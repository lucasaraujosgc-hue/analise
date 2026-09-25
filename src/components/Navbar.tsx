import React from 'react';
import { Printer, Terminal, Database, ArrowLeft, FolderOpen, Bot } from 'lucide-react';
import { VirgulaLogo } from './VirgulaLogo';

interface NavbarProps {
  onOpenSelenium: () => void;
  onOpenPrint: () => void;
  onOpenStorage: () => void;
  onOpenApiInfo: () => void;
  onOpenRpa: () => void;
  onBackToPortfolio?: () => void;
  hasEmpresa: boolean;
  selectedCompanyName?: string;
}

const botaoSecundario =
  'flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-white hover:bg-muted text-foreground border border-border transition cursor-pointer';

export const Navbar: React.FC<NavbarProps> = ({
  onOpenSelenium,
  onOpenPrint,
  onOpenStorage,
  onOpenApiInfo,
  onOpenRpa,
  onBackToPortfolio,
  hasEmpresa,
  selectedCompanyName,
}) => {
  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-border sticky top-0 z-40 print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[72px] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {hasEmpresa && onBackToPortfolio && (
            <button
              onClick={onBackToPortfolio}
              className="p-2 rounded-xl text-primary hover:bg-primary-50 border border-border transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
              title="Voltar para a carteira"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden md:inline">Carteira</span>
            </button>
          )}

          <VirgulaLogo size="md" href="/" />

          <div className="hidden md:block h-9 w-px bg-border" />
          <div className="hidden md:block min-w-0">
            <p className="text-xs font-semibold text-primary">Inteligência fiscal multi-CNPJ</p>
            <p className="text-[11px] text-muted-foreground truncate max-w-xs lg:max-w-md">
              {selectedCompanyName ? (
                <>
                  Em análise: <span className="text-foreground font-medium">{selectedCompanyName}</span>
                </>
              ) : (
                'Cadastro, CNDs, PGMEI e DASN-SIMEI da sua carteira'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={onOpenStorage} className={botaoSecundario} title="Arquivos salvos (CNDs, extratos e dossiês)">
            <FolderOpen className="w-4 h-4 text-primary" />
            <span className="hidden sm:inline">Arquivos</span>
          </button>
          <button onClick={onOpenRpa} className={botaoSecundario} title="Gravar e executar robôs (RPA)">
            <Bot className="w-4 h-4 text-primary" />
            <span className="hidden sm:inline">Robôs</span>
          </button>
          <button onClick={onOpenApiInfo} className={botaoSecundario} title="De onde vêm os dados">
            <Database className="w-4 h-4 text-primary" />
            <span className="hidden lg:inline">Fontes de dados</span>
          </button>
          <button onClick={onOpenSelenium} className={botaoSecundario} title="Script de emissão assistida da CND federal">
            <Terminal className="w-4 h-4 text-primary" />
            <span className="hidden lg:inline">Script CND</span>
          </button>
          {hasEmpresa && (
            <button
              onClick={onOpenPrint}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-primary hover:bg-primary-800 text-primary-foreground shadow-sm transition cursor-pointer"
              title="Gerar dossiê para impressão ou PDF"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Dossiê</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
