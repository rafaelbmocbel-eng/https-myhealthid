import React from 'react';
import { cn } from '@/lib/utils';
import { Scale, Zap, ShieldCheck } from 'lucide-react';

interface ScoreValues {
  D: number;
  EFI: number;
  P: number;
  I: number;
  R: number;
  C: number;
  AF: number;
  HID: number;
  NUT: number;
  ERG: number;
  N: number;
  MED?: number;
}

interface Props {
  scores: ScoreValues;
  myidScore: number;
  highlightedKey?: string | null;
  className?: string;
}

function severityColor(val: number): string {
  if (val <= 2) return 'hsl(142, 70%, 45%)';   // green
  if (val <= 4) return 'hsl(48, 90%, 50%)';     // yellow
  if (val <= 6) return 'hsl(25, 90%, 50%)';     // orange
  if (val <= 8) return 'hsl(0, 80%, 50%)';      // red
  return 'hsl(0, 85%, 40%)';                     // dark red
}

function capacityColor(val: number): string {
  // Inverted: high = good (green), low = bad (red)
  if (val >= 8) return 'hsl(142, 70%, 45%)';
  if (val >= 6) return 'hsl(142, 50%, 55%)';
  if (val >= 4) return 'hsl(48, 90%, 50%)';
  if (val >= 2) return 'hsl(25, 90%, 50%)';
  return 'hsl(0, 80%, 50%)';
}

function scoreColor(myid: number): string {
  if (myid < 3) return 'hsl(142, 70%, 45%)';
  if (myid < 6) return 'hsl(48, 90%, 50%)';
  if (myid < 8) return 'hsl(25, 90%, 50%)';
  return 'hsl(0, 85%, 45%)';
}

function scoreStatus(myid: number): string {
  if (myid < 3) return 'RECUPERAÇÃO FAVORÁVEL';
  if (myid < 6) return 'SOBRECARGA MODERADA';
  if (myid < 8) return 'SOBRECARGA CRÍTICA';
  return 'RISCO DE CRONIFICAÇÃO';
}

const ScoreBar = ({ label, value, max = 10, type, isHighlighted }: { label: string; value: number; max?: number; type: 'demand' | 'capacity' | 'noise'; isHighlighted: boolean }) => {
  const color = type === 'demand' ? severityColor(value) : type === 'capacity' ? capacityColor(value) : severityColor(value);
  const percentage = (value / max) * 100;

  return (
    <div className={cn(
      "relative flex flex-col gap-1 transition-all duration-300 py-1 px-2 rounded-lg",
      isHighlighted ? "bg-muted shadow-sm scale-[1.02] ring-1 ring-border" : "opacity-80 hover:opacity-100"
    )}>
      <div className="flex justify-between items-center px-0.5">
        <span className="text-[10px] uppercase font-black tracking-wider" style={{ color }}>{label}</span>
        <span className="text-[10px] font-black" style={{ color }}>{value.toFixed(1)}</span>
      </div>
      <div className="h-1.5 w-full bg-muted-foreground/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
            boxShadow: isHighlighted ? `0 0 8px ${color}60` : 'none'
          }}
        />
      </div>
    </div>
  );
};

