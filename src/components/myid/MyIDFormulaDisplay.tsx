import React from 'react';
import { cn } from '@/lib/utils';
import { Scale, Zap, ShieldCheck } from 'lucide-react';
import { getThermalColor } from '@/utils/myidCalculations';

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

function scoreColor(myid: number): string {
  return getThermalColor(myid);
}

function scoreStatus(myid: number): string {
  if (myid < 3) return 'RECUPERAÇÃO FAVORÁVEL';
  if (myid < 6) return 'SOBRECARGA MODERADA';
  if (myid < 8) return 'SOBRECARGA CRÍTICA';
  return 'RISCO DE CRONIFICAÇÃO';
}

const ScoreBar = ({ label, value, max = 10, type, isHighlighted }: { label: string; value: number; max?: number; type: 'demand' | 'capacity' | 'noise'; isHighlighted: boolean }) => {
  // Demand: High = Hot (Red)
  // Capacity: High = Cold (Violet)
  const color = type === 'demand' ? getThermalColor(value) : type === 'capacity' ? getThermalColor(10 - value) : getThermalColor(value);
  const percentage = (value / max) * 100;

  return (
    <div className={cn(
      "relative flex flex-col gap-1.5 transition-all duration-300 py-1.5 px-2 rounded-xl",
      isHighlighted ? "bg-muted shadow-sm scale-[1.02] ring-1 ring-border" : "opacity-90 hover:opacity-100"
    )}>
      <div className="flex justify-between items-center px-0.5">
        <span className="text-[10px] uppercase font-black tracking-widest" style={{ color }}>{label}</span>
        <span className="text-[10px] font-black" style={{ color }}>{value.toFixed(1)}</span>
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden shadow-inner">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
            boxShadow: isHighlighted ? `0 0 10px ${color}40` : 'none'
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
    <div className={cn("rounded-3xl border border-border bg-white overflow-hidden shadow-sm transition-all duration-500", className)}>
      {/* Visual Header - Minimalist & Premium */}
      <div className="p-8 pb-4 text-center relative">
        <div className="flex flex-col items-center">
          <div className="text-6xl font-black tracking-tighter" style={{ color: myidColor }}>
            {myidScore.toFixed(1)}
          </div>
          <div className="flex flex-col items-center mt-1">
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground opacity-60">MyID Index</span>
            <span className="text-xs font-black mt-2 px-3 py-1 rounded-full text-white uppercase tracking-wider" style={{ backgroundColor: myidColor }}>
              {status}
            </span>
          </div>
        </div>
      </div>

      <div className="p-8 pt-4 space-y-10">
        {/* The Balance Bar - Premium Style */}
        <div className="space-y-4">
          <div className="flex justify-between items-end px-1 mb-2">
            <div className="flex flex-col items-start gap-1">
              <span className="text-[10px] font-black uppercase text-red-500 tracking-[0.2em]">Demanda</span>
              <span className="text-3xl font-black text-foreground">{numerator.toFixed(1)}</span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] font-black uppercase text-emerald-500 tracking-[0.2em]">Capacidade</span>
              <span className="text-3xl font-black text-foreground">{denominator.toFixed(1)}</span>
            </div>
          </div>

          <div className="h-3 w-full flex rounded-full overflow-hidden bg-muted/40">
            <div
              className="h-full transition-all duration-1000 ease-in-out bg-red-500"
              style={{ width: `${demandPct}%` }}
            />
            <div
              className="h-full transition-all duration-1000 ease-in-out bg-emerald-500"
              style={{ width: `${capacityPct}%` }}
            />
          </div>

          <div className="flex justify-between text-[8px] font-black text-muted-foreground/50 uppercase tracking-[0.1em] px-1">
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
