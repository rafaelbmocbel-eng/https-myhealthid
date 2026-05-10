import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { MyIDFreshnessInfo } from '@/hooks/useMyIDFreshness';

interface Props {
  info: MyIDFreshnessInfo;
  size?: 'xs' | 'sm';
  className?: string;
}

const COLORS: Record<MyIDFreshnessInfo['status'], string> = {
  fresh: 'bg-emerald-500',
  aging: 'bg-amber-500',
  stale: 'bg-rose-500',
  none: 'bg-muted-foreground/40',
};

const LABELS: Record<MyIDFreshnessInfo['status'], string> = {
  fresh: 'MyID atualizado',
  aging: 'MyID precisa atualizar',
  stale: 'MyID desatualizado',
  none: 'Sem MyID concluído',
};

export function MyIDFreshnessDot({ info, size = 'xs', className }: Props) {
  const dim = size === 'xs' ? 'h-1.5 w-1.5' : 'h-2 w-2';
  const tooltip = info.diasDesde != null
    ? `${LABELS[info.status]} (${info.diasDesde}d)`
    : LABELS[info.status];

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn('inline-block rounded-full shrink-0', dim, COLORS[info.status], className)}
            aria-label={tooltip}
          />
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
