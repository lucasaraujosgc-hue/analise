import React, { useState, useEffect } from 'react';
import { X, HardDrive, Download, FileText, Folder, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { fetchStorageFiles } from '../services/api';
import { StorageFile } from '../types/cnpj';

interface StorageManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StorageManagerModal: React.FC<StorageManagerModalProps> = ({ isOpen, onClose }) => {
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStorageFiles();
      setFiles(data.files || []);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar arquivos do storage');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadFiles();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Gerenciador de PDFs & Montagem Docker</h3>
              <p className="text-xs text-slate-400">Diretório: <code className="text-emerald-400 font-mono">/app/storage</code> montado em <code className="text-emerald-400 font-mono">./storage</code></p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadFiles}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Atualizar lista de arquivos"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-slate-950/60 p-4 border-b border-slate-800 text-xs text-slate-300 flex items-start gap-3">
          <Folder className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-white">Como acessar os arquivos na sua máquina física:</span>
            <p className="text-slate-400 text-[11px] mt-0.5">
              Ao rodar via Docker ou Docker Compose com o comando <code className="text-cyan-400 bg-slate-900 px-1 py-0.5 rounded">docker compose up</code>, todos os PDFs salvos aqui são gravados diretamente na pasta local <code className="text-emerald-400 bg-slate-900 px-1 py-0.5 rounded font-mono">./storage/</code> do seu projeto.
            </p>
          </div>
        </div>

        {/* Content Table */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 mb-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          {files.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <FileText className="w-12 h-12 text-slate-600 mx-auto" />
              <h4 className="font-bold text-slate-400 text-sm">Nenhum PDF salvo no volume ainda</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Ao consultar certidões CNDs, apurar débitos do MEI ou gerar relatórios executivos, clique em <strong>"Salvar PDF na Montagem"</strong> para armazená-los permanentemente.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((file, idx) => (
                <div
                  key={idx}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/70 hover:bg-slate-800 transition gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-slate-700/50 text-emerald-400 shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-white truncate max-w-md" title={file.filename}>
                        {file.filename}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span className="px-1.5 py-0.2 rounded bg-slate-900 text-cyan-300 text-[10px] font-mono">
                          {file.categoria}
                        </span>
                        <span>{formatFileSize(file.size)}</span>
                        <span>•</span>
                        <span>{new Date(file.updatedAt).toLocaleString('pt-BR')}</span>
                      </div>
                    </div>
                  </div>

                  <a
                    href={file.downloadUrl}
                    download={file.filename}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar PDF</span>
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-900 text-xs">
          <span className="text-slate-400">Total de arquivos: <strong className="text-white">{files.length}</strong></span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
