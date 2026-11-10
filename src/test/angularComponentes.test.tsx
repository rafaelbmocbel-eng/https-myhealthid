import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PainelEstilo from '../components/angular/PainelEstilo';
import { ItensSvg, MarcacaoAngulo, MarcacaoReta, Ponto, Rotulo } from '../components/angular/MarcacaoSvg';
import { ESTILO_INSTAGRAM, ESTILO_PADRAO, LIMITES_ESTILO } from '../lib/angular/estilo';
import CameraNivel from '../components/angular/CameraNivel';
import ComparadorFotos from '../components/angular/ComparadorFotos';
import { SentidoDoOlhar } from '../components/angular/SessaoVistas';
import type { Landmark } from '../lib/angular/pose';

const camera = vi.hoisted(() => ({ lm: null as null | unknown[], graus: null as null | number }));
vi.mock('@/lib/angular/detector', () => ({ detectarPose: async () => camera.lm }));
// `ativar` é estável no hook de verdade: se mudasse a cada render, a câmera pediria o fluxo de novo.
const ativarSensor = async () => {};
vi.mock('@/hooks/useInclinometro', () => ({ useInclinometro: () => ({ graus: camera.graus, ativar: ativarSensor }) }));
const avisosDaTela = vi.hoisted(() => ({ error: vi.fn(), warning: vi.fn(), success: vi.fn() }));
vi.mock('sonner', () => ({ toast: avisosDaTela }));

