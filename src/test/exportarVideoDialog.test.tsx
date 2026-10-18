import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ExportarVideoDialog from '@/components/angular/video/ExportarVideoDialog';
import { carregarExportarVideoDialog, exportarVideoDisponivel, type PropsExportarVideoDialog } from '@/components/angular/video/exportarVideoLigacao';
import { anguloJoelho } from '@/lib/angular/video/angulos';
import { ErroExportacao, MENSAGEM_SEM_GRAVACAO } from '@/lib/angular/video/exportarVideoPuro';
import { criarTrilha } from '@/lib/angular/video/trilha';
import { ESTILO_PADRAO } from '@/lib/angular/estilo';
import { TEXTO_CONSENTIMENTO, TEXTO_ROSTO_CONFERIDO } from '@/lib/social/consentimento';
import { toast } from 'sonner';

const mocks = vi.hoisted(() => ({
  suporte: vi.fn(),
  abrirFonte: vi.fn(),
  criarPrevia: vi.fn(),
  exportar: vi.fn(),
  baixarBlob: vi.fn(),
  compartilhar: vi.fn(),
  png: vi.fn(),
  liberarFonte: vi.fn(),
  liberarPrevia: vi.fn(),
  mostrar: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/utils/pdfBranding', () => ({ carregarBrandingClinica: async () => ({}) }));
vi.mock('@/lib/social/exportar', async (original) => ({
  ...(await original<typeof import('@/lib/social/exportar')>()),
  baixarBlob: mocks.baixarBlob,
  compartilharArquivo: mocks.compartilhar,
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
const MP4 = { mime: 'video/mp4;codecs=avc1.640028', extensao: 'mp4' as const, aceitoNoInstagram: true };

const trilhaDe = (segundos: number, fps = 30) => criarTrilha(fps, 640, 480, Array.from({ length: Math.round(segundos * fps) }, (_, i) => ({ i, t: i / fps, pontos: {} })));

function props(extra: Partial<PropsExportarVideoDialog> = {}): PropsExportarVideoDialog {
  const trilha = trilhaDe(4);
  return {
    aberto: true, aoFechar: vi.fn(), video: document.createElement('video'), trilha, definicoes: [anguloJoelho('D'), anguloJoelho('E')], estilo: ESTILO_PADRAO,
    intervalo: { inicio: 0, fim: 4 - 1 / 30 }, direcao: 1, titulo: 'Marcha (caminhada)', linhasMetricas: ['• Cadência: 109 passos/min'], ...extra,
  };
}

const prepararPrevia = (resumo = { porOrigem: { pose: 100, vizinho: 0, fixa: 0 }, semRosto: false }) => {
  mocks.criarPrevia.mockImplementation(async () => ({
    canvas: document.createElement('canvas'), largura: 1080, altura: 1920, resumoRosto: resumo, nQuadros: 120, mostrar: mocks.mostrar, liberar: mocks.liberarPrevia,
  }));
};

const aguardarPrevia = async () => { await waitFor(() => expect(mocks.criarPrevia).toHaveBeenCalled(), { timeout: 3000 }); await waitFor(() => expect(mocks.mostrar).toHaveBeenCalled(), { timeout: 3000 }); };
const botaoBaixar = () => screen.getByTestId('baixar-video-arquivo');

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.suporte.mockReturnValue({ ok: true, escolha: WEBM });
  mocks.abrirFonte.mockImplementation(async () => ({ el: document.createElement('video'), liberar: mocks.liberarFonte }));
  mocks.exportar.mockImplementation(async () => new Blob(['video'], { type: 'video/webm;codecs=vp8' }));
  mocks.mostrar.mockResolvedValue(undefined);
  mocks.png.mockResolvedValue(new Blob(['png'], { type: 'image/png' }));
  prepararPrevia();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: vi.fn(() => 'blob:video') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: vi.fn() });
  vi.mocked(toast.error).mockReset();
  vi.mocked(toast.info).mockReset();
  vi.mocked(toast.success).mockReset();
});

afterEach(cleanup);

describe('diálogo "Baixar vídeo analisado"', () => {
  it('o módulo é achado pela ligação e vira o componente do diálogo', async () => {
    expect(exportarVideoDisponivel()).toBe(true);
    const C = await carregarExportarVideoDialog();
    expect(C).toBe(ExportarVideoDialog);
  });

  it('sem gravador de vídeo mostra a mensagem clara, bloqueia o botão e nem abre a cópia do vídeo', () => {
    mocks.suporte.mockReturnValue({ ok: false, motivo: MENSAGEM_SEM_GRAVACAO });
    render(<ExportarVideoDialog {...props()} />);
    expect(screen.getByTestId('aviso-sem-gravacao')).toHaveTextContent(/iOS 14\.3/);
    expect(botaoBaixar()).toBeDisabled();
    expect(mocks.abrirFonte).not.toHaveBeenCalled();
    expect(mocks.criarPrevia).not.toHaveBeenCalled();
  });

  it('fechado não abre nada; ao abrir, monta a prévia com o rosto coberto por padrão', async () => {
    const { rerender } = render(<ExportarVideoDialog {...props({ aberto: false })} />);
    expect(mocks.abrirFonte).not.toHaveBeenCalled();
    rerender(<ExportarVideoDialog {...props({ aberto: true })} />);
    await aguardarPrevia();
    expect(mocks.criarPrevia.mock.calls[0][0].modoRosto).toBe('desfoque');
    expect(mocks.criarPrevia.mock.calls[0][0].formato).toBe('original');
    expect(screen.getByTestId('previa-video').querySelector('canvas')).not.toBeNull();
    expect(screen.getByTestId('dica-rosto-video')).toHaveTextContent(/Rosto localizado/);
  });

  it('formato original com o rosto coberto baixa sem pedir autorização; o arquivo tem nome seguro e vai para o download', async () => {
    render(<ExportarVideoDialog {...props()} />);
    await aguardarPrevia();
    expect(screen.queryByTestId('autorizacao-video')).toBeNull();
    await waitFor(() => expect(botaoBaixar()).toBeEnabled());
    fireEvent.click(botaoBaixar());
    await waitFor(() => expect(mocks.baixarBlob).toHaveBeenCalledTimes(1));
    const op = mocks.exportar.mock.calls[0][0];
    expect(op).toMatchObject({ formato: 'original', velocidade: 1, modoRosto: 'desfoque', mostrarGrafico: true, mostrarMetricas: true, intervalo: { inicio: 0 } });
    expect(op.moldura).toBeUndefined();
    expect(op.fonte).toBeDefined();
    const nome = mocks.baixarBlob.mock.calls[0][1] as string;
    expect(nome).toMatch(/^analise-marcha-caminhada-original-\d{4}-\d{2}-\d{2}\.webm$/);
    expect(nome).not.toMatch(/paciente|rosilda/i);
    await waitFor(() => expect(screen.getByTestId('resultado-video')).toBeInTheDocument());
    expect(toast.success).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('compartilhar-video')).toBeEnabled());
  });

  it('a prévia é solta antes de gravar (memória e decodificador) e refeita depois', async () => {
    render(<ExportarVideoDialog {...props()} />);
    await aguardarPrevia();
    await waitFor(() => expect(botaoBaixar()).toBeEnabled());
    const antes = mocks.criarPrevia.mock.calls.length;
    fireEvent.click(botaoBaixar());
    await waitFor(() => expect(mocks.exportar).toHaveBeenCalled());
    expect(mocks.liberarPrevia).toHaveBeenCalled();
    await waitFor(() => expect(mocks.baixarBlob).toHaveBeenCalled());
    await waitFor(() => expect(mocks.criarPrevia.mock.calls.length).toBeGreaterThan(antes), { timeout: 3000 });
  });

  it('formato do Instagram só libera depois da autorização do paciente, e a moldura segue com a autorização marcada', async () => {
    render(<ExportarVideoDialog {...props()} />);
    await aguardarPrevia();
    fireEvent.click(screen.getByRole('button', { name: /Story/ }));
    expect(screen.getByText(TEXTO_CONSENTIMENTO)).toBeInTheDocument();
    expect(botaoBaixar()).toBeDisabled();
    expect(screen.getByTestId('baixar-quadro-previa')).toBeDisabled();
    fireEvent.click(screen.getByTestId('autorizacao-video'));
    await waitFor(() => expect(botaoBaixar()).toBeEnabled());
    fireEvent.click(botaoBaixar());
    await waitFor(() => expect(mocks.exportar).toHaveBeenCalled());
    const op = mocks.exportar.mock.calls[0][0];
    expect(op.formato).toBe('story');
    expect(op.moldura).toMatchObject({ autorizado: true, titulo: 'Análise de marcha (caminhada)' });
  });

  it('avisa que WebM não serve para o Instagram, e some o aviso quando o aparelho grava MP4', async () => {
    const { unmount } = render(<ExportarVideoDialog {...props()} />);
    await aguardarPrevia();
    fireEvent.click(screen.getByRole('button', { name: /Feed/ }));
    expect(screen.getByTestId('aviso-tipo-arquivo')).toHaveTextContent(/WEBM.*MP4/);
    unmount();
    mocks.suporte.mockReturnValue({ ok: true, escolha: MP4 });
    render(<ExportarVideoDialog {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: /Feed/ }));
    expect(screen.queryByTestId('aviso-tipo-arquivo')).toBeNull();
  });

  it('mostrar o rosto exige a autorização, mesmo no formato original', async () => {
    render(<ExportarVideoDialog {...props()} />);
    await aguardarPrevia();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar' }));
    expect(screen.getByText(TEXTO_CONSENTIMENTO)).toBeInTheDocument();
    expect(botaoBaixar()).toBeDisabled();
    fireEvent.click(screen.getByTestId('autorizacao-video'));
    await waitFor(() => expect(botaoBaixar()).toBeEnabled());
    fireEvent.click(botaoBaixar());
    await waitFor(() => expect(mocks.exportar).toHaveBeenCalled());
    expect(mocks.exportar.mock.calls[0][0]).toMatchObject({ modoRosto: 'nenhum', autorizado: true });
  });

  it('rosto não localizado em algum quadro pede a conferência antes de baixar', async () => {
    prepararPrevia({ porOrigem: { pose: 60, vizinho: 0, fixa: 40 }, semRosto: true });
    render(<ExportarVideoDialog {...props()} />);
    await aguardarPrevia();
    await waitFor(() => expect(screen.getByTestId('conferir-rosto-video')).toBeInTheDocument());
    expect(screen.getByTestId('dica-rosto-video')).toHaveTextContent(/40% dos quadros/);
    expect(screen.getByText(TEXTO_ROSTO_CONFERIDO)).toBeInTheDocument();
    expect(botaoBaixar()).toBeDisabled();
    fireEvent.click(screen.getByText(TEXTO_ROSTO_CONFERIDO));
    await waitFor(() => expect(botaoBaixar()).toBeEnabled());
  });

  it('câmera lenta encurta o trecho para o arquivo caber no limite e mostra a duração final', async () => {
    const trilha = trilhaDe(30);
    render(<ExportarVideoDialog {...props({ trilha, intervalo: { inicio: 0, fim: 30 - 1 / 30 } })} />);
    await aguardarPrevia();
    expect(screen.getByTestId('resumo-duracao')).toHaveTextContent('30,0 s');
    fireEvent.click(screen.getByRole('button', { name: /^0,1×/ }));
    expect(screen.getByTestId('resumo-duracao')).toHaveTextContent('90,0 s');
    expect(screen.getByText(/Nesta velocidade cabem 9 s/)).toBeInTheDocument();
    await waitFor(() => expect(botaoBaixar()).toBeEnabled());
  });

  it('o trecho nunca fica com menos de meio segundo', async () => {
    render(<ExportarVideoDialog {...props()} />);
    await aguardarPrevia();
    const fim = screen.getByLabelText('Fim do trecho');
    fireEvent.change(fim, { target: { value: '0.1' } });
    expect(screen.getByTestId('resumo-duracao')).toHaveTextContent('0,5 s');
  });

  it('cancelar interrompe a gravação e avisa, sem baixar nada', async () => {
    mocks.exportar.mockImplementation((op: { sinal: AbortSignal }) => new Promise((_, falha) => {
      op.sinal.addEventListener('abort', () => { const e = new Error('Gravação cancelada.'); e.name = 'AbortError'; falha(e); });
    }));
    render(<ExportarVideoDialog {...props()} />);
    await aguardarPrevia();
    await waitFor(() => expect(botaoBaixar()).toBeEnabled());
    fireEvent.click(botaoBaixar());
    await waitFor(() => expect(screen.getByTestId('gravando-video')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('cancelar-gravacao'));
    await waitFor(() => expect(toast.info).toHaveBeenCalledWith('Gravação cancelada.'));
    expect(mocks.baixarBlob).not.toHaveBeenCalled();
    await waitFor(() => expect(botaoBaixar()).toBeInTheDocument());
  });

  it('mostra o progresso durante a gravação', async () => {
    let seguir: (b: Blob) => void = () => undefined;
    mocks.exportar.mockImplementation((op: { onProgresso: (p: number) => void }) => new Promise<Blob>((ok) => { op.onProgresso(0.42); seguir = ok; }));
    render(<ExportarVideoDialog {...props()} />);
    await aguardarPrevia();
    await waitFor(() => expect(botaoBaixar()).toBeEnabled());
    fireEvent.click(botaoBaixar());
    await waitFor(() => expect(screen.getByText(/Gravando… 42%/)).toBeInTheDocument());
    seguir(new Blob(['v'], { type: 'video/webm' }));
    await waitFor(() => expect(mocks.baixarBlob).toHaveBeenCalled());
  });

  it('enquanto grava, o resto da página fica escondido (para o navegador desenhar só o diálogo) e tudo volta no fim', async () => {
    const outro = document.createElement('div');
    outro.id = 'resto-do-app';
    outro.style.visibility = 'visible';
    document.body.appendChild(outro);
    let seguir: (b: Blob) => void = () => undefined;
    mocks.exportar.mockImplementation(() => new Promise<Blob>((ok) => { seguir = ok; }));
    render(<ExportarVideoDialog {...props()} />);
    await aguardarPrevia();
    await waitFor(() => expect(botaoBaixar()).toBeEnabled());
    expect(outro.style.visibility).toBe('visible');
    fireEvent.click(botaoBaixar());
    await waitFor(() => expect(outro.style.visibility).toBe('hidden'));
    expect(screen.getByTestId('dialogo-exportar-video')).toBeVisible();
    seguir(new Blob(['v'], { type: 'video/webm' }));
    await waitFor(() => expect(outro.style.visibility).toBe('visible'));
    outro.remove();
  });

  it('erro da exportação vira aviso em português e o botão volta', async () => {
    mocks.exportar.mockRejectedValue(new ErroExportacao('gravacao', 'O navegador interrompeu a gravação do vídeo.'));
    render(<ExportarVideoDialog {...props()} />);
    await aguardarPrevia();
    await waitFor(() => expect(botaoBaixar()).toBeEnabled());
    fireEvent.click(botaoBaixar());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('O navegador interrompeu a gravação do vídeo.'));
    await waitFor(() => expect(botaoBaixar()).toBeEnabled());
    mocks.exportar.mockRejectedValue(new Error('qualquer coisa interna'));
    fireEvent.click(botaoBaixar());
    await waitFor(() => expect(toast.error).toHaveBeenLastCalledWith('Não consegui gerar o vídeo. Tente de novo com um trecho menor.'));
  });

  it('baixar o quadro da prévia gera um PNG (com autorização quando a moldura é do Instagram)', async () => {
    render(<ExportarVideoDialog {...props()} />);
    await aguardarPrevia();
    await waitFor(() => expect(screen.getByTestId('baixar-quadro-previa')).toBeEnabled());
    fireEvent.click(screen.getByTestId('baixar-quadro-previa'));
    await waitFor(() => expect(mocks.baixarBlob).toHaveBeenCalledTimes(1));
    expect(mocks.baixarBlob.mock.calls[0][1]).toMatch(/^quadro-original-\d{4}-\d{2}-\d{2}\.png$/);
  });

  it('ao fechar solta a prévia e a cópia do vídeo; ao reabrir a autorização volta desmarcada', async () => {
    const { rerender } = render(<ExportarVideoDialog {...props()} />);
    await aguardarPrevia();
    fireEvent.click(screen.getByRole('button', { name: /Quadrado/ }));
    fireEvent.click(screen.getByTestId('autorizacao-video'));
    await waitFor(() => expect(botaoBaixar()).toBeEnabled());
    rerender(<ExportarVideoDialog {...props({ aberto: false })} />);
    await waitFor(() => expect(mocks.liberarFonte).toHaveBeenCalled());
    expect(mocks.liberarPrevia).toHaveBeenCalled();
    rerender(<ExportarVideoDialog {...props({ aberto: true })} />);
    await aguardarPrevia();
    fireEvent.click(screen.getByRole('button', { name: /Story/ }));
    expect(screen.getByTestId('autorizacao-video')).toHaveAttribute('aria-checked', 'false');
    expect(botaoBaixar()).toBeDisabled();
  });

  it('sem métricas nem ângulos os interruptores ficam desligados e o vídeo sai sem gráfico e sem cartões', async () => {
    render(<ExportarVideoDialog {...props({ definicoes: [], linhasMetricas: [] })} />);
    await aguardarPrevia();
    await waitFor(() => expect(botaoBaixar()).toBeEnabled());
    fireEvent.click(botaoBaixar());
    await waitFor(() => expect(mocks.exportar).toHaveBeenCalled());
    expect(mocks.exportar.mock.calls[0][0]).toMatchObject({ mostrarGrafico: false, mostrarMetricas: false });
  });

  it('passa à exportação os cartões, as curvas, os eventos e as faixas confirmadas que a tela tem', async () => {
    const cartoes = [{ chave: 'c', titulo: 'Cadência', valores: [{ lado: null, texto: '109 passos/min', status: 'dentro' as const }], referencias: [], contexto: [], avisos: [] }];
    const series = [{ id: 'joelho_d', rotulo: 'D', cor: '#2A78D6', pontos: [{ t: 0, v: 3 }, { t: 0.1, v: 5 }] }];
    const marcadores = [{ id: 'e1', t: 0.5, tipo: 'contato' as const, lado: 'D' as const }];
    const bandas = [{ id: 'b', min: 60, max: 70, rotulo: 'Referência do pico: 60 a 70°' }];
    render(<ExportarVideoDialog {...props({ cartoes, series, marcadores, bandas })} />);
    await aguardarPrevia();
    await waitFor(() => expect(botaoBaixar()).toBeEnabled());
    fireEvent.click(botaoBaixar());
    await waitFor(() => expect(mocks.exportar).toHaveBeenCalled());
    expect(mocks.exportar.mock.calls[0][0]).toMatchObject({ cartoes, series, marcadores, bandas, direcao: 1, titulo: 'Marcha (caminhada)' });
  });
  it('o quadro em PNG também espera a conferência do rosto quando o app não o localizou em todos os quadros', async () => {
    prepararPrevia({ porOrigem: { pose: 60, vizinho: 0, fixa: 40 }, semRosto: true });
    render(<ExportarVideoDialog {...props()} />);
    await aguardarPrevia();
    await waitFor(() => expect(screen.getByTestId('conferir-rosto-video')).toBeInTheDocument());
    expect(screen.getByTestId('baixar-quadro-previa')).toBeDisabled();
    fireEvent.click(screen.getByTestId('baixar-quadro-previa'));
    expect(mocks.png).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText(TEXTO_ROSTO_CONFERIDO));
    await waitFor(() => expect(screen.getByTestId('baixar-quadro-previa')).toBeEnabled());
    fireEvent.click(screen.getByTestId('baixar-quadro-previa'));
    await waitFor(() => expect(mocks.baixarBlob).toHaveBeenCalledTimes(1));
  });

  it('o texto do rosto só diz "em todos os quadros" quando é verdade: quadros por vizinhança são ditos como tal', async () => {
    prepararPrevia({ porOrigem: { pose: 90, vizinho: 10, fixa: 0 }, semRosto: false });
    render(<ExportarVideoDialog {...props()} />);
    await aguardarPrevia();
    await waitFor(() => expect(screen.getByTestId('dica-rosto-video')).toHaveTextContent(/em 10% dos quadros a posição vem dos quadros vizinhos/));
    expect(screen.getByTestId('dica-rosto-video')).not.toHaveTextContent(/em todos os quadros/);
  });

  it('fora do app nativo não cria endereço de arquivo para o vídeo gravado (a URL ficaria retida sem uso)', async () => {
    render(<ExportarVideoDialog {...props()} />);
    await aguardarPrevia();
    await waitFor(() => expect(botaoBaixar()).toBeEnabled());
    fireEvent.click(botaoBaixar());
    await waitFor(() => expect(screen.getByTestId('resultado-video')).toBeInTheDocument());
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('fechar o diálogo durante a gravação devolve a página na hora, sem esperar a gravação terminar de cancelar', async () => {
    const outro = document.createElement('div');
    outro.style.visibility = 'visible';
    document.body.appendChild(outro);
    mocks.exportar.mockImplementation(() => new Promise<Blob>(() => undefined));
    const { rerender } = render(<ExportarVideoDialog {...props()} />);
    await aguardarPrevia();
    await waitFor(() => expect(botaoBaixar()).toBeEnabled());
    fireEvent.click(botaoBaixar());
    await waitFor(() => expect(outro.style.visibility).toBe('hidden'));
    rerender(<ExportarVideoDialog {...props({ aberto: false })} />);
    await waitFor(() => expect(outro.style.visibility).toBe('visible'));
    outro.remove();
  });
});
