import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  anosDasnExigiveis,
  extrairDasnPendentes,
  gerarCompetencias,
  montarDeclaracoes,
  parseDeclaracoesEntregues,
  parseExtratoPgmei,
  resumir,
  vencimentoPadrao,
} from '../mei';

const hoje = new Date(2026, 8, 15); // 15/09/2026

test('gera competências do mês de opção até o mês anterior', () => {
  const lista = gerarCompetencias({ dataOpcaoMei: '2026-03-15', hoje });
  assert.deepEqual(lista, ['202603', '202604', '202605', '202606', '202607', '202608']);
  assert.equal(gerarCompetencias({ meses: 60, hoje }).length, 60);
  assert.equal(gerarCompetencias({ meses: 3, hoje: new Date(2026, 0, 10) }).join(','), '202510,202511,202512');
});

test('vencimento do DAS é dia 20 do mês seguinte', () => {
  assert.equal(vencimentoPadrao('202412'), '20/01/2025');
  assert.equal(vencimentoPadrao('202601'), '20/02/2026');
});

test('anos de DASN-SIMEI exigíveis respeitam o prazo de 31/05', () => {
  assert.deepEqual(anosDasnExigiveis({ dataOpcaoMei: '2022-05-01', hoje }), [2022, 2023, 2024, 2025]);
  assert.deepEqual(anosDasnExigiveis({ dataOpcaoMei: '2022-05-01', hoje: new Date(2026, 3, 10) }), [2022, 2023, 2024]);
  assert.deepEqual(anosDasnExigiveis({ dataOpcaoMei: '2022-05-01', dataExclusaoMei: '2023-08-01', hoje }), [2022, 2023]);
});

// Tabela copiada da tela "Emitir Guia de Pagamento (DAS)" do PGMEI (colunas separadas por tab).
const extrato = [
  'Período de Apuração\tApurado\tSituação\tBenefício INSS\tPrincipal\tMulta\tJuros\tTotal\tData de Vencimento\tData de Acolhimento',
  'Janeiro/2026\tSim\tLiquidado\tNão\t\t\t\t\t20/02/2026\t',
  'Fevereiro/2026\tNão\tDevedor\tNão\t81,05\t16,21\t4,86\t102,12\t20/03/2026\t30/09/2026',
  'Março/2026\tNão\tDevedor\tNão\t81,05\t16,21\t3,90\t101,16\t20/04/2026\t30/09/2026',
  'Agosto/2026\tNão\tA Vencer\tNão\t81,05\t0,00\t0,00\t81,05\t21/09/2026\t30/09/2026',
  '11/2025\tSim\tDébito em Dívida Ativa\tNão\t76,90\t\t\t\t20/12/2025\t',
].join('\n');

test('lê o extrato do PGMEI: situação, valores e datas por competência', () => {
  const { competencias } = parseExtratoPgmei(extrato, hoje);
  const porPa = Object.fromEntries(competencias.map(c => [c.periodoApuracao, c]));

  assert.equal(porPa['202601'].situacao, 'PAGO');
  assert.equal(porPa['202602'].situacao, 'EM_ABERTO');
  assert.equal(porPa['202602'].vencida, true);
  assert.equal(porPa['202602'].principal, 81.05);
  assert.equal(porPa['202602'].multa, 16.21);
  assert.equal(porPa['202602'].juros, 4.86);
  assert.equal(porPa['202602'].total, 102.12);
  assert.equal(porPa['202602'].vencimento, '20/03/2026');
  assert.equal(porPa['202602'].dataLimitePagamento, '30/09/2026');
  // Vence em 21/09: ainda não é atraso.
  assert.equal(porPa['202608'].situacao, 'A_VENCER');
  assert.equal(porPa['202608'].vencida, false);
  assert.equal(porPa['202511'].situacao, 'DIVIDA_ATIVA');
  assert.equal(porPa['202511'].total, 76.9);
});

test('datas "20/02/2024" não são confundidas com a competência 02/2024', () => {
  const { competencias } = parseExtratoPgmei('03/2024 Devedor 75,60 15,12 6,00 96,72 20/04/2024', hoje);
  assert.equal(competencias.length, 1);
  assert.equal(competencias[0].periodoApuracao, '202403');
});

test('resume totais em aberto, vencidos e dívida ativa', () => {
  const { competencias } = parseExtratoPgmei(extrato, hoje);
  const declaracoes = montarDeclaracoes([2024, 2025], new Map([[2024, { fonte: 'PGMEI' }]]), new Map([[2025, { fonte: 'DASN-SIMEI' }]]));
  const r = resumir(competencias, declaracoes);
  assert.equal(r.qtdEmAberto, 3);
  assert.equal(r.totalEmAberto, 284.33);
  assert.equal(r.qtdVencidas, 2);
  assert.equal(r.totalVencido, 203.28);
  assert.equal(r.qtdDividaAtiva, 1);
  assert.equal(r.totalDividaAtiva, 76.9);
  assert.equal(r.totalGeral, 361.23);
  assert.deepEqual(r.declaracoesPendentes, [2024]);
});

test('identifica DASN-SIMEI pendente no aviso do PGMEI', () => {
  const anos = extrairDasnPendentes([
    'Sr. Contribuinte antes da geração do(s) documento(s) é necessário realizar a entrega da declaração do ano calendário de 2024.',
  ]);
  assert.deepEqual(anos, [2024]);
});

test('lê anos de declarações entregues ignorando a data de transmissão', () => {
  const anos = parseDeclaracoesEntregues('Ano-calendário\tTipo\tData\n15/04/2024 2023 Original transmitida\n2022\tRetificadora\t10/03/2023');
  assert.deepEqual(anos, [2022, 2023]);
});
