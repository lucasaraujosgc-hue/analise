import React from 'react';

interface VirgulaLogoProps {
  size?: 'sm' | 'md' | 'lg';
  // "dark" = para usar sobre fundo escuro (verde da marca).
  theme?: 'dark' | 'light';
  className?: string;
  href?: string;
}

// Logo "Vírgula, Contábil" conforme o arquivo de identidade visual:
// Vírgula em Fraunces bold (verde), vírgula em laranja e "CONTÁBIL" em Inter
// espaçado, centralizado abaixo.
export const VirgulaLogo: React.FC<VirgulaLogoProps> = ({ size = 'md', theme = 'light', className = '', href }) => {
  const onDark = theme === 'dark';

  const sizes = {
    sm: { word: 'text-xl', sub: 'text-[9px] tracking-[0.3em] ml-[0.3em]' },
    md: { word: 'text-2xl md:text-[28px]', sub: 'text-[10px] md:text-[11px] tracking-[0.3em] ml-[0.3em]' },
    lg: { word: 'text-3xl md:text-4xl', sub: 'text-xs md:text-[13px] tracking-[0.3em] ml-[0.3em]' },
  }[size];

  const content = (
    <div className="flex flex-col items-center">
      <div className="flex items-baseline">
        <span className={`${sizes.word} font-serif font-bold tracking-tight ${onDark ? 'text-primary-foreground' : 'text-primary'}`}>
          Vírgula
        </span>
        <span className={`${sizes.word} font-serif font-bold leading-none text-accent`}>,</span>
      </div>
      <span
        className={`font-sans font-normal uppercase leading-none mt-0.5 ${sizes.sub} ${
          onDark ? 'text-primary-200' : 'text-muted-foreground'
        }`}
      >
        Contábil
      </span>
    </div>
  );

  if (href) {
    return (
      <a href={href} className={`flex items-center gap-3 select-none hover:opacity-80 transition-opacity no-underline ${className}`}>
        {content}
      </a>
    );
  }
  return <div className={`flex items-center select-none ${className}`}>{content}</div>;
};
