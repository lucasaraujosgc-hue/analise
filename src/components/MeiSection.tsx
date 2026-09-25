import React, { useEffect, useRef, useState } from 'react';
import { EmpresaData, JobMei, ResultadoMei, SituacaoCompetencia, SituacaoDeclaracao, StatusSistema, CompetenciaMei } from '../types/cnpj';
import {
  fetchJobMei,
  fetchResultadoMei,
  fetchStatusSistema,
  importarExtratoMei,
  iniciarConsultaMei,
  marcarDeclaracaoMei,
  savePdfToStorage,
} from '../services/api';
import { DASN_SIMEI_URL, PGMEI_URL } from '../data/cndLinks';
import { CaptchaRemoto } from './CaptchaRemoto';
import { formatCNPJ, formatCurrency } from '../utils/formatters';
import {
  AlertCircle, AlertTriangle, CheckCircle2, ClipboardCopy, ExternalLink, FileWarning, HardDrive,
  Loader2, Play, Receipt, Upload, Check,
} from 'lucide-react';

interface MeiSectionProps {
  empresa: EmpresaData;
  isMei: boolean;
  setIsMei: (val: boolean) => void;
  onRefreshPortfolioSummary?: () => void;
}

const EM_ABERTO: SituacaoCompetencia[] = ['EM_ABERTO', 'A_VENCER', 'DIVIDA_ATIVA', 'BLOQUEADO_DASN', 'ABAIXO_MINIMO', 'REAPURACAO_NECESSARIA'];

