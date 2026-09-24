import React, { useState } from 'react';
import { EmpresaData, StatusCnd } from '../types/cnpj';
import {
  Building2, Plus, Search, Eye, Printer, RefreshCw, Trash2,
  CheckCircle2, AlertTriangle, XCircle, Phone, Mail, Copy, Check, ShieldAlert, Receipt, FileWarning,
} from 'lucide-react';
import { cleanCNPJ, formatCNPJ, formatCurrency } from '../utils/formatters';

interface PortfolioManagerProps {
  carteira: EmpresaData[];
  onSelectEmpresa: (empresa: EmpresaData) => void;
  onPrintReport: (empresa: EmpresaData) => void;
  onRefreshEmpresa: (cnpj: string) => Promise<void>;
  onRemoveEmpresa: (cnpj: string) => Promise<void> | void;
  onAddCnpj: (cnpj: string) => Promise<void>;
  isLoading: boolean;
}

function temPendencia(emp: EmpresaData): boolean {
  const p = emp.pendenciasResumo;
  return (
    (p?.guiasAtrasoMei || 0) > 0 ||
    (p?.declaracoesPendentesMei?.length || 0) > 0 ||
    p?.cndFederal === 'POSITIVA' ||
    p?.cndEstadual === 'POSITIVA'
  );
}

const StatusCndBadge: React.FC<{ status?: StatusCnd }> = ({ status }) => {
  if (status === 'NEGATIVA')
    return (
      <span className="flex items-center gap-1 text-emerald-700 font-semibold">
        <CheckCircle2 className="w-3.5 h-3.5" /> Negativa
      </span>
    );
  if (status === 'POSITIVA_COM_EFEITO_DE_NEGATIVA')
    return (
      <span className="flex items-center gap-1 text-amber-700 font-semibold">
        <AlertTriangle className="w-3.5 h-3.5" /> Positiva c/ efeito
      </span>
    );
  if (status === 'POSITIVA')
    return (
      <span className="flex items-center gap-1 text-rose-700 font-semibold">
        <XCircle className="w-3.5 h-3.5" /> Positiva
      </span>
    );
  return <span className="text-muted-foreground">Não consultada</span>;
};

