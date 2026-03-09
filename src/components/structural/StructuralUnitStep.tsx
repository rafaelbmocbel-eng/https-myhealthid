import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  UnitAssessment, UnitConfig, EVIDENCE_TESTS,
  classifyScore, classifyScoreColor, classifyScoreBg,
  AffectedStructure, getSeverityColorHex,
} from '@/types/structural';

interface Props {
  unitConfig: UnitConfig;
  assessment: UnitAssessment;
  onChange: (assessment: UnitAssessment) => void;
}

export default function StructuralUnitStep({ unitConfig, assessment, onChange }: Props) {
  const [expandedSection, setExpandedSection] = useState<string | null>('score');
  const tests = EVIDENCE_TESTS[unitConfig.id] || [];

  const toggle = (section: string) =>
    setExpandedSection(prev => prev === section ? null : section);

  const updateScore = (score: number) => {
    const classification = classifyScore(score);
    onChange({ ...assessment, score, classification });
  };

  const updateTestNotes = (testId: string, notes: string) => {
    const newTests = assessment.testsPerformed.map(t =>
      t.testId === testId ? { ...t, notes, performed: true } : t
    );
    onChange({ ...assessment, testsPerformed: newTests });
  };

  const toggleStructure = (
    category: 'muscles' | 'joints' | 'ligaments' | 'nerves' | 'viscera',
    name: string
  ) => {
    const existing = assessment.affectedStructures[category];
    const found = existing.find(s => s.name === name);
    let updated: AffectedStructure[];
    if (found) {
      updated = existing.filter(s => s.name !== name);
    } else {
      updated = [...existing, { name, severity: 'MODERADA', side: '', finding: '' }];
    }
    onChange({
      ...assessment,
      affectedStructures: { ...assessment.affectedStructures, [category]: updated },
    });
  };

  const structureCategories = [
    { key: 'muscles' as const, label: 'Músculos', icon: '💪', color: 'text-blue-600', borderColor: 'border-blue-200' },
    { key: 'joints' as const, label: 'Articulações', icon: '🦴', color: 'text-amber-600', borderColor: 'border-amber-200' },
    { key: 'ligaments' as const, label: 'Ligamentos', icon: '🔗', color: 'text-green-600', borderColor: 'border-green-200' },
    { key: 'nerves' as const, label: 'Nervos', icon: '⚡', color: 'text-red-600', borderColor: 'border-red-200' },
    { key: 'viscera' as const, label: 'Vísceras', icon: '🫀', color: 'text-purple-600', borderColor: 'border-purple-200' },
  ];

  return (
    <div className="space-y-3">

      {/* ── Score 0-10 ── */}
      <div className="clinical-card border-l-4 border-l-primary shadow-md bg-white animate-in zoom-in-95 duration-500">
        <div className="flex items-center justify-between mb-4">
          <Label className="text-sm font-bold flex items-center gap-2 text-primary uppercase tracking-wider">
            1. Severidade do Comprometimento
          </Label>
          <div className="text-right">
            <div className={cn('text-3xl font-black leading-none', classifyScoreColor(assessment.score))}>
              {assessment.score.toFixed(1)}
            </div>
          </div>
        </div>

        {/* Quick Selection Buttons */}
        <div className="grid grid-cols-6 gap-1.5 mb-4">
          {[0, 2, 4, 6, 8, 10].map(val => (
            <button
              key={val}
              type="button"
              onClick={() => updateScore(val)}
              className={cn(
                "py-3 rounded-lg text-sm font-black transition-all border-2",
                Math.round(assessment.score) === val
                  ? "text-white shadow-md scale-105 border-transparent"
                  : "bg-muted/30 text-muted-foreground border-transparent hover:border-primary/20"
              )}
              style={{
                backgroundColor: Math.round(assessment.score) === val ? getSeverityColorHex(val) : undefined,
              }}
            >
              {val}
            </button>
          ))}
        </div>

        <div className="space-y-2 pt-2 border-t border-dashed">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Ajuste Fino (Slider)</span>
            <Badge className={cn('text-[10px] font-bold uppercase tracking-tight', classifyScoreBg(assessment.score))}>
              {classifyScore(assessment.score)}
            </Badge>
          </div>
          <Slider
            value={[assessment.score]}
            min={0} max={10} step={0.5}
            onValueChange={([v]) => updateScore(v)}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground font-bold px-1 mt-1 uppercase">
            <span>Saudável</span>
            <span>Crítico</span>
          </div>
        </div>
      </div>

      {/* ── Testes Sugeridos (Compacto) ── */}
      <div className="clinical-card !p-3">
        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 block">
          Sugestões de Testes & Evidências
        </Label>
        <div className="grid grid-cols-1 gap-1.5">
          {tests.map(test => (
            <div key={test.id} className="flex flex-col p-2 rounded-lg bg-muted/30 border border-muted-foreground/10">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700">{test.name}</span>
                <span className="text-[9px] text-muted-foreground font-medium">{test.time}</span>
              </div>
              <p className="text-[9px] text-muted-foreground leading-tight italic mt-0.5">{test.evidence}</p>
            </div>
          ))}
        </div>
      </div>


      {/* ── Estruturas Acometidas (Compacto) ── */}
      <div className="clinical-card !p-3 bg-slate-50/50">
        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 block">
          Estruturas em Disfunção
        </Label>

        <div className="space-y-3">
          {structureCategories.map(({ key, label, icon, color, borderColor }) => {
            const structures = unitConfig.structures[key];
            if (structures.length === 0) return null;

            return (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <span className="text-xs">{icon}</span>
                  <span className={cn('text-[10px] font-bold uppercase', color)}>{label}</span>
                </div>

                <div className="flex flex-wrap gap-1">
                  {structures.map(name => {
                    const isSelected = assessment.affectedStructures[key].some(s => s.name === name);
                    return (
                      <button
                        key={name}
                        onClick={() => toggleStructure(key, name)}
                        className={cn(
                          'text-[10px] px-2 py-0.5 rounded border transition-all font-medium',
                          isSelected
                            ? 'bg-primary/10 text-primary border-primary/30'
                            : 'bg-white text-muted-foreground border-transparent hover:border-primary/20'
                        )}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Observações Unificadas ── */}
      <div className="clinical-card !p-3 border-t-2 border-t-primary/20">
        <Label className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-2 block">
          Anotações & Achados Clínicos
        </Label>
        <Textarea
          value={assessment.observacoes}
          onChange={e => onChange({ ...assessment, observacoes: e.target.value })}
          placeholder="Descreva achados palpatórios, testes positivos e justificativa clínica aqui..."
          className="resize-none text-xs min-h-[100px] bg-white border-muted-foreground/20 focus:border-primary"
        />
      </div>
    </div>
  );
}
