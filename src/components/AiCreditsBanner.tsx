import { useState } from 'react';
import { Sparkles, AlertTriangle, CheckCircle2, RefreshCw, ExternalLink, X, Clock, Wallet, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAiCreditsStatus, type AiCreditsStatus } from '@/hooks/useAiCreditsStatus';
import { cn } from '@/lib/utils';

// Top-up de créditos da Lovable Cloud & AI (mesma página de Settings → Workspace → Cloud & AI balance)
const TOPUP_URL = 'https://lovable.dev/settings/workspace';
const PLANS_URL = 'https://lovable.dev/settings/plans';
const DISMISS_KEY = 'ai_credits_banner_dismissed_until';

interface StatusVisual {
  variant: 'success' | 'warning' | 'destructive';
  icon: typeof Sparkles;
  title: string;
}

const VISUALS: Record<AiCreditsStatus, StatusVisual> = {
  active:        { variant: 'success',    icon: CheckCircle2,  title: 'IA ativa — créditos disponíveis' },
  exhausted:     { variant: 'destructive', icon: AlertTriangle, title: 'Créditos da IA esgotados' },
  rate_limited:  { variant: 'warning',    icon: Clock,         title: 'IA temporariamente limitada' },
  unconfigured:  { variant: 'destructive', icon: AlertTriangle, title: 'IA não configurada' },
  error:         { variant: 'warning',    icon: AlertTriangle, title: 'IA com instabilidade' },
  unknown:       { variant: 'warning',    icon: Sparkles,      title: 'Verificando IA...' },
};

const VARIANT_CLASSES: Record<StatusVisual['variant'], string> = {
  success:     'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  warning:     'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
  destructive: 'bg-destructive/10 text-destructive border-destructive/30',
};

function isDismissed(status: AiCreditsStatus): boolean {
  if (status !== 'active') return false;
  try {
    const until = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Date.now() < until;
  } catch { return false; }
}

function dismissForOneDay() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
  } catch { /* ignore */ }
}

export default function AiCreditsBanner() {
  const { status, message, detail, httpStatus, checkedAt, loading, refresh } = useAiCreditsStatus(true);
  const [dismissed, setDismissed] = useState(() => isDismissed(status));

  if (status === 'unknown' && loading) return null;
  if (status === 'active' && dismissed) return null;

  const visual = VISUALS[status];
  const Icon = visual.icon;
  const isProblem = status === 'exhausted' || status === 'unconfigured' || status === 'error' || status === 'rate_limited';

  return (
    <div
      className={cn(
        'mb-4 rounded-xl border px-3 py-3 md:px-4 md:py-4 flex flex-col gap-3 text-sm shadow-sm',
        VARIANT_CLASSES[visual.variant],
      )}
      role={isProblem ? 'alert' : 'status'}
    >
      {/* Linha principal: ícone + título + ações de canto */}
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{visual.title}</span>
            {httpStatus > 0 && isProblem && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-background/60 border border-current/20">
                HTTP {httpStatus}
              </span>
            )}
          </div>
          <p className="text-xs opacity-90 mt-0.5 break-words">
            {message}
            {detail && isProblem && (
              <span className="block text-[11px] opacity-70 mt-0.5 font-mono truncate">
                {detail}
              </span>
            )}
          </p>
          {checkedAt && (
            <p className="text-[10px] opacity-60 mt-1">
              Última verificação: {new Date(checkedAt).toLocaleTimeString('pt-BR')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={refresh}
            disabled={loading}
            className="h-8 w-8 p-0 hover:bg-background/60"
            title="Verificar novamente"
          >
            <RefreshCw className={cn('icon-sm', loading && 'animate-spin')} />
          </Button>
          {status === 'active' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { dismissForOneDay(); setDismissed(true); }}
              className="h-8 w-8 p-0 hover:bg-background/60"
              title="Ocultar por 24h"
            >
              <X className="icon-sm" />
            </Button>
          )}
        </div>
      </div>

      {/* Aviso sobre saldo + ações */}
      <div className="flex items-start gap-2 pt-2 border-t border-current/15">
        <Info className="icon-sm shrink-0 mt-0.5 opacity-70" />
        <p className="text-[11px] opacity-80 flex-1">
          O saldo exato em USD não é exposto pela API da Lovable AI. Para ver o valor restante e adicionar
          créditos, abra <span className="font-medium">Settings → Workspace → Cloud &amp; AI balance</span>.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          asChild
          size="sm"
          className="h-9 text-xs gap-1.5 bg-background hover:bg-background/80 text-foreground border border-current/30"
          variant="outline"
        >
          <a href={TOPUP_URL} target="_blank" rel="noopener noreferrer">
            <Wallet className="icon-sm" />
            Adicionar créditos
            <ExternalLink className="h-3 w-3 opacity-60" />
          </a>
        </Button>
        <Button
          asChild
          size="sm"
          variant="ghost"
          className="h-9 text-xs gap-1.5 hover:bg-background/60"
        >
          <a href={PLANS_URL} target="_blank" rel="noopener noreferrer">
            Ver planos
            <ExternalLink className="h-3 w-3 opacity-60" />
          </a>
        </Button>
      </div>
    </div>
  );
}
