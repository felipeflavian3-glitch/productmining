// Leitura dos dados: Supabase quando configurado, senão o local.json do coletor (teste no PC).
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const POR_PAGINA = 50;

export const ORDENS = {
  nota: { rotulo: 'Nota de oportunidade', campo: 'nota_oportunidade', asc: false },
  vendas: { rotulo: 'Vendas estimadas', campo: 'vendas_mes_est', asc: false },
  tendencia: { rotulo: 'Maior subida', campo: 'variacao_pct', asc: false },
  reviews: { rotulo: 'Menos reviews', campo: 'reviews', asc: true },
  preco: { rotulo: 'Menor preço', campo: 'preco', asc: true },
  novos: { rotulo: 'Vistos pela 1ª vez', campo: 'primeira_vez', asc: false },
};

const usaSupabase = () => !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);

let cliente;
function db() {
  cliente ??= createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
  return cliente;
}
const ok = ({ data, error, count }) => {
  if (error) throw new Error(error.message);
  return count !== undefined && count !== null ? { data, count } : data;
};

async function lerLocal() {
  const arquivo = join(process.cwd(), '..', 'coletor', 'data', 'local.json');
  try {
    return JSON.parse(await readFile(arquivo, 'utf8'));
  } catch {
    return { categorias: {}, produtos: {}, snapshots: [] };
  }
}

const diaAnterior = (data) => {
  const d = new Date(data + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

// Converte os parâmetros da URL em filtros
export function lerFiltros(sp) {
  const n = (v) => (v === undefined || v === '' ? null : Number(v));
  return {
    q: (sp.q || '').trim(),
    categoria: sp.categoria || '',
    precoMin: n(sp.precoMin),
    precoMax: n(sp.precoMax),
    reviewsMax: n(sp.reviewsMax),
    notaMin: n(sp.notaMin),
    marcas: sp.marcas === 'mostrar' ? 'mostrar' : 'ocultar',
    subindo: sp.subindo === '1',
    ordem: ORDENS[sp.ordem] ? sp.ordem : 'nota',
    pagina: Math.max(1, Number(sp.pagina) || 1),
  };
}

export async function categoriasRaiz() {
  if (usaSupabase()) {
    return ok(await db().from('categorias').select('id,nome').is('pai', null).order('nome'));
  }
  const d = await lerLocal();
  return Object.values(d.categorias).filter((c) => !c.pai).sort((a, b) => a.nome.localeCompare(b.nome));
}

export async function ultimaColeta() {
  if (usaSupabase()) {
    const r = ok(await db().from('produtos').select('ultima_vez').order('ultima_vez', { ascending: false }).limit(1));
    return r[0]?.ultima_vez ?? null;
  }
  const d = await lerLocal();
  return Object.values(d.produtos).map((p) => p.ultima_vez).sort().at(-1) ?? null;
}

export async function listarProdutos(f) {
  const ultima = await ultimaColeta();
  if (!ultima) return { itens: [], total: 0, ultima: null };
  const desde = diaAnterior(ultima); // produtos que sumiram das listas há mais de 1 dia saem
  const ordem = ORDENS[f.ordem];
  const de = (f.pagina - 1) * POR_PAGINA;

  if (usaSupabase()) {
    let q = db().from('produtos').select('*', { count: 'exact' }).gte('ultima_vez', desde);
    if (f.q) q = q.ilike('titulo', `%${f.q}%`);
    if (f.categoria) q = q.eq('categoria_raiz', f.categoria);
    if (f.precoMin != null) q = q.gte('preco', f.precoMin);
    if (f.precoMax != null) q = q.lte('preco', f.precoMax);
    if (f.reviewsMax != null) q = q.lte('reviews', f.reviewsMax);
    if (f.notaMin != null) q = q.gte('nota_oportunidade', f.notaMin);
    if (f.marcas === 'ocultar') q = q.is('marca_forte', null);
    if (f.subindo) q = q.or('variacao_pct.gt.0,entrou_na_lista.eq.true');
    q = q.order(ordem.campo, { ascending: ordem.asc, nullsFirst: false }).order('asin');
    const { data, count } = ok(await q.range(de, de + POR_PAGINA - 1));
    return { itens: data, total: count, ultima };
  }

  const d = await lerLocal();
  const busca = f.q.toLowerCase();
  const todos = Object.values(d.produtos).filter(
    (p) =>
      p.ultima_vez >= desde &&
      (!busca || p.titulo.toLowerCase().includes(busca)) &&
      (!f.categoria || p.categoria_raiz === f.categoria) &&
      (f.precoMin == null || (p.preco != null && p.preco >= f.precoMin)) &&
      (f.precoMax == null || (p.preco != null && p.preco <= f.precoMax)) &&
      (f.reviewsMax == null || p.reviews <= f.reviewsMax) &&
      (f.notaMin == null || p.nota_oportunidade >= f.notaMin) &&
      (f.marcas === 'mostrar' || !p.marca_forte) &&
      (!f.subindo || p.variacao_pct > 0 || p.entrou_na_lista),
  );
  const val = (p) => p[ordem.campo];
  todos.sort((a, b) => {
    const va = val(a), vb = val(b);
    if (va == null && vb == null) return a.asin.localeCompare(b.asin);
    if (va == null) return 1;
    if (vb == null) return -1;
    const c = va < vb ? -1 : va > vb ? 1 : 0;
    return (ordem.asc ? c : -c) || a.asin.localeCompare(b.asin);
  });
  return { itens: todos.slice(de, de + POR_PAGINA), total: todos.length, ultima };
}

export async function obterProduto(asin) {
  if (usaSupabase()) {
    const [p] = ok(await db().from('produtos').select('*').eq('asin', asin).limit(1));
    if (!p) return null;
    const historico = ok(
      await db().from('snapshots').select('data,categoria_id,lista,rank,preco,reviews').eq('asin', asin).order('data'),
    );
    const ids = [...new Set(historico.map((h) => h.categoria_id))];
    const cats = ids.length ? ok(await db().from('categorias').select('id,nome,pai').in('id', ids)) : [];
    return { ...p, historico, categorias: Object.fromEntries(cats.map((c) => [c.id, c])) };
  }
  const d = await lerLocal();
  const p = d.produtos[asin];
  if (!p) return null;
  const historico = d.snapshots.filter((s) => s.asin === asin).sort((a, b) => a.data.localeCompare(b.data));
  return { ...p, historico, categorias: d.categorias };
}

export const fonteDados = () => (usaSupabase() ? 'Supabase' : 'arquivo local (teste)');
