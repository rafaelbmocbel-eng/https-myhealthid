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
  FileText, Sparkles, Printer,
} from 'lucide-react';
import StructuralConnectionMap from './StructuralConnectionMap';

interface Props {
  data: StructuralAssessmentData;
}

function generateTreatmentGuidelines(data: StructuralAssessmentData): string {
  const lines: string[] = [];
  const date = new Date().toLocaleDateString('pt-BR');

  lines.push('═══════════════════════════════════════');
  lines.push('  DIRETRIZ DE TRATAMENTO – MÉTODO IDENTIDADE');
  lines.push(`  Data: ${date}`);
  lines.push('═══════════════════════════════════════');
  lines.push('');
  lines.push(`Score Estrutural Geral: ${data.scoreStructuralGeneral.toFixed(1)}/10 — ${data.classification}`);
  lines.push('');

  // Driver
  if (data.primaryDriver) {
    const cfg = UNIT_CONFIGS.find(u => u.id === data.primaryDriver);
    const unit = data.units[data.primaryDriver];
    if (cfg && unit) {
      lines.push(`⚠️ DRIVER PRIMÁRIO: ${cfg.id} (${cfg.name}) — Score ${unit.score.toFixed(1)}`);
      lines.push(`   Foco inicial obrigatório nesta unidade antes de tratar unidades secundárias.`);
      lines.push('');
    }
  }

  // Priorities
  if (data.clinicalPriorities.length > 0) {
    lines.push('─── PRIORIDADES CLÍNICAS ───');
    data.clinicalPriorities.forEach(p => {
      const cfg = UNIT_CONFIGS.find(u => u.id === p.unitId);
      lines.push(`  ${p.priority}. ${cfg?.emoji || ''} ${p.unitId} (Score ${p.score.toFixed(1)})`);
      lines.push(`     Ação: ${p.action}`);
      lines.push(`     Duração: ${p.durationWeeks} semanas | Meta: ${p.expectedImprovement}`);
    });
    lines.push('');
  }

  // Relationships & Chains
  if (data.relationships.direct.length > 0) {
    lines.push('─── CONEXÕES DIRETAS (Tecidos Comprometidos) ───');
    data.relationships.direct.forEach(rel => {
      lines.push(`  ${rel.source} → ${rel.target} [${rel.severity}]`);
      lines.push(`    Mecanismo: ${rel.mechanism}`);
      if (rel.affectedStructures.length > 0) {
        lines.push(`    Estruturas: ${rel.affectedStructures.join(', ')}`);
      }
    });
    lines.push('');
  }

  if (data.relationships.indirect.length > 0) {
    lines.push('─── CONEXÕES INDIRETAS (Cadeias de Disfunção) ───');
    data.relationships.indirect.forEach(rel => {
      lines.push(`  ${rel.source} ⟶ ${rel.intermediate} ⟶ ${rel.target} [${rel.severity}]`);
      lines.push(`    Cadeia: ${rel.mechanism}`);
    });
    lines.push('');
  }

  // Affected Structures
  const categories = ['muscles', 'joints', 'ligaments', 'nerves', 'viscera'] as const;
  const catLabels: Record<string, string> = {
    muscles: 'MÚSCULOS', joints: 'ARTICULAÇÕES', ligaments: 'LIGAMENTOS',
    nerves: 'NERVOS', viscera: 'VÍSCERAS',
  };

  lines.push('─── ESTRUTURAS ACOMETIDAS ───');
  for (const cat of categories) {
    const all = Object.values(data.units).flatMap(u => u.affectedStructures[cat]);
    const unique = [...new Map(all.map(s => [s.name, s])).values()];
    if (unique.length > 0) {
      lines.push(`  ${catLabels[cat]}:`);
      unique.forEach(s => lines.push(`    • ${s.name} (${s.severity})${s.finding ? ` — ${s.finding}` : ''}`));
    }
  }
  lines.push('');

  // Evidence-based Protocol
  lines.push('─── PROTOCOLO DE TRATAMENTO BASEADO EM EVIDÊNCIA ───');
  lines.push('');

  // Phase 1: Acute management
  const criticalUnits = data.clinicalPriorities.filter(p => p.score >= 8);
  const moderateUnits = data.clinicalPriorities.filter(p => p.score >= 5 && p.score < 8);
  const mildUnits = data.clinicalPriorities.filter(p => p.score >= 3 && p.score < 5);

  if (criticalUnits.length > 0) {
    lines.push('  FASE 1 — AGUDA (Semanas 1-3)');
    lines.push('  Objetivo: Redução de dor e inflamação');
    criticalUnits.forEach(p => {
      const cfg = UNIT_CONFIGS.find(u => u.id === p.unitId);
      lines.push(`    ${cfg?.emoji || ''} ${p.unitId}:`);
      lines.push('      • Terapia manual: Liberação miofascial + mobilização articular grau I-II');
      lines.push('      • Modalidades: Crioterapia, TENS, US pulsado (evidência B)');
      lines.push('      • Exercícios: Isométricos leves, respiratórios, controle motor');
      lines.push('      • Frequência: 2-3x/semana');
    });
    lines.push('');
  }

  if (moderateUnits.length > 0) {
    lines.push('  FASE 2 — SUBAGUDA (Semanas 3-6)');
    lines.push('  Objetivo: Restauração de mobilidade e estabilização');
    moderateUnits.forEach(p => {
      const cfg = UNIT_CONFIGS.find(u => u.id === p.unitId);
      lines.push(`    ${cfg?.emoji || ''} ${p.unitId}:`);
      lines.push('      • Terapia manual: Mobilização grau III-IV, MET, técnicas neurodinâmicas');
      lines.push('      • Exercícios: Estabilização segmentar, propriocepção, fortalecimento excêntrico');
      lines.push('      • Progressão: Aumento gradual de carga conforme tolerância');
      lines.push('      • Frequência: 2x/semana');
    });
    lines.push('');
  }

  if (mildUnits.length > 0) {
    lines.push('  FASE 3 — MANUTENÇÃO (Semanas 6-8)');
    lines.push('  Objetivo: Prevenção de recidivas e otimização funcional');
    mildUnits.forEach(p => {
      const cfg = UNIT_CONFIGS.find(u => u.id === p.unitId);
      lines.push(`    ${cfg?.emoji || ''} ${p.unitId}:`);
      lines.push('      • Exercícios funcionais e sport-specific');
      lines.push('      • Reeducação postural global');
      lines.push('      • Autogerenciamento: HEP (Home Exercise Program)');
      lines.push('      • Frequência: 1x/semana → alta com reavaliação em 4 semanas');
    });
    lines.push('');
  }

  // Preferences
  if (data.preferences.techniquePreference.length > 0) {
    lines.push('─── PREFERÊNCIAS DO PACIENTE ───');
    lines.push(`  Técnicas preferidas: ${data.preferences.techniquePreference.join(', ')}`);
    if (data.preferences.techniqueAversion.length > 0) {
      lines.push(`  Aversões: ${data.preferences.techniqueAversion.join(', ')}`);
    }
    lines.push(`  Tolerância à dor: ${data.preferences.painTolerance}/10`);
    if (data.preferences.additionalNotes) {
      lines.push(`  Obs: ${data.preferences.additionalNotes}`);
    }
    lines.push('');
  }

  lines.push('═══════════════════════════════════════');
  lines.push('  Gerado pelo Sistema Método Identidade');
  lines.push('  MyHealth ID — Avaliação Estrutural');
  lines.push('═══════════════════════════════════════');

  return lines.join('\n');
}

