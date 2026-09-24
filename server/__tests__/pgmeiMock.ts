// PGMEI simulado com os mesmos seletores do portal real (#cnpj,
// #anoCalendarioSelect, checkboxes AAAAMM), usado nos testes do robô.
import express from 'express';

const PGMEI = '/SimplesNacional/Aplicacoes/ATSPO/pgmei.app';
const DASN = '/SimplesNacional/Aplicacoes/ATSPO/dasnsimei.app';

function pagina(corpo: string) {
  return `<!doctype html><html lang="pt-BR"><body>${corpo}</body></html>`;
}

function identificacao(acao: string) {
  return pagina(`<form method="post" action="${acao}">
    <input id="cnpj" name="cnpj" type="text" />
    <button type="submit">Continuar</button>
  </form>`);
}

function telaEmissao(ano?: string) {
  const opcoes = ['2026', '2025', '2024', '2023'].map(a => `<option value="${a}" ${a === ano ? 'selected' : ''}>${a}</option>`).join('');
  let conteudo = '';
  if (ano === '2026') {
    conteudo = `<table class="table">
      <thead><tr><th></th><th>Período de Apuração</th><th>Apurado</th><th>Situação</th><th>Benefício INSS</th>
      <th>Principal</th><th>Multa</th><th>Juros</th><th>Total</th><th>Data de Vencimento</th><th>Data de Acolhimento</th></tr></thead>
      <tbody>
        <tr><td><input type="checkbox" value="202601" disabled></td><td>Janeiro/2026</td><td>Sim</td><td>Liquidado</td><td>Não</td><td></td><td></td><td></td><td></td><td>20/02/2026</td><td></td></tr>
        <tr><td><input type="checkbox" value="202602"></td><td>Fevereiro/2026</td><td>Não</td><td>Devedor</td><td>Não</td><td>81,05</td><td>16,21</td><td>4,86</td><td>102,12</td><td>20/03/2026</td><td>30/09/2026</td></tr>
        <tr><td><input type="checkbox" value="202608"></td><td>Agosto/2026</td><td>Não</td><td>A Vencer</td><td>Não</td><td>81,05</td><td>0,00</td><td>0,00</td><td>81,05</td><td>21/09/2026</td><td>30/09/2026</td></tr>
      </tbody></table>`;
  } else if (ano === '2025') {
    conteudo = `<div class="alert alert-danger">Sr. Contribuinte antes da geração do(s) documento(s) é necessário realizar a entrega da declaração do ano calendário de 2024.</div>`;
  } else if (ano) {
    conteudo = `<table><thead><tr><th></th><th>Período de Apuração</th><th>Situação</th><th>Total</th></tr></thead>
      <tbody><tr><td><input type="checkbox" value="${ano}12" disabled></td><td>Dezembro/${ano}</td><td>Liquidado</td><td></td></tr></tbody></table>`;
  }
  return pagina(`<form method="post" action="${PGMEI}/emissao">
      <select id="anoCalendarioSelect" name="ano"><option value="">Selecione</option>${opcoes}</select>
      <button type="submit">Ok</button>
    </form>${conteudo}`);
}

export function servidorSimulado() {
  const app = express();
  app.use(express.urlencoded({ extended: true }));
  const cnpjsRecebidos: string[] = [];

  app.get(`${PGMEI}/Identificacao`, (req, res) => res.send(identificacao(`${PGMEI}/Identificacao`)));
  app.post(`${PGMEI}/Identificacao`, (req, res) => {
    cnpjsRecebidos.push(req.body.cnpj);
    res.redirect(`${PGMEI}/`);
  });
  app.get(`${PGMEI}/`, (req, res) => res.send(pagina(`<a href="${PGMEI}/emissao">Emitir Guia de Pagamento (DAS)</a>`)));
  app.get(`${PGMEI}/emissao`, (req, res) => res.send(telaEmissao()));
  app.post(`${PGMEI}/emissao`, (req, res) => res.send(telaEmissao(req.body.ano)));

  app.get(`${DASN}/Identificacao`, (req, res) => res.send(identificacao(`${DASN}/Identificacao`)));
  app.post(`${DASN}/Identificacao`, (req, res) => res.redirect(`${DASN}/`));
  app.get(`${DASN}/`, (req, res) => res.send(pagina(`<a href="${DASN}/consulta">Consultar Declarações</a>`)));
  app.get(`${DASN}/consulta`, (req, res) =>
    res.send(pagina(`<table><tr><th>Ano-calendário</th><th>Tipo</th><th>Transmissão</th></tr>
      <tr><td>2025</td><td>Original</td><td>10/05/2026</td></tr>
      <tr><td>2023</td><td>Original</td><td>20/04/2024</td></tr></table>`)),
  );

  return { app, cnpjsRecebidos };
}
