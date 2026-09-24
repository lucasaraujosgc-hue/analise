import React from 'react';
import { ShieldCheck, HardDrive, Printer, Building2, Terminal, Database, ArrowLeft, FolderOpen } from 'lucide-react';
import { VirgulaLogo } from './VirgulaLogo';

interface NavbarProps {
  onOpenSelenium: () => void;
  onOpenPrint: () => void;
  onOpenStorage: () => void;
  onOpenApiInfo: () => void;
  onBackToPortfolio?: () => void;
  hasEmpresa: boolean;
  selectedCompanyName?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  onOpenSelenium, 
  onOpenPrint, 
  onOpenStorage,
  onOpenApiInfo,
  onBackToPortfolio,
  hasEmpresa,
  selectedCompanyName
}) => {
  return (
    <header className="bg-slate-950 border-b border-slate-800/90 text-white sticky top-0 z-40 shadow-xl backdrop-blur-md bg-opacity-95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Identity */}
        <div className="flex items-center space-x-3">
          {hasEmpresa && onBackToPortfolio && (
            <button
              onClick={onBackToPortfolio}
              className="mr-2 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-white border border-slate-700 transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
              title="Voltar para a Carteira Multi-CNPJ"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden md:inline">Carteira</span>
            </button>
          )}

          <div className="flex items-center gap-3">
            <VirgulaLogo size="md" theme="dark" />
            <div className="hidden sm:block h-7 w-px bg-slate-800" />
            <div className="hidden sm:block">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Inteligência Fiscal & Multi-CNPJ
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate max-w-xs sm:max-w-md mt-0.5">
                {selectedCompanyName ? (
                  <>Empresa em análise: <span className="text-emerald-300 font-semibold">{selectedCompanyName}</span></>
                ) : (
                  'Auditoria de CNPJs, CNDs, PGMEI & Docker Volume'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Botão para abrir o Storage Docker */}
          <button
            onClick={onOpenStorage}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-800/60 transition"
            title="Ver arquivos e PDFs salvos no volume Docker (/app/storage)"
          >
            <FolderOpen className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">PDFs Docker</span>
          </button>

          {/* Botão de Informações da API */}
          <button
            onClick={onOpenApiInfo}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
            title="Informações das APIs da Receita Federal e dados de contato"
          >
            <Database className="w-4 h-4 text-emerald-400" />
            <span className="hidden md:inline">APIs Receita</span>
          </button>

          {/* Script Selenium */}
          <button
            onClick={onOpenSelenium}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
            title="Ver e exportar script do Selenium em Python"
          >
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Selenium</span>
          </button>

          {/* Imprimir Dossiê */}
          {hasEmpresa && (
            <button
              onClick={onOpenPrint}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 transition"
              title="Gerar Dossiê / Relatório para Impressão ou PDF"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir Dossiê</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
