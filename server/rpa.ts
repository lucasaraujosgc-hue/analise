// RPA gravável: a pessoa grava no sistema os passos feitos num navegador que
// roda no servidor (cliques, digitação com variáveis, teclas, rolagem, esperas)
// e o robô repete o roteiro para qualquer empresa até obter o PDF.

import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { abrirNavegador, abrirUrl, AjudaHumana, capturarPdfs, desafioCaptchaVisivel } from './navegador';

export interface AlvoElemento {
  seletor?: string;
  texto?: string;
  tag?: string;
  x: number;
  y: number;
  scrollY?: number;
}

export type PassoRpa =
  | { tipo: 'clique'; alvo: AlvoElemento; esperaMs: number; opcional?: boolean }
  | { tipo: 'digitar'; valor: string; alvo?: AlvoElemento; limpar: boolean; esperaMs: number }
  | { tipo: 'tecla'; tecla: string; esperaMs: number }
  | { tipo: 'rolar'; dy: number; esperaMs: number }
  | { tipo: 'esperar'; ms: number }
  | { tipo: 'navegar'; url: string; esperaMs: number }
  | { tipo: 'aguardarPdf'; timeoutMs: number };

export type FinalidadeRoteiro = 'CND_FEDERAL' | 'CND_ESTADUAL' | 'OUTRO';

export interface RoteiroRpa {
  id: string;
  nome: string;
  finalidade: FinalidadeRoteiro;
  uf?: string;
  urlInicial: string;
  passos: PassoRpa[];
  criadoEm: string;
  atualizadoEm: string;
}

export type VariaveisRpa = Record<string, string>;

export const LARGURA_TELA = 1366;
export const ALTURA_TELA = 768;
const TECLAS_PERMITIDAS = ['Enter', 'Tab', 'Escape', 'Backspace', 'ArrowDown', 'ArrowUp', 'Space'];

const esperar = (ms: number) => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Roteiros salvos (data/rpa/roteiros.json)
// ---------------------------------------------------------------------------

export class RepositorioRoteiros {
  private arquivo: string;

  constructor(dataDir: string) {
    const dir = path.join(dataDir, 'rpa');
    fs.mkdirSync(dir, { recursive: true });
    this.arquivo = path.join(dir, 'roteiros.json');
  }

  listar(): RoteiroRpa[] {
    try {
      return fs.existsSync(this.arquivo) ? JSON.parse(fs.readFileSync(this.arquivo, 'utf-8')) : [];
    } catch {
      return [];
    }
  }

  obter(id: string) {
    return this.listar().find(r => r.id === id);
  }

  // Roteiro usado pelo botão "Buscar CND" de cada esfera (o mais recente).
  paraCnd(esfera: 'federal' | 'estadual', uf?: string) {
    const finalidade = esfera === 'federal' ? 'CND_FEDERAL' : 'CND_ESTADUAL';
    return this.listar()
      .filter(r => r.finalidade === finalidade && (esfera === 'federal' || !r.uf || r.uf === uf))
      .sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm))[0];
  }

  salvar(dados: Omit<RoteiroRpa, 'id' | 'criadoEm' | 'atualizadoEm'> & { id?: string }): RoteiroRpa {
    const lista = this.listar();
    const agora = new Date().toISOString();
    const existente = dados.id ? lista.find(r => r.id === dados.id) : undefined;
    const roteiro: RoteiroRpa = {
      id: existente?.id || randomUUID(),
      nome: String(dados.nome || 'Roteiro sem nome').slice(0, 120),
      finalidade: dados.finalidade,
      uf: dados.finalidade === 'CND_ESTADUAL' ? dados.uf : undefined,
      urlInicial: dados.urlInicial,
      passos: validarPassos(dados.passos),
      criadoEm: existente?.criadoEm || agora,
      atualizadoEm: agora,
    };
    const nova = existente ? lista.map(r => (r.id === roteiro.id ? roteiro : r)) : [...lista, roteiro];
    fs.writeFileSync(this.arquivo, JSON.stringify(nova, null, 2), 'utf-8');
    return roteiro;
  }

  excluir(id: string) {
    fs.writeFileSync(this.arquivo, JSON.stringify(this.listar().filter(r => r.id !== id), null, 2), 'utf-8');
  }
}

