import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { serializarAnalise } from '../lib/angular/analiseVideo/persistencia';
import type { VideoCarregado } from '../lib/angular/analiseVideo/carregarVideo';
import { trilhaVazia } from '../lib/angular/analiseVideo/trilhaVazia';

const mocks = vi.hoisted(() => ({ ler: vi.fn() }));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: null, profile: null }) }));
vi.mock('@/lib/dosagem/db', () => ({ tabela: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/utils/pdfBranding', () => ({ carregarBrandingClinica: async () => ({}) }));
vi.mock('@/lib/pdf/entrega', () => ({ entregarPdf: vi.fn(), baixarBlob: vi.fn() }));
vi.mock('@/lib/angular/analiseVideo/rascunho', () => ({ apagarRascunho: async () => true, lerRascunho: async () => null, salvarRascunho: async () => true }));
vi.mock('@/lib/angular/analiseVideo/carregarVideo', async (original) => ({
  ...(await original<typeof import('@/lib/angular/analiseVideo/carregarVideo')>()),
  lerMetadadosDoVideo: mocks.ler,
  estimarFps: async () => null,
}));

const { default: AnaliseVideo } = await import('../components/angular/video/AnaliseVideo');

const videoA = (): VideoCarregado => ({ url: 'blob:a', arquivo: new File(['a'], 'a.mp4', { type: 'video/mp4' }), nome: 'a.mp4', tamanho: 5000, duracao: 6, largura: 640, altura: 480 });
const videoB = (): VideoCarregado => ({ url: 'blob:b', arquivo: new File(['b'], 'b.mp4', { type: 'video/mp4' }), nome: 'b.mp4', tamanho: 9000, duracao: 12, largura: 1280, altura: 720 });

function arquivoDaAnalise(v: VideoCarregado): File {
  const texto = serializarAnalise({
    video: { nome: '', tamanho: v.tamanho, duracao: v.duracao, largura: v.largura, altura: v.altura }, modeloId: 'marcha', fpsVideo: 30, intervalo: { inicio: 0, fim: 2 },
    trilha: trilhaVazia(30, 0, 2, v.largura, v.altura), eventos: null, cmPorPx: null, extras: {},
  });
  return new File([texto], 'analise.json', { type: 'application/json' });
}

beforeEach(() => {
  mocks.ler.mockReset();
  mocks.ler.mockImplementation(async (f: File) => (f.name === 'a.mp4' ? videoA() : videoB()));
  vi.mocked(toast.error).mockReset();
  vi.mocked(toast.success).mockReset();
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: vi.fn() });
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: vi.fn(() => 'blob:x') });
});
afterEach(cleanup);

const escolherVideo = (f: File) => fireEvent.change(screen.getByTestId('entrada-video'), { target: { files: [f] } });

describe('retomar uma análise salva escolhendo o vídeo dela', () => {
  it('um vídeo errado não entra no estado e a análise aberta continua esperando o vídeo certo', async () => {
    render(<AnaliseVideo paciente={null} entrada="gesto" />);
    fireEvent.change(screen.getByTestId('entrada-analise'), { target: { files: [arquivoDaAnalise(videoA())] } });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Análise aberta/));

    escolherVideo(new File(['b'], 'b.mp4', { type: 'video/mp4' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/não é o da análise salva/)));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:b');
    expect(screen.getByTestId('entrada-video')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/Escolha agora o vídeo dela/);
    expect(screen.queryByTestId('analise-video')).toBeNull();

    escolherVideo(new File(['a'], 'a.mp4', { type: 'video/mp4' }));
    await waitFor(() => expect(screen.getByTestId('analise-video')).toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith('Análise retomada.');
  });

  it('depois do erro, abrir o mesmo arquivo de novo guarda a análise (não responde "outro vídeo") e o vídeo certo a retoma', async () => {
    render(<AnaliseVideo paciente={null} entrada="gesto" />);
    const json = () => arquivoDaAnalise(videoA());
    fireEvent.change(screen.getByTestId('entrada-analise'), { target: { files: [json()] } });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Análise aberta/));
    escolherVideo(new File(['b'], 'b.mp4', { type: 'video/mp4' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByTestId('entrada-analise'), { target: { files: [json()] } });
    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(2));
    expect(toast.success).toHaveBeenLastCalledWith(expect.stringMatching(/Agora escolha o vídeo dela/));
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent(/Análise aberta/);

    escolherVideo(new File(['a'], 'a.mp4', { type: 'video/mp4' }));
    await waitFor(() => expect(screen.getByTestId('analise-video')).toBeInTheDocument());
  });
});
