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
  AffectedStructure,
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
      <div className="clinical-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">{unitConfig.emoji}</span>
            <div>
              <h3 className="font-bold text-sm">{unitConfig.id}: {unitConfig.name}</h3>
              <p className="text-[10px] text-muted-foreground">{unitConfig.region}</p>
            </div>
          </div>
          <div className="text-right">
            <div className={cn('text-3xl font-black', classifyScoreColor(assessment.score))}>
              {assessment.score.toFixed(1)}
            </div>
            <Badge className={cn('text-[10px]', classifyScoreBg(assessment.score))}>
              {classifyScore(assessment.score)}
            </Badge>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Avaliação da Unidade</span>
            <span className="font-medium">{assessment.score.toFixed(1)} / 10</span>
          </div>
          <Slider
            value={[assessment.score]}
            min={0} max={10} step={0.5}
            onValueChange={([v]) => updateScore(v)}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>0 = Sem Alteração</span>
            <span>5 = Moderado</span>
            <span>10 = Crítico</span>
          </div>
        </div>
      </div>

      {/* ── Testes Clínicos (compact) ── */}
      <div className="clinical-card !p-0 overflow-hidden">
        <button
          onClick={() => toggle('tests')}
          className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-muted/30 transition-all"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold">Testes Clínicos</span>
            {(() => {
              const usedCount = assessment.testsPerformed.filter(t => t.performed || t.notes.length > 0).length;
              return (
                <Badge variant="outline" className="text-[9px]">
                  {usedCount}/{tests.length} usados
                </Badge>
              );
            })()}
          </div>
          <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', expandedSection === 'tests' && 'rotate-180')} />
        </button>

        {expandedSection === 'tests' && (
          <div className="border-t px-3 py-2 space-y-1.5 animate-slide-in">
            {tests.map(test => {
              const result = assessment.testsPerformed.find(t => t.testId === test.id);
              const hasNotes = result && result.notes.length > 0;
              return (
                <div key={test.id} className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded-md border text-[11px] transition-all cursor-pointer',
                  hasNotes ? 'bg-primary/5 border-primary/20' : 'bg-muted/10 border-transparent hover:border-muted'
                )}
                  onClick={() => {
                    const el = document.getElementById(`test-notes-${test.id}`);
                    if (el) el.classList.toggle('hidden');
                  }}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', hasNotes ? 'bg-primary' : 'bg-muted-foreground/30')} />
                  <span className="font-medium flex-1 truncate">{test.name}</span>
                  {test.optional && <span className="text-[8px] text-muted-foreground">OPC</span>}
                  <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                </div>
              );
            })}
            {/* Expanded note areas */}
            {tests.map(test => {
              const result = assessment.testsPerformed.find(t => t.testId === test.id);
              return (
                <div key={`notes-${test.id}`} id={`test-notes-${test.id}`} className="hidden pl-4 pb-1">
                  <p className="text-[9px] text-muted-foreground mb-1">{test.evidence}</p>
                  <Textarea
                    placeholder={`Achados do ${test.name}...`}
                    value={result?.notes || ''}
                    onChange={e => updateTestNotes(test.id, e.target.value)}
                    className="text-[11px] resize-none h-12"
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Estruturas Acometidas (compact) ── */}
      <div className="clinical-card !p-0 overflow-hidden">
        <button
          onClick={() => toggle('structures')}
          className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-muted/30 transition-all"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold">Estruturas Acometidas</span>
            {Object.values(assessment.affectedStructures).flat().length > 0 && (
              <Badge variant="outline" className="text-[9px]">
                {Object.values(assessment.affectedStructures).flat().length} selecionadas
              </Badge>
            )}
          </div>
          <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', expandedSection === 'structures' && 'rotate-180')} />
        </button>

        {expandedSection === 'structures' && (
          <div className="border-t px-3 py-2 space-y-2 animate-slide-in">
            {structureCategories.map(({ key, label, icon, color, borderColor }) => {
              const structures = unitConfig.structures[key];
              if (structures.length === 0) return null;
              const selectedCount = assessment.affectedStructures[key].length;

              return (
                <div key={key}>
                  <button
                    className="w-full flex items-center gap-1.5 py-1 text-[11px]"
                    onClick={() => {
                      const el = document.getElementById(`struct-${unitConfig.id}-${key}`);
                      if (el) el.classList.toggle('hidden');
                    }}
                  >
                    <span className="text-xs">{icon}</span>
                    <span className={cn('font-bold', color)}>{label}</span>
                    {selectedCount > 0 && (
                      <Badge variant="outline" className="text-[8px] ml-auto">{selectedCount}</Badge>
                    )}
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </button>
                  <div id={`struct-${unitConfig.id}-${key}`} className="hidden pl-4 pb-1">
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {structures.map(name => {
                        const isSelected = assessment.affectedStructures[key].some(s => s.name === name);
                        return (
                          <button
                            key={name}
                            onClick={() => toggleStructure(key, name)}
                            className={cn(
                              'text-[10px] px-2 py-0.5 rounded-full border transition-all',
                              isSelected
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'hover:border-primary/50 bg-background'
                            )}
                          >
                            {name}
                          </button>
                        );
                      })}
                    </div>
                    <Input
                      placeholder={`Outros ${label.toLowerCase()}...`}
                      className="text-[10px] h-7"
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const val = (e.target as HTMLInputElement).value.trim();
                          if (val) {
                            toggleStructure(key, val);
                            (e.target as HTMLInputElement).value = '';
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Observações ── */}
      <div className="clinical-card">
        <Label className="font-semibold text-sm">Observações Clínicas</Label>
        <Textarea
          value={assessment.observacoes}
          onChange={e => onChange({ ...assessment, observacoes: e.target.value })}
          placeholder={`Achados específicos para ${unitConfig.shortName}...`}
          className="mt-2 resize-none text-xs"
          rows={2}
        />
      </div>
    </div>
  );
}
