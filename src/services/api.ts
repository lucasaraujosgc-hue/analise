import { EmpresaData, CNDAnalysisResult, PGMEIResult, StorageFile } from '../types/cnpj';

export async function fetchCnpjData(cnpj: string): Promise<EmpresaData> {
  const cleanCnpj = cnpj.replace(/\D/g, '');
  const response = await fetch(`/api/cnpj/${cleanCnpj}`);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Falha ao consultar CNPJ (${response.status})`);
  }
  
  return await response.json();
}

// Carteira Multi-CNPJ
export async function fetchCarteira(): Promise<EmpresaData[]> {
  try {
    const res = await fetch('/api/carteira');
    if (!res.ok) throw new Error('Falha ao carregar carteira');
    return await res.json();
  } catch (e) {
    console.warn('Usando fallback do localStorage para carteira:', e);
    const local = localStorage.getItem('auditacnpj_carteira');
    return local ? JSON.parse(local) : [];
  }
}

export async function saveCompanyToCarteira(empresa: EmpresaData): Promise<EmpresaData[]> {
  try {
    const res = await fetch('/api/carteira', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(empresa),
    });
    if (res.ok) {
      const data = await res.json();
      return data.carteira;
    }
  } catch (e) {
    console.warn('Erro ao salvar no backend, salvando no localStorage:', e);
  }

  // Local fallback
  const local = localStorage.getItem('auditacnpj_carteira');
  let list: EmpresaData[] = local ? JSON.parse(local) : [];
  const idx = list.findIndex(e => e.cnpj.replace(/\D/g, '') === empresa.cnpj.replace(/\D/g, ''));
  if (idx >= 0) {
    list[idx] = empresa;
  } else {
    list.unshift(empresa);
  }
  localStorage.setItem('auditacnpj_carteira', JSON.stringify(list));
  return list;
}

export async function deleteCompanyFromCarteira(cnpj: string): Promise<EmpresaData[]> {
  const clean = cnpj.replace(/\D/g, '');
  try {
    const res = await fetch(`/api/carteira/${clean}`, { method: 'DELETE' });
    if (res.ok) {
      const data = await res.json();
      try {
        localStorage.setItem('auditacnpj_carteira', JSON.stringify(data.carteira));
      } catch (e) {}
      return data.carteira;
    }
  } catch (e) {
    console.warn('Erro ao deletar no backend, deletando no localStorage:', e);
  }

  const local = localStorage.getItem('auditacnpj_carteira');
  let list: EmpresaData[] = local ? JSON.parse(local) : [];
  list = list.filter(e => e.cnpj.replace(/\D/g, '') !== clean);
  localStorage.setItem('auditacnpj_carteira', JSON.stringify(list));
  return list;
}

export async function updatePendenciasInCarteira(cnpj: string, payload: { pendenciasResumo?: any; telefone?: string; email?: string }): Promise<void> {
  const clean = cnpj.replace(/\D/g, '');
  try {
    await fetch(`/api/carteira/${clean}/pendencias`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn('Erro ao atualizar pendências no backend:', e);
  }
}

// CND PDF Analysis
export async function analyzeCndPdf(options: {
  pdfBase64?: string;
  rawText?: string;
  fileName?: string;
  cnpj?: string;
}): Promise<CNDAnalysisResult> {
  const response = await fetch('/api/cnd/analyze-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Erro ao processar análise da certidão (${response.status})`);
  }

  return await response.json();
}

// PGMEI RPA
export async function consultPgmeiRpa(cnpj: string): Promise<PGMEIResult> {
  const response = await fetch('/api/rpa/pgmei', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cnpj }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Erro na consulta do PGMEI');
  }

  return await response.json();
}

// Parse custom PGMEI extract text
export async function parsePgmeiExtract(rawText: string, cnpj: string): Promise<any> {
  const response = await fetch('/api/rpa/pgmei-parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawText, cnpj }),
  });

  if (!response.ok) {
    throw new Error('Falha ao analisar extrato do PGMEI');
  }

  return await response.json();
}

// Save PDF to persistent storage mount
export async function savePdfToStorage(params: {
  cnpj: string;
  tipo: 'CND' | 'DAS_MEI' | 'RELATORIO';
  filename?: string;
  contentBase64?: string;
  textContent?: string;
  metadata?: any;
}): Promise<{ success: boolean; filename: string; size: number; message: string; savedPath: string }> {
  const res = await fetch('/api/storage/save-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao salvar PDF no volume do Docker.');
  }

  return await res.json();
}

// Fetch list of saved files in storage
export async function fetchStorageFiles(): Promise<{ storageDir: string; totalFiles: number; files: StorageFile[] }> {
  const res = await fetch('/api/storage/files');
  if (!res.ok) {
    throw new Error('Falha ao listar arquivos do storage');
  }
  return await res.json();
}

// Selenium Python Script
export async function fetchSeleniumScript(options: {
  cnpj: string;
  cndUrl?: string;
  pgmeiOnly?: boolean;
}): Promise<string> {
  const response = await fetch('/api/selenium-script', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    throw new Error('Falha ao gerar script do Selenium');
  }

  const data = await response.json();
  return data.script;
}
