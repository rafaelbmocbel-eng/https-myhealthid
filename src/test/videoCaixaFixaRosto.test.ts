import { describe, expect, it } from 'vitest';
import {
  PASSO_TECLA, PASSO_TECLA_GRANDE, caixaFixaNaPosicao, deslocamentoDaTecla, limitarCaixaAoQuadro, limitarPosicaoDaCaixa, moverPosicaoDaCaixa,
  posicaoPadraoDaCaixaFixa, proximoQuadroSemRosto, tamanhoCobertoDaCaixaFixa,
} from '@/lib/angular/video/caixaFixaRosto';
import { configurar, trilhaSintetica } from '@/lib/angular/video/figuraSintetica';
import { FOLGA_ROSTO_VIDEO, ajusteTotalDoRosto } from '@/lib/angular/video/exportarVideo';
import { caixasDoRosto, type OrigemCaixa } from '@/lib/angular/video/rostoPorQuadro';
import { caixaRostoPadrao, escalarCaixaRosto, type CaixaRosto } from '@/lib/social/rosto';

const bordas = (c: CaixaRosto) => ({ esq: c.cx - c.w / 2, dir: c.cx + c.w / 2, topo: c.cy - c.h / 2, base: c.cy + c.h / 2 });

describe('caixa fixa do rosto: limite à área do quadro', () => {
  it('uma caixa que já cabe no quadro fica como está', () => {
    const c: CaixaRosto = { cx: 0.4, cy: 0.3, w: 0.2, h: 0.1 };
    expect(limitarCaixaAoQuadro(c)).toEqual(c);
  });

  it('empurra a caixa para dentro por cada uma das quatro bordas, sem mudar o tamanho', () => {
    expect(limitarCaixaAoQuadro({ cx: -0.3, cy: 0.5, w: 0.2, h: 0.2 })).toEqual({ cx: 0.1, cy: 0.5, w: 0.2, h: 0.2 });
    expect(limitarCaixaAoQuadro({ cx: 1.4, cy: 0.5, w: 0.2, h: 0.2 })).toEqual({ cx: 0.9, cy: 0.5, w: 0.2, h: 0.2 });
    expect(limitarCaixaAoQuadro({ cx: 0.5, cy: -2, w: 0.2, h: 0.3 })).toEqual({ cx: 0.5, cy: 0.15, w: 0.2, h: 0.3 });
    const base = limitarCaixaAoQuadro({ cx: 0.5, cy: 9, w: 0.2, h: 0.3 });
    expect(base.cy).toBeCloseTo(0.85, 12);
    expect(bordas(base).base).toBeCloseTo(1, 12);
  });

  it('caixa do tamanho do quadro (ou maior) fica no centro, com tamanho no máximo 1', () => {
    expect(limitarCaixaAoQuadro({ cx: 0.1, cy: 0.9, w: 1, h: 1 })).toEqual({ cx: 0.5, cy: 0.5, w: 1, h: 1 });
    expect(limitarCaixaAoQuadro({ cx: 0.1, cy: 0.9, w: 3, h: 1.5 })).toEqual({ cx: 0.5, cy: 0.5, w: 1, h: 1 });
  });

  it('tamanho negativo vira zero e valores que não são número viram o centro (nunca NaN)', () => {
    expect(limitarCaixaAoQuadro({ cx: 0.5, cy: 0.5, w: -1, h: -1 })).toEqual({ cx: 0.5, cy: 0.5, w: 0, h: 0 });
    const c = limitarCaixaAoQuadro({ cx: Number.NaN, cy: Infinity, w: Number.NaN, h: 0.2 });
    expect(Object.values(c).every(Number.isFinite)).toBe(true);
    expect(c.cx).toBe(0.5);
    expect(c.w).toBe(0);
  });

  it('para qualquer entrada o resultado tem as quatro bordas entre 0 e 1', () => {
    let semente = 7;
    const aleatorio = () => { semente = (semente * 16807) % 2147483647; return semente / 2147483647; };
    for (let i = 0; i < 500; i++) {
      const c = limitarCaixaAoQuadro({ cx: aleatorio() * 4 - 1.5, cy: aleatorio() * 4 - 1.5, w: aleatorio() * 1.6 - 0.1, h: aleatorio() * 1.6 - 0.1 });
      const b = bordas(c);
      expect(b.esq).toBeGreaterThanOrEqual(-1e-12);
      expect(b.topo).toBeGreaterThanOrEqual(-1e-12);
      expect(b.dir).toBeLessThanOrEqual(1 + 1e-12);
      expect(b.base).toBeLessThanOrEqual(1 + 1e-12);
    }
  });

  it('limitarPosicaoDaCaixa usa o tamanho que a caixa cobre de verdade', () => {
    const tamanho = { w: 0.4, h: 0.2 };
    expect(limitarPosicaoDaCaixa({ cx: 0, cy: 0 }, tamanho)).toEqual({ cx: 0.2, cy: 0.1 });
    expect(limitarPosicaoDaCaixa({ cx: 1, cy: 1 }, tamanho)).toEqual({ cx: 0.8, cy: 0.9 });
    expect(limitarPosicaoDaCaixa({ cx: 0.5, cy: 0.5 }, tamanho)).toEqual({ cx: 0.5, cy: 0.5 });
  });
});

