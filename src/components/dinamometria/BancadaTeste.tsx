import { Bluetooth, Check, Clock, Minus, Play, Plus, RotateCcw, Timer, Repeat, Pause, Hourglass, ArrowDownUp, ArrowLeftRight, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { StatusCelula } from '@/lib/dinamometria/celulaBle';
import type { Lado } from '@/lib/dinamometria/analise';
import { cn } from '@/lib/utils';

export interface ProtocoloTeste {
  tempoForca: number;
  repeticoes: number;
  descanso: number;
  preparo: number;
  lado: Lado;
  grupo: 'ag' | 'an';
  ordem: 'grupo' | 'lado';
}

export interface EtapaBancada {
  id: string;
  titulo: string;
  lado: Lado;
  // Pico capturado (kgf) — null se ainda não foi feito; erro se a curva não serviu.
  picoKgf: number | null;
  erro?: string | null;
}

function Passo({ icone: Icone, rotulo, valor, unidade, min, max, passo = 1, onChange }: {
  icone: typeof Timer; rotulo: string; valor: number; unidade: string; min: number; max: number; passo?: number; onChange: (v: number) => void;
}) {
  const ajustar = (d: number) => onChange(Math.min(max, Math.max(min, valor + d)));
  return (
    <div className="rounded-xl border border-border/60 bg-background p-2.5 flex flex-col gap-1.5">
      <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1"><Icone className="h-3.5 w-3.5" />{rotulo}</p>
      <div className="flex items-center justify-between gap-1">
        <button type="button" aria-label={`Diminuir ${rotulo}`} onClick={() => ajustar(-passo)} disabled={valor <= min}
          className="h-8 w-8 shrink-0 rounded-lg border border-border/70 flex items-center justify-center hover:bg-muted disabled:opacity-40">
          <Minus className="h-3.5 w-3.5" />
        </button>
        <p className="text-xl font-bold tabular-nums leading-none text-center">
          {valor}<span className="text-xs font-medium text-muted-foreground ml-0.5">{unidade}</span>
        </p>
        <button type="button" aria-label={`Aumentar ${rotulo}`} onClick={() => ajustar(passo)} disabled={valor >= max}
          className="h-8 w-8 shrink-0 rounded-lg border border-border/70 flex items-center justify-center hover:bg-muted disabled:opacity-40">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function Segmentado<T extends string>({ valor, opcoes, onChange }: { valor: T; opcoes: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="grid rounded-xl bg-muted/60 p-1 gap-1" style={{ gridTemplateColumns: `repeat(${opcoes.length}, minmax(0, 1fr))` }}>
      {opcoes.map(([v, l]) => (
        <button key={v} type="button" onClick={() => onChange(v)} aria-pressed={valor === v}
          className={cn('rounded-lg px-2 py-1.5 text-xs font-medium transition-colors truncate', valor === v ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
          {l}
        </button>
      ))}
    </div>
  );
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * Bancada do teste de força com a célula: aparelho, protocolo, por onde começar
 * e a sequência de etapas com o andamento (pico de cada uma) — é a área de
 * trabalho da dinamometria.
 */
export default function BancadaTeste({ status, bateria, proto, onProto, etapas, nomeAg, nomeAn, titulo, onConectar, onIniciar, onCapturarUma }: {
  status: StatusCelula;
  bateria: number | null;
  proto: ProtocoloTeste;
  onProto: (p: ProtocoloTeste) => void;
  etapas: EtapaBancada[];
  nomeAg: string;
  nomeAn: string;
  titulo: string;
  onConectar: () => void;
  onIniciar: (ids: string[]) => void;
  onCapturarUma: (id: string) => void;
}) {
  const set = (patch: Partial<ProtocoloTeste>) => onProto({ ...proto, ...patch });
  const feitas = etapas.filter((e) => e.picoKgf != null).length;
  const pendentes = etapas.filter((e) => e.picoKgf == null);
  // Tempo estimado: contagem + força + descansos de cada etapa, mais ~15 s para reposicionar.
  const porEtapa = proto.preparo * proto.repeticoes + proto.tempoForca * proto.repeticoes + proto.descanso * (proto.repeticoes - 1) + 15;
  const minutos = Math.max(1, Math.round((porEtapa * (pendentes.length || etapas.length)) / 60));
  const progresso = etapas.length ? (feitas / etapas.length) * 100 : 0;

  return (
    <div className="rounded-2xl border border-primary/25 bg-card overflow-hidden shadow-sm">
      {/* Cabeçalho: título e aparelho */}
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Bancada de teste</p>
            <p className="text-lg font-bold leading-tight truncate">{titulo}</p>
          </div>
          {status.conectado ? (
            <div className="shrink-0 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
              <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">{status.nome}</span>
              {bateria != null && (
                <span className="flex items-end gap-px ml-0.5" aria-label={`Bateria ${bateria} de 3`}>
                  {[1, 2, 3].map((n) => <span key={n} className={cn('w-1 rounded-sm', n <= bateria ? 'bg-emerald-600' : 'bg-emerald-600/25')} style={{ height: 4 + n * 2 }} />)}
                </span>
              )}
            </div>
          ) : (
            <Button size="sm" className="shrink-0 gap-1.5 rounded-full" onClick={onConectar}>
              <Bluetooth className="h-3.5 w-3.5" /> Conectar célula
            </Button>
          )}
        </div>
        {etapas.length > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
              <span>{feitas} de {etapas.length} etapas</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />≈ {minutos} min {feitas ? 'restantes' : 'no total'}</span>
            </div>
            <div className="h-1.5 rounded-full bg-primary/10 overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${progresso}%` }} /></div>
          </div>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Protocolo */}
        <section className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Protocolo</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Passo icone={Timer} rotulo="Força" valor={proto.tempoForca} unidade="s" min={1} max={30} onChange={(v) => set({ tempoForca: v })} />
            <Passo icone={Repeat} rotulo="Repetições" valor={proto.repeticoes} unidade="×" min={1} max={10} onChange={(v) => set({ repeticoes: v })} />
            <Passo icone={Pause} rotulo="Descanso" valor={proto.descanso} unidade="s" min={0} max={180} passo={5} onChange={(v) => set({ descanso: v })} />
            <Passo icone={Hourglass} rotulo="Contagem" valor={proto.preparo} unidade="s" min={1} max={10} onChange={(v) => set({ preparo: v })} />
          </div>
          {proto.tempoForca < 4 && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Com menos de 4 s de força a fadiga e a curva de falha do platô não são calculadas.</p>
          )}
        </section>

        {/* Por onde começar */}
        <section className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Por onde começar</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Segmentado valor={proto.lado} opcoes={[['D', 'Direito'], ['E', 'Esquerdo']]} onChange={(v) => set({ lado: v })} />
            <Segmentado valor={proto.grupo} opcoes={[['ag', nomeAg], ['an', nomeAn]]} onChange={(v) => set({ grupo: v })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {([['grupo', 'Músculo a músculo', 'mesmo músculo D e E, depois o outro', ArrowLeftRight], ['lado', 'Lado a lado', 'os dois músculos de um lado, depois o outro', ArrowDownUp]] as const).map(([v, l, d, Ic]) => (
              <button key={v} type="button" onClick={() => set({ ordem: v })} aria-pressed={proto.ordem === v}
                className={cn('rounded-xl border p-2.5 text-left transition-colors', proto.ordem === v ? 'border-primary bg-primary/5' : 'border-border/60 hover:bg-muted/50')}>
                <p className="text-xs font-semibold flex items-center gap-1.5"><Ic className="h-3.5 w-3.5 text-primary" />{l}</p>
                <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{d}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Sequência */}
        <section className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sequência</p>
          <ol className="space-y-1.5">
            {etapas.map((e, i) => {
              const feito = e.picoKgf != null;
              return (
                <li key={e.id} className={cn('flex items-center gap-2.5 rounded-xl border px-2.5 py-2', feito ? 'border-emerald-500/30 bg-emerald-500/5' : e.erro ? 'border-amber-400/50 bg-amber-50/50 dark:bg-amber-900/10' : 'border-border/60')}>
                  <span className={cn('h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold', feito ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground')}>
                    {feito ? <Check className="h-4 w-4" /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: e.lado === 'D' ? '#2A78D6' : '#EB6834' }} />{e.titulo}
                    </p>
                    {feito ? <p className="text-[11px] text-emerald-700 dark:text-emerald-400 tabular-nums">pico {fmt(e.picoKgf!)} kgf</p>
                      : e.erro ? <p className="text-[11px] text-amber-700 dark:text-amber-400 truncate">{e.erro}</p>
                      : <p className="text-[11px] text-muted-foreground">aguardando</p>}
                  </div>
                  <Button size="sm" variant="ghost" className="h-8 px-2 text-xs gap-1 shrink-0" disabled={!status.conectado} onClick={() => onCapturarUma(e.id)}>
                    {feito ? <><RotateCcw className="h-3.5 w-3.5" /> Refazer</> : <><Play className="h-3.5 w-3.5" /> Só esta</>}
                  </Button>
                </li>
              );
            })}
          </ol>
        </section>

        <div className="space-y-1.5">
          {pendentes.length > 0 && feitas > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-11" disabled={!status.conectado} onClick={() => onIniciar(etapas.map((e) => e.id))}>Refazer tudo</Button>
              <Button className="h-11 gap-2" disabled={!status.conectado} onClick={() => onIniciar(pendentes.map((e) => e.id))}><Play className="h-4 w-4" /> Continuar ({pendentes.length})</Button>
            </div>
          ) : (
            <Button className="w-full h-12 gap-2 text-base" disabled={!status.conectado || !etapas.length} onClick={() => onIniciar(etapas.map((e) => e.id))}>
              <Play className="h-4 w-4" /> {feitas === etapas.length && feitas > 0 ? 'Refazer o teste' : 'Iniciar teste'}
            </Button>
          )}
          {!status.conectado && <p className="text-[11px] text-center text-muted-foreground">Conecte a célula para iniciar. Sem célula, use os arquivos do Excel abaixo.</p>}
        </div>
      </div>
    </div>
  );
}
