import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, ArrowRight, CheckCircle2, Circle, Settings2, Activity, BarChart3,
} from 'lucide-react';
import {
  StructuralAssessmentData, UNIT_CONFIGS,
  createDefaultAssessment, calculateGeneralScore, classifyScore,
  mapRelationships, identifyPrimaryDriver, generateClinicalPriorities,
  classifyScoreColor,
} from '@/types/structural';
import StructuralPreferencesStep from './StructuralPreferencesStep';
import StructuralUnitStep from './StructuralUnitStep';
import StructuralResultsSummary from './StructuralResultsSummary';

// Steps: 0=Preferences, 1-8=Units, 9=Results
const TOTAL_STEPS = 10;

interface Props {
  initialData?: StructuralAssessmentData;
  onComplete: (data: StructuralAssessmentData) => void;
  onBack?: () => void;
}

export default function StructuralWizard({ initialData, onComplete, onBack }: Props) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<StructuralAssessmentData>(initialData || createDefaultAssessment());

  const stepLabels = useMemo(() => [
    { label: 'Preferências', icon: Settings2, emoji: '⚙️' },
    ...UNIT_CONFIGS.map(u => ({ label: u.id, icon: Activity, emoji: u.emoji })),
    { label: 'Resultados', icon: BarChart3, emoji: '📊' },
  ], []);

  const goNext = useCallback(() => {
    if (step === TOTAL_STEPS - 2) {
      // Before showing results, compute everything
      const general = calculateGeneralScore(data.units);
      const classification = classifyScore(general);
      const relationships = mapRelationships(data.units);
      const primaryDriver = identifyPrimaryDriver(data.units);
      const clinicalPriorities = generateClinicalPriorities(data.units);

      const finalData: StructuralAssessmentData = {
        ...data,
        scoreStructuralGeneral: general,
        classification,
        relationships,
        primaryDriver,
        clinicalPriorities,
        dysfunctionChain: [],
      };
      setData(finalData);
    }
    setStep(s => Math.min(s + 1, TOTAL_STEPS - 1));
  }, [step, data]);

  const goBack = useCallback(() => {
    if (step === 0 && onBack) {
      onBack();
      return;
    }
    setStep(s => Math.max(s - 1, 0));
  }, [step, onBack]);

  const progress = ((step + 1) / TOTAL_STEPS) * 100;

  const isResultsStep = step === TOTAL_STEPS - 1;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="clinical-card">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
            <Activity className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Unidades ID – Avaliação Estrutural</h1>
            <p className="text-muted-foreground text-xs">8 Unidades Funcionais · Testes baseados em evidências</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Progress value={progress} className="flex-1 h-2" />
          <span className="text-xs text-muted-foreground font-medium">{step + 1}/{TOTAL_STEPS}</span>
        </div>
      </div>

      {/* Step indicators - horizontal scroll */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {stepLabels.map((sl, i) => {
          const isActive = step === i;
          const isDone = step > i;
          const unitScore = i >= 1 && i <= 8 ? data.units[UNIT_CONFIGS[i - 1]?.id]?.score : null;
          return (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={cn(
                'shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all snap-start',
                isActive ? 'border-primary bg-primary/10 font-semibold' :
                isDone ? 'border-emerald-200 bg-emerald-50' : 'border-border hover:border-primary/30'
              )}
            >
              {isDone ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              ) : isActive ? (
                <Circle className="h-3.5 w-3.5 text-primary fill-primary/20" />
              ) : (
                <span>{sl.emoji}</span>
              )}
              <span className="whitespace-nowrap">{sl.label}</span>
              {unitScore !== null && unitScore > 0 && (
                <span className={cn('font-bold', classifyScoreColor(unitScore))}>
                  {unitScore.toFixed(1)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="animate-slide-in">
        {step === 0 && (
          <StructuralPreferencesStep
            data={data.preferences}
            onChange={prefs => setData(d => ({ ...d, preferences: prefs }))}
          />
        )}
        {step >= 1 && step <= 8 && (() => {
          const unitIdx = step - 1;
          const cfg = UNIT_CONFIGS[unitIdx];
          const assessment = data.units[cfg.id];
          return (
            <StructuralUnitStep
              key={cfg.id}
              unitConfig={cfg}
              assessment={assessment}
              onChange={updated => setData(d => ({
                ...d,
                units: { ...d.units, [cfg.id]: updated },
              }))}
            />
          );
        })()}
        {isResultsStep && <StructuralResultsSummary data={data} />}
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center bg-card p-4 rounded-xl shadow-sm border">
        <Button variant="outline" onClick={goBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> {step === 0 ? 'Voltar' : 'Anterior'}
        </Button>

        {isResultsStep ? (
          <Button
            className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground gap-2"
            onClick={() => onComplete(data)}
          >
            Salvar Avaliação Estrutural <CheckCircle2 className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground gap-2"
            onClick={goNext}
          >
            Próximo <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
