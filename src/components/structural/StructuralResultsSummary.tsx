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
  FileText, Sparkles, Printer, Check, Dumbbell, Brain,
  ChevronDown, ChevronUp, Copy, Clock, Heart, Shield,
} from 'lucide-react';
import StructuralConnectionMap from './StructuralConnectionMap';
import { generateRehabInsights, RehabInsight, TISSUE_TIMELINES } from '@/utils/tissueHealingTimelines';

interface Props {
  data: StructuralAssessmentData;
}

// ── Evidence-based Techniques Menu ────────────────────────────────────
interface Technique { nome: string; categoria: string; descricao: string; evidencia: string; duracao: string; }
interface Exercise { nome: string; categoria: string; descricao: string; series: string; repeticoes: string; motivo: string; }

interface Phase {
  titulo: string;
  semanas: string;
  objetivo: string;
  frequencia: string;
  tecnicas: Technique[];
  exercicios: Exercise[];
}

function buildPhases(data: StructuralAssessmentData): Phase[] {
  const critical = data.clinicalPriorities.filter(p => p.score >= 8);
  const moderate = data.clinicalPriorities.filter(p => p.score >= 5 && p.score < 8);
  const mild = data.clinicalPriorities.filter(p => p.score >= 3 && p.score < 5);
  const phases: Phase[] = [];

  // Phase 1: Acute
  if (critical.length > 0 || data.clinicalPriorities.some(p => p.score >= 7)) {
    phases.push({
      titulo: 'Fase 1 — Aguda',
      semanas: '1-3',
      objetivo: 'Redução de dor, edema e proteção tecidual',
      frequencia: '2-3x/semana',
      tecnicas: [
        { nome: 'Liberação Miofascial', categoria: 'Terapia Manual', descricao: 'Liberação de aderências e trigger points nos tecidos restritos', evidencia: 'Nível A', duracao: '10-15 min' },
        { nome: 'Mobilização Articular Grau I-II', categoria: 'Terapia Manual', descricao: 'Mobilização oscilatória dentro da amplitude livre para modulação de dor', evidencia: 'Nível A', duracao: '5-10 min' },
        { nome: 'TENS', categoria: 'Eletroterapia', descricao: 'Estimulação elétrica transcutânea para controle álgico via gate control', evidencia: 'Nível B', duracao: '20-30 min' },
        { nome: 'Crioterapia', categoria: 'Termoterapia', descricao: 'Aplicação de frio para vasoconstrição e redução de edema', evidencia: 'Nível B', duracao: '10-15 min' },
        { nome: 'Dry Needling', categoria: 'Terapia Manual', descricao: 'Agulhamento seco em trigger points ativos para desativação neural', evidencia: 'Nível B', duracao: '5-10 min' },
        { nome: 'Respiração Diafragmática', categoria: 'Controle Motor', descricao: 'Reeducação do padrão respiratório para regulação autonômica', evidencia: 'Nível A', duracao: '5 min' },
      ],
      exercicios: [
        { nome: 'Isométricos Segmentares', categoria: 'Estabilização', descricao: 'Contrações isométricas das unidades comprometidas', series: '3', repeticoes: '10x 10s', motivo: 'Ativação muscular sem carga articular para manter controle motor' },
        { nome: 'Ativação de Core/Multífido', categoria: 'Controle Motor', descricao: 'Ativação do multífido e transverso em posição neutra', series: '3', repeticoes: '10x 8s', motivo: 'Estabilização segmentar profunda — evidência nível A para lombalgia' },
        { nome: 'Mobilidade Neural', categoria: 'Neurodinâmica', descricao: 'Deslizamento neural (sliders) para nervos comprometidos', series: '2', repeticoes: '15x', motivo: 'Restauração da mobilidade neural sem tensionamento agressivo' },
        { nome: 'Respiratórios', categoria: 'Controle Motor', descricao: 'Padrão diafragmático + expiração ativa com ativação de zona de aposição', series: '3', repeticoes: '8x', motivo: 'Regulação do sistema nervoso autônomo e estabilização do core' },
      ],
    });
  }

  // Phase 2: Subacute
  if (moderate.length > 0 || critical.length > 0) {
    phases.push({
      titulo: 'Fase 2 — Subaguda',
      semanas: '3-6',
      objetivo: 'Restauração de mobilidade, estabilização ativa e controle motor',
      frequencia: '2-3x/semana',
      tecnicas: [
        { nome: 'Mobilização Grau III-IV', categoria: 'Terapia Manual', descricao: 'Mobilização oscilatória até o end-feel para restaurar amplitude', evidencia: 'Nível A', duracao: '5-10 min' },
        { nome: 'Técnica de Energia Muscular (MET)', categoria: 'Terapia Manual', descricao: 'Contração isométrica contra resistência para restauração articular', evidencia: 'Nível B', duracao: '5-8 min' },
        { nome: 'Neurodinâmica (Tensioners)', categoria: 'Terapia Manual', descricao: 'Tensionamento neural progressivo para restauração de mobilidade neural', evidencia: 'Nível B', duracao: '5 min' },
        { nome: 'Manipulação HVLA', categoria: 'Terapia Manual', descricao: 'Thrust de alta velocidade e baixa amplitude em segmentos hipomóveis', evidencia: 'Nível A', duracao: '2-3 min' },
        { nome: 'Terapia Visceral', categoria: 'Terapia Manual', descricao: 'Mobilização visceral para restauração de mobilidade fascial visceral', evidencia: 'Nível C', duracao: '10 min' },
        { nome: 'Liberação Diafragmática', categoria: 'Terapia Manual', descricao: 'Técnicas de liberação do diafragma e pilares diafragmáticos', evidencia: 'Nível B', duracao: '5-8 min' },
      ],
      exercicios: [
        { nome: 'Estabilização Dinâmica', categoria: 'Fortalecimento', descricao: 'Exercícios de estabilização com perturbação controlada', series: '3', repeticoes: '12x', motivo: 'Transição da estabilização estática para dinâmica — preparação funcional' },
        { nome: 'Fortalecimento Excêntrico', categoria: 'Fortalecimento', descricao: 'Contrações excêntricas dos grupos musculares comprometidos', series: '3', repeticoes: '10x', motivo: 'Remodelamento tecidual e aumento de resistência mecânica' },
        { nome: 'Propriocepção', categoria: 'Sensório-motor', descricao: 'Treinamento proprioceptivo em superfícies instáveis', series: '3', repeticoes: '30-60s', motivo: 'Reconexão sensório-motora pós-lesão' },
        { nome: 'Flexibilidade Ativa', categoria: 'Mobilidade', descricao: 'Alongamento ativo das cadeias encurtadas identificadas', series: '3', repeticoes: '30s hold', motivo: 'Restauração do comprimento muscular funcional' },
        { nome: 'Cadeia Cinética Integrada', categoria: 'Funcional', descricao: 'Exercícios em padrão funcional integrando múltiplas unidades', series: '2', repeticoes: '10x', motivo: 'Integração inter-unitária das conexões identificadas no mapa' },
      ],
    });
  }

  // Phase 3: Maintenance/Functional
  phases.push({
    titulo: 'Fase 3 — Manutenção/Funcional',
    semanas: '6-8+',
    objetivo: 'Reeducação funcional, prevenção de recidivas e alta progressiva',
    frequencia: '1-2x/semana → HEP',
    tecnicas: [
      { nome: 'Reeducação Postural Global (RPG)', categoria: 'Cadeias Musculares', descricao: 'Posturas globais para reequilíbrio das cadeias musculares', evidencia: 'Nível B', duracao: '15-20 min' },
      { nome: 'Pilates Clínico', categoria: 'Controle Motor', descricao: 'Exercícios de controle motor com foco nas unidades comprometidas', evidencia: 'Nível A', duracao: '30 min' },
      { nome: 'Taping Funcional', categoria: 'Complementar', descricao: 'Bandagem funcional para feedback proprioceptivo durante atividades', evidencia: 'Nível C', duracao: '5 min' },
    ],
    exercicios: [
      { nome: 'Exercícios Funcionais Sport-Specific', categoria: 'Funcional', descricao: 'Treinamento funcional adaptado às atividades do paciente', series: '3', repeticoes: '10-15x', motivo: 'Transferência funcional para atividades diárias e esportivas' },
      { nome: 'HEP (Home Exercise Program)', categoria: 'Auto-gerenciamento', descricao: 'Programa domiciliar personalizado com 4-6 exercícios-chave', series: '2', repeticoes: '10x', motivo: 'Autonomia e manutenção dos ganhos pós-alta' },
      { nome: 'Treino de Consciência Corporal', categoria: 'Educação', descricao: 'Exercícios de percepção corporal e automonitoramento', series: '1', repeticoes: '5 min', motivo: 'Prevenção de recidivas por melhora da percepção proprioceptiva' },
    ],
  });

  return phases;
}

