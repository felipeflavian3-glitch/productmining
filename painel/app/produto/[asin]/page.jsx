import Link from 'next/link';
import { notFound } from 'next/navigation';
import { obterProduto } from '@/lib/dados';
import { dataBR, dolar, faixaNota, numero, palavrasChave, variacao } from '@/lib/formato';

export const dynamic = 'force-dynamic';

const COMPONENTES = [
  { chave: 'demanda', rotulo: 'Demanda', max: 30 },
  { chave: 'concorrencia', rotulo: 'Concorrência', max: 25 },
  { chave: 'tendencia', rotulo: 'Tendência', max: 20 },
  { chave: 'preco', rotulo: 'Faixa de preço', max: 15 },
  { chave: 'avaliacao', rotulo: 'Espaço p/ melhorar', max: 10 },
  { chave: 'categoria', rotulo: 'Risco da categoria', max: 0 },
  { chave: 'marca', rotulo: 'Marca forte', max: 0 },
];

const NOMES_LISTA = { bestsellers: 'Mais vendidos', new: 'Lançamentos', movers: 'Em alta', wished: 'Mais desejados' };

// Gráfico de ranking no tempo (rank menor = mais alto no gráfico)
function GraficoRank({ pontos }) {
  const L = 640, A = 160, m = { e: 40, d: 12, t: 12, b: 24 };
  const ranks = pontos.map((p) => p.rank);
  const min = Math.min(...ranks), max = Math.max(...ranks);
  const x = (i) => m.e + (pontos.length === 1 ? (L - m.e - m.d) / 2 : (i * (L - m.e - m.d)) / (pontos.length - 1));
  const y = (r) => m.t + (max === min ? (A - m.t - m.b) / 2 : ((r - min) * (A - m.t - m.b)) / (max - min));
  const caminho = pontos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.rank).toFixed(1)}`).join(' ');
  return (
    <svg className="grafico" viewBox={`0 0 ${L} ${A}`} role="img" aria-label="Ranking ao longo do tempo">
      <line className="eixo" x1={m.e} x2={L - m.d} y1={A - m.b} y2={A - m.b} />
      <text x={m.e - 6} y={m.t + 4} textAnchor="end">#{min}</text>
      {max !== min && <text x={m.e - 6} y={A - m.b} textAnchor="end">#{max}</text>}
      <path className="serie" d={caminho} />
      {pontos.map((p, i) => (
        <circle key={p.data} className="ponto" cx={x(i)} cy={y(p.rank)} r="3">
          <title>{`${dataBR(p.data)}: #${p.rank}`}</title>
        </circle>
      ))}
      <text x={m.e} y={A - 6}>{dataBR(pontos[0].data)}</text>
      {pontos.length > 1 && <text x={L - m.d} y={A - 6} textAnchor="end">{dataBR(pontos.at(-1).data)}</text>}
    </svg>
  );
}

