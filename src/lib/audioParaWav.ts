// Converte um áudio gravado (ex.: audio/mp4 AAC do iPhone) para WAV mono 16 kHz —
// formato que o Gemini SEMPRE aceita. O iOS grava em mp4/AAC, que o modelo rejeita
// ("Formato de áudio não aceito"); convertendo para WAV no app, a transcrição volta
// a funcionar em qualquer aparelho. 16 kHz mono é ideal para fala e mantém o arquivo
// pequeno.
export async function audioParaWav(blob: Blob, sampleRate = 16000): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioCtx: typeof AudioContext =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  let decoded: AudioBuffer;
  try {
    // slice(0) para não "consumir" o ArrayBuffer em alguns navegadores.
    decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
  } catch (e) {
    ctx.close();
    throw e;
  }

  // Reamostra para mono no sampleRate alvo via OfflineAudioContext.
  const frames = Math.max(1, Math.ceil(decoded.duration * sampleRate));
  const offline = new OfflineAudioContext(1, frames, sampleRate);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start(0);
  const rendered = await offline.startRendering();
  ctx.close();

  return encodeWavPCM16(rendered.getChannelData(0), sampleRate);
}

function encodeWavPCM16(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // tamanho do sub-chunk fmt
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate (mono, 16 bits)
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits por amostra
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Blob([view], { type: 'audio/wav' });
}

// Base64 "cru" (sem o prefixo data:...;base64,) de um Blob.
export async function blobParaBase64(blob: Blob): Promise<string> {
  const dataUrl: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(new Error('leitura do áudio falhou'));
    r.readAsDataURL(blob);
  });
  return dataUrl.split(',')[1] || '';
}
