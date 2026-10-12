import { Loader2 } from 'lucide-react';

// Rastreio do corpo em andamento: barra de progresso e botão para cancelar.
export default function PainelRastreio({ progresso, aoCancelar, texto }: { progresso: number; aoCancelar: () => void; texto?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, progresso)) * 100);
  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4" role="status" aria-live="polite" data-testid="painel-rastreio">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {texto ?? 'Achando o corpo em cada quadro…'} <span className="ml-auto tabular-nums">{pct}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Progresso do rastreio">
        <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">O vídeo é processado neste aparelho e não é enviado a lugar nenhum. Deixe a tela aberta até terminar.</p>
      <button type="button" onClick={aoCancelar} className="flex min-h-12 w-full items-center justify-center rounded-xl border border-border bg-background text-sm font-semibold hover:bg-muted/60">Cancelar</button>
    </div>
  );
}
