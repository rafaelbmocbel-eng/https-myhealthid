import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { criarBancoFalso, type BancoFalso } from './helpers/bancoFalso';
import type { Landmark } from '@/lib/angular/pose';

const h = vi.hoisted(() => ({
  banco: null as unknown as BancoFalso,
  sucesso: vi.fn(),
  erro: vi.fn(),
  aviso: vi.fn(),
  info: vi.fn(),
  detectar: vi.fn(),
  preparar: vi.fn(),
  gerarSessao: vi.fn(),
  gerarPosicao: vi.fn(),
  entregar: vi.fn(),
  corpo: null as null | Landmark[],
  limites: [] as number[],
  perderRespostaDoInsert: false,
  rlsBloqueiaUpdate: false,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (t: string) => {
      const q = h.banco.from(t) as { limit: (n: number) => unknown; insert: (p: unknown) => unknown; update: (p: unknown) => unknown; then: PromiseLike<unknown>['then'] };
      const original = q.limit.bind(q);
      q.limit = (n: number) => { h.limites.push(n); return original(n); };
      // O banco falso não tem chave primária nem RLS: aqui o insert repetido dá 23505 e o insert pode gravar e perder a resposta.
      const inserir = q.insert.bind(q);
      q.insert = (p: unknown) => {
        inserir(p);
        const executar = q.then.bind(q);
        q.then = ((ok: never, falha: never) => {
          const linhas = (h.banco.tabelas[t] ?? []) as { id?: string }[];
          const id = (p as { id?: string }).id;
          if (id && linhas.some((l) => l.id === id)) {
            h.banco.operacoes.push({ tabela: t, tipo: 'insert', payload: p, filtros: [] });
            return Promise.resolve({ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "notas_prontuario_pkey"' } }).then(ok, falha);
          }
          const perderResposta = (r: unknown) => {
            if (!h.perderRespostaDoInsert) return r;
            h.perderRespostaDoInsert = false;
            return { data: null, error: { message: 'Failed to fetch' } };
          };
          return executar(perderResposta as never).then(ok, falha);
        }) as typeof q.then;
        return q;
      };
      const atualizar = q.update.bind(q);
      q.update = (p: unknown) => {
        atualizar(p);
        if (h.rlsBloqueiaUpdate) {
          q.then = ((ok: never, falha: never) => {
            h.banco.operacoes.push({ tabela: t, tipo: 'update', payload: p, filtros: [] });
            return Promise.resolve({ data: [], error: null }).then(ok, falha);
          }) as typeof q.then;
        }
        return q;
      };
      return q;
    },
    rpc: (n: string, a?: Record<string, unknown>) => h.banco.rpc(n, a),
  },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'prof-1' }, profile: { nome: 'Rafael', sobrenome: 'Lima', crefito: '1234-F' } }) }));
vi.mock('@/components/AppLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/hooks/useProntuarioSeguranca', () => {
  const lista = [{ id: 'p1', nome: 'Mateus', sobrenome: 'Souza' }, { id: 'p2', nome: 'Ana', sobrenome: 'Lima' }];
  return {
    usePacientesLista: () => ({ data: lista }),
    usePacienteDosagem: (id: string | null) => ({ data: lista.find((p) => p.id === id) }),
  };
});
vi.mock('@/components/paciente/PacienteSelect', () => ({
  PacienteSelect: ({ pacientes, value, onValueChange }: { pacientes: { id: string; nome: string }[]; value: string; onValueChange: (v: string) => void }) => (
    <select aria-label="Paciente" value={value} onChange={(e) => onValueChange(e.target.value)}>
      <option value="">Nenhum</option>
      {pacientes.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
    </select>
  ),
}));
vi.mock('@/components/angular/MarchaVideo', () => ({ default: () => null }));
vi.mock('@/components/angular/PontoAPontoVideo', () => ({ default: () => null }));
vi.mock('@/components/angular/ExportarSocialDialog', () => ({
  default: (p: { aberto: boolean; arte: { medidas: { nome: string; valor: string }[] } | null; landmarks?: unknown[] }) => (p.aberto
    ? <div data-testid="arte-aberta">{p.arte?.medidas.map((m) => `${m.nome}=${m.valor}`).join('|')}#{p.landmarks?.length}</div>
    : null),
}));
vi.mock('@/components/angular/CameraNivel', () => ({
  default: (p: { posicao?: string; instrucao?: string; progresso?: string; ultima?: string; onCapturar: (f: File, i: number | null) => void; onPular?: () => void; onFechar: () => void }) => (
    <div role="dialog" aria-label="Câmera falsa">
      <p data-testid="camera-titulo">{p.progresso ?? 'avulsa'}: {p.posicao}</p>
      <p data-testid="camera-instrucao">{p.instrucao}</p>
      {p.ultima && <p data-testid="camera-ultima">{p.ultima}</p>}
      <button type="button" onClick={() => p.onCapturar(new File(['x'], 'c.jpg', { type: 'image/jpeg' }), 2)}>Capturar</button>
      {p.onPular && <button type="button" onClick={p.onPular}>Pular na câmera</button>}
      <button type="button" onClick={p.onFechar}>Fechar a câmera</button>
    </div>
  ),
}));
vi.mock('@/lib/angular/detector', () => ({ detectarPose: (...a: unknown[]) => h.detectar(...a) }));
vi.mock('@/lib/angular/fotoSessao', async (original) => ({ ...(await original<typeof import('@/lib/angular/fotoSessao')>()), prepararFoto: (...a: unknown[]) => h.preparar(...a) }));
vi.mock('sonner', () => ({ toast: { success: h.sucesso, error: h.erro, warning: h.aviso, info: h.info } }));
vi.mock('@/lib/pdf/entrega', async (original) => ({ ...(await original<typeof import('@/lib/pdf/entrega')>()), entregarPdf: (...a: unknown[]) => h.entregar(...a) }));
vi.mock('@/lib/angular/relatorioSessao', async (original) => ({ ...(await original<typeof import('@/lib/angular/relatorioSessao')>()), gerarRelatorioSessao: (...a: unknown[]) => h.gerarSessao(...a) }));
vi.mock('@/lib/angular/relatorio', async (original) => ({ ...(await original<typeof import('@/lib/angular/relatorio')>()), gerarRelatorioAngular: (...a: unknown[]) => h.gerarPosicao(...a) }));

import AnaliseAngular from '@/pages/AnaliseAngular';
import { LIMITE_DO_HISTORICO } from '@/hooks/useSessaoDoPaciente';

// ---------------------------------------------------------------------------
// Corpos de teste (pontos do modelo em 0 a 1, com a foto falsa de 1000 x 1500 px). Valores escolhidos para dar contas fáceis à mão.
// ---------------------------------------------------------------------------

const L = (x: number, y: number, visibility = 0.9): Landmark => ({ x, y, visibility });
const base = (): Landmark[] => Array.from({ length: 33 }, () => L(0.5, 0.5));

// De frente o lado direito do paciente aparece à ESQUERDA da imagem. Ombro D em (400, 450) px e E em (600, 480): 30 px em 200 px = 8,5°, direito mais alto.
const corpoFrente = (): Landmark[] => {
  const lm = base();
  lm[0] = L(0.5, 0.12);
  lm[7] = L(0.53, 0.1); lm[8] = L(0.47, 0.1);
  lm[11] = L(0.6, 0.32); lm[12] = L(0.4, 0.3);
  lm[13] = L(0.65, 0.45); lm[14] = L(0.35, 0.45);
  lm[15] = L(0.67, 0.6); lm[16] = L(0.33, 0.6);
  lm[23] = L(0.56, 0.55); lm[24] = L(0.44, 0.55);
  lm[25] = L(0.55, 0.72); lm[26] = L(0.45, 0.72);
  lm[27] = L(0.55, 0.92); lm[28] = L(0.45, 0.92);
  return lm;
};

// O modelo trocou direito e esquerdo em todos os pares: o ombro e o quadril "direitos" (12 e 24) caíram à direita da imagem.
const corpoFrenteTrocado = (): Landmark[] => {
  const lm = corpoFrente();
  for (const [e, d] of [[7, 8], [11, 12], [13, 14], [15, 16], [23, 24], [25, 26], [27, 28]]) [lm[e], lm[d]] = [lm[d], lm[e]];
  return lm;
};

// Só o lado fotografado aparece (visibilidade alta); o outro lado do corpo fica atrás.
const corpoPerfil = (lado: 'D' | 'E'): Landmark[] => {
  const lm: Landmark[] = base().map((p) => ({ ...p, visibility: 0.1 }));
  const i = lado === 'D' ? { orelha: 8, ombro: 12, cotovelo: 14, punho: 16, quadril: 24, joelho: 26, tornozelo: 28 } : { orelha: 7, ombro: 11, cotovelo: 13, punho: 15, quadril: 23, joelho: 25, tornozelo: 27 };
  const olhaPara = lado === 'D' ? 1 : -1;
  lm[0] = L(0.5 + 0.04 * olhaPara, 0.12);
  lm[i.orelha] = L(0.5, 0.1); lm[i.ombro] = L(0.5, 0.3); lm[i.cotovelo] = L(0.52, 0.45); lm[i.punho] = L(0.55, 0.6);
  lm[i.quadril] = L(0.5, 0.55); lm[i.joelho] = L(0.52, 0.73); lm[i.tornozelo] = L(0.5, 0.92);
  return lm;
};

// ---------------------------------------------------------------------------
// Ajuda
// ---------------------------------------------------------------------------

vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
Element.prototype.scrollIntoView = vi.fn();
// O jsdom não tem as URLs de objeto: a tela as revoga ao trocar de foto e ao sair.
Object.assign(URL, { createObjectURL: () => 'blob:teste', revokeObjectURL: () => {} });

const ctxFalso = () => new Proxy({ measureText: () => ({ width: 10 }) } as Record<string, unknown>, { get: (t, p: string) => (p in t ? t[p] : () => undefined), set: () => true });

// Troca o paciente da URL sem passar pelo seletor (como o botão voltar do navegador).
function IrParaOutroPaciente() {
  const navegar = useNavigate();
  return (
    <>
      <button type="button" onClick={() => navegar('/analise-angular?paciente=p2&modo=livre', { replace: true })}>mudar a URL para p2</button>
      <button type="button" onClick={() => navegar('/analise-angular?modo=livre', { replace: true })}>tirar o paciente da URL</button>
    </>
  );
}

function renderizar(paciente = '', notas: Record<string, unknown>[] = [], modo = 'livre') {
  h.banco = criarBancoFalso({ notas_prontuario: notas as never });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const consulta = [paciente ? `paciente=${paciente}` : '', modo ? `modo=${modo}` : ''].filter(Boolean).join('&');
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[`/analise-angular${consulta ? `?${consulta}` : ''}`]}><AnaliseAngular /><IrParaOutroPaciente /></MemoryRouter>
    </QueryClientProvider>,
  );
}

