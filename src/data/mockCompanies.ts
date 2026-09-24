import { EmpresaData } from '../types/cnpj';

export const SAMPLE_COMPANIES: { label: string; cnpj: string; description: string; isMei?: boolean }[] = [
  {
    label: 'MEI - Lucas Serviços Digitais',
    cnpj: '48.912.345/0001-90',
    description: 'Microempreendedor Individual com DAS em atraso para teste do PGMEI',
    isMei: true,
  },
  {
    label: 'Nubank (Nu Pagamentos S.A.)',
    cnpj: '18.236.120/0001-58',
    description: 'Grande Instituição Financeira / QSA amplo e múltiplos CNAEs',
    isMei: false,
  },
  {
    label: 'Magazine Luiza S.A.',
    cnpj: '47.960.950/0001-21',
    description: 'Varejo nacional / Diversos CNAEs secundários e filiais',
    isMei: false,
  },
  {
    label: 'Totvs S.A.',
    cnpj: '53.113.791/0001-22',
    description: 'Tecnologia da Informação & Software',
    isMei: false,
  },
];

export const SAMPLE_CND_TEXTS = {
  negativa: `MINISTÉRIO DA FAZENDA
SECRETARIA DA RECEITA FEDERAL DO BRASIL
PROCURADORIA-GERAL DA FAZENDA NACIONAL

CERTIDÃO NEGATIVA DE DÉBITOS RELATIVOS AOS TRIBUTOS FEDERAIS E À DÍVIDA ATIVA DA UNIÃO

Nome: EMPRESA EXEMPLO SERVICOS DIGITAIS LTDA
CNPJ: 18.236.120/0001-58

Ressalvado o direito de a Fazenda Nacional cobrar e inscrever quaisquer dívidas de responsabilidade do sujeito passivo acima identificado que vierem a ser apuradas, é certificado que NÃO CONSTAM DÉBITOS relativos a créditos tributários administrados pela Secretaria da Receita Federal do Brasil (RFB) e a inscrições em Dívida Ativa da União (DAU) junto à Procuradoria-Geral da Fazenda Nacional (PGFN).

Esta certidão é válida para o estabelecimento matriz e suas filiais.
Emitida às 14:32:10 do dia 15/03/2026.
Válida até: 11/09/2026.
Código de controle da certidão: A89B.72C1.442E.990F`,

  positivaComEfeitosNegativa: `MINISTÉRIO DA FAZENDA
SECRETARIA DA RECEITA FEDERAL DO BRASIL
PROCURADORIA-GERAL DA FAZENDA NACIONAL

CERTIDÃO POSITIVA COM EFEITOS DE NEGATIVA DE DÉBITOS RELATIVOS AOS TRIBUTOS FEDERAIS E À DÍVIDA ATIVA DA UNIÃO

Nome: EMPRESA EXEMPLO COMERCIO E PARTICIPACOES LTDA
CNPJ: 47.960.950/0001-21

Certificamos que CONSTA(M) débito(s) administrado(s) pela Secretaria da Receita Federal do Brasil (RFB) ou inscrição(ões) em Dívida Ativa da União (DAU) junto à PGFN, cujas EXIGIBILIDADES ESTÃO SUSPENSAS nos termos do art. 151 da Lei nº 5.172/1966 (Código Tributário Nacional - CTN), ou garantidos por penhora ou parcelamento regular ativo.

Conforme o disposto no art. 206 do CTN, este documento produz os mesmos efeitos da Certidão Negativa.
Esta certidão é válida para o estabelecimento matriz e suas filiais.
Emitida às 10:15:00 do dia 02/02/2026.
Válida até: 01/08/2026.
Código de controle da certidão: 3F4D.11BC.88AA.7401`,

  positiva: `SECRETARIA DA FAZENDA DO ESTADO
DEPARTAMENTO DE ADMINISTRAÇÃO TRIBUTÁRIA

CERTIDÃO POSITIVA DE DÉBITOS FISCAIS ESTADUAIS (ICMS E DEMAIS TRIBUTOS)

Nome: COMERCIO E INDUSTRIA EXEMPLO S.A.
CNPJ: 53.113.791/0001-22

Certifica-se, para os devidos fins, que revendo os arquivos da Dívida Ativa e do Sistema Integrado de Administração Tributária, CONSTAM DÉBITOS EXIGÍVEIS E PENDÊNCIAS FISCAIS em nome do contribuinte acima especificado, relativos ao ICMS e multas punitivas não suspensas judicialmente.

SITUAÇÃO: PENDENTE / IRREGULAR.
Emitida às 09:12:44 do dia 10/01/2026.
Válida até: 10/02/2026.
Código de controle da certidão: DEB7.9912.8310.4431`,
};
