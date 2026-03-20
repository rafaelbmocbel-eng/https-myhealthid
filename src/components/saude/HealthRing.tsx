import { cn } from '@/lib/utils';

interface HealthRingProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  bgColor?: string;
  icon?: React.ReactNode;
  label: string;
  displayValue: string;
  unit?: string;
  className?: string;
}

export default function HealthRing({
  value, max, size = 100, strokeWidth = 8,
  color, bgColor, icon, label, displayValue, unit, className
}: HealthRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(1, Math.max(0, value / max));
  const offset = circumference * (1 - progress);

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke={bgColor || 'hsl(var(--muted))'}
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {icon && <div className="mb-0.5">{icon}</div>}
          <span className="text-sm font-black text-foreground leading-none">{displayValue}</span>
          {unit && <span className="text-[8px] text-muted-foreground">{unit}</span>}
        </div>
      </div>
      <span className="text-[10px] font-semibold text-muted-foreground text-center">{label}</span>
    </div>
  );
}
