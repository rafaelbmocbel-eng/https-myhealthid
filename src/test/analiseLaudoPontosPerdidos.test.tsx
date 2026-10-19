import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import AbaLaudo from '../components/angular/video/laudo/AbaLaudo';
import PontosAConferir from '../components/angular/video/laudo/PontosAConferir';
import { fraseContagemPontos, useContagemPontosAConferir } from '../components/angular/video/laudo/useContagemPontosAConferir';
import { useEstadoLaudo } from '../components/angular/video/laudo/useEstadoLaudo';
import { sugestaoParaCorrecao, sugestoesDePontosAusentes } from '../lib/angular/analiseVideo/marcacoes';
import { lerAnaliseSalva, serializarAnalise } from '../lib/angular/analiseVideo/persistencia';
import type { VideoCarregado } from '../lib/angular/analiseVideo/carregarVideo';
import { analisarMovimento } from '../lib/angular/movimento/analisarMovimento';
import { agruparItensACorrigir } from '../lib/angular/movimento/pontosPerdidos';
import { protocoloDo } from '../lib/angular/movimento/protocolos';
import { termoProibido } from '../lib/angular/movimento/vocabulario';
import { corrigirPonto } from '../lib/angular/video/correcao';
import type { TrilhaPose } from '../lib/angular/video/tipos';
import { trilhaAgachamentoLateral } from './movimentoMotorSintetico';

