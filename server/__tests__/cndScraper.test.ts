// Teste do robô da CND federal contra um portal simulado local.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'net';
import { emitirCndFederal } from '../cndScraper';
import { abrirNavegador, localizarChrome } from '../navegador';

async function gerarPdf(texto: string): Promise<Buffer> {
  const { browser } = await abrirNavegador();
  try {
    const page = await browser.newPage();
    await page.setContent(`<pre>${texto}</pre>`);
    return Buffer.from(await page.pdf({ format: 'A4' }));
  } finally {
    await browser.close();
  }
}

test('robô da CND informa o CNPJ, segue os botões e captura o PDF', { skip: !localizarChrome(), timeout: 120_000 }, async () => {
  const pdf = await gerarPdf('CERTIDAO NEGATIVA DE DEBITOS RELATIVOS AOS TRIBUTOS FEDERAIS\nCNPJ: 34.058.193/0001-53\nValida ate 10/03/2027.');
  const app = express();
  let cnpjRecebido = '';
  app.get('/cnd', (req, res) =>
    res.send(`<!doctype html><body>
      <input formcontrolname="cnpj" placeholder="CNPJ" />
      <button id="consultar">Consultar</button>
      <div id="resultado"></div>
      <script>
        document.getElementById('consultar').onclick = () => {
          const cnpj = document.querySelector('input').value;
          setTimeout(() => {
            document.getElementById('resultado').innerHTML = '<button id="emitir">Emitir Certidão</button>';
            document.getElementById('emitir').onclick = () => { location.href = '/pdf?cnpj=' + cnpj; };
          }, 500);
        };
      </script></body>`),
  );
  app.get('/pdf', (req, res) => {
    cnpjRecebido = String(req.query.cnpj);
    res.type('application/pdf').send(pdf);
  });
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;

  try {
    const r = await emitirCndFederal({ cnpj: '34058193000153', url: `http://127.0.0.1:${port}/cnd`, timeoutMs: 30_000 });
    assert.equal(cnpjRecebido, '34058193000153');
    assert.ok(r.pdf && r.pdf.subarray(0, 4).toString() === '%PDF');
  } finally {
    server.close();
  }
});
