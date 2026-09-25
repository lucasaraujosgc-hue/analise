export interface CNAE {
  codigo: string;
  descricao: string;
}

export interface SocioQSA {
  nome_socio: string;
  qualificacao_socio: string;
  faixa_etaria?: string;
  data_entrada_sociedade?: string;
  pais?: string;
}

export interface EnderecoEmpresa {
  tipo_logradouro?: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cep: string;
  municipio: string;
  uf: string;
  endereco_completo: string;
}

export interface InscricaoEstadual {
  inscricao: string;
  uf: string;
  ativa: boolean;
}

export type StatusCnd = 'NEGATIVA' | 'POSITIVA_COM_EFEITO_DE_NEGATIVA' | 'POSITIVA' | 'NAO_CONSULTADA' | 'INCONCLUSIVA';

export interface PendenciasResumo {
  cndFederal?: StatusCnd;
  cndEstadual?: StatusCnd;
  cndFederalValidade?: string;
  cndEstadualValidade?: string;
  totalDebitosMei?: number;
  guiasAtrasoMei?: number;
  guiasEmAbertoMei?: number;
  declaracoesPendentesMei?: number[];
  meiConsultadoEm?: string;
  meiFonte?: string;
  ultimaConsulta?: string;
}

export interface EmpresaData {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  situacao_cadastral: string;
  data_situacao_cadastral?: string;
  motivo_situacao_cadastral?: string;
  data_inicio_atividade: string;
  natureza_juridica: string;
  porte: string;
  capital_social: number;
  email: string;
  emails?: string[];
  telefone: string;
  telefone_secundario?: string;
  telefones?: string[];
  contatos_manuais?: { telefone?: string; email?: string };
  endereco: EnderecoEmpresa;
  cnae_fiscal: CNAE;
  cnaes_secundarios: CNAE[];
  qsa: SocioQSA[];
  opcao_pelo_simples: boolean;
  opcao_pelo_mei: boolean;
  data_opcao_pelo_mei?: string;
  data_exclusao_do_mei?: string;
  inscricoes_estaduais?: InscricaoEstadual[];
  source?: string;
  fontes?: string[];
  fontes_contato?: string[];
  lastUpdated?: string;
  pendenciasResumo?: PendenciasResumo;
}

export type TipoCertidao = 'NEGATIVA' | 'POSITIVA_COM_EFEITO_DE_NEGATIVA' | 'POSITIVA' | 'INCONCLUSIVA';

export interface CNDClassification {
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

export interface CNDAnalysisResult {
  success: boolean;
  fileName: string;
  extractedTextLength: number;
  sampleText: string;
  classification: CNDClassification;
}

// ---- MEI (PGMEI / DASN-SIMEI) ----

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

export interface CompetenciaMei {
  periodo: string;
  periodoApuracao: string;
  situacao: SituacaoCompetencia;
  vencimento?: string;
  vencida?: boolean;
  principal?: number;
  multa?: number;
  juros?: number;
  total?: number;
  dataLimitePagamento?: string;
  mensagem?: string;
}

export type SituacaoDeclaracao = 'PENDENTE' | 'ENTREGUE' | 'NAO_VERIFICADA';

export interface DeclaracaoMei {
  ano: number;
  situacao: SituacaoDeclaracao;
  prazo: string;
  fonte?: string;
  observacao?: string;
}

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
  fonte: 'PGMEI_ROBO' | 'IMPORTACAO_PGMEI';
  consultadoEm: string;
  periodoInicial?: string;
  periodoFinal?: string;
  competencias: CompetenciaMei[];
  declaracoes: DeclaracaoMei[];
  resumo: ResumoMei;
  avisos: string[];
}

export interface JobMei {
  id: string;
  cnpj: string;
  status: 'na_fila' | 'executando' | 'aguardando_humano' | 'concluido' | 'erro';
  etapa: string;
  atual: number;
  total: number;
  resultado?: ResultadoMei;
  erro?: string;
  bloqueado?: boolean;
}

export interface StatusSistema {
  robo_pgmei: { disponivel: boolean; headless: boolean };
  robo_cnd?: { disponivel: boolean };
  proxy_receita?: boolean;
  cnd_federal_url: string;
}

export interface StorageFile {
  filename: string;
  subfolder: string;
  categoria: string;
  size: number;
  updatedAt: string;
  downloadUrl: string;
}
