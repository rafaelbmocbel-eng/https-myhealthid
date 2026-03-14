import React from 'react';
import { cn } from '@/lib/utils';
import { Zap, ShieldCheck, Info } from 'lucide-react';
import { getThermalColor, getMyIDInterpretation } from '@/utils/myidCalculations';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

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

const ScoreIndicator = ({
  label,
  value,
  max = 10,
  type,
  isHighlighted
}: {
  label: string;
  value: number;
  max?: number;
  type: 'demand' | 'capacity' | 'noise';
  isHighlighted: boolean
}) => {
  // Demand: High = Hot (Red)
  // Capacity: High = Cold (Violet)
  // Noise: High = Bad
  const color = type === 'demand' || type === 'noise'
    ? getThermalColor(value)
    : getThermalColor(10 - value);

  const percentage = (value / max) * 100;

  return (
    <div className={cn(
      "space-y-1.5 transition-all duration-300 p-1.5 rounded-lg border border-transparent",
      isHighlighted ? "bg-muted/50 border-border shadow-sm scale-[1.01]" : ""
    )}>
      <div className="flex justify-between items-center px-0.5">
        <span className="text-[11px] font-bold text-gray-700">{label}</span>
        <span className="text-[11px] font-black" style={{ color }}>{value.toFixed(1)}/10</span>
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden shadow-inner">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
            boxShadow: isHighlighted ? `0 0 8px ${color}40` : 'none'
          }}
        />
      </div>
    </div>
  );
};

