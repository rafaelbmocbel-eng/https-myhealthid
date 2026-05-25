import React from 'react';
import { cn } from '@/lib/utils';
import { Zap, ShieldCheck, Info, AlertTriangle, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import MyIDGaugeSemicircle from './MyIDGaugeSemicircle';
import {
  DIMENSION_LABELS, DIMENSION_COLORS, TEMPLATES_INTERPRETACAO,
  classificarMyID100, PerdaCalculada, calcularPerdaDimensao, identificarDriver,
} from '@/utils/myid/lossTable';

interface ScoreValues {
  D: number; EFI: number; P: number; I: number;
  R: number; C: number; AF: number; HID: number;
  NUT: number; ERG: number; N: number; MED?: number;
}

interface Props {
  scores: ScoreValues;
  myidScore: number; // 0-100
  perdas?: Record<string, PerdaCalculada>;
  driverPrimario?: { dimensao: string; perda_pontos: number; percentual_impacto: number; motivo: string } | null;
  gatilhosCriticos?: string[];
  highlightedKey?: string | null;
  hasRedFlags?: boolean;
  className?: string;
  hideGauge?: boolean;
}

function LossBar({ dim, perda, maxLoss = 20 }: { dim: string; perda: PerdaCalculada; maxLoss?: number }) {
  const color = DIMENSION_COLORS[dim] || '#64748B';
  const barWidth = Math.min((perda.perda_pontos / maxLoss) * 100, 100);

  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="text-[11px] font-bold w-16 text-right text-foreground/80 shrink-0">
        {DIMENSION_LABELS[dim] || dim}
      </span>
      <div className="flex-1 h-3 bg-muted/40 rounded-full overflow-hidden shadow-inner">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${barWidth}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[11px] font-black w-12 text-right" style={{ color }}>
        -{perda.perda_pontos}pts
      </span>
      {perda.gatilho_critico && <AlertTriangle className="icon-sm text-red-500 shrink-0" />}
    </div>
  );
}

