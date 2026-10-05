import type jsPDF from 'jspdf';

// Moldura padrão dos relatórios: filete externo azul-marinho (cor da marca) e um
// filete interno fino dourado, com cantos arredondados. Desenhada em todas as
// páginas no fim da geração, sem mexer no conteúdo (margens do conteúdo >= 14 mm).
const MARINHO: [number, number, number] = [28, 55, 83];
const DOURADO: [number, number, number] = [234, 170, 20];

export function molduraEmTodasPaginas(doc: jsPDF) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const total = doc.getNumberOfPages();
  const inicial = doc.getCurrentPageInfo().pageNumber;
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setLineJoin('round');
    doc.setDrawColor(...MARINHO); doc.setLineWidth(0.7);
    doc.roundedRect(5, 5, W - 10, H - 10, 3, 3, 'S');
    doc.setDrawColor(...DOURADO); doc.setLineWidth(0.25);
    doc.roundedRect(6.4, 6.4, W - 12.8, H - 12.8, 2.2, 2.2, 'S');
  }
  doc.setPage(inicial);
}
