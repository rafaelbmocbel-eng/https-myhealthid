import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  toast: vi.fn(),
  transcreverAudio: vi.fn(),
  motores: [] as Array<{
    opcoes: { aoAtualizar?: (e: { texto: string; pendentes: number; falhas: number; indisponivel: boolean }) => void };
    anexar: ReturnType<typeof vi.fn>;
    encerrar: ReturnType<typeof vi.fn>;
    cancelar: ReturnType<typeof vi.fn>;
  }>,
  anexarFalha: false,
  resultado: { texto: '', completo: true } as { texto: string; completo: boolean },
}));

vi.mock('@/hooks/use-toast', () => ({ toast: h.toast }));
vi.mock('@/lib/transcreverAudio', () => ({ transcreverAudio: h.transcreverAudio }));
vi.mock('@/lib/transcricaoAoVivo', () => ({
  PERFIL_DITADO: { minSeg: 4, maxSeg: 14, pausaMs: 450 },
  TranscritorAoVivo: class {
    anexar = vi.fn(async () => { if (h.anexarFalha) throw new Error('Web Audio indisponível'); });
    encerrar = vi.fn(async () => h.resultado);
    cancelar = vi.fn();
    constructor(public opcoes: { aoAtualizar?: (e: { texto: string; pendentes: number; falhas: number; indisponivel: boolean }) => void }) {
      h.motores.push(this as unknown as (typeof h.motores)[number]);
    }
  },
}));

import { useSpeechToText } from '@/hooks/useSpeechToText';

// Microfone e gravador de mentira: o gravador entrega alguns bytes e chama onstop ao parar.
let gravadores: Array<{ stop: () => void; state: string }> = [];
class MediaRecorderFalso {
  static isTypeSupported = () => true;
  state = 'inactive';
  mimeType = 'audio/webm;codecs=opus';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(public stream: { getTracks: () => Array<{ stop: () => void }> }) { gravadores.push(this); }
  start() { this.state = 'recording'; this.ondataavailable?.({ data: new Blob([new Uint8Array(4000)]) }); }
  stop() { this.state = 'inactive'; this.onstop?.(); }
}
const trilhas = [{ stop: vi.fn() }];

