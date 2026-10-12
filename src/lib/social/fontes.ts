import bebasUrl from '@/assets/fonts/social/bebas-neue-latin-400.woff2?url';
import inter700Url from '@/assets/fonts/social/inter-latin-700.woff2?url';
import inter800Url from '@/assets/fonts/social/inter-latin-800.woff2?url';
import type { Medidor, TipoFonte } from './layout';

/*
 * Fontes da arte social. Os arquivos vão junto com o app (nada de CDN, que pode estar bloqueado ou
 * lento no celular) e só entram no canvas depois de carregados, senão o primeiro desenho sairia com a
 * fonte de reserva. Se o carregamento falhar, a pilha cai em fontes parecidas do sistema.
 */

export const FAMILIA_TITULO = '"MyID Social Bebas", "Bebas Neue", "Arial Narrow", Impact, "Helvetica Neue", sans-serif';
export const FAMILIA_TEXTO = '"MyID Social Inter", Inter, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const PESO: Record<TipoFonte, number> = { titulo: 400, forte: 800, texto: 700 };

/** Valor da propriedade `font` do canvas para o tipo e o corpo em px. */
export function fonteCss(tipo: TipoFonte, px: number): string {
  return `${PESO[tipo]} ${Math.max(1, Math.round(px * 100) / 100)}px ${tipo === 'titulo' ? FAMILIA_TITULO : FAMILIA_TEXTO}`;
}

let carregando: Promise<boolean> | null = null;

/** Carrega as fontes embarcadas uma vez; resolve true se todas entraram e false se o canvas vai usar as de reserva. */
export function garantirFontesSociais(): Promise<boolean> {
  if (carregando) return carregando;
  carregando = (async () => {
    if (typeof document === 'undefined' || typeof FontFace === 'undefined' || !document.fonts) return false;
    try {
      const faces = [
        new FontFace('MyID Social Bebas', `url(${bebasUrl}) format("woff2")`, { weight: '400', style: 'normal' }),
        new FontFace('MyID Social Inter', `url(${inter700Url}) format("woff2")`, { weight: '700', style: 'normal' }),
        new FontFace('MyID Social Inter', `url(${inter800Url}) format("woff2")`, { weight: '800', style: 'normal' }),
      ];
      await Promise.all(faces.map(async (f) => { await f.load(); document.fonts.add(f); }));
      return true;
    } catch {
      // Arquivo de fonte inacessível: a arte sai com as fontes de reserva e a próxima tentativa recarrega.
      carregando = null;
      return false;
    }
  })();
  return carregando;
}

let ctxMedida: CanvasRenderingContext2D | null | undefined;

/** Mede texto com a fonte real do canvas; sem canvas (testes), estima pela média da largura dos caracteres. */
export const medidorDoCanvas: Medidor = (texto, fonte, tipo) => {
  if (ctxMedida === undefined) {
    try {
      ctxMedida = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
    } catch {
      // Ambiente sem canvas: cai na estimativa.
      ctxMedida = null;
    }
  }
  if (!ctxMedida) return estimarLargura(texto, fonte, tipo);
  ctxMedida.font = fonteCss(tipo, fonte);
  return ctxMedida.measureText(texto).width;
};

const MEDIA: Record<TipoFonte, number> = { titulo: 0.4, forte: 0.62, texto: 0.6 };
export const estimarLargura: Medidor = (texto, fonte, tipo) => [...texto].length * MEDIA[tipo] * fonte;
