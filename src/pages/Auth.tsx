import { useState } from 'react';
import { SignInSchema, SignUpSchema } from '@/lib/validations';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import LogoIcon from '@/components/LogoIcon';

export default function Auth() {
  const { user, signIn, signUp, loading } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ nome: '', email: '', password: '' });

  if (!loading && user) {
    if (user.user_metadata?.is_patient === true) return <Navigate to="/paciente/dashboard" replace />;
    // Honra ?redirect= (ex.: aceitar convite de clínica) — só caminhos internos.
    const redirect = new URLSearchParams(window.location.search).get('redirect');
    if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
      return <Navigate to={redirect} replace />;
    }
    return <Navigate to="/hoje" replace />;
  }



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === 'login') {
      const parsed = SignInSchema.safeParse(form);
      if (!parsed.success) {
        return toast({ title: parsed.error.errors[0]?.message || 'Dados inválidos', variant: 'destructive' });
      }
    } else {
      const parsed = SignUpSchema.safeParse(form);
      if (!parsed.success) {
        return toast({ title: parsed.error.errors[0]?.message || 'Dados inválidos', variant: 'destructive' });
      }
    }
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

  // Cadastro/login com Google — sem senha e SEM etapa de confirmação por e-mail
  // (o Google já verifica o e-mail). Volta pra /auth, que redireciona o
  // profissional pra /hoje. Preserva ?redirect= (ex.: convite de clínica).
  const handleGoogle = async () => {
    setSubmitting(true);
    try {
      const redirect = new URL('/auth', window.location.origin);
      const r = new URLSearchParams(window.location.search).get('redirect');
      if (r && r.startsWith('/') && !r.startsWith('//')) redirect.searchParams.set('redirect', r);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirect.toString(), queryParams: { prompt: 'select_account' } },
      });
      if (error) throw error;
      // Redireciona para o Google; a volta cai em /auth já autenticado.
    } catch (err: any) {
      toast({ title: 'Erro ao entrar com Google', description: err?.message, variant: 'destructive' });
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel – branding */}
      <div
        className="hidden lg:flex flex-col w-1/2 p-12 justify-between"
        style={{ background: 'linear-gradient(160deg, hsl(213 55% 16%) 0%, hsl(213 55% 8%) 100%)' }}
      >
        <div className="flex items-center gap-3">
          <LogoIcon size={44} />
          <div>
            <p className="text-white font-bold text-lg leading-none">My Health ID</p>
            <p className="text-xs text-white/50 mt-1">Plataforma Clínica Inteligente</p>
          </div>
        </div>
        <div>
          <h2 className="text-4xl font-black text-white leading-tight mb-4">
            Sua identidade<br />
            <span style={{ color: 'hsl(190 85% 50%)' }}>clínica digital</span>
          </h2>
          <p className="text-white/60 text-sm leading-relaxed max-w-md">
            Avaliação multidimensional da dor, protocolos baseados em evidências, escoliose integrada e agenda inteligente — tudo em uma plataforma.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3">
            {[
              { icon: '🧬', label: 'Avaliação MyID' },
              { icon: '📋', label: 'Prontuário Digital' },
              { icon: '📊', label: 'Protocolos & Evidências' },
              { icon: '📅', label: 'Agenda Inteligente' },
            ].map(f => (
              <div key={f.label} className="flex items-center gap-2 text-white/50 text-xs bg-white/5 rounded-lg px-3 py-2">
                <span>{f.icon}</span>
                <span>{f.label}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-white/20 text-xs">My Health ID © 2026 · LGPD Compliant</p>
      </div>

      {/* Right panel – form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden flex items-center justify-center gap-2.5">
            <LogoIcon size={52} />
            <span className="text-2xl font-black text-foreground">My Health ID</span>
          </div>

          <h1 className="text-2xl font-black text-foreground mb-1">
            {tab === 'login' ? 'Bem-vindo de volta' : 'Criar conta'}
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            {tab === 'login' ? 'Entre com suas credenciais para acessar a plataforma.' : 'Cadastre-se como terapeuta para começar.'}
          </p>

          {/* Tabs */}
          <div className="flex rounded-xl bg-muted p-1 mb-6">
            {(['login', 'register'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${tab === t ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {t === 'login' ? 'Entrar' : 'Cadastrar'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === 'register' && (
              <div className="space-y-1">
                <Label htmlFor="nome">Nome completo</Label>
                <Input id="nome" placeholder="Dr. João Silva" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required className="h-11 rounded-xl" />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" placeholder="terapeuta@clinica.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                {tab === 'login' && (
                  <Link to="/recuperar-senha" className="text-xs font-semibold hover:underline" style={{ color: 'hsl(190 85% 50%)' }}>
                    Esqueci minha senha?
                  </Link>
                )}
              </div>
              <div className="relative">
                <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required className="pr-10 h-11 rounded-xl" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full bg-primary text-primary-foreground h-11 rounded-xl font-bold text-sm" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : tab === 'login' ? 'Entrar na plataforma' : 'Criar conta'}
            </Button>
          </form>

          {/* Divisor */}
          <div className="flex items-center gap-3 my-5">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">ou</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Google — caminho sem confirmação de e-mail (recomendado) */}
          <Button type="button" variant="outline" onClick={handleGoogle} disabled={submitting}
            className="w-full h-11 rounded-xl font-semibold text-sm gap-2.5">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
              <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"/>
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
            </svg>
            {tab === 'login' ? 'Entrar com Google' : 'Cadastrar com Google'}
          </Button>

          <p className="text-center text-xs text-muted-foreground mt-6">
            {tab === 'login' ? 'Não tem conta?' : 'Já tem conta?'}{' '}
            <button onClick={() => setTab(tab === 'login' ? 'register' : 'login')} className="font-semibold hover:underline" style={{ color: 'hsl(190 85% 50%)' }}>
              {tab === 'login' ? 'Cadastrar' : 'Entrar'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
