import React, { useState, useEffect } from 'react';
import { fetchSeleniumScript } from '../services/api';
import { Terminal, Copy, Check, Download, X } from 'lucide-react';

interface SeleniumModalProps {
  isOpen: boolean;
  onClose: () => void;
  cnpj: string;
}

export const SeleniumModal: React.FC<SeleniumModalProps> = ({ isOpen, onClose, cnpj }) => {
  const [scriptCode, setScriptCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetchSeleniumScript({ cnpj, appUrl: window.location.origin })
      .then(setScriptCode)
      .catch(e => setScriptCode(`# Erro ao gerar o script: ${e.message}`))
      .finally(() => setLoading(false));
  }, [isOpen, cnpj]);

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([scriptCode], { type: 'text/x-python;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cnd_assistida_${cnpj.replace(/[^0-9A-Z]/gi, '') || 'empresa'}.py`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary-950/60 backdrop-blur-sm">
      <div className="bg-white border border-border rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary-50 text-primary">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Emissão assistida da CND federal (Python)</h3>
              <p className="text-xs text-muted-foreground">
                Abre o portal, preenche o CNPJ, espera você concluir a verificação e envia o PDF baixado para análise.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition cursor-pointer" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-3 bg-muted/70 border-b border-border flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="font-semibold text-foreground">No seu computador:</span>
            <code className="bg-white border border-border px-2 py-1 rounded text-primary font-mono text-[11px]">pip install selenium webdriver-manager requests</code>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCopy} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white hover:bg-muted text-foreground text-xs font-semibold transition border border-border cursor-pointer">
              {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
            <button onClick={handleDownload} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-800 text-primary-foreground text-xs font-semibold transition cursor-pointer">
              <Download className="w-3.5 h-3.5" />
              Baixar .py
            </button>
          </div>
        </div>

        <div className="p-6 flex-1 overflow-y-auto font-mono text-xs text-primary-100 bg-primary-950 leading-relaxed">
          {loading ? <div className="py-20 text-center text-primary-300">Gerando script...</div> : <pre className="whitespace-pre">{scriptCode}</pre>}
        </div>
      </div>
    </div>
  );
};
