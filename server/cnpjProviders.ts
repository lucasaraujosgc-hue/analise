// Consulta de CNPJ em várias bases públicas com mesclagem dos resultados.
//
// Por que várias fontes: a instância pública da MinhaReceita roda em "modo de
// privacidade" — ela remove o e-mail de TODAS as empresas e, para empresário
// individual (MEI/EI), remove também telefone e logradouro. Antes, o sistema só
// tentava outra fonte quando a MinhaReceita falhava, então telefone/e-mail nunca
// apareciam. Agora todas as fontes são consultadas em paralelo e os contatos são
// unidos (sem duplicar), mantendo a MinhaReceita como base cadastral principal.

export type FetchLike = (url: string, init?: any) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<any>;
}>;

export interface CnaeItem {
  codigo: string;
  descricao: string;
}

export interface SocioItem {
  nome_socio: string;
  qualificacao_socio: string;
  faixa_etaria?: string;
  data_entrada_sociedade?: string;
  pais?: string;
}

export interface EnderecoParcial {
  tipo_logradouro?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string;
  municipio?: string;
  uf?: string;
}

export interface InscricaoEstadual {
  inscricao: string;
  uf: string;
  ativa: boolean;
}

export interface ProviderData {
  fonte: string;
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  situacao_cadastral?: string;
  data_situacao_cadastral?: string;
  motivo_situacao_cadastral?: string;
  data_inicio_atividade?: string;
  natureza_juridica?: string;
  porte?: string;
  capital_social?: number;
  telefones: string[];
  emails: string[];
  endereco?: EnderecoParcial;
  cnae_fiscal?: CnaeItem;
  cnaes_secundarios?: CnaeItem[];
  qsa?: SocioItem[];
  opcao_pelo_simples?: boolean;
  data_opcao_pelo_simples?: string;
  data_exclusao_do_simples?: string;
  opcao_pelo_mei?: boolean;
  data_opcao_pelo_mei?: string;
  data_exclusao_do_mei?: string;
  inscricoes_estaduais?: InscricaoEstadual[];
}

export const NAO_CADASTRADO = 'Não cadastrado';

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

// Mantém letras e números: a partir de julho/2026 a RFB passou a emitir CNPJ
// alfanumérico (IN RFB 2.229/2024), então não podemos descartar letras.
export function sanitizeCnpj(value: string): string {
  return String(value || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
}

// Dígito verificador compatível com CNPJ numérico e alfanumérico
// (valor de cada caractere = código ASCII - 48).
export function isValidCnpj(value: string): boolean {
  const cnpj = sanitizeCnpj(value);
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj)) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calc = (base: string) => {
    const weights = base.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = base.split('').reduce((acc, ch, i) => acc + (ch.charCodeAt(0) - 48) * weights[i], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const dv1 = calc(cnpj.slice(0, 12));
  const dv2 = calc(cnpj.slice(0, 12) + dv1);
  return cnpj.endsWith(`${dv1}${dv2}`);
}

function str(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value).trim();
  return s === 'null' || s === 'undefined' ? '' : s;
}

function bool(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  const s = str(value).toUpperCase();
  if (['S', 'SIM', 'TRUE', 'Y'].includes(s)) return true;
  if (['N', 'NAO', 'NÃO', 'FALSE'].includes(s)) return false;
  return undefined;
}

function num(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  const s = str(value);
  if (!s) return undefined;
  // "4000.00" ou "4.000,00"
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : undefined;
}

// Converte "dd/mm/aaaa" ou "aaaa-mm-dd..." para "aaaa-mm-dd".
export function isoDate(value: unknown): string | undefined {
  const s = str(value);
  if (!s) return undefined;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return undefined;
}

