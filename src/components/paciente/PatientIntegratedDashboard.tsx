import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity, Fingerprint, AlignCenter, Dumbbell,
  TrendingUp, Brain, ChevronDown, ChevronUp, FileText,
  Sparkles, Printer, Copy
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getMyIDFingerprintData, getMyIDSeverityColor } from '@/utils/myidCalculations';
import MyIDFingerprint from '@/components/myid/MyIDFingerprint';
import MyIDFormulaDisplay from '@/components/myid/MyIDFormulaDisplay';
import StructuralConnectionMap from '@/components/structural/StructuralConnectionMap';
import { StructuralAssessmentData, UNIT_CONFIGS, classifyScore, classifyScoreColor } from '@/types/structural';
import type { MyIDResult as MyIDResultType, FingerprintRing } from '@/types/myid';
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Area
} from 'recharts';

interface PatientIntegratedDashboardProps {
  pacienteId: string;
  serviceType: 'identidade' | 'cob_zero' | 'studio';
}

export default function PatientIntegratedDashboard({
  pacienteId,
  serviceType
}: PatientIntegratedDashboardProps) {
  const [showDiretrizes, setShowDiretrizes] = useState(false);
  const [hoveredScoreKey, setHoveredScoreKey] = useState<string | null>(null);

  // ── MyID data
  const { data: myidAvaliacoes = [] } = useQuery({
    queryKey: ['integrated-myid-avaliacoes', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avaliacoes_identidade')
        .select('*')
        .eq('paciente_id', pacienteId)
        .not('myid_score', 'is', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // ── MyID from myid_avaliacoes (completed via link)
  const { data: myidFromLink = [] } = useQuery({
    queryKey: ['integrated-myid-link', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('myid_avaliacoes')
        .select('*')
        .eq('paciente_id', pacienteId)
        .eq('status', 'concluido')
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      return data || [];
    },
  });

  const ultimaMyID = myidAvaliacoes[0];
  const myidLinkResult = myidFromLink[0]?.resultado_processado as any;

  // Use whichever is more recent
  const hasMyID = !!ultimaMyID || !!myidLinkResult;

  // ── Service-specific data
  const { data: serviceData = [] } = useQuery({
    queryKey: ['integrated-service-data', pacienteId, serviceType],
    queryFn: async () => {
      if (serviceType === 'cob_zero') {
        const { data } = await supabase.from('avaliacoes_cob_zero').select('*')
          .eq('paciente_id', pacienteId).order('created_at', { ascending: false });
        return data || [];
      } else if (serviceType === 'studio') {
        const { data } = await supabase.from('studio_medidas').select('*')
          .eq('paciente_id', pacienteId).order('data_medida', { ascending: false });
        return data || [];
      }
      return [];
    },
  });

  // ── Structural assessment data (only for Método Identidade)
  const { data: structuralAvaliacoes = [] } = useQuery({
    queryKey: ['integrated-structural', pacienteId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('avaliacoes_identidade')
        .select('*')
        .eq('paciente_id', pacienteId)
        .not('score_e', 'is', null)
        .is('myid_score', null)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      return data || [];
    },
    enabled: serviceType === 'identidade',
  });

  const structuralData = structuralAvaliacoes[0]?.dados_avaliacao as any as StructuralAssessmentData | null;

  const lastServiceEntry = serviceData[0] as any;

  // ── Build scores
  const getScores = () => {
    if (myidLinkResult?.component_scores) {
      const cs = myidLinkResult.component_scores;
      return {
        D: cs.D ?? (cs.D_pain ?? 0),
        EFI: cs.EFI ?? (cs.EFI_functionality ?? 0),
        P: cs.P ?? (cs.P_psychological ?? 0),
        I: cs.I ?? (cs.I_inertia ?? 0),
        R: cs.R ?? (cs.R_regulation ?? 0),
        C: cs.C ?? (cs.C_context ?? 0),
        AF: cs.AF ?? (cs.AF_activity ?? 5),
        HID: cs.HID ?? (cs.HID_hydration ?? 5),
        NUT: cs.NUT ?? (cs.NUT_nutrition ?? 5),
        ERG: cs.ERG ?? (cs.ERG_ergonomics ?? 5),
        N: cs.N ?? (cs.N_noise ?? 0),
        MED: 0,
      };
    }
    if (ultimaMyID) {
      const analysis = ultimaMyID.myid_analysis as any;
      const cs = analysis?.componentScores || analysis?.component_scores || {};
      return {
        D: cs.D ?? (Number(ultimaMyID.score_d) || 0),
        EFI: cs.EFI ?? (Number(ultimaMyID.score_efi) || 0),
        P: cs.P ?? (Number(ultimaMyID.score_p) || 0),
        I: cs.I ?? (Number(ultimaMyID.score_i) || 0),
        R: cs.R ?? (Number(ultimaMyID.score_r) || 0),
        C: cs.C ?? (Number(ultimaMyID.score_c) || 0),
        AF: cs.AF ?? 5, HID: cs.HID ?? 5, NUT: cs.NUT ?? 5, ERG: cs.ERG ?? 5,
        N: cs.N ?? (Number(ultimaMyID.score_n) || 0),
        MED: 0,
      };
    }
    return null;
  };

  const scores = getScores();
  const myidScore = myidLinkResult?.MyID_score ?? Number(ultimaMyID?.myid_score) ?? 0;
  const classificacao = myidLinkResult?.status ?? ultimaMyID?.classificacao ?? 'LEVE';
  const recommendation = myidLinkResult?.recommendation ?? '';
  const painPattern = myidLinkResult?.pain_pattern ?? '';
  const focusAreas = myidLinkResult?.focus_areas ?? [];

  const rings = scores ? getMyIDFingerprintData(scores) : [];
  const severityClass = getMyIDSeverityColor(classificacao);

  // ── Chart data
  const getMyIDDate = (av: any) => av.data_avaliacao || format(parseISO(av.created_at), 'dd/MM/yyyy');
  const getServiceDate = (av: any) => serviceType === 'studio' ? format(parseISO(av.data_medida), 'dd/MM/yyyy') : av.data_avaliacao;

  const allDates = Array.from(new Set([
    ...myidAvaliacoes.map(getMyIDDate),
    ...serviceData.map(getServiceDate)
  ])).sort((a: string, b: string) => {
    try {
      return parse(a, 'dd/MM/yyyy', new Date()).getTime() - parse(b, 'dd/MM/yyyy', new Date()).getTime();
    } catch { return 0; }
  });

  const chartData = allDates.map(dateStr => {
    const myidMatch = myidAvaliacoes.find(m => getMyIDDate(m) === dateStr);
    const serviceMatch = serviceData.find((m: any) => getServiceDate(m) === dateStr);
    const point: any = { date: dateStr };
    if (myidMatch) {
      point.myidScore = Number(myidMatch.myid_score) || null;
      point.scoreD = Number(myidMatch.score_d) || null;
      point.scoreR = Number(myidMatch.score_r) || null;
    }
    if (serviceMatch) {
      const sm = serviceMatch as any;
      if (serviceType === 'cob_zero') {
        point.cobb = Number(sm.cobb_angle) || null;
        point.scoreE = Number(sm.score_e) || null;
        point.risco = Number(sm.risco_percentage) || null;
      } else if (serviceType === 'studio') {
        point.gordura = Number(sm.percentual_gordura) || null;
        point.peso = Number(sm.peso) || null;
      }
    }
    return point;
  });

  // ═══════════════════ RENDER ═══════════════════

  return (
    <div className="space-y-5">
      {/* ─── SEÇÃO 1: MyID RESULTADO ─── */}
      {!hasMyID ? (
        <div className="flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-xl border-border bg-muted/20 text-center">
          <Fingerprint className="h-14 w-14 text-muted-foreground opacity-20 mb-3" />
          <h4 className="font-bold text-foreground">Aguardando MyID</h4>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            O paciente precisa concluir o questionário MyID para visualizar os resultados.
          </p>
        </div>
      ) : (
        <>
          {/* MyID Fingerprint + Score */}
          <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card via-card to-violet-50/30 dark:to-violet-950/10">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/30 shrink-0">
                  <Fingerprint className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-foreground leading-none">Impressão Digital Sistêmica</h3>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-1">MyID Score</p>
                </div>
                <Badge className={`ml-auto border ${severityClass}`}>{classificacao}</Badge>
              </div>

              {/* Fingerprint — large, centered */}
              <div className="w-full max-w-lg mx-auto">
                <MyIDFingerprint rings={rings} myidScore={myidScore} highlightedKey={hoveredScoreKey} />
              </div>

              {/* Score + Indexes below */}
              <div className="space-y-3 w-full">
                <div className="text-center">
                  <div className="text-4xl font-black tracking-tighter" style={{
                    color: myidScore <= 2 ? 'hsl(270,60%,65%)' : myidScore <= 4 ? 'hsl(210,75%,55%)' : myidScore <= 6 ? 'hsl(35,85%,55%)' : 'hsl(0,85%,50%)'
                  }}>
                    {myidScore.toFixed(1)}
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">Índice MyID Global</div>
                </div>

                {/* Score circles grid */}
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {rings.map(r => (
                    <div
                      key={r.scoreKey}
                      className={`flex items-center gap-2 p-2 rounded-xl transition-all duration-200 cursor-pointer ${hoveredScoreKey === r.scoreKey
                        ? 'ring-2 ring-offset-1 scale-105'
                        : 'hover:scale-102'
                        }`}
                      style={{
                        backgroundColor: hoveredScoreKey === r.scoreKey
                          ? `${r.color}22`
                          : `${r.color}10`,
                        outlineColor: hoveredScoreKey === r.scoreKey ? r.color : undefined,
                      }}
                      onMouseEnter={() => setHoveredScoreKey(r.scoreKey)}
                      onMouseLeave={() => setHoveredScoreKey(null)}
                    >
                      <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                      <div className="min-w-0">
                        <div className="text-[9px] text-muted-foreground uppercase font-bold truncate">{r.scoreKey}</div>
                        <div className="text-sm font-black" style={{ color: r.color }}>{r.value.toFixed(1)}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {painPattern && (
                  <div className="text-xs text-muted-foreground border-t border-border/50 pt-2">
                    <span className="font-bold">Padrão Temporal:</span> {painPattern}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ─── EQUAÇÃO MyID ─── */}
          {scores && (
            <MyIDFormulaDisplay scores={scores} myidScore={myidScore} />
          )}
        </>
      )}

      {/* ─── SEÇÃO 1.5: AVALIAÇÃO ESTRUTURAL (only Método Identidade) ─── */}
      {serviceType === 'identidade' && structuralData && (
        <Card className="shadow-sm overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/30 shrink-0">
                <Activity className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <h3 className="font-black text-lg text-foreground">Avaliação Estrutural</h3>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">8 Unidades Funcionais</p>
              </div>
              <div className="ml-auto text-right">
                <div className={cn('text-2xl font-black', classifyScoreColor(structuralData.scoreStructuralGeneral ?? 0))}>
                  {(structuralData.scoreStructuralGeneral ?? 0).toFixed(1)}
                </div>
                <div className="text-[9px] font-bold text-muted-foreground">{classifyScore(structuralData.scoreStructuralGeneral ?? 0)}</div>
              </div>
            </div>

            {/* Unit scores grid */}
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 mb-4">
              {UNIT_CONFIGS.map(cfg => {
                const unit = structuralData.units?.[cfg.id];
                const score = unit?.score ?? 0;
                return (
                  <div key={cfg.id} className="text-center p-1.5 rounded-lg bg-muted/40">
                    <div className="text-xs">{cfg.emoji}</div>
                    <div className={cn('text-sm font-black', classifyScoreColor(score))}>{score.toFixed(1)}</div>
                    <div className="text-[8px] text-muted-foreground font-bold">{cfg.id}</div>
                  </div>
                );
              })}
            </div>

            {/* Connection Map */}
            <StructuralConnectionMap data={structuralData} />

            {/* Gerar Diretriz de Tratamento */}
            <StructuralDiretrizButton data={structuralData} />
          </CardContent>
        </Card>
      )}

      {/* ─── SEÇÃO 2: AVALIAÇÃO ESPECÍFICA DO SERVIÇO ─── */}
      {lastServiceEntry && serviceType !== 'identidade' && (
        <Card className="shadow-sm overflow-hidden">
          <CardContent className="p-5">
            {serviceType === 'cob_zero' ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30 shrink-0">
                    <AlignCenter className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg text-foreground">COB° ZERO</h3>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Avaliação Estrutural</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-3 text-center">
                    <div className="text-3xl font-black text-blue-600">{Number(lastServiceEntry.cobb_angle || 0).toFixed(1)}°</div>
                    <div className="text-[9px] font-bold text-blue-800/60 uppercase">Ângulo Cobb</div>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3 text-center">
                    <div className="text-xl font-black">{Number(lastServiceEntry.score_e || 0).toFixed(1)}</div>
                    <div className="text-[9px] font-bold text-muted-foreground uppercase">Score E</div>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/10 rounded-xl p-3 text-center">
                    <div className="text-xl font-black text-orange-600">{Number(lastServiceEntry.risco_percentage || 0).toFixed(1)}%</div>
                    <div className="text-[9px] font-bold text-orange-800/60 uppercase">Risco</div>
                  </div>
                </div>
                {hasMyID && (
                  <p className="text-[10px] text-muted-foreground border-t pt-2">
                    <span className="font-bold">Conexão:</span> Score E estrutural ({Number(lastServiceEntry.score_e || 0).toFixed(1)}) complementa o MyID sistêmico ({myidScore.toFixed(1)}).
                    {Number(lastServiceEntry.risco_percentage) > 50 && ' ⚠️ Risco elevado — monitorar evolução do Cobb com MyID.'}
                  </p>
                )}
              </div>
            ) : serviceType === 'studio' ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30 shrink-0">
                    <Dumbbell className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg text-foreground">Studio Personal</h3>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Composição Corporal</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-xl p-3 text-center">
                    <div className="text-3xl font-black text-emerald-600">{Number(lastServiceEntry.percentual_gordura || 0).toFixed(1)}%</div>
                    <div className="text-[9px] font-bold text-emerald-800/60 uppercase">Gordura</div>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3 text-center">
                    <div className="text-xl font-black">{Number(lastServiceEntry.peso || 0).toFixed(1)}kg</div>
                    <div className="text-[9px] font-bold text-muted-foreground uppercase">Peso</div>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3 text-center">
                    <div className="text-xl font-black">{Number(lastServiceEntry.imc || 0).toFixed(1)}</div>
                    <div className="text-[9px] font-bold text-muted-foreground uppercase">IMC</div>
                  </div>
                </div>
                {hasMyID && (
                  <p className="text-[10px] text-muted-foreground border-t pt-2">
                    <span className="font-bold">Conexão:</span> AF = {scores?.AF.toFixed(1)} influencia diretamente o denominador do MyID.
                    {scores && scores.AF < 4 && ' ⚠️ Atividade física baixa — foco em progressão gradual.'}
                  </p>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* ─── SEÇÃO 3: EVOLUÇÃO GRÁFICA ─── */}
      {chartData.length >= 2 && (
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="font-bold text-sm">Evolução Clínica</h3>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} domain={[0, 10]} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line yAxisId="right" type="monotone" dataKey="myidScore" name="MyID" stroke="hsl(270,60%,55%)" strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
                  {serviceType === 'cob_zero' && (
                    <>
                      <Bar yAxisId="left" dataKey="cobb" name="Cobb°" fill="hsl(210,70%,55%)" radius={[4, 4, 0, 0]} barSize={20} />
                      <Line yAxisId="left" type="monotone" dataKey="risco" name="Risco%" stroke="#f97316" strokeWidth={1.5} dot={{ r: 3 }} connectNulls />
                    </>
                  )}
                  {serviceType === 'studio' && (
                    <>
                      <Bar yAxisId="left" dataKey="gordura" name="Gordura%" fill="hsl(150,60%,45%)" radius={[4, 4, 0, 0]} barSize={20} />
                      <Line yAxisId="left" type="monotone" dataKey="peso" name="Peso" stroke="#6366f1" strokeWidth={1.5} dot={{ r: 3 }} connectNulls />
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── SEÇÃO 4: DIRETRIZES DE TRATAMENTO ─── */}
      {hasMyID && (
        <Card className="shadow-sm border-violet-200/50">
          <CardContent className="p-0">
            <Button
              variant="ghost"
              className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-violet-50/50"
              onClick={() => setShowDiretrizes(!showDiretrizes)}
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-violet-600" />
                <span className="font-bold text-sm">Diretrizes de Tratamento</span>
              </div>
              {showDiretrizes ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>

            {showDiretrizes && (
              <div className="px-4 pb-5 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                {recommendation && (
                  <div className="bg-violet-50/50 dark:bg-violet-900/10 p-3 rounded-lg border border-violet-200/50">
                    <h4 className="text-xs font-bold text-violet-700 mb-1">🎯 Interpretação Geral</h4>
                    <p className="text-sm text-foreground">{recommendation}</p>
                  </div>
                )}

                {focusAreas?.length > 0 && (
                  <div className="bg-amber-50/50 dark:bg-amber-900/10 p-3 rounded-lg border border-amber-200/50">
                    <h4 className="text-xs font-bold text-amber-700 mb-1">🔍 Áreas de Foco</h4>
                    <ul className="text-sm space-y-1">
                      {focusAreas.map((area: string, i: number) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-amber-500 mt-0.5">•</span>
                          <span>{area}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Score-based directives */}
                {scores && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {scores.D >= 6 && (
                      <div className="bg-red-50/50 dark:bg-red-900/10 p-3 rounded-lg border border-red-200/50 text-sm">
                        <span className="font-bold text-red-700">🔴 Dor ({scores.D.toFixed(1)}):</span> Priorizar manejo da dor antes de carga funcional.
                      </div>
                    )}
                    {scores.P >= 5 && (
                      <div className="bg-amber-50/50 dark:bg-amber-900/10 p-3 rounded-lg border border-amber-200/50 text-sm">
                        <span className="font-bold text-amber-700">🟡 Psicológico ({scores.P.toFixed(1)}):</span> Educação em dor e estratégias de coping.
                      </div>
                    )}
                    {scores.R < 5 && (
                      <div className="bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-200/50 text-sm">
                        <span className="font-bold text-blue-700">💤 Regulação ({scores.R.toFixed(1)}):</span> Priorizar higiene do sono e gerenciamento de estresse.
                      </div>
                    )}
                    {scores.AF < 4 && (
                      <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-3 rounded-lg border border-emerald-200/50 text-sm">
                        <span className="font-bold text-emerald-700">💪 Atividade ({scores.AF.toFixed(1)}):</span> Iniciar com exercícios leves e progressão gradual.
                      </div>
                    )}
                    {scores.HID < 4 && (
                      <div className="bg-sky-50/50 dark:bg-sky-900/10 p-3 rounded-lg border border-sky-200/50 text-sm">
                        <span className="font-bold text-sky-700">💧 Hidratação ({scores.HID.toFixed(1)}):</span> Aumentar consumo de água para pelo menos 2L/dia.
                      </div>
                    )}
                    {scores.N >= 5 && (
                      <div className="bg-slate-100/50 dark:bg-slate-900/10 p-3 rounded-lg border border-slate-200/50 text-sm">
                        <span className="font-bold text-slate-700">⚡ Ruído ({scores.N.toFixed(1)}):</span> Investigar fatores viscerais e autonômicos.
                      </div>
                    )}
                  </div>
                )}

                {/* Service-specific connection */}
                {serviceType === 'cob_zero' && lastServiceEntry && (
                  <div className="bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-200/50 text-sm">
                    <span className="font-bold text-blue-700">🔗 COB° + MyID:</span> Cobb {Number(lastServiceEntry.cobb_angle || 0).toFixed(1)}° com MyID {myidScore.toFixed(1)}.
                    {myidScore > 4 ? ' O estado sistêmico pode estar amplificando a dor estrutural.' : ' Estado sistêmico não agrava significativamente o quadro estrutural.'}
                  </div>
                )}
                {serviceType === 'studio' && lastServiceEntry && (
                  <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-3 rounded-lg border border-emerald-200/50 text-sm">
                    <span className="font-bold text-emerald-700">🔗 Studio + MyID:</span> Composição corporal atual ({Number(lastServiceEntry.percentual_gordura || 0).toFixed(1)}% gordura) com AF de {scores?.AF.toFixed(1)}.
                    {scores && scores.AF < 5 ? ' Foco em aumento gradual de atividade antes de intensificar carga.' : ' Boa base de atividade — pode progredir normalmente.'}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Structural Treatment Guideline Generator ──────────────────────────
function StructuralDiretrizButton({ data }: { data: StructuralAssessmentData }) {
  const [guidelines, setGuidelines] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = () => {
    const lines: string[] = [];
    const date = new Date().toLocaleDateString('pt-BR');

    lines.push('═══════════════════════════════════════');
    lines.push('  DIRETRIZ DE TRATAMENTO ESTRUTURAL');
    lines.push(`  Método Identidade · ${date}`);
    lines.push('═══════════════════════════════════════');
    lines.push('');
    lines.push(`Score Geral: ${(data.scoreStructuralGeneral ?? 0).toFixed(1)}/10 — ${data.classification || 'N/A'}`);
    lines.push('');

    if (data.primaryDriver) {
      const cfg = UNIT_CONFIGS.find(u => u.id === data.primaryDriver);
      const unit = data.units?.[data.primaryDriver];
      if (cfg && unit) {
        lines.push(`⚠️ DRIVER: ${cfg.id} (${cfg.name}) — Score ${unit.score.toFixed(1)}`);
        lines.push('   Foco inicial obrigatório.');
        lines.push('');
      }
    }

    if (data.clinicalPriorities?.length > 0) {
      lines.push('─── PRIORIDADES CLÍNICAS ───');
      data.clinicalPriorities.forEach(p => {
        const cfg = UNIT_CONFIGS.find(u => u.id === p.unitId);
        lines.push(`  ${p.priority}. ${cfg?.emoji || ''} ${p.unitId} (${p.score.toFixed(1)})`);
        lines.push(`     ${p.action} · ${p.durationWeeks} sem · Meta: ${p.expectedImprovement}`);
      });
      lines.push('');
    }

    if (data.relationships?.direct?.length > 0) {
      lines.push('─── CONEXÕES ───');
      data.relationships.direct.forEach(rel => {
        const tissue = rel.affectedStructures[0]?.startsWith('TISSUE:')
          ? rel.affectedStructures[0].replace('TISSUE:', '').toUpperCase()
          : '';
        lines.push(`  ${rel.source} → ${rel.target} [${rel.severity}] ${tissue ? `(${tissue})` : ''}`);
        lines.push(`    ${rel.mechanism}`);
      });
      lines.push('');
    }

    const critical = data.clinicalPriorities.filter(p => p.score >= 8);
    const moderate = data.clinicalPriorities.filter(p => p.score >= 5 && p.score < 8);

    lines.push('─── PROTOCOLO BASEADO EM EVIDÊNCIA ───');
    lines.push('');

    if (critical.length > 0) {
      lines.push('FASE 1 — AGUDA (Sem 1-3)');
      lines.push('  Objetivo: Redução de dor e inflamação');
      critical.forEach(p => {
        const cfg = UNIT_CONFIGS.find(u => u.id === p.unitId);
        lines.push(`  ${cfg?.emoji || ''} ${p.unitId}: Liberação miofascial + mob. grau I-II`);
        lines.push('    TENS, crioterapia, isométricos · 2-3x/sem');
      });
      lines.push('');
    }

    if (moderate.length > 0) {
      lines.push('FASE 2 — SUBAGUDA (Sem 3-6)');
      lines.push('  Objetivo: Restauração de mobilidade');
      moderate.forEach(p => {
        const cfg = UNIT_CONFIGS.find(u => u.id === p.unitId);
        lines.push(`  ${cfg?.emoji || ''} ${p.unitId}: Mob. grau III-IV + estabilização`);
        lines.push('    Fortalecimento excêntrico + controle motor · 2-3x/sem');
      });
      lines.push('');
    }

    lines.push('FASE 3 — MANUTENÇÃO (Sem 6-8)');
    lines.push('  Exercícios funcionais + reeducação postural · 1-2x/sem');

    if (data.preferences) {
      lines.push('');
      lines.push('─── PREFERÊNCIAS ───');
      if (data.preferences.techniquePreference?.length) lines.push(`  Preferências: ${data.preferences.techniquePreference.join(', ')}`);
      if (data.preferences.techniqueAversion?.length) lines.push(`  Aversões: ${data.preferences.techniqueAversion.join(', ')}`);
    }

    setGuidelines(lines.join('\n'));
  };

  const handleCopy = () => {
    if (guidelines) {
      navigator.clipboard.writeText(guidelines);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    if (!guidelines) return;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(`<pre style="font-family:monospace;font-size:12px;padding:20px;white-space:pre-wrap;">${guidelines}</pre>`);
      w.document.close();
      w.print();
    }
  };

  if (!guidelines) {
    return (
      <div className="mt-4 pt-4 border-t">
        <Button className="w-full bg-gradient-primary text-white gap-2" onClick={generate}>
          <Sparkles className="h-4 w-4" />
          Gerar Diretriz de Tratamento Estrutural
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> Diretriz de Tratamento
        </h4>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleCopy}>
            <Copy className="h-3 w-3" /> {copied ? 'Copiado!' : 'Copiar'}
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handlePrint}>
            <Printer className="h-3 w-3" /> Imprimir
          </Button>
        </div>
      </div>
      <pre className="text-[10px] bg-muted/50 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
        {guidelines}
      </pre>
    </div>
  );
}
