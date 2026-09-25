import React, { useState } from 'react';
import { EmpresaData, CNDAnalysisResult, TipoCertidao, StatusCnd } from '../types/cnpj';
import { analyzeCndPdf, fetchJob, iniciarEmissaoCndFederal, updatePendenciasInCarteira } from '../services/api';
import { SAMPLE_CND_TEXTS } from '../data/mockCompanies';
import { CND_ESTADUAL, CND_FEDERAL, OUTRAS_CERTIDOES } from '../data/cndLinks';
import { formatCNPJ } from '../utils/formatters';
import { CaptchaRemoto } from './CaptchaRemoto';
import {
  FileText, CheckCircle, AlertTriangle, XCircle, Loader2, Calendar, Key, HelpCircle,
  FileCheck, Terminal, ExternalLink, Copy, Check, ChevronDown, Server,
} from 'lucide-react';

interface CndAnalysisSectionProps {
  empresa: EmpresaData;
  onOpenSeleniumModal: () => void;
  onRefreshPortfolioSummary?: () => void;
}

type Esfera = 'federal' | 'estadual';

const ROTULO_STATUS: Record<StatusCnd, string> = {
  NEGATIVA: 'Negativa',
  POSITIVA_COM_EFEITO_DE_NEGATIVA: 'Positiva com efeito de negativa',
  POSITIVA: 'Positiva (com pendências)',
  INCONCLUSIVA: 'Inconclusiva',
  NAO_CONSULTADA: 'Não consultada',
};

