import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserPlus, Search } from 'lucide-react';

// Card acolhedor mostrado nas abas do portal quando o cliente ainda NÃO tem
// vínculo com um profissional (sem registro em `pacientes`). Antes essas abas
// ficavam em branco e mudas; agora convidam a encontrar um profissional, igual
// ao que o Dashboard já faz.
export default function PortalSemVinculoCard({ recurso }: { recurso?: string }) {
  const navigate = useNavigate();
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center text-center gap-3 py-10 px-6">
        <div className="rounded-full bg-primary/10 p-3">
          <UserPlus className="h-6 w-6 text-primary" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-bold text-foreground">
            Conecte-se a um profissional
          </p>
          <p className="text-xs text-muted-foreground max-w-xs">
            {recurso
              ? `Para usar ${recurso}, você precisa estar vinculado a um profissional.`
              : 'Você ainda não está vinculado a um profissional. Encontre um para liberar esta área.'}
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => navigate('/paciente/profissionais')}>
          <Search className="h-4 w-4" /> Encontrar profissional
        </Button>
      </CardContent>
    </Card>
  );
}
