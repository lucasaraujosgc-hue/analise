import React, { useState } from 'react';
import { EmpresaData } from '../types/cnpj';
import { formatCNPJ, formatCurrency, formatDate } from '../utils/formatters';
import { Building, Calendar, DollarSign, Shield, Check, Copy, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

interface CompanyOverviewProps {
  empresa: EmpresaData;
}

export const CompanyOverview: React.FC<CompanyOverviewProps> = ({ empresa }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyCnpj = () => {
    navigator.clipboard.writeText(formatCNPJ(empresa.cnpj));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isAtiva = empresa.situacao_cadastral.toUpperCase().includes('ATIVA');
  const isBaixada = empresa.situacao_cadastral.toUpperCase().includes('BAIXADA');

  return (
    <div className="bg-white rounded-2xl border border-border p-5 sm:p-7">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-border">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                isAtiva
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : isBaixada
                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              {isAtiva ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : isBaixada ? (
                <XCircle className="w-3.5 h-3.5 text-rose-600" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              )}
              {empresa.situacao_cadastral}
            </span>

            {empresa.opcao_pelo_mei && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent-100 text-accent-800 border border-accent-200">
                Optante MEI (SIMEI){empresa.data_opcao_pelo_mei ? ` desde ${formatDate(empresa.data_opcao_pelo_mei)}` : ''}
              </span>
            )}

            {empresa.opcao_pelo_simples && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 text-primary border border-primary-200">
                Simples Nacional
              </span>
            )}

            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-foreground">
              Porte: {empresa.porte}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
            {empresa.razao_social}
          </h1>

          {empresa.nome_fantasia && empresa.nome_fantasia !== 'Não informado' && (
            <p className="text-base text-muted-foreground font-medium mt-0.5">
              Nome Fantasia: <span className="text-foreground font-semibold">{empresa.nome_fantasia}</span>
            </p>
          )}
        </div>

        {/* CNPJ Box with Copy */}
        <div className="flex items-center gap-2 bg-muted p-3 rounded-xl border border-border self-start lg:self-center">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
              CNPJ (Cadastro Nacional)
            </span>
            <span className="text-lg font-mono font-bold text-foreground">
              {formatCNPJ(empresa.cnpj)}
            </span>
          </div>
          <button
            onClick={handleCopyCnpj}
            className="p-2 text-muted-foreground hover:text-primary hover:bg-white rounded-lg transition border border-transparent hover:border-border cursor-pointer"
            title="Copiar CNPJ formatado"
          >
            {copied ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Grid of Key Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-5">
        <div className="bg-muted/70 p-3.5 rounded-xl border border-border">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-1">
            <Calendar className="w-4 h-4 text-primary" />
            Data de Abertura
          </div>
          <div className="text-base font-bold text-foreground">
            {formatDate(empresa.data_inicio_atividade)}
          </div>
          {empresa.data_situacao_cadastral && (
            <span className="text-xs text-muted-foreground block mt-0.5">
              Desde {formatDate(empresa.data_situacao_cadastral)}
            </span>
          )}
        </div>

        <div className="bg-muted/70 p-3.5 rounded-xl border border-border">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-1">
            <DollarSign className="w-4 h-4 text-primary" />
            Capital Social
          </div>
          <div className="text-base font-bold text-foreground">
            {formatCurrency(empresa.capital_social)}
          </div>
          <span className="text-xs text-muted-foreground block mt-0.5">
            Integralizado declarado
          </span>
        </div>

        <div className="bg-muted/70 p-3.5 rounded-xl border border-border sm:col-span-2">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-1">
            <Shield className="w-4 h-4 text-accent-600" />
            Natureza Jurídica
          </div>
          <div className="text-sm font-semibold text-foreground line-clamp-2">
            {empresa.natureza_juridica || 'Não informada'}
          </div>
        </div>
      </div>
    </div>
  );
};
