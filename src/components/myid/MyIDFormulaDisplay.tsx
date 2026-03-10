import React from 'react';
import { cn } from '@/lib/utils';
import { Zap, ShieldCheck, Info, AlertTriangle } from 'lucide-react';
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
  const interp = getMyIDInterpretation(myidScore, hasRedFlags);
  const myidColor = interp.color;
  const status = interp.label;

  // Hybrid Formula: ((D + EFI) * (1 + P / 10)) + P + I
  const numerator = ((D + EFI) * (1 + P / 10)) + P + I;
  const denominator = Math.max(0.5, (R + C + AF + HID + NUT + ERG) - N - MED);

  const totalSum = numerator + denominator;
  const demandPct = (numerator / totalSum) * 100;
  const capacityPct = (denominator / totalSum) * 100;

  // ── Perfis de Saúde MyID ──────────────────────────────────────────────────
  // Ajuste de thresholds para perfis (alinhado com v2 mais sensível)
  const hasHiddenDrains = D > 5 || EFI > 5 || P > 5 || I > 5 || N > 5;
  const isSilentHero = myidScore <= 1.5 && hasHiddenDrains;
  const isPerfectStorm = myidScore >= 5.0 && numerator > 20 && denominator < 15;
  const isFragileBalance = myidScore > 1.3 && denominator < 12 && !isPerfectStorm;
  const isSolidBase = myidScore < 1.3 && numerator < 10;

  // ── Interpretação Narrativa MyID ──────────────────────────────────────────
  const getNarrative = () => {
    // 1. Herói Silencioso (Já estava lá, mas vamos refinar)
    // 2. Tempestade Perfeita (Score alto + Demanda alta + Capacidade baixa)
    // 3. Equilíbrio Tênue (Score moderado/alto + Baixa Capacidade)
    // 4. Base Sólida (Score baixo + Baixa Demanda + Alta Capacidade)

    if (isPerfectStorm) {
      return {
        title: "TEMPESTADE PERFEITA",
        icon: <AlertTriangle className="w-5 h-5 text-red-600" />,
        color: "border-red-200 bg-gradient-to-br from-red-50 to-white",
        textColor: "text-red-900",
        accentColor: "text-red-600",
        description: `Seu sistema está operando em um nível de sobrecarga crítico (${myidScore.toFixed(1)}). Sua Demanda (${numerator.toFixed(1)}) está muito alta e sua Capacidade de Recuperação (${denominator.toFixed(1)}) está insuficiente para compensar o desgaste.`,
        insight: `💡 **Insight:** Atenção Urgente! Este é o momento de priorizar o repouso e estratégias de alívio imediato. Tentar "forçar" o sistema agora pode levar a uma crise de dor ou lesão.`
      };
    }

    if (isSilentHero) {
      const hiddenFactors = [];
      if (D > 6) hiddenFactors.push('Dor');
      if (EFI > 6) hiddenFactors.push('Perda Funcional');
      if (P > 6) hiddenFactors.push('Sobrecarga Psicológica');
      if (I > 6) hiddenFactors.push('Gatilhos/Inércia');
      if (N > 6) hiddenFactors.push('Ruído Sistêmico');
      const hiddenNames = hiddenFactors.join(', ');

      return {
        title: "SEU ESCUDO PROTETOR (HERÓI SILENCIOSO)",
        icon: <ShieldCheck className="w-5 h-5 text-indigo-500" />,
        color: "border-indigo-200 bg-gradient-to-br from-indigo-50 to-white",
        textColor: "text-indigo-900",
        accentColor: "text-red-600",
        description: `Seu Índice MyID final está favorável (${myidScore.toFixed(1)}) **NÃO** porque não há problemas sistêmicos (detectamos indicadores elevados de ${hiddenNames}), mas porque **sua Base de Recuperação (Hábitos) está tão forte que age como um escudo impenetrável**.`,
        insight: `💡 **Insight:** Essa é uma ótima notícia. Seus bons hábitos estão vencendo a carga negativa. O foco ideal agora é investigar e lapidar esses "Ralos de Energia Ocultos" antes que sua resiliência diminua.`
      };
    }

    if (isFragileBalance) {
      return {
        title: "EQUILÍBRIO TÊNUE",
        icon: <Zap className="w-5 h-5 text-blue-500" />,
        color: "border-blue-200 bg-gradient-to-br from-blue-50 to-white",
        textColor: "text-blue-900",
        accentColor: "text-blue-600",
        description: `Seu sistema está em um estado de alerta (${myidScore.toFixed(1)}). Embora a demanda não seja extrema, sua **Capacidade de Reserva está baixa (${denominator.toFixed(1)})**. Isso significa que qualquer novo estresse ou esforço pode desequilibrar seu sistema rapidamente.`,
        insight: `💡 **Insight:** Foco total em reconstruir suas defesas. Melhorar o sono e a hidratação são os passos mais rápidos para aumentar sua régua de tolerância e evitar crises.`
      };
    }

    if (isSolidBase) {
      return {
        title: "BASE SÓLIDA E RESILIENTE",
        icon: <ShieldCheck className="w-5 h-5 text-violet-500" />,
        color: "border-violet-200 bg-gradient-to-br from-violet-50 to-white",
        textColor: "text-violet-900",
        accentColor: "text-violet-600",
        description: `Parabéns! Seu sistema apresenta um equilíbrio excelente (${myidScore.toFixed(1)}). Com baixa demanda e uma capacidade robusta, você possui uma margem de segurança alta para lidar com os desafios do dia a dia.`,
        insight: `💡 **Insight:** Momento ideal para progressão de performance. Sua base sólida permite que você explore novos limites e intensifique seus treinos ou atividades com segurança.`
      };
    }

    // Default interpretation if no special profile matches
    return {
      title: "PERFIL DE SAÚDE MyID",
      icon: <Info className="w-5 h-5 text-blue-500" />,
      color: "border-blue-100 bg-gradient-to-br from-blue-50/50 to-white",
      textColor: "text-slate-900",
      accentColor: "text-blue-600",
      description: `Seu Índice MyID de ${myidScore.toFixed(1)} aponta para um estado de ${status.toLowerCase()}. A relação entre o que você consome de energia (Demanda) e o que você repõe (Capacidade) está dentro do esperado para este perfil.`,
      insight: `💡 **Insight:** Continue acompanhando seus índices. Pequenos ajustes nos hábitos diários (Capacidade) são sempre a forma mais sustentável de reduzir seu score global.`
    };
  };

  const narrative = getNarrative();

  return (
    <div className={cn("space-y-6", className)}>
      {/* Visual Header - Summary */}
      <Card className="border-0 shadow-lg bg-white overflow-hidden rounded-3xl">
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
                  { icon: '✨', range: '< 1.3', label: 'FAVORÁVEL', color: 'text-violet-600' },
                  { icon: '🔹', range: '1.3-3', label: 'MODERADA', color: 'text-blue-600' },
                  { icon: '🔶', range: '3-5', label: 'SEVERA', color: 'text-amber-600' },
                  { icon: '🚨', range: '> 5', label: 'CRÍTICA', color: 'text-red-600' },
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

          {/* Balance Bar */}
          <div className="space-y-4 max-w-2xl mx-auto w-full">
            <div className="flex justify-between items-start px-1 mb-1">
              <div className="flex flex-col items-start gap-0.5">
                <span className="text-[10px] font-black uppercase text-red-500 tracking-[0.2em]">Demanda</span>
                <span className="text-3xl font-black text-foreground">{numerator.toFixed(1)}</span>
                <span className="text-[10px] text-red-700/60 font-medium leading-tight max-w-[140px]">Carga de dor, inércia e fatores psicossociais</span>
              </div>
              <div className="flex flex-col items-end gap-0.5 text-right">
                <span className="text-[10px] font-black uppercase text-emerald-500 tracking-[0.2em]">Capacidade</span>
                <span className="text-3xl font-black text-foreground">{denominator.toFixed(1)}</span>
                <span className="text-[10px] text-emerald-700/60 font-medium leading-tight max-w-[140px]">Sua resiliência, hábitos e suporte de saúde</span>
              </div>
            </div>

            <div className="h-3 w-full flex rounded-full overflow-hidden bg-muted/40 shadow-inner">
              <div
                className="h-full transition-all duration-1000 ease-in-out bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]"
                style={{ width: `${demandPct}%` }}
              />
              <div
                className="h-full transition-all duration-1000 ease-in-out bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                style={{ width: `${capacityPct}%` }}
              />
            </div>

            <div className="flex justify-between text-[8px] font-black text-muted-foreground/50 uppercase tracking-[0.1em] px-1">
              <span>↑ Carga / Desgaste</span>
              <span>Resiliência / Recuperação ↑</span>
            </div>
          </div>

          {/* Navigating the Narrative Box */}
          <div className="mx-auto max-w-2xl mt-8 pt-6 border-t border-indigo-100/30">
            <div className={cn("rounded-2xl border-2 p-5 shadow-sm transition-all duration-500", narrative.color)}>
              <h4 className={cn("flex items-center gap-2 font-black mb-2 text-sm uppercase tracking-wider", narrative.textColor)}>
                {narrative.icon}
                {narrative.title}
              </h4>
              <p className={cn("text-xs leading-relaxed font-semibold", narrative.textColor)}
                dangerouslySetInnerHTML={{ __html: narrative.description.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/<span class="text-red-600 uppercase font-black">(.*?)<\/span>/g, '<span class="text-red-600 uppercase font-black">$1</span>') }} />

              <div className={cn("text-[11px] leading-relaxed font-medium mt-3 p-3 rounded-xl bg-white/40 border border-white/20", narrative.textColor)}
                dangerouslySetInnerHTML={{ __html: narrative.insight.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Factor Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Numerador Card */}
        <Card className="border-red-200 shadow-sm flex flex-col overflow-hidden rounded-2xl">
          <CardHeader className="bg-red-50/50 pb-4 border-b border-red-100">
            <CardTitle className="text-red-700 flex flex-col gap-1.5 text-base font-black">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                O QUE ESTÁ SOBRECARREGANDO <span className="opacity-60 font-medium ml-1">(Numerador)</span>
              </div>
              {hasHiddenDrains && isSilentHero && (
                <span className="inline-flex items-center bg-red-100/80 text-red-800 text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold w-fit border border-red-200">
                  ⚠️ Fator Oculto Ativo
                </span>
              )}
            </CardTitle>
            <CardDescription className="text-red-700/60 font-medium text-xs">Fatores que aumentam sua carga sistêmica</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-5 pb-6">
            <ScoreIndicator label="Dor (D)" value={D} type="demand" isHighlighted={highlightedKey === 'D'} />
            <ScoreIndicator label="Funcionalidade (EFI)" value={EFI} type="demand" isHighlighted={highlightedKey === 'EFI'} />
            <ScoreIndicator label="Psicológico (P)" value={P} type="demand" isHighlighted={highlightedKey === 'P'} />
            <ScoreIndicator label="Inércia (I)" value={I} type="demand" isHighlighted={highlightedKey === 'I'} />
            <div className="pt-2 mt-2 border-t border-red-100/50 flex justify-between items-center">
              <span className="text-[10px] uppercase font-black text-red-700/40 tracking-widest">Total Numerador</span>
              <span className="text-lg font-black text-red-700">{numerator.toFixed(1)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Denominador Card */}
        <Card className="border-emerald-200 shadow-sm flex flex-col overflow-hidden rounded-2xl">
          <CardHeader className="bg-emerald-50/50 pb-4 border-b border-emerald-100">
            <CardTitle className="text-emerald-700 flex items-center gap-2 text-base font-black">
              <ShieldCheck className="w-5 h-5" />
              O QUE ESTÁ AJUDANDO <span className="opacity-60 font-medium ml-1">(Denominador)</span>
            </CardTitle>
            <CardDescription className="text-emerald-700/60 font-medium text-xs">Fatores de recuperação do seu sistema</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-5 pb-6">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <ScoreIndicator label="Regulação (R)" value={R} type="capacity" isHighlighted={highlightedKey === 'R'} />
              <ScoreIndicator label="Contexto (C)" value={C} type="capacity" isHighlighted={highlightedKey === 'C'} />
              <ScoreIndicator label="Atividade (AF)" value={AF} type="capacity" isHighlighted={highlightedKey === 'AF'} />
              <ScoreIndicator label="Hidratação (HID)" value={HID} type="capacity" isHighlighted={highlightedKey === 'HID'} />
              <ScoreIndicator label="Nutrição (NUT)" value={NUT} type="capacity" isHighlighted={highlightedKey === 'NUT'} />
              <ScoreIndicator label="Ergonomia (ERG)" value={ERG} type="capacity" isHighlighted={highlightedKey === 'ERG'} />
            </div>

            <div className="pt-3 mt-4 border-t border-emerald-100/80 space-y-2">
              <div className="mb-2">
                <span className="text-[10px] uppercase font-black text-red-700/70 tracking-widest bg-red-50 px-2 py-0.5 rounded-md">
                  Ralos de Energia (Subtraem da Capacidade)
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4">
                <ScoreIndicator label="Ruído (N)" value={N} type="noise" isHighlighted={highlightedKey === 'N'} />
                <ScoreIndicator label="Medicação (MED)" value={MED} type="noise" isHighlighted={highlightedKey === 'MED'} />
              </div>
              <div className="flex justify-between items-center pt-3 mt-2 border-t border-emerald-100/50">
                <span className="text-[10px] uppercase font-black text-emerald-700/40 tracking-widest">Total Denominador</span>
                <span className="text-lg font-black text-emerald-700">{denominator.toFixed(1)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer Concept */}
      <div className="pt-2 text-center">
        <div className="inline-flex items-center gap-2 bg-muted/30 px-4 py-2 rounded-full border border-border/50">
          <Info className="w-3 h-3 text-muted-foreground" />
          <p className="text-[10px] text-muted-foreground font-medium leading-none">
            O Índice MyID é a relação entre a <strong>Carga Sistêmica</strong> e a <strong>Capacidade de Resposta</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
