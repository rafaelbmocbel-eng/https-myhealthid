import { useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import ResumoCompleto from './ResumoCompleto';

type Visao = 'resumo' | 'completo';

const OPCOES: Array<{ id: Visao; rotulo: string }> = [
  { id: 'resumo', rotulo: 'Resumo' },
  { id: 'completo', rotulo: 'Completo' },
];

interface Props {
  pacienteId: string;
  // `resultado` da última avaliação do profissional.
  resultado: unknown;
  // Edições à mão da tela da avaliação (_secoes.editadas), com o que foi salvo nesta sessão.
  editadas?: unknown;
  // O cartão do Resumo de sempre (editável pelo lápis do cabeçalho), entregue pronto por quem monta a tela.
  resumo: ReactNode;
}

// Seletor "Resumo | Completo". O Resumo é o de hoje, sem mudança; o Completo é só leitura e calculado na hora.
export default function ResumoClinicoVisoes({ pacienteId, resultado, editadas, resumo }: Props) {
  const [visao, setVisao] = useState<Visao>('resumo');
  return (
    <div className="space-y-2.5">
      <div role="group" aria-label="Forma de ver o resumo clínico" className="inline-flex rounded-lg border border-border/60 bg-muted/40 p-0.5">
        {OPCOES.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={visao === o.id}
            onClick={() => setVisao(o.id)}
            className={cn(
              'min-h-11 min-w-[84px] rounded-md px-3 text-[12px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              visao === o.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.rotulo}
          </button>
        ))}
      </div>
      {visao === 'resumo' ? resumo : <ResumoCompleto pacienteId={pacienteId} resultado={resultado} editadas={editadas} />}
    </div>
  );
}
