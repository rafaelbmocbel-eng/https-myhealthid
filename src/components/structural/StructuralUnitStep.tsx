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
            <span>0 = Crítico</span>
            <span>5 = Moderado</span>
            <span>10 = Excelente</span>
          </div>
        </div>
      </div>

      {/* ── Testes Clínicos ── */}
      <button
        onClick={() => toggle('tests')}
        className="w-full clinical-card !p-3 flex items-center justify-between hover:border-primary/30 transition-all"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Testes Clínicos</span>
          <Badge variant="outline" className="text-[10px]">{tests.length} testes</Badge>
        </div>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', expandedSection === 'tests' && 'rotate-180')} />
      </button>

      {expandedSection === 'tests' && (
        <div className="clinical-card space-y-3 animate-slide-in">
          {tests.map(test => {
            const result = assessment.testsPerformed.find(t => t.testId === test.id);
            return (
              <div key={test.id} className="p-3 rounded-lg border bg-muted/20 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">{test.name}</span>
                    {test.optional && <Badge variant="outline" className="text-[9px] ml-2">Opcional</Badge>}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{test.time} · {test.difficulty}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">{test.evidence}</p>
                <Textarea
                  placeholder={`Resultado / achados do ${test.name}...`}
                  value={result?.notes || ''}
                  onChange={e => updateTestNotes(test.id, e.target.value)}
                  className="text-xs resize-none h-14"
                />
              </div>
            );
          })}
        </div>
      )}

      {/* ── Estruturas Acometidas ── */}
      <button
        onClick={() => toggle('structures')}
        className="w-full clinical-card !p-3 flex items-center justify-between hover:border-primary/30 transition-all"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Estruturas Acometidas</span>
          {Object.values(assessment.affectedStructures).flat().length > 0 && (
            <Badge variant="outline" className="text-[10px]">
              {Object.values(assessment.affectedStructures).flat().length} selecionadas
            </Badge>
          )}
        </div>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', expandedSection === 'structures' && 'rotate-180')} />
      </button>

      {expandedSection === 'structures' && (
        <div className="clinical-card space-y-4 animate-slide-in">
          {structureCategories.map(({ key, label, icon, color, borderColor }) => {
            const structures = unitConfig.structures[key];
            if (structures.length === 0) return null;

            return (
              <div key={key} className={cn('p-3 rounded-lg border', borderColor, 'bg-muted/10')}>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-sm">{icon}</span>
                  <span className={cn('text-xs font-bold', color)}>{label}</span>
                </div>

                {/* Selectable structure pills */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {structures.map(name => {
                    const isSelected = assessment.affectedStructures[key].some(s => s.name === name);
                    return (
                      <button
                        key={name}
                        onClick={() => toggleStructure(key, name)}
                        className={cn(
                          'text-[11px] px-2.5 py-1 rounded-full border transition-all',
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

                {/* Free text for additional structures */}
                <Input
                  placeholder={`Outros ${label.toLowerCase()}...`}
                  className="text-xs h-8"
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
            );
          })}
        </div>
      )}

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
