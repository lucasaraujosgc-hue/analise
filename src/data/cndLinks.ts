// Portais oficiais de emissão de certidões. Os links estaduais foram conferidos
// em buscas nos sites das SEFAZ em set/2026; os marcados com conferido: false
// não puderam ser confirmados e podem ter mudado.

export const CND_FEDERAL = {
  nome: 'Receita Federal / PGFN — Certidão de Débitos Relativos a Tributos Federais e à Dívida Ativa da União',
  url: 'https://servicos.receitafederal.gov.br/servico/certidoes/#/home/cnpj',
};

export interface LinkCndEstadual {
  orgao: string;
  url: string;
  conferido: boolean;
  observacao?: string;
}

export const CND_ESTADUAL: Record<string, LinkCndEstadual> = {
  AC: { orgao: 'SEFAZ/AC', url: 'https://www.ac.gov.br/servico/certidao-negativa-de-debito-sefaz', conferido: true },
  AL: { orgao: 'SEFAZ/AL', url: 'https://contribuinte.sefaz.al.gov.br/certidao/', conferido: true },
  AM: { orgao: 'SEFAZ/AM', url: 'https://sefaz.am.gov.br/portfolio-servicos/detalhes/541', conferido: true },
  AP: { orgao: 'SEFAZ/AP', url: 'https://www.sefaz.ap.gov.br/sate/seg/SEGf_AcessarFuncao.jsp?cdFuncao=DIA_060', conferido: true },
  BA: { orgao: 'SEFAZ/BA', url: 'https://servicos.sefaz.ba.gov.br/sistemas/DSCRE/Modulos/Publico/EmissaoCertidao.aspx', conferido: true },
  CE: { orgao: 'SEFAZ/CE', url: 'https://consultapublica.sefaz.ce.gov.br/certidaonegativa/preparar-consultar', conferido: true },
  DF: { orgao: 'Receita/DF', url: 'https://ww1.receita.fazenda.df.gov.br/cidadao/certidoes/Certidao', conferido: false },
  ES: { orgao: 'SEFAZ/ES', url: 'https://s2-internet.sefaz.es.gov.br/certidao/cnd', conferido: true },
  GO: { orgao: 'SEFAZ/GO', url: 'https://www.sefaz.go.gov.br/certidao/emissao/', conferido: true },
  MA: { orgao: 'SEFAZ/MA', url: 'https://sistemas1.sefaz.ma.gov.br/certidoes/jsp/emissaoCertidaoNegativa/emissaoCertidaoNegativa.jsf', conferido: true },
  MG: { orgao: 'SEF/MG', url: 'https://www.fazenda.mg.gov.br/empresas/certidao_debitos/', conferido: true },
  MS: { orgao: 'SEFAZ/MS', url: 'https://www.sefaz.ms.gov.br/servicos-em-destaque/certidao-tributaria-estadual-emissao-certidao-negativa-de-debitos-estaduais-2/', conferido: true },
  MT: { orgao: 'SEFAZ/MT', url: 'https://www.sefaz.mt.gov.br/cnd/certidao/servlet/ServletRotd?origem=60', conferido: true },
  PA: { orgao: 'SEFA/PA', url: 'https://app.sefa.pa.gov.br/emissao-certidao/', conferido: true },
  PB: { orgao: 'SEFAZ/PB', url: 'https://cartaservico.sefaz.pb.gov.br/saibamais.php?id=91', conferido: true },
  PE: { orgao: 'SEFAZ/PE', url: 'https://efisco.sefaz.pe.gov.br/sfi_fin_gpc/PREmitirCertidaoRegularidadeWeb', conferido: true },
  PI: { orgao: 'SEFAZ/PI', url: 'https://webas.sefaz.pi.gov.br/certidaoSituacao/', conferido: true },
  PR: { orgao: 'SEFA/PR', url: 'https://www.fazenda.pr.gov.br/servicos/Mais-buscados/Certidoes/Emitir-Certidao-Negativa-Receita-Estadual-kZrX5gol', conferido: true },
  RJ: { orgao: 'SEFAZ/RJ', url: 'https://www4.fazenda.rj.gov.br/certidao-fiscal-web/emitirCertidao.jsf', conferido: false },
  RN: { orgao: 'SET/RN', url: 'https://uvt2.set.rn.gov.br/#/services/certidao-negativa/emitir', conferido: true },
  RO: { orgao: 'SEFIN/RO', url: 'https://www.sefin.ro.gov.br/certidaonegativa/', conferido: true },
  RR: { orgao: 'SEFAZ/RR', url: 'https://www.sefaz.rr.gov.br/empresa/certidao-negativa-de-debitos', conferido: true },
  RS: { orgao: 'SEFAZ/RS', url: 'https://www.sefaz.rs.gov.br/sat/CertidaoSitFiscalSolic.aspx', conferido: true },
  SC: { orgao: 'SEF/SC', url: 'https://www.sef.sc.gov.br/servicos/emitir-certidao-negativa-de-debitos-fiscais-cnd', conferido: true },
  SE: { orgao: 'SEFAZ/SE', url: 'https://www.sefaz.se.gov.br/SitePages/emissao_certidao_negativa.aspx', conferido: true },
  SP: {
    orgao: 'SEFAZ/SP',
    url: 'https://www10.fazenda.sp.gov.br/CertidaoNegativaDeb/Pages/EmissaoCertidaoNegativa.aspx',
    conferido: true,
    observacao: 'Em SP, débitos inscritos em dívida ativa têm certidão separada na PGE (www.dividaativa.pge.sp.gov.br).',
  },
  TO: { orgao: 'SEFAZ/TO', url: 'https://www.to.gov.br/sefaz', conferido: false },
};

export const OUTRAS_CERTIDOES = [
  { nome: 'CNDT — Débitos Trabalhistas (TST)', url: 'https://cndt-certidao.tst.jus.br/inicio.faces' },
  { nome: 'CRF — Regularidade do FGTS (Caixa)', url: 'https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf' },
];

export const PGMEI_URL = 'https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/pgmei.app/Identificacao';
export const DASN_SIMEI_URL = 'https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/dasnsimei.app/Identificacao';
