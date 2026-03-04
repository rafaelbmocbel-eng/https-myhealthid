import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Info, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  UnitAssessment, UnitConfig, EvidenceTest, EVIDENCE_TESTS,
  calculateUnitScore, classifyScore, classifyScoreColor, classifyScoreBg,
  AffectedStructure,
} from '@/types/structural';

interface Props {
  unitConfig: UnitConfig;
  assessment: UnitAssessment;
  onChange: (assessment: UnitAssessment) => void;
}

export default function StructuralUnitStep({ unitConfig, assessment, onChange }: Props) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const tests = EVIDENCE_TESTS[unitConfig.id] || [];

  // Group tests by category
  const categories = [...new Set(tests.map(t => t.category))];

  const updateTest = (testId: string, updates: Partial<typeof assessment.testsPerformed[0]>) => {
    const newTests = assessment.testsPerformed.map(t =>
      t.testId === testId ? { ...t, ...updates } : t
    );
    const score = calculateUnitScore(newTests);
    const classification = classifyScore(score);
    onChange({ ...assessment, testsPerformed: newTests, score, classification });
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

  const performedCount = assessment.testsPerformed.filter(t => t.performed).length;
  const totalTests = tests.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="clinical-card">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{unitConfig.emoji}</span>
              <h2 className="text-lg font-bold">{unitConfig.id}: {unitConfig.shortName}</h2>
            </div>
            <p className="text-muted-foreground text-xs">{performedCount}/{totalTests} testes realizados</p>
          </div>
          <div className="text-right">
            <div className={cn('text-3xl font-black', classifyScoreColor(assessment.score))}>
              {assessment.score.toFixed(1)}
            </div>
            <Badge className={cn('text-xs', classifyScoreBg(assessment.score))}>
              {assessment.classification}
            </Badge>
          </div>
        </div>
      </div>

      {/* Tests by category */}
      {categories.map(cat => {
        const catTests = tests.filter(t => t.category === cat);
        const isExpanded = expandedCategory === cat;

        return (
          <div key={cat} className="clinical-card border">
            <button
              className="w-full flex items-center justify-between"
              onClick={() => setExpandedCategory(isExpanded ? null : cat)}
            >
              <div className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">{cat}</span>
                <Badge variant="outline" className="text-[10px]">{catTests.length} testes</Badge>
              </div>
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {isExpanded && (
              <div className="mt-4 space-y-4 border-t pt-4">
                {catTests.map(test => {
                  const result = assessment.testsPerformed.find(t => t.testId === test.id);
                  if (!result) return null;

                  return (
                    <div key={test.id} className={cn(
                      'p-3 rounded-lg border transition-all',
                      result.performed ? 'bg-primary/5 border-primary/30' : 'bg-muted/30'
                    )}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={result.performed}
                            onCheckedChange={checked => updateTest(test.id, { performed: !!checked })}
                          />
                          <div>
                            <span className="font-medium text-sm">{test.name}</span>
                            {test.optional && <Badge variant="outline" className="text-[9px] ml-2">Opcional</Badge>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span>{test.time}</span>
                          <span>·</span>
                          <span>{test.difficulty}</span>
                        </div>
                      </div>

                      {result.performed && (
                        <div className="ml-6 space-y-2">
                          <div className="flex items-start gap-1 text-xs text-muted-foreground mb-2">
                            <Info className="h-3 w-3 mt-0.5 shrink-0" />
                            <span>{test.evidence}</span>
                          </div>

                          {/* Score options */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                            {test.scoring.map(opt => (
                              <button
                                key={opt.label}
                                onClick={() => updateTest(test.id, {
                                  scoreContribution: opt.value,
                                  result: opt.label,
                                })}
                                className={cn(
                                  'text-xs p-2 rounded-lg border text-left transition-all',
                                  result.result === opt.label
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'hover:border-primary/50'
                                )}
                              >
                                <div className="font-medium">{opt.label}</div>
                                <div className="opacity-70">Score: {opt.value}</div>
                              </button>
                            ))}
                          </div>

                          {/* Notes */}
                          <Textarea
                            placeholder="Observação do teste..."
                            value={result.notes}
                            onChange={e => updateTest(test.id, { notes: e.target.value })}
                            className="text-xs resize-none h-16"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Affected Structures */}
      <div className="clinical-card">
        <Label className="font-semibold text-sm mb-3 block">Estruturas Acometidas</Label>
        <div className="space-y-3">
          {([
            { key: 'muscles' as const, label: 'Músculos', icon: '💪', color: 'text-blue-600' },
            { key: 'joints' as const, label: 'Articulações', icon: '🦴', color: 'text-amber-600' },
            { key: 'ligaments' as const, label: 'Ligamentos', icon: '🔗', color: 'text-green-600' },
            { key: 'nerves' as const, label: 'Nervos', icon: '⚡', color: 'text-red-600' },
            { key: 'viscera' as const, label: 'Vísceras', icon: '🫀', color: 'text-purple-600' },
          ]).map(({ key, label, icon, color }) => (
            unitConfig.structures[key].length > 0 && (
              <div key={key}>
                <div className="flex items-center gap-1 mb-1.5">
                  <span className="text-xs">{icon}</span>
                  <span className={cn('text-xs font-semibold', color)}>{label}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {unitConfig.structures[key].map(name => {
                    const isSelected = assessment.affectedStructures[key].some(s => s.name === name);
                    return (
                      <button
                        key={name}
                        onClick={() => toggleStructure(key, name)}
                        className={cn(
                          'text-xs px-2.5 py-1 rounded-full border transition-all',
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'hover:border-primary/50 bg-muted/50'
                        )}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )
          ))}
        </div>
      </div>

      {/* Observações */}
      <div className="clinical-card">
        <Label className="font-semibold text-sm">Observações Clínicas - {unitConfig.id}</Label>
        <Textarea
          value={assessment.observacoes}
          onChange={e => onChange({ ...assessment, observacoes: e.target.value })}
          placeholder={`Achados específicos para ${unitConfig.shortName}...`}
          className="mt-2 resize-none"
          rows={2}
        />
      </div>
    </div>
  );
}
