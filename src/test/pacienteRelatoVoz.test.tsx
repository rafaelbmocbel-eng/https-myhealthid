import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({
  toast: vi.fn(),
  transcreverAudio: vi.fn(),
  invoke: vi.fn(),
  motores: [] as Array<{ anexar: ReturnType<typeof vi.fn>; encerrar: ReturnType<typeof vi.fn>; cancelar: ReturnType<typeof vi.fn> }>,
  resultado: { texto: '', completo: true, vozMs: 0 } as { texto: string; completo: boolean; vozMs: number },
  // 'sincrono': onstop sai junto com stop(); 'adiado': só quando o teste mandar (o gravador real demora alguns ms)
  modoParada: 'sincrono' as 'sincrono' | 'adiado',
  bytesPorGravacao: [4000, 4000, 4000] as number[],
}));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: h.toast }) }));
vi.mock('@/lib/transcreverAudio', () => ({ transcreverAudio: h.transcreverAudio }));
vi.mock('@/components/presencial/Body3DAvatar', () => ({ REGIONS: [], STRUCTURES: {} }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: h.invoke },
    from: () => {
      const c: Record<string, unknown> = {};
      c.select = () => c;
      c.eq = () => c;
      c.order = () => c;
      c.limit = () => Promise.resolve({ data: [], error: null });
      return c;
    },
  },
}));
vi.mock('@/lib/transcricaoAoVivo', async (importarOriginal) => ({
  ...(await importarOriginal<typeof import('@/lib/transcricaoAoVivo')>()),
  TranscritorAoVivo: class {
    anexar = vi.fn(async () => {});
    encerrar = vi.fn(async (_duracaoMs?: number) => h.resultado);
    cancelar = vi.fn();
    constructor(public opcoes: unknown) { h.motores.push(this as unknown as (typeof h.motores)[number]); }
  },
}));

import PacienteRelatoVoz from '@/components/paciente/PacienteRelatoVoz';

let gravadores: MediaRecorderFalso[] = [];
class MediaRecorderFalso {
  static isTypeSupported = () => true;
  state = 'inactive';
  mimeType = 'audio/webm;codecs=opus';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  indice: number;
  constructor(public stream: { getTracks: () => Array<{ stop: () => void }> }) { this.indice = gravadores.length; gravadores.push(this); }
  start() {
    this.state = 'recording';
    this.ondataavailable?.({ data: new Blob([new Uint8Array(h.bytesPorGravacao[this.indice] ?? 4000)]) });
  }
  stop() {
    this.state = 'inactive';
    if (h.modoParada === 'sincrono') this.onstop?.();
  }
  pararDeVerdade() { this.onstop?.(); }
}
const microfones: Array<{ stop: ReturnType<typeof vi.fn> }> = [];

beforeEach(() => {
  h.toast.mockReset();
  h.transcreverAudio.mockReset();
  h.invoke.mockReset();
  h.invoke.mockImplementation(async (nome: string) => ({ data: nome === 'voice-assessment' ? { assessment: {}, transcricao: 'transcrito no envio' } : {}, error: null }));
  h.motores.length = 0;
  h.resultado = { texto: '', completo: true, vozMs: 0 };
  h.modoParada = 'sincrono';
  h.bytesPorGravacao = [4000, 4000, 4000];
  gravadores = [];
  microfones.length = 0;
  (globalThis as unknown as { MediaRecorder: unknown }).MediaRecorder = MediaRecorderFalso;
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi.fn(async () => {
        const trilha = { stop: vi.fn() };
        microfones.push(trilha);
        return { getTracks: () => [trilha] };
      }),
    },
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

const montar = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><PacienteRelatoVoz pacienteId="pac-1" /></QueryClientProvider>);
};
const caixa = () => screen.getByPlaceholderText(/Ou escreva aqui/) as HTMLTextAreaElement;
const gravar = async () => {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Gravar áudio/ })); });
  await screen.findByRole('button', { name: /Parar/ });
};
const parar = async () => {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Parar/ })); });
  await waitFor(() => expect(screen.queryByText('Finalizando a transcrição…')).toBeNull());
};

