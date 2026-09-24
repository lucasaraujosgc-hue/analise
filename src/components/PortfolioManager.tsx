import React, { useState } from 'react';
import { EmpresaData } from '../types/cnpj';
import { 
  Building2, Plus, Search, Eye, Printer, RefreshCw, Trash2, 
  CheckCircle2, AlertTriangle, XCircle, HelpCircle, Phone, Mail, 
  Copy, Check, FileText, ChevronRight, ShieldAlert, Sparkles, Filter
} from 'lucide-react';
import { formatCNPJ } from '../utils/formatters';

interface PortfolioManagerProps {
  carteira: EmpresaData[];
  onSelectEmpresa: (empresa: EmpresaData) => void;
  onPrintReport: (empresa: EmpresaData) => void;
  onRefreshEmpresa: (cnpj: string) => Promise<void>;
  onRemoveEmpresa: (cnpj: string) => Promise<void> | void;
  onAddCnpj: (cnpj: string, isMei?: boolean) => Promise<void>;
  isLoading: boolean;
}

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 14) val = val.slice(0, 14);

    if (val.length <= 2) {
      setInputCnpj(val);
    } else if (val.length <= 5) {
      setInputCnpj(`${val.slice(0, 2)}.${val.slice(2)}`);
    } else if (val.length <= 8) {
      setInputCnpj(`${val.slice(0, 2)}.${val.slice(2, 5)}.${val.slice(5)}`);
    } else if (val.length <= 12) {
      setInputCnpj(`${val.slice(0, 2)}.${val.slice(2, 5)}.${val.slice(5, 8)}/${val.slice(8)}`);
    } else {
      setInputCnpj(`${val.slice(0, 2)}.${val.slice(2, 5)}.${val.slice(5, 8)}/${val.slice(8, 12)}-${val.slice(12)}`);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputCnpj.replace(/\D/g, '');
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

  // Filtered portfolio
  const filteredList = carteira.filter(emp => {
    const searchMatch = 
      emp.razao_social.toLowerCase().includes(filterText.toLowerCase()) ||
      emp.nome_fantasia.toLowerCase().includes(filterText.toLowerCase()) ||
      emp.cnpj.includes(filterText.replace(/\D/g, ''));

    if (!searchMatch) return false;

    if (activeTabFilter === 'MEI') return emp.opcao_pelo_mei;
    if (activeTabFilter === 'PENDENCIAS') {
      const hasMeiDebts = (emp.pendenciasResumo?.guiasAtrasoMei || 0) > 0;
      const hasCndDebts = emp.pendenciasResumo?.cndFederal === 'POSITIVA' || emp.pendenciasResumo?.cndFederal === 'POSITIVA_COM_EFEITO_DE_NEGATIVA';
      return hasMeiDebts || hasCndDebts;
    }

    return true;
  });

  // Calculate high level metrics
  const totalEmpresas = carteira.length;
  const totalMei = carteira.filter(e => e.opcao_pelo_mei).length;
  const totalComPendencias = carteira.filter(e => (e.pendenciasResumo?.guiasAtrasoMei || 0) > 0 || e.pendenciasResumo?.cndFederal === 'POSITIVA').length;
  const totalValorDebitosMei = carteira.reduce((acc, curr) => acc + (curr.pendenciasResumo?.totalDebitosMei || 0), 0);

  return (
    <div className="space-y-6">
      {/* 1. Header com Métricas da Carteira Multi-CNPJ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm text-slate-100 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Carteira Monitorada</span>
            <div className="p-2 rounded-xl bg-slate-800 text-emerald-400">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-white">{totalEmpresas}</span>
            <span className="text-xs text-slate-400 ml-2">empresas salvas</span>
          </div>
          <div className="mt-1 text-[11px] text-emerald-400">
            Sincronizado no banco local e Docker
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm text-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Empresas MEI</span>
            <div className="p-2 rounded-xl bg-slate-800 text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-amber-400">{totalMei}</span>
            <span className="text-xs text-slate-400 ml-2">com módulo PGMEI</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Monitoramento de guias DAS
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm text-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Com Pendências</span>
            <div className="p-2 rounded-xl bg-slate-800 text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-rose-400">{totalComPendencias}</span>
            <span className="text-xs text-slate-400 ml-2">requerem atenção</span>
          </div>
          <div className="mt-1 text-[11px] text-rose-400">
            Débitos MEI ou CND Positiva
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm text-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Volume Débitos MEI</span>
            <div className="p-2 rounded-xl bg-slate-800 text-cyan-400">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl sm:text-2xl font-black text-cyan-400">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValorDebitosMei)}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Total acumulado em aberto
          </div>
        </div>
      </div>

      {/* 2. Barra de Inserção de Novo CNPJ na Carteira */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-400" />
              Adicionar Novo CNPJ à Carteira
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Insira o número do CNPJ para consultar na Receita Federal e adicionar à sua relação de empresas monitoradas.
            </p>
          </div>

          <form onSubmit={handleAddSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="00.000.000/0000-00"
                value={inputCnpj}
                onChange={handleInputChange}
                className="w-full sm:w-64 px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || inputCnpj.replace(/\D/g, '').length !== 14}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/30 transition disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Consultando Receita...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Cadastrar Empresa</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Atalhos Rápidos para Testes */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 text-[11px] font-medium">Exemplos rápidos:</span>
          <button
            type="button"
            onClick={() => onAddCnpj('48912345000190', true)}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 text-[11px] font-mono transition"
          >
            Carbono Tech MEI (48.912.345/0001-90)
          </button>
          <button
            type="button"
            onClick={() => onAddCnpj('18236120000158', false)}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 border border-slate-700 text-[11px] font-mono transition"
          >
            Nubank S.A. (18.236.120/0001-58)
          </button>
          <button
            type="button"
            onClick={() => onAddCnpj('00000000000191', false)}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-300 border border-slate-700 text-[11px] font-mono transition"
          >
            Banco do Brasil (00.000.000/0001-91)
          </button>
        </div>
      </div>

      {/* 3. Filtros & Tabela da Carteira de Empresas */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-md overflow-hidden">
        {/* Barra Superior da Lista */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTabFilter('TODAS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTabFilter === 'TODAS'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Todas ({carteira.length})
            </button>
            <button
              onClick={() => setActiveTabFilter('MEI')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTabFilter === 'MEI'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Apenas MEI ({totalMei})
            </button>
            <button
              onClick={() => setActiveTabFilter('PENDENCIAS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTabFilter === 'PENDENCIAS'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Com Pendências ({totalComPendencias})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar razão social ou CNPJ..."
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
            />
          </div>
        </div>

        {/* Lista / Tabela das Empresas */}
        {filteredList.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <Building2 className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="font-bold text-base text-slate-300">Nenhuma empresa encontrada</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {carteira.length === 0 
                ? 'Insira um CNPJ no campo acima para começar a gerenciar sua carteira de empresas.' 
                : 'Nenhum resultado corresponde ao filtro atual.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {filteredList.map((emp) => {
              const isRefreshing = refreshingCnpj === emp.cnpj;
              const hasMeiDebts = (emp.pendenciasResumo?.guiasAtrasoMei || 0) > 0;
              const cndFederalStatus = emp.pendenciasResumo?.cndFederal || 'NAO_CONSULTADA';

              return (
                <div 
                  key={emp.cnpj}
                  className="p-4 sm:p-5 hover:bg-slate-800/40 transition flex flex-col xl:flex-row xl:items-center justify-between gap-4"
                >
                  {/* Bloco 1: Identificação & Dados da Empresa */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => copyToClipboard(emp.cnpj)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-950 hover:bg-slate-800 text-emerald-400 font-mono text-xs font-bold border border-slate-700/80 transition"
                        title="Copiar CNPJ"
                      >
                        {copiedCnpj === emp.cnpj ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                        <span>{formatCNPJ(emp.cnpj)}</span>
                      </button>

                      {emp.opcao_pelo_mei ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          MEI
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          {emp.porte || 'GERAL'}
                        </span>
                      )}

                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        emp.situacao_cadastral === 'ATIVA'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}>
                        {emp.situacao_cadastral}
                      </span>
                    </div>

                    <div>
                      <h3 
                        onClick={() => onSelectEmpresa(emp)}
                        className="text-base font-bold text-white hover:text-emerald-400 transition cursor-pointer truncate"
                        title="Clique para visualizar o painel completo desta empresa"
                      >
                        {emp.razao_social}
                      </h3>
                      {emp.nome_fantasia && emp.nome_fantasia !== 'Não informado' && (
                        <p className="text-xs text-slate-400 truncate">
                          Fantasia: <span className="text-slate-300 font-medium">{emp.nome_fantasia}</span>
                        </p>
                      )}
                    </div>

                    {/* Contatos & Localização */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-emerald-400" />
                        <strong className="text-slate-300">{emp.telefone || 'Não cadastrado'}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-cyan-400" />
                        <strong className="text-slate-300">{emp.email || 'Não cadastrado'}</strong>
                      </span>
                      <span>
                        {emp.endereco.municipio}/{emp.endereco.uf}
                      </span>
                    </div>
                  </div>

                  {/* Bloco 2: Resumo de Pendências (CNDs & MEI) */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-xs shrink-0">
                    {/* Status CND Federal */}
                    <div className="space-y-1 pr-3 border-r border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-semibold">CND Federal</span>
                      {cndFederalStatus === 'NEGATIVA' ? (
                        <span className="flex items-center gap-1 text-emerald-400 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Negativa
                        </span>
                      ) : cndFederalStatus === 'POSITIVA_COM_EFEITO_DE_NEGATIVA' ? (
                        <span className="flex items-center gap-1 text-amber-400 font-bold">
                          <AlertTriangle className="w-3.5 h-3.5" /> Positiva c/ Efeito
                        </span>
                      ) : cndFederalStatus === 'POSITIVA' ? (
                        <span className="flex items-center gap-1 text-rose-400 font-bold">
                          <XCircle className="w-3.5 h-3.5" /> Positiva (Débitos)
                        </span>
                      ) : (
                        <span className="text-slate-500 font-medium">Não consultada</span>
                      )}
                    </div>

                    {/* Status MEI DAS */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 block font-semibold">Débitos MEI</span>
                      {emp.opcao_pelo_mei ? (
                        hasMeiDebts ? (
                          <div className="space-y-0.5">
                            <span className="flex items-center gap-1 text-rose-400 font-bold">
                              <ShieldAlert className="w-3.5 h-3.5" /> {emp.pendenciasResumo?.guiasAtrasoMei} guias pendentes
                            </span>
                            <span className="text-[10px] text-rose-300 font-mono">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(emp.pendenciasResumo?.totalDebitosMei || 0)}
                            </span>
                          </div>
                        ) : (
                          <span className="flex items-center gap-1 text-emerald-400 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Em dia
                          </span>
                        )
                      ) : (
                        <span className="text-slate-500">Não optante MEI</span>
                      )}
                    </div>
                  </div>

                  {/* Bloco 3: Botões de Ação Solicitados */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {/* 1. Visualizar Pendências */}
                    <button
                      onClick={() => onSelectEmpresa(emp)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 border border-slate-700 font-semibold text-xs transition cursor-pointer"
                      title="Visualizar pendências completas, CNDs, débitos e dados cadastrais"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Visualizar Pendências</span>
                    </button>

                    {/* 2. Imprimir / Salvar Dossiê PDF */}
                    <button
                      onClick={() => onPrintReport(emp)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs shadow-sm transition cursor-pointer"
                      title="Abrir Dossiê Executivo para Impressão, Download em PDF ou Salvar no Docker"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Dossiê & PDF</span>
                    </button>

                    {/* 3. Atualizar Dados */}
                    <button
                      onClick={() => handleRefresh(emp.cnpj)}
                      disabled={isRefreshing}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
                      title="Atualizar dados cadastrais e apurar pendências na Receita Federal"
                    >
                      <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
                    </button>

                    {/* 4. Remover da Carteira */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEmpresaToDelete(emp);
                      }}
                      className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-slate-700/80 transition cursor-pointer"
                      title="Remover empresa da carteira"
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

      {/* Modal de Confirmação para Exclusão da Empresa */}
      {empresaToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">Excluir Empresa da Carteira</h3>
                <p className="text-xs text-slate-400">Esta ação remove a empresa da sua lista de monitoramento</p>
              </div>
            </div>

            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <div className="text-sm font-semibold text-slate-100">{empresaToDelete.razao_social}</div>
              <div className="text-xs font-mono text-emerald-400 font-bold">{formatCNPJ(empresaToDelete.cnpj)}</div>
              {empresaToDelete.endereco?.municipio && (
                <div className="text-[11px] text-slate-400">
                  {empresaToDelete.endereco.municipio} - {empresaToDelete.endereco.uf}
                </div>
              )}
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Deseja realmente remover esta empresa da sua relação? Você poderá adicioná-la novamente a qualquer momento digitando o CNPJ.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setEmpresaToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition cursor-pointer"
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
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-950/40 transition cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirmar Exclusão</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
