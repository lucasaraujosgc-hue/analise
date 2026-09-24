import React, { useState } from 'react';
import { EnderecoEmpresa } from '../types/cnpj';
import { formatCEP } from '../utils/formatters';
import { MapPin, Phone, Mail, ExternalLink, Copy, Check } from 'lucide-react';

interface AddressAndContactProps {
  endereco: EnderecoEmpresa;
  telefone: string;
  email: string;
}

export const AddressAndContact: React.FC<AddressAndContactProps> = ({
  endereco,
  telefone,
  email,
}) => {
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const copyToClipboard = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    endereco.endereco_completo || `${endereco.logradouro}, ${endereco.numero}, ${endereco.municipio} - ${endereco.uf}`
  )}`;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {/* Endereço */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <MapPin className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Endereço Cadastral
              </h3>
            </div>
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-semibold hover:underline"
            >
              Abrir no Maps
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="space-y-2 text-sm text-slate-800">
            <p className="font-semibold text-base text-slate-900">
              {endereco.logradouro || 'Logradouro não informado'}, {endereco.numero || 'S/N'}
              {endereco.complemento && ` - ${endereco.complemento}`}
            </p>
            <p className="text-slate-600">
              Bairro: <span className="font-medium text-slate-800">{endereco.bairro || 'Não informado'}</span>
            </p>
            <p className="text-slate-600">
              Município: <span className="font-medium text-slate-800">{endereco.municipio} - {endereco.uf}</span>
            </p>
            <p className="text-slate-600">
              CEP: <span className="font-mono font-medium text-slate-800">{formatCEP(endereco.cep)}</span>
            </p>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-400">Localização oficial na RFB</span>
          <button
            onClick={() => copyToClipboard(endereco.endereco_completo, setCopiedAddr)}
            className="text-xs text-slate-600 hover:text-blue-600 flex items-center gap-1 font-medium cursor-pointer"
          >
            {copiedAddr ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedAddr ? 'Copiado!' : 'Copiar Endereço'}
          </button>
        </div>
      </div>

      {/* Contatos */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <Phone className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Contatos Cadastrados
              </h3>
            </div>
          </div>

          <div className="space-y-4">
            {/* Telefone */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center border border-slate-200 text-slate-700">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Telefone
                  </span>
                  <span className="text-sm font-semibold text-slate-800">
                    {telefone || 'Não cadastrado'}
                  </span>
                </div>
              </div>
              {telefone && telefone !== 'Não cadastrado' && (
                <button
                  onClick={() => copyToClipboard(telefone, setCopiedPhone)}
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition"
                  title="Copiar telefone"
                >
                  {copiedPhone ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              )}
            </div>

            {/* Email */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center border border-slate-200 text-slate-700">
                  <Mail className="w-4 h-4" />
                </div>
                <div className="overflow-hidden">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    E-mail
                  </span>
                  <a
                    href={email && email !== 'Não cadastrado' ? `mailto:${email}` : undefined}
                    className="text-sm font-semibold text-slate-800 truncate block hover:text-blue-600"
                  >
                    {email || 'Não cadastrado'}
                  </a>
                </div>
              </div>
              {email && email !== 'Não cadastrado' && (
                <button
                  onClick={() => copyToClipboard(email, setCopiedEmail)}
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition"
                  title="Copiar e-mail"
                >
                  {copiedEmail ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400">
          Dados declarados perante a Receita Federal do Brasil
        </div>
      </div>
    </div>
  );
};