describe('painel do estilo das linhas', () => {
  it('as predefinições aplicam o estilo e marcam a ativa', () => {
    const aoMudar = vi.fn();
    render(<PainelEstilo estilo={ESTILO_PADRAO} aoMudar={aoMudar} aoFechar={() => {}} />);
    expect(screen.getByRole('button', { name: 'Padrão' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Instagram' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Instagram' }));
    expect(aoMudar).toHaveBeenCalledWith(ESTILO_INSTAGRAM);
    for (const nome of ['Alto contraste', 'Fino']) expect(screen.getByRole('button', { name: nome })).toBeInTheDocument();
  });

  it('espessura, cor, arco, rótulo e casas mudam só o que foi tocado', () => {
    const aoMudar = vi.fn();
    render(<PainelEstilo estilo={ESTILO_INSTAGRAM} aoMudar={aoMudar} aoFechar={() => {}} />);
    const esp = screen.getByLabelText('Espessura das linhas') as HTMLInputElement;
    expect(esp.min).toBe(String(LIMITES_ESTILO.espessura.min));
    expect(esp.max).toBe(String(LIMITES_ESTILO.espessura.max));
    fireEvent.change(esp, { target: { value: '12' } });
    expect(aoMudar).toHaveBeenLastCalledWith({ ...ESTILO_INSTAGRAM, espessura: 12 });
    fireEvent.click(screen.getByRole('button', { name: 'Cor #ef4444' }));
    expect(aoMudar).toHaveBeenLastCalledWith({ ...ESTILO_INSTAGRAM, cor: '#ef4444' });
    fireEvent.click(screen.getByRole('button', { name: 'Arco do ângulo' }));
    expect(aoMudar).toHaveBeenLastCalledWith({ ...ESTILO_INSTAGRAM, mostrarArco: false });
    fireEvent.click(screen.getByRole('button', { name: 'Rótulo do ângulo' }));
    expect(aoMudar).toHaveBeenLastCalledWith({ ...ESTILO_INSTAGRAM, mostrarRotulo: false });
    fireEvent.click(screen.getByRole('button', { name: '118,4°' }));
    expect(aoMudar).toHaveBeenLastCalledWith({ ...ESTILO_INSTAGRAM, casasRotulo: 1 });
  });

  it('sem arco e sem rótulo some o que depende deles', () => {
    render(<PainelEstilo estilo={{ ...ESTILO_INSTAGRAM, mostrarArco: false, mostrarRotulo: false }} aoMudar={() => {}} aoFechar={() => {}} />);
    expect(screen.queryByLabelText('Tamanho do arco')).toBeNull();
    expect(screen.queryByLabelText('Tamanho do rótulo')).toBeNull();
  });

  it('fecha', () => {
    const aoFechar = vi.fn();
    render(<PainelEstilo estilo={ESTILO_PADRAO} aoMudar={() => {}} aoFechar={aoFechar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fechar o estilo das linhas' }));
    expect(aoFechar).toHaveBeenCalled();
  });
});

describe('marcações em SVG', () => {
  const base = { estilo: ESTILO_INSTAGRAM, escala: 1, limites: { w: 1000, h: 1000 } };
  const renderSvg = (el: React.ReactElement) => render(<svg>{el}</svg>).container.querySelector('svg')!;

  it('o ângulo traz braços, arco, três pontas e o rótulo "118°" em pílula', () => {
    const svg = renderSvg(<MarcacaoAngulo {...base} vertice={{ x: 500, y: 500 }} a={{ x: 900, y: 500 }} b={{ x: 500, y: 900 }} graus={118} />);
    expect(svg.querySelectorAll('line').length).toBeGreaterThanOrEqual(2);
    expect(svg.querySelectorAll('path').length).toBe(1);
    expect(svg.querySelectorAll('circle').length).toBe(3);
    expect(svg.querySelector('rect')).not.toBeNull();
    expect(svg.querySelector('text')!.textContent).toBe('118°');
    const linha = svg.querySelector('line')!;
    expect(Number(linha.getAttribute('stroke-width'))).toBeCloseTo(9, 6);
    expect(linha.getAttribute('stroke')).toBe('#4caf50');
  });

  it('a espessura segue a escala', () => {
    const svg = renderSvg(<MarcacaoReta {...base} escala={3} a={{ x: 0, y: 0 }} b={{ x: 100, y: 100 }} />);
    expect(Number(svg.querySelector('line')!.getAttribute('stroke-width'))).toBeCloseTo(27, 6);
  });

  it('o estilo padrão escreve o rótulo com contorno, sem pílula', () => {
    const svg = renderSvg(<Rotulo {...base} estilo={ESTILO_PADRAO} texto="5,7°" x={300} y={300} />);
    expect(svg.querySelector('rect')).toBeNull();
    const t = svg.querySelector('text')!;
    expect(t.getAttribute('stroke')).toBe('#000000');
    expect(t.textContent).toBe('5,7°');
  });

  it('o ponto usa a cor do papel e o contorno do estilo de alto contraste desenha halo nas retas', () => {
    const svg = renderSvg(<Ponto {...base} x={10} y={20} papel="b" />);
    expect(svg.querySelector('circle')!.getAttribute('fill')).toBe(ESTILO_INSTAGRAM.corPontoB);
    const alto = renderSvg(<MarcacaoReta {...base} estilo={{ ...ESTILO_INSTAGRAM, contorno: '#000000', contornoLinhas: true }} a={{ x: 0, y: 0 }} b={{ x: 100, y: 0 }} />);
    expect(alto.querySelectorAll('line').length).toBe(2);
  });

  it('os itens do núcleo esmaecem por grupo', () => {
    const itens = [{ tipo: 'ponto' as const, x: 1, y: 2, raio: 3, cor: '#f00', anel: '#fff', larguraAnel: 1, grupo: 'ombros' }];
    const { container } = render(<svg><ItensSvg itens={itens} opacidadePorGrupo={{ ombros: 0.6 }} /></svg>);
    expect(container.querySelector('circle')!.getAttribute('opacity')).toBe('0.6');
  });
});

describe('câmera do app na sessão (CameraNivel)', () => {
  let getUserMedia: ReturnType<typeof vi.fn>;
  let desenhos: unknown[][];

  beforeEach(() => {
    camera.lm = null;
    camera.graus = null;
    desenhos = [];
    getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] }));
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, get: () => 4000 });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, get: () => 3000 });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({ drawImage: (...a: unknown[]) => { desenhos.push(a); } }) as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb: BlobCallback) => { cb(new Blob(['jpeg'], { type: 'image/jpeg' })); });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete (HTMLVideoElement.prototype as unknown as Record<string, unknown>).videoWidth;
    delete (HTMLVideoElement.prototype as unknown as Record<string, unknown>).videoHeight;
  });

  const abrir = (props: Partial<React.ComponentProps<typeof CameraNivel>> = {}) => {
    const onCapturar = vi.fn(), onFechar = vi.fn(), onPular = vi.fn();
    render(<CameraNivel onCapturar={onCapturar} onFechar={onFechar} {...props} />);
    return { onCapturar, onFechar, onPular };
  };
  const botaoFoto = () => screen.getByRole('button', { name: /Tirar foto/ });

  it('na sequência mostra "Posição n de total", o nome da posição e o que pedir ao paciente', () => {
    abrir({ progresso: 'Posição 2 de 4', posicao: 'Perfil direito', instrucao: 'Peça para ficar de perfil, com o lado direito voltado para a câmera.', ultima: 'Frente guardada.' });
    expect(screen.getByText('Posição 2 de 4: Perfil direito')).toBeInTheDocument();
    expect(screen.getByTestId('instrucao-camera')).toHaveTextContent('Peça para ficar de perfil, com o lado direito voltado para a câmera.');
    expect(screen.getByText('Frente guardada.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Terminar as fotos' })).toBeInTheDocument();
  });

  it('como foto avulsa mostra só o nome da posição e não oferece pular', () => {
    abrir({ posicao: 'Costas', instrucao: 'Peça para ficar de costas.' });
    expect(screen.getByText('Tirar a foto: Costas')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pular/ })).toBeNull();
    // O diálogo traz o seu próprio botão de fechar, além do da câmera.
    expect(screen.getAllByRole('button', { name: 'Fechar' })).toHaveLength(2);
  });

  it('sem posição o título continua o de sempre', () => {
    abrir();
    expect(screen.getByText('Tirar a foto')).toBeInTheDocument();
    expect(screen.queryByTestId('instrucao-camera')).toBeNull();
  });

  it('o botão Pular aparece só quando a sequência o oferece e chama a função recebida', () => {
    const pular = vi.fn();
    abrir({ progresso: 'Posição 3 de 4', posicao: 'Perfil esquerdo', onPular: pular });
    fireEvent.click(screen.getByRole('button', { name: /Pular/ }));
    expect(pular).toHaveBeenCalledTimes(1);
  });

  it('depois de cada foto a câmera continua aberta: a mesma câmera tira as fotos seguidas, sem pedir outra vez', async () => {
    const { onCapturar, onFechar } = abrir({ progresso: 'Posição 1 de 4', posicao: 'Frente', instrucao: 'x' });
    await waitFor(() => expect(botaoFoto()).toBeEnabled());
    fireEvent.click(botaoFoto());
    await waitFor(() => expect(onCapturar).toHaveBeenCalledTimes(1));
    fireEvent.click(botaoFoto());
    await waitFor(() => expect(onCapturar).toHaveBeenCalledTimes(2));
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(onFechar).not.toHaveBeenCalled();
    expect(screen.getByText('Posição 1 de 4: Frente')).toBeInTheDocument();
  });

  it('a foto sai reduzida a 2000 px no maior lado (vídeo de 4000 x 3000 vira 2000 x 1500) e leva a inclinação do celular', async () => {
    camera.graus = 3;
    const { onCapturar } = abrir();
    await waitFor(() => expect(botaoFoto()).toBeEnabled());
    fireEvent.click(botaoFoto());
    await waitFor(() => expect(onCapturar).toHaveBeenCalledTimes(1));
    expect(desenhos).toHaveLength(1);
    expect(desenhos[0].slice(1)).toEqual([0, 0, 2000, 1500]);
    const [arquivo, inclinacao] = onCapturar.mock.calls[0];
    expect(arquivo).toBeInstanceOf(File);
    expect((arquivo as File).type).toBe('image/jpeg');
    expect(inclinacao).toBe(3);
  });

  it('um vídeo pequeno (640 x 480) não é ampliado nem reduzido', async () => {
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, get: () => 640 });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, get: () => 480 });
    const { onCapturar } = abrir();
    await waitFor(() => expect(botaoFoto()).toBeEnabled());
    fireEvent.click(botaoFoto());
    await waitFor(() => expect(onCapturar).toHaveBeenCalled());
    expect(desenhos[0].slice(1)).toEqual([0, 0, 640, 480]);
  });

  it('o guia de enquadramento acende nas costas, mesmo sem o nariz aparecer', async () => {
    const ponto = (x: number, y: number, visibility = 0.9): Landmark => ({ x, y, visibility });
    const lm = Array.from({ length: 33 }, () => ponto(0.5, 0.5));
    lm[0] = ponto(0.5, 0.1, 0.1);
    lm[7] = ponto(0.46, 0.09); lm[8] = ponto(0.54, 0.09);
    lm[11] = ponto(0.4, 0.25); lm[12] = ponto(0.6, 0.25); lm[23] = ponto(0.45, 0.55); lm[24] = ponto(0.55, 0.55);
    lm[27] = ponto(0.46, 0.92); lm[28] = ponto(0.54, 0.92);
    camera.lm = lm;
    abrir({ posicao: 'Costas', instrucao: 'x' });
    await waitFor(() => expect(screen.getByText('Enquadramento bom. Pode fotografar.')).toBeInTheDocument(), { timeout: 4000 });
  });
});

