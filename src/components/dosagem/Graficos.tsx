import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ACC } from '@/lib/dosagem/acentos';
import { fmt } from '@/lib/dosagem/calculos';
import type { Tom } from './visual';

// Gráficos esquemáticos em SVG, no tema claro e escuro. Os de forma de onda
// são ilustrações FORA DE ESCALA — as legendas trazem os valores reais.

export function GraficoCard({ titulo, legenda, children, className }: { titulo: string; legenda?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <figure className={cn('rounded-2xl border border-border/60 bg-card p-3.5', className)}>
      <figcaption className="mb-2 text-xs font-semibold text-foreground/90">{titulo}</figcaption>
      {children}
      {legenda && <p className="mt-1.5 text-[10.5px] leading-snug text-muted-foreground">{legenda}</p>}
    </figure>
  );
}

const MARCADOR: Record<Tom, string> = {
  bom: 'fill-emerald-500',
  atencao: 'fill-amber-500',
  ruim: 'fill-red-500',
  neutro: 'fill-foreground',
};

// ───────────────────────────── Laser: faixa de energia ─────────────────────────

export function JanelaDose({ min, max, valor, unidade = 'J', tom = 'neutro' }: {
  min?: number; max?: number; valor: number | null; unidade?: string; tom?: Tom;
}) {
  const id = useId().replace(/:/g, '');
  const W = 320, H = 96, pad = 18;
  const v = valor ?? 0;
  const topo = Math.max(max ? max * 1.5 : min ? min * 2.6 : v * 1.4 || 10, v * 1.15, 1);
  const x = (n: number) => pad + (Math.min(n, topo) / topo) * (W - 2 * pad);
  const x0 = min !== undefined ? x(min) : null;
  const x1 = min !== undefined ? x(max ?? topo) : null;
  const aberto = min !== undefined && max === undefined;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Posição da dose por ponto em relação à faixa da literatura">
      <defs>
        <linearGradient id={`${id}-b`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="rgb(16 185 129)" stopOpacity="0.75" />
          <stop offset="1" stopColor="rgb(16 185 129)" stopOpacity={aberto ? 0.05 : 0.75} />
        </linearGradient>
      </defs>
      <rect x={pad} y={44} width={W - 2 * pad} height={12} rx={6} className="fill-muted" />
      {x0 !== null && x1 !== null && <rect x={x0} y={44} width={Math.max(x1 - x0, 2)} height={12} rx={6} fill={`url(#${id}-b)`} />}
      {x0 !== null && (
        <>
          <line x1={x0} x2={x0} y1={40} y2={60} className="stroke-emerald-600" strokeWidth={1.5} />
          <text x={x0} y={76} textAnchor="middle" className="fill-muted-foreground text-[10px]">mín. {fmt(min, 1)} {unidade}</text>
        </>
      )}
      {max !== undefined && x1 !== null && (
        <>
          <line x1={x1} x2={x1} y1={40} y2={60} className="stroke-emerald-600" strokeWidth={1.5} />
          <text x={x1} y={76} textAnchor="middle" className="fill-muted-foreground text-[10px]">{fmt(max, 1)} {unidade}</text>
        </>
      )}
      {valor !== null && valor > 0 && (
        <g>
          <line x1={x(v)} x2={x(v)} y1={34} y2={50} className="stroke-foreground/50" strokeWidth={1} strokeDasharray="2 2" />
          <circle cx={x(v)} cy={50} r={8.5} className={cn(MARCADOR[tom], 'stroke-background')} strokeWidth={2.5} />
          <text x={x(v)} y={26} textAnchor="middle" className="fill-foreground text-[11px] font-bold">{fmt(v, 1)} {unidade}</text>
        </g>
      )}
    </svg>
  );
}

// ───────────────────────── Ultrassom: curva de aquecimento ───────────────────