export default function MyIDFormulaDisplay({ scores, myidScore, highlightedKey, className = '' }: Props) {
  const { D, EFI, P, I, R, C, AF, HID, NUT, ERG, N, MED = 0 } = scores;

  const numerator = ((D + EFI) * (1 + P / 10)) + I;
  const denominator = Math.max(0.5, (R + C + AF + HID + NUT + ERG) - N - MED);
  const myidColor = scoreColor(myidScore);
  const status = scoreStatus(myidScore);

  // Calculate percentages for demand and capacity for a relative balance bar
  const totalSum = numerator + denominator;
  const demandPct = (numerator / totalSum) * 100;
  const capacityPct = (denominator / totalSum) * 100;

  return (
    <div className={cn("rounded-3xl border-2 bg-card overflow-hidden shadow-xl transition-all duration-500", className)} style={{ borderColor: `${myidColor}30` }}>
      {/* Visual Header */}
      <div className="bg-gradient-to-r from-muted/50 via-card to-muted/50 p-6 text-center border-b border-border/50 relative">
        <Scale className="absolute right-6 top-6 w-8 h-8 text-muted-foreground/10" />
        <div className="inline-flex flex-col items-center">
          <div className="flex items-center gap-3">
            <div className="text-6xl font-black tracking-tighter" style={{ color: myidColor }}>
              {myidScore.toFixed(1)}
            </div>
            <div className="flex flex-col items-start leading-none">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">MyID Index</span>
              <span className="text-sm font-bold mt-1" style={{ color: myidColor }}>{status}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* The Balance Bar */}
        <div className="space-y-4">
          <div className="flex justify-between items-end px-1">
            <div className="flex flex-col items-start gap-1">
              <span className="text-[10px] font-black uppercase text-red-500 tracking-widest">Demanda</span>
              <span className="text-2xl font-black text-foreground">{numerator.toFixed(1)}</span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">Capacidade</span>
              <span className="text-2xl font-black text-foreground">{denominator.toFixed(1)}</span>
            </div>
          </div>

          <div className="h-4 w-full flex rounded-full overflow-hidden shadow-inner bg-muted/30 p-1">
            <div
              className="h-full rounded-l-full transition-all duration-1000 ease-in-out bg-gradient-to-r from-red-600 to-red-400"
              style={{ width: `${demandPct}%` }}
            />
            <div
              className="h-full rounded-r-full transition-all duration-1000 ease-in-out bg-gradient-to-r from-emerald-400 to-emerald-600"
              style={{ width: `${capacityPct}%` }}
            />
          </div>

          <div className="flex justify-between text-[8px] font-bold text-muted-foreground uppercase tracking-tighter px-1">
            <span>↑ Carga / Desgaste</span>
            <span>Resiliência / Recuperação ↑</span>
          </div>
        </div>

        {/* Breakdown Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
          {/* Demand Column */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-red-100 dark:border-red-900/30">
              <Zap className="w-4 h-4 text-red-500" />
              <h4 className="text-xs font-black uppercase tracking-widest text-red-600">Fatores de Estresse</h4>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <ScoreBar label="D (Sintoma)" value={D} type="demand" isHighlighted={highlightedKey === 'D'} />
              <ScoreBar label="EFI (Disfunção)" value={EFI} type="demand" isHighlighted={highlightedKey === 'EFI'} />
              <ScoreBar label="P (Severidade)" value={P} type="demand" isHighlighted={highlightedKey === 'P'} />
              <ScoreBar label="I (Incapacidade)" value={I} type="demand" isHighlighted={highlightedKey === 'I'} />
            </div>
          </div>

          {/* Capacity Column */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-emerald-100 dark:border-emerald-900/30">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <h4 className="text-xs font-black uppercase tracking-widest text-emerald-600">Fatores de Reserva</h4>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <div className="grid grid-cols-2 gap-2">
                <ScoreBar label="R (Respirar)" value={R} type="capacity" isHighlighted={highlightedKey === 'R'} />
                <ScoreBar label="C (Circular)" value={C} type="capacity" isHighlighted={highlightedKey === 'C'} />
                <ScoreBar label="AF (Atividade)" value={AF} type="capacity" isHighlighted={highlightedKey === 'AF'} />
                <ScoreBar label="HID (Hidratar)" value={HID} type="capacity" isHighlighted={highlightedKey === 'HID'} />
                <ScoreBar label="NUT (Nutrir)" value={NUT} type="capacity" isHighlighted={highlightedKey === 'NUT'} />
                <ScoreBar label="ERG (Energia)" value={ERG} type="capacity" isHighlighted={highlightedKey === 'ERG'} />
              </div>
              <div className="pt-2 mt-2 border-t border-muted border-dashed grid grid-cols-2 gap-2 opacity-60">
                <ScoreBar label="N (Ruído)" value={N} type="noise" isHighlighted={highlightedKey === 'N'} />
                <ScoreBar label="MED (Medic.)" value={MED} type="noise" isHighlighted={highlightedKey === 'MED'} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Concept */}
        <div className="pt-6 border-t border-border/50 text-center">
          <p className="text-[10px] text-muted-foreground leading-relaxed max-w-sm mx-auto">
            O <strong>Índice MyID</strong> representa a relação entre a demanda do sistema e sua capacidade de resposta.
            Uma pontuação alta indica que os fatores de reserva estão sobrecarregados.
          </p>
        </div>
      </div>
    </div>
  );
}