export const CndAnalysisSection: React.FC<CndAnalysisSectionProps> = ({ empresa, onOpenSeleniumModal, onRefreshPortfolioSummary }) => {
  const [esfera, setEsfera] = useState<Esfera>('federal');
  const [analisando, setAnalisando] = useState(false);
  const [resultado, setResultado] = useState<{ esfera: Esfera; dados: CNDAnalysisResult; exemplo: boolean } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [textoColado, setTextoColado] = useState('');
  const [mostrarColar, setMostrarColar] = useState(false);
  const [mostrarExemplos, setMostrarExemplos] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [roboEtapa, setRoboEtapa] = useState<string | null>(null);
  const [captchaJobId, setCaptchaJobId] = useState<string | null>(null);

  const uf = empresa.endereco.uf;
  const estadual = uf ? CND_ESTADUAL[uf] : undefined;
  const link = esfera === 'federal' ? { orgao: 'Receita Federal / PGFN', url: CND_FEDERAL.url, conferido: true, observacao: undefined } : estadual;
  const ies = (empresa.inscricoes_estaduais || []).filter(ie => !uf || ie.uf === uf);
  const statusAtual = esfera === 'federal' ? empresa.pendenciasResumo?.cndFederal : empresa.pendenciasResumo?.cndEstadual;
  const validadeAtual = esfera === 'federal' ? empresa.pendenciasResumo?.cndFederalValidade : empresa.pendenciasResumo?.cndEstadualValidade;

  const abrirPortal = () => {
    if (!link) return;
    navigator.clipboard.writeText(formatCNPJ(empresa.cnpj)).catch(() => {});
    setCopiado(true);
    setTimeout(() => setCopiado(false), 3000);
    window.open(link.url, '_blank', 'noopener,noreferrer');
  };

  const registrar = async (dados: CNDAnalysisResult, exemplo: boolean) => {
    setResultado({ esfera, dados, exemplo });
    // Exemplos servem só para demonstrar a leitura: não alteram a carteira.
    if (exemplo) return;
    const tipo = dados.classification.tipo;
    await updatePendenciasInCarteira(
      empresa.cnpj,
      esfera === 'federal'
        ? { cndFederal: tipo, cndFederalValidade: dados.classification.validade || undefined }
        : { cndEstadual: tipo, cndEstadualValidade: dados.classification.validade || undefined },
    );
    onRefreshPortfolioSummary?.();
  };

  const analisar = async (payload: Parameters<typeof analyzeCndPdf>[0], exemplo = false) => {
    setAnalisando(true);
    setErro(null);
    try {
      await registrar(await analyzeCndPdf({ ...payload, cnpj: exemplo ? undefined : empresa.cnpj, esfera }), exemplo);
    } catch (err: any) {
      setErro(err.message || 'Erro ao analisar a certidão.');
    } finally {
      setAnalisando(false);
    }
  };

  // Robô no servidor: abre o portal da Receita, informa o CNPJ e captura o PDF.
  const buscarNoServidor = async () => {
    setErro(null);
    setRoboEtapa('Iniciando o robô...');
    try {
      const jobId = await iniciarEmissaoCndFederal(empresa.cnpj);
      for (;;) {
        await new Promise(r => setTimeout(r, 2000));
        const job = await fetchJob<CNDAnalysisResult>(jobId);
        if (job.status === 'concluido' && job.resultado) {
          setResultado({ esfera: 'federal', dados: job.resultado, exemplo: false });
          onRefreshPortfolioSummary?.();
          break;
        }
        if (job.status === 'erro') {
          setErro(job.erro || 'O robô não conseguiu emitir a certidão.');
          break;
        }
        setCaptchaJobId(job.status === 'aguardando_humano' ? jobId : null);
        setRoboEtapa(job.status === 'na_fila' ? 'Na fila (um robô por vez)...' : job.etapa);
      }
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setRoboEtapa(null);
      setCaptchaJobId(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => analisar({ pdfBase64: reader.result as string, fileName: file.name });
    reader.onerror = () => setErro('Não foi possível ler o arquivo.');
    reader.readAsDataURL(file);
  };

  const renderBadge = (tipo: TipoCertidao) => {
    const estilos: Record<TipoCertidao, { caixa: string; icone: React.ReactNode; titulo: string }> = {
      NEGATIVA: { caixa: 'bg-emerald-50 border-emerald-500 text-emerald-900', icone: <CheckCircle className="w-6 h-6 text-emerald-600" />, titulo: 'Certidão negativa — em dia' },
      POSITIVA_COM_EFEITO_DE_NEGATIVA: {
        caixa: 'bg-amber-50 border-amber-500 text-amber-950',
        icone: <AlertTriangle className="w-6 h-6 text-amber-600" />,
        titulo: 'Positiva com efeito de negativa — pendência negociada',
      },
      POSITIVA: { caixa: 'bg-rose-50 border-rose-600 text-rose-950', icone: <XCircle className="w-6 h-6 text-rose-600" />, titulo: 'Certidão positiva — há pendências' },
      INCONCLUSIVA: { caixa: 'bg-muted border-border text-foreground', icone: <HelpCircle className="w-6 h-6 text-muted-foreground" />, titulo: 'Certidão inconclusiva' },
    };
    const e = estilos[tipo];
    return (
      <div className={`p-4 rounded-xl border-2 ${e.caixa}`}>
        <div className="flex items-center gap-2 mb-1">
          {e.icone}
          <span className="text-lg font-serif font-semibold">{e.titulo}</span>
        </div>
        <p className="text-sm">{resultado?.dados.classification.diagnostico}</p>
      </div>
    );
  };

  const c = resultado?.dados.classification;

  return (
    <div className="bg-white rounded-2xl border border-border p-5 sm:p-7">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border gap-3 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary-50 text-primary">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Certidões negativas (CND)</h3>
            <p className="text-xs text-muted-foreground">Emita no portal oficial e envie o PDF: o sistema lê e classifica a certidão.</p>
          </div>
        </div>

        <div className="flex rounded-xl bg-muted p-1 self-start sm:self-center" role="tablist">
          {(['federal', 'estadual'] as Esfera[]).map(e => (
            <button
              key={e}
              role="tab"
              aria-selected={esfera === e}
              onClick={() => setEsfera(e)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                esfera === e ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {e === 'federal' ? 'Federal (RFB/PGFN)' : `Estadual (${uf || 'UF'})`}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <div className="p-4 rounded-xl bg-primary-50/70 border border-primary-100 space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">Portal oficial</div>
            {link ? (
              <>
                <div className="text-sm font-semibold text-foreground">{esfera === 'federal' ? CND_FEDERAL.nome : `${link.orgao} — certidão de débitos estaduais`}</div>
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="block text-xs font-mono text-primary break-all hover:underline">
                  {link.url}
                </a>
                {!link.conferido && <p className="text-[11px] text-accent-800">Endereço não confirmado recentemente: se não abrir, procure “certidão negativa” no site da SEFAZ.</p>}
                {link.observacao && <p className="text-[11px] text-muted-foreground">{link.observacao}</p>}
                {esfera === 'estadual' && ies.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Inscrição estadual: <span className="font-mono text-foreground">{ies.map(ie => ie.inscricao).join(', ')}</span>
                  </p>
                )}
                <button
                  onClick={abrirPortal}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-800 text-primary-foreground text-xs font-semibold transition cursor-pointer"
                >
                  {copiado ? <Check className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
                  {copiado ? 'CNPJ copiado — cole no portal' : 'Abrir portal e copiar CNPJ'}
                </button>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">UF da empresa não informada no cadastro.</p>
            )}
          </div>

          <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
            <li>Abra o portal (o CNPJ já vai copiado).</li>
            <li>Conclua a verificação de segurança e emita a certidão.</li>
            <li>Envie o PDF baixado ao lado.</li>
          </ol>

          {esfera === 'federal' && (
            <button
              onClick={buscarNoServidor}
              disabled={Boolean(roboEtapa)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-600 text-accent-foreground text-xs font-semibold transition disabled:opacity-60 cursor-pointer"
            >
              {roboEtapa ? <Loader2 className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />}
              {roboEtapa || 'Buscar CND automaticamente (robô no servidor)'}
            </button>
          )}

          {captchaJobId && <CaptchaRemoto jobId={captchaJobId} />}

          {esfera === 'federal' && (
            <button
              onClick={onOpenSeleniumModal}
              className="flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5" />
              Script de emissão assistida (preenche o CNPJ e envia o PDF sozinho)
            </button>
          )}

          <div className="p-3 rounded-xl bg-muted/70 text-xs space-y-1">
            <div className="font-semibold text-foreground">Situação registrada</div>
            <div className="text-muted-foreground">
              {ROTULO_STATUS[statusAtual || 'NAO_CONSULTADA']}
              {validadeAtual ? ` · válida até ${validadeAtual}` : ''}
            </div>
          </div>

          <div className="text-xs space-y-1">
            <div className="font-semibold text-foreground">Outras certidões</div>
            {OUTRAS_CERTIDOES.map(o => (
              <a key={o.url} href={o.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                <ExternalLink className="w-3 h-3" /> {o.nome}
              </a>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 space-y-4">
          <label className="relative block border-2 border-dashed border-border hover:border-primary-300 rounded-xl p-6 text-center bg-background hover:bg-primary-50/40 transition cursor-pointer">
            <input type="file" accept=".pdf,application/pdf" onChange={handleFileUpload} disabled={analisando} className="sr-only" />
            {analisando ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-sm font-semibold text-foreground">Lendo a certidão...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-primary-50 text-primary flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <p className="text-sm font-semibold text-foreground">Enviar o PDF da CND {esfera === 'federal' ? 'federal' : 'estadual'}</p>
                <p className="text-xs text-muted-foreground">O arquivo fica guardado em Arquivos › CNDs.</p>
              </div>
            )}
          </label>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <button onClick={() => setMostrarColar(v => !v)} className="text-muted-foreground hover:text-primary underline cursor-pointer">
              {mostrarColar ? 'Ocultar' : 'Ou colar o texto da certidão'}
            </button>
            <button onClick={() => setMostrarExemplos(v => !v)} className="flex items-center gap-1 text-muted-foreground hover:text-primary cursor-pointer">
              Ver exemplos de leitura <ChevronDown className={`w-3.5 h-3.5 transition ${mostrarExemplos ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {mostrarColar && (
            <div className="p-3 rounded-xl bg-muted/70 space-y-2">
              <textarea
                rows={4}
                value={textoColado}
                onChange={e => setTextoColado(e.target.value)}
                placeholder="Cole aqui o texto da certidão"
                className="w-full p-2.5 text-xs font-mono rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary-200"
              />
              <div className="flex justify-end">
                <button
                  onClick={() => analisar({ rawText: textoColado, fileName: 'texto-colado.txt' })}
                  disabled={!textoColado.trim() || analisando}
                  className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary-800 text-primary-foreground text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
                >
                  Analisar texto
                </button>
              </div>
            </div>
          )}

          {mostrarExemplos && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Exemplos (não alteram a carteira):</span>
              {(
                [
                  ['negativa', 'Negativa'],
                  ['positivaComEfeitosNegativa', 'Positiva c/ efeito de negativa'],
                  ['positiva', 'Positiva'],
                ] as const
              ).map(([chave, rotulo]) => (
                <button
                  key={chave}
                  onClick={() => analisar({ rawText: SAMPLE_CND_TEXTS[chave], fileName: `exemplo-${chave}.txt` }, true)}
                  className="px-2 py-1 rounded-lg bg-muted hover:bg-primary-50 text-foreground border border-border transition cursor-pointer"
                >
                  {rotulo}
                </button>
              ))}
            </div>
          )}

          {erro && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {resultado && c && (
            <div className="p-4 rounded-2xl border border-border space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {resultado.exemplo ? 'Exemplo' : `Certidão ${resultado.esfera}`} · <span className="font-mono">{resultado.dados.fileName}</span>
                </span>
                <button onClick={() => setResultado(null)} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">
                  Limpar
                </button>
              </div>

              {renderBadge(c.tipo)}

              {c.vencida && (
                <div className="p-3 rounded-xl bg-accent-50 border border-accent-200 text-accent-800 text-xs flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Esta certidão já venceu ({c.validade}). Emita uma nova.
                </div>
              )}
              {c.cnpj_confere === false && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  O CNPJ da certidão ({c.cnpj_encontrado}) não é desta empresa ({formatCNPJ(empresa.cnpj)}).
                </div>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {[
                  { rotulo: 'Validade', valor: c.validade || '—', icone: <Calendar className="w-3.5 h-3.5 text-primary" /> },
                  { rotulo: 'Emissão', valor: c.emissao || '—', icone: <Calendar className="w-3.5 h-3.5 text-muted-foreground" /> },
                  { rotulo: 'Código de controle', valor: c.codigo_controle || '—', icone: <Key className="w-3.5 h-3.5 text-accent-600" /> },
                  { rotulo: 'CNPJ no documento', valor: c.cnpj_encontrado || '—', icone: <Copy className="w-3.5 h-3.5 text-muted-foreground" /> },
                ].map(item => (
                  <div key={item.rotulo} className="p-3 rounded-lg bg-muted/70">
                    <span className="text-muted-foreground block text-[10px] uppercase tracking-wide mb-0.5">{item.rotulo}</span>
                    <span className="font-semibold text-foreground flex items-center gap-1 break-all">
                      {item.icone}
                      {item.valor}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
