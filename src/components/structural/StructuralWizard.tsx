import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, CheckCircle2, Settings2, Activity, BarChart3, ChevronDown,
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
import BodyMapSelector from './BodyMapSelector';
import StructuralConnectionMap from './StructuralConnectionMap';

interface Props {
  initialData?: StructuralAssessmentData;
  onComplete: (data: StructuralAssessmentData) => void;
  onBack?: () => void;
}

type ViewMode = 'map' | 'preferences' | 'results';

export default function StructuralWizard({ initialData, onComplete, onBack }: Props) {
  const [data, setData] = useState<StructuralAssessmentData>(initialData || createDefaultAssessment());
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [showPrefs, setShowPrefs] = useState(false);
  const unitFormRef = useRef<HTMLDivElement>(null);

  const completedUnits = useMemo(() => {
    return UNIT_CONFIGS.filter(cfg => {
      const unit = data.units[cfg.id];
      if (!unit) return false;
      // Unit is considered evaluated if score > 0 (slider) or any test has notes
      return unit.score > 0 || unit.testsPerformed.some(t => t.performed || t.notes.length > 0);
    }).map(cfg => cfg.id);
  }, [data.units]);

  const progress = (completedUnits.length / UNIT_CONFIGS.length) * 100;
  const allDone = completedUnits.length === UNIT_CONFIGS.length;

  const handleSelectUnit = useCallback((unitId: string) => {
    setSelectedUnit(prev => prev === unitId ? null : unitId);
    setViewMode('map');
    // Scroll to form after state update
    setTimeout(() => {
      unitFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, []);

  const handleFinalize = useCallback(() => {
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
    setViewMode('results');
    setSelectedUnit(null);
  }, [data]);

  if (viewMode === 'results') {
    return (
      <div className="space-y-4">
        <StructuralResultsSummary data={data} />
        <div className="flex justify-between items-center bg-card p-4 rounded-xl shadow-sm border">
          <Button variant="outline" onClick={() => setViewMode('map')} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar ao Mapa
          </Button>
          <Button
            className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground gap-2"
            onClick={() => onComplete(data)}
          >
            Salvar Avaliação Estrutural <CheckCircle2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="clinical-card">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
            <Activity className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Unidades ID – Avaliação Estrutural</h1>
            <p className="text-muted-foreground text-xs">Toque numa região do corpo para avaliar</p>
          </div>
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack} className="h-8 w-8 p-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Progress value={progress} className="flex-1 h-2" />
          <span className="text-xs text-muted-foreground font-medium">{completedUnits.length}/{UNIT_CONFIGS.length} unidades</span>
        </div>
      </div>

      {/* Preferences toggle */}
      <button
        onClick={() => setShowPrefs(p => !p)}
        className="w-full clinical-card !p-3 flex items-center justify-between hover:border-primary/30 transition-all"
      >
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Preferências & Contraindicações</span>
          {data.preferences.techniquePreference.length > 0 && (
            <Badge variant="outline" className="text-[10px]">
              {data.preferences.techniquePreference.length} selecionadas
            </Badge>
          )}
        </div>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', showPrefs && 'rotate-180')} />
      </button>
      {showPrefs && (
        <div className="animate-slide-in">
          <StructuralPreferencesStep
            data={data.preferences}
            onChange={prefs => setData(d => ({ ...d, preferences: prefs }))}
          />
        </div>
      )}

      {/* Unit evaluation form — appears ABOVE the body map when a unit is selected */}
      {selectedUnit && (() => {
        const cfg = UNIT_CONFIGS.find(c => c.id === selectedUnit);
        if (!cfg) return null;
        const assessment = data.units[cfg.id];
        const isCompleted = completedUnits.includes(cfg.id);

        return (
          <div ref={unitFormRef} className="animate-slide-in">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{cfg.emoji}</span>
              <h2 className="text-lg font-bold">{cfg.name}</h2>
              {isCompleted && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              {assessment.score > 0 && (
                <Badge className={cn('text-xs', classifyScoreColor(assessment.score))}>
                  {assessment.score.toFixed(1)} — {classifyScore(assessment.score)}
                </Badge>
              )}
            </div>
            <StructuralUnitStep
              key={cfg.id}
              unitConfig={cfg}
              assessment={assessment}
              onChange={updated => setData(d => ({
                ...d,
                units: { ...d.units, [cfg.id]: updated },
              }))}
            />
          </div>
        );
      })()}

      {/* Body Map — always visible */}
      <BodyMapSelector
        units={data.units}
        activeUnitId={selectedUnit || undefined}
        onSelectUnit={handleSelectUnit}
      />

      {/* Connection Map — below body map */}
      <StructuralConnectionMap
        data={data}
        editable={true}
        onDataChange={setData}
      />

      {/* Actions */}
      <div className="flex justify-between items-center bg-card p-4 rounded-xl shadow-sm border">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>

        <Button
          className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground gap-2"
          onClick={handleFinalize}
          disabled={completedUnits.length === 0}
        >
          {allDone ? 'Ver Resultados' : `Finalizar (${completedUnits.length}/${UNIT_CONFIGS.length})`}
          <BarChart3 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