export default function StructuralResultsSummary({ data }: Props) {
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [guidelines, setGuidelines] = useState('');

  const driverConfig = data.primaryDriver ? UNIT_CONFIGS.find(u => u.id === data.primaryDriver) : null;
  const driverUnit = data.primaryDriver ? data.units[data.primaryDriver] : null;

  const handleGenerateGuidelines = () => {
    const text = generateTreatmentGuidelines(data);
    setGuidelines(text);
    setShowGuidelines(true);
  };

  const handleCopyGuidelines = () => {
    navigator.clipboard.writeText(guidelines);
  };

  const handlePrintGuidelines = () => {
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(`<pre style="font-family:monospace;font-size:12px;white-space:pre-wrap;padding:30px;">${guidelines}</pre>`);
      w.document.close();
      w.print();
    }
  };

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
                      unit.score <= 2 ? 'bg-emerald-500' :
                        unit.score <= 4 ? 'bg-green-400' :
                          unit.score <= 6 ? 'bg-amber-500' :
                            unit.score <= 8 ? 'bg-orange-500' : 'bg-red-500'
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className={cn('text-sm font-bold w-12 text-right', classifyScoreColor(unit.score))}>
                  {unit.score.toFixed(1)}
                </span>
                <Badge variant="outline" className={cn('text-[9px] w-24 justify-center', classifyScoreBg(unit.score))}>
                  {unit.classification}
                </Badge>
              </div>
            );
          })}
        </div>
      </div>

      {/* Connection Map */}
      <StructuralConnectionMap data={data} />

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
                {rel.affectedStructures.length > 0 && (
                  <p className="text-primary font-medium mt-1">Tecidos: {rel.affectedStructures.join(', ')}</p>
                )}
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
            <h3 className="font-semibold text-sm">Cadeias de Disfunção (Indiretas)</h3>
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

      {/* ═══ GENERATE TREATMENT GUIDELINES BUTTON ═══ */}
      <div className="clinical-card border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Diretriz de Tratamento</h3>
            <p className="text-[10px] text-muted-foreground">Baseada em evidência e no Método Identidade</p>
          </div>
        </div>

        {!showGuidelines ? (
          <Button
            className="w-full bg-gradient-to-r from-primary to-primary/80 text-primary-foreground gap-2"
            onClick={handleGenerateGuidelines}
          >
            <Sparkles className="h-4 w-4" />
            Gerar Diretriz de Tratamento
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopyGuidelines} className="gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Copiar
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrintGuidelines} className="gap-1.5">
                <Printer className="h-3.5 w-3.5" /> Imprimir
              </Button>
            </div>
            <pre className="text-[10px] leading-relaxed p-4 bg-card rounded-lg border overflow-x-auto whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
              {guidelines}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
