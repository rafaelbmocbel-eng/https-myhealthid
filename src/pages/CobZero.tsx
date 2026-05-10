import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertCircle } from 'lucide-react';

export default function CobZero() {
  const navigate = useNavigate();
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="mx-auto h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="h-page">Serviço descontinuado</h1>
        <p className="text-muted-foreground text-sm">
          O <strong>COB° ZERO</strong> não está mais ativo como serviço.
          Os dados históricos de avaliações estruturais continuam disponíveis no perfil de cada paciente.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
          <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <Button onClick={() => navigate('/pacientes')}>
            Ir para Pacientes
          </Button>
        </div>
      </div>
    </div>
  );
}
