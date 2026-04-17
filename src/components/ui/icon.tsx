import { LucideIcon, LucideProps } from 'lucide-react';
import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

/**
 * Sistema de ícones padronizado do app.
 *
 * Padrões oficiais (use SEMPRE estes tamanhos):
 *  - xs  (h-3, 12px)  — listas compactas, badges, chips
 *  - sm  (h-4, 16px)  — PADRÃO em botões, inputs, labels e cards
 *  - md  (h-5, 20px)  — hero sections, headers de página, destaques
 *  - lg  (h-6, 24px)  — ícones de avatar, empty states pequenos
 *  - xl  (h-8, 32px)  — empty states, modais
 *
 * Cores: SEMPRE use tokens semânticos (text-primary, text-muted-foreground).
 * Nunca use cores hardcoded (text-blue-500, text-red-600).
 *
 * Exemplo:
 *   <Icon icon={Calendar} size="sm" className="text-primary" />
 */

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_MAP: Record<IconSize, string> = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-8 w-8',
};

interface IconProps extends Omit<LucideProps, 'size'> {
  icon: LucideIcon;
  size?: IconSize;
}

export const Icon = forwardRef<SVGSVGElement, IconProps>(
  ({ icon: LucideIconComp, size = 'sm', className, ...props }, ref) => {
    return (
      <LucideIconComp
        ref={ref}
        className={cn(SIZE_MAP[size], 'shrink-0', className)}
        {...props}
      />
    );
  }
);

Icon.displayName = 'Icon';
