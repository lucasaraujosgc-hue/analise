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
    <div className="bg-white rounded-2xl border border-border p-5 sm:p-7">
      <div className="flex items-center justify-between pb-4 border-b border-border mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-accent-50 text-accent-700">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Quadro de Sócios e Administradores (QSA)
            </h3>
            <p className="text-xs text-muted-foreground">
              Composição societária e representantes legais registrados na RFB
            </p>
          </div>
        </div>

        {hasPartners && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-accent-100 text-accent-800">
            {qsa.length} {qsa.length === 1 ? 'Membro registrado' : 'Membros registrados'}
          </span>
        )}
      </div>

      {hasPartners ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {qsa.map((socio, idx) => (
            <div
              key={`${socio.nome_socio}-${idx}`}
              className="p-4 rounded-xl bg-muted/70 hover:bg-muted border border-border transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-accent-100 text-accent-700 font-bold flex items-center justify-center text-xs shrink-0">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-accent-50 text-accent-800 border border-accent-200">
                    {socio.qualificacao_socio}
                  </span>
                </div>

                <h4 className="font-bold text-foreground text-sm leading-snug">
                  {socio.nome_socio}
                </h4>
              </div>

              <div className="mt-4 pt-3 border-t border-border text-xs text-muted-foreground space-y-1.5">
                {socio.faixa_etaria && (
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Faixa Etária: <strong className="text-foreground">{socio.faixa_etaria}</strong></span>
                  </div>
                )}
                {socio.data_entrada_sociedade && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Entrada: <strong className="text-foreground">{formatDate(socio.data_entrada_sociedade)}</strong></span>
                  </div>
                )}
                {socio.pais && socio.pais !== 'Brasil' && (
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>País de Origem: <strong className="text-foreground">{socio.pais}</strong></span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 rounded-xl bg-muted border border-dashed border-border text-center">
          <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-foreground">
            {isMei 
              ? 'Empresa individual (MEI / EI) sem Quadro de Sócios adicional' 
              : 'QSA não disponibilizado publicamente para este tipo societário'}
          </h4>
          <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
            {isMei
              ? 'Por ser Microempreendedor Individual (natureza jurídica individual), a administração é exercida exclusivamente pelo titular.'
              : 'Empresas individuais ou certos registros de filiais e órgãos públicos não possuem sócios múltiplos registrados no QSA.'}
          </p>
        </div>
      )}
    </div>
  );
};
