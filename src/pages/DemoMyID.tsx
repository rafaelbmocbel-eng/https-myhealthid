import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import LogoIcon from '@/components/LogoIcon';
import { ArrowLeft, ArrowRight, Sparkles, Brain, Activity, Moon, Heart, Apple, RefreshCw } from 'lucide-react';

type Pergunta = {
  id: string;
  icon: typeof Brain;
  titulo: string;
  pergunta: string;
  min: string;
  max: string;
};

const PERGUNTAS: Pergunta[] = [
  { id: 'energia', icon: Activity, titulo: 'Energia', pergunta: 'Como está sua energia ao longo do dia?', min: 'Exausto', max: 'Pleno' },
  { id: 'sono', icon: Moon, titulo: 'Sono', pergunta: 'Qualidade do seu sono nas últimas 2 semanas?', min: 'Péssimo', max: 'Excelente' },
  { id: 'humor', icon: Heart, titulo: 'Humor', pergunta: 'Como está seu humor e bem-estar emocional?', min: 'Muito baixo', max: 'Ótimo' },
  { id: 'movimento', icon: Activity, titulo: 'Movimento', pergunta: 'Quanto você se movimenta no dia a dia?', min: 'Sedentário', max: 'Muito ativo' },
  { id: 'alimentacao', icon: Apple, titulo: 'Alimentação', pergunta: 'Como está sua alimentação?', min: 'Desregulada', max: 'Equilibrada' },
];

export default function DemoMyID() {
  const [step, setStep] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, number>>({});

  const total = PERGUNTAS.length;
  const finalizado = step >= total;

  const score = useMemo(() => {
    const vals = Object.values(respostas);
    if (!vals.length) return 0;
    const media = vals.reduce((a, b) => a + b, 0) / vals.length;
    return Math.round(media * 10); // 0..100
  }, [respostas]);

  const piores = useMemo(() => {
    return PERGUNTAS
      .map((p) => ({ ...p, valor: respostas[p.id] ?? 5 }))
      .sort((a, b) => a.valor - b.valor)
      .slice(0, 2);
  }, [respostas]);

  const tier = score >= 75 ? 'alto' : score >= 50 ? 'médio' : 'baixo';
  const tierColor = score >= 75 ? 'text-emerald-500' : score >= 50 ? 'text-amber-500' : 'text-red-500';

  const reiniciar = () => {
    setStep(0);
    setRespostas({});
  };

  const atual = PERGUNTAS[step];
  const valorAtual = atual ? respostas[atual.id] ?? 5 : 5;

  return (
    <div className="min-h-dvh bg-background text-foreground overflow-x-hidden">
      <Helmet>
        <title>Demo MyID — experimente a avaliação clínica com IA</title>
        <meta name="description" content="Experimente uma versão simplificada do MyID em 60 segundos. Sem cadastro." />
        <meta name="robots" content="noindex" />
      </Helmet>

      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <LogoIcon size={28} />
            <span className="text-sm font-semibold tracking-tight">MY HEALTH ID</span>
          </Link>
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Demo interativa — versão simplificada do MyID
        </div>

        {!finalizado && atual && (
          <>
            <div className="mb-4 flex items-center justify-between text-xs text-muted-foreground">
              <span>Pergunta {step + 1} de {total}</span>
              <span>{Math.round(((step) / total) * 100)}%</span>
            </div>
            <div className="mb-8 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${(step / total) * 100}%` }}
              />
            </div>

            <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-sm sm:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <atual.icon className="h-5 w-5" />
                </div>
                <div className="text-sm font-medium text-muted-foreground">{atual.titulo}</div>
              </div>

              <h1 className="mt-4 text-xl font-semibold leading-tight sm:text-2xl">{atual.pergunta}</h1>

              <div className="mt-8">
                <div className="text-center text-5xl font-bold tracking-tight text-primary">
                  {valorAtual}
                </div>
                <div className="mt-1 text-center text-xs text-muted-foreground">de 10</div>

                <div className="mt-6 px-1">
                  <Slider
                    value={[valorAtual]}
                    onValueChange={(v) => setRespostas((r) => ({ ...r, [atual.id]: v[0] }))}
                    min={0}
                    max={10}
                    step={1}
                  />
                  <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                    <span>{atual.min}</span>
                    <span>{atual.max}</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-between gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={step === 0}
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                >
                  <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
                </Button>
                <Button
                  onClick={() => {
                    setRespostas((r) => ({ ...r, [atual.id]: valorAtual }));
                    setStep((s) => s + 1);
                  }}
                  className="gap-1.5"
                >
                  {step === total - 1 ? 'Ver resultado' : 'Próxima'} <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}

        {finalizado && (
          <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-sm sm:p-10">
            <div className="text-center">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Seu MyID Score
              </div>
              <div className={`mt-2 text-7xl font-bold tracking-tight ${tierColor}`}>
                {score}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">de 100 — nível <span className={tierColor}>{tier}</span></div>
            </div>

            <div className="mt-8">
              <h2 className="text-sm font-semibold">Pontos de maior atenção</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Identificamos as dimensões com maior potencial de ganho.
              </p>
              <ul className="mt-3 space-y-2">
                {piores.map((p) => (
                  <li key={p.id} className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/30 p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <p.icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-medium">{p.titulo}</span>
                    </div>
                    <span className="text-sm font-semibold text-muted-foreground">{p.valor}/10</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <Brain className="h-5 w-5 shrink-0 text-primary mt-0.5" />
                <div>
                  <div className="text-sm font-semibold">Esta é uma demo simplificada.</div>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    O MyID real avalia <strong>11 dimensões clínicas</strong>, gera narrativa pronta para prontuário, missões gamificadas para o paciente e integra com seu fluxo profissional.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Link to="/auth?modo=cadastro" className="flex-1">
                <Button className="w-full gap-2" size="lg">
                  Testar grátis por 14 dias <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Button variant="outline" size="lg" onClick={reiniciar} className="gap-2">
                <RefreshCw className="h-4 w-4" /> Refazer
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
