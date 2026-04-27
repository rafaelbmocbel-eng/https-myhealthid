import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Padrão global de Badge — MY HEALTH ID
 *
 * - shrink-0: nunca encolhe e quebra layout em flex
 * - whitespace-nowrap: não quebra texto entre linhas
 * - max-w-full + truncate: trunca quando o container é estreito
 * - Tamanhos: xs (h-4) | sm (h-5, padrão) | md (h-6) | lg (h-7)
 * - Variantes semânticas: success, warning, danger, info, neutral
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 shrink-0 whitespace-nowrap max-w-full [&>span]:truncate",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground border-border bg-background",
        // Semantic
        success: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400",
        warning: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400",
        danger: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400",
        info: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-400",
        neutral: "border-border bg-muted text-muted-foreground",
      },
      size: {
        xs: "h-4 px-1.5 text-[9px] leading-none",
        sm: "h-5 px-2 text-[10px] leading-none",
        md: "h-6 px-2.5 text-xs leading-none",
        lg: "h-7 px-3 text-sm leading-none",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "sm",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, size, ...props }, ref) => {
    return <div ref={ref} className={cn(badgeVariants({ variant, size }), className)} {...props} />;
  }
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
