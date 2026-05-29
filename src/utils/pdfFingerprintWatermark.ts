import jsPDF from 'jspdf';
import fingerprintSrc from '@/assets/myid-fingerprint.png';

let cachedDataUrl: string | null = null;

async function loadFingerprintDataUrl(): Promise<string> {
  if (cachedDataUrl) return cachedDataUrl;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load fingerprint'));
    img.src = fingerprintSrc;
  });
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.getContext('2d')!.drawImage(img, 0, 0);
  cachedDataUrl = canvas.toDataURL('image/png');
  return cachedDataUrl;
}

/**
 * Draws the MyID fingerprint at low opacity (watermark).
 * opacity: 0..1
 */
export async function drawFingerprintWatermark(
  doc: jsPDF,
  x: number,
  y: number,
  size: number,
  opacity = 0.06,
): Promise<void> {
  try {
    const dataUrl = await loadFingerprintDataUrl();
    // jsPDF GState for opacity
    const anyDoc = doc as any;
    const gs = anyDoc.GState ? new anyDoc.GState({ opacity }) : null;
    if (gs && anyDoc.setGState) anyDoc.setGState(gs);
    doc.addImage(dataUrl, 'PNG', x, y, size, size);
    if (gs && anyDoc.setGState) anyDoc.setGState(new anyDoc.GState({ opacity: 1 }));
  } catch {
    // silent fallback
  }
}

/**
 * Compact fingerprint mark (no watermark) — for top of internal pages.
 */
export async function drawFingerprintMark(
  doc: jsPDF,
  x: number,
  y: number,
  size: number,
): Promise<void> {
  try {
    const dataUrl = await loadFingerprintDataUrl();
    doc.addImage(dataUrl, 'PNG', x, y, size, size);
  } catch { /* ignore */ }
}
