import { cn } from "@/lib/utils";

/**
 * Premium skeleton: shimmer effect com leve toque dourado.
 * Combina pulse + um gradient sweep horizontal sutil.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted/70 animate-pulse",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_ease-in-out_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-[hsl(42_60%_70%/0.18)] before:to-transparent",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