describe('PacienteRelatoVoz: transcrição ao vivo', () => {
  it('ao vivo completo: o texto vai para a caixa para a pessoa conferir e o áudio inteiro não é transcrito de novo', async () => {
    h.resultado = { texto: 'dor no joelho há dois meses', completo: true, vozMs: 4000 };
    montar();
    await gravar();
    await parar();
    expect(caixa().value).toBe('dor no joelho há dois meses');
    expect(h.transcreverAudio).not.toHaveBeenCalled();
  });

  it('ao vivo incompleto e o áudio inteiro também falha: o texto parcial NÃO entra na caixa (valeria no lugar do áudio) e o envio leva o ÁUDIO', async () => {
    h.resultado = { texto: 'dor no joelho esquerdo que começou no mês passado', completo: false, vozMs: 4000 };
    h.transcreverAudio.mockRejectedValue(new Error('sem rede'));
    montar();
    await gravar();
    await parar();
    expect(caixa().value).toBe('');
    await screen.findByText(/Ele será transcrito quando você enviar/); // aviso claro: nada de "pronto para enviar" como se estivesse tudo certo
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Enviar relato/ })); });
    await waitFor(() => expect(h.invoke).toHaveBeenCalledWith('voice-assessment', expect.anything()));
    const corpo = h.invoke.mock.calls.find(([nome]) => nome === 'voice-assessment')![1].body;
    expect(typeof corpo.audioBase64).toBe('string');
    expect(corpo.transcript).toBeUndefined();
    expect(corpo.appendAudio).toBeUndefined();
  });

  it('o áudio inteiro só devolve texto inventado: vale o que apareceu ao vivo', async () => {
    h.resultado = { texto: 'dor no ombro direito', completo: false, vozMs: 4000 };
    h.transcreverAudio.mockResolvedValue('Legendas pela comunidade Amara.org');
    montar();
    await gravar();
    await parar();
    expect(caixa().value).toBe('dor no ombro direito');
  });

  it('saiu da tela no meio da gravação: solta o microfone, cancela o motor e não transcreve nada', async () => {
    const { unmount } = montar();
    await gravar();
    unmount();
    expect(h.motores[0].cancelar).toHaveBeenCalled();
    expect(microfones[0].stop).toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 20));
    expect(h.transcreverAudio).not.toHaveBeenCalled();
  });

  it('saiu da tela depois do Parar, enquanto finaliza: cancela o motor que espera o último trecho', async () => {
    let terminar: (r: { texto: string; completo: boolean; vozMs: number }) => void = () => {};
    const { unmount } = montar();
    await gravar();
    h.motores[0].encerrar.mockImplementation(() => new Promise((r) => { terminar = r; }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Parar/ })); });
    unmount();
    expect(h.motores[0].cancelar).toHaveBeenCalled();
    await act(async () => { terminar({ texto: 'texto atrasado', completo: true, vozMs: 3000 }); });
    expect(h.toast).not.toHaveBeenCalled();
  });

  it('o gravador para sozinho (permissão revogada, ligação): a tela não fica "gravando" e o microfone é solto', async () => {
    montar();
    await gravar();
    await act(async () => { gravadores[0].state = 'inactive'; gravadores[0].pararDeVerdade(); });
    await waitFor(() => expect(screen.getByRole('button', { name: /Gravar áudio/ })).toBeTruthy());
    expect(screen.queryByRole('button', { name: /Parar/ })).toBeNull();
    expect(microfones[0].stop).toHaveBeenCalled();
  });

  it('Parar e logo Gravar de novo (duplo toque, onstop ainda não chegou): não abre segunda gravação por cima; quando o onstop chega, a tela fica coerente e dá para gravar de novo', async () => {
    h.modoParada = 'adiado';
    h.resultado = { texto: 'primeira gravação', completo: true, vozMs: 3000 };
    montar();
    await gravar();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Parar/ })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Gravar áudio/ })); });
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    expect(gravadores).toHaveLength(1);
    await act(async () => { gravadores[0].pararDeVerdade(); });
    await waitFor(() => expect(caixa().value).toBe('primeira gravação'));
    expect(microfones[0].stop).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Parar/ })).toBeNull();
    await gravar();
    expect(gravadores).toHaveLength(2);
    expect(gravadores[1].state).toBe('recording');
  });

  it('o onstop de uma gravação não leva a duração da gravação seguinte (cada gravação informa ao motor a sua)', async () => {
    let agora = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => agora);
    montar();
    await gravar();
    agora += 3_000;
    await parar();
    expect(h.motores[0].encerrar).toHaveBeenCalledWith(3_000);
    await gravar();
    agora += 7_000;
    await parar();
    expect(h.motores[1].encerrar).toHaveBeenCalledWith(7_000);
  });

  it('dois toques seguidos em "Gravar áudio" antes da permissão chegar abrem um microfone só', async () => {
    let liberar: (s: unknown) => void = () => {};
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockImplementationOnce(() => new Promise((r) => { liberar = r; }));
    montar();
    const botao = screen.getByRole('button', { name: /Gravar áudio/ });
    await act(async () => { fireEvent.click(botao); fireEvent.click(botao); });
    await act(async () => { liberar({ getTracks: () => [{ stop: vi.fn() }] }); });
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    expect(gravadores).toHaveLength(1);
  });

  it('gravação mínima (menos de 1 KB) sem texto do ao vivo: não manda o áudio inteiro ao servidor', async () => {
    h.bytesPorGravacao = [10];
    h.resultado = { texto: '', completo: false, vozMs: 0 };
    montar();
    await gravar();
    await parar();
    expect(h.transcreverAudio).not.toHaveBeenCalled();
    expect(caixa().value).toBe('');
  });
});

