import { describe, expect, it } from 'vitest';
import { estatisticas, janelaEmAmostras, preencherLacunas, suavizar } from '../lib/angular/video/suavizar';
import { aleatorio } from '../lib/angular/video/detectorFalso';

const rms = (a: (number | null)[], b: number[]) => Math.sqrt(a.reduce<number>((s, v, i) => s + ((v as number) - b[i]) ** 2, 0) / a.length);

describe('suavizar', () => {
  it('Savitzky–Golay de grau 2 reproduz exatamente uma parábola, inclusive nas pontas', () => {
    const serie = Array.from({ length: 40 }, (_, i) => 3 + 0.5 * i - 0.02 * i * i);
    const s = suavizar(serie, 9, { metodo: 'savitzky_golay', ordem: 2 });
    s.forEach((v, i) => expect(v as number).toBeCloseTo(serie[i], 8));
  });

  it('média móvel mantém série constante e reta no miolo', () => {
    expect(suavizar(Array(20).fill(7), 5, { metodo: 'media_movel' }).every((v) => Math.abs((v as number) - 7) < 1e-12)).toBe(true);
    const reta = Array.from({ length: 30 }, (_, i) => 2 * i);
    const s = suavizar(reta, 5, { metodo: 'media_movel' });
    for (let i = 2; i < 28; i++) expect(s[i] as number).toBeCloseTo(reta[i], 9);
  });

  it('reduz o ruído sem achatar o pico: o Savitzky–Golay erra menos que a média móvel', () => {
    const rnd = aleatorio(7);
    const limpa = Array.from({ length: 200 }, (_, i) => 60 * Math.sin((2 * Math.PI * i) / 50));
    const ruidosa = limpa.map((v) => v + (rnd() - 0.5) * 8);
    const sg = suavizar(ruidosa, 9);
    const mm = suavizar(ruidosa, 9, { metodo: 'media_movel' });
    expect(rms(sg, limpa)).toBeLessThan(rms(ruidosa, limpa));
    expect(rms(sg, limpa)).toBeLessThan(rms(mm, limpa));
    const pico = (s: (number | null)[]) => Math.max(...(s as number[]));
    expect(Math.abs(pico(sg) - 60)).toBeLessThan(Math.abs(pico(mm) - 60) + 1e-9);
  });

  it('nunca altera a série recebida e devolve um array novo', () => {
    const serie = Object.freeze([1, 5, 2, 8, 3, 9, 4]) as number[];
    const s = suavizar(serie, 3);
    expect(s).not.toBe(serie);
    expect(serie).toEqual([1, 5, 2, 8, 3, 9, 4]);
  });

  it('os pesos do Savitzky–Golay são os clássicos: (−3, 12, 17, 12, −3)/35 na janela de 5 e (−2, 3, 6, 7, 6, 3, −2)/21 na de 7 (grau 2)', () => {
    const impulso = (n: number, pos: number) => Array.from({ length: n }, (_, i) => (i === pos ? 1 : 0));
    const cinco = suavizar(impulso(21, 10), 5) as number[];
    expect([8, 9, 10, 11, 12].map((i) => cinco[i] * 35)).toEqual([-3, 12, 17, 12, -3].map((x) => expect.closeTo(x, 9)));
    const sete = suavizar(impulso(31, 15), 7) as number[];
    expect([12, 13, 14, 15, 16, 17, 18].map((i) => sete[i] * 21)).toEqual([-2, 3, 6, 7, 6, 3, -2].map((x) => expect.closeTo(x, 9)));
    // fora da janela nada vaza
    expect(cinco[5]).toBeCloseTo(0, 12);
    expect(cinco[15]).toBeCloseTo(0, 12);
  });

  it('o caminho rápido (janela completa) e o geral (perto de lacunas e das pontas) concordam', () => {
    const serie = Array.from({ length: 60 }, (_, i) => Math.sin(i / 5) * 30 + (i % 7));
    const comLacuna = [...serie] as (number | null)[];
    comLacuna[40] = null;
    const a = suavizar(serie, 7) as number[], b = suavizar(comLacuna, 7) as (number | null)[];
    for (let i = 0; i < 33; i++) expect(b[i] as number).toBeCloseTo(a[i], 9);
    for (let i = 47; i < 60; i++) expect(b[i] as number).toBeCloseTo(a[i], 9);
    expect(b[40]).toBeNull();
  });

  it('mantém as lacunas como null e usa as amostras válidas vizinhas', () => {
    const serie = [1, 2, 3, null, 5, 6, 7, undefined, 9, 10, 11];
    const s = suavizar(serie, 5, { metodo: 'media_movel' });
    expect(s[3]).toBeNull();
    expect(s[7]).toBeNull();
    expect(s[4]).toBeCloseTo((3 + 5 + 6 + 7) / 4, 9);
    expect(s).toHaveLength(serie.length);
  });

  it('janela par vira ímpar; janela pequena ou série curta só copia; NaN vira null', () => {
    const serie = [1, 2, 3, 4, 5, 6, 7];
    expect(suavizar(serie, 2)).toEqual(serie);
    expect(suavizar(serie, 1)).toEqual(serie);
    expect(suavizar([1, 2], 5)).toEqual([1, 2]);
    expect(suavizar([1, Number.NaN, 3, 4, 5], 1)).toEqual([1, null, 3, 4, 5]);
    expect(suavizar([], 5)).toEqual([]);
    const par = suavizar([0, 0, 0, 10, 0, 0, 0], 4, { metodo: 'media_movel' });
    expect(par[3] as number).toBeCloseTo(10 / 5, 9);
  });

  it('grau 0 equivale à média móvel; grau maior que as amostras disponíveis não quebra', () => {
    const serie = [1, 3, 2, 8, 5, 4, 6];
    const a = suavizar(serie, 5, { metodo: 'savitzky_golay', ordem: 0 });
    const b = suavizar(serie, 5, { metodo: 'media_movel' });
    a.forEach((v, i) => expect(v as number).toBeCloseTo(b[i] as number, 9));
    expect(suavizar([1, 2, 3, 4, 5], 5, { ordem: 9 }).every((v) => Number.isFinite(v as number))).toBe(true);
  });

  it('séries circulares atravessam ±180° sem criar picos falsos', () => {
    const serie = [170, 175, 179, -178, -175, -170, -165];
    const s = suavizar(serie, 3, { metodo: 'media_movel', circular: true }) as number[];
    s.forEach((v) => expect(Math.abs(v) > 160).toBe(true));
    const errado = suavizar(serie, 3, { metodo: 'media_movel' }) as number[];
    expect(errado.some((v) => Math.abs(v) < 100)).toBe(true);
    expect(s.every((v) => v > -180 && v <= 180)).toBe(true);
  });

  it('janelaEmAmostras devolve sempre um número ímpar de pelo menos 3', () => {
    expect(janelaEmAmostras(0.12, 30)).toBe(5);
    expect(janelaEmAmostras(0.12, 60)).toBe(7);
    expect(janelaEmAmostras(0.01, 30)).toBe(3);
    expect(janelaEmAmostras(0.2, 15)).toBe(3);
    for (const fps of [10, 15, 24, 30, 60, 120]) expect(janelaEmAmostras(0.15, fps) % 2).toBe(1);
  });
});

describe('preencherLacunas', () => {
  it('interpola em linha reta lacunas curtas, deixa as longas e as pontas', () => {
    const r = preencherLacunas([null, 1, null, null, 4, null, null, null, null, 9, null], 2);
    expect(r).toEqual([null, 1, 2, 3, 4, null, null, null, null, 9, null]);
  });

  it('não altera a série recebida', () => {
    const serie = Object.freeze([1, null, 3]) as (number | null)[];
    expect(preencherLacunas(serie, 3)).toEqual([1, 2, 3]);
    expect(serie).toEqual([1, null, 3]);
  });
});

describe('estatisticas', () => {
  it('calcula n, média, desvio-padrão amostral, mínimo e máximo ignorando lacunas', () => {
    const e = estatisticas([2, 4, null, 4, 4, 5, 5, 7, 9]);
    expect(e.n).toBe(8);
    expect(e.media).toBeCloseTo(5, 9);
    expect(e.dp).toBeCloseTo(Math.sqrt(32 / 7), 9);
    expect(e.min).toBe(2);
    expect(e.max).toBe(9);
    expect(estatisticas([])).toEqual({ n: 0, media: null, dp: null, min: null, max: null });
    expect(estatisticas([3]).dp).toBeNull();
  });
});
