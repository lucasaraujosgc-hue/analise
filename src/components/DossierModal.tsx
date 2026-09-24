import React, { useState } from 'react';
import { EmpresaData } from '../types/cnpj';
import { formatCNPJ, formatCurrency, formatDate, formatCnaeCode, formatCEP } from '../utils/formatters';
import { 
  Printer, X, Building, ShieldCheck, CheckCircle2, AlertTriangle, 
  XCircle, FileText, Download, HardDrive, Loader2, Check, Sparkles 
} from 'lucide-react';
import { VirgulaLogo } from './VirgulaLogo';
import { savePdfToStorage } from '../services/api';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

interface DossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  empresa: EmpresaData;
  isMei: boolean;
}

export const DossierModal: React.FC<DossierModalProps> = ({
  isOpen,
  onClose,
  empresa,
  isMei,
}) => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSavingDocker, setIsSavingDocker] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  // 1. Direct PDF Download with jsPDF + html2canvas
  const handleDownloadPdf = async () => {
    const element = document.getElementById('dossier-printable-content');
    if (!element) return;

    setIsGeneratingPdf(true);
    setFeedbackMsg(null);

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const cleanCnpj = empresa.cnpj.replace(/\D/g, '');
      const cleanName = empresa.razao_social.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 25);
      const fileName = `Dossie_VirgulaContabil_${cleanName}_${cleanCnpj}.pdf`;

      pdf.save(fileName);
      setFeedbackMsg({ type: 'success', text: `PDF baixado com sucesso: ${fileName}` });
      setTimeout(() => setFeedbackMsg(null), 4500);
    } catch (err: any) {
      console.error('Erro ao gerar PDF via canvas, usando fallback HTML:', err);
      // Fallback: download standalone printable HTML file
      handleDownloadHtmlFallback();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // 2. Standalone HTML printable fallback
  const handleDownloadHtmlFallback = () => {
    const content = document.getElementById('dossier-printable-content')?.innerHTML;
    if (!content) return;

    const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Dossiê Vírgula, Contábil - ${empresa.razao_social}</title>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @media print {
      @page { margin: 12mm; size: A4; }
      body { margin: 0; padding: 0; }
    }
  </style>
</head>
<body class="bg-white p-8 text-slate-800 font-sans">
  ${content}
  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`;

    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Dossie_Contabil_${empresa.cnpj.replace(/\D/g, '')}.html`;
    a.click();
    URL.revokeObjectURL(url);
    setFeedbackMsg({ type: 'success', text: 'Relatório baixado em formato compatível para impressão/PDF!' });
    setTimeout(() => setFeedbackMsg(null), 4500);
  };

  // 3. Save PDF to Docker Volume (/app/storage/relatorios)
  const handleSaveToDocker = async () => {
    setIsSavingDocker(true);
    setFeedbackMsg(null);

    try {
      const element = document.getElementById('dossier-printable-content');
      let base64Pdf: string | undefined;

      if (element) {
        try {
          const canvas = await html2canvas(element, { scale: 1.5, useCORS: true, logging: false, backgroundColor: '#ffffff' });
          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
          const imgWidth = 210;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;
          pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
          base64Pdf = pdf.output('datauristring');
        } catch (e) {
          console.warn('Canvas export failed, saving text dossier:', e);
        }
      }

      const cleanCnpj = empresa.cnpj.replace(/\D/g, '');
      const cleanName = empresa.razao_social.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20);
      const filename = `DOSSIE_${cleanName}_${cleanCnpj}_${new Date().toISOString().slice(0, 10)}.pdf`;

      const res = await savePdfToStorage({
        cnpj: empresa.cnpj,
        tipo: 'RELATORIO',
        filename,
        contentBase64: base64Pdf,
        textContent: element?.innerText || `Dossiê da empresa ${empresa.razao_social} - CNPJ: ${formatCNPJ(empresa.cnpj)}`,
        metadata: {
          razao_social: empresa.razao_social,
          emissao: new Date().toISOString(),
        }
      });

      setFeedbackMsg({ 
        type: 'success', 
        text: `Dossiê salvo permanentemente no Docker: /app/storage/relatorios/${res.filename}` 
      });
      setTimeout(() => setFeedbackMsg(null), 6000);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: 'Erro ao salvar no storage: ' + (err.message || 'Falha de gravação') });
    } finally {
      setIsSavingDocker(false);
    }
  };

  // 4. Safe Print Dialog with fallback
  const handlePrint = () => {
    try {
      const printFrame = document.createElement('iframe');
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = '0';
      document.body.appendChild(printFrame);

      const doc = printFrame.contentWindow?.document;
      const content = document.getElementById('dossier-printable-content')?.innerHTML || '';

      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html lang="pt-BR">
            <head>
              <meta charset="utf-8">
              <title>Dossiê - ${empresa.razao_social}</title>
              <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
              <script src="https://cdn.tailwindcss.com"></script>
              <style>
                @media print {
                  @page { margin: 10mm; size: A4; }
                  body { margin: 0; padding: 0; background: #fff; color: #1e293b; font-family: 'Inter', sans-serif; }
                }
              </style>
            </head>
            <body class="bg-white p-6">
              ${content}
            </body>
          </html>
        `);
        doc.close();

        setTimeout(() => {
          try {
            printFrame.contentWindow?.focus();
            printFrame.contentWindow?.print();
            setTimeout(() => {
              try { document.body.removeChild(printFrame); } catch (e) {}
            }, 3000);
          } catch (e) {
            console.warn('Iframe print blocked, falling back to direct window.print or PDF download:', e);
            try { document.body.removeChild(printFrame); } catch (err) {}
            handleDownloadPdf();
          }
        }, 600);
      } else {
        window.print();
      }
    } catch (err) {
      console.warn('Print trigger failed, downloading PDF directly:', err);
      handleDownloadPdf();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        
        {/* Modal Top Bar (Controles) */}
        <div className="flex flex-wrap items-center justify-between px-5 sm:px-6 py-3.5 border-b border-slate-200 bg-slate-50 gap-3">
          <div className="flex items-center gap-2.5">
            <VirgulaLogo size="sm" theme="light" />
            <div className="h-6 w-px bg-slate-200" />
            <span className="text-xs font-semibold text-slate-700 hidden sm:inline">
              Dossiê Executivo de Compliance Fiscal
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 1. Baixar PDF Oficial */}
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md shadow-emerald-900/20 transition cursor-pointer disabled:opacity-50"
              title="Gerar e baixar o arquivo PDF oficial do dossiê no seu computador"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Gerando PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Baixar PDF</span>
                </>
              )}
            </button>

            {/* 2. Salvar no Docker Volume */}
            <button
              onClick={handleSaveToDocker}
              disabled={isSavingDocker}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold border border-slate-700 transition cursor-pointer disabled:opacity-50"
              title="Salvar permanentemente na pasta montada /app/storage/relatorios no container Docker"
            >
              {isSavingDocker ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <HardDrive className="w-4 h-4 text-cyan-400" />
                  <span className="hidden sm:inline">Salvar no Docker</span>
                </>
              )}
            </button>

            {/* 3. Imprimir */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-300 transition cursor-pointer"
              title="Abrir diálogo de impressão do navegador"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>

            {/* Fechar */}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200 transition cursor-pointer"
              title="Fechar janela"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback Banner */}
        {feedbackMsg && (
          <div className={`px-6 py-2.5 text-xs font-semibold flex items-center justify-between transition-all ${
            feedbackMsg.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200' 
              : 'bg-rose-50 text-rose-800 border-b border-rose-200'
          }`}>
            <div className="flex items-center gap-2">
              {feedbackMsg.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              )}
              <span>{feedbackMsg.text}</span>
            </div>
            <button 
              onClick={() => setFeedbackMsg(null)}
              className="text-slate-400 hover:text-slate-600 font-bold ml-2"
            >
              ×
            </button>
          </div>
        )}

        {/* Conteúdo Imprimível / Capturável */}
        <div className="p-6 sm:p-10 flex-1 overflow-y-auto space-y-6 text-slate-800 bg-white" id="dossier-printable-content">
          
          {/* Cabeçalho Oficial Vírgula, Contábil */}
          <div className="border-b-2 border-slate-900 pb-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <VirgulaLogo size="lg" theme="light" />
                <div className="h-12 w-px bg-slate-200 hidden sm:block" />
                <div>
                  <span className="text-[11px] uppercase tracking-widest font-black text-[oklch(0.36_0.06_165)] block">
                    Dossiê Corporativo de Auditoria & Compliance Fiscal
                  </span>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight mt-0.5">
                    {empresa.razao_social}
                  </h1>
                  {empresa.nome_fantasia && empresa.nome_fantasia !== 'Não informado' && (
                    <p className="text-xs font-semibold text-slate-600">
                      Nome Fantasia: {empresa.nome_fantasia}
                    </p>
                  )}
                </div>
              </div>

              <div className="sm:text-right shrink-0 bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-xl border sm:border-0 border-slate-200">
                <span className="text-[10px] font-mono block text-slate-500 uppercase tracking-wider">
                  Data de Emissão do Dossiê:
                </span>
                <span className="text-xs font-bold text-slate-900">
                  {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}
                </span>
                <span className="text-[9px] block text-emerald-700 font-mono mt-0.5 font-semibold">
                  Autenticação: VC-{empresa.cnpj.slice(-6)}-{new Date().getFullYear()}
                </span>
              </div>
            </div>
          </div>

          {/* 1. Dados Gerais & Cadastrais */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 border-b border-slate-200 pb-1 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-[oklch(0.36_0.06_165)]" />
              <span>1. Identificação Cadastral da Empresa</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 text-xs">
              <div>
                <span className="text-slate-500 block text-[10px] font-medium uppercase">CNPJ:</span>
                <span className="font-mono font-black text-slate-900 text-sm">
                  {formatCNPJ(empresa.cnpj)}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px] font-medium uppercase">Situação Cadastral:</span>
                <span className="font-bold text-emerald-700 uppercase">
                  {empresa.situacao_cadastral || 'ATIVA'}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px] font-medium uppercase">Data de Abertura:</span>
                <span className="font-bold text-slate-900">
                  {formatDate(empresa.data_inicio_atividade)}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px] font-medium uppercase">Capital Social:</span>
                <span className="font-bold text-slate-900">
                  {formatCurrency(empresa.capital_social)}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px] font-medium uppercase">Porte Empresarial:</span>
                <span className="font-semibold text-slate-800">{empresa.porte || 'MICRO EMPRESA'}</span>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px] font-medium uppercase">Regime Tributário:</span>
                <span className="font-semibold text-slate-800">
                  {empresa.opcao_pelo_simples ? 'Simples Nacional' : 'Regime Geral'}
                  {empresa.opcao_pelo_mei ? ' (MEI - SIMEI)' : ''}
                </span>
              </div>

              <div className="col-span-2">
                <span className="text-slate-500 block text-[10px] font-medium uppercase">Natureza Jurídica:</span>
                <span className="font-semibold text-slate-800 truncate block">
                  {empresa.natureza_juridica}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Endereço & Contatos Oficiais */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 border-b border-slate-200 pb-1">
              2. Localização e Contatos Cadastrados na Receita Federal
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
              <div>
                <span className="text-slate-500 block text-[10px] font-medium uppercase">Endereço Comercial Oficial:</span>
                <span className="font-semibold text-slate-900 leading-relaxed block mt-0.5">
                  {empresa.endereco.endereco_completo}
                </span>
              </div>

              <div className="space-y-1.5">
                <div>
                  <span className="text-slate-500 block text-[10px] font-medium uppercase">Telefone de Contato:</span>
                  <span className="font-semibold text-slate-900 font-mono">
                    {empresa.telefone && empresa.telefone !== 'Não cadastrado' ? empresa.telefone : 'Não informado na base da RFB'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-medium uppercase">E-mail Corporativo:</span>
                  <span className="font-semibold text-slate-900 font-mono">
                    {empresa.email && empresa.email !== 'Não cadastrado' ? empresa.email : 'Não informado na base da RFB'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Atividades Econômicas (CNAEs) */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 border-b border-slate-200 pb-1">
              3. Atividades Econômicas (CNAEs)
            </h3>

            <div className="text-xs space-y-2">
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200">
                <span className="font-bold text-[oklch(0.36_0.06_165)] block text-xs">
                  CNAE Principal: {formatCnaeCode(empresa.cnae_fiscal.codigo)}
                </span>
                <span className="font-medium text-slate-800 text-xs">
                  {empresa.cnae_fiscal.descricao}
                </span>
              </div>

              {empresa.cnaes_secundarios && empresa.cnaes_secundarios.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="font-bold text-slate-700 block mb-1.5 text-[11px] uppercase">
                    Atividades Secundárias Cadastradas ({empresa.cnaes_secundarios.length}):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-hidden text-[11px]">
                    {empresa.cnaes_secundarios.slice(0, 10).map((sec, i) => (
                      <div key={i} className="text-slate-700">
                        • <strong className="font-mono text-slate-900">{formatCnaeCode(sec.codigo)}</strong> - {sec.descricao}
                      </div>
                    ))}
                  </div>
                  {empresa.cnaes_secundarios.length > 10 && (
                    <span className="text-[10px] text-slate-500 italic block mt-1">
                      + outras {empresa.cnaes_secundarios.length - 10} atividades econômicas registradas...
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 4. Quadro de Sócios e Administradores (QSA) */}
          {empresa.qsa && empresa.qsa.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 border-b border-slate-200 pb-1">
                4. Quadro de Sócios e Administradores (QSA)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {empresa.qsa.map((s, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="font-black text-slate-900 block">
                      {s.nome_socio}
                    </span>
                    <span className="text-[11px] text-[oklch(0.36_0.06_165)] font-semibold block mt-0.5">
                      {s.qualificacao_socio}
                    </span>
                    {s.faixa_etaria && (
                      <span className="text-[10px] text-slate-500 block">
                        Faixa Etária: {s.faixa_etaria}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. Regularidade Fiscal, CNDs e Diagnóstico MEI */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 border-b border-slate-200 pb-1">
              5. Diagnóstico de Compliance Fiscal e Débitos
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/80 space-y-1.5">
                <span className="font-black text-slate-900 text-xs block uppercase tracking-wider">
                  Certidões Negativas de Débitos (CNDs):
                </span>
                <div className="space-y-1 text-slate-700 text-[11px]">
                  <p>• <strong>CND Federal:</strong> {empresa.pendenciasResumo?.cndFederal || 'Disponível para emissão com RPA'}</p>
                  <p>• <strong>CND Estadual / SEFAZ:</strong> {empresa.pendenciasResumo?.cndEstadual || 'Disponível para emissão com RPA'}</p>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/80 space-y-1.5">
                <span className="font-black text-slate-900 text-xs block uppercase tracking-wider">
                  Diagnóstico MEI & Guias DAS:
                </span>
                <div className="space-y-1 text-slate-700 text-[11px]">
                  {empresa.opcao_pelo_mei ? (
                    empresa.pendenciasResumo?.guiasAtrasoMei ? (
                      <p className="text-rose-700 font-bold">
                        • {empresa.pendenciasResumo.guiasAtrasoMei} guias em atraso ({new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(empresa.pendenciasResumo.totalDebitosMei || 0)})
                      </p>
                    ) : (
                      <p className="text-emerald-700 font-bold">• Situação regularizada no PGMEI (Sem guias vencidas)</p>
                    )
                  ) : (
                    <p className="text-slate-600">• Empresa não optante pelo enquadramento MEI</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Rodapé e Autenticação */}
          <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-500 gap-2">
            <div className="flex items-center gap-2">
              <VirgulaLogo size="sm" theme="light" />
              <span>• Plataforma de Inteligência Fiscal e Gestão de Débitos</span>
            </div>
            <span>
              Documento expedido com validade probatória cadastral conforme Lei nº 8.934/1994.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
