import { useCallback, useRef, useState, type ReactNode } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export interface PedidoDeConfirmacao {
  titulo: string;
  texto: ReactNode;
  /** Rótulo do botão que segue em frente. */
  confirmar: string;
  /** Rótulo do botão que desiste (padrão: "Cancelar"). */
  cancelar?: string;
  aoConfirmar: () => void;
  /** Para onde o foco vai depois de confirmar, quando o botão que abriu a pergunta deixa de existir (senão o foco cairia no vazio). */
  focoDepoisDeConfirmar?: () => void;
}

/**
 * Pergunta antes de uma ação que apaga trabalho (trocar a foto, substituir pontos, trocar o paciente).
 * `pedir` abre a pergunta; `dialogo` é o elemento que a tela deve renderizar uma vez.
 */
export function useConfirmacao() {
  const [pedido, setPedido] = useState<PedidoDeConfirmacao | null>(null);
  // Durante a animação de fechar, o texto continua o mesmo em vez de sumir.
  const ultimo = useRef<PedidoDeConfirmacao | null>(null);
  const confirmado = useRef(false);
  if (pedido) ultimo.current = pedido;
  const pedir = useCallback((p: PedidoDeConfirmacao) => setPedido(p), []);
  const mostrado = pedido ?? ultimo.current;

  const dialogo = (
    <AlertDialog open={!!pedido} onOpenChange={(aberto) => { if (!aberto) setPedido(null); }}>
      <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md" onCloseAutoFocus={(e) => {
        const foco = mostrado?.focoDepoisDeConfirmar;
        if (confirmado.current && foco) { e.preventDefault(); foco(); }
        confirmado.current = false;
      }}>
        <AlertDialogHeader>
          <AlertDialogTitle>{mostrado?.titulo}</AlertDialogTitle>
          <AlertDialogDescription asChild><div>{mostrado?.texto}</div></AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel className="mt-0">{mostrado?.cancelar ?? 'Cancelar'}</AlertDialogCancel>
          <AlertDialogAction onClick={() => { confirmado.current = true; mostrado?.aoConfirmar(); }}>{mostrado?.confirmar}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { pedir, dialogo };
}
