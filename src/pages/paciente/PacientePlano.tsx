import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Sparkles, ArrowLeft, Lock, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PacienteLayout from '@/components/paciente/PacienteLayout';
import ProtectedPatientRoute from '@/components/paciente/ProtectedPatientRoute';
import { useWellnessAccess } from '@/hooks/useWellnessAccess';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const FREE_FEATURES = [
  'Avaliação MyID completa',
  'Missões, metas e pontos (XP)',
  'Dicas e exercícios do seu MyID',
  'Diário e acompanhamento de evolução',
];

const PREMIUM_FEATURES = [
  'Tudo do plano gratuito',
  'Plano de treino personalizado com GIFs (IA)',
  'Plano alimentar personalizado (IA)',
  '1 consulta com profissional por mês',
  'Eventos e aulas online exclusivos',
];

export default function PacientePlano() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { tipoConta, isPremium, isFree, proximaCobranca } = useWellnessAccess();
  const [pagando, setPagando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const CHECKOUT_KEY = 'wellness.checkout';

  // Voltou do SumUp: confirma o pagamento na API e ativa o Premium sozinho
  useEffect(() => {
    const raw = localStorage.getItem(CHECKOUT_KEY);
    if (!raw || !user) return;
    let pendente: { id: string; ts: number } | null = null;
    try { pendente = JSON.parse(raw); } catch { localStorage.removeItem(CHECKOUT_KEY); return; }
    if (!pendente?.id || Date.now() - pendente.ts > 48 * 3600000) {
      localStorage.removeItem(CHECKOUT_KEY);
      return;
    }
    (async () => {
      setConfirmando(true);
      try {
        const { data, error } = await supabase.functions.invoke('wellness-pagamento', {
          body: { checkout_id: pendente!.id },
        });
        if (error) throw error;
        if ((data as any)?.ok) {
          localStorage.removeItem(CHECKOUT_KEY);
          toast({ title: '🎉 Premium ativado!', description: 'Seu plano já está liberado — aproveite.' });
          qc.invalidateQueries({ queryKey: ['wellness-status'] });
        }
        // status PENDENTE: mantém guardado e tenta de novo na próxima visita
      } catch {
        // rede/instabilidade: tenta de novo na próxima visita
      } finally {
        setConfirmando(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleAssinar = async () => {
    setPagando(true);
    try {
      const { createSumUpCheckout } = await import('@/utils/sumupCheckout');
      const result = await createSumUpCheckout({
        amount: 49,
        description: 'Wellness Premium — My Health ID (mensal)',
        customer_email: user?.email || undefined,
        reference: `wellness-premium-${user?.id || 'anon'}-${Date.now()}`,
        redirect_url: `${window.location.origin}/paciente/plano`,
      });
      localStorage.setItem(CHECKOUT_KEY, JSON.stringify({ id: result.checkout_id, ts: Date.now() }));
      window.location.href = result.checkout_url;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({
        title: 'Não foi possível abrir o pagamento',
        description: msg + ' — tente de novo ou fale com seu profissional.',
        variant: 'destructive',
      });
      setPagando(false);
    }
  };

  const diasParaVencer = proximaCobranca
    ? Math.ceil((new Date(proximaCobranca).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <ProtectedPatientRoute>
      <PacienteLayout>
        <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="icon-sm" /> Voltar
          </button>

          <div className="text-center space-y-2 pt-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/70">
              <Sparkles className="icon-lg text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-black text-foreground">Plano Wellness</h1>
            <p className="text-sm text-muted-foreground">
              Desbloqueie todo o potencial do seu MyID
            </p>
          </div>

          {/* Plano Gratuito */}
          <Card className={isFree ? 'border-primary/30' : ''}>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-foreground">Gratuito</h2>
                  <p className="text-xs text-muted-foreground">Para conhecer seu perfil</p>
                </div>
                {isFree && <Badge variant="secondary" className="text-[10px]">Seu plano</Badge>}
              </div>
              <div className="text-2xl font-black text-foreground">
                R$ 0<span className="text-xs font-normal text-muted-foreground">/mês</span>
              </div>
              <ul className="space-y-1.5 pt-2">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-foreground">
                    <Check className="icon-sm text-primary shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Plano Premium */}
          <Card className={`relative overflow-hidden ${isPremium ? 'border-primary' : 'border-primary/40'}`}>
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-bl-xl">
              RECOMENDADO
            </div>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-foreground flex items-center gap-1.5">
                    <Sparkles className="icon-sm text-primary" /> Premium
                  </h2>
                  <p className="text-xs text-muted-foreground">Acesso completo + acompanhamento</p>
                </div>
                {isPremium && <Badge className="text-[10px]">Ativo</Badge>}
              </div>
              <div className="text-2xl font-black text-foreground">
                R$ 49<span className="text-xs font-normal text-muted-foreground">/mês</span>
              </div>
              <ul className="space-y-1.5 pt-2">
                {PREMIUM_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-foreground">
                    <Check className="icon-sm text-primary shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              {confirmando && (
                <div className="flex items-center gap-2 mt-3 p-2 rounded-lg bg-muted/40">
                  <Loader2 className="icon-sm animate-spin text-muted-foreground" />
                  <p className="text-[11px] text-muted-foreground">Confirmando seu pagamento…</p>
                </div>
              )}
              {!isPremium && tipoConta !== 'clinico' && !confirmando && (
                <Button className="w-full mt-3" onClick={handleAssinar} disabled={pagando}>
                  {pagando ? <Loader2 className="icon-sm mr-2 animate-spin" /> : <Sparkles className="icon-sm mr-2" />}
                  {pagando ? 'Abrindo pagamento…' : 'Assinar agora'}
                </Button>
              )}
              {isPremium && proximaCobranca && (
                <div className="mt-3 space-y-2">
                  <p className="text-[11px] text-muted-foreground">
                    Ativo até {new Date(proximaCobranca).toLocaleDateString('pt-BR')}
                    {diasParaVencer !== null && diasParaVencer <= 5 && diasParaVencer >= 0 && ' — vence em breve'}
                  </p>
                  {diasParaVencer !== null && diasParaVencer <= 5 && (
                    <Button className="w-full" variant="outline" onClick={handleAssinar} disabled={pagando}>
                      {pagando ? <Loader2 className="icon-sm mr-2 animate-spin" /> : <Sparkles className="icon-sm mr-2" />}
                      Renovar agora (+31 dias)
                    </Button>
                  )}
                </div>
              )}
              {tipoConta === 'clinico' && (
                <div className="flex items-center gap-2 mt-3 p-2 rounded-lg bg-muted/40">
                  <Lock className="icon-sm text-muted-foreground" />
                  <p className="text-[11px] text-muted-foreground">
                    Você já é paciente da clínica e tem acesso completo.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <p className="text-center text-[10px] text-muted-foreground">
            Cancele a qualquer momento. Sem fidelidade.
          </p>
        </div>
      </PacienteLayout>
    </ProtectedPatientRoute>
  );
}
