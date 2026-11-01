import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: h.invoke } } }));
vi.mock('@/lib/audioParaWav', () => ({ blobParaBase64: vi.fn(async () => 'YXVkaW8=') }));

import { transcreverAudio } from '@/lib/transcreverAudio';

const audio = () => new Blob([new Uint8Array(2000)], { type: 'audio/webm' });

beforeEach(() => { h.invoke.mockReset(); });

describe('transcreverAudio', () => {
  it('manda o áudio em base64 com o sinal de aborto e o limite de 2 min, e devolve o texto sem espaços nas pontas', async () => {
    h.invoke.mockResolvedValue({ data: { texto: '  dor lombar  ' }, error: null });
    const controle = new AbortController();
    expect(await transcreverAudio(audio(), controle.signal)).toBe('dor lombar');
    expect(h.invoke).toHaveBeenCalledWith('transcrever-audio', {
      body: { audioBase64: 'YXVkaW8=', audioMimeType: 'audio/webm' },
      signal: controle.signal,
      timeout: 120_000,
    });
  });

  it('sinal já abortado quando o áudio fica pronto (cancelou durante a conversão): não envia nada ao servidor', async () => {
    const controle = new AbortController();
    const pronto = transcreverAudio(audio(), controle.signal);
    controle.abort();
    await expect(pronto).rejects.toMatchObject({ name: 'AbortError' });
    expect(h.invoke).not.toHaveBeenCalled();
  });

  it('erro do servidor ou resposta sem texto vira erro (quem chama decide o que fazer)', async () => {
    h.invoke.mockResolvedValueOnce({ data: null, error: new Error('502') });
    await expect(transcreverAudio(audio())).rejects.toThrow('502');
    h.invoke.mockResolvedValueOnce({ data: { error: 'Sem texto' }, error: null });
    await expect(transcreverAudio(audio())).rejects.toThrow('Sem texto');
  });
});
