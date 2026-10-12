import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COR_SUGERIDAS, ESTILOS, LIMITES_ESTILO, estilosIguais, type EstiloMarcacao } from '@/lib/angular/estilo';

const botao = 'flex min-h-11 items-center justify-center rounded-xl border px-3 text-sm font-semibold transition-colors';

function Controle({ rotulo, valor, children }: { rotulo: string; valor?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{rotulo}</span>
        {valor && <span className="text-xs font-semibold tabular-nums">{valor}</span>}
      </div>
      {children}
    </div>
  );
}

function Deslizante({ rotulo, valor, min, max, passo = 1, aoMudar, texto }: { rotulo: string; valor: number; min: number; max: number; passo?: number; aoMudar: (v: number) => void; texto?: string }) {
  return (
    <Controle rotulo={rotulo} valor={texto ?? String(valor)}>
      <input type="range" min={min} max={max} step={passo} value={valor} aria-label={rotulo} onChange={(e) => aoMudar(Number(e.target.value))}
        className="h-11 w-full cursor-pointer touch-pan-x accent-primary" />
    </Controle>
  );
}

// Estilo das linhas de todas as medidas: vale para a tela, o PDF e a imagem baixada.
export default function PainelEstilo({ estilo, aoMudar, aoFechar }: { estilo: EstiloMarcacao; aoMudar: (e: EstiloMarcacao) => void; aoFechar: () => void }) {
  const mudar = (parte: Partial<EstiloMarcacao>) => aoMudar({ ...estilo, ...parte });
  return (
    <section aria-label="Estilo das linhas" className="space-y-3 rounded-2xl border border-border/60 bg-card p-3" data-testid="painel-estilo">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Estilo das linhas</p>
        <button type="button" onClick={aoFechar} aria-label="Fechar o estilo das linhas" className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="group" aria-label="Predefinições">
        {ESTILOS.map((p) => {
          const ativo = estilosIguais(estilo, p.estilo);
          return (
            <button key={p.id} type="button" aria-pressed={ativo} onClick={() => aoMudar(p.estilo)}
              className={cn(botao, ativo ? 'border-primary bg-primary/10' : 'border-border/60 hover:bg-muted/50')}>{p.nome}</button>
          );
        })}
      </div>

      <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        <Deslizante rotulo="Espessura das linhas" valor={estilo.espessura} min={LIMITES_ESTILO.espessura.min} max={LIMITES_ESTILO.espessura.max} aoMudar={(v) => mudar({ espessura: v })} />

        <Controle rotulo="Cor das linhas">
          <div className="flex flex-wrap items-center gap-1.5">
            {COR_SUGERIDAS.map((c) => (
              <button key={c} type="button" aria-label={`Cor ${c}`} aria-pressed={estilo.cor.toLowerCase() === c} onClick={() => mudar({ cor: c })}
                className={cn('h-9 w-9 rounded-full border-2', estilo.cor.toLowerCase() === c ? 'border-primary ring-2 ring-primary/40' : 'border-border')} style={{ background: c }} />
            ))}
            <label className="relative flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border" title="Outra cor">
              <span className="text-xs font-bold text-muted-foreground" aria-hidden>+</span>
              <input type="color" aria-label="Outra cor das linhas" value={/^#[0-9a-f]{6}$/i.test(estilo.cor) ? estilo.cor : '#4caf50'} onChange={(e) => mudar({ cor: e.target.value })}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
            </label>
          </div>
        </Controle>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" aria-pressed={estilo.mostrarArco} onClick={() => mudar({ mostrarArco: !estilo.mostrarArco })}
          className={cn(botao, estilo.mostrarArco ? 'border-primary bg-primary/10' : 'border-border/60 hover:bg-muted/50')}>Arco do ângulo</button>
        <button type="button" aria-pressed={estilo.mostrarRotulo} onClick={() => mudar({ mostrarRotulo: !estilo.mostrarRotulo })}
          className={cn(botao, estilo.mostrarRotulo ? 'border-primary bg-primary/10' : 'border-border/60 hover:bg-muted/50')}>Rótulo do ângulo</button>
      </div>

      {(estilo.mostrarArco || estilo.mostrarRotulo) && (
        <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
          {estilo.mostrarArco && <Deslizante rotulo="Tamanho do arco" valor={estilo.raioArco} min={LIMITES_ESTILO.raioArco.min} max={LIMITES_ESTILO.raioArco.max} passo={5} aoMudar={(v) => mudar({ raioArco: v })} texto={`${estilo.raioArco}`} />}
          {estilo.mostrarRotulo && (
            <>
              <Deslizante rotulo="Tamanho do rótulo" valor={estilo.tamanhoRotulo} min={LIMITES_ESTILO.tamanhoRotulo.min} max={LIMITES_ESTILO.tamanhoRotulo.max} passo={2} aoMudar={(v) => mudar({ tamanhoRotulo: v })} texto={`${estilo.tamanhoRotulo}`} />
              <Controle rotulo="Casas decimais do ângulo">
                <div className="grid grid-cols-2 gap-1.5">
                  {([[0, '118°'], [1, '118,4°']] as const).map(([c, exemplo]) => (
                    <button key={c} type="button" aria-pressed={(estilo.casasRotulo ?? 1) === c} onClick={() => mudar({ casasRotulo: c })}
                      className={cn(botao, (estilo.casasRotulo ?? 1) === c ? 'border-primary bg-primary/10' : 'border-border/60 hover:bg-muted/50')}>{exemplo}</button>
                  ))}
                </div>
              </Controle>
            </>
          )}
        </div>
      )}
      <p className="text-[11px] leading-snug text-muted-foreground">Vale para todas as medidas, para o PDF e para a imagem baixada. Os tamanhos acompanham o tamanho da foto.</p>
    </section>
  );
}
