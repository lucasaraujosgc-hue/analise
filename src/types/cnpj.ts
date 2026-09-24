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

export interface PendenciasResumo {
  cndFederal?: 'NEGATIVA' | 'POSITIVA_COM_EFEITO_DE_NEGATIVA' | 'POSITIVA' | 'NAO_CONSULTADA' | 'INCONCLUSIVA';
  cndEstadual?: 'NEGATIVA' | 'POSITIVA_COM_EFEITO_DE_NEGATIVA' | 'POSITIVA' | 'NAO_CONSULTADA' | 'INCONCLUSIVA';
  totalDebitosMei?: number;
  guiasAtrasoMei?: number;
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
  telefone: string;
  telefone_secundario?: string;
  endereco: EnderecoEmpresa;
  cnae_fiscal: CNAE;
  cnaes_secundarios: CNAE[];
  qsa: SocioQSA[];
  opcao_pelo_simples: boolean;
  opcao_pelo_mei: boolean;
  source?: string;
  lastUpdated?: string;
  pendenciasResumo?: PendenciasResumo;
}

export type TipoCertidao = 'NEGATIVA' | 'POSITIVA_COM_EFEITO_DE_NEGATIVA' | 'POSITIVA' | 'INCONCLUSIVA';

export interface CNDClassification {
  tipo: TipoCertidao;
  diagnostico: string;
  badgeColor: 'green' | 'amber' | 'red' | 'gray';
  validade: string | null;
  emissao: string | null;
  codigo_controle: string | null;
  cnpj_encontrado: string | null;
}

export interface CNDAnalysisResult {
  success: boolean;
  fileName: string;
  extractedTextLength: number;
  sampleText: string;
  classification: CNDClassification;
}

export interface GuiaAtrasoMEI {
  periodo: string;
  vencimento: string;
  principal: number;
  multa_juros: number;
  total: number;
  situacao: string;
  tipo: string;
  linha_digitavel?: string;
}

export interface PGMEIResult {
  success: boolean;
  url: string;
  cnpj: string;
  status_mei: string;
  total_guias_atraso: number;
  valor_total_atraso: number;
  competencias_pendentes: GuiaAtrasoMEI[];
  instrucoes_rpa: {
    url: string;
    campo_cnpj: string;
    botao_continuar: string;
    seletor_tabela_guias: string;
  };
}

export interface StorageFile {
  filename: string;
  subfolder: string;
  categoria: string;
  size: number;
  updatedAt: string;
  downloadUrl: string;
}
