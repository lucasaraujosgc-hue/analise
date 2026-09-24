// Robô gratuito de consulta ao PGMEI (portal público da Receita Federal).
//
// Adaptado do projeto scraping-das-mei, https://github.com/engmsilva/scraping-das-mei
// (Copyright Marcelo Ribeiro da Silva, Apache License 2.0) — mesmos seletores do
// portal e mesma técnica de navegação (rebrowser-puppeteer + interação humanizada).
// Diferença: em vez de emitir o PDF de um mês, lê a tabela de competências de
// cada ano-calendário (situação, principal, multa, juros, total e vencimento) e
// os avisos de DASN-SIMEI não entregue.

import { abrirNavegador, abrirUrl, localizarChrome, TIMEOUT_NAV } from './navegador';
import {
  CompetenciaMei,
  anosDasnExigiveis,
  extrairDasnPendentes,
  montarDeclaracoes,
  parseDeclaracoesEntregues,
  parseExtratoPgmei,
  resumir,
  ResultadoMei,
} from './mei';

const PGMEI_PATH = '/SimplesNacional/Aplicacoes/ATSPO/pgmei.app';
const DASN_PATH = '/SimplesNacional/Aplicacoes/ATSPO/dasnsimei.app';
export const RECEITA_BASE_URL = 'https://www8.receita.fazenda.gov.br';
export const PGMEI_URL = `${RECEITA_BASE_URL}${PGMEI_PATH}/Identificacao`;
export const DASN_SIMEI_URL = `${RECEITA_BASE_URL}${DASN_PATH}/Identificacao`;

export { localizarChrome };
const TIMEOUT_SEL = 20_000;

export interface OpcoesConsultaPgmei {
  cnpj: string;
  dataOpcaoMei?: string;
  dataExclusaoMei?: string;
  // Quantos anos-calendário ler (do mais recente para trás). Padrão: 6.
  maxAnos?: number;
  verificarDasn?: boolean;
  headless?: boolean;
  // Com navegador visível, tempo para a pessoa resolver o captcha, se aparecer.
  esperaCaptchaMs?: number;
  baseUrl?: string;
  chromePath?: string;
  onProgresso?: (etapa: string, atual: number, total: number) => void;
  hoje?: Date;
}

export class PgmeiBloqueadoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PgmeiBloqueadoError';
  }
}


const esperar = (ms: number) => new Promise(r => setTimeout(r, ms));
const atrasoAleatorio = (min = 300, max = 900) => esperar(Math.floor(Math.random() * (max - min + 1)) + min);

async function moverMouseHumano(page: any, deX: number, deY: number, paraX: number, paraY: number, passos = 25) {
  const ctrlX = (deX + paraX) / 2 + (Math.random() - 0.5) * 150;
  const ctrlY = (deY + paraY) / 2 + (Math.random() - 0.5) * 150;
  for (let i = 0; i <= passos; i++) {
    const t = i / passos;
    const mt = 1 - t;
    await page.mouse.move(mt * mt * deX + 2 * mt * t * ctrlX + t * t * paraX, mt * mt * deY + 2 * mt * t * ctrlY + t * t * paraY);
    await esperar(6 + Math.random() * 14);
  }
}

async function cliqueHumano(page: any, seletor: string) {
  const el = await page.waitForSelector(seletor, { timeout: TIMEOUT_SEL, visible: true });
  const box = await el.boundingBox();
  if (!box) throw new Error(`Elemento invisível: ${seletor}`);
  const alvoX = box.x + box.width * (0.25 + Math.random() * 0.5);
  const alvoY = box.y + box.height * (0.25 + Math.random() * 0.5);
  await moverMouseHumano(page, Math.random() * 800, Math.random() * 600, alvoX, alvoY);
  await atrasoAleatorio(80, 200);
  await page.mouse.click(alvoX, alvoY);
}

