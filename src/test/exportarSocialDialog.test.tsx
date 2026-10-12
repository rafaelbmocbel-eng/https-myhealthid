import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ExportarSocialDialog from '@/components/angular/ExportarSocialDialog';
import type { AnaliseParaExportar } from '@/lib/angular/analise';
import type { Landmark } from '@/lib/angular/pose';
import { toast } from 'sonner';
import { AVISO_CONSELHO, TEXTO_CONSENTIMENTO, TEXTO_ROSTO_CONFERIDO } from '@/lib/social/consentimento';

const mocks = vi.hoisted(() => ({
  baixarBlob: vi.fn(),
  compartilharArquivo: vi.fn(),
  renderizar: vi.fn(),
  carregarSelo: vi.fn(),
  branding: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/utils/pdfBranding', () => ({ carregarBrandingClinica: (...a: unknown[]) => mocks.branding(...a) }));
vi.mock('@/lib/social/exportar', async (original) => ({
  ...(await original<typeof import('@/lib/social/exportar')>()),
  baixarBlob: mocks.baixarBlob,
  compartilharArquivo: mocks.compartilharArquivo,
  canvasParaPng: async () => new Blob(['png'], { type: 'image/png' }),
  canvasParaPngSincrono: () => new Blob(['png'], { type: 'image/png' }),
}));
vi.mock('@/lib/social/desenhar', async (original) => ({
  ...(await original<typeof import('@/lib/social/desenhar')>()),
  carregarMarcaDoApp: async () => null,
  carregarSeloDaClinica: (...a: unknown[]) => mocks.carregarSelo(...a),
  renderizarArteSocial: mocks.renderizar,
}));

const foto = () => {
  const c = document.createElement('canvas');
  c.width = 1200;
  c.height = 1600;
  return c;
};

const arte = (n = 2): AnaliseParaExportar => ({
  titulo: 'Pós operatório de SLAP',
  legenda: '3ª semana de PO',
  paineis: [
    { rotulo: 'Pré-Sessão', data: '11/10/2026', imagem: foto(), largura: 1200, altura: 1600 },
    { rotulo: 'Pós-Sessão', data: '25/10/2026', imagem: foto(), largura: 1200, altura: 1600 },
  ].slice(0, n),
  medidas: [{ nome: 'Elevação do ombro', valor: '118°' }],
});

const pose = (): Landmark[] => {
  const lm: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
  lm[0] = { x: 0.62, y: 0.18, visibility: 0.95 };
  lm[2] = { x: 0.58, y: 0.15, visibility: 0.95 };
  lm[3] = { x: 0.575, y: 0.15, visibility: 0.95 };
  lm[7] = { x: 0.52, y: 0.17, visibility: 0.95 };
  lm[9] = { x: 0.59, y: 0.2, visibility: 0.95 };
  return lm;
};

// Por padrão o rosto é achado pelos pontos de pose; os testes sem pose passam `landmarks: undefined`.
const abrir = (props: Partial<React.ComponentProps<typeof ExportarSocialDialog>> = {}) => {
  const dados = props.arte ?? arte();
  return render(<ExportarSocialDialog aberto aoFechar={() => undefined} arte={dados} landmarks={[pose(), pose()]} {...props} />);
};

const botaoBaixar = () => screen.getByTestId('baixar-png');
const botaoCompartilhar = () => screen.getByTestId('compartilhar');
const caixaAutorizacao = () => screen.getByRole('checkbox', { name: TEXTO_CONSENTIMENTO });
const prontoParaBaixar = async () => { await screen.findByTestId('previa-arte-social'); };

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  mocks.renderizar.mockReturnValue({ canvas: document.createElement('canvas'), layout: {} });
  mocks.compartilharArquivo.mockResolvedValue('compartilhado');
  mocks.carregarSelo.mockResolvedValue(null);
  mocks.branding.mockResolvedValue({});
});

afterEach(() => {
  vi.restoreAllMocks();
  mocks.baixarBlob.mockClear();
  mocks.compartilharArquivo.mockReset();
  mocks.renderizar.mockReset();
  mocks.carregarSelo.mockReset();
  mocks.branding.mockReset();
  vi.mocked(toast.info).mockClear();
  localStorage.clear();
});

describe('ExportarSocialDialog: portão de consentimento', () => {
  it('abre com a autorização desmarcada e os botões de baixar e compartilhar desabilitados', async () => {
    abrir();
    await prontoParaBaixar();
    expect(caixaAutorizacao()).not.toBeChecked();
    expect(botaoBaixar()).toBeDisabled();
    expect(botaoCompartilhar()).toBeDisabled();
    expect(screen.getByText(TEXTO_CONSENTIMENTO)).toBeInTheDocument();
    expect(screen.getByText(AVISO_CONSELHO)).toBeInTheDocument();
  });

  it('marcar a autorização libera os dois botões e desmarcar trava de novo', async () => {
    abrir();
    await prontoParaBaixar();
    fireEvent.click(caixaAutorizacao());
    expect(botaoBaixar()).toBeEnabled();
    expect(botaoCompartilhar()).toBeEnabled();
    fireEvent.click(caixaAutorizacao());
    expect(botaoBaixar()).toBeDisabled();
    expect(botaoCompartilhar()).toBeDisabled();
  });

  it('sem a autorização, clicar em baixar ou compartilhar não gera nem envia nada', async () => {
    abrir();
    await prontoParaBaixar();
    fireEvent.click(botaoBaixar());
    fireEvent.click(botaoCompartilhar());
    expect(mocks.renderizar).not.toHaveBeenCalled();
    expect(mocks.baixarBlob).not.toHaveBeenCalled();
    expect(mocks.compartilharArquivo).not.toHaveBeenCalled();
  });

  it('a autorização não vale para a próxima arte: ao fechar e reabrir volta desmarcada', async () => {
    const dados = arte();
    const poses = [pose(), pose()];
    const { rerender } = render(<ExportarSocialDialog aberto aoFechar={() => undefined} arte={dados} landmarks={poses} />);
    await prontoParaBaixar();
    fireEvent.click(caixaAutorizacao());
    expect(botaoBaixar()).toBeEnabled();
    rerender(<ExportarSocialDialog aberto={false} aoFechar={() => undefined} arte={dados} landmarks={poses} />);
    rerender(<ExportarSocialDialog aberto aoFechar={() => undefined} arte={dados} landmarks={poses} />);
    await prontoParaBaixar();
    expect(caixaAutorizacao()).not.toBeChecked();
    expect(botaoBaixar()).toBeDisabled();
  });

  it('uma arte nova também zera a autorização', async () => {
    const { rerender } = render(<ExportarSocialDialog aberto aoFechar={() => undefined} arte={arte()} />);
    await prontoParaBaixar();
    fireEvent.click(caixaAutorizacao());
    rerender(<ExportarSocialDialog aberto aoFechar={() => undefined} arte={arte()} />);
    await waitFor(() => expect(caixaAutorizacao()).not.toBeChecked());
  });
});

describe('ExportarSocialDialog: baixar e compartilhar', () => {
  it('baixa o PNG com nome sem dados do paciente', async () => {
    abrir();
    await prontoParaBaixar();
    fireEvent.click(caixaAutorizacao());
    fireEvent.click(botaoBaixar());
    await waitFor(() => expect(mocks.baixarBlob).toHaveBeenCalledTimes(1));
    const [blob, nome] = mocks.baixarBlob.mock.calls[0];
    expect(blob).toBeInstanceOf(Blob);
    expect(nome).toMatch(/^antes-depois-story-\d{4}-\d{2}-\d{2}\.png$/);
    expect(mocks.renderizar).toHaveBeenCalledTimes(1);
    const [opcoes, , , escala] = mocks.renderizar.mock.calls[0];
    expect(escala).toBe(1);
    expect(opcoes.formato).toBe('story');
    expect(opcoes.layout).toBe('empilhada');
  });

  it('compartilha só o arquivo e não baixa quando o aparelho abre a folha de compartilhamento', async () => {
    abrir();
    await prontoParaBaixar();
    fireEvent.click(caixaAutorizacao());
    fireEvent.click(botaoCompartilhar());
    await waitFor(() => expect(mocks.compartilharArquivo).toHaveBeenCalledTimes(1));
    const arquivo = mocks.compartilharArquivo.mock.calls[0][0] as File;
    expect(arquivo).toBeInstanceOf(File);
    expect(arquivo.type).toBe('image/png');
    expect(arquivo.name).toMatch(/^antes-depois-story-/);
    expect(mocks.baixarBlob).not.toHaveBeenCalled();
  });

  it('cai no download quando o aparelho não compartilha arquivos', async () => {
    mocks.compartilharArquivo.mockResolvedValue('indisponivel');
    abrir();
    await prontoParaBaixar();
    fireEvent.click(caixaAutorizacao());
    fireEvent.click(botaoCompartilhar());
    await waitFor(() => expect(mocks.baixarBlob).toHaveBeenCalledTimes(1));
  });

  it('cancelar a folha de compartilhamento não baixa nada', async () => {
    mocks.compartilharArquivo.mockResolvedValue('cancelado');
    abrir();
    await prontoParaBaixar();
    fireEvent.click(caixaAutorizacao());
    fireEvent.click(botaoCompartilhar());
    await waitFor(() => expect(mocks.compartilharArquivo).toHaveBeenCalled());
    expect(mocks.baixarBlob).not.toHaveBeenCalled();
  });

  it('uma foto só usa o layout "uma foto" e o nome de análise', async () => {
    abrir({ arte: arte(1) });
    await prontoParaBaixar();
    expect(screen.queryByText('Disposição das fotos')).not.toBeInTheDocument();
    fireEvent.click(caixaAutorizacao());
    fireEvent.click(botaoBaixar());
    await waitFor(() => expect(mocks.baixarBlob).toHaveBeenCalled());
    expect(mocks.baixarBlob.mock.calls[0][1]).toMatch(/^analise-postural-story-/);
    expect(mocks.renderizar.mock.calls[0][0].layout).toBe('unica');
  });
});

describe('ExportarSocialDialog: conteúdo e privacidade', () => {
  it('traz título, legenda e rótulos da arte e avisa para não usar o nome do paciente', async () => {
    abrir();
    await prontoParaBaixar();
    expect(screen.getByLabelText('Título da arte')).toHaveValue('Pós operatório de SLAP');
    expect(screen.getByLabelText('Legenda da pílula')).toHaveValue('3ª semana de PO');
    expect(screen.getByLabelText('Rótulo da foto 1')).toHaveValue('Pré-Sessão');
    expect(screen.getByLabelText('Data da foto 2')).toHaveValue('25/10/2026');
    expect(screen.getByText(/Não use o nome do paciente/)).toBeInTheDocument();
  });

  it('esconde o rosto por padrão (desfoque) e avisa para posicionar à mão quando não há pontos de pose', async () => {
    abrir({ landmarks: undefined });
    await prontoParaBaixar();
    expect(screen.getByRole('button', { name: 'Desfocar' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('aviso-rosto-previa')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Posicionar o rosto/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('com pontos de pose nas duas fotos o rosto é localizado sozinho', async () => {
    abrir();
    await prontoParaBaixar();
    expect(screen.queryByTestId('aviso-rosto-previa')).not.toBeInTheDocument();
    expect(screen.getByText(/Rosto localizado pelos pontos do corpo/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enquadrar a foto/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('escolher "Mostrar" tira a área do rosto e a ferramenta de posicionar', async () => {
    abrir({ landmarks: undefined });
    await prontoParaBaixar();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar' }));
    expect(screen.queryByRole('button', { name: /Posicionar o rosto/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Largura da área')).not.toBeInTheDocument();
    expect(screen.queryByTestId('aviso-rosto-previa')).not.toBeInTheDocument();
  });

  it('lembra os perfis (sem o @ e em minúsculas) para a próxima arte', async () => {
    abrir();
    await prontoParaBaixar();
    const campo = screen.getByLabelText('Perfil 1');
    fireEvent.change(campo, { target: { value: '@RafaelMocbel' } });
    fireEvent.blur(campo);
    expect(campo).toHaveValue('rafaelmocbel');
    expect(JSON.parse(localStorage.getItem('myid:social:preferencias')!).perfis).toEqual(['rafaelmocbel']);
  });

  it('começa com os perfis lembrados', async () => {
    localStorage.setItem('myid:social:preferencias', JSON.stringify({ perfis: ['rafaelmocbel', 'myhealthid.app'], seloModo: 'marca', margensStories: true, modoRosto: 'tarja' }));
    abrir();
    await prontoParaBaixar();
    expect(screen.getByLabelText('Perfil 1')).toHaveValue('rafaelmocbel');
    expect(screen.getByLabelText('Perfil 2')).toHaveValue('myhealthid.app');
    expect(screen.getByLabelText('Perfil 3')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Tarja' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('trocar o formato e a disposição vale para a arte gerada', async () => {
    abrir();
    await prontoParaBaixar();
    fireEvent.click(screen.getByRole('button', { name: /Feed retrato/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Lado a lado' }));
    fireEvent.click(caixaAutorizacao());
    fireEvent.click(botaoBaixar());
    await waitFor(() => expect(mocks.baixarBlob).toHaveBeenCalled());
    const opcoes = mocks.renderizar.mock.calls[0][0];
    expect(opcoes.formato).toBe('feed');
    expect(opcoes.layout).toBe('lado_a_lado');
    expect(opcoes.tituloModo).toBe('horizontal');
    expect(mocks.baixarBlob.mock.calls[0][1]).toMatch(/^antes-depois-feed-/);
  });

  it('o rosto escolhido (desfoque) vai nas opções da arte final', async () => {
    abrir();
    await prontoParaBaixar();
    fireEvent.click(caixaAutorizacao());
    fireEvent.click(botaoBaixar());
    await waitFor(() => expect(mocks.baixarBlob).toHaveBeenCalled());
    const opcoes = mocks.renderizar.mock.calls[0][0];
    expect(opcoes.modoRosto).toBe('desfoque');
    expect(opcoes.rostos).toHaveLength(2);
    expect(opcoes.rostos.every((r: unknown) => r !== null)).toBe(true);
  });
});

describe('ExportarSocialDialog: proteção do rosto', () => {
  const confirmarRosto = () => screen.getByRole('checkbox', { name: TEXTO_ROSTO_CONFERIDO });

  it('"Mostrar" vale só para esta arte: não é lembrado e a próxima arte volta a esconder o rosto', async () => {
    const { rerender } = render(<ExportarSocialDialog aberto aoFechar={() => undefined} arte={arte()} landmarks={[pose(), pose()]} />);
    await prontoParaBaixar();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar' }));
    expect(screen.getByRole('button', { name: 'Mostrar' })).toHaveAttribute('aria-pressed', 'true');
    expect(JSON.parse(localStorage.getItem('myid:social:preferencias') ?? '{}').modoRosto).not.toBe('nenhum');
    rerender(<ExportarSocialDialog aberto={false} aoFechar={() => undefined} arte={null} />);
    rerender(<ExportarSocialDialog aberto aoFechar={() => undefined} arte={arte()} landmarks={[pose(), pose()]} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Desfocar' })).toHaveAttribute('aria-pressed', 'true'));
    expect(screen.getByRole('button', { name: 'Mostrar' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('a arte seguinte volta ao último modo que esconde (tarja), não a "Mostrar"', async () => {
    const { rerender } = render(<ExportarSocialDialog aberto aoFechar={() => undefined} arte={arte()} landmarks={[pose(), pose()]} />);
    await prontoParaBaixar();
    fireEvent.click(screen.getByRole('button', { name: 'Tarja' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar' }));
    rerender(<ExportarSocialDialog aberto aoFechar={() => undefined} arte={arte()} landmarks={[pose(), pose()]} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tarja' })).toHaveAttribute('aria-pressed', 'true'));
    expect(JSON.parse(localStorage.getItem('myid:social:preferencias')!).modoRosto).toBe('tarja');
  });

  it('uma preferência antiga gravada como "nenhum" é lida como desfoque', async () => {
    localStorage.setItem('myid:social:preferencias', JSON.stringify({ perfis: [], seloModo: 'marca', margensStories: true, modoRosto: 'nenhum' }));
    abrir();
    await prontoParaBaixar();
    expect(screen.getByRole('button', { name: 'Desfocar' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('sem rosto localizado, baixar e compartilhar esperam a confirmação de que a área cobre o rosto', async () => {
    abrir({ landmarks: undefined });
    await prontoParaBaixar();
    fireEvent.click(caixaAutorizacao());
    expect(botaoBaixar()).toBeDisabled();
    expect(botaoCompartilhar()).toBeDisabled();
    fireEvent.click(botaoBaixar());
    expect(mocks.renderizar).not.toHaveBeenCalled();
    fireEvent.click(confirmarRosto());
    expect(botaoBaixar()).toBeEnabled();
    expect(botaoCompartilhar()).toBeEnabled();
    fireEvent.click(confirmarRosto());
    expect(botaoBaixar()).toBeDisabled();
  });

  it('mexer na área do rosto depois de confirmar pede a confirmação de novo', async () => {
    abrir({ landmarks: undefined });
    await prontoParaBaixar();
    fireEvent.click(caixaAutorizacao());
    fireEvent.click(confirmarRosto());
    expect(botaoBaixar()).toBeEnabled();
    fireEvent.change(screen.getByLabelText('Largura da área'), { target: { value: '1.5' } });
    expect(confirmarRosto()).not.toBeChecked();
    expect(botaoBaixar()).toBeDisabled();
  });

  it('com o rosto localizado pelos pontos de pose não há confirmação extra', async () => {
    abrir();
    await prontoParaBaixar();
    expect(screen.queryByTestId('conferir-rosto')).not.toBeInTheDocument();
    fireEvent.click(caixaAutorizacao());
    expect(botaoBaixar()).toBeEnabled();
  });

  it('em "Mostrar" (escolha explícita) a confirmação da área não é pedida', async () => {
    abrir({ landmarks: undefined });
    await prontoParaBaixar();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar' }));
    expect(screen.queryByTestId('conferir-rosto')).not.toBeInTheDocument();
    fireEvent.click(caixaAutorizacao());
    expect(botaoBaixar()).toBeEnabled();
  });

  it('a confirmação do rosto também volta desmarcada na arte seguinte', async () => {
    const { rerender } = render(<ExportarSocialDialog aberto aoFechar={() => undefined} arte={arte()} />);
    await prontoParaBaixar();
    fireEvent.click(confirmarRosto());
    rerender(<ExportarSocialDialog aberto aoFechar={() => undefined} arte={arte()} />);
    await waitFor(() => expect(confirmarRosto()).not.toBeChecked());
  });
});

describe('ExportarSocialDialog: compartilhar, perfis e selo', () => {
  it('quando o navegador recusa por falta de gesto não baixa nem diz que o aparelho não compartilha', async () => {
    mocks.compartilharArquivo.mockResolvedValue('bloqueado');
    abrir();
    await prontoParaBaixar();
    fireEvent.click(caixaAutorizacao());
    fireEvent.click(botaoCompartilhar());
    await waitFor(() => expect(vi.mocked(toast.info)).toHaveBeenCalledWith(expect.stringMatching(/Toque em Compartilhar de novo/)));
    expect(mocks.baixarBlob).not.toHaveBeenCalled();
  });

  it('o share sai na mesma tarefa do toque: o arquivo é montado sem esperar nada antes', async () => {
    abrir();
    await prontoParaBaixar();
    fireEvent.click(caixaAutorizacao());
    fireEvent.click(botaoCompartilhar());
    // sem waitFor: se houvesse um await antes do share, a chamada ainda não teria acontecido
    expect(mocks.compartilharArquivo).toHaveBeenCalledTimes(1);
  });

  it('o campo de perfil aceita colar o endereço inteiro do Instagram (a limpeza é feita depois)', async () => {
    abrir();
    await prontoParaBaixar();
    const campo = screen.getByLabelText('Perfil 1');
    expect(Number(campo.getAttribute('maxlength'))).toBeGreaterThanOrEqual(100);
    fireEvent.change(campo, { target: { value: 'https://www.instagram.com/rafaelmocbel.fisioterapia/?igsh=abc' } });
    fireEvent.blur(campo);
    expect(campo).toHaveValue('rafaelmocbel.fisioterapia');
  });

  it('avisa quando a logo da clínica não pôde ser usada e o selo caiu na marca do app', async () => {
    mocks.branding.mockResolvedValue({ clinicaLogoUrl: 'https://exemplo.com/logo.png' });
    mocks.carregarSelo.mockResolvedValue({ imagem: {}, tipo: 'marca' });
    abrir({ terapeutaId: 'terapeuta-1' });
    await prontoParaBaixar();
    expect(await screen.findByTestId('aviso-logo')).toHaveTextContent(/Não consegui usar a logo da clínica/);
  });

  it('com a logo da clínica carregada não há aviso', async () => {
    mocks.branding.mockResolvedValue({ clinicaLogoUrl: 'https://exemplo.com/logo.png' });
    mocks.carregarSelo.mockResolvedValue({ imagem: {}, tipo: 'logo' });
    abrir({ terapeutaId: 'terapeuta-1' });
    await prontoParaBaixar();
    await waitFor(() => expect(mocks.carregarSelo).toHaveBeenCalledWith('https://exemplo.com/logo.png'));
    expect(screen.queryByTestId('aviso-logo')).not.toBeInTheDocument();
  });
});
