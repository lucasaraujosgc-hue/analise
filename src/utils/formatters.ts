// Aceita CNPJ alfanumérico (emitido pela RFB desde julho/2026).
export function formatCNPJ(value: string): string {
  const digits = cleanCNPJ(value).slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

export function cleanCNPJ(value: string): string {
  return String(value || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0);
}

export function formatDate(dateString?: string): string {
  if (!dateString) return 'Não informada';
  if (dateString.includes('/')) return dateString;
  const parts = dateString.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateString;
}

export function formatCEP(cep?: string): string {
  if (!cep) return '';
  const digits = cep.replace(/\D/g, '');
  if (digits.length === 8) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return cep;
}

export function formatCnaeCode(code: string): string {
  const d = code.replace(/\D/g, '');
  if (d.length === 7) {
    return `${d.slice(0, 4)}-${d.slice(4, 5)}/${d.slice(5, 7)}`;
  }
  return code;
}
