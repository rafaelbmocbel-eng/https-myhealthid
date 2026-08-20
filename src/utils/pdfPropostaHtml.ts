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

  const canvas = await html2canvas(root, {
    scale: SCALE,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    imageTimeout: 15000,
    windowWidth: root.scrollWidth,
  });

  const cw = canvas.width;
  const ch = canvas.height;

  // Altura em mm se a largura ocupar a página inteira (210mm).
  const fullHeightMM = (ch / cw) * A4_W_MM;
  const pagesFull = Math.max(1, Math.ceil(fullHeightMM / A4_H_MM));

  // Se couber em até 2 páginas, usa largura cheia. Se passar, encolhe
  // proporcional (com margens laterais) pra caber exatamente em 2 páginas.
  let placedWmm = A4_W_MM;
  let targetPages = pagesFull;
  if (pagesFull > MAX_PAGES) {
    placedWmm = (MAX_PAGES * A4_H_MM) * (cw / ch); // faz a altura total = 2×297mm
    targetPages = MAX_PAGES;
  }
  const offsetXmm = (A4_W_MM - placedWmm) / 2;
  const mmPerPx = placedWmm / cw;
  const pageHpx = Math.floor(A4_H_MM / mmPerPx);

  // Fronteiras seguras de quebra = base de cada [data-block] (px do canvas).
  const breaks = (Array.from(root.querySelectorAll('[data-block]')) as HTMLElement[])
    .map((b) => (b.getBoundingClientRect().bottom - rootRect.top) * SCALE)
    .filter((v) => v > 0 && v <= ch)
    .sort((a, b) => a - b);

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  let start = 0;
  let pageIdx = 0;

  while (start < ch - 1 && pageIdx < targetPages) {
    const isLastAllowed = pageIdx === targetPages - 1;
    let end = start + pageHpx;
    if (end >= ch || isLastAllowed) {
      end = ch; // última página leva o resto
    } else {
      const fit = breaks.filter((b) => b > start + 8 && b <= end).pop();
      if (fit) end = fit;
    }

    const sliceH = Math.max(1, Math.round(end - start));
    const slice = document.createElement('canvas');
    slice.width = cw;
    slice.height = sliceH;
    const ctx = slice.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cw, sliceH);
    ctx.drawImage(canvas, 0, start, cw, sliceH, 0, 0, cw, sliceH);

    const imgData = slice.toDataURL('image/jpeg', 0.95);
    const hMM = sliceH * mmPerPx;
    if (pageIdx > 0) pdf.addPage();
    pdf.addImage(imgData, 'JPEG', offsetXmm, 0, placedWmm, hMM);

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

    start = end;
    pageIdx += 1;
  }

  return pdf.output('blob');
}
