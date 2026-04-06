import { Package } from 'lucide-react';

import { usePatientSessionStats } from '@/hooks/usePatientSessionStats';

interface PacoteBadgeProps {
  pacienteId: string;
}

export default function PacoteBadge({ pacienteId }: PacoteBadgeProps) {
  const { pacote: pacoteAtivo, sessoesRestantes } = usePatientSessionStats(pacienteId);

  if (!pacoteAtivo) return null;

  return (
    <div className="flex flex-col flex-shrink-0 items-center justify-center gap-1">
      <span className="text-[9px] md:text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Pacote</span>
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border bg-muted/40">
        <Package className="h-3 w-3 text-primary" />
        <span className="text-xs font-bold">
          {pacoteAtivo.sessoes_utilizadas}/{pacoteAtivo.total_sessoes}
        </span>
        <span className="text-[9px] text-muted-foreground">
          {sessoesRestantes && sessoesRestantes > 0 ? `(${sessoesRestantes} rest.)` : '✓'}
        </span>
      </div>
    </div>
  );
}
