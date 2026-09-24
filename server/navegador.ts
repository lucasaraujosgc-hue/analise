// Navegador compartilhado pelos robôs (PGMEI e CND) que rodam no servidor.

import fs from 'fs';

export const TIMEOUT_NAV = 60_000;

export class SiteInacessivelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SiteInacessivelError';
  }
}

export function localizarChrome(): string | undefined {
  const candidatos = [
    process.env.CHROME_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    // No Alpine, /usr/bin/chromium-browser é um script que falha fora do shell; usa o binário direto.
    '/usr/lib/chromium/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];
  const pwDir = '/opt/pw-browsers';
  if (fs.existsSync(pwDir)) {
    for (const d of fs.readdirSync(pwDir)) {
      if (d.startsWith('chromium-')) candidatos.push(`${pwDir}/${d}/chrome-linux/chrome`);
    }
  }
  return candidatos.find(p => p && fs.existsSync(p));
}

// RECEITA_PROXY=http://usuario:senha@host:porta — os portais da Receita costumam
// não responder para IPs de fora do Brasil; um proxy brasileiro resolve.
export function proxyConfigurado(): { servidor: string; usuario?: string; senha?: string } | null {
  const bruto = process.env.RECEITA_PROXY?.trim();
  if (!bruto) return null;
  try {
    const url = new URL(bruto.includes('://') ? bruto : `http://${bruto}`);
    return {
      servidor: `${url.protocol}//${url.host}`,
      usuario: url.username ? decodeURIComponent(url.username) : undefined,
      senha: url.password ? decodeURIComponent(url.password) : undefined,
    };
  } catch {
    return null;
  }
}

export async function abrirNavegador(opcoes: { headless?: boolean; chromePath?: string } = {}) {
  const chromePath = opcoes.chromePath || localizarChrome();
  if (!chromePath) {
    throw new Error('Chrome/Chromium não encontrado. Instale o Chromium ou defina CHROME_PATH com o caminho do executável.');
  }

  // Correção do rebrowser contra detecção de automação (igual ao scraping-das-mei).
  process.env.REBROWSER_PATCHES_RUNTIME_FIX_MODE ??= 'addBinding';
  const { default: puppeteer } = await import('rebrowser-puppeteer-core');

  const proxy = proxyConfigurado();
  const browser = await puppeteer.launch({
    headless: opcoes.headless ?? true,
    executablePath: chromePath,
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--lang=pt-BR,pt',
      '--window-size=1366,768',
      ...(proxy ? [`--proxy-server=${proxy.servidor}`] : []),
    ],
    defaultViewport: { width: 1366, height: 768 },
  });

  const prepararPagina = async (page: any) => {
    if (proxy?.usuario) await page.authenticate({ username: proxy.usuario, password: proxy.senha || '' });
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7' });
    page.setDefaultNavigationTimeout(TIMEOUT_NAV);
    return page;
  };

  return { browser, prepararPagina };
}

// Abre a URL esperando só o HTML (o portal mantém conexões abertas e o
// "networkidle" pode nunca acontecer). Tenta duas vezes antes de desistir.
export async function abrirUrl(page: any, url: string, tentativas = 2) {
  let ultimoErro: unknown;
  for (let i = 0; i < tentativas; i++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_NAV });
      return;
    } catch (err) {
      ultimoErro = err;
    }
  }
  const host = new URL(url).host;
  const dica = proxyConfigurado()
    ? 'Confira se o proxy definido em RECEITA_PROXY está funcionando.'
    : 'Os sites da Receita costumam não responder para servidores fora do Brasil: se a sua VPS está em outro país, defina RECEITA_PROXY com um proxy no Brasil.';
  throw new SiteInacessivelError(
    `O servidor não conseguiu abrir ${host} em ${TIMEOUT_NAV / 1000}s (${(ultimoErro as Error)?.message || 'sem resposta'}). ${dica}`,
  );
}
