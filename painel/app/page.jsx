import Link from 'next/link';
import { categoriasRaiz, fonteDados, lerFiltros, listarProdutos, ORDENS, POR_PAGINA } from '@/lib/dados';
import { dataBR, dolar, faixaNota, numero, variacao } from '@/lib/formato';

export const dynamic = 'force-dynamic';

function urlCom(sp, mudancas) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...mudancas })) if (v !== undefined && v !== '' && v !== null) p.set(k, v);
  return `/?${p}`;
}

export default async function Inicio({ searchParams }) {
  const sp = await searchParams;
  const f = lerFiltros(sp);
  const [{ itens, total, ultima }, cats] = await Promise.all([listarProdutos(f), categoriasRaiz()]);
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <>
      <div className="cabeca">
        <div>
          <h1>Oportunidades na Amazon US</h1>
          <p>
            Top 100 de cada categoria e subcategoria, com nota de 0 a 100 para importar da China e vender via FBA.
          </p>
        </div>
        <p className="num">
          Coleta: {dataBR(ultima)} · {fonteDados()}
        </p>
      </div>

      <form className="filtros" method="get">
        <label className="busca">
          Buscar
          <input name="q" defaultValue={f.q} placeholder="ex: silicone, dog, organizer…" />
        </label>
        <label>
          Categoria
          <select name="categoria" defaultValue={f.categoria}>
            <option value="">Todas</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </label>
        <label>
          Preço mín.
          <input name="precoMin" type="number" min="0" step="1" defaultValue={f.precoMin ?? ''} placeholder="US$" />
        </label>
        <label>
          Preço máx.
          <input name="precoMax" type="number" min="0" step="1" defaultValue={f.precoMax ?? ''} placeholder="US$" />
        </label>
        <label>
          Reviews até
          <input name="reviewsMax" type="number" min="0" step="50" defaultValue={f.reviewsMax ?? ''} placeholder="ex: 500" />
        </label>
        <label>
          Marcas fortes
          <select name="marcas" defaultValue={f.marcas}>
            <option value="ocultar">Ocultar</option>
            <option value="mostrar">Mostrar</option>
          </select>
        </label>
        <label>
          Ordenar por
          <select name="ordem" defaultValue={f.ordem}>
            {Object.entries(ORDENS).map(([k, o]) => (
              <option key={k} value={k}>{o.rotulo}</option>
            ))}
          </select>
        </label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
          <label className="check">
            <input type="checkbox" name="subindo" value="1" defaultChecked={f.subindo} /> Subindo
          </label>
          <button className="botao" type="submit">Filtrar</button>
        </div>
      </form>

      <div className="resumo">
        <span className="num">{numero(total)} produtos</span>
        <span>Vendas/mês são estimativas pelo ranking, servem para comparar e não como número exato.</span>
      </div>

      <div className="tabela">
        <div className="linha cab">
          <span>Nota</span>
          <span />
          <span>Produto</span>
          <span className="dir">Preço</span>
          <span className="dir">Reviews</span>
          <span className="dir">Vendas/mês</span>
          <span className="dir">7 dias</span>
          <span className="dir">Rank</span>
        </div>
        {itens.length === 0 && (
          <div className="vazio">
            {ultima ? 'Nenhum produto com esses filtros.' : 'Ainda não há coleta. Rode o coletor para preencher o painel.'}
          </div>
        )}
        {itens.map((p) => {
          const v = variacao(p);
          return (
            <Link key={p.asin} href={`/produto/${p.asin}`} className="linha">
              <span className={`nota ${faixaNota(p.nota_oportunidade)}`}>{p.nota_oportunidade}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="thumb" src={p.imagem} alt="" loading="lazy" />
              <div>
                <div className="titulo">{p.titulo}</div>
                <div className="sub">
                  {p.categoria_nome}
                  {p.em_lancamentos && <span className="selo">lançamento</span>}
                  {p.marca_forte && <span className="selo">marca forte</span>}
                </div>
                <div className="mobile-dados num">
                  <span>{dolar(p.preco)}</span>
                  <span>{numero(p.reviews)} reviews</span>
                  <span>~{numero(p.vendas_mes_est)}/mês</span>
                  <span className={v.classe}>{v.texto}</span>
                </div>
              </div>
              <span className="dir num">{dolar(p.preco)}</span>
              <div className="dir num">
                {numero(p.reviews)}
                {p.nota != null && <div className="sub"><span className="estrela">★</span> {p.nota}</div>}
              </div>
              <span className="dir num">~{numero(p.vendas_mes_est)}</span>
              <span className={`dir num ${v.classe}`}>{v.texto}</span>
              <span className="dir num">#{p.rank_atual}</span>
            </Link>
          );
        })}
      </div>

      {paginas > 1 && (
        <div className="paginacao num">
          {f.pagina > 1 && <Link className="botao leve" href={urlCom(sp, { pagina: f.pagina - 1 })}>← Anterior</Link>}
          <span>{f.pagina} / {paginas}</span>
          {f.pagina < paginas && <Link className="botao leve" href={urlCom(sp, { pagina: f.pagina + 1 })}>Próxima →</Link>}
        </div>
      )}
    </>
  );
}
