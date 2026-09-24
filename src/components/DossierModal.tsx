import React, { useEffect, useState } from 'react';
import { EmpresaData, ResultadoMei } from '../types/cnpj';
import { formatCNPJ, formatCurrency, formatDate, formatCnaeCode, formatCEP } from '../utils/formatters';
import { 
  Printer, X, Building, ShieldCheck, CheckCircle2, AlertTriangle, 
  XCircle, FileText, Download, HardDrive, Loader2, Check, Sparkles 
} from 'lucide-react';
import { VirgulaLogo } from './VirgulaLogo';
import { fetchResultadoMei, savePdfToStorage } from '../services/api';
import { jsPDF } from 'jspdf';
// html2canvas-pro entende as cores oklch() do Tailwind v4 (o html2canvas original falhava).
import html2canvas from 'html2canvas-pro';

// CSS do próprio app para imprimir/exportar o dossiê com o mesmo visual.
function estilosDaPagina(): string {
  const partes: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      partes.push(`<style>${Array.from(sheet.cssRules).map(r => r.cssText).join('\n')}</style>`);
    } catch {
      if (sheet.href) partes.push(`<link rel="stylesheet" href="${sheet.href}">`);
    }
  }
  return partes.join('\n');
}

const ROTULO_CND: Record<string, string> = {
  NEGATIVA: 'Negativa',
  POSITIVA_COM_EFEITO_DE_NEGATIVA: 'Positiva com efeito de negativa',
  POSITIVA: 'Positiva (com pendências)',
  INCONCLUSIVA: 'Inconclusiva',
  NAO_CONSULTADA: 'Não consultada',
};

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
  const [mei, setMei] = useState<ResultadoMei | null>(null);

  useEffect(() => {
    if (!isOpen || !isMei) return;
    fetchResultadoMei(empresa.cnpj).then(setMei).catch(() => setMei(null));
  }, [isOpen, isMei, empresa.cnpj]);

  if (!isOpen) return null;
  const meiEmAberto = (mei?.competencias || []).filter(c =>
    ['EM_ABERTO', 'A_VENCER', 'DIVIDA_ATIVA', 'BLOQUEADO_DASN', 'ABAIXO_MINIMO', 'REAPURACAO_NECESSARIA'].includes(c.situacao),
  );

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
  ${estilosDaPagina()}
  <style>
    @media print {
      @page { margin: 12mm; size: A4; }
      body { margin: 0; padding: 0; }
    }
  </style>
