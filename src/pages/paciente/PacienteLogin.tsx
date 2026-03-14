import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Loader2, Heart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import LogoIcon from '@/components/LogoIcon';

export default function PacienteLogin() {
  const { user, signIn, signUp, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const portalToken = searchParams.get('token');

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ nome: '', email: '', password: '' });
  const [linking, setLinking] = useState(false);

  // If already logged in, try to link and redirect
  useEffect(() => {
    if (!authLoading && user) {
      handlePostLogin();
    }
  }, [authLoading, user]);

  const handlePostLogin = async () => {
    if (linking) return;
    setLinking(true);

    try {
      // Try to link patient via portal_token
      if (portalToken) {
        const { data, error } = await supabase.rpc('link_patient_user_by_token', {
          p_token: portalToken,
        });
        if (error) {
          console.warn('[Portal] Falha ao vincular paciente:', error);
        }
      }

      // Check if user is a patient (has pacientes record linked)
      const { data: paciente } = await supabase
        .from('pacientes')
        .select('id')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (paciente) {
        navigate('/paciente/dashboard', { replace: true });
      } else {
        toast({
          title: 'Conta não vinculada',
          description: 'Seu e-mail não está vinculado a nenhum paciente. Peça o link de acesso ao seu terapeuta.',
          variant: 'destructive',
        });
        setLinking(false);
      }
    } catch (err) {
      console.error('[Portal] Erro:', err);
      setLinking(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    if (tab === 'login') {
      const { error } = await signIn(form.email, form.password);
      if (error) {
        toast({ title: 'Erro ao entrar', description: error.message, variant: 'destructive' });
        setSubmitting(false);
      }
      // redirect handled by useEffect
    } else {
      const { error } = await signUp(form.email, form.password, form.nome);
      if (error) {
        toast({ title: 'Erro ao cadastrar', description: error.message, variant: 'destructive' });
      } else {
        toast({
          title: 'Cadastro realizado!',
          description: 'Verifique seu e-mail para confirmar a conta.',
        });
        setTab('login');
      }
      setSubmitting(false);
    }
  };

  if (authLoading || linking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="w-full py-6 px-6 flex items-center gap-3" style={{ background: 'linear-gradient(135deg, hsl(213 55% 18%) 0%, hsl(213 55% 12%) 100%)' }}>
        <LogoIcon size={36} />
        <div>
          <div className="text-sm font-black text-white tracking-wide">
            My Health <span style={{ color: 'hsl(40 95% 52%)' }}>ID</span>
          </div>
          <div className="text-[10px] text-white/50">Portal do Paciente</div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-3">
              <Heart className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-xl font-black text-foreground">
              {tab === 'login' ? 'Acesse seu portal' : 'Criar conta'}
            </h1>
            <p className="text-muted-foreground text-xs mt-1">
              {tab === 'login'
                ? 'Acompanhe sua evolução e agende consultas.'
                : 'Cadastre-se para acessar seus resultados.'}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex rounded-xl bg-muted p-1 mb-5">
            {(['login', 'register'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                  tab === t
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t === 'login' ? 'Entrar' : 'Cadastrar'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {tab === 'register' && (
              <div className="space-y-1">
                <Label htmlFor="nome" className="text-xs">Nome completo</Label>
                <Input
                  id="nome"
                  placeholder="Seu nome"
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  required
                  className="h-10 rounded-xl text-sm"
                />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="email" className="text-xs">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
                className="h-10 rounded-xl text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password" className="text-xs">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required
                  className="pr-10 h-10 rounded-xl text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full h-10 rounded-xl font-bold text-sm"
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : tab === 'login' ? (
                'Entrar no portal'
              ) : (
                'Criar conta'
              )}
            </Button>
          </form>

          <p className="text-center text-[11px] text-muted-foreground mt-4">
            {tab === 'login' ? 'Não tem conta?' : 'Já tem conta?'}{' '}
            <button
              onClick={() => setTab(tab === 'login' ? 'register' : 'login')}
              className="font-semibold hover:underline"
              style={{ color: 'hsl(40 95% 52%)' }}
            >
              {tab === 'login' ? 'Cadastrar' : 'Entrar'}
            </button>
          </p>

          {portalToken && (
            <p className="text-center text-[10px] text-muted-foreground/60 mt-3">
              🔗 Link de convite detectado — sua conta será vinculada automaticamente.
            </p>
          )}
        </div>
      </div>

      <p className="text-center text-[10px] text-muted-foreground/40 py-4">
        My Health ID © 2026 · Portal do Paciente
      </p>
    </div>
  );
}
