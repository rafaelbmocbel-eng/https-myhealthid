import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import CaixaRostoArrastavel from '@/components/angular/video/CaixaRostoArrastavel';
import { PASSO_TECLA, PASSO_TECLA_GRANDE } from '@/lib/angular/video/caixaFixaRosto';

/*
 * jsdom não tem PointerEvent nem layout: o evento de ponteiro é um MouseEvent com os campos que o componente lê, e a camada da caixa
 * "mede" 200 x 400 px na tela (a escala é 1000 px de canvas para 200 px de tela).
 */
class EventoDePonteiro extends MouseEvent {
  pointerId: number;
  pointerType: string;
  constructor(tipo: string, init: PointerEventInit = {}) {
    super(tipo, init);
    this.pointerId = init.pointerId ?? 1;
    this.pointerType = init.pointerType ?? 'touch';
  }
}

beforeAll(() => {
  Object.defineProperty(window, 'PointerEvent', { configurable: true, writable: true, value: EventoDePonteiro });
});

const LARGURA = 1000, ALTURA = 2000;
const AREA = { x: 0, y: 200, w: 1000, h: 1000 };
const TAMANHO = { w: 0.2, h: 0.1 };

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 400, width: 200, height: 400, toJSON: () => ({}) });
  Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', { configurable: true, writable: true, value: vi.fn() });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function montar(extra: Partial<React.ComponentProps<typeof CaixaRostoArrastavel>> = {}) {
  const aoMudar = vi.fn();
  render(<CaixaRostoArrastavel larguraCanvas={LARGURA} alturaCanvas={ALTURA} areaVideo={AREA} posicao={{ cx: 0.5, cy: 0.5 }} tamanho={TAMANHO} aoMudar={aoMudar} {...extra} />);
  return { aoMudar, caixa: screen.getByTestId('caixa-rosto-arrastavel') };
}

const ultima = (m: ReturnType<typeof vi.fn>) => m.mock.calls[m.mock.calls.length - 1][0] as { cx: number; cy: number };

