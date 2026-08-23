// Captura PCM direto do microfone e monta um WAV 16 kHz mono — SEM depender de
// decodeAudioData. Motivo: o navegador grava webm/opus (Chrome/Android) e o
// Gemini REJEITA opus (HTTP 400). A conversão pós-gravação (decodeAudioData do
// webm) falha justamente nos áudios longos do MediaRecorder, e o app acabava
// mandando opus e falhando "na hora". Capturando PCM durante a gravação, o
// áudio já nasce em WAV — formato que o Gemini sempre aceita — e nunca passa
// pelo decode que quebra.
//
// Usa ScriptProcessorNode (depreciado, mas suportado em todo lugar e sem exigir
// carregar um módulo externo, o que seria frágil no PWA). Reamostra em stream
// para 16 kHz mono e acumula Int16 (≈32 KB/s → ~1,9 MB/min), o que mantém o uso
// de memória baixo mesmo em consultas longas.

const TARGET_RATE = 16000;

export interface PcmCapture {
  /** Encerra a captura e devolve o WAV (16 kHz mono PCM16). */
  stop: () => Blob;
  /** Desconecta os nós sem gerar o WAV (usado em cancelamento/limpeza). */
  disconnect: () => void;
  /** Total de amostras capturadas (para saber se há áudio de fato). */
  readonly samples: number;
}

/**
 * Inicia a captura PCM pendurada no MESMO AudioContext/source já usados pelo
 * medidor de nível. Não altera o fluxo do MediaRecorder (que segue como backup).
 */
export function iniciarCapturaPCM(
  ctx: AudioContext,
  source: MediaStreamAudioSourceNode,
): PcmCapture {
  const inRate = ctx.sampleRate || 48000;
  const ratio = inRate / TARGET_RATE; // >1 (downsample) na esmagadora maioria
  const chunks: Int16Array[] = [];
  let total = 0;
  let carry = 0; // posição fracionária carregada entre buffers (mantém a fase)
  let stopped = false;

  const BUF = 4096;
  const node = ctx.createScriptProcessor(BUF, 1, 1);

  node.onaudioprocess = (ev) => {
    if (stopped) return;
    const input = ev.inputBuffer.getChannelData(0);
    const out: number[] = [];
    let pos = carry;
    while (pos < input.length) {
      const i = Math.floor(pos);
      const frac = pos - i;
      const s0 = input[i];
      const s1 = i + 1 < input.length ? input[i + 1] : s0;
      const s = s0 + (s1 - s0) * frac; // interpolação linear
      const c = s < -1 ? -1 : s > 1 ? 1 : s;
      out.push(c < 0 ? c * 0x8000 : c * 0x7fff);
      pos += ratio;
    }
    carry = pos - input.length; // sobra fracionária para o próximo buffer
    if (out.length) {
      chunks.push(Int16Array.from(out));
      total += out.length;
    }
  };

  source.connect(node);
  // ScriptProcessor só processa se estiver conectado ao destination em alguns
  // navegadores; roteia por um ganho ZERO para não vazar áudio nos alto-falantes.
  const sink = ctx.createGain();
  sink.gain.value = 0;
  node.connect(sink);
  sink.connect(ctx.destination);

  const disconnect = () => {
    stopped = true;
    node.onaudioprocess = null;
    try { node.disconnect(); } catch { /* já desconectado */ }
    try { sink.disconnect(); } catch { /* já desconectado */ }
  };

  const stop = (): Blob => {
    disconnect();
    return encodeWav16k(chunks, total);
  };

  return {
    stop,
    disconnect,
    get samples() { return total; },
  };
}

function encodeWav16k(chunks: Int16Array[], total: number): Blob {
  const dataLen = total * 2;
  const buffer = new ArrayBuffer(44 + dataLen);
  const view = new DataView(buffer);
  const wr = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  wr(0, 'RIFF');
  view.setUint32(4, 36 + dataLen, true);
  wr(8, 'WAVE');
  wr(12, 'fmt ');
  view.setUint32(16, 16, true);       // tamanho do sub-chunk fmt
  view.setUint16(20, 1, true);        // PCM
  view.setUint16(22, 1, true);        // mono
  view.setUint32(24, TARGET_RATE, true);
  view.setUint32(28, TARGET_RATE * 2, true); // byte rate (mono, 16 bits)
  view.setUint16(32, 2, true);        // block align
  view.setUint16(34, 16, true);       // bits por amostra
  wr(36, 'data');
  view.setUint32(40, dataLen, true);
  let off = 44;
  for (const c of chunks) {
    for (let i = 0; i < c.length; i++) {
      view.setInt16(off, c[i], true);
      off += 2;
    }
  }
  return new Blob([view], { type: 'audio/wav' });
}
