import { Plus, Ruler, Sparkles, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatarSegundos } from '@/lib/angular/analiseVideo/tempo';
import { textoDoValor } from '@/lib/angular/analiseVideo/medidaManual';
import { COR_REFERENCIA as COR_REF, ICONE_MEDIDA } from '@/components/angular/iconesMedida';
import { MEDIDAS_DO_PAINEL, type MedidasManuais } from './useMedidasManuais';

const nf = (n: number, d = 1) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

const botao = 'flex min-h-12 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition-colors disabled:opacity-40';

// Medidas feitas à mão no quadro parado: escolher a ferramenta, marcar os pontos (com lupa), guardar o valor com o instante.
export default function PainelMedidaManual({ m, temRastreio, tocando, aoIr }: { m: MedidasManuais; temRastreio: boolean; tocando: boolean; aoIr: (quadro: number) => void }) {
  const { medida, ehRef, ptsAtiva, proximo, pontos, refs, giro, cmPorPx, resultado, capturas, noTrecho, foraDoTrecho, trecho } = m;
  const trechoAtual = trecho ? `${formatarSegundos(trecho.inicio, 1)} a ${formatarSegundos(trecho.fim + trecho.passo, 1)}` : 'sem rastreio';
  const grupos = [
    { titulo: 'Ângulos no corpo', itens: MEDIDAS_DO_PAINEL.filter((x) => !x.auxiliar && /^(joelho|quadril|tornozelo|tronco)/.test(x.id)) },
    { titulo: 'Outras ferramentas', itens: MEDIDAS_DO_PAINEL.filter((x) => !x.auxiliar && !/^(joelho|quadril|tornozelo|tronco)/.test(x.id)) },
    { titulo: 'Referências do vídeo', itens: MEDIDAS_DO_PAINEL.filter((x) => x.auxiliar) },
  ];

  const sugerir = () => {
    const r = m.sugerir();
    if (r === 'sem_pose') toast.error('Faça o rastreio do corpo antes para o app sugerir os pontos.');
    else if (r === 'sem_pontos') toast.warning('Os pontos desta medida não estão nítidos neste quadro. Marque à mão ou escolha outro quadro.');
    else toast.success('Pontos sugeridos. Confira e arraste o que estiver fora do lugar.');
  };
  const guardar = () => { if (m.guardar()) toast.success('Medida guardada neste quadro.'); };
  const remover = (uid: string) => {
    const c = m.remover(uid);
    if (c) toast('Medida removida.', { action: { label: 'Desfazer', onClick: () => m.reinserir(c) } });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs leading-snug text-muted-foreground">Pare no quadro certo, escolha a ferramenta e toque na imagem para marcar cada ponto (a lupa ajuda a acertar). Arraste um ponto para ajustar.</p>
      {grupos.map((g) => (
        <section key={g.titulo} className="space-y-1.5" aria-label={g.titulo}>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.titulo}</h4>
          <div className="grid grid-cols-2 gap-1.5">
            {g.itens.map((x) => {
              const Icone = ICONE_MEDIDA[x.id] ?? Ruler;
              const n = (x.auxiliar ? refs[x.id] : pontos[x.id])?.length ?? 0;
              const ativa = medida?.id === x.id;
              return (
                <button key={x.id} type="button" aria-pressed={ativa} onClick={() => m.setAtivaId(ativa ? null : x.id)} data-testid={`ferramenta-${x.id}`}
                  className={cn(botao, 'min-h-14 justify-start py-1.5 text-left', ativa ? 'border-primary bg-primary/10' : 'border-border/60 hover:bg-muted/50')}>
                  <Icone className="h-4 w-4 shrink-0" style={!ativa && COR_REF[x.id] ? { color: COR_REF[x.id] } : undefined} aria-hidden />
                  <span className="min-w-0 flex-1 whitespace-normal text-left text-[13px] leading-tight">{x.nome}</span>
                  <span className={cn('text-[11px] tabular-nums', n >= x.pontos.length ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground')}>{n >= x.pontos.length ? '✓' : `${n}/${x.pontos.length}`}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {medida?.id === 'nivel' && (
        <div className="space-y-2 rounded-xl bg-muted/40 p-2.5 text-xs">
          <p className="text-muted-foreground">Marque 2 pontos sobre algo reto na vida real (chão, rodapé, fio de prumo) para corrigir o giro da imagem.</p>
          <div className="grid grid-cols-2 gap-1.5">
            {(['horizontal', 'vertical'] as const).map((tp) => (
              <button key={tp} type="button" aria-pressed={m.nivelTipo === tp} onClick={() => m.setNivelTipo(tp)} className={cn(botao, 'capitalize', m.nivelTipo === tp ? 'border-primary bg-primary/10' : 'border-border/60')}>{tp}</button>
            ))}
          </div>
          {giro !== null && <p className="font-medium">{Math.abs(giro) < 0.05 ? 'Imagem já está nivelada.' : `Imagem girada ${nf(Math.abs(giro))}°: os ângulos saem corrigidos.`}</p>}
        </div>
      )}
      {medida?.id === 'escala' && (
        <div className="space-y-2 rounded-xl bg-muted/40 p-2.5 text-xs">
          <p className="text-muted-foreground">Marque as pontas de um objeto de tamanho conhecido no plano do paciente e informe o comprimento.</p>
          <div className="flex items-center gap-2">
            <Input inputMode="decimal" value={m.escalaCm} onChange={(e) => m.setEscalaCm(e.target.value)} placeholder="Comprimento" className="h-11 text-[16px] sm:text-sm" aria-label="Comprimento do objeto em centímetros" />
            <span className="shrink-0 font-medium">cm</span>
          </div>
          {cmPorPx && <p className="font-medium text-emerald-700 dark:text-emerald-400">Escala calibrada: as distâncias saem em centímetros.</p>}
        </div>
      )}
      {medida?.id === 'regua' && !cmPorPx && <p className="rounded-xl bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">Para medir em centímetros, primeiro calibre a escala.</p>}

      {medida && (
        <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-3" data-testid="medida-em-andamento">
          <p className="text-xs" role="status">
            <strong>{medida.nome}.</strong>{' '}
            {tocando ? 'Pause o vídeo no quadro que quer medir.'
              : proximo ? <>Toque na imagem para marcar <strong>{ptsAtiva.length + 1}. {proximo}</strong>.</>
                : ehRef ? 'Referência completa. Arraste um ponto para ajustar.' : 'Medida completa. Guarde ou ajuste os pontos.'}
          </p>
          {resultado && <p className="text-sm font-medium tabular-nums" data-testid="resultado-manual">{resultado.texto}</p>}
          <div className="grid grid-cols-2 gap-1.5">
            {!ehRef && temRastreio && <button type="button" onClick={sugerir} disabled={tocando} className={cn(botao, 'border-border/60 hover:bg-muted/50')}><Sparkles className="h-4 w-4" aria-hidden /> Sugerir</button>}
            <button type="button" onClick={m.desfazerPonto} disabled={!ptsAtiva.length} className={cn(botao, 'border-border/60 hover:bg-muted/50')}><Undo2 className="h-4 w-4" aria-hidden /> Desfazer ponto</button>
            <button type="button" onClick={m.limpar} disabled={!ptsAtiva.length} className={cn(botao, 'border-border/60 hover:bg-muted/50')}><Trash2 className="h-4 w-4" aria-hidden /> Limpar</button>
            {!ehRef && <button type="button" onClick={guardar} disabled={!resultado || tocando} data-testid="guardar-medida" className={cn(botao, 'col-span-2 border-primary bg-primary text-primary-foreground hover:bg-primary/90')}><Plus className="h-4 w-4" aria-hidden /> Guardar medida neste quadro</button>}
          </div>
        </div>
      )}

      <section className="space-y-1.5" aria-label="Medidas guardadas">
        <h4 className="text-sm font-semibold">Medidas guardadas ({capturas.length})</h4>
        {capturas.length === 0 ? <p className="text-xs text-muted-foreground">Cada medida guardada fica com o instante do vídeo e entra no PDF.</p> : (
          <>
            {noTrecho.length > 0 && (
              <ul className="space-y-1.5">
                {noTrecho.map((c) => (
                  <li key={c.uid} className="flex items-center gap-1.5 rounded-xl border border-border/60 p-1.5 text-sm" data-testid="captura-manual">
                    <button type="button" className="min-h-11 min-w-0 flex-1 rounded-lg px-1.5 text-left hover:bg-muted/40" onClick={() => aoIr(c.quadro)} title="Ir para este quadro">
                      <span className="block truncate font-medium">{c.nome}: {textoDoValor(c.valor, c.unidade)}</span>
                      <span className="block text-[11px] tabular-nums text-muted-foreground">{formatarSegundos(c.t)} · quadro {c.quadro + 1}</span>
                    </button>
                    <button type="button" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10" aria-label="Remover medida" onClick={() => remover(c.uid)}><Trash2 className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
            )}
            {foraDoTrecho.length > 0 && (
              <div className="space-y-1.5 rounded-xl bg-muted/40 p-2" data-testid="medidas-fora-do-trecho">
                <p className="px-1 text-xs leading-snug text-muted-foreground">
                  {foraDoTrecho.length === 1 ? 'Esta medida está' : 'Estas medidas estão'} fora do trecho atual ({trechoAtual}): {foraDoTrecho.length === 1 ? 'fica' : 'ficam'} fora do gráfico, dos cartões, do PDF, do vídeo exportado, do resumo copiado e do registro no prontuário (o arquivo da análise guarda todas). Se o trecho voltar a incluir o instante, {foraDoTrecho.length === 1 ? 'ela volta' : 'elas voltam'} a valer.
                </p>
                <ul className="space-y-1.5">
                  {foraDoTrecho.map((c) => (
                    <li key={c.uid} className="flex items-center gap-1.5 rounded-xl border border-dashed border-border bg-background/60 p-1.5 text-sm" data-testid="captura-fora-do-trecho">
                      <span className="min-h-11 min-w-0 flex-1 px-1.5 py-0.5">
                        <span className="block truncate font-medium text-muted-foreground">{c.nome}: {textoDoValor(c.valor, c.unidade)}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] tabular-nums text-muted-foreground">
                          {formatarSegundos(c.t)}
                          <span className="rounded-full bg-muted px-2 py-0.5 font-medium">fora do trecho atual</span>
                        </span>
                      </span>
                      <button type="button" className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-destructive/40 px-2.5 text-xs font-semibold text-destructive hover:bg-destructive/10" aria-label={`Remover medida fora do trecho: ${c.nome}, ${formatarSegundos(c.t)}`} data-testid="remover-fora-do-trecho" onClick={() => remover(c.uid)}>
                        <Trash2 className="h-4 w-4" aria-hidden /> Remover
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
