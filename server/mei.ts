// Regras e estruturas do módulo MEI: competências (DAS) em aberto, declarações
// anuais (DASN-SIMEI) e leitura do extrato copiado do PGMEI.

export type SituacaoCompetencia =
  | 'EM_ABERTO'
  | 'A_VENCER'
  | 'PAGO'
  | 'DIVIDA_ATIVA'
  | 'PARCELADO'
  | 'DEBITO_AUTOMATICO'
  | 'BLOQUEADO_DASN'
  | 'ABAIXO_MINIMO'
  | 'SEM_DEBITO'
  | 'NAO_OPTANTE'
  | 'REAPURACAO_NECESSARIA'
  | 'ERRO';

export interface ComposicaoTributo {
  tributo: string;
  total: number;
}

export interface CompetenciaMei {
  periodo: string; // MM/AAAA
  periodoApuracao: string; // AAAAMM
  situacao: SituacaoCompetencia;
  vencimento?: string; // DD/MM/AAAA
  vencida?: boolean;
  principal?: number;
  multa?: number;
  juros?: number;
  total?: number;
  dataLimitePagamento?: string;
  numeroDocumento?: string;
  linhaDigitavel?: string;
  composicao?: ComposicaoTributo[];
  mensagem?: string;
}

export type SituacaoDeclaracao = 'PENDENTE' | 'ENTREGUE' | 'NAO_VERIFICADA';

export interface DeclaracaoMei {
  ano: number;
  situacao: SituacaoDeclaracao;
  prazo: string; // DD/MM/AAAA
  fonte?: string;
  observacao?: string;
}

// PGMEI_ROBO: consulta automática no portal público do PGMEI (gratuita).
// IMPORTACAO_PGMEI: tabela copiada do PGMEI e colada no sistema.
export type FonteMei = 'PGMEI_ROBO' | 'IMPORTACAO_PGMEI';

export interface ResumoMei {
  qtdEmAberto: number;
  totalEmAberto: number;
  qtdVencidas: number;
  totalVencido: number;
  qtdDividaAtiva: number;
  totalDividaAtiva: number;
  qtdSemValor: number;
  totalGeral: number;
  declaracoesPendentes: number[];
}

export interface ResultadoMei {
  cnpj: string;
  fonte: FonteMei;
  consultadoEm: string;
  periodoInicial?: string;
  periodoFinal?: string;
  competencias: CompetenciaMei[];
  declaracoes: DeclaracaoMei[];
  resumo: ResumoMei;
  avisos: string[];
}

// Situações que representam dinheiro devido (entram nos totais / na lista "em aberto").
export const SITUACOES_EM_ABERTO: SituacaoCompetencia[] = [
  'EM_ABERTO',
  'A_VENCER',
  'DIVIDA_ATIVA',
  'BLOQUEADO_DASN',
  'ABAIXO_MINIMO',
  'REAPURACAO_NECESSARIA',
];

export const DESCRICAO_SITUACAO: Record<SituacaoCompetencia, string> = {
  EM_ABERTO: 'Em aberto (vencida)',
  A_VENCER: 'A vencer',
  PAGO: 'Pago',
  DIVIDA_ATIVA: 'Dívida ativa (PGFN)',
  PARCELADO: 'Parcelado',
  DEBITO_AUTOMATICO: 'Débito automático',
  BLOQUEADO_DASN: 'Bloqueado: falta DASN-SIMEI',
  ABAIXO_MINIMO: 'Abaixo do mínimo (R$ 10,00)',
  SEM_DEBITO: 'Sem débito',
  NAO_OPTANTE: 'Não optante SIMEI',
  REAPURACAO_NECESSARIA: 'Requer nova apuração no PGMEI',
  ERRO: 'Erro na consulta',
};

const MESES = [
  'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function paToPeriodo(pa: string): string {
  return `${pa.slice(4, 6)}/${pa.slice(0, 4)}`;
}

