import React from 'react';
import { X, Database, Phone, Receipt, FileCheck, HardDrive } from 'lucide-react';

interface ApiInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FONTES_CNPJ = [
  { nome: 'MinhaReceita', desc: 'Dados abertos da RFB. Base cadastral principal, mas oculta e-mail e, para MEI, telefone e endereço.' },
  { nome: 'BrasilAPI', desc: 'Mesmo formato dos dados abertos; usada como reserva.' },
  { nome: 'OpenCNPJ', desc: 'Dados abertos com telefones estruturados.' },
  { nome: 'CNPJ.ws', desc: 'Telefone com DDD, e-mail e inscrições estaduais (limite de 3 consultas/min).' },
  { nome: 'CNPJá (open)', desc: 'Telefones e e-mails (limite de 5 consultas/min).' },
  { nome: 'ReceitaWS', desc: 'Lê o comprovante de inscrição: costuma trazer telefone e e-mail (limite de 3 consultas/min).' },
];

export const ApiInfoModal: React.FC<ApiInfoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary-950/60 backdrop-blur-sm">
      <div className="bg-white border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary-50 text-primary">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-foreground">De onde vêm os dados</h3>
              <p className="text-xs text-muted-foreground">Todas as fontes são gratuitas</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 text-xs text-muted-foreground">
          <section className="space-y-3">
            <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" /> Cadastro do CNPJ
            </h4>
            <p>As fontes abaixo são consultadas ao mesmo tempo e os resultados são unidos. Se uma falhar ou atingir o limite, as outras completam.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FONTES_CNPJ.map(f => (
                <div key={f.nome} className="p-3 rounded-xl bg-muted/70">
                  <span className="font-semibold text-foreground block">{f.nome}</span>
                  <span className="text-[11px]">{f.desc}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2 p-4 rounded-xl bg-accent-50 border border-accent-200">
            <h4 className="font-semibold text-sm text-accent-800 flex items-center gap-2">
              <Phone className="w-4 h-4" /> Por que telefone e e-mail não apareciam
            </h4>
            <p className="text-accent-800">
              O sistema só consultava a MinhaReceita e parava ali. A instância pública dela roda em modo de privacidade: remove o e-mail de todas as
              empresas e, para empresário individual (MEI), também telefone e logradouro. Agora as outras fontes são sempre consultadas e os contatos
              são mesclados. Se nenhuma fonte tiver o dado, você pode informá-lo em “Contatos” — ele é mantido nas próximas atualizações.
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary" /> MEI: DAS em aberto e DASN-SIMEI
            </h4>
            <p>
              Um robô abre o portal público do PGMEI (o mesmo que o MEI usa, sem certificado digital), lê a tabela de competências de cada ano
              — situação, principal, multa, juros, total e vencimento — e os avisos de declaração não entregue. Em seguida consulta o DASN-SIMEI.
              Baseado no projeto de código aberto <span className="font-mono text-foreground">engmsilva/scraping-das-mei</span>.
            </p>
            <p>
              O portal tem verificação anti-robô. Se ela bloquear a consulta, tente novamente mais tarde, rode o servidor com
              <code className="mx-1 px-1 rounded bg-muted text-foreground">PGMEI_HEADLESS=false</code>para resolver o captcha na tela, ou copie e cole a
              tabela do PGMEI em “Importar extrato”.
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-primary" /> Certidões (CND)
            </h4>
            <p>
              Federal: servicos.receitafederal.gov.br/servico/certidoes/#/home/cnpj. Estadual: portal da SEFAZ da UF da empresa. O PDF enviado é lido e
              classificado em Negativa, Positiva com efeito de negativa ou Positiva, com validade e conferência do CNPJ.
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-primary" /> Arquivos
            </h4>
            <p>
              CNDs, relatórios do MEI e dossiês ficam em <code className="px-1 rounded bg-muted text-foreground">./storage</code> (volume do Docker
              montado em <code className="px-1 rounded bg-muted text-foreground">/app/storage</code>).
            </p>
          </section>
        </div>

        <div className="p-4 border-t border-border flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-800 text-primary-foreground font-semibold text-xs transition cursor-pointer">
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
};
