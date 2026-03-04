import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  StructuralAssessmentData, UNIT_CONFIGS,
  classifyScore, classifyScoreColor, classifyScoreBg,
} from '@/types/structural';
import { AlertTriangle, ArrowRight, Target, TrendingDown, Zap } from 'lucide-react';

interface Props {
  data: StructuralAssessmentData;
}

export default function StructuralResultsSummary({ data }: Props) {
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
        </div>
      </div>

      {/* Unit Scores Grid */}
      <div className="clinical-card">
        <h3 className="font-semibold text-sm mb-3">8 Unidades Funcionais</h3>
        <div className="space-y-2">
          {UNIT_CONFIGS.map(cfg => {
            const unit = data.units[cfg.id];
            if (!unit) return null;
            const pct = (unit.score / 10) * 100;
            return (
              <div key={cfg.id} className="flex items-center gap-3">
                <span className="text-sm w-6">{cfg.emoji}</span>
                <span className="text-xs font-medium w-24 truncate">{cfg.id}: {cfg.shortName}</span>
                <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all',
                      unit.score >= 8 ? 'bg-emerald-500' :
                      unit.score >= 6 ? 'bg-amber-500' :
                      unit.score >= 4 ? 'bg-orange-500' : 'bg-red-500'
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className={cn('text-sm font-bold w-12 text-right', classifyScoreColor(unit.score))}>
                  {unit.score.toFixed(1)}
                </span>
                <Badge variant="outline" className={cn('text-[9px] w-20 justify-center', classifyScoreBg(unit.score))}>
                  {unit.classification}
                </Badge>
              </div>
            );
          })}
        </div>
      </div>

      {/* Primary Driver */}
      {driverConfig && driverUnit && (
        <div className="clinical-card border-red-200 bg-red-50/50">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-5 w-5 text-red-600" />
            <h3 className="font-bold text-sm text-red-800">Driver Primário Identificado</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{driverConfig.emoji}</span>
            <div>
              <div className="font-bold">{driverConfig.id} ({driverConfig.shortName})</div>
              <div className={cn('text-2xl font-black', classifyScoreColor(driverUnit.score))}>
                {driverUnit.score.toFixed(1)}/10
              </div>
            </div>
          </div>
          {driverUnit.observacoes && (
            <p className="text-sm text-muted-foreground mt-2">{driverUnit.observacoes}</p>
          )}
        </div>
      )}

      {/* Direct Relationships */}
      {data.relationships.direct.length > 0 && (
        <div className="clinical-card">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Relações Estruturais Diretas</h3>
          </div>
          <div className="space-y-2">
            {data.relationships.direct.map((rel, i) => (
              <div key={i} className="p-2 rounded-lg bg-muted/50 border text-xs">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-[9px]">{rel.source}</Badge>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Badge variant="outline" className="text-[9px]">{rel.target}</Badge>
                  <Badge className={cn('text-[9px] ml-auto',
                    rel.severity === 'SEVERA' ? 'bg-red-100 text-red-700 border-red-200' :
                    rel.severity === 'MODERADA' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                    'bg-green-100 text-green-700 border-green-200'
                  )}>{rel.severity}</Badge>
                </div>
                <p className="text-muted-foreground">{rel.mechanism}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Indirect Relationships */}
      {data.relationships.indirect.length > 0 && (
        <div className="clinical-card">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="h-4 w-4 text-amber-600" />
            <h3 className="font-semibold text-sm">Relações Indiretas</h3>
          </div>
          <div className="space-y-2">
            {data.relationships.indirect.map((rel, i) => (
              <div key={i} className="p-2 rounded-lg bg-muted/50 border text-xs">
                <div className="flex items-center gap-1 mb-1">
                  <Badge variant="outline" className="text-[9px]">{rel.source}</Badge>
                  <ArrowRight className="h-3 w-3" />
                  <Badge variant="outline" className="text-[9px]">{rel.intermediate}</Badge>
                  <ArrowRight className="h-3 w-3" />
                  <Badge variant="outline" className="text-[9px]">{rel.target}</Badge>
                </div>
                <p className="text-muted-foreground">{rel.mechanism}</p>
              </div>
            ))}
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
                  <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                    {p.priority}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{cfg?.emoji}</span>
                      <span className="font-semibold text-sm">{p.unitId}</span>
                      <span className={cn('text-sm font-bold', classifyScoreColor(p.score))}>{p.score.toFixed(1)}/10</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.action}</p>
                    <p className="text-xs text-muted-foreground">Duração: {p.durationWeeks} semanas · Meta: {p.expectedImprovement}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Affected Structures Summary */}
      <div className="clinical-card">
        <h3 className="font-semibold text-sm mb-3">Estruturas Acometidas (Global)</h3>
        {(['muscles', 'joints', 'ligaments', 'nerves', 'viscera'] as const).map(cat => {
          const allStructures = Object.values(data.units).flatMap(u => u.affectedStructures[cat]);
          const unique = [...new Map(allStructures.map(s => [s.name, s])).values()];
          if (unique.length === 0) return null;
          const labels: Record<string, string> = { muscles: '💪 Músculos', joints: '🦴 Articulações', ligaments: '🔗 Ligamentos', nerves: '⚡ Nervos', viscera: '🫀 Vísceras' };
          return (
            <div key={cat} className="mb-2">
              <span className="text-xs font-semibold">{labels[cat]}</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {unique.map(s => (
                  <Badge key={s.name} variant="outline" className={cn('text-[10px]',
                    s.severity === 'SEVERA' ? 'border-red-300 text-red-700' :
                    s.severity === 'MODERADA' ? 'border-amber-300 text-amber-700' :
                    'border-green-300 text-green-700'
                  )}>
                    {s.name} ({s.severity})
                  </Badge>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
