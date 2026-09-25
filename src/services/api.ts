import {
  EmpresaData,
  CNDAnalysisResult,
  StorageFile,
  ResultadoMei,
  JobMei,
  SituacaoDeclaracao,
  StatusSistema,
  RoteiroRpa,
  PassoRpa,
} from '../types/cnpj';
import { cleanCNPJ } from '../utils/formatters';

async function lerErro(res: Response, padrao: string): Promise<Error> {
  const data = await res.json().catch(() => ({}));
  return new Error(data.error || `${padrao} (${res.status})`);
}

export async function fetchCnpjData(cnpj: string): Promise<EmpresaData> {
  const response = await fetch(`/api/cnpj/${cleanCNPJ(cnpj)}`);
  if (!response.ok) throw await lerErro(response, 'Falha ao consultar CNPJ');
  return response.json();
}

// Carteira Multi-CNPJ
export async function fetchCarteira(): Promise<EmpresaData[]> {
  try {
    const res = await fetch('/api/carteira');
    if (!res.ok) throw new Error('Falha ao carregar carteira');
    return await res.json();
  } catch (e) {
    console.warn('Usando cópia local da carteira:', e);
    try {
      const local = localStorage.getItem('auditacnpj_carteira');
      return local ? JSON.parse(local) : [];
    } catch {
      return [];
    }
  }
}

function guardarCopiaLocal(lista: EmpresaData[]) {
  try {
    localStorage.setItem('auditacnpj_carteira', JSON.stringify(lista));
  } catch {
    // armazenamento local indisponível: segue só com o servidor
  }
}

export async function saveCompanyToCarteira(empresa: EmpresaData): Promise<EmpresaData[]> {
  const res = await fetch('/api/carteira', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(empresa),
  });
  if (!res.ok) throw await lerErro(res, 'Falha ao salvar empresa na carteira');
  const data = await res.json();
  guardarCopiaLocal(data.carteira);
  return data.carteira;
}

export async function deleteCompanyFromCarteira(cnpj: string): Promise<EmpresaData[]> {
  const res = await fetch(`/api/carteira/${cleanCNPJ(cnpj)}`, { method: 'DELETE' });
  if (!res.ok) throw await lerErro(res, 'Falha ao remover empresa');
  const data = await res.json();
  guardarCopiaLocal(data.carteira);
  return data.carteira;
}

export async function updatePendenciasInCarteira(cnpj: string, pendenciasResumo: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`/api/carteira/${cleanCNPJ(cnpj)}/pendencias`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pendenciasResumo }),
    });
  } catch (e) {
    console.warn('Erro ao atualizar pendências:', e);
  }
}

export async function salvarContatoManual(cnpj: string, contato: { telefone: string; email: string }): Promise<EmpresaData[]> {
  const res = await fetch(`/api/carteira/${cleanCNPJ(cnpj)}/contato`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(contato),
  });
  if (!res.ok) throw await lerErro(res, 'Falha ao salvar contato');
  const data = await res.json();
  return data.carteira;
}

export async function fetchStatusSistema(): Promise<StatusSistema | null> {
  try {
    const res = await fetch('/api/status');
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

// CND
export async function analyzeCndPdf(options: {
  pdfBase64?: string;
  rawText?: string;
  fileName?: string;
  cnpj?: string;
  esfera?: 'federal' | 'estadual';
}): Promise<CNDAnalysisResult> {
  const response = await fetch('/api/cnd/analyze-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  if (!response.ok) throw await lerErro(response, 'Erro ao analisar a certidão');
  return response.json();
}

export async function iniciarEmissaoCndFederal(cnpj: string): Promise<string> {
  const res = await fetch(`/api/cnd/${cleanCNPJ(cnpj)}/emitir`, { method: 'POST' });
  if (!res.ok) throw await lerErro(res, 'Falha ao iniciar a emissão da CND');
  return (await res.json()).jobId;
}

export async function fetchJob<T>(jobId: string): Promise<{ status: string; etapa: string; resultado?: T; erro?: string; bloqueado?: boolean }> {
  const res = await fetch(`/api/jobs/${jobId}`);
  if (!res.ok) throw await lerErro(res, 'Falha ao acompanhar o robô');
  return res.json();
}

// MEI
export async function fetchResultadoMei(cnpj: string): Promise<ResultadoMei | null> {
  const res = await fetch(`/api/mei/${cleanCNPJ(cnpj)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw await lerErro(res, 'Falha ao carregar a consulta do MEI');
  return res.json();
}

export async function iniciarConsultaMei(cnpj: string, opcoes: { maxAnos?: number; verificarDasn?: boolean } = {}): Promise<string> {
  const res = await fetch(`/api/mei/${cleanCNPJ(cnpj)}/consultar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opcoes),
  });
  if (!res.ok) throw await lerErro(res, 'Falha ao iniciar a consulta no PGMEI');
  return (await res.json()).jobId;
}

export async function fetchJobMei(jobId: string): Promise<JobMei> {
  const res = await fetch(`/api/jobs/${jobId}`);
  if (!res.ok) throw await lerErro(res, 'Falha ao acompanhar a consulta');
  return res.json();
}

export async function importarExtratoMei(cnpj: string, dados: { texto?: string; textoDeclaracoes?: string }): Promise<ResultadoMei> {
  const res = await fetch(`/api/mei/${cleanCNPJ(cnpj)}/importar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  });
  if (!res.ok) throw await lerErro(res, 'Falha ao importar o extrato');
  return res.json();
}

export async function marcarDeclaracaoMei(cnpj: string, ano: number, situacao: SituacaoDeclaracao): Promise<ResultadoMei> {
  const res = await fetch(`/api/mei/${cleanCNPJ(cnpj)}/declaracoes/${ano}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ situacao }),
  });
  if (!res.ok) throw await lerErro(res, 'Falha ao atualizar a declaração');
  return res.json();
}