function numero(v: unknown, padrao: number, min: number, max: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : padrao;
}

// Os passos vêm do navegador do usuário: normaliza tipos e limites.
export function validarPassos(passos: unknown): PassoRpa[] {
  if (!Array.isArray(passos)) return [];
  const alvo = (a: any): AlvoElemento => ({
    seletor: typeof a?.seletor === 'string' ? a.seletor.slice(0, 500) : undefined,
    texto: typeof a?.texto === 'string' ? a.texto.slice(0, 120) : undefined,
    tag: typeof a?.tag === 'string' ? a.tag.slice(0, 20) : undefined,
    x: numero(a?.x, 0, 0, LARGURA_TELA),
    y: numero(a?.y, 0, 0, ALTURA_TELA),
    scrollY: numero(a?.scrollY, 0, 0, 1e6),
  });
  const espera = (p: any) => numero(p?.esperaMs, 1000, 0, 120_000);
  const out: PassoRpa[] = [];
  for (const p of passos as any[]) {
    switch (p?.tipo) {
      case 'clique':
        out.push({ tipo: 'clique', alvo: alvo(p.alvo), esperaMs: espera(p), opcional: Boolean(p.opcional) });
        break;
      case 'digitar':
        out.push({ tipo: 'digitar', valor: String(p.valor ?? '').slice(0, 500), alvo: p.alvo ? alvo(p.alvo) : undefined, limpar: p.limpar !== false, esperaMs: espera(p) });
        break;
      case 'tecla':
        if (TECLAS_PERMITIDAS.includes(p.tecla)) out.push({ tipo: 'tecla', tecla: p.tecla, esperaMs: espera(p) });
        break;
      case 'rolar':
        out.push({ tipo: 'rolar', dy: numero(p.dy, 400, -5000, 5000), esperaMs: espera(p) });
        break;
      case 'esperar':
        out.push({ tipo: 'esperar', ms: numero(p.ms, 1000, 0, 120_000) });
        break;
      case 'navegar':
        if (/^https?:\/\//i.test(String(p.url))) out.push({ tipo: 'navegar', url: String(p.url), esperaMs: espera(p) });
        break;
      case 'aguardarPdf':
        out.push({ tipo: 'aguardarPdf', timeoutMs: numero(p.timeoutMs, 60_000, 5_000, 300_000) });
        break;
    }
  }
  return out;
}

export function substituirVariaveis(texto: string, vars: VariaveisRpa): string {
  return texto.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, nome) => vars[nome.toLowerCase()] ?? '');
}

export function variaveisDaEmpresa(empresa: { cnpj: string; razao_social?: string; endereco?: { uf?: string }; inscricoes_estaduais?: { inscricao: string; uf: string }[] }): VariaveisRpa {
  const c = empresa.cnpj;
  const uf = empresa.endereco?.uf || '';
  const ie = empresa.inscricoes_estaduais?.find(i => !uf || i.uf === uf)?.inscricao || '';
  return {
    cnpj: c,
    cnpj_formatado: c.length === 14 ? `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}` : c,
    razao_social: empresa.razao_social || '',
    uf,
    inscricao_estadual: ie,
  };
}

// ---------------------------------------------------------------------------
// Identificação do elemento clicado (para repetir mesmo se a página mudar um pouco)
// ---------------------------------------------------------------------------

