// Coleta diária: lê as listas, calcula tendência e nota, grava no banco.
//
//   node src/run.js                      → produção (Supabase)
//   node src/run.js --local              → grava em data/local.json
//   --categorias=kitchen,pet-supplies    → só essas categorias
//   --listas=bestsellers,new             → quais listas
//   --subcats=8 --paginas=2              → profundidade
//   --data=2026-11-02                    → força a data (para testes)
import { CATEGORIAS, PADROES } from './config.js';
import { abrirNavegador, Bloqueado, lerLista, lerSubcategorias, urlLista } from './amazon.js';
import { calcularNota, estimarVendasMes, marcaForte } from './nota.js';
import { criarArmazenamento } from './armazenamento.js';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const lista = (v, padrao) => (typeof v === 'string' ? v.split(',').filter(Boolean) : padrao);

const opcoes = {
  categorias: lista(args.categorias, null),
  listas: lista(args.listas, PADROES.listas),
  subcats: args.subcats !== undefined ? Number(args.subcats) : PADROES.subcategorias,
  paginas: args.paginas !== undefined ? Number(args.paginas) : PADROES.paginas,
};
const hoje = typeof args.data === 'string' ? args.data : new Date().toISOString().slice(0, 10);
const categorias = opcoes.categorias
  ? CATEGORIAS.filter((c) => opcoes.categorias.includes(c.slug))
  : CATEGORIAS;

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const pausa = () => esperar(PADROES.pausaMin + Math.random() * (PADROES.pausaMax - PADROES.pausaMin));

class Parar extends Error {}

const armazenamento = criarArmazenamento({ local: !!args.local });
const { browser, novaPagina } = await abrirNavegador();
let page = await novaPagina();
let bloqueios = 0;
let paginasLidas = 0;

async function visitar(url) {
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      const itens = await lerLista(page, url);
      paginasLidas++;
      return itens;
    } catch (e) {
      if (e instanceof Bloqueado) {
        bloqueios++;
        console.warn(`  ⚠ captcha/bloqueio (${bloqueios}/${PADROES.maxBloqueios}) em ${url}`);
        if (bloqueios >= PADROES.maxBloqueios) throw new Parar();
        await page.context().close();
        await esperar(60000 * bloqueios);
        page = await novaPagina();
      } else {
        console.warn(`  ⚠ erro em ${url}: ${e.message.split('\n')[0]}`);
        if (tentativa === 2) return [];
        await esperar(5000);
      }
    }
  }
  return [];
}

// ---------- 1. Coleta ----------
const cats = [];
const snapshots = new Map(); // chave → linha
const aparicoes = new Map(); // asin → [{categoria, lista, rank}]
const detalhes = new Map(); // asin → dados mais recentes do produto

function registrar(itens, alvo, nomeLista) {
  for (const it of itens) {
    const chave = `${it.asin}|${alvo.id}|${nomeLista}`;
    if (snapshots.has(chave)) continue;
    snapshots.set(chave, {
      data: hoje, asin: it.asin, categoria_id: alvo.id, lista: nomeLista,
      rank: it.rank, preco: it.preco, nota: it.nota, reviews: it.reviews,
    });
    if (!aparicoes.has(it.asin)) aparicoes.set(it.asin, []);
    aparicoes.get(it.asin).push({ alvo, lista: nomeLista, rank: it.rank });
    const antes = detalhes.get(it.asin);
    detalhes.set(it.asin, { ...antes, ...Object.fromEntries(Object.entries(it).filter(([, v]) => v != null)) });
  }
}

const inicio = Date.now();
try {
  for (const cat of categorias) {
    console.log(`\n■ ${cat.nome} (${cat.slug})`);
    const raiz = { id: cat.slug, cat, nome: cat.nome, node: null, sub: false };
    cats.push({ id: raiz.id, slug: cat.slug, node: null, nome: cat.nome, pai: null });
    const alvos = [raiz];

    for (let i = 0; i < alvos.length; i++) {
      const alvo = alvos[i];
      for (const nomeLista of opcoes.listas) {
        const maxPg = nomeLista === 'bestsellers' ? opcoes.paginas : Math.min(opcoes.paginas, PADROES.paginasOutrasListas);
        for (let pg = 1; pg <= maxPg; pg++) {
          const itens = await visitar(urlLista(nomeLista, cat.slug, alvo.node, pg));
          registrar(itens, alvo, nomeLista);
          console.log(`  ${alvo.nome} · ${nomeLista} · pág ${pg}: ${itens.length}`);

          // Na primeira página da categoria principal, descobre as subcategorias
          if (i === 0 && nomeLista === 'bestsellers' && pg === 1 && opcoes.subcats > 0) {
            const subs = (await lerSubcategorias(page, cat.slug)).slice(0, opcoes.subcats);
            for (const s of subs) {
              const id = `${cat.slug}/${s.node}`;
              alvos.push({ id, cat, nome: s.nome, node: s.node, sub: true });
              cats.push({ id, slug: cat.slug, node: s.node, nome: s.nome, pai: cat.slug });
            }
          }
          await pausa();
          if (itens.length < 50) break; // não tem página seguinte
        }
      }
    }
  }
} catch (e) {
  if (!(e instanceof Parar)) throw e;
  console.warn('\n⛔ Muitos bloqueios seguidos — parando a coleta e salvando o que já foi lido.');
}
await browser.close();

