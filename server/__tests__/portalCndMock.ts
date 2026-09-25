// Portal de certidões simulado no layout do site da Receita: busca no cabeçalho,
// banner de cookies, campo "Informe o CNPJ" e botões Consultar/Emitir Certidão.
import express from 'express';

export function portalCndSimulado(pdf: Buffer, opcoes: { deslocar?: boolean } = {}) {
  const app = express();
  const recebidos: string[] = [];
  app.get('/cnd', (req, res) =>
    res.send(`<!doctype html><body style="margin:0;font-family:sans-serif">
      <header style="padding:16px"><input type="text" id="busca-global" style="width:900px" /></header>
      ${opcoes.deslocar ? '<div style="height:120px">Aviso novo no topo da página</div>' : ''}
      <main style="padding:16px">
        <label>CNPJ</label>
        <input placeholder="Informe o CNPJ" style="width:320px" />
        <div style="margin-top:24px">
          <button id="consultar">Consultar Certidão</button>
          <button class="emitir">Emitir Certidão</button>
        </div>
      </main>
      <div id="cookies" style="position:fixed;bottom:0;left:0;right:0;height:140px;background:#eee">
        <button onclick="document.getElementById('cookies').remove()">Aceitar</button>
      </div>
      <script>
        document.querySelector('.emitir').onclick = () => {
          const cnpj = document.querySelector('input[placeholder="Informe o CNPJ"]').value;
          setTimeout(() => { location.href = '/pdf?cnpj=' + encodeURIComponent(cnpj); }, 400);
        };
      </script></body>`),
  );
  app.get('/pdf', (req, res) => {
    recebidos.push(String(req.query.cnpj));
    res.type('application/pdf').send(pdf);
  });
  return { app, recebidos };
}
