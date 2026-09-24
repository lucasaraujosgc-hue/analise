import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidCnpj,
  lookupCnpj,
  mergeProviderData,
  normalizeCnpja,
  normalizeCnpjWs,
  normalizeMinhaReceita,
  normalizePhone,
  normalizeReceitaWs,
  PROVIDERS,
} from '../cnpjProviders';

// Resposta real no formato da MinhaReceita pública em modo de privacidade:
// e-mail nulo e, por ser empresário individual, sem telefone e sem logradouro.
const minhaReceitaMei = {
  cnpj: '34058193000153',
  razao_social: '34.058.193 ROBERIO DE ALMEIDA PEREIRA',
  nome_fantasia: '',
  descricao_situacao_cadastral: 'ATIVA',
  data_situacao_cadastral: '2019-06-28',
  descricao_motivo_situacao_cadastral: 'SEM MOTIVO',
  data_inicio_atividade: '2019-06-28',
  codigo_natureza_juridica: 2135,
  natureza_juridica: 'Empresário (Individual)',
  porte: 'MICRO EMPRESA',
  capital_social: 4000,
  ddd_telefone_1: '',
  ddd_telefone_2: '',
  email: null,
  descricao_tipo_de_logradouro: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: 'CENTRO',
  cep: '44330000',
  municipio: 'SAO GONCALO DOS CAMPOS',
  uf: 'BA',
  cnae_fiscal: 4520001,
  cnae_fiscal_descricao: 'Serviços de manutenção e reparação mecânica de veículos automotores',
  cnaes_secundarios: [{ codigo: 0, descricao: '' }],
  qsa: [],
  opcao_pelo_simples: true,
  opcao_pelo_mei: true,
  data_opcao_pelo_mei: '2019-06-28',
  data_exclusao_do_mei: null,
};

const receitaWsMei = {
  status: 'OK',
  cnpj: '34.058.193/0001-53',
  nome: '34.058.193 ROBERIO DE ALMEIDA PEREIRA',
  fantasia: '',
  abertura: '28/06/2019',
  situacao: 'ATIVA',
  natureza_juridica: '213-5 - Empresário (Individual)',
  porte: 'MICRO EMPRESA',
  logradouro: 'RUA JOSE PEDREIRA',
  numero: '120',
  complemento: '',
  bairro: 'CENTRO',
  municipio: 'SAO GONCALO DOS CAMPOS',
  uf: 'BA',
  cep: '44.330-000',
  email: 'Roberio.Mecanica@Gmail.com',
  telefone: '(75) 3246-1122 / (75) 9 9876-5432',
  atividade_principal: [{ code: '45.20-0-01', text: 'Serviços de manutenção e reparação mecânica de veículos automotores' }],
  atividades_secundarias: [{ code: '00.00-0-00', text: 'Não informada' }],
  qsa: [],
  capital_social: '4000.00',
  simples: { optante: true, data_opcao: '28/06/2019' },
  simei: { optante: true, data_opcao: '28/06/2019' },
};

test('valida CNPJ numérico e alfanumérico', () => {
  assert.equal(isValidCnpj('34.058.193/0001-53'), true);
  assert.equal(isValidCnpj('18236120000158'), true);
  assert.equal(isValidCnpj('12.ABC.345/01DE-35'), true);
  assert.equal(isValidCnpj('34058193000154'), false);
  assert.equal(isValidCnpj('11111111111111'), false);
  assert.equal(isValidCnpj('123'), false);
});

test('normaliza telefones de formatos diferentes', () => {
  assert.equal(normalizePhone('7532461122'), '7532461122');
  assert.equal(normalizePhone('(75) 9 9876-5432'), '75998765432');
  assert.equal(normalizePhone('32461122', '75'), '7532461122');
  assert.equal(normalizePhone('+55 (11) 98765-4321'), '11987654321');
  assert.equal(normalizePhone('0000000000'), null);
  assert.equal(normalizePhone(''), null);
});

