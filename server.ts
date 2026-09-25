import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { PDFParse } from 'pdf-parse';
import { isValidCnpj, lookupCnpj, NAO_CADASTRADO, sanitizeCnpj } from './server/cnpjProviders';
import { classifyCndText, CND_FEDERAL_URL } from './server/cnd';
import {
  anosDasnExigiveis,
  CompetenciaMei,
  DeclaracaoMei,
  montarDeclaracoes,
  parseDeclaracoesEntregues,
  parseExtratoPgmei,
  resumir,
  ResultadoMei,
  SituacaoDeclaracao,
} from './server/mei';
import { consultarPgmei, localizarChrome, PgmeiBloqueadoError } from './server/pgmeiScraper';
import { emitirCndFederal, CndBloqueadaError } from './server/cndScraper';
import { AjudaHumana, proxyConfigurado, SiteInacessivelError } from './server/navegador';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Diretórios montados como volume no Docker
const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, 'data');
const STORAGE_DIR = process.env.STORAGE_DIR || path.resolve(__dirname, 'storage');
const MEI_DIR = path.join(DATA_DIR, 'mei');
const STORAGE_SUBFOLDERS = [
  { name: 'cnds', label: 'CNDs (Certidões Negativas/Positivas)' },
  { name: 'guias_mei', label: 'Guias DAS do MEI & Extratos' },
  { name: 'relatorios', label: 'Relatórios Executivos & Dossiês' },
];