async function digitarHumano(page: any, seletor: string, texto: string) {
  await cliqueHumano(page, seletor);
  await page.click(seletor, { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await atrasoAleatorio(200, 400);
  for (const ch of texto) {
    await page.keyboard.type(ch);
    await esperar(90 + Math.random() * 90);
  }
  await atrasoAleatorio(400, 700);
}

async function lerMensagens(page: any): Promise<string[]> {
  return page
    .$$eval('#toast-container .toast-message, .alert, .validation-summary-errors', (els: Element[]) =>
      els.map(el => (el as HTMLElement).innerText?.replace(/\s+/g, ' ').trim()).filter(Boolean),
    )
    .catch(() => []);
}

async function aguardarSaidaDaIdentificacao(page: any, prazoMs: number): Promise<boolean> {
  const limite = Date.now() + prazoMs;
  while (Date.now() < limite) {
    if (!/identificacao/i.test(page.url())) return true;
    await esperar(500);
  }
  return false;
}

async function identificar(page: any, url: string, cnpj: string, opcoes: OpcoesConsultaPgmei) {
  await abrirUrl(page, url);
  await atrasoAleatorio(1200, 2200);
  await page.waitForSelector('input[id=cnpj]', { timeout: TIMEOUT_SEL, visible: true });
  await digitarHumano(page, 'input[id=cnpj]', cnpj);
  await cliqueHumano(page, 'button[type=submit]');

  await Promise.race([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15_000 }),
    page.waitForSelector('#toast-container .toast-message, .alert', { timeout: 15_000, visible: true }),
  ]).catch(() => {});

  if (!/identificacao/i.test(page.url())) return;

  const mensagens = await lerMensagens(page);
  // Navegador visível: dá tempo para a pessoa resolver o captcha e clicar em Continuar.
  if (opcoes.headless === false) {
    opcoes.onProgresso?.('Aguardando a verificação de segurança (resolva o captcha no navegador aberto)...', 0, 0);
    if (await aguardarSaidaDaIdentificacao(page, opcoes.esperaCaptchaMs ?? 180_000)) {
      await page.waitForNetworkIdle({ timeout: 10_000 }).catch(() => {});
      return;
    }
  }
  const detalhe = mensagens.join(' ') || 'o portal não saiu da tela de identificação';
  throw new PgmeiBloqueadoError(
    `A Receita bloqueou a consulta automática (${detalhe}). Tente de novo em alguns minutos, rode com PGMEI_HEADLESS=false para resolver o captcha manualmente, ou cole a tabela do PGMEI em "Importar extrato".`,
  );
}

interface LinhaTabela {
  pa: string;
  celulas: string[];
}

async function lerTabelaAno(page: any): Promise<{ linhas: LinhaTabela[]; mensagens: string[] }> {
  const linhas: LinhaTabela[] = await page.evaluate(() => {
    const tabelas = Array.from(document.querySelectorAll('table'));
    const tabela =
      tabelas.find(t => t.querySelector('input[value^="20"]')) ||
      tabelas.find(t => /per[ií]odo/i.test((t as HTMLElement).innerText));
    if (!tabela) return [];
    return Array.from(tabela.querySelectorAll('tbody tr'))
      .map(tr => {
        const input = tr.querySelector('input[value]') as HTMLInputElement | null;
        return {
          pa: input && /^\d{6}$/.test(input.value) ? input.value : '',
          celulas: Array.from(tr.querySelectorAll('td')).map(td => (td as HTMLElement).innerText.replace(/\s+/g, ' ').trim()),
        };
      })
      .filter(l => l.celulas.some(Boolean));
  });
  return { linhas, mensagens: await lerMensagens(page) };
}

export function linhasParaCompetencias(linhas: LinhaTabela[], hoje = new Date()): CompetenciaMei[] {
  // O leitor de extrato já entende a linha da tabela (período, situação, valores e datas).
  // O período do checkbox (AAAAMM) vai na frente para não depender do texto do mês.
  const texto = linhas.map(l => [l.pa, ...l.celulas].filter(Boolean).join('\t')).join('\n');
  return parseExtratoPgmei(texto, hoje).competencias;
}

async function verificarDasnSimei(browser: any, prepararPagina: (p: any) => Promise<any>, opcoes: OpcoesConsultaPgmei, base: string): Promise<number[]> {
  const page = await prepararPagina(await browser.newPage());
  try {
    await identificar(page, `${base}${DASN_PATH}/Identificacao`, opcoes.cnpj, opcoes);
    const textos: string[] = [await page.evaluate(() => document.body.innerText)];
    // Abre a tela de consulta/impressão de declarações, se existir.
    const link = await page.$$eval('a', (as: Element[]) => {
      const alvo = as.find(a => /consult|imprimir/i.test((a as HTMLElement).innerText));
      return alvo ? (alvo as HTMLAnchorElement).href : null;
    });
    if (link) {
      await abrirUrl(page, link);
      textos.push(
        await page.evaluate(() =>
          Array.from(document.querySelectorAll('table tr'))
            .map(tr => (tr as HTMLElement).innerText.replace(/\s+/g, ' '))
            .join('\n'),
        ),
      );
    }
    return parseDeclaracoesEntregues(textos.join('\n'));
  } finally {
    await page.close().catch(() => {});
  }
}