// O servidor só transcreve o áudio quando não há texto na caixa (20 caracteres ou mais): com texto, ele usa só o texto.
// Por isso o áudio de uma gravação que não virou texto precisa ser SOMADO ao texto no envio (appendAudio), senão a fala some.
describe('PacienteRelatoVoz: gravação que não virou texto com a caixa já preenchida', () => {
  const corpoDoEnvio = () => h.invoke.mock.calls.find(([nome]) => nome === 'voice-assessment')![1].body;
  const enviar = async () => {
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Enviar relato/ })); });
    await waitFor(() => expect(h.invoke).toHaveBeenCalledWith('voice-assessment', expect.anything()), { timeout: 4000 });
  };

  it('2a gravação falha em tudo com a caixa já preenchida pela 1a: o envio manda o texto E o áudio com appendAudio, e o relato usa o texto somado devolvido pelo servidor', async () => {
    h.resultado = { texto: 'dor no joelho direito há duas semanas', completo: true, vozMs: 4000 };
    montar();
    await gravar();
    await parar();
    expect(caixa().value).toBe('dor no joelho direito há duas semanas');
    h.resultado = { texto: 'formigamento no pé esquerdo', completo: false, vozMs: 4000 };
    h.transcreverAudio.mockRejectedValue(new Error('sem rede'));
    h.invoke.mockImplementation(async (nome: string) => ({ data: nome === 'voice-assessment' ? { assessment: {}, transcricao: 'dor no joelho direito há duas semanas\n\nformigamento no pé esquerdo' } : {}, error: null }));
    await gravar();
    await parar();
    expect(caixa().value).toBe('dor no joelho direito há duas semanas'); // o parcial não entra: valeria no lugar do áudio
    await screen.findByText(/Ele será transcrito quando você enviar/);
    await enviar();
    const corpo = corpoDoEnvio();
    expect(corpo.appendAudio).toBe(true);
    expect(corpo.transcript).toBe('dor no joelho direito há duas semanas');
    expect(typeof corpo.audioBase64).toBe('string');
    await waitFor(() => expect(h.invoke).toHaveBeenCalledWith('extract-pain-from-voice', expect.anything()));
    const dor = h.invoke.mock.calls.find(([nome]) => nome === 'extract-pain-from-voice')![1].body;
    expect(dor.transcript).toContain('formigamento no pé esquerdo'); // a fala da 2a gravação chegou à extração de dor e ao relato salvo
  });

  it('texto digitado (20 caracteres ou mais) e uma gravação que falhou: o áudio também é somado', async () => {
    h.resultado = { texto: '', completo: false, vozMs: 4000 };
    h.transcreverAudio.mockRejectedValue(new Error('sem rede'));
    montar();
    fireEvent.change(caixa(), { target: { value: 'estou com dor nas costas desde ontem' } });
    await gravar();
    await parar();
    await enviar();
    expect(corpoDoEnvio().appendAudio).toBe(true);
  });

  it('a 2a gravação virou texto: o áudio não é somado (o texto já tem a fala, somar duplicaria)', async () => {
    h.resultado = { texto: 'dor no joelho direito há duas semanas', completo: true, vozMs: 4000 };
    montar();
    await gravar();
    await parar();
    h.resultado = { texto: 'também sinto formigamento', completo: true, vozMs: 3000 };
    await gravar();
    await parar();
    await waitFor(() => expect(caixa().value).toContain('formigamento'));
    await enviar();
    expect(corpoDoEnvio().appendAudio).toBeUndefined();
    expect(screen.queryByText(/Ele será transcrito quando você enviar/)).toBeNull();
  });

  it('gravação que era só silêncio (ao vivo completo e vazio) não gera o aviso nem soma áudio', async () => {
    h.resultado = { texto: '', completo: true, vozMs: 0 };
    montar();
    fireEvent.change(caixa(), { target: { value: 'estou com dor nas costas desde ontem' } });
    await gravar();
    await parar();
    expect(screen.queryByText(/Ele será transcrito quando você enviar/)).toBeNull();
    await enviar();
    expect(corpoDoEnvio().appendAudio).toBeUndefined();
  });

  it('a falha que passou: depois de uma gravação que virou texto, o aviso some e o áudio volta a ser tratado como já transcrito', async () => {
    h.resultado = { texto: '', completo: false, vozMs: 4000 };
    h.transcreverAudio.mockRejectedValueOnce(new Error('sem rede'));
    montar();
    await gravar();
    await parar();
    await screen.findByText(/Ele será transcrito quando você enviar/);
    h.resultado = { texto: 'dor no ombro direito desde ontem', completo: true, vozMs: 4000 };
    await gravar();
    await parar();
    await waitFor(() => expect(screen.queryByText(/Ele será transcrito quando você enviar/)).toBeNull());
    expect(caixa().value).toBe('dor no ombro direito desde ontem');
  });

  it('"Enviar outro relato" limpa o aviso e o estado da gravação', async () => {
    h.resultado = { texto: '', completo: false, vozMs: 4000 };
    h.transcreverAudio.mockRejectedValue(new Error('sem rede'));
    montar();
    await gravar();
    await parar();
    await enviar();
    await screen.findByText('Relato enviado!');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Enviar outro relato/ })); });
    expect(screen.queryByText(/Ele será transcrito quando você enviar/)).toBeNull();
    h.invoke.mockClear();
    fireEvent.change(caixa(), { target: { value: 'estou com dor nas costas desde ontem' } });
    await enviar();
    expect(corpoDoEnvio().appendAudio).toBeUndefined();
    expect(corpoDoEnvio().audioBase64).toBeUndefined();
  });
});