// Normaliza um telefone para somente dígitos com DDD (10 ou 11 dígitos).
export function normalizePhone(raw: unknown, ddd?: unknown): string | null {
  let digits = str(raw).replace(/\D/g, '');
  const dddDigits = str(ddd).replace(/\D/g, '');
  if (!digits) return null;

  if (dddDigits && (digits.length === 8 || digits.length === 9)) {
    digits = dddDigits.slice(-2) + digits;
  }
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    digits = digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  if (digits.length === 12 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  if (digits.length !== 10 && digits.length !== 11) return null;
  if (/^(\d)\1+$/.test(digits)) return null;
  if (digits.startsWith('0')) return null;
  return digits;
}

export function formatPhone(digits: string): string {
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return digits;
}

export function normalizeEmail(raw: unknown): string | null {
  const s = str(raw).toLowerCase();
  if (!s) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? s : null;
}

function pushPhone(list: string[], raw: unknown, ddd?: unknown) {
  // Campos como o da ReceitaWS trazem vários números: "(75) 3642-1234 / (75) 99999-0000"
  const parts = ddd ? [raw] : str(raw).split(/[\/;,]| e /);
  for (const part of parts) {
    const phone = normalizePhone(part, ddd);
    if (phone && !list.includes(phone)) list.push(phone);
  }
}

function pushEmail(list: string[], raw: unknown) {
  for (const part of str(raw).split(/[;,\s]+/)) {
    const email = normalizeEmail(part);
    if (email && !list.includes(email)) list.push(email);
  }
}

function cleanCnaes(list: unknown, codeKey: string[], descKey: string[]): CnaeItem[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((c: any) => ({
      codigo: str(codeKey.map(k => c?.[k]).find(v => str(v))).replace(/\D/g, ''),
      descricao: str(descKey.map(k => c?.[k]).find(v => str(v))),
    }))
    .filter(c => c.codigo && c.codigo !== '0');
}

// ---------------------------------------------------------------------------
// Normalizadores de cada fonte
// ---------------------------------------------------------------------------

// MinhaReceita e BrasilAPI usam o mesmo formato (dados abertos da RFB).
export function normalizeMinhaReceita(d: any, fonte = 'MinhaReceita'): ProviderData | null {
  if (!d || typeof d !== 'object' || !str(d.razao_social)) return null;
  const telefones: string[] = [];
  pushPhone(telefones, d.ddd_telefone_1);
  pushPhone(telefones, d.ddd_telefone_2);
  const emails: string[] = [];
  pushEmail(emails, d.email);

  return {
    fonte,
    cnpj: sanitizeCnpj(d.cnpj),
    razao_social: str(d.razao_social),
    nome_fantasia: str(d.nome_fantasia),
    situacao_cadastral: str(d.descricao_situacao_cadastral).toUpperCase(),
    data_situacao_cadastral: isoDate(d.data_situacao_cadastral),
    motivo_situacao_cadastral: str(d.descricao_motivo_situacao_cadastral),
    data_inicio_atividade: isoDate(d.data_inicio_atividade),
    natureza_juridica: [str(d.codigo_natureza_juridica), str(d.natureza_juridica)].filter(Boolean).join(' - '),
    porte: str(d.porte || d.descricao_porte),
    capital_social: num(d.capital_social),
    telefones,
    emails,
    endereco: {
      tipo_logradouro: str(d.descricao_tipo_de_logradouro),
      logradouro: str(d.logradouro),
      numero: str(d.numero),
      complemento: str(d.complemento),
      bairro: str(d.bairro),
      cep: str(d.cep).replace(/\D/g, ''),
      municipio: str(d.municipio),
      uf: str(d.uf).toUpperCase(),
    },
    cnae_fiscal: str(d.cnae_fiscal)
      ? { codigo: str(d.cnae_fiscal).replace(/\D/g, ''), descricao: str(d.cnae_fiscal_descricao) }
      : undefined,
    cnaes_secundarios: cleanCnaes(d.cnaes_secundarios, ['codigo'], ['descricao']),
    qsa: Array.isArray(d.qsa)
      ? d.qsa.map((s: any) => ({
          nome_socio: str(s.nome_socio || s.nome),
          qualificacao_socio: str(s.qualificacao_socio),
          faixa_etaria: str(s.faixa_etaria),
          data_entrada_sociedade: isoDate(s.data_entrada_sociedade),
          pais: str(s.pais),
        })).filter((s: SocioItem) => s.nome_socio)
      : undefined,
    opcao_pelo_simples: bool(d.opcao_pelo_simples),
    data_opcao_pelo_simples: isoDate(d.data_opcao_pelo_simples),
    data_exclusao_do_simples: isoDate(d.data_exclusao_do_simples),
    opcao_pelo_mei: bool(d.opcao_pelo_mei),
    data_opcao_pelo_mei: isoDate(d.data_opcao_pelo_mei),
    data_exclusao_do_mei: isoDate(d.data_exclusao_do_mei),
  };
}

// https://publica.cnpj.ws/cnpj/{cnpj}
export function normalizeCnpjWs(d: any): ProviderData | null {
  const est = d?.estabelecimento;
  if (!d || !est || !str(d.razao_social)) return null;
  const telefones: string[] = [];
  pushPhone(telefones, est.telefone1, est.ddd1);
  pushPhone(telefones, est.telefone2, est.ddd2);
  const emails: string[] = [];
  pushEmail(emails, est.email);

  const simples = d.simples || {};
  return {
    fonte: 'CNPJ.ws',
    cnpj: sanitizeCnpj(est.cnpj),
    razao_social: str(d.razao_social),
    nome_fantasia: str(est.nome_fantasia),
    situacao_cadastral: str(est.situacao_cadastral).toUpperCase(),
    data_situacao_cadastral: isoDate(est.data_situacao_cadastral),
    motivo_situacao_cadastral: str(est.motivo_situacao_cadastral?.descricao),
    data_inicio_atividade: isoDate(est.data_inicio_atividade),
    natureza_juridica: [str(d.natureza_juridica?.id), str(d.natureza_juridica?.descricao)].filter(Boolean).join(' - '),
    porte: str(d.porte?.descricao),
    capital_social: num(d.capital_social),
    telefones,
    emails,
    endereco: {
      tipo_logradouro: str(est.tipo_logradouro),
      logradouro: str(est.logradouro),
      numero: str(est.numero),
      complemento: str(est.complemento),
      bairro: str(est.bairro),
      cep: str(est.cep).replace(/\D/g, ''),
      municipio: str(est.cidade?.nome),
      uf: str(est.estado?.sigla).toUpperCase(),
    },
    cnae_fiscal: est.atividade_principal
      ? {
          codigo: str(est.atividade_principal.subclasse || est.atividade_principal.id).replace(/\D/g, ''),
          descricao: str(est.atividade_principal.descricao),
        }
      : undefined,
    cnaes_secundarios: cleanCnaes(est.atividades_secundarias, ['subclasse', 'id'], ['descricao']),
    qsa: Array.isArray(d.socios)
      ? d.socios.map((s: any) => ({
          nome_socio: str(s.nome),
          qualificacao_socio: str(s.qualificacao_socio?.descricao),
          faixa_etaria: str(s.faixa_etaria),
          data_entrada_sociedade: isoDate(s.data_entrada),
          pais: str(s.pais?.nome),
        })).filter((s: SocioItem) => s.nome_socio)
      : undefined,
    opcao_pelo_simples: bool(simples.simples),
    data_opcao_pelo_simples: isoDate(simples.data_opcao_simples),
    data_exclusao_do_simples: isoDate(simples.data_exclusao_simples),
    opcao_pelo_mei: bool(simples.mei),
    data_opcao_pelo_mei: isoDate(simples.data_opcao_mei),
    data_exclusao_do_mei: isoDate(simples.data_exclusao_mei),
    inscricoes_estaduais: Array.isArray(est.inscricoes_estaduais)
      ? est.inscricoes_estaduais
          .map((ie: any) => ({
            inscricao: str(ie.inscricao_estadual),
            uf: str(ie.estado?.sigla).toUpperCase(),
            ativa: ie.ativo !== false,
          }))
          .filter((ie: InscricaoEstadual) => ie.inscricao)
      : undefined,
  };
}

// https://receitaws.com.br/v1/cnpj/{cnpj} — lê o comprovante de inscrição,
// por isso costuma trazer telefone e e-mail quando as bases abertas não trazem.
export function normalizeReceitaWs(d: any): ProviderData | null {
  if (!d || d.status === 'ERROR' || !str(d.nome)) return null;
  const telefones: string[] = [];
  pushPhone(telefones, d.telefone);
  const emails: string[] = [];
  pushEmail(emails, d.email);

  const principal = Array.isArray(d.atividade_principal) ? d.atividade_principal[0] : undefined;
  return {
    fonte: 'ReceitaWS',
    cnpj: sanitizeCnpj(d.cnpj),
    razao_social: str(d.nome),
    nome_fantasia: str(d.fantasia),
    situacao_cadastral: str(d.situacao).toUpperCase(),
    data_situacao_cadastral: isoDate(d.data_situacao),
    motivo_situacao_cadastral: str(d.motivo_situacao),
    data_inicio_atividade: isoDate(d.abertura),
    natureza_juridica: str(d.natureza_juridica),
    porte: str(d.porte),
    capital_social: num(d.capital_social),
    telefones,
    emails,
    endereco: {
      logradouro: str(d.logradouro),
      numero: str(d.numero),
      complemento: str(d.complemento),
      bairro: str(d.bairro),
      cep: str(d.cep).replace(/\D/g, ''),
      municipio: str(d.municipio),
      uf: str(d.uf).toUpperCase(),
    },
    cnae_fiscal: principal
      ? { codigo: str(principal.code).replace(/\D/g, ''), descricao: str(principal.text) }
      : undefined,
    cnaes_secundarios: cleanCnaes(d.atividades_secundarias, ['code'], ['text']),
    qsa: Array.isArray(d.qsa)
      ? d.qsa.map((s: any) => ({
          nome_socio: str(s.nome),
          qualificacao_socio: str(s.qual).replace(/^\d+-/, ''),
          pais: str(s.pais_origem),
        })).filter((s: SocioItem) => s.nome_socio)
      : undefined,
    opcao_pelo_simples: bool(d.simples?.optante),
    data_opcao_pelo_simples: isoDate(d.simples?.data_opcao),
    data_exclusao_do_simples: isoDate(d.simples?.data_exclusao),
    opcao_pelo_mei: bool(d.simei?.optante),
    data_opcao_pelo_mei: isoDate(d.simei?.data_opcao),
    data_exclusao_do_mei: isoDate(d.simei?.data_exclusao),
  };
}

// https://open.cnpja.com/office/{cnpj}
export function normalizeCnpja(d: any): ProviderData | null {
  if (!d || !d.company || !str(d.company.name)) return null;
  const telefones: string[] = [];
  for (const p of Array.isArray(d.phones) ? d.phones : []) pushPhone(telefones, p?.number, p?.area);
  const emails: string[] = [];
  for (const e of Array.isArray(d.emails) ? d.emails : []) pushEmail(emails, e?.address);

  const address = d.address || {};
  return {
    fonte: 'CNPJá',
    cnpj: sanitizeCnpj(d.taxId),
    razao_social: str(d.company.name),
    nome_fantasia: str(d.alias),
    situacao_cadastral: str(d.status?.text).toUpperCase(),
    data_situacao_cadastral: isoDate(d.statusDate),
    data_inicio_atividade: isoDate(d.founded),
    natureza_juridica: [str(d.company.nature?.id), str(d.company.nature?.text)].filter(Boolean).join(' - '),
    porte: str(d.company.size?.text),
    capital_social: num(d.company.equity),
    telefones,
    emails,
    endereco: {
      logradouro: str(address.street),
      numero: str(address.number),
      complemento: str(address.details),
      bairro: str(address.district),
      cep: str(address.zip).replace(/\D/g, ''),
      municipio: str(address.city),
      uf: str(address.state).toUpperCase(),
    },
    cnae_fiscal: d.mainActivity
      ? { codigo: str(d.mainActivity.id).replace(/\D/g, ''), descricao: str(d.mainActivity.text) }
      : undefined,
    cnaes_secundarios: cleanCnaes(d.sideActivities, ['id'], ['text']),
    qsa: Array.isArray(d.company.members)
      ? d.company.members.map((m: any) => ({
          nome_socio: str(m.person?.name),
          qualificacao_socio: str(m.role?.text),
          faixa_etaria: str(m.person?.age),
          data_entrada_sociedade: isoDate(m.since),
        })).filter((s: SocioItem) => s.nome_socio)
      : undefined,
    opcao_pelo_simples: bool(d.company.simples?.optant),
    data_opcao_pelo_simples: isoDate(d.company.simples?.since),
    opcao_pelo_mei: bool(d.company.simei?.optant),
    data_opcao_pelo_mei: isoDate(d.company.simei?.since),
    inscricoes_estaduais: Array.isArray(d.registrations)
      ? d.registrations
          .map((r: any) => ({ inscricao: str(r.number), uf: str(r.state).toUpperCase(), ativa: r.enabled !== false }))
          .filter((r: InscricaoEstadual) => r.inscricao)
      : undefined,
  };
}

// https://api.opencnpj.org/{cnpj}
export function normalizeOpenCnpj(d: any): ProviderData | null {
  if (!d || !str(d.razao_social)) return null;
  const telefones: string[] = [];
  for (const t of Array.isArray(d.telefones) ? d.telefones : []) {
    if (t?.is_fax) continue;
    pushPhone(telefones, t?.numero, t?.ddd);
  }
  const emails: string[] = [];
  pushEmail(emails, d.email);

  return {
    fonte: 'OpenCNPJ',
    cnpj: sanitizeCnpj(d.cnpj),
    razao_social: str(d.razao_social),
    nome_fantasia: str(d.nome_fantasia),
    situacao_cadastral: str(d.situacao_cadastral).toUpperCase(),
    data_situacao_cadastral: isoDate(d.data_situacao_cadastral),
    data_inicio_atividade: isoDate(d.data_inicio_atividade),
    natureza_juridica: str(d.natureza_juridica),
    porte: str(d.porte_empresa),
    capital_social: num(d.capital_social),
    telefones,
    emails,
    endereco: {
      tipo_logradouro: str(d.tipo_logradouro),
      logradouro: str(d.logradouro),
      numero: str(d.numero),
      complemento: str(d.complemento),
      bairro: str(d.bairro),
      cep: str(d.cep).replace(/\D/g, ''),
      municipio: str(d.municipio),
      uf: str(d.uf).toUpperCase(),
    },
    cnae_fiscal: str(d.cnae_principal) ? { codigo: str(d.cnae_principal).replace(/\D/g, ''), descricao: '' } : undefined,
    opcao_pelo_simples: bool(d.opcao_simples),
    data_opcao_pelo_simples: isoDate(d.data_opcao_simples),
    opcao_pelo_mei: bool(d.opcao_mei),
    data_opcao_pelo_mei: isoDate(d.data_opcao_mei),
  };
}

export interface ProviderDef {
  nome: string;
  url: (cnpj: string) => string;
  normalize: (json: any) => ProviderData | null;
}

// Ordem = prioridade para os dados cadastrais. Contatos são unidos de todas.
export const PROVIDERS: ProviderDef[] = [
  { nome: 'MinhaReceita', url: c => `https://minhareceita.org/${c}`, normalize: d => normalizeMinhaReceita(d, 'MinhaReceita') },
  { nome: 'BrasilAPI', url: c => `https://brasilapi.com.br/api/cnpj/v1/${c}`, normalize: d => normalizeMinhaReceita(d, 'BrasilAPI') },
  { nome: 'OpenCNPJ', url: c => `https://api.opencnpj.org/${c}`, normalize: normalizeOpenCnpj },
  { nome: 'CNPJ.ws', url: c => `https://publica.cnpj.ws/cnpj/${c}`, normalize: normalizeCnpjWs },
  { nome: 'CNPJá', url: c => `https://open.cnpja.com/office/${c}`, normalize: normalizeCnpja },
  { nome: 'ReceitaWS', url: c => `https://receitaws.com.br/v1/cnpj/${c}`, normalize: normalizeReceitaWs },
];

// ---------------------------------------------------------------------------
// Mesclagem
// ---------------------------------------------------------------------------

export interface EmpresaNormalizada {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  situacao_cadastral: string;
  data_situacao_cadastral: string;
  motivo_situacao_cadastral: string;
  data_inicio_atividade: string;
  natureza_juridica: string;
  porte: string;
  capital_social: number;
  email: string;
  emails: string[];
  telefone: string;
  telefone_secundario?: string;
  telefones: string[];
  endereco: Required<EnderecoParcial> & { endereco_completo: string };
  cnae_fiscal: CnaeItem;
  cnaes_secundarios: CnaeItem[];
  qsa: SocioItem[];
  opcao_pelo_simples: boolean;
  opcao_pelo_mei: boolean;
  data_opcao_pelo_mei?: string;
  data_exclusao_do_mei?: string;
  inscricoes_estaduais: InscricaoEstadual[];
  source: string;
  fontes: string[];
  fontes_contato: string[];
}

function first<T>(items: ProviderData[], pick: (p: ProviderData) => T | undefined): T | undefined {
  for (const item of items) {
    const value = pick(item);
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && !value) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    return value;
  }
  return undefined;
}