// Código executado dentro da página. Fica como texto puro porque o tsx injeta um
// helper (__name) em funções nomeadas, que não existe no navegador.
const SCRIPT_DESCREVER = `(function (px, py) {
  var base = px === null ? document.activeElement : document.elementFromPoint(px, py);
  if (!base || base === document.body) return null;
  var el = base.closest('button, a, [role="button"], input, select, textarea, label, [onclick]') || base;
  var tag = el.tagName.toLowerCase();
  function unico(s) { try { return document.querySelectorAll(s).length === 1; } catch (e) { return false; } }
  var seletor;
  if (el.id && !/\\d{4,}/.test(el.id) && unico('#' + CSS.escape(el.id))) seletor = '#' + CSS.escape(el.id);
  if (!seletor) {
    var attrs = ['name', 'formcontrolname', 'placeholder', 'aria-label', 'title', 'data-testid'];
    for (var i = 0; i < attrs.length && !seletor; i++) {
      var v = el.getAttribute(attrs[i]);
      if (v) {
        var s = tag + '[' + attrs[i] + '="' + v.replace(/"/g, '\\\\"') + '"]';
        if (unico(s)) seletor = s;
      }
    }
  }
  if (!seletor) {
    var partes = [];
    var atual = el;
    while (atual && atual !== document.body && partes.length < 6) {
      var pai = atual.parentElement;
      var mesmaTag = pai ? Array.prototype.filter.call(pai.children, function (c) { return c.tagName === atual.tagName; }) : [];
      partes.unshift(atual.tagName.toLowerCase() + ':nth-of-type(' + (mesmaTag.indexOf(atual) + 1) + ')');
      atual = pai;
      if (unico(partes.join(' > '))) break;
    }
    if (unico(partes.join(' > '))) seletor = partes.join(' > ');
  }
  var campo = ['input', 'textarea', 'select'].indexOf(tag) >= 0;
  var texto = campo ? undefined : ((el.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 80) || undefined);
  return { seletor: seletor, texto: texto, tag: tag, scrollY: Math.round(window.scrollY) };
})`;

async function descreverElemento(page: any, x: number | null, y: number | null): Promise<Omit<AlvoElemento, 'x' | 'y'> | null> {
  return page.evaluate(`${SCRIPT_DESCREVER}(${x === null ? 'null' : x}, ${y === null ? 'null' : y})`).catch(() => null);
}

