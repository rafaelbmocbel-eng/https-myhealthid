import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Activity, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import logoMetodo from '@/assets/logo-metodo-identidade.jpg';

export default function Auth() {
  const { user, signIn, signUp, loading } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ nome: '', email: '', password: '' });

  if (!loading && user) return <Navigate to="/agenda" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    if (tab === 'login') {
      const { error } = await signIn(form.email, form.password);
      if (error) toast({ title: 'Erro ao entrar', description: error.message, variant: 'destructive' });
    } else {
      const { error } = await signUp(form.email, form.password, form.nome);
      if (error) {
        toast({ title: 'Erro ao cadastrar', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Cadastro realizado!', description: 'Verifique seu e-mail para confirmar a conta.' });
        setTab('login');
      }
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel – branding */}
      <div className="hidden lg:flex flex-col w-1/2 bg-gradient-to-br from-[hsl(222,47%,8%)] to-[hsl(187,76%,15%)] p-12 justify-between">
        <div className="flex items-center gap-3">
          <img src={logoMetodo} alt="Logo" className="h-10 w-10 rounded-xl object-cover" />
          <div>
            <div className="text-sm font-black text-white">MÉTODO <span className="text-cyan-400">IDENTIDADE</span></div>
            <div className="text-xs text-white/60">+ COB° ZERO v8.2</div>
          </div>
        </div>
        <div>
          <h2 className="text-4xl font-black text-white leading-tight mb-4">
            Agenda Inteligente<br />
            <span className="text-cyan-400">Premium</span>
          </h2>
          <p className="text-white/70 text-sm leading-relaxed">
            Gerencie sua clínica com calendário multi-visão, agendamento rápido, lembretes automáticos e dashboard de performance.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3">
            {[
              { icon: '📅', label: 'Calendário dia/semana/mês' },
              { icon: '🔔', label: 'Lembretes automáticos' },
              { icon: '📊', label: 'Dashboard de performance' },
              { icon: '🔗', label: 'Self-booking do paciente' },
            ].map(f => (
              <div key={f.label} className="flex items-center gap-2 text-white/70 text-xs">
                <span>{f.icon}</span>
                <span>{f.label}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-white/30 text-xs">Core Axis Pro © 2026 · LGPD Compliant</p>
      </div>

      {/* Right panel – form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <img src={logoMetodo} alt="Logo" className="h-8 w-8 rounded-lg object-cover" />
            <span className="font-black text-sm">MÉTODO IDENTIDADE</span>
          </div>

          <h1 className="text-2xl font-black text-foreground mb-1">
            {tab === 'login' ? 'Bem-vindo de volta' : 'Criar conta'}
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            {tab === 'login' ? 'Entre com suas credenciais para acessar a plataforma.' : 'Cadastre-se como terapeuta para começar.'}
          </p>

          {/* Tabs */}
          <div className="flex rounded-xl bg-secondary/20 p-1 mb-6">
            {(['login', 'register'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {t === 'login' ? 'Entrar' : 'Cadastrar'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === 'register' && (
              <div className="space-y-1">
                <Label htmlFor="nome">Nome completo</Label>
                <Input id="nome" placeholder="Dr. João Silva" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" placeholder="terapeuta@clinica.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required className="pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full bg-gradient-primary text-white h-11" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : tab === 'login' ? 'Entrar na plataforma' : 'Criar conta'}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-6">
            {tab === 'login' ? 'Não tem conta?' : 'Já tem conta?'}{' '}
            <button onClick={() => setTab(tab === 'login' ? 'register' : 'login')} className="text-primary font-semibold hover:underline">
              {tab === 'login' ? 'Cadastrar' : 'Entrar'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