export default function MyIDFormulaDisplay({ scores, myidScore, highlightedKey, hasRedFlags = false, className = '' }: Props & { hasRedFlags?: boolean }) {
  const { D, EFI, P, I, R, C, AF, HID, NUT, ERG, N, MED = 0 } = scores;
  const dimScores = { D, EFI, P, I, N };
  const interp = getMyIDInterpretation(myidScore, hasRedFlags, dimScores);
  const myidColor = interp.color;
  const status = interp.label;
  const dimensionAlerts = interp.dimensionAlerts || [];

  // v3 Déficit do Ótimo formula components
  const demandaAvg = (D + EFI + I) / 3;
  const amplificadorP = 1 + P / 10;
  const demandaAmplificada = demandaAvg * amplificadorP;

  const deficitR = 10 - R;
  const deficitC = 10 - C;
  const deficitAF = 10 - AF;
  const deficitHID = 10 - HID;
  const deficitNUT = 10 - NUT;
  const deficitERG = 10 - ERG;
  const deficitAvg = (deficitR + deficitC + deficitAF + deficitHID + deficitNUT + deficitERG) / 6;

  const medBuffer = Math.min(2, MED * 0.3);

  const componenteDemanda = demandaAmplificada * 0.50;
  const componenteDeficit = deficitAvg * 0.35;
  const componenteRuido = N * 0.15;

  // Silent Hero Logic
  const hasHiddenDrains = D > 6 || EFI > 6 || P > 6 || I > 6 || N > 6;
  const isSilentHero = myidScore <= 4 && hasHiddenDrains;

  const hiddenFactors = [];
  if (D > 6) hiddenFactors.push('Dor');
  if (EFI > 6) hiddenFactors.push('Perda Funcional');
  if (P > 6) hiddenFactors.push('Sobrecarga Psicológica');
  if (I > 6) hiddenFactors.push('Gatilhos/Inércia');
  if (N > 6) hiddenFactors.push('Ruído Sistêmico');
  const hiddenNames = hiddenFactors.join(', ');

  return (
    <div className={cn("space-y-6", className)}>
      {/* Visual Header - Summary */}
      <Card className="border-0 shadow-lg bg-card overflow-hidden rounded-3xl">
        <CardContent className="p-8 space-y-8">
          <div className="flex flex-col items-center">
            <div className="text-6xl font-black tracking-tighter" style={{ color: myidColor }}>
              {myidScore.toFixed(1)}
            </div>
            <div className="flex flex-col items-center mt-1">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground opacity-60">MyID Index</span>
              <span className="text-xs font-black mt-2 px-4 py-1.5 rounded-full text-white uppercase tracking-wider shadow-sm" style={{ backgroundColor: myidColor }}>
                {status}
              </span>

              {/* Severity Legend */}
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-6 pt-4 border-t border-border/40 w-full max-w-lg">
                {[
                  { icon: '✨', range: '< 3', label: 'RECUPERAÇÃO FAVORÁVEL', color: 'text-violet-600' },
                  { icon: '🔹', range: '3-6', label: 'SOBRECARGA MODERADA', color: 'text-blue-600' },
                  { icon: '🔶', range: '6-8', label: 'SOBRECARGA CRÍTICA', color: 'text-amber-600' },
                  { icon: '🚨', range: '> 8', label: 'RISCO CRONIFICAÇÃO', color: 'text-red-600' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
                    <span className="text-xs">{item.icon}</span>
                    <span className={cn("text-[9px] font-black uppercase tracking-wider", item.color)}>{item.range}</span>
                    <span className="text-[9px] font-bold text-muted-foreground/80 uppercase tracking-tighter">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Dimension Alerts */}
          {dimensionAlerts.length > 0 && (
            <div className="mt-4 space-y-2 max-w-lg mx-auto w-full">
              {dimensionAlerts.map((alert) => (
                <div key={alert.dimension} className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs">
                  <span className="text-base">🔴</span>
                  <span className="font-bold text-amber-900">
                    {alert.label} ({alert.dimension} = {alert.value.toFixed(1)}) → classificação elevada para {alert.severity}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* v3 Formula Composition Bar */}
          <div className="space-y-4 max-w-2xl mx-auto w-full">
            <div className="text-center mb-2">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">COMPOSIÇÃO DO ÍNDICE</span>
            </div>

            {/* Three weighted components */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                <div className="text-2xl font-black text-red-600">{componenteDemanda.toFixed(1)}</div>
                <div className="text-[9px] font-black uppercase tracking-wider text-red-500 mt-1">Demanda × P</div>
                <div className="text-[8px] text-red-400 font-medium">50% do peso</div>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <div className="text-2xl font-black text-amber-600">{componenteDeficit.toFixed(1)}</div>
                <div className="text-[9px] font-black uppercase tracking-wider text-amber-500 mt-1">Déficit Capacidade</div>
                <div className="text-[8px] text-amber-400 font-medium">35% do peso</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-2xl font-black text-slate-600">{componenteRuido.toFixed(1)}</div>
                <div className="text-[9px] font-black uppercase tracking-wider text-slate-500 mt-1">Ruído Sistêmico</div>
                <div className="text-[8px] text-slate-400 font-medium">15% do peso</div>
              </div>
            </div>

            {/* Stacked composition bar */}
            <div className="space-y-1.5">
              <div className="h-3 w-full flex rounded-full overflow-hidden bg-muted/40 shadow-inner">
                {myidScore > 0 && (
                  <>
                    <div className="h-full bg-red-500 transition-all duration-1000" style={{ width: `${(componenteDemanda / myidScore) * 100}%` }} />
                    <div className="h-full bg-amber-500 transition-all duration-1000" style={{ width: `${(componenteDeficit / myidScore) * 100}%` }} />
                    <div className="h-full bg-slate-400 transition-all duration-1000" style={{ width: `${(componenteRuido / myidScore) * 100}%` }} />
                  </>
                )}
              </div>
              {medBuffer > 0 && (
                <div className="text-[9px] text-emerald-600 font-bold text-center">
                  💊 Buffer Medicação: -{medBuffer.toFixed(1)}
                </div>
              )}
            </div>

            {/* Amplifier info */}
            <div className="text-center p-2 rounded-lg bg-muted/30 border border-border/50">
              <span className="text-[10px] text-muted-foreground font-medium">
                Amplificador Psicológico (P): <strong className="text-foreground">×{amplificadorP.toFixed(1)}</strong>
                {amplificadorP > 1.5 && <span className="text-red-500 ml-1">⚠️ Alto</span>}
              </span>
            </div>
          </div>

          {/* Silent Hero */}
          {isSilentHero && (
            <div className="mx-auto max-w-2xl mt-8 pt-6 border-t border-indigo-100/50">
              <div className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm">
                <h4 className="flex items-center gap-2 text-indigo-800 font-black mb-2 text-sm uppercase tracking-wider">
                  <ShieldCheck className="w-5 h-5 text-indigo-500" />
                  Seu Escudo Protetor (Herói Silencioso)
                </h4>
                <p className="text-xs text-indigo-900/80 leading-relaxed font-semibold">
                  Seu Índice MyID final está favorável ({myidScore.toFixed(1)}) <strong>NÃO</strong> porque não há problemas sistêmicos (detectamos indicadores elevados de <span className="text-red-600 uppercase font-black">{hiddenNames}</span>), mas porque <strong>seus déficits de capacidade são mínimos, agindo como um escudo protetor</strong>.
                </p>
                <p className="text-[11px] text-indigo-900/70 leading-relaxed font-medium mt-3 bg-indigo-100/30 p-3 rounded-xl">
                  💡 <strong>Insight:</strong> Seus bons hábitos estão compensando a carga negativa. O foco ideal agora é investigar e reduzir esses "Ralos de Energia Ocultos" antes que sua resiliência diminua.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Factor Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Demanda Card */}
        <Card className="border-red-200 shadow-sm flex flex-col overflow-hidden rounded-2xl">
          <CardHeader className="bg-red-50/50 pb-4 border-b border-red-100">
            <CardTitle className="text-red-700 flex flex-col gap-1.5 text-base font-black">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                DEMANDA SISTÊMICA <span className="opacity-60 font-medium ml-1">(50%)</span>
              </div>
              {hasHiddenDrains && isSilentHero && (
                <span className="inline-flex items-center bg-red-100/80 text-red-800 text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold w-fit border border-red-200">
                  ⚠️ Fator Oculto Ativo
                </span>
              )}
            </CardTitle>
            <CardDescription className="text-red-700/60 font-medium text-xs">Média(D, EFI, I) × Amplificador P</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-5 pb-6">
            <ScoreIndicator label="Dor (D)" value={D} type="demand" isHighlighted={highlightedKey === 'D'} />
            <ScoreIndicator label="Funcionalidade (EFI)" value={EFI} type="demand" isHighlighted={highlightedKey === 'EFI'} />
            <ScoreIndicator label="Psicológico (P) — Amplificador" value={P} type="demand" isHighlighted={highlightedKey === 'P'} />
            <ScoreIndicator label="Inércia (I)" value={I} type="demand" isHighlighted={highlightedKey === 'I'} />
            <div className="pt-2 mt-2 border-t border-red-100/50 flex justify-between items-center">
              <span className="text-[10px] uppercase font-black text-red-700/40 tracking-widest">Contribuição</span>
              <span className="text-lg font-black text-red-700">{componenteDemanda.toFixed(1)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Déficit de Capacidade Card */}
        <Card className="border-amber-200 shadow-sm flex flex-col overflow-hidden rounded-2xl">
          <CardHeader className="bg-amber-50/50 pb-4 border-b border-amber-100">
            <CardTitle className="text-amber-700 flex items-center gap-2 text-base font-black">
              <ShieldCheck className="w-5 h-5" />
              DÉFICIT DE CAPACIDADE <span className="opacity-60 font-medium ml-1">(35%)</span>
            </CardTitle>
            <CardDescription className="text-amber-700/60 font-medium text-xs">Distância do ideal (10) — quanto menor, melhor</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-5 pb-6">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <ScoreIndicator label={`Regulação (R) — Déf: ${deficitR.toFixed(1)}`} value={R} type="capacity" isHighlighted={highlightedKey === 'R'} />
              <ScoreIndicator label={`Contexto (C) — Déf: ${deficitC.toFixed(1)}`} value={C} type="capacity" isHighlighted={highlightedKey === 'C'} />
              <ScoreIndicator label={`Atividade (AF) — Déf: ${deficitAF.toFixed(1)}`} value={AF} type="capacity" isHighlighted={highlightedKey === 'AF'} />
              <ScoreIndicator label={`Hidratação (HID) — Déf: ${deficitHID.toFixed(1)}`} value={HID} type="capacity" isHighlighted={highlightedKey === 'HID'} />
              <ScoreIndicator label={`Nutrição (NUT) — Déf: ${deficitNUT.toFixed(1)}`} value={NUT} type="capacity" isHighlighted={highlightedKey === 'NUT'} />
              <ScoreIndicator label={`Ergonomia (ERG) — Déf: ${deficitERG.toFixed(1)}`} value={ERG} type="capacity" isHighlighted={highlightedKey === 'ERG'} />
            </div>

            <div className="pt-3 mt-4 border-t border-amber-100/80 space-y-2">
              <div className="mb-2">
                <span className="text-[10px] uppercase font-black text-slate-700/70 tracking-widest bg-slate-50 px-2 py-0.5 rounded-md">
                  Ruído & Medicação
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4">
                <ScoreIndicator label="Ruído (N)" value={N} type="noise" isHighlighted={highlightedKey === 'N'} />
                <ScoreIndicator label="Medicação (MED)" value={MED} type="noise" isHighlighted={highlightedKey === 'MED'} />
              </div>
              <div className="flex justify-between items-center pt-3 mt-2 border-t border-amber-100/50">
                <span className="text-[10px] uppercase font-black text-amber-700/40 tracking-widest">Déficit Médio</span>
                <span className="text-lg font-black text-amber-700">{deficitAvg.toFixed(1)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="pt-2 text-center">
        <div className="inline-flex items-center gap-2 bg-muted/30 px-4 py-2 rounded-full border border-border/50">
          <Info className="w-3 h-3 text-muted-foreground" />
          <p className="text-[10px] text-muted-foreground font-medium leading-none">
            MyID = <strong>[Demanda × P × 0.50]</strong> + <strong>[Déficit × 0.35]</strong> + <strong>[N × 0.15]</strong> — Ferramenta de suporte ao raciocínio clínico.
          </p>
        </div>
      </div>
    </div>
  );
}
