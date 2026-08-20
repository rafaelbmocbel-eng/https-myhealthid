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

// Carrega uma imagem de URL arbitrária (ex.: logo da clínica no storage do
// Supabase) e devolve um data URL PNG + dimensões naturais, pra encaixar num
// box mantendo a proporção. Cache por URL. Devolve null em falha (CORS/404),
// pra quem chama cair na marca do app.
const urlImageCache = new Map<string, { dataUrl: string; w: number; h: number }>();

export async function loadImageForPDF(
  url: string,
  opts?: { grayscale?: boolean },
): Promise<{ dataUrl: string; w: number; h: number } | null> {
  if (!url) return null;
  const cacheKey = opts?.grayscale ? `gray:${url}` : url;
  const cached = urlImageCache.get(cacheKey);
  if (cached) return cached;
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('img load failed'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    if (opts?.grayscale) {
      // Dessatura pra a marca-d'água (timbre) não brigar com o texto do corpo.
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const px = d.data;
      for (let i = 0; i < px.length; i += 4) {
        const g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        px[i] = px[i + 1] = px[i + 2] = g;
      }
      ctx.putImageData(d, 0, 0);
    }
    const out = { dataUrl: canvas.toDataURL('image/png'), w: canvas.width, h: canvas.height };
    urlImageCache.set(cacheKey, out);
    return out;
  } catch {
    // CORS/404/imagem inválida — quem chama usa a marca do app como fallback
    return null;
  }
}

/**
 * Timbre: logo da clínica como marca-d'água suave (dessaturada, baixa opacidade)
 * centrada em (cx, cy) com largura-alvo targetW. Fica ATRÁS do conteúdo, então
 * chame antes de desenhar o corpo. Silenciosa se a imagem não carregar.
 */
export async function drawLogoWatermark(
  doc: jsPDF,
  url: string,
  cx: number,
  cy: number,
  targetW: number,
  opacity = 0.05,
): Promise<void> {
  const img = await loadImageForPDF(url, { grayscale: true });
  if (!img) return;
  const w = targetW;
  const h = (img.h / img.w) * targetW;
  const anyDoc = doc as any;
  const gs = anyDoc.GState ? new anyDoc.GState({ opacity }) : null;
  if (gs && anyDoc.setGState) anyDoc.setGState(gs);
  doc.addImage(img.dataUrl, 'PNG', cx - w / 2, cy - h / 2, w, h);
  if (gs && anyDoc.setGState) anyDoc.setGState(new anyDoc.GState({ opacity: 1 }));
}

/**
 * Desenha a logo da clínica dentro de uma plaque branca arredondada, ajustada
 * (contain) e centralizada — a logo pode ser escura e o topo é navy. Retorna
 * true se desenhou, false se a imagem não pôde ser carregada.
 */
export async function drawClinicLogo(
  doc: jsPDF,
  url: string,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
): Promise<boolean> {
  const img = await loadImageForPDF(url);
  if (!img) return false;
  doc.setFillColor(255, 255, 255);
  (doc as any).roundedRect(boxX, boxY, boxW, boxH, 2, 2, 'F');
  const pad = 2;
  const availW = boxW - pad * 2;
  const availH = boxH - pad * 2;
  const ratio = Math.min(availW / img.w, availH / img.h);
  const w = img.w * ratio;
  const h = img.h * ratio;
  doc.addImage(img.dataUrl, 'PNG', boxX + (boxW - w) / 2, boxY + (boxH - h) / 2, w, h);
  return true;
}
