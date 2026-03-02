import React from 'react';

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
  className?: string;
}

function valueColor(val: number, inverted = false): string {
  const v = inverted ? 10 - val : val;
  if (v <= 2) return 'text-violet-500';
  if (v <= 4) return 'text-blue-500';
  if (v <= 6) return 'text-amber-500';
  if (v <= 8) return 'text-orange-500';
  return 'text-red-500';
}

/**
 * Displays the MyID formula with actual score values inline.
 * Each symbol is colored by its severity.
 */
export default function MyIDFormulaDisplay({ scores, myidScore, className = '' }: Props) {
  const { D, EFI, P, I, R, C, AF, HID, NUT, ERG, N, MED = 0 } = scores;

  const numerator = ((D + EFI) * (1 + P / 10)) + I;
  const denominator = Math.max(0.5, (R + C + AF + HID + NUT + ERG) - N - MED);

  const ScoreChip = ({ label, value, inverted = false }: { label: string; value: number; inverted?: boolean }) => (
    <span className={`inline-flex items-center gap-0.5 font-mono text-sm ${valueColor(value, inverted)}`}>
      <span className="font-bold">{label}</span>
      <span className="text-[10px] bg-muted/80 px-1 py-0.5 rounded font-black">{value.toFixed(1)}</span>
    </span>
  );

  return (
    <div className={`rounded-xl border bg-card p-4 space-y-3 ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Equação MyID</span>
        <span className="ml-auto text-lg font-black" style={{ color: myidScore <= 2 ? 'hsl(270,60%,65%)' : myidScore <= 4 ? 'hsl(210,75%,55%)' : myidScore <= 6 ? 'hsl(35,85%,55%)' : myidScore <= 8 ? 'hsl(15,90%,50%)' : 'hsl(0,85%,50%)' }}>
          {myidScore.toFixed(2)}
        </span>
      </div>

      {/* Fraction layout */}
      <div className="flex flex-col items-center gap-0">
        {/* Numerator */}
        <div className="flex items-center gap-1 flex-wrap justify-center text-sm pb-1.5">
          <span className="text-muted-foreground">[</span>
          <span className="text-muted-foreground">(</span>
          <ScoreChip label="D" value={D} />
          <span className="text-muted-foreground">+</span>
          <ScoreChip label="EFI" value={EFI} />
          <span className="text-muted-foreground">)</span>
          <span className="text-muted-foreground">×</span>
          <span className="text-muted-foreground">(1 +</span>
          <ScoreChip label="P" value={P} />
          <span className="text-muted-foreground">/10)</span>
          <span className="text-muted-foreground">+</span>
          <ScoreChip label="I" value={I} />
          <span className="text-muted-foreground">]</span>
          <span className="text-[10px] text-muted-foreground ml-1">= {numerator.toFixed(2)}</span>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-border my-0.5" />

        {/* Denominator */}
        <div className="flex items-center gap-1 flex-wrap justify-center text-sm pt-1.5">
          <span className="text-muted-foreground">[</span>
          <span className="text-muted-foreground">(</span>
          <ScoreChip label="R" value={R} inverted />
          <span className="text-muted-foreground">+</span>
          <ScoreChip label="C" value={C} inverted />
          <span className="text-muted-foreground">+</span>
          <ScoreChip label="AF" value={AF} inverted />
          <span className="text-muted-foreground">+</span>
          <ScoreChip label="HID" value={HID} inverted />
          <span className="text-muted-foreground">+</span>
          <ScoreChip label="NUT" value={NUT} inverted />
          <span className="text-muted-foreground">+</span>
          <ScoreChip label="ERG" value={ERG} inverted />
          <span className="text-muted-foreground">)</span>
          <span className="text-muted-foreground">−</span>
          <ScoreChip label="N" value={N} />
          {MED > 0 && (
            <>
              <span className="text-muted-foreground">−</span>
              <ScoreChip label="MED" value={MED} />
            </>
          )}
          <span className="text-muted-foreground">]</span>
          <span className="text-[10px] text-muted-foreground ml-1">= {denominator.toFixed(2)}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 pt-2 border-t border-border/50">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-violet-500" />
          <span className="text-[9px] text-muted-foreground">Bom (0-2)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-blue-500" />
          <span className="text-[9px] text-muted-foreground">Aceitável (2-4)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-amber-500" />
          <span className="text-[9px] text-muted-foreground">Atenção (4-6)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-red-500" />
          <span className="text-[9px] text-muted-foreground">Crítico (8-10)</span>
        </div>
      </div>
    </div>
  );
}
