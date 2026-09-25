import React, { useEffect, useRef, useState } from 'react';
import { EmpresaData, FinalidadeRoteiro, PassoRpa, RoteiroRpa } from '../types/cnpj';
import { fetchJob, rpa } from '../services/api';
import { CND_ESTADUAL, CND_FEDERAL } from '../data/cndLinks';
import { CaptchaRemoto } from './CaptchaRemoto';
import {
  Bot, Circle, Clock, FileDown, Keyboard, Loader2, MousePointerClick, Pencil, Play, Plus, Save, ArrowDown, ArrowUp,
  Trash2, X, Globe, CheckCircle2, AlertCircle,
} from 'lucide-react';

interface RpaStudioProps {
  isOpen: boolean;
  onClose: () => void;
  empresa?: EmpresaData | null;
  onExecutado?: () => void;
}

const LARGURA = 1366;
const ALTURA = 768;
const VARIAVEIS = ['cnpj', 'cnpj_formatado', 'inscricao_estadual', 'razao_social', 'uf'];
const UFS = Object.keys(CND_ESTADUAL);

const ROTULO_FINALIDADE: Record<FinalidadeRoteiro, string> = {
  CND_FEDERAL: 'CND Federal',
  CND_ESTADUAL: 'CND Estadual',
  OUTRO: 'Outro documento',
};

function descrever(p: PassoRpa): string {
  switch (p.tipo) {
    case 'clique': {
      if (p.alvo.texto) return `Clicar em “${p.alvo.texto}”`;
      const atributo = p.alvo.seletor?.match(/\[(?:placeholder|aria-label|name|title)="([^"]+)"\]/)?.[1];
      if (atributo) return `Clicar no campo “${atributo}”`;
      if (p.alvo.seletor) return `Clicar em ${p.alvo.tag || 'elemento'}`;
      return `Clicar no ponto (${Math.round(p.alvo.x)}, ${Math.round(p.alvo.y)})`;
    }
    case 'digitar':
      return `Digitar “${p.valor}”`;
    case 'tecla':
      return `Tecla ${p.tecla}`;
    case 'rolar':
      return p.dy > 0 ? 'Rolar para baixo' : 'Rolar para cima';
    case 'esperar':
      return `Esperar ${(p.ms / 1000).toFixed(1)} s`;
    case 'navegar':
      return `Ir para ${p.url}`;
    case 'aguardarPdf':
      return `Aguardar o PDF (até ${Math.round(p.timeoutMs / 1000)} s)`;
  }
}

function urlPadrao(finalidade: FinalidadeRoteiro, uf: string) {
  if (finalidade === 'CND_FEDERAL') return CND_FEDERAL.url;
  if (finalidade === 'CND_ESTADUAL') return CND_ESTADUAL[uf]?.url || '';
  return '';
}

type Execucao = { roteiroId: string; jobId?: string; etapa: string; status?: string; erro?: string; resultado?: any };

