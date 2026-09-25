// Grava um roteiro no portal simulado e repete para outro CNPJ.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'net';
import { abrirNavegador, localizarChrome } from '../navegador';
import { executarRoteiro, SessaoGravacao, substituirVariaveis, validarPassos, variaveisDaEmpresa } from '../rpa';
import { emitirCndFederal } from '../cndScraper';
import { portalCndSimulado } from './portalCndMock';

async function gerarPdf(texto: string): Promise<Buffer> {
  const { browser } = await abrirNavegador({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`<pre>${texto}</pre>`);
    return Buffer.from(await page.pdf({ format: 'A4' }));
  } finally {
    await browser.close();
  }
}

async function centro(sessao: SessaoGravacao, seletor: string) {
  const box = await (await sessao.page.$(seletor)).boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test('variáveis e validação dos passos', () => {
  const vars = variaveisDaEmpresa({ cnpj: '34058193000153', razao_social: 'X', endereco: { uf: 'BA' } });
  assert.equal(substituirVariaveis('{{cnpj_formatado}} / {{ cnpj }}', vars), '34.058.193/0001-53 / 34058193000153');
  const passos = validarPassos([{ tipo: 'tecla', tecla: 'rm -rf' }, { tipo: 'esperar', ms: 999999 }, { tipo: 'navegar', url: 'javascript:alert(1)' }]);
  assert.deepEqual(passos, [{ tipo: 'esperar', ms: 120000 }]);
});

test('gravar e repetir roteiro da CND, mesmo com a página mudando de layout', { skip: !localizarChrome(), timeout: 240_000 }, async () => {
  const pdf = await gerarPdf('CERTIDAO NEGATIVA DE DEBITOS\nCNPJ: 34.058.193/0001-53');
  const gravacao = portalCndSimulado(pdf);
  const s1 = gravacao.app.listen(0);
  const url1 = `http://127.0.0.1:${(s1.address() as AddressInfo).port}/cnd`;

  let passos;
  const sessao = await SessaoGravacao.abrir(url1, variaveisDaEmpresa({ cnpj: '34058193000153' }));
  try {
    await sessao.acao({ tipo: 'clique', ...(await centro(sessao, '#cookies button')) });
    await sessao.acao({ tipo: 'clique', ...(await centro(sessao, 'input[placeholder="Informe o CNPJ"]')) });
    await sessao.acao({ tipo: 'digitar', valor: '{{cnpj}}' });
    await sessao.acao({ tipo: 'clique', ...(await centro(sessao, '.emitir')) });
    await sessao.acao({ tipo: 'aguardarPdf', timeoutMs: 20000 });
    passos = sessao.passos;
    const telaJpeg = await sessao.tela();
    assert.equal(telaJpeg.subarray(0, 2).toString('hex'), 'ffd8');
  } finally {
    await sessao.fechar();
    s1.close();
  }
  assert.equal(passos.length, 5);
  assert.equal((passos[0] as any).alvo.texto, 'Aceitar');
  assert.equal((passos[1] as any).alvo.seletor, 'input[placeholder="Informe o CNPJ"]');
  assert.equal((passos[2] as any).valor, '{{cnpj}}');
  assert.equal((passos[3] as any).alvo.texto, 'Emitir Certidão');

  // Repete para outro CNPJ numa página com layout diferente (coordenadas mudaram).
  const execucao = portalCndSimulado(pdf, { deslocar: true });
  const s2 = execucao.app.listen(0);
  try {
    const url2 = `http://127.0.0.1:${(s2.address() as AddressInfo).port}/cnd`;
    const r = await executarRoteiro({ nome: 'teste', urlInicial: url2, passos }, variaveisDaEmpresa({ cnpj: '18236120000158' }));
    assert.ok(r.pdf);
    // A captura pode buscar a URL do PDF de novo; o que importa é o CNPJ enviado.
    assert.ok(execucao.recebidos.length > 0 && execucao.recebidos.every(c => c === '18236120000158'));
  } finally {
    s2.close();
  }
});

test('robô genérico da CND digita no campo certo, não na busca do topo', { skip: !localizarChrome(), timeout: 120_000 }, async () => {
  const pdf = await gerarPdf('CERTIDAO NEGATIVA');
  const portal = portalCndSimulado(pdf);
  const s = portal.app.listen(0);
  try {
    const r = await emitirCndFederal({ cnpj: '34058193000153', url: `http://127.0.0.1:${(s.address() as AddressInfo).port}/cnd`, timeoutMs: 30_000 });
    assert.ok(r.pdf);
    assert.ok(portal.recebidos.length > 0 && portal.recebidos.every(c => c === '34058193000153'));
  } finally {
    s.close();
  }
});
