import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  arcoDoAngulo, coresDoRotulo, escalaDoEstilo, escalaNaTela, ESTILOS, ESTILO_INSTAGRAM, ESTILO_PADRAO, estilosIguais, larguraDoTexto, lerEstilo, normalizarEstilo,
  rotuloGraus, rotuloValor, salvarEstilo,
} from '../lib/angular/estilo';

const P = (x: number, y: number) => ({ x, y });

describe('estilo das marcações', () => {
  afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

  it('tem as predefinições nomeadas e o Instagram é verde e grosso', () => {
    expect(ESTILOS.map((e) => e.nome)).toEqual(['Padrão', 'Instagram', 'Alto contraste', 'Fino']);
    expect(ESTILO_INSTAGRAM.espessura).toBeGreaterThanOrEqual(8);
    expect(ESTILO_INSTAGRAM.cor).toBe('#4caf50');
    expect(ESTILO_INSTAGRAM.casasRotulo).toBe(0);
    for (const { estilo } of ESTILOS) {
      expect(estilo.espessura).toBeGreaterThanOrEqual(2);
      expect(estilo.espessura).toBeLessThanOrEqual(14);
    }
  });

  it('a escala segue o menor lado da foto e o zoom só da tela', () => {
    expect(escalaDoEstilo(2000, 1000)).toBe(1);
    expect(escalaDoEstilo(3000, 4000)).toBe(3);
    expect(escalaDoEstilo(1000, 1000, 4)).toBeCloseTo(0.5, 6);
    expect(escalaDoEstilo(1000, 1000, 0.5)).toBe(1);
  });

  it('na tela pequena o rótulo nunca fica menor que o mínimo legível', () => {
    // foto de 3000 px mostrada em 300 px: 0,1 px de tela por px de foto
    const k = escalaNaTela(3, 0.1, 40);
    expect(40 * k * 0.1).toBeGreaterThanOrEqual(12 - 1e-9);
    expect(escalaNaTela(3, 1, 40)).toBe(3);
    expect(escalaNaTela(3, 0, 40)).toBe(3);
  });

  it('formata o rótulo em graus, cm e %', () => {
    expect(rotuloGraus(118.4)).toBe('118°');
    expect(rotuloGraus(118.44, 1)).toBe('118,4°');
    expect(rotuloValor(12.34, 'cm')).toBe('12,3 cm');
    expect(rotuloValor(2.06, '%')).toBe('2,1%');
    expect(rotuloValor(144.2, 'graus', 0)).toBe('144°');
  });

  it('arco do ângulo: valor, sentido e posição do rótulo', () => {
    const horario = arcoDoAngulo(P(0, 0), P(10, 0), P(0, 10), 10);
    expect(horario.anguloGraus).toBeCloseTo(90, 6);
    expect(horario.path).toBe('M 10 0 A 10 10 0 0 1 0 10');
    expect(horario.delta).toBeGreaterThan(0);
    // bissetriz a 45°, mais longe que o arco
    expect(horario.posicaoRotulo.x).toBeGreaterThan(10);
    expect(horario.posicaoRotulo.x).toBeCloseTo(horario.posicaoRotulo.y, 6);
    const anti = arcoDoAngulo(P(0, 0), P(0, 10), P(10, 0), 10);
    expect(anti.path).toBe('M 0 10 A 10 10 0 0 0 10 0');
    expect(anti.delta).toBeLessThan(0);
    expect(arcoDoAngulo(P(0, 0), P(-10, 0), P(10, 0), 10).anguloGraus).toBeCloseTo(180, 6);
    expect(arcoDoAngulo(P(5, 5), P(5, 5), P(10, 0), 10).path).toBe('');
  });

  it('com a caixa do rótulo, ele fica encostado fora do arco sem invadi-lo', () => {
    const caixa = { w: 100, h: 40 };
    const a = arcoDoAngulo(P(0, 0), P(100, 0), P(100, 100), 50, caixa);
    // bissetriz a 22,5°: a caixa precisa ficar além do raio
    const mais = Math.hypot(a.posicaoRotulo.x, a.posicaoRotulo.y);
    expect(mais).toBeGreaterThan(50 + 20);
  });

  it('grava e lê o estilo; JSON inválido ou fora dos limites volta ao seguro', () => {
    salvarEstilo({ ...ESTILO_INSTAGRAM, espessura: 11 });
    expect(lerEstilo().espessura).toBe(11);
    expect(estilosIguais(lerEstilo(), { ...ESTILO_INSTAGRAM, espessura: 11 })).toBe(true);
    localStorage.setItem('myid:angular:estilo-marcacao', '{nao e json');
    expect(lerEstilo()).toEqual(ESTILO_PADRAO);
    localStorage.setItem('myid:angular:estilo-marcacao', JSON.stringify({ espessura: 99, cor: 'vermelho', tamanhoRotulo: -4, mostrarArco: 'sim' }));
    const e = lerEstilo();
    expect(e.espessura).toBe(14);
    expect(e.cor).toBe(ESTILO_PADRAO.cor);
    expect(e.tamanhoRotulo).toBeGreaterThanOrEqual(24);
    expect(e.mostrarArco).toBe(ESTILO_PADRAO.mostrarArco);
  });

  it('sem armazenamento (janela privada) segue com o padrão e não quebra ao salvar', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado'); });
    expect(lerEstilo()).toEqual(ESTILO_PADRAO);
    expect(() => salvarEstilo(ESTILO_INSTAGRAM)).not.toThrow();
  });

  it('normalizarEstilo ignora lixo', () => {
    expect(normalizarEstilo(null)).toEqual(ESTILO_PADRAO);
    expect(normalizarEstilo('x')).toEqual(ESTILO_PADRAO);
  });

  it('rótulo Instagram: pílula branca, borda na cor das retas e texto verde mais escuro; padrão: texto com contorno', () => {
    const i = coresDoRotulo(ESTILO_INSTAGRAM);
    expect(i.fundo).toBe('#ffffff');
    expect(i.borda).toBe(ESTILO_INSTAGRAM.cor);
    expect(i.texto).not.toBe(i.borda);
    expect(i.contorno).toBeUndefined();
    const p = coresDoRotulo(ESTILO_PADRAO);
    expect(p.fundo).toBeUndefined();
    expect(p.contorno).toBe('#000000');
    expect(p.texto).toBe('#ffffff');
    // trocar a cor das retas leva a borda junto
    expect(coresDoRotulo({ ...ESTILO_INSTAGRAM, cor: '#3b82f6' }).borda).toBe('#3b82f6');
  });

  it('a largura estimada do texto cresce com o texto e com a fonte', () => {
    expect(larguraDoTexto('118°', 40)).toBeGreaterThan(larguraDoTexto('8°', 40));
    expect(larguraDoTexto('118°', 80)).toBeCloseTo(2 * larguraDoTexto('118°', 40), 6);
  });
});