for (const dir of [DATA_DIR, STORAGE_DIR, MEI_DIR, ...STORAGE_SUBFOLDERS.map(s => path.join(STORAGE_DIR, s.name))]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const CARTEIRA_FILE = path.join(DATA_DIR, 'carteira.json');

function loadCarteira(): any[] {
  try {
    if (fs.existsSync(CARTEIRA_FILE)) {
      return JSON.parse(fs.readFileSync(CARTEIRA_FILE, 'utf-8')) || [];
    }
  } catch (err) {
    console.error('Erro ao carregar carteira.json:', err);
  }
  return [];
}

function saveCarteira(items: any[]) {
  try {
    fs.writeFileSync(CARTEIRA_FILE, JSON.stringify(items, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erro ao salvar carteira.json:', err);
  }
}

let carteiraCache = loadCarteira();

function findEmpresa(cnpj: string) {
  const clean = sanitizeCnpj(cnpj);
  return carteiraCache.find(e => sanitizeCnpj(e.cnpj) === clean);
}

// Período de enquadramento no SIMEI. Cadastros antigos não guardavam a data de
// opção; nesse caso a data de abertura é o limite (não há MEI antes dela).
function datasMei(empresa: any): { dataOpcaoMei?: string; dataExclusaoMei?: string } {
  return {
    dataOpcaoMei: empresa?.data_opcao_pelo_mei || empresa?.data_inicio_atividade || undefined,
    dataExclusaoMei: empresa?.data_exclusao_do_mei || undefined,
  };
}

function temValor(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== '' && v !== NAO_CADASTRADO;
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ==========================================
// 1. CARTEIRA MULTI-CNPJ
// ==========================================

app.get('/api/carteira', (req, res) => {
  return res.json(carteiraCache);
});

// Adiciona ou atualiza uma empresa. Na atualização preserva o que não veio da
// Receita: pendências já apuradas e contatos informados manualmente.
app.post('/api/carteira', (req, res) => {
  const empresa = req.body;
  if (!empresa || !empresa.cnpj) {
    return res.status(400).json({ error: 'Dados da empresa incompletos. CNPJ obrigatório.' });
  }

  const clean = sanitizeCnpj(empresa.cnpj);
  const now = new Date().toISOString();
  const existing = findEmpresa(clean);

  const manual = existing?.contatos_manuais || {};
  const telefone = temValor(manual.telefone)
    ? manual.telefone
    : temValor(empresa.telefone) ? empresa.telefone : existing?.telefone || NAO_CADASTRADO;
  const email = temValor(manual.email)
    ? manual.email
    : temValor(empresa.email) ? empresa.email : existing?.email || NAO_CADASTRADO;

  const updatedItem = {
    ...existing,
    ...empresa,
    cnpj: clean,
    telefone,
    email,
    contatos_manuais: existing?.contatos_manuais,
    lastUpdated: now,
    pendenciasResumo: empresa.pendenciasResumo || existing?.pendenciasResumo || {
      cndFederal: 'NAO_CONSULTADA',
      cndEstadual: 'NAO_CONSULTADA',
    },
  };

  if (existing) {
    carteiraCache = carteiraCache.map(e => (sanitizeCnpj(e.cnpj) === clean ? updatedItem : e));
  } else {
    carteiraCache.unshift(updatedItem);
  }

  saveCarteira(carteiraCache);
  return res.json({ success: true, item: updatedItem, carteira: carteiraCache });
});

app.delete('/api/carteira/:cnpj', (req, res) => {
  const clean = sanitizeCnpj(req.params.cnpj);
  carteiraCache = carteiraCache.filter(e => sanitizeCnpj(e.cnpj) !== clean);
  saveCarteira(carteiraCache);
  return res.json({ success: true, carteira: carteiraCache });
});

app.put('/api/carteira/:cnpj/pendencias', (req, res) => {
  const existing = findEmpresa(req.params.cnpj);
  if (!existing) {
    return res.status(404).json({ error: 'Empresa não encontrada na carteira' });
  }
  const { pendenciasResumo } = req.body || {};
  if (pendenciasResumo) {
    existing.pendenciasResumo = { ...existing.pendenciasResumo, ...pendenciasResumo, ultimaConsulta: new Date().toISOString() };
  }
  existing.lastUpdated = new Date().toISOString();
  saveCarteira(carteiraCache);
  return res.json({ success: true, item: existing });
});

// Contato informado manualmente (as bases públicas nem sempre trazem telefone/e-mail).
app.put('/api/carteira/:cnpj/contato', (req, res) => {
  const existing = findEmpresa(req.params.cnpj);
  if (!existing) {
    return res.status(404).json({ error: 'Empresa não encontrada na carteira' });
  }
  const telefone = String(req.body?.telefone ?? '').trim();
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return res.status(400).json({ error: 'E-mail inválido.' });
  }
  existing.contatos_manuais = { telefone: telefone || undefined, email: email || undefined };
  existing.telefone = telefone || (existing.telefones?.[0] ?? NAO_CADASTRADO);
  existing.email = email || (existing.emails?.[0] ?? NAO_CADASTRADO);
  existing.lastUpdated = new Date().toISOString();
  saveCarteira(carteiraCache);
  return res.json({ success: true, item: existing, carteira: carteiraCache });
});

// ==========================================
// 2. CONSULTA DE CNPJ (bases públicas da RFB)
// ==========================================
app.get('/api/cnpj/:cnpj', async (req, res) => {
  const cnpj = sanitizeCnpj(req.params.cnpj);
  if (!isValidCnpj(cnpj)) {
    return res.status(400).json({ error: 'CNPJ inválido. Confira os 14 caracteres e os dígitos verificadores.' });
  }

  try {
    const data = await lookupCnpj(cnpj);
    if (data) return res.json(data);

    const cached = findEmpresa(cnpj);
    if (cached) return res.json({ ...cached, source: 'CarteiraLocal' });

    return res.status(404).json({
      error: 'CNPJ não localizado nas bases públicas da Receita Federal (ou todas as fontes estão indisponíveis agora).',
    });
  } catch (error: any) {
    console.error('Erro ao consultar CNPJ:', error);
    return res.status(500).json({ error: 'Erro ao processar consulta de CNPJ: ' + (error.message || 'Erro interno') });
  }
});

// ==========================================
// 3. STORAGE DE PDFs (volume /storage)
// ==========================================

app.post('/api/storage/save-pdf', async (req, res) => {
  try {
    const { cnpj, tipo, filename, contentBase64, textContent } = req.body;
    const clean = sanitizeCnpj(cnpj) || 'GERAL';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    let subfolder = 'relatorios';
    if (tipo === 'CND') subfolder = 'cnds';
    if (tipo === 'DAS_MEI') subfolder = 'guias_mei';

    const targetDir = path.join(STORAGE_DIR, subfolder);
    // basename impede gravar fora da pasta (ex.: "../../server.ts")
    const safeFilename = path.basename(String(filename || `${tipo}_${clean}_${timestamp}.pdf`));
    const targetPath = path.join(targetDir, safeFilename);

    if (contentBase64) {
      fs.writeFileSync(targetPath, Buffer.from(String(contentBase64).replace(/^data:[^;]+;base64,/, ''), 'base64'));
    } else if (textContent) {
      fs.writeFileSync(targetPath, textContent, 'utf-8');
    } else {
      return res.status(400).json({ error: 'Nenhum conteúdo (base64 ou texto) enviado para salvar.' });
    }

    const stat = fs.statSync(targetPath);
    return res.json({
      success: true,
      filename: safeFilename,
      tipo,
      cnpj: clean,
      subfolder,
      size: stat.size,
      savedPath: targetPath,
      message: `Arquivo salvo em ${targetPath}`,
    });
  } catch (error: any) {
    console.error('Erro ao salvar arquivo em storage:', error);
    return res.status(500).json({ error: 'Erro ao salvar arquivo no volume: ' + error.message });
  }
});

app.get('/api/storage/files', (req, res) => {
  try {
    const results: any[] = [];
    for (const sub of STORAGE_SUBFOLDERS) {
      const dirPath = path.join(STORAGE_DIR, sub.name);
      if (!fs.existsSync(dirPath)) continue;
      for (const file of fs.readdirSync(dirPath)) {
        if (file.startsWith('.')) continue;
        const stat = fs.statSync(path.join(dirPath, file));
        if (!stat.isFile()) continue;
        results.push({
          filename: file,
          subfolder: sub.name,
          categoria: sub.label,
          size: stat.size,
          updatedAt: stat.mtime.toISOString(),
          downloadUrl: `/api/storage/download/${sub.name}/${encodeURIComponent(file)}`,
        });
      }
    }
    results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return res.json({ storageDir: STORAGE_DIR, totalFiles: results.length, files: results });
  } catch (err: any) {
    return res.status(500).json({ error: 'Erro ao listar arquivos do storage: ' + err.message });
  }
});

app.get('/api/storage/download/:subfolder/:filename', (req, res) => {
  const { subfolder, filename } = req.params;
  if (!STORAGE_SUBFOLDERS.some(s => s.name === subfolder)) {
    return res.status(400).send('Pasta inválida.');
  }
  const safeFilename = path.basename(filename);
  const filePath = path.join(STORAGE_DIR, subfolder, safeFilename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Arquivo não encontrado no storage.');
  }
  return res.download(filePath, safeFilename);
});

// ==========================================
// 4. CND — leitura e classificação do PDF
// ==========================================
async function textoDoPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    return (await parser.getText()).text || '';
  } finally {
    await parser.destroy().catch(() => {});
  }
}

function salvarPdfCnd(buffer: Buffer, cnpj: string, esfera?: string) {
  try {
    const nome = `CND_${String(esfera || 'CND').toUpperCase()}_${sanitizeCnpj(cnpj)}_${Date.now()}.pdf`;
    fs.writeFileSync(path.join(STORAGE_DIR, 'cnds', path.basename(nome)), buffer);
    return nome;
  } catch (e) {
    console.warn('Não foi possível salvar o PDF da CND:', e);
    return undefined;
  }
}

function registrarCndNaCarteira(cnpj: string, esfera: 'federal' | 'estadual', tipo: string, validade: string | null) {
  const empresa = findEmpresa(cnpj);
  if (!empresa) return;
  empresa.pendenciasResumo = {
    ...empresa.pendenciasResumo,
    ...(esfera === 'federal'
      ? { cndFederal: tipo, cndFederalValidade: validade || undefined }
      : { cndEstadual: tipo, cndEstadualValidade: validade || undefined }),
    ultimaConsulta: new Date().toISOString(),
  };
  saveCarteira(carteiraCache);
}

app.post('/api/cnd/analyze-pdf', async (req, res) => {
  try {
    const { pdfBase64, rawText, fileName, cnpj, esfera } = req.body;
    let extractedText = '';

    if (pdfBase64) {
      const buffer = Buffer.from(String(pdfBase64).replace(/^data:[^;]+;base64,/, ''), 'base64');
      extractedText = await textoDoPdf(buffer);
      if (cnpj) salvarPdfCnd(buffer, cnpj, esfera);
    } else if (rawText) {
      extractedText = String(rawText);
    } else {
      return res.status(400).json({ error: 'Nenhum PDF (Base64) ou texto informado.' });
    }

    if (!extractedText.trim()) {
      return res.status(422).json({
        error: 'O PDF não tem texto legível (provavelmente é uma imagem escaneada). Baixe a certidão original no site do órgão emissor.',
      });
    }

    return res.json({
      success: true,
      fileName: fileName || 'certidao.pdf',
      extractedTextLength: extractedText.length,
      sampleText: extractedText.slice(0, 1500),
      classification: classifyCndText(extractedText, { cnpj }),
    });
  } catch (error: any) {
    console.error('Erro ao analisar PDF de CND:', error);
    return res.status(500).json({ error: 'Falha ao processar arquivo PDF: ' + error.message });
  }
});

// Emissão da CND federal pelo robô no servidor (em segundo plano).
app.post('/api/cnd/:cnpj/emitir', (req, res) => {
  const cnpj = sanitizeCnpj(req.params.cnpj);
  if (!isValidCnpj(cnpj)) return res.status(400).json({ error: 'CNPJ inválido.' });

  const job = criarJob('cnd', cnpj, async job => {
    const robo = await emitirCndFederal({
      cnpj,
      url: process.env.CND_FEDERAL_URL_TESTE,
      onProgresso: etapa => Object.assign(job, { etapa }),
      ajudaHumana: ajudaHumanaDoJob(job),
    });
    const texto = robo.pdf ? await textoDoPdf(robo.pdf) : robo.textoPagina || '';
    const fileName = robo.pdf ? salvarPdfCnd(robo.pdf, cnpj, 'federal') : 'resposta-do-portal.txt';
    const classification = classifyCndText(texto, { cnpj });
    registrarCndNaCarteira(cnpj, 'federal', classification.tipo, classification.validade);
    return {
      success: true,
      fileName: fileName || 'certidao.pdf',
      extractedTextLength: texto.length,
      sampleText: texto.slice(0, 1500),
      classification,
    };
  });

  return res.json({ jobId: job.id });
});

// ==========================================
// 5. MEI — DAS em aberto e DASN-SIMEI (PGMEI, gratuito)
// ==========================================

function arquivoMei(cnpj: string) {
  return path.join(MEI_DIR, `${sanitizeCnpj(cnpj)}.json`);
}

function lerResultadoMei(cnpj: string): ResultadoMei | null {
  try {
    const file = arquivoMei(cnpj);
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : null;
  } catch {
    return null;
  }
}

function salvarResultadoMei(resultado: ResultadoMei) {
  fs.writeFileSync(arquivoMei(resultado.cnpj), JSON.stringify(resultado, null, 2), 'utf-8');

  const empresa = findEmpresa(resultado.cnpj);
  if (empresa) {
    empresa.pendenciasResumo = {
      ...empresa.pendenciasResumo,
      totalDebitosMei: resultado.resumo.totalGeral,
      guiasAtrasoMei: resultado.resumo.qtdVencidas + resultado.resumo.qtdDividaAtiva,
      guiasEmAbertoMei: resultado.resumo.qtdEmAberto + resultado.resumo.qtdDividaAtiva,
      declaracoesPendentesMei: resultado.resumo.declaracoesPendentes,
      meiConsultadoEm: resultado.consultadoEm,
      meiFonte: resultado.fonte,
      ultimaConsulta: new Date().toISOString(),
    };
    saveCarteira(carteiraCache);
  }
}

function recalcular(resultado: ResultadoMei): ResultadoMei {
  resultado.competencias.sort((a, b) => b.periodoApuracao.localeCompare(a.periodoApuracao));
  resultado.resumo = resumir(resultado.competencias, resultado.declaracoes);
  return resultado;
}

interface JobRobo {
  id: string;
  tipo: 'mei' | 'cnd';
  cnpj: string;
  status: 'na_fila' | 'executando' | 'aguardando_humano' | 'concluido' | 'erro';
  etapa: string;
  atual: number;
  total: number;
  criadoEm: number;
  resultado?: any;
  erro?: string;
  bloqueado?: boolean;
}

const jobs = new Map<string, JobRobo>();
// Página do robô aguardando a pessoa resolver um captcha (por id do job).
const telasAguardando = new Map<string, any>();

function ajudaHumanaDoJob(job: JobRobo): AjudaHumana {
  return async (page, concluido) => {
    telasAguardando.set(job.id, page);
    Object.assign(job, { status: 'aguardando_humano', etapa: 'A Receita pediu uma verificação: resolva o captcha na tela abaixo.' });
    const limite = Date.now() + 4 * 60_000;
    try {
      while (Date.now() < limite) {
        if (await concluido().catch(() => false)) return true;
        await new Promise(r => setTimeout(r, 1000));
      }
      return false;
    } finally {
      telasAguardando.delete(job.id);
      Object.assign(job, { status: 'executando', etapa: 'Continuando a consulta...' });
    }
  };
}
// Um robô por vez: evita abrir vários navegadores e não sobrecarrega os portais.
let filaRobos: Promise<void> = Promise.resolve();

function criarJob(tipo: JobRobo['tipo'], cnpj: string, executar: (job: JobRobo) => Promise<any>): JobRobo {
  const emAndamento = Array.from(jobs.values()).find(
    j => j.tipo === tipo && j.cnpj === cnpj && (j.status === 'na_fila' || j.status === 'executando'),
  );
  if (emAndamento) return emAndamento;

  limparJobsAntigos();
  const job: JobRobo = { id: randomUUID(), tipo, cnpj, status: 'na_fila', etapa: 'Aguardando na fila...', atual: 0, total: 0, criadoEm: Date.now() };
  jobs.set(job.id, job);
  filaRobos = filaRobos.then(async () => {
    job.status = 'executando';
    try {
      const resultado = await executar(job);
      Object.assign(job, { status: 'concluido', etapa: 'Concluído.', resultado });
    } catch (err: any) {
      console.error(`[${tipo.toUpperCase()}] Falha:`, err);
      Object.assign(job, {
        status: 'erro',
        erro: err?.message || 'Falha inesperada no robô.',
        bloqueado: err instanceof PgmeiBloqueadoError || err instanceof CndBloqueadaError || err instanceof SiteInacessivelError,
      });
    }
  });
  return job;
}

function limparJobsAntigos() {
  const limite = Date.now() - 60 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (job.criadoEm < limite && (job.status === 'concluido' || job.status === 'erro')) jobs.delete(id);
  }
}

