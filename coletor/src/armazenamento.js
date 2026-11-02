// Onde os dados ficam: Supabase (produção) ou data/local.json (teste no PC, sem contas).
import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const LOTE = 500;
const lotes = (arr, n = LOTE) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const somarDias = (data, dias) => {
  const d = new Date(data + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

export function criarArmazenamento({ local }) {
  return local ? armazenamentoLocal() : armazenamentoSupabase();
}

function armazenamentoSupabase() {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Defina SUPABASE_URL e SUPABASE_SERVICE_KEY (ou rode com --local).');
  }
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const ok = ({ data, error }) => {
    if (error) throw new Error(error.message);
    return data;
  };

  return {
    async salvarCategorias(cats) {
      ok(await db.from('categorias').upsert(cats));
    },
    async salvarSnapshots(rows) {
      for (const l of lotes(rows)) ok(await db.from('snapshots').upsert(l));
    },
    async dataReferencia(hoje) {
      const r = ok(
        await db.from('snapshots').select('data').gte('data', somarDias(hoje, -7)).lt('data', hoje)
          .order('data').limit(1),
      );
      return r[0]?.data ?? null;
    },
    async snapshotsDoDia(data, lista) {
      const todos = [];
      for (let de = 0; ; de += 1000) {
        const r = ok(
          await db.from('snapshots').select('asin,categoria_id,rank').eq('data', data).eq('lista', lista)
            .range(de, de + 999),
        );
        todos.push(...r);
        if (r.length < 1000) return todos;
      }
    },
    async salvarProdutos(prods) {
      // primeira_vez não vai no payload: o default do banco preenche só em produto novo
      for (const l of lotes(prods)) ok(await db.from('produtos').upsert(l));
    },
    async limparAntigos(hoje, dias) {
      ok(await db.from('snapshots').delete().lt('data', somarDias(hoje, -dias)));
    },
    async finalizar() {},
  };
}

function armazenamentoLocal() {
  const arquivo = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'local.json');
  const dados = existsSync(arquivo)
    ? JSON.parse(readFileSync(arquivo, 'utf8'))
    : { categorias: {}, produtos: {}, snapshots: [] };
  const chaveSnap = (s) => `${s.data}|${s.asin}|${s.categoria_id}|${s.lista}`;

  return {
    async salvarCategorias(cats) {
      for (const c of cats) dados.categorias[c.id] = c;
    },
    async salvarSnapshots(rows) {
      const idx = new Map(dados.snapshots.map((s, i) => [chaveSnap(s), i]));
      for (const r of rows) {
        const i = idx.get(chaveSnap(r));
        if (i === undefined) dados.snapshots.push(r);
        else dados.snapshots[i] = r;
      }
    },
    async dataReferencia(hoje) {
      const min = somarDias(hoje, -7);
      const datas = dados.snapshots.map((s) => s.data).filter((d) => d >= min && d < hoje).sort();
      return datas[0] ?? null;
    },
    async snapshotsDoDia(data, lista) {
      return dados.snapshots.filter((s) => s.data === data && s.lista === lista);
    },
    async salvarProdutos(prods) {
      for (const p of prods) {
        const antigo = dados.produtos[p.asin];
        dados.produtos[p.asin] = { primeira_vez: antigo?.primeira_vez ?? p.ultima_vez, ...p };
      }
    },
    async limparAntigos(hoje, dias) {
      const min = somarDias(hoje, -dias);
      dados.snapshots = dados.snapshots.filter((s) => s.data >= min);
    },
    async finalizar() {
      mkdirSync(dirname(arquivo), { recursive: true });
      writeFileSync(arquivo, JSON.stringify(dados));
      console.log(`Dados salvos em ${arquivo}`);
    },
  };
}
