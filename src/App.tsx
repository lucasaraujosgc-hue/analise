import React, { useState, useEffect } from 'react';
import { EmpresaData } from './types/cnpj';
import { fetchCnpjData, fetchCarteira, saveCompanyToCarteira, deleteCompanyFromCarteira } from './services/api';
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
import { ArrowLeft, Printer, RefreshCw, Trash2, CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cleanCNPJ } from './utils/formatters';

type Toast = { type: 'success' | 'error' | 'info'; message: string };

export default function App() {
  const [carteira, setCarteira] = useState<EmpresaData[]>([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState<EmpresaData | null>(null);
  const [isMei, setIsMei] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const [isSeleniumModalOpen, setIsSeleniumModalOpen] = useState(false);
  const [isDossierModalOpen, setIsDossierModalOpen] = useState(false);
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
  const [isApiInfoModalOpen, setIsApiInfoModalOpen] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const loadPortfolio = async () => {
    setCarteira(await fetchCarteira());
  };

  useEffect(() => {
    loadPortfolio();
  }, []);

  // Mantém a empresa aberta em sincronia com a carteira (pendências, contatos editados etc.).
  useEffect(() => {
    if (!selectedEmpresa) return;
    const atual = carteira.find(e => cleanCNPJ(e.cnpj) === cleanCNPJ(selectedEmpresa.cnpj));
    if (atual && atual !== selectedEmpresa) setSelectedEmpresa(atual);
  }, [carteira]);

  const selecionar = (emp: EmpresaData) => {
    setSelectedEmpresa(emp);
    setIsMei(Boolean(emp.opcao_pelo_mei));
  };

  const handleSelectEmpresa = (emp: EmpresaData) => {
    selecionar(emp);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrintReport = (emp: EmpresaData) => {
    selecionar(emp);
    setIsDossierModalOpen(true);
  };

  const handleAddCnpjToCarteira = async (cnpj: string) => {
    const clean = cleanCNPJ(cnpj);
    if (clean.length !== 14) {
      setToast({ type: 'error', message: 'CNPJ inválido. Informe os 14 caracteres.' });
      return;
    }

    setIsLoading(true);
    try {
      const data = await fetchCnpjData(clean);
      const lista = await saveCompanyToCarteira(data);
      setCarteira(lista);
      const salvo = lista.find(e => cleanCNPJ(e.cnpj) === clean) || data;
      selecionar(salvo);
      const semContato = salvo.telefone === 'Não cadastrado' && salvo.email === 'Não cadastrado';
      setToast({
        type: semContato ? 'info' : 'success',
        message: semContato
          ? `${salvo.razao_social} cadastrada. As bases públicas não trouxeram telefone nem e-mail — você pode informá-los em "Contatos".`
          : `${salvo.razao_social} cadastrada na carteira.`,
      });
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Erro ao consultar o CNPJ.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshEmpresa = async (cnpj: string) => {
    try {
      const fresh = await fetchCnpjData(cnpj);
      setCarteira(await saveCompanyToCarteira(fresh));
      setToast({ type: 'success', message: `Dados de ${fresh.razao_social} atualizados.` });
    } catch (err: any) {
      setToast({ type: 'error', message: `Erro ao atualizar: ${err.message}` });
    }
  };

  const handleRemoveEmpresa = async (cnpj: string) => {
    const clean = cleanCNPJ(cnpj);
    setCarteira(prev => prev.filter(e => cleanCNPJ(e.cnpj) !== clean));
    if (selectedEmpresa && cleanCNPJ(selectedEmpresa.cnpj) === clean) setSelectedEmpresa(null);

    try {
      setCarteira(await deleteCompanyFromCarteira(clean));
      setToast({ type: 'success', message: 'Empresa removida da carteira.' });
    } catch (err: any) {
      await loadPortfolio();
      setToast({ type: 'error', message: 'Erro ao remover empresa: ' + (err.message || 'erro inesperado') });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <Navbar
        onOpenSelenium={() => setIsSeleniumModalOpen(true)}
        onOpenPrint={() => setIsDossierModalOpen(true)}
        onOpenStorage={() => setIsStorageModalOpen(true)}
        onOpenApiInfo={() => setIsApiInfoModalOpen(true)}
        onBackToPortfolio={selectedEmpresa ? () => setSelectedEmpresa(null) : undefined}
        hasEmpresa={Boolean(selectedEmpresa)}
        selectedCompanyName={selectedEmpresa?.razao_social}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {!selectedEmpresa ? (
          <div className="space-y-6">
            <section className="relative overflow-hidden rounded-3xl bg-primary text-primary-foreground p-6 sm:p-9">
              <div className="absolute -right-10 -bottom-24 font-serif font-bold text-[260px] leading-none text-accent/25 select-none pointer-events-none" aria-hidden>
                ,
              </div>
              <div className="relative max-w-2xl space-y-3">
                <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.25em] text-accent-200">
                  Auditoria & inteligência fiscal
                </span>
                <h1 className="text-3xl sm:text-4xl font-semibold leading-tight">
                  Painel da carteira <span className="text-accent-300">multi-CNPJ</span>
                </h1>
                <p className="text-sm text-primary-100 leading-relaxed">
                  Dados cadastrais, contatos, CNAEs e sócios, certidões negativas federal e estadual, e — para MEI — as guias DAS em aberto
                  com valor de cada competência e as declarações DASN-SIMEI em atraso.
                </p>
              </div>
            </section>

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
          <div className="space-y-6" key={selectedEmpresa.cnpj}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-border p-3.5 rounded-2xl">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setSelectedEmpresa(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-50 hover:bg-primary-100 text-primary text-xs font-semibold transition cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar para a carteira</span>
                </button>
                <span className="hidden sm:block text-xs text-muted-foreground truncate">
                  Dossiê de <strong className="text-foreground">{selectedEmpresa.razao_social}</strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRefreshEmpresa(selectedEmpresa.cnpj)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-muted text-foreground text-xs font-medium border border-border transition cursor-pointer"
                  title="Buscar novamente os dados nas bases da Receita"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-primary" />
                  <span>Atualizar dados</span>
                </button>
                <button
                  onClick={() => setIsDossierModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary-800 text-primary-foreground font-semibold text-xs transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Dossiê & PDF</span>
                </button>
                <button
                  onClick={() => handleRemoveEmpresa(selectedEmpresa.cnpj)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-muted-foreground hover:text-rose-700 text-xs font-medium border border-border transition cursor-pointer"
                  title="Remover esta empresa da carteira"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Excluir</span>
                </button>
              </div>
            </div>

            <CompanyOverview empresa={selectedEmpresa} />

            <MeiSection empresa={selectedEmpresa} isMei={isMei} setIsMei={setIsMei} onRefreshPortfolioSummary={loadPortfolio} />

            <CndAnalysisSection
              empresa={selectedEmpresa}
              onOpenSeleniumModal={() => setIsSeleniumModalOpen(true)}
              onRefreshPortfolioSummary={loadPortfolio}
            />

            <AddressAndContact
              empresa={selectedEmpresa}
              onContatoSalvo={lista => {
                setCarteira(lista);
                setToast({ type: 'success', message: 'Contato salvo. Ele será mantido nas próximas atualizações.' });
              }}
            />

            <CnaeSection cnaePrincipal={selectedEmpresa.cnae_fiscal} cnaesSecundarios={selectedEmpresa.cnaes_secundarios} />

            <QsaSection qsa={selectedEmpresa.qsa} isMei={isMei || selectedEmpresa.opcao_pelo_mei} />
          </div>
        )}
      </main>

      <footer className="border-t border-border bg-white py-8 mt-12 print:hidden">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <VirgulaLogo size="sm" />
            <span>Auditoria, compliance fiscal e inteligência multi-CNPJ</span>
          </div>
          <span>© {new Date().getFullYear()} Vírgula, Contábil</span>
        </div>
      </footer>

      <SeleniumModal
        isOpen={isSeleniumModalOpen}
        onClose={() => setIsSeleniumModalOpen(false)}
        cnpj={selectedEmpresa?.cnpj || ''}
      />

      {selectedEmpresa && (
        <DossierModal isOpen={isDossierModalOpen} onClose={() => setIsDossierModalOpen(false)} empresa={selectedEmpresa} isMei={isMei} />
      )}

      <StorageManagerModal isOpen={isStorageModalOpen} onClose={() => setIsStorageModalOpen(false)} />
      <ApiInfoModal isOpen={isApiInfoModalOpen} onClose={() => setIsApiInfoModalOpen(false)} />

      {toast && (
        <div className="fixed top-20 right-5 z-50 max-w-sm w-[calc(100%-2.5rem)]" role="status">
          <div
            className={`p-4 rounded-2xl border bg-white shadow-lg flex items-start gap-3 ${
              toast.type === 'success' ? 'border-primary-200' : toast.type === 'error' ? 'border-rose-300' : 'border-accent-300'
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-primary" />
              ) : toast.type === 'error' ? (
                <AlertCircle className="w-5 h-5 text-rose-600" />
              ) : (
                <Info className="w-5 h-5 text-accent-600" />
              )}
            </div>
            <div className="flex-1 text-xs leading-relaxed text-foreground">{toast.message}</div>
            <button onClick={() => setToast(null)} className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer" aria-label="Fechar">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
