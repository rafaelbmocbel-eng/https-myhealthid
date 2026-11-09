import { useEffect, useRef, useState } from 'react';
import type { BufferCircular } from '@/lib/emg/bufferCircular';
import { cn } from '@/lib/utils';
import {
  ESCALA_MINIMA_UV,
  JANELA_GRAFICO_S,
  desenharSinal,
  lerCoresDoTema,
  maiorAbsoluto,
  numeroPt,
  proximaEscala,
  type CoresGrafico,
} from './desenho';

// Com "reduzir movimento" ligado no sistema, o traçado deixa de rolar suave: atualiza poucas vezes por segundo.
const INTERVALO_MOVIMENTO_REDUZIDO_MS = 500;

interface Props {
  buffer: BufferCircular;
  /** Taxa do sinal (Hz); null enquanto o módulo não mandou nada. */
  fsHz: number | null;
  /** Congela o desenho (o sinal continua sendo recebido e gravado). */
  congelado: boolean;
  janelaS?: number;
  className?: string;
}

/**
 * Gráfico do sinal ao vivo em canvas. Quem desenha é um laço de requestAnimationFrame que lê direto do
 * buffer circular: chegar amostra nova NÃO renderiza o React (só a escala, quando muda de degrau).
 */
export default function GraficoAoVivo({ buffer, fsHz, congelado, janelaS = JANELA_GRAFICO_S, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fsRef = useRef(fsHz);
  const congeladoRef = useRef(congelado);
  const instantaneoRef = useRef<Float64Array | null>(null);
  const reduzirRef = useRef(false);
  const temaRef = useRef(0);
  const escalaMostradaRef = useRef<number>(ESCALA_MINIMA_UV);
  const [escala, setEscala] = useState<number>(ESCALA_MINIMA_UV);
  const [reduzirMovimento, setReduzirMovimento] = useState(false);

  useEffect(() => {
    fsRef.current = fsHz;
  }, [fsHz]);

  // Ao congelar, guarda uma cópia da janela de agora: o buffer segue andando por baixo.
  useEffect(() => {
    congeladoRef.current = congelado;
    if (congelado) instantaneoRef.current = buffer.ultimas(Math.round((fsRef.current ?? 0) * janelaS));
    else instantaneoRef.current = null;
  }, [congelado, buffer, janelaS]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const consulta = window.matchMedia('(prefers-reduced-motion: reduce)');
    const aplicar = (): void => {
      reduzirRef.current = consulta.matches;
      setReduzirMovimento(consulta.matches);
    };
    aplicar();
    consulta.addEventListener?.('change', aplicar);
    return () => consulta.removeEventListener?.('change', aplicar);
  }, []);

  // Tema claro e escuro: o canvas não herda o CSS, então as cores são lidas de novo quando a classe do <html> muda.
  useEffect(() => {
    if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;
    const observador = new MutationObserver(() => {
      temaRef.current++;
    });
    observador.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    return () => observador.disconnect();
  }, []);

  useEffect(() => {
    let quadroId = 0;
    let ultimaChave = '';
    let ultimoDesenho = -Infinity;
    let escalaAtual: number | null = null;
    let cores: CoresGrafico | null = null;
    let versaoDasCores = -1;

    const quadro = (agora: number): void => {
      quadroId = requestAnimationFrame(quadro);
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (reduzirRef.current && agora - ultimoDesenho < INTERVALO_MOVIMENTO_REDUZIDO_MS) return;

      const largura = canvas.clientWidth;
      const altura = canvas.clientHeight;
      if (largura < 2 || altura < 2) return;
      const tamanhoJanela = Math.round((fsRef.current ?? 0) * janelaS);
      const congeladoAgora = congeladoRef.current;
      const chave = `${buffer.totalRecebido}|${largura}|${altura}|${temaRef.current}|${congeladoAgora ? 'c' : 'v'}|${tamanhoJanela}`;
      if (chave === ultimaChave) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ultimaChave = chave;
      ultimoDesenho = agora;

      const dpr = window.devicePixelRatio || 1;
      const larguraPx = Math.round(largura * dpr);
      const alturaPx = Math.round(altura * dpr);
      if (canvas.width !== larguraPx) canvas.width = larguraPx;
      if (canvas.height !== alturaPx) canvas.height = alturaPx;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (cores === null || versaoDasCores !== temaRef.current) {
        cores = lerCoresDoTema();
        versaoDasCores = temaRef.current;
      }
      const amostras = congeladoAgora && instantaneoRef.current ? instantaneoRef.current : buffer.ultimas(tamanhoJanela);
      escalaAtual = proximaEscala(escalaAtual, maiorAbsoluto(amostras));
      if (escalaAtual !== escalaMostradaRef.current) {
        escalaMostradaRef.current = escalaAtual;
        setEscala(escalaAtual);
      }
      desenharSinal(ctx, { largura, altura, amostras, tamanhoJanela, janelaS, escala: escalaAtual, cores });
    };

    quadroId = requestAnimationFrame(quadro);
    return () => cancelAnimationFrame(quadroId);
  }, [buffer, janelaS]);

  return (
    <div className={cn('space-y-1.5', className)}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Sinal do músculo ao vivo. O valor em números está logo acima."
        className="block h-40 w-full rounded-lg border border-border/60 bg-card sm:h-52"
        data-testid="grafico-ao-vivo"
      />
      <p className="text-[11px] leading-snug text-muted-foreground" data-testid="grafico-legenda">
        Últimos {janelaS} s · escala de ±{numeroPt(escala, 0)} µV (ajusta sozinha){congelado ? ' · gráfico congelado' : ''}
        {reduzirMovimento ? ' · movimento reduzido: atualiza 2 vezes por segundo' : ''}
      </p>
    </div>
  );
}
