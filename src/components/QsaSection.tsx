import React from 'react';
import { SocioQSA } from '../types/cnpj';
import { formatDate } from '../utils/formatters';
import { Users, UserCheck, Calendar, Globe, Shield } from 'lucide-react';

interface QsaSectionProps {
  qsa: SocioQSA[];
  isMei: boolean;
}

export const QsaSection: React.FC<QsaSectionProps> = ({ qsa, isMei }) => {
  const hasPartners = qsa && qsa.length > 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-7">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Quadro de Sócios e Administradores (QSA)
            </h3>
            <p className="text-xs text-slate-500">
              Composição societária e representantes legais registrados na RFB
            </p>
          </div>
        </div>

        {hasPartners && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-100 text-purple-800">
            {qsa.length} {qsa.length === 1 ? 'Membro registrado' : 'Membros registrados'}
          </span>
        )}
      </div>

      {hasPartners ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {qsa.map((socio, idx) => (
            <div
              key={`${socio.nome_socio}-${idx}`}
              className="p-4 rounded-xl bg-slate-50/80 hover:bg-slate-100/70 border border-slate-200/70 transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-xs shrink-0">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                    {socio.qualificacao_socio}
                  </span>
                </div>

                <h4 className="font-bold text-slate-900 text-sm leading-snug">
                  {socio.nome_socio}
                </h4>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200/60 text-xs text-slate-500 space-y-1.5">
                {socio.faixa_etaria && (
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-slate-400" />
                    <span>Faixa Etária: <strong className="text-slate-700">{socio.faixa_etaria}</strong></span>
                  </div>
                )}
                {socio.data_entrada_sociedade && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Entrada: <strong className="text-slate-700">{formatDate(socio.data_entrada_sociedade)}</strong></span>
                  </div>
                )}
                {socio.pais && socio.pais !== 'Brasil' && (
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                    <span>País de Origem: <strong className="text-slate-700">{socio.pais}</strong></span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center">
          <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-slate-700">
            {isMei 
              ? 'Empresa individual (MEI / EI) sem Quadro de Sócios adicional' 
              : 'QSA não disponibilizado publicamente para este tipo societário'}
          </h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            {isMei
              ? 'Por ser Microempreendedor Individual (natureza jurídica individual), a administração é exercida exclusivamente pelo titular.'
              : 'Empresas individuais ou certos registros de filiais e órgãos públicos não possuem sócios múltiplos registrados no QSA.'}
          </p>
        </div>
      )}
    </div>
  );
};
