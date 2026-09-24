import React, { useState } from 'react';
import { CNAE } from '../types/cnpj';
import { formatCnaeCode } from '../utils/formatters';
import { Briefcase, Layers, Search, CheckCircle } from 'lucide-react';

interface CnaeSectionProps {
  cnaePrincipal: CNAE;
  cnaesSecundarios: CNAE[];
}

export const CnaeSection: React.FC<CnaeSectionProps> = ({
  cnaePrincipal,
  cnaesSecundarios,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSecundarios = cnaesSecundarios.filter((c) => {
    const term = searchTerm.toLowerCase();
    return (
      c.codigo.toLowerCase().includes(term) ||
      c.descricao.toLowerCase().includes(term)
    );
  });

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-7">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Atividades Econômicas (CNAEs)
            </h3>
            <p className="text-xs text-slate-500">
              Classificação Nacional de Atividades Econômicas cadastradas
            </p>
          </div>
        </div>

        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
          Total: {1 + (cnaesSecundarios?.length || 0)} CNAE{cnaesSecundarios?.length !== 0 ? 's' : ''}
        </span>
      </div>

      {/* CNAE Principal */}
      <div className="mb-6">
        <span className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-2 flex items-center gap-1.5">
          <CheckCircle className="w-4 h-4 text-blue-600" />
          Atividade Econômica Principal
        </span>
        <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50/80 to-indigo-50/50 border border-blue-200/80">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
            <div className="flex-1">
              <span className="inline-block px-2.5 py-1 rounded-md bg-blue-600 text-white font-mono font-bold text-sm tracking-wide mb-1.5 shadow-sm">
                CNAE {formatCnaeCode(cnaePrincipal.codigo)}
              </span>
              <p className="text-base font-semibold text-slate-900 leading-snug">
                {cnaePrincipal.descricao || 'Atividade principal cadastrada'}
              </p>
            </div>
            <span className="self-start text-[11px] font-semibold uppercase px-2.5 py-1 rounded bg-white text-blue-700 border border-blue-200 shadow-2xs">
              Principal
            </span>
          </div>
        </div>
      </div>

      {/* CNAEs Secundários */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-slate-500" />
            Atividades Secundárias ({cnaesSecundarios?.length || 0})
          </span>

          {cnaesSecundarios && cnaesSecundarios.length > 3 && (
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrar por código ou descrição..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-slate-700"
              />
            </div>
          )}
        </div>

        {cnaesSecundarios && cnaesSecundarios.length > 0 ? (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {filteredSecundarios.map((cnae, index) => (
              <div
                key={`${cnae.codigo}-${index}`}
                className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/70 transition flex items-start gap-3"
              >
                <span className="font-mono text-xs font-bold text-slate-700 bg-white px-2 py-1 rounded border border-slate-200 shrink-0">
                  {formatCnaeCode(cnae.codigo)}
                </span>
                <span className="text-xs sm:text-sm text-slate-800 font-medium leading-relaxed">
                  {cnae.descricao}
                </span>
              </div>
            ))}

            {filteredSecundarios.length === 0 && (
              <p className="text-xs text-slate-500 italic py-3 text-center">
                Nenhuma atividade secundária encontrada para a busca "{searchTerm}".
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
            Nenhuma atividade secundária registrada no cadastro desta empresa.
          </p>
        )}
      </div>
    </div>
  );
};
