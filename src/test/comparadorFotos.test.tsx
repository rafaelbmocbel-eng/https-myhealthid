import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import ComparadorFotos, { type FotoAnalisada } from '@/components/angular/ComparadorFotos';
import { OPCOES_ANALISE_PADRAO } from '@/lib/angular/analise';

vi.mock('@/lib/angular/detector', () => ({ detectarPose: vi.fn().mockRejectedValue(new Error('offline')) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn() } }));

const foto = (pontos: FotoAnalisada['analise']['pontos'], extra: Partial<FotoAnalisada> = {}): FotoAnalisada => ({
  analise: { vista: 'frente', largura: 1200, altura: 1600, imagem: new Image(), pontos, giro: null, cmPorPx: null, opcoes: OPCOES_ANALISE_PADRAO },
  url: 'blob:foto', ...extra,
});

// Ombros: o primeiro ponto é o direito do paciente. 8,5° com o direito mais alto contra 2,9° também com o direito mais alto.
const PRE = foto({ ombros: [{ x: 100, y: 100 }, { x: 300, y: 130 }], 'joelho-d': [{ x: 100, y: 100 }, { x: 110, y: 300 }, { x: 100, y: 500 }] });
const POS = foto({ ombros: [{ x: 100, y: 100 }, { x: 300, y: 110 }], 'joelho-d': [{ x: 100, y: 100 }, { x: 102, y: 300 }, { x: 100, y: 500 }] }, { data: '2026-10-11' });