// Storage
export async function savePdfToStorage(params: {
  cnpj: string;
  tipo: 'CND' | 'DAS_MEI' | 'RELATORIO';
  filename?: string;
  contentBase64?: string;
  textContent?: string;
}): Promise<{ success: boolean; filename: string; size: number; message: string; savedPath: string }> {
  const res = await fetch('/api/storage/save-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw await lerErro(res, 'Falha ao salvar o arquivo');
  return res.json();
}

export async function fetchStorageFiles(): Promise<{ storageDir: string; totalFiles: number; files: StorageFile[] }> {
  const res = await fetch('/api/storage/files');
  if (!res.ok) throw new Error('Falha ao listar arquivos do storage');
  return res.json();
}

export async function fetchSeleniumScript(options: { cnpj: string; cndUrl?: string; appUrl?: string }): Promise<string> {
  const response = await fetch('/api/selenium-script', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  if (!response.ok) throw new Error('Falha ao gerar o script');
  return (await response.json()).script;
}

// RPA gravável
async function jsonOuErro<T>(res: Response, padrao: string): Promise<T> {
  if (!res.ok) throw await lerErro(res, padrao);
  return res.json();
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const rpa = {
  listar: async () => jsonOuErro<RoteiroRpa[]>(await fetch('/api/rpa/roteiros'), 'Falha ao listar roteiros'),
  salvar: async (roteiro: Partial<RoteiroRpa>) =>
    jsonOuErro<RoteiroRpa>(
      await fetch(roteiro.id ? `/api/rpa/roteiros/${roteiro.id}` : '/api/rpa/roteiros', {
        method: roteiro.id ? 'PUT' : 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(roteiro),
      }),
      'Falha ao salvar o roteiro',
    ),
  excluir: async (id: string) => jsonOuErro(await fetch(`/api/rpa/roteiros/${id}`, { method: 'DELETE' }), 'Falha ao excluir'),
  executar: async (id: string, cnpj: string) =>
    (
      await jsonOuErro<{ jobId: string }>(
        await fetch(`/api/rpa/roteiros/${id}/executar`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ cnpj }) }),
        'Falha ao executar o roteiro',
      )
    ).jobId,
  abrirSessao: async (dados: { url: string; cnpjExemplo?: string; passosIniciais?: PassoRpa[] }) =>
    jsonOuErro<{ id: string; passos: PassoRpa[]; variaveis: Record<string, string> }>(
      await fetch('/api/rpa/sessoes', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(dados) }),
      'Falha ao abrir o navegador',
    ),
  acao: async (id: string, acao: Record<string, unknown>) =>
    jsonOuErro<{ passos: PassoRpa[] }>(
      await fetch(`/api/rpa/sessoes/${id}/acao`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(acao) }),
      'Falha ao executar a ação',
    ),
  editarPassos: async (id: string, passos: PassoRpa[]) =>
    jsonOuErro<{ passos: PassoRpa[] }>(
      await fetch(`/api/rpa/sessoes/${id}/passos`, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ passos }) }),
      'Falha ao editar os passos',
    ),
  estadoSessao: async (id: string) =>
    jsonOuErro<{ passos: PassoRpa[]; url: string; pdfCapturado: boolean }>(await fetch(`/api/rpa/sessoes/${id}`), 'Sessão encerrada'),
  fecharSessao: async (id: string) => fetch(`/api/rpa/sessoes/${id}`, { method: 'DELETE' }).catch(() => undefined),
};

export async function iniciarEmissaoCnd(cnpj: string, esfera: 'federal' | 'estadual'): Promise<{ jobId: string; roteiro?: string }> {
  const res = await fetch(`/api/cnd/${cleanCNPJ(cnpj)}/emitir`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ esfera }) });
  return jsonOuErro(res, 'Falha ao iniciar a emissão da CND');
}
