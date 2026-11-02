-- Rode isto uma vez no Supabase: painel do projeto → SQL Editor → New query → colar → Run.

create table if not exists categorias (
  id text primary key,          -- 'kitchen' ou 'kitchen/289668'
  slug text not null,
  node text,
  nome text not null,
  pai text
);

create table if not exists produtos (
  asin text primary key,
  titulo text not null,
  imagem text,
  url text,
  preco numeric,
  nota numeric,
  reviews int default 0,
  categoria_id text,
  categoria_raiz text,
  categoria_nome text,
  lista_principal text,
  rank_atual int,
  rank_ref int,                 -- ranking na data de comparação (até 7 dias atrás)
  variacao_pct numeric,         -- +0.5 = subiu 50% no ranking
  entrou_na_lista boolean default false,
  em_lancamentos boolean default false,
  vendas_mes_est int,
  marca_forte text,
  nota_oportunidade int,
  componentes jsonb,
  primeira_vez date not null default current_date,
  ultima_vez date not null
);

create table if not exists snapshots (
  data date not null,
  asin text not null,
  categoria_id text not null,
  lista text not null,
  rank int not null,
  preco numeric,
  nota numeric,
  reviews int,
  primary key (data, asin, categoria_id, lista)
);

create index if not exists snapshots_asin on snapshots (asin, data);
create index if not exists snapshots_data_lista on snapshots (data, lista);
create index if not exists produtos_nota on produtos (ultima_vez, nota_oportunidade desc);

-- Acesso só pelo servidor (coletor e painel usam a service key). Sem políticas = ninguém
-- de fora lê nada pela chave pública.
alter table categorias enable row level security;
alter table produtos enable row level security;
alter table snapshots enable row level security;
