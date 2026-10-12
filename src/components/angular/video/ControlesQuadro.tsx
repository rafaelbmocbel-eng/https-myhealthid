import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VELOCIDADES, formatarSegundos, limitar, type MarcaScrubber } from '@/lib/angular/analiseVideo/tempo';
import { COR_LADO } from '@/lib/angular/analiseVideo/tiposUi';

const FOLGA_PX = 12;

/**
 * Barra de quadros do vídeo: arrastar com o dedo ou usar o teclado muda o quadro. Mostra os quadros corrigidos
 * (bolinha amarela) e os eventos (risco azul = direito, laranja = esquerdo; o contato é mais alto que a saída).
 */
export function BarraQuadros({ quadro, nQuadros, marcas, aoIr }: { quadro: number; nQuadros: number; marcas: MarcaScrubber[]; aoIr: (i: number) => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  const arrastando = useRef(false);
  const ultimo = Math.max(0, nQuadros - 1);
  const pct = ultimo === 0 ? 0 : (quadro / ultimo) * 100;
  const posicao = (p: number) => `calc(${FOLGA_PX}px + (100% - ${FOLGA_PX * 2}px) * ${p / 100})`;

  const doToque = (e: PointerEvent) => {
    const r = caixa.current?.getBoundingClientRect();
    if (!r || ultimo === 0) return;
    const f = limitar((e.clientX - r.left - FOLGA_PX) / Math.max(1, r.width - FOLGA_PX * 2), 0, 1);
    aoIr(Math.round(f * ultimo));
  };
  const teclas = (e: KeyboardEvent) => {
    const passo = e.shiftKey ? 10 : 1;
    const mapa: Record<string, number> = { ArrowLeft: quadro - passo, ArrowDown: quadro - passo, ArrowRight: quadro + passo, ArrowUp: quadro + passo, PageDown: quadro - 10, PageUp: quadro + 10, Home: 0, End: ultimo };
    if (e.key in mapa) { e.preventDefault(); aoIr(limitar(mapa[e.key], 0, ultimo)); }
  };

  return (
    <div
      ref={caixa} role="slider" tabIndex={0} aria-label="Quadro do vídeo" aria-valuemin={1} aria-valuemax={Math.max(1, nQuadros)} aria-valuenow={quadro + 1} aria-valuetext={`Quadro ${quadro + 1} de ${nQuadros}`}
      className="relative h-12 w-full cursor-pointer touch-none select-none rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="barra-quadros"
      onKeyDown={teclas}
      onPointerDown={(e) => { arrastando.current = true; e.currentTarget.setPointerCapture(e.pointerId); doToque(e); }}
      onPointerMove={(e) => { if (arrastando.current) doToque(e); }}
      onPointerUp={() => { arrastando.current = false; }}
      onPointerCancel={() => { arrastando.current = false; }}
    >
      <div className="absolute inset-x-3 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-muted" />
      <div className="absolute left-3 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary/50" style={{ width: `calc((100% - ${FOLGA_PX * 2}px) * ${pct / 100})` }} />
      {marcas.map((m) => (m.tipo === 'corrigido' ? (
        <span key={m.chave} aria-hidden data-marca="corrigido" className="absolute top-[7px] h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-amber-400 ring-2 ring-background" style={{ left: posicao(m.pct) }} />
      ) : (
        <span
          key={m.chave} aria-hidden data-marca={m.tipo}
          className={cn('absolute w-[3px] -translate-x-1/2 rounded-full', m.tipo === 'contato' ? 'bottom-[5px] h-3.5' : 'bottom-[5px] h-2')}
          style={{ left: posicao(m.pct), background: m.lado ? COR_LADO[m.lado] : '#71717a' }}
        />
      )))}
      <span aria-hidden className="absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow-md" style={{ left: posicao(pct) }} />
    </div>
  );
}

const botaoBase = 'flex h-12 w-full items-center justify-center rounded-xl border border-border bg-background text-foreground transition-colors hover:bg-muted/60 active:scale-[0.97] disabled:opacity-40';

interface ControlesProps {
  quadro: number;
  nQuadros: number;
  t: number;
  tocando: boolean;
  velocidade: number;
  marcas: MarcaScrubber[];
  aoIr: (i: number) => void;
  aoPasso: (n: number) => void;
  aoAlternar: () => void;
  aoVelocidade: (v: number) => void;
}

// Barra de quadros, botões de quadro anterior e próximo e velocidades de câmera lenta.
export default function ControlesQuadro({ quadro, nQuadros, t, tocando, velocidade, marcas, aoIr, aoPasso, aoAlternar, aoVelocidade }: ControlesProps) {
  return (
    <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-2.5" role="group" aria-label="Controles do vídeo">
      <BarraQuadros quadro={quadro} nQuadros={nQuadros} marcas={marcas} aoIr={aoIr} />
      <div className="grid grid-cols-5 gap-1.5">
        <button type="button" className={botaoBase} aria-label="Voltar 10 quadros" onClick={() => aoPasso(-10)}><ChevronsLeft className="h-5 w-5" /></button>
        <button type="button" className={botaoBase} aria-label="Quadro anterior" onClick={() => aoPasso(-1)}><ChevronLeft className="h-5 w-5" /></button>
        <button type="button" className={cn(botaoBase, 'border-primary bg-primary text-primary-foreground hover:bg-primary/90')} aria-label={tocando ? 'Pausar' : 'Reproduzir'} aria-pressed={tocando} onClick={aoAlternar}>
          {tocando ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
        <button type="button" className={botaoBase} aria-label="Próximo quadro" onClick={() => aoPasso(1)}><ChevronRight className="h-5 w-5" /></button>
        <button type="button" className={botaoBase} aria-label="Avançar 10 quadros" onClick={() => aoPasso(10)}><ChevronsRight className="h-5 w-5" /></button>
      </div>
      <div className="flex items-center gap-2">
        <div className="grid flex-1 grid-cols-4 gap-1.5" role="group" aria-label="Velocidade de reprodução">
          {VELOCIDADES.map((v) => (
            <button key={v} type="button" aria-pressed={velocidade === v} onClick={() => aoVelocidade(v)}
              className={cn('flex h-11 items-center justify-center rounded-xl border text-sm font-semibold tabular-nums transition-colors', velocidade === v ? 'border-primary bg-primary/10' : 'border-border/60 hover:bg-muted/50')}>
              {v.toLocaleString('pt-BR')}×
            </button>
          ))}
        </div>
      </div>
      <p className="text-center text-xs font-medium tabular-nums text-muted-foreground" role="status" aria-live="off" data-testid="posicao-quadro">
        Quadro {quadro + 1} de {nQuadros} · {formatarSegundos(t)}
      </p>
    </div>
  );
}
