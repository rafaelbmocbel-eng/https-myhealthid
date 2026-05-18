import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import LogoIcon from '@/components/LogoIcon';
import logoFull from '@/assets/logo-myhealthid-full.webp';

export default function RecuperarSenha() {
  const { resetPassword } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      return toast({ title: 'Informe seu e-mail', variant: 'destructive' });
    }
    setSubmitting(true);
    const { error } = await resetPassword(email.trim());
    if (error) {
      toast({ title: 'Erro ao enviar e-mail', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'E-mail enviado!', description: 'Verifique sua caixa de entrada para redefinir a senha.' });
      setSent(true);
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
            <div className="text-sm font-black text-white tracking-wide">My Health <span style={{ color: 'hsl(40 95% 52%)' }}>ID</span></div>
            <div className="text-xs text-white/50">Plataforma Clínica Inteligente</div>
          </div>
        </div>
        <div>
          <h2 className="text-4xl font-black text-white leading-tight mb-4">
            Recupere o acesso<br />
            <span style={{ color: 'hsl(40 95% 52%)' }}>à sua conta</span>
          </h2>
          <p className="text-white/60 text-sm leading-relaxed max-w-md">
            Enviaremos um link seguro para o seu e-mail. Basta clicar no link para criar uma nova senha.
          </p>
        </div>
        <p className="text-white/20 text-xs">My Health ID © 2026 · LGPD Compliant</p>
      </div>

      {/* Right panel – form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <LogoIcon size={34} />
            <span className="font-black text-sm text-foreground">My Health <span style={{ color: 'hsl(40 95% 52%)' }}>ID</span></span>
          </div>

          <Link to="/auth" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-4 w-4" />
            Voltar para o login
          </Link>

          <h1 className="text-2xl font-black text-foreground mb-1">Recuperar senha</h1>
          <p className="text-muted-foreground text-sm mb-6">
            {sent
              ? 'Verifique seu e-mail e clique no link recebido para continuar.'
              : 'Informe o e-mail cadastrado para receber o link de redefinição.'}
          </p>

          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="terapeuta@clinica.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 rounded-xl"
                />
              </div>
              <Button type="submit" className="w-full bg-primary text-primary-foreground h-11 rounded-xl font-bold text-sm" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar link de recuperação'}
              </Button>
            </form>
          ) : (
            <div className="rounded-xl bg-muted p-6 text-center">
              <p className="text-sm text-muted-foreground mb-4">
                E-mail enviado para <strong className="text-foreground">{email}</strong>
              </p>
              <Button
                variant="outline"
                className="w-full rounded-xl h-11"
                onClick={() => { setSent(false); setEmail(''); }}
              >
                Enviar novamente
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
