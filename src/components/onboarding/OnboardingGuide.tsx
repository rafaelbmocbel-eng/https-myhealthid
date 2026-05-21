import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Stethoscope, UserPlus, PlayCircle, FileText,
  ArrowRight, CheckCircle2, Rocket, X, Sparkles,
} from 'lucide-react';

/**
 * Wizard de onboarding em 4 passos:
 *  1. Escolher e confirmar lente profissional
 *  2. Cadastrar primeiro paciente (real ou exemplo)
 *  3. Assistir demo MyID (60s)
 *  4. Concluir primeiro relatório (avaliação MyID)
 *
 * Detecção é automática via banco — checklist nunca mente.
 * Demo é só localStorage (não há estado de "assisti" no DB).
 */

const DEMO_KEY = 'onb_demo_assistido';
const DISMISSED_KEY = 'onb_dismissed';
const WELCOME_SHOWN_KEY = 'onb_welcome_shown';

type StepKey = 'lente' | 'paciente' | 'demo' | 'relatorio';

interface StepDef {
  key: StepKey;
  icon: typeof Stethoscope;
  title: string;
  description: string;
  cta: string;
  href: string;
}

const STEPS: StepDef[] = [
  {
    key: 'lente',
    icon: Stethoscope,
    title: 'Escolha sua lente profissional',
    description: 'Defina sua profissão (médico, fisio, psicólogo, etc.). Trava sua área de atuação no app.',
    cta: 'Definir lente',
    href: '/configuracoes',
  },
  {
    key: 'paciente',
    icon: UserPlus,
    title: 'Cadastre seu primeiro paciente',
    description: 'Pode ser real ou apenas um teste — você apaga depois se quiser.',
    cta: 'Adicionar paciente',
    href: '/pacientes',
  },
  {
    key: 'demo',
    icon: PlayCircle,
    title: 'Assista à demo do MyID (60s)',
    description: 'Veja em 1 minuto como funciona a avaliação proprietária com IA.',
    cta: 'Assistir agora',
    href: '/#demo',
  },
  {
    key: 'relatorio',
    icon: FileText,
    title: 'Gere seu primeiro relatório MyID',
    description: 'Envie o questionário ao paciente e gere a análise clínica completa.',
    cta: 'Abrir paciente',
    href: '/pacientes',
  },
];

export default function OnboardingGuide() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === 'true',
  );
  const [demoAssistido, setDemoAssistido] = useState(
    () => localStorage.getItem(DEMO_KEY) === 'true',
  );

  // 1. Lente confirmada?
  const { data: profile } = useQuery({
    queryKey: ['onb-profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('perfil_profissional_confirmado')
        .eq('user_id', user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  // 2. Tem pelo menos 1 paciente?
  const { data: temPaciente } = useQuery({
    queryKey: ['onb-paciente', user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from('pacientes')
        .select('id', { count: 'exact', head: true })
        .eq('terapeuta_id', user!.id);
      return (count ?? 0) > 0;
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  // 4. Tem alguma avaliação MyID concluída?
  const { data: temRelatorio } = useQuery({
    queryKey: ['onb-relatorio', user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from('avaliacoes_identidade')
        .select('id', { count: 'exact', head: true })
        .eq('terapeuta_id', user!.id);
      return (count ?? 0) > 0;
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const status = useMemo<Record<StepKey, boolean>>(
    () => ({
      lente: !!profile?.perfil_profissional_confirmado,
      paciente: !!temPaciente,
      demo: demoAssistido,
      relatorio: !!temRelatorio,
    }),
    [profile, temPaciente, demoAssistido, temRelatorio],
  );

  const completedCount = STEPS.filter((s) => status[s.key]).length;
  const allDone = completedCount === STEPS.length;
  const pct = Math.round((completedCount / STEPS.length) * 100);

  // Welcome modal automático no 1º carregamento após signup
  useEffect(() => {
    if (!user || dismissed || allDone) return;
    if (localStorage.getItem(WELCOME_SHOWN_KEY) === 'true') return;
    // Mostra só se ainda não fez NADA
    if (completedCount === 0) {
      setOpen(true);
      localStorage.setItem(WELCOME_SHOWN_KEY, 'true');
    }
  }, [user, dismissed, allDone, completedCount]);

  const handleAction = (step: StepDef) => {
    if (step.key === 'demo') {
      localStorage.setItem(DEMO_KEY, 'true');
      setDemoAssistido(true);
      window.open(step.href, '_blank');
      return;
    }
    setOpen(false);
    navigate(step.href);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setDismissed(true);
    setOpen(false);
  };

  if (!user || dismissed || allDone) return null;

  const proximoIdx = STEPS.findIndex((s) => !status[s.key]);

  return (
    <>
      {/* Banner inline para o dashboard */}
      <div className="relative w-full rounded-xl border border-primary/30 bg-primary/5 transition-colors hover:bg-primary/10">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-xl p-3 pr-12 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Rocket className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">Primeiros passos</h3>
                <Badge variant="outline" className="text-[10px]">
                  {completedCount}/{STEPS.length}
                </Badge>
              </div>
              <Progress value={pct} className="mt-1.5 h-1.5" />
              <p className="mt-1.5 text-xs text-muted-foreground line-clamp-1">
                Próximo: {STEPS[proximoIdx]?.title}
              </p>
            </div>
          </div>
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2 shrink-0"
          onClick={handleDismiss}
          aria-label="Dispensar"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Modal wizard */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto p-0 gap-0">
          <div className="bg-gradient-to-br from-primary/10 via-background to-accent/5 p-5 pb-4">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-[11px] text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" />
              Bem-vindo ao MY HEALTH ID
            </div>
            <DialogTitle className="text-lg font-bold leading-tight">
              4 passos para configurar sua clínica
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs text-muted-foreground">
              Leva menos de 5 minutos. Acompanhe seu progresso abaixo.
            </DialogDescription>
            <div className="mt-3 flex items-center gap-2">
              <Progress value={pct} className="h-2 flex-1" />
              <span className="text-xs font-semibold text-primary">{pct}%</span>
            </div>
          </div>

          <div className="space-y-2 p-5 pt-3">
            {STEPS.map((step, i) => {
              const done = status[step.key];
              const isProximo = i === proximoIdx;
              const Icon = step.icon;
              return (
                <div
                  key={step.key}
                  className={`rounded-xl border p-3 transition-all ${
                    done
                      ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20'
                      : isProximo
                      ? 'border-primary/40 bg-primary/5 shadow-sm'
                      : 'border-border/40 bg-card'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        done
                          ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-400'
                          : isProximo
                          ? 'bg-primary/15 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4
                        className={`text-sm font-semibold leading-tight ${
                          done ? 'text-muted-foreground line-through' : ''
                        }`}
                      >
                        {i + 1}. {step.title}
                      </h4>
                      {!done && (
                        <>
                          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                            {step.description}
                          </p>
                          {isProximo && (
                            <Button
                              size="sm"
                              className="mt-2.5 h-8 gap-1.5 text-xs"
                              onClick={() => handleAction(step)}
                            >
                              {step.cta} <ArrowRight className="h-3 w-3" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-t border-border/40 px-5 py-3">
            <button
              type="button"
              onClick={handleDismiss}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Pular tutorial
            </button>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="h-8 text-xs">
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
