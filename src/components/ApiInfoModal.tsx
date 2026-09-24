import React from 'react';
import { X, Database, Phone, Mail, CheckCircle2, AlertTriangle, HardDrive, Shield } from 'lucide-react';

interface ApiInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiInfoModal: React.FC<ApiInfoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">APIs da Receita Federal & Diagnóstico de Dados</h3>
              <p className="text-xs text-slate-400">Arquitetura de dados, telefones, e-mails e montagem Docker</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-300">
          {/* 1. Quais APIs são utilizadas */}
          <div className="space-y-3">
            <h4 className="font-bold text-sm text-emerald-400 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              1. Quais APIs estamos usando para consultar a Receita Federal?
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                <span className="font-bold text-white block mb-1">Minha Receita (RFB)</span>
                <p className="text-[11px] text-slate-400">
                  Base pública espelhada mensalmente dos arquivos abertos da Receita Federal do Brasil (CNPJ Open Data).
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                <span className="font-bold text-white block mb-1">BrasilAPI</span>
                <p className="text-[11px] text-slate-400">
                  API pública de alta resiliência mantida pela comunidade brasileira com múltiplos espelhos.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                <span className="font-bold text-white block mb-1">CNPJ.ws / RFB</span>
                <p className="text-[11px] text-slate-400">
                  Serviço de dados cadastrais de estabelecimentos e quadro societário da RFB.
                </p>
              </div>
            </div>
          </div>

          {/* 2. Por que o telefone e e-mail não estavam vindo */}
          <div className="space-y-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700/80">
            <h4 className="font-bold text-sm text-amber-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              2. Por que o Telefone e o E-mail não estavam vindo?
            </h4>
            
            <div className="space-y-3 text-slate-300 text-xs">
              <div className="flex items-start gap-2.5">
                <Phone className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Telefone:</strong> No banco oficial da Receita Federal, o campo <code className="px-1.5 py-0.5 rounded bg-slate-950 text-emerald-400 font-mono">ddd_telefone_1</code> frequentemente vem com 10 ou 11 dígitos concatenados (ex: <code className="text-slate-200 font-mono">1122222222</code>). Uma condição de máscara anterior descartava o valor se o telefone 2 não existisse. Corrigimos o algoritmo de parsing para normalizar automaticamente números com DDD no formato brasileiro <code className="text-emerald-400 font-mono">(XX) XXXXX-XXXX</code> e checar múltiplos campos (<code className="font-mono">ddd_telefone_1</code>, <code className="font-mono">telefone_1</code>, <code className="font-mono">telefone_2</code>).
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Mail className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">E-mail:</strong> No Brasil, milhares de empresas deixam o campo de e-mail em branco na abertura ou inserem o e-mail do contador (que às vezes é removido por privacidade). Nosso extrator agora faz a varredura em <code className="font-mono">email</code>, <code className="font-mono">correio_eletronico</code> e <code className="font-mono">estabelecimento.email</code>. Além disso, permitimos que você edite ou cadastre contatos diretamente na ficha da empresa e na Carteira Multi-CNPJ!
                </div>
              </div>
            </div>
          </div>

          {/* 3. Como funciona a pasta montada no Docker (/app/storage) */}
          <div className="space-y-3">
            <h4 className="font-bold text-sm text-cyan-400 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-cyan-400" />
              3. Montagem dos PDFs no Docker (Volume Host & Container)
            </h4>
            <p className="text-slate-400 text-xs">
              Ao gerar ou consultar certidões (CND) ou guias DAS do MEI, você pode salvar o arquivo diretamente no volume do Docker. Todos os PDFs ficam disponíveis na sua máquina física em tempo real:
            </p>
            <div className="p-3 rounded-xl bg-slate-950 font-mono text-[11px] text-emerald-400 border border-slate-800 space-y-1">
              <div># No docker-compose.yml:</div>
              <div className="text-slate-300">volumes:</div>
              <div className="text-emerald-300 pl-4">- ./storage:/app/storage</div>
              <div className="text-slate-300"># Subpastas criadas automaticamente:</div>
              <div className="text-slate-400 pl-4">./storage/cnds/ (Certidões Federal e Estadual)</div>
              <div className="text-slate-400 pl-4">./storage/guias_mei/ (Boletos DAS e Extratos)</div>
              <div className="text-slate-400 pl-4">./storage/relatorios/ (Dossiês de Compliance)</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex justify-end bg-slate-900">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
