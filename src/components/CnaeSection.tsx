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
    <div className="bg-white rounded-2xl border border-border p-5 sm:p-7">
      <div className="flex items-center justify-between pb-4 border-b border-border mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary-50 text-primary">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Atividades Econômicas (CNAEs)
            </h3>
            <p className="text-xs text-muted-foreground">
              Classificação Nacional de Atividades Econômicas cadastradas
            </p>
          </div>
        </div>

        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-foreground">
          Total: {1 + (cnaesSecundarios?.length || 0)} CNAE{cnaesSecundarios?.length !== 0 ? 's' : ''}
        </span>
      </div>

      {/* CNAE Principal */}
      <div className="mb-6">
        <span className="text-xs font-bold uppercase tracking-wider text-primary mb-2 flex items-center gap-1.5">
          <CheckCircle className="w-4 h-4 text-primary" />
          Atividade Econômica Principal
        </span>
        <div className="p-4 rounded-xl bg-primary-50 border border-primary-200">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
            <div className="flex-1">
              <span className="inline-block px-2.5 py-1 rounded-md bg-primary text-primary-foreground font-mono font-bold text-sm tracking-wide mb-1.5 shadow-sm">
                CNAE {formatCnaeCode(cnaePrincipal.codigo)}
              </span>
              <p className="text-base font-semibold text-foreground leading-snug">
                {cnaePrincipal.descricao || 'Atividade principal cadastrada'}
              </p>
            </div>
            <span className="self-start text-[11px] font-semibold uppercase px-2.5 py-1 rounded bg-white text-primary border border-primary-200 shadow-2xs">
              Principal
            </span>
          </div>
        </div>
      </div>

      {/* CNAEs Secundários */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-muted-foreground" />
            Atividades Secundárias ({cnaesSecundarios?.length || 0})
          </span>

          {cnaesSecundarios && cnaesSecundarios.length > 3 && (
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrar por código ou descrição..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-border focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none text-foreground"
              />
            </div>
          )}
        </div>

        {cnaesSecundarios && cnaesSecundarios.length > 0 ? (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {filteredSecundarios.map((cnae, index) => (
              <div
                key={`${cnae.codigo}-${index}`}
                className="p-3 rounded-xl bg-muted hover:bg-muted border border-border transition flex items-start gap-3"
              >
                <span className="font-mono text-xs font-bold text-foreground bg-white px-2 py-1 rounded border border-border shrink-0">
                  {formatCnaeCode(cnae.codigo)}
                </span>
                <span className="text-xs sm:text-sm text-foreground font-medium leading-relaxed">
                  {cnae.descricao}
                </span>
              </div>
            ))}

            {filteredSecundarios.length === 0 && (
              <p className="text-xs text-muted-foreground italic py-3 text-center">
                Nenhuma atividade secundária encontrada para a busca "{searchTerm}".
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic bg-muted p-4 rounded-xl border border-border text-center">
            Nenhuma atividade secundária registrada no cadastro desta empresa.
          </p>
        )}
      </div>
    </div>
  );
};
