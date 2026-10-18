import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ExportarVideoDialog from '@/components/angular/video/ExportarVideoDialog';
import type { PropsExportarVideoDialog } from '@/components/angular/video/exportarVideoLigacao';
import { anguloJoelho } from '@/lib/angular/video/angulos';
import { caixaFixaNaPosicao, tamanhoCobertoDaCaixaFixa } from '@/lib/angular/video/caixaFixaRosto';
import { ajusteTotalDoRosto } from '@/lib/angular/video/exportarVideo';
import type { OrigemCaixa } from '@/lib/angular/video/rostoPorQuadro';
import { criarTrilha } from '@/lib/angular/video/trilha';
import { ESTILO_PADRAO } from '@/lib/angular/estilo';
import { TEXTO_ROSTO_CONFERIDO } from '@/lib/social/consentimento';
import type { CaixaRosto } from '@/lib/social/rosto';
import { toast } from 'sonner';

const mocks = vi.hoisted(() => ({
  suporte: vi.fn(),
  abrirFonte: vi.fn(),
  criarPrevia: vi.fn(),
  exportar: vi.fn(),
  baixarBlob: vi.fn(),
  png: vi.fn(),
  mostrar: vi.fn(),
  moverCaixa: vi.fn(),
  liberarPrevia: vi.fn(),
  origem: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/utils/pdfBranding', () => ({ carregarBrandingClinica: async () => ({}) }));
vi.mock('@/lib/social/exportar', async (original) => ({
  ...(await original<typeof import('@/lib/social/exportar')>()),
  baixarBlob: mocks.baixarBlob,
  canvasParaPng: mocks.png,
}));
vi.mock('@/lib/social/desenhar', async (original) => ({
  ...(await original<typeof import('@/lib/social/desenhar')>()),
  carregarMarcaDoApp: async () => null,
  carregarSeloDaClinica: async () => null,
  carregarImagem: async () => document.createElement('img'),
}));
vi.mock('@/lib/angular/video/exportarVideo', async (original) => ({
  ...(await original<typeof import('@/lib/angular/video/exportarVideo')>()),
  suporteDeGravacao: mocks.suporte,
  abrirFonteDeVideo: mocks.abrirFonte,
  criarPrevia: mocks.criarPrevia,
  exportarVideoAnalise: mocks.exportar,
}));

const WEBM = { mime: 'video/webm;codecs=vp8', extensao: 'webm' as const, aceitoNoInstagram: false };
const LARGURA = 640, ALTURA = 480;
const trilha = criarTrilha(30, LARGURA, ALTURA, Array.from({ length: 120 }, (_, i) => ({ i, t: i / 30, pontos: {} })));

function props(extra: Partial<PropsExportarVideoDialog> = {}): PropsExportarVideoDialog {
  return {
    aberto: true, aoFechar: vi.fn(), video: document.createElement('video'), trilha, definicoes: [anguloJoelho('D'), anguloJoelho('E')], estilo: ESTILO_PADRAO,
    intervalo: { inicio: 0, fim: 4 - 1 / 30 }, direcao: 1, titulo: 'Agachamento', linhasMetricas: ['• Flexão do joelho: 105°'], ...extra,
  };
}

const SEM_ROSTO = { porOrigem: { pose: 50, vizinho: 0, fixa: 50 }, semRosto: true };
const COM_ROSTO = { porOrigem: { pose: 100, vizinho: 0, fixa: 0 }, semRosto: false };

/** `origem` diz, por quadro, de onde vem a caixa do rosto: o quadro de abertura da prévia é o 60. */
const prepararPrevia = (origem: (i: number) => OrigemCaixa, resumo = SEM_ROSTO) => {
  mocks.origem.mockImplementation(origem);
  mocks.criarPrevia.mockImplementation(async () => ({
    canvas: document.createElement('canvas'), largura: 540, altura: 1704, resumoRosto: resumo, nQuadros: 120, mostrar: mocks.mostrar, liberar: mocks.liberarPrevia,
    areaVideo: { x: 0, y: 20, w: 540, h: 960 }, origemDoQuadro: mocks.origem, moverCaixaFixa: mocks.moverCaixa,
  }));
};

const aguardarPrevia = async () => {
  await waitFor(() => expect(mocks.criarPrevia).toHaveBeenCalled(), { timeout: 3000 });
  await waitFor(() => expect(mocks.mostrar).toHaveBeenCalled(), { timeout: 3000 });
};
const caixa = () => screen.getByTestId('caixa-rosto-arrastavel');
const botaoBaixar = () => screen.getByTestId('baixar-video-arquivo');
const conferir = () => screen.getByRole('checkbox', { name: TEXTO_ROSTO_CONFERIDO });
const ultimaCaixaPedida = () => mocks.moverCaixa.mock.calls[mocks.moverCaixa.mock.calls.length - 1][0] as CaixaRosto;
const caixaPadrao = caixaFixaNaPosicao(LARGURA, ALTURA, null);

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.suporte.mockReturnValue({ ok: true, escolha: WEBM });
  mocks.abrirFonte.mockImplementation(async () => ({ el: document.createElement('video'), liberar: vi.fn() }));
  mocks.exportar.mockImplementation(async () => new Blob(['video'], { type: 'video/webm;codecs=vp8' }));
  mocks.mostrar.mockResolvedValue(undefined);
  mocks.png.mockResolvedValue(new Blob(['png'], { type: 'image/png' }));
  prepararPrevia(() => 'fixa');
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: vi.fn(() => 'blob:video') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: vi.fn() });
  vi.mocked(toast.info).mockReset();
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('diálogo de exportação: caixa do rosto arrastável nos quadros sem rosto localizado', () => {
  it('a caixa aparece no quadro em que o rosto não foi localizado, com o aviso, a contagem e a conferência de sempre', async () => {
    render(<ExportarVideoDialog {...props()} />);
    await aguardarPrevia();
    await waitFor(() => expect(caixa()).toBeInTheDocument());
    expect(screen.getByTestId('dica-rosto-video')).toHaveTextContent(/Em 50% dos quadros não localizei o rosto/);
    expect(screen.getByTestId('dica-rosto-video')).toHaveTextContent(/caixa fixa que você pode mover/);
    expect(screen.getByTestId('situacao-caixa-rosto')).toHaveTextContent(/arraste-a até o rosto, ou use as setas do teclado/);
    expect(conferir()).toBeInTheDocument();
    expect(botaoBaixar()).toBeDisabled();
  });

  it('com o rosto localizado no quadro mostrado não há caixa para arrastar; o botão leva ao próximo quadro sem rosto', async () => {
    prepararPrevia((i) => (i >= 80 ? 'fixa' : 'pose'));
    render(<ExportarVideoDialog {...props()} />);
    await aguardarPrevia();
    await waitFor(() => expect(screen.getByTestId('situacao-caixa-rosto')).toHaveTextContent(/o rosto foi localizado/));
    expect(screen.queryByTestId('caixa-rosto-arrastavel')).toBeNull();
    fireEvent.click(screen.getByTestId('ir-quadro-sem-rosto'));
    await waitFor(() => expect(mocks.mostrar).toHaveBeenLastCalledWith(80));
    await waitFor(() => expect(caixa()).toBeInTheDocument());
    expect(screen.queryByTestId('ir-quadro-sem-rosto')).toBeNull();
  });

  it('quando o trecho escolhido não tem quadro sem rosto, o botão avisa em vez de ficar parado', async () => {
    // só há quadros sem rosto fora do trecho (o trecho vai até o quadro 100 e eles começam depois)
    prepararPrevia((i) => (i >= 118 ? 'fixa' : 'pose'));
    render(<ExportarVideoDialog {...props()} />);
    await aguardarPrevia();
    fireEvent.change(screen.getByLabelText('Fim do trecho'), { target: { value: '3' } });
    await waitFor(() => expect(screen.getByTestId('ir-quadro-sem-rosto')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('ir-quadro-sem-rosto'));
    expect(toast.info).toHaveBeenCalledWith('Nenhum quadro do trecho escolhido tem o rosto sem localizar.');
  });

  it('se o app localizou o rosto em todos os quadros não há caixa nem controles de posição', async () => {
    prepararPrevia(() => 'pose', COM_ROSTO);
    render(<ExportarVideoDialog {...props()} />);
    await aguardarPrevia();
    await waitFor(() => expect(screen.getByTestId('dica-rosto-video')).toBeInTheDocument());
    expect(screen.queryByTestId('caixa-rosto-arrastavel')).toBeNull();
    expect(screen.queryByTestId('controle-caixa-rosto')).toBeNull();
    expect(screen.queryByTestId('conferir-rosto-video')).toBeNull();
  });

  it('mostrar o rosto (com autorização) tira a caixa: não há o que cobrir', async () => {
    render(<ExportarVideoDialog {...props()} />);
    await aguardarPrevia();
    await waitFor(() => expect(caixa()).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar' }));
    await waitFor(() => expect(screen.queryByTestId('caixa-rosto-arrastavel')).toBeNull());
  });

  it('a prévia nasce com a caixa de partida (no alto), sem uma posição escolhida', async () => {
    render(<ExportarVideoDialog {...props()} />);
    await aguardarPrevia();
    expect(mocks.criarPrevia.mock.calls[0][0].caixaFixa).toEqual(caixaPadrao);
  });

  it('mover a caixa redesenha a prévia que já existe (sem refazê-la), na nova posição, e desfaz a conferência do rosto', async () => {
    render(<ExportarVideoDialog {...props()} />);
    await aguardarPrevia();
    await waitFor(() => expect(caixa()).toBeInTheDocument());
    fireEvent.click(conferir());
    await waitFor(() => expect(botaoBaixar()).toBeEnabled());
    const previasAntes = mocks.criarPrevia.mock.calls.length;

    fireEvent.keyDown(caixa(), { key: 'ArrowRight', shiftKey: true });
    await waitFor(() => expect(mocks.moverCaixa).toHaveBeenCalled());
    const c = ultimaCaixaPedida();
    expect(c.cx).toBeCloseTo(caixaPadrao.cx + 0.05, 9);
    expect(c.cy).toBeCloseTo(caixaPadrao.cy, 9);
    expect(c.w).toBe(caixaPadrao.w);
    expect(c.h).toBe(caixaPadrao.h);
    expect(conferir()).toHaveAttribute('aria-checked', 'false');
    expect(botaoBaixar()).toBeDisabled();
    expect(screen.getByTestId('baixar-quadro-previa')).toBeDisabled();
    await new Promise((r) => setTimeout(r, 400));
    expect(mocks.criarPrevia.mock.calls.length).toBe(previasAntes);
  });

  it('vários passos seguidos viram um redesenho só por quadro de tela, com a posição mais recente', async () => {
    render(<ExportarVideoDialog {...props()} />);
    await aguardarPrevia();
    await waitFor(() => expect(caixa()).toBeInTheDocument());
    for (let i = 0; i < 5; i++) fireEvent.keyDown(caixa(), { key: 'ArrowDown' });
    await waitFor(() => expect(mocks.moverCaixa).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 100));
    expect(mocks.moverCaixa).toHaveBeenCalledTimes(1);
    expect(ultimaCaixaPedida().cy).toBeCloseTo(caixaPadrao.cy + 5 * 0.01, 9);
  });

  it('o vídeo exportado recebe a caixa fixa escolhida, e só libera depois de conferir de novo', async () => {
    render(<ExportarVideoDialog {...props()} />);
    await aguardarPrevia();
    await waitFor(() => expect(caixa()).toBeInTheDocument());
    fireEvent.keyDown(caixa(), { key: 'ArrowLeft', shiftKey: true });
    fireEvent.keyDown(caixa(), { key: 'ArrowDown', shiftKey: true });
    expect(botaoBaixar()).toBeDisabled();
    fireEvent.click(conferir());
    await waitFor(() => expect(botaoBaixar()).toBeEnabled());
    fireEvent.click(botaoBaixar());
    await waitFor(() => expect(mocks.exportar).toHaveBeenCalled());
    const op = mocks.exportar.mock.calls[0][0];
    expect(op.caixaFixa.cx).toBeCloseTo(caixaPadrao.cx - 0.05, 9);
    expect(op.caixaFixa.cy).toBeCloseTo(caixaPadrao.cy + 0.05, 9);
    expect(op.modoRosto).toBe('desfoque');
  });

  it('sem mexer na caixa, o vídeo sai com a caixa de partida', async () => {
    render(<ExportarVideoDialog {...props()} />);
    await aguardarPrevia();
    await waitFor(() => expect(conferir()).toBeInTheDocument());
    fireEvent.click(conferir());
    await waitFor(() => expect(botaoBaixar()).toBeEnabled());
    fireEvent.click(botaoBaixar());
    await waitFor(() => expect(mocks.exportar).toHaveBeenCalled());
    expect(mocks.exportar.mock.calls[0][0].caixaFixa).toEqual(caixaPadrao);
  });

  it('o quadro PNG sai com a caixa onde ela foi deixada: o redesenho pendente é aplicado antes de gerar a imagem', async () => {
    render(<ExportarVideoDialog {...props()} />);
    await aguardarPrevia();
    await waitFor(() => expect(caixa()).toBeInTheDocument());
    // o quadro de tela nunca chega: só o redesenho forçado pelo botão pode ter pintado a caixa nova
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    fireEvent.keyDown(caixa(), { key: 'ArrowDown', shiftKey: true });
    expect(mocks.moverCaixa).not.toHaveBeenCalled();
    fireEvent.click(conferir());
    await waitFor(() => expect(screen.getByTestId('baixar-quadro-previa')).toBeEnabled());
    fireEvent.click(screen.getByTestId('baixar-quadro-previa'));
    await waitFor(() => expect(mocks.png).toHaveBeenCalled());
    expect(mocks.moverCaixa).toHaveBeenCalledTimes(1);
    expect(ultimaCaixaPedida().cy).toBeCloseTo(caixaPadrao.cy + 0.05, 9);
    expect(mocks.moverCaixa.mock.invocationCallOrder[0]).toBeLessThan(mocks.png.mock.invocationCallOrder[0]);
  });

  it('"Voltar a caixa ao alto" devolve a posição de partida e pede a conferência de novo', async () => {
    render(<ExportarVideoDialog {...props()} />);
    await aguardarPrevia();
    await waitFor(() => expect(caixa()).toBeInTheDocument());
    expect(screen.queryByTestId('recolocar-caixa-rosto')).toBeNull();
    fireEvent.keyDown(caixa(), { key: 'ArrowRight', shiftKey: true });
    await waitFor(() => expect(screen.getByTestId('recolocar-caixa-rosto')).toBeInTheDocument());
    await waitFor(() => expect(mocks.moverCaixa).toHaveBeenCalledTimes(1));
    fireEvent.click(conferir());
    fireEvent.click(screen.getByTestId('recolocar-caixa-rosto'));
    await waitFor(() => expect(mocks.moverCaixa).toHaveBeenCalledTimes(2));
    expect(ultimaCaixaPedida()).toEqual(caixaPadrao);
    expect(screen.queryByTestId('recolocar-caixa-rosto')).toBeNull();
    expect(conferir()).toHaveAttribute('aria-checked', 'false');
  });

  it('aumentar a largura da área refaz a prévia com a caixa ainda inteira dentro do quadro', async () => {
    render(<ExportarVideoDialog {...props()} />);
    await aguardarPrevia();
    await waitFor(() => expect(caixa()).toBeInTheDocument());
    // encosta a caixa na borda direita
    for (let i = 0; i < 12; i++) fireEvent.keyDown(caixa(), { key: 'ArrowRight', shiftKey: true });
    const antes = tamanhoCobertoDaCaixaFixa(caixaPadrao, ajusteTotalDoRosto({ ajusteRosto: { mulLargura: 1, mulAltura: 1 } }));
    await waitFor(() => expect(ultimaCaixaPedida().cx).toBeCloseTo(1 - antes.w / 2, 9));

    const chamadasAntes = mocks.criarPrevia.mock.calls.length;
    fireEvent.change(screen.getByLabelText('Largura da área'), { target: { value: '2.2' } });
    await waitFor(() => expect(mocks.criarPrevia.mock.calls.length).toBeGreaterThan(chamadasAntes), { timeout: 3000 });
    const depois = tamanhoCobertoDaCaixaFixa(caixaPadrao, ajusteTotalDoRosto({ ajusteRosto: { mulLargura: 2.2, mulAltura: 1 } }));
    const pedida = mocks.criarPrevia.mock.calls[mocks.criarPrevia.mock.calls.length - 1][0].caixaFixa as CaixaRosto;
    expect(depois.w).toBeGreaterThan(antes.w);
    expect(pedida.cx).toBeCloseTo(1 - depois.w / 2, 9);
    expect(pedida.cx + depois.w / 2).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('reabrir o diálogo começa de novo, com a caixa de partida', async () => {
    const { rerender } = render(<ExportarVideoDialog {...props()} />);
    await aguardarPrevia();
    await waitFor(() => expect(caixa()).toBeInTheDocument());
    fireEvent.keyDown(caixa(), { key: 'ArrowRight', shiftKey: true });
    await waitFor(() => expect(mocks.moverCaixa).toHaveBeenCalled());
    rerender(<ExportarVideoDialog {...props({ aberto: false })} />);
    await waitFor(() => expect(mocks.liberarPrevia).toHaveBeenCalled());
    mocks.criarPrevia.mockClear();
    rerender(<ExportarVideoDialog {...props({ aberto: true })} />);
    await waitFor(() => expect(mocks.criarPrevia).toHaveBeenCalled(), { timeout: 3000 });
    expect(mocks.criarPrevia.mock.calls[0][0].caixaFixa).toEqual(caixaPadrao);
  });

  it('enquanto grava a caixa some (a prévia é solta) e a gravação já leva a caixa escolhida', async () => {
    mocks.exportar.mockImplementation(() => new Promise<Blob>(() => undefined));
    render(<ExportarVideoDialog {...props()} />);
    await aguardarPrevia();
    await waitFor(() => expect(caixa()).toBeInTheDocument());
    fireEvent.keyDown(caixa(), { key: 'ArrowDown', shiftKey: true });
    fireEvent.click(conferir());
    await waitFor(() => expect(botaoBaixar()).toBeEnabled());
    fireEvent.click(botaoBaixar());
    await waitFor(() => expect(screen.getByTestId('gravando-video')).toBeInTheDocument());
    expect(screen.queryByTestId('caixa-rosto-arrastavel')).toBeNull();
    expect(mocks.exportar.mock.calls[0][0].caixaFixa.cy).toBeCloseTo(caixaPadrao.cy + 0.05, 9);
  });

  it('a conferência do rosto continua obrigatória mesmo depois de mexer na caixa', async () => {
    render(<ExportarVideoDialog {...props()} />);
    await aguardarPrevia();
    await waitFor(() => expect(caixa()).toBeInTheDocument());
    fireEvent.keyDown(caixa(), { key: 'ArrowRight' });
    expect(screen.getByText(TEXTO_ROSTO_CONFERIDO)).toBeInTheDocument();
    expect(botaoBaixar()).toBeDisabled();
    fireEvent.click(botaoBaixar());
    expect(mocks.exportar).not.toHaveBeenCalled();
  });
});
