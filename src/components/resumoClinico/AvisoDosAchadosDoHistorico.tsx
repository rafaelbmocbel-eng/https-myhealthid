import { ArrowRight } from 'lucide-react';
import { textoDoAvisoDosAchados } from '@/lib/resumoClinico/exibicao';

interface Props {
  // Quantos achados aguardam a revisão. Indefinido enquanto a leitura roda ou se ela falhou: nesses casos não aparece nada.
  total: number | undefined;
  // A leitura passou do limite: o número pode ser maior.
  contagemIncompleta?: boolean;
  // Quem monta a tela decide como chegar ao Avatar e se ele existe nesta visão. Sem a função não há botão: nunca um botão
  // que não leva a lugar nenhum.
  onAbrirAvatar?: () => void;
}

const ID_DO_TEXTO = 'aviso-achados-do-historico-texto';

// Só um número e um caminho até onde o profissional revisa (a fila do Avatar). Nenhuma data de achado é lida nem mostrada, e
// nada aqui vira marco: a linha do tempo abaixo não muda.
export default function AvisoDosAchadosDoHistorico({ total, contagemIncompleta = false, onAbrirAvatar }: Props) {
  if (total === undefined || !Number.isFinite(total) || total <= 0) return null;
  return (
    <div
      data-aviso="achados-do-historico"
      className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5 dark:border-amber-800/40 dark:bg-amber-950/20 sm:flex-row sm:items-center sm:justify-between"
    >
      <p id={ID_DO_TEXTO} className="min-w-0 break-words text-sm leading-snug text-foreground">
        {textoDoAvisoDosAchados(total, contagemIncompleta)}
      </p>
      {onAbrirAvatar && (
        <button
          type="button"
          aria-describedby={ID_DO_TEXTO}
          onClick={() => onAbrirAvatar()}
          className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-md border border-primary/40 bg-background px-3 text-sm font-medium text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
        >
          Abrir o Avatar
          <ArrowRight className="icon-xs shrink-0" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
