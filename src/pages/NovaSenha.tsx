import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import LogoIcon from '@/components/LogoIcon';

export default function NovaSenha() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isPortal = searchParams.get('portal') === '1';
  const successRedirect = isPortal ? '/paciente/login' : '/auth';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [checkingHash, setCheckingHash] = useState(true);
  const [validHash, setValidHash] = useState(false);

  useEffect(() => {
    // O Supabase consome o hash da URL (#access_token=...&type=recovery)
    // automaticamente ao iniciar e dispara o evento PASSWORD_RECOVERY.
    // Também pode já ter consumido antes deste componente montar — então
    // checamos: (1) hash bruto, (2) evento PASSWORD_RECOVERY, (3) sessão ativa.
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setValidHash(true);
      setCheckingHash(false);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setValidHash(true);
        setCheckingHash(false);
      }
    });

    // Fallback: se já houver sessão (hash já consumido antes do mount), permite
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setValidHash(true);
        setCheckingHash(false);
      } else {
        // Aguarda 1.5s pelo evento; se não vier, considera inválido
        setTimeout(() => {
          setCheckingHash((prev) => {
            if (prev) {
              setValidHash(false);
              toast({
                title: 'Link inválido',
                description: 'O link de recuperação expirou ou é inválido. Solicite um novo.',
                variant: 'destructive',
              });
              return false;
            }
            return prev;
          });
        }, 1500);
      }
    });

    return () => subscription.unsubscribe();
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      return toast({ title: 'A senha deve ter pelo menos 6 caracteres', variant: 'destructive' });
    }
    if (password !== confirmPassword) {
      return toast({ title: 'As senhas não coincidem', variant: 'destructive' });
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast({ title: 'Erro ao redefinir senha', description: error.message, variant: 'destructive' });
    } else {
      setSuccess(true);
      toast({ title: 'Senha redefinida com sucesso!' });
      setTimeout(() => navigate(successRedirect), 2500);
    }
    setSubmitting(false);
  };

  if (checkingHash) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!validHash) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <div className="text-center max-w-sm">
          <LogoIcon size={44} className="mx-auto mb-4" />
          <h1 className="text-xl font-black text-foreground mb-2">Link inválido ou expirado</h1>
          <p className="text-sm text-muted-foreground mb-6">
            O link de recuperação não é válido. Solicite um novo e-mail de recuperação.
          </p>
          <Button onClick={() => navigate('/recuperar-senha')} className="bg-primary text-primary-foreground rounded-xl h-11 px-6">
            Solicitar novo link
          </Button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <div className="text-center max-w-sm">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-black text-foreground mb-2">Senha redefinida!</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Você será redirecionado para o login em instantes…
          </p>
          <Button onClick={() => navigate('/auth')} className="bg-primary text-primary-foreground rounded-xl h-11 px-6">
            Ir para o login
          </Button>
        </div>
      </div>
    );
  }

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
            Nova senha<br />
            <span style={{ color: 'hsl(190 85% 50%)' }}>com segurança</span>
          </h2>
          <p className="text-white/60 text-sm leading-relaxed max-w-md">
            Escolha uma senha forte e única para proteger sua conta na plataforma.
          </p>
        </div>
        <p className="text-white/20 text-xs">My Health ID © 2026 · LGPD Compliant</p>
      </div>

      {/* Right panel – form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <LogoIcon size={34} />
            <span className="font-black text-sm text-foreground">My Health <span style={{ color: 'hsl(190 85% 50%)' }}>ID</span></span>
          </div>

          <h1 className="text-2xl font-black text-foreground mb-1">Criar nova senha</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Digite e confirme sua nova senha de acesso.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="password">Nova senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="pr-10 h-11 rounded-xl"
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
            <div className="space-y-1">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="h-11 rounded-xl"
              />
            </div>
            <Button type="submit" className="w-full bg-primary text-primary-foreground h-11 rounded-xl font-bold text-sm" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Redefinir senha'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
