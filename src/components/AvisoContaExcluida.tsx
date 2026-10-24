import { useEffect } from 'react';
import { toast } from 'sonner';
import { descartarAvisoContaExcluida, lerAvisoContaExcluida } from '@/lib/contaCliente';

// Quando o logout falha depois de excluir a conta, a página é recarregada e o aviso de sucesso se perderia.
// ExcluirContaCliente deixa o aviso guardado na sessão e este componente (montado uma vez no App) o mostra.
export default function AvisoContaExcluida() {
  useEffect(() => {
    const aviso = lerAvisoContaExcluida();
    if (!aviso) return;
    descartarAvisoContaExcluida();
    toast.success(aviso.titulo, { description: aviso.descricao, duration: 9000 });
  }, []);

  return null;
}
