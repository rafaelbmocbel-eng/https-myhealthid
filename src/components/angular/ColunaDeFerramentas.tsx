import { Ruler } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Medida, Ponto } from '@/lib/angular/medidas';
import { COR_REFERENCIA, ICONE_MEDIDA, LADO_MEDIDA } from './iconesMedida';
import { GRUPOS_DA_COLUNA } from './gruposDeMedida';

/** Coluna de ícones ao lado da foto: uma ferramenta por botão, em grupos (ferramentas, referências da foto, postura). */
export function ColunaDeFerramentas({ disponiveis, pontos, ativaId, aoAtivar, alturaMaxDvh }: {
  disponiveis: Medida[];
  pontos: Record<string, Ponto[]>;
  ativaId: string;
  aoAtivar: (medidaId: string) => void;
  alturaMaxDvh: number;
}) {
  return (
    <nav aria-label="Ferramentas de medida" className="flex w-14 shrink-0 flex-col gap-1 overflow-y-auto rounded-2xl border border-border/60 bg-card p-1" style={{ maxHeight: `${alturaMaxDvh}dvh` }}>
      {GRUPOS_DA_COLUNA.map((g, gi) => {
        const itens = disponiveis.filter((m) => m.grupo === g.id);
        if (!itens.length) return null;
        return (
          <div key={g.id} className="flex flex-col gap-1" role="group" aria-label={g.titulo}>
            {gi > 0 && <span className="mx-1 h-px bg-border" aria-hidden />}
            {itens.map((m) => {
              const Icone = ICONE_MEDIDA[m.id] ?? Ruler;
              const feita = (pontos[m.id]?.length ?? 0) >= m.pontos.length;
              const ativa = m.id === ativaId;
              return (
                <button key={m.id} type="button" onClick={() => aoAtivar(m.id)} aria-pressed={ativa} aria-label={m.nome} title={m.nome}
                  className={cn('relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors', ativa ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
                  <Icone className="h-5 w-5" style={!ativa && COR_REFERENCIA[m.id] ? { color: COR_REFERENCIA[m.id] } : undefined} />
                  {LADO_MEDIDA[m.id] && <span className="absolute bottom-0.5 right-0.5 text-[9px] font-bold leading-none">{LADO_MEDIDA[m.id]}</span>}
                  {feita && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-card" aria-hidden />}
                </button>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
