/** Leva o vídeo ao instante `t` e espera o quadro estar pronto para ser desenhado (com limite de tempo). */
export function irParaTempoEAguardar(v: HTMLVideoElement, t: number, limiteMs = 2500): Promise<void> {
  return new Promise((ok) => {
    if (Math.abs(v.currentTime - t) < 1e-4 && v.readyState >= 2) { ok(); return; }
    let feito = false;
    const fim = () => { if (feito) return; feito = true; v.removeEventListener('seeked', fim); window.clearTimeout(id); ok(); };
    const id = window.setTimeout(fim, limiteMs);
    v.addEventListener('seeked', fim);
    v.currentTime = t;
  });
}

/** Lê um arquivo de texto escolhido pelo usuário. */
export function lerTextoDoArquivo(arquivo: File): Promise<string> {
  if (typeof arquivo.text === 'function') return arquivo.text();
  return new Promise((ok, falha) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result ?? ''));
    r.onerror = () => falha(new Error('Não consegui ler o arquivo.'));
    r.readAsText(arquivo);
  });
}
