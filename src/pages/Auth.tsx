import { useState } from 'react';
import { SignInSchema, SignUpSchema } from '@/lib/validations';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import LogoIcon from '@/components/LogoIcon';
import logoFull from '@/assets/logo-myhealthid-full.webp';

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
            <div className="text-sm font-black text-white tracking-wide">My Health <span style={{ color: 'hsl(190 85% 50%)' }}>ID</span></div>
            <div className="text-xs text-white/50">Plataforma Clínica Inteligente</div>
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
          <div className="mb-8 lg:hidden flex justify-center">
            <img src={logoFull} alt="My Health ID" className="h-14 w-auto" />
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