const SITUACAO: Record<SituacaoCompetencia, { rotulo: string; classe: string }> = {
  EM_ABERTO: { rotulo: 'Vencida', classe: 'bg-rose-50 text-rose-800 border-rose-200' },
  A_VENCER: { rotulo: 'A vencer', classe: 'bg-accent-50 text-accent-800 border-accent-200' },
  DIVIDA_ATIVA: { rotulo: 'Dívida ativa (PGFN)', classe: 'bg-rose-100 text-rose-900 border-rose-300' },
  BLOQUEADO_DASN: { rotulo: 'Falta DASN', classe: 'bg-accent-100 text-accent-800 border-accent-300' },
  ABAIXO_MINIMO: { rotulo: 'Abaixo de R$ 10', classe: 'bg-muted text-muted-foreground border-border' },
  REAPURACAO_NECESSARIA: { rotulo: 'Refazer apuração', classe: 'bg-accent-50 text-accent-800 border-accent-200' },
  PAGO: { rotulo: 'Pago', classe: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  PARCELADO: { rotulo: 'Parcelado', classe: 'bg-primary-50 text-primary border-primary-200' },
  DEBITO_AUTOMATICO: { rotulo: 'Débito automático', classe: 'bg-primary-50 text-primary border-primary-200' },
  SEM_DEBITO: { rotulo: 'Sem débito', classe: 'bg-muted text-muted-foreground border-border' },
  NAO_OPTANTE: { rotulo: 'Não optante', classe: 'bg-muted text-muted-foreground border-border' },
  ERRO: { rotulo: 'Erro', classe: 'bg-muted text-muted-foreground border-border' },
};

const DECLARACAO: Record<SituacaoDeclaracao, { rotulo: string; classe: string }> = {
  PENDENTE: { rotulo: 'Em atraso', classe: 'bg-rose-50 text-rose-800 border-rose-200' },
  ENTREGUE: { rotulo: 'Entregue', classe: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  NAO_VERIFICADA: { rotulo: 'Não verificada', classe: 'bg-muted text-muted-foreground border-border' },
};

function valor(v?: number) {
  return v === undefined ? '—' : formatCurrency(v);
}

function textoResumo(empresa: EmpresaData, r: ResultadoMei): string {
  const abertas = r.competencias.filter(c => EM_ABERTO.includes(c.situacao));
  const linhas = [
    `MEI ${empresa.razao_social} — CNPJ ${formatCNPJ(empresa.cnpj)}`,
    `Consulta ao PGMEI em ${new Date(r.consultadoEm).toLocaleString('pt-BR')}`,
    '',
    abertas.length ? 'Guias DAS em aberto:' : 'Nenhuma guia DAS em aberto.',
    ...abertas.map(
      c => `- ${c.periodo}: ${valor(c.total)} (${SITUACAO[c.situacao].rotulo.toLowerCase()}${c.vencimento ? `, venc. ${c.vencimento}` : ''})`,
    ),
    '',
    `Total em aberto: ${formatCurrency(r.resumo.totalGeral)}`,
    r.resumo.declaracoesPendentes.length
      ? `DASN-SIMEI em atraso: ${r.resumo.declaracoesPendentes.join(', ')}`
      : 'Nenhuma DASN-SIMEI em atraso identificada.',
  ];
  return linhas.join('\n');
}

export const MeiSection: React.FC<MeiSectionProps> = ({ empresa, isMei, setIsMei, onRefreshPortfolioSummary }) => {
  const [resultado, setResultado] = useState<ResultadoMei | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [status, setStatus] = useState<StatusSistema | null>(null);
  const [job, setJob] = useState<JobMei | null>(null);
  const [erro, setErro] = useState<{ texto: string; bloqueado?: boolean } | null>(null);
  const [maxAnos, setMaxAnos] = useState(6);
  const [verificarDasn, setVerificarDasn] = useState(true);
  const [mostrarTodas, setMostrarTodas] = useState(false);
  const [importarAberto, setImportarAberto] = useState(false);
  const [textoExtrato, setTextoExtrato] = useState('');
  const [textoDeclaracoes, setTextoDeclaracoes] = useState('');
  const [importando, setImportando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let ativo = true;
    Promise.all([fetchResultadoMei(empresa.cnpj).catch(() => null), fetchStatusSistema()]).then(([r, s]) => {
      if (!ativo) return;
      setResultado(r);
      setStatus(s);
      setCarregando(false);
    });
    return () => {
      ativo = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [empresa.cnpj]);

  const mostrarAviso = (texto: string) => {
    setAviso(texto);
    setTimeout(() => setAviso(null), 4000);
  };

  const acompanhar = (jobId: string) => {
    timer.current = setTimeout(async () => {
      try {
        const atual = await fetchJobMei(jobId);
        setJob(atual);
        if (atual.status === 'concluido' && atual.resultado) {
          setResultado(atual.resultado);
          setJob(null);
          onRefreshPortfolioSummary?.();
        } else if (atual.status === 'erro') {
          setErro({ texto: atual.erro || 'Falha na consulta.', bloqueado: atual.bloqueado });
          setJob(null);
        } else {
          acompanhar(jobId);
        }
      } catch (err: any) {
        setErro({ texto: err.message });
        setJob(null);
      }
    }, 2000);
  };

  const consultar = async () => {
    setErro(null);
    try {
      const jobId = await iniciarConsultaMei(empresa.cnpj, { maxAnos, verificarDasn });
      setJob({ id: jobId, cnpj: empresa.cnpj, status: 'na_fila', etapa: 'Iniciando...', atual: 0, total: 0 });
      acompanhar(jobId);
    } catch (err: any) {
      setErro({ texto: err.message });
    }
  };

  const importar = async () => {
    setImportando(true);
    setErro(null);
    try {
      const r = await importarExtratoMei(empresa.cnpj, { texto: textoExtrato || undefined, textoDeclaracoes: textoDeclaracoes || undefined });
      setResultado(r);
      setImportarAberto(false);
      setTextoExtrato('');
      setTextoDeclaracoes('');
      onRefreshPortfolioSummary?.();
      mostrarAviso(`${r.competencias.length} competência(s) importada(s).`);
    } catch (err: any) {
      setErro({ texto: err.message });
    } finally {
      setImportando(false);
    }
  };

  const marcar = async (ano: number, situacao: SituacaoDeclaracao) => {
    try {
      setResultado(await marcarDeclaracaoMei(empresa.cnpj, ano, situacao));
      onRefreshPortfolioSummary?.();
    } catch (err: any) {
      setErro({ texto: err.message });
    }
  };

  const copiarResumo = () => {
    if (!resultado) return;
    navigator.clipboard.writeText(textoResumo(empresa, resultado));
    mostrarAviso('Resumo copiado — pronto para enviar ao cliente.');
  };

  const salvarRelatorio = async () => {
    if (!resultado) return;
    try {
      const res = await savePdfToStorage({
        cnpj: empresa.cnpj,
        tipo: 'DAS_MEI',
        filename: `MEI_${empresa.cnpj}_${new Date().toISOString().slice(0, 10)}.txt`,
        textContent: textoResumo(empresa, resultado),
      });
      mostrarAviso(`Relatório salvo em Arquivos: ${res.filename}`);
    } catch (err: any) {
      setErro({ texto: err.message });
    }
  };

  if (!isMei) {
    return (
      <div className="bg-white rounded-2xl border border-border p-5 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-muted text-muted-foreground">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">MEI — guias DAS e DASN-SIMEI</h3>
            <p className="text-xs text-muted-foreground">Segundo a Receita, esta empresa não é optante pelo SIMEI.</p>
          </div>
        </div>
        <button
          onClick={() => setIsMei(true)}
          className="px-4 py-2 rounded-xl bg-white hover:bg-muted text-foreground border border-border font-semibold text-xs transition cursor-pointer self-start sm:self-center"
        >
          Consultar como MEI mesmo assim
        </button>
      </div>
    );
  }

  const roboIndisponivel = status && !status.robo_pgmei.disponivel;
  const competenciasVisiveis: CompetenciaMei[] = resultado
    ? resultado.competencias.filter(c => mostrarTodas || EM_ABERTO.includes(c.situacao))
    : [];
  const r = resultado?.resumo;

  return (
    <div className="bg-white rounded-2xl border border-border overflow-hidden">
      <div className="h-1.5 bg-accent" />
      <div className="p-5 sm:p-7 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide bg-accent-100 text-accent-800">
              MEI · SIMEI
            </span>
            <h3 className="text-xl font-semibold text-foreground mt-2">Guias DAS em aberto e declarações DASN-SIMEI</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {resultado
                ? `Última consulta: ${new Date(resultado.consultadoEm).toLocaleString('pt-BR')} · ${
                    resultado.fonte === 'PGMEI_ROBO' ? 'robô no portal PGMEI' : 'extrato importado do PGMEI'
                  }`
                : 'Consulta gratuita no portal público do PGMEI — sem certificado digital e sem API paga.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a href={PGMEI_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-xl border border-border hover:bg-muted transition">
              PGMEI <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <a href={DASN_SIMEI_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-xl border border-border hover:bg-muted transition">
              DASN-SIMEI <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={() => setImportarAberto(v => !v)}
              className="flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-xl border border-border hover:bg-muted transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" /> Importar extrato
            </button>
            <button
              onClick={consultar}
              disabled={Boolean(job) || Boolean(roboIndisponivel)}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-primary hover:bg-primary-800 text-primary-foreground transition disabled:opacity-50 cursor-pointer"
            >
              {job ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {job ? 'Consultando...' : resultado ? 'Consultar de novo' : 'Consultar PGMEI agora'}
            </button>
          </div>
        </div>

        {!job && (
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <label className="flex items-center gap-1.5">
              Anos a verificar:
              <select value={maxAnos} onChange={e => setMaxAnos(Number(e.target.value))} className="px-2 py-1 rounded-lg border border-border bg-white text-foreground">
                <option value={3}>3 últimos</option>
                <option value={6}>6 últimos</option>
                <option value={10}>10 últimos</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={verificarDasn} onChange={e => setVerificarDasn(e.target.checked)} className="accent-[var(--color-primary)]" />
              Verificar também as declarações no DASN-SIMEI
            </label>
          </div>
        )}

        {roboIndisponivel && (
          <div className="p-3 rounded-xl bg-accent-50 border border-accent-200 text-accent-800 text-xs">
            O navegador (Chromium) usado pelo robô não foi encontrado no servidor. Use “Importar extrato” ou instale o Chromium / defina CHROME_PATH.
          </div>
        )}

        {job && (
          <div className="p-4 rounded-xl bg-primary-50 border border-primary-100 space-y-2">
            <div className="flex items-center gap-2 text-sm text-primary font-medium">
              <Loader2 className="w-4 h-4 animate-spin" />
              {job.status === 'na_fila' ? 'Na fila (uma consulta por vez)...' : job.etapa}
            </div>
            <div className="h-1.5 rounded-full bg-primary-100 overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: job.total ? `${Math.max(8, (job.atual / job.total) * 100)}%` : '12%' }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">O robô navega no PGMEI como uma pessoa faria; costuma levar de 30 s a 2 min.</p>
            {job.status === 'aguardando_humano' && <CaptchaRemoto jobId={job.id} />}
          </div>
        )}

        {erro && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p>{erro.texto}</p>
              {erro.bloqueado && (
                <button onClick={() => setImportarAberto(true)} className="font-semibold underline cursor-pointer">
                  Importar a tabela do PGMEI manualmente
                </button>
              )}
            </div>
          </div>
        )}

        {aviso && (
          <div className="p-3 rounded-xl bg-primary-50 border border-primary-200 text-primary text-xs flex items-center gap-2">
            <Check className="w-4 h-4" /> {aviso}
          </div>
        )}

        {importarAberto && (
          <div className="p-4 rounded-2xl bg-muted/70 border border-border space-y-3">
            <p className="text-xs text-muted-foreground">
              No PGMEI, abra “Emitir Guia de Pagamento (DAS)”, escolha o ano, selecione a tabela inteira com o mouse, copie (Ctrl+C) e cole abaixo.
              Repita para cada ano. Para as declarações, copie a lista de declarações transmitidas do DASN-SIMEI (opcional).
            </p>
            <textarea
              rows={5}
              value={textoExtrato}
              onChange={e => setTextoExtrato(e.target.value)}
              placeholder={'Fevereiro/2026\tNão\tDevedor\tNão\t81,05\t16,21\t4,86\t102,12\t20/03/2026\t30/09/2026'}
              className="w-full p-3 rounded-xl bg-white border border-border text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
            <textarea
              rows={2}
              value={textoDeclaracoes}
              onChange={e => setTextoDeclaracoes(e.target.value)}
              placeholder="(opcional) Lista de declarações do DASN-SIMEI — ex.: 2024  Original  Transmitida em 10/05/2025"
              className="w-full p-3 rounded-xl bg-white border border-border text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setImportarAberto(false)} className="px-3 py-1.5 rounded-lg border border-border text-xs bg-white cursor-pointer">
                Cancelar
              </button>
              <button
                onClick={importar}
                disabled={importando || (!textoExtrato.trim() && !textoDeclaracoes.trim())}
                className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary-800 text-primary-foreground font-semibold text-xs transition disabled:opacity-50 cursor-pointer"
              >
                {importando ? 'Importando...' : 'Importar'}
              </button>
            </div>
          </div>
        )}

        {carregando && !resultado && <p className="text-xs text-muted-foreground">Carregando última consulta...</p>}

        {!carregando && !resultado && !job && (
          <div className="p-6 rounded-2xl border border-dashed border-border text-center space-y-2">
            <Receipt className="w-8 h-8 text-accent mx-auto" />
            <p className="text-sm font-semibold text-foreground">Nenhuma consulta do MEI ainda</p>
            <p className="text-xs text-muted-foreground max-w-lg mx-auto">
              Clique em “Consultar PGMEI agora” para listar as competências em aberto com o valor de cada uma (principal, multa, juros e total) e
              descobrir declarações DASN-SIMEI em atraso.
            </p>
          </div>
        )}

        {resultado && r && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-primary text-primary-foreground sm:col-span-2 lg:col-span-1">
                <div className="text-xs font-medium text-primary-200">Total em aberto</div>
                <div className="text-3xl font-serif font-semibold mt-1">{formatCurrency(r.totalGeral)}</div>
                <div className="text-[11px] text-primary-200 mt-1">
                  {r.qtdEmAberto + r.qtdDividaAtiva} competência(s)
                  {r.qtdSemValor ? ` · ${r.qtdSemValor} sem valor informado` : ''}
                </div>
              </div>
              <div className="p-5 rounded-2xl border border-border">
                <div className="text-xs font-medium text-muted-foreground">Vencidas</div>
                <div className="text-2xl font-serif font-semibold text-rose-700 mt-1">{formatCurrency(r.totalVencido)}</div>
                <div className="text-[11px] text-muted-foreground mt-1">{r.qtdVencidas} guia(s) com multa e juros</div>
              </div>
              <div className="p-5 rounded-2xl border border-border">
                <div className="text-xs font-medium text-muted-foreground">Dívida ativa (PGFN)</div>
                <div className="text-2xl font-serif font-semibold text-foreground mt-1">{formatCurrency(r.totalDividaAtiva)}</div>
                <div className="text-[11px] text-muted-foreground mt-1">{r.qtdDividaAtiva} competência(s) — pagar pela PGFN</div>
              </div>
              <div className="p-5 rounded-2xl border border-border">
                <div className="text-xs font-medium text-muted-foreground">DASN-SIMEI em atraso</div>
                <div className={`text-2xl font-serif font-semibold mt-1 ${r.declaracoesPendentes.length ? 'text-accent-700' : 'text-emerald-700'}`}>
                  {r.declaracoesPendentes.length || 'Nenhuma'}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  {r.declaracoesPendentes.length ? `Anos: ${r.declaracoesPendentes.join(', ')}` : 'entre os anos verificados'}
                </div>
              </div>
            </div>

            <div className="border border-border rounded-xl overflow-hidden">
              <div className="bg-muted/70 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-xs text-foreground uppercase tracking-wide">
                  {mostrarTodas ? 'Todas as competências verificadas' : 'Competências em aberto'}
                </span>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={mostrarTodas} onChange={e => setMostrarTodas(e.target.checked)} />
                  Mostrar também as pagas
                </label>
              </div>

              {competenciasVisiveis.length === 0 ? (
                <div className="p-6 text-center text-sm text-emerald-700 flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Nenhuma guia em aberto nos anos verificados.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead className="text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="px-4 py-2.5 text-left font-medium">Competência</th>
                        <th className="px-4 py-2.5 text-left font-medium">Vencimento</th>
                        <th className="px-4 py-2.5 text-left font-medium">Situação</th>
                        <th className="px-4 py-2.5 text-right font-medium">Principal</th>
                        <th className="px-4 py-2.5 text-right font-medium">Multa</th>
                        <th className="px-4 py-2.5 text-right font-medium">Juros</th>
                        <th className="px-4 py-2.5 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {competenciasVisiveis.map(c => (
                        <tr key={c.periodoApuracao} className="hover:bg-muted/50">
                          <td className="px-4 py-2.5 font-mono font-semibold text-foreground">{c.periodo}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{c.vencimento || '—'}</td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded border text-[10px] font-semibold ${SITUACAO[c.situacao].classe}`} title={c.mensagem}>
                              {SITUACAO[c.situacao].rotulo}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono">{valor(c.principal)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-rose-700">{valor(c.multa)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-rose-700">{valor(c.juros)}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold text-foreground">{valor(c.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    {!mostrarTodas && (
                      <tfoot>
                        <tr className="border-t-2 border-border bg-muted/50">
                          <td colSpan={6} className="px-4 py-2.5 text-right font-semibold text-foreground">
                            Total em aberto
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-foreground">{formatCurrency(r.totalGeral)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground -mt-3">
              Multa e juros valem para pagamento até a “data de acolhimento” do PGMEI; depois disso o valor é recalculado.
            </p>

            <div className="border border-border rounded-xl overflow-hidden">
              <div className="bg-muted/70 px-4 py-3 flex items-center gap-2">
                <FileWarning className="w-4 h-4 text-accent-700" />
                <span className="font-semibold text-xs text-foreground uppercase tracking-wide">Declarações anuais (DASN-SIMEI)</span>
              </div>
              {resultado.declaracoes.length === 0 ? (
                <p className="p-4 text-xs text-muted-foreground">Nenhum ano-calendário exigível ainda.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {resultado.declaracoes.map(d => (
                    <li key={d.ano} className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-semibold text-foreground w-10">{d.ano}</span>
                        <span className={`px-2 py-0.5 rounded border text-[10px] font-semibold ${DECLARACAO[d.situacao].classe}`}>
                          {DECLARACAO[d.situacao].rotulo}
                        </span>
                        <span className="text-muted-foreground">
                          prazo {d.prazo}
                          {d.fonte ? ` · fonte: ${d.fonte}` : ''}
                          {d.observacao ? ` · ${d.observacao}` : ''}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {d.situacao !== 'ENTREGUE' && (
                          <button onClick={() => marcar(d.ano, 'ENTREGUE')} className="px-2 py-1 rounded-lg border border-border hover:bg-muted cursor-pointer">
                            Marcar entregue
                          </button>
                        )}
                        {d.situacao !== 'PENDENTE' && (
                          <button onClick={() => marcar(d.ano, 'PENDENTE')} className="px-2 py-1 rounded-lg border border-border hover:bg-muted cursor-pointer">
                            Marcar em atraso
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="px-4 py-2.5 text-[11px] text-muted-foreground border-t border-border">
                DASN-SIMEI entregue fora do prazo gera multa (MAED) de no mínimo R$ 50,00 por declaração.
              </p>
            </div>

            {resultado.avisos.length > 0 && (
              <div className="p-3 rounded-xl bg-accent-50 border border-accent-200 text-accent-800 text-xs space-y-1">
                {resultado.avisos.map((a, i) => (
                  <p key={i} className="flex gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {a}
                  </p>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button onClick={copiarResumo} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-border hover:bg-muted transition cursor-pointer">
                <ClipboardCopy className="w-3.5 h-3.5 text-primary" /> Copiar resumo para o cliente
              </button>
              <button onClick={salvarRelatorio} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-border hover:bg-muted transition cursor-pointer">
                <HardDrive className="w-3.5 h-3.5 text-primary" /> Salvar relatório em Arquivos
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
