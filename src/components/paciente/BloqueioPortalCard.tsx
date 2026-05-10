import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, MessageCircle, Sparkles } from 'lucide-react';

interface Props {
  whatsappProfissional?: string;
  nomeProfissional?: string;
}

export default function BloqueioPortalCard({ whatsappProfissional, nomeProfissional }: Props) {
  const navigate = useNavigate();

  const abrirWhatsapp = () => {
    if (!whatsappProfissional) return;
    const num = whatsappProfissional.replace(/\D/g, '');
    const msg = encodeURIComponent('Olá! Quero retomar meu tratamento.');
    window.open(`https://wa.me/55${num}?text=${msg}`, '_blank');
  };

  return (
    <Card className="border-border/40 shadow-xs">
      <CardContent className="p-5 sm:p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
          <Lock className="icon-lg text-muted-foreground" />
        </div>
        <h2 className="h-section mb-1.5">Portal pausado</h2>
        <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">
          Seu período de tratamento ativo terminou. Seu histórico continua disponível abaixo,
          mas para receber novas atividades você precisa retomar com{' '}
          {nomeProfissional ? `${nomeProfissional}` : 'seu profissional'} ou assinar o
          plano Wellness Premium.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 justify-center max-w-md mx-auto">
          {whatsappProfissional && (
            <Button onClick={abrirWhatsapp} variant="outline" className="flex-1">
              <MessageCircle className="icon-sm mr-1.5" />
              Voltar ao tratamento
            </Button>
          )}
          <Button onClick={() => navigate('/paciente/plano')} className="flex-1">
            <Sparkles className="icon-sm mr-1.5" />
            Wellness Premium · R$ 49/mês
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
