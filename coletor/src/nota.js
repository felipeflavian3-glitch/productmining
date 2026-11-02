// Nota de oportunidade (0-100) e estimativa de vendas a partir do ranking.
import { EXPOENTE_RANK, FATOR_SUBCATEGORIA, MARCAS_FORTES } from './config.js';

// Vendas/mês ≈ k × rank^-0.75. Ordem de grandeza, serve para comparar produtos.
export function estimarVendasMes(rank, k, ehSubcategoria) {
  const base = ehSubcategoria ? k * FATOR_SUBCATEGORIA : k;
  return Math.round(base * Math.pow(rank, -EXPOENTE_RANK));
}

const limitar = (v, min, max) => Math.max(min, Math.min(max, v));

function pontosDemanda(vendas) {
  // 300/mês → 0 pts, 10.000/mês → 30 pts (escala logarítmica)
  if (!vendas || vendas < 300) return 0;
  return Math.round(limitar((Math.log10(vendas) - Math.log10(300)) / (4 - Math.log10(300)), 0, 1) * 30);
}

function pontosConcorrencia(reviews) {
  // Poucas reviews no Top 100 = dá para entrar sem anos de histórico
  if (reviews < 100) return 25;
  if (reviews < 500) return 20;
  if (reviews < 2000) return 12;
  if (reviews < 10000) return 5;
  return 0;
}

function pontosPreco(preco) {
  // Faixa boa para FBA: paga as taxas e ainda cabe margem, sem ser caro demais para testar
  // Abaixo de ~US$12 a taxa FBA + comissão de 15% praticamente zera o lucro
  if (!preco) return 0;
  if (preco >= 20 && preco <= 70) return 15;
  if ((preco >= 15 && preco < 20) || (preco > 70 && preco <= 100)) return 8;
  if (preco < 8) return -20;
  if (preco < 12) return -10;
  return 0;
}

function pontosAvaliacao(nota) {
  // Nota mediana = clientes reclamando = espaço para uma versão melhorada
  if (!nota) return 5;
  if (nota >= 3.5 && nota < 4.3) return 10;
  if (nota >= 4.3 && nota < 4.6) return 6;
  if (nota >= 4.6) return 3;
  return 4;
}

function pontosTendencia({ variacaoPct, entrouNaLista, emLancamentos, temHistorico }) {
  let p = 0;
  if (temHistorico) {
    if (variacaoPct != null) p += limitar(Math.round(variacaoPct * 30), -10, 15); // +50% de subida = 15
    if (entrouNaLista) p += 8;
  } else {
    p += 5; // neutro enquanto não há histórico
  }
  if (emLancamentos) p += 5;
  return limitar(p, -10, 20);
}

export function marcaForte(titulo) {
  const t = (titulo || '').toLowerCase();
  return MARCAS_FORTES.find((m) => t.startsWith(m + ' ') || t.startsWith(m + ',') || t.startsWith(m + '®'));
}

export function calcularNota(p) {
  const comp = {
    demanda: pontosDemanda(p.vendasMesEst),
    concorrencia: pontosConcorrencia(p.reviews ?? 0),
    preco: pontosPreco(p.preco),
    avaliacao: pontosAvaliacao(p.nota),
    tendencia: pontosTendencia(p),
    categoria: -(p.penalidadeCategoria || 0),
    marca: p.marca ? -15 : 0,
  };
  const total = Object.values(comp).reduce((a, b) => a + b, 0);
  return { nota: limitar(Math.round(total), 0, 100), componentes: comp };
}