/*
 * Pontos a conferir (agente P): a aba Laudo lista no topo onde faltou ponto, agrupado por repetição, com "Ir ao quadro"; a contagem vai para o rótulo
 * da aba; ao corrigir à mão a análise se refaz e o item some. Aqui: a lista, a contagem, o callback com o quadro certo e a integração com a tela de vídeo.
 */

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock('@/lib/pdf/entrega', () => ({ entregarPdf: vi.fn(), baixarBlob: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: null, profile: null }) }));
vi.mock('@/lib/dosagem/db', () => ({ tabela: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/utils/pdfBranding', () => ({ carregarBrandingClinica: async () => ({}) }));
vi.mock('@/lib/angular/analiseVideo/rascunho', () => ({ apagarRascunho: async () => true, lerRascunho: async () => null, salvarRascunho: async () => true }));
const mocks = vi.hoisted(() => ({ ler: vi.fn() }));
vi.mock('@/lib/angular/analiseVideo/carregarVideo', async (original) => ({
  ...(await original<typeof import('@/lib/angular/analiseVideo/carregarVideo')>()),
  lerMetadadosDoVideo: mocks.ler,
  estimarFps: async () => null,
}));

const { default: AnaliseVideo } = await import('../components/angular/video/AnaliseVideo');

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// O joelho esquerdo some no ponto mais baixo da repetição 2 (5,3 a 5,75 s): quadros 161 a 173 da trilha.
const perdidos = (_i: number, t: number) => (t > 5.3 && t < 5.75 ? ['joelho_e'] : false);
const inteira = (): TrilhaPose => trilhaAgachamentoLateral({ ruidoPx: 0.6 });
const comPerda = (): TrilhaPose => trilhaAgachamentoLateral({ ruidoPx: 0.6, perdidos });
const protocolo = protocoloDo('agachamento_lateral');

/** O profissional marca o ponto no primeiro e no último quadro sem ponto (e no meio), na posição que ele tinha na figura sem perda. */
function corrigida(): TrilhaPose {
  const ref = inteira();
  let t = comPerda();
  for (const i of [160, 166, 172]) {
    const p = ref.quadros[i].pontos.joelho_e;
    t = corrigirPonto(t, i, 'joelho_e', { x: p.x, y: p.y });
  }
  return t;
}

const analiseDe = (t: TrilhaPose) => analisarMovimento('agachamento_lateral', t);

describe('seção "Pontos a conferir"', () => {
  it('lista o ponto, o trecho sem ponto e as medidas sem valor, agrupados por repetição, com a contagem no título', () => {
    render(<PontosAConferir pontosPerdidos={analiseDe(comPerda()).pontosPerdidos} protocolo={protocolo} aoIrAoQuadro={vi.fn()} />);
    const secao = screen.getByTestId('pontos-a-conferir');
    expect(within(secao).getByRole('heading', { level: 3 })).toHaveTextContent('Pontos a conferir (1)');
    const grupo = within(secao).getByTestId('pontos-repeticao-2');
    expect(within(grupo).getByRole('heading', { level: 4 })).toHaveTextContent('Repetição 2');
    const itens = within(grupo).getAllByTestId('ponto-a-conferir');
    expect(itens).toHaveLength(1);
    expect(itens[0]).toHaveAttribute('data-ponto', 'joelho_e');
    expect(itens[0]).toHaveTextContent('Joelho esquerdo');
    expect(itens[0]).toHaveTextContent(/Sem ponto confiável em 13 quadros \(quadros 161 a 173\), perto de 5,50 s/);
    const medidas = within(itens[0]).getByTestId('medidas-sem-valor');
    for (const nome of ['Flexão máxima do joelho (lado esquerdo)', 'Flexão máxima do quadril (lado esquerdo)', 'Dorsiflexão máxima do tornozelo (lado esquerdo)', 'Avanço do joelho em relação à ponta do pé (lado esquerdo)']) {
      expect(medidas).toHaveTextContent(nome);
    }
    expect(medidas).not.toHaveTextContent('(lado direito)');
  });

  it('o texto diz o que faltou, onde e o que fazer, sem palavras de julgamento', () => {
    render(<PontosAConferir pontosPerdidos={analiseDe(comPerda()).pontosPerdidos} protocolo={protocolo} aoIrAoQuadro={vi.fn()} />);
    const texto = screen.getByTestId('pontos-a-conferir').textContent ?? '';
    expect(texto).toMatch(/faltou ponto confiável do corpo/);
    expect(texto).toMatch(/nada foi preenchido no lugar/);
    expect(texto).toMatch(/Toque em "Ir ao quadro" e arraste o ponto destacado/);
    fireEvent.click(screen.getByRole('button', { name: 'O ponto falta em vários quadros?' }));
    const aberto = screen.getByTestId('pontos-a-conferir').textContent ?? '';
    expect(aberto).toMatch(/corrija também o primeiro e o último sem ponto/);
    expect(aberto).toMatch(/até 1,5 s/);
    expect(termoProibido(aberto)).toBeNull();
  });

  it('"Ir ao quadro" entrega o quadro do extremo e o ponto; os atalhos levam ao primeiro e ao último quadro sem ponto', () => {
    const analise = analiseDe(comPerda());
    const [item] = agruparItensACorrigir(analise.pontosPerdidos);
    const ir = vi.fn();
    render(<PontosAConferir pontosPerdidos={analise.pontosPerdidos} protocolo={protocolo} aoIrAoQuadro={ir} />);
    fireEvent.click(screen.getByRole('button', { name: `Ir ao quadro ${item.quadro + 1}: Joelho esquerdo, Repetição 2` }));
    expect(ir).toHaveBeenLastCalledWith({ quadro: item.quadro, ponto: 'joelho_e' });
    expect(item.quadro).toBeGreaterThanOrEqual(160);
    expect(item.quadro).toBeLessThanOrEqual(172);
    fireEvent.click(screen.getByTestId('ir-ao-primeiro-sem-ponto'));
    expect(ir).toHaveBeenLastCalledWith({ quadro: 160, ponto: 'joelho_e' });
    fireEvent.click(screen.getByTestId('ir-ao-ultimo-sem-ponto'));
    expect(ir).toHaveBeenLastCalledWith({ quadro: 172, ponto: 'joelho_e' });
    expect(ir).toHaveBeenCalledTimes(3);
  });

  it('sem perda de pontos mostra só uma frase discreta de confirmação', () => {
    render(<PontosAConferir pontosPerdidos={analiseDe(inteira()).pontosPerdidos} protocolo={protocolo} aoIrAoQuadro={vi.fn()} />);
    expect(screen.queryByTestId('pontos-a-conferir')).toBeNull();
    expect(screen.getByTestId('sem-pontos-perdidos')).toHaveTextContent('Nenhuma medida ficou sem valor por pontos perdidos.');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('os botões dizem de qual ponto e repetição falam: dois joelhos no mesmo quadro não geram nomes iguais', () => {
    const doisJoelhos = trilhaAgachamentoLateral({ ruidoPx: 0.6, perdidos: (_i, t) => (t > 5.3 && t < 5.75 ? ['joelho_e', 'joelho_d'] : false) });
    const [direito, esquerdo] = agruparItensACorrigir(analiseDe(doisJoelhos).pontosPerdidos).sort((a, b) => a.ponto.localeCompare(b.ponto));
    expect(direito.ponto).toBe('joelho_d');
    expect(esquerdo.ponto).toBe('joelho_e');
    render(<PontosAConferir pontosPerdidos={analiseDe(doisJoelhos).pontosPerdidos} protocolo={protocolo} aoIrAoQuadro={vi.fn()} />);
    const nomes = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? '');
    expect(nomes).toHaveLength(new Set(nomes).size);
    const ir = screen.getAllByTestId('ir-ao-quadro');
    expect(ir.map((b) => b.getAttribute('aria-label'))).toEqual([
      `Ir ao quadro ${direito.quadro + 1}: Joelho direito, Repetição 2`,
      `Ir ao quadro ${esquerdo.quadro + 1}: Joelho esquerdo, Repetição 2`,
    ]);
    const cartao = (ponto: string) => within(screen.getAllByTestId('ponto-a-conferir').find((c) => c.getAttribute('data-ponto') === ponto) as HTMLElement);
    expect(cartao('joelho_e').getByTestId('ir-ao-ultimo-sem-ponto')).toHaveAccessibleName(`Último quadro sem ponto (${esquerdo.ultimoQuadro + 1}): Joelho esquerdo, Repetição 2`);
    expect(cartao('joelho_d').getByTestId('ir-ao-ultimo-sem-ponto')).toHaveAccessibleName(`Último quadro sem ponto (${direito.ultimoQuadro + 1}): Joelho direito, Repetição 2`);
    // O "Primeiro quadro sem ponto" só aparece quando difere do "Ir ao quadro"; aqui o extremo é o primeiro quadro, então só há o último.
    expect(screen.queryAllByTestId('ir-ao-primeiro-sem-ponto')).toHaveLength(0);
    // O texto visível do botão continua no começo do nome: quem fala o comando visível ("Ir ao quadro 176") é entendido.
    for (const b of ir) expect((b.getAttribute('aria-label') ?? '').startsWith((b.textContent ?? '').trim())).toBe(true);
  });

  it('sem o callback a lista só informa: não há botões', () => {
    render(<PontosAConferir pontosPerdidos={analiseDe(comPerda()).pontosPerdidos} protocolo={protocolo} />);
    expect(screen.getAllByTestId('ponto-a-conferir')).toHaveLength(1);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('dois pontos em repetições diferentes viram dois itens, cada um no grupo da sua repetição', () => {
    const t = trilhaAgachamentoLateral({ ruidoPx: 0.6, perdidos: (_i, s) => ((s > 5.3 && s < 5.75) || (s > 11.3 && s < 11.75) ? ['joelho_e'] : false) });
    render(<PontosAConferir pontosPerdidos={analiseDe(t).pontosPerdidos} protocolo={protocolo} aoIrAoQuadro={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Pontos a conferir (2)');
    expect(within(screen.getByTestId('pontos-repeticao-2')).getAllByTestId('ponto-a-conferir')).toHaveLength(1);
    expect(within(screen.getByTestId('pontos-repeticao-4')).getAllByTestId('ponto-a-conferir')).toHaveLength(1);
  });
});

describe('contagem do rótulo da aba', () => {
  const entrada = (trilha: TrilhaPose | null) => ({ protocolo, trilha, eventos: null, direcao: 1 as const });

  it('conta os pontos a conferir e a frase respeita o singular e o plural', async () => {
    const { result } = renderHook(() => useContagemPontosAConferir(entrada(comPerda())));
    await waitFor(() => expect(result.current).toBe(1));
    expect(fraseContagemPontos(1)).toBe('1 ponto a conferir');
    expect(fraseContagemPontos(3)).toBe('3 pontos a conferir');
  });

  it('é zero sem perda, sem trilha e depois da correção feita à mão', async () => {
    const { result, rerender } = renderHook(({ t }: { t: TrilhaPose | null }) => useContagemPontosAConferir(entrada(t)), { initialProps: { t: comPerda() as TrilhaPose | null } });
    await waitFor(() => expect(result.current).toBe(1));
    rerender({ t: corrigida() });
    await waitFor(() => expect(result.current).toBe(0));
    rerender({ t: comPerda() });
    await waitFor(() => expect(result.current).toBe(1));
    rerender({ t: null });
    await waitFor(() => expect(result.current).toBe(0));
    rerender({ t: inteira() });
    await waitFor(() => expect(result.current).toBe(0));
  });
});

interface TelaProps { trilha: TrilhaPose | null; aoIrAoQuadro?: (alvo: { quadro: number; ponto: string }) => void }

function Tela({ trilha, aoIrAoQuadro }: TelaProps) {
  const estado = useEstadoLaudo('agachamento', 'lateral');
  return (
    <AbaLaudo
      estado={estado} vistaDeclarada="lateral" trilha={trilha} escalaCmPorPixel={null} eventos={null} direcao={1}
      video={{ nome: 'agachamento.mp4', duracaoS: 20, largura: 640, altura: 480 }} quadrosChaveCorrigidos={0} medidasManuaisForaDoTrecho={0}
      data="2026-10-18" aoIrAoQuadro={aoIrAoQuadro}
    />
  );
}

describe('aba Laudo com pontos perdidos', () => {
  it('a seção fica no topo, antes do resumo, e "Ir ao quadro" chama o callback com o quadro certo', () => {
    const ir = vi.fn();
    render(<Tela trilha={comPerda()} aoIrAoQuadro={ir} />);
    const secao = screen.getByTestId('pontos-a-conferir');
    const resumo = screen.getByTestId('resumo-do-laudo');
    expect(secao.compareDocumentPosition(resumo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const [item] = agruparItensACorrigir(analiseDe(comPerda()).pontosPerdidos);
    fireEvent.click(screen.getByTestId('ir-ao-quadro'));
    expect(ir).toHaveBeenCalledWith({ quadro: item.quadro, ponto: 'joelho_e' });
  });

  it('o resumo do laudo diz que medidas ficaram de fora', () => {
    render(<Tela trilha={comPerda()} aoIrAoQuadro={vi.fn()} />);
    expect(screen.getByTestId('resumo-do-laudo')).toHaveTextContent(/4 medidas não foram calculadas por pontos perdidos/);
  });

  it('sem perda mostra a frase de confirmação; ao corrigir à mão a análise se refaz sozinha e o item some', async () => {
    const { rerender } = render(<Tela trilha={comPerda()} aoIrAoQuadro={vi.fn()} />);
    expect(screen.getByTestId('pontos-a-conferir')).toBeInTheDocument();
    expect(screen.queryByTestId('sem-pontos-perdidos')).toBeNull();
    rerender(<Tela trilha={corrigida()} aoIrAoQuadro={vi.fn()} />);
    await waitFor(() => expect(screen.queryByTestId('pontos-a-conferir')).toBeNull());
    expect(screen.getByTestId('sem-pontos-perdidos')).toBeInTheDocument();
    expect(screen.getByTestId('resumo-do-laudo')).not.toHaveTextContent(/pontos perdidos/);
  });

  it('a mesma aba sem perda não traz nenhum botão de correção', () => {
    render(<Tela trilha={inteira()} aoIrAoQuadro={vi.fn()} />);
    expect(screen.queryByTestId('ir-ao-quadro')).toBeNull();
    expect(screen.getByTestId('sem-pontos-perdidos')).toBeInTheDocument();
  });
});

// ---------- integração com a tela de vídeo ----------

const video = (): VideoCarregado => ({ url: 'blob:a', arquivo: new File(['a'], 'agachamento.mp4', { type: 'video/mp4' }), nome: 'agachamento.mp4', tamanho: 5000, duracao: 17, largura: 640, altura: 480 });

function arquivoDaAnalise(trilha: TrilhaPose): File {
  const v = video();
  const texto = serializarAnalise({
    video: { nome: '', tamanho: v.tamanho, duracao: v.duracao, largura: v.largura, altura: v.altura }, modeloId: 'agachamento', fpsVideo: 30,
    intervalo: { inicio: 0, fim: 17 }, trilha, eventos: null, cmPorPx: null, extras: {},
  });
  expect(lerAnaliseSalva(texto).ok).toBe(true);
  return new File([texto], 'analise.json', { type: 'application/json' });
}

async function retomar(trilha: TrilhaPose) {
  render(<AnaliseVideo paciente={null} entrada="gesto" />);
  fireEvent.change(screen.getByTestId('entrada-analise'), { target: { files: [arquivoDaAnalise(trilha)] } });
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Análise aberta/));
  fireEvent.change(screen.getByTestId('entrada-video'), { target: { files: [new File(['a'], 'agachamento.mp4', { type: 'video/mp4' })] } });
  await waitFor(() => expect(screen.getByTestId('analise-video')).toBeInTheDocument());
}

describe('análise em vídeo: da contagem na aba ao quadro com o ponto destacado', () => {
  beforeEach(() => {
    mocks.ler.mockReset();
    mocks.ler.mockImplementation(async () => video());
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: vi.fn() });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: vi.fn(() => 'blob:x') });
    // O jsdom não implementa pause(): ir a um quadro pausa o vídeo e reclamaria a cada chamada.
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  });

  it('o rótulo da aba Laudo (beta) leva a contagem antes mesmo de abrir a aba', async () => {
    await retomar(comPerda());
    await waitFor(() => expect(screen.getByTestId('aba-laudo')).toHaveAccessibleName('Laudo (beta) · 1 ponto a conferir'));
    expect(screen.getByTestId('contagem-pontos-a-conferir')).toHaveTextContent('1');
    expect(screen.getByTestId('aba-metricas')).not.toHaveAttribute('aria-label');
  });

  it('sem perda de pontos o rótulo continua "Laudo (beta)" e não há contagem', async () => {
    await retomar(inteira());
    fireEvent.click(screen.getByTestId('aba-laudo'));
    await screen.findByTestId('laudo-calculado');
    expect(screen.getByTestId('aba-laudo')).toHaveAccessibleName('Laudo (beta)');
    expect(screen.queryByTestId('contagem-pontos-a-conferir')).toBeNull();
    expect(screen.getByTestId('sem-pontos-perdidos')).toBeInTheDocument();
  });

  it('"Ir ao quadro" leva o player ao quadro do extremo e destaca o ponto para o profissional arrastar', async () => {
    await retomar(comPerda());
    fireEvent.click(screen.getByTestId('aba-laudo'));
    const botao = await screen.findByTestId('ir-ao-quadro');
    const [item] = agruparItensACorrigir(analiseDe(comPerda()).pontosPerdidos);
    expect(screen.queryByTestId('destaque-do-ponto')).toBeNull();
    fireEvent.click(botao);
    await waitFor(() => expect(screen.getByTestId('posicao-quadro')).toHaveTextContent(new RegExp(`^Quadro ${item.quadro + 1} de `)));
    // O ponto não foi detectado nesse quadro: a alça tracejada (sugestão) leva o anel de destaque, e o aviso do player diz o que fazer.
    expect(await screen.findByTestId('alca-fantasma-joelho_e')).toBeInTheDocument();
    expect(screen.getByTestId('destaque-do-ponto')).toBeInTheDocument();
    expect(within(screen.getByTestId('player-quadros')).getByRole('status')).toHaveTextContent(/Corrija joelho esquerdo \(anel laranja\)/);

    fireEvent.click(screen.getByTestId('ir-ao-primeiro-sem-ponto'));
    await waitFor(() => expect(screen.getByTestId('posicao-quadro')).toHaveTextContent(/^Quadro 161 de /));
    expect(screen.getByTestId('destaque-do-ponto')).toBeInTheDocument();
  });

  it('o ponto destacado some do player quando o profissional vai para outro quadro', async () => {
    await retomar(comPerda());
    fireEvent.click(screen.getByTestId('aba-laudo'));
    fireEvent.click(await screen.findByTestId('ir-ao-quadro'));
    await screen.findByTestId('destaque-do-ponto');
    fireEvent.click(screen.getByRole('button', { name: 'Voltar 10 quadros' }));
    await waitFor(() => expect(screen.queryByTestId('destaque-do-ponto')).toBeNull());
  });
});

// ---------- buraco longo: o quadro de destino precisa de alça ----------

// O joelho esquerdo some de 4,7 a 7,3 s (77 quadros): o extremo da repetição 2 fica a mais de 15 quadros de qualquer quadro com o ponto.
const buracoLongo = (): TrilhaPose => trilhaAgachamentoLateral({ ruidoPx: 0.6, perdidos: (_i, t) => (t > 4.7 && t < 7.3 ? ['joelho_e'] : false) });
const nuncaDetectado = (): TrilhaPose => trilhaAgachamentoLateral({ ruidoPx: 0.6, perdidos: () => ['joelho_e'] });

describe('alça do ponto no quadro de "Ir ao quadro", mesmo num buraco longo', () => {
  it('a janela de 15 quadros não alcança o extremo, mas a sugestão para a correção usa o quadro mais perto com o ponto', () => {
    const t = buracoLongo();
    const [item] = agruparItensACorrigir(analiseDe(t).pontosPerdidos);
    expect(item.quadrosSemPonto).toBeGreaterThan(60);
    expect(sugestoesDePontosAusentes(t, item.quadro, ['joelho_e'])).toEqual({});
    const s = sugestaoParaCorrecao(t, item.quadro, 'joelho_e');
    expect(s).not.toBeNull();
    const vizinho = t.quadros[item.primeiroQuadro - 1].pontos.joelho_e;
    expect(vizinho).toBeDefined();
    const dist = (q: number): number => Math.abs(q - item.quadro);
    const maisPerto = dist(item.primeiroQuadro - 1) <= dist(item.ultimoQuadro + 1) ? item.primeiroQuadro - 1 : item.ultimoQuadro + 1;
    expect(s?.x).toBeCloseTo(t.quadros[maisPerto].pontos.joelho_e.x, 6);
    expect(s?.y).toBeCloseTo(t.quadros[maisPerto].pontos.joelho_e.y, 6);
  });

  it('depois de corrigir só o primeiro e o último quadro o item continua, e o quadro de destino continua com alça', () => {
    const ref = inteira();
    const [antes] = agruparItensACorrigir(analiseDe(buracoLongo()).pontosPerdidos);
    let t = buracoLongo();
    for (const i of [antes.primeiroQuadro, antes.ultimoQuadro]) {
      const p = ref.quadros[i].pontos.joelho_e;
      t = corrigirPonto(t, i, 'joelho_e', { x: p.x, y: p.y });
    }
    const itens = agruparItensACorrigir(analiseDe(t).pontosPerdidos);
    expect(itens).toHaveLength(1);
    expect(sugestoesDePontosAusentes(t, itens[0].quadro, ['joelho_e'])).toEqual({});
    expect(sugestaoParaCorrecao(t, itens[0].quadro, 'joelho_e')).not.toBeNull();
  });

  it('ponto que nunca foi detectado começa na média dos pontos ligados a ele no quadro; nada é gravado na trilha', () => {
    const t = nuncaDetectado();
    const [item] = agruparItensACorrigir(analiseDe(t).pontosPerdidos);
    expect(t.quadros.every((q) => q.pontos.joelho_e === undefined)).toBe(true);
    const s = sugestaoParaCorrecao(t, item.quadro, 'joelho_e');
    const { quadril_e: h, tornozelo_e: a } = t.quadros[item.quadro].pontos;
    expect(s?.x).toBeCloseTo((h.x + a.x) / 2, 6);
    expect(s?.y).toBeCloseTo((h.y + a.y) / 2, 6);
    expect(t.quadros.every((q) => q.pontos.joelho_e === undefined)).toBe(true);
  });

  it('não sugere nada quando o ponto já é utilizável no quadro, quando o quadro não existe ou quando não há referência', () => {
    const t = inteira();
    expect(sugestaoParaCorrecao(t, 100, 'joelho_e')).toBeNull();
    expect(sugestaoParaCorrecao(t, 9999, 'joelho_e')).toBeNull();
    const vazio: TrilhaPose = { ...t, quadros: t.quadros.map((q) => ({ ...q, pontos: {} })) };
    expect(sugestaoParaCorrecao(vazio, 100, 'joelho_e')).toBeNull();
  });
});

describe('análise em vídeo: buraco longo', () => {
  beforeEach(() => {
    mocks.ler.mockReset();
    mocks.ler.mockImplementation(async () => video());
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: vi.fn() });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: vi.fn(() => 'blob:x') });
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  });

  it('"Ir ao quadro" no meio do buraco mostra a alça tracejada e o anel, e o aviso fala em anel laranja só porque ele existe', async () => {
    await retomar(buracoLongo());
    fireEvent.click(screen.getByTestId('aba-laudo'));
    const botao = await screen.findByTestId('ir-ao-quadro');
    const [item] = agruparItensACorrigir(analiseDe(buracoLongo()).pontosPerdidos);
    fireEvent.click(botao);
    await waitFor(() => expect(screen.getByTestId('posicao-quadro')).toHaveTextContent(new RegExp(`^Quadro ${item.quadro + 1} de `)));
    expect(await screen.findByTestId('alca-fantasma-joelho_e')).toBeInTheDocument();
    expect(screen.getByTestId('destaque-do-ponto')).toBeInTheDocument();
    expect(within(screen.getByTestId('player-quadros')).getByRole('status')).toHaveTextContent(/Corrija joelho esquerdo \(anel laranja\)/);
  });

  it('ponto nunca detectado: "Ir ao quadro" também leva uma alça para o profissional arrastar', async () => {
    await retomar(nuncaDetectado());
    fireEvent.click(screen.getByTestId('aba-laudo'));
    fireEvent.click((await screen.findAllByTestId('ir-ao-quadro'))[0]);
    expect(await screen.findByTestId('alca-fantasma-joelho_e')).toBeInTheDocument();
    expect(screen.getByTestId('destaque-do-ponto')).toBeInTheDocument();
  });
});
