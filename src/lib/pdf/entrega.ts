// Entrega de PDFs: todo PDF gerado no app passa por aqui e abre a janela
// "PDF pronto" (enviar no WhatsApp do cliente, compartilhar ou baixar).

export interface PdfPronto {
  blob: Blob;
  nome: string;
  /** Paciente dono do documento; se faltar, tenta deduzir pela URL (/pacientes/:id). */
  pacienteId?: string | null;
  telefone?: string | null;
  titulo?: string;
  /** Mensagem sugerida para acompanhar o PDF no WhatsApp. */
  mensagem?: string;
}

const EVENTO = 'mh:pdf-pronto';
let ouvintes = 0;

export function entregarPdf(p: PdfPronto) {
  // Sem a janela montada (ex.: portal do cliente), baixa direto.
  if (!ouvintes || typeof window === 'undefined') { baixarBlob(p.blob, p.nome); return; }
  window.dispatchEvent(new CustomEvent<PdfPronto>(EVENTO, { detail: p }));
}

export function ouvirPdfPronto(cb: (p: PdfPronto) => void) {
  const h = (e: Event) => cb((e as CustomEvent<PdfPronto>).detail);
  window.addEventListener(EVENTO, h);
  ouvintes++;
  return () => { window.removeEventListener(EVENTO, h); ouvintes--; };
}

export function baixarBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function pacienteDaUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const m = /\/pacientes\/([0-9a-f-]{36})/i.exec(window.location.pathname) || /[?&](?:paciente|pacienteId)=([0-9a-f-]{36})/i.exec(window.location.search);
  return m ? m[1] : null;
}

// Nome do cliente nos documentos: MAIÚSCULO e sem acento (padrão da clínica).
export function nomeDocumento(nome: string | null | undefined): string {
  return String(nome ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim().toUpperCase();
}