const arquivo = () => new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
const aba = (nome: RegExp) => screen.getByRole('tab', { name: nome });
const estadoDaAba = (nome: RegExp) => aba(nome).getAttribute('data-estado');
const notasGravadas = () => (h.banco.tabelas.notas_prontuario ?? []) as Record<string, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
const operacoes = (tipo: string) => h.banco.operacoes.filter((o) => o.tabela === 'notas_prontuario' && o.tipo === tipo);

/** Escolhe a foto da posição que está na tela (ainda sem foto) e espera o modelo terminar de sugerir. */
async function carregarFoto(corpo: Landmark[] | null = corpoFrente()) {
  h.corpo = corpo;
  const antes = h.preparar.mock.calls.length;
  fireEvent.change(screen.getByLabelText(/Escolher a foto:/), { target: { files: [arquivo()] } });
  await waitFor(() => expect(h.preparar.mock.calls.length).toBe(antes + 1));
  await waitFor(() => expect(screen.getByTestId('avisos-marcacao')).toBeInTheDocument());
}

const entradaTrocarFoto = () => document.querySelector('label[aria-label="Trocar a foto"] input') as HTMLInputElement;
const textoDaLista = () => screen.getByText('Resultado', { selector: 'p' }).closest('div')!.textContent ?? '';

// Gestos: o jsdom não tem PointerEvent, DOMPoint nem a matriz do SVG. A conta é a identidade: o clique cai no ponto da foto de mesmo (x, y).
function prepararGestos() {
  class PointerEventFalso extends MouseEvent {
    pointerId: number;
    constructor(tipo: string, init: MouseEventInit & { pointerId?: number } = {}) { super(tipo, init); this.pointerId = init.pointerId ?? 1; }
  }
  vi.stubGlobal('PointerEvent', PointerEventFalso);
  vi.stubGlobal('DOMPoint', class { x: number; y: number; constructor(x = 0, y = 0) { this.x = x; this.y = y; } matrixTransform() { return { x: this.x, y: this.y }; } });
  (SVGElement.prototype as unknown as { getScreenCTM: () => unknown }).getScreenCTM = () => ({ inverse: () => ({}) });
  (Element.prototype as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};
}
const svgDaFoto = () => document.querySelector('svg[viewBox="0 0 1000 1500"]') as SVGSVGElement;
const tocar = (x: number, y: number) => {
  fireEvent.pointerDown(svgDaFoto(), { clientX: x, clientY: y, pointerId: 1 });
  fireEvent.pointerUp(svgDaFoto(), { clientX: x, clientY: y, pointerId: 1 });
};

// Arrasta o primeiro ponto sugerido (como o dedo do profissional): a posição deixa de estar salva.
function arrastarUmPonto() {
  const ponto = svgDaFoto().querySelector('g[style*="cursor: move"]')!;
  fireEvent.pointerDown(ponto, { clientX: 410, clientY: 460, pointerId: 1 });
  fireEvent.pointerMove(svgDaFoto(), { clientX: 450, clientY: 470, pointerId: 1 });
  fireEvent.pointerUp(svgDaFoto(), { clientX: 450, clientY: 470, pointerId: 1 });
}

// Segura toda escrita no banco até liberar() (rede lenta): dá tempo de mexer na tela com o salvamento em voo.
function segurarEscrita() {
  let liberar: () => void = () => {};
  const portao = new Promise<void>((ok) => { liberar = ok; });
  let preso = false;
  h.banco.antesDeEscrever(async () => { preso = true; await portao; });
  return { liberar: () => liberar(), estaPreso: () => preso };
}

const apagarNota = async (id: string) => {
  await (h.banco.from('notas_prontuario') as unknown as { delete: () => { eq: (c: string, v: string) => PromiseLike<unknown> } }).delete().eq('id', id);
};
const idsDosInserts = () => operacoes('insert').map((o) => (o.payload as { id: string }).id);
const fecharAPagina = () => { const ev = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(ev); return ev.defaultPrevented; };

beforeEach(() => {
  h.sucesso.mockReset(); h.erro.mockReset(); h.aviso.mockReset(); h.info.mockReset(); h.entregar.mockReset(); h.limites = []; h.perderRespostaDoInsert = false; h.rlsBloqueiaUpdate = false;
  h.corpo = corpoFrente();
  let n = 0;
  h.preparar.mockReset().mockImplementation(async () => ({ url: `blob:foto-${++n}`, w: 1000, h: 1500, img: document.createElement('img') }));
  h.detectar.mockReset().mockImplementation(async () => h.corpo);
  h.gerarSessao.mockReset().mockResolvedValue({ blob: new Blob(['pdf']), nome: 'Analise_angular_sessao_MATEUS.pdf' });
  h.gerarPosicao.mockReset().mockResolvedValue({ blob: new Blob(['pdf']), nome: 'Analise_angular_MATEUS.pdf' });
  localStorage.clear();
  // O jsdom não desenha: sem contexto, a foto marcada para o PDF fica de fora (os testes de PDF com foto trocam isto).
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });


// ---------------------------------------------------------------------------
// Ajuda da análise livre
// ---------------------------------------------------------------------------

const NOME = 'elevação do braço direito';
const abrirLivre = () => fireEvent.click(aba(/Análise livre/));
const campoNome = () => screen.getByLabelText(/O que você está analisando\?/) as HTMLInputElement;
const escreverNome = (nome: string) => fireEvent.change(campoNome(), { target: { value: nome } });
const coluna = () => within(screen.getByRole('navigation', { name: 'Ferramentas de medida' }));
const ferramenta = (nome: string) => fireEvent.click(coluna().getByRole('button', { name: nome }));
const resultadoLivre = () => screen.getByTestId('resultado-livre').textContent ?? '';
const salvarLivre = () => screen.getByTestId('salvar-livre');
const novaAnaliseLivre = () => screen.getByTestId('nova-analise-livre');

