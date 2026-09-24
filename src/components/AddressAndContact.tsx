import React, { useState } from 'react';
import { EmpresaData } from '../types/cnpj';
import { formatCEP } from '../utils/formatters';
import { salvarContatoManual } from '../services/api';
import { MapPin, Phone, Mail, ExternalLink, Copy, Check, Pencil, Loader2, Info } from 'lucide-react';

interface AddressAndContactProps {
  empresa: EmpresaData;
  onContatoSalvo: (carteira: EmpresaData[]) => void;
}

const NAO_CADASTRADO = 'Não cadastrado';

export const AddressAndContact: React.FC<AddressAndContactProps> = ({ empresa, onContatoSalvo }) => {
  const { endereco } = empresa;
  const [copiado, setCopiado] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [telefone, setTelefone] = useState(empresa.contatos_manuais?.telefone || '');
  const [email, setEmail] = useState(empresa.contatos_manuais?.email || '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const telefones = Array.from(
    new Set([empresa.contatos_manuais?.telefone, ...(empresa.telefones || []), empresa.telefone].filter((t): t is string => Boolean(t) && t !== NAO_CADASTRADO)),
  );
  const emails = Array.from(
    new Set([empresa.contatos_manuais?.email, ...(empresa.emails || []), empresa.email].filter((e): e is string => Boolean(e) && e !== NAO_CADASTRADO)),
  );

  const copiar = (texto: string) => {
    navigator.clipboard.writeText(texto);
    setCopiado(texto);
    setTimeout(() => setCopiado(null), 2000);
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      onContatoSalvo(await salvarContatoManual(empresa.cnpj, { telefone, email }));
      setEditando(false);
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  };

  const logradouro = [endereco.tipo_logradouro, endereco.logradouro].filter(Boolean).join(' ');
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    endereco.endereco_completo || `${logradouro}, ${endereco.numero}, ${endereco.municipio} - ${endereco.uf}`,
  )}`;

  const LinhaContato = ({ valor, href, icone: Icone }: { valor: string; href?: string; icone: typeof Phone }) => (
    <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-muted/70">
      <div className="flex items-center gap-2.5 min-w-0">
        <Icone className="w-4 h-4 text-primary shrink-0" />
        {href ? (
          <a href={href} className="text-sm font-medium text-foreground hover:text-primary truncate">
            {valor}
          </a>
        ) : (
          <span className="text-sm font-medium text-foreground truncate">{valor}</span>
        )}
      </div>
      <button onClick={() => copiar(valor)} className="p-1.5 text-muted-foreground hover:text-primary rounded-lg transition cursor-pointer" title="Copiar" aria-label={`Copiar ${valor}`}>
        {copiado === valor ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div className="bg-white rounded-2xl border border-border p-5 sm:p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary-50 text-primary">
                <MapPin className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-foreground">Endereço cadastral</h3>
            </div>
            <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 font-semibold hover:underline">
              Abrir no Maps
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="space-y-1.5 text-sm">
            <p className="font-semibold text-foreground">
              {logradouro || 'Logradouro não informado'}, {endereco.numero || 'S/N'}
              {endereco.complemento && ` - ${endereco.complemento}`}
            </p>
            <p className="text-muted-foreground">
              Bairro: <span className="text-foreground">{endereco.bairro || 'Não informado'}</span>
            </p>
            <p className="text-muted-foreground">
              Município: <span className="text-foreground">{endereco.municipio} - {endereco.uf}</span>
            </p>
            <p className="text-muted-foreground">
              CEP: <span className="font-mono text-foreground">{formatCEP(endereco.cep)}</span>
            </p>
            {empresa.inscricoes_estaduais && empresa.inscricoes_estaduais.length > 0 && (
              <p className="text-muted-foreground">
                Inscrição estadual:{' '}
                <span className="font-mono text-foreground">
                  {empresa.inscricoes_estaduais.map(ie => `${ie.inscricao} (${ie.uf}${ie.ativa ? '' : ', inativa'})`).join(', ')}
                </span>
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Endereço declarado à Receita Federal</span>
          <button onClick={() => copiar(endereco.endereco_completo)} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 font-medium cursor-pointer">
            {copiado === endereco.endereco_completo ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
            Copiar endereço
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border p-5 sm:p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary-50 text-primary">
                <Phone className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-foreground">Contatos</h3>
            </div>
            <button
              onClick={() => setEditando(v => !v)}
              className="text-xs text-primary flex items-center gap-1 font-semibold hover:underline cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              {editando ? 'Cancelar' : 'Informar contato'}
            </button>
          </div>

          {editando ? (
            <form onSubmit={salvar} className="space-y-3">
              <label className="block">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Telefone</span>
                <input
                  value={telefone}
                  onChange={e => setTelefone(e.target.value)}
                  placeholder="(75) 99999-0000"
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">E-mail</span>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="contato@empresa.com.br"
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                />
              </label>
              {erro && <p className="text-xs text-rose-700">{erro}</p>}
              <button
                type="submit"
                disabled={salvando}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary-800 text-primary-foreground text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
              >
                {salvando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Salvar contato
              </button>
            </form>
          ) : (
            <div className="space-y-2">
              {telefones.length === 0 && emails.length === 0 && (
                <div className="p-3 rounded-xl bg-accent-50 text-accent-800 text-xs flex gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Nenhuma base pública trouxe telefone ou e-mail. A MinhaReceita oculta o e-mail de todas as empresas (e o telefone de MEI)
                    e as demais fontes gratuitas podem estar sem o dado ou com limite de consultas. Informe o contato manualmente ou tente
                    "Atualizar dados" mais tarde.
                  </span>
                </div>
              )}
              {telefones.map(t => (
                <LinhaContato key={t} valor={t} href={`tel:${t.replace(/\D/g, '')}`} icone={Phone} />
              ))}
              {emails.map(e => (
                <LinhaContato key={e} valor={e} href={`mailto:${e}`} icone={Mail} />
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-border text-xs text-muted-foreground">
          {empresa.contatos_manuais?.telefone || empresa.contatos_manuais?.email
            ? 'Inclui contato informado manualmente.'
            : empresa.fontes_contato?.length
              ? `Contato encontrado em: ${empresa.fontes_contato.join(', ')}.`
              : `Fontes consultadas: ${(empresa.fontes || [empresa.source]).filter(Boolean).join(', ') || '—'}.`}
        </div>
      </div>
    </div>
  );
};
