import { describe, expect, it } from 'vitest';
import { posicaoDaLupa } from '../lib/angular/analiseVideo/lupa';

const base = { tamanho: 120, larguraCaixa: 372, margemTopoTela: 64 };

describe('posicaoDaLupa', () => {
  it('fica acima do dedo quando cabe na janela, mesmo passando do topo do player (vídeo deitado)', () => {
    // player de 210 px de altura a 207 px do topo da janela; ponto do joelho a 141 px do topo do player
    const p = posicaoDaLupa({ ...base, cx: 186, cy: 141, topoDaCaixaNaTela: 207 });
    expect(p.lado).toBe('acima');
    expect(p.top).toBe(141 - 120 - 32);
    expect(p.top).toBeLessThan(0);
    expect(p.left).toBe(186 - 60);
  });

  it('com o cabeçalho fixo no caminho, vai para o lado com mais espaço e nunca para baixo do dedo', () => {
    const p = posicaoDaLupa({ ...base, cx: 100, cy: 60, topoDaCaixaNaTela: 100 });
    expect(p.lado).toBe('direita');
    expect(p.left).toBe(132);
    expect(100 + p.top).toBeGreaterThanOrEqual(64);
    const q = posicaoDaLupa({ ...base, cx: 300, cy: 60, topoDaCaixaNaTela: 100 });
    expect(q.lado).toBe('esquerda');
    expect(q.left).toBe(300 - 32 - 120);
  });

  it('mantém a lupa dentro da largura da caixa', () => {
    const p = posicaoDaLupa({ ...base, cx: 5, cy: 300, topoDaCaixaNaTela: 300 });
    expect(p.left).toBeGreaterThanOrEqual(4);
    const q = posicaoDaLupa({ ...base, cx: 370, cy: 300, topoDaCaixaNaTela: 300 });
    expect(q.left + 120).toBeLessThanOrEqual(372 - 4);
  });

  it('só usa o espaço abaixo do dedo se nem acima nem os lados couberem', () => {
    const p = posicaoDaLupa({ cx: 100, cy: 20, tamanho: 120, larguraCaixa: 200, topoDaCaixaNaTela: 70, margemTopoTela: 64 });
    expect(p.lado).toBe('abaixo');
    expect(p.top).toBe(20 + 32);
  });
});