/** Escolhe a foto da análise livre e espera o editor aparecer. Nenhuma marcação automática roda. */
async function carregarFotoLivre() {
  const antes = h.preparar.mock.calls.length;
  fireEvent.change(screen.getByLabelText('Escolher a foto da análise livre'), { target: { files: [arquivo()] } });
  await waitFor(() => expect(h.preparar.mock.calls.length).toBe(antes + 1));
  await waitFor(() => expect(svgDaFoto()).not.toBeNull());
}

// Duas retas: uma horizontal e outra a 45°. O ângulo entre elas é 45°.
const PONTOS_COBB: [number, number][] = [[100, 100], [300, 100], [100, 300], [300, 500]];
function marcarCobb() {
  prepararGestos();
  ferramenta('Ângulo entre retas (tipo Cobb)');
  for (const [x, y] of PONTOS_COBB) tocar(x, y);
}

async function salvarAnalise() {
  fireEvent.click(salvarLivre());
  await waitFor(() => expect(screen.getByTestId('livre-salva')).toBeInTheDocument());
}

/** Livre com foto, nome e a medida tipo Cobb pronta. */
async function prepararAnaliseLivre(paciente = 'p1', nome = NOME, notas: Record<string, unknown>[] = []) {
  renderizar(paciente, notas);
  await carregarFotoLivre();
  if (nome) escreverNome(nome);
  marcarCobb();
}

async function confirmarDialogo(botao: string) {
  fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: botao }));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
}

beforeEach(() => {
  h.sucesso.mockReset(); h.erro.mockReset(); h.aviso.mockReset(); h.info.mockReset(); h.entregar.mockReset(); h.limites = []; h.perderRespostaDoInsert = false; h.rlsBloqueiaUpdate = false;
  h.corpo = corpoFrente();
  let n = 0;
  h.preparar.mockReset().mockImplementation(async () => ({ url: `blob:foto-${++n}`, w: 1000, h: 1500, img: document.createElement('img') }));
  h.detectar.mockReset().mockImplementation(async () => h.corpo);
  h.gerarSessao.mockReset().mockResolvedValue({ blob: new Blob(['pdf']), nome: 'Analise_angular_sessao_MATEUS.pdf' });
  h.gerarPosicao.mockReset().mockResolvedValue({ blob: new Blob(['pdf']), nome: 'Analise_angular_MATEUS.pdf' });
  localStorage.clear();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe('o terceiro botão do seletor: Análise livre', () => {
  it('o seletor do topo tem Postura em foto, Análise livre e Análise em vídeo, e cada um abre a sua tela', () => {
    renderizar('', [], '');
    const nomes = screen.getAllByRole('tab', { name: /Postura em foto|Análise livre|Análise em vídeo/ }).map((t) => t.textContent?.trim());
    expect(nomes).toEqual(['Postura em foto', 'Análise livre', 'Análise em vídeo']);
    expect(aba(/Postura em foto/)).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('progresso-sessao')).toBeInTheDocument();
    expect(screen.queryByTestId('analise-livre')).toBeNull();

    abrirLivre();
    expect(aba(/Análise livre/)).toHaveAttribute('aria-selected', 'true');
    expect(aba(/Postura em foto/)).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByTestId('analise-livre')).toBeInTheDocument();
    expect(screen.queryByTestId('progresso-sessao')).toBeNull();

    fireEvent.click(aba(/Análise em vídeo/));
    expect(aba(/Análise em vídeo/)).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByTestId('analise-livre')).toBeNull();
    fireEvent.click(aba(/Postura em foto/));
    expect(screen.getByTestId('progresso-sessao')).toBeInTheDocument();
  });

  it('o endereço com modo=livre abre direto na análise livre', () => {
    renderizar();
    expect(aba(/Análise livre/)).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('analise-livre')).toBeInTheDocument();
  });
});

