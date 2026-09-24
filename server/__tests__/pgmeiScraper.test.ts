// Teste ponta a ponta do robô contra um PGMEI simulado local.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'net';
import { consultarPgmei, localizarChrome } from '../pgmeiScraper';
import { servidorSimulado } from './pgmeiMock';

test('robô lê competências em aberto e DASN pendente no PGMEI simulado', { skip: !localizarChrome(), timeout: 180_000 }, async () => {
  const { app, cnpjsRecebidos } = servidorSimulado();
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  const etapas: string[] = [];

  try {
    const resultado = await consultarPgmei({
      cnpj: '34058193000153',
      dataOpcaoMei: '2023-01-01',
      baseUrl: `http://127.0.0.1:${port}`,
      hoje: new Date(2026, 8, 15),
      onProgresso: etapa => etapas.push(etapa),
    });

    assert.deepEqual(cnpjsRecebidos, ['34058193000153']);
    const porPa = Object.fromEntries(resultado.competencias.map(c => [c.periodoApuracao, c]));
    assert.equal(porPa['202601'].situacao, 'PAGO');
    assert.equal(porPa['202602'].situacao, 'EM_ABERTO');
    assert.equal(porPa['202602'].total, 102.12);
    assert.equal(porPa['202608'].situacao, 'A_VENCER');
    assert.equal(porPa['202312'].situacao, 'PAGO');

    assert.equal(resultado.resumo.totalEmAberto, 183.17);
    assert.equal(resultado.resumo.qtdVencidas, 1);

    const dasn = Object.fromEntries(resultado.declaracoes.map(d => [d.ano, d.situacao]));
    assert.equal(dasn[2024], 'PENDENTE'); // aviso do PGMEI
    assert.equal(dasn[2025], 'ENTREGUE'); // lista do DASN-SIMEI
    assert.equal(dasn[2023], 'ENTREGUE');
    assert.deepEqual(resultado.resumo.declaracoesPendentes, [2024]);
    assert.ok(etapas.some(e => e.includes('2026')));
  } finally {
    server.close();
  }
});