async function localizarElemento(page: any, alvo: AlvoElemento) {
  if (alvo.seletor) {
    const el = await page.$(alvo.seletor).catch(() => null);
    if (el && (await el.boundingBox())) return el;
  }
  if (alvo.texto) {
    const handle = await page.evaluateHandle(
      (texto: string, tag?: string) => {
        const candidatos = Array.from(document.querySelectorAll(tag ? `${tag}, button, a, [role="button"]` : 'button, a, [role="button"], label, span, div')) as HTMLElement[];
        return (
          candidatos.find(c => c.offsetParent !== null && (c.innerText || '').replace(/\s+/g, ' ').trim() === texto) || null
        );
      },
      alvo.texto,
      alvo.tag,
    );
    const el = handle.asElement();
    if (el && (await el.boundingBox())) return el;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Execução de um passo (usada na gravação ao vivo e na repetição)
// ---------------------------------------------------------------------------

async function digitarDevagar(page: any, texto: string) {
  for (const ch of texto) {
    await page.keyboard.type(ch);
    await esperar(50 + Math.random() * 60);
  }
}

export async function executarPasso(page: any, passo: PassoRpa, vars: VariaveisRpa): Promise<void> {
  switch (passo.tipo) {
    case 'clique': {
      const el = await localizarElemento(page, passo.alvo);
      if (el) {
        await el.click();
      } else if (passo.opcional) {
        return;
      } else {
        await page.evaluate((y: number) => window.scrollTo(0, y), passo.alvo.scrollY || 0);
        await page.mouse.click(passo.alvo.x, passo.alvo.y);
      }
      break;
    }
    case 'digitar': {
      if (passo.alvo) {
        const el = await localizarElemento(page, passo.alvo);
        if (el) await el.click();
      }
      if (passo.limpar) {
        await page.keyboard.down('Control');
        await page.keyboard.press('KeyA');
        await page.keyboard.up('Control');
        await page.keyboard.press('Backspace');
      }
      await digitarDevagar(page, substituirVariaveis(passo.valor, vars));
      break;
    }
    case 'tecla':
      await page.keyboard.press(passo.tecla === 'Space' ? ' ' : passo.tecla);
      break;
    case 'rolar':
      await page.mouse.wheel({ deltaY: passo.dy });
      break;
    case 'navegar':
      await abrirUrl(page, substituirVariaveis(passo.url, vars));
      break;
    case 'esperar':
      await esperar(passo.ms);
      return;
    case 'aguardarPdf':
      return;
  }
  await esperar(passo.esperaMs);
}

export function descreverPasso(p: PassoRpa): string {
  switch (p.tipo) {
    case 'clique':
      return `Clicar em ${p.alvo.texto ? `"${p.alvo.texto}"` : p.alvo.seletor || `(${Math.round(p.alvo.x)}, ${Math.round(p.alvo.y)})`}`;
    case 'digitar':
      return `Digitar "${p.valor}"`;
    case 'tecla':
      return `Tecla ${p.tecla}`;
    case 'rolar':
      return `Rolar ${p.dy > 0 ? 'para baixo' : 'para cima'}`;
    case 'esperar':
      return `Esperar ${Math.round(p.ms / 100) / 10}s`;
    case 'navegar':
      return `Ir para ${p.url}`;
    case 'aguardarPdf':
      return `Aguardar o PDF (até ${Math.round(p.timeoutMs / 1000)}s)`;
  }
}

// ---------------------------------------------------------------------------
// Sessão de gravação: navegador ao vivo controlado pelo frontend
// ---------------------------------------------------------------------------

export class SessaoGravacao {
  readonly id = randomUUID();
  passos: PassoRpa[] = [];
  ultimaAtividade = Date.now();
  private ultimaAcao = Date.now();
  private pastaDownload = fs.mkdtempSync(path.join(os.tmpdir(), 'rpa-grav-'));

  private constructor(
    private browser: any,
    public page: any,
    public vars: VariaveisRpa,
    private capturador: { obter(): Promise<Buffer | undefined> },
  ) {}

  static async abrir(url: string, vars: VariaveisRpa, passosIniciais: PassoRpa[] = []) {
    const { browser, prepararPagina } = await abrirNavegador();
    try {
      const page = await prepararPagina((await browser.pages())[0]);
      const sessao = new SessaoGravacao(browser, page, vars, { obter: async () => undefined });
      sessao.capturador = await capturarPdfs(browser, page, sessao.pastaDownload);
      await abrirUrl(page, url);
      // Continuar um roteiro existente: repete os passos já gravados antes de gravar mais.
      for (const p of passosIniciais) {
        if (p.tipo !== 'aguardarPdf') await executarPasso(page, p, vars).catch(() => {});
      }
      sessao.passos = [...passosIniciais];
      return sessao;
    } catch (err) {
      await browser.close().catch(() => {});
      throw err;
    }
  }

  // A espera do passo anterior é o tempo que a pessoa levou até a próxima ação.
  private registrar(passo: PassoRpa) {
    const agora = Date.now();
    const anterior = this.passos[this.passos.length - 1];
    if (anterior && 'esperaMs' in anterior) anterior.esperaMs = Math.min(Math.max(agora - this.ultimaAcao, 500), 10_000);
    this.passos.push(passo);
    this.ultimaAcao = agora;
    this.ultimaAtividade = agora;
  }

  async tela(): Promise<Buffer> {
    this.ultimaAtividade = Date.now();
    return Buffer.from(await this.page.screenshot({ type: 'jpeg', quality: 70 }));
  }

  async pdfCapturado() {
    return Boolean(await this.capturador.obter());
  }

  async acao(dados: any): Promise<void> {
    switch (dados?.tipo) {
      case 'clique': {
        const x = numero(dados.x, 0, 0, LARGURA_TELA);
        const y = numero(dados.y, 0, 0, ALTURA_TELA);
        const desc = await descreverElemento(this.page, x, y);
        await this.page.mouse.click(x, y);
        this.registrar({ tipo: 'clique', alvo: { ...(desc || {}), x, y }, esperaMs: 1000 });
        break;
      }
      case 'digitar': {
        const valor = String(dados.valor ?? '');
        const desc = await descreverElemento(this.page, null, null);
        const passo: PassoRpa = {
          tipo: 'digitar',
          valor,
          alvo: desc ? { ...desc, x: 0, y: 0 } : undefined,
          limpar: dados.limpar !== false,
          esperaMs: 1000,
        };
        await executarPasso(this.page, { ...passo, alvo: undefined, esperaMs: 0 }, this.vars);
        this.registrar(passo);
        break;
      }
      case 'tecla': {
        if (!TECLAS_PERMITIDAS.includes(dados.tecla)) throw new Error('Tecla não permitida.');
        await executarPasso(this.page, { tipo: 'tecla', tecla: dados.tecla, esperaMs: 0 }, this.vars);
        this.registrar({ tipo: 'tecla', tecla: dados.tecla, esperaMs: 1000 });
        break;
      }
      case 'rolar': {
        const dy = numero(dados.dy, 400, -5000, 5000);
        await this.page.mouse.wheel({ deltaY: dy });
        this.registrar({ tipo: 'rolar', dy, esperaMs: 800 });
        break;
      }
      case 'esperar':
        this.registrar({ tipo: 'esperar', ms: numero(dados.ms, 2000, 0, 120_000) });
        break;
      case 'navegar': {
        const url = String(dados.url || '');
        if (!/^https?:\/\//i.test(url)) throw new Error('URL inválida.');
        await abrirUrl(this.page, substituirVariaveis(url, this.vars));
        this.registrar({ tipo: 'navegar', url, esperaMs: 2000 });
        break;
      }
      case 'aguardarPdf':
        this.registrar({ tipo: 'aguardarPdf', timeoutMs: numero(dados.timeoutMs, 60_000, 5_000, 300_000) });
        break;
      default:
        throw new Error('Ação desconhecida.');
    }
  }

  async fechar() {
    await this.browser.close().catch(() => {});
    fs.rmSync(this.pastaDownload, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Execução de um roteiro salvo
// ---------------------------------------------------------------------------

export class RoteiroFalhouError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RoteiroFalhouError';
  }
}

export async function executarRoteiro(
  roteiro: Pick<RoteiroRpa, 'urlInicial' | 'passos' | 'nome'>,
  vars: VariaveisRpa,
  opcoes: { onProgresso?: (etapa: string) => void; ajudaHumana?: AjudaHumana; salvarPrint?: (page: any) => Promise<string | null> } = {},
): Promise<{ pdf?: Buffer; textoPagina?: string }> {
  const progresso = opcoes.onProgresso || (() => {});
  const pastaDownload = fs.mkdtempSync(path.join(os.tmpdir(), 'rpa-exec-'));
  const { browser, prepararPagina } = await abrirNavegador();
  let page: any;

  // Se o portal pedir captcha, a tela vai para a pessoa resolver.
  const liberarCaptcha = async () => {
    if (!(await desafioCaptchaVisivel(page))) return;
    const ok = opcoes.ajudaHumana ? await opcoes.ajudaHumana(page, async () => !(await desafioCaptchaVisivel(page))) : false;
    if (!ok) throw new RoteiroFalhouError('O portal pediu verificação de captcha e ela não foi resolvida.');
  };

  try {
    page = await prepararPagina((await browser.pages())[0]);
    const capturador = await capturarPdfs(browser, page, pastaDownload);

    const aguardarPdf = async (timeoutMs: number) => {
      const limite = Date.now() + timeoutMs;
      while (Date.now() < limite) {
        const pdf = await capturador.obter();
        if (pdf) return pdf;
        const texto: string = await page.evaluate(() => document.body.innerText).catch(() => '');
        if (/insuficientes para a emiss[aã]o/i.test(texto)) throw Object.assign(new Error('sem-pdf'), { textoPagina: texto });
        await liberarCaptcha();
        await esperar(1000);
      }
      return undefined;
    };

    progresso(`Abrindo ${new URL(roteiro.urlInicial).host}...`);
    await abrirUrl(page, substituirVariaveis(roteiro.urlInicial, vars));
    await esperar(1500);

    for (let i = 0; i < roteiro.passos.length; i++) {
      const passo = roteiro.passos[i];
      progresso(`Passo ${i + 1}/${roteiro.passos.length}: ${descreverPasso(passo)}`);
      await liberarCaptcha();
      if (passo.tipo === 'aguardarPdf') {
        const pdf = await aguardarPdf(passo.timeoutMs);
        if (pdf) return { pdf };
        continue;
      }
      await executarPasso(page, passo, vars);
      const pdf = await capturador.obter();
      if (pdf) return { pdf };
    }

    progresso('Aguardando o PDF...');
    const pdf = await aguardarPdf(30_000);
    if (pdf) return { pdf };
    throw new RoteiroFalhouError(`O roteiro "${roteiro.nome}" terminou sem gerar PDF.`);
  } catch (err: any) {
    if (err?.textoPagina) return { textoPagina: err.textoPagina };
    if (page && opcoes.salvarPrint) {
      const print = await opcoes.salvarPrint(page);
      if (print) err.message += ` Print da tela salvo em Arquivos: ${print}.`;
    }
    throw err;
  } finally {
    await browser.close().catch(() => {});
    fs.rmSync(pastaDownload, { recursive: true, force: true });
  }
}
