import { afterEach, describe, expect, it, vi } from 'vitest';
import { protegerRosto } from '@/lib/social/borrar';
import { janelaDaImagem } from '@/lib/social/geometria';

interface Chamada { nome: string; fillStyle?: unknown }

/** Contexto 2D que só anota o que foi pedido: o jsdom não tem canvas, e aqui interessa o QUE é desenhado. */
function contextoGravador() {
  const chamadas: Chamada[] = [];
  const estado: Record<string, unknown> = { fillStyle: '#000' };
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(t, prop: string) {
      if (prop in t) return t[prop];
      return () => { chamadas.push({ nome: prop, fillStyle: estado.fillStyle }); };
    },
    set(t, prop: string, v) {
      t[prop] = v;
      if (prop === 'fillStyle') estado.fillStyle = v;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, chamadas };
}

const caixa = { x: 0, y: 0, w: 1080, h: 1080 };
const rosto = { cx: 0.5, cy: 0.2, w: 0.2, h: 0.2 };
const fonte = { width: 1080, height: 1080 } as unknown as CanvasImageSource;

afterEach(() => { vi.restoreAllMocks(); });

describe('protegerRosto: o rosto nunca segue sem cobertura em silêncio', () => {
  it('sem canvas temporário para o desfoque (memória esgotada), a tarja sólida cobre o rosto', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const { ctx, chamadas } = contextoGravador();
    const j = janelaDaImagem(caixa, 1080, 1080, 'inteira');
    expect(protegerRosto(ctx, fonte, 1080, 1080, j, caixa, rosto, 'desfoque')).toBe(true);
    expect(chamadas.some((c) => c.nome === 'fill' && c.fillStyle === '#080c16')).toBe(true);
    expect(chamadas.some((c) => c.nome === 'drawImage')).toBe(false);
  });

  it('a tarja pedida desenha a tarja; o enquadramento inválido avisa que nada foi coberto', () => {
    const { ctx, chamadas } = contextoGravador();
    const j = janelaDaImagem(caixa, 1080, 1080, 'inteira');
    expect(protegerRosto(ctx, fonte, 1080, 1080, j, caixa, rosto, 'tarja')).toBe(true);
    expect(chamadas.some((c) => c.nome === 'fill' && c.fillStyle === '#080c16')).toBe(true);
    const invalida = janelaDaImagem({ x: 0, y: 0, w: 0, h: 0 }, 1080, 1080, 'inteira');
    const outra = contextoGravador();
    expect(protegerRosto(outra.ctx, fonte, 1080, 1080, invalida, caixa, rosto, 'desfoque')).toBe(false);
    expect(outra.chamadas).toHaveLength(0);
  });
});
