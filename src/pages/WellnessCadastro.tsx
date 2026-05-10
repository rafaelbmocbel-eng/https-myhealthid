import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, Fingerprint, CheckCircle2 } from 'lucide-react';
import LogoIcon from '@/components/LogoIcon';

export default function WellnessCadastro() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    nome: '',
    sobrenome: '',
    email: '',
    telefone: '',
    password: '',
  });
  const [aceitouTermos, setAceitouTermos] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aceitouTermos) {
      toast({ title: 'Aceite os termos para continuar', variant: 'destructive' });
      return;
    }
    if (form.password.length < 6) {
      toast({ title: 'Senha deve ter pelo menos 6 caracteres', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      // 1. Sign up
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/paciente/dashboard`,
          data: {
            is_patient: true,
            nome: form.nome,
          },
        },
      });
      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error('Falha ao criar conta');

      // 2. Sign in (caso confirmação automática esteja off, ainda assim conseguimos sessão se já confirmou)
      if (!authData.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: form.email.trim().toLowerCase(),
          password: form.password,
        });
        if (signInError) {
          toast({
            title: 'Confirme seu e-mail',
            description: 'Enviamos um link para você confirmar a conta.',
          });
          navigate('/paciente/login');
          return;
        }
      }

      // 3. Cria paciente wellness
      const { error: rpcError } = await supabase.rpc('criar_paciente_wellness', {
        p_nome: form.nome,
        p_sobrenome: form.sobrenome,
        p_email: form.email.trim().toLowerCase(),
        p_telefone: form.telefone || null,
      });
      if (rpcError) throw rpcError;

      toast({
        title: 'Bem-vindo(a)! 🎉',
        description: 'Agora vamos descobrir seu MyID.',
      });
      navigate('/paciente/questionarios');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar conta';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4 py-8">
        <div className="w-full max-w-md space-y-6">
          {/* Hero */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10">
              <LogoIcon className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground">Descubra seu MyID</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Crie sua conta gratuita e ganhe acesso ao seu perfil de saúde
              </p>
            </div>
          </div>

          {/* Benefícios */}
          <div className="grid grid-cols-1 gap-2">
            {[
              { icon: Fingerprint, label: 'Avaliação MyID completa, gratuita' },
              { icon: Sparkles, label: 'Missões e desafios personalizados' },
              { icon: CheckCircle2, label: 'Atualize a cada mês e veja sua evolução' },
            ].map((b, i) => {
              const Icon = b.icon;
              return (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/40">
                  <Icon className="icon-sm text-primary shrink-0" />
                  <span className="text-xs text-foreground">{b.label}</span>
                </div>
              );
            })}
          </div>

          <Card>
            <CardContent className="p-5">
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="nome" className="text-xs">Nome</Label>
                    <Input
                      id="nome"
                      required
                      value={form.nome}
                      onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="sobrenome" className="text-xs">Sobrenome</Label>
                    <Input
                      id="sobrenome"
                      value={form.sobrenome}
                      onChange={(e) => setForm({ ...form, sobrenome: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="email" className="text-xs">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="telefone" className="text-xs">WhatsApp (opcional)</Label>
                  <Input
                    id="telefone"
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="password" className="text-xs">Senha (mín. 6 caracteres)</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={6}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </div>

                <div className="flex items-start gap-2 pt-1">
                  <Checkbox
                    id="termos"
                    checked={aceitouTermos}
                    onCheckedChange={(c) => setAceitouTermos(!!c)}
                  />
                  <Label htmlFor="termos" className="text-[11px] text-muted-foreground leading-snug cursor-pointer">
                    Concordo em receber comunicações e autorizo o tratamento dos meus dados conforme a LGPD.
                  </Label>
                </div>

                <Button type="submit" className="w-full mt-2" disabled={submitting}>
                  {submitting ? (
                    <><Loader2 className="icon-sm mr-2 animate-spin" /> Criando conta...</>
                  ) : (
                    <>Criar conta gratuita <Sparkles className="icon-sm ml-2" /></>
                  )}
                </Button>

                <p className="text-center text-[11px] text-muted-foreground pt-1">
                  Já tem conta?{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/paciente/login')}
                    className="text-primary font-semibold hover:underline"
                  >
                    Entrar
                  </button>
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
