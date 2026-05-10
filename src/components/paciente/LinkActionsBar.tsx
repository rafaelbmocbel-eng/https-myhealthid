import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Smartphone,
  Copy,
  Plus,
  Loader2,
  Fingerprint,
  CalendarDays,
  LayoutDashboard,
  Check,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, LucideIcon> = {
  myid: Fingerprint,
  agenda: CalendarDays,
  portal: LayoutDashboard,
};

export interface LinkActionItem {
  key: string;
  label: string;
  active: boolean;
  loading?: boolean;
  color?: string;
  onAction: () => void;
  onGenerate?: () => void;
  isWhatsApp: boolean;
}

interface LinkActionsBarProps {
  items: LinkActionItem[];
  className?: string;
}

const COLOR_MAP: Record<
  string,
  { bg: string; text: string; border: string; soft: string; ring: string }
> = {
  emerald: {
    bg: 'bg-emerald-500',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    soft: 'bg-emerald-50 hover:bg-emerald-100',
    ring: 'ring-emerald-500/20',
  },
  blue: {
    bg: 'bg-blue-500',
    text: 'text-blue-700',
    border: 'border-blue-200',
    soft: 'bg-blue-50 hover:bg-blue-100',
    ring: 'ring-blue-500/20',
  },
  violet: {
    bg: 'bg-violet-500',
    text: 'text-violet-700',
    border: 'border-violet-200',
    soft: 'bg-violet-50 hover:bg-violet-100',
    ring: 'ring-violet-500/20',
  },
  amber: {
    bg: 'bg-amber-500',
    text: 'text-amber-700',
    border: 'border-amber-200',
    soft: 'bg-amber-50 hover:bg-amber-100',
    ring: 'ring-amber-500/20',
  },
  primary: {
    bg: 'bg-primary',
    text: 'text-primary',
    border: 'border-primary/20',
    soft: 'bg-primary/10 hover:bg-primary/20',
    ring: 'ring-primary/20',
  },
};

export default function LinkActionsBar({ items, className }: LinkActionsBarProps) {
  if (items.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {items.map((item) => {
        const colors = COLOR_MAP[item.color || 'primary'] || COLOR_MAP.primary;
        const TypeIcon = ICON_MAP[item.key] || LayoutDashboard;

        if (item.active) {
          return (
            <Tooltip key={item.key} delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={item.onAction}
                  className={cn(
                    'group inline-flex items-center gap-2 h-8 pl-2 pr-2.5 rounded-lg border text-xs font-semibold transition-all shadow-sm',
                    'hover:shadow-md hover:-translate-y-px active:translate-y-0 active:scale-[0.98]',
                    colors.soft,
                    colors.border,
                    colors.text,
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex items-center justify-center w-5 h-5 rounded-md shrink-0',
                      colors.bg,
                    )}
                  >
                    <TypeIcon className="w-3 h-3 text-white" />
                  </span>
                  <span className="hidden sm:inline">{item.label}</span>
                  <span
                    className={cn(
                      'inline-flex items-center justify-center w-5 h-5 rounded-md shrink-0 ml-0.5',
                      item.isWhatsApp ? 'bg-[#25D366] text-white' : 'bg-foreground/5 text-foreground/70',
                    )}
                  >
                    {item.isWhatsApp ? (
                      <Smartphone className="w-3 h-3" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </span>
                  <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <p className="font-semibold">{item.label} · ativo</p>
                <p className="text-muted-foreground">
                  {item.isWhatsApp ? 'Clique para enviar via WhatsApp' : 'Clique para copiar o link'}
                </p>
              </TooltipContent>
            </Tooltip>
          );
        }

        return (
          <Tooltip key={item.key} delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={item.onGenerate}
                disabled={item.loading}
                className={cn(
                  'group inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-dashed border-border text-xs font-semibold text-muted-foreground transition-all',
                  'hover:border-solid hover:bg-muted/60 hover:text-foreground active:scale-[0.98]',
                  'disabled:opacity-60 disabled:cursor-wait',
                )}
              >
                <TypeIcon className="icon-sm shrink-0" />
                <span className="hidden sm:inline">{item.label}</span>
                {item.loading ? (
                  <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                ) : (
                  <Plus className="w-3 h-3 shrink-0" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <p className="font-semibold">Gerar link {item.label}</p>
              <p className="text-muted-foreground">Clique para criar um novo link compartilhável</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
