import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import ControlesQuadro, { BarraQuadros } from '../components/angular/video/ControlesQuadro';
import GraficoAngulo from '../components/angular/video/GraficoAngulo';
import CartoesMetricas from '../components/angular/video/CartoesMetricas';
import ListaEventos from '../components/angular/video/ListaEventos';
import EscolherModelo from '../components/angular/video/EscolherModelo';
import CompararLados from '../components/angular/video/CompararLados';
import PainelExportar from '../components/angular/video/PainelExportar';
import PainelRastreio from '../components/angular/video/PainelRastreio';
import EnviarVideo from '../components/angular/video/EnviarVideo';
import { detectorDeTeste } from '../components/angular/video/ganchoTeste';
import type { SerieGrafico } from '../lib/angular/analiseVideo/graficoLayout';
import { alcaMaisProxima } from '../lib/angular/analiseVideo/marcacoes';
import type { CartaoMetricaUi, EventoUi, ModeloUi } from '../lib/angular/analiseVideo/tiposUi';
import type { VideoCarregado } from '../lib/angular/analiseVideo/carregarVideo';

afterEach(cleanup);

describe('barra e controles de quadro', () => {
  it('o teclado muda o quadro e a barra descreve a posição', () => {
    const aoIr = vi.fn();
    render(<BarraQuadros quadro={10} nQuadros={100} marcas={[]} aoIr={aoIr} />);
    const barra = screen.getByRole('slider', { name: 'Quadro do vídeo' });
    expect(barra).toHaveAttribute('aria-valuenow', '11');
    expect(barra).toHaveAttribute('aria-valuetext', 'Quadro 11 de 100');
    fireEvent.keyDown(barra, { key: 'ArrowRight' });
    expect(aoIr).toHaveBeenLastCalledWith(11);
    fireEvent.keyDown(barra, { key: 'ArrowLeft', shiftKey: true });
    expect(aoIr).toHaveBeenLastCalledWith(0);
    fireEvent.keyDown(barra, { key: 'End' });
    expect(aoIr).toHaveBeenLastCalledWith(99);
    fireEvent.keyDown(barra, { key: 'Home' });
    expect(aoIr).toHaveBeenLastCalledWith(0);
    fireEvent.keyDown(barra, { key: 'PageUp' });
    expect(aoIr).toHaveBeenLastCalledWith(20);
  });

  it('mostra os quadros corrigidos e os eventos como marcas', () => {
    const { container } = render(<BarraQuadros quadro={0} nQuadros={50} aoIr={() => {}}
      marcas={[{ chave: 'c-5', i: 5, pct: 10, tipo: 'corrigido' }, { chave: 'e-1', i: 20, pct: 40, tipo: 'contato', lado: 'D' }, { chave: 'e-2', i: 30, pct: 60, tipo: 'saida', lado: 'E' }]} />);
    expect(container.querySelectorAll('[data-marca="corrigido"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-marca="contato"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-marca="saida"]')).toHaveLength(1);
  });

  it('os botões de quadro e a velocidade chamam o que se espera, com alvos de toque grandes', () => {
    const f = { aoIr: vi.fn(), aoPasso: vi.fn(), aoAlternar: vi.fn(), aoVelocidade: vi.fn() };
    render(<ControlesQuadro quadro={4} nQuadros={90} t={0.13} tocando={false} velocidade={0.25} marcas={[]} {...f} />);
    fireEvent.click(screen.getByRole('button', { name: 'Próximo quadro' }));
    expect(f.aoPasso).toHaveBeenLastCalledWith(1);
    fireEvent.click(screen.getByRole('button', { name: 'Quadro anterior' }));
    expect(f.aoPasso).toHaveBeenLastCalledWith(-1);
    fireEvent.click(screen.getByRole('button', { name: 'Avançar 10 quadros' }));
    expect(f.aoPasso).toHaveBeenLastCalledWith(10);
    fireEvent.click(screen.getByRole('button', { name: 'Reproduzir' }));
    expect(f.aoAlternar).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '0,25×' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '0,1×' }));
    expect(f.aoVelocidade).toHaveBeenLastCalledWith(0.1);
    expect(screen.getByTestId('posicao-quadro')).toHaveTextContent('Quadro 5 de 90 · 0,13 s');
    for (const nome of ['Próximo quadro', 'Quadro anterior', 'Reproduzir']) expect(screen.getByRole('button', { name: nome }).className).toMatch(/h-12/);
  });

  it('com o vídeo tocando o botão vira "Pausar"', () => {
    render(<ControlesQuadro quadro={0} nQuadros={10} t={0} tocando velocidade={1} marcas={[]} aoIr={() => {}} aoPasso={() => {}} aoAlternar={() => {}} aoVelocidade={() => {}} />);
    expect(screen.getByRole('button', { name: 'Pausar' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('gráfico ângulo x tempo', () => {
  const serie = (id: string, lado: 'D' | 'E', f: (t: number) => number): SerieGrafico => ({ id, rotulo: lado, lado, cor: lado === 'D' ? '#2A78D6' : '#EB6834', pontos: Array.from({ length: 61 }, (_, i) => ({ t: i / 10, v: f(i / 10) })) });
  const series = [serie('joelho_d', 'D', (t) => 30 + 20 * Math.sin(t)), serie('joelho_e', 'E', (t) => 25 + 20 * Math.cos(t))];

  it('uma curva por lado, valores no cursor e nenhuma banda sem referência', () => {
    render(<GraficoAngulo titulo="Joelho" series={series} t0={0} duracao={6} t={1.5} aoIrPara={() => {}} />);
    expect(screen.getByTestId('curva-joelho_d')).toBeInTheDocument();
    expect(screen.getByTestId('curva-joelho_e')).toBeInTheDocument();
    expect(screen.queryByTestId('banda-referencia')).toBeNull();
    expect(screen.getByTestId('grafico-angulo').textContent).toMatch(/D \d+,\d°/);
    expect(screen.getByRole('img')).toHaveAccessibleName(/Joelho: D de \d+ a \d+°; E de/);
  });

  it('a banda de referência só aparece quando recebida (com a fonte na legenda)', () => {
    render(<GraficoAngulo titulo="Joelho" series={series} t0={0} duracao={6} t={0} aoIrPara={() => {}} bandas={[{ id: 'b', min: 20, max: 45, rotulo: 'Referência do pico: 20 a 45° (Autor, 2020, PMID 1)' }]} />);
    expect(screen.getByTestId('banda-referencia')).toBeInTheDocument();
    expect(screen.getByText(/PMID 1/)).toBeInTheDocument();
  });

  it('eventos viram marcadores e a legenda os explica', () => {
    render(<GraficoAngulo titulo="Joelho" series={series} t0={0} duracao={6} t={0} aoIrPara={() => {}}
      marcadores={[{ id: 'a', t: 1, tipo: 'contato', lado: 'D' }, { id: 'b', t: 2, tipo: 'saida', lado: 'E' }, { id: 'c', t: 3, tipo: 'outro', legenda: 'pico da repetição' }]} />);
    expect(screen.getByTestId('marcador-contato')).toBeInTheDocument();
    expect(screen.getByTestId('marcador-saida')).toBeInTheDocument();
    expect(screen.getByText(/contato inicial/)).toBeInTheDocument();
    expect(screen.getByText(/saída do pé/)).toBeInTheDocument();
    expect(screen.getByText(/pico da repetição/)).toBeInTheDocument();
  });

  it('o cursor anda com o tempo sem refazer as curvas', () => {
    const { rerender } = render(<GraficoAngulo titulo="Joelho" series={series} t0={0} duracao={6} t={1} aoIrPara={() => {}} />);
    const x1 = Number(screen.getByTestId('cursor-grafico').getAttribute('x1'));
    const d1 = screen.getByTestId('curva-joelho_d').getAttribute('d');
    rerender(<GraficoAngulo titulo="Joelho" series={series} t0={0} duracao={6} t={4} aoIrPara={() => {}} />);
    expect(Number(screen.getByTestId('cursor-grafico').getAttribute('x1'))).toBeGreaterThan(x1);
    expect(screen.getByTestId('curva-joelho_d').getAttribute('d')).toBe(d1);
  });
});

describe('cartões de métricas', () => {
  const base: CartaoMetricaUi = { chave: 'x', titulo: 'Amplitude do joelho', valores: [{ lado: 'D', texto: '55,5°', status: 'sem_referencia' }, { lado: 'E', texto: '50,1°', status: 'sem_referencia' }], referencias: [], contexto: [], avisos: [] };

  it('sem referência diz "sem referência" e não inventa faixa', () => {
    render(<CartoesMetricas cartoes={[base]} />);
    expect(screen.getAllByText('sem referência')).toHaveLength(2);
    expect(screen.queryByTestId('linha-referencia')).toBeNull();
    expect(screen.queryByText(/dentro da referência|fora da referência/)).toBeNull();
    expect(screen.getByText(/o app não inventa limites/)).toBeInTheDocument();
  });

  it('com referência mostra a faixa, a fonte curta, o PMID e o link do PubMed', () => {
    const c: CartaoMetricaUi = {
      ...base, titulo: 'Velocidade',
      valores: [{ lado: null, texto: '130,0 cm/s', status: 'dentro' }],
      referencias: [{ faixa: '127,2 a 146,2 cm/s', populacao: 'Adultos saudáveis', citacao: 'Bohannon RW. Age Ageing. 1997.', rotulo: 'Bohannon, 1997', pmid: '9143432', nota: 'Não é intervalo individual.' }],
    };
    render(<CartoesMetricas cartoes={[c]} />);
    expect(screen.getByText('dentro da referência')).toBeInTheDocument();
    expect(screen.getByTestId('linha-referencia').textContent).toMatch(/127,2 a 146,2 cm\/s \(Bohannon, 1997, PMID 9143432\)/);
    expect(screen.getByRole('link', { name: 'PubMed 9143432' })).toHaveAttribute('href', 'https://pubmed.ncbi.nlm.nih.gov/9143432/');
  });

  it('fora da referência chama atenção; limiar prático diz "limiar"', () => {
    const fora: CartaoMetricaUi = { ...base, valores: [{ lado: null, texto: '20°', status: 'fora' }], referencias: [{ faixa: '30 a 40°', populacao: 'p', citacao: 'c', pmid: '1' }] };
    const limiar: CartaoMetricaUi = { ...base, chave: 'y', titulo: 'Cadência', valores: [{ lado: null, texto: '109 passos/min', status: 'dentro' }], referencias: [{ faixa: '≥ 100 passos/min', populacao: 'p', citacao: 'c', pmid: '2', tipo: 'limiar_heuristico' }] };
    render(<CartoesMetricas cartoes={[fora, limiar]} />);
    expect(screen.getByText('fora da referência')).toBeInTheDocument();
    expect(screen.getByText('dentro do limiar')).toBeInTheDocument();
    expect(screen.queryByText('dentro da referência')).toBeNull();
    const [primeiro] = screen.getAllByTestId('cartao-metrica');
    expect(primeiro.className).toMatch(/border-amber/);
  });

  it('sem referência, a literatura aparece como contexto com a fonte e a fórmula fica disponível', () => {
    const c: CartaoMetricaUi = { ...base, contexto: [{ texto: 'Amplitude média de 67,3°.', citacao: 'Gale T. J Biomech Eng. 2020.', pmid: '32491153' }], formula: 'IS = |D − E| ÷ média × 100' };
    render(<CartoesMetricas cartoes={[c]} />);
    const ctx = screen.getByTestId('contexto-literatura');
    expect(within(ctx).getByText(/sem faixa para classificar/)).toBeInTheDocument();
    expect(within(ctx).getByRole('link', { name: 'PubMed 32491153' })).toBeInTheDocument();
    expect(screen.getByText('Como é calculado')).toBeInTheDocument();
  });

  it('sem cartões orienta a rastrear', () => {
    render(<CartoesMetricas cartoes={[]} />);
    expect(screen.getByText(/faça o rastreio/)).toBeInTheDocument();
  });
});

describe('eventos', () => {
  const eventos: EventoUi[] = [
    { id: 'D-contato-34', tipo: 'contato', lado: 'D', i: 34, t: 1.13, origem: 'auto' },
    { id: 'E-saida-40', tipo: 'saida', lado: 'E', i: 40, t: 1.33, origem: 'manual' },
  ];
  const f = () => ({ aoIr: vi.fn(), aoAdicionar: vi.fn(), aoMover: vi.fn(), aoRemover: vi.fn(), aoRestaurar: vi.fn() });

  it('lista os eventos, diz o que é sugerido e o que foi editado', () => {
    render(<ListaEventos eventos={eventos} quadroAtual={0} {...f()} />);
    const itens = screen.getAllByTestId('evento');
    expect(itens).toHaveLength(2);
    expect(itens[0].textContent).toMatch(/Contato inicial do pé.*quadro 35.*sugerido/);
    expect(itens[1].textContent).toMatch(/Saída do pé.*editado/);
  });

  it('marca, move, remove e vai ao quadro do evento', () => {
    const c = f();
    render(<ListaEventos eventos={eventos} quadroAtual={10} {...c} />);
    fireEvent.click(screen.getByRole('button', { name: 'Contato esquerdo' }));
    expect(c.aoAdicionar).toHaveBeenLastCalledWith('contato', 'E');
    fireEvent.click(screen.getByRole('button', { name: 'Saída direito' }));
    expect(c.aoAdicionar).toHaveBeenLastCalledWith('saida', 'D');
    const [primeiro] = screen.getAllByTestId('evento');
    fireEvent.click(within(primeiro).getByRole('button', { name: 'Mover para este quadro' }));
    expect(c.aoMover).toHaveBeenCalledWith('D-contato-34');
    fireEvent.click(within(primeiro).getByRole('button', { name: 'Remover evento' }));
    expect(c.aoRemover).toHaveBeenCalledWith('D-contato-34');
    fireEvent.click(within(primeiro).getByRole('button', { name: /Ir para Contato inicial do pé direito/ }));
    expect(c.aoIr).toHaveBeenCalledWith(34);
  });

  it('não move um evento para o quadro em que ele já está, e só oferece voltar às sugestões depois de editar', () => {
    const c = f();
    const { rerender } = render(<ListaEventos eventos={eventos} quadroAtual={34} {...c} />);
    expect(within(screen.getAllByTestId('evento')[0]).getByRole('button', { name: 'Mover para este quadro' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Voltar às sugestões/ }));
    expect(c.aoRestaurar).toHaveBeenCalled();
    rerender(<ListaEventos eventos={[eventos[0]]} quadroAtual={0} {...c} />);
    expect(screen.queryByRole('button', { name: /Voltar às sugestões/ })).toBeNull();
  });

  it('sem eventos orienta a marcar à mão', () => {
    render(<ListaEventos eventos={[]} quadroAtual={0} {...f()} />);
    expect(screen.getByText(/Nenhum evento detectado/)).toBeInTheDocument();
  });
});

describe('passo do modelo de gesto', () => {
  const video: VideoCarregado = { url: 'blob:x', arquivo: new File([''], 'v.webm'), nome: 'v.webm', tamanho: 1000, duracao: 12, largura: 640, altura: 480 };
  const modelos: ModeloUi[] = [
    { id: 'marcha', nome: 'Marcha (caminhada)', vista: 'Vista lateral', descricao: 'Ângulos ao longo do ciclo.', itens: ['cadência', 'simetria'], comEventos: true },
    { id: 'salto', nome: 'Aterrissagem de salto', vista: 'Vista frontal', descricao: 'Valgo dinâmico.', itens: ['desvio do joelho'], comEventos: false },
  ];
  const props = () => ({
    video, modelos, modeloId: 'marcha', aoModelo: vi.fn(), fpsVideo: 120, aoFpsVideo: vi.fn(), taxaFps: 30, aoTaxa: vi.fn(),
    intervalo: { inicio: 0, fim: 12 }, aoIntervalo: vi.fn(), avisos: ['Vídeo longo'], aoRastrear: vi.fn(), aoSoMedir: vi.fn(), aoTrocarVideo: vi.fn(),
  });

  it('escolhe o gesto, a taxa de quadros e o detalhe da análise', () => {
    const p = props();
    render(<EscolherModelo {...p} />);
    expect(screen.getByRole('radio', { name: /Marcha/ })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByTestId('modelo-salto'));
    expect(p.aoModelo).toHaveBeenCalledWith('salto');
    fireEvent.click(screen.getByRole('button', { name: '240' }));
    expect(p.aoFpsVideo).toHaveBeenCalledWith(240);
    expect(screen.getByRole('button', { name: '120' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /Detalhada/ }));
    expect(p.aoTaxa).toHaveBeenCalledWith(60);
    expect(screen.getByText(/Vídeo longo/)).toBeInTheDocument();
  });

  it('rastrear é o botão principal; vindo do ponto a ponto, "só medir" passa à frente', () => {
    const p = props();
    const { container, rerender } = render(<EscolherModelo {...p} primario="rastrear" />);
    const ordem = () => [...container.querySelectorAll('button[data-testid^="botao-"]')].map((b) => b.getAttribute('data-testid'));
    expect(ordem()).toEqual(['botao-rastrear', 'botao-so-medir']);
    fireEvent.click(screen.getByTestId('botao-rastrear'));
    expect(p.aoRastrear).toHaveBeenCalled();
    rerender(<EscolherModelo {...p} primario="medir" />);
    expect(ordem()).toEqual(['botao-so-medir', 'botao-rastrear']);
    fireEvent.click(screen.getByTestId('botao-so-medir'));
    expect(p.aoSoMedir).toHaveBeenCalled();
  });

  it('o trecho do vídeo respeita o limite de 30 s', () => {
    const p = props();
    render(<EscolherModelo {...p} video={{ ...video, duracao: 75 }} intervalo={{ inicio: 0, fim: 30 }} />);
    fireEvent.change(screen.getByLabelText('Início do trecho'), { target: { value: '5' } });
    expect(p.aoIntervalo).toHaveBeenLastCalledWith({ inicio: 5, fim: 30 });
    fireEvent.change(screen.getByLabelText('Fim do trecho'), { target: { value: '12' } });
    const ultima = p.aoIntervalo.mock.calls[p.aoIntervalo.mock.calls.length - 1][0] as { inicio: number; fim: number };
    expect(ultima.fim - ultima.inicio).toBeLessThanOrEqual(30);
  });
});

describe('D × E, exportar, rastreio e envio', () => {
  it('compara os lados com a assimetria e a fórmula', () => {
    const r = { min: 4, max: 60, adm: 56, media: 20, n: 90 };
    render(<CompararLados formula="IS = |D − E| ÷ ((D + E) ÷ 2) × 100" linhas={[{ grupoId: 'joelho', nome: 'Joelho', D: r, E: { ...r, adm: 50 }, assimetriaAdm: 11.3 }]} />);
    expect(screen.getByLabelText('Joelho: direito e esquerdo')).toBeInTheDocument();
    expect(screen.getByTestId('lado-D')).toHaveTextContent('56,0°');
    expect(screen.getByTestId('lado-E')).toHaveTextContent('50,0°');
    expect(screen.getByText('11,3%')).toBeInTheDocument();
    expect(screen.getByText(/IS = \|D − E\|/)).toBeInTheDocument();
  });

  it('sem os dois lados avisa', () => {
    render(<CompararLados formula="" linhas={[]} />);
    expect(screen.getByText(/não tem ângulos dos dois lados/)).toBeInTheDocument();
  });

  it('as saídas ficam desabilitadas sem análise e o texto conta as correções', () => {
    const f = { aoBaixarVideo: vi.fn(), aoQuadroInstagram: vi.fn(), aoPdf: vi.fn(), aoSalvar: vi.fn(), aoAbrir: vi.fn(), aoRegistrar: vi.fn(), aoCopiar: vi.fn() };
    const { rerender } = render(<PainelExportar temAnalise={false} gerandoPdf={false} registrando={false} temPaciente={false} correcoes={{ quadros: 0, pontos: 0 }} {...f} />);
    expect(screen.getByTestId('baixar-video')).toBeDisabled();
    expect(screen.getByTestId('baixar-quadro')).toBeDisabled();
    expect(screen.getByTestId('registrar-prontuario')).toBeDisabled();
    expect(screen.getByText(/Escolha um paciente/)).toBeInTheDocument();
    rerender(<PainelExportar temAnalise gerandoPdf={false} registrando={false} temPaciente correcoes={{ quadros: 3, pontos: 5 }} {...f} />);
    fireEvent.click(screen.getByTestId('baixar-video'));
    fireEvent.click(screen.getByTestId('baixar-quadro'));
    fireEvent.click(screen.getByTestId('gerar-pdf'));
    expect(f.aoBaixarVideo).toHaveBeenCalled();
    expect(f.aoQuadroInstagram).toHaveBeenCalled();
    expect(f.aoPdf).toHaveBeenCalled();
    expect(screen.getByText(/corrigiu 5 pontos em 3 quadros/)).toBeInTheDocument();
  });

  it('o rastreio mostra o progresso e pode ser cancelado', () => {
    const aoCancelar = vi.fn();
    render(<PainelRastreio progresso={0.42} aoCancelar={aoCancelar} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(aoCancelar).toHaveBeenCalled();
  });

  it('o envio aceita vídeo e análise salva, cada um no seu campo', () => {
    const aoEscolherVideo = vi.fn(), aoAbrirAnalise = vi.fn();
    render(<EnviarVideo aoEscolherVideo={aoEscolherVideo} aoAbrirAnalise={aoAbrirAnalise} />);
    const video = new File(['v'], 'v.webm', { type: 'video/webm' });
    fireEvent.change(screen.getByTestId('entrada-video'), { target: { files: [video] } });
    expect(aoEscolherVideo).toHaveBeenCalledWith(video);
    const json = new File(['{}'], 'a.json', { type: 'application/json' });
    fireEvent.change(screen.getByTestId('entrada-analise'), { target: { files: [json] } });
    expect(aoAbrirAnalise).toHaveBeenCalledWith(json);
    expect(screen.getByTestId('entrada-video')).toHaveAttribute('accept', 'video/*');
  });
});

describe('arrastar pontos e gancho de teste', () => {
  const pontos = { joelho_d: { x: 100, y: 100 }, joelho_e: { x: 108, y: 100 }, quadril_d: { x: 100, y: 40 } };
  const nomes = ['joelho_d', 'joelho_e', 'quadril_d', 'tornozelo_d'];

  it('com dois joelhos próximos pega o mais perto do dedo, qualquer que seja a ordem', () => {
    expect(alcaMaisProxima(pontos, nomes, { x: 105, y: 100 }, 20)).toBe('joelho_e');
    expect(alcaMaisProxima(pontos, nomes, { x: 101, y: 100 }, 20)).toBe('joelho_d');
    expect(alcaMaisProxima(pontos, [...nomes].reverse(), { x: 101, y: 100 }, 20)).toBe('joelho_d');
  });

  it('fora do alcance não pega nada (e o dedo desliza os quadros)', () => {
    expect(alcaMaisProxima(pontos, nomes, { x: 300, y: 300 }, 20)).toBeNull();
    expect(alcaMaisProxima(null, nomes, { x: 100, y: 100 }, 20)).toBeNull();
    expect(alcaMaisProxima(pontos, ['tornozelo_d'], { x: 100, y: 100 }, 20)).toBeNull();
  });

  it('o gancho de detector falso só existe em desenvolvimento', () => {
    const falso = async () => null;
    window.__MYID_DETECTOR_TESTE__ = falso;
    expect(detectorDeTeste()).toBe(falso);
    vi.stubEnv('DEV', false);
    expect(detectorDeTeste()).toBeUndefined();
    vi.unstubAllEnvs();
    delete window.__MYID_DETECTOR_TESTE__;
    expect(detectorDeTeste()).toBeUndefined();
  });
});
