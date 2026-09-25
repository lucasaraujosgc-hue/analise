import React, { useEffect, useRef, useState } from 'react';
import { MousePointerClick } from 'lucide-react';

// Mostra a tela do robô (no servidor) e repassa os cliques, para a pessoa
// resolver o captcha que o portal da Receita pediu.
const LARGURA_ROBO = 1366;
const ALTURA_ROBO = 768;

export const CaptchaRemoto: React.FC<{ jobId: string }> = ({ jobId }) => {
  const [versao, setVersao] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const t = setInterval(() => setVersao(v => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const clicar = async (e: React.MouseEvent<HTMLImageElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * LARGURA_ROBO;
    const y = ((e.clientY - rect.top) / rect.height) * ALTURA_ROBO;
    await fetch(`/api/jobs/${jobId}/clique`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x, y }),
    }).catch(() => {});
    setVersao(v => v + 1);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-accent-800 flex items-center gap-1.5">
        <MousePointerClick className="w-4 h-4" />
        A Receita pediu uma verificação. Clique na imagem abaixo como se fosse o site: selecione as figuras pedidas e confirme. O robô continua
        sozinho quando liberar (você tem até 4 minutos).
      </p>
      <img
        ref={imgRef}
        src={`/api/jobs/${jobId}/tela?v=${versao}`}
        onClick={clicar}
        alt="Tela do robô no portal da Receita"
        className="w-full rounded-xl border-2 border-accent cursor-crosshair select-none"
        style={{ aspectRatio: `${LARGURA_ROBO} / ${ALTURA_ROBO}` }}
        draggable={false}
      />
    </div>
  );
};