export default function MyIDFormulaDisplay({
  scores, myidScore, perdas: perdasProp, driverPrimario, gatilhosCriticos = [], highlightedKey, hasRedFlags = false, className = ''
}: Props) {
  const { D, EFI, P, I, R, C, AF, HID, NUT, ERG, N, MED = 0 } = scores;

  // Calculate perdas if not provided
  const perdas = perdasProp || (() => {
    const p: Record<string, PerdaCalculada> = {};
    p['D'] = calcularPerdaDimensao('D', D);
    p['EFI'] = calcularPerdaDimensao('EFI', EFI);
    p['P'] = calcularPerdaDimensao('P', P);
    p['I'] = calcularPerdaDimensao('I', I);
    p['N'] = calcularPerdaDimensao('N', N);
    p['R'] = calcularPerdaDimensao('R', 10 - R);
    p['C'] = calcularPerdaDimensao('C', 10 - C);
    p['AF'] = calcularPerdaDimensao('AF', 10 - AF);
    p['HID'] = calcularPerdaDimensao('HID', 10 - HID);
    p['NUT'] = calcularPerdaDimensao('NUT', 10 - NUT);
    p['ERG'] = calcularPerdaDimensao('ERG', 10 - ERG);
    return p;
  })();

  const driver = driverPrimario || identificarDriver(perdas);
  const totalPerdas = Object.values(perdas).reduce((sum, p) => sum + p.perda_pontos, 0);
  const temGatilhoCritico = gatilhosCriticos.length > 0 || Object.values(perdas).some(p => p.gatilho_critico);
  const classificacao = classificarMyID100(myidScore, temGatilhoCritico);
  const template = TEMPLATES_INTERPRETACAO[classificacao.nome] || TEMPLATES_INTERPRETACAO['MODERADO'];

  // Sort perdas by loss amount descending
  const perdasSorted = Object.entries(perdas).sort(([, a], [, b]) => b.perda_pontos - a.perda_pontos);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Score Principal — Gauge MyID-100 */}
      <Card className="border-0 shadow-lg bg-card overflow-hidden rounded-3xl">
        <CardContent className="p-8 space-y-6">
          <div className="flex flex-col items-center">
            <MyIDGaugeSemicircle
              score={myidScore}
              classificacao={classificacao.nome}
              cor={classificacao.cor}
              emoji={classificacao.emoji}
            />

            {/* Interpretation */}
            <div className="mt-4 p-4 rounded-xl bg-muted/30 border w-full max-w-lg text-left">
              <p className="text-sm font-medium text-foreground leading-relaxed">{template.descricao}</p>
              <p className="text-xs text-muted-foreground mt-2">{template.recomendacao}</p>
            </div>
          </div>

          {/* Critical Triggers */}
          {temGatilhoCritico && (
            <div className="mt-4 space-y-2 max-w-lg mx-auto w-full">
              {Object.entries(perdas).filter(([_, p]) => p.gatilho_critico).map(([dim, p]) => (
                <div key={dim} className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs">
                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                  <span className="font-bold text-red-900">
                    ⚠️ Característica em perigo crítico: {DIMENSION_LABELS[dim]} (score bruto {p.score_bruto.toFixed(1)})
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gráfico de Perdas */}
      <Card className="shadow-lg border-0 bg-card overflow-hidden rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-black flex items-center gap-2">
            📊 Análise de Perdas <span className="text-muted-foreground font-medium text-xs">(total: -{totalPerdas} pts)</span>
          </CardTitle>
          <CardDescription className="text-xs">Cada problema subtrai pontos da sua pontuação de 100</CardDescription>
        </CardHeader>
        <CardContent className="pb-6">
          <div className="space-y-0.5">
            {perdasSorted.map(([dim, perda]) => (
              perda.perda_pontos > 0 && <LossBar key={dim} dim={dim} perda={perda} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Driver Primário */}
      {driver && (
        <Card className="shadow-lg border-2 overflow-hidden rounded-2xl" style={{ borderColor: DIMENSION_COLORS[driver.dimensao] || '#64748B' }}>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-5 w-5" style={{ color: DIMENSION_COLORS[driver.dimensao] }} />
              <h3 className="text-sm font-black uppercase tracking-wider">🎯 Driver Primário</h3>
            </div>
            <div className="flex items-center gap-4">
              <div
                className="h-16 w-16 rounded-2xl flex items-center justify-center text-white font-black text-xl shrink-0"
                style={{ backgroundColor: DIMENSION_COLORS[driver.dimensao] }}
              >
                {DIMENSION_LABELS[driver.dimensao]?.slice(0, 3) || driver.dimensao}
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-black" style={{ color: DIMENSION_COLORS[driver.dimensao] }}>
                  {DIMENSION_LABELS[driver.dimensao]}
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Responsável por <strong>{driver.percentual_impacto.toFixed(1)}%</strong> das perdas (-{driver.perda_pontos} pts)
                </p>
                <p className="text-[11px] text-muted-foreground/70 mt-1">{driver.motivo}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Demand Scores */}
        <Card className="border-red-200 shadow-sm flex flex-col overflow-hidden rounded-2xl">
          <CardHeader className="bg-red-50/50 pb-3 border-b border-red-100">
            <CardTitle className="text-red-700 flex items-center gap-2 text-sm font-black">
              <Zap className="w-4 h-4" /> DEMANDA (scores brutos)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4 pb-5">
            {[
              { label: 'Dor (D)', value: D, key: 'D' },
              { label: 'Funcionalidade (EFI)', value: EFI, key: 'EFI' },
              { label: 'Psicológico (P)', value: P, key: 'P' },
              { label: 'Inércia (I)', value: I, key: 'I' },
            ].map(item => (
              <div key={item.key} className={cn("space-y-1 p-1.5 rounded-lg transition-all", highlightedKey === item.key && "bg-muted/50 border border-border")}>
                <div className="flex justify-between text-xs font-bold text-foreground/80">
                  <span>{item.label}</span>
                  <span>{item.value.toFixed(1)}/10 → <span className="text-red-600">-{perdas[item.key]?.perda_pontos || 0}pts</span></span>
                </div>
                <Progress value={item.value * 10} className="h-2 bg-red-100 [&>div]:bg-red-500" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Capacity Scores */}
        <Card className="border-emerald-200 shadow-sm flex flex-col overflow-hidden rounded-2xl">
          <CardHeader className="bg-emerald-50/50 pb-3 border-b border-emerald-100">
            <CardTitle className="text-emerald-700 flex items-center gap-2 text-sm font-black">
              <ShieldCheck className="w-4 h-4" /> CAPACIDADE (scores brutos)
            </CardTitle>
            <CardDescription className="text-emerald-600/60 text-[10px]">Alto = bom. Perda = déficit do ideal</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4 pb-5">
            {[
              { label: 'Regulação (R)', value: R, key: 'R' },
              { label: 'Contexto (C)', value: C, key: 'C' },
              { label: 'Atividade (AF)', value: AF, key: 'AF' },
              { label: 'Hidratação (HID)', value: HID, key: 'HID' },
              { label: 'Nutrição (NUT)', value: NUT, key: 'NUT' },
              { label: 'Ergonomia (ERG)', value: ERG, key: 'ERG' },
            ].map(item => (
              <div key={item.key} className={cn("space-y-1 p-1 rounded-lg transition-all", highlightedKey === item.key && "bg-muted/50 border border-border")}>
                <div className="flex justify-between text-[11px] font-bold text-foreground/80">
                  <span>{item.label}</span>
                  <span>{item.value.toFixed(1)}/10 → <span className="text-amber-600">-{perdas[item.key]?.perda_pontos || 0}pts</span></span>
                </div>
                <Progress value={item.value * 10} className={`h-1.5 bg-emerald-100 ${item.value < 5 ? "[&>div]:bg-red-500" : "[&>div]:bg-emerald-500"}`} />
              </div>
            ))}
            <div className="pt-2 mt-2 border-t border-muted/50 space-y-2">
              <div className="flex justify-between text-[11px] font-bold text-foreground/70">
                <span>Ruído (N)</span><span>{N.toFixed(1)}/10 → <span className="text-slate-600">-{perdas['N']?.perda_pontos || 0}pts</span></span>
              </div>
              {MED !== 0 && (
                <div className="flex justify-between text-[11px] font-bold text-foreground/70">
                  <span>💊 Medicação</span><span className={MED > 0 ? "text-emerald-600" : "text-red-600"}>{MED > 0 ? '+' : ''}{MED}pts</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="pt-2 text-center">
        <div className="inline-flex items-center gap-2 bg-muted/30 px-4 py-2 rounded-full border border-border/50">
          <Info className="w-3 h-3 text-muted-foreground" />
          <p className="text-[10px] text-muted-foreground font-medium leading-none">
            MyID-100 = 100 - <strong>Σ Perdas por dimensão</strong> — Quanto maior, melhor. v2.0
          </p>
        </div>
      </div>
    </div>
  );
}
