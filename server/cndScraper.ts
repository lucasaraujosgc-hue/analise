// Robô que emite a CND federal no próprio servidor: abre o portal de certidões
// da Receita, informa o CNPJ, pede a emissão e captura o PDF gerado.
//
// O portal é um app Angular sem documentação pública dos seletores, então a
// navegação é genérica: localiza o campo de CNPJ e os botões pelo texto e
// captura qualquer PDF que o portal devolver (resposta HTTP, download ou nova aba).

import fs from 'fs';
import os from 'os';
import path from 'path';
import { abrirNavegador, abrirUrl, AjudaHumana, capturarPdfs, desafioCaptchaVisivel } from './navegador';
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

// Em ordem de preferência. Um único seletor com vírgulas pegava o primeiro input
// da página — a busca do cabeçalho do site — e digitava o CNPJ no lugar errado.
const SELETORES_CNPJ = [
  "input[formcontrolname*='cnpj' i]",
  "input[id*='cnpj' i]",
  "input[name*='cnpj' i]",
  "input[placeholder*='cnpj' i]",
  "input[aria-label*='cnpj' i]",
];

async function localizarCampoCnpj(page: any, prazoMs: number) {
  const limite = Date.now() + prazoMs;
  while (Date.now() < limite) {
    for (const sel of SELETORES_CNPJ) {
      for (const el of await page.$$(sel)) {
        // Ignora a busca do cabeçalho do portal.
        const naBusca = await el.evaluate((e: Element) => Boolean(e.closest('header, [role="search"], form[role="search"]'))).catch(() => true);
        if (!naBusca && (await el.boundingBox())) return el;
      }
    }
    await esperar(500);
  }
  return null;
}

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
  ajudaHumana?: AjudaHumana;
}): Promise<ResultadoRoboCnd> {
  const progresso = opcoes.onProgresso || (() => {});
  const pastaDownload = fs.mkdtempSync(path.join(os.tmpdir(), 'cnd-'));
  const { browser, prepararPagina } = await abrirNavegador({ headless: opcoes.headless });

  let pdf: Buffer | undefined;
  let page: any;
  try {
    page = await prepararPagina((await browser.pages())[0]);
    const capturador = await capturarPdfs(browser, page, pastaDownload);

    progresso('Abrindo o portal de certidões da Receita...');
    await abrirUrl(page, opcoes.url || CND_FEDERAL_URL);

    // Banner de cookies cobre os botões da página.
    await esperar(1500);
    await clicarPorTexto(page, /^aceitar( todos)?( os cookies)?$/i, new Set());

    const campo = await localizarCampoCnpj(page, 30_000);
    if (!campo) throw new CndBloqueadaError('O portal de certidões abriu, mas o campo de CNPJ não apareceu. Grave um roteiro em "Robôs (RPA)" para este site.');

    progresso('Informando o CNPJ...');
    await campo.click({ clickCount: 3 });
    for (const ch of opcoes.cnpj) {
      await page.keyboard.type(ch);
      await esperar(60 + Math.random() * 80);
    }
    await esperar(800);

    const clicados = new Set<string>();
    const primeiro = await clicarPorTexto(page, /^(emitir certid|emitir|consultar|pesquisar|continuar|avan[cç]ar)/i, clicados);
    if (!primeiro) await page.keyboard.press('Enter');
    else clicados.add(primeiro);

    progresso('Aguardando a emissão da certidão...');
    let limite = Date.now() + (opcoes.timeoutMs ?? 90_000);
    while (!pdf && Date.now() < limite) {
      await esperar(1500);

      pdf = await capturador.obter();
      if (pdf) break;

      const texto: string = await page.evaluate(() => document.body.innerText).catch(() => '');
      if (/insuficientes para a emiss[aã]o/i.test(texto)) return { textoPagina: texto };

      if (await desafioCaptchaVisivel(page)) {
        const liberou = opcoes.ajudaHumana
          ? await opcoes.ajudaHumana(page, async () => !(await desafioCaptchaVisivel(page)))
          : false;
        if (!liberou) {
          throw new CndBloqueadaError(
            'O portal pediu verificação de captcha e ela não foi resolvida. Emita pelo link oficial e envie o PDF, ou tente de novo.',
          );
        }
        limite = Math.max(limite, Date.now() + 60_000);
        continue;
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
