import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  StructuralAssessmentData, UNIT_CONFIGS,
  classifyScore, classifyScoreColor, classifyScoreBg,
} from '@/types/structural';
import {
  AlertTriangle, ArrowRight, Target, TrendingDown, Zap,
  ChevronDown, ChevronUp, Clock, Heart, Shield,
} from 'lucide-react';
import StructuralConnectionMap from './StructuralConnectionMap';
import { generateRehabInsights, generateEngagementSummary, RehabInsight, TISSUE_TIMELINES } from '@/utils/tissueHealingTimelines';

interface Props {
  data: StructuralAssessmentData;
  pacienteId?: string;
  terapeutaId?: string;
  pacienteNome?: string;
  readOnly?: boolean;
  onNavigateDiretrizes?: () => void;
}

// ── Component ─────────────────────────────────────────
export default function StructuralResultsSummary({ data, pacienteId, terapeutaId, pacienteNome, readOnly, onNavigateDiretrizes }: Props) {
  const [openRehabDetails, setOpenRehabDetails] = useState<Set<number>>(new Set());

  const rehabInsights = generateRehabInsights(data.units);

  const driverConfig = data.primaryDriver ? UNIT_CONFIGS.find(u => u.id === data.primaryDriver) : null;
  const driverUnit = data.primaryDriver ? data.units[data.primaryDriver] : null;

  return (
    <div className="space-y-4">
      {/* Header Score */}
      <div className="clinical-card bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Score Estrutural Geral</h2>
          <div className={cn('text-5xl font-black', classifyScoreColor(data.scoreStructuralGeneral))}>
            {data.scoreStructuralGeneral.toFixed(1)}<span className="text-lg text-muted-foreground">/10</span>
          </div>
          <Badge className={cn('mt-2', classifyScoreBg(data.scoreStructuralGeneral))}>
            {data.classification}
          </Badge>
          <p className="text-[10px] text-muted-foreground mt-1">0 = Sem Alteração · 10 = Crítico</p>
        </div>
      </div>

      {/* Unit Scores */}
      <div className="clinical-card">
        <h3 className="font-semibold text-sm mb-3">8 Unidades Funcionais</h3>
        <div className="space-y-2">
          {UNIT_CONFIGS.map(cfg => {
            const unit = data.units[cfg.id]; if (!unit) return null;
            const pct = (unit.score / 10) * 100;
            return (
              <div key={cfg.id} className="flex items-center gap-3">
                <span className="text-sm w-6">{cfg.emoji}</span>
                <span className="text-xs font-medium w-24 truncate">{cfg.id}: {cfg.shortName}</span>
                <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full',
                    unit.score <= 2 ? 'bg-emerald-500' : unit.score <= 4 ? 'bg-green-400' :
                      unit.score <= 6 ? 'bg-amber-500' : unit.score <= 8 ? 'bg-orange-500' : 'bg-red-500'
                  )} style={{ width: `${pct}%` }} />
                </div>
                <span className={cn('text-sm font-bold w-12 text-right', classifyScoreColor(unit.score))}>{unit.score.toFixed(1)}</span>
                <Badge variant="outline" className={cn('text-[9px] w-24 justify-center', classifyScoreBg(unit.score))}>{unit.classification}</Badge>
              </div>
            );
          })}
        </div>
      </div>

      {/* Connection Map */}
      <StructuralConnectionMap data={data} />

      {/* Driver */}
      {driverConfig && driverUnit && (
        <div className="clinical-card border-red-200 bg-red-50/50">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-5 w-5 text-red-600" />
            <h3 className="font-bold text-sm text-red-800">Driver Primário</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{driverConfig.emoji}</span>
            <div>
              <div className="font-bold">{driverConfig.id} ({driverConfig.shortName})</div>
              <div className={cn('text-2xl font-black', classifyScoreColor(driverUnit.score))}>{driverUnit.score.toFixed(1)}/10</div>
            </div>
          </div>
        </div>
      )}

      {/* Clinical Priorities */}
      {data.clinicalPriorities.length > 0 && (
        <div className="clinical-card">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <h3 className="font-semibold text-sm">Prioridades Clínicas</h3>
          </div>
          <div className="space-y-2">
            {data.clinicalPriorities.map(p => {
              const cfg = UNIT_CONFIGS.find(u => u.id === p.unitId);
              return (
                <div key={p.unitId} className="flex items-start gap-3 p-2 rounded-lg border bg-muted/30">
                  <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">{p.priority}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{cfg?.emoji}</span>
                      <span className="font-semibold text-sm">{p.unitId}</span>
                      <span className={cn('text-sm font-bold', classifyScoreColor(p.score))}>{p.score.toFixed(1)}/10</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.action} · {p.durationWeeks} sem · {p.expectedImprovement}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ REHAB TIMELINE — EVIDENCE-BASED ═══ */}
      {rehabInsights.length > 0 && (
        <div className="clinical-card border-primary/20 bg-gradient-to-br from-card to-primary/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
              <Clock className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Tempo de Reabilitação — Baseado em Evidência</h3>
              <p className="text-[10px] text-muted-foreground">Cada tecido tem seu relógio biológico. Respeitar esse tempo é a chave da recuperação.</p>
            </div>
          </div>

          {/* Alert for articular/ligament structures */}
          {rehabInsights.some(i => i.category === 'Articular' || i.category === 'Ligamentar') && (
            <div className="p-3 rounded-xl border-2 border-destructive/30 bg-destructive/5 mb-4">
              <div className="flex items-start gap-2">
                <Shield className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-destructive">⚠️ Estruturas com cicatrização lenta identificadas</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Articulações e ligamentos têm tempos de recuperação <strong>significativamente maiores</strong> que músculos. 
                    O alívio da dor <strong>NÃO significa</strong> que o tecido está curado — o processo biológico continua 
                    mesmo quando os sintomas melhoram. Abandonar a reabilitação precocemente é a principal causa de recidiva.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Timeline overview bar */}
          <div className="mb-4 p-3 rounded-xl bg-muted/50 border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground">VISÃO GERAL DO TEMPO</span>
              <span className="text-xs text-muted-foreground">
                {rehabInsights[rehabInsights.length - 1]?.minWeeks || 0}–{rehabInsights[0]?.maxWeeks || 0} semanas total
              </span>
            </div>
            <div className="space-y-2">
              {rehabInsights.map((insight, idx) => {
                const maxAll = rehabInsights[0]?.maxWeeks || 1;
                const barWidth = (insight.maxWeeks / maxAll) * 100;
                const barStart = (insight.minWeeks / maxAll) * 100;
                const colorMap: Record<string, string> = {
                  emerald: 'bg-emerald-500',
                  amber: 'bg-amber-500',
                  orange: 'bg-orange-500',
                  red: 'bg-red-500',
                  purple: 'bg-purple-500',
                  blue: 'bg-blue-500',
                };
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-sm w-6 shrink-0">{insight.icon}</span>
                    <span className="text-[10px] font-medium w-20 truncate shrink-0">{insight.tissue}</span>
                    <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden relative">
                      <div
                        className={cn('h-full rounded-full absolute', colorMap[insight.color] || 'bg-primary')}
                        style={{ left: `${barStart}%`, width: `${barWidth - barStart}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold w-20 text-right shrink-0">
                      {insight.minWeeks}–{insight.maxWeeks} sem
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detailed insights per tissue */}
          <div className="space-y-2">
            {rehabInsights.map((insight, idx) => {
              const isOpen = openRehabDetails.has(idx);
              const colorMap: Record<string, { bg: string; border: string; text: string; badge: string }> = {
                emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-500' },
                amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-500' },
                orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-500' },
                red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-500' },
                purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-500' },
                blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-500' },
              };
              const col = colorMap[insight.color] || colorMap.blue;

              return (
                <div key={idx} className={cn('rounded-xl border-2 overflow-hidden', col.border)}>
                  <button
                    className={cn('w-full flex items-center justify-between p-3', col.bg, 'text-left')}
                    onClick={() => setOpenRehabDetails(prev => {
                      const s = new Set(prev);
                      if (s.has(idx)) s.delete(idx); else s.add(idx);
                      return s;
                    })}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{insight.icon}</span>
                      <div>
                        <div className={cn('font-semibold text-sm', col.text)}>
                          {insight.tissue} — {insight.severity}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {insight.structures.join(', ')} · {insight.unitId}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={cn('text-[10px] text-white', col.badge)}>
                        {insight.minWeeks}–{insight.maxWeeks} semanas
                      </Badge>
                      {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="p-3 space-y-3 bg-background">
                      {/* Patient engagement message */}
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <div className="flex items-start gap-2">
                          <Heart className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <p className="text-xs leading-relaxed text-foreground">{insight.patientMessage}</p>
                        </div>
                      </div>
                      
                      {/* Healing phases timeline */}
                      <div>
                        <h5 className="text-xs font-semibold mb-2 text-muted-foreground">FASES DE CICATRIZAÇÃO</h5>
                        <div className="space-y-1.5">
                          {insight.phases.map((phase, pi) => (
                            <div key={pi} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30">
                              <div className={cn('w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0', col.badge)}>
                                {pi + 1}
                              </div>
                              <div>
                                <div className="text-xs font-medium">{phase.name} <span className="text-muted-foreground">· Sem {phase.weeks}</span></div>
                                <p className="text-[10px] text-muted-foreground">{phase.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Evidence reference */}
                      <div className="p-2 rounded-lg bg-muted/30 border border-dashed">
                        <p className="text-[9px] text-muted-foreground italic">📖 {insight.evidenceNote}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Global engagement message */}
          <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <Heart className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-foreground mb-1">Por que cada sessão importa?</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  A reabilitação é um investimento no seu corpo. Cada tecido tem seu próprio relógio biológico — 
                  <strong> respeitar esse tempo é a diferença entre uma recuperação completa e uma recidiva</strong>. 
                  {rehabInsights.some(i => i.category === 'Articular') && (
                    <> Especialmente para tecidos articulares, o tratamento consistente é a única forma comprovada de estimular o reparo biológico.</>
                  )}
                  {rehabInsights.some(i => i.category === 'Ligamentar') && (
                    <> Para ligamentos, o fortalecimento muscular ao redor da articulação se torna seu principal mecanismo de proteção a longo prazo.</>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ NAVEGAÇÃO PARA DIRETRIZES ═══ */}
      <div className="clinical-card border-primary/30">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
            <Target className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Diretrizes de Tratamento</h3>
            <p className="text-[10px] text-muted-foreground">Monte a diretriz completa com técnicas e exercícios na aba dedicada</p>
          </div>
        </div>
        <Button
          className="w-full bg-gradient-to-r from-primary to-primary/80 text-primary-foreground gap-2"
          onClick={onNavigateDiretrizes}
        >
          <Target className="h-4 w-4" />
          Ir para Diretrizes e Tratamento
        </Button>
      </div>
    </div>
  );
}
