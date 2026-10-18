import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import PainelMedidaManual from '../components/angular/video/PainelMedidaManual';
import { useMedidasManuais } from '../components/angular/video/useMedidasManuais';
import type { CapturaManual } from '../lib/angular/analiseVideo/medidaManual';
import type { VideoCarregado } from '../lib/angular/analiseVideo/carregarVideo';
import { serializarAnalise } from '../lib/angular/analiseVideo/persistencia';
import { trilhaVazia } from '../lib/angular/analiseVideo/trilhaVazia';

const mocks = vi.hoisted(() => ({ ler: vi.fn(), rastrear: vi.fn(), baixarBlob: vi.fn() }));

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: null, profile: null }) }));
vi.mock('@/lib/dosagem/db', () => ({ tabela: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/utils/pdfBranding', () => ({ carregarBrandingClinica: async () => ({}) }));
vi.mock('@/lib/pdf/entrega', () => ({ entregarPdf: vi.fn(), baixarBlob: mocks.baixarBlob }));
vi.mock('@/lib/angular/analiseVideo/rascunho', () => ({ apagarRascunho: async () => true, lerRascunho: async () => null, salvarRascunho: async () => true }));
vi.mock('@/lib/angular/analiseVideo/carregarVideo', async (original) => ({
  ...(await original<typeof import('@/lib/angular/analiseVideo/carregarVideo')>()),
  lerMetadadosDoVideo: mocks.ler,
  estimarFps: async () => null,
}));
vi.mock('@/lib/angular/video', async (original) => ({
  ...(await original<typeof import('@/lib/angular/video')>()),
  rastrearVideo: mocks.rastrear,
}));

const { default: AnaliseVideo } = await import('../components/angular/video/AnaliseVideo');

const captura = (uid: string, quadro: number, t: number): CapturaManual => ({
  uid, medidaId: 'joelho-d', nome: 'Joelho direito', t, quadro, pontos: [{ x: 10, y: 10 }, { x: 20, y: 30 }, { x: 15, y: 60 }], valor: 40, unidade: 'graus', texto: '40°',
});
const temposDe = (inicio: number, fim: number, fps = 30) => Array.from({ length: Math.floor((fim - inicio) * fps + 1e-6) }, (_, i) => inicio + i / fps);

afterEach(cleanup);

describe('hook das medidas manuais: o que vale no trecho atual', () => {
  const opcoes = (tempos: number[], quadro = 0) => ({ quadro, t: tempos[quadro] ?? 0, largura: 640, altura: 480, quadroPose: undefined, tocando: false, tempos, fps: 30 });

  it('as de fora não aparecem nos quadros da trilha nova, nem quando o índice guardado coincide com o de um quadro dela', () => {
    const { result, rerender } = renderHook((p: ReturnType<typeof opcoes>) => useMedidasManuais(p), { initialProps: opcoes(temposDe(0, 3), 10) });
    act(() => { result.current.restaurar([captura('a', 10, 10 / 30), captura('b', 85, 85 / 30)]); });
    expect(result.current.daqui.map((c) => c.uid)).toEqual(['a']);
    rerender(opcoes(temposDe(2, 5), 10));
    expect(result.current.capturas).toHaveLength(2);
    expect(result.current.noTrecho.map((c) => c.uid)).toEqual(['b']);
    expect(result.current.foraDoTrecho.map((c) => c.uid)).toEqual(['a']);
    expect(result.current.daqui).toEqual([]);
    rerender(opcoes(temposDe(0, 3), 10));
    expect(result.current.daqui.map((c) => c.uid)).toEqual(['a']);
  });

  it('remover devolve a medida e reinserir a recoloca na ordem do instante', () => {
    const { result } = renderHook(() => useMedidasManuais(opcoes(temposDe(0, 3))));
    act(() => { result.current.restaurar([captura('a', 3, 0.1), captura('b', 30, 1), captura('c', 60, 2)]); });
    let removida: CapturaManual | undefined;
    act(() => { removida = result.current.remover('b'); });
    expect(removida?.uid).toBe('b');
    expect(result.current.capturas.map((c) => c.uid)).toEqual(['a', 'c']);
    act(() => { result.current.reinserir(removida as CapturaManual); });
    expect(result.current.capturas.map((c) => c.uid)).toEqual(['a', 'b', 'c']);
    act(() => { result.current.reinserir(removida as CapturaManual); });
    expect(result.current.capturas).toHaveLength(3);
    act(() => { expect(result.current.remover('nao-existe')).toBeUndefined(); });
  });
});

describe('lista de medidas guardadas com a marca "fora do trecho atual"', () => {
  beforeEach(() => { vi.mocked(toast).mockReset(); });

  function Tela({ tempos, aoIr = () => {} }: { tempos: number[]; aoIr?: (q: number) => void }) {
    const m = useMedidasManuais({ quadro: 0, t: tempos[0] ?? 0, largura: 640, altura: 480, quadroPose: undefined, tocando: false, tempos, fps: 30 });
    return (
      <>
        <button type="button" onClick={() => m.restaurar([captura('a', 3, 0.1), captura('b', 14, 2.4), captura('c', 210, 7)])}>carregar</button>
        <PainelMedidaManual m={m} temRastreio={false} tocando={false} aoIr={aoIr} />
      </>
    );
  }
  const abrir = (tempos: number[]) => {
    const r = render(<Tela tempos={tempos} />);
    fireEvent.click(screen.getByText('carregar'));
    return r;
  };

  it('as de dentro ficam na lista normal e as de fora numa área neutra com a marca, a frase e o botão Remover por item', () => {
    abrir(temposDe(2, 5));
    expect(screen.getByRole('heading', { name: 'Medidas guardadas (3)' })).toBeInTheDocument();
    const normais = screen.getAllByTestId('captura-manual');
    expect(normais).toHaveLength(1);
    expect(normais[0]).toHaveTextContent('2,40 s · quadro 13');
    const area = screen.getByTestId('medidas-fora-do-trecho');
    expect(area).toHaveTextContent(/Estas medidas estão fora do trecho atual \(2,0 s a 5,0 s\)/);
    expect(area).toHaveTextContent(/fora do gráfico, dos cartões, do PDF e do vídeo exportado/);
    expect(area).toHaveTextContent(/Se o trecho voltar a incluir o instante, elas voltam a valer/);
    const fora = screen.getAllByTestId('captura-fora-do-trecho');
    expect(fora).toHaveLength(2);
    for (const item of fora) {
      expect(item).toHaveTextContent('fora do trecho atual');
      expect(within(item).getByRole('button', { name: /^Remover medida fora do trecho/ })).toHaveTextContent('Remover');
      expect(within(item).queryByTitle('Ir para este quadro')).toBeNull();
    }
    expect(fora[0]).toHaveTextContent('0,10 s');
    expect(fora[1]).toHaveTextContent('7,00 s');
  });

  it('as de fora não levam a nenhum quadro; as de dentro continuam levando ao quadro derivado do instante', () => {
    const aoIr = vi.fn();
    render(<Tela tempos={temposDe(2, 5)} aoIr={aoIr} />);
    fireEvent.click(screen.getByText('carregar'));
    fireEvent.click(screen.getByTitle('Ir para este quadro'));
    expect(aoIr).toHaveBeenCalledExactlyOnceWith(12);
  });

  it('com uma só medida fora, a frase fica no singular', () => {
    abrir(temposDe(0, 3));
    expect(screen.getByTestId('medidas-fora-do-trecho')).toHaveTextContent(/Esta medida está fora do trecho atual \(0,0 s a 3,0 s\)/);
    expect(screen.getAllByTestId('captura-fora-do-trecho')).toHaveLength(1);
    expect(screen.getAllByTestId('captura-manual')).toHaveLength(2);
  });

  it('sem nenhuma fora do trecho, a área não existe', () => {
    abrir(temposDe(0, 8));
    expect(screen.queryByTestId('medidas-fora-do-trecho')).toBeNull();
    expect(screen.getAllByTestId('captura-manual')).toHaveLength(3);
  });

  it('trocar o trecho não apaga nada: o que estava dentro passa para a área de fora e o que voltou a caber, para a lista normal', () => {
    const { rerender } = abrir(temposDe(2, 5));
    expect(screen.getAllByTestId('captura-manual')).toHaveLength(1);
    rerender(<Tela tempos={temposDe(6, 9)} />);
    expect(screen.getByRole('heading', { name: 'Medidas guardadas (3)' })).toBeInTheDocument();
    expect(screen.getAllByTestId('captura-manual')).toHaveLength(1);
    expect(screen.getAllByTestId('captura-manual')[0]).toHaveTextContent('7,00 s');
    expect(screen.getAllByTestId('captura-fora-do-trecho')).toHaveLength(2);
    rerender(<Tela tempos={temposDe(2, 5)} />);
    expect(screen.getAllByTestId('captura-manual')[0]).toHaveTextContent('2,40 s');
    expect(screen.getAllByTestId('captura-fora-do-trecho')).toHaveLength(2);
  });

  it('só some com a ação explícita de remover, e o Desfazer do aviso a traz de volta', () => {
    abrir(temposDe(2, 5));
    const antes = screen.getAllByTestId('captura-fora-do-trecho');
    fireEvent.click(within(antes[1]).getByRole('button', { name: /Remover medida fora do trecho/ }));
    expect(screen.getAllByTestId('captura-fora-do-trecho')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Medidas guardadas (2)' })).toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith('Medida removida.', expect.objectContaining({ action: expect.objectContaining({ label: 'Desfazer' }) }));
    const opcoes = vi.mocked(toast).mock.calls[0][1] as { action: { onClick: () => void } };
    act(() => { opcoes.action.onClick(); });
    expect(screen.getAllByTestId('captura-fora-do-trecho')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Medidas guardadas (3)' })).toBeInTheDocument();
  });

  it('remover a última medida de fora tira a área; remover uma de dentro continua com o botão de sempre e o Desfazer', () => {
    abrir(temposDe(0, 3));
    fireEvent.click(within(screen.getByTestId('captura-fora-do-trecho')).getByRole('button', { name: /Remover medida fora do trecho/ }));
    expect(screen.queryByTestId('medidas-fora-do-trecho')).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Remover medida' })[0]);
    expect(screen.getAllByTestId('captura-manual')).toHaveLength(1);
    expect(toast).toHaveBeenCalledTimes(2);
  });
});

describe('análise completa: re-rastrear com outro trecho mantém as medidas guardadas', () => {
  const videoA = (): VideoCarregado => ({ url: 'blob:a', arquivo: new File(['a'], 'a.mp4', { type: 'video/mp4' }), nome: 'a.mp4', tamanho: 5000, duracao: 8, largura: 640, altura: 480 });
  const lerTexto = (b: Blob) => new Promise<string>((ok, falha) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => falha(r.error); r.readAsText(b); });

  function arquivoDaAnalise(): File {
    const v = videoA();
    const texto = serializarAnalise({
      video: { nome: '', tamanho: v.tamanho, duracao: v.duracao, largura: v.largura, altura: v.altura }, modeloId: 'marcha', fpsVideo: 30, intervalo: { inicio: 2, fim: 5 },
      trilha: trilhaVazia(30, 2, 5, v.largura, v.altura), eventos: null, cmPorPx: null,
      extras: { capturas: [captura('a', 3, 0.1), captura('b', 12, 2.4), captura('c', 150, 7)] },
    });
    return new File([texto], 'analise.json', { type: 'application/json' });
  }

  beforeEach(() => {
    mocks.ler.mockReset();
    mocks.ler.mockImplementation(async () => videoA());
    mocks.rastrear.mockReset();
    mocks.rastrear.mockImplementation(async (_el: unknown, o: { fps: number; intervalo: { inicio: number; fim: number } }) => trilhaVazia(o.fps, o.intervalo.inicio, o.intervalo.fim, 640, 480));
    mocks.baixarBlob.mockReset();
    // O jsdom não implementa pause() e avisaria a cada troca de gesto.
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    vi.mocked(toast.info).mockReset();
    vi.mocked(toast.error).mockReset();
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: vi.fn() });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: vi.fn(() => 'blob:x') });
  });

  async function abrirAnalise() {
    render(<AnaliseVideo paciente={null} entrada="ponto" />);
    fireEvent.change(screen.getByTestId('entrada-analise'), { target: { files: [arquivoDaAnalise()] } });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Análise aberta/));
    fireEvent.change(screen.getByTestId('entrada-video'), { target: { files: [new File(['a'], 'a.mp4', { type: 'video/mp4' })] } });
    await waitFor(() => expect(screen.getByTestId('analise-video')).toBeInTheDocument());
  }
  const rastrearDe = async (inicio: number, fim: number) => {
    fireEvent.click(screen.getByRole('button', { name: 'Trocar o gesto ou o trecho' }));
    await waitFor(() => expect(screen.getByLabelText('Início do trecho')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Início do trecho'), { target: { value: String(inicio) } });
    fireEvent.change(screen.getByLabelText('Fim do trecho'), { target: { value: String(fim) } });
    fireEvent.click(screen.getByTestId('botao-rastrear'));
    await waitFor(() => expect(screen.getByTestId('analise-video')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('aba-medir')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('aba-medir'));
  };

  it('abrir a análise salva já separa pelo trecho da trilha: 1 dentro, 2 fora, nenhuma apagada', async () => {
    await abrirAnalise();
    expect(screen.getByRole('heading', { name: 'Medidas guardadas (3)' })).toBeInTheDocument();
    expect(screen.getAllByTestId('captura-manual')).toHaveLength(1);
    expect(screen.getAllByTestId('captura-fora-do-trecho')).toHaveLength(2);
  });

  it('dois trechos diferentes em sequência: as medidas ficam, mudam de lado conforme o trecho e o aviso é neutro (sem "removida")', async () => {
    await abrirAnalise();

    await rastrearDe(3.5, 5);
    expect(mocks.rastrear).toHaveBeenCalledTimes(1);
    expect(mocks.rastrear.mock.calls[0][1].intervalo).toEqual({ inicio: 3.5, fim: 5 });
    expect(screen.getByRole('heading', { name: 'Medidas guardadas (3)' })).toBeInTheDocument();
    expect(screen.queryAllByTestId('captura-manual')).toHaveLength(0);
    expect(screen.getAllByTestId('captura-fora-do-trecho')).toHaveLength(3);
    expect(toast.info).toHaveBeenLastCalledWith(expect.stringMatching(/3 medidas guardadas estão fora do trecho atual/));
    expect(vi.mocked(toast.info).mock.calls.at(-1)?.[0]).not.toMatch(/removida/);
    expect(toast.warning).not.toHaveBeenCalled();

    await rastrearDe(0, 3);
    expect(mocks.rastrear).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('heading', { name: 'Medidas guardadas (3)' })).toBeInTheDocument();
    const dentro = screen.getAllByTestId('captura-manual');
    expect(dentro).toHaveLength(2);
    expect(dentro[0]).toHaveTextContent('0,10 s · quadro 4');
    expect(dentro[1]).toHaveTextContent('2,40 s · quadro 73');
    const fora = screen.getAllByTestId('captura-fora-do-trecho');
    expect(fora).toHaveLength(1);
    expect(fora[0]).toHaveTextContent('7,00 s');
    expect(fora[0]).toHaveTextContent('fora do trecho atual');
  });

  it('o arquivo salvo guarda todas as medidas, com os mesmos campos de antes (sem campo novo), e o resumo copiado só leva as de dentro', async () => {
    await abrirAnalise();
    fireEvent.click(screen.getByTestId('aba-exportar'));
    fireEvent.click(screen.getByTestId('salvar-analise'));
    expect(mocks.baixarBlob).toHaveBeenCalledTimes(1);
    const salvo = JSON.parse(await lerTexto(mocks.baixarBlob.mock.calls[0][0] as Blob)) as { extras: { capturas: Record<string, unknown>[] } };
    expect(salvo.extras.capturas.map((c) => c.uid)).toEqual(['a', 'b', 'c']);
    for (const c of salvo.extras.capturas) expect(Object.keys(c).sort()).toEqual(['medidaId', 'nome', 'pontos', 'quadro', 'texto', 'uid', 'unidade', 't', 'valor'].sort());

    const escrever = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: escrever } });
    fireEvent.click(screen.getByTestId('copiar-resumo'));
    await waitFor(() => expect(escrever).toHaveBeenCalledTimes(1));
    const resumo = (escrever.mock.calls[0] as unknown as [string])[0];
    expect(resumo).toMatch(/2,40 s/);
    expect(resumo).not.toMatch(/0,10 s/);
    expect(resumo).not.toMatch(/7,00 s/);
  });
});