export async function consultarPgmei(opcoes: OpcoesConsultaPgmei): Promise<ResultadoMei> {
  const base = opcoes.baseUrl || RECEITA_BASE_URL;
  const hoje = opcoes.hoje || new Date();
  const progresso = opcoes.onProgresso || (() => {});
  const headless = opcoes.headless ?? true;

  const { browser, prepararPagina } = await abrirNavegador({ headless, chromePath: opcoes.chromePath });

  const avisos: string[] = [];
  const mensagensPortal: string[] = [];
  const competencias: CompetenciaMei[] = [];
  let entregues: number[] = [];

  try {
    const page = await prepararPagina((await browser.pages())[0]);

    progresso('Acessando o PGMEI e informando o CNPJ...', 0, 0);
    await identificar(page, `${base}${PGMEI_PATH}/Identificacao`, opcoes.cnpj, opcoes);

    progresso('Abrindo "Emitir Guia de Pagamento (DAS)"...', 0, 0);
    await atrasoAleatorio(500, 1000);
    await page.waitForSelector(`a[href="${PGMEI_PATH}/emissao"]`, { timeout: TIMEOUT_SEL });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: TIMEOUT_NAV }).catch(() => {}),
      page.click(`a[href="${PGMEI_PATH}/emissao"]`),
    ]);
    await page.waitForSelector('#anoCalendarioSelect', { timeout: TIMEOUT_SEL, visible: true });

    const anosDisponiveis: string[] = await page.$$eval('#anoCalendarioSelect option', (ops: Element[]) =>
      ops.map(o => (o as HTMLOptionElement).value).filter(v => /^\d{4}$/.test(v)),
    );
    const anoOpcao = Number(opcoes.dataOpcaoMei?.slice(0, 4)) || 0;
    const anos = anosDisponiveis
      .filter(a => Number(a) >= anoOpcao)
      .sort((a, b) => Number(b) - Number(a))
      .slice(0, opcoes.maxAnos ?? 6);

    if (anos.length === 0) avisos.push('O PGMEI não listou nenhum ano-calendário para este CNPJ.');

    for (let i = 0; i < anos.length; i++) {
      const ano = anos[i];
      progresso(`Lendo as competências de ${ano}...`, i + 1, anos.length);
      if (i > 0) {
        // Volta para a seleção de ano (a página pode ter mudado após o envio).
        if (!(await page.$('#anoCalendarioSelect'))) {
          await abrirUrl(page, `${base}${PGMEI_PATH}/emissao`);
        }
        await atrasoAleatorio(600, 1400);
      }
      await page.select('#anoCalendarioSelect', ano);
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {}),
        page.click('button[type=submit]'),
      ]);

      const { linhas, mensagens } = await lerTabelaAno(page);
      mensagensPortal.push(...mensagens);
      const doAno = linhasParaCompetencias(linhas, hoje).filter(c => c.periodoApuracao.startsWith(ano));
      if (doAno.length === 0 && mensagens.length) avisos.push(`${ano}: ${mensagens.join(' ')}`);
      competencias.push(...doAno);
    }

    if (opcoes.verificarDasn !== false) {
      progresso('Verificando declarações no DASN-SIMEI...', anos.length, anos.length);
      try {
        entregues = await verificarDasnSimei(browser, prepararPagina, opcoes, base);
        if (entregues.length === 0) {
          avisos.push('Não foi possível ler as declarações entregues no DASN-SIMEI; os anos sem aviso do PGMEI ficam como "não verificada".');
        }
      } catch (err) {
        avisos.push(`DASN-SIMEI não verificado: ${(err as Error).message}`);
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  const exigiveis = anosDasnExigiveis({ dataOpcaoMei: opcoes.dataOpcaoMei, dataExclusaoMei: opcoes.dataExclusaoMei, hoje });
  const pendentes = new Map<number, { fonte: string; observacao?: string }>();
  for (const ano of extrairDasnPendentes(mensagensPortal)) {
    pendentes.set(ano, { fonte: 'PGMEI', observacao: 'O PGMEI bloqueia a emissão do DAS até a entrega desta declaração.' });
  }
  const mapaEntregues = new Map<number, { fonte: string }>();
  for (const ano of entregues) if (!pendentes.has(ano)) mapaEntregues.set(ano, { fonte: 'DASN-SIMEI' });
  // Se o DASN-SIMEI listou as declarações, os anos exigíveis que não aparecem estão pendentes.
  if (entregues.length > 0) {
    for (const ano of exigiveis) {
      if (!mapaEntregues.has(ano) && !pendentes.has(ano)) pendentes.set(ano, { fonte: 'DASN-SIMEI', observacao: 'Não consta entrega no DASN-SIMEI.' });
    }
  }
  const declaracoes = montarDeclaracoes(exigiveis, pendentes, mapaEntregues);

  competencias.sort((a, b) => b.periodoApuracao.localeCompare(a.periodoApuracao));
  return {
    cnpj: opcoes.cnpj,
    fonte: 'PGMEI_ROBO',
    consultadoEm: new Date().toISOString(),
    periodoInicial: competencias.at(-1)?.periodo,
    periodoFinal: competencias[0]?.periodo,
    competencias,
    declaracoes,
    resumo: resumir(competencias, declaracoes),
    avisos,
  };
}
