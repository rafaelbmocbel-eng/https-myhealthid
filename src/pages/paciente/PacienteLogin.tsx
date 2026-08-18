import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Loader2, Heart, Activity, Calendar, Dumbbell, LineChart, ShieldCheck, Sparkles, Lock, Mail, User as UserIcon, MessageCircle } from 'lucide-react';
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

  // Quem chega pelo link de convite quase sempre é PRIMEIRO acesso: precisa
  // CRIAR a senha (Cadastrar), não "Entrar". Por isso o link já abre em Cadastrar
  // — evita o erro "Invalid login credentials" de tentar logar sem ter conta.
  const [tab, setTab] = useState<'login' | 'register'>(
    (Boolean(routeToken) || searchParams.get('token') || searchParams.get('portal') === '1') ? 'register' : 'login',
  );
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ nome: '', email: '', password: '' });
  const [linking, setLinking] = useState(false);
  const [resetting, setResetting] = useState(false);
  const linkAttempted = useRef(false);
  const signOutAttempted = useRef(false);
  const [demorandoMuito, setDemorandoMuito] = useState(false);
  const [profissionalConflito, setProfissionalConflito] = useState(false);
  // Logou, mas o e-mail/link não bateu com nenhum cadastro. Em vez de virar
  // "avulso" na vitrine sem querer, mostramos uma escolha clara: já sou cliente
  // (usar o link pessoal) vs. sou novo (encontrar profissional na vitrine).
  const [naoVinculado, setNaoVinculado] = useState(false);
  const [criandoNovo, setCriandoNovo] = useState(false);
  // Entrou no link do portal com uma conta que é de PROFISSIONAL (ex.: escolheu
  // a própria conta Google). Antes o app só deslogava em silêncio (parecia loop);
  // agora mostramos um aviso claro pedindo pra usar a conta do cliente.
  const [avisoProfissional, setAvisoProfissional] = useState(false);

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
          setAvisoProfissional(true); // mostra aviso claro em vez de loop silencioso
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
      // Sempre verifica se é profissional primeiro — independente de isPortalLink
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) console.warn('[Portal] Falha ao validar perfil antes do vínculo:', profileError);

      if (profile) {
        if (isPortalLink) {
          linkAttempted.current = false;
          setLinking(false);
          setSubmitting(false);
          setAvisoProfissional(true); // aviso claro em vez de só um toast que some
          await signOut();
        } else {
          // Profissional acessando login do paciente — mostra tela de escolha
          setLinking(false);
          setProfissionalConflito(true);
        }
        return;
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
        // Check if already a standalone patient
        const { data: portalPaciente } = await supabase
          .from('portal_pacientes')
          .select('id')
          .eq('user_id', user!.id)
          .maybeSingle();

        if (portalPaciente) {
          navigate('/paciente/profissionais', { replace: true });
          return;
        }

        // Não achou vínculo por token nem por e-mail e ainda não é avulso.
        // NÃO cria conta avulsa automaticamente — pergunta o que a pessoa é,
        // pra não desconectar da ficha real um cliente já cadastrado que só
        // errou o e-mail (o caso comum: cliente CASSI cadastrado sem e-mail).
        setNaoVinculado(true);
        setLinking(false);
        setSubmitting(false);
        linkAttempted.current = false;
      }
    } catch (err) {
      console.error('[Portal] Erro:', err);
      linkAttempted.current = false;
      setLinking(false);
      setSubmitting(false);
    }
  };

  // "Sou novo por aqui" — cria a conta avulsa (sem terapeuta) e leva à vitrine
  // pra encontrar um profissional. Só acontece por escolha explícita, nunca
  // automático, pra não sequestrar quem já é cliente de alguém.
  const criarContaNovoCliente = async () => {
    if (!user) return;
    setCriandoNovo(true);
    const nome = user.user_metadata?.nome || user.email?.split('@')[0] || 'Paciente';
    const { error: insertError } = await supabase
      .from('portal_pacientes')
      .insert({ user_id: user.id, nome, email: user.email });
    if (!insertError) {
      navigate('/paciente/profissionais', { replace: true });
    } else {
      setCriandoNovo(false);
      toast({
        title: 'Não foi possível continuar',
        description: 'Ocorreu um erro ao criar sua conta. Tente novamente em instantes.',
        variant: 'destructive',
      });
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
        // "Invalid login credentials" = e-mail/senha não conferem OU a conta
        // ainda não existe. No primeiro acesso pelo link, o caminho é Cadastrar.
        const invalido = (error.message || '').toLowerCase().includes('invalid login');
        if (invalido) {
          toast({
            title: 'É seu primeiro acesso?',
            description: 'Toque em "Cadastrar" para criar sua senha. Se já tem conta, confira o e-mail e a senha.',
            variant: 'destructive',
          });
          setTab('register');
        } else {
          toast({ title: 'Erro ao entrar', description: error.message, variant: 'destructive' });
        }
        setSubmitting(false);
        linkAttempted.current = false;
      }
    } else {
      try {
        const { data: signUpData, error } = await withAuthLockRetry(() =>
          supabase.auth.signUp({
            email: form.email,
            password: form.password,
            options: {
              data: { nome: form.nome, is_patient: true },
              // Preserva o token na volta da confirmação de e-mail, senão o
              // vínculo por token se perde (crítico p/ cliente cadastrado sem e-mail).
              emailRedirectTo: portalToken
                ? `${window.location.origin}/paciente/login?portal=1&token=${encodeURIComponent(portalToken)}`
                : `${window.location.origin}/paciente/login`,
            },
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
        } else if (!signUpData?.session) {
          // Email confirmation required — user won't be logged in automatically
          toast({
            title: 'Verifique seu e-mail',
            description: 'Clique no link que enviamos para ativar sua conta e depois faça login.',
          });
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

  // Entrar/cadastrar com Google (sem senha). Preserva o token do portal na volta
  // (via query em redirectTo) pra vincular o paciente à ficha certa; sem token,
  // o vínculo acontece pelo e-mail do Google (link_patient_user_by_email).
  const handleGoogle = async () => {
    setSubmitting(true);
    try {
      const redirect = new URL('/paciente/login', window.location.origin);
      redirect.searchParams.set('portal', '1');
      if (portalToken) redirect.searchParams.set('token', portalToken);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirect.toString() },
      });
      if (error) throw error;
      // A página redireciona para o Google; a volta cai aqui já autenticado.
    } catch (err: any) {
      console.error('[Portal] Erro no login Google:', err);
      toast({
        title: 'Não foi possível entrar com Google',
        description: err?.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
      setSubmitting(false);
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

  if (avisoProfissional) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background gap-6 px-6 py-10 text-center">
        <div className="bg-white/95 rounded-xl px-3 py-2 shadow-md">
          <img src={logoFull} alt="My Health ID" className="h-10 w-auto object-contain" />
        </div>
        <div className="space-y-2 max-w-sm">
          <p className="text-lg font-black text-foreground">Essa é uma conta de profissional</p>
          <p className="text-sm text-muted-foreground">
            Este link é do <b>portal do cliente</b>. A conta que você escolheu é de
            <b> profissional</b> — por isso não dá pra entrar por aqui.
          </p>
          <p className="text-sm text-muted-foreground">
            Toque abaixo e, na tela do Google, <b>escolha (ou adicione) a conta do cliente</b> —
            não a sua conta de profissional.
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button
            onClick={() => {
              setAvisoProfissional(false);
              signOutAttempted.current = false;
              linkAttempted.current = false;
              setTab('register');
            }}
          >
            Entrar com a conta do cliente
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground max-w-xs">
          Dica: no teste, use uma conta Google diferente da sua, ou crie a conta do cliente
          com e-mail e senha aqui mesmo.
        </p>
      </div>
    );
  }

  if (profissionalConflito) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background gap-6 px-6 text-center">
        <div className="bg-white/95 rounded-xl px-3 py-2 shadow-md mb-2">
          <img src={logoFull} alt="My Health ID" className="h-10 w-auto object-contain" />
        </div>
        <div className="space-y-1">
          <p className="text-base font-bold text-foreground">Você está logado como profissional</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Para acessar o portal do paciente, saia da conta atual.
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button
            onClick={async () => {
              await signOut();
              setProfissionalConflito(false);
              linkAttempted.current = false;
            }}
          >
            Sair e acessar como paciente
          </Button>
          <Button variant="outline" onClick={() => navigate('/inicio-app', { replace: true })}>
            Voltar ao app profissional
          </Button>
        </div>
      </div>
    );
  }

  if (naoVinculado) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background gap-6 px-6 py-10 text-center">
        <div className="bg-white/95 rounded-xl px-3 py-2 shadow-md">
          <img src={logoFull} alt="My Health ID" className="h-10 w-auto object-contain" />
        </div>
        <div className="space-y-2 max-w-sm">
          <p className="text-lg font-black text-foreground">Não encontramos seu cadastro</p>
          <p className="text-sm text-muted-foreground">
            O e-mail <b>{user?.email}</b> ainda não está ligado a nenhuma ficha.
          </p>
        </div>

        {/* Caminho recomendado pra quem já é cliente: link pessoal do terapeuta */}
        <div className="w-full max-w-sm rounded-xl border border-primary/20 bg-primary/5 p-4 text-left space-y-1.5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <p className="text-sm font-bold text-foreground">Seu terapeuta já te cadastrou?</p>
          </div>
          <p className="text-[12px] text-muted-foreground leading-snug">
            Use o <b>link pessoal</b> que ele te enviou no WhatsApp — ele abre direto na sua ficha,
            mesmo que seu cadastro esteja sem e-mail. Se não tiver o link, é só pedir pra ele.
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-sm">
          <Button onClick={criarContaNovoCliente} disabled={criandoNovo} className="gap-2">
            {criandoNovo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Sou novo — encontrar um profissional
          </Button>
          <Button
            variant="outline"
            disabled={criandoNovo}
            onClick={async () => {
              await signOut();
              setNaoVinculado(false);
              linkAttempted.current = false;
              signOutAttempted.current = false;
              setTab('login');
            }}
          >
            Sair e tentar com outro e-mail
          </Button>
        </div>
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
              {tab === 'login'
                ? 'Bem-vindo de volta'
                : isPortalLink ? 'Crie sua senha de acesso' : 'Crie sua conta'}
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-1.5 px-2">
              {tab === 'login'
                ? 'Já tem conta? Entre com seu e-mail e senha.'
                : isPortalLink
                  ? 'Primeiro acesso: escolha um e-mail e crie uma senha. O link já te liga ao seu terapeuta.'
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

          {/* Entrar com Google (sem senha) */}
          <div className="flex items-center gap-3 my-4">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[11px] text-muted-foreground">ou</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleGoogle}
            disabled={submitting}
            className="w-full h-11 rounded-xl font-semibold text-sm gap-2.5 bg-background"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62Z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
              <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
            </svg>
            Continuar com Google
          </Button>

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

          {portalToken ? (
            <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
              <Sparkles className="icon-sm text-primary shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-snug">
                <strong className="text-foreground">Link de convite detectado.</strong> Sua conta
                será vinculada automaticamente ao seu terapeuta.
              </p>
            </div>
          ) : (
            <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-muted/50 border border-border/60">
              <MessageCircle className="icon-sm text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-snug">
                <strong className="text-foreground">Seu terapeuta te cadastrou?</strong> Entre pelo
                <b> link pessoal</b> que ele enviou no WhatsApp — assim você cai direto na sua ficha,
                mesmo sem e-mail no cadastro.
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