describe('caixa fixa do rosto: mover', () => {
  const tamanho = { w: 0.2, h: 0.1 };

  it('soma o deslocamento (em fração do quadro) e para na borda', () => {
    const p = moverPosicaoDaCaixa({ cx: 0.5, cy: 0.5 }, 0.1, -0.2, tamanho);
    expect(p.cx).toBeCloseTo(0.6, 12);
    expect(p.cy).toBeCloseTo(0.3, 12);
    expect(moverPosicaoDaCaixa({ cx: 0.5, cy: 0.5 }, 5, 5, tamanho)).toEqual({ cx: 0.9, cy: 0.95 });
    expect(moverPosicaoDaCaixa({ cx: 0.5, cy: 0.5 }, -5, -5, tamanho)).toEqual({ cx: 0.1, cy: 0.05 });
  });

  it('um deslocamento que não é número não move a caixa', () => {
    expect(moverPosicaoDaCaixa({ cx: 0.4, cy: 0.4 }, Number.NaN, Infinity, tamanho)).toEqual({ cx: 0.4, cy: 0.4 });
  });

  it('a posição de partida é a da caixa padrão da arte social (no alto, ao centro) e a caixa fixa leva o tamanho de partida', () => {
    const padrao = caixaRostoPadrao(540, 960);
    expect(posicaoPadraoDaCaixaFixa(540, 960)).toEqual({ cx: padrao.cx, cy: padrao.cy });
    expect(caixaFixaNaPosicao(540, 960, null)).toEqual(padrao);
    const movida = caixaFixaNaPosicao(540, 960, { cx: 0.3, cy: 0.6 });
    expect(movida).toEqual({ ...padrao, cx: 0.3, cy: 0.6 });
  });

  it('a caixa fixa pedida fora do quadro volta para dentro', () => {
    const c = caixaFixaNaPosicao(540, 960, { cx: 5, cy: -5 });
    const b = bordas(c);
    expect(b.dir).toBeLessThanOrEqual(1);
    expect(b.topo).toBeGreaterThanOrEqual(0);
  });
});

describe('caixa fixa do rosto: tamanho coberto', () => {
  it('é o tamanho que o desenho cobre de fato num quadro sem rosto (margem do módulo, folga do vídeo e controles do profissional)', () => {
    const trilha = trilhaSintetica(configurar('agachamento', { largura: 540, altura: 960 }), 30, 1, { ausentes: () => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] });
    const base = caixaFixaNaPosicao(trilha.largura, trilha.altura, { cx: 0.5, cy: 0.5 });
    for (const ajusteRosto of [undefined, { mulLargura: 1.5, mulAltura: 0.8 }, { mulLargura: 2.2, mulAltura: 2.2 }]) {
      const caixas = caixasDoRosto(trilha, { caixaFixa: base });
      expect(caixas.every((c) => c.origem === 'fixa')).toBe(true);
      const ajuste = ajusteTotalDoRosto({ ajusteRosto });
      const coberta = escalarCaixaRosto(caixas[10].caixa, ajuste.mulLargura, ajuste.mulAltura);
      const t = tamanhoCobertoDaCaixaFixa(base, ajuste);
      expect(t.w).toBeCloseTo(coberta.w, 12);
      expect(t.h).toBeCloseTo(coberta.h, 12);
    }
  });

  it('o ajuste total é a folga do vídeo vezes o ajuste do profissional', () => {
    expect(ajusteTotalDoRosto({})).toEqual(FOLGA_ROSTO_VIDEO);
    const a = ajusteTotalDoRosto({ ajusteRosto: { mulLargura: 2, mulAltura: 0.5 } });
    expect(a.mulLargura).toBeCloseTo(FOLGA_ROSTO_VIDEO.mulLargura * 2, 12);
    expect(a.mulAltura).toBeCloseTo(FOLGA_ROSTO_VIDEO.mulAltura * 0.5, 12);
    expect(ajusteTotalDoRosto({ folgaRosto: { mulLargura: 1, mulAltura: 1 }, ajusteRosto: { mulLargura: 1.2, mulAltura: 1.4 } })).toEqual({ mulLargura: 1.2, mulAltura: 1.4 });
  });

  it('nunca passa do quadro inteiro', () => {
    const t = tamanhoCobertoDaCaixaFixa({ cx: 0.5, cy: 0.5, w: 0.9, h: 0.9 }, { mulLargura: 2.2, mulAltura: 2.2 });
    expect(t).toEqual({ w: 1, h: 1 });
  });
});

