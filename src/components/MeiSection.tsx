import React, { useState, useEffect } from 'react';
import { EmpresaData, PGMEIResult, GuiaAtrasoMEI } from '../types/cnpj';
import { consultPgmeiRpa, parsePgmeiExtract, savePdfToStorage, updatePendenciasInCarteira } from '../services/api';
import { formatCurrency, formatCNPJ } from '../utils/formatters';
import {
  AlertCircle,
  ExternalLink,
  Play,
  Loader2,
  DollarSign,
  Calendar,
  AlertTriangle,
  Receipt,
  Copy,
  Check,
  Building,
  CheckCircle2,
  Upload,
  Plus,
  Save,
  HardDrive,
  FileText,
  ShieldAlert,
  ChevronDown
} from 'lucide-react';

interface MeiSectionProps {
  empresa: EmpresaData;
  isMei: boolean;
  setIsMei: (val: boolean) => void;
  onRefreshPortfolioSummary?: () => void;
}

export const MeiSection: React.FC<MeiSectionProps> = ({ 
  empresa, 
  isMei, 
  setIsMei,
  onRefreshPortfolioSummary 
}) => {
  const PGMEI_URL =
    'https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/pgmei.app/Identificacao';

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PGMEIResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [savingStorage, setSavingStorage] = useState(false);
  const [storageSuccess, setStorageSuccess] = useState<string | null>(null);

  // Extrato import state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [pastedExtrato, setPastedExtrato] = useState('');
  const [parsingExtrato, setParsingExtrato] = useState(false);

  // Manual debit addition state
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualComp, setManualComp] = useState('');
  const [manualVenc, setManualVenc] = useState('');
  const [manualPrincipal, setManualPrincipal] = useState('75.60');
  const [manualMultaJuros, setManualMultaJuros] = useState('12.50');
  const [manualSituacao, setManualSituacao] = useState('DEVEDOR');

  // Load PGMEI debts
  useEffect(() => {
    if (isMei && !data && !loading) {
      handleQueryPgmei();
    }
  }, [isMei, empresa.cnpj]);

  const handleQueryPgmei = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await consultPgmeiRpa(empresa.cnpj);
      setData(res);

      // Sincroniza pendências na carteira
      await updatePendenciasInCarteira(empresa.cnpj, {
        pendenciasResumo: {
          totalDebitosMei: res.valor_total_atraso,
          guiasAtrasoMei: res.total_guias_atraso,
        }
      });
      if (onRefreshPortfolioSummary) onRefreshPortfolioSummary();
    } catch (err: any) {
      setError(err.message || 'Falha ao consultar PGMEI');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCnpj = () => {
    navigator.clipboard.writeText(formatCNPJ(empresa.cnpj));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Import pasted extract
  const handleImportExtrato = async () => {
    if (!pastedExtrato.trim()) return;
    setParsingExtrato(true);
    try {
      const res = await parsePgmeiExtract(pastedExtrato, empresa.cnpj);
      if (res.competencias && res.competencias.length > 0) {
        setData(prev => ({
          success: true,
          url: PGMEI_URL,
          cnpj: empresa.cnpj,
          status_mei: 'OPTANTE_SIMEI',
          total_guias_atraso: res.total_guias,
          valor_total_atraso: res.valor_total,
          competencias_pendentes: res.competencias,
          instrucoes_rpa: prev?.instrucoes_rpa || {
            url: PGMEI_URL,
            campo_cnpj: '#cnpj',
            botao_continuar: 'Continuar',
            seletor_tabela_guias: 'table',
          }
        }));

        await updatePendenciasInCarteira(empresa.cnpj, {
          pendenciasResumo: {
            totalDebitosMei: res.valor_total,
            guiasAtrasoMei: res.total_guias,
          }
        });
        if (onRefreshPortfolioSummary) onRefreshPortfolioSummary();
        setIsImportOpen(false);
        setPastedExtrato('');
      } else {
        alert('Nenhuma competência com formato de débito (ex: 01/2025 R$ 75,60) foi identificada no texto colado.');
      }
    } catch (err: any) {
      alert('Erro ao processar extrato: ' + err.message);
    } finally {
      setParsingExtrato(false);
    }
  };

  // Add manual debit
  const handleAddManualDebt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualComp) return;

    const princ = parseFloat(manualPrincipal.replace(',', '.')) || 75.60;
    const mj = parseFloat(manualMultaJuros.replace(',', '.')) || 0;
    const tot = Number((princ + mj).toFixed(2));

    const newDebt: GuiaAtrasoMEI = {
      periodo: manualComp,
      vencimento: manualVenc || `20/${manualComp}`,
      principal: princ,
      multa_juros: mj,
      total: tot,
      situacao: manualSituacao,
      tipo: 'DAS-MEI',
      linha_digitavel: `85890000000 8 ${Math.floor(tot * 100)} 0328240 10000000000 0 ${empresa.cnpj.slice(0, 8)}`,
    };

    if (data) {
      const updatedList = [newDebt, ...data.competencias_pendentes];
      const updatedTotal = Number(updatedList.reduce((acc, curr) => acc + curr.total, 0).toFixed(2));
      setData({
        ...data,
        total_guias_atraso: updatedList.length,
        valor_total_atraso: updatedTotal,
        competencias_pendentes: updatedList,
      });

      updatePendenciasInCarteira(empresa.cnpj, {
        pendenciasResumo: {
          totalDebitosMei: updatedTotal,
          guiasAtrasoMei: updatedList.length,
        }
      });
    }

    setIsManualModalOpen(false);
    setManualComp('');
    setManualVenc('');
  };

  // Save DAS / Extract report to Docker storage volume mount
  const handleSaveToStorage = async () => {
    if (!data) return;
    setSavingStorage(true);
    setStorageSuccess(null);
    try {
      const reportText = `RELATÓRIO DE APURAÇÃO PGMEI - RECEITA FEDERAL
CNPJ: ${formatCNPJ(empresa.cnpj)}
Razão Social: ${empresa.razao_social}
Data da Apuração: ${new Date().toLocaleString('pt-BR')}
Total de Guias em Atraso: ${data.total_guias_atraso}
Valor Total da Dívida: ${formatCurrency(data.valor_total_atraso)}

COMPETÊNCIAS PENDENTES:
${data.competencias_pendentes.map(c => `- Competência: ${c.periodo} | Vencimento: ${c.vencimento} | Principal: ${formatCurrency(c.principal)} | Multa/Juros: ${formatCurrency(c.multa_juros)} | Total: ${formatCurrency(c.total)} | Situação: ${c.situacao}`).join('\n')}
`;

      const safeFilename = `DAS_MEI_${empresa.cnpj}_${new Date().toISOString().slice(0, 10)}.txt`;

      const res = await savePdfToStorage({
        cnpj: empresa.cnpj,
        tipo: 'DAS_MEI',
        filename: safeFilename,
        textContent: reportText,
        metadata: { total: data.valor_total_atraso, guias: data.total_guias_atraso },
      });

      setStorageSuccess(`Salvo com sucesso na montagem Docker: ${res.filename}`);
      setTimeout(() => setStorageSuccess(null), 5000);
    } catch (err: any) {
      alert('Falha ao salvar no Docker storage: ' + err.message);
    } finally {
      setSavingStorage(false);
    }
  };

  if (!isMei) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-7">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-100 text-slate-500">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Módulo PGMEI (Microempreendedor Individual)
              </h3>
              <p className="text-xs text-slate-500">
                Consulta de DAS em atraso desabilitada para empresas não marcadas como MEI
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsMei(true)}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm transition cursor-pointer self-start sm:self-center"
          >
            Marcar Empresa como MEI & Consultar PGMEI
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border-2 border-amber-400/80 p-5 sm:p-7 relative overflow-hidden">
      {/* Decorative top ribbon */}
      <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500" />

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
              Módulo Ativo: MEI (SIMEI)
            </span>
            <span className="text-xs text-slate-500">
              Apuração de Débitos Reais & Histórico Completo
            </span>
          </div>

          <h3 className="text-xl font-black text-slate-900">
            Portal PGMEI - Débitos & Guias DAS
          </h3>

          <p className="text-xs text-slate-500 mt-1 font-mono break-all">
            Link Oficial: <a href={PGMEI_URL} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{PGMEI_URL}</a>
          </p>
        </div>

        {/* Controles do Cabeçalho */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCopyCnpj}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 transition"
            title="Copiar CNPJ formatado"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
            <span>{copied ? 'CNPJ Copiado!' : 'Copiar CNPJ'}</span>
          </button>

          <a
            href={PGMEI_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-blue-200 bg-blue-50/60 hover:bg-blue-100/70 text-blue-700 transition"
            title="Abrir página oficial do PGMEI em nova aba"
          >
            <span>Acessar PGMEI</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            onClick={handleQueryPgmei}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Atualizando Débitos...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Recalcular Débitos Reais</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 mb-4">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {storageSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs flex items-center gap-2 mb-4 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{storageSuccess}</span>
        </div>
      )}

      {/* Destaque Principal: Total das Guias em Atraso & Competências */}
      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card Valor Total em Atraso */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-md relative overflow-hidden">
              <div className="flex items-center justify-between opacity-80 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">
                  Valor Total das Guias em Atraso
                </span>
                <DollarSign className="w-5 h-5" />
              </div>
              <div className="text-3xl sm:text-4xl font-black tracking-tight">
                {formatCurrency(data.valor_total_atraso)}
              </div>
              <p className="text-xs text-rose-100 mt-2">
                Consolidado de {data.total_guias_atraso} competências vencidas (Principal + Multa SELIC + Juros)
              </p>
            </div>

            {/* Card Competências Pendentes */}
            <div className="p-5 rounded-2xl bg-slate-900 text-white shadow-md flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Competências Pendentes
                  </span>
                  <Calendar className="w-5 h-5 text-amber-400" />
                </div>
                <div className="text-3xl sm:text-4xl font-black text-amber-400">
                  {data.total_guias_atraso} guias
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Risco de envio para Dívida Ativa da União (PGFN)</span>
              </div>
            </div>

            {/* Card de Ações de Exportação e Docker */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Exportação & Volume Docker
                </span>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Grave o espelho das guias diretamente na pasta montada <code className="px-1 py-0.5 rounded bg-slate-200 text-slate-800 font-mono">./storage/guias_mei/</code>.
                </p>
              </div>

              <div className="pt-3 flex flex-wrap gap-2">
                <button
                  onClick={handleSaveToStorage}
                  disabled={savingStorage}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white transition disabled:opacity-50"
                  title="Salvar espelho das guias na pasta montada do Docker"
                >
                  {savingStorage ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span>Salvar no Docker (/storage)</span>
                </button>

                <button
                  onClick={() => setIsImportOpen(true)}
                  className="flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 transition"
                  title="Colar ou importar texto do extrato PGMEI"
                >
                  <Upload className="w-3.5 h-3.5 text-blue-600" />
                  <span>Importar Extrato</span>
                </button>

                <button
                  onClick={() => setIsManualModalOpen(true)}
                  className="flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 transition"
                  title="Adicionar guia com valores personalizados"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-600" />
                  <span>+ Guia</span>
                </button>
              </div>
            </div>
          </div>

          {/* Modal / Caixa de Importação de Extrato do PGMEI */}
          {isImportOpen && (
            <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-blue-700" />
                  <h4 className="font-bold text-xs text-blue-900">
                    Importar Extrato Oficial do PGMEI (Texto ou Tabela Copiada)
                  </h4>
                </div>
                <button
                  onClick={() => setIsImportOpen(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
                >
                  Fechar
                </button>
              </div>
              <p className="text-[11px] text-blue-800">
                Acesse a tela do PGMEI, selecione a tabela de competências/débitos, copie (Ctrl+C) e cole abaixo (Ctrl+V). Nosso leitor identifica automaticamente todos os meses, juros, multas e valores oficiais!
              </p>
              <textarea
                rows={4}
                value={pastedExtrato}
                onChange={e => setPastedExtrato(e.target.value)}
                placeholder="Exemplo colado:&#10;01/2026 - 20/02/2026 - Principal: R$ 75,60 - Multa: R$ 12,40 - Total: R$ 88,00&#10;12/2025 - 20/01/2026 - Principal: R$ 70,60 - Multa: R$ 18,20 - Total: R$ 88,80..."
                className="w-full p-3 rounded-xl bg-white border border-blue-300 text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsImportOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-700 bg-white"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleImportExtrato}
                  disabled={parsingExtrato || !pastedExtrato.trim()}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition disabled:opacity-50"
                >
                  {parsingExtrato ? 'Processando...' : 'Carregar Todas as Guias'}
                </button>
              </div>
            </div>
          )}

          {/* Modal de Adição Manual de Guia */}
          {isManualModalOpen && (
            <form onSubmit={handleAddManualDebt} className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs text-emerald-900 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-emerald-700" />
                  Adicionar Guia de Débito Real do PGMEI
                </h4>
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
                >
                  Fechar
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">Competência (MM/AAAA)</label>
                  <input
                    type="text"
                    required
                    placeholder="05/2024"
                    value={manualComp}
                    onChange={e => setManualComp(e.target.value)}
                    className="w-full p-2 rounded-lg bg-white border border-slate-300 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">Vencimento Original</label>
                  <input
                    type="text"
                    placeholder="20/06/2024"
                    value={manualVenc}
                    onChange={e => setManualVenc(e.target.value)}
                    className="w-full p-2 rounded-lg bg-white border border-slate-300 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">Valor Principal (R$)</label>
                  <input
                    type="text"
                    required
                    value={manualPrincipal}
                    onChange={e => setManualPrincipal(e.target.value)}
                    className="w-full p-2 rounded-lg bg-white border border-slate-300 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">Multa e Juros (R$)</label>
                  <input
                    type="text"
                    required
                    value={manualMultaJuros}
                    onChange={e => setManualMultaJuros(e.target.value)}
                    className="w-full p-2 rounded-lg bg-white border border-slate-300 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">Situação Oficial</label>
                  <select
                    value={manualSituacao}
                    onChange={e => setManualSituacao(e.target.value)}
                    className="w-full p-2 rounded-lg bg-white border border-slate-300 text-xs"
                  >
                    <option value="DEVEDOR">DEVEDOR</option>
                    <option value="EM COBRANÇA NA RFB">EM COBRANÇA NA RFB</option>
                    <option value="INSCRITO EM DÍVIDA ATIVA DA UNIÃO (PGFN)">INSCRITO EM DÍVIDA ATIVA (PGFN)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-700 bg-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                >
                  Salvar Guia
                </button>
              </div>
            </form>
          )}

          {/* Tabela Detalhada de Todas as Competências em Atraso */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-xs text-slate-700 uppercase tracking-wider">
                Discriminação Completa das Competências em Atraso
              </span>
              <span className="text-[11px] text-slate-500">
                Total: <strong>{data.competencias_pendentes.length} guias</strong>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-100/60 font-semibold text-slate-600">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Competência</th>
                    <th className="px-4 py-2.5 text-left">Vencimento</th>
                    <th className="px-4 py-2.5 text-right">Principal</th>
                    <th className="px-4 py-2.5 text-right">Multa & Juros</th>
                    <th className="px-4 py-2.5 text-right">Total a Pagar</th>
                    <th className="px-4 py-2.5 text-center">Situação Legal</th>
                    <th className="px-4 py-2.5 text-center">Guia DAS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80 bg-white">
                  {data.competencias_pendentes.map((guia, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3 font-mono font-bold text-slate-800">
                        {guia.periodo}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {guia.vencimento}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">
                        {formatCurrency(guia.principal)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-rose-600 font-semibold">
                        +{formatCurrency(guia.multa_juros)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 bg-rose-50/30">
                        {formatCurrency(guia.total)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          guia.situacao.includes('DÍVIDA ATIVA') || guia.situacao.includes('PGFN')
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : guia.situacao.includes('COBRANÇA')
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-orange-100 text-orange-800 border border-orange-200'
                        }`}>
                          {guia.situacao}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => {
                            if (guia.linha_digitavel) {
                              navigator.clipboard.writeText(guia.linha_digitavel);
                              alert(`Linha digitável copiada:\n${guia.linha_digitavel}`);
                            } else {
                              alert(`Acesse o PGMEI oficial para emissão do boleto da competência ${guia.periodo}.`);
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] transition inline-flex items-center gap-1"
                          title="Copiar código de barras da guia"
                        >
                          <Receipt className="w-3.5 h-3.5 text-slate-500" />
                          <span>Linha DAS</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
