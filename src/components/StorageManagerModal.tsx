import React, { useState, useEffect } from 'react';
import { X, HardDrive, Download, FileText, Folder, RefreshCw, AlertCircle } from 'lucide-react';
import { fetchStorageFiles } from '../services/api';
import { StorageFile } from '../types/cnpj';

interface StorageManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const StorageManagerModal: React.FC<StorageManagerModalProps> = ({ isOpen, onClose }) => {
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      setFiles((await fetchStorageFiles()).files || []);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar arquivos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) loadFiles();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary-950/60 backdrop-blur-sm">
      <div className="bg-white border border-border rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-xl overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary-50 text-primary">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-foreground">Arquivos salvos</h3>
              <p className="text-xs text-muted-foreground">
                Pasta <code className="text-primary font-mono">./storage</code> (volume <code className="text-primary font-mono">/app/storage</code> no Docker)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadFiles}
              disabled={loading}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition cursor-pointer"
              title="Atualizar lista"
              aria-label="Atualizar lista"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-primary' : ''}`} />
            </button>
            <button onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer" aria-label="Fechar">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 bg-muted/70 border-b border-border text-xs text-muted-foreground flex items-start gap-3">
          <Folder className="w-5 h-5 text-primary shrink-0" />
          <p>
            Com <code className="text-primary">docker compose up</code>, tudo o que é salvo aqui aparece na pasta <code className="text-primary">./storage/</code> do projeto:
            CNDs em <code>cnds/</code>, relatórios do MEI em <code>guias_mei/</code> e dossiês em <code>relatorios/</code>.
          </p>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {files.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <FileText className="w-10 h-10 text-primary-300 mx-auto" />
              <h4 className="font-semibold text-foreground text-sm">Nenhum arquivo salvo ainda</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Os PDFs de CND enviados, os relatórios do MEI e os dossiês salvos aparecem aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map(file => (
                <div
                  key={`${file.subfolder}/${file.filename}`}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-muted/60 hover:bg-muted transition gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-white text-primary shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-foreground truncate max-w-md" title={file.filename}>
                        {file.filename}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                        <span className="px-1.5 rounded bg-primary-50 text-primary text-[10px]">{file.categoria}</span>
                        <span>{formatFileSize(file.size)}</span>
                        <span>·</span>
                        <span>{new Date(file.updatedAt).toLocaleString('pt-BR')}</span>
                      </div>
                    </div>
                  </div>
                  <a
                    href={file.downloadUrl}
                    download={file.filename}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-800 text-primary-foreground font-medium text-xs transition shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Baixar
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Total: <strong className="text-foreground">{files.length}</strong> arquivo(s)
          </span>
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-white hover:bg-muted text-foreground border border-border font-medium transition cursor-pointer">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
