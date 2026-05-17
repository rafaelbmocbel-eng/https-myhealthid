import { useState } from 'react';
import logoSrc from '@/assets/logo-myhealthid.png';

export default function LogoIcon({
  size = 40,
  className = '',
  glow = false
}: {
  size?: number;
  className?: string;
  glow?: boolean
}) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div
      className={`relative inline-flex items-center justify-center overflow-hidden rounded-full ${glow ? 'animate-pulse-slow' : ''}`}
      style={{ width: size, height: size }}
    >
      {glow && (
        <div
          className="absolute inset-0 rounded-full bg-accent/40 blur-md transition-all duration-1000"
        />
      )}

      {!imageFailed ? (
        <img
          src={logoSrc}
          alt="My Health ID"
          width={size}
          height={size}
          loading="eager"
          decoding="async"
          onError={() => setImageFailed(true)}
          className={`relative h-full w-full rounded-full border border-border/60 object-cover shadow-lg ${className}`}
        />
      ) : (
        <div
          aria-label="My Health ID"
          className={`relative flex h-full w-full items-center justify-center rounded-full border border-border/60 bg-primary text-primary-foreground shadow-lg ${className}`}
        >
          <span className="text-[0.42em] font-black tracking-[0.2em]">MH</span>
        </div>
      )}
    </div>
  );
}
