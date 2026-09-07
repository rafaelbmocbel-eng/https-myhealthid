// Gera o PDF da Proposta a partir do HTML renderizado (o mesmo do preview).
// Regras:
//  - SEMPRE cabe em no máximo 2 páginas A4 (encolhe proporcional se passar);
//  - captura em ALTA resolução (nitidez de impressão);
//  - a logo da clínica é sobreposta como imagem nítida separada (na resolução
//    original), em vez de ficar rasterizada junto com a página.
import jsPDF from 'jspdf';

const A4_W_MM = 210;
const A4_H_MM = 297;
const MAX_PAGES = 2;
const SCALE = 3.5; // ~250 DPI a partir de um container de 600px

export interface LogoParaPdf {
  dataUrl: string;
  w: number;
  h: number;
}

export async function gerarPropostaPdfDeHtml(
  root: HTMLElement,
  opts?: { logo?: LogoParaPdf },
): Promise<Blob> {
  const html2canvas = (await import('html2canvas')).default;

  // Espera as FONTES carregarem — sem isso o html2canvas captura com fonte de
  // fallback e o texto sai "diferente do preview".
  try { if ((document as any).fonts?.ready) await (document as any).fonts.ready; } catch { /* fonts API indisponível */ }

  // Espera imagens (se houver) carregarem/decodificarem antes de capturar.
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(imgs.map((img) => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise<void>((res) => {
      img.addEventListener('load', () => res(), { once: true });
      img.addEventListener('error', () => res(), { once: true });
    });
  }));

  // Posição/tamanho da caixa da logo ANTES da captura (pra sobrepor depois).
  const rootRect = root.getBoundingClientRect();
  const logoEl = root.querySelector('[data-logo]') as HTMLElement | null;
  const logoBox = logoEl
    ? {
        left: logoEl.getBoundingClientRect().left - rootRect.left,
        top: logoEl.getBoundingClientRect().top - rootRect.top,
        w: logoEl.getBoundingClientRect().width,
        h: logoEl.getBoundingClientRect().height,
      }
    : null;

  // Durante a captura, apaga a background-image da caixa da logo pra ela NÃO
  // ficar rasterizada (borrada) por baixo da logo nítida que sobrepomos depois
  // — senão aparecem duas logos, uma por cima da outra. Restaura em seguida.
  const logoElBg = logoEl ? logoEl.style.backgroundImage : '';
  if (logoEl && opts?.logo) logoEl.style.backgroundImage = 'none';

  const canvas = await html2canvas(root, {
    scale: SCALE,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    imageTimeout: 15000,
    windowWidth: root.scrollWidth,
  });

  if (logoEl && opts?.logo) logoEl.style.backgroundImage = logoElBg;

  const cw = canvas.width;
  const ch = canvas.height;

  // Margem lateral (~2 cm de cada lado): a proposta fica centralizada e
  // "emoldurada" na página, em vez de colada nas bordas.
  const MARGIN_MM = 20;
  const maxContentWmm = A4_W_MM - 2 * MARGIN_MM; // 170mm de área útil

  // Altura em mm se a largura ocupar a área útil (com margens).
  const fullHeightMM = (ch / cw) * maxContentWmm;
  const pagesFull = Math.max(1, Math.ceil(fullHeightMM / A4_H_MM));

  // Se couber em até 2 páginas, usa a largura com margem. Se passar, encolhe
  // proporcional (margens ficam ainda maiores) pra caber em 2 páginas.
  let placedWmm = maxContentWmm;
  if (pagesFull > MAX_PAGES) {
    placedWmm = Math.min(maxContentWmm, (MAX_PAGES * A4_H_MM) * (cw / ch));
  }
  const offsetXmm = (A4_W_MM - placedWmm) / 2; // centralizado
  const mmPerPx = placedWmm / cw;
  const pageHpx = Math.floor(A4_H_MM / mmPerPx);

  // Fronteiras seguras de quebra = base de cada [data-block] (px do canvas).
  const breaks = (Array.from(root.querySelectorAll('[data-block]')) as HTMLElement[])
    .map((b) => (b.getBoundingClientRect().bottom - rootRect.top) * SCALE)
    .filter((v) => v > 0 && v <= ch)
    .sort((a, b) => a - b);

  // Cortes das páginas — SEMPRE em fronteira de card ([data-block]), nunca no
  // meio. Preferência: se cabe em 2 páginas, escolhe a quebra mais perto do meio
  // que deixe AS DUAS páginas cheias e sem estourar (equilíbrio). Se não houver
  // fronteira válida, cai na quebra limpa gulosa (enche a 1ª ao máximo).
  const cuts: number[] = [];
  const tol = pageHpx + 2;
  if (ch <= tol) {
    // cabe em 1 página
  } else {
    const validos = breaks.filter((b) => b <= tol && ch - b <= tol);
    if (validos.length) {
      const mid = ch / 2;
      const split = validos.reduce((best, b) => (Math.abs(b - mid) < Math.abs(best - mid) ? b : best), validos[0]);
      cuts.push(split);
    } else {
      // guloso limpo (pode passar de 2 páginas em propostas muito longas)
      let pageStart = 0;
      let lastFit = 0;
      for (const b of breaks) {
        if (b - pageStart > tol) {
          if (lastFit > pageStart + 2) { cuts.push(lastFit); pageStart = lastFit; }
          else { cuts.push(pageStart + pageHpx); pageStart += pageHpx; }
        }
        lastFit = b;
      }
    }
  }

  const bounds = [0, ...cuts, ch];
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  for (let pageIdx = 0; pageIdx < bounds.length - 1; pageIdx++) {
    const start = bounds[pageIdx];
    const end = bounds[pageIdx + 1];
    const sliceH = Math.max(1, Math.round(end - start));
    const slice = document.createElement('canvas');
    slice.width = cw;
    slice.height = sliceH;
    const ctx = slice.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cw, sliceH);
    ctx.drawImage(canvas, 0, start, cw, sliceH, 0, 0, cw, sliceH);

    // PNG (sem perdas) em vez de JPEG: texto e bordas ficam NÍTIDOS, sem os
    // artefatos/borrão do JPEG — a maior causa do PDF sair "menos bonito" que o
    // preview. Propostas têm 1-2 páginas, então o arquivo continua leve.
    const imgData = slice.toDataURL('image/png');
    const hMM = sliceH * mmPerPx;
    if (pageIdx > 0) pdf.addPage();
    pdf.addImage(imgData, 'PNG', offsetXmm, 0, placedWmm, hMM, undefined, 'FAST');

    // Sobrepõe a logo NÍTIDA (resolução original) se ela cair nesta página.
    if (logoBox && opts?.logo) {
      const boxTopPx = logoBox.top * SCALE;
      const boxBottomPx = (logoBox.top + logoBox.h) * SCALE;
      if (boxTopPx >= start && boxBottomPx <= end) {
        // fit "contain" da logo dentro da caixa, mantendo proporção
        const boxWmm = logoBox.w * SCALE * mmPerPx;
        const boxHmm = logoBox.h * SCALE * mmPerPx;
        const pad = boxHmm * 0.12;
        const availW = boxWmm - pad * 2;
        const availH = boxHmm - pad * 2;
        const r = Math.min(availW / opts.logo.w, availH / opts.logo.h);
        const lw = opts.logo.w * r;
        const lh = opts.logo.h * r;
        const boxXmm = offsetXmm + logoBox.left * SCALE * mmPerPx;
        const boxYmm = (boxTopPx - start) * mmPerPx;
        const lx = boxXmm + (boxWmm - lw) / 2;
        const ly = boxYmm + (boxHmm - lh) / 2;
        pdf.addImage(opts.logo.dataUrl, 'PNG', lx, ly, lw, lh);
      }
    }
  }

  return pdf.output('blob');
}