</head>
<body class="bg-white p-8 text-foreground font-sans">
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
      // Sem PDF (falha na captura), salva o texto do dossiê com a extensão correta.
      const filename = `DOSSIE_${cleanName}_${cleanCnpj}_${new Date().toISOString().slice(0, 10)}.${base64Pdf ? 'pdf' : 'txt'}`;

      const res = await savePdfToStorage({
        cnpj: empresa.cnpj,
        tipo: 'RELATORIO',
        filename,
        contentBase64: base64Pdf,
        textContent: element?.innerText || `Dossiê da empresa ${empresa.razao_social} - CNPJ: ${formatCNPJ(empresa.cnpj)}`,
      });

      setFeedbackMsg({ 
        type: 'success', 
        text: `Dossiê salvo em Arquivos › relatórios: ${res.filename}` 
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
              ${estilosDaPagina()}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-primary-950/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[94vh] flex flex-col shadow-xl overflow-hidden border border-border">
        
        {/* Modal Top Bar (Controles) */}
        <div className="flex flex-wrap items-center justify-between px-5 sm:px-6 py-3.5 border-b border-border bg-muted gap-3">
          <div className="flex items-center gap-2.5">
            <VirgulaLogo size="sm" theme="light" />
            <div className="h-6 w-px bg-border" />
            <span className="text-xs font-semibold text-foreground hidden sm:inline">
              Dossiê Executivo de Compliance Fiscal
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 1. Baixar PDF Oficial */}
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-800 text-primary-foreground text-xs font-semibold transition cursor-pointer disabled:opacity-50"
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
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-muted text-foreground text-xs font-semibold border border-border transition cursor-pointer disabled:opacity-50"
              title="Salvar permanentemente na pasta montada /app/storage/relatorios no container Docker"
            >
              {isSavingDocker ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <HardDrive className="w-4 h-4 text-primary" />
                  <span className="hidden sm:inline">Salvar em Arquivos</span>
                </>
              )}
            </button>

            {/* 3. Imprimir */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-muted text-foreground text-xs font-semibold border border-border transition cursor-pointer"
              title="Abrir diálogo de impressão do navegador"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>

            {/* Fechar */}
            <button
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition cursor-pointer"
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
              ? 'bg-primary-50 text-primary border-b border-primary-200' 
              : 'bg-rose-50 text-rose-800 border-b border-rose-200'
          }`}>
            <div className="flex items-center gap-2">
              {feedbackMsg.type === 'success' ? (
                <Check className="w-4 h-4 text-primary" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              )}
              <span>{feedbackMsg.text}</span>
            </div>
            <button 
              onClick={() => setFeedbackMsg(null)}
              className="text-muted-foreground hover:text-muted-foreground font-bold ml-2"
            >
              ×
            </button>
          </div>
        )}

        {/* Conteúdo Imprimível / Capturável */}
        <div className="p-6 sm:p-10 flex-1 overflow-y-auto space-y-6 text-foreground bg-white" id="dossier-printable-content">
          
          {/* Cabeçalho Oficial Vírgula, Contábil */}
          <div className="border-b-2 border-primary pb-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <VirgulaLogo size="lg" theme="light" />
                <div className="h-12 w-px bg-border hidden sm:block" />
                <div>
                  <span className="text-[11px] uppercase tracking-widest font-semibold text-primary block">
                    Dossiê Corporativo de Auditoria & Compliance Fiscal
                  </span>
                  <h1 className="text-xl sm:text-2xl font-semibold text-foreground leading-tight mt-0.5">
                    {empresa.razao_social}
                  </h1>
                  {empresa.nome_fantasia && empresa.nome_fantasia !== 'Não informado' && (
                    <p className="text-xs font-semibold text-muted-foreground">
                      Nome Fantasia: {empresa.nome_fantasia}
                    </p>
                  )}
                </div>
              </div>

              <div className="sm:text-right shrink-0 bg-muted sm:bg-transparent p-3 sm:p-0 rounded-xl border sm:border-0 border-border">
                <span className="text-[10px] font-mono block text-muted-foreground uppercase tracking-wider">
                  Data de Emissão do Dossiê:
                </span>
                <span className="text-xs font-bold text-foreground">
                  {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}
                </span>
              </div>
            </div>
          </div>

          {/* 1. Dados Gerais & Cadastrais */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-primary" />
              <span>1. Identificação Cadastral da Empresa</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/70 p-4 rounded-xl border border-border text-xs">
              <div>
                <span className="text-muted-foreground block text-[10px] font-medium uppercase">CNPJ:</span>
                <span className="font-mono font-semibold text-foreground text-sm">
                  {formatCNPJ(empresa.cnpj)}
                </span>
              </div>

              <div>
                <span className="text-muted-foreground block text-[10px] font-medium uppercase">Situação Cadastral:</span>
                <span className="font-bold text-primary uppercase">
                  {empresa.situacao_cadastral || 'ATIVA'}
                </span>
              </div>

              <div>
                <span className="text-muted-foreground block text-[10px] font-medium uppercase">Data de Abertura:</span>
                <span className="font-bold text-foreground">
                  {formatDate(empresa.data_inicio_atividade)}
                </span>
              </div>

              <div>
                <span className="text-muted-foreground block text-[10px] font-medium uppercase">Capital Social:</span>
                <span className="font-bold text-foreground">
                  {formatCurrency(empresa.capital_social)}
                </span>
              </div>

              <div>
                <span className="text-muted-foreground block text-[10px] font-medium uppercase">Porte Empresarial:</span>
                <span className="font-semibold text-foreground">{empresa.porte || 'MICRO EMPRESA'}</span>
              </div>

              <div>
                <span className="text-muted-foreground block text-[10px] font-medium uppercase">Regime Tributário:</span>
                <span className="font-semibold text-foreground">
                  {empresa.opcao_pelo_simples ? 'Simples Nacional' : 'Regime Geral'}
                  {empresa.opcao_pelo_mei ? ' (MEI - SIMEI)' : ''}
                </span>
              </div>

              <div className="col-span-2">
                <span className="text-muted-foreground block text-[10px] font-medium uppercase">Natureza Jurídica:</span>
                <span className="font-semibold text-foreground truncate block">
                  {empresa.natureza_juridica}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Endereço & Contatos Oficiais */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
              2. Localização e Contatos
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-muted/70 p-4 rounded-xl border border-border">
              <div>
                <span className="text-muted-foreground block text-[10px] font-medium uppercase">Endereço Comercial Oficial:</span>
                <span className="font-semibold text-foreground leading-relaxed block mt-0.5">
                  {empresa.endereco.endereco_completo}
                </span>
              </div>

              <div className="space-y-1.5">
                <div>
                  <span className="text-muted-foreground block text-[10px] font-medium uppercase">Telefone de Contato:</span>
                  <span className="font-semibold text-foreground font-mono">
                    {empresa.telefone && empresa.telefone !== 'Não cadastrado' ? empresa.telefone : 'Não informado na base da RFB'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] font-medium uppercase">E-mail Corporativo:</span>
                  <span className="font-semibold text-foreground font-mono">
                    {empresa.email && empresa.email !== 'Não cadastrado' ? empresa.email : 'Não informado na base da RFB'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Atividades Econômicas (CNAEs) */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
              3. Atividades Econômicas (CNAEs)
            </h3>

            <div className="text-xs space-y-2">
              <div className="p-3 rounded-xl bg-primary-50 border border-primary-200">
                <span className="font-bold text-primary block text-xs">
                  CNAE Principal: {formatCnaeCode(empresa.cnae_fiscal.codigo)}
                </span>
                <span className="font-medium text-foreground text-xs">
                  {empresa.cnae_fiscal.descricao}
                </span>
              </div>

              {empresa.cnaes_secundarios && empresa.cnaes_secundarios.length > 0 && (
                <div className="p-3 rounded-xl bg-muted border border-border">
                  <span className="font-bold text-foreground block mb-1.5 text-[11px] uppercase">
                    Atividades Secundárias Cadastradas ({empresa.cnaes_secundarios.length}):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-hidden text-[11px]">
                    {empresa.cnaes_secundarios.slice(0, 10).map((sec, i) => (
                      <div key={i} className="text-foreground">
                        • <strong className="font-mono text-foreground">{formatCnaeCode(sec.codigo)}</strong> - {sec.descricao}
                      </div>
                    ))}
                  </div>
                  {empresa.cnaes_secundarios.length > 10 && (
                    <span className="text-[10px] text-muted-foreground italic block mt-1">
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
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
                4. Quadro de Sócios e Administradores (QSA)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {empresa.qsa.map((s, idx) => (
                  <div key={idx} className="p-3 bg-muted rounded-xl border border-border">
                    <span className="font-semibold text-foreground block">
                      {s.nome_socio}
                    </span>
                    <span className="text-[11px] text-primary font-semibold block mt-0.5">
                      {s.qualificacao_socio}
                    </span>
                    {s.faixa_etaria && (
                      <span className="text-[10px] text-muted-foreground block">
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
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
              5. Diagnóstico de Compliance Fiscal e Débitos
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-4 rounded-xl border border-border bg-muted/70 space-y-1.5">
                <span className="font-semibold text-foreground text-xs block uppercase tracking-wider">Certidões negativas (CND)</span>
                <div className="space-y-1 text-foreground text-[11px]">
                  <p>
                    • <strong>Federal:</strong> {ROTULO_CND[empresa.pendenciasResumo?.cndFederal || 'NAO_CONSULTADA']}
                    {empresa.pendenciasResumo?.cndFederalValidade ? ` (válida até ${empresa.pendenciasResumo.cndFederalValidade})` : ''}
                  </p>
                  <p>
                    • <strong>Estadual ({empresa.endereco.uf}):</strong> {ROTULO_CND[empresa.pendenciasResumo?.cndEstadual || 'NAO_CONSULTADA']}
                    {empresa.pendenciasResumo?.cndEstadualValidade ? ` (válida até ${empresa.pendenciasResumo.cndEstadualValidade})` : ''}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-border bg-muted/70 space-y-1.5">
                <span className="font-semibold text-foreground text-xs block uppercase tracking-wider">MEI — DAS e DASN-SIMEI</span>
                <div className="space-y-1 text-foreground text-[11px]">
                  {!isMei ? (
                    <p>• Empresa não optante pelo SIMEI.</p>
                  ) : !mei ? (
                    <p>• PGMEI ainda não consultado.</p>
                  ) : (
                    <>
                      <p className={mei.resumo.totalGeral > 0 ? 'text-rose-700 font-semibold' : 'text-emerald-700 font-semibold'}>
                        • {meiEmAberto.length} competência(s) em aberto — total {formatCurrency(mei.resumo.totalGeral)}
                      </p>
                      <p className={mei.resumo.declaracoesPendentes.length ? 'text-rose-700 font-semibold' : ''}>
                        • DASN-SIMEI em atraso: {mei.resumo.declaracoesPendentes.length ? mei.resumo.declaracoesPendentes.join(', ') : 'nenhuma identificada'}
                      </p>
                      <p className="text-muted-foreground">• Consulta em {new Date(mei.consultadoEm).toLocaleString('pt-BR')}</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {isMei && meiEmAberto.length > 0 && (
              <table className="w-full text-[11px] border border-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Competência</th>
                    <th className="px-2 py-1.5 text-left">Vencimento</th>
                    <th className="px-2 py-1.5 text-right">Principal</th>
                    <th className="px-2 py-1.5 text-right">Multa</th>
                    <th className="px-2 py-1.5 text-right">Juros</th>
                    <th className="px-2 py-1.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {meiEmAberto.map(c => (
                    <tr key={c.periodoApuracao} className="border-t border-border">
                      <td className="px-2 py-1 font-mono">{c.periodo}{c.situacao === 'DIVIDA_ATIVA' ? ' (dívida ativa)' : ''}</td>
                      <td className="px-2 py-1">{c.vencimento || '—'}</td>
                      <td className="px-2 py-1 text-right">{c.principal !== undefined ? formatCurrency(c.principal) : '—'}</td>
                      <td className="px-2 py-1 text-right">{c.multa !== undefined ? formatCurrency(c.multa) : '—'}</td>
                      <td className="px-2 py-1 text-right">{c.juros !== undefined ? formatCurrency(c.juros) : '—'}</td>
                      <td className="px-2 py-1 text-right font-semibold">{c.total !== undefined ? formatCurrency(c.total) : '—'}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border font-semibold">
                    <td colSpan={5} className="px-2 py-1.5 text-right">Total em aberto</td>
                    <td className="px-2 py-1.5 text-right">{formatCurrency(mei!.resumo.totalGeral)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {/* Rodapé e Autenticação */}
          <div className="pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between text-[10px] text-muted-foreground gap-2">
            <div className="flex items-center gap-2">
              <VirgulaLogo size="sm" theme="light" />
              <span>• Plataforma de Inteligência Fiscal e Gestão de Débitos</span>
            </div>
            <span>
              Relatório gerencial com base em dados públicos da Receita Federal e nos documentos enviados. Não substitui certidões oficiais.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
