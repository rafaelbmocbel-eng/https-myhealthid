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

const ScoreChip = ({ label, value, type }: { label: string; value: number; type: 'demand' | 'capacity' | 'noise' }) => {
  const color = type === 'demand' ? severityColor(value) : type === 'capacity' ? capacityColor(value) : severityColor(value);
  return (
    <span className="inline-flex items-center gap-1 font-mono">
      <span className="font-black text-sm" style={{ color }}>{label}</span>
      <span
        className="text-[11px] px-1.5 py-0.5 rounded-md font-black text-white min-w-[32px] text-center"
        style={{ backgroundColor: color }}
      >
        {value.toFixed(1)}
      </span>
    </span>
  );
};

export default function MyIDFormulaDisplay({ scores, myidScore, className = '' }: Props) {
  const { D, EFI, P, I, R, C, AF, HID, NUT, ERG, N, MED = 0 } = scores;

  const numerator = ((D + EFI) * (1 + P / 10)) + I;
  const denominator = Math.max(0.5, (R + C + AF + HID + NUT + ERG) - N - MED);
  const myidColor = scoreColor(myidScore);
  const status = scoreStatus(myidScore);

  return (
    <div className={`rounded-2xl border-2 bg-card overflow-hidden shadow-lg ${className}`} style={{ borderColor: `${myidColor}40` }}>
      {/* Header */}
      <div className="px-5 py-3 border-b bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: myidColor }} />
          <span className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">A Equação do MyID</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black" style={{ color: myidColor }}>{myidScore.toFixed(1)}</span>
          <span className="text-xs font-bold text-muted-foreground">/10</span>
        </div>
      </div>

      {/* Main formula */}
      <div className="px-5 py-5 space-y-4">
        {/* Visual formula representation */}
        <div className="text-center space-y-1">
          <div className="text-xs font-bold text-muted-foreground tracking-wider mb-3">MyID =</div>

          {/* Fraction */}
          <div className="inline-flex flex-col items-center">
            {/* Numerator */}
            <div className="flex items-center gap-1.5 flex-wrap justify-center px-4 pb-2">
              <span className="text-muted-foreground font-bold text-sm">[</span>
              <span className="text-muted-foreground text-sm">(</span>
              <ScoreChip label="D" value={D} type="demand" />
              <span className="text-muted-foreground text-sm">+</span>
              <ScoreChip label="EFI" value={EFI} type="demand" />
              <span className="text-muted-foreground text-sm">) ×</span>
              <span className="text-muted-foreground text-sm">(1 +</span>
              <ScoreChip label="P" value={P} type="demand" />
              <span className="text-muted-foreground text-sm">/10) +</span>
              <ScoreChip label="I" value={I} type="demand" />
              <span className="text-muted-foreground font-bold text-sm">]</span>
            </div>

            {/* Result numerator */}
            <div className="text-xs text-muted-foreground font-mono mb-1">= {numerator.toFixed(2)}</div>

            {/* Divider line */}
            <div className="w-full h-[2px] rounded-full bg-gradient-to-r from-transparent via-foreground/30 to-transparent my-1" />

            {/* Denominator */}
            <div className="flex items-center gap-1.5 flex-wrap justify-center px-4 pt-2">
              <span className="text-muted-foreground font-bold text-sm">[</span>
              <span className="text-muted-foreground text-sm">(</span>
              <ScoreChip label="R" value={R} type="capacity" />
              <span className="text-muted-foreground text-sm">+</span>
              <ScoreChip label="C" value={C} type="capacity" />
              <span className="text-muted-foreground text-sm">+</span>
              <ScoreChip label="AF" value={AF} type="capacity" />
              <span className="text-muted-foreground text-sm">+</span>
              <ScoreChip label="HID" value={HID} type="capacity" />
              <span className="text-muted-foreground text-sm">+</span>
              <ScoreChip label="NUT" value={NUT} type="capacity" />
              <span className="text-muted-foreground text-sm">+</span>
              <ScoreChip label="ERG" value={ERG} type="capacity" />
              <span className="text-muted-foreground text-sm">)</span>
              <span className="text-muted-foreground text-sm">−</span>
              <ScoreChip label="N" value={N} type="noise" />
              {MED > 0 && (
                <>
                  <span className="text-muted-foreground text-sm">−</span>
                  <ScoreChip label="MED" value={MED} type="noise" />
                </>
              )}
              <span className="text-muted-foreground font-bold text-sm">]</span>
            </div>

            {/* Result denominator */}
            <div className="text-xs text-muted-foreground font-mono mt-1">= {denominator.toFixed(2)}</div>
          </div>
        </div>

        {/* Status badge */}
        <div className="flex justify-center pt-2">
          <div
            className="px-5 py-1.5 rounded-full text-xs font-black tracking-wider text-white shadow-md"
            style={{ backgroundColor: myidColor }}
          >
            {status}
          </div>
        </div>

        {/* Two-column legend */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 mt-4 pt-3 border-t border-border/40">
          <div className="text-[9px] text-muted-foreground">
            <span className="font-bold text-foreground">NUMERADOR</span> = Demanda (↑ pior)
          </div>
          <div className="text-[9px] text-muted-foreground">
            <span className="font-bold text-foreground">DENOMINADOR</span> = Capacidade (↑ melhor)
          </div>
          <div className="text-[9px] text-muted-foreground mt-1">Quanto <strong>MAIOR</strong> o MyID,</div>
          <div className="text-[9px] text-muted-foreground mt-1"><strong>MAIOR</strong> a sobrecarga do sistema</div>
        </div>

        {/* Severity scale */}
        <div className="flex items-center gap-1 mt-2">
          <div className="h-2 flex-1 rounded-l-full" style={{ background: 'hsl(142, 70%, 45%)' }} />
          <div className="h-2 flex-1" style={{ background: 'hsl(48, 90%, 50%)' }} />
          <div className="h-2 flex-1" style={{ background: 'hsl(25, 90%, 50%)' }} />
          <div className="h-2 flex-1 rounded-r-full" style={{ background: 'hsl(0, 85%, 45%)' }} />
        </div>
        <div className="flex justify-between text-[8px] text-muted-foreground font-medium">
          <span>&lt;3 Favorável</span>
          <span>3-6 Moderado</span>
          <span>6-8 Crítico</span>
          <span>&gt;8 Cronificação</span>
        </div>
      </div>
    </div>
  );
}
