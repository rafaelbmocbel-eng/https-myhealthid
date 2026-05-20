import { Link, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import LogoIcon from '@/components/LogoIcon';
import {
  ArrowRight, Brain, ShieldCheck, Sparkles, Users, CalendarDays,
  MessageSquare, Activity, Lock, PlayCircle, CheckCircle2, Stethoscope,
} from 'lucide-react';

const beneficios = [
  {
    icon: Brain,
    titulo: 'MyID v2.0 — avaliação proprietária',
    texto: 'Score de saúde integrativo com IA. 11 dimensões clínicas, gamificação para o paciente e narrativa pronta para prontuário.',
  },
  {
    icon: Stethoscope,
    titulo: 'Multiprofissional com lente travada',
    texto: 'Médico, Psicólogo, Nutricionista, Fisio, T.O. e Educador Físico — cada um vê o que é seu, sem cruzar áreas.',
  },
  {
    icon: CalendarDays,
    titulo: 'Agenda + portal do paciente PWA',
    texto: 'Agenda inteligente, reagendamento pelo paciente, lembretes automáticos e app instalável (iOS/Android).',
  },
  {
    icon: MessageSquare,
    titulo: 'CRM + WhatsApp unificado',
    texto: 'Inbox única, cadências automáticas, funil de vendas público com chatbot e PIX EMV — vendas no piloto automático.',
  },
  {
    icon: Activity,
    titulo: 'Evolução longitudinal e relatórios',
    texto: 'Gráficos comparativos, PDFs prontos, histórico de atendimentos e métricas de retenção em um lugar só.',
  },
  {
    icon: ShieldCheck,
    titulo: 'LGPD e isolamento por profissional',
    texto: 'RLS no banco, consentimentos versionados e portal do paciente isolado da área do profissional.',
  },
];

const provas = [
  { metrica: '11', label: 'dimensões clínicas no MyID' },
  { metrica: '6', label: 'profissões suportadas' },
  { metrica: '100%', label: 'mobile-first / PWA' },
  { metrica: 'LGPD', label: 'compliance nativo' },
];

const depoimentos = [
  {
    nome: 'Dra. Marina S.',
    cargo: 'Fisioterapeuta — São Paulo',
    texto: 'Reduzi 70% do tempo de avaliação. O MyID já entrega a narrativa pronta — só reviso e libero o plano.',
  },
  {
    nome: 'Clínica Movimento+',
    cargo: 'Clínica multidisciplinar',
    texto: '3 profissionais usando a mesma conta sem se confundir. A lente travada deu segurança jurídica e clareza pro paciente.',
  },
  {
    nome: 'Dr. Felipe R.',
    cargo: 'Médico do esporte',
    texto: 'O portal do paciente engaja como nenhum outro app que testei. A retenção do meu acompanhamento dobrou.',
  },
];

export default function LandingPublica() {
  const { user, authReady } = useAuth();

  // Usuário logado vê o dashboard, não a landing
  if (authReady && user) {
    return <Navigate to="/inicio-app" replace />;
  }

  return (
    <div className="min-h-dvh bg-background text-foreground overflow-x-hidden">
      <Helmet>
        <title>MY HEALTH ID — Avaliação clínica com IA para profissionais de saúde</title>
        <meta
          name="description"
          content="Plataforma multiprofissional com MyID, agenda, portal do paciente PWA, CRM com WhatsApp e prontuário. Teste grátis por 14 dias."
        />
        <link rel="canonical" href="https://https-myhealthid.lovable.app/" />
        <meta property="og:title" content="MY HEALTH ID" />
        <meta property="og:description" content="Avaliação clínica com IA para profissionais de saúde. Teste grátis por 14 dias." />
        <meta property="og:url" content="https://https-myhealthid.lovable.app/" />
        <meta property="og:type" content="website" />
      </Helmet>

      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <LogoIcon size={32} />
            <span className="text-sm font-semibold tracking-tight">MY HEALTH ID</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#beneficios" className="hover:text-foreground transition-colors">Recursos</a>
            <a href="#demo" className="hover:text-foreground transition-colors">Demo</a>
            <a href="#depoimentos" className="hover:text-foreground transition-colors">Clientes</a>
            <Link to="/precos" className="hover:text-foreground transition-colors">Preços</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth" className="hidden sm:block">
              <Button variant="ghost" size="sm">Entrar</Button>
            </Link>
            <Link to="/auth?modo=cadastro">
              <Button size="sm" className="gap-1.5">
                Testar grátis <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/40">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(ellipse at top, hsl(var(--primary) / 0.12), transparent 60%), radial-gradient(ellipse at bottom right, hsl(var(--accent) / 0.08), transparent 60%)',
          }}
        />
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24 text-center">
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Avaliação clínica com IA — para 6 profissões
          </div>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            O sistema clínico que <span className="text-primary">avalia, agenda e vende</span> por você.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            MyID, agenda inteligente, portal do paciente PWA e CRM com WhatsApp — em uma única plataforma multiprofissional. Configure em minutos.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/auth?modo=cadastro">
              <Button size="lg" className="h-12 px-7 text-base gap-2">
                Começar trial grátis de 14 dias <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#demo" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
              <PlayCircle className="h-4 w-4" /> Ver demo de 60s
            </a>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Sem cartão de crédito</span>
            <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Cancele quando quiser</span>
            <span className="inline-flex items-center gap-1"><Lock className="h-3.5 w-3.5 text-primary" /> LGPD compliant</span>
          </div>
        </div>
      </section>

      {/* Prova social — métricas */}
      <section className="border-b border-border/40 bg-muted/30">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:grid-cols-4 sm:py-12">
          {provas.map((p) => (
            <div key={p.label} className="text-center">
              <div className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">{p.metrica}</div>
              <div className="mt-1 text-xs text-muted-foreground sm:text-sm">{p.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Benefícios */}
      <section id="beneficios" className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <div className="eyebrow-accent mb-2">Por que MY HEALTH ID</div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Tudo que sua clínica precisa, sem 5 sistemas diferentes.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Avaliação, agenda, portal do paciente, CRM e financeiro — integrados de verdade.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {beneficios.map(({ icon: Icon, titulo, texto }) => (
            <div
              key={titulo}
              className="group rounded-2xl border border-border/40 bg-card p-5 shadow-xs transition-all hover:border-primary/30 hover:shadow-md"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold leading-tight">{titulo}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Demo de 60s */}
      <section id="demo" className="border-y border-border/40 bg-muted/20">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <div className="eyebrow-accent mb-2">Demo de 60 segundos</div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Veja o MyID em ação.
            </h2>
            <p className="mt-3 text-muted-foreground">
              Do cadastro do paciente ao relatório com IA — em menos de 1 minuto.
            </p>
          </div>

          <div className="mx-auto mt-10 max-w-4xl">
            <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-lg aspect-video">
              {/* Placeholder de vídeo — substituir src com link real quando disponível */}
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10">
                <button
                  type="button"
                  aria-label="Reproduzir demo"
                  className="group flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform hover:scale-105"
                >
                  <PlayCircle className="h-10 w-10" />
                </button>
                <p className="mt-5 text-sm font-medium">Demo MyID — 60 segundos</p>
                <p className="mt-1 text-xs text-muted-foreground">Em breve: vídeo demonstrativo completo</p>
              </div>
              {/*
              Quando o vídeo estiver pronto, substitua o bloco acima por:
              <iframe
                src="https://www.youtube.com/embed/SEU_ID_AQUI"
                title="Demo MY HEALTH ID"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
              */}
            </div>
          </div>
        </div>
      </section>

      {/* Depoimentos */}
      <section id="depoimentos" className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <div className="eyebrow-accent mb-2">Quem usa, recomenda</div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Profissionais que ganharam tempo (e pacientes).
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
          {depoimentos.map((d) => (
            <figure
              key={d.nome}
              className="flex flex-col gap-4 rounded-2xl border border-border/40 bg-card p-6 shadow-xs"
            >
              <blockquote className="text-sm leading-relaxed text-foreground/90">
                "{d.texto}"
              </blockquote>
              <figcaption className="flex items-center gap-3 border-t border-border/40 pt-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold leading-tight">{d.nome}</div>
                  <div className="text-xs text-muted-foreground">{d.cargo}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="border-t border-border/40 bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:py-24">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Pronto para parar de perder tempo com burocracia?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            14 dias grátis. Sem cartão. Sem amarração. Configure sua clínica em minutos.
          </p>
          <div className="mt-8">
            <Link to="/auth?modo=cadastro">
              <Button size="lg" className="h-12 px-8 text-base gap-2">
                Começar agora <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Já tem conta? <Link to="/auth" className="underline hover:text-foreground">Entrar</Link>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-background">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <LogoIcon size={20} />
            <span>© {new Date().getFullYear()} MY HEALTH ID</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/precos" className="hover:text-foreground">Preços</Link>
            <Link to="/auth" className="hover:text-foreground">Entrar</Link>
            <a href="mailto:contato@myhealthid.app" className="hover:text-foreground">Contato</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
