import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LADO_MAX_FOTO, dimensoesReduzidas, landmarksParaGuia, prepararFoto } from '@/lib/angular/fotoSessao';
import { avaliarEnquadramento, type Landmark } from '@/lib/angular/pose';

describe('dimensoesReduzidas', () => {
  it('reduz o maior lado a 2000 px mantendo a proporção (valores à mão)', () => {
    expect(LADO_MAX_FOTO).toBe(2000);
    expect(dimensoesReduzidas(4000, 3000)).toEqual({ w: 2000, h: 1500, reduzir: true });
    expect(dimensoesReduzidas(3000, 4000)).toEqual({ w: 1500, h: 2000, reduzir: true });
    expect(dimensoesReduzidas(6000, 6000)).toEqual({ w: 2000, h: 2000, reduzir: true });
    expect(dimensoesReduzidas(3024, 4032)).toEqual({ w: 1500, h: 2000, reduzir: true });
  });

  it('foto que já cabe no limite não muda e nunca é ampliada', () => {
    expect(dimensoesReduzidas(2000, 1000)).toEqual({ w: 2000, h: 1000, reduzir: false });
    expect(dimensoesReduzidas(1999, 1000)).toEqual({ w: 1999, h: 1000, reduzir: false });
    expect(dimensoesReduzidas(640, 480)).toEqual({ w: 640, h: 480, reduzir: false });
  });

  it('nunca devolve lado zero e tolera medidas inválidas', () => {
    expect(dimensoesReduzidas(4001, 2)).toEqual({ w: 2000, h: 1, reduzir: true });
    expect(dimensoesReduzidas(0, 0).reduzir).toBe(false);
    expect(dimensoesReduzidas(-5, 3000).reduzir).toBe(false);
  });

  it('aceita outro limite', () => {
    expect(dimensoesReduzidas(1000, 500, 400)).toEqual({ w: 400, h: 200, reduzir: true });
  });
});

describe('prepararFoto', () => {
  let dims: Map<string, { w: number; h: number }>;
  let revogadas: string[];
  let criadas: number;
  let desenhos: unknown[][];
  let contextoIndisponivel: boolean;
  let blobNulo: boolean;

  beforeEach(() => {
    dims = new Map();
    revogadas = [];
    criadas = 0;
    desenhos = [];
    contextoIndisponivel = false;
    blobNulo = false;
    class ImagemFalsa {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 0;
      naturalHeight = 0;
      private endereco = '';
      get src() { return this.endereco; }
      set src(v: string) {
        this.endereco = v;
        queueMicrotask(() => {
          const d = dims.get(v);
          if (!d) { this.onerror?.(); return; }
          this.naturalWidth = d.w; this.naturalHeight = d.h;
          this.onload?.();
        });
      }
    }
    vi.stubGlobal('Image', ImagemFalsa);
    vi.stubGlobal('URL', Object.assign(URL, {
      createObjectURL: (b: Blob & { dims?: { w: number; h: number } }) => {
        const url = `blob:${++criadas}`;
        if (b.dims) dims.set(url, b.dims);
        return url;
      },
      revokeObjectURL: (u: string) => { revogadas.push(u); },
    }));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => (contextoIndisponivel ? null : {
      imageSmoothingQuality: 'low', drawImage: (...a: unknown[]) => { desenhos.push(a); },
    } as unknown as CanvasRenderingContext2D));
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function toBlob(this: HTMLCanvasElement, cb: BlobCallback) {
      if (blobNulo) { cb(null); return; }
      const b = new Blob(['jpeg'], { type: 'image/jpeg' }) as Blob & { dims?: { w: number; h: number } };
      b.dims = { w: this.width, h: this.height };
      cb(b);
    });
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  const arquivo = () => new Blob(['x'], { type: 'image/jpeg' });

  it('reduz uma foto de 12 MP para 2000 x 1500, desenha a original no canvas e revoga a URL da original', async () => {
    dims.set('blob:1', { w: 4000, h: 3000 });
    const f = await prepararFoto(arquivo());
    expect(desenhos).toHaveLength(1);
    expect(desenhos[0].slice(1)).toEqual([0, 0, 2000, 1500]);
    expect(f.w).toBe(2000);
    expect(f.h).toBe(1500);
    expect(f.url).toBe('blob:2');
    expect(f.img.naturalWidth).toBe(2000);
    expect(revogadas).toEqual(['blob:1']);
  });

  it('foto em retrato também fica com o maior lado em 2000 (1500 x 2000)', async () => {
    dims.set('blob:1', { w: 3024, h: 4032 });
    const f = await prepararFoto(arquivo());
    expect([f.w, f.h]).toEqual([1500, 2000]);
  });

  it('foto que já cabe fica como veio: sem canvas, sem revogar, com a mesma URL', async () => {
    dims.set('blob:1', { w: 1200, h: 1600 });
    const f = await prepararFoto(arquivo());
    expect(desenhos).toHaveLength(0);
    expect(revogadas).toEqual([]);
    expect(f.url).toBe('blob:1');
    expect([f.w, f.h]).toEqual([1200, 1600]);
  });

  it('arquivo que não é imagem legível: rejeita e revoga a URL criada', async () => {
    await expect(prepararFoto(arquivo())).rejects.toThrow();
    expect(revogadas).toEqual(['blob:1']);
  });

  it('sem canvas, fica com a foto como veio', async () => {
    dims.set('blob:1', { w: 4000, h: 3000 });
    contextoIndisponivel = true;
    const f = await prepararFoto(arquivo());
    expect(f.url).toBe('blob:1');
    expect([f.w, f.h]).toEqual([4000, 3000]);
    expect(revogadas).toEqual([]);
  });

  it('se o canvas não gera o JPEG, fica com a foto como veio', async () => {
    dims.set('blob:1', { w: 4000, h: 3000 });
    blobNulo = true;
    const f = await prepararFoto(arquivo());
    expect(f.url).toBe('blob:1');
    expect(revogadas).toEqual([]);
  });

  it('se a versão reduzida não abre, fica com a original e revoga a reduzida', async () => {
    dims.set('blob:1', { w: 4000, h: 3000 });
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb: BlobCallback) => { cb(new Blob(['quebrado'], { type: 'image/jpeg' })); });
    const f = await prepararFoto(arquivo());
    expect(f.url).toBe('blob:1');
    expect(revogadas).toEqual(['blob:2']);
  });
});

