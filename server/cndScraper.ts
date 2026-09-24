// Robô que emite a CND federal no próprio servidor: abre o portal de certidões
// da Receita, informa o CNPJ, pede a emissão e captura o PDF gerado.
//
// O portal é um app Angular sem documentação pública dos seletores, então a
// navegação é genérica: localiza o campo de CNPJ e os botões pelo texto e
// captura qualquer PDF que o portal devolver (resposta HTTP, download ou nova aba).

import fs from 'fs';
import os from 'os';
import path from 'path';
import { abrirNavegador, abrirUrl } from './navegador';
import { CND_FEDERAL_URL } from './cnd';
import { salvarPrintDiagnostico } from './pgmeiScraper';

export class CndBloqueadaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CndBloqueadaError';
  }
}

export interface ResultadoRoboCnd {
  pdf?: Buffer;
  // Quando o portal responde com uma mensagem em vez de PDF (ex.: "informações
  // insuficientes para a emissão"), o texto dela é devolvido para classificação.
  textoPagina?: string;
}

const esperar = (ms: number) => new Promise(r => setTimeout(r, ms));

const SELETOR_CNPJ = [
  "input[formcontrolname*='cnpj' i]",
  "input[id*='cnpj' i]",
  "input[name*='cnpj' i]",
  "input[placeholder*='cnpj' i]",
  "input[aria-label*='cnpj' i]",
  "input[type='text']",
].join(', ');

// Clica no primeiro botão/link visível cujo texto combine com o padrão.
async function clicarPorTexto(page: any, padrao: RegExp, jaClicados: Set<string>): Promise<string | null> {
  return page.evaluate(
    (fonte: string, flags: string, ignorar: string[]) => {
      const re = new RegExp(fonte, flags);
      const alvos = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="submit"]')) as HTMLElement[];
      for (const el of alvos) {
        const texto = (el.innerText || (el as HTMLInputElement).value || '').replace(/\s+/g, ' ').trim();
        const visivel = el.offsetParent !== null && !(el as HTMLButtonElement).disabled;
        if (visivel && texto && re.test(texto) && !ignorar.includes(texto)) {
          el.click();
          return texto;
        }
      }
      return null;
    },
    padrao.source,
    padrao.flags,
    Array.from(jaClicados),
  );
}

export async function emitirCndFederal(opcoes: {
  cnpj: string;
  url?: string;
  headless?: boolean;
  timeoutMs?: number;
  onProgresso?: (etapa: string) => void;
}): Promise<ResultadoRoboCnd> {
  const progresso = opcoes.onProgresso || (() => {});
  const pastaDownload = fs.mkdtempSync(path.join(os.tmpdir(), 'cnd-'));
  const { browser, prepararPagina } = await abrirNavegador({ headless: opcoes.headless });

  let pdf: Buffer | undefined;
  let urlPdf: string | undefined;
  const capturarResposta = async (resp: any) => {
    const tipo = String(resp.headers()['content-type'] || '').toLowerCase();
    if (pdf || !resp.ok() || !tipo.includes('pdf')) return;
    urlPdf = resp.url();
    try {
      const buf: Buffer = await resp.buffer();
      if (buf.subarray(0, 4).toString() === '%PDF') pdf = buf;
    } catch {
      // Quando o PDF vira download o corpo não fica disponível: baixamos de novo pela URL.
    }
  };

  let page: any;
  try {
    page = await prepararPagina((await browser.pages())[0]);
    page.on('response', capturarResposta);
    const cdp = await browser.target().createCDPSession();
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: pastaDownload });
    // PDF aberto em nova aba
    browser.on('targetcreated', async (target: any) => {
      const nova = await target.page().catch(() => null);
      if (nova) nova.on('response', capturarResposta);
    });

    progresso('Abrindo o portal de certidões da Receita...');
    await abrirUrl(page, opcoes.url || CND_FEDERAL_URL);

    const campo = await page.waitForSelector(SELETOR_CNPJ, { visible: true, timeout: 30_000 }).catch(() => null);
    if (!campo) throw new CndBloqueadaError('O portal de certidões abriu, mas o campo de CNPJ não apareceu.');

    progresso('Informando o CNPJ...');
    await campo.click({ clickCount: 3 });
    for (const ch of opcoes.cnpj) {
      await page.keyboard.type(ch);
      await esperar(60 + Math.random() * 80);
    }
    await esperar(800);

    const clicados = new Set<string>();
    const primeiro = await clicarPorTexto(page, /^(consultar|emitir|pesquisar|continuar|avan[cç]ar)/i, clicados);
    if (!primeiro) await page.keyboard.press('Enter');
    else clicados.add(primeiro);

    progresso('Aguardando a emissão da certidão...');
    const limite = Date.now() + (opcoes.timeoutMs ?? 90_000);
    while (!pdf && Date.now() < limite) {
      await esperar(1500);

      const baixado = fs.readdirSync(pastaDownload).find(f => !f.endsWith('.crdownload'));
      if (baixado) {
        const buf = fs.readFileSync(path.join(pastaDownload, baixado));
        if (buf.subarray(0, 4).toString() === '%PDF') {
          pdf = buf;
          break;
        }
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
        if (buf && buf.subarray(0, 4).toString() === '%PDF') {
          pdf = buf;
          break;
        }
      }

      const texto: string = await page.evaluate(() => document.body.innerText).catch(() => '');
      if (/insuficientes para a emiss[aã]o/i.test(texto)) return { textoPagina: texto };

      const captcha = await page.$('iframe[src*="hcaptcha"], iframe[src*="recaptcha"], iframe[title*="captcha" i]');
      if (captcha && (await captcha.boundingBox())) {
        throw new CndBloqueadaError(
          'O portal pediu verificação de captcha e o robô não pode resolvê-la. Emita pelo link oficial e envie o PDF, ou use o script de emissão assistida.',
        );
      }

      // Passos seguintes do portal: emitir nova certidão, segunda via, baixar/imprimir.
      const proximo = await clicarPorTexto(page, /(emitir|nova certid|segunda via|2[ªa] via|baixar|download|imprimir|visualizar)/i, clicados);
      if (proximo) {
        clicados.add(proximo);
        progresso(`Clicando em "${proximo}"...`);
      }
    }

    if (!pdf) {
      throw new CndBloqueadaError('O portal não entregou o PDF da certidão no tempo esperado. Emita pelo link oficial e envie o PDF.');
    }
    return { pdf };
  } catch (err) {
    if (err instanceof CndBloqueadaError && page) {
      const print = await salvarPrintDiagnostico(page, 'cnd');
      if (print) err.message += ` Print da tela salvo em Arquivos: ${print}.`;
    }
    throw err;
  } finally {
    await browser.close().catch(() => {});
    fs.rmSync(pastaDownload, { recursive: true, force: true });
  }
}