describe('caixa fixa do rosto: teclado', () => {
  it('as quatro setas movem um passo pequeno; com Shift, o passo grande', () => {
    expect(deslocamentoDaTecla('ArrowLeft')).toEqual({ dx: -PASSO_TECLA, dy: 0 });
    expect(deslocamentoDaTecla('ArrowRight')).toEqual({ dx: PASSO_TECLA, dy: 0 });
    expect(deslocamentoDaTecla('ArrowUp')).toEqual({ dx: 0, dy: -PASSO_TECLA });
    expect(deslocamentoDaTecla('ArrowDown')).toEqual({ dx: 0, dy: PASSO_TECLA });
    expect(deslocamentoDaTecla('ArrowDown', true)).toEqual({ dx: 0, dy: PASSO_TECLA_GRANDE });
    expect(PASSO_TECLA_GRANDE).toBeGreaterThan(PASSO_TECLA);
  });

  it('qualquer outra tecla é ignorada', () => {
    for (const t of ['Enter', 'Tab', ' ', 'a', 'Home', 'Escape']) expect(deslocamentoDaTecla(t)).toBeNull();
  });
});

describe('caixa fixa do rosto: ir ao próximo quadro sem rosto localizado', () => {
  const o = (s: string): OrigemCaixa[] => [...s].map((c) => (c === 'f' ? 'fixa' : c === 'v' ? 'vizinho' : 'pose'));

  it('acha o próximo depois do quadro atual e volta ao começo do trecho quando acaba', () => {
    const origens = o('pppfppfpp');
    expect(proximoQuadroSemRosto(origens, 0, 0, 8)).toBe(3);
    expect(proximoQuadroSemRosto(origens, 3, 0, 8)).toBe(6);
    expect(proximoQuadroSemRosto(origens, 6, 0, 8)).toBe(3);
    expect(proximoQuadroSemRosto(origens, 8, 0, 8)).toBe(3);
  });

  it('só olha dentro do trecho escolhido', () => {
    const origens = o('fppppppppf');
    expect(proximoQuadroSemRosto(origens, 4, 1, 8)).toBeNull();
    expect(proximoQuadroSemRosto(origens, 4, 1, 9)).toBe(9);
    expect(proximoQuadroSemRosto(origens, 4, 0, 8)).toBe(0);
  });

  it('quadro vizinho não conta (a caixa fixa só vale onde a origem é fixa)', () => {
    expect(proximoQuadroSemRosto(o('ppvvpp'), 0, 0, 5)).toBeNull();
  });

  it('se o único quadro sem rosto é o atual devolve ele mesmo, e sem nenhum (ou sem trilha) devolve null', () => {
    expect(proximoQuadroSemRosto(o('ppfpp'), 2, 0, 4)).toBe(2);
    expect(proximoQuadroSemRosto(o('ppppp'), 2, 0, 4)).toBeNull();
    expect(proximoQuadroSemRosto([], 0, 0, 0)).toBeNull();
    expect(proximoQuadroSemRosto(o('fff'), 1, 5, 2)).toBeNull();
  });

  it('o quadro atual fora do trecho não atrapalha', () => {
    expect(proximoQuadroSemRosto(o('ppfppfpp'), 0, 3, 7)).toBe(5);
    expect(proximoQuadroSemRosto(o('ppfppfpp'), 7, 3, 7)).toBe(5);
  });
});
