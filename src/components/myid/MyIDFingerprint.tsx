import React, { useMemo, useState, useEffect } from 'react';
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
const STROKE = 20;

// Todos os arcos começam no topo (12h) e crescem no sentido horário,
// desenhados com <circle> + strokeDasharray — geometria perfeita,
// sem aproximação por path.

export default function MyIDFingerprint({
  rings, myidScore, className = '', onRingClick, onRingHover,
  highlightedKey, hasRedFlags = false, compact = false,
}: Props) {
  const [hoveredIdx, setHoveredIdx]         = useState<number | null>(null);
  const [legendaAberta, setLegendaAberta]   = useState(false);
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

  const innerRings = useMemo(() => rings.filter(r => r.type === 'inner'), [rings]);
  const outerRings = useMemo(() => rings.filter(r => r.type === 'outer'), [rings]);
  const allRings   = useMemo(() => [...innerRings, ...outerRings], [innerRings, outerRings]);
  const totalRings = allRings.length || 1;

  const spacing = Math.min(32, (MAX_R - BASE_R) / totalRings);

  // ── Ridge data ───────────────────────────────────────────────────────────────
  const ridgeData = useMemo(() => {
    return allRings.map((ring, i) => {
      const r = BASE_R + i * spacing;

      // Value → fração do círculo (min 4% para score zero ainda mostrar um traço)
      const fillFraction = Math.max(ring.value / 10, 0.04);
      const circumference = 2 * Math.PI * r;
      const dashLen = circumference * Math.min(fillFraction, 1);

      const color = ring.color || getThermalColor(ring.value);
      // Severity drives brightness (0-10, maior = mais alarmante):
      // capacity (inner): low value = alarming
      // demand (outer): high value = alarming
      // EFI é "outer" mas é bem-estar (menor = pior), por isso vem com severity explícito.
      const severity = ring.severity ?? (ring.type === 'inner' ? 10 - ring.value : ring.value);
      const opacity = 0.55 + (severity / 10) * 0.45;

      return { ...ring, r, fillFraction, circumference, dashLen, color, opacity, severity, index: i };
    });
  }, [allRings, spacing]);

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
      <div>
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          className="w-full mx-auto"
          preserveAspectRatio="xMidYMid meet"
        >
        <defs>
          <filter id="fp-active-glow" x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <radialGradient id="fp-center-g" cx="50%" cy="50%">
            <stop offset="0%"   stopColor={centerColor} stopOpacity="0.22" />
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
        <circle cx={CX} cy={CY} r={MAX_R + 40} fill="url(#fp-center-g)" opacity="0.25" />

        {/* ── Rings — círculos perfeitos via strokeDasharray, todos iniciando no topo ── */}
        {ridgeData.map((ridge, ridgeIdx) => {
          const isActive   = activeIdx === ridgeIdx;
          const isRevealed = revealProgress > ridgeIdx;
          const sw         = isActive ? STROKE + 6 : STROKE;

          // Sigla no ponto médio do arco preenchido (ângulo a partir do topo, sentido horário)
          const midDeg = -90 + ridge.fillFraction * 360 / 2;
          const midRad = (midDeg * Math.PI) / 180;
          const lx = CX + ridge.r * Math.cos(midRad);
          const ly = CY + ridge.r * Math.sin(midRad);
          const norm = ((midDeg % 360) + 360) % 360;
          const rawRot = midDeg + 90;
          const rot = (norm > 0 && norm < 180) ? rawRot + 180 : rawRot;

          const sigla   = SHORT_LABELS[ridge.scoreKey] || ridge.scoreKey;
          const showSig = ridge.dashLen > 46;

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
              {/* Trilha de fundo — círculo completo, bem sutil */}
              <circle
                cx={CX} cy={CY} r={ridge.r}
                fill="none"
                stroke={ridge.color}
                strokeWidth={STROKE}
                opacity={0.09}
              />

              {/* Arco de valor — círculo nativo com dasharray, início no topo */}
              <circle
                cx={CX} cy={CY} r={ridge.r}
                fill="none"
                stroke={ridge.color}
                strokeWidth={sw}
                strokeLinecap="round"
                strokeDasharray={`${ridge.dashLen.toFixed(2)} ${(ridge.circumference - ridge.dashLen).toFixed(2)}`}
                transform={`rotate(-90, ${CX}, ${CY})`}
                opacity={isActive ? 1 : ridge.opacity}
                filter={isActive ? 'url(#fp-active-glow)' : undefined}
                style={{ transition: 'stroke-width 0.2s ease, opacity 0.2s ease' }}
              />

              {/* Sigla centralizada no arco — nome completo na legenda abaixo */}
              {showSig && isRevealed && (
                <text
                  x={lx} y={ly}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={13}
                  fontWeight="900"
                  fill="white"
                  stroke={ridge.color}
                  strokeWidth="1.2"
                  paintOrder="stroke"
                  letterSpacing="0.5"
                  opacity={isActive ? 1 : 0.92}
                  transform={`rotate(${rot}, ${lx}, ${ly})`}
                  style={{ pointerEvents: 'none' }}
                >
                  {sigla}
                </text>
              )}
            </g>
          );
        })}

        {/* Outer labels removed — sigla + nome ficam juntos dentro de cada arco */}

        {/* ── Center core ── */}
        <circle cx={CX} cy={CY} r={BASE_R - 12} fill="url(#fp-center-g)" />

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
      </div>

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
              /* Legenda RECOLHIDA por padrão — 12 linhas sempre abertas pesavam
                 o card; um toque expande (e tocar num anel continua abrindo o
                 detalhe da dimensão direto) */
              <div>
                <button
                  onClick={() => setLegendaAberta(v => !v)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <span className="text-[11px] text-muted-foreground font-semibold tracking-wide uppercase">
                    Legenda das dimensões
                  </span>
                  <span className="text-[11px] text-primary font-medium">
                    {legendaAberta ? 'recolher' : 'toque para ver'}
                  </span>
                </button>
                {legendaAberta && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
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
                )}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
