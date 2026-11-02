export const dolar = (v) =>
  v == null ? '—' : v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export const numero = (v) => (v == null ? '—' : Math.round(v).toLocaleString('pt-BR'));

export const dataBR = (iso) => (iso ? iso.split('-').reverse().join('/') : '—');

export function variacao(p) {
  if (p.entrou_na_lista) return { texto: 'entrou', classe: 'sobe' };
  if (p.variacao_pct == null) return { texto: '—', classe: '' };
  const pct = Math.round(p.variacao_pct * 100);
  if (pct === 0) return { texto: '0%', classe: '' };
  return { texto: `${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}%`, classe: pct > 0 ? 'sobe' : 'desce' };
}

export const faixaNota = (n) => (n >= 70 ? 'alta' : n >= 50 ? 'media' : 'baixa');

// Palavras-chave para buscar fornecedor: título sem marca e sem enfeites, ~7 palavras
export function palavrasChave(titulo, marca) {
  let t = titulo.replace(/[|,(\[].*$/, '');
  if (marca) t = t.replace(new RegExp('^' + marca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '');
  return t.replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/).filter(Boolean).slice(0, 7).join(' ');
}
