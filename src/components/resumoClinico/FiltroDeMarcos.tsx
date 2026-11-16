import { cn } from '@/lib/utils';
import type { IdDoFiltro, OpcaoDeFiltro } from '@/lib/resumoClinico/filtros';

interface Props {
  opcoes: OpcaoDeFiltro[];
  ativo: IdDoFiltro;
  onEscolher: (id: IdDoFiltro) => void;
  // Id da lista de marcos que o filtro muda.
  controla: string;
}

export default function FiltroDeMarcos({ opcoes, ativo, onEscolher, controla }: Props) {
  return (
    <div role="group" aria-label="Filtrar os marcos por tipo" className="flex flex-wrap gap-2">
      {opcoes.map((opcao) => (
        <button
          key={opcao.id}
          type="button"
          aria-pressed={ativo === opcao.id}
          aria-controls={controla}
          onClick={() => onEscolher(opcao.id)}
          className={cn(
            'min-h-11 rounded-full border px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            ativo === opcao.id
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-background text-foreground hover:bg-muted',
          )}
        >
          {opcao.rotulo} ({opcao.total})
        </button>
      ))}
    </div>
  );
}