app.get('/api/status', (req, res) => {
  return res.json({
    robo_pgmei: {
      disponivel: Boolean(localizarChrome()),
      headless: process.env.PGMEI_HEADLESS === 'true',
    },
    robo_cnd: { disponivel: Boolean(localizarChrome()) },
    proxy_receita: Boolean(proxyConfigurado()),
    cnd_federal_url: CND_FEDERAL_URL,
  });
});

// Tela atual do robô (JPEG) enquanto aguarda a pessoa resolver o captcha.
app.get('/api/jobs/:id/tela', async (req, res) => {
  const page = telasAguardando.get(req.params.id);
  if (!page) return res.status(404).json({ error: 'Nenhuma verificação aguardando.' });
  try {
    const img = await page.screenshot({ type: 'jpeg', quality: 70 });
    res.set('Cache-Control', 'no-store');
    return res.type('image/jpeg').send(Buffer.from(img));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Repassa o clique da pessoa para a tela do robô (coordenadas da janela 1366x768).
app.post('/api/jobs/:id/clique', async (req, res) => {
  const page = telasAguardando.get(req.params.id);
  if (!page) return res.status(404).json({ error: 'Nenhuma verificação aguardando.' });
  const x = Number(req.body?.x);
  const y = Number(req.body?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return res.status(400).json({ error: 'Coordenadas inválidas.' });
  await page.mouse.click(x, y).catch(() => {});
  return res.json({ ok: true });
});

app.get(['/api/jobs/:id', '/api/mei/jobs/:id'], (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Consulta não encontrada (pode ter expirado).' });
  return res.json(job);
});

app.get('/api/mei/:cnpj', (req, res) => {
  const resultado = lerResultadoMei(req.params.cnpj);
  if (!resultado) return res.status(404).json({ error: 'Nenhuma consulta do MEI salva para este CNPJ.' });
  return res.json(resultado);
});

app.post('/api/mei/:cnpj/consultar', async (req, res) => {
  const cnpj = sanitizeCnpj(req.params.cnpj);
  if (!isValidCnpj(cnpj)) return res.status(400).json({ error: 'CNPJ inválido.' });

  const empresa = findEmpresa(cnpj);
  const maxAnos = Math.min(Math.max(Number(req.body?.maxAnos) || 6, 1), 10);
  const verificarDasn = req.body?.verificarDasn !== false;

  const job = criarJob('mei', cnpj, async job => {
    const resultado = await consultarPgmei({
      cnpj,
      ...datasMei(empresa),
      maxAnos,
      verificarDasn,
      baseUrl: process.env.PGMEI_BASE_URL,
      ajudaHumana: ajudaHumanaDoJob(job),
      onProgresso: (etapa, atual, total) => Object.assign(job, { etapa, atual, total }),
    });

    // Mantém a situação de declarações marcadas manualmente quando o robô não conseguiu verificar.
    const anterior = lerResultadoMei(cnpj);
    if (anterior) {
      resultado.declaracoes = resultado.declaracoes.map(d => {
        const manual = anterior.declaracoes.find(a => a.ano === d.ano && a.fonte === 'Manual');
        return d.situacao === 'NAO_VERIFICADA' && manual ? manual : d;
      });
    }
    salvarResultadoMei(recalcular(resultado));
    return resultado;
  });

  return res.json({ jobId: job.id });
});

// Importa a tabela copiada do PGMEI (Ctrl+C na tela "Emitir Guia de Pagamento").
app.post('/api/mei/:cnpj/importar', (req, res) => {
  const cnpj = sanitizeCnpj(req.params.cnpj);
  const { texto, textoDeclaracoes } = req.body || {};
  if (!texto && !textoDeclaracoes) {
    return res.status(400).json({ error: 'Cole o texto da tabela do PGMEI ou da lista de declarações do DASN-SIMEI.' });
  }

  const empresa = findEmpresa(cnpj);
  const anterior = lerResultadoMei(cnpj);
  const { competencias: importadas, ignoradas } = texto ? parseExtratoPgmei(String(texto)) : { competencias: [], ignoradas: 0 };
  if (texto && importadas.length === 0) {
    return res.status(422).json({
      error: 'Nenhuma competência reconhecida. Copie a tabela inteira do PGMEI (com o mês/ano, situação e valores de cada linha).',
    });
  }

  // Competências importadas substituem as de mesmo período; as demais são mantidas.
  const porPa = new Map<string, CompetenciaMei>((anterior?.competencias || []).map(c => [c.periodoApuracao, c]));
  for (const c of importadas) porPa.set(c.periodoApuracao, c);

  const exigiveis = anosDasnExigiveis(datasMei(empresa));
  const pendentes = new Map<number, { fonte: string; observacao?: string }>();
  const entregues = new Map<number, { fonte: string }>();
  for (const d of anterior?.declaracoes || []) {
    if (!exigiveis.includes(d.ano)) continue;
    if (d.situacao === 'PENDENTE') pendentes.set(d.ano, { fonte: d.fonte || 'Anterior', observacao: d.observacao });
    if (d.situacao === 'ENTREGUE') entregues.set(d.ano, { fonte: d.fonte || 'Anterior' });
  }
  if (textoDeclaracoes) {
    const anos = parseDeclaracoesEntregues(String(textoDeclaracoes));
    for (const ano of anos) {
      pendentes.delete(ano);
      entregues.set(ano, { fonte: 'Importação DASN-SIMEI' });
    }
    if (anos.length > 0) {
      for (const ano of exigiveis) {
        if (!entregues.has(ano)) pendentes.set(ano, { fonte: 'Importação DASN-SIMEI', observacao: 'Não consta na lista de declarações importada.' });
      }
    }
  }

  const resultado = recalcular({
    cnpj,
    fonte: 'IMPORTACAO_PGMEI',
    consultadoEm: new Date().toISOString(),
    competencias: Array.from(porPa.values()),
    declaracoes: montarDeclaracoes(exigiveis, pendentes, entregues),
    resumo: resumir([], []),
    avisos: ignoradas ? [`${ignoradas} linha(s) com período mas sem valores/situação foram ignoradas.`] : [],
  });
  salvarResultadoMei(resultado);
  return res.json(resultado);
});

// Marca manualmente a situação de uma DASN-SIMEI.
app.put('/api/mei/:cnpj/declaracoes/:ano', (req, res) => {
  const cnpj = sanitizeCnpj(req.params.cnpj);
  const ano = Number(req.params.ano);
  const situacao = String(req.body?.situacao || '') as SituacaoDeclaracao;
  if (!['PENDENTE', 'ENTREGUE', 'NAO_VERIFICADA'].includes(situacao)) {
    return res.status(400).json({ error: 'Situação inválida.' });
  }

  const empresa = findEmpresa(cnpj);
  const resultado: ResultadoMei = lerResultadoMei(cnpj) || {
    cnpj,
    fonte: 'IMPORTACAO_PGMEI',
    consultadoEm: new Date().toISOString(),
    competencias: [],
    declaracoes: montarDeclaracoes(
      anosDasnExigiveis(datasMei(empresa)),
      new Map(),
      new Map(),
    ),
    resumo: resumir([], []),
    avisos: [],
  };

  const nova: DeclaracaoMei = { ano, situacao, prazo: `31/05/${ano + 1}`, fonte: 'Manual' };
  const idx = resultado.declaracoes.findIndex(d => d.ano === ano);
  if (idx >= 0) resultado.declaracoes[idx] = nova;
  else resultado.declaracoes.push(nova);
  resultado.declaracoes.sort((a, b) => b.ano - a.ano);

  salvarResultadoMei(recalcular(resultado));
  return res.json(resultado);
});

// ==========================================
// 6. SCRIPT ASSISTIDO (Python/Selenium) PARA A CND FEDERAL
// ==========================================
app.post('/api/selenium-script', (req, res) => {
  const { cnpj, cndUrl, appUrl } = req.body || {};
  const cleanCnpj = sanitizeCnpj(cnpj) || '00000000000000';
  const targetCndUrl = cndUrl || CND_FEDERAL_URL;
  const baseApp = appUrl || 'http://localhost:3000';

  const script = `"""
Vírgula, Contábil — emissão assistida de CND com leitura automática do PDF

O site da certidão tem verificação de segurança (captcha), então o robô abre o
navegador, preenche o CNPJ e espera você concluir a emissão. Quando o PDF for
baixado, ele é enviado ao sistema para classificação (Negativa / Positiva com
efeito de negativa / Positiva).

Instalação:
    pip install selenium webdriver-manager requests
Uso:
    python cnd_assistida.py
"""

import base64
import glob
import os
import time

import requests
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager

CNPJ = "${cleanCnpj}"
URL_CND = "${targetCndUrl}"
APP_URL = "${baseApp}"
PASTA_DOWNLOAD = os.path.abspath("storage/downloads")


def abrir_navegador():
    os.makedirs(PASTA_DOWNLOAD, exist_ok=True)
    options = Options()
    options.add_argument("--start-maximized")
    options.add_experimental_option("prefs", {
        "download.default_directory": PASTA_DOWNLOAD,
        "download.prompt_for_download": False,
        "plugins.always_open_pdf_externally": True,
    })
    return webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)


def preencher_cnpj(driver):
    for _ in range(40):
        campos = driver.find_elements(By.CSS_SELECTOR, "input[formcontrolname*='cnpj' i], input[id*='cnpj' i], input[name*='cnpj' i], input[placeholder*='CNPJ' i]")
        if campos:
            campos[0].clear()
            campos[0].send_keys(CNPJ)
            print("[+] CNPJ preenchido.")
            return
        time.sleep(0.5)
    print("[!] Campo de CNPJ não encontrado: digite o CNPJ manualmente.")


def aguardar_pdf(antes, limite_segundos=600):
    fim = time.time() + limite_segundos
    while time.time() < fim:
        novos = [f for f in glob.glob(os.path.join(PASTA_DOWNLOAD, "*.pdf")) if f not in antes]
        if novos:
            time.sleep(1)
            return max(novos, key=os.path.getmtime)
        time.sleep(1)
    return None


def enviar_para_analise(caminho):
    with open(caminho, "rb") as f:
        conteudo = base64.b64encode(f.read()).decode()
    resp = requests.post(f"{APP_URL}/api/cnd/analyze-pdf", json={
        "pdfBase64": conteudo,
        "fileName": os.path.basename(caminho),
        "cnpj": CNPJ,
        "esfera": "federal",
    }, timeout=60)
    resp.raise_for_status()
    classificacao = resp.json()["classification"]
    print(f"[+] Resultado: {classificacao['tipo']} — validade: {classificacao.get('validade')}")


if __name__ == "__main__":
    driver = abrir_navegador()
    try:
        antes = set(glob.glob(os.path.join(PASTA_DOWNLOAD, "*.pdf")))
        driver.get(URL_CND)
        preencher_cnpj(driver)
        print("[*] Conclua a verificação de segurança e clique em emitir/baixar a certidão...")
        pdf = aguardar_pdf(antes)
        if pdf:
            print(f"[+] PDF baixado: {pdf}")
            enviar_para_analise(pdf)
        else:
            print("[-] Nenhum PDF baixado no tempo limite.")
    finally:
        driver.quit()
`;

  return res.json({ script });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Vírgula, Contábil rodando em http://0.0.0.0:${PORT}`);
  });
}

startServer();