describe('guia de enquadramento nas costas', () => {
  const ponto = (x: number, y: number, visibility = 0.9): Landmark => ({ x, y, visibility });
  // Corpo inteiro e centralizado, de costas: o nariz some (visibilidade 0,1) e as orelhas aparecem.
  const costas = (): Landmark[] => {
    const lm = Array.from({ length: 33 }, () => ponto(0.5, 0.5));
    lm[0] = ponto(0.5, 0.1, 0.1);
    lm[7] = ponto(0.46, 0.09); lm[8] = ponto(0.54, 0.09);
    lm[11] = ponto(0.4, 0.25); lm[12] = ponto(0.6, 0.25);
    lm[23] = ponto(0.45, 0.55); lm[24] = ponto(0.55, 0.55);
    lm[27] = ponto(0.46, 0.92); lm[28] = ponto(0.54, 0.92);
    return lm;
  };

  it('com o nariz visível devolve os mesmos pontos (a própria lista)', () => {
    const lm = costas();
    lm[0] = ponto(0.5, 0.1, 0.95);
    expect(landmarksParaGuia(lm)).toBe(lm);
  });

  it('sem nariz visível, a média das orelhas ocupa o lugar dele e a lista original não muda', () => {
    const lm = costas();
    const g = landmarksParaGuia(lm)!;
    expect(g).not.toBe(lm);
    expect(g[0].x).toBeCloseTo(0.5, 10);
    expect(g[0].y).toBeCloseTo(0.09, 10);
    expect(g[0].visibility).toBe(0.9);
    expect(lm[0]).toEqual({ x: 0.5, y: 0.1, visibility: 0.1 });
    expect(g[7]).toBe(lm[7]);
  });

  it('com uma orelha só usa essa orelha; sem orelhas usa os olhos; sem nada devolve a própria lista', () => {
    const umaOrelha = costas();
    umaOrelha[8] = ponto(0.54, 0.09, 0.2);
    expect(landmarksParaGuia(umaOrelha)![0]).toEqual({ x: 0.46, y: 0.09, visibility: 0.9 });

    const olhos = costas();
    olhos[7] = ponto(0.46, 0.09, 0.1); olhos[8] = ponto(0.54, 0.09, 0.1);
    olhos[2] = ponto(0.48, 0.1, 0.8); olhos[5] = ponto(0.52, 0.12, 0.7);
    const g = landmarksParaGuia(olhos)![0];
    expect(g.x).toBeCloseTo(0.5, 10);
    expect(g.y).toBeCloseTo(0.11, 10);
    expect(g.visibility).toBe(0.7);

    const nada = costas();
    for (const i of [2, 5, 7, 8]) nada[i] = ponto(0.5, 0.1, 0.1);
    expect(landmarksParaGuia(nada)).toBe(nada);
    expect(landmarksParaGuia(null)).toBeNull();
  });

  it('o guia acende nas costas mesmo sem o nariz (o que o guia sem ajuste não faz)', () => {
    expect(avaliarEnquadramento(landmarksParaGuia(costas()))).toEqual({ ok: true, mensagem: 'Enquadramento bom. Pode fotografar.' });
  });

  it('as outras mensagens do guia continuam: pés cortados e corpo pequeno', () => {
    const cortado = costas();
    cortado[27] = ponto(0.46, 0.995); cortado[28] = ponto(0.54, 0.995);
    expect(avaliarEnquadramento(landmarksParaGuia(cortado)).ok).toBe(false);
    const pequeno = costas();
    pequeno[27] = ponto(0.46, 0.5); pequeno[28] = ponto(0.54, 0.5);
    expect(avaliarEnquadramento(landmarksParaGuia(pequeno)).mensagem).toMatch(/Aproxime-se/);
  });
});
