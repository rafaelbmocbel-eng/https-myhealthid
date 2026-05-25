import { useEffect, useState } from 'react';

interface ConfettiBurstProps {
  /** quando true, dispara o burst e auto-some após `duration`ms */
  trigger: boolean;
  duration?: number;
  pieces?: number;
}

/**
 * Celebração premium em CSS puro (sem dependências).
 * Mistura dourado, navy e cyan — paleta MY HEALTH ID.
 * Use em momentos de conquista (MyID concluído, missão completa, pagamento ok).
 */
export function ConfettiBurst({ trigger, duration = 3500, pieces = 36 }: ConfettiBurstProps) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (trigger) {
      setActive(true);
      const t = setTimeout(() => setActive(false), duration);
      return () => clearTimeout(t);
    }
  }, [trigger, duration]);

  if (!active) return null;

  const colors = [
    'hsl(42 60% 55%)',   // gold
    'hsl(38 55% 45%)',   // gold-deep
    'hsl(190 85% 50%)',  // accent cyan
    'hsl(218 50% 25%)',  // primary navy
    'hsl(42 70% 75%)',   // gold-light
  ];

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden" aria-hidden="true">
      {Array.from({ length: pieces }).map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.6;
        const dur = 2.4 + Math.random() * 1.6;
        const size = 6 + Math.random() * 8;
        const color = colors[i % colors.length];
        const isCircle = Math.random() > 0.6;
        return (
          <span
            key={i}
            className="absolute top-0"
            style={{
              left: `${left}%`,
              width: size,
              height: size * (isCircle ? 1 : 0.4),
              background: color,
              borderRadius: isCircle ? '50%' : '2px',
              animation: `confetti-fall ${dur}s ${delay}s cubic-bezier(0.25, 0.6, 0.4, 1) forwards`,
              boxShadow: `0 0 8px ${color}66`,
            }}
          />
        );
      })}
    </div>
  );
}
