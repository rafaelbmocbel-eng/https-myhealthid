import type { Landmark } from './pose';

// Foto de uma posição da sessão: reduzida ao carregar, para quatro fotos caberem na memória do celular.
// Uma foto de 12 MP (4000x3000) decodificada ocupa cerca de 48 MB; reduzida a 2000 px no maior lado, cerca de 12 MB.
// Os ângulos não mudam com uma redução uniforme e a escala em cm usa pontos da própria foto, então nada quebra.

/** Maior lado, em px, de uma foto da sessão. Acima disso o zoom de 5x e a arte para Instagram não ganham qualidade. */
export const LADO_MAX_FOTO = 2000;

export interface FotoPreparada {
  /** Endereço `blob:` da imagem que fica na memória; quem a usa deve revogá-lo. */
  url: string;
  w: number;
  h: number;
  img: HTMLImageElement;
}

/** Tamanho final de uma foto de `w` x `h` com o maior lado em no máximo `ladoMax` (nunca amplia). */
export function dimensoesReduzidas(w: number, h: number, ladoMax = LADO_MAX_FOTO): { w: number; h: number; reduzir: boolean } {
  const maior = Math.max(w, h);
  if (!(maior > ladoMax) || !(w > 0) || !(h > 0)) return { w, h, reduzir: false };
  const k = ladoMax / maior;
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)), reduzir: true };
}

function carregarImagem(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, falha) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => falha(new Error('imagem ilegível'));
    img.src = url;
  });
}

function canvasParaJpeg(cv: HTMLCanvasElement, qualidade: number): Promise<Blob | null> {
  return new Promise((ok) => { cv.toBlob((b) => ok(b), 'image/jpeg', qualidade); });
}

/**
 * Abre a foto e, se o maior lado passar de `ladoMax`, a reduz num canvas (JPEG 0,92) e devolve a imagem reduzida.
 * A orientação do EXIF é a do navegador: o `<img>` e o canvas já a aplicam, e a imagem reduzida sai sem EXIF e com os pixels no lugar.
 * Foto que já cabe no limite fica como veio. Rejeita se o arquivo não for uma imagem legível.
 */
export async function prepararFoto(arquivo: Blob, ladoMax = LADO_MAX_FOTO): Promise<FotoPreparada> {
  const urlOriginal = URL.createObjectURL(arquivo);
  let original: HTMLImageElement;
  try {
    original = await carregarImagem(urlOriginal);
  } catch (e) {
    URL.revokeObjectURL(urlOriginal);
    throw e;
  }
  const w0 = original.naturalWidth, h0 = original.naturalHeight;
  const alvo = dimensoesReduzidas(w0, h0, ladoMax);
  const comoVeio: FotoPreparada = { url: urlOriginal, w: w0, h: h0, img: original };
  if (!alvo.reduzir) return comoVeio;

  const cv = document.createElement('canvas');
  cv.width = alvo.w; cv.height = alvo.h;
  const ctx = cv.getContext('2d');
  if (!ctx) return comoVeio;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(original, 0, 0, alvo.w, alvo.h);
  const blob = await canvasParaJpeg(cv, 0.92);
  if (!blob) return comoVeio;
  const urlReduzida = URL.createObjectURL(blob);
  try {
    const reduzida = await carregarImagem(urlReduzida);
    URL.revokeObjectURL(urlOriginal);
    return { url: urlReduzida, w: reduzida.naturalWidth || alvo.w, h: reduzida.naturalHeight || alvo.h, img: reduzida };
  } catch {
    // A versão reduzida não abriu (navegador sem JPEG no canvas, por exemplo): fica a foto como veio.
    URL.revokeObjectURL(urlReduzida);
    return comoVeio;
  }
}

const VISIBILIDADE_MINIMA = 0.5;

/**
 * Pontos do modelo para o guia de enquadramento. O guia usa o nariz como topo da cabeça, mas de costas o nariz some:
 * sem nariz visível, a média das orelhas (ou, sem elas, dos olhos) ocupa o lugar dele, para o guia não pedir "afaste-se" sem motivo.
 * Com o nariz visível devolve os mesmos pontos.
 */
export function landmarksParaGuia(lm: Landmark[] | null): Landmark[] | null {
  if (!lm) return null;
  const visivel = (i: number) => (lm[i]?.visibility ?? 0) >= VISIBILIDADE_MINIMA;
  if (visivel(0)) return lm;
  const orelhas = [7, 8].filter(visivel), olhos = [2, 5].filter(visivel);
  const base = (orelhas.length ? orelhas : olhos).map((i) => lm[i]);
  if (!base.length) return lm;
  const saida = lm.slice();
  saida[0] = { x: base.reduce((t, p) => t + p.x, 0) / base.length, y: base.reduce((t, p) => t + p.y, 0) / base.length, visibility: Math.min(...base.map((p) => p.visibility ?? 0)) };
  return saida;
}
