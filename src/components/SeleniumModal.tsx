import React, { useState, useEffect } from 'react';
import { fetchSeleniumScript } from '../services/api';
import { Terminal, Copy, Check, Download, X, Code, ExternalLink } from 'lucide-react';

interface SeleniumModalProps {
  isOpen: boolean;
  onClose: () => void;
  cnpj: string;
  cndUrl?: string;
  isMei: boolean;
}

export const SeleniumModal: React.FC<SeleniumModalProps> = ({
  isOpen,
  onClose,
  cnpj,
  cndUrl,
  isMei,
}) => {
  const [scriptCode, setScriptCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadScript();
    }
  }, [isOpen, cnpj, cndUrl, isMei]);

  const loadScript = async () => {
    setLoading(true);
    try {
      const code = await fetchSeleniumScript({
        cnpj,
        cndUrl,
        pgmeiOnly: !isMei,
      });
      setScriptCode(code);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

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
    a.download = `audita_cnpj_${cnpj.replace(/\D/g, '') || 'rpa'}_selenium.py`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Automação RPA com Selenium (Python)
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">
                  Selenium 4.x
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Script automatizado para navegação nos portais da RFB, CNDs e PGMEI
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Instructions banner */}
        <div className="px-6 py-3 bg-slate-950 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <span className="font-semibold text-emerald-400">Como executar no seu computador:</span>
            <code className="bg-slate-800 px-2 py-1 rounded text-emerald-300 font-mono text-[11px]">
              pip install selenium webdriver-manager pypdf
            </code>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado!' : 'Copiar Código'}
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Baixar .py
            </button>
          </div>
        </div>

        {/* Code Content */}
        <div className="p-6 flex-1 overflow-y-auto font-mono text-xs text-slate-300 bg-slate-950 leading-relaxed selection:bg-emerald-500/30">
          {loading ? (
            <div className="py-20 text-center text-slate-500">Gerando script do Selenium...</div>
          ) : (
            <pre className="whitespace-pre">{scriptCode}</pre>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>
            Utiliza ChromeDriver automático sem necessidade de baixar executáveis manuais.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