export const RpaStudio: React.FC<RpaStudioProps> = ({ isOpen, onClose, empresa, onExecutado }) => {
  const [roteiros, setRoteiros] = useState<RoteiroRpa[]>([]);
  const [modo, setModo] = useState<'lista' | 'gravar'>('lista');
  const [erro, setErro] = useState<string | null>(null);

  // Roteiro em edição
  const [editId, setEditId] = useState<string | undefined>();
  const [nome, setNome] = useState('');
  const [finalidade, setFinalidade] = useState<FinalidadeRoteiro>('CND_FEDERAL');
  const [uf, setUf] = useState(empresa?.endereco.uf || 'BA');
  const [urlInicial, setUrlInicial] = useState(CND_FEDERAL.url);
  const [cnpjExemplo, setCnpjExemplo] = useState(empresa?.cnpj || '');
  const [passos, setPassos] = useState<PassoRpa[]>([]);

  // Gravação ao vivo
  const [sessaoId, setSessaoId] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [versao, setVersao] = useState(0);
  const [texto, setTexto] = useState('');
  const [limpar, setLimpar] = useState(true);
  const [esperaSeg, setEsperaSeg] = useState(3);
  const [irPara, setIrPara] = useState('');
  const campoTexto = useRef<HTMLInputElement>(null);

  // Teste de execução
  const [cnpjTeste, setCnpjTeste] = useState(empresa?.cnpj || '');
  const [execucao, setExecucao] = useState<Execucao | null>(null);

  const carregar = () => rpa.listar().then(setRoteiros).catch(e => setErro(e.message));

  useEffect(() => {
    if (!isOpen) return;
    carregar();
    setCnpjTeste(empresa?.cnpj || '');
    setCnpjExemplo(empresa?.cnpj || '');
  }, [isOpen]);

  // Atualiza a imagem da tela enquanto grava.
  useEffect(() => {
    if (!sessaoId) return;
    const t = setInterval(() => setVersao(v => v + 1), 800);
    return () => clearInterval(t);
  }, [sessaoId]);

  const fecharSessao = async () => {
    if (sessaoId) await rpa.fecharSessao(sessaoId);
    setSessaoId(null);
  };

  const fechar = async () => {
    await fecharSessao();
    setModo('lista');
    onClose();
  };

  const novo = () => {
    setEditId(undefined);
    setNome('');
    setFinalidade('CND_FEDERAL');
    setUrlInicial(CND_FEDERAL.url);
    setPassos([]);
    setErro(null);
    setModo('gravar');
  };

  const editar = (r: RoteiroRpa) => {
    setEditId(r.id);
    setNome(r.nome);
    setFinalidade(r.finalidade);
    setUf(r.uf || empresa?.endereco.uf || 'BA');
    setUrlInicial(r.urlInicial);
    setPassos(r.passos);
    setErro(null);
    setModo('gravar');
  };

  const abrirNavegador = async (continuar: boolean) => {
    setAbrindo(true);
    setErro(null);
    try {
      const s = await rpa.abrirSessao({ url: urlInicial, cnpjExemplo, passosIniciais: continuar ? passos : [] });
      setSessaoId(s.id);
      setPassos(s.passos);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setAbrindo(false);
    }
  };

  const acao = async (dados: Record<string, unknown>) => {
    if (!sessaoId) return;
    setOcupado(true);
    setErro(null);
    try {
      setPassos((await rpa.acao(sessaoId, dados)).passos);
    } catch (e: any) {
      setErro(e.message);
      if (/encerrada/i.test(e.message)) setSessaoId(null);
    } finally {
      setOcupado(false);
      setVersao(v => v + 1);
    }
  };

  const cliqueNaTela = (e: React.MouseEvent<HTMLImageElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    acao({ tipo: 'clique', x: ((e.clientX - rect.left) / rect.width) * LARGURA, y: ((e.clientY - rect.top) / rect.height) * ALTURA });
  };

  const alterarPassos = async (novos: PassoRpa[]) => {
    setPassos(novos);
    if (sessaoId) await rpa.editarPassos(sessaoId, novos).catch(() => {});
  };

  const atualizarPasso = (i: number, mudanca: Partial<PassoRpa>) =>
    alterarPassos(passos.map((p, j) => (j === i ? ({ ...p, ...mudanca } as PassoRpa) : p)));

  const moverPasso = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= passos.length) return;
    const novos = [...passos];
    [novos[i], novos[j]] = [novos[j], novos[i]];
    alterarPassos(novos);
  };

  const salvar = async () => {
    setErro(null);
    try {
      await rpa.salvar({ id: editId, nome, finalidade, uf: finalidade === 'CND_ESTADUAL' ? uf : undefined, urlInicial, passos });
      await fecharSessao();
      await carregar();
      setModo('lista');
    } catch (e: any) {
      setErro(e.message);
    }
  };

  const executar = async (r: RoteiroRpa) => {
    setExecucao({ roteiroId: r.id, etapa: 'Iniciando...' });
    try {
      const jobId = await rpa.executar(r.id, cnpjTeste);
      for (;;) {
        await new Promise(res => setTimeout(res, 2000));
        const job = await fetchJob<any>(jobId);
        setExecucao({ roteiroId: r.id, jobId, etapa: job.etapa, status: job.status, erro: job.erro, resultado: job.resultado });
        if (job.status === 'concluido' || job.status === 'erro') break;
      }
      onExecutado?.();
    } catch (e: any) {
      setExecucao({ roteiroId: r.id, etapa: '', status: 'erro', erro: e.message });
    }
  };

  const inserirVariavel = (v: string) => {
    setTexto(t => `${t}{{${v}}}`);
    campoTexto.current?.focus();
  };

  if (!isOpen) return null;

  const botao = 'flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-border bg-white hover:bg-muted transition disabled:opacity-50 cursor-pointer';

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center p-2 sm:p-4 bg-primary-950/60 backdrop-blur-sm">
      <div className="bg-white border border-border rounded-2xl w-full max-w-[1500px] flex flex-col shadow-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary-50 text-primary">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Robôs (RPA)</h3>
              <p className="text-xs text-muted-foreground">Grave os passos num navegador que roda no servidor; o robô repete para qualquer empresa até gerar o PDF.</p>
            </div>
          </div>
          <button onClick={fechar} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition cursor-pointer" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        {erro && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {erro}
          </div>
        )}

        {modo === 'lista' ? (
          <div className="p-5 overflow-y-auto space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                CNPJ para testar:
                <input
                  value={cnpjTeste}
                  onChange={e => setCnpjTeste(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className="px-3 py-1.5 rounded-lg border border-border bg-background font-mono text-foreground"
                />
              </label>
              <button onClick={novo} className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-primary hover:bg-primary-800 text-primary-foreground cursor-pointer">
                <Plus className="w-4 h-4" /> Gravar novo roteiro
              </button>
            </div>

            {roteiros.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-border rounded-2xl space-y-2">
                <Bot className="w-9 h-9 text-accent mx-auto" />
                <p className="text-sm font-semibold text-foreground">Nenhum roteiro gravado</p>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Grave, por exemplo, a emissão da CND federal: clique no campo do CNPJ, digite {'{{cnpj}}'}, clique em “Emitir Certidão” e adicione
                  “Aguardar PDF”. Depois o botão “Buscar CND automaticamente” passa a usar esse roteiro.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border border border-border rounded-2xl">
                {roteiros.map(r => (
                  <li key={r.id} className="p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-sm text-foreground">{r.nome}</div>
                        <div className="text-xs text-muted-foreground">
                          {ROTULO_FINALIDADE[r.finalidade]}
                          {r.uf ? ` · ${r.uf}` : ''} · {r.passos.length} passo(s) · atualizado em {new Date(r.atualizadoEm).toLocaleString('pt-BR')}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => executar(r)} disabled={!cnpjTeste || Boolean(execucao && !execucao.status?.match(/concluido|erro/))} className={botao}>
                          <Play className="w-3.5 h-3.5 text-primary" /> Testar
                        </button>
                        <button onClick={() => editar(r)} className={botao}>
                          <Pencil className="w-3.5 h-3.5 text-primary" /> Editar
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`Excluir o roteiro "${r.nome}"?`)) return;
                            await rpa.excluir(r.id);
                            carregar();
                          }}
                          className={`${botao} hover:text-rose-700`}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Excluir
                        </button>
                      </div>
                    </div>

                    {execucao?.roteiroId === r.id && (
                      <div className="p-3 rounded-xl bg-muted/70 text-xs space-y-2">
                        {execucao.status === 'concluido' ? (
                          <p className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                            <CheckCircle2 className="w-4 h-4" />
                            {execucao.resultado?.classification
                              ? `Certidão ${execucao.resultado.classification.tipo.replace(/_/g, ' ').toLowerCase()} — salva em Arquivos (${execucao.resultado.fileName}).`
                              : execucao.resultado?.fileName
                                ? `PDF salvo em Arquivos: ${execucao.resultado.fileName}`
                                : 'Concluído, mas o portal não gerou PDF.'}
                          </p>
                        ) : execucao.status === 'erro' ? (
                          <p className="flex items-center gap-1.5 text-rose-700">
                            <AlertCircle className="w-4 h-4 shrink-0" /> {execucao.erro}
                          </p>
                        ) : (
                          <p className="flex items-center gap-1.5 text-primary">
                            <Loader2 className="w-4 h-4 animate-spin" /> {execucao.etapa}
                          </p>
                        )}
                        {execucao.status === 'aguardando_humano' && execucao.jobId && <CaptchaRemoto jobId={execucao.jobId} />}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[1fr_380px]">
            <div className="p-4 overflow-y-auto space-y-3 border-b xl:border-b-0 xl:border-r border-border">
              {!sessaoId ? (
                <div className="space-y-3 max-w-2xl">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="text-xs text-muted-foreground space-y-1">
                      <span>Nome do roteiro</span>
                      <input value={nome} onChange={e => setNome(e.target.value)} placeholder="CND Federal — Receita" className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground" />
                    </label>
                    <label className="text-xs text-muted-foreground space-y-1">
                      <span>Finalidade</span>
                      <div className="flex gap-2">
                        <select
                          value={finalidade}
                          onChange={e => {
                            const f = e.target.value as FinalidadeRoteiro;
                            setFinalidade(f);
                            setUrlInicial(urlPadrao(f, uf) || urlInicial);
                          }}
                          className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground"
                        >
                          {(Object.keys(ROTULO_FINALIDADE) as FinalidadeRoteiro[]).map(f => (
                            <option key={f} value={f}>
                              {ROTULO_FINALIDADE[f]}
                            </option>
                          ))}
                        </select>
                        {finalidade === 'CND_ESTADUAL' && (
                          <select
                            value={uf}
                            onChange={e => {
                              setUf(e.target.value);
                              setUrlInicial(urlPadrao('CND_ESTADUAL', e.target.value));
                            }}
                            className="px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground"
                          >
                            {UFS.map(u => (
                              <option key={u}>{u}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </label>
                  </div>
                  <label className="block text-xs text-muted-foreground space-y-1">
                    <span>URL inicial</span>
                    <input value={urlInicial} onChange={e => setUrlInicial(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm font-mono text-foreground" />
                  </label>
                  <label className="block text-xs text-muted-foreground space-y-1">
                    <span>CNPJ de exemplo (usado nas variáveis durante a gravação)</span>
                    <input value={cnpjExemplo} onChange={e => setCnpjExemplo(e.target.value)} className="w-full sm:w-72 px-3 py-2 rounded-xl border border-border bg-background text-sm font-mono text-foreground" />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => abrirNavegador(false)} disabled={abrindo || !urlInicial} className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-primary hover:bg-primary-800 text-primary-foreground disabled:opacity-50 cursor-pointer">
                      {abrindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Circle className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />}
                      {passos.length ? 'Gravar do zero' : 'Abrir navegador e gravar'}
                    </button>
                    {passos.length > 0 && (
                      <button onClick={() => abrirNavegador(true)} disabled={abrindo} className={botao}>
                        <Play className="w-3.5 h-3.5 text-primary" /> Repetir os passos e continuar gravando
                      </button>
                    )}
                    <button onClick={() => setModo('lista')} className={botao}>
                      Voltar
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Dica: clique na tela como num navegador. Para digitar, clique no campo e use a caixa “Digitar”. Termine com “Aguardar PDF”.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="flex items-center gap-1 text-rose-600 font-semibold">
                      <Circle className="w-3 h-3 fill-rose-500" /> Gravando
                    </span>
                    {ocupado && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                    <div className="flex-1" />
                    <input
                      value={irPara}
                      onChange={e => setIrPara(e.target.value)}
                      placeholder="https://..."
                      className="w-64 px-2.5 py-1.5 rounded-lg border border-border bg-background font-mono"
                    />
                    <button onClick={() => irPara && acao({ tipo: 'navegar', url: irPara })} className={botao}>
                      <Globe className="w-3.5 h-3.5" /> Ir
                    </button>
                  </div>

                  <img
                    src={`/api/rpa/sessoes/${sessaoId}/tela?v=${versao}`}
                    onClick={cliqueNaTela}
                    alt="Navegador do robô"
                    className={`w-full rounded-xl border-2 ${ocupado ? 'border-accent' : 'border-primary-200'} cursor-crosshair select-none`}
                    style={{ aspectRatio: `${LARGURA} / ${ALTURA}` }}
                    draggable={false}
                  />

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-muted/70 space-y-2">
                      <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Keyboard className="w-4 h-4 text-primary" /> Digitar no campo selecionado
                      </div>
                      <div className="flex gap-2">
                        <input
                          ref={campoTexto}
                          value={texto}
                          onChange={e => setTexto(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && texto) {
                              acao({ tipo: 'digitar', valor: texto, limpar });
                              setTexto('');
                            }
                          }}
                          placeholder="texto ou {{cnpj}}"
                          className="flex-1 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs font-mono"
                        />
                        <button
                          onClick={() => {
                            acao({ tipo: 'digitar', valor: texto, limpar });
                            setTexto('');
                          }}
                          disabled={!texto}
                          className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50 cursor-pointer"
                        >
                          Digitar
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {VARIAVEIS.map(v => (
                          <button key={v} onClick={() => inserirVariavel(v)} className="px-2 py-0.5 rounded-md bg-white border border-border text-[11px] font-mono text-primary cursor-pointer">
                            {`{{${v}}}`}
                          </button>
                        ))}
                      </div>
                      <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <input type="checkbox" checked={limpar} onChange={e => setLimpar(e.target.checked)} /> Apagar o conteúdo do campo antes
                      </label>
                    </div>

                    <div className="p-3 rounded-xl bg-muted/70 space-y-2 text-xs">
                      <div className="font-semibold text-foreground">Outras ações</div>
                      <div className="flex flex-wrap gap-1.5">
                        {['Enter', 'Tab', 'Escape'].map(t => (
                          <button key={t} onClick={() => acao({ tipo: 'tecla', tecla: t })} className={botao}>
                            {t}
                          </button>
                        ))}
                        <button onClick={() => acao({ tipo: 'rolar', dy: 400 })} className={botao}>
                          <ArrowDown className="w-3.5 h-3.5" /> Rolar
                        </button>
                        <button onClick={() => acao({ tipo: 'rolar', dy: -400 })} className={botao}>
                          <ArrowUp className="w-3.5 h-3.5" /> Rolar
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <input type="number" min={1} max={120} value={esperaSeg} onChange={e => setEsperaSeg(Number(e.target.value))} className="w-16 px-2 py-1.5 rounded-lg border border-border bg-white" />
                        <button onClick={() => acao({ tipo: 'esperar', ms: esperaSeg * 1000 })} className={botao}>
                          <Clock className="w-3.5 h-3.5" /> Adicionar espera (s)
                        </button>
                        <button onClick={() => acao({ tipo: 'aguardarPdf', timeoutMs: 90_000 })} className={botao}>
                          <FileDown className="w-3.5 h-3.5" /> Aguardar PDF
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-col min-h-0">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Passos ({passos.length})</span>
                <div className="flex gap-2">
                  {sessaoId && (
                    <button onClick={fecharSessao} className={botao}>
                      Parar
                    </button>
                  )}
                  <button onClick={salvar} disabled={!passos.length || !nome.trim()} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-primary hover:bg-primary-800 text-primary-foreground disabled:opacity-50 cursor-pointer" title={!nome.trim() ? 'Dê um nome ao roteiro' : undefined}>
                    <Save className="w-3.5 h-3.5" /> Salvar
                  </button>
                </div>
              </div>
              <ol className="flex-1 overflow-y-auto divide-y divide-border text-xs">
                {passos.length === 0 && <li className="p-4 text-muted-foreground">Os passos aparecem aqui conforme você usa o navegador.</li>}
                {passos.map((p, i) => (
                  <li key={i} className="p-3 space-y-1.5">
                    <div className="flex items-start gap-2">
                      <span className="w-5 text-muted-foreground font-mono">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-foreground flex items-center gap-1.5">
                          {p.tipo === 'clique' && <MousePointerClick className="w-3.5 h-3.5 text-primary shrink-0" />}
                          <span className="break-words">{descrever(p)}</span>
                        </div>
                        {p.tipo === 'digitar' && (
                          <input
                            value={p.valor}
                            onChange={e => atualizarPasso(i, { valor: e.target.value })}
                            className="mt-1 w-full px-2 py-1 rounded-md border border-border bg-background font-mono text-[11px]"
                          />
                        )}
                        <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                          {'esperaMs' in p && (
                            <label className="flex items-center gap-1">
                              espera depois
                              <input
                                type="number"
                                min={0}
                                step={0.5}
                                value={Math.round(p.esperaMs / 100) / 10}
                                onChange={e => atualizarPasso(i, { esperaMs: Number(e.target.value) * 1000 } as Partial<PassoRpa>)}
                                className="w-14 px-1.5 py-0.5 rounded border border-border bg-background"
                              />
                              s
                            </label>
                          )}
                          {p.tipo === 'esperar' && (
                            <label className="flex items-center gap-1">
                              <input type="number" min={0} step={0.5} value={Math.round(p.ms / 100) / 10} onChange={e => atualizarPasso(i, { ms: Number(e.target.value) * 1000 } as Partial<PassoRpa>)} className="w-14 px-1.5 py-0.5 rounded border border-border bg-background" />s
                            </label>
                          )}
                          {p.tipo === 'clique' && (
                            <label className="flex items-center gap-1" title="Se o elemento não existir (ex.: banner de cookies), pula o passo">
                              <input type="checkbox" checked={Boolean(p.opcional)} onChange={e => atualizarPasso(i, { opcional: e.target.checked } as Partial<PassoRpa>)} />
                              opcional
                            </label>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => moverPasso(i, -1)} className="p-0.5 text-muted-foreground hover:text-foreground cursor-pointer" aria-label="Subir">
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => moverPasso(i, 1)} className="p-0.5 text-muted-foreground hover:text-foreground cursor-pointer" aria-label="Descer">
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button onClick={() => alterarPassos(passos.filter((_, j) => j !== i))} className="p-1 text-muted-foreground hover:text-rose-700 cursor-pointer" aria-label="Apagar passo">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