describe('a tela da análise livre não tem nada da sessão da postura', () => {
  it('sem foto: pede uma foto só, com a instrução da livre e a câmera do app; sem abas de posição, pular, resumo nem comparação', () => {
    renderizar('p1');
    expect(screen.getByLabelText('Escolher a foto da análise livre')).toBeInTheDocument();
    expect(screen.getByTestId('instrucao-livre')).toHaveTextContent('Escolha uma foto do movimento ou da postura que quer medir');
    expect(screen.getByRole('button', { name: /Tirar a foto no app/ })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Frente|Perfil direito|Perfil esquerdo|Costas/ })).toBeNull();
    expect(screen.queryByTestId('pular-posicao')).toBeNull();
    expect(screen.queryByRole('button', { name: /Pular posição/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Resumo da sessão/ })).toBeNull();
    expect(screen.queryByTestId('comparar-anterior')).toBeNull();
    expect(screen.queryByTestId('abrir-comparador-vazio')).toBeNull();
    expect(screen.queryByText(/Posições da avaliação/)).toBeNull();
  });

  it('com foto: nenhum botão Automático, nenhum aviso de marcação, o modelo de pose não roda e não há "para onde o paciente olha"', async () => {
    renderizar('p1');
    await carregarFotoLivre();
    expect(screen.queryByRole('button', { name: /Automático/ })).toBeNull();
    expect(screen.queryByTestId('avisos-marcacao')).toBeNull();
    expect(screen.queryByTestId('sentido-do-olhar')).toBeNull();
    expect(screen.queryByTestId('comparar-anterior')).toBeNull();
    expect(screen.queryByTestId('abrir-comparador')).toBeNull();
    expect(screen.queryByTestId('salvar-e-proxima')).toBeNull();
    expect(screen.queryByTestId('salvar-posicao')).toBeNull();
    expect(h.detectar).not.toHaveBeenCalled();
  });

  it('mostra só as seis ferramentas livres e as duas referências da foto (nível e escala): nenhuma medida de postura', async () => {
    renderizar('p1');
    await carregarFotoLivre();
    const nomes = coluna().getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(nomes).toEqual([
      'Ângulo livre (3 pontos)', 'Compasso (vértice e dois braços)', 'Compasso com referência', 'Ângulo de uma reta', 'Ângulo entre retas (tipo Cobb)', 'Régua (distância)',
      'Nível (corrigir foto torta)', 'Escala (calibrar em cm)',
    ]);
    expect(within(screen.getByRole('group', { name: 'Ferramentas' })).getAllByRole('button')).toHaveLength(6);
    expect(within(screen.getByRole('group', { name: 'Referências da foto' })).getAllByRole('button')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /Altura do paciente/ })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Postura' })).toBeNull();
    expect(screen.queryByText('Postura', { selector: 'p' })).toBeNull();
    expect(screen.queryByText(/Desnível dos ombros/)).toBeNull();
  });

  it('tem a mesma edição da postura: desfazer, limpar, zoom, mover, grade, estilo, ver só o desenho, baixar imagem, tirar e trocar a foto', async () => {
    renderizar('p1');
    await carregarFotoLivre();
    const barra = within(screen.getByRole('toolbar', { name: 'Ações da foto' }));
    for (const nome of ['Desfazer o último ponto', 'Limpar a medida', 'Diminuir zoom', 'Aumentar zoom', 'Ajustar à tela', 'Mover a foto com um dedo', 'Grade', 'Estilo das linhas', 'Ver só o desenho', 'Baixar imagem', 'Tirar a foto no app']) {
      expect(barra.getByRole('button', { name: nome })).toBeInTheDocument();
    }
    expect(barra.getByLabelText('Trocar a foto')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    fireEvent.click(barra.getByRole('button', { name: 'Aumentar zoom' }));
    expect(screen.getByText('150%')).toBeInTheDocument();
    fireEvent.click(barra.getByRole('button', { name: 'Grade' }));
    expect(barra.getByRole('button', { name: 'Grade' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(barra.getByRole('button', { name: 'Estilo das linhas' }));
    expect(screen.getByText(/Espessura/i)).toBeInTheDocument();
  });
});

describe('coluna de ferramentas', () => {
  const separadores = () => screen.getByRole('navigation', { name: 'Ferramentas de medida' }).querySelectorAll('span.h-px').length;

  it('na livre há um separador, entre as ferramentas e as referências da foto; na postura há dois', async () => {
    renderizar('p1');
    await carregarFotoLivre();
    expect(separadores()).toBe(1);
    fireEvent.click(aba(/Postura em foto/));
    await carregarFoto(corpoFrente());
    expect(separadores()).toBe(2);
  });
});

describe('medir na análise livre', () => {
  it('tipo Cobb: quatro toques dão o ângulo entre as retas e o resultado aparece na tela', async () => {
    await prepararAnaliseLivre();
    expect(resultadoLivre()).toContain('Ângulo entre as duas retas (tipo Cobb): 45,0°.');
    expect(resultadoLivre()).not.toMatch(/normal|alterad|bom|ruim|nota/i);
  });

  it('desfazer tira o último ponto e limpar tira todos os da medida', async () => {
    await prepararAnaliseLivre();
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer o último ponto' }));
    expect(screen.getByText('3/4')).toBeInTheDocument();
    expect(resultadoLivre()).toContain('Complete uma medida para ver o resultado.');
    fireEvent.click(screen.getByRole('button', { name: 'Limpar a medida' }));
    expect(screen.getByText('0/4')).toBeInTheDocument();
  });

  it('escala em cm: calibrar com um objeto de 10 cm e medir com a régua dá a distância em centímetros', async () => {
    renderizar('p1');
    await carregarFotoLivre();
    prepararGestos();
    ferramenta('Escala (calibrar em cm)');
    tocar(100, 100);
    tocar(200, 100);
    fireEvent.change(screen.getByLabelText('Comprimento do objeto em centímetros'), { target: { value: '10' } });
    expect(screen.getByText('Escala pronta: a régua já mede em centímetros.')).toBeInTheDocument();
    ferramenta('Régua (distância)');
    tocar(0, 0);
    tocar(300, 400);
    expect(resultadoLivre()).toContain('Distância: 50,0 cm');
  });

  it('régua sem escala avisa que é preciso calibrar primeiro, e nada é medido', async () => {
    renderizar('p1');
    await carregarFotoLivre();
    prepararGestos();
    ferramenta('Régua (distância)');
    expect(screen.getByText(/Para medir em centímetros, primeiro calibre a escala/)).toBeInTheDocument();
    tocar(0, 0);
    tocar(300, 400);
    expect(resultadoLivre()).toContain('Complete uma medida para ver o resultado.');
  });

  it('nível: duas marcações numa linha reta da foto corrigem o giro (8,5°) e o resultado vem corrigido', async () => {
    renderizar('p1');
    await carregarFotoLivre();
    prepararGestos();
    ferramenta('Nível (corrigir foto torta)');
    tocar(100, 100);
    tocar(300, 130);
    expect(screen.getByText('Foto girada 8,5°: todos os ângulos já saem corrigidos.')).toBeInTheDocument();
    ferramenta('Ângulo de uma reta');
    tocar(100, 500);
    tocar(300, 500);
    expect(resultadoLivre()).toContain('Correção de nível aplicada: 8,5°.');
    expect(resultadoLivre()).toContain('Reta a 8,5° da horizontal');
  });

  it('compasso com referência mostra as quatro direções de referência', async () => {
    renderizar('p1');
    await carregarFotoLivre();
    ferramenta('Compasso com referência');
    const cartao = within(screen.getByTestId('cartao-compasso-ref'));
    for (const nome of ['Vertical para baixo', 'Vertical para cima', 'Horizontal para a esquerda', 'Horizontal para a direita']) expect(cartao.getByRole('button', { name: nome })).toBeInTheDocument();
    fireEvent.click(cartao.getByRole('button', { name: 'Horizontal para a direita' }));
    expect(cartao.getByRole('button', { name: 'Horizontal para a direita' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('zoom, copiar e baixar na análise livre', () => {
  it('o zoom volta ao normal quando a foto é trocada', async () => {
    renderizar('p1');
    await carregarFotoLivre();
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar zoom' }));
    expect(screen.getByText('150%')).toBeInTheDocument();
    fireEvent.change(entradaTrocarFoto(), { target: { files: [arquivo()] } });
    await waitFor(() => expect(document.querySelector('image')?.getAttribute('href')).toBe('blob:foto-2'));
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('Copiar leva o título da análise com o nome e as medidas', async () => {
    const escrever = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: escrever }, configurable: true });
    await prepararAnaliseLivre();
    fireEvent.click(screen.getByRole('button', { name: /Copiar/ }));
    await waitFor(() => expect(escrever).toHaveBeenCalledTimes(1));
    expect(escrever).toHaveBeenCalledWith(`Análise angular — análise livre: ${NOME}\n• Ângulo entre as duas retas (tipo Cobb): 45,0°. Medido na foto sobre as retas marcadas; não substitui o Cobb da radiografia.`);
    expect(h.sucesso).toHaveBeenCalledWith('Resumo copiado.');
  });

  it('Baixar imagem baixa um PNG chamado analise-angular-livre-<data>.png, sem nada do paciente', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctxFalso() as never);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => cb(new Blob(['png'])));
    const nomes: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function baixou(this: HTMLAnchorElement) { nomes.push(this.download); });
    await prepararAnaliseLivre();
    fireEvent.click(screen.getAllByRole('button', { name: /^Baixar imagem$/ })[1]);
    await waitFor(() => expect(nomes).toHaveLength(1));
    expect(nomes[0]).toMatch(/^analise-angular-livre-\d{4}-\d{2}-\d{2}\.png$/);
    expect(h.sucesso).toHaveBeenCalledWith('Imagem baixada com as marcações.');
  });
});

describe('nome da análise', () => {
  it('é um campo opcional "O que você está analisando?", com o exemplo no lugar do texto e limite de 80 caracteres', () => {
    renderizar('p1');
    expect(campoNome()).toHaveAttribute('placeholder', 'elevação do braço direito');
    expect(campoNome()).toHaveAttribute('maxlength', '80');
    expect(within(screen.getByTestId('analise-livre')).getByText('(opcional)')).toBeInTheDocument();
    expect(screen.getByText('0/80')).toBeInTheDocument();
    escreverNome('abdução do ombro');
    expect(campoNome().value).toBe('abdução do ombro');
    expect(screen.getByText('16/80')).toBeInTheDocument();
  });

  it('um nome de mais de 80 caracteres é cortado em 80', () => {
    renderizar('p1');
    escreverNome('n'.repeat(120));
    expect(campoNome().value).toBe('n'.repeat(80));
  });

  it('o nome aparece no cabeçalho do resultado', async () => {
    await prepararAnaliseLivre();
    expect(screen.getByTestId('resultado-livre')).toHaveTextContent(`· ${NOME}`);
  });
});

describe('salvar a análise livre no prontuário', () => {
  it('grava UMA nota: título com o nome, vista livre, esquema 2, sessão de uma posição e só as medidas (nada da foto)', async () => {
    await prepararAnaliseLivre('p1', '  elevação   do braço direito ');
    expect(salvarLivre()).toHaveTextContent('Salvar análise');
    await salvarAnalise();
    expect(notasGravadas()).toHaveLength(1);
    const nota = notasGravadas()[0];
    expect(nota).toMatchObject({ paciente_id: 'p1', terapeuta_id: 'prof-1', tipo: 'analise_angular', titulo: `Análise angular — análise livre: ${NOME}` });
    expect(nota.dados_extras).toMatchObject({
      vista: 'livre', nome_livre: NOME, esquema: 2, metodo: 'marcacao_manual', nivel_graus: null, escala_cm_por_px: null,
      sessao: { ordem: 1, previstas: ['livre'] },
    });
    expect(nota.dados_extras.medidas.map((m: { id: string }) => m.id)).toEqual(['cobb']);
    expect(nota.dados_extras).not.toHaveProperty('lado_perfil');
    expect(nota.dados_extras).not.toHaveProperty('pontos_ajustados');
    expect(nota.referencia_id).toBe(nota.dados_extras.sessao.id);
    expect(nota.descricao).toContain('Pontos marcados manualmente.');
    expect(nota.descricao).not.toMatch(/automática/i);
    expect(JSON.stringify(nota)).not.toContain('blob:');
    expect(h.sucesso).toHaveBeenCalledWith('Análise salva no prontuário de Mateus.');
    expect(salvarLivre()).toHaveTextContent('Atualizar análise');
  });

  it('sem nome grava "Análise angular — análise livre", sem nome_livre', async () => {
    await prepararAnaliseLivre('p1', '');
    await salvarAnalise();
    expect(notasGravadas()[0].titulo).toBe('Análise angular — análise livre');
    expect(notasGravadas()[0].dados_extras).not.toHaveProperty('nome_livre');
  });

  it('salvar de novo ATUALIZA a mesma nota (nunca cria outra), e o botão só diz "salva" depois de gravar', async () => {
    await prepararAnaliseLivre();
    await salvarAnalise();
    const id = notasGravadas()[0].id as string;
    const antes = notasGravadas()[0].dados_extras.medidas[0].graus;

    arrastarUmPonto();
    expect(screen.queryByTestId('livre-salva')).toBeNull();
    expect(screen.getByTestId('livre-alterada')).toBeInTheDocument();
    fireEvent.click(salvarLivre());
    await waitFor(() => expect(screen.getByTestId('livre-salva')).toBeInTheDocument());
    expect(notasGravadas()).toHaveLength(1);
    expect(operacoes('insert')).toHaveLength(1);
    expect(operacoes('update')).toHaveLength(1);
    expect(notasGravadas()[0].id).toBe(id);
    expect(notasGravadas()[0].dados_extras.medidas[0].graus).not.toBe(antes);
    expect(h.sucesso).toHaveBeenLastCalledWith('Análise atualizada no prontuário de Mateus.');
  });

  it('mudar só o nome depois de salvar pede "Atualizar análise" e o título da mesma nota muda', async () => {
    await prepararAnaliseLivre();
    await salvarAnalise();
    escreverNome('flexão do ombro esquerdo');
    expect(screen.queryByTestId('livre-salva')).toBeNull();
    fireEvent.click(salvarLivre());
    await waitFor(() => expect(screen.getByTestId('livre-salva')).toBeInTheDocument());
    expect(notasGravadas()).toHaveLength(1);
    expect(notasGravadas()[0].titulo).toBe('Análise angular — análise livre: flexão do ombro esquerdo');
    expect(notasGravadas()[0].dados_extras.nome_livre).toBe('flexão do ombro esquerdo');
  });

  it('sem paciente, salvar fica desligado com o motivo, mas o resultado e o PDF funcionam', async () => {
    await prepararAnaliseLivre('');
    expect(salvarLivre()).toBeDisabled();
    expect(screen.getByText(/Escolha um paciente no topo para salvar no prontuário/)).toBeInTheDocument();
    expect(resultadoLivre()).toContain('45,0°');
    expect(screen.getByRole('button', { name: /PDF desta análise/ })).toBeEnabled();
  });

  it('sem nenhuma medida pronta, salvar fica desligado e a tela diz o que falta', async () => {
    renderizar('p1');
    await carregarFotoLivre();
    expect(salvarLivre()).toBeDisabled();
    expect(screen.getByText('Complete uma medida para poder salvar.')).toBeInTheDocument();
  });

  it('uma falha ao gravar mostra o erro, não diz que salvou e deixa tentar de novo', async () => {
    await prepararAnaliseLivre();
    h.banco.falharEscritaQuando(() => true, 'sem rede');
    fireEvent.click(salvarLivre());
    await waitFor(() => expect(h.erro).toHaveBeenCalledWith('sem rede'));
    expect(h.sucesso).not.toHaveBeenCalled();
    expect(screen.queryByTestId('livre-salva')).toBeNull();
    expect(notasGravadas()).toHaveLength(0);
    h.banco.falharEscritaQuando(null);
    await salvarAnalise();
    expect(notasGravadas()).toHaveLength(1);
  });

  it('nota excluída no prontuário: "Atualizar" grava a análise de novo com o mesmo id e avisa, em vez de dizer que atualizou', async () => {
    await prepararAnaliseLivre();
    await salvarAnalise();
    const id = notasGravadas()[0].id as string;
    await apagarNota(id);
    expect(notasGravadas()).toHaveLength(0);
    arrastarUmPonto();
    fireEvent.click(salvarLivre());
    await waitFor(() => expect(h.aviso).toHaveBeenCalledWith('A nota anterior desta análise não foi encontrada no prontuário; gravei de novo.'));
    expect(notasGravadas()).toHaveLength(1);
    expect(notasGravadas()[0].id).toBe(id);
    expect(h.sucesso).toHaveBeenCalledTimes(1);
  });

  it('o banco recusa o update de uma nota que existe: não vira "atualizada", não duplica e a tela continua pedindo para salvar', async () => {
    await prepararAnaliseLivre();
    await salvarAnalise();
    h.rlsBloqueiaUpdate = true;
    arrastarUmPonto();
    fireEvent.click(salvarLivre());
    await waitFor(() => expect(h.erro).toHaveBeenCalledWith('Não consegui atualizar esta análise: a nota anterior existe, mas você não pode alterá-la.'));
    expect(h.sucesso).toHaveBeenCalledTimes(1);
    expect(notasGravadas()).toHaveLength(1);
    expect(screen.queryByTestId('livre-salva')).toBeNull();
  });

  it('tocar duas vezes em salvar com a gravação em voo grava uma nota só', async () => {
    await prepararAnaliseLivre();
    const escrita = segurarEscrita();
    fireEvent.click(salvarLivre());
    await waitFor(() => expect(escrita.estaPreso()).toBe(true));
    fireEvent.click(salvarLivre());
    expect(salvarLivre()).toBeDisabled();
    escrita.liberar();
    await waitFor(() => expect(screen.getByTestId('livre-salva')).toBeInTheDocument());
    expect(operacoes('insert')).toHaveLength(1);
  });

  it('ponto arrastado enquanto grava: a nota fica guardada, mas a análise continua "não salva" e pede "Atualizar"', async () => {
    await prepararAnaliseLivre();
    const escrita = segurarEscrita();
    fireEvent.click(salvarLivre());
    await waitFor(() => expect(escrita.estaPreso()).toBe(true));
    arrastarUmPonto();
    escrita.liberar();
    await waitFor(() => expect(notasGravadas()).toHaveLength(1));
    await waitFor(() => expect(salvarLivre()).toHaveTextContent('Atualizar análise'));
    expect(screen.queryByTestId('livre-salva')).toBeNull();
    expect(fecharAPagina()).toBe(true);
    fireEvent.click(salvarLivre());
    await waitFor(() => expect(screen.getByTestId('livre-salva')).toBeInTheDocument());
    expect(operacoes('insert')).toHaveLength(1);
    expect(operacoes('update')).toHaveLength(1);
  });

  it('nome mudado enquanto grava: a nota gravada tem o nome antigo e a análise continua "não salva"', async () => {
    await prepararAnaliseLivre();
    const escrita = segurarEscrita();
    fireEvent.click(salvarLivre());
    await waitFor(() => expect(escrita.estaPreso()).toBe(true));
    escreverNome('outro nome');
    escrita.liberar();
    await waitFor(() => expect(notasGravadas()).toHaveLength(1));
    await waitFor(() => expect(salvarLivre()).toHaveTextContent('Atualizar análise'));
    expect(screen.queryByTestId('livre-salva')).toBeNull();
    expect(notasGravadas()[0].titulo).toBe(`Análise angular — análise livre: ${NOME}`);
  });

  it('análise recomeçada com a gravação em voo: a nota gravada não vai parar na análise nova', async () => {
    await prepararAnaliseLivre();
    const escrita = segurarEscrita();
    fireEvent.click(salvarLivre());
    await waitFor(() => expect(escrita.estaPreso()).toBe(true));
    fireEvent.click(novaAnaliseLivre());
    await confirmarDialogo('Começar nova análise');
    expect(screen.getByLabelText('Escolher a foto da análise livre')).toBeInTheDocument();
    escrita.liberar();
    await waitFor(() => expect(notasGravadas()).toHaveLength(1));
    await waitFor(() => expect(h.sucesso).toHaveBeenCalledWith('Análise salva no prontuário de Mateus.'));
    expect(screen.queryByTestId('livre-salva')).toBeNull();

    await carregarFotoLivre();
    marcarCobb();
    expect(salvarLivre()).toHaveTextContent('Salvar análise');
    fireEvent.click(salvarLivre());
    await waitFor(() => expect(notasGravadas()).toHaveLength(2));
    expect(operacoes('update')).toHaveLength(0);
    expect(notasGravadas()[0].dados_extras.sessao.id).not.toBe(notasGravadas()[1].dados_extras.sessao.id);
  });

  it('o id guardado de uma tentativa que falhou não passa para a análise nova', async () => {
    await prepararAnaliseLivre();
    h.banco.falharEscritaQuando(() => true, 'sem rede');
    fireEvent.click(salvarLivre());
    await waitFor(() => expect(h.erro).toHaveBeenCalledWith('sem rede'));
    const tentado = idsDosInserts();
    h.banco.falharEscritaQuando(null);
    fireEvent.click(novaAnaliseLivre());
    await confirmarDialogo('Começar nova análise');
    await carregarFotoLivre();
    marcarCobb();
    await salvarAnalise();
    expect(notasGravadas()).toHaveLength(1);
    expect(tentado.length).toBeGreaterThan(0);
    expect(notasGravadas()[0].id).not.toBe(tentado[0]);
  });

  it('se a URL mudar de paciente por fora do seletor, a nota já salva nunca é atualizada nem gravada no outro paciente', async () => {
    await prepararAnaliseLivre();
    await salvarAnalise();
    fireEvent.click(screen.getByRole('button', { name: 'mudar a URL para p2' }));
    await waitFor(() => expect(screen.getByText(/Esta análise já foi salva em outro paciente/)).toBeInTheDocument());
    expect(salvarLivre()).toBeDisabled();
    expect(operacoes('insert')).toHaveLength(1);
    expect(operacoes('update')).toHaveLength(0);
  });
});

describe('nova análise livre', () => {
  it('com marcação não salva pergunta antes: cancelar mantém tudo, confirmar esvazia (foto, pontos e nome) e a próxima é outra nota', async () => {
    await prepararAnaliseLivre();
    fireEvent.click(novaAnaliseLivre());
    const pergunta = await screen.findByRole('alertdialog');
    expect(within(pergunta).getByText('Começar uma nova análise livre?')).toBeInTheDocument();
    fireEvent.click(within(pergunta).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(svgDaFoto()).not.toBeNull();
    expect(campoNome().value).toBe(NOME);
    expect(resultadoLivre()).toContain('45,0°');

    fireEvent.click(novaAnaliseLivre());
    await confirmarDialogo('Começar nova análise');
    expect(svgDaFoto()).toBeNull();
    expect(campoNome().value).toBe('');
    expect(screen.getByLabelText('Escolher a foto da análise livre')).toBeInTheDocument();
  });

  it('depois de começar outra, o foco vai para o campo do nome (o botão some e o foco não pode cair no vazio)', async () => {
    await prepararAnaliseLivre();
    await salvarAnalise();
    novaAnaliseLivre().focus();
    fireEvent.click(novaAnaliseLivre());
    expect(screen.queryByTestId('nova-analise-livre')).toBeNull();
    expect(document.activeElement).toBe(campoNome());
  });

  it('com a confirmação, o foco também termina no campo do nome', async () => {
    await prepararAnaliseLivre();
    fireEvent.click(novaAnaliseLivre());
    await confirmarDialogo('Começar nova análise');
    expect(screen.queryByTestId('nova-analise-livre')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(campoNome()));
  });

  it('cancelar a confirmação não muda o foco para o campo do nome', async () => {
    await prepararAnaliseLivre();
    fireEvent.click(novaAnaliseLivre());
    const pergunta = await screen.findByRole('alertdialog');
    fireEvent.click(within(pergunta).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(document.activeElement).not.toBe(campoNome());
    expect(svgDaFoto()).not.toBeNull();
  });

  it('já salva e sem mudança: começa outra sem perguntar, e a nota anterior fica no prontuário', async () => {
    await prepararAnaliseLivre();
    await salvarAnalise();
    fireEvent.click(novaAnaliseLivre());
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(svgDaFoto()).toBeNull();
    expect(notasGravadas()).toHaveLength(1);

    await carregarFotoLivre();
    escreverNome('flexão do joelho');
    marcarCobb();
    expect(salvarLivre()).toHaveTextContent('Salvar análise');
    await salvarAnalise();
    expect(notasGravadas()).toHaveLength(2);
    expect(operacoes('update')).toHaveLength(0);
    expect(notasGravadas()[1].titulo).toBe('Análise angular — análise livre: flexão do joelho');
    expect(notasGravadas()[0].dados_extras.sessao.id).not.toBe(notasGravadas()[1].dados_extras.sessao.id);
  });

  it('não aparece enquanto não há foto nem nome', () => {
    renderizar('p1');
    expect(screen.queryByTestId('nova-analise-livre')).toBeNull();
    escreverNome('algo');
    expect(novaAnaliseLivre()).toBeInTheDocument();
  });
});

describe('foto da análise livre', () => {
  it('trocar a foto de uma análise com pontos pede confirmação; confirmar apaga os pontos e a mesma nota é atualizada ao salvar', async () => {
    await prepararAnaliseLivre();
    await salvarAnalise();
    fireEvent.change(entradaTrocarFoto(), { target: { files: [arquivo()] } });
    const pergunta = await screen.findByRole('alertdialog');
    expect(within(pergunta).getByText('Trocar a foto desta análise?')).toBeInTheDocument();
    expect(h.preparar).toHaveBeenCalledTimes(1);
    fireEvent.click(within(pergunta).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(h.preparar).toHaveBeenCalledTimes(1);

    fireEvent.change(entradaTrocarFoto(), { target: { files: [arquivo()] } });
    await confirmarDialogo('Trocar a foto');
    await waitFor(() => expect(h.preparar).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(document.querySelector('image')?.getAttribute('href')).toBe('blob:foto-2'));
    expect(resultadoLivre()).toContain('Complete uma medida para ver o resultado.');
    marcarCobb();
    expect(salvarLivre()).toHaveTextContent('Atualizar análise');
    fireEvent.click(salvarLivre());
    await waitFor(() => expect(screen.getByTestId('livre-salva')).toBeInTheDocument());
    expect(notasGravadas()).toHaveLength(1);
    expect(operacoes('update')).toHaveLength(1);
  });

  it('arquivo que não é imagem é recusado com aviso', () => {
    renderizar('p1');
    fireEvent.change(screen.getByLabelText('Escolher a foto da análise livre'), { target: { files: [new File(['x'], 'a.pdf', { type: 'application/pdf' })] } });
    expect(h.erro).toHaveBeenCalledWith('Escolha um arquivo de imagem.');
    expect(h.preparar).not.toHaveBeenCalled();
  });

  it('imagem que não abre mostra o aviso e não cria foto', async () => {
    h.preparar.mockReset().mockRejectedValue(new Error('corrompida'));
    renderizar('p1');
    fireEvent.change(screen.getByLabelText('Escolher a foto da análise livre'), { target: { files: [arquivo()] } });
    await waitFor(() => expect(h.erro).toHaveBeenCalledWith('Não consegui abrir essa imagem.'));
    expect(svgDaFoto()).toBeNull();
  });

  it('análise recomeçada antes de a foto ficar pronta: a foto é descartada e a URL revogada', async () => {
    const revogar = vi.spyOn(URL, 'revokeObjectURL');
    renderizar('p1');
    escreverNome('algo');
    let concluir: (f: { url: string; w: number; h: number; img: HTMLImageElement }) => void = () => {};
    h.preparar.mockImplementationOnce(() => new Promise((ok) => { concluir = ok; }));
    fireEvent.change(screen.getByLabelText('Escolher a foto da análise livre'), { target: { files: [arquivo()] } });
    fireEvent.click(novaAnaliseLivre());
    await act(async () => { concluir({ url: 'blob:antiga', w: 1000, h: 1500, img: document.createElement('img') }); });
    expect(svgDaFoto()).toBeNull();
    expect(revogar).toHaveBeenCalledWith('blob:antiga');
  });

  it('página fechada antes de a foto ficar pronta: a URL é revogada', async () => {
    const revogar = vi.spyOn(URL, 'revokeObjectURL');
    const { unmount } = renderizar('p1');
    let concluir: (f: { url: string; w: number; h: number; img: HTMLImageElement }) => void = () => {};
    h.preparar.mockImplementationOnce(() => new Promise((ok) => { concluir = ok; }));
    fireEvent.change(screen.getByLabelText('Escolher a foto da análise livre'), { target: { files: [arquivo()] } });
    unmount();
    await act(async () => { concluir({ url: 'blob:antiga', w: 1000, h: 1500, img: document.createElement('img') }); });
    expect(revogar).toHaveBeenCalledWith('blob:antiga');
  });

  it('a câmera do app abre como foto avulsa da análise livre, a foto entra com a inclinação do celular e a câmera fecha', async () => {
    renderizar('p1');
    fireEvent.click(screen.getByRole('button', { name: /Tirar a foto no app/ }));
    expect(screen.getByTestId('camera-titulo')).toHaveTextContent('avulsa: Análise livre');
    expect(screen.getByTestId('camera-instrucao')).toHaveTextContent('Escolha uma foto do movimento ou da postura que quer medir');
    fireEvent.click(screen.getByRole('button', { name: 'Capturar' }));
    await waitFor(() => expect(svgDaFoto()).not.toBeNull());
    expect(screen.queryByRole('dialog', { name: 'Câmera falsa' })).toBeNull();
    ferramenta('Nível (corrigir foto torta)');
    expect(screen.getByText(/Corrigido automaticamente pelo sensor do celular/)).toBeInTheDocument();
  });

  it('trocar a foto pela câmera com pontos marcados pergunta antes de abrir a câmera', async () => {
    await prepararAnaliseLivre();
    fireEvent.click(within(screen.getByRole('toolbar', { name: 'Ações da foto' })).getByRole('button', { name: 'Tirar a foto no app' }));
    expect(screen.queryByRole('dialog', { name: 'Câmera falsa' })).toBeNull();
    await confirmarDialogo('Tirar outra foto');
    expect(screen.getByRole('dialog', { name: 'Câmera falsa' })).toBeInTheDocument();
  });
});

describe('PDF desta análise', () => {
  it('usa o relatório de uma posição com o nome da análise no lugar da vista, sem comparação, e entrega o PDF', async () => {
    await prepararAnaliseLivre();
    fireEvent.click(screen.getByRole('button', { name: /PDF desta análise/ }));
    await waitFor(() => expect(h.gerarPosicao).toHaveBeenCalledTimes(1));
    const dados = h.gerarPosicao.mock.calls[0][0];
    expect(dados).toMatchObject({
      paciente: 'Mateus Souza', profissional: 'Rafael Lima · CREFITO 1234-F', vistaNome: NOME, tituloDaAnalise: `Análise livre: ${NOME}`, metodo: 'marcacao_manual', anterior: null,
    });
    expect(dados.medidas.map((m: { id: string }) => m.id)).toEqual(['cobb']);
    expect(dados).not.toHaveProperty('pontos');
    expect(dados).not.toHaveProperty('avisos');
    expect(h.gerarSessao).not.toHaveBeenCalled();
    await waitFor(() => expect(h.entregar).toHaveBeenCalledTimes(1));
    expect(h.entregar).toHaveBeenCalledWith(expect.objectContaining({ titulo: 'Análise angular livre', pacienteId: 'p1', nome: 'Analise_angular_MATEUS.pdf' }));
  });

  it('sem nome e sem paciente o PDF sai como "Análise livre" e sem vínculo com o cadastro', async () => {
    await prepararAnaliseLivre('', '');
    fireEvent.click(screen.getByRole('button', { name: /PDF desta análise/ }));
    await waitFor(() => expect(h.gerarPosicao).toHaveBeenCalledTimes(1));
    expect(h.gerarPosicao.mock.calls[0][0]).toMatchObject({ paciente: 'Paciente', vistaNome: 'análise livre', tituloDaAnalise: 'Análise livre' });
    await waitFor(() => expect(h.entregar).toHaveBeenCalledWith(expect.objectContaining({ pacienteId: null })));
  });

  it('o interruptor "Incluir a foto" liga e desliga a foto marcada no PDF', async () => {
    const ctx = ctxFalso();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,AAAA');
    await prepararAnaliseLivre();
    fireEvent.click(screen.getByRole('button', { name: /PDF desta análise/ }));
    await waitFor(() => expect(h.gerarPosicao).toHaveBeenCalledTimes(1));
    expect(h.gerarPosicao.mock.calls[0][0].imagem).toMatchObject({ url: 'data:image/jpeg;base64,AAAA' });

    fireEvent.click(screen.getByLabelText('Incluir a foto com as marcações'));
    fireEvent.click(screen.getByRole('button', { name: /PDF desta análise/ }));
    await waitFor(() => expect(h.gerarPosicao).toHaveBeenCalledTimes(2));
    expect(h.gerarPosicao.mock.calls[1][0].imagem).toBeNull();
  });

  it('sem nenhuma medida pronta o PDF fica desligado', async () => {
    renderizar('p1');
    await carregarFotoLivre();
    expect(screen.getByRole('button', { name: /PDF desta análise/ })).toBeDisabled();
  });
});

describe('o estado da livre é independente do da postura', () => {
  it('trocar entre Postura em foto, Análise livre e Análise em vídeo não perde a foto nem os pontos de nenhum', async () => {
    renderizar('p1', [], '');
    await carregarFoto(corpoFrente());
    expect(textoDaLista()).toContain('Linha dos ombros: 8,5° com a horizontal, lado direito mais alto.');

    abrirLivre();
    await carregarFotoLivre();
    escreverNome(NOME);
    marcarCobb();
    expect(resultadoLivre()).toContain('45,0°');

    fireEvent.click(aba(/Análise em vídeo/));
    fireEvent.click(aba(/Postura em foto/));
    expect(estadoDaAba(/Frente/)).toBe('marcando');
    expect(textoDaLista()).toContain('Linha dos ombros: 8,5° com a horizontal, lado direito mais alto.');
    expect(screen.getByTestId('progresso-sessao')).toHaveTextContent('1 de 4 posições');
    expect(h.detectar).toHaveBeenCalledTimes(1);

    abrirLivre();
    expect(campoNome().value).toBe(NOME);
    expect(resultadoLivre()).toContain('45,0°');
    expect(h.detectar).toHaveBeenCalledTimes(1);
    expect(h.preparar).toHaveBeenCalledTimes(2);
  });

  it('grade e "ver só o desenho" da livre sobrevivem à troca de aba, como na postura', async () => {
    renderizar('p1', [], '');
    abrirLivre();
    await carregarFotoLivre();
    const barra = () => within(screen.getByRole('toolbar', { name: 'Ações da foto' }));
    fireEvent.click(barra().getByRole('button', { name: 'Grade' }));
    fireEvent.click(barra().getByRole('button', { name: 'Ver só o desenho' }));
    expect(barra().getByRole('button', { name: 'Grade' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(aba(/Análise em vídeo/));
    abrirLivre();
    expect(barra().getByRole('button', { name: 'Grade' })).toHaveAttribute('aria-pressed', 'true');
    expect(barra().getByRole('button', { name: 'Ver só o desenho' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('as duas gravam notas separadas: a livre fora da sessão da postura e a postura com as suas quatro posições previstas', async () => {
    renderizar('p1', [], '');
    await carregarFoto(corpoFrente());
    fireEvent.click(screen.getByTestId('salvar-posicao'));
    await waitFor(() => expect(estadoDaAba(/Frente/)).toBe('salva'));
    abrirLivre();
    await carregarFotoLivre();
    marcarCobb();
    await salvarAnalise();
    expect(notasGravadas()).toHaveLength(2);
    const [frente, livre] = notasGravadas();
    expect(frente.titulo).toBe('Análise angular — vista frente');
    expect(frente.dados_extras.sessao.previstas).toEqual(['frente', 'perfil_d', 'perfil_e', 'costas']);
    expect(livre.dados_extras.vista).toBe('livre');
    expect(livre.dados_extras.sessao.previstas).toEqual(['livre']);
    expect(livre.referencia_id).not.toBe(frente.referencia_id);
    fireEvent.click(aba(/Postura em foto/));
    expect(estadoDaAba(/Frente/)).toBe('salva');
    expect(screen.getByTestId('progresso-sessao')).toHaveTextContent('1 de 4 posições');
  });

  it('uma nota livre do paciente nunca vira "avaliação anterior" da postura, nem na posição nem no resumo', async () => {
    const livre = {
      id: 'n-livre', created_at: '2026-03-12T13:05:00.000Z', paciente_id: 'p1', terapeuta_id: 'prof-1', tipo: 'analise_angular', titulo: 'x', descricao: 'x',
      dados_extras: {
        vista: 'livre', nome_livre: NOME, medidas: [{ id: 'cobb', graus: 45, texto: 'Ângulo entre as duas retas (tipo Cobb): 45,0°.' }], metodo: 'marcacao_manual', nivel_graus: null,
        escala_cm_por_px: null, opcoes: {}, esquema: 2, sessao: { id: 's-livre', ordem: 1, previstas: ['livre'], iniciadaEm: '2026-03-12T13:00:00.000Z' },
      },
    };
    renderizar('p1', [livre], '');
    await carregarFoto(corpoFrente());
    const cartao = within(await screen.findByTestId('comparar-anterior'));
    expect(cartao.getByText(/Ainda não há análise angular de frente registrada para este paciente/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Resumo da sessão/ }));
    expect(screen.queryByText(/Comparar com a avaliação anterior/i)).toBeNull();
    expect(screen.queryByText(/12\/03\/2026/)).toBeNull();
  });

  it('a livre também não é afetada pelo histórico da postura: nenhuma comparação aparece nela', async () => {
    const frente = {
      id: 'n-frente', created_at: '2026-03-10T13:05:00.000Z', paciente_id: 'p1', terapeuta_id: 'prof-1', tipo: 'analise_angular', titulo: 'x', descricao: 'x',
      dados_extras: {
        vista: 'frente', medidas: [{ id: 'cobb', graus: 30, texto: 'Ângulo entre as duas retas (tipo Cobb): 30,0°.' }], metodo: 'marcacao_manual', nivel_graus: null,
        escala_cm_por_px: null, opcoes: {}, esquema: 2, sessao: { id: 's-frente', ordem: 1, previstas: ['frente'], iniciadaEm: '2026-03-10T13:00:00.000Z' },
      },
    };
    await prepararAnaliseLivre('p1', NOME, [frente]);
    expect(screen.queryByTestId('comparar-anterior')).toBeNull();
    expect(screen.queryByText(/Antes/)).toBeNull();
  });
});

describe('trocar o paciente com a análise livre em andamento', () => {
  it('pede a mesma confirmação e, ao confirmar, reinicia a livre e a sessão da postura', async () => {
    renderizar('p1', [], '');
    await carregarFoto(corpoFrente());
    abrirLivre();
    await carregarFotoLivre();
    escreverNome(NOME);
    marcarCobb();
    await salvarAnalise();

    fireEvent.change(screen.getByLabelText('Paciente'), { target: { value: 'p2' } });
    const pergunta = await screen.findByRole('alertdialog');
    expect(within(pergunta).getByText('Trocar o paciente?')).toBeInTheDocument();
    expect(pergunta).toHaveTextContent('A sessão de postura e a análise livre em andamento serão reiniciadas');
    fireEvent.click(within(pergunta).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(screen.getByLabelText('Paciente')).toHaveValue('p1');
    expect(resultadoLivre()).toContain('45,0°');

    fireEvent.change(screen.getByLabelText('Paciente'), { target: { value: 'p2' } });
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Trocar e reiniciar' }));
    await waitFor(() => expect(screen.getByLabelText('Paciente')).toHaveValue('p2'));
    expect(screen.getByLabelText('Escolher a foto da análise livre')).toBeInTheDocument();
    expect(campoNome().value).toBe('');
    fireEvent.click(aba(/Postura em foto/));
    expect(estadoDaAba(/Frente/)).toBe('sem_foto');
    expect(screen.getByTestId('progresso-sessao')).toHaveTextContent('0 de 4 posições');
  });

  it('só a livre em andamento: o texto da pergunta fala da análise livre, e a análise nova vai para o outro paciente', async () => {
    await prepararAnaliseLivre();
    await salvarAnalise();
    fireEvent.change(screen.getByLabelText('Paciente'), { target: { value: 'p2' } });
    const pergunta = await screen.findByRole('alertdialog');
    expect(pergunta).toHaveTextContent('A análise livre em andamento será reiniciada');
    fireEvent.click(within(pergunta).getByRole('button', { name: 'Trocar e reiniciar' }));
    await waitFor(() => expect(screen.getByLabelText('Paciente')).toHaveValue('p2'));
    await carregarFotoLivre();
    marcarCobb();
    await salvarAnalise();
    expect(notasGravadas()).toHaveLength(2);
    expect(notasGravadas()[1].paciente_id).toBe('p2');
    expect(operacoes('update')).toHaveLength(0);
  });

  it('com a URL sem paciente e a análise já salva em p1, escolher outro paciente pergunta antes (a nota é de p1)', async () => {
    await prepararAnaliseLivre();
    await salvarAnalise();
    fireEvent.click(screen.getByRole('button', { name: 'tirar o paciente da URL' }));
    await waitFor(() => expect(screen.getByLabelText('Paciente')).toHaveValue(''));
    fireEvent.change(screen.getByLabelText('Paciente'), { target: { value: 'p2' } });
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('A análise livre em andamento será reiniciada');
    expect(screen.getByLabelText('Paciente')).toHaveValue('');
  });

  it('só a postura em andamento: a pergunta continua a de sempre', async () => {
    renderizar('p1', [], '');
    await carregarFoto(corpoFrente());
    fireEvent.click(screen.getByTestId('salvar-posicao'));
    await waitFor(() => expect(estadoDaAba(/Frente/)).toBe('salva'));
    fireEvent.change(screen.getByLabelText('Paciente'), { target: { value: 'p2' } });
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('A sessão em andamento será reiniciada: as fotos e os pontos desta sessão serão descartados. As posições já salvas continuam no prontuário do paciente anterior.');
  });

  it('escolher o primeiro paciente de uma análise livre avulsa não pergunta nem perde a foto', async () => {
    await prepararAnaliseLivre('');
    fireEvent.change(screen.getByLabelText('Paciente'), { target: { value: 'p1' } });
    await waitFor(() => expect(screen.getByLabelText('Paciente')).toHaveValue('p1'));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(resultadoLivre()).toContain('45,0°');
    expect(salvarLivre()).toBeEnabled();
  });

  it('tirar o paciente pede confirmação quando há análise livre em andamento; sem nada a perder, não pergunta', async () => {
    await prepararAnaliseLivre();
    fireEvent.click(screen.getByRole('button', { name: 'Tirar paciente' }));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    cleanup();
    renderizar('p1');
    fireEvent.change(screen.getByLabelText('Paciente'), { target: { value: 'p2' } });
    await waitFor(() => expect(screen.getByLabelText('Paciente')).toHaveValue('p2'));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});

describe('fechar a página com a análise livre', () => {
  it('avisa quando há marcação não salva e deixa de avisar depois de salvar', async () => {
    renderizar('p1');
    expect(fecharAPagina()).toBe(false);
    await carregarFotoLivre();
    expect(fecharAPagina()).toBe(false);
    marcarCobb();
    expect(fecharAPagina()).toBe(true);
    await salvarAnalise();
    expect(fecharAPagina()).toBe(false);
  });
});

describe('baixar para Instagram e imagem na análise livre', () => {
  it('"Baixar para Instagram" abre a arte com as medidas da análise e uma foto sem pontos do modelo', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctxFalso() as never);
    await prepararAnaliseLivre();
    expect(screen.queryByTestId('arte-aberta')).toBeNull();
    fireEvent.click(screen.getByTestId('baixar-instagram-livre'));
    const arte = await screen.findByTestId('arte-aberta');
    expect(arte).toHaveTextContent('Ângulo entre retas (tipo Cobb)=45,0°');
    expect(arte).toHaveTextContent('#1');
  });

  it('os dois botões ficam desligados até haver uma marcação', async () => {
    renderizar('p1');
    await carregarFotoLivre();
    const baixarImagem = () => screen.getAllByRole('button', { name: /^Baixar imagem$/ });
    expect(baixarImagem()).toHaveLength(2);
    expect(screen.getByTestId('baixar-instagram-livre')).toBeDisabled();
    for (const b of baixarImagem()) expect(b).toBeDisabled();
    marcarCobb();
    expect(screen.getByTestId('baixar-instagram-livre')).toBeEnabled();
    for (const b of baixarImagem()) expect(b).toBeEnabled();
  });
});
