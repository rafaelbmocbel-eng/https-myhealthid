import * as React from 'react';
import { cn } from '@/lib/utils';

type IllustrationVariant = 'inbox' | 'calendar' | 'patients' | 'chart' | 'search' | 'spark';

interface EmptyStateProps {
  icon?: React.ReactNode;
  /** Ilustração SVG premium (alternativa ao icon). Renderiza maior e com glow dourado. */
  illustration?: IllustrationVariant;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Estado vazio padronizado — clean, centralizado, sem ruído.
 * Use `illustration` para momentos hero (dashboard, listas principais).
 * Use `icon` para empty states inline/compactos.
 */
export function EmptyState({ icon, illustration, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center px-6 py-10 sm:py-14',
        className,
      )}
    >
      {illustration ? (
        <PremiumIllustration variant={illustration} />
      ) : icon ? (
        <div className="mb-3 h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground">
          {icon}
        </div>
      ) : null}
      <p className="h-card">{title}</p>
      {description && (
        <p className="text-caption mt-1.5 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Ilustrações SVG inline — dourado + navy, sem dependências.
   ───────────────────────────────────────────────────────────── */
function PremiumIllustration({ variant }: { variant: IllustrationVariant }) {
  return (
    <div className="relative mb-5 h-28 w-28 flex items-center justify-center animate-fade-in">
      {/* glow dourado por trás */}
      <div
        className="absolute inset-0 rounded-full opacity-70"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, hsl(42 60% 60% / 0.22) 0%, transparent 65%)',
          filter: 'blur(8px)',
        }}
        aria-hidden
      />
      <svg viewBox="0 0 120 120" className="relative h-24 w-24" fill="none">
        <defs>
          <linearGradient id="es-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(42 70% 70%)" />
            <stop offset="100%" stopColor="hsl(38 55% 45%)" />
          </linearGradient>
          <linearGradient id="es-navy" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.18" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.06" />
          </linearGradient>
        </defs>
        {/* circle base */}
        <circle cx="60" cy="60" r="46" fill="url(#es-navy)" />
        <circle cx="60" cy="60" r="46" stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray="2 4" opacity="0.6" />
        {variant === 'inbox' && (
          <>
            <path d="M32 58h14l4 8h20l4-8h14v22a4 4 0 0 1-4 4H36a4 4 0 0 1-4-4V58Z" fill="hsl(var(--card))" stroke="url(#es-gold)" strokeWidth="2" strokeLinejoin="round" />
            <path d="M40 42h40l-4 16H44l-4-16Z" stroke="url(#es-gold)" strokeWidth="2" strokeLinejoin="round" />
          </>
        )}
        {variant === 'calendar' && (
          <>
            <rect x="32" y="40" width="56" height="48" rx="6" fill="hsl(var(--card))" stroke="url(#es-gold)" strokeWidth="2" />
            <path d="M32 52h56" stroke="url(#es-gold)" strokeWidth="2" />
            <path d="M44 34v10M76 34v10" stroke="url(#es-gold)" strokeWidth="3" strokeLinecap="round" />
            <circle cx="60" cy="70" r="4" fill="url(#es-gold)" />
          </>
        )}
        {variant === 'patients' && (
          <>
            <circle cx="60" cy="50" r="12" fill="hsl(var(--card))" stroke="url(#es-gold)" strokeWidth="2" />
            <path d="M36 86c2-12 12-18 24-18s22 6 24 18" fill="hsl(var(--card))" stroke="url(#es-gold)" strokeWidth="2" strokeLinecap="round" />
          </>
        )}
        {variant === 'chart' && (
          <>
            <path d="M34 84h52" stroke="hsl(var(--border))" strokeWidth="2" strokeLinecap="round" />
            <rect x="40" y="64" width="8" height="20" rx="2" fill="url(#es-gold)" opacity="0.7" />
            <rect x="56" y="52" width="8" height="32" rx="2" fill="url(#es-gold)" />
            <rect x="72" y="42" width="8" height="42" rx="2" fill="url(#es-gold)" opacity="0.85" />
            <path d="M38 50l16-10 16 6 14-14" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
        {variant === 'search' && (
          <>
            <circle cx="54" cy="54" r="18" fill="hsl(var(--card))" stroke="url(#es-gold)" strokeWidth="2.5" />
            <path d="M68 68l14 14" stroke="url(#es-gold)" strokeWidth="3" strokeLinecap="round" />
          </>
        )}
        {variant === 'spark' && (
          <>
            <path d="M60 32l6 18 18 6-18 6-6 18-6-18-18-6 18-6 6-18Z" fill="url(#es-gold)" opacity="0.85" />
            <circle cx="88" cy="40" r="3" fill="url(#es-gold)" />
            <circle cx="34" cy="80" r="2.5" fill="url(#es-gold)" opacity="0.7" />
          </>
        )}
      </svg>
    </div>
  );
}

export default EmptyState;
