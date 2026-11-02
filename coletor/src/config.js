// Categorias da Amazon US que fazem sentido para importar da China e vender via FBA.
// Ficaram de fora: livros, digitais, mercado/alimentos (FDA), roupas (tamanhos/devoluções),
// eletrodomésticos grandes (frete) e tudo que exige licença.
//
// k = vendas/mês estimadas do #1 da categoria principal. É um chute calibrado para dar
// ordem de grandeza, não número exato — a Amazon não divulga vendas.
// penalidade = pontos tirados da nota por risco da categoria (certificação, devolução, etc).
export const CATEGORIAS = [
  { slug: 'home-garden', nome: 'Casa e Cozinha', k: 90000 },
  { slug: 'kitchen', nome: 'Cozinha e Mesa', k: 60000 },
  { slug: 'pet-supplies', nome: 'Pet', k: 45000 },
  { slug: 'sporting-goods', nome: 'Esporte e Lazer', k: 40000 },
  { slug: 'beauty', nome: 'Beleza', k: 70000, penalidade: 5 },
  { slug: 'hpc', nome: 'Saúde e Casa', k: 80000, penalidade: 8 },
  { slug: 'toys-and-games', nome: 'Brinquedos', k: 50000, penalidade: 8 },
  { slug: 'office-products', nome: 'Escritório', k: 35000 },
  { slug: 'baby-products', nome: 'Bebê', k: 30000, penalidade: 10 },
  { slug: 'automotive', nome: 'Automotivo', k: 30000 },
  { slug: 'hi', nome: 'Ferramentas e Reforma', k: 40000 },
  { slug: 'lawn-garden', nome: 'Jardim e Área Externa', k: 25000 },
  { slug: 'arts-crafts', nome: 'Artesanato', k: 25000 },
  { slug: 'wireless', nome: 'Acessórios de Celular', k: 45000, penalidade: 5 },
  { slug: 'electronics', nome: 'Eletrônicos', k: 50000, penalidade: 12 },
];

// Listas públicas. Movers & Shakers e Most Wished For estavam voltando vazias para
// visitante anônimo em nov/2026; ficam aqui caso a Amazon volte a mostrar.
export const LISTAS = {
  bestsellers: { nome: 'Mais vendidos', caminho: 'bestsellers' },
  new: { nome: 'Lançamentos', caminho: 'new-releases' },
  movers: { nome: 'Em alta (24h)', caminho: 'movers-and-shakers' },
  wished: { nome: 'Mais desejados', caminho: 'most-wished-for' },
};

export const PADROES = {
  listas: ['bestsellers', 'new'],
  subcategorias: 8, // quantas subcategorias seguir em cada categoria
  paginas: 2, // 50 produtos por página → Top 100 dos mais vendidos
  paginasOutrasListas: 1, // lançamentos etc: só Top 50, para caber nos 2.000 min/mês do GitHub
  pausaMin: 2500,
  pausaMax: 6000,
  maxBloqueios: 3, // para tudo depois de N captchas
  retencaoDias: 120, // snapshots mais velhos que isso são apagados
};

// Fator do k para subcategorias (o #1 de uma subcategoria vende bem menos que o #1 da principal)
export const FATOR_SUBCATEGORIA = 0.15;
export const EXPOENTE_RANK = 0.75;

// Marcas grandes: copiar produto delas é briga perdida (e risco de propriedade intelectual).
export const MARCAS_FORTES = [
  'amazon basics', 'amazon', 'apple', 'samsung', 'anker', 'stanley', 'owala', 'yeti', 'hydro flask',
  'ninja', 'kitchenaid', 'keurig', 'cuisinart', 'lodge', 'oxo', 'pyrex', 'rubbermaid', 'ziploc',
  'lego', 'mattel', 'hasbro', 'barbie', 'hot wheels', 'nerf', 'crayola', 'dewalt', 'milwaukee',
  'black+decker', 'bosch', 'makita', 'ryobi', 'craftsman', 'purina', 'blue buffalo', 'kong',
  'cerave', 'neutrogena', 'olay', 'loreal', "l'oreal", 'maybelline', 'dove', 'colgate', 'oral-b',
  'crest', 'philips', 'sony', 'jbl', 'bose', 'logitech', 'sharpie', 'post-it', 'scotch', 'bic',
  'pampers', 'huggies', 'graco', 'chicco', 'fisher-price', 'armor all', 'chemical guys', 'weathertech',
  'nike', 'adidas', 'coleman', 'contigo', 'brita', 'dyson', 'shark', 'bissell', 'instant pot', 'vitamix',
  'nespresso', 'starbucks', 'clorox', 'lysol', 'tide', 'bounty', 'charmin', 'cricut', 'elmers', "elmer's",
];
