import jsPDF from 'jspdf';
import logoSrc from '@/assets/logo-myhealthid.jpg';

/**
 * Loads the MyHealthID logo and adds it to a jsPDF document.
 * Falls back to a drawn circle logo if image loading fails.
 */
export async function addLogoToDoc(doc: jsPDF, x: number, y: number, size: number): Promise<void> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load logo'));
      img.src = logoSrc;
    });

    // Draw circular clip via canvas
    const canvas = document.createElement('canvas');
    const px = size * 4; // high-res
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext('2d')!;
    
    // Circular clip
    ctx.beginPath();
    ctx.arc(px / 2, px / 2, px / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    
    // Draw image to fill
    const imgRatio = img.width / img.height;
    let drawW = px, drawH = px;
    if (imgRatio > 1) { drawH = px; drawW = px * imgRatio; }
    else { drawW = px; drawH = px / imgRatio; }
    ctx.drawImage(img, (px - drawW) / 2, (px - drawH) / 2, drawW, drawH);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    doc.addImage(dataUrl, 'JPEG', x, y, size, size);
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