// ---------- 2. Tendência (compara com até 7 dias atrás) ----------
const dataRef = await armazenamento.dataReferencia(hoje);
const ref = dataRef ? await armazenamento.snapshotsDoDia(dataRef, 'bestsellers') : [];
const rankRef = new Map(ref.map((s) => [`${s.asin}|${s.categoria_id}`, s.rank]));
const catsComHistorico = new Set(ref.map((s) => s.categoria_id));

// ---------- 3. Nota de cada produto ----------
const produtos = [];
for (const [asin, aps] of aparicoes) {
  const d = detalhes.get(asin);
  const bs = aps.filter((a) => a.lista === 'bestsellers');
  // Categoria principal: a subcategoria mais específica onde aparece nos mais vendidos
  const ordenar = (arr) => [...arr].sort((a, b) => (b.alvo.sub - a.alvo.sub) || (a.rank - b.rank));
  const principal = ordenar(bs)[0] ?? ordenar(aps)[0];

  const vendasMesEst = bs.length
    ? Math.max(...bs.map((a) => estimarVendasMes(a.rank, a.alvo.cat.k, a.alvo.sub)))
    : Math.round(estimarVendasMes(principal.rank, principal.alvo.cat.k, principal.alvo.sub) * 0.3);

  const temHistorico = principal.lista === 'bestsellers' && catsComHistorico.has(principal.alvo.id);
  const rRef = rankRef.get(`${asin}|${principal.alvo.id}`) ?? null;
  const variacaoPct = temHistorico && rRef ? (rRef - principal.rank) / rRef : null;
  const entrouNaLista = temHistorico && !rRef;
  const marca = marcaForte(d.titulo);

  const { nota, componentes } = calcularNota({
    vendasMesEst, reviews: d.reviews, preco: d.preco, nota: d.nota,
    variacaoPct, entrouNaLista, temHistorico,
    emLancamentos: aps.some((a) => a.lista === 'new'),
    penalidadeCategoria: principal.alvo.cat.penalidade, marca,
  });

  produtos.push({
    asin,
    titulo: d.titulo,
    imagem: d.imagem,
    url: d.url,
    preco: d.preco ?? null,
    nota: d.nota ?? null,
    reviews: d.reviews ?? 0,
    categoria_id: principal.alvo.id,
    categoria_raiz: principal.alvo.cat.slug,
    categoria_nome: principal.alvo.sub ? `${principal.alvo.cat.nome} › ${principal.alvo.nome}` : principal.alvo.cat.nome,
    lista_principal: principal.lista,
    rank_atual: principal.rank,
    rank_ref: rRef,
    variacao_pct: variacaoPct,
    entrou_na_lista: entrouNaLista,
    em_lancamentos: aps.some((a) => a.lista === 'new'),
    vendas_mes_est: vendasMesEst,
    marca_forte: marca ?? null,
    nota_oportunidade: nota,
    componentes,
    ultima_vez: hoje,
  });
}

// ---------- 4. Grava ----------
await armazenamento.salvarCategorias(cats);
await armazenamento.salvarSnapshots([...snapshots.values()]);
await armazenamento.salvarProdutos(produtos);
await armazenamento.limparAntigos(hoje, PADROES.retencaoDias);
await armazenamento.finalizar();

const min = ((Date.now() - inicio) / 60000).toFixed(1);
console.log(`\n✔ ${hoje}: ${paginasLidas} páginas, ${snapshots.size} posições, ${produtos.length} produtos em ${min} min.`);
console.log(dataRef ? `  Tendência comparada com ${dataRef}.` : '  Primeiro dia: ainda sem histórico para tendência.');
console.log('\nTop 10 oportunidades:');
for (const p of [...produtos].sort((a, b) => b.nota_oportunidade - a.nota_oportunidade).slice(0, 10)) {
  console.log(`  ${String(p.nota_oportunidade).padStart(3)} · $${p.preco ?? '?'} · ${p.reviews} reviews · ${p.titulo.slice(0, 60)}`);
}
if (paginasLidas === 0) process.exit(1);