test('MinhaReceita em modo privacidade não traz contato; ReceitaWS completa telefone, e-mail e endereço', () => {
  const mr = normalizeMinhaReceita(minhaReceitaMei)!;
  assert.deepEqual(mr.telefones, []);
  assert.deepEqual(mr.emails, []);
  assert.deepEqual(mr.cnaes_secundarios, []);

  const rws = normalizeReceitaWs(receitaWsMei)!;
  assert.deepEqual(rws.telefones, ['7532461122', '75998765432']);
  assert.deepEqual(rws.emails, ['roberio.mecanica@gmail.com']);

  const merged = mergeProviderData('34058193000153', [mr, rws])!;
  assert.equal(merged.telefone, '(75) 3246-1122');
  assert.equal(merged.telefone_secundario, '(75) 99876-5432');
  assert.equal(merged.email, 'roberio.mecanica@gmail.com');
  assert.equal(merged.endereco.logradouro, 'RUA JOSE PEDREIRA');
  assert.equal(merged.endereco.numero, '120');
  assert.equal(merged.source, 'MinhaReceita');
  assert.deepEqual(merged.fontes_contato, ['ReceitaWS']);
  assert.equal(merged.opcao_pelo_mei, true);
  assert.equal(merged.data_opcao_pelo_mei, '2019-06-28');
  assert.equal(merged.cnae_fiscal.codigo, '4520001');
  assert.equal(merged.natureza_juridica, '2135 - Empresário (Individual)');
});

test('CNPJ.ws e CNPJá: telefones com DDD separado, e-mails e inscrições estaduais', () => {
  const ws = normalizeCnpjWs({
    razao_social: 'EMPRESA TESTE LTDA',
    capital_social: '1000.00',
    porte: { descricao: 'Micro Empresa' },
    natureza_juridica: { id: '2062', descricao: 'Sociedade Empresária Limitada' },
    simples: { simples: 'Sim', mei: 'Não' },
    socios: [{ nome: 'FULANO', qualificacao_socio: { descricao: 'Sócio-Administrador' } }],
    estabelecimento: {
      cnpj: '18236120000158',
      situacao_cadastral: 'Ativa',
      ddd1: '11', telefone1: '30031234', ddd2: null, telefone2: null,
      email: 'contato@empresa.com.br',
      logradouro: 'PAULISTA', tipo_logradouro: 'Avenida', numero: '1000',
      cidade: { nome: 'São Paulo' }, estado: { sigla: 'SP' },
      atividade_principal: { id: '6202300', descricao: 'Software' },
      inscricoes_estaduais: [{ inscricao_estadual: '123456789', ativo: true, estado: { sigla: 'SP' } }],
    },
  })!;
  assert.deepEqual(ws.telefones, ['1130031234']);
  assert.deepEqual(ws.emails, ['contato@empresa.com.br']);
  assert.equal(ws.opcao_pelo_mei, false);
  assert.deepEqual(ws.inscricoes_estaduais, [{ inscricao: '123456789', uf: 'SP', ativa: true }]);

  const ja = normalizeCnpja({
    taxId: '18236120000158',
    company: { name: 'EMPRESA TESTE LTDA', nature: { id: 2062, text: 'Sociedade Empresária Limitada' }, simei: { optant: false } },
    phones: [{ area: '11', number: '987654321' }],
    emails: [{ address: 'financeiro@empresa.com.br' }],
    address: { street: 'Avenida Paulista', number: '1000', city: 'São Paulo', state: 'SP' },
  })!;
  assert.deepEqual(ja.telefones, ['11987654321']);
  assert.deepEqual(ja.emails, ['financeiro@empresa.com.br']);

  const merged = mergeProviderData('18236120000158', [ws, ja])!;
  assert.deepEqual(merged.telefones, ['(11) 3003-1234', '(11) 98765-4321']);
  assert.deepEqual(merged.emails, ['contato@empresa.com.br', 'financeiro@empresa.com.br']);
});

test('lookupCnpj consulta todas as fontes e tolera falhas', async () => {
  const calls: string[] = [];
  const fakeFetch = async (url: string) => {
    calls.push(url);
    if (url.includes('minhareceita')) return { ok: true, status: 200, json: async () => minhaReceitaMei };
    if (url.includes('receitaws')) return { ok: true, status: 200, json: async () => receitaWsMei };
    if (url.includes('brasilapi')) throw new Error('timeout');
    return { ok: false, status: 429, json: async () => ({}) };
  };
  const result = await lookupCnpj('34.058.193/0001-53', { fetchImpl: fakeFetch });
  assert.equal(calls.length, PROVIDERS.length);
  assert.ok(result);
  assert.equal(result!.email, 'roberio.mecanica@gmail.com');
  assert.equal(result!.telefone, '(75) 3246-1122');
  assert.deepEqual(result!.fontes, ['MinhaReceita', 'ReceitaWS']);
});

test('lookupCnpj retorna null quando nenhuma fonte responde', async () => {
  const result = await lookupCnpj('34058193000153', {
    fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({}) }),
  });
  assert.equal(result, null);
});
