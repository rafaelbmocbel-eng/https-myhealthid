import { useNavigate } from 'react-router-dom';
import { Heart, Calendar, Activity, Dumbbell, LineChart, MessageCircle, Search, ShieldCheck, Star, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logoFull from '@/assets/logo-myhealthid-full.webp';

const FEATURES = [
  { icon: Search, title: 'Encontre seu terapeuta', desc: 'Busque profissionais por especialidade, cidade e convênio — gratuito.' },
  { icon: Calendar, title: 'Agenda online', desc: 'Marque e remarque sessões com seu terapeuta sem precisar ligar.' },
  { icon: Activity, title: 'Diário de saúde', desc: 'Registre humor, sintomas e bem-estar diariamente.' },
  { icon: LineChart, title: 'Acompanhe sua evolução', desc: 'Veja seu progresso ao longo do tempo com gráficos e relatórios.' },
  { icon: Dumbbell, title: 'Exercícios personalizados', desc: 'Acesse a programação de treinos e tarefas enviada pelo seu terapeuta.' },
  { icon: MessageCircle, title: 'Chat direto', desc: 'Troque mensagens com seu profissional de saúde de forma segura.' },
];

const ESPECIALIDADES = [
  'Psicologia', 'Fisioterapia', 'Nutrição', 'Educação Física',
  'Fonoaudiologia', 'Terapia Ocupacional', 'Psiquiatria', 'Neuropsicologia',
];

export default function PortalLanding() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border/40">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <img src={logoFull} alt="My Health ID" className="h-8 w-auto object-contain" />
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/paciente/login')}>
              Entrar
            </Button>
            <Button size="sm" onClick={() => navigate('/portaldocliente/vitrine')}>
              Encontrar terapeuta
            </Button>
          </div>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section
        className="relative flex flex-col items-center justify-center text-center px-4 py-16 sm:py-24 overflow-hidden"
        style={{ background: 'linear-gradient(160deg, hsl(213 55% 14%) 0%, hsl(213 55% 4%) 100%)' }}
      >
        {/* decorative orbs */}
        <div className="pointer-events-none absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, hsl(190 85% 50%), transparent 70%)' }} />
        <div className="pointer-events-none absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full opacity-15 blur-3xl"
          style={{ background: 'radial-gradient(circle, hsl(190 85% 50%), transparent 70%)' }} />

        <div className="relative max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 mb-6">
            <Sparkles className="h-3 w-3" style={{ color: 'hsl(190 85% 60%)' }} />
            <span className="text-[11px] font-semibold text-white/80">Plataforma de saúde integrada</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white leading-[1.1] mb-5">
            Cuide da sua saúde com{' '}
            <span style={{ color: 'hsl(190 85% 50%)' }}>os melhores profissionais</span>
          </h1>

          <p className="text-white/60 text-sm sm:text-base leading-relaxed mb-8 max-w-lg mx-auto">
            Encontre terapeutas, nutricionistas, fisioterapeutas e mais.
            Agende sessões, acompanhe sua evolução e mantenha seu histórico de saúde — tudo em um só lugar.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              className="h-12 px-8 rounded-xl font-bold text-sm shadow-lg"
              onClick={() => navigate('/portaldocliente/vitrine')}
            >
              <Search className="h-4 w-4 mr-2" />
              Encontrar meu terapeuta
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-8 rounded-xl font-bold text-sm border-white/20 text-white hover:bg-white/10"
              onClick={() => navigate('/paciente/login')}
            >
              Já tenho terapeuta — Entrar
            </Button>
          </div>

          <p className="text-white/30 text-xs mt-5 flex items-center justify-center gap-1">
            <ShieldCheck className="h-3 w-3" />
            Gratuito para pacientes · Dados protegidos pela LGPD
          </p>
        </div>
      </section>

      {/* ─── Especialidades ─── */}
      <section className="py-10 px-4 bg-muted/30 border-y border-border/40">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Especialidades disponíveis
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {ESPECIALIDADES.map((e) => (
              <button
                key={e}
                onClick={() => navigate(`/portaldocliente/vitrine?especialidade=${encodeURIComponent(e)}`)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold border border-border/60 bg-card hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-black text-foreground mb-3">
              Tudo que você precisa para cuidar da sua saúde
            </h2>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              O portal do paciente reúne todas as ferramentas de acompanhamento em um único aplicativo.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="rounded-xl border border-border/40 bg-card p-5 hover:shadow-sm transition-shadow">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-bold text-sm text-foreground mb-1">{f.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── CTA Final ─── */}
      <section className="py-14 px-4 bg-primary/5 border-t border-border/40">
        <div className="max-w-lg mx-auto text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Heart className="h-7 w-7 text-primary" fill="currentColor" />
          </div>
          <h2 className="text-xl font-black text-foreground mb-3">
            Comece agora — é gratuito
          </h2>
          <p className="text-muted-foreground text-sm mb-6">
            Crie sua conta em segundos e encontre o profissional ideal para a sua necessidade.
          </p>
          <Button
            size="lg"
            className="h-12 px-8 rounded-xl font-bold"
            onClick={() => navigate('/portaldocliente/vitrine')}
          >
            Explorar terapeutas
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="py-6 px-4 border-t border-border/40 mt-auto">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground/60">
          <div className="flex items-center gap-2">
            <img src={logoFull} alt="My Health ID" className="h-5 w-auto opacity-50 object-contain" />
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> LGPD Compliant</span>
            <span>© 2026 My Health ID</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
