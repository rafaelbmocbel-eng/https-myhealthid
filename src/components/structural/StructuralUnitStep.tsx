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
    <div className="space-y-0.5 overflow-hidden select-none">
      {/* ── Score (Micro) ── */}
      <div className="bg-white border rounded p-1 shadow-sm mb-1">
        <div className="flex items-center justify-between mb-0.5">
          <Label className="text-[7px] font-black text-primary uppercase tracking-tighter">1. Severidade</Label>
          <div className={cn('text-base font-black leading-none', classifyScoreColor(assessment.score))}>
            {assessment.score.toFixed(1)}
          </div>
        </div>

        <div className="grid grid-cols-6 gap-0.5 mb-1">
          {[0, 2, 4, 6, 8, 10].map(val => (
            <button
              key={val}
              type="button"
              onClick={() => updateScore(val)}
              className={cn(
                "h-5 rounded text-[8px] font-black transition-all border",
                Math.round(assessment.score) === val
                  ? "text-white shadow-sm border-transparent"
                  : "bg-muted/10 text-muted-foreground border-transparent hover:border-primary/20"
              )}
              style={{ backgroundColor: Math.round(assessment.score) === val ? getSeverityColorHex(val) : undefined }}
            >
              {val}
            </button>
          ))}
        </div>

        <div className="pt-0.5 border-t border-dashed">
          <Slider
            value={[assessment.score]}
            min={0} max={10} step={0.5}
            onValueChange={([v]) => updateScore(v)}
            className="h-1.5"
          />
        </div>
      </div>

      {/* ── Testes (Trigger Único) ── */}
      <div className="border rounded overflow-hidden">
        <button
          onClick={() => toggle('tests')}
          className="w-full flex items-center justify-between p-1 bg-slate-50 hover:bg-slate-100 transition-colors"
        >
          <span className="text-[7px] font-black text-muted-foreground uppercase tracking-widest">📋 Sugestões de Testes</span>
          <ChevronDown className={cn('h-2 w-2 text-muted-foreground transition-transform', expandedSection === 'tests' && 'rotate-180')} />
        </button>
        {expandedSection === 'tests' && (
          <div className="p-1 space-y-0.5 bg-white border-t">
            {tests.slice(0, 3).map(test => (
              <div key={test.id} className="p-1 rounded bg-muted/5 border border-black/5 leading-none">
                <span className="text-[8px] font-bold text-slate-700">{test.name}</span>
                <p className="text-[7px] text-muted-foreground italic truncate">{test.evidence}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Estruturas (Triggers por Categoria) ── */}
      <div className="border rounded overflow-hidden bg-white">
        <div className="p-1 border-b bg-slate-50">
          <span className="text-[7px] font-black text-muted-foreground uppercase tracking-widest">🦴 Estruturas em Disfunção</span>
        </div>

        <div className="divide-y divide-slate-100">
          {structureCategories.map(({ key, label, icon, color }) => {
            const structures = unitConfig.structures[key];
            if (structures.length === 0) return null;
            const isExpanded = expandedSection === key;
            const selectedCount = assessment.affectedStructures[key].length;

            return (
              <div key={key}>
                <button
                  onClick={() => toggle(key)}
                  className="w-full flex items-center justify-between p-1 hover:bg-muted/10 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span className="text-[9px]">{icon}</span>
                    <span className={cn('text-[8px] font-bold uppercase', color)}>{label}</span>
                    {selectedCount > 0 && <Badge variant="secondary" className="h-3 px-1 text-[7px] bg-primary/10 text-primary border-none">{selectedCount}</Badge>}
                  </div>
                  <ChevronDown className={cn('h-2 w-2 text-muted-foreground transition-transform', isExpanded && 'rotate-180')} />
                </button>

                {isExpanded && (
                  <div className="p-1 flex flex-wrap gap-0.5 bg-muted/5 border-t">
                    {structures.map(name => {
                      const isSelected = assessment.affectedStructures[key].some(s => s.name === name);
                      return (
                        <button
                          key={name}
                          onClick={() => toggleStructure(key, name)}
                          className={cn(
                            'text-[8px] px-1 py-0.25 rounded border transition-all font-bold',
                            isSelected
                              ? 'bg-primary/20 text-primary border-primary/40'
                              : 'bg-white text-muted-foreground border-slate-200 hover:border-primary/20'
                          )}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Notas (Micro) ── */}
      <div className="bg-white border rounded p-1">
        <Textarea
          value={assessment.observacoes}
          onChange={e => onChange({ ...assessment, observacoes: e.target.value })}
          placeholder="Notas clínicas..."
          className="resize-none text-[9px] min-h-[30px] p-0.5 bg-slate-50/10 border-none focus-visible:ring-0 h-8 shadow-none"
        />
      </div>
    </div>
  );
}
