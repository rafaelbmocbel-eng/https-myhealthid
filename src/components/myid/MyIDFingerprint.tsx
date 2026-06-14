import React, { useMemo, useState, useCallback, useEffect } from 'react';
import type { FingerprintRing } from '@/types/myid';
import { getThermalColor } from '@/utils/myidCalculations';
import { classificarMyID100 } from '@/utils/myid/lossTable';

interface Props {
  rings: FingerprintRing[];
  myidScore: number;
  className?: string;
  onRingClick?: (ring: FingerprintRing) => void;
  onRingHover?: (ringKey: string | null) => void;
  highlightedKey?: string | null;
  hasRedFlags?: boolean;
  compact?: boolean;
}

function scoreStatusLabel(score: number) { return classificarMyID100(score).nome; }
function scoreStatusColor(score: number) { return classificarMyID100(score).cor; }

const SHORT_LABELS: Record<string, string> = {
  D: 'D', EFI: 'EFI', P: 'P', I: 'I', R: 'R', C: 'C',
  AF: 'AF', HID: 'HID', NUT: 'NUT', ERG: 'ERG', N: 'N', MED: 'MED',
};

const FULL_LABELS: Record<string, string> = {
  D: 'Dor', EFI: 'Atividades', P: 'Emoções', I: 'Mudanças',
  R: 'Sono/Energia', C: 'Vida pessoal', AF: 'Movimento',
  HID: 'Hidratação', NUT: 'Alimentação', ERG: 'Postura',
  N: 'Sinais corpo', MED: 'Medicação',
};

const RING_DESCRIPTIONS: Record<string, { title: string; summary: string; components: string[] }> = {
  D:   { title: 'Dor (D)', summary: 'Intensidade e características da dor relatada.', components: ['Intensidade atual', 'Pior intensidade', 'Melhor dia', 'Tipo de dor', 'Regiões afetadas'] },
  EFI: { title: 'Atividades do dia (EFI)', summary: 'Impacto funcional nas tarefas diárias.', components: ['Trabalho', 'Tarefas domésticas', 'Exercício', 'Independência', 'Vida social'] },
  P:   { title: 'Cabeça e emoções (P)', summary: 'Crenças e respostas psicológicas frente à dor.', components: ['Medo de movimento', 'Catastrofização', 'Evitação', 'Autoeficácia', 'Expectativa de recuperação'] },
  I:   { title: 'Mudanças recentes (I)', summary: 'Gatilhos e mudanças que antecederam o quadro.', components: ['Novos equipamentos', 'Aumento de carga', 'Mudança de postura', 'Sustos físicos', 'Data de início'] },
  R:   { title: 'Sono e energia (R)', summary: 'Regulação neurovegetativa: descanso e recuperação.', components: ['Qualidade do sono', 'Horas de sono', 'Despertar por dor', 'Fadiga', 'Estresse e ansiedade'] },
  C:   { title: 'Vida pessoal (C)', summary: 'Contexto social, familiar e financeiro.', components: ['Trabalho estressante', 'Conflitos familiares', 'Preocupação financeira'] },
  AF:  { title: 'Movimento (AF)', summary: 'Nível de atividade física no dia a dia.', components: ['Horas sentado', 'Estilo de vida', 'Tipos de exercício', 'Intensidade'] },
  HID: { title: 'Hidratação (HID)', summary: 'Estado de hidratação corporal.', components: ['Litros de água/dia', 'Cor da urina', 'Frequência miccional', 'Sintomas de desidratação'] },
  NUT: { title: 'Alimentação (NUT)', summary: 'Qualidade nutricional e padrão alimentar.', components: ['Qualidade da dieta', 'Frutas e vegetais', 'Proteína', 'Alimentos inflamatórios'] },
  ERG: { title: 'Postura no dia (ERG)', summary: 'Ergonomia e hábitos posturais.', components: ['Workspace', 'Tempo sentado contínuo', 'Posição de dormir', 'Hábitos posturais ruins'] },
  N:   { title: 'Sinais do corpo (N)', summary: 'Ruído sistêmico: sinais viscerais e autonômicos.', components: ['Trauma axial', 'Cicatrizes abdominais', 'Sintomas viscerais', 'Saúde hormonal'] },
  MED: { title: 'Medicação (MED)', summary: 'Uso de medicações relevantes para o quadro.', components: ['AINE diário', 'Antidepressivo', 'Relaxante muscular', 'Corticoide'] },
};

