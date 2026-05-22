import { useState, lazy, Suspense } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, Instagram, Link2, Crosshair, Loader2 } from 'lucide-react';

const CrmTrafegoOrigem = lazy(() => import('./trafego/CrmTrafegoOrigem'));
const CrmTrafegoInstagram = lazy(() => import('./trafego/CrmTrafegoInstagram'));
const CrmTrafegoLinks = lazy(() => import('./trafego/CrmTrafegoLinks'));
const CrmTrafegoPixels = lazy(() => import('./trafego/CrmTrafegoPixels'));

type Sub = 'origem' | 'instagram' | 'links' | 'pixels';

const SUBS: { key: Sub; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'origem', label: 'Origem', icon: TrendingUp },
  { key: 'instagram', label: 'Instagram', icon: Instagram },
  { key: 'links', label: 'Links UTM', icon: Link2 },
  { key: 'pixels', label: 'Pixels', icon: Crosshair },
];

interface Props {
  embedded?: boolean;
}

export default function CrmTrafego({ embedded = false }: Props) {
  const [sub, setSub] = useState<Sub>('origem');

  return (
    <div className={embedded ? '' : 'min-h-screen bg-background'}>
      <div className="border-b border-border/40 bg-card/30 sticky top-0 z-10">
        <div className="px-3 sm:px-5 py-3">
          <h1 className="h-section">Tráfego</h1>
          <p className="text-caption mt-0.5">De onde vêm seus leads e como divulgar melhor</p>
        </div>
        <div className="overflow-x-auto">
          <div className="flex gap-1 px-2 pb-2 min-w-max">
            {SUBS.map((s) => {
              const active = sub === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setSub(s.key)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors whitespace-nowrap',
                    active ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:bg-muted/60',
                  )}
                >
                  <s.icon className="icon-xs shrink-0" />
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <Suspense fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }>
        {sub === 'origem' && <CrmTrafegoOrigem />}
        {sub === 'instagram' && <CrmTrafegoInstagram />}
        {sub === 'links' && <CrmTrafegoLinks />}
        {sub === 'pixels' && <CrmTrafegoPixels />}
      </Suspense>
    </div>
  );
}
