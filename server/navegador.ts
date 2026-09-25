// Navegador compartilhado pelos robôs (PGMEI e CND) que rodam no servidor.

import fs from 'fs';
import { spawn } from 'child_process';

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

// Em servidor sem monitor (VPS/Docker), o Chrome "com janela" roda numa tela
// virtual (Xvfb). É bem menos detectado pela verificação anti-robô da Receita do
// que o modo headless.
let telaVirtual: Promise<boolean> | null = null;

function localizarXvfb(): string | undefined {
  return ['/usr/bin/Xvfb', '/usr/local/bin/Xvfb'].find(p => fs.existsSync(p));
}

async function garantirTela(): Promise<{ ok: boolean; virtual: boolean }> {
  if (process.platform !== 'linux' || process.env.DISPLAY) return { ok: true, virtual: false };
  const xvfb = localizarXvfb();
  if (!xvfb) return { ok: false, virtual: false };
  telaVirtual ??= new Promise(resolve => {
    const display = ':99';
    const proc = spawn(xvfb, [display, '-screen', '0', '1366x768x24', '-nolisten', 'tcp', '-ac'], { stdio: 'ignore', detached: true });
    proc.on('error', () => resolve(false));
    proc.unref();
    process.env.DISPLAY = display;
    setTimeout(() => resolve(true), 1000);
  });
  const ok = await telaVirtual;
  return { ok, virtual: ok };
}

export function modoHeadless(): boolean {
  return process.env.PGMEI_HEADLESS === 'true';
}

export async function abrirNavegador(opcoes: { headless?: boolean; chromePath?: string } = {}) {
  const chromePath = opcoes.chromePath || localizarChrome();
  if (!chromePath) {
    throw new Error('Chrome/Chromium não encontrado. Instale o Chromium ou defina CHROME_PATH com o caminho do executável.');
  }

  // Correção do rebrowser contra detecção de automação (igual ao scraping-das-mei).
  process.env.REBROWSER_PATCHES_RUNTIME_FIX_MODE ??= 'addBinding';
  const { default: puppeteer } = await import('rebrowser-puppeteer-core');

  let headless = opcoes.headless ?? modoHeadless();
  let virtual = false;
  if (!headless) {
    const tela = await garantirTela();
    virtual = tela.virtual;
    if (!tela.ok) {
      console.warn('[navegador] Sem tela e sem Xvfb instalado: usando modo headless.');
      headless = true;
    }
  }

  const proxy = proxyConfigurado();
  const browser = await puppeteer.launch({
    headless,
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

  // telaVirtual: ninguém está vendo a janela, então não adianta esperar captcha manual.
  return { browser, prepararPagina, headless, telaVirtual: virtual };
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

// Ajuda humana: quando o portal mostra um desafio de captcha, a tela do robô é
// exibida no sistema e a pessoa resolve com o mouse. Resolve true se liberou.
export type AjudaHumana = (page: any, concluido: () => Promise<boolean>) => Promise<boolean>;

const pausa = (ms: number) => new Promise(r => setTimeout(r, ms));

// O widget do hCaptcha é pequeno; o desafio (grade de imagens) é um iframe grande.
export async function desafioCaptchaVisivel(page: any): Promise<boolean> {
  const frames = await page.$$('iframe[src*="hcaptcha"], iframe[src*="recaptcha"], iframe[title*="captcha" i]').catch(() => []);
  for (const f of frames) {
    const box = await f.boundingBox().catch(() => null);
    if (box && box.width > 200 && box.height > 200) return true;
  }
  return false;
}

// Espera a verificação do portal liberar. Não clica de novo: reenviar reinicia
// o hCaptcha. Se aparecer um desafio (ou o prazo acabar), chama a ajuda humana.
export async function aguardarLiberacao(
  page: any,
  concluido: () => Promise<boolean>,
  opcoes: { prazoMs: number; ajudaHumana?: AjudaHumana },
): Promise<boolean> {
  const limite = Date.now() + opcoes.prazoMs;
  while (Date.now() < limite) {
    if (await concluido().catch(() => false)) return true;
    if (opcoes.ajudaHumana && (await desafioCaptchaVisivel(page))) return opcoes.ajudaHumana(page, concluido);
    await pausa(1000);
  }
  if (await concluido().catch(() => false)) return true;
  return opcoes.ajudaHumana ? opcoes.ajudaHumana(page, concluido) : false;
}

function ehPdf(buf?: Buffer | null): buf is Buffer {
  return Boolean(buf && buf.subarray(0, 4).toString() === '%PDF');
}

// Captura qualquer PDF que o portal entregar: resposta HTTP, download ou nova aba.
export async function capturarPdfs(browser: any, page: any, pastaDownload: string) {
  let pdf: Buffer | undefined;
  let urlPdf: string | undefined;

  const aoResponder = async (resp: any) => {
    const tipo = String(resp.headers()['content-type'] || '').toLowerCase();
    if (pdf || !resp.ok() || !tipo.includes('pdf')) return;
    urlPdf = resp.url();
    try {
      const buf: Buffer = await resp.buffer();
      if (ehPdf(buf)) pdf = buf;
    } catch {
      // Quando o PDF vira download o corpo não fica disponível: baixamos de novo pela URL.
    }
  };
  page.on('response', aoResponder);
  browser.on('targetcreated', async (target: any) => {
    const nova = await target.page().catch(() => null);
    if (nova) nova.on('response', aoResponder);
  });
  const cdp = await browser.target().createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: pastaDownload });

  return {
    async obter(): Promise<Buffer | undefined> {
      if (pdf) return pdf;
      const baixado = fs.existsSync(pastaDownload) ? fs.readdirSync(pastaDownload).find(f => !f.endsWith('.crdownload')) : undefined;
      if (baixado) {
        const buf = fs.readFileSync(`${pastaDownload}/${baixado}`);
        if (ehPdf(buf)) return (pdf = buf);
      }
      if (urlPdf) {
        const base64: string | null = await page
          .evaluate(async (u: string) => {
            const r = await fetch(u, { credentials: 'include' });
            const bytes = new Uint8Array(await r.arrayBuffer());
            let bin = '';
            for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
            return btoa(bin);
          }, urlPdf)
          .catch(() => null);
        const buf = base64 ? Buffer.from(base64, 'base64') : null;
        if (ehPdf(buf)) return (pdf = buf);
      }
      return undefined;
    },
  };
}