export function mergeProviderData(cnpj: string, results: ProviderData[]): EmpresaNormalizada | null {
  const valid = results.filter(Boolean);
  if (valid.length === 0) return null;

  const telefones: string[] = [];
  const emails: string[] = [];
  const fontesContato = new Set<string>();
  for (const r of valid) {
    for (const t of r.telefones) {
      if (!telefones.includes(t)) {
        telefones.push(t);
        fontesContato.add(r.fonte);
      }
    }
    for (const e of r.emails) {
      if (!emails.includes(e)) {
        emails.push(e);
        fontesContato.add(r.fonte);
      }
    }
  }

  // Endereço inteiro da fonte mais prioritária que tenha logradouro, para não
  // misturar pedaços de endereços diferentes.
  const endereco =
    valid.find(r => r.endereco?.logradouro)?.endereco ||
    valid.find(r => r.endereco?.municipio)?.endereco ||
    {};
  const end = {
    tipo_logradouro: endereco.tipo_logradouro || '',
    logradouro: endereco.logradouro || '',
    numero: endereco.numero || 'S/N',
    complemento: endereco.complemento || '',
    bairro: endereco.bairro || '',
    cep: endereco.cep || '',
    municipio: endereco.municipio || '',
    uf: endereco.uf || '',
  };
  const rua = [end.tipo_logradouro, end.logradouro].filter(Boolean).join(' ');
  const endereco_completo = [
    [rua, end.numero].filter(Boolean).join(', ') + (end.complemento ? ` - ${end.complemento}` : ''),
    end.bairro,
    [end.municipio, end.uf].filter(Boolean).join('/'),
    end.cep ? `CEP: ${end.cep}` : '',
  ].filter(s => s && s.trim()).join(', ');

  const cnaeFiscal = first(valid, r => (r.cnae_fiscal?.codigo ? r.cnae_fiscal : undefined));
  // Algumas fontes trazem só o código do CNAE; completa a descrição com outra fonte.
  const cnaeDescricao = cnaeFiscal
    ? first(valid, r => (r.cnae_fiscal?.codigo === cnaeFiscal.codigo ? r.cnae_fiscal.descricao : undefined))
    : undefined;

  const opcaoMei = first(valid, r => r.opcao_pelo_mei);
  const naturezaJuridica = first(valid, r => r.natureza_juridica) || '';

  return {
    cnpj,
    razao_social: first(valid, r => r.razao_social) || '',
    nome_fantasia: first(valid, r => r.nome_fantasia) || 'Não informado',
    situacao_cadastral: first(valid, r => r.situacao_cadastral) || 'NÃO INFORMADA',
    data_situacao_cadastral: first(valid, r => r.data_situacao_cadastral) || '',
    motivo_situacao_cadastral: first(valid, r => r.motivo_situacao_cadastral) || '',
    data_inicio_atividade: first(valid, r => r.data_inicio_atividade) || '',
    natureza_juridica: naturezaJuridica,
    porte: first(valid, r => r.porte) || 'Não informado',
    capital_social: first(valid, r => r.capital_social) ?? 0,
    email: emails[0] || NAO_CADASTRADO,
    emails,
    telefone: telefones[0] ? formatPhone(telefones[0]) : NAO_CADASTRADO,
    telefone_secundario: telefones[1] ? formatPhone(telefones[1]) : undefined,
    telefones: telefones.map(formatPhone),
    endereco: { ...end, endereco_completo },
    cnae_fiscal: cnaeFiscal
      ? { codigo: cnaeFiscal.codigo, descricao: cnaeDescricao || 'Atividade principal' }
      : { codigo: '', descricao: 'Não informada' },
    cnaes_secundarios: first(valid, r => r.cnaes_secundarios) || [],
    qsa: first(valid, r => r.qsa) || [],
    opcao_pelo_simples: Boolean(first(valid, r => r.opcao_pelo_simples)),
    opcao_pelo_mei: Boolean(opcaoMei),
    data_opcao_pelo_mei: first(valid, r => r.data_opcao_pelo_mei),
    data_exclusao_do_mei: first(valid, r => r.data_exclusao_do_mei),
    inscricoes_estaduais: first(valid, r => r.inscricoes_estaduais) || [],
    source: valid[0].fonte,
    fontes: valid.map(r => r.fonte),
    fontes_contato: Array.from(fontesContato),
  };
}

export async function fetchProvider(
  provider: ProviderDef,
  cnpj: string,
  fetchImpl: FetchLike,
  timeoutMs: number,
): Promise<ProviderData | null> {
  try {
    const res = await fetchImpl(provider.url(cnpj), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VirgulaContabil/1.0)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return provider.normalize(await res.json());
  } catch (err) {
    console.warn(`[cnpj] ${provider.nome} indisponível:`, (err as Error)?.message || err);
    return null;
  }
}

export async function lookupCnpj(
  cnpj: string,
  options: { fetchImpl?: FetchLike; timeoutMs?: number; providers?: ProviderDef[] } = {},
): Promise<EmpresaNormalizada | null> {
  const clean = sanitizeCnpj(cnpj);
  const providers = options.providers || PROVIDERS;
  const fetchImpl = options.fetchImpl || (fetch as unknown as FetchLike);
  const timeoutMs = options.timeoutMs ?? 9000;

  const results = await Promise.all(providers.map(p => fetchProvider(p, clean, fetchImpl, timeoutMs)));
  return mergeProviderData(clean, results.filter((r): r is ProviderData => r !== null));
}
