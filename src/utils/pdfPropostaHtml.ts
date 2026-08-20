// Gera o PDF da Proposta a partir do HTML renderizado (o mesmo do preview),
// via html2canvas. Pagina quebrando SEMPRE em uma fronteira de [data-block],
// pra nenhum card ser cortado no meio. Retorna um Blob (compatível com download
// e com o compartilhamento via WhatsApp já existentes).
import jsPDF from 'jspdf';

const A4_W_MM = 210;
const A4_H_MM = 297;

export async function gerarPropostaPdfDeHtml(root: HTMLElement): Promise<Blob> {
  const html2canvas = (await import('html2canvas')).default;

  // Espera TODAS as imagens (ex.: logo da clínica em data URL) carregarem e
  // decodificarem — senão o html2canvas captura antes e a logo sai em branco.
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(imgs.map((img) => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise<void>((res) => {
      img.addEventListener('load', () => res(), { once: true });
      img.addEventListener('error', () => res(), { once: true });
    });
  }));
  await Promise.all(imgs.map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve())));

  // Captura o documento inteiro em alta resolução.
  const scale = 2;
  const canvas = await html2canvas(root, {
    scale,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    imageTimeout: 15000,
    windowWidth: root.scrollWidth,
  });

  const pxPerMm = canvas.width / A4_W_MM;      // largura do doc = largura da página A4
  const pageHpx = Math.floor(A4_H_MM * pxPerMm);

  // Fronteiras seguras de quebra = base de cada bloco (em px do canvas).
  const rootRect = root.getBoundingClientRect();
  const blocks = Array.from(root.querySelectorAll('[data-block]')) as HTMLElement[];
  const breaks = blocks
    .map((b) => (b.getBoundingClientRect().bottom - rootRect.top) * scale)
    .filter((v) => v > 0 && v <= canvas.height)
    .sort((a, b) => a - b);

  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  let start = 0;
  let first = true;

  while (start < canvas.height - 1) {
    let end = start + pageHpx;
    if (end < canvas.height) {
      // desce até a última fronteira de bloco que ainda cabe nesta página
      const fit = breaks.filter((b) => b > start + 8 && b <= end).pop();
      if (fit) {
        end = fit;
      }
      // se nenhum bloco couber (bloco maior que a página), corta no limite da página
    } else {
      end = canvas.height;
    }

    const sliceH = Math.max(1, Math.round(end - start));
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = sliceH;
    const ctx = slice.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, start, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

    const imgData = slice.toDataURL('image/jpeg', 0.92);
    const hMM = sliceH / pxPerMm;
    if (!first) pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, 0, A4_W_MM, hMM);
    first = false;
    start = end;
  }

  return pdf.output('blob');
}
