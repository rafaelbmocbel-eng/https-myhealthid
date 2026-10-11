import { toast } from 'sonner';
import { notificarClientePlano } from '@/lib/chancelaApi';

/**
 * Avisa o cliente (WhatsApp) que a equipe decidiu sobre o plano dele. Dispara e esquece:
 * a chancela ou a recusa já está gravada, e `notificarClientePlano` nunca lança.
 */
export function avisarClienteDoPlano(planoId: string): void {
  void notificarClientePlano(planoId).then((r) => {
    if (r.enviado) toast('O cliente foi avisado por WhatsApp.');
  });
}