describe('caixa do rosto arrastável', () => {
  it('é um alvo focável, com rótulo em português que explica o arrasto e as setas', () => {
    const { caixa } = montar();
    expect(caixa).toHaveAttribute('tabindex', '0');
    expect(caixa).toHaveAttribute('role', 'group');
    expect(caixa.getAttribute('aria-label')).toMatch(/Cobertura do rosto/);
    expect(caixa.getAttribute('aria-label')).toMatch(/Arraste ou use as setas do teclado/);
    expect(caixa.getAttribute('aria-roledescription')).toBe('caixa arrastável');
  });

  it('fica sobre o rosto: a posição e o tamanho saem em porcentagem do canvas, a partir da área do vídeo', () => {
    montar({ posicao: { cx: 0.25, cy: 0.5 } });
    const contorno = screen.getByTestId('contorno-caixa-rosto');
    // centro x = 0,25 do vídeo = 25% do canvas; centro y = (200 + 0,5 * 1000) / 2000 = 35%
    expect(contorno.style.left).toBe('25%');
    expect(contorno.style.top).toBe('35%');
    expect(contorno.style.width).toBe('20%');
    expect(contorno.style.height).toBe('5%');
  });

  it('a área de toque tem no mínimo 44 px mesmo com a caixa pequena, e não deixa a página rolar durante o arrasto', () => {
    const { caixa } = montar();
    expect(caixa.style.minWidth).toBe('44px');
    expect(caixa.style.minHeight).toBe('44px');
    expect(caixa.className).toContain('touch-none');
  });

  it('a camada acompanha a proporção do canvas', () => {
    montar();
    expect(screen.getByTestId('area-caixa-rosto').style.aspectRatio.replace(/\s/g, '')).toBe('1000/2000');
  });

  it('arrastar com o dedo move o centro pela diferença do ponteiro (px da tela -> fração do quadro do vídeo)', () => {
    const { aoMudar, caixa } = montar();
    fireEvent.pointerDown(caixa, { pointerId: 1, clientX: 100, clientY: 100 });
    // 20 px na tela = 10% da largura da camada = 0,1 do quadro do vídeo; 40 px de 400 = 10% da altura do canvas = 0,2 do quadro (vídeo com metade da altura)
    fireEvent.pointerMove(caixa, { pointerId: 1, clientX: 120, clientY: 140 });
    const p = ultima(aoMudar);
    expect(p.cx).toBeCloseTo(0.6, 9);
    expect(p.cy).toBeCloseTo(0.7, 9);
    fireEvent.pointerUp(caixa, { pointerId: 1, clientX: 120, clientY: 140 });
  });

  it('o ponteiro é capturado, para o arrasto seguir mesmo quando o dedo sai da caixa', () => {
    const { caixa } = montar();
    fireEvent.pointerDown(caixa, { pointerId: 7, clientX: 10, clientY: 10 });
    expect(HTMLElement.prototype.setPointerCapture).toHaveBeenCalledWith(7);
  });

  it('funciona também sem captura de ponteiro (o navegador a recusa)', () => {
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', { configurable: true, writable: true, value: () => { throw new Error('sem captura'); } });
    const { aoMudar, caixa } = montar();
    fireEvent.pointerDown(caixa, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(caixa, { pointerId: 1, clientX: 20, clientY: 0 });
    expect(ultima(aoMudar).cx).toBeCloseTo(0.6, 9);
  });

  it('o mouse só arrasta com o botão principal', () => {
    const { aoMudar, caixa } = montar();
    fireEvent.pointerDown(caixa, { pointerId: 1, pointerType: 'mouse', button: 2, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(caixa, { pointerId: 1, pointerType: 'mouse', clientX: 50, clientY: 50 });
    expect(aoMudar).not.toHaveBeenCalled();
    fireEvent.pointerDown(caixa, { pointerId: 2, pointerType: 'mouse', button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(caixa, { pointerId: 2, pointerType: 'mouse', clientX: 20, clientY: 0 });
    expect(aoMudar).toHaveBeenCalledTimes(1);
  });

  it('a caixa não sai do quadro: arrastar para longe para na borda e, voltando, ela volta a seguir o dedo', () => {
    const { aoMudar, caixa } = montar();
    fireEvent.pointerDown(caixa, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(caixa, { pointerId: 1, clientX: 9000, clientY: 9000 });
    expect(ultima(aoMudar)).toEqual({ cx: 1 - TAMANHO.w / 2, cy: 1 - TAMANHO.h / 2 });
    fireEvent.pointerMove(caixa, { pointerId: 1, clientX: -9000, clientY: -9000 });
    expect(ultima(aoMudar)).toEqual({ cx: TAMANHO.w / 2, cy: TAMANHO.h / 2 });
    fireEvent.pointerMove(caixa, { pointerId: 1, clientX: 110, clientY: 100 });
    expect(ultima(aoMudar).cx).toBeCloseTo(0.55, 9);
    expect(ultima(aoMudar).cy).toBeCloseTo(0.5, 9);
  });

  it('só o ponteiro que começou o arrasto o conduz, e depois de soltar nada mais se move', () => {
    const { aoMudar, caixa } = montar();
    fireEvent.pointerDown(caixa, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(caixa, { pointerId: 2, clientX: 50, clientY: 50 });
    expect(aoMudar).not.toHaveBeenCalled();
    fireEvent.pointerUp(caixa, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(caixa, { pointerId: 1, clientX: 50, clientY: 50 });
    expect(aoMudar).not.toHaveBeenCalled();
  });

  it('o toque cancelado (o sistema tomou o gesto) encerra o arrasto', () => {
    const { aoMudar, caixa } = montar();
    fireEvent.pointerDown(caixa, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerCancel(caixa, { pointerId: 1 });
    fireEvent.pointerMove(caixa, { pointerId: 1, clientX: 50, clientY: 50 });
    expect(aoMudar).not.toHaveBeenCalled();
  });

  it('as setas movem a caixa e o Shift aumenta o passo', () => {
    const { aoMudar, caixa } = montar();
    fireEvent.keyDown(caixa, { key: 'ArrowRight' });
    expect(ultima(aoMudar).cx).toBeCloseTo(0.5 + PASSO_TECLA, 9);
    fireEvent.keyDown(caixa, { key: 'ArrowLeft', shiftKey: true });
    expect(ultima(aoMudar).cx).toBeCloseTo(0.5 - PASSO_TECLA_GRANDE, 9);
    fireEvent.keyDown(caixa, { key: 'ArrowUp' });
    expect(ultima(aoMudar).cy).toBeCloseTo(0.5 - PASSO_TECLA, 9);
    fireEvent.keyDown(caixa, { key: 'ArrowDown', shiftKey: true });
    expect(ultima(aoMudar).cy).toBeCloseTo(0.5 + PASSO_TECLA_GRANDE, 9);
  });

  it('as setas também param na borda do quadro', () => {
    const { aoMudar, caixa } = montar({ posicao: { cx: 1 - TAMANHO.w / 2, cy: TAMANHO.h / 2 } });
    fireEvent.keyDown(caixa, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(caixa, { key: 'ArrowUp', shiftKey: true });
    expect(ultima(aoMudar)).toEqual({ cx: 1 - TAMANHO.w / 2, cy: TAMANHO.h / 2 });
  });

  it('outras teclas passam adiante (Tab segue a ordem de foco) e as setas não rolam a página', () => {
    const { aoMudar, caixa } = montar();
    expect(fireEvent.keyDown(caixa, { key: 'Tab' })).toBe(true);
    expect(fireEvent.keyDown(caixa, { key: 'Enter' })).toBe(true);
    expect(aoMudar).not.toHaveBeenCalled();
    expect(fireEvent.keyDown(caixa, { key: 'ArrowDown' })).toBe(false);
  });

  it('depois de mover pelas setas, avisa a nova posição em texto para o leitor de tela', () => {
    const { caixa } = montar({ posicao: { cx: 0.4, cy: 0.3 } });
    fireEvent.keyDown(caixa, { key: 'ArrowRight', shiftKey: true });
    expect(screen.getByRole('status')).toHaveTextContent('Caixa a 45% da esquerda e a 30% do alto do quadro.');
  });

  it('sem área do vídeo (canvas ainda vazio) não desenha nada', () => {
    const { container } = render(<CaixaRostoArrastavel larguraCanvas={0} alturaCanvas={0} areaVideo={{ x: 0, y: 0, w: 0, h: 0 }} posicao={{ cx: 0.5, cy: 0.5 }} tamanho={TAMANHO} aoMudar={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