// ── Fancy color by phase index ─────────────────────────────────────────
const PHASE_COLORS = [
  { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-500' },
  { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-500' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-500' },
];

export default function StructuralResultsSummary({ data }: Props) {
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [guidelines, setGuidelines] = useState('');
  const [copied, setCopied] = useState(false);
  const [openPhases, setOpenPhases] = useState<Set<number>>(new Set([0]));
  const [openRehabDetails, setOpenRehabDetails] = useState<Set<number>>(new Set());

  const phases = buildPhases(data);
  const rehabInsights = generateRehabInsights(data.units);

  // Selection state — starts empty, therapist picks what they want
  const [selectedTecnicas, setSelectedTecnicas] = useState<Record<number, Set<number>>>(() => {
    const init: Record<number, Set<number>> = {};
    phases.forEach((_, i) => { init[i] = new Set(); });
    return init;
  });
  const [selectedExercicios, setSelectedExercicios] = useState<Record<number, Set<number>>>(() => {
    const init: Record<number, Set<number>> = {};
    phases.forEach((_, i) => { init[i] = new Set(); });
    return init;
  });

  const togglePhase = (i: number) => {
    setOpenPhases(prev => { const s = new Set(prev); if (s.has(i)) s.delete(i); else s.add(i); return s; });
  };
  const toggleTec = (p: number, t: number) => {
    setSelectedTecnicas(prev => { const s = new Set(prev[p] || []); if (s.has(t)) s.delete(t); else s.add(t); return { ...prev, [p]: s }; });
  };
  const toggleEx = (p: number, e: number) => {
    setSelectedExercicios(prev => { const s = new Set(prev[p] || []); if (s.has(e)) s.delete(e); else s.add(e); return { ...prev, [p]: s }; });
  };

  const driverConfig = data.primaryDriver ? UNIT_CONFIGS.find(u => u.id === data.primaryDriver) : null;
  const driverUnit = data.primaryDriver ? data.units[data.primaryDriver] : null;

  const handleGenerateGuidelines = () => {
    const lines: string[] = [];
    const date = new Date().toLocaleDateString('pt-BR');
    lines.push('═══════════════════════════════════════');
    lines.push('  DIRETRIZ ESTRUTURAL — MÉTODO IDENTIDADE');
    lines.push(`  Data: ${date}`);
    lines.push('═══════════════════════════════════════');
    lines.push('');
    lines.push(`Score Geral: ${data.scoreStructuralGeneral.toFixed(1)}/10 — ${data.classification}`);
    lines.push('');
    if (data.primaryDriver) {
      const cfg = UNIT_CONFIGS.find(u => u.id === data.primaryDriver);
      const unit = data.units[data.primaryDriver];
      if (cfg && unit) lines.push(`⚠️ DRIVER: ${cfg.id} (${cfg.name}) — ${unit.score.toFixed(1)}\n`);
    }
    // Include selected techniques/exercises per phase
    phases.forEach((phase, pi) => {
      lines.push(`─── ${phase.titulo.toUpperCase()} (Sem ${phase.semanas}) ───`);
      lines.push(`Objetivo: ${phase.objetivo}`);
      lines.push(`Frequência: ${phase.frequencia}\n`);
      const selTec = selectedTecnicas[pi] || new Set();
      const selEx = selectedExercicios[pi] || new Set();
      if (selTec.size > 0) {
        lines.push('TÉCNICAS:');
        phase.tecnicas.forEach((t, ti) => {
          if (selTec.has(ti)) lines.push(`  ✓ ${t.nome} (${t.categoria}) · ${t.duracao} · Evidência ${t.evidencia}`);
        });
        lines.push('');
      }
      if (selEx.size > 0) {
        lines.push('EXERCÍCIOS:');
        phase.exercicios.forEach((e, ei) => {
          if (selEx.has(ei)) lines.push(`  ✓ ${e.nome} · ${e.series}x${e.repeticoes} · ${e.motivo}`);
        });
        lines.push('');
      }
    });
    if (data.relationships.direct.length > 0) {
      lines.push('─── CONEXÕES ───');
      data.relationships.direct.forEach(r => lines.push(`  ${r.source} → ${r.target} · ${r.mechanism}`));
      lines.push('');
    }
    lines.push('═══════════════════════════════════════');
    lines.push('  Gerado pelo Método Identidade · MyHealth ID');
    setGuidelines(lines.join('\n'));
    setShowGuidelines(true);
  };

  const handleCopy = () => { navigator.clipboard.writeText(guidelines); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const handlePrint = () => {
    const w = window.open('', '_blank');
    if (w) { w.document.write(`<pre style="font-family:monospace;font-size:12px;padding:20px;white-space:pre-wrap;">${guidelines}</pre>`); w.document.close(); w.print(); }
  };

  const totalTecSel = Object.values(selectedTecnicas).reduce((s, v) => s + v.size, 0);
  const totalExSel = Object.values(selectedExercicios).reduce((s, v) => s + v.size, 0);
  const totalTec = phases.reduce((s, p) => s + p.tecnicas.length, 0);
  const totalEx = phases.reduce((s, p) => s + p.exercicios.length, 0);

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

      {/* ═══ TECHNIQUE & EXERCISE MENU ═══ */}
      <div className="clinical-card border-primary/30">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Cardápio de Técnicas e Exercícios</h3>
            <p className="text-[10px] text-muted-foreground">Baseado em evidência e no Método Identidade · Selecione os itens desejados</p>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Dumbbell className="h-3.5 w-3.5" /> <strong className="text-foreground">{totalExSel}</strong>/{totalEx} exercícios</span>
          <span className="flex items-center gap-1"><Brain className="h-3.5 w-3.5" /> <strong className="text-foreground">{totalTecSel}</strong>/{totalTec} técnicas</span>
        </div>

        <div className="space-y-3">
          {phases.map((phase, pi) => {
            const col = PHASE_COLORS[pi] || PHASE_COLORS[2];
            const open = openPhases.has(pi);
            return (
              <div key={pi} className={cn('rounded-xl border-2 overflow-hidden', col.border)}>
                <button className={cn('w-full flex items-center justify-between p-3', col.bg, 'text-left')} onClick={() => togglePhase(pi)}>
                  <div className="flex items-center gap-3">
                    <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0', col.badge)}>{pi + 1}</div>
                    <div>
                      <div className={cn('font-semibold text-sm', col.text)}>{phase.titulo}</div>
                      <div className="text-[10px] text-muted-foreground">Sem {phase.semanas} · {phase.frequencia} · {phase.objetivo}</div>
                    </div>
                  </div>
                  {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
                {open && (
                  <div className="p-3 space-y-4 bg-background">
                    {/* Técnicas */}
                    <div>
                      <h4 className="font-medium text-xs mb-2 flex items-center gap-1.5"><Brain className="h-3.5 w-3.5 text-muted-foreground" /> Técnicas ({selectedTecnicas[pi]?.size || 0}/{phase.tecnicas.length})</h4>
                      <div className="space-y-1.5">
                        {phase.tecnicas.map((tec, ti) => {
                          const sel = selectedTecnicas[pi]?.has(ti);
                          return (
                            <div key={ti} className={cn('p-2.5 rounded-lg border transition-all cursor-pointer', sel ? 'bg-card border-primary/30' : 'bg-muted/30 border-dashed opacity-50')} onClick={() => toggleTec(pi, ti)}>
                              <div className="flex items-start gap-2">
                                <div className={cn('w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 mt-0.5', sel ? 'bg-primary border-primary' : 'border-muted-foreground/30')}>
                                  {sel && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-xs">{tec.nome}</div>
                                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    <Badge variant="outline" className="text-[9px]">{tec.categoria}</Badge>
                                    <span className="text-[9px] text-muted-foreground">{tec.duracao}</span>
                                    <Badge className="text-[9px] bg-blue-100 text-blue-700 border-0">{tec.evidencia}</Badge>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">{tec.descricao}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {/* Exercícios */}
                    <div>
                      <h4 className="font-medium text-xs mb-2 flex items-center gap-1.5"><Dumbbell className="h-3.5 w-3.5 text-muted-foreground" /> Exercícios ({selectedExercicios[pi]?.size || 0}/{phase.exercicios.length})</h4>
                      <div className="space-y-1.5">
                        {phase.exercicios.map((ex, ei) => {
                          const sel = selectedExercicios[pi]?.has(ei);
                          return (
                            <div key={ei} className={cn('p-2.5 rounded-lg border transition-all cursor-pointer', sel ? 'bg-card border-primary/30' : 'bg-muted/30 border-dashed opacity-50')} onClick={() => toggleEx(pi, ei)}>
                              <div className="flex items-start gap-2">
                                <div className={cn('w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 mt-0.5', sel ? 'bg-primary border-primary' : 'border-muted-foreground/30')}>
                                  {sel && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-xs">{ex.nome}</div>
                                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    <Badge variant="outline" className="text-[9px]">{ex.categoria}</Badge>
                                    <span className="text-[9px] text-muted-foreground">{ex.series}x {ex.repeticoes}</span>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">{ex.descricao}</p>
                                  <div className="mt-1 p-1 rounded bg-amber-50 border border-amber-100">
                                    <p className="text-[9px] text-amber-700">💡 {ex.motivo}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Generate/Print */}
        <div className="mt-4 pt-4 border-t">
          {!showGuidelines ? (
            <Button className="w-full bg-gradient-to-r from-primary to-primary/80 text-primary-foreground gap-2" onClick={handleGenerateGuidelines}
              disabled={totalTecSel === 0 && totalExSel === 0}>
              <Sparkles className="h-4 w-4" />
              Gerar Diretriz com {totalTecSel + totalExSel} Itens Selecionados
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                  <Copy className="h-3.5 w-3.5" /> {copied ? 'Copiado!' : 'Copiar'}
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
                  <Printer className="h-3.5 w-3.5" /> Imprimir
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowGuidelines(false)} className="gap-1.5 ml-auto">
                  Editar Seleção
                </Button>
              </div>
              <pre className="text-[10px] leading-relaxed p-4 bg-card rounded-lg border overflow-x-auto whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">{guidelines}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
