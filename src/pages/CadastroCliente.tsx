import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Loader2, UserPlus, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import LogoIcon from '@/components/LogoIcon';

export default function CadastroCliente() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [terapeutaNome, setTerapeutaNome] = useState('');
  const [valid, setValid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ nome: '', email: '', password: '' });

  // Validate slug
  useEffect(() => {
    if (!slug) return;
    const check = async () => {
      // Look up config_agenda by slug to confirm it's valid
      const { data } = await supabase
        .from('config_agenda')
        .select('terapeuta_id')
        .eq('slug', slug)
        .maybeSingle();

      if (data) {
        setValid(true);
        // Try to get therapist name
        const { data: profile } = await supabase
          .from('profiles')
          .select('nome, sobrenome')
          .eq('user_id', data.terapeuta_id)
          .maybeSingle();
        if (profile) {
          setTerapeutaNome(`${profile.nome} ${profile.sobrenome}`.trim());
        }
      }
      setLoading(false);
    };
    check();
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug) return;
    setSubmitting(true);

    try {
      const res = await supabase.functions.invoke('register-patient', {
        body: { slug, nome: form.nome, email: form.email, password: form.password },
      });

      if (res.error || res.data?.error) {
        toast({
          title: 'Erro no cadastro',
          description: res.data?.error || 'Tente novamente.',
          variant: 'destructive',
        });
        setSubmitting(false);
        return;
      }

      setSuccess(true);

      // Auto-login
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });

      if (signInErr) {
        toast({
          title: 'Cadastro realizado!',
          description: 'Agora entre no portal com seu e-mail e senha.',
        });
        setTimeout(() => navigate('/paciente/login'), 2000);
      } else {
        toast({ title: 'Bem-vindo(a)!', description: 'Redirecionando ao seu portal...' });
        setTimeout(() => navigate('/paciente/dashboard', { replace: true }), 1500);
      }
    } catch {
      toast({ title: 'Erro', description: 'Erro de conexão. Tente novamente.', variant: 'destructive' });
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center gap-4">
        <LogoIcon size={48} />
        <h1 className="text-xl font-bold text-foreground">Link inválido</h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          Este link de cadastro não existe ou está desativado. Verifique com seu profissional.
        </p>
        <Button variant="outline" onClick={() => navigate('/paciente/login')}>
          Ir para o login
        </Button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Cadastro realizado!</h1>
        <p className="text-sm text-muted-foreground">Redirecionando ao portal...</p>
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col lg:flex-row bg-background">
      {/* Branding panel (desktop) */}
      <div
        className="hidden md:flex flex-col lg:w-1/2 p-8 lg:p-12 justify-between"
        style={{ background: 'linear-gradient(160deg, hsl(213 55% 16%) 0%, hsl(213 55% 8%) 100%)' }}
      >
        <div className="flex items-center gap-3">
          <LogoIcon size={44} />
          <div>
            <div className="text-sm font-black text-white tracking-wide">
              My Health <span style={{ color: 'hsl(40 95% 52%)' }}>ID</span>
            </div>
            <div className="text-xs text-white/50">Portal do Paciente</div>
          </div>
        </div>
        <div>
          <h2 className="text-3xl lg:text-4xl font-black text-white leading-tight mb-4">
            Comece sua jornada de<br />
            <span style={{ color: 'hsl(40 95% 52%)' }}>saúde integrada</span>
          </h2>
          <p className="text-white/60 text-sm leading-relaxed max-w-md">
            Cadastre-se para acessar seu portal personalizado com evolução, exercícios guiados, agenda interativa e muito mais.
          </p>
          {terapeutaNome && (
            <div className="mt-6 bg-white/5 rounded-xl px-4 py-3 border border-white/10">
              <p className="text-white/40 text-xs">Profissional responsável</p>
              <p className="text-white font-semibold text-sm">{terapeutaNome}</p>
            </div>
          )}
        </div>
        <p className="text-white/20 text-xs">My Health ID © 2026</p>
      </div>

      {/* Mobile header */}
      <div
        className="md:hidden w-full py-4 px-4 flex items-center gap-3 shrink-0"
        style={{ background: 'linear-gradient(135deg, hsl(213 55% 18%) 0%, hsl(213 55% 12%) 100%)' }}
      >
        <LogoIcon size={32} />
        <div>
          <div className="text-sm font-black text-white tracking-wide">
            My Health <span style={{ color: 'hsl(40 95% 52%)' }}>ID</span>
          </div>
          <div className="text-[10px] text-white/50">Cadastro de Cliente</div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <div className="w-full max-w-sm">
          <div className="text-center mb-5">
            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-primary/10 mb-3">
              <UserPlus className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
            </div>
            <h1 className="text-lg sm:text-xl font-black text-foreground">Criar sua conta</h1>
            <p className="text-muted-foreground text-xs mt-1">
              Preencha seus dados para acessar o portal
              {terapeutaNome && <span className="block mt-0.5">Profissional: <strong>{terapeutaNome}</strong></span>}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="nome" className="text-xs">Nome completo</Label>
              <Input
                id="nome"
                placeholder="Seu nome completo"
                value={form.nome}
                onChange={(e) => setForm(f => ({ ...f, nome: e.target.value }))}
                required
                className="h-11 rounded-xl text-[16px] sm:text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email" className="text-xs">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                required
                className="h-11 rounded-xl text-[16px] sm:text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password" className="text-xs">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={form.password}
                  onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                  minLength={6}
                  className="pr-10 h-11 rounded-xl text-[16px] sm:text-sm"
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
            <Button type="submit" className="w-full h-11 rounded-xl font-bold text-sm" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cadastrar e acessar portal'}
            </Button>
          </form>

          <p className="text-center text-[11px] text-muted-foreground mt-4">
            Já tem conta?{' '}
            <button
              onClick={() => navigate('/paciente/login')}
              className="font-semibold hover:underline"
              style={{ color: 'hsl(40 95% 52%)' }}
            >
              Entrar
            </button>
          </p>
        </div>
      </div>

      <p className="md:hidden text-center text-[10px] text-muted-foreground/40 py-3 shrink-0">
        My Health ID © 2026
      </p>
    </div>
  );
}
