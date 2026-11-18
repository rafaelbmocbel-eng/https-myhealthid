import { Loader2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Props {
  aberto: boolean;
  // Título do marco confirmado, para o profissional saber qual é.
  titulo: string;
  salvando: boolean;
  // Erro de quem apaga (banco, rede): aparece no diálogo, que continua aberto.
  erro: string | null;
  onDesfazer: () => unknown;
  onCancelar: () => void;
  // Quem sabe para onde o foco vai depois de fechar com sucesso (o botão que abriu o diálogo deixa de existir).
  onCloseAutoFocus?: (evento: Event) => void;
}

// Só apresentação: quem apaga é o hook da página. O foco começa em "Voltar", o lado seguro. O título vem do que o cliente escreveu e
// pode ter uma palavra enorme sem espaço: a caixa é uma grade e cada filho precisa poder encolher (min-w-0), e o texto do cliente
// quebra em qualquer ponto (overflow-wrap:anywhere), senão o diálogo passa da largura do celular.
export default function DesfazerMarcoDialog({ aberto, titulo, salvando, erro, onDesfazer, onCancelar, onCloseAutoFocus }: Props) {
  return (
    <AlertDialog open={aberto} onOpenChange={(abrir) => { if (!abrir && !salvando) onCancelar(); }}>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus} className="w-[calc(100%-2rem)] rounded-lg">
        <AlertDialogHeader className="min-w-0">
          <AlertDialogTitle>Desfazer a confirmação?</AlertDialogTitle>
          <AlertDialogDescription className="[overflow-wrap:anywhere]">
            O marco confirmado “{titulo}” será apagado de vez e não dá para recuperá-lo. O relato do cliente volta à linha do tempo
            como não revisado. O que o cliente escreveu não é apagado.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {erro && <p role="alert" data-erro="desfazer" className="min-w-0 break-words text-sm leading-snug text-destructive">{erro}</p>}
        <AlertDialogFooter className="min-w-0 gap-2 sm:gap-0">
          <AlertDialogCancel disabled={salvando} className="mt-0 h-11 w-full sm:w-auto">Voltar</AlertDialogCancel>
          <AlertDialogAction
            disabled={salvando}
            className="h-11 w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto"
            onClick={(evento) => {
              // O botão fecha o diálogo sozinho; aqui ele só fecha quando o hook terminar de apagar.
              evento.preventDefault();
              onDesfazer();
            }}
          >
            {salvando ? (<><Loader2 className="icon-xs animate-spin" aria-hidden="true" />Desfazendo…</>) : 'Desfazer confirmação'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
