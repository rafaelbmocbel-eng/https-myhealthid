import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { createRef, type RefObject } from 'react';
import { BarraQuadros } from '../components/angular/video/ControlesQuadro';
import EscolherModelo from '../components/angular/video/EscolherModelo';
import GraficoAngulo from '../components/angular/video/GraficoAngulo';
import PlayerQuadros from '../components/angular/video/PlayerQuadros';
import { useReproducao } from '../components/angular/video/useReproducao';
import type { VideoCarregado } from '../lib/angular/analiseVideo/carregarVideo';
import type { ModeloUi } from '../lib/angular/analiseVideo/tiposUi';
import { ESTILO_PADRAO } from '../lib/angular/estilo';
import { tempoDeExibicao } from '../lib/angular/video/trilha';

afterEach(() => { cleanup(); vi.useRealTimers(); });

/** <video> falso: guarda cada busca de tempo, limita a taxa de reprodução (como o iPhone) e deixa o play() ser recusado. */
function videoFalso(o: { taxaMinima?: number; playRecusado?: boolean } = {}) {
  let taxa = 1;
  const buscas: number[] = [];
  const el = {
    currentTime: 0, paused: true, ended: false,
    get playbackRate() { return taxa; },
    set playbackRate(v: number) { taxa = Math.max(v, o.taxaMinima ?? 0.0625); },
    pause: vi.fn(() => { el.paused = true; }),
    play: vi.fn(() => (o.playRecusado ? Promise.reject(new Error('NotAllowedError')) : Promise.resolve())),
  };
  let tempo = 0;
  Object.defineProperty(el, 'currentTime', { get: () => tempo, set: (v: number) => { tempo = v; buscas.push(v); } });
  return { el: el as unknown as HTMLVideoElement, buscas, bruto: el };
}

describe('reprodução em passos (aparelho que não aceita a câmera lenta pedida)', () => {
  const tempos = [0, 0.1, 0.2, 0.3, 0.4];
  const montar = (v: ReturnType<typeof videoFalso>) => {
    const videoRef = { current: v.el } as RefObject<HTMLVideoElement>;
    return renderHook(() => useReproducao({ videoRef, tempos, fps: 10, ativo: true }));
  };

  beforeEach(() => { vi.useFakeTimers(); });

  it('a 0,25× num aparelho que só aceita 0,5× ou mais, o vídeo acompanha o contador a cada passo', () => {
    const v = videoFalso({ taxaMinima: 0.5 });
    const { result } = montar(v);
    act(() => { result.current.alternar(); });
    expect(result.current.tocando).toBe(true);
    expect(v.bruto.play).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(400); });
    expect(result.current.quadro).toBe(1);
    expect(v.buscas[v.buscas.length - 1]).toBeCloseTo(tempoDeExibicao(0.1, 10), 9);
    act(() => { vi.advanceTimersByTime(800); });
    expect(result.current.quadro).toBe(3);
    expect(v.buscas[v.buscas.length - 1]).toBeCloseTo(tempoDeExibicao(0.3, 10), 9);
    act(() => { vi.advanceTimersByTime(4000); });
    expect(result.current.quadro).toBe(4);
    expect(result.current.tocando).toBe(false);
  });

  it('se o navegador recusar o play(), troca para o modo em passos em vez de andar sobre imagem parada', async () => {
    const v = videoFalso({ playRecusado: true });
    const { result } = montar(v);
    await act(async () => { result.current.setVelocidade(1); });
    await act(async () => { result.current.alternar(); await Promise.resolve(); });
    expect(v.bruto.play).toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current.quadro).toBe(1);
    expect(v.buscas[v.buscas.length - 1]).toBeCloseTo(tempoDeExibicao(0.1, 10), 9);
  });

  it('pausar no meio volta o vídeo para o quadro parado', () => {
    const v = videoFalso({ taxaMinima: 0.5 });
    const { result } = montar(v);
    act(() => { result.current.alternar(); });
    act(() => { vi.advanceTimersByTime(800); });
    act(() => { result.current.alternar(); });
    expect(result.current.tocando).toBe(false);
    expect(result.current.quadro).toBe(2);
    expect(v.el.currentTime).toBeCloseTo(tempoDeExibicao(0.2, 10), 9);
  });
});

describe('seta na barra de quadros', () => {
  it('trata a tecla uma vez só: não deixa o atalho da janela somar o passo de novo', () => {
    const aoIr = vi.fn();
    const janela = vi.fn();
    window.addEventListener('keydown', janela);
    render(<BarraQuadros quadro={10} nQuadros={100} marcas={[]} aoIr={aoIr} />);
    const barra = screen.getByRole('slider', { name: 'Quadro do vídeo' });
    fireEvent.keyDown(barra, { key: 'ArrowRight' });
    expect(aoIr).toHaveBeenCalledTimes(1);
    expect(janela).not.toHaveBeenCalled();
    fireEvent.keyDown(barra, { key: ' ' });
    expect(janela).toHaveBeenCalledTimes(1);
    window.removeEventListener('keydown', janela);
  });
});

