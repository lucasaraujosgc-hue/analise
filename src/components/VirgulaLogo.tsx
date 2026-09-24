import React from 'react';

interface VirgulaLogoProps {
  size?: 'sm' | 'md' | 'lg';
  theme?: 'dark' | 'light';
  className?: string;
}

export const VirgulaLogo: React.FC<VirgulaLogoProps> = ({
  size = 'md',
  theme = 'dark',
  className = '',
}) => {
  const isLight = theme === 'light';

  const textPrimary = isLight
    ? 'text-[oklch(0.36_0.06_165)]'
    : 'text-white';

  const textAccent = 'text-[oklch(0.72_0.14_55)]';

  const textMuted = isLight
    ? 'text-[oklch(0.48_0.02_160)]'
    : 'text-slate-300';

  const sizeClasses = {
    sm: {
      text: 'text-xl',
      comma: 'text-xl',
      sub: 'text-[9px] tracking-[0.28em] ml-[0.28em]',
    },
    md: {
      text: 'text-2xl md:text-[28px]',
      comma: 'text-2xl md:text-[28px]',
      sub: 'text-[10px] md:text-[11px] tracking-[0.3em] ml-[0.3em]',
    },
    lg: {
      text: 'text-3xl md:text-4xl',
      comma: 'text-3xl md:text-4xl',
      sub: 'text-xs md:text-sm tracking-[0.32em] ml-[0.32em]',
    },
  }[size];

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      <div className="flex items-baseline">
        <span
          className={`${sizeClasses.text} font-bold ${textPrimary} tracking-tight`}
          style={{ fontFamily: "'Fraunces', Georgia, serif" }}
        >
          Vírgula
        </span>
        <span
          className={`${sizeClasses.comma} font-bold ${textAccent} leading-none`}
          style={{ fontFamily: "'Fraunces', Georgia, serif" }}
        >
          ,
        </span>
      </div>
      <span
        className={`font-sans font-normal ${textMuted} uppercase leading-none mt-0.5 ${sizeClasses.sub}`}
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        Contábil
      </span>
    </div>
  );
};
