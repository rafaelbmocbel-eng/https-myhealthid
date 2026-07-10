import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  onRetry: () => void;
  mensagem?: string;
}

/**
 * Estado de erro amigável para o portal do paciente — nunca deixar o
 * paciente em spinner infinito ou tela vazia sem saída.
 */
export default function PortalErrorState({ onRetry, mensagem }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 p-6 text-center">
      <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
        <WifiOff className="h-5 w-5 text-destructive" />
      </div>
      <div>
        <p className="text-base font-bold text-foreground">Não foi possível carregar</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          {mensagem || 'Verifique sua conexão com a internet e tente novamente.'}
        </p>
      </div>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={onRetry}>
        <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
      </Button>
    </div>
  );
}