// ── Geometry ─────────────────────────────────────────────────────────────────
const VW = 1000;
const VH = 1000;
const CX = 500;
const CY = 490;

const BASE_R = 68;
const MAX_R  = 448;
const STROKE = 22;

// Each ring's arc is nearly a complete circle.
// The tiny gap (12°) is rotated 30° per ring, spreading the 12 openings evenly
// around the full 360° — no two adjacent rings open at the same angle.
// Result: no "vinco" (notch) is visible from any direction.
const GAP_DEG      = 12;              // tiny gap per ring
const AVAIL_SWEEP  = 360 - GAP_DEG;  // 348° — nearly full circle

export default function MyIDFingerprint({
  rings, myidScore, className = '', onRingClick, onRingHover,
  highlightedKey, hasRedFlags = false, compact = false,
}: Props) {
  const [hoveredIdx, setHoveredIdx]         = useState<number | null>(null);
  const [selectedIdx, setSelectedIdx]       = useState<number | null>(null);
  const [revealed, setRevealed]             = useState(false);
  const [revealProgress, setRevealProgress] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 120);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!revealed) return;
    let frame = 0;
    const total = rings.length;
    const iv = setInterval(() => {
      frame++;
      setRevealProgress(frame);
      if (frame >= total) clearInterval(iv);
    }, 70);
    return () => clearInterval(iv);
  }, [revealed, rings.length]);

  const innerRings = rings.filter(r => r.type === 'inner');
  const outerRings = rings.filter(r => r.type === 'outer');
  const allRings   = [...innerRings, ...outerRings];
  const totalRings = allRings.length || 1;

  const spacing = Math.min(32, (MAX_R - BASE_R) / totalRings);

  // ── Arc path — all rings share the same center (CX, CY) ───────────────────
  const arcPath = useCallback((r: number, startDeg: number, sweepDeg: number): string => {
    if (sweepDeg < 0.5) return '';
    const toRad = (d: number) => (d * Math.PI) / 180;
    const s  = toRad(startDeg);
    const e  = toRad(startDeg + sweepDeg);
    const x1 = CX + r * Math.cos(s);
    const y1 = CY + r * Math.sin(s);
    const x2 = CX + r * Math.cos(e);
    const y2 = CY + r * Math.sin(e);
    const large = sweepDeg > 180 ? 1 : 0;
    return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }, []);

  // ── Ridge data ───────────────────────────────────────────────────────────────
  const ridgeData = useMemo(() => {
    // Spread the 12 gaps evenly: ring i has its opening at (i * 30°) around the circle.
    // This means no ring starts or ends at the same angle as its neighbor.
    const gapStep = 360 / totalRings;

    return allRings.map((ring, i) => {
      const r = BASE_R + i * spacing;

      // Gap center for this ring — rotated 30° from the previous ring
      const gapCenter = (i * gapStep + 270) % 360; // start offset at top-ish for ring 0
      const startDeg  = (gapCenter + GAP_DEG / 2 + 360) % 360;

      // Value → arc fill (min 8% so even zero-score rings show a tiny arc)
      const fillFraction = Math.max(ring.value / 10, 0.08);
      const filledSweep  = AVAIL_SWEEP * fillFraction;

      const color = ring.color || getThermalColor(ring.value);
      // Severity drives brightness:
      // capacity: low value = alarming (brighter)
      // demand:   high value = alarming (brighter)
      const opacity = ring.type === 'inner'
        ? 0.42 + (1 - ring.value / 10) * 0.53
        : 0.42 + (ring.value / 10) * 0.53;

      return { ...ring, r, startDeg, gapCenter, filledSweep, color, opacity, index: i };
    });
  }, [allRings, spacing, totalRings]);

  const centerColor = scoreStatusColor(myidScore);
  const label       = scoreStatusLabel(myidScore);

  const handleClick = (ridge: typeof ridgeData[0], idx: number) => {
    setSelectedIdx(selectedIdx === idx ? null : idx);
    if (onRingClick) onRingClick(ridge);
  };

  const highlightedIdx = highlightedKey
    ? ridgeData.findIndex(r => r.scoreKey === highlightedKey) : -1;

  const activeIdx = highlightedIdx >= 0 ? highlightedIdx
    : selectedIdx !== null ? selectedIdx
    : hoveredIdx;

  return (
    <div
      className={`relative w-full ${className}`}
      role="img"
      aria-label={`Impressão digital MyID — score ${Math.round(myidScore)}/100 — ${label}`}
    >
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        className="w-full mx-auto"
        style={{ filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.09))' }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="fp-glow-hi" x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="fp-glow-med" x="-12%" y="-12%" width="124%" height="124%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="fp-core-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="20" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="fp-pulse-glow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <radialGradient id="fp-center-g" cx="50%" cy="50%">
            <stop offset="0%"   stopColor={centerColor} stopOpacity="0.28" />
            <stop offset="100%" stopColor={centerColor} stopOpacity="0"    />
          </radialGradient>
          <linearGradient id="fp-legend-g" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="hsl(270,60%,72%)" />
            <stop offset="25%"  stopColor="hsl(230,70%,60%)" />
            <stop offset="50%"  stopColor="hsl(35,85%,55%)"  />
            <stop offset="75%"  stopColor="hsl(15,90%,50%)"  />
            <stop offset="100%" stopColor="hsl(0,85%,50%)"   />
          </linearGradient>
        </defs>

        {/* Ambient glow */}
        <circle cx={CX} cy={CY} r={MAX_R + 40} fill="url(#fp-center-g)" opacity="0.30" />

        {/* ── Rings ── */}
        {ridgeData.map((ridge, ridgeIdx) => {
          const isActive   = activeIdx === ridgeIdx;
          const isRevealed = revealProgress > ridgeIdx;
          const sw         = isActive ? STROKE + 8 : STROKE;

          // Background: full 360° circle (no gap) — very faint reference track
          const fillPath = arcPath(ridge.r, ridge.startDeg, Math.min(ridge.filledSweep, AVAIL_SWEEP));

          // Short label at the midpoint of the filled arc
          const labelAngleDeg = ridge.startDeg + ridge.filledSweep / 2;
          const labelAngleRad = (labelAngleDeg * Math.PI) / 180;
          const lx = CX + ridge.r * Math.cos(labelAngleRad);
          const ly = CY + ridge.r * Math.sin(labelAngleRad);
          // Flip text in the upper-left / upper-right quadrants to avoid upside-down rendering
          const rawRot = labelAngleDeg + 90;
          const rot    = (labelAngleDeg % 360 > 90 && labelAngleDeg % 360 < 270)
            ? rawRot + 180 : rawRot;

          const sigla      = SHORT_LABELS[ridge.scoreKey] || ridge.scoreKey;
          const fullName   = FULL_LABELS[ridge.scoreKey] || ridge.label;
          const arcLen     = (Math.min(ridge.filledSweep, AVAIL_SWEEP) * Math.PI * ridge.r) / 180;
          // How much text we can show inside the arc stroke (22px wide)
          const showSig      = arcLen > 42;
          const showFullName = arcLen > fullName.length * 7.5 + 30;

          return (
            <g
              key={ridge.scoreKey}
              role="button"
              aria-label={`${ridge.label}: ${ridge.value.toFixed(1)} de 10`}
              onMouseEnter={() => { setHoveredIdx(ridgeIdx); onRingHover?.(ridge.scoreKey); }}
              onMouseLeave={() => { setHoveredIdx(null); onRingHover?.(null); }}
              onClick={() => handleClick(ridge, ridgeIdx)}
              style={{
                cursor: 'pointer',
                opacity: isRevealed ? 1 : 0,
                transition: `opacity 0.55s ease ${ridgeIdx * 65}ms`,
              }}
            >
              {/* Full-circle background track (360°, no gap) */}
              <circle
                cx={CX} cy={CY} r={ridge.r}
                fill="none"
                stroke={ridge.color}
                strokeWidth={STROKE}
                opacity={0.08}
              />

              {/* Value arc — starts at this ring's unique angle */}
              {fillPath && (
                <path
                  d={fillPath}
                  fill="none"
                  stroke={ridge.color}
                  strokeWidth={sw}
                  strokeLinecap="round"
                  opacity={isActive ? 1 : ridge.opacity}
                  filter={
                    isActive           ? 'url(#fp-glow-hi)'  :
                    ridge.value >= 7   ? 'url(#fp-glow-hi)'  :
                    ridge.value >= 4.5 ? 'url(#fp-glow-med)' : undefined
                  }
                  style={{ transition: 'stroke-width 0.2s ease, opacity 0.2s ease' }}
                />
              )}

              {/* Sigla (always) + nome completo (quando tem espaço) — ambos no mesmo ponto */}
              {showSig && isRevealed && fillPath && (
                <g transform={`rotate(${rot}, ${lx}, ${ly})`} style={{ pointerEvents: 'none' }}>
                  {/* Sigla line */}
                  <text
                    x={lx}
                    y={showFullName ? ly - 6 : ly}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={showFullName ? 11 : 13}
                    fontWeight="900"
                    fill="white"
                    stroke={ridge.color}
                    strokeWidth="1.2"
                    paintOrder="stroke"
                    letterSpacing="0.5"
                    opacity={isActive ? 1 : 0.92}
                  >
                    {sigla}
                  </text>
                  {/* Full name line — only when arc is wide enough */}
                  {showFullName && (
                    <text
                      x={lx}
                      y={ly + 8}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={8.5}
                      fontWeight="700"
                      fill="white"
                      stroke={ridge.color}
                      strokeWidth="0.9"
                      paintOrder="stroke"
                      opacity={isActive ? 0.95 : 0.80}
                    >
                      {fullName}
                    </text>
                  )}
                </g>
              )}
            </g>
          );
        })}

        {/* Outer labels removed — sigla + nome ficam juntos dentro de cada arco */}

        {/* ── Center core ── */}
        <circle cx={CX} cy={CY} r={BASE_R - 12} fill="url(#fp-center-g)" filter="url(#fp-core-glow)" />

        {/* Progress ring */}
        <circle cx={CX} cy={CY} r={50} fill="none" stroke={centerColor} strokeWidth={5} opacity="0.12"
          transform={`rotate(-90, ${CX}, ${CY})`}
        />
        <circle cx={CX} cy={CY} r={50} fill="none" stroke={centerColor} strokeWidth={6}
          strokeLinecap="round" opacity="0.72"
          strokeDasharray={`${2 * Math.PI * 50}`}
          strokeDashoffset={`${2 * Math.PI * 50 * (1 - Math.min(myidScore, 100) / 100)}`}
          transform={`rotate(-90, ${CX}, ${CY})`}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1)' }}
        />

        {/* Score text */}
        <text x={CX} y={CY - 14} textAnchor="middle" dominantBaseline="central"
          fontSize="50" fontWeight="900" fill={centerColor}
          style={{ transition: 'fill 0.3s ease' }}>
          {Math.round(myidScore)}
        </text>
        <text x={CX} y={CY + 20} textAnchor="middle"
          fontSize="14" fontWeight="600" fill={centerColor} opacity="0.55">
          /100
        </text>
        <text x={CX} y={CY + 42} textAnchor="middle"
          fontSize="13" fontWeight="800" fill={centerColor} opacity="0.88"
          letterSpacing="2.5">
          {label.toUpperCase()}
        </text>

        {/* Dashed separator between capacity (inner) and demand (outer) rings */}
        {innerRings.length > 0 && outerRings.length > 0 && (
          <circle
            cx={CX} cy={CY}
            r={BASE_R + innerRings.length * spacing}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth={1.5}
            opacity={0.28}
            strokeDasharray="6 5"
          />
        )}

        {/* Red flags pulse */}
        {hasRedFlags && (
          <g style={{ animation: 'fpPulse 1.8s ease-in-out infinite' }}>
            <circle cx={CX} cy={CY} r={MAX_R + 18} fill="none"
              stroke="hsl(0,72%,51%)" strokeWidth={2} strokeDasharray="6 9" opacity={0.55}
            />
            <circle cx={CX} cy={CY} r={MAX_R + 24} fill="none"
              stroke="hsl(0,72%,51%)" strokeWidth={7} opacity={0.10}
              filter="url(#fp-pulse-glow)"
            />
            <text x={CX} y={CY - MAX_R - 42} textAnchor="middle"
              fill="hsl(0,72%,51%)" fontSize="14" fontWeight="900" letterSpacing="2.5">
              ⚠ SINAIS DE ALERTA DETECTADOS
            </text>
          </g>
        )}

        {/* Legend */}
        {(() => {
          const lx0 = 90, ly0 = VH - 52, barW = 820, barH = 14;
          return (
            <g>
              <text x={lx0} y={ly0 - 10} fontSize="13" fontWeight="700"
                fill="hsl(var(--muted-foreground))" letterSpacing="1.8" opacity={0.55}>
                ESCALA DE COMPROMETIMENTO
              </text>
              <rect x={lx0} y={ly0} width={barW} height={barH} rx={barH / 2}
                fill="url(#fp-legend-g)" opacity={0.85}
              />
              <text x={lx0}          y={ly0 + barH + 18} textAnchor="middle"
                fontSize="13" fontWeight="700" fill="hsl(270,60%,65%)" opacity={0.80}>
                Ótimo
              </text>
              <text x={lx0 + barW}   y={ly0 + barH + 18} textAnchor="middle"
                fontSize="13" fontWeight="700" fill="hsl(0,75%,55%)" opacity={0.80}>
                Crítico
              </text>
            </g>
          );
        })()}

        <style>{`
          @keyframes fpPulse {
            0%, 100% { opacity: 0.25; }
            50%       { opacity: 0.85; }
          }
        `}</style>
      </svg>

      {/* Detail panel */}
      {!compact && (() => {
        const ridge = activeIdx !== null && activeIdx >= 0 && activeIdx < ridgeData.length
          ? ridgeData[activeIdx] : null;
        const info  = ridge ? RING_DESCRIPTIONS[ridge.scoreKey] : null;

        return (
          <div className="mt-3 rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm p-4 shadow-xs min-h-[130px] transition-all duration-200">
            {ridge && info ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: ridge.color }} />
                  <h4 className="text-sm font-bold tracking-wide" style={{ color: ridge.color }}>
                    {info.title}
                  </h4>
                  <span className="ml-auto text-xs font-bold tabular-nums" style={{ color: ridge.color }}>
                    {ridge.value.toFixed(1)}<span className="text-muted-foreground font-normal">/10</span>
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{info.summary}</p>
                <div className="flex flex-wrap gap-1.5">
                  {info.components.map((c) => (
                    <span key={c}
                      className="text-[11px] px-2 py-0.5 rounded-md bg-muted/60 text-foreground/75 border border-border/30">
                      {c}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              /* Legenda sempre visível — mapeia sigla ↔ dimensão */
              <div>
                <p className="text-[11px] text-muted-foreground mb-2 font-semibold tracking-wide uppercase">
                  Legenda das dimensões
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {ridgeData.map((r) => (
                    <button
                      key={r.scoreKey}
                      className="flex items-center gap-1.5 text-left hover:opacity-80 transition-opacity"
                      onClick={() => handleClick(r, r.index)}
                    >
                      <span className="shrink-0 w-2 h-2 rounded-full" style={{ background: r.color }} />
                      <span className="text-[11px] font-black tabular-nums" style={{ color: r.color }}>
                        {r.scoreKey}
                      </span>
                      <span className="text-[11px] text-foreground/70 truncate">
                        {FULL_LABELS[r.scoreKey] || r.label}
                      </span>
                      <span className="ml-auto text-[10px] text-muted-foreground tabular-nums shrink-0">
                        {r.value.toFixed(1)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
