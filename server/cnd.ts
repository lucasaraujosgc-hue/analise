// Classificação de Certidões Negativas de Débitos (Federal e Estaduais) a partir
// do texto extraído do PDF.

export const CND_FEDERAL_URL = 'https://servicos.receitafederal.gov.br/servico/certidoes/#/home/cnpj';

export type TipoCertidao = 'NEGATIVA' | 'POSITIVA_COM_EFEITO_DE_NEGATIVA' | 'POSITIVA' | 'INCONCLUSIVA';

export interface CndClassification {
  tipo: TipoCertidao;
  diagnostico: string;
  badgeColor: 'green' | 'amber' | 'red' | 'gray';
  validade: string | null;
  vencida: boolean | null;
  emissao: string | null;
  codigo_controle: string | null;
  cnpj_encontrado: string | null;
  cnpj_confere: boolean | null;
}

// Remove acentos e normaliza espaços/quebras de linha (o texto extraído de PDF
// frequentemente quebra frases no meio).
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const TITULOS: { tipo: TipoCertidao; pattern: RegExp }[] = [
  { tipo: 'POSITIVA_COM_EFEITO_DE_NEGATIVA', pattern: /CERTIDAO POSITIVA,? COM EFEITOS? DE NEGATIVA/ },
  { tipo: 'NEGATIVA', pattern: /CERTIDAO NEGATIVA/ },
  { tipo: 'POSITIVA', pattern: /CERTIDAO POSITIVA/ },
];

const CORPO_EFEITO_NEGATIVA = [
  /POSITIVA,? COM EFEITOS? DE NEGATIVA/,
  /MESMOS EFEITOS DA CERTIDAO NEGATIVA/,
  /EXIGIBILIDADES? (ESTA|ESTAO|ENCONTRA-SE|SE ENCONTRA)M? SUSPENSAS?/,
  /EXIGIBILIDADE SUSPENSA/,
];

const CORPO_POSITIVA = [
  /CONSTAM DEBITOS/,
  /CONSTA\(M\) DEBITO/,
  /EXISTEM PENDENCIAS/,
  /PENDENTE ?\/ ?IRREGULAR/,
  /INSUFICIENTES PARA A EMISSAO DE CERTIDAO/,
];

const CORPO_NEGATIVA = [
  /NAO CONSTAM DEBITOS/,
  /NAO CONSTA(M)? (NENHUM )?DEBITO/,
  /NAO CONSTAM PENDENCIAS/,
  /INEXISTENCIA DE DEBITOS/,
  /SITUACAO REGULAR/,
];