export default async function Produto({ params }) {
  const { asin } = await params;
  const p = await obterProduto(asin);
  if (!p) notFound();

  const v = variacao(p);
  const kw = encodeURIComponent(palavrasChave(p.titulo, p.marca_forte));
  const imgGrande = p.imagem?.replace(/\._[^.]+_\./, '._AC_SL500_.');

  // Uma série por categoria + lista
  const series = new Map();
  for (const h of p.historico) {
    const chave = `${h.categoria_id}|${h.lista}`;
    if (!series.has(chave)) series.set(chave, []);
    series.get(chave).push(h);
  }
  const nomeCat = (id) => {
    const c = p.categorias[id];
    if (!c) return id;
    return c.pai ? `${p.categorias[c.pai]?.nome ?? c.pai} › ${c.nome}` : c.nome;
  };
  const dias = new Set(p.historico.map((h) => h.data)).size;

  return (
    <>
      <Link href="/" className="voltar">← Voltar ao ranking</Link>
      <div className="produto">
        <div className="pilha">
          <div className="painel">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="foto" src={imgGrande} alt={p.titulo} />
          </div>
          <div className="painel">
            <h2>Achar fornecedor</h2>
            <div className="links">
              <a className="botao leve" target="_blank" rel="noreferrer" href={`https://www.alibaba.com/trade/search?SearchText=${kw}`}>Alibaba</a>
              <a className="botao leve" target="_blank" rel="noreferrer" href={`https://www.aliexpress.com/wholesale?SearchText=${kw}`}>AliExpress</a>
              <a className="botao leve" target="_blank" rel="noreferrer" href={`https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imgGrande)}`}>Busca por imagem</a>
            </div>
            <p className="explica">
              A busca por imagem costuma achar o mesmo produto no 1688 e no Alibaba. A calculadora de margem chega na Fase 2.
            </p>
          </div>
        </div>

        <div className="pilha">
          <div className="painel">
            <div style={{ display: 'flex', gap: 14, alignItems: 'start' }}>
              <span className={`nota ${faixaNota(p.nota_oportunidade)}`} style={{ width: 56, height: 44, fontSize: 20 }}>
                {p.nota_oportunidade}
              </span>
              <div style={{ minWidth: 0 }}>
                <h1>{p.titulo}</h1>
                <div className="sub" style={{ whiteSpace: 'normal' }}>
                  {p.categoria_nome} · ASIN <span className="num">{p.asin}</span>
                  {p.marca_forte && <span className="selo">marca forte: {p.marca_forte}</span>}
                </div>
              </div>
            </div>
            <div className="metricas">
              <div className="metrica"><span>Preço</span><strong className="num">{dolar(p.preco)}</strong></div>
              <div className="metrica"><span>Vendas/mês (est.)</span><strong className="num">~{numero(p.vendas_mes_est)}</strong></div>
              <div className="metrica"><span>Reviews</span><strong className="num">{numero(p.reviews)}</strong></div>
              <div className="metrica"><span>Avaliação</span><strong className="num">{p.nota ?? '—'} <span className="estrela" style={{ display: 'inline' }}>★</span></strong></div>
              <div className="metrica"><span>Rank atual</span><strong className="num">#{p.rank_atual}</strong></div>
              <div className="metrica"><span>7 dias</span><strong className={`num ${v.classe}`}>{v.texto}</strong></div>
            </div>
            <div className="links">
              <a className="botao" href={p.url} target="_blank" rel="noreferrer">Ver na Amazon ↗</a>
            </div>
          </div>

          <div className="painel">
            <h2>Por que essa nota</h2>
            {COMPONENTES.map(({ chave, rotulo, max }) => {
              const val = p.componentes?.[chave] ?? 0;
              if (max === 0 && val === 0) return null;
              const neg = val < 0;
              const largura = max ? Math.max(0, (val / max) * 100) : Math.min(100, Math.abs(val) * 5);
              return (
                <div className="comp" key={chave}>
                  <span>{rotulo}</span>
                  <div className={`barra ${neg ? 'neg' : ''}`}><i style={{ width: `${neg ? Math.min(100, Math.abs(val) * 5) : largura}%` }} /></div>
                  <span className="num dir">{val}{max ? `/${max}` : ''}</span>
                </div>
              );
            })}
            <p className="explica">
              Demanda vem do ranking. Concorrência é melhor com poucas reviews. Nota entre 3,5 e 4,3 indica clientes
              insatisfeitos, ou seja, espaço para uma versão melhor. Preço ideal entre US$ 20 e 70; abaixo de US$ 12 a FBA come a margem.
            </p>
          </div>

          <div className="painel">
            <h2>Ranking no tempo</h2>
            {[...series].map(([chave, pts]) => {
              const [cat, lista] = chave.split('|');
              return (
                <div key={chave}>
                  <div className="legenda-graf">{nomeCat(cat)} · {NOMES_LISTA[lista] ?? lista}</div>
                  <GraficoRank pontos={pts} />
                </div>
              );
            })}
            {dias < 3 && (
              <p className="explica">
                O histórico começa em {dataBR(p.primeira_vez)}. A linha fica útil depois de 1 a 2 semanas de coleta diária.
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