describe('comparador de fotos com o lado do perfil e o seletor de posição', () => {
  beforeEach(() => {
    camera.lm = null;
    avisosDaTela.warning.mockReset(); avisosDaTela.error.mockReset(); avisosDaTela.success.mockReset();
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  const abrirMarcar = () => fireEvent.click(screen.getByRole('tab', { name: 'Marcar' }));
  const abrirPrumoDePerfil = () => fireEvent.click(screen.getByRole('button', { name: 'Fio de prumo (perfil)' }));
  const olhaPara = (lado: 'Esquerda' | 'Direita') => screen.getByRole('button', { name: new RegExp(`^${lado} da imagem`) });

  it('o lado do perfil define para onde o paciente olha por padrão: perfil direito na direita da imagem, perfil esquerdo na esquerda', () => {
    const { unmount } = render(<ComparadorFotos vista="perfil" lado="D" />);
    abrirMarcar(); abrirPrumoDePerfil();
    expect(olhaPara('Direita')).toHaveAttribute('aria-pressed', 'true');
    expect(olhaPara('Esquerda')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(/Vista perfil direito\./)).toBeInTheDocument();
    unmount();
    render(<ComparadorFotos vista="perfil" lado="E" />);
    abrirMarcar(); abrirPrumoDePerfil();
    expect(olhaPara('Esquerda')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Vista perfil esquerdo\./)).toBeInTheDocument();
  });

  it('sem o lado (uso antigo) tudo fica como antes: padrão à direita e nenhum seletor de posição', () => {
    render(<ComparadorFotos vista="perfil" />);
    abrirMarcar(); abrirPrumoDePerfil();
    expect(olhaPara('Direita')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Vista perfil\. As mesmas medidas/)).toBeInTheDocument();
    expect(screen.queryByRole('tablist', { name: 'Posição das fotos' })).toBeNull();
  });

  it('o seletor mostra as quatro posições, começa na da tela e troca as medidas e o "olha para" ao mudar', () => {
    render(<ComparadorFotos vista="frente" seletorDePosicao />);
    const seletor = screen.getByRole('tablist', { name: 'Posição das fotos' });
    expect(Array.from(seletor.querySelectorAll('[role=tab]')).map((t) => t.textContent)).toEqual(['Frente', 'Perfil direito', 'Perfil esquerdo', 'Costas']);
    expect(screen.getByRole('tab', { name: 'Frente' })).toHaveAttribute('aria-selected', 'true');
    abrirMarcar();
    expect(screen.queryByRole('button', { name: 'Fio de prumo (perfil)' })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Perfil esquerdo' }));
    expect(screen.getByRole('tab', { name: 'Perfil esquerdo' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/Vista perfil esquerdo\./)).toBeInTheDocument();
    abrirPrumoDePerfil();
    expect(olhaPara('Esquerda')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Perfil direito' }));
    abrirPrumoDePerfil();
    expect(olhaPara('Direita')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Costas' }));
    expect(screen.queryByRole('button', { name: 'Fio de prumo (perfil)' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Desnível dos ombros' })).toBeInTheDocument();
  });

  it('o seletor começa no perfil do lado recebido', () => {
    render(<ComparadorFotos vista="perfil" lado="E" seletorDePosicao />);
    expect(screen.getByRole('tab', { name: 'Perfil esquerdo' })).toHaveAttribute('aria-selected', 'true');
  });

  it('a marcação automática do comparador usa o lado informado e avisa "confira o lado" em vez de calar', async () => {
    let n = 0;
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null; onerror: (() => void) | null = null; naturalWidth = 1000; naturalHeight = 1500;
      set src(_v: string) { queueMicrotask(() => this.onload?.()); }
    });
    Object.assign(URL, { createObjectURL: () => `blob:c${++n}`, revokeObjectURL: () => {} });
    // Só o lado esquerdo do corpo aparece, mas a foto foi marcada como perfil direito.
    const ponto = (x: number, y: number, visibility: number): Landmark => ({ x, y, visibility });
    const lm = Array.from({ length: 33 }, () => ponto(0.5, 0.5, 0.1));
    for (const i of [11, 23, 25, 27]) lm[i] = ponto(0.5, 0.4, 0.95);
    lm[7] = ponto(0.5, 0.1, 0.95); lm[0] = ponto(0.46, 0.12, 0.95);
    camera.lm = lm;
    render(<ComparadorFotos vista="perfil" lado="D" />);
    fireEvent.change(screen.getByLabelText('Escolher a foto Pré'), { target: { files: [new File(['x'], 'f.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(avisosDaTela.warning).toHaveBeenCalled());
    const textos = avisosDaTela.warning.mock.calls.map((c) => String(c[0]));
    expect(textos.some((t) => t.startsWith('Confira o lado: nesta foto de perfil direito o modelo enxergou melhor o lado esquerdo do corpo.'))).toBe(true);
    expect(textos.some((t) => t.startsWith('Lado do perfil não informado'))).toBe(false);
  });

  it('uma foto nova escolhida no comparador de perfil esquerdo começa olhando para a esquerda da imagem', async () => {
    let n = 0;
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null; onerror: (() => void) | null = null; naturalWidth = 1000; naturalHeight = 1500;
      set src(_v: string) { queueMicrotask(() => this.onload?.()); }
    });
    Object.assign(URL, { createObjectURL: () => `blob:d${++n}`, revokeObjectURL: () => {} });
    camera.lm = null;
    render(<ComparadorFotos vista="perfil" lado="E" />);
    fireEvent.change(screen.getByLabelText('Escolher a foto Pré'), { target: { files: [new File(['x'], 'f.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Fio de prumo (perfil)' })).toBeInTheDocument());
    abrirPrumoDePerfil();
    expect(olhaPara('Esquerda')).toHaveAttribute('aria-pressed', 'true');
  });
});


describe('seletor do sentido do olhar no perfil', () => {
  it('mostra os dois lados da imagem com o escolhido marcado e devolve o que a pessoa tocar', () => {
    const aoMudar = vi.fn();
    render(<SentidoDoOlhar valor="direita" aoMudar={aoMudar} />);
    expect(screen.getByText('O paciente olha para a')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Direita da imagem/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Esquerda da imagem/ })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: /Esquerda da imagem/ }));
    expect(aoMudar).toHaveBeenCalledWith('esquerda');
    fireEvent.click(screen.getByRole('button', { name: /Direita da imagem/ }));
    expect(aoMudar).toHaveBeenLastCalledWith('direita');
  });
});