export const PortfolioManager: React.FC<PortfolioManagerProps> = ({
  carteira,
  onSelectEmpresa,
  onPrintReport,
  onRefreshEmpresa,
  onRemoveEmpresa,
  onAddCnpj,
  isLoading,
}) => {
  const [inputCnpj, setInputCnpj] = useState('');
  const [filterText, setFilterText] = useState('');
  const [refreshingCnpj, setRefreshingCnpj] = useState<string | null>(null);
  const [copiedCnpj, setCopiedCnpj] = useState<string | null>(null);
  const [activeTabFilter, setActiveTabFilter] = useState<'TODAS' | 'MEI' | 'PENDENCIAS'>('TODAS');
  const [empresaToDelete, setEmpresaToDelete] = useState<EmpresaData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = cleanCNPJ(inputCnpj);
    if (clean.length !== 14) return;
    await onAddCnpj(clean);
    setInputCnpj('');
  };

  const handleRefresh = async (cnpj: string) => {
    setRefreshingCnpj(cnpj);
    try {
      await onRefreshEmpresa(cnpj);
    } finally {
      setRefreshingCnpj(null);
    }
  };

  const copyToClipboard = (cnpj: string) => {
    navigator.clipboard.writeText(formatCNPJ(cnpj));
    setCopiedCnpj(cnpj);
    setTimeout(() => setCopiedCnpj(null), 2000);
  };

  const termo = filterText.toLowerCase();
  const termoCnpj = cleanCNPJ(filterText);
  const filteredList = carteira.filter(emp => {
    const bate =
      !termo ||
      emp.razao_social.toLowerCase().includes(termo) ||
      (emp.nome_fantasia || '').toLowerCase().includes(termo) ||
      (termoCnpj !== '' && emp.cnpj.includes(termoCnpj));
    if (!bate) return false;
    if (activeTabFilter === 'MEI') return emp.opcao_pelo_mei;
    if (activeTabFilter === 'PENDENCIAS') return temPendencia(emp);
    return true;
  });

  const totalMei = carteira.filter(e => e.opcao_pelo_mei).length;
  const totalComPendencias = carteira.filter(temPendencia).length;
  const totalValorDebitosMei = carteira.reduce((acc, curr) => acc + (curr.pendenciasResumo?.totalDebitosMei || 0), 0);
  const totalDasnPendentes = carteira.reduce((acc, curr) => acc + (curr.pendenciasResumo?.declaracoesPendentesMei?.length || 0), 0);

  const metricas = [
    { rotulo: 'Empresas na carteira', valor: String(carteira.length), detalhe: 'monitoradas', icone: Building2, cor: 'text-primary' },
    { rotulo: 'MEI', valor: String(totalMei), detalhe: 'com módulo PGMEI', icone: Receipt, cor: 'text-accent-700' },
    { rotulo: 'Com pendências', valor: String(totalComPendencias), detalhe: 'DAS, DASN ou CND positiva', icone: ShieldAlert, cor: 'text-rose-700' },
    {
      rotulo: 'Débitos MEI apurados',
      valor: formatCurrency(totalValorDebitosMei),
      detalhe: `${totalDasnPendentes} DASN-SIMEI em atraso`,
      icone: FileWarning,
      cor: 'text-foreground',
    },
  ];

  const filtros: { id: typeof activeTabFilter; rotulo: string }[] = [
    { id: 'TODAS', rotulo: `Todas (${carteira.length})` },
    { id: 'MEI', rotulo: `MEI (${totalMei})` },
    { id: 'PENDENCIAS', rotulo: `Com pendências (${totalComPendencias})` },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricas.map(m => (
          <div key={m.rotulo} className="bg-white border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{m.rotulo}</span>
              <m.icone className={`w-5 h-5 ${m.cor}`} />
            </div>
            <div className={`mt-3 text-2xl font-serif font-semibold ${m.cor}`}>{m.valor}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{m.detalhe}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-border rounded-2xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Plus className="w-5 h-5 text-accent-600" />
              Adicionar CNPJ à carteira
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Consultamos várias bases públicas da Receita e unimos os dados, inclusive telefone e e-mail quando alguma delas tem.
            </p>
          </div>

          <form onSubmit={handleAddSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="text"
              inputMode="text"
              placeholder="00.000.000/0000-00"
              value={inputCnpj}
              onChange={e => setInputCnpj(formatCNPJ(e.target.value))}
              className="w-full sm:w-64 px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-300"
              aria-label="CNPJ"
            />
            <button
              type="submit"
              disabled={isLoading || cleanCNPJ(inputCnpj).length !== 14}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-800 text-primary-foreground font-semibold text-xs whitespace-nowrap transition disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>{isLoading ? 'Consultando...' : 'Cadastrar empresa'}</span>
            </button>
          </form>
        </div>
      </div>

      <div className="bg-white border border-border rounded-2xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {filtros.map(f => (
              <button
                key={f.id}
                onClick={() => setActiveTabFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTabFilter === f.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {f.rotulo}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar razão social ou CNPJ..."
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>
        </div>

        {filteredList.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Building2 className="w-10 h-10 text-primary-300 mx-auto" />
            <h3 className="font-semibold text-foreground">Nenhuma empresa encontrada</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {carteira.length === 0 ? 'Informe um CNPJ acima para começar a montar a carteira.' : 'Nenhum resultado para o filtro atual.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredList.map(emp => {
              const p = emp.pendenciasResumo;
              const dasnPendentes = p?.declaracoesPendentesMei || [];
              return (
                <div key={emp.cnpj} className="p-4 sm:p-5 hover:bg-muted/60 transition flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => copyToClipboard(emp.cnpj)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary-50 hover:bg-primary-100 text-primary font-mono text-xs font-semibold transition cursor-pointer"
                        title="Copiar CNPJ"
                      >
                        {copiedCnpj === emp.cnpj ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 opacity-60" />}
                        {formatCNPJ(emp.cnpj)}
                      </button>
                      {emp.opcao_pelo_mei ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-accent-100 text-accent-800">MEI</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground">{emp.porte || 'Porte não informado'}</span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          emp.situacao_cadastral === 'ATIVA' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {emp.situacao_cadastral}
                      </span>
                    </div>

                    <div>
                      <h3
                        onClick={() => onSelectEmpresa(emp)}
                        className="text-base font-semibold text-foreground hover:text-primary transition cursor-pointer truncate"
                        title="Abrir o painel completo desta empresa"
                      >
                        {emp.razao_social}
                      </h3>
                      {emp.nome_fantasia && emp.nome_fantasia !== 'Não informado' && (
                        <p className="text-xs text-muted-foreground truncate">{emp.nome_fantasia}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-primary" />
                        <span className={emp.telefone === 'Não cadastrado' ? '' : 'text-foreground font-medium'}>{emp.telefone || 'Não cadastrado'}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-primary" />
                        <span className={emp.email === 'Não cadastrado' ? '' : 'text-foreground font-medium'}>{emp.email || 'Não cadastrado'}</span>
                      </span>
                      <span>
                        {emp.endereco.municipio}/{emp.endereco.uf}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap sm:flex-nowrap items-start gap-4 bg-muted/70 p-3 rounded-xl text-xs shrink-0">
                    <div className="space-y-1 pr-4 border-r border-border">
                      <span className="text-[10px] text-muted-foreground block font-medium">CND Federal</span>
                      <StatusCndBadge status={p?.cndFederal} />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground block font-medium">MEI (PGMEI / DASN)</span>
                      {!emp.opcao_pelo_mei ? (
                        <span className="text-muted-foreground">Não optante</span>
                      ) : !p?.meiConsultadoEm ? (
                        <span className="text-muted-foreground">Não consultado</span>
                      ) : (p.guiasEmAbertoMei || 0) > 0 || dasnPendentes.length > 0 ? (
                        <div className="space-y-0.5">
                          {(p.guiasEmAbertoMei || 0) > 0 && (
                            <span className="flex items-center gap-1 text-rose-700 font-semibold">
                              <ShieldAlert className="w-3.5 h-3.5" /> {p.guiasEmAbertoMei} guia(s) · {formatCurrency(p.totalDebitosMei || 0)}
                            </span>
                          )}
                          {dasnPendentes.length > 0 && (
                            <span className="block text-[11px] text-accent-800 font-semibold">DASN pendente: {dasnPendentes.join(', ')}</span>
                          )}
                        </div>
                      ) : (
                        <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Em dia
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      onClick={() => onSelectEmpresa(emp)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary-50 hover:bg-primary-100 text-primary font-semibold text-xs transition cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                      Ver pendências
                    </button>
                    <button
                      onClick={() => onPrintReport(emp)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary hover:bg-primary-800 text-primary-foreground font-semibold text-xs transition cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      Dossiê
                    </button>
                    <button
                      onClick={() => handleRefresh(emp.cnpj)}
                      disabled={refreshingCnpj === emp.cnpj}
                      className="p-2 rounded-xl bg-white hover:bg-muted text-muted-foreground hover:text-foreground border border-border transition cursor-pointer"
                      title="Atualizar dados cadastrais"
                      aria-label="Atualizar dados cadastrais"
                    >
                      <RefreshCw className={`w-4 h-4 ${refreshingCnpj === emp.cnpj ? 'animate-spin text-primary' : ''}`} />
                    </button>
                    <button
                      onClick={() => setEmpresaToDelete(emp)}
                      className="p-2 rounded-xl bg-white hover:bg-rose-50 text-muted-foreground hover:text-rose-700 border border-border transition cursor-pointer"
                      title="Remover da carteira"
                      aria-label="Remover da carteira"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {empresaToDelete && (
        <div className="fixed inset-0 z-50 bg-primary-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-border rounded-2xl max-w-md w-full p-6 shadow-xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Excluir empresa da carteira</h3>
                <p className="text-xs text-muted-foreground">Remove a empresa da lista de monitoramento</p>
              </div>
            </div>
            <div className="bg-muted rounded-xl p-3.5 space-y-0.5">
              <div className="text-sm font-semibold text-foreground">{empresaToDelete.razao_social}</div>
              <div className="text-xs font-mono text-primary">{formatCNPJ(empresaToDelete.cnpj)}</div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setEmpresaToDelete(null)}
                className="px-4 py-2 rounded-xl bg-white hover:bg-muted text-foreground text-xs font-semibold border border-border transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    await onRemoveEmpresa(empresaToDelete.cnpj);
                    setEmpresaToDelete(null);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {isDeleting ? 'Excluindo...' : 'Confirmar exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
