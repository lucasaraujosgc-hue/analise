import React from 'react';
import { Search, Loader2, Sparkles, CheckSquare, Square, Building, AlertCircle } from 'lucide-react';
import { formatCNPJ } from '../utils/formatters';
import { SAMPLE_COMPANIES } from '../data/mockCompanies';

interface CnpjSearchProps {
  cnpjInput: string;
  setCnpjInput: (val: string) => void;
  isMei: boolean;
  setIsMei: (val: boolean) => void;
  onSearch: (cnpjToSearch?: string, meiOverride?: boolean) => void;
  isLoading: boolean;
  error: string | null;
}

export const CnpjSearch: React.FC<CnpjSearchProps> = ({
  cnpjInput,
  setCnpjInput,
  isMei,
  setIsMei,
  onSearch,
  isLoading,
  error,
}) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCnpjInput(formatCNPJ(e.target.value));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSearch();
    }
  };

  const handleSampleClick = (sample: typeof SAMPLE_COMPANIES[0]) => {
    setCnpjInput(sample.cnpj);
    if (typeof sample.isMei === 'boolean') {
      setIsMei(sample.isMei);
      onSearch(sample.cnpj, sample.isMei);
    } else {
      onSearch(sample.cnpj);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-7">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Building className="w-5 h-5 text-blue-600" />
            Consulta e Análise de Empresa por CNPJ
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Insira o CNPJ para buscar CNAEs, endereço, telefone, e-mail, QSA, CNDs e guias PGMEI.
          </p>
        </div>

        {/* Botão / Toggle MEI Requisitado */}
        <div 
          onClick={() => setIsMei(!isMei)}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border cursor-pointer select-none transition-all ${
            isMei 
              ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-sm ring-2 ring-amber-400/20' 
              : 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-700'
          }`}
          title="Clique para ativar a consulta automática de débitos no portal PGMEI"
        >
          {isMei ? (
            <CheckSquare className="w-5 h-5 text-amber-600 fill-amber-100" />
          ) : (
            <Square className="w-5 h-5 text-slate-400" />
          )}
          <div className="text-left">
            <span className="text-xs font-bold block uppercase tracking-wider">
              {isMei ? 'Empresa é MEI (Ativado)' : 'Marcar se for MEI'}
            </span>
            <span className="text-[11px] text-slate-500 block leading-tight">
              {isMei ? 'Consulta PGMEI inclusa' : 'Habilitar apuração de DAS em atraso'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={cnpjInput}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="00.000.000/0000-00 (ou digite apenas os números)"
            className="w-full px-4 py-3.5 text-base sm:text-lg font-mono font-medium rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none text-slate-800 placeholder-slate-400 transition"
            maxLength={18}
          />
          {cnpjInput && (
            <button
              type="button"
              onClick={() => setCnpjInput('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 p-1"
            >
              Limpar
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => onSearch()}
          disabled={isLoading || !cnpjInput.trim()}
          className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Consultando...</span>
            </>
          ) : (
            <>
              <Search className="w-5 h-5" />
              <span>Analisar Empresa</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mt-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block">Atenção na consulta:</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Exemplos rápidos para teste imediato */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="flex items-center gap-1 font-medium text-slate-600">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          Testar com empresas de exemplo:
        </span>
        {SAMPLE_COMPANIES.map((sample) => (
          <button
            key={sample.cnpj}
            type="button"
            onClick={() => handleSampleClick(sample)}
            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 font-medium transition cursor-pointer border border-slate-200/60"
            title={`${sample.description} - ${sample.cnpj}`}
          >
            {sample.label}
          </button>
        ))}
      </div>
    </div>
  );
};