export function CurvaAquecimento({ taxa, tempoMin }: { taxa: number; tempoMin: number | null }) {
  const id = useId().replace(/:/g, '');
  const W = 320, H = 176, l = 38, r = 12, t = 14, b = 28;
  const tMax = Math.min(120, Math.max(12, (tempoMin ?? 0) * 1.15, (4 / taxa) * 1.12));
  const yMax = 5;
  const X = (m: number) => l + (m / tMax) * (W - l - r);
  const Y = (c: number) => H - b - (Math.min(c, yMax) / yMax) * (H - t - b);
  const passo = tMax <= 16 ? 2 : tMax <= 40 ? 10 : 20;
  const ticks: number[] = [];
  for (let m = 0; m <= tMax; m += passo) ticks.push(m);
  const fimLinha = Math.min(tMax, yMax / taxa);
  const dT = tempoMin ? taxa * tempoMin : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Aquecimento estimado ao longo do tempo">
      <defs>
        <pattern id={`${id}-h`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" className="stroke-muted-foreground/30" strokeWidth="2" />
        </pattern>
        <linearGradient id={`${id}-a`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="rgb(249 115 22)" stopOpacity="0.28" />
          <stop offset="1" stopColor="rgb(249 115 22)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* grade e metas de 1, 2 e 4 °C */}
      {[1, 2, 4].map((c) => (
        <g key={c}>
          <line x1={l} x2={W - r} y1={Y(c)} y2={Y(c)} className="stroke-border" strokeWidth={1} strokeDasharray="3 3" />
          <text x={l - 6} y={Y(c) + 3} textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">{c} °C</text>
        </g>
      ))}
      <line x1={l} x2={W - r} y1={Y(0)} y2={Y(0)} className="stroke-border" strokeWidth={1} />
      {/* região além dos 10 min medidos */}
      {tMax > 10 && <rect x={X(10)} y={t} width={W - r - X(10)} height={H - t - b} fill={`url(#${id}-h)`} />}
      {tMax > 10 && <text x={W - r - 3} y={t + 10} textAnchor="end" className="fill-muted-foreground text-[9px]">além dos 10 min medidos</text>}
      {/* área e linha */}
      <path d={`M ${X(0)} ${Y(0)} L ${X(fimLinha)} ${Y(taxa * fimLinha)} L ${X(fimLinha)} ${Y(0)} Z`} fill={`url(#${id}-a)`} />
      <line x1={X(0)} y1={Y(0)} x2={X(fimLinha)} y2={Y(taxa * fimLinha)} stroke="rgb(249 115 22)" strokeWidth={2.5} strokeLinecap="round" />
      {/* tempo escolhido */}
      {tempoMin && dT !== null && tempoMin <= tMax && (
        <g>
          <line x1={X(tempoMin)} x2={X(tempoMin)} y1={Y(0)} y2={Y(dT)} className="stroke-foreground/50" strokeWidth={1} strokeDasharray="2 2" />
          <circle cx={X(tempoMin)} cy={Y(dT)} r={5.5} fill="rgb(249 115 22)" className="stroke-background" strokeWidth={2} />
          <text x={Math.min(X(tempoMin), W - 44)} y={Math.max(Y(dT) - 10, t + 10)} textAnchor="middle" className="fill-foreground text-[11px] font-bold tabular-nums">≈ {fmt(dT, 1)} °C</text>
        </g>
      )}
      {ticks.map((m) => (
        <text key={m} x={X(m)} y={H - 10} textAnchor="middle" className="fill-muted-foreground text-[10px] tabular-nums">{m}{m === ticks[ticks.length - 1] ? ' min' : ''}</text>
      ))}
    </svg>
  );
}

// ───────────────────────────── Ondas de choque: EFD ──────────────────────────

export function MedidorEfd({ valor }: { valor: number | null }) {
  const id = useId().replace(/:/g, '');
  const W = 320, H = 100, pad = 14, max = 0.8;
  const X = (n: number) => pad + (Math.min(n, max) / max) * (W - 2 * pad);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Posição da EFD em relação aos ensaios">
      <defs>
        <linearGradient id={`${id}-g`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="rgb(110 231 183)" />
          <stop offset="0.5" stopColor="rgb(253 230 138)" />
          <stop offset="1" stopColor="rgb(253 164 175)" />
        </linearGradient>
      </defs>
      <rect x={pad} y={42} width={W - 2 * pad} height={13} rx={6.5} fill={`url(#${id}-g)`} className="opacity-90 dark:opacity-60" />
      {/* faixa observada nos ensaios */}
      <rect x={X(0.03)} y={62} width={X(0.78) - X(0.03)} height={4} rx={2} className="fill-foreground/25" />
      <text x={X(0.4)} y={78} textAnchor="middle" className="fill-muted-foreground text-[9.5px]">faixa dos ensaios 0,03–0,78</text>
      {/* limite arbitrário de 0,2 */}
      <line x1={X(0.2)} x2={X(0.2)} y1={36} y2={61} className="stroke-foreground/60" strokeWidth={1.2} strokeDasharray="3 2" />
      <text x={X(0.2)} y={92} textAnchor="middle" className="fill-muted-foreground text-[9.5px]">0,2 (limite arbitrário)</text>
      {/* média 0,19 */}
      <path d={`M ${X(0.19)} 33 l 4 -6 h -8 z`} className="fill-foreground/70" />
      <text x={X(0.19) - 7} y={22} textAnchor="end" className="fill-muted-foreground text-[9.5px]">média 0,19</text>
      {valor !== null && valor > 0 && (
        <g>
          <circle cx={X(valor)} cy={48.5} r={9} className="fill-foreground stroke-background" strokeWidth={2.5} />
          <text x={Math.min(Math.max(X(valor), 30), W - 30)} y={14} textAnchor="middle" className="fill-foreground text-[11px] font-bold tabular-nums">{fmt(valor, 2)} mJ/mm²</text>
        </g>
      )}
      <text x={pad} y={H - 1} className="fill-muted-foreground text-[9.5px]">0</text>
      <text x={W - pad} y={H - 1} textAnchor="end" className="fill-muted-foreground text-[9.5px]">0,8</text>
    </svg>
  );
}

// ───────────────────────────── Formas de onda (esquemas) ─────────────────────

const Rotulo = ({ x, y, children, anchor = 'middle' }: { x: number; y: number; children: ReactNode; anchor?: 'start' | 'middle' | 'end' }) => (
  <text x={x} y={y} textAnchor={anchor} className="fill-muted-foreground text-[10px] tabular-nums">{children}</text>
);

/** Trem de pulsos retangulares: largura e período. */
export function OndaPulsos({ larguraTxt, periodoTxt, bifasico = false }: { larguraTxt: string; periodoTxt: string; bifasico?: boolean }) {
  const W = 320, H = 138, base = 70, amp = 32, w = 22, P = 96, x0 = 30;
  const pulsos = [0, 1, 2].map((i) => x0 + i * P);
  const caminho = pulsos
    .map((x) => (bifasico
      ? `M ${x} ${base} V ${base - amp} H ${x + w} V ${base + amp} H ${x + 2 * w} V ${base}`
      : `M ${x} ${base} V ${base - amp} H ${x + w} V ${base}`))
    .join(' ');
  const larg = bifasico ? 2 * w : w;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Trem de pulsos: largura e período (esquema fora de escala)">
      <line x1={10} x2={W - 10} y1={base} y2={base} className="stroke-border" strokeWidth={1} />
      <path d={`M 10 ${base} H ${x0} ${caminho} H ${W - 10}`} fill="none" className={ACC.traco} strokeWidth={2.2} strokeLinejoin="round" />
      {/* largura */}
      <path d={`M ${pulsos[0]} ${base - amp - 8} v -4 H ${pulsos[0] + larg} v 4`} fill="none" className="stroke-muted-foreground" strokeWidth={1} />
      <Rotulo x={pulsos[0] + larg / 2} y={base - amp - 16}>{larguraTxt}</Rotulo>
      {/* período */}
      <path d={`M ${pulsos[0]} ${base + amp + 10} h ${P}`} fill="none" className="stroke-muted-foreground" strokeWidth={1} />
      <path d={`M ${pulsos[0]} ${base + amp + 6} v 8 M ${pulsos[1]} ${base + amp + 6} v 8`} fill="none" className="stroke-muted-foreground" strokeWidth={1} />
      <Rotulo x={(pulsos[0] + pulsos[1]) / 2 + larg / 2} y={base + amp + 26}>{periodoTxt}</Rotulo>
    </svg>
  );
}

