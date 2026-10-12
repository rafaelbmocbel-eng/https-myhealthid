import { describe, expect, it } from 'vitest';
import { OPCOES_ANALISE_PADRAO, calcularResultados, itensDaAnalise } from '@/lib/angular/analise';
import { medidasParaComparar, parearMedidas } from '@/lib/angular/comparar';
import { analiseDoPainel, pontosSemOcultas, pontosSemReferencias, referenciasDaFoto } from '@/lib/angular/compararPaineis';
import { ESTILO_INSTAGRAM } from '@/lib/angular/estilo';
import type { Ponto } from '@/lib/angular/medidas';

const p = (x: number, y: number): Ponto => ({ x, y });
const base = { nivelTipo: 'horizontal' as const, escalaCm: '', giroBase: null, cmPorPxBase: null };

describe('referências de cada foto', () => {
  it('nível e escala marcados valem mais que os de origem', () => {
    const r = referenciasDaFoto({ ...base, pontos: { nivel: [p(0, 0), p(100, 10)], escala: [p(0, 0), p(100, 0)] }, escalaCm: '20,5', giroBase: 1, cmPorPxBase: 9 });
    expect(r.giro).toBeCloseTo(5.71, 1);
    expect(r.cmPorPx).toBeCloseTo(0.205, 6);
  });

  it('sem marcação usa o giro e a escala de origem', () => {
    expect(referenciasDaFoto({ ...base, pontos: {}, giroBase: -2.5, cmPorPxBase: 0.1 })).toEqual({ giro: -2.5, cmPorPx: 0.1 });
    expect(referenciasDaFoto({ ...base, pontos: { escala: [p(0, 0), p(10, 0)] }, escalaCm: 'abc', cmPorPxBase: 0.3 }).cmPorPx).toBe(0.3);
  });

  it('a semente descarta os pontos de nível e escala, já resolvidos em giro e escala', () => {
    const pontos = { ombros: [p(1, 1), p(2, 2)], nivel: [p(0, 0), p(9, 9)], escala: [p(0, 0), p(5, 5)], altura: [p(0, 0), p(0, 90)] };
    expect(Object.keys(pontosSemReferencias(pontos))).toEqual(['ombros', 'altura']);
  });

  it('medidas escondidas somem dos pontos', () => {
    const pontos = { ombros: [p(1, 1)], pelve: [p(2, 2)] };
    expect(pontosSemOcultas(pontos, new Set())).toBe(pontos);
    expect(Object.keys(pontosSemOcultas(pontos, new Set(['ombros'])))).toEqual(['pelve']);
  });
});

describe('análise de cada painel com o núcleo de medidas', () => {
  const foto = { w: 1200, h: 1600, img: new Image() };
  const entrada = (pontos: Record<string, Ponto[]>, extra: Partial<Parameters<typeof analiseDoPainel>[0]> = {}) =>
    analiseDoPainel({ ...base, vista: 'frente', foto, pontos, opcoes: OPCOES_ANALISE_PADRAO, ...extra });

  it('monta a análise com o tamanho da foto e as opções', () => {
    const a = entrada({ ombros: [p(0, 0), p(10, 0)] });
    expect([a.largura, a.altura, a.vista]).toEqual([1200, 1600, 'frente']);
    expect(a.imagem).toBe(foto.img);
    expect(entrada({}, { foto: null }).largura).toBe(0);
  });

  it('compara a mesma medida marcada nas duas fotos', () => {
    const pre = entrada({ ombros: [p(100, 100), p(300, 130)], 'joelho-d': [p(100, 100), p(110, 300), p(100, 500)] });
    const pos = entrada({ ombros: [p(100, 100), p(300, 110)], 'joelho-d': [p(100, 100), p(102, 300), p(100, 500)] });
    const linhas = parearMedidas(medidasParaComparar(calcularResultados(pre)), medidasParaComparar(calcularResultados(pos)));
    expect(linhas.map((l) => l.id)).toEqual(['ombros', 'joelho-d']);
    expect(linhas[0]).toMatchObject({ diferenca: -5.6 });
    expect(linhas[0].antes?.graus).toBe(8.5);
    expect(linhas[1].diferenca).toBeGreaterThan(0);
  });

  it('o nível de cada foto corrige só os ângulos dela', () => {
    const pontos = { ombros: [p(0, 0), p(100, 17.63)] };
    const sem = calcularResultados(entrada(pontos))[0].valor;
    const com = calcularResultados(entrada(pontos, { giroBase: 10 }))[0].valor;
    expect(sem).toBeCloseTo(10, 1);
    expect(com).toBeLessThan(0.1);
  });

  it('o desenho de cada foto usa o mesmo estilo e leva o valor da medida no rótulo', () => {
    const a = entrada({ ombros: [p(100, 100), p(300, 130)] });
    const itens = itensDaAnalise(a, ESTILO_INSTAGRAM, { auxiliares: false });
    const rotulo = itens.find((i) => i.tipo === 'rotulo');
    expect(rotulo && 'texto' in rotulo ? rotulo.texto : '').toBe('9°');
    const reta = itens.find((i) => i.tipo === 'reta' && !i.tracejado);
    // Foto de 1200 px de menor lado: a espessura do estilo (para 1000 px) sai 1,2 vez maior.
    expect(reta && 'largura' in reta ? reta.largura : 0).toBeCloseTo(ESTILO_INSTAGRAM.espessura * 1.2, 6);
  });
});
