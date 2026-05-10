import { Package, CheckCircle2 } from 'lucide-react';

import { usePatientSessionStats } from '@/hooks/usePatientSessionStats';

interface AgendaPatientStatsProps {
  pacienteId: string;
}

export default function AgendaPatientStats({ pacienteId }: AgendaPatientStatsProps) {
  const { isLoading, pacote, sessoesRestantes, totalSessoes } = usePatientSessionStats(pacienteId);

  return (
    <div className="grid gap-2 border-t border-border/60 pt-3 sm:grid-cols-2">
      <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <CheckCircle2 className="icon-sm text-primary" />
          <span>Sessões realizadas</span>
        </div>
        <p className="mt-1 text-sm font-bold text-foreground">
          {isLoading ? 'Carregando…' : totalSessoes}
        </p>
      </div>

      <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Package className="icon-sm text-primary" />
          <span>Pacote ativo</span>
        </div>
        <p className="mt-1 text-sm font-bold text-foreground">
          {isLoading ? 'Carregando…' : pacote ? `${pacote.sessoes_utilizadas}/${pacote.total_sessoes}` : 'Sem pacote ativo'}
        </p>
        {!isLoading && pacote && (
          <p className="text-[11px] text-muted-foreground">{sessoesRestantes} restantes</p>
        )}
      </div>
    </div>
  );
}
