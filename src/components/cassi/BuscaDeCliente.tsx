import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn, normalizarBusca } from '@/lib/utils';

export interface CandidatoBusca {
  id: string;
  nome: string;
  carteirinha?: string | null;
  encerrado?: boolean;
  jaNaLista?: boolean; // já está na lista: aparece com a marca "já na lista" e a ação de outra guia (veja `aoEscolherJaNaLista`)
  semOutraGuia?: string; // com `jaNaLista`: por que não dá para pedir outra guia (a opção aparece desligada, com este motivo)
}

// Campo "procure o cliente e adicione": lista só quem casa com o que foi digitado (nome ou carteirinha).
// Candidato com `jaNaLista` (só a lista do Faturamento usa) mostra "já na lista · adicionar outra guia" e, ao escolher, chama
// `aoEscolherJaNaLista` em vez de `onEscolher`.
export function BuscaDeCliente({ candidatos, placeholder, rotulo, rotuloEncerrado = 'encerrado', semResultado = 'Quem já está na lista não aparece aqui.', onEscolher, aoEscolherJaNaLista, desabilitado = false }: {
  candidatos: CandidatoBusca[];
  placeholder: string;
  rotulo: string;
  rotuloEncerrado?: string; // o que avisar de quem está encerrado no CASSI
  semResultado?: string; // complemento de "Nenhum cliente encontrado." (quem não aparece e por quê)
  onEscolher: (id: string) => void;
  aoEscolherJaNaLista?: (id: string) => void;
  desabilitado?: boolean;
}) {
  const [busca, setBusca] = useState('');
  const q = normalizarBusca(busca);
  const resultados = useMemo(
    () => (q ? candidatos.filter((c) => normalizarBusca(`${c.nome} ${c.carteirinha || ''}`).includes(q)).slice(0, 8) : []),
    [candidatos, q],
  );

  return (
    <div className="relative">
      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder={placeholder}
        aria-label={rotulo}
        disabled={desabilitado}
        className="h-9 text-sm"
      />
      {resultados.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg overflow-hidden max-h-64 overflow-y-auto" aria-label="Resultados da busca">
          {resultados.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                disabled={!!c.semOutraGuia}
                onClick={() => {
                  if (c.jaNaLista) (aoEscolherJaNaLista ?? onEscolher)(c.id);
                  else onEscolher(c.id);
                  setBusca('');
                }}
                className={cn('w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 disabled:opacity-60', c.jaNaLista && 'min-h-11')}
              >
                <Plus className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden />
                <span className="flex-1 min-w-0">
                  <span className="block truncate">{c.nome}</span>
                  {c.jaNaLista && <span className="block text-[11px] text-muted-foreground">já na lista · {c.semOutraGuia ?? 'adicionar outra guia'}</span>}
                </span>
                {c.encerrado && <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 shrink-0">{rotuloEncerrado}</span>}
                {c.carteirinha && <span className="text-[11px] text-muted-foreground shrink-0">{c.carteirinha}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {q && resultados.length === 0 && (
        <p className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg px-3 py-2 text-xs text-muted-foreground" role="status">
          Nenhum cliente encontrado. {semResultado}
        </p>
      )}
    </div>
  );
}