/** Ciclo de contração: rampa, estímulo (on) e repouso (off). */
export function OndaOnOff({ onS, offS, rampaS }: { onS: number; offS: number; rampaS: number }) {
  const W = 320, H = 126, base = 82, amp = 46, x0 = 16;
  const ciclo = (W - 2 * x0) / 2;
  const fOn = Math.min(0.86, Math.max(0.14, onS / (onS + offS)));
  const wOn = ciclo * fOn;
  const rampa = Math.min(wOn / 3, Math.max(4, (rampaS / (onS + offS)) * ciclo));
  const desenho = [0, 1].map((i) => {
    const x = x0 + i * ciclo;
    return `M ${x} ${base} L ${x + rampa} ${base - amp} H ${x + wOn - rampa} L ${x + wOn} ${base} H ${x + ciclo}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Ciclo de contração: rampa, on e off (esquema proporcional ao ciclo)">
      <line x1={x0} x2={W - x0} y1={base} y2={base} className="stroke-border" strokeWidth={1} />
      <path d={desenho} fill="none" className={ACC.traco} strokeWidth={2.4} strokeLinejoin="round" />
      <path d={`M ${x0 + rampa} ${base - amp} L ${x0 + wOn - rampa} ${base - amp} L ${x0 + wOn} ${base} L ${x0} ${base} Z`} className={ACC.preenchSuave} />
      <Rotulo x={x0 + wOn / 2} y={base - amp - 8}>ON {fmt(onS, 1)} s</Rotulo>
      <Rotulo x={x0 + wOn + (ciclo - wOn) / 2} y={base + 18}>OFF {fmt(offS, 1)} s</Rotulo>
      {rampaS > 0 && <Rotulo x={x0} y={base + 32} anchor="start">rampa {fmt(rampaS, 1)} s</Rotulo>}
    </svg>
  );
}

/** Bursts de portadora de kHz modulados em baixa frequência (russa). */
export function OndaBursts({ portadoraTxt, burstTxt, periodoTxt, ciclo }: { portadoraTxt: string; burstTxt: string; periodoTxt: string; ciclo: number }) {
  const W = 320, H = 150, base = 68, amp = 24, x0 = 16, P = (W - 2 * x0) / 3;
  const duty = Math.min(0.9, Math.max(0.18, ciclo));
  const wB = P * duty;
  const ciclos = Math.max(4, Math.round(12 * duty));
  const partes: string[] = [];
  for (let i = 0; i < 3; i++) {
    const xi = x0 + i * P;
    let d = `M ${xi} ${base}`;
    const n = 80;
    for (let k = 1; k <= n; k++) {
      const u = k / n;
      d += ` L ${xi + u * wB} ${base - amp * Math.sin(u * ciclos * 2 * Math.PI)}`;
    }
    d += ` L ${xi + P} ${base}`;
    partes.push(d);
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Bursts da portadora de kHz (esquema fora de escala)">
      <line x1={x0} x2={W - x0} y1={base} y2={base} className="stroke-border" strokeWidth={1} />
      <path d={partes.join(' ')} fill="none" className={ACC.traco} strokeWidth={1.6} strokeLinejoin="round" />
      <path d={`M ${x0} ${base - amp - 8} v -4 H ${x0 + wB} v 4`} fill="none" className="stroke-muted-foreground" strokeWidth={1} />
      <Rotulo x={x0 + wB / 2} y={base - amp - 16}>{burstTxt}</Rotulo>
      <path d={`M ${x0} ${base + amp + 8} v 8 M ${x0 + P} ${base + amp + 8} v 8 M ${x0} ${base + amp + 12} h ${P}`} fill="none" className="stroke-muted-foreground" strokeWidth={1} />
      <Rotulo x={x0 + P / 2} y={base + amp + 28}>{periodoTxt}</Rotulo>
      <Rotulo x={W / 2} y={H - 4}>{portadoraTxt}</Rotulo>
    </svg>
  );
}

/** Duas portadoras e o batimento (interferencial). */
export function OndaBatimento({ f1Txt, f2Txt, batTxt }: { f1Txt: string; f2Txt: string; batTxt: string }) {
  const W = 320, H = 184, x0 = 14, comp = W - 2 * x0, n = 360;
  const NC = 14; // ciclos desenhados da portadora de menor frequência, em 2 batimentos
  const caminho = (fn: (u: number) => number, yc: number, a: number) => {
    let d = '';
    for (let k = 0; k <= n; k++) {
      const u = k / n;
      d += `${k === 0 ? 'M' : 'L'} ${x0 + u * comp} ${yc - a * fn(u)} `;
    }
    return d;
  };
  const s1 = (u: number) => Math.sin(2 * Math.PI * NC * u);
  const s2 = (u: number) => Math.sin(2 * Math.PI * (NC + 2) * u);
  const soma = (u: number) => (s1(u) + s2(u)) / 2;
  // sin(a) + sin(b) = 2·sin((a+b)/2)·cos((a−b)/2): a envoltória é |cos(2π·u)|, com 2 batimentos em u ∈ [0, 1].
  const env = (u: number) => Math.abs(Math.cos(2 * Math.PI * u));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Duas correntes e o batimento resultante (esquema fora de escala)">
      <text x={x0} y={11} className="fill-muted-foreground text-[10px] tabular-nums">corrente 1 · {f1Txt}</text>
      <path d={caminho(s1, 30, 9)} fill="none" className="stroke-muted-foreground/70" strokeWidth={1.2} />
      <text x={x0} y={56} className="fill-muted-foreground text-[10px] tabular-nums">corrente 2 · {f2Txt}</text>
      <path d={caminho(s2, 75, 9)} fill="none" className="stroke-muted-foreground/70" strokeWidth={1.2} />
      <text x={x0} y={100} className="fill-foreground text-[10px] font-semibold">soma: o batimento</text>
      <line x1={x0} x2={W - x0} y1={142} y2={142} className="stroke-border" strokeWidth={1} />
      <path d={caminho(soma, 142, 34)} fill="none" className={ACC.traco} strokeWidth={1.6} strokeLinejoin="round" />
      <path d={caminho(env, 142, 34)} fill="none" className="stroke-foreground/45" strokeWidth={1} strokeDasharray="3 3" />
      <path d={caminho((u) => -env(u), 142, 34)} fill="none" className="stroke-foreground/45" strokeWidth={1} strokeDasharray="3 3" />
      <text x={W / 2} y={H - 3} textAnchor="middle" className="fill-foreground text-[11px] font-semibold tabular-nums">{batTxt}</text>
    </svg>
  );
}
