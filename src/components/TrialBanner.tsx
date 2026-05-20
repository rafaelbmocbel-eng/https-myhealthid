import { Link } from 'react-router-dom';
import { Sparkles, Clock, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { usePlanoAtivo } from '@/hooks/usePlanoAtivo';
import { Button } from '@/components/ui/button';

const DISMISS_KEY = 'mhid.trial-banner-dismissed-day';

/**
 * Banner global mostrado para usuários em trial.
 * Não bloqueia uso. Mostra dias restantes + CTA para /precos.
 * Pode ser fechado por dia (reaparece no dia seguinte).
 */
export default function TrialBanner() {
  const { data: plano } = usePlanoAtivo();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const today = new Date().toDateString();
    if (localStorage.getItem(DISMISS_KEY) === today) setDismissed(true);
  }, []);

  if (dismissed || !plano || plano.status !== 'trial' || !plano.data_fim) return null;

  const diasRestantes = Math.max(
    0,
    Math.ceil((new Date(plano.data_fim).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  );

  const urgente = diasRestantes <= 3;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, new Date().toDateString());
    setDismissed(true);
  };

  return (
    <div
      className={`relative flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-xs sm:text-sm ${
        urgente
          ? 'border-destructive/30 bg-destructive/5 text-destructive-foreground'
          : 'border-primary/20 bg-primary/5'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {urgente ? (
          <Clock className="h-4 w-4 shrink-0 text-destructive" />
        ) : (
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
        )}
        <span className="truncate">
          <strong className="font-semibold">Trial Profissional</strong>{' '}
          <span className="text-muted-foreground">
            — {diasRestantes === 0
              ? 'expira hoje'
              : diasRestantes === 1
              ? '1 dia restante'
              : `${diasRestantes} dias restantes`}
          </span>
        </span>
      </div>
      <div className="flex items-center gap-1">
        <Link to="/precos">
          <Button size="sm" variant={urgente ? 'destructive' : 'default'} className="h-7 px-3 text-xs">
            Assinar agora
          </Button>
        </Link>
        <button
          onClick={handleDismiss}
          aria-label="Fechar"
          className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-foreground/5"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
