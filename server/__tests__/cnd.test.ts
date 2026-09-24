import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyCndText } from '../cnd';

const negativaFederal = `MINISTÉRIO DA FAZENDA
Secretaria da Receita Federal do Brasil
Procuradoria-Geral da Fazenda Nacional
CERTIDÃO NEGATIVA DE DÉBITOS RELATIVOS AOS TRIBUTOS FEDERAIS E À DÍVIDA
ATIVA DA UNIÃO
Nome: ROBERIO DE ALMEIDA PEREIRA
CNPJ: 34.058.193/0001-53
Ressalvado o direito de a Fazenda Nacional cobrar e inscrever quaisquer dívidas de responsabilidade
do sujeito passivo acima identificado que vierem a ser apuradas, é certificado que não constam
pendências em seu nome.
Emitida às 10:15:22 do dia 10/09/2026 <hora e data de Brasília>.
Válida até 09/03/2027.
Código de controle da certidão: 7A1B.2C3D.4E5F.6A7B`;

const efeitoNegativa = `CERTIDÃO POSITIVA COM EFEITOS DE NEGATIVA DE DÉBITOS RELATIVOS AOS TRIBUTOS
FEDERAIS E À DÍVIDA ATIVA DA UNIÃO
CNPJ: 34.058.193
Certifica-se que constam débitos cuja exigibilidade está suspensa. Conforme o art. 206 do CTN, esta
certidão tem os mesmos efeitos da certidão negativa.
Válida até 01/01/2026.`;

const positivaEstadual = `SECRETARIA DA FAZENDA DO ESTADO
CERTIDÃO POSITIVA DE DÉBITOS TRIBUTÁRIOS
CNPJ: 11.222.333/0001-81
Constam débitos exigíveis em nome do contribuinte.`;

test('classifica certidão negativa federal com quebra de linha no título', () => {
  const r = classifyCndText(negativaFederal, { cnpj: '34058193000153', hoje: new Date(2026, 8, 24) });
  assert.equal(r.tipo, 'NEGATIVA');
  assert.equal(r.validade, '09/03/2027');
  assert.equal(r.vencida, false);
  assert.equal(r.emissao, '10/09/2026 às 10:15:22');
  assert.equal(r.codigo_controle, '7A1B.2C3D.4E5F.6A7B');
  assert.equal(r.cnpj_confere, true);
});

test('positiva com efeitos de negativa não é confundida com positiva', () => {
  const r = classifyCndText(efeitoNegativa, { cnpj: '34058193000153', hoje: new Date(2026, 8, 24) });
  assert.equal(r.tipo, 'POSITIVA_COM_EFEITO_DE_NEGATIVA');
  assert.equal(r.vencida, true);
  assert.equal(r.cnpj_confere, true); // CND federal pode trazer só a raiz do CNPJ
});

test('positiva estadual e conferência de CNPJ divergente', () => {
  const r = classifyCndText(positivaEstadual, { cnpj: '34058193000153' });
  assert.equal(r.tipo, 'POSITIVA');
  assert.equal(r.cnpj_confere, false);
});

test('emissão negada pela internet conta como pendência', () => {
  const r = classifyCndText('As informações disponíveis na Secretaria da Receita Federal do Brasil sobre o contribuinte são insuficientes para a emissão de certidão por meio da Internet.');
  assert.equal(r.tipo, 'POSITIVA');
});

test('texto sem padrão reconhecível fica inconclusivo', () => {
  assert.equal(classifyCndText('documento qualquer').tipo, 'INCONCLUSIVA');
});
