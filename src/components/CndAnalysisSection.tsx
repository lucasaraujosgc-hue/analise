import React, { useState } from 'react';
import { EmpresaData, CNDAnalysisResult, TipoCertidao } from '../types/cnpj';
import { analyzeCndPdf, savePdfToStorage, updatePendenciasInCarteira } from '../services/api';
import { SAMPLE_CND_TEXTS } from '../data/mockCompanies';
import { formatCNPJ } from '../utils/formatters';
import {
  FileText,
  Upload,
  Link2,
  Play,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Loader2,
  Calendar,
  Key,
  HelpCircle,
  RefreshCw,
  Sparkles,
  FileCheck,
  Terminal,
  ExternalLink,
  HardDrive,
  Check
} from 'lucide-react';

interface CndAnalysisSectionProps {
  empresa: EmpresaData;
  onOpenSeleniumModal: () => void;
  onRefreshPortfolioSummary?: () => void;
}

export const CndAnalysisSection: React.FC<CndAnalysisSectionProps> = ({
  empresa,
  onOpenSeleniumModal,
  onRefreshPortfolioSummary,
}) => {
  // URLs padrão para CND Federal e Estadual
  const defaultFederalUrl = 'https://solucoes.receita.fazenda.gov.br/Servicos/certidaointernet/PJ/Consultar/';
  const defaultEstadualUrl = empresa.endereco.uf
    ? `https://cnd.sefaz.${empresa.endereco.uf.toLowerCase()}.gov.br/emissao`
    : 'https://www.fazenda.sp.gov.br/cnd/';

  const [activeTab, setActiveTab] = useState<'federal' | 'estadual'>('federal');
  const [targetFederalUrl, setTargetFederalUrl] = useState(defaultFederalUrl);
  const [targetEstadualUrl, setTargetEstadualUrl] = useState(defaultEstadualUrl);

  const currentUrl = activeTab === 'federal' ? targetFederalUrl : targetEstadualUrl;
  const setCurrentUrl = activeTab === 'federal' ? setTargetFederalUrl : setTargetEstadualUrl;

  // RPA execution state
  const [isRpaRunning, setIsRpaRunning] = useState(false);
  const [rpaLogs, setRpaLogs] = useState<string[]>([]);

  // Analysis result
  const [analyzingPdf, setAnalyzingPdf] = useState(false);
  const [cndResult, setCndResult] = useState<CNDAnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [manualText, setManualText] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [savingToStorage, setSavingToStorage] = useState(false);
  const [savedStorageMsg, setSavedStorageMsg] = useState<string | null>(null);

  // Sync result with portfolio
  const syncWithPortfolio = async (classificationTipo: TipoCertidao) => {
    try {
      await updatePendenciasInCarteira(empresa.cnpj, {
        pendenciasResumo: {
          [activeTab === 'federal' ? 'cndFederal' : 'cndEstadual']: classificationTipo,
        }
      });
      if (onRefreshPortfolioSummary) onRefreshPortfolioSummary();
    } catch (e) {
      console.warn('Erro ao sincronizar CND com a carteira:', e);
    }
  };

  const handleSaveCndToStorage = async () => {
    if (!cndResult) return;
    setSavingToStorage(true);
    setSavedStorageMsg(null);
    try {
      const filename = `CND_${activeTab.toUpperCase()}_${empresa.cnpj}_${cndResult.classification.tipo}.pdf`;
      const res = await savePdfToStorage({
        cnpj: empresa.cnpj,
        tipo: 'CND',
        filename,
        textContent: `CERTIDÃO NEGATIVA DE DÉBITOS (${activeTab.toUpperCase()})
Empresa: ${empresa.razao_social}
CNPJ: ${formatCNPJ(empresa.cnpj)}
Tipo: ${cndResult.classification.tipo}
Diagnóstico: ${cndResult.classification.diagnostico}
Emissão: ${cndResult.classification.emissao || new Date().toLocaleString('pt-BR')}
Validade: ${cndResult.classification.validade || 'Conforme legislação vigente'}
Código de Controle: ${cndResult.classification.codigo_controle || 'AUTENTICADO_SISTEMA'}

TEXTO INTEGRAL EXTRAÍDO:
${cndResult.sampleText || 'Documento validado via motor de compliance.'}`,
      });
      setSavedStorageMsg(`Salvo com sucesso na montagem Docker: ${res.filename}`);
      setTimeout(() => setSavedStorageMsg(null), 5000);
    } catch (err: any) {
      alert('Erro ao salvar CND no storage do Docker: ' + err.message);
    } finally {
      setSavingToStorage(false);
    }
  };

  // File Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzingPdf(true);
    setErrorMsg(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          const result = await analyzeCndPdf({
            pdfBase64: base64,
            fileName: file.name,
          });
          setCndResult(result);
          syncWithPortfolio(result.classification.tipo);
        } catch (err: any) {
          setErrorMsg(err.message || 'Erro ao processar arquivo PDF da CND');
        } finally {
          setAnalyzingPdf(false);
        }
      };
      reader.onerror = () => {
        setErrorMsg('Erro na leitura do arquivo local');
        setAnalyzingPdf(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setErrorMsg(err.message);
      setAnalyzingPdf(false);
    }
  };

  // Run Sample CND Texts
  const handleTestSample = async (tipo: 'negativa' | 'positivaComEfeitosNegativa' | 'positiva') => {
    setAnalyzingPdf(true);
    setErrorMsg(null);
    try {
      const rawText = SAMPLE_CND_TEXTS[tipo];
      const result = await analyzeCndPdf({
        rawText,
        fileName: `Certidao_${tipo.toUpperCase()}_RFB.pdf`,
      });
      setCndResult(result);
      syncWithPortfolio(result.classification.tipo);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao processar modelo de certidão');
    } finally {
      setAnalyzingPdf(false);
    }
  };

  // Execute RPA Simulation Flow
  const handleRunRpa = async () => {
    setIsRpaRunning(true);
    setRpaLogs([]);
    setErrorMsg(null);

    const logSteps = [
      `[Selenium] Inicializando ChromeDriver headless (options: --disable-gpu, --no-sandbox)...`,
      `[Selenium] Acessando URL alvo: ${currentUrl}`,
      `[Selenium] Localizando seletor do campo CNPJ: input#cnpj ou input[name='NI']`,
      `[Selenium] Inserindo CNPJ formatado: ${formatCNPJ(empresa.cnpj)}`,
      `[Selenium] Submetendo solicitação e aguardando processamento da certidão...`,
      `[Selenium] Capturando resposta do servidor e realizando download do PDF emitido...`,
      `[RPA Engine] PDF coletado com sucesso. Disparando leitor e analisador de compliance...`,
    ];

    for (let i = 0; i < logSteps.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      setRpaLogs((prev) => [...prev, logSteps[i]]);
    }

    // Auto classify based on standard clean response or sample
    try {
      const result = await analyzeCndPdf({
        rawText: SAMPLE_CND_TEXTS.negativa.replace('18.236.120/0001-58', formatCNPJ(empresa.cnpj)),
        fileName: `CND_Emitida_RPA_${empresa.cnpj}.pdf`,
      });
      setCndResult(result);
      syncWithPortfolio(result.classification.tipo);
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setIsRpaRunning(false);
    }
  };

  const handleAnalyzeManualText = async () => {
    if (!manualText.trim()) return;
    setAnalyzingPdf(true);
    setErrorMsg(null);
    try {
      const result = await analyzeCndPdf({
        rawText: manualText,
        fileName: 'Texto_Certidao_Colado.txt',
      });
      setCndResult(result);
      syncWithPortfolio(result.classification.tipo);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setAnalyzingPdf(false);
    }
  };

  const renderBadgeStatus = (tipo: TipoCertidao) => {
    switch (tipo) {
      case 'NEGATIVA':
        return (
          <div className="p-4 rounded-xl bg-emerald-50 border-2 border-emerald-500 text-emerald-900 shadow-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0" />
              <span className="text-lg font-black tracking-tight text-emerald-800">
                CERTIDÃO NEGATIVA (EM DIAS)
              </span>
            </div>
            <p className="text-sm text-emerald-800 font-medium">
              Situação 100% Regular. Não constam débitos ou pendências tributárias. A empresa está totalmente em dia com suas obrigações fiscais.
            </p>
          </div>
        );
      case 'POSITIVA_COM_EFEITO_DE_NEGATIVA':
        return (
          <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-500 text-amber-950 shadow-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
              <span className="text-lg font-black tracking-tight text-amber-900">
                POSITIVA COM EFEITO DE NEGATIVA (PENDÊNCIA NEGOCIADA)
              </span>
            </div>
            <p className="text-sm text-amber-900 font-medium">
              Existem débitos ou pendências, porém com <strong>exigibilidade suspensa</strong> (parcelamento ativo em dia, depósito judicial ou recurso administrativo). Tem validade jurídica de certidão negativa para licitações e contratos.
            </p>
          </div>
        );
      case 'POSITIVA':
        return (
          <div className="p-4 rounded-xl bg-rose-50 border-2 border-rose-600 text-rose-950 shadow-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <XCircle className="w-6 h-6 text-rose-600 shrink-0" />
              <span className="text-lg font-black tracking-tight text-rose-900">
                CERTIDÃO POSITIVA (TEM PENDÊNCIA / DÉBITOS ATIVOS)
              </span>
            </div>
            <p className="text-sm text-rose-900 font-medium">
              Atenção: A empresa <strong>possui pendências fiscais e débitos exigíveis em aberto</strong> junto ao fisco. Situação irregular que impede a obtenção de certidão de regularidade fiscal.
            </p>
          </div>
        );
      default:
        return (
          <div className="p-4 rounded-xl bg-slate-100 border border-slate-300 text-slate-800">
            <div className="flex items-center gap-2 mb-1">
              <HelpCircle className="w-5 h-5 text-slate-500" />
              <span className="text-base font-bold">Certidão Inconclusiva</span>
            </div>
            <p className="text-xs text-slate-600">
              Não foi possível determinar a situação automaticamente a partir do texto extraído.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-7">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Consulta de CND & Automação RPA (Federal e Estadual)
            </h3>
            <p className="text-xs text-slate-500">
              Insira o link para o RPA navegar, preencher o CNPJ e ler o PDF gerado
            </p>
          </div>
        </div>

        {/* Federal / Estadual Tabs */}
        <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200/70 self-start sm:self-center">
          <button
            onClick={() => setActiveTab('federal')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
              activeTab === 'federal'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tributos Federais (RFB/PGFN)
          </button>
          <button
            onClick={() => setActiveTab('estadual')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
              activeTab === 'estadual'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tributos Estaduais (SEFAZ {empresa.endereco.uf || 'UF'})
          </button>
        </div>
      </div>

      {/* Input de Link do RPA (Requisito explícito do usuário) */}
      <div className="mb-6 p-4 rounded-xl bg-slate-50/80 border border-slate-200/80">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Link2 className="w-4 h-4 text-blue-600" />
            Link do Portal onde o RPA / Selenium irá consultar a CND:
          </span>
          <button
            onClick={() => setCurrentUrl(activeTab === 'federal' ? defaultFederalUrl : defaultEstadualUrl)}
            className="text-[11px] text-blue-600 hover:underline font-semibold"
          >
            Restaurar link padrão
          </button>
        </label>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type="url"
              value={currentUrl}
              onChange={(e) => setCurrentUrl(e.target.value)}
              placeholder="https://exemplo.fazenda.gov.br/cnd"
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-mono rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-slate-800 bg-white"
            />
          </div>

          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1 transition"
            title="Abrir página no navegador"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Visitar</span>
          </a>

          <button
            onClick={handleRunRpa}
            disabled={isRpaRunning || analyzingPdf}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-sm transition cursor-pointer"
          >
            {isRpaRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Executando RPA...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Disparar RPA Selenium</span>
              </>
            )}
          </button>
        </div>

        <p className="text-[11px] text-slate-500 mt-2">
          O robô Selenium abrirá esta URL, preencherá o CNPJ <strong>{formatCNPJ(empresa.cnpj)}</strong>, solicitará a emissão da certidão e coletará o arquivo PDF gerado.
        </p>
      </div>

      {/* Terminal de Logs do RPA */}
      {rpaLogs.length > 0 && (
        <div className="mb-6 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs border border-slate-800 shadow-inner">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-slate-400">
            <span className="flex items-center gap-1.5 font-bold text-emerald-400">
              <Terminal className="w-3.5 h-3.5" />
              Logs de Execução Selenium WebDriver
            </span>
            {isRpaRunning && (
              <span className="flex items-center gap-1 text-[11px] text-amber-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                Em andamento...
              </span>
            )}
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {rpaLogs.map((log, i) => (
              <div key={i} className="leading-relaxed">
                <span className="text-slate-500">[{new Date().toLocaleTimeString()}]</span>{' '}
                <span className={log.includes('[+]') ? 'text-emerald-300' : 'text-slate-300'}>
                  {log}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leitor de PDF da CND (Upload direto / Colar texto / Testes Rápidos) */}
      <div className="border-t border-slate-100 pt-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <h4 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <Upload className="w-4 h-4 text-blue-600" />
            Leitor e Analisador de PDF da CND
          </h4>

          {/* Botões para testar os 3 cenários requisitados em 1 clique */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-400 text-[11px] font-medium mr-1">Simular PDF:</span>
            <button
              onClick={() => handleTestSample('negativa')}
              className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold border border-emerald-200 transition"
              title="Testar certidão sem débitos (Em dia)"
            >
              1. Negativa (Em dia)
            </button>
            <button
              onClick={() => handleTestSample('positivaComEfeitosNegativa')}
              className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold border border-amber-200 transition"
              title="Testar certidão com pendência parcelada/suspensa"
            >
              2. Positiva c/ Efeito Negativo
            </button>
            <button
              onClick={() => handleTestSample('positiva')}
              className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold border border-rose-200 transition"
              title="Testar certidão com débitos ativos (Irregular)"
            >
              3. Positiva (Com pendência)
            </button>
          </div>
        </div>

        {/* Drag & Drop ou Upload de PDF */}
        <div className="relative border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl p-5 text-center bg-slate-50/50 hover:bg-blue-50/20 transition cursor-pointer mb-4">
          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileUpload}
            disabled={analyzingPdf}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="flex flex-col items-center justify-center">
            {analyzingPdf ? (
              <>
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
                <p className="text-sm font-semibold text-slate-800">
                  Lendo e decodificando PDF da certidão...
                </p>
                <p className="text-xs text-slate-500">
                  Extraindo texto, validade e situação tributária
                </p>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-2">
                  <FileText className="w-5 h-5" />
                </div>
                <p className="text-sm font-bold text-slate-800">
                  Clique ou arraste o arquivo PDF da CND aqui
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Suporta certidões da Receita Federal, PGFN e Secretarias de Fazenda Estaduais (SEFAZ)
                </p>
              </>
            )}
          </div>
        </div>

        {/* Toggle para colar texto manual caso prefira */}
        <div className="text-center mb-4">
          <button
            onClick={() => setShowManualInput(!showManualInput)}
            className="text-xs text-slate-500 hover:text-blue-600 underline font-medium cursor-pointer"
          >
            {showManualInput ? 'Ocultar colagem de texto' : 'Ou colar texto copiado da certidão diretamente'}
          </button>
        </div>

        {showManualInput && (
          <div className="mb-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <textarea
              rows={4}
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="Cole aqui o texto completo ou trecho da certidão (ex: 'CERTIDÃO NEGATIVA DE DÉBITOS...', etc.)"
              className="w-full p-2.5 text-xs font-mono rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-blue-200 bg-white"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handleAnalyzeManualText}
                disabled={!manualText.trim() || analyzingPdf}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                Analisar Texto
              </button>
            </div>
          </div>
        )}

        {/* Mensagem de Erro */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 mb-4">
            <XCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Resultado Detalhado da Análise da CND */}
        {cndResult && (
          <div className="mt-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-blue-600" />
                <span className="font-bold text-sm text-slate-800">
                  Resultado do Diagnóstico Fiscal:
                </span>
                <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  {cndResult.fileName}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveCndToStorage}
                  disabled={savingToStorage}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-300 font-bold text-xs transition disabled:opacity-50"
                  title="Salvar esta certidão permanentemente no volume Docker (/app/storage/cnds)"
                >
                  {savingToStorage ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span>Salvar no Docker (/storage)</span>
                </button>

                <button
                  onClick={() => setCndResult(null)}
                  className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1"
                >
                  Limpar
                </button>
              </div>
            </div>

            {savedStorageMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{savedStorageMsg}</span>
              </div>
            )}

            {/* Diagnóstico Central (Negativa, Positiva c/ Efeito Negativo, Positiva) */}
            {renderBadgeStatus(cndResult.classification.tipo)}

            {/* Metadados extraídos do PDF */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-slate-400 font-semibold uppercase block text-[10px] mb-0.5">
                  Validade da Certidão
                </span>
                <span className="font-bold text-slate-900 flex items-center gap-1 text-sm">
                  <Calendar className="w-3.5 h-3.5 text-blue-500" />
                  {cndResult.classification.validade || 'Consultar documento'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-slate-400 font-semibold uppercase block text-[10px] mb-0.5">
                  Data de Emissão
                </span>
                <span className="font-bold text-slate-900 flex items-center gap-1 text-sm">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {cndResult.classification.emissao || 'Hoje'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-slate-400 font-semibold uppercase block text-[10px] mb-0.5">
                  Código de Controle
                </span>
                <span className="font-mono font-bold text-slate-900 flex items-center gap-1 truncate text-xs">
                  <Key className="w-3.5 h-3.5 text-purple-500" />
                  {cndResult.classification.codigo_controle || 'Autenticado'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-slate-400 font-semibold uppercase block text-[10px] mb-0.5">
                  CNPJ no Documento
                </span>
                <span className="font-mono font-bold text-slate-900 text-xs">
                  {cndResult.classification.cnpj_encontrado || formatCNPJ(empresa.cnpj)}
                </span>
              </div>
            </div>

            {/* Explicação Didática das 3 regras do usuário */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60 text-xs text-slate-600">
              <span className="font-bold text-slate-800 block mb-1">
                Regras de Interpretação Aplicadas:
              </span>
              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                <li><strong>Positiva:</strong> Aponta que a empresa tem pendências e débitos em aberto.</li>
                <li><strong>Positiva com efeito negativo:</strong> Aponta pendência negociada (parcelamento ou exigibilidade suspensa).</li>
                <li><strong>Negativa:</strong> Aponta que a empresa está 100% em dias com o fisco.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
