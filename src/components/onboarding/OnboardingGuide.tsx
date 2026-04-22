import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Activity, Users, CalendarDays, ClipboardList, Sparkles,
  ArrowRight, CheckCircle2, Rocket, X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const STEPS = [
  {
    icon: Users,
    title: 'Cadastre seu primeiro paciente',
    description: 'Comece adicionando pacientes à sua base para gerenciar atendimentos.',
    action: '/pacientes',
    actionLabel: 'Ir para Pacientes',
    checkKey: 'onb_paciente',
  },
  {
    icon: Activity,
    title: 'Realize uma avaliação',
    description: 'Abra o perfil do paciente e escolha o tipo de avaliação (Método Identidade, COB° ZERO ou Studio Personal).',
    action: '/pacientes',
    actionLabel: 'Nova Avaliação',
    checkKey: 'onb_avaliacao',
  },
  {
    icon: CalendarDays,
    title: 'Configure sua agenda',
    description: 'Defina horários, dias de atendimento e duração das sessões.',
    action: '/agenda',
    actionLabel: 'Configurar Agenda',
    checkKey: 'onb_agenda',
  },
  {
    icon: ClipboardList,
    title: 'Crie um protocolo de tratamento',
    description: 'Monte diretrizes terapêuticas personalizadas para seus pacientes.',
    action: '/protocolos',
    actionLabel: 'Criar Protocolo',
    checkKey: 'onb_protocolo',
  },
  {
    icon: Sparkles,
    title: 'Explore os Serviços',
    description: 'Acesse o perfil do paciente para realizar avaliações do Método Identidade, COB° ZERO e Studio Personal ID.',
    action: '/pacientes',
    actionLabel: 'Ir para Pacientes',
    checkKey: 'onb_studio',
  },
];

const STORAGE_KEY = 'onboarding_progress';
const DISMISSED_KEY = 'onboarding_dismissed';

function getProgress(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function setStepDone(key: string) {
  const p = getProgress();
  p[key] = true;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

export default function OnboardingGuide() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<Record<string, boolean>>(getProgress);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === 'true');
  const [currentStep, setCurrentStep] = useState(0);

  const completedCount = STEPS.filter(s => progress[s.checkKey]).length;
  const allDone = completedCount === STEPS.length;
  const pct = Math.round((completedCount / STEPS.length) * 100);

  useEffect(() => {
    // Auto-advance to first incomplete step
    const idx = STEPS.findIndex(s => !progress[s.checkKey]);
    if (idx >= 0) setCurrentStep(idx);
  }, [progress]);

  const handleAction = (step: typeof STEPS[0]) => {
    setStepDone(step.checkKey);
    setProgress({ ...progress, [step.checkKey]: true });
    setOpen(false);
    navigate(step.action);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setDismissed(true);
  };

  if (dismissed || allDone) return null;

  return (
    <>
      {/* Inline banner */}
      <div className="clinical-card !p-3 border-primary/20 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors" onClick={() => setOpen(true)}>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Rocket className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Primeiros Passos</h3>
              <Badge variant="outline" className="text-[10px]">{completedCount}/{STEPS.length}</Badge>
            </div>
            <Progress value={pct} className="h-1.5 mt-1.5" />
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={(e) => { e.stopPropagation(); handleDismiss(); }}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Full dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
          <div className="p-5 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Rocket className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">Tutorial Guiado</h2>
            </div>
            <p className="text-xs text-muted-foreground">Complete os passos abaixo para configurar sua clínica.</p>
            <div className="flex items-center gap-2 mt-3">
              <Progress value={pct} className="flex-1 h-2" />
              <span className="text-xs font-semibold text-primary">{pct}%</span>
            </div>
          </div>

          <div className="px-5 pb-5 space-y-2">
            {STEPS.map((step, i) => {
              const done = progress[step.checkKey];
              const Icon = step.icon;
              const isCurrent = i === currentStep;
              return (
                <div
                  key={step.checkKey}
                  onClick={() => !done && setCurrentStep(i)}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                    done ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800'
                    : isCurrent ? 'bg-primary/5 border-primary/30 shadow-sm'
                    : 'border-border hover:bg-accent/50'
                  }`}
                >
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                    done ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-400'
                    : isCurrent ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  }`}>
                    {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className={`text-sm font-semibold ${done ? 'line-through text-muted-foreground' : ''}`}>{step.title}</h4>
                    {isCurrent && !done && (
                      <>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{step.description}</p>
                        {step.subActions ? (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {step.subActions.map(sa => (
                              <Button key={sa.href} size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => { handleAction(step); navigate(sa.href); }}>
                                {sa.label} <ArrowRight className="h-3 w-3" />
                              </Button>
                            ))}
                          </div>
                        ) : (
                          <Button size="sm" className="mt-2 gap-1.5 h-7 text-xs" onClick={() => handleAction(step)}>
                            {step.actionLabel} <ArrowRight className="h-3 w-3" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
