import { Link } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Activity, AlignCenter, ArrowRight, Users, FileText, Award, TrendingUp, Star } from 'lucide-react';
import heroBg from '@/assets/hero-bg.jpg';

const stats = [
  { label: 'Avaliações realizadas', value: '1.247', icon: FileText },
  { label: 'Pacientes ativos', value: '384', icon: Users },
  { label: 'Taxa de aderência', value: '87%', icon: TrendingUp },
  { label: 'Score médio ID', value: '18.4', icon: Award },
];

const features = [
  { icon: '🧠', title: 'Avaliação Multidimensional', desc: '6 blocos de scoring integrados para mapear a disfunção em suas dimensões estrutural, comportamental, contextual e neurovegetativa.' },
  { icon: '🦴', title: 'Protocolo COB° ZERO', desc: 'Classificação Lenke, cálculo de Cobb, risco de progressão (Lonstein & Carlson) e prescrição automática em 4 fases.' },
  { icon: '🎯', title: 'Relatórios Baseados em Evidências', desc: 'Gere PDFs com radar charts, hierarquia terapêutica, metas quantificáveis e plano de 12 semanas.' },
  { icon: '🤖', title: 'IA Integrada', desc: 'Diagnóstico textual automático, educação em dor, interpretação de scores e recomendações personalizadas.' },
  { icon: '🏆', title: 'Gamificação & Engajamento', desc: 'Badges, XP, leaderboard e notificações multi-canal para manter a aderência do paciente acima de 80%.' },
  { icon: '📊', title: 'Dashboard Evolutivo', desc: 'Acompanhe a evolução do ID score, Cobb angle e SRS-22r ao longo das semanas com gráficos comparativos.' },
];

export default function Index() {
  return (
    <AppLayout>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroBg})` }}
        />
        <div className="absolute inset-0 bg-gradient-hero opacity-80" />
        <div className="relative container py-20 md:py-32">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-4">
              <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
              <span className="text-sm text-white/80">Avaliação Integrada Baseada em Evidências | v8.2</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-white leading-tight mb-4">
              Método <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, hsl(187 76% 60%), hsl(160 72% 60%))' }}>Identidade</span>
              <br />+ COB° ZERO
            </h1>
            <p className="text-lg text-white/80 mb-8 max-w-xl">
              Plataforma clínica completa para avaliação multidimensional da dor e protocolo baseado em evidências para escoliose idiopática.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-gradient-primary text-white shadow-primary gap-2 text-base">
                <Link to="/metodo-identidade">
                  <Activity className="h-5 w-5" />
                  Método Identidade
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="gap-2 border-white/30 text-white hover:bg-white/10 text-base">
                <Link to="/cob-zero">
                  <AlignCenter className="h-5 w-5" />
                  COB° ZERO
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="container -mt-8 relative z-10 mb-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map(stat => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="clinical-card text-center">
                <Icon className="h-6 w-6 text-primary mx-auto mb-2" />
                <div className="text-2xl font-black text-foreground">{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Módulos principais */}
      <section className="container mb-20">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Método Identidade */}
          <div className="clinical-card border-2 border-primary/20 hover:border-primary/40 transition-all group">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-primary">
                <Activity className="h-7 w-7 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Método Identidade</h2>
                <p className="text-sm text-muted-foreground">Avaliação Multidimensional da Dor</p>
              </div>
            </div>
            <div className="space-y-2 mb-5">
              {[
                { label: 'Bloco 1', desc: 'Anamnese & Contexto (Score F)' },
                { label: 'Bloco 2', desc: 'Avaliação da Dor – Avatar Corporal (Score D)' },
                { label: 'Bloco 3', desc: 'Funcionalidade – EFI (Score EFI)' },
                { label: 'Bloco 4', desc: 'Kinesiophobia – TSK-11 (Score P)' },
                { label: 'Bloco 5', desc: 'Regulação Neurovegetativa (Score R)' },
                { label: 'Bloco 6', desc: 'Avaliação Estrutural – 8 UCs (Score E)' },
              ].map(b => (
                <div key={b.label} className="flex items-center gap-2 text-sm">
                  <span className="h-5 w-14 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">{b.label}</span>
                  <span className="text-muted-foreground">{b.desc}</span>
                </div>
              ))}
            </div>
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 mb-4">
              <div className="text-xs text-muted-foreground">Fórmula ID Final</div>
              <div className="font-mono text-xs mt-1 text-primary">
                ID = [(E×0.30) + (P×0.20) + (C×0.20) + (F×0.15) + (D×0.10)] × (10/R)
              </div>
            </div>
            <Button asChild className="w-full bg-gradient-primary text-white gap-2">
              <Link to="/metodo-identidade">
                Iniciar Avaliação <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          {/* COB° ZERO */}
          <div className="clinical-card border-2 border-blue-200 hover:border-blue-400 transition-all group">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-xl flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg, hsl(210 80% 45%), hsl(187 76% 45%))' }}>
                <AlignCenter className="h-7 w-7 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold">COB° ZERO</h2>
                <p className="text-sm text-muted-foreground">Protocolo Integrado de Escoliose</p>
              </div>
            </div>
            <div className="space-y-2 mb-5">
              {[
                { label: 'Etapa 1', desc: 'Dados Básicos & Queixa' },
                { label: 'Etapa 2', desc: 'Antropometria – Adam, ATR, Goniometria' },
                { label: 'Etapa 3', desc: 'Lenke + Cobb + Risco de Progressão' },
                { label: 'Etapa 4', desc: 'Unidades Corporais – 8 UCs' },
                { label: 'Etapa 5', desc: 'Prescrição – 4 Fases (12 semanas)' },
              ].map(b => (
                <div key={b.label} className="flex items-center gap-2 text-sm">
                  <span className="h-5 w-14 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{b.label}</span>
                  <span className="text-muted-foreground">{b.desc}</span>
                </div>
              ))}
            </div>
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 mb-4">
              <div className="text-xs text-muted-foreground">Fórmula Risco de Progressão</div>
              <div className="font-mono text-xs mt-1 text-blue-700">
                Risk(%) = 0.24×Cobb + 0.41×Sexo − 3.93 × Risser
              </div>
            </div>
            <Button asChild className="w-full gap-2 text-white" style={{ background: 'linear-gradient(135deg, hsl(210 80% 45%), hsl(187 76% 45%))' }}>
              <Link to="/cob-zero">
                Iniciar Protocolo <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mb-20">
        <h2 className="text-2xl font-bold text-center mb-2">Funcionalidades Integradas</h2>
        <p className="text-muted-foreground text-center text-sm mb-8">Tudo que você precisa para uma prática clínica baseada em evidências</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {features.map(f => (
            <div key={f.title} className="clinical-card hover:shadow-md transition-all">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-bold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card">
        <div className="container py-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="h-8 w-8 rounded-xl bg-gradient-primary flex items-center justify-center">
              <Activity className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold">Método Identidade + COB° ZERO</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Plataforma clínica baseada em evidências · v8.2 · 2026 · LGPD Compliant
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Referências: Schroth (2009) · SEAS (2012) · Negrini (2018) · Alves (2024)
          </p>
        </div>
      </footer>
    </AppLayout>
  );
}