export function periodoToPa(periodo: string): string {
  const [mm, aaaa] = periodo.split('/');
  return `${aaaa}${mm.padStart(2, '0')}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function formatBr(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function parseBr(value?: string): Date | null {
  const m = value?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 23, 59, 59);
}

// AAAAMMDD -> DD/MM/AAAA
export function yyyymmddToBr(value?: string): string | undefined {
  const s = String(value || '');
  if (!/^\d{8}$/.test(s)) return undefined;
  return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
}

// O DAS do MEI vence no dia 20 do mês seguinte à competência.
export function vencimentoPadrao(pa: string): string {
  const ano = Number(pa.slice(0, 4));
  const mes = Number(pa.slice(4, 6));
  const venc = new Date(ano, mes, 20); // mês seguinte (0-based)
  return formatBr(venc);
}

export function estaVencida(vencimento: string | undefined, hoje = new Date()): boolean {
  const d = parseBr(vencimento);
  return d ? d.getTime() < hoje.getTime() : false;
}

// Lista as competências (AAAAMM) a verificar: do mês de opção pelo SIMEI (ou do
// limite de meses para trás) até o mês anterior ao atual. O mês corrente ainda
// não fechou, então não entra.
export function gerarCompetencias(options: {
  dataOpcaoMei?: string; // AAAA-MM-DD
  dataExclusaoMei?: string;
  meses?: number;
  hoje?: Date;
}): string[] {
  const hoje = options.hoje || new Date();
  const meses = Math.max(1, Math.min(options.meses ?? 60, 120));

  let fimAno = hoje.getFullYear();
  let fimMes = hoje.getMonth(); // mês anterior (1-based)
  if (fimMes === 0) {
    fimMes = 12;
    fimAno -= 1;
  }
  if (options.dataExclusaoMei) {
    const [a, m] = options.dataExclusaoMei.split('-').map(Number);
    if (a && m && a * 100 + m < fimAno * 100 + fimMes) {
      fimAno = a;
      fimMes = m;
    }
  }

  const fim = fimAno * 12 + (fimMes - 1);
  let inicio = fim - (meses - 1);
  if (options.dataOpcaoMei) {
    const [a, m] = options.dataOpcaoMei.split('-').map(Number);
    if (a && m) inicio = Math.max(inicio, a * 12 + (m - 1));
  }

  const lista: string[] = [];
  for (let i = inicio; i <= fim; i++) {
    lista.push(`${Math.floor(i / 12)}${pad((i % 12) + 1)}`);
  }
  return lista;
}

// Prazo da DASN-SIMEI: 31 de maio do ano seguinte.
export function prazoDasn(ano: number): string {
  return `31/05/${ano + 1}`;
}

// Anos-calendário cuja DASN-SIMEI já deveria ter sido entregue.
export function anosDasnExigiveis(options: { dataOpcaoMei?: string; dataExclusaoMei?: string; hoje?: Date }): number[] {
  const hoje = options.hoje || new Date();
  const anoAtual = hoje.getFullYear();
  const prazoAnoAnterior = new Date(anoAtual, 4, 31, 23, 59, 59);
  const ultimoAno = hoje.getTime() > prazoAnoAnterior.getTime() ? anoAtual - 1 : anoAtual - 2;

  let primeiroAno = Math.max(2009, ultimoAno - 9);
  if (options.dataOpcaoMei) {
    const a = Number(options.dataOpcaoMei.slice(0, 4));
    if (a) primeiroAno = Math.max(primeiroAno, a);
  }
  let fim = ultimoAno;
  if (options.dataExclusaoMei) {
    const a = Number(options.dataExclusaoMei.slice(0, 4));
    if (a) fim = Math.min(fim, a);
  }

  const anos: number[] = [];
  for (let a = primeiroAno; a <= fim; a++) anos.push(a);
  return anos;
}

export function montarDeclaracoes(
  anosExigiveis: number[],
  pendentes: Map<number, { fonte: string; observacao?: string }>,
  entregues: Map<number, { fonte: string }>,
): DeclaracaoMei[] {
  const anos = new Set<number>([...anosExigiveis, ...pendentes.keys()]);
  return Array.from(anos)
    .sort((a, b) => b - a)
    .map(ano => {
      const pend = pendentes.get(ano);
      if (pend) return { ano, situacao: 'PENDENTE' as const, prazo: prazoDasn(ano), fonte: pend.fonte, observacao: pend.observacao };
      const ent = entregues.get(ano);
      if (ent) return { ano, situacao: 'ENTREGUE' as const, prazo: prazoDasn(ano), fonte: ent.fonte };
      return { ano, situacao: 'NAO_VERIFICADA' as const, prazo: prazoDasn(ano) };
    });
}

export function resumir(competencias: CompetenciaMei[], declaracoes: DeclaracaoMei[]): ResumoMei {
  let qtdEmAberto = 0;
  let totalEmAberto = 0;
  let qtdVencidas = 0;
  let totalVencido = 0;
  let qtdDividaAtiva = 0;
  let totalDividaAtiva = 0;
  let qtdSemValor = 0;

  for (const c of competencias) {
    if (!SITUACOES_EM_ABERTO.includes(c.situacao)) continue;
    const valor = c.total ?? 0;
    if (c.total === undefined) qtdSemValor++;
    if (c.situacao === 'DIVIDA_ATIVA') {
      qtdDividaAtiva++;
      totalDividaAtiva += valor;
      continue;
    }
    qtdEmAberto++;
    totalEmAberto += valor;
    if (c.vencida) {
      qtdVencidas++;
      totalVencido += valor;
    }
  }

  return {
    qtdEmAberto,
    totalEmAberto: round2(totalEmAberto),
    qtdVencidas,
    totalVencido: round2(totalVencido),
    qtdDividaAtiva,
    totalDividaAtiva: round2(totalDividaAtiva),
    qtdSemValor,
    totalGeral: round2(totalEmAberto + totalDividaAtiva),
    declaracoesPendentes: declaracoes.filter(d => d.situacao === 'PENDENTE').map(d => d.ano).sort(),
  };
}

// ---------------------------------------------------------------------------
// Leitura do extrato copiado do PGMEI ("Emitir Guia de Pagamento (DAS)" ou
// "Consulta Extrato/Pendências"). Cada linha da tabela vira uma competência.
// ---------------------------------------------------------------------------

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function parseMoney(s: string): number {
  return Number(s.replace(/\./g, '').replace(',', '.'));
}

function situacaoPorTexto(linha: string): SituacaoCompetencia | null {
  const u = stripAccents(linha).toUpperCase();
  if (/DIVIDA ATIVA|PGFN|\bPFN\b/.test(u)) return 'DIVIDA_ATIVA';
  if (/PARCELAD/.test(u)) return 'PARCELADO';
  if (/DEBITO AUTOMATICO/.test(u)) return 'DEBITO_AUTOMATICO';
  if (/LIQUIDAD|\bPAGO\b|QUITAD/.test(u)) return 'PAGO';
  if (/A VENCER/.test(u)) return 'A_VENCER';
  if (/DEVEDOR|EM ABERTO|EM COBRANCA|VENCID/.test(u)) return 'EM_ABERTO';
  if (/NAO OPTANTE/.test(u)) return 'NAO_OPTANTE';
  return null;
}

function encontrarPeriodo(linha: string): string | null {
  const semAcento = stripAccents(linha).toLowerCase();
  // "Janeiro/2024" ou "janeiro de 2024"
  const nome = semAcento.match(/\b(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*(?:\/|de)\s*(20\d{2})\b/);
  if (nome) return `${nome[2]}${pad(MESES.indexOf(nome[1]) + 1)}`;
  // "01/2024" — sem confundir com datas "20/02/2024"
  const mmaaaa = linha.match(/(?<![\d/])(0[1-9]|1[0-2])\/(20\d{2})(?![\d/])/);
  if (mmaaaa) return `${mmaaaa[2]}${mmaaaa[1]}`;
  // "202401" isolado (formato AAAAMM)
  const aaaamm = linha.match(/(?<!\d)(20\d{2})(0[1-9]|1[0-2])(?!\d)/);
  if (aaaamm) return `${aaaamm[1]}${aaaamm[2]}`;
  return null;
}

export function parseExtratoPgmei(texto: string, hoje = new Date()): { competencias: CompetenciaMei[]; ignoradas: number } {
  const porPa = new Map<string, CompetenciaMei>();
  let ignoradas = 0;

  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.trim();
    if (!linha) continue;
    const pa = encontrarPeriodo(linha);
    if (!pa) continue;

    const valores = Array.from(linha.matchAll(/(?<![\d,])(\d{1,3}(?:\.\d{3})*,\d{2})(?![\d])/g)).map(m => parseMoney(m[1]));
    const datas = Array.from(linha.matchAll(/\b(\d{2}\/\d{2}\/\d{4})\b/g)).map(m => m[1]);

    let situacao = situacaoPorTexto(linha);
    if (!situacao) {
      if (valores.length === 0) {
        ignoradas++;
        continue;
      }
      situacao = 'EM_ABERTO';
    }

    const comp: CompetenciaMei = {
      periodo: paToPeriodo(pa),
      periodoApuracao: pa,
      situacao,
      vencimento: datas[0] || vencimentoPadrao(pa),
      dataLimitePagamento: datas[1],
    };

    // Ordem das colunas do PGMEI: Principal, Multa, Juros, Total.
    if (valores.length >= 4) {
      [comp.principal, comp.multa, comp.juros, comp.total] = valores.slice(0, 4);
    } else if (valores.length === 3) {
      comp.principal = valores[0];
      comp.multa = valores[1];
      comp.juros = 0;
      comp.total = valores[2];
    } else if (valores.length === 2) {
      comp.principal = valores[0];
      comp.total = valores[1];
      comp.multa = round2(valores[1] - valores[0]);
      comp.juros = 0;
    } else if (valores.length === 1) {
      comp.total = valores[0];
    }

    if (comp.situacao === 'EM_ABERTO' && !estaVencida(comp.vencimento, hoje)) comp.situacao = 'A_VENCER';
    comp.vencida = comp.situacao === 'EM_ABERTO' || (comp.situacao === 'DIVIDA_ATIVA');

    // Se a mesma competência aparecer mais de uma vez, fica a linha com mais dados.
    const anterior = porPa.get(pa);
    if (!anterior || (anterior.total === undefined && comp.total !== undefined)) porPa.set(pa, comp);
  }

  const competencias = Array.from(porPa.values()).sort((a, b) => b.periodoApuracao.localeCompare(a.periodoApuracao));
  return { competencias, ignoradas };
}

// O PGMEI bloqueia a emissão quando falta a DASN-SIMEI e avisa: "Sr. Contribuinte
// antes da geração do(s) documento(s) é necessário realizar a entrega da
// declaração do ano calendário de 2023."
export function extrairDasnPendentes(textos: string[]): number[] {
  const anos = new Set<number>();
  for (const texto of textos) {
    const u = stripAccents(texto).toUpperCase();
    const padroes = [
      /ENTREGA DA DECLARACAO DO ANO[- ]CALENDARIO (?:DE )?(20\d{2})/g,
      /DASN[- ]?SIMEI[^.]{0,80}?(?:ANO[- ]CALENDARIO (?:DE )?)?(20\d{2})/g,
    ];
    for (const p of padroes) {
      for (const m of u.matchAll(p)) anos.add(Number(m[1]));
    }
  }
  return Array.from(anos).sort();
}

// Lê uma lista de declarações DASN-SIMEI copiada do portal (anos que aparecem
// em linhas com indicação de entrega/transmissão).
export function parseDeclaracoesEntregues(texto: string): number[] {
  const anos = new Set<number>();
  for (const linha of texto.split(/\r?\n/)) {
    // Datas de transmissão ("15/04/2024") não são o ano-calendário.
    const u = stripAccents(linha).toUpperCase().replace(/\d{2}\/\d{2}\/\d{4}/g, ' ');
    if (!/ORIGINAL|RETIFICADORA|TRANSMITID|ENTREGUE|RECIBO|SITUACAO ESPECIAL/.test(u)) continue;
    for (const m of u.matchAll(/(?<!\d)(20\d{2})(?!\d)/g)) {
      const ano = Number(m[1]);
      if (ano >= 2009 && ano <= new Date().getFullYear()) {
        anos.add(ano);
        break; // o primeiro ano da linha é o ano-calendário
      }
    }
  }
  return Array.from(anos).sort();
}
