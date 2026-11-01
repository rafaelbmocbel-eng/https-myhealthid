import { describe, it, expect, vi } from 'vitest';
import { iniciarCapturaPCM } from '@/lib/pcmRecorder';

// Microfone de mentira a 48 kHz: guarda o tratador de áudio e deixa o teste entregar blocos.
function criarContexto(taxa: number) {
  let tratador: ((ev: unknown) => void) | null = null;
  const ctx = {
    sampleRate: taxa,
    destination: {},
    createScriptProcessor: vi.fn(() => ({
      set onaudioprocess(f: ((ev: unknown) => void) | null) { tratador = f; },
      get onaudioprocess() { return tratador; },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createGain: vi.fn(() => ({ gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() })),
  };
  const fonte = { connect: vi.fn(), disconnect: vi.fn() };
  const entregar = (audio: Float32Array) => {
    for (let i = 0; i < audio.length; i += 4096) {
      const bloco = audio.slice(i, i + 4096);
      tratador?.({ inputBuffer: { getChannelData: () => bloco } });
    }
  };
  return { ctx: ctx as unknown as AudioContext, fonte: fonte as unknown as MediaStreamAudioSourceNode, entregar };
}

const seno = (freq: number, taxa: number, seg: number, amplitude = 0.5) => {
  const n = Math.round(taxa * seg);
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) s[i] = amplitude * Math.sin((2 * Math.PI * freq * i) / taxa);
  return s;
};

const lerWav = (wav: Blob): Promise<Int16Array> =>
  new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(new Int16Array((leitor.result as ArrayBuffer).slice(44)));
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsArrayBuffer(wav);
  });

const amplitudeEm = (amostras: Int16Array, freq: number, taxa: number) => {
  const w = (2 * Math.PI * freq) / taxa;
  const coef = 2 * Math.cos(w);
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < amostras.length; i++) {
    const s0 = amostras[i] / 32767 + coef * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return (2 * Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - coef * s1 * s2))) / amostras.length;
};

describe('iniciarCapturaPCM: o WAV de 16 kHz que segue para a transcrição final', () => {
  it('a 48 kHz: tem a duração certa, mantém a fala (1 kHz) e não deixa o chiado de 12 kHz virar um tom falso de 4 kHz', async () => {
    const { ctx, fonte, entregar } = criarContexto(48000);
    const captura = iniciarCapturaPCM(ctx, fonte);
    const fala = seno(1000, 48000, 2);
    const chiado = seno(12000, 48000, 2);
    entregar(Float32Array.from(fala, (v, i) => v + chiado[i]));
    expect(Math.abs(captura.samples - 2 * 16000)).toBeLessThanOrEqual(2);
    const amostras = await lerWav(captura.stop());
    expect(amostras.length).toBe(captura.samples);
    const miolo = amostras.subarray(400, amostras.length - 400);
    expect(amplitudeEm(miolo, 1000, 16000)).toBeGreaterThan(0.5 * 0.94);
    expect(amplitudeEm(miolo, 4000, 16000)).toBeLessThan(0.005); // antes, sem filtro, aparecia com ~0,5
  });

  it('a 16 kHz (contexto já na taxa do Whisper): passa as amostras sem mexer', async () => {
    const { ctx, fonte, entregar } = criarContexto(16000);
    const captura = iniciarCapturaPCM(ctx, fonte);
    entregar(seno(1000, 16000, 1));
    expect(captura.samples).toBe(16000);
    const amostras = await lerWav(captura.stop());
    expect(amplitudeEm(amostras, 1000, 16000)).toBeGreaterThan(0.49);
  });
});
