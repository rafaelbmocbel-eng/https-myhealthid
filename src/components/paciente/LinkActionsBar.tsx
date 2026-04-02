import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Smartphone, Copy, Plus, Loader2, CalendarDays, Link2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LinkActionItem {
  key: string;
  label: string;
  /** Whether a link is currently active */
  active: boolean;
  /** Loading state when generating a link */
  loading?: boolean;
  /** Color accent for the icon label */
  color?: string;
  /** Called when the WhatsApp/copy button is clicked */
  onAction: () => void;
  /** Called when "generate" is clicked (only when !active) */
  onGenerate?: () => void;
  /** True if WhatsApp action, false if copy fallback */
  isWhatsApp: boolean;
}

interface LinkActionsBarProps {
  items: LinkActionItem[];
  className?: string;
}

const COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  primary: { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20' },
};

export default function LinkActionsBar({ items, className }: LinkActionsBarProps) {
  if (items.length === 0) return null;

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {items.map((item, idx) => {
        const colors = COLOR_MAP[item.color || 'primary'] || COLOR_MAP.primary;
        return (
          <Tooltip key={item.key} delayDuration={0}>
            <TooltipTrigger asChild>
              {item.active ? (
                <Button
                  size="icon"
                  className={cn(
                    'h-7 w-7 md:h-8 md:w-8 rounded-lg transition-all',
                    item.isWhatsApp
                      ? 'bg-[#25D366] hover:bg-[#20BE5C] text-white'
                      : cn('border', colors.bg, colors.text, colors.border, 'hover:opacity-80'),
                  )}
                  variant={item.isWhatsApp ? 'default' : 'outline'}
                  onClick={item.onAction}
                >
                  {item.isWhatsApp ? (
                    <Smartphone className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              ) : (
                <Button
                  size="icon"
                  variant="outline"
                  className="h-7 w-7 md:h-8 md:w-8 rounded-lg border-dashed text-muted-foreground/60"
                  disabled={item.loading}
                  onClick={item.onGenerate}
                >
                  {item.loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                </Button>
              )}
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <span className="font-semibold">{item.label}</span>
              {item.active
                ? item.isWhatsApp ? ' · Enviar via WhatsApp' : ' · Copiar link'
                : ' · Gerar link'
              }
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