describe('PacienteRelatoVoz: sair da tela', () => {
  it('saiu da tela com o motor ainda esperando o último trecho: o áudio inteiro nem é enviado (o cancelar do motor devolve "incompleto")', async () => {
    let terminar: (r: { texto: string; completo: boolean; vozMs: number }) => void = () => {};
    const { unmount } = montar();
    await gravar();
    h.motores[0].encerrar.mockImplementation(() => new Promise((r) => { terminar = r; }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Parar/ })); });
    unmount();
    await act(async () => { terminar({ texto: '', completo: false, vozMs: 0 }); });
    expect(h.transcreverAudio).not.toHaveBeenCalled();
  });

  it('saiu da tela com o áudio inteiro em andamento: o envio é abortado', async () => {
    h.resultado = { texto: '', completo: false, vozMs: 4000 };
    let sinal: AbortSignal | undefined;
    h.transcreverAudio.mockImplementation((_blob: Blob, s?: AbortSignal) => { sinal = s; return new Promise(() => {}); });
    const { unmount } = montar();
    await gravar();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Parar/ })); });
    await waitFor(() => expect(h.transcreverAudio).toHaveBeenCalledTimes(1));
    expect(sinal?.aborted).toBe(false);
    unmount();
    expect(sinal?.aborted).toBe(true);
  });
});

describe('PacienteRelatoVoz: invenção do Whisper no áudio inteiro', () => {
  it('o ao vivo não ouviu voz e o áudio inteiro devolve só "Obrigado.": não entra na caixa', async () => {
    h.resultado = { texto: '', completo: false, vozMs: 0 };
    h.transcreverAudio.mockResolvedValue('Obrigado.');
    montar();
    await gravar();
    await parar();
    expect(caixa().value).toBe('');
  });

  it('o ao vivo ouviu uma fala longa e o áudio inteiro devolve "Obrigado.": é fala, entra na caixa', async () => {
    h.resultado = { texto: '', completo: false, vozMs: 5000 };
    h.transcreverAudio.mockResolvedValue('Obrigado.');
    montar();
    await gravar();
    await parar();
    expect(caixa().value).toBe('Obrigado.');
  });
});