function parseBrDate(value: string): Date | null {
  const m = value.match(/(\d{2})[\/.](\d{2})[\/.](\d{4})/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 23, 59, 59);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function classifyCndText(text: string, options: { cnpj?: string; hoje?: Date } = {}): CndClassification {
  const norm = normalizeText(text);

  // 1) O título da certidão é o indicador mais confiável: usa o que aparecer primeiro.
  // Em empate de posição vale a ordem de TITULOS ("CERTIDAO POSITIVA" também casa
  // no início de "CERTIDAO POSITIVA COM EFEITOS DE NEGATIVA").
  let tipo: TipoCertidao = 'INCONCLUSIVA';
  let bestIndex = Number.POSITIVE_INFINITY;
  for (const t of TITULOS) {
    const m = norm.match(t.pattern);
    if (m && m.index !== undefined && m.index < bestIndex) {
      bestIndex = m.index;
      tipo = t.tipo;
    }
  }

  // 2) Sem título reconhecível: usa as expressões do corpo.
  if (tipo === 'INCONCLUSIVA') {
    if (CORPO_EFEITO_NEGATIVA.some(p => p.test(norm))) tipo = 'POSITIVA_COM_EFEITO_DE_NEGATIVA';
    else if (CORPO_NEGATIVA.some(p => p.test(norm))) tipo = 'NEGATIVA';
    else if (CORPO_POSITIVA.some(p => p.test(norm))) tipo = 'POSITIVA';
  } else if (tipo === 'POSITIVA' && CORPO_EFEITO_NEGATIVA.some(p => p.test(norm))) {
    tipo = 'POSITIVA_COM_EFEITO_DE_NEGATIVA';
  }

  const diagnosticos: Record<TipoCertidao, { texto: string; cor: CndClassification['badgeColor'] }> = {
    NEGATIVA: {
      texto: 'Empresa regular: não constam débitos perante o órgão emissor na data de emissão.',
      cor: 'green',
    },
    POSITIVA_COM_EFEITO_DE_NEGATIVA: {
      texto:
        'Existem débitos, porém com exigibilidade suspensa (parcelamento em dia, garantia ou discussão judicial/administrativa). Tem os mesmos efeitos da certidão negativa.',
      cor: 'amber',
    },
    POSITIVA: {
      texto: /INSUFICIENTES PARA A EMISSAO DE CERTIDAO/.test(norm)
        ? 'A Receita não permitiu a emissão pela internet: há pendências a regularizar (consulte o Relatório de Situação Fiscal no e-CAC).'
        : 'Constam débitos exigíveis em aberto, sem suspensão de exigibilidade. A empresa está irregular perante o órgão emissor.',
      cor: 'red',
    },
    INCONCLUSIVA: {
      texto: 'Não foi possível identificar o tipo da certidão no texto extraído. Confira o documento visualmente.',
      cor: 'gray',
    },
  };

  const validadeMatch =
    text.match(/v[aá]lida\s+at[eé]\s*:?\s*(\d{2}[\/.]\d{2}[\/.]\d{4})/i) ||
    text.match(/validade\s*:?\s*(?:at[eé]\s*)?(\d{2}[\/.]\d{2}[\/.]\d{4})/i);
  const emissaoMatch =
    text.match(/emitid[ao]\s+[aà]s\s*(\d{2}:\d{2}(?::\d{2})?)\s+do\s+dia\s*(\d{2}[\/.]\d{2}[\/.]\d{4})/i) ||
    text.match(/(?:data\s+(?:da\s+)?)?emiss[aã]o\s*:?\s*(\d{2}[\/.]\d{2}[\/.]\d{4})/i);
  const controleMatch = text.match(/c[oó]digo\s+de\s+controle(?:\s+da\s+certid[aã]o)?\s*:?\s*([A-Z0-9][A-Z0-9.\-]{7,40})/i);
  const cnpjMatch = text.match(/(\d{2}\.\d{3}\.\d{3}(?:\/\d{4}-\d{2})?)/);

  const validade = validadeMatch ? validadeMatch[1] : null;
  const hoje = options.hoje || new Date();
  const validadeDate = validade ? parseBrDate(validade) : null;

  // A CND federal vale para matriz e filiais e às vezes mostra só a raiz (8 dígitos).
  let cnpjConfere: boolean | null = null;
  if (options.cnpj && cnpjMatch) {
    const alvo = options.cnpj.replace(/[^0-9A-Z]/gi, '');
    const encontrado = cnpjMatch[1].replace(/\D/g, '');
    cnpjConfere = alvo.slice(0, 8) === encontrado.slice(0, 8);
  }

  return {
    tipo,
    diagnostico: diagnosticos[tipo].texto,
    badgeColor: diagnosticos[tipo].cor,
    validade,
    vencida: validadeDate ? validadeDate.getTime() < hoje.getTime() : null,
    emissao: emissaoMatch ? (emissaoMatch[2] ? `${emissaoMatch[2]} às ${emissaoMatch[1]}` : emissaoMatch[1]) : null,
    codigo_controle: controleMatch ? controleMatch[1].replace(/\.$/, '') : null,
    cnpj_encontrado: cnpjMatch ? cnpjMatch[1] : null,
    cnpj_confere: cnpjConfere,
  };
}
