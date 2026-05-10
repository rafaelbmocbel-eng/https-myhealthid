import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle2, Clock, Lock } from 'lucide-react';

type Status = 'ativo' | 'carencia' | 'bloqueado';

interface Props {
  status: Status;
  diasRestantesCarencia?: number | null;
}

export default function StatusClinicoBadge({ status, diasRestantesCarencia }: Props) {
  const cfg = {
    ativo: {
      Icon: CheckCircle2,
      label: 'Ativo',
      cls: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      tip: 'Pacote ativo ou pagamento confirmado nos últimos 30 dias. Portal e atividades liberados.',
    },
    carencia: {
      Icon: Clock,
      label: `Carência ${diasRestantesCarencia ?? ''}d`.trim(),
      cls: 'bg-amber-100 text-amber-700 border-amber-200',
      tip: 'Sem pacote ativo. Portal segue aberto, mas você não pode criar exercícios, protocolos ou missões novas. Confirme um novo pagamento para liberar.',
    },
    bloqueado: {
      Icon: Lock,
      label: 'Bloqueado',
      cls: 'bg-muted text-muted-foreground border-border',
      tip: 'Mais de 60 dias sem pagamento. Portal mostra apenas histórico read-only. Confirme um pagamento ou crie um novo pacote para reativar.',
    },
  }[status];

  const Icon = cfg.Icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`${cfg.cls} gap-1 cursor-help`}>
            <Icon className="icon-xs" />
            {cfg.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{cfg.tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