beforeEach(() => {
  h.toast.mockReset();
  h.transcreverAudio.mockReset();
  h.motores.length = 0;
  h.anexarFalha = false;
  h.resultado = { texto: '', completo: true };
  gravadores = [];
  trilhas[0].stop.mockReset();
  (globalThis as unknown as { MediaRecorder: unknown }).MediaRecorder = MediaRecorderFalso;
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(async () => ({ getTracks: () => trilhas })) },
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

const gravar = async (onResult = vi.fn()) => {
  const hook = renderHook(() => useSpeechToText());
  await act(async () => { hook.result.current.startListening(onResult); });
  await waitFor(() => expect(hook.result.current.isListening).toBe(true));
  return { ...hook, onResult };
};
const parar = async (hook: Awaited<ReturnType<typeof gravar>>) => {
  await act(async () => { hook.result.current.stopListening(); });
  await waitFor(() => expect(hook.result.current.isTranscribing).toBe(false));
};

describe('useSpeechToText: ao vivo', () => {
  it('mostra o texto aparecendo enquanto grava, entrega o texto do ao vivo ao parar e NÃO manda o áudio inteiro de novo', async () => {
    const hook = await gravar();
    expect(h.motores).toHaveLength(1);
    expect(h.motores[0].anexar).toHaveBeenCalledTimes(1);
    act(() => h.motores[0].opcoes.aoAtualizar!({ texto: 'dor no joelho direito', pendentes: 1, falhas: 0, indisponivel: false }));
    expect(hook.result.current.liveText).toBe('dor no joelho direito');
    h.resultado = { texto: 'dor no joelho direito ao subir escada', completo: true };
    await parar(hook);
    expect(hook.onResult).toHaveBeenCalledTimes(1);
    expect(hook.onResult).toHaveBeenCalledWith('dor no joelho direito ao subir escada');
    expect(h.transcreverAudio).not.toHaveBeenCalled();
    expect(hook.result.current.liveText).toBe('');
    expect(trilhas[0].stop).toHaveBeenCalled(); // soltou o microfone
  });

  it('algum trecho falhou no ao vivo: transcreve o áudio inteiro, como antes (nada se perde)', async () => {
    h.resultado = { texto: 'só um pedaço', completo: false };
    h.transcreverAudio.mockResolvedValue('texto completo do áudio inteiro');
    const hook = await gravar();
    await parar(hook);
    expect(h.transcreverAudio).toHaveBeenCalledTimes(1);
    expect(hook.onResult).toHaveBeenCalledWith('texto completo do áudio inteiro');
  });

  it('o navegador não tem Web Audio: segue só com a gravação inteira, sem erro para a pessoa', async () => {
    h.anexarFalha = true;
    h.transcreverAudio.mockResolvedValue('ditado sem ao vivo');
    const hook = await gravar();
    await waitFor(() => expect(h.motores[0].cancelar).toHaveBeenCalled());
    await parar(hook);
    expect(h.motores[0].encerrar).not.toHaveBeenCalled();
    expect(hook.onResult).toHaveBeenCalledWith('ditado sem ao vivo');
    expect(h.toast).not.toHaveBeenCalled();
  });

  it('gravou só silêncio (ao vivo completo e vazio): avisa que não ouviu nada, não chama ninguém e não escreve nada', async () => {
    h.resultado = { texto: '', completo: true };
    const hook = await gravar();
    await parar(hook);
    expect(hook.onResult).not.toHaveBeenCalled();
    expect(h.transcreverAudio).not.toHaveBeenCalled();
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Não ouvi nenhuma fala' }));
  });

  it('falha também no áudio inteiro: avisa e não escreve nada', async () => {
    h.resultado = { texto: '', completo: false };
    h.transcreverAudio.mockRejectedValue(new Error('servidor fora do ar'));
    const hook = await gravar();
    await parar(hook);
    expect(hook.onResult).not.toHaveBeenCalled();
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Não consegui transcrever', variant: 'destructive' }));
  });

  it('enquanto finaliza, isTranscribing fica verdadeiro e a caixa de ao vivo segue com o texto', async () => {
    let terminar: (r: { texto: string; completo: boolean }) => void = () => {};
    const hook = await gravar();
    h.motores[0].encerrar.mockImplementation(() => new Promise((r) => { terminar = r; }));
    act(() => h.motores[0].opcoes.aoAtualizar!({ texto: 'primeiro trecho', pendentes: 0, falhas: 0, indisponivel: false }));
    await act(async () => { hook.result.current.stopListening(); });
    expect(hook.result.current.isListening).toBe(false);
    expect(hook.result.current.isTranscribing).toBe(true);
    expect(hook.result.current.liveText).toBe('primeiro trecho');
    await act(async () => { terminar({ texto: 'primeiro trecho e o resto', completo: true }); });
    await waitFor(() => expect(hook.result.current.isTranscribing).toBe(false));
    expect(hook.onResult).toHaveBeenCalledWith('primeiro trecho e o resto');
  });

  it('tocar de novo em "gravar" com a gravação em andamento não abre um segundo microfone', async () => {
    const hook = await gravar();
    await act(async () => { hook.result.current.startListening(vi.fn()); });
    expect(h.motores).toHaveLength(1);
    expect(gravadores).toHaveLength(1);
    await parar(hook);
  });

  it('sair da tela no meio da gravação solta o microfone, cancela o ao vivo e não entrega texto', async () => {
    const hook = await gravar();
    hook.unmount();
    expect(h.motores[0].cancelar).toHaveBeenCalled();
    expect(trilhas[0].stop).toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 20));
    expect(hook.onResult).not.toHaveBeenCalled();
    expect(h.transcreverAudio).not.toHaveBeenCalled();
  });

  it('sem permissão do microfone: avisa e não fica "gravando"', async () => {
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('NotAllowedError'));
    const hook = renderHook(() => useSpeechToText());
    await act(async () => { hook.result.current.startListening(vi.fn()); });
    expect(hook.result.current.isListening).toBe(false);
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao acessar microfone' }));
    expect(h.motores).toHaveLength(0);
  });
});
