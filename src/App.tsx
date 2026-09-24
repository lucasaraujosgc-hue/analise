import React, { useState, useEffect } from 'react';
import { EmpresaData } from './types/cnpj';
import { 
  fetchCnpjData, 
  fetchCarteira, 
  saveCompanyToCarteira, 
  deleteCompanyFromCarteira,
  updatePendenciasInCarteira 
} from './services/api';
import { Navbar } from './components/Navbar';
import { PortfolioManager } from './components/PortfolioManager';
import { CompanyOverview } from './components/CompanyOverview';
import { CnaeSection } from './components/CnaeSection';
import { AddressAndContact } from './components/AddressAndContact';
import { QsaSection } from './components/QsaSection';
import { CndAnalysisSection } from './components/CndAnalysisSection';
import { MeiSection } from './components/MeiSection';
import { SeleniumModal } from './components/SeleniumModal';
import { DossierModal } from './components/DossierModal';
import { StorageManagerModal } from './components/StorageManagerModal';
import { ApiInfoModal } from './components/ApiInfoModal';
import { VirgulaLogo } from './components/VirgulaLogo';
import { ArrowLeft, Building2, ShieldCheck, Printer, RefreshCw, Sparkles, Trash2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { formatCNPJ } from './utils/formatters';

export default function App() {
  const [carteira, setCarteira] = useState<EmpresaData[]>([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState<EmpresaData | null>(null);
  const [isMei, setIsMei] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Modals
  const [isSeleniumModalOpen, setIsSeleniumModalOpen] = useState(false);
  const [isDossierModalOpen, setIsDossierModalOpen] = useState(false);
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
  const [isApiInfoModalOpen, setIsApiInfoModalOpen] = useState(false);

  // Load Carteira Multi-CNPJ on startup
  const loadPortfolio = async () => {
    try {
      const data = await fetchCarteira();
      setCarteira(data);
    } catch (err) {
      console.warn('Erro ao carregar carteira inicial:', err);
    }
  };

  useEffect(() => {
    loadPortfolio();
  }, []);

  // Update selected company when it is selected
  const handleSelectEmpresa = (emp: EmpresaData) => {
    setSelectedEmpresa(emp);
    setIsMei(Boolean(emp.opcao_pelo_mei));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Direct print from portfolio button
  const handlePrintReport = (emp: EmpresaData) => {
    setSelectedEmpresa(emp);
    setIsMei(Boolean(emp.opcao_pelo_mei));
    setIsDossierModalOpen(true);
  };

  // Add new CNPJ to portfolio
  const handleAddCnpjToCarteira = async (cnpj: string, meiOverride?: boolean) => {
    const clean = cnpj.replace(/\D/g, '');
    if (clean.length !== 14) {
      setToast({ type: 'error', message: 'CNPJ inválido. Digite os 14 dígitos numéricos.' });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchCnpjData(clean);
      if (typeof meiOverride === 'boolean') {
        data.opcao_pelo_mei = meiOverride;
      }

      // Salva na carteira (banco local e persistência)
      const updatedList = await saveCompanyToCarteira(data);
      setCarteira(updatedList);
      
      // Abre a empresa recém adicionada para inspeção imediata
      setSelectedEmpresa(data);
      setIsMei(Boolean(data.opcao_pelo_mei));
      setToast({ type: 'success', message: `${data.razao_social} cadastrada na sua carteira!` });
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Erro ao consultar CNPJ na base da Receita Federal.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh company data from RFB
  const handleRefreshEmpresa = async (cnpj: string) => {
    const clean = cnpj.replace(/\D/g, '');
    try {
      const freshData = await fetchCnpjData(clean);
      const updatedList = await saveCompanyToCarteira(freshData);
      setCarteira(updatedList);

      if (selectedEmpresa && selectedEmpresa.cnpj.replace(/\D/g, '') === clean) {
        setSelectedEmpresa(freshData);
        setIsMei(Boolean(freshData.opcao_pelo_mei));
      }
      setToast({ type: 'success', message: `Dados de ${freshData.razao_social} atualizados com sucesso!` });
    } catch (err: any) {
      setToast({ type: 'error', message: `Erro ao atualizar dados: ${err.message}` });
    }
  };

  // Remove company from portfolio
  const handleRemoveEmpresa = async (cnpj: string) => {
    const clean = cnpj.replace(/\D/g, '');
    
    // Atualização otimista imediata na interface
    setCarteira(prev => prev.filter(e => e.cnpj.replace(/\D/g, '') !== clean));
    if (selectedEmpresa && selectedEmpresa.cnpj.replace(/\D/g, '') === clean) {
      setSelectedEmpresa(null);
    }

    try {
      const updated = await deleteCompanyFromCarteira(clean);
      setCarteira(updated);
      setToast({ type: 'success', message: 'Empresa removida com sucesso da sua carteira!' });
    } catch (err: any) {
      console.error('Erro ao remover empresa:', err);
      await loadPortfolio();
      setToast({ type: 'error', message: 'Erro ao remover empresa: ' + (err.message || 'Erro inesperado') });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        onOpenSelenium={() => setIsSeleniumModalOpen(true)}
        onOpenPrint={() => setIsDossierModalOpen(true)}
        onOpenStorage={() => setIsStorageModalOpen(true)}
        onOpenApiInfo={() => setIsApiInfoModalOpen(true)}
        onBackToPortfolio={selectedEmpresa ? () => setSelectedEmpresa(null) : undefined}
        hasEmpresa={Boolean(selectedEmpresa)}
        selectedCompanyName={selectedEmpresa?.razao_social}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Quando nenhuma empresa está em detalhamento, exibe o Painel Multi-CNPJ */}
        {!selectedEmpresa ? (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Boas-vindas & Banner de Identidade Visual Vírgula, Contábil */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
              <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/10 via-teal-500/5 to-transparent pointer-events-none" />
              
              <div className="max-w-2xl space-y-3 relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Vírgula, Contábil • Auditoria & Inteligência Fiscal</span>
                </div>
                
                <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                  Painel Central <span className="text-emerald-400">Multi-CNPJ</span>
                </h1>
                
                <p className="text-sm text-slate-300 leading-relaxed">
                  Gerencie a regularidade fiscal da sua carteira de clientes: consulta de dados cadastrais, atividades econômicas (CNAEs), QSA, certidões CNDs (Federal e Estadual), débitos do MEI com automação Selenium e geração de dossiês com exportação em PDF e armazenamento Docker.
                </p>
              </div>
            </div>

            {/* Gerenciador de Carteira Multi-CNPJ */}
            <PortfolioManager
              carteira={carteira}
              onSelectEmpresa={handleSelectEmpresa}
              onPrintReport={handlePrintReport}
              onRefreshEmpresa={handleRefreshEmpresa}
              onRemoveEmpresa={handleRemoveEmpresa}
              onAddCnpj={handleAddCnpjToCarteira}
              isLoading={isLoading}
            />
          </div>
        ) : (
          /* Quando uma empresa específica é selecionada: Apresentação Detalhada de Compliance */
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Barra de Retorno e Ações Rápidas */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-md">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedEmpresa(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700"
                >
                  <ArrowLeft className="w-4 h-4 text-emerald-400" />
                  <span>Voltar para Carteira</span>
                </button>
                <div className="hidden sm:block h-5 w-px bg-slate-800" />
                <span className="text-xs text-slate-400 truncate max-w-sm">
                  Exibindo dossiê completo de: <strong className="text-white">{selectedEmpresa.razao_social}</strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRefreshEmpresa(selectedEmpresa.cnpj)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
                  title="Atualizar dados da empresa na Receita Federal"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Atualizar Dados</span>
                </button>

                <button
                  onClick={() => setIsDossierModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-900/30 transition cursor-pointer"
                  title="Abrir Dossiê Executivo para Impressão, Download em PDF ou Salvar no Docker"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Dossiê & PDF</span>
                </button>

                <button
                  onClick={() => {
                    if (selectedEmpresa) {
                      handleRemoveEmpresa(selectedEmpresa.cnpj);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 text-xs font-medium border border-slate-700 transition"
                  title="Remover esta empresa da carteira"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Excluir</span>
                </button>
              </div>
            </div>

            {/* 1. Visão Geral da Empresa */}
            <CompanyOverview empresa={selectedEmpresa} />

            {/* 2. CNDs e RPA com Leitor de PDF (Federal e Estadual) */}
            <CndAnalysisSection
              empresa={selectedEmpresa}
              onOpenSeleniumModal={() => setIsSeleniumModalOpen(true)}
              onRefreshPortfolioSummary={loadPortfolio}
            />

            {/* 3. Módulo MEI & PGMEI (com as guias em atraso e valor total) */}
            <MeiSection
              empresa={selectedEmpresa}
              isMei={isMei}
              setIsMei={setIsMei}
              onRefreshPortfolioSummary={loadPortfolio}
            />

            {/* 4. CNAEs (Principal + Secundários detalhados) */}
            <CnaeSection
              cnaePrincipal={selectedEmpresa.cnae_fiscal}
              cnaesSecundarios={selectedEmpresa.cnaes_secundarios}
            />

            {/* 5. Endereço e Contatos Oficiais */}
            <AddressAndContact
              endereco={selectedEmpresa.endereco}
              telefone={selectedEmpresa.telefone}
              email={selectedEmpresa.email}
            />

            {/* 6. Quadro de Sócios e Administradores (QSA) */}
            <QsaSection
              qsa={selectedEmpresa.qsa}
              isMei={isMei || selectedEmpresa.opcao_pelo_mei}
            />
          </div>
        )}
      </main>

      {/* Footer Oficial Vírgula, Contábil */}
      <footer className="bg-slate-950 border-t border-slate-900 py-8 text-center text-xs text-slate-500 mt-12 print:hidden">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <VirgulaLogo size="sm" theme="dark" />
            <span className="text-slate-400 font-medium">
              Auditoria, Compliance Fiscal & Inteligência Multi-CNPJ
            </span>
          </div>
          <div className="flex items-center gap-3 text-slate-500 text-[11px]">
            <span>
              PDFs no Docker: <code className="text-emerald-400 font-mono">./storage</code> (/app/storage)
            </span>
            <span>•</span>
            <span>© {new Date().getFullYear()} Vírgula, Contábil</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <SeleniumModal
        isOpen={isSeleniumModalOpen}
        onClose={() => setIsSeleniumModalOpen(false)}
        cnpj={selectedEmpresa?.cnpj || ''}
        isMei={isMei}
      />

      {selectedEmpresa && (
        <DossierModal
          isOpen={isDossierModalOpen}
          onClose={() => setIsDossierModalOpen(false)}
          empresa={selectedEmpresa}
          isMei={isMei}
        />
      )}

      {/* Modal de Armazenamento Docker (/app/storage) */}
      <StorageManagerModal
        isOpen={isStorageModalOpen}
        onClose={() => setIsStorageModalOpen(false)}
      />

      {/* Modal Informativo das APIs da Receita Federal */}
      <ApiInfoModal
        isOpen={isApiInfoModalOpen}
        onClose={() => setIsApiInfoModalOpen(false)}
      />

      {/* Notificação Toast Flutuante */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 max-w-sm w-full animate-in slide-in-from-top-3 fade-in duration-200">
          <div className={`p-4 rounded-2xl border shadow-2xl flex items-start gap-3 backdrop-blur-md ${
            toast.type === 'success' 
              ? 'bg-slate-900/95 border-emerald-500/50 text-emerald-200 shadow-emerald-950/40' 
              : toast.type === 'error'
              ? 'bg-slate-900/95 border-rose-500/50 text-rose-200 shadow-rose-950/40'
              : 'bg-slate-900/95 border-slate-700 text-slate-200 shadow-black/60'
          }`}>
            <div className="mt-0.5 shrink-0">
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : toast.type === 'error' ? (
                <AlertCircle className="w-5 h-5 text-rose-400" />
              ) : (
                <Sparkles className="w-5 h-5 text-emerald-400" />
              )}
            </div>
            <div className="flex-1 text-xs leading-relaxed font-medium">
              {toast.message}
            </div>
            <button 
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