const fake2d = () => ({ drawImage: vi.fn(), scale: vi.fn(), save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), fill: vi.fn(), arc: vi.fn(), closePath: vi.fn(), setLineDash: vi.fn(), fillText: vi.fn(), strokeText: vi.fn() });

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe('ComparadorFotos', () => {
  it('mostra as duas fotos com nomes Pré e Pós e a diferença em graus de cada medida', () => {
    render(<ComparadorFotos vista="frente" atual={POS} outra={PRE} />);
    expect(screen.getByLabelText('Nome da foto 1')).toHaveValue('Pré');
    expect(screen.getByLabelText('Nome da foto 2')).toHaveValue('Pós');
    expect(screen.getByLabelText('Data da foto Pós')).toHaveValue('2026-10-11');

    const ombros = within(screen.getByTestId('diferenca-ombros'));
    expect(ombros.getByText('8,5°')).toBeInTheDocument();
    expect(ombros.getByText('2,9°')).toBeInTheDocument();
    expect(ombros.getByText('−5,6°')).toBeInTheDocument();
    expect(screen.getAllByText('direito mais alto').length).toBeGreaterThanOrEqual(2);

    const joelho = within(screen.getByTestId('diferenca-joelho-d'));
    expect(joelho.getByText(/^\+?[−-]?\d+,\d°$/, { selector: 'p.font-bold' })).toBeInTheDocument();
    expect(screen.getByText(/não indica melhora ou piora/)).toBeInTheDocument();
  });

  it('o nome editado aparece na tabela de diferenças', () => {
    render(<ComparadorFotos vista="frente" atual={POS} outra={PRE} />);
    fireEvent.change(screen.getByLabelText('Nome da foto 1'), { target: { value: 'Antes' } });
    fireEvent.change(screen.getByLabelText('Nome da foto 2'), { target: { value: 'Depois' } });
    expect(screen.getByText('(Depois − Antes)')).toBeInTheDocument();
    expect(within(screen.getByTestId('diferenca-ombros')).getByText('Antes')).toBeInTheDocument();
    expect(within(screen.getByTestId('diferenca-ombros')).getByText('Depois')).toBeInTheDocument();
  });

  it('alterna entre lado a lado e empilhadas', () => {
    render(<ComparadorFotos vista="frente" atual={POS} outra={PRE} />);
    const grade = screen.getByTestId('painel-0').parentElement!;
    expect(grade).toHaveClass('grid-cols-2');
    fireEvent.click(screen.getByRole('tab', { name: 'Empilhadas' }));
    expect(grade).toHaveClass('grid-cols-1');
    fireEvent.click(screen.getByRole('tab', { name: 'Lado a lado' }));
    expect(grade).toHaveClass('grid-cols-2');
  });

  it('não subtrai desníveis de lados opostos e explica por quê', () => {
    const trocado = foto({ ombros: [{ x: 100, y: 130 }, { x: 300, y: 100 }] });
    render(<ComparadorFotos vista="frente" atual={trocado} outra={PRE} />);
    const ombros = within(screen.getByTestId('diferenca-ombros'));
    expect(ombros.getByText(/O lado mudou/)).toBeInTheDocument();
    expect(ombros.getByText('—')).toBeInTheDocument();
  });

  it('com só uma foto marcada, pede a marcação na outra sem inventar diferença', () => {
    render(<ComparadorFotos vista="frente" atual={POS} />);
    const ombros = within(screen.getByTestId('diferenca-ombros'));
    expect(ombros.getByText('Falta marcar na foto Pré.')).toBeInTheDocument();
    expect(screen.getByLabelText('Escolher a foto Pré')).toBeInTheDocument();
  });

  it('esconde e mostra uma medida pelo botão da medida', () => {
    render(<ComparadorFotos vista="frente" atual={POS} outra={PRE} />);
    const grupo = screen.getByRole('group', { name: 'Medidas mostradas' });
    fireEvent.click(within(grupo).getByRole('button', { name: /Desnível dos ombros/ }));
    expect(screen.queryByTestId('diferenca-ombros')).toBeNull();
    expect(screen.getByTestId('diferenca-joelho-d')).toBeInTheDocument();
    fireEvent.click(within(grupo).getByRole('button', { name: /Desnível dos ombros/ }));
    expect(screen.getByTestId('diferenca-ombros')).toBeInTheDocument();
  });

  it('entrega ao export as duas fotos marcadas e as medidas, sem rótulos de arte', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => fake2d() as unknown as CanvasRenderingContext2D);
    const onExportar = vi.fn();
    render(<ComparadorFotos vista="frente" atual={POS} outra={PRE} onExportar={onExportar} />);
    fireEvent.change(screen.getByLabelText('Nome da foto 1'), { target: { value: 'Pré-sessão' } });
    fireEvent.click(screen.getByRole('button', { name: /Baixar para Instagram/ }));
    expect(onExportar).toHaveBeenCalledTimes(1);
    const arte = onExportar.mock.calls[0][0];
    expect(arte.paineis.map((p: { rotulo: string }) => p.rotulo)).toEqual(['Pré-sessão', 'Pós']);
    expect(arte.paineis[1].data).toBe('11/10/2026');
    expect(arte.paineis[0].data).toBeUndefined();
    expect(arte.paineis[0]).toMatchObject({ largura: 1200, altura: 1600 });
    expect(arte.paineis[0].imagem).toBeInstanceOf(HTMLCanvasElement);
    expect(arte.medidas.find((m: { nome: string }) => m.nome === 'Desnível dos ombros').valor).toBe('8,5° → 2,9° (−5,6°)');
  });

  it('entrega junto da arte os pontos de pose de cada foto, para achar o rosto', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => fake2d() as unknown as CanvasRenderingContext2D);
    const onExportar = vi.fn();
    const lm = [{ x: 0.5, y: 0.1, visibility: 0.9 }];
    render(<ComparadorFotos vista="frente" atual={{ ...POS, landmarks: lm }} outra={PRE} onExportar={onExportar} />);
    fireEvent.click(screen.getByRole('button', { name: /Baixar para Instagram/ }));
    expect(onExportar.mock.calls[0][1]).toEqual({ landmarks: [null, lm] });
  });

  it('troca as fotos de lugar e mantém os nomes e a diferença coerente', () => {
    render(<ComparadorFotos vista="frente" atual={POS} outra={PRE} />);
    expect(within(screen.getByTestId('diferenca-ombros')).getByText('−5,6°')).toBeInTheDocument();
    expect(screen.getByLabelText('Data da foto Pós')).toHaveValue('2026-10-11');
    fireEvent.click(screen.getByRole('button', { name: /Trocar/ }));
    expect(screen.getByLabelText('Nome da foto 1')).toHaveValue('Pré');
    expect(screen.getByLabelText('Nome da foto 2')).toHaveValue('Pós');
    expect(screen.getByLabelText('Data da foto Pré')).toHaveValue('2026-10-11');
    expect(within(screen.getByTestId('diferenca-ombros')).getByText('+5,6°')).toBeInTheDocument();
  });

  it('sem onExportar não mostra o botão de arte', () => {
    render(<ComparadorFotos vista="frente" atual={POS} outra={PRE} />);
    expect(screen.queryByRole('button', { name: /Baixar para Instagram/ })).toBeNull();
  });

  it('na edição lista as ferramentas da vista e volta à comparação', () => {
    render(<ComparadorFotos vista="frente" atual={POS} outra={PRE} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Marcar' }));
    const ferramentas = within(screen.getByRole('navigation', { name: 'Ferramentas de medida' }));
    expect(ferramentas.getByRole('button', { name: 'Desnível dos ombros' })).toHaveAttribute('aria-pressed', 'true');
    expect(ferramentas.getByRole('button', { name: 'Joelho direito' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ângulo craniovertebral' })).toBeNull();
    fireEvent.click(ferramentas.getByRole('button', { name: 'Joelho direito' }));
    expect(screen.getByRole('status')).toHaveTextContent('Joelho direito.');
    fireEvent.click(screen.getByRole('button', { name: 'Ver a comparação' }));
    expect(screen.getByTestId('diferencas')).toBeInTheDocument();
  });

  it('o estilo escolhido é guardado e a espessura muda', () => {
    render(<ComparadorFotos vista="frente" atual={POS} outra={PRE} />);
    fireEvent.click(screen.getByRole('button', { name: 'Estilo das linhas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Instagram' }));
    expect(screen.getByRole('button', { name: 'Instagram' })).toHaveAttribute('aria-pressed', 'true');
    expect(JSON.parse(localStorage.getItem('myid:angular:estilo-marcacao')!).espessura).toBe(9);
    fireEvent.change(screen.getByLabelText('Espessura das linhas'), { target: { value: '12' } });
    expect(JSON.parse(localStorage.getItem('myid:angular:estilo-marcacao')!).espessura).toBe(12);
  });
});

describe('ComparadorFotos: correções de revisão', () => {
  const P = (x: number, y: number) => ({ x, y });
  // Fio de prumo de perfil: apoio embaixo e orelha, ombro, quadril e joelho; a orelha fica 30 px à frente do fio.
  const prumoPerfil = (espelhar: boolean) => {
    const x = (v: number) => (espelhar ? 200 - v : v);
    return [P(x(100), 500), P(x(130), 100), P(x(120), 200), P(x(100), 300), P(x(95), 400)];
  };
  const fotoPerfil = (olhaPara: 'direita' | 'esquerda', pontos = prumoPerfil(olhaPara === 'esquerda')): FotoAnalisada => ({
    analise: { vista: 'perfil', largura: 1200, altura: 1600, imagem: new Image(), pontos: { 'prumo-perfil': pontos }, giro: null, cmPorPx: null, opcoes: { ...OPCOES_ANALISE_PADRAO, olhaPara } },
    url: 'blob:perfil',
  });

  it('cada foto guarda para onde o paciente olha: pré à direita e pós à esquerda não viram "lado trocado"', () => {
    render(<ComparadorFotos vista="perfil" atual={fotoPerfil('esquerda')} outra={fotoPerfil('direita')} />);
    const orelha = within(screen.getByTestId('diferenca-prumo-perfil-orelha-graus'));
    expect(orelha.queryByText(/O lado mudou/)).toBeNull();
    expect(orelha.getAllByText('à frente do fio')).toHaveLength(2);
    expect(orelha.getByText('0,0°', { selector: 'p.font-bold' })).toBeInTheDocument();
  });

  it('o seletor "olha para" muda só a foto em edição', () => {
    render(<ComparadorFotos vista="perfil" atual={fotoPerfil('direita')} outra={fotoPerfil('direita', prumoPerfil(false))} />);
    // as duas fotos têm a orelha à direita do fio, olhando para a direita: iguais
    expect(within(screen.getByTestId('diferenca-prumo-perfil-orelha-graus')).getAllByText('à frente do fio')).toHaveLength(2);
    fireEvent.click(screen.getByRole('tab', { name: 'Marcar' }));
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Ferramentas de medida' })).getByRole('button', { name: 'Fio de prumo (perfil)' }));
    const cartao = within(screen.getByTestId('cartao-prumo'));
    expect(cartao.getByRole('button', { name: /Direita da imagem/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(cartao.getByRole('button', { name: /Esquerda da imagem/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver a comparação' }));
    // só a foto que estava em edição passou a olhar para a esquerda: a mesma anatomia vira "atrás do fio" nela e fica "à frente" na outra
    const orelha = within(screen.getByTestId('diferenca-prumo-perfil-orelha-graus'));
    expect(orelha.getByText('atrás do fio')).toBeInTheDocument();
    expect(orelha.getByText('à frente do fio')).toBeInTheDocument();
  });

  it('a foto semente não ganha a data de hoje: a data só vem se o integrador informar', () => {
    render(<ComparadorFotos vista="frente" atual={foto({ ombros: [{ x: 100, y: 100 }, { x: 300, y: 110 }] })} outra={PRE} />);
    expect(screen.getByLabelText('Data da foto Pós')).toHaveValue('');
    expect(screen.getByLabelText('Data da foto Pré')).toHaveValue('');
  });

  it('o botão de fechar a comparação não encolhe quando o texto ao lado é longo', () => {
    render(<ComparadorFotos vista="frente" atual={POS} outra={PRE} onFechar={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Fechar a comparação' })).toHaveClass('shrink-0');
  });

  const alcas = (container: HTMLElement) => Array.from(container.querySelectorAll('svg circle[fill="transparent"]')).map((c) => Number(c.getAttribute('r')));

  it('marcando pontos novos o alvo de toque da medida ativa é pequeno; completa, volta ao grande', () => {
    const umPonto = foto({ ombros: [{ x: 100, y: 100 }] });
    const { container, unmount } = render(<ComparadorFotos vista="frente" atual={umPonto} outra={umPonto} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Marcar' }));
    expect(alcas(container)).toEqual([5]);
    unmount();

    const completo = render(<ComparadorFotos vista="frente" atual={POS} outra={PRE} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Marcar' }));
    const raios = alcas(completo.container);
    expect(raios).toContain(24);
    expect(raios).toContain(12);
    expect(raios).not.toContain(5);
  });

  it('a alça do fio de prumo também não rouba o toque enquanto ainda faltam pontos', () => {
    const incompleto = fotoPerfil('direita', prumoPerfil(false).slice(0, 2));
    const { container } = render(<ComparadorFotos vista="perfil" atual={incompleto} outra={incompleto} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Marcar' }));
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Ferramentas de medida' })).getByRole('button', { name: 'Fio de prumo (perfil)' }));
    const transparente = container.querySelector('[data-testid="alca-prumo"] circle[fill="transparent"]')!;
    expect(Number(transparente.getAttribute('r'))).toBe(5);
  });
});
