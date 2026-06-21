import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Loader2, Heart, Activity, Calendar, Dumbbell, LineChart, ShieldCheck, Sparkles, Lock, Mail, User as UserIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import LogoIcon from '@/components/LogoIcon';
import logoFull from '@/assets/logo-myhealthid-full.webp';
import { withAuthLockRetry } from '@/lib/authLock';

export default function PacienteLogin() {
  const { token: routeToken } = useParams();
  const { user, signIn, signOut, loading: authLoading, authReady } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const portalToken = routeToken ?? searchParams.get('token');
  const isPortalLink = Boolean(routeToken) || searchParams.get('portal') === '1';

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ nome: '', email: '', password: '' });
  const [linking, setLinking] = useState(false);
  const [resetting, setResetting] = useState(false);
  const linkAttempted = useRef(false);
  const signOutAttempted = useRef(false);
  const [demorandoMuito, setDemorandoMuito] = useState(false);

  // Se o carregamento inicial demorar demais, avisa o paciente em vez de deixar o spinner vago.
  useEffect(() => {
    if (!authLoading && !linking) { setDemorandoMuito(false); return; }
    const timer = setTimeout(() => setDemorandoMuito(true), 6000);
    return () => clearTimeout(timer);
  }, [authLoading, linking]);

  // If portal link (portal=1) and user is logged in as professional, sign them out first
  useEffect(() => {
    if (!authReady || authLoading || !user || signOutAttempted.current) return;

    if (isPortalLink) {
      const checkAndSignOut = async () => {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) console.warn('[Portal] Falha ao verificar sessão profissional:', error);

        if (profile) {
          signOutAttempted.current = true;
          linkAttempted.current = false;
          setLinking(false);
          setSubmitting(false);
          await signOut();
          return;
        }

        if (!linkAttempted.current) {
          linkAttempted.current = true;
          handlePostLogin();
        }
      };
      checkAndSignOut();
    } else {
      if (!linkAttempted.current) {
        linkAttempted.current = true;
        handlePostLogin();
      }
    }
  }, [authLoading, authReady, isPortalLink, signOut, user]);

  useEffect(() => {
    if (!authReady || authLoading || user || !isPortalLink) return;
    signOutAttempted.current = false;
    setLinking(false);
    setSubmitting(false);
  }, [authLoading, authReady, isPortalLink, user]);

  const handlePostLogin = async () => {
    if (linking || !user) return;
    setLinking(true);

    try {
      if (isPortalLink) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profileError) console.warn('[Portal] Falha ao validar perfil antes do vínculo:', profileError);

        if (profile) {
          await signOut();
          linkAttempted.current = false;
          setLinking(false);
          setSubmitting(false);
          toast({
            title: 'Acesso exclusivo do portal',
            description: 'Entre com a conta do paciente para continuar.',
          });
          return;
        }
      }

      if (portalToken) {
        const { data, error } = await supabase.rpc('link_patient_user_by_token', { p_token: portalToken });
        if (error) console.warn('[Portal] Falha ao vincular via token:', error);
        else if (data) {
          navigate('/paciente/dashboard', { replace: true });
          return;
        }
      }

      const { data: linkedByEmail, error: emailError } = await supabase.rpc('link_patient_user_by_email');
      if (emailError) console.warn('[Portal] Falha ao vincular via email:', emailError);
      else if (linkedByEmail) {
        navigate('/paciente/dashboard', { replace: true });
        return;
      }

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
          description: 'Seu e-mail não está vinculado a nenhum paciente. Verifique se usou o mesmo e-mail informado ao seu terapeuta.',
          variant: 'destructive',
        });
        linkAttempted.current = false;
        setLinking(false);
        setSubmitting(false);
      }
    } catch (err) {
      console.error('[Portal] Erro:', err);
      linkAttempted.current = false;
      setLinking(false);
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!form.email) {
      toast({
        title: 'Informe seu e-mail',
        description: 'Digite o e-mail no campo acima para receber o link de redefinição.',
        variant: 'destructive',
      });
      return;
    }
    setResetting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
        redirectTo: `${window.location.origin}/nova-senha?portal=1`,
      });
      if (error) throw error;
      toast({
        title: 'E-mail enviado',
        description: 'Se este e-mail estiver cadastrado, você receberá instruções para redefinir sua senha.',
      });
    } catch (err: any) {
      toast({
        title: 'Não foi possível enviar',
        description: err.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setResetting(false);
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
        linkAttempted.current = false;
      }
    } else {
      try {
        const { error } = await withAuthLockRetry(() =>
          supabase.auth.signUp({
            email: form.email,
            password: form.password,
            options: { data: { nome: form.nome, is_patient: true } },
          })
        );

        if (error) {
          const message = error.message.toLowerCase();
          const code = (error as any)?.code?.toLowerCase?.() || '';
          const isAlreadyRegistered =
            message.includes('already registered') ||
            message.includes('already been registered') ||
            message.includes('user already registered') ||
            code === 'user_already_exists' ||
            code === 'email_exists';
          const isWeakPassword =
            code === 'weak_password' ||
            message.includes('weak password') ||
            message.includes('pwned') ||
            message.includes('password should');
          const isInvalidEmail =
            code === 'email_address_invalid' ||
            code === 'validation_failed' ||
            message.includes('email address is invalid') ||
            (message.includes('email address') && message.includes('invalid')) ||
            message.includes('unable to validate email');

          if (isAlreadyRegistered) {
            const { error: signInError } = await signIn(form.email, form.password);
            if (!signInError) {
              toast({ title: 'Conta já existente', description: 'Você já tinha cadastro. Entrando no portal...' });
              return;
            }
            toast({
              title: 'E-mail já cadastrado',
              description: 'Esta conta já existe. Use a aba Entrar com a senha já criada.',
              variant: 'destructive',
            });
            setTab('login');
            setSubmitting(false);
            return;
          }
          if (isWeakPassword) {
            toast({
              title: 'Senha muito fraca',
              description: 'Escolha uma senha mais forte (mínimo 8 caracteres, evite senhas comuns).',
              variant: 'destructive',
            });
            setSubmitting(false);
            return;
          }
          if (isInvalidEmail) {
            toast({
              title: 'E-mail não aceito',
              description: 'Use um e-mail válido e real. Domínios temporários podem ser bloqueados.',
              variant: 'destructive',
            });
            setSubmitting(false);
            return;
          }
          toast({ title: 'Erro ao cadastrar', description: error.message, variant: 'destructive' });
          setSubmitting(false);
        } else {
          toast({ title: 'Conta criada!', description: 'Conectando ao portal...' });
        }
      } catch (err: any) {
        console.error('[Portal] Erro no cadastro:', err);
        toast({
          title: 'Erro ao cadastrar',
          description: 'Ocorreu um erro de conexão. Tente novamente.',
          variant: 'destructive',
        });
        setSubmitting(false);
      }
    }
  };

  if (authLoading || linking) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background gap-3 px-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Conectando ao portal...</p>
        {demorandoMuito && (
          <>
            <p className="text-xs text-muted-foreground max-w-xs">
              Isso está demorando mais que o normal. Verifique sua conexão com a internet.
            </p>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              Tentar novamente
            </Button>
          </>
        )}
      </div>
    );
  }

  const features = [
    { icon: LineChart, label: 'Sua evolução', desc: 'Acompanhe seus avanços' },
    { icon: Dumbbell, label: 'Exercícios', desc: 'Programa personalizado' },
    { icon: Calendar, label: 'Agenda', desc: 'Marque e remarque online' },
    { icon: Activity, label: 'Diário', desc: 'Sintomas e bem-estar' },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col lg:flex-row bg-background overflow-x-clip">
      {/* ============ Left panel — Brand / Hero ============ */}
      <div
        className="relative hidden md:flex flex-col lg:w-1/2 p-8 lg:p-12 justify-between overflow-hidden"
        style={{ background: 'linear-gradient(160deg, hsl(213 55% 18%) 0%, hsl(213 55% 6%) 100%)' }}
      >
        {/* decorative orbs */}
        <div
          className="pointer-events-none absolute -top-24 -right-24 w-[420px] h-[420px] rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, hsl(190 85% 50% / 0.6), transparent 70%)' }}
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-20 w-[360px] h-[360px] rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, hsl(190 85% 50% / 0.5), transparent 70%)' }}
        />

        <div className="relative flex items-center gap-3">
          <div className="bg-white/95 rounded-xl px-3 py-2 shadow-lg">
            <img src={logoFull} alt="My Health ID" className="h-10 w-auto object-contain" />
          </div>
          <div className="text-xs text-white/50">Portal do Paciente</div>
        </div>

        <div className="relative">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur border border-white/10 mb-5">
            <Sparkles className="h-3 w-3" style={{ color: 'hsl(190 85% 60%)' }} />
            <span className="text-[11px] font-semibold text-white/80">Sua jornada de saúde, integrada</span>
          </div>
          <h2 className="text-3xl lg:text-4xl font-black text-white leading-[1.1] mb-4">
            Um portal feito<br />
            <span style={{ color: 'hsl(190 85% 50%)' }}>para você</span> evoluir
          </h2>
          <p className="text-white/60 text-sm leading-relaxed max-w-md mb-8">
            Acompanhe sua evolução, acesse exercícios personalizados, registre seu diário e
            converse com seu terapeuta — tudo em um só lugar, com segurança.
          </p>

          <div className="grid grid-cols-2 gap-3 max-w-md">
            {features.map(f => (
              <div
                key={f.label}
                className="group flex items-start gap-3 bg-white/5 backdrop-blur border border-white/10 rounded-xl px-3 py-2.5 hover:bg-white/10 transition-colors"
              >
                <div
                  className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'hsl(190 85% 50% / 0.15)' }}
                >
                  <f.icon className="h-4 w-4" style={{ color: 'hsl(190 85% 60%)' }} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white">{f.label}</div>
                  <div className="text-[10px] text-white/50 leading-tight">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center justify-between text-white/30 text-[11px]">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="icon-sm" />
            <span>LGPD Compliant · Dados criptografados</span>
          </div>
          <span>© 2026</span>
        </div>
      </div>

      {/* ============ Mobile header ============ */}
      <div className="md:hidden relative w-full py-4 px-4 shrink-0 bg-white border-b border-border/40">
        <img src={logoFull} alt="My Health ID — Portal do Paciente" className="w-full h-auto max-h-36 object-contain" />
      </div>

      {/* ============ Right panel — Form ============ */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <div className="w-full max-w-sm">
          {/* Header */}
          <div className="text-center mb-6">
            <div
              className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 shadow-lg"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.7) 100%)',
                boxShadow: '0 10px 30px -10px hsl(var(--primary) / 0.5)',
              }}
            >
              <Heart className="h-7 w-7 text-primary-foreground" fill="currentColor" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
              {tab === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-1.5 px-2">
              {tab === 'login'
                ? 'Entre com o e-mail informado ao seu terapeuta.'
                : 'Use o mesmo e-mail que seu terapeuta cadastrou.'}
            </p>
          </div>

          {/* Tabs — animated indicator */}
          <div className="relative flex rounded-xl bg-muted p-1 mb-5">
            <div
              className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg bg-primary shadow-md transition-transform duration-300 ease-out"
              style={{ transform: tab === 'login' ? 'translateX(0)' : 'translateX(100%)' }}
            />
            {(['login', 'register'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`relative z-10 flex-1 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                  tab === t ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t === 'login' ? 'Entrar' : 'Cadastrar'}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {tab === 'register' && (
              <div className="space-y-1.5">
                <Label htmlFor="nome" className="text-xs font-semibold">Nome completo</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="nome"
                    placeholder="Seu nome"
                    value={form.nome}
                    onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                    required
                    className="pl-10 h-11 rounded-xl text-[16px] sm:text-sm"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="seu@email.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                  className="pl-10 h-11 rounded-xl text-[16px] sm:text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold">Senha</Label>
                {tab === 'login' && (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={resetting}
                    className="text-[11px] font-semibold hover:underline disabled:opacity-50"
                    style={{ color: 'hsl(40 95% 45%)' }}
                  >
                    {resetting ? 'Enviando…' : 'Esqueci minha senha'}
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                  placeholder={tab === 'register' ? 'Mínimo 8 caracteres' : '••••••••'}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required
                  minLength={tab === 'register' ? 8 : 6}
                  className="pl-10 pr-10 h-11 rounded-xl text-[16px] sm:text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {tab === 'register' && (
                <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                  Combine letras, números e símbolos. Evite senhas comuns como "123456".
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-11 rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-shadow"
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

          {/* Switch tab footer */}
          <p className="text-center text-xs text-muted-foreground mt-5">
            {tab === 'login' ? 'Ainda não tem conta?' : 'Já tem conta?'}{' '}
            <button
              type="button"
              onClick={() => setTab(tab === 'login' ? 'register' : 'login')}
              className="font-bold hover:underline"
              style={{ color: 'hsl(40 95% 45%)' }}
            >
              {tab === 'login' ? 'Cadastre-se' : 'Entrar'}
            </button>
          </p>

          {portalToken && (
            <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
              <Sparkles className="icon-sm text-primary shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-snug">
                <strong className="text-foreground">Link de convite detectado.</strong> Sua conta
                será vinculada automaticamente ao seu terapeuta.
              </p>
            </div>
          )}

          {/* Trust bar */}
          <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/70">
            <ShieldCheck className="h-3 w-3" />
            <span>Acesso seguro · Dados protegidos pela LGPD</span>
          </div>
        </div>
      </div>

      {/* Mobile footer */}
      <p className="md:hidden text-center text-[10px] text-muted-foreground/50 py-3 shrink-0">
        My Health ID © 2026 · Portal do Paciente
      </p>
    </div>
  );
}
