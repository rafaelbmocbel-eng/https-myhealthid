import jsPDF from 'jspdf';
import logoSrc from '@/assets/logo-myhealthid.png';

/**
 * Loads the MyHealthID logo and adds it to a jsPDF document.
 * Falls back to a drawn circle logo if image loading fails.
 */
export async function addLogoToDoc(doc: jsPDF, x: number, y: number, size: number, customUrl?: string): Promise<void> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load logo'));
      img.src = customUrl || logoSrc;
    });

    // Encaixe "contain": a logo cabe INTEIRA na caixa size×size, na proporção
    // real — sem cortar (o círculo antigo cortava as laterais de logos largas,
    // ex.: "PHYSIO MOCBEL" virava "PHY MOC") e sem distorcer. Centralizada.
    const ratio = (img.width / img.height) || 1;
    let w = size, h = size;
    if (ratio >= 1) { w = size; h = size / ratio; } // logo larga → mais baixa
    else { h = size; w = size * ratio; }             // logo alta → mais estreita
    const cx = x + (size - w) / 2;
    const cy = y + (size - h) / 2;

    // Canvas em alta resolução, fundo TRANSPARENTE, exportado em PNG (mantém a
    // transparência da logo — JPEG punha fundo branco e borrava).
    const maxPx = 1400;
    let bw = img.width, bh = img.height;
    if (Math.max(bw, bh) > maxPx) { const s = maxPx / Math.max(bw, bh); bw *= s; bh *= s; }
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bw));
    canvas.height = Math.max(1, Math.round(bh));
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    doc.addImage(dataUrl, 'PNG', cx, cy, w, h);
  } catch {
    // Fallback: draw a simple circle logo
    doc.setFillColor(28, 55, 83);
    doc.circle(x + size / 2, y + size / 2, size / 2, 'F');
    doc.setFillColor(234, 170, 20);
    doc.circle(x + size / 2, y + size / 2, size / 3, 'F');
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.5);
    doc.circle(x + size / 2, y + size / 2, size / 2, 'S');
  }
}
