// Leitura das listas públicas da Amazon US (Best Sellers, New Releases...) com Playwright.
import { chromium } from 'playwright';
import { LISTAS } from './config.js';

const BASE = 'https://www.amazon.com';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36';

export class Bloqueado extends Error {}

export async function abrirNavegador() {
  const browser = await chromium.launch();
  const novaPagina = async () => {
    const ctx = await browser.newContext({
      locale: 'en-US',
      userAgent: USER_AGENT,
      viewport: { width: 1366, height: 900 },
      extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
    });
    // Imagens, fontes e vídeos não são necessários: deixa a coleta mais leve e rápida.
    await ctx.route('**/*', (r) =>
      ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue(),
    );
    return ctx.newPage();
  };
  return { browser, novaPagina };
}

export function urlLista(lista, slug, node, pagina) {
  const caminho = LISTAS[lista].caminho;
  const cat = node ? `${slug}/${node}` : slug;
  return `${BASE}/gp/${caminho}/${cat}${pagina > 1 ? `?pg=${pagina}` : ''}`;
}

async function verificarBloqueio(page) {
  const bloqueado = await page.evaluate(
    () =>
      !!document.querySelector('form[action*="validateCaptcha"]') ||
      /robot check|sorry! something went wrong/i.test(document.title),
  );
  if (bloqueado) throw new Bloqueado(page.url());
}

// Os itens 31-50 só aparecem depois de rolar a página.
async function rolarAteCarregar(page) {
  let anterior = -1;
  for (let i = 0; i < 12; i++) {
    const qtd = await page.locator('#gridItemRoot').count();
    if (qtd >= 50 || (qtd === anterior && i > 3)) break;
    anterior = qtd;
    await page.mouse.wheel(0, 2500);
    await page.waitForTimeout(600);
  }
}

export async function lerLista(page, url) {
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  if (resp && resp.status() === 503) throw new Bloqueado(url);
  await verificarBloqueio(page);
  await rolarAteCarregar(page);

  return page.evaluate(() => {
    const num = (s) => (s ? Number(String(s).replace(/[^0-9.]/g, '')) || null : null);
    return [...document.querySelectorAll('#gridItemRoot')]
      .map((el) => {
        const asin = el.querySelector('[data-asin]')?.getAttribute('data-asin');
        const link = el.querySelector('a[href*="/dp/"]');
        const img = el.querySelector('img');
        const titulo =
          el.querySelector('[class*="line-clamp"]')?.textContent?.trim() || img?.getAttribute('alt') || '';
        const aval = el.querySelector('a[href*="product-reviews"]')?.getAttribute('aria-label') || '';
        const m = aval.match(/([\d.]+) out of 5 stars,\s*([\d,]+)/);
        // Preço pode vir como faixa ("$10.99 - $20.99"): fica com o menor.
        const precoTxt = el.querySelector('[class*="p13n-sc-price"]')?.textContent || '';
        return {
          asin,
          rank: num(el.querySelector('.zg-bdg-text')?.textContent),
          titulo,
          imagem: img?.getAttribute('src') || null,
          url: link ? `https://www.amazon.com/dp/${asin}` : null,
          preco: num(precoTxt.split('-')[0]),
          nota: m ? Number(m[1]) : null,
          reviews: m ? Number(m[2].replace(/,/g, '')) : 0,
        };
      })
      .filter((p) => p.asin && p.rank);
  });
}

// Subcategorias diretas a partir do menu lateral de uma página de categoria principal.
export async function lerSubcategorias(page, slug) {
  return page.evaluate((slug) => {
    const vistos = new Map();
    for (const a of document.querySelectorAll(`a[href*="/zgbs/${slug}/"]`)) {
      const m = a.getAttribute('href').match(new RegExp(`/zgbs/${slug}/(\\d+)`));
      const nome = a.textContent.trim();
      if (m && nome && !vistos.has(m[1])) vistos.set(m[1], nome);
    }
    return [...vistos].map(([node, nome]) => ({ node, nome }));
  }, slug);
}
