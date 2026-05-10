import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Sparkles, ArrowLeft, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PacienteLayout from '@/components/paciente/PacienteLayout';
import ProtectedPatientRoute from '@/components/paciente/ProtectedPatientRoute';
import { useWellnessAccess } from '@/hooks/useWellnessAccess';
import { useToast } from '@/hooks/use-toast';

const FREE_FEATURES = [
  'Avaliação MyID completa',
  'Painel pessoal de saúde',
  '1/3 das missões personalizadas',
  'Acompanhamento mensal de evolução',
];

const PREMIUM_FEATURES = [
  'Tudo do plano gratuito',
  'Biblioteca completa de exercícios',
  'Protocolos de ansiedade e bem-estar',
  'Todas as missões e desafios (XP completo)',
  'Chat com profissional',
  '1 consulta com profissional por mês',
  'Eventos e aulas online exclusivos',
];

export default function PacientePlano() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { tipoConta, isPremium, isFree } = useWellnessAccess();

  const handleAssinar = () => {
    toast({
      title: 'Em breve',
      description: 'O pagamento online estará disponível na próxima atualização. Fale conosco para liberar manualmente.',
    });
  };

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
              {!isPremium && tipoConta !== 'clinico' && (
                <Button className="w-full mt-3" onClick={handleAssinar}>
                  <Sparkles className="icon-sm mr-2" /> Assinar agora
                </Button>
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