describe('taxa efetiva da análise', () => {
  const video: VideoCarregado = { url: 'blob:x', arquivo: new File([''], 'v.webm'), nome: 'v.webm', tamanho: 1000, duracao: 30, largura: 640, altura: 480 };
  const modelos: ModeloUi[] = [{ id: 'marcha', nome: 'Marcha (caminhada)', vista: 'Vista lateral', descricao: 'd', itens: [], comEventos: true }];
  const props = (taxaFps: number, fim: number) => ({
    video, modelos, modeloId: 'marcha', aoModelo: vi.fn(), fpsVideo: 60, aoFpsVideo: vi.fn(), taxaFps, aoTaxa: vi.fn(),
    intervalo: { inicio: 0, fim }, aoIntervalo: vi.fn(), avisos: [], aoRastrear: vi.fn(), aoSoMedir: vi.fn(), aoTrocarVideo: vi.fn(),
  });

  it('60 q/s num trecho de 30 s não cabe: diz o máximo, oferece as saídas e não deixa rastrear (nada é reduzido em silêncio)', () => {
    render(<EscolherModelo {...props(60, 30)} />);
    const aviso = screen.getByTestId('aviso-limite-trecho');
    expect(aviso).toHaveTextContent(/não cabe a 60 q\/s: o máximo é 20 s/);
    expect(screen.getByTestId('sugerir-taxa')).toHaveTextContent('Para 30 s use até 40 q/s');
    expect(screen.getByTestId('botao-rastrear')).toBeDisabled();
    expect(screen.queryByTestId('aviso-taxa-reduzida')).toBeNull();
  });

  it('trecho que cabe no limite não avisa e deixa rastrear', () => {
    render(<EscolherModelo {...props(60, 20)} />);
    expect(screen.queryByTestId('aviso-limite-trecho')).toBeNull();
    expect(screen.getByTestId('botao-rastrear')).toBeEnabled();
    cleanup();
    render(<EscolherModelo {...props(30, 30)} />);
    expect(screen.queryByTestId('aviso-limite-trecho')).toBeNull();
  });
});

describe('legenda do sinal do ângulo no gráfico', () => {
  it('aparece embaixo do gráfico quando recebida', () => {
    const serie = { id: 'a', rotulo: 'D', lado: 'D' as const, cor: '#000', pontos: [{ t: 0, v: 1 }, { t: 1, v: 2 }] };
    const { rerender } = render(<GraficoAngulo titulo="Quadril" series={[serie]} t0={0} duracao={1} t={0} aoIrPara={() => {}} legendaSinal="Flexão do quadril (0° = em pé; negativo = extensão)." />);
    expect(screen.getByTestId('legenda-sinal')).toHaveTextContent('negativo = extensão');
    rerender(<GraficoAngulo titulo="Quadril" series={[serie]} t0={0} duracao={1} t={0} aoIrPara={() => {}} />);
    expect(screen.queryByTestId('legenda-sinal')).toBeNull();
  });
});

describe('alças fantasma no player', () => {
  const videoRef = createRef<HTMLVideoElement>() as RefObject<HTMLVideoElement>;
  const alcas = [{ nome: 'joelho_d', rotulo: 'Joelho direito' }, { nome: 'tornozelo_d', rotulo: 'Tornozelo direito' }];
  const base = {
    url: 'blob:x', largura: 640, altura: 480, videoRef, quadro: 3, nQuadros: 10, ligacoes: [], alcas, marcacoesDe: () => [], estilo: ESTILO_PADRAO,
    mostrarEsqueleto: true, mostrarAngulos: true, aoCorrigir: vi.fn(), aoDeslizar: vi.fn(),
  };

  it('ponto que o detector perdeu ganha uma alça tracejada na posição sugerida; o detectado fica com a alça normal', () => {
    render(<PlayerQuadros {...base} podeCorrigir pontos={{ joelho_d: { x: 100, y: 100 } }} fantasmas={{ tornozelo_d: { x: 110, y: 220 } }} />);
    expect(screen.getByTestId('alca-joelho_d')).toBeInTheDocument();
    const fantasma = screen.getByTestId('alca-fantasma-tornozelo_d');
    expect(fantasma).toHaveAttribute('aria-label', expect.stringMatching(/não detectado.*arraste para posicionar/));
    expect(fantasma.querySelectorAll('circle')[0]).toHaveAttribute('cx', '110');
    expect(screen.queryByTestId('alca-fantasma-joelho_d')).toBeNull();
  });

  it('quadro sem corpo detectado também oferece as alças tracejadas', () => {
    render(<PlayerQuadros {...base} podeCorrigir pontos={null} fantasmas={{ joelho_d: { x: 100, y: 200 }, tornozelo_d: { x: 100, y: 300 } }} />);
    expect(screen.getByTestId('alca-fantasma-joelho_d')).toBeInTheDocument();
    expect(screen.getByTestId('alca-fantasma-tornozelo_d')).toBeInTheDocument();
  });

  it('sem poder corrigir (tocando) ou sem sugestão, não há alça fantasma', () => {
    const { rerender } = render(<PlayerQuadros {...base} podeCorrigir={false} pontos={null} fantasmas={{ joelho_d: { x: 100, y: 200 } }} />);
    expect(screen.queryByTestId('alca-fantasma-joelho_d')).toBeNull();
    rerender(<PlayerQuadros {...base} podeCorrigir pontos={null} fantasmas={{}} />);
    expect(screen.queryByTestId('alca-fantasma-joelho_d')).toBeNull();
  });
});
