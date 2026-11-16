import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { nomeDaFonteParaExibir } from '@/lib/resumoClinico/exibicao';
import { MOTIVO_DATA_NAO_VALIDA, NOME_DA_FONTE_DO_MARCO } from '@/lib/resumoClinico/tipos';
import type { RegistroIgnorado } from '@/lib/resumoClinico/tipos';

// Avisa quantos registros ficaram fora da linha do tempo e, ao tocar, mostra QUAL e por quê. A lista fica sempre montada
// (só escondida) para o aria-controls do botão apontar para um id que existe.
export default function RegistrosDeFora({ registros }: { registros: RegistroIgnorado[] }) {
  const [aberta, setAberta] = useState(false);
  if (registros.length === 0) return null;
  const quantos = registros.length;
  return (
    <div className="space-y-1">
      <button
        type="button"
        aria-expanded={aberta}
        aria-controls="linha-do-tempo-fora"
        onClick={() => setAberta((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-border/40 bg-muted/30 px-3 py-2 text-left text-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="min-w-0 break-words">
          {quantos} {quantos === 1 ? 'registro ficou' : 'registros ficaram'} de fora: {MOTIVO_DATA_NAO_VALIDA}.
        </span>
        <ChevronDown className={cn('icon-xs shrink-0 transition-transform', aberta && 'rotate-180')} aria-hidden="true" />
      </button>
      <ul id="linha-do-tempo-fora" hidden={!aberta} className="space-y-2 px-1 pt-1">
        {registros.map((registro, i) => {
          const fonte = nomeDaFonteParaExibir(registro.rotulo, NOME_DA_FONTE_DO_MARCO[registro.fonte]);
          return (
            <li key={`${registro.id}:${i}`} className="min-w-0 space-y-0.5 border-l-2 border-dashed border-border/60 pl-3">
              <p className="break-words text-sm font-medium leading-snug text-foreground">{registro.rotulo}</p>
              <p className="break-words text-xs text-muted-foreground">{fonte ? `${fonte} · ${registro.motivo}` : registro.motivo}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
