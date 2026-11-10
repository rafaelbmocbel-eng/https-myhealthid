import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (t: string) => {
      const q = h.banco.from(t) as { limit: (n: number) => unknown };
      const original = q.limit.bind(q);
      q.limit = (n: number) => { h.limites.push(n); return original(n); };
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
vi.mock('@/components/angular/ExportarSocialDialog', () => ({ default: () => null }));
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
  return <button type="button" onClick={() => navegar('/analise-angular?paciente=p2', { replace: true })}>mudar a URL para p2</button>;
}

function renderizar(paciente = '', notas: Record<string, unknown>[] = []) {
  h.banco = criarBancoFalso({ notas_prontuario: notas as never });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[`/analise-angular${paciente ? `?paciente=${paciente}` : ''}`]}><AnaliseAngular /><IrParaOutroPaciente /></MemoryRouter>
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

beforeEach(() => {
  h.sucesso.mockReset(); h.erro.mockReset(); h.aviso.mockReset(); h.info.mockReset(); h.entregar.mockReset(); h.limites = [];
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
// Testes
// ---------------------------------------------------------------------------

describe('sessão com várias posições', () => {
  it('abre com as quatro posições, a instrução certa em cada uma e nada marcado', () => {
    renderizar();
    for (const nome of [/Frente/, /Perfil direito/, /Perfil esquerdo/, /Costas/]) expect(estadoDaAba(nome)).toBe('sem_foto');
    expect(screen.getByTestId('progresso-sessao')).toHaveTextContent('0 de 4 posições');
    expect(screen.getByTestId('instrucao-posicao')).toHaveTextContent('Peça para ficar de frente para a câmera');
    fireEvent.click(aba(/Perfil direito/));
    expect(screen.getByTestId('instrucao-posicao')).toHaveTextContent('Peça para ficar de perfil, com o lado direito voltado para a câmera.');
    fireEvent.click(aba(/Perfil esquerdo/));
    expect(screen.getByTestId('instrucao-posicao')).toHaveTextContent('Peça para ficar de perfil, com o lado esquerdo voltado para a câmera.');
    fireEvent.click(aba(/Costas/));
    expect(screen.getByTestId('instrucao-posicao')).toHaveTextContent('Peça para ficar de costas para a câmera');
  });

  it('duas posições preenchidas: trocar de aba não perde nada e não roda a marcação automática de novo', async () => {
    renderizar();
    await carregarFoto(corpoFrente());
    expect(h.detectar).toHaveBeenCalledTimes(1);
    expect(textoDaLista()).toContain('Linha dos ombros: 8,5° com a horizontal, lado direito mais alto.');
    expect(estadoDaAba(/Frente/)).toBe('marcando');

    fireEvent.click(aba(/Perfil direito/));
    await carregarFoto(corpoPerfil('D'));
    expect(h.detectar).toHaveBeenCalledTimes(2);
    expect(estadoDaAba(/Perfil direito/)).toBe('marcando');
    expect(screen.getByTestId('progresso-sessao')).toHaveTextContent('2 de 4 posições');

    fireEvent.click(aba(/Frente/));
    expect(textoDaLista()).toContain('Linha dos ombros: 8,5° com a horizontal, lado direito mais alto.');
    fireEvent.click(aba(/Perfil direito/));
    fireEvent.click(aba(/Frente/));
    fireEvent.click(aba(/Costas/));
    expect(estadoDaAba(/Costas/)).toBe('sem_foto');
    expect(h.detectar).toHaveBeenCalledTimes(2);
    expect(estadoDaAba(/Frente/)).toBe('marcando');
    expect(estadoDaAba(/Perfil direito/)).toBe('marcando');
  });

  it('a foto de cada posição é reduzida ao carregar (o arquivo vai para o preparador de fotos)', async () => {
    renderizar();
    await carregarFoto();
    expect(h.preparar).toHaveBeenCalledTimes(1);
    expect((h.preparar.mock.calls[0][0] as File).name).toBe('foto.jpg');
  });

  it('trocar a foto de uma posição com pontos pede confirmação: cancelar mantém tudo, confirmar troca só essa posição', async () => {
    renderizar();
    await carregarFoto();
    fireEvent.click(aba(/Perfil direito/));
    await carregarFoto(corpoPerfil('D'));
    fireEvent.click(aba(/Frente/));

    fireEvent.change(entradaTrocarFoto(), { target: { files: [arquivo()] } });
    const pergunta = await screen.findByRole('alertdialog');
    expect(within(pergunta).getByText('Trocar a foto desta posição?')).toBeInTheDocument();
    expect(h.preparar).toHaveBeenCalledTimes(2);
    fireEvent.click(within(pergunta).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(h.preparar).toHaveBeenCalledTimes(2);
    expect(textoDaLista()).toContain('Linha dos ombros');

    fireEvent.change(entradaTrocarFoto(), { target: { files: [arquivo()] } });
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Trocar a foto' }));
    await waitFor(() => expect(h.preparar).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(document.querySelector('image')?.getAttribute('href')).toBe('blob:foto-3'));
    expect(estadoDaAba(/Perfil direito/)).toBe('marcando');
  });

  it('trocar a foto de uma posição sem pontos não pergunta nada', async () => {
    renderizar();
    await carregarFoto(null);
    h.corpo = corpoFrente();
    fireEvent.change(entradaTrocarFoto(), { target: { files: [arquivo()] } });
    await waitFor(() => expect(h.preparar).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('pular a posição leva à próxima sem foto e, ao pular todas, abre o resumo', async () => {
    renderizar();
    fireEvent.click(screen.getByTestId('pular-posicao'));
    expect(estadoDaAba(/Frente/)).toBe('pulada');
    expect(aba(/Perfil direito/)).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByTestId('pular-posicao'));
    fireEvent.click(screen.getByTestId('pular-posicao'));
    expect(aba(/Costas/)).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByTestId('pular-posicao'));
    expect(screen.getByTestId('resumo-sessao')).toBeInTheDocument();
    expect(estadoDaAba(/Costas/)).toBe('pulada');
  });
});

describe('marcação automática', () => {
  it('mostra o que o modelo achou: quantas medidas marcou e as que não conseguiu, com o motivo', async () => {
    const corpo = corpoFrente();
    corpo[14] = L(0.35, 0.45, 0.1);
    renderizar();
    await carregarFoto(corpo);
    const painel = screen.getByTestId('avisos-marcacao');
    expect(painel).toHaveTextContent(/Marquei \d+ medida\(s\) com o modelo de pose/);
    expect(painel).toHaveTextContent('Não marquei:');
    expect(painel).toHaveTextContent('Alinhamento do braço direito: não achei o cotovelo direito');
    expect(painel).toHaveTextContent('Desnível dos cotovelos: não achei o cotovelo direito');
  });

  it('sem corpo na foto, avisa na tela e não marca nada', async () => {
    renderizar();
    await carregarFoto(null);
    expect(screen.getByTestId('avisos-marcacao')).toHaveTextContent('Não achei o corpo na foto. Marque os pontos à mão.');
    expect(screen.getByTestId('avisos-marcacao')).toHaveTextContent('O modelo não marcou nenhuma medida nesta foto.');
    expect(textoDaLista()).toContain('Complete uma medida para ver o resultado.');
  });

  it('se o modelo falhar (sem internet), a foto fica na tela com o aviso e a marcação à mão', async () => {
    renderizar();
    h.detectar.mockRejectedValue(new Error('offline'));
    await carregarFoto();
    expect(screen.getByTestId('avisos-marcacao')).toHaveTextContent(/Não consegui carregar a marcação automática agora/);
    expect(estadoDaAba(/Frente/)).toBe('marcando');
  });

  it('direito e esquerdo trocados pelo modelo: avisa e o botão "Inverter D/E" refaz as medidas com os lados certos', async () => {
    renderizar();
    await carregarFoto(corpoFrenteTrocado());
    expect(screen.getByTestId('avisos-marcacao')).toHaveTextContent('O modelo pode ter trocado direito e esquerdo');
    expect(textoDaLista()).toContain('lado esquerdo mais alto');
    fireEvent.click(screen.getByRole('button', { name: 'Inverter D/E' }));
    await waitFor(() => expect(textoDaLista()).toContain('lado direito mais alto'));
    expect(screen.getByTestId('avisos-marcacao')).not.toHaveTextContent('O modelo pode ter trocado direito e esquerdo');
    expect(screen.getByRole('button', { name: 'Desfazer a inversão D/E' })).toBeInTheDocument();
    expect(h.detectar).toHaveBeenCalledTimes(1);
  });

  it('perfil: usa o lado da posição e avisa "confira o lado" quando o outro lado aparece melhor', async () => {
    renderizar();
    fireEvent.click(aba(/Perfil direito/));
    const lm = corpoPerfil('D');
    for (const i of [11, 13, 15, 23, 25, 27]) lm[i] = L(0.5, 0.5, 0.95);
    for (const i of [12, 14, 16, 24, 26, 28]) lm[i] = { ...lm[i], visibility: 0.3 };
    await carregarFoto(lm);
    expect(screen.getByTestId('avisos-marcacao')).toHaveTextContent('Confira o lado: nesta foto de perfil direito o modelo enxergou melhor o lado esquerdo do corpo.');
  });

  it('se o profissional já marcou uma medida enquanto o modelo trabalhava, a sugestão da foto recém-carregada não a sobrescreve', async () => {
    prepararGestos();
    renderizar();
    let liberar: (lm: Landmark[]) => void = () => {};
    h.detectar.mockImplementation(() => new Promise<Landmark[]>((ok) => { liberar = ok; }));
    fireEvent.change(screen.getByLabelText(/Escolher a foto:/), { target: { files: [arquivo()] } });
    await waitFor(() => expect(h.detectar).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(svgDaFoto()).not.toBeNull());
    tocar(100, 100);
    tocar(300, 100);
    expect(textoDaLista()).toContain('Linha dos ombros nivelada (0,0°).');
    liberar(corpoFrente());
    await waitFor(() => expect(textoDaLista()).toContain('Linha dos quadris'));
    expect(textoDaLista()).toContain('Linha dos ombros nivelada (0,0°).');
    expect(textoDaLista()).not.toContain('8,5°');
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('o botão Automático só preenche medidas sem pontos e pergunta antes de trocar as que já têm', async () => {
    prepararGestos();
    renderizar();
    await carregarFoto(null);
    // Ombros marcados à mão, nivelados (100,100) e (300,100); o Automático acharia 8,5°.
    tocar(100, 100);
    tocar(300, 100);
    expect(textoDaLista()).toContain('Linha dos ombros nivelada (0,0°).');

    h.corpo = corpoFrente();
    fireEvent.click(screen.getByRole('button', { name: /Automático/ }));
    const pergunta = await screen.findByRole('alertdialog');
    expect(within(pergunta).getByText('Trocar os pontos já marcados?')).toBeInTheDocument();
    expect(pergunta).toHaveTextContent('Desnível dos ombros');
    expect(textoDaLista()).toContain('Linha dos quadris');
    expect(textoDaLista()).toContain('Linha dos ombros nivelada (0,0°).');

    fireEvent.click(within(pergunta).getByRole('button', { name: 'Manter os meus pontos' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(textoDaLista()).toContain('Linha dos ombros nivelada (0,0°).');

    fireEvent.click(screen.getByRole('button', { name: /Automático/ }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Trocar pelos sugeridos' }));
    await waitFor(() => expect(textoDaLista()).toContain('Linha dos ombros: 8,5° com a horizontal, lado direito mais alto.'));
  });
});

describe('salvar no prontuário', () => {
  it('salvar duas vezes grava UMA nota: a segunda vez atualiza a mesma nota, e o botão passa a dizer "Atualizar"', async () => {
    renderizar('p1');
    await carregarFoto();
    const botao = screen.getByTestId('salvar-posicao');
    expect(botao).toHaveTextContent('Salvar esta posição');
    fireEvent.click(botao);
    await waitFor(() => expect(estadoDaAba(/Frente/)).toBe('salva'));
    expect(operacoes('insert')).toHaveLength(1);
    expect(notasGravadas()).toHaveLength(1);
    expect(screen.getByTestId('salvar-posicao')).toHaveTextContent('Atualizar esta posição');

    fireEvent.click(screen.getByTestId('salvar-posicao'));
    await waitFor(() => expect(operacoes('update')).toHaveLength(1));
    expect(operacoes('insert')).toHaveLength(1);
    expect(notasGravadas()).toHaveLength(1);
    const id = notasGravadas()[0].id;
    expect(operacoes('update')[0].filtros).toContainEqual(['eq', 'id', id]);
    expect(h.sucesso).toHaveBeenCalledWith('Posição salva no prontuário de Mateus.');
    expect(h.sucesso).toHaveBeenCalledWith('Posição atualizada no prontuário de Mateus.');
  });

  it('a nota leva título com a posição, o esquema 2, a sessão, o id da sessão em referencia_id e só as medidas (nada da foto)', async () => {
    renderizar('p1');
    await carregarFoto();
    fireEvent.click(screen.getByTestId('salvar-posicao'));
    await waitFor(() => expect(notasGravadas()).toHaveLength(1));
    const nota = notasGravadas()[0];
    expect(nota).toMatchObject({ paciente_id: 'p1', terapeuta_id: 'prof-1', tipo: 'analise_angular', titulo: 'Análise angular — vista frente (1 de 4)' });
    expect(nota.dados_extras).toMatchObject({ vista: 'frente', esquema: 2, metodo: 'automatica_conferida', pontos_ajustados: [], nivel_graus: null });
    expect(nota.dados_extras.lado_perfil).toBeUndefined();
    expect(nota.dados_extras.sessao).toMatchObject({ ordem: 1, previstas: ['frente', 'perfil_d', 'perfil_e', 'costas'] });
    expect(nota.dados_extras.sessao.id).toBe(nota.referencia_id);
    expect(nota.dados_extras.medidas.find((m: { id: string }) => m.id === 'ombros')).toMatchObject({ graus: 8.5 });
    expect(nota.descricao).toContain('Pontos sugeridos por detecção automática; nenhuma medida ajustada à mão.');
    expect(nota.descricao).not.toMatch(/conferid/i);
    expect(JSON.stringify(nota)).not.toContain('blob:');
  });

  it('"Salvar e ir para a próxima" grava e vai para a próxima posição sem foto; ao terminar, abre o resumo', async () => {
    renderizar('p1');
    await carregarFoto();
    fireEvent.click(screen.getByTestId('salvar-e-proxima'));
    await waitFor(() => expect(aba(/Perfil direito/)).toHaveAttribute('aria-selected', 'true'));
    expect(estadoDaAba(/Frente/)).toBe('salva');
    expect(notasGravadas()).toHaveLength(1);
    expect(screen.getByTestId('instrucao-posicao')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('pular-posicao'));
    fireEvent.click(screen.getByTestId('pular-posicao'));
    expect(aba(/Costas/)).toHaveAttribute('aria-selected', 'true');
    await carregarFoto(corpoFrente());
    expect(screen.getByTestId('salvar-e-proxima')).toHaveTextContent('Salvar e ver o resumo');
    fireEvent.click(screen.getByTestId('salvar-e-proxima'));
    await screen.findByTestId('resumo-sessao');
    expect(notasGravadas()).toHaveLength(2);
    expect(notasGravadas()[0].titulo).toBe('Análise angular — vista frente (1 de 4)');
    expect(notasGravadas()[1].titulo).toBe('Análise angular — vista costas (2 de 2)');
  });

  it('perfil direito e perfil esquerdo gravam o lado do perfil, a mesma sessão e o "olha para" de cada lado', async () => {
    renderizar('p1');
    fireEvent.click(aba(/Perfil direito/));
    await carregarFoto(corpoPerfil('D'));
    fireEvent.click(screen.getByTestId('salvar-posicao'));
    await waitFor(() => expect(notasGravadas()).toHaveLength(1));
    fireEvent.click(aba(/Perfil esquerdo/));
    await carregarFoto(corpoPerfil('E'));
    fireEvent.click(screen.getByTestId('salvar-posicao'));
    await waitFor(() => expect(notasGravadas()).toHaveLength(2));
    const [d, e] = notasGravadas();
    expect(d.dados_extras).toMatchObject({ vista: 'perfil', lado_perfil: 'D', esquema: 2 });
    expect(e.dados_extras).toMatchObject({ vista: 'perfil', lado_perfil: 'E', esquema: 2 });
    expect(d.dados_extras.opcoes.olhaPara).toBe('direita');
    expect(e.dados_extras.opcoes.olhaPara).toBe('esquerda');
    expect(d.titulo).toBe('Análise angular — vista perfil direito (2 de 4)');
    expect(e.titulo).toBe('Análise angular — vista perfil esquerdo (3 de 4)');
    expect(d.dados_extras.sessao.id).toBe(e.dados_extras.sessao.id);
    expect(d.referencia_id).toBe(e.referencia_id);
    expect([d.dados_extras.sessao.ordem, e.dados_extras.sessao.ordem]).toEqual([2, 3]);
    expect(d.id).not.toBe(e.id);
  });

  it('com posições puladas, o título e as previstas contam só as que ficam na sessão', async () => {
    renderizar('p1');
    fireEvent.click(screen.getByTestId('pular-posicao'));
    fireEvent.click(screen.getByTestId('pular-posicao'));
    fireEvent.click(screen.getByTestId('pular-posicao'));
    fireEvent.click(aba(/Frente/));
    expect(estadoDaAba(/Frente/)).toBe('pulada');
    await carregarFoto();
    fireEvent.click(screen.getByTestId('salvar-posicao'));
    await waitFor(() => expect(notasGravadas()).toHaveLength(1));
    expect(notasGravadas()[0].titulo).toBe('Análise angular — vista frente (1 de 2)');
    expect(notasGravadas()[0].dados_extras.sessao.previstas).toEqual(['frente', 'costas']);
  });

  it('sem paciente, salvar fica desligado com o motivo, mas a análise e o PDF da posição funcionam', async () => {
    renderizar();
    await carregarFoto();
    expect(screen.getByTestId('salvar-posicao')).toBeDisabled();
    expect(screen.getByTestId('salvar-e-proxima')).toBeDisabled();
    expect(screen.getByText(/Escolha um paciente no topo para salvar no prontuário/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /PDF desta posição/ }));
    await waitFor(() => expect(h.gerarPosicao).toHaveBeenCalledTimes(1));
    expect(h.gerarPosicao.mock.calls[0][0]).toMatchObject({ paciente: 'Paciente', vistaNome: 'frente', metodo: 'automatica_conferida', anterior: null });
    expect(h.gerarPosicao.mock.calls[0][0].medidas.length).toBeGreaterThan(0);
    expect(h.entregar).toHaveBeenCalledWith(expect.objectContaining({ pacienteId: null }));
    expect(h.banco.operacoes.filter((o) => o.tipo === 'insert')).toHaveLength(0);
  });

  it('medida ajustada à mão: arrastar um ponto sugerido vai para pontos_ajustados e para o texto da nota', async () => {
    prepararGestos();
    renderizar('p1');
    await carregarFoto();
    const ponto = svgDaFoto().querySelector('g[style*="cursor: move"]')!;
    fireEvent.pointerDown(ponto, { clientX: 410, clientY: 460, pointerId: 1 });
    fireEvent.pointerMove(svgDaFoto(), { clientX: 450, clientY: 470, pointerId: 1 });
    fireEvent.pointerUp(svgDaFoto(), { clientX: 450, clientY: 470, pointerId: 1 });
    fireEvent.click(screen.getByTestId('salvar-posicao'));
    await waitFor(() => expect(notasGravadas()).toHaveLength(1));
    const nota = notasGravadas()[0];
    expect(nota.dados_extras.pontos_ajustados).toHaveLength(1);
    expect(nota.descricao).toContain('Pontos sugeridos por detecção automática; 1 medida ajustada à mão.');
  });

  it('um ponto marcado à mão (sem sugestão) grava "marcados manualmente" e nenhum ponto ajustado', async () => {
    prepararGestos();
    renderizar('p1');
    await carregarFoto(null);
    tocar(100, 100);
    tocar(300, 130);
    fireEvent.click(screen.getByTestId('salvar-posicao'));
    await waitFor(() => expect(notasGravadas()).toHaveLength(1));
    const nota = notasGravadas()[0];
    expect(nota.dados_extras.metodo).toBe('marcacao_manual');
    expect(nota.dados_extras.pontos_ajustados).toBeUndefined();
    expect(nota.descricao).toContain('Pontos marcados manualmente.');
    expect(nota.dados_extras.medidas).toEqual([expect.objectContaining({ id: 'ombros', graus: 8.5 })]);
  });

  it('uma falha ao gravar mostra o erro, não marca a posição como salva e deixa tentar de novo', async () => {
    renderizar('p1');
    await carregarFoto();
    h.banco.falharEscritaQuando(() => true, 'sem conexão');
    fireEvent.click(screen.getByTestId('salvar-posicao'));
    await waitFor(() => expect(h.erro).toHaveBeenCalledWith('sem conexão'));
    expect(estadoDaAba(/Frente/)).toBe('marcando');
    expect(screen.getByTestId('salvar-posicao')).toHaveTextContent('Salvar esta posição');
    h.banco.falharEscritaQuando(null);
    fireEvent.click(screen.getByTestId('salvar-posicao'));
    await waitFor(() => expect(estadoDaAba(/Frente/)).toBe('salva'));
    expect(notasGravadas()).toHaveLength(1);
  });
});

describe('trocar o paciente', () => {
  it('com a sessão em andamento pede confirmação e, ao confirmar, reinicia a sessão', async () => {
    renderizar('p1');
    await carregarFoto();
    fireEvent.click(screen.getByTestId('salvar-posicao'));
    await waitFor(() => expect(estadoDaAba(/Frente/)).toBe('salva'));

    fireEvent.change(screen.getByLabelText('Paciente'), { target: { value: 'p2' } });
    const pergunta = await screen.findByRole('alertdialog');
    expect(within(pergunta).getByText('Trocar o paciente?')).toBeInTheDocument();
    fireEvent.click(within(pergunta).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(screen.getByLabelText('Paciente')).toHaveValue('p1');
    expect(estadoDaAba(/Frente/)).toBe('salva');

    fireEvent.change(screen.getByLabelText('Paciente'), { target: { value: 'p2' } });
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Trocar e reiniciar' }));
    await waitFor(() => expect(screen.getByLabelText('Paciente')).toHaveValue('p2'));
    expect(estadoDaAba(/Frente/)).toBe('sem_foto');
    expect(screen.getByTestId('progresso-sessao')).toHaveTextContent('0 de 4 posições');

    await carregarFoto();
    fireEvent.click(screen.getByTestId('salvar-posicao'));
    await waitFor(() => expect(notasGravadas()).toHaveLength(2));
    expect(notasGravadas()[1].paciente_id).toBe('p2');
    expect(notasGravadas()[1].dados_extras.sessao.id).not.toBe(notasGravadas()[0].dados_extras.sessao.id);
    expect(operacoes('update')).toHaveLength(0);
  });

  it('tirar o paciente também pede confirmação quando há trabalho na sessão', async () => {
    renderizar('p1');
    await carregarFoto();
    fireEvent.click(screen.getByRole('button', { name: 'Tirar paciente' }));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
  });

  it('se a URL mudar de paciente por fora do seletor, uma nota já salva nunca é atualizada nem gravada no outro paciente', async () => {
    renderizar('p1');
    await carregarFoto();
    fireEvent.click(screen.getByTestId('salvar-posicao'));
    await waitFor(() => expect(estadoDaAba(/Frente/)).toBe('salva'));
    fireEvent.click(screen.getByRole('button', { name: 'mudar a URL para p2' }));
    await waitFor(() => expect(screen.getByText(/Esta sessão já tem posições salvas de outro paciente/)).toBeInTheDocument());
    expect(screen.getByTestId('salvar-posicao')).toBeDisabled();
    expect(screen.getByTestId('salvar-e-proxima')).toBeDisabled();
    expect(operacoes('insert')).toHaveLength(1);
    expect(operacoes('update')).toHaveLength(0);
  });

  it('escolher o primeiro paciente de uma análise avulsa não pergunta nem perde a foto', async () => {
    renderizar();
    await carregarFoto();
    fireEvent.change(screen.getByLabelText('Paciente'), { target: { value: 'p1' } });
    await waitFor(() => expect(screen.getByLabelText('Paciente')).toHaveValue('p1'));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(estadoDaAba(/Frente/)).toBe('marcando');
    expect(screen.getByTestId('salvar-posicao')).toBeEnabled();
  });

  it('sem nada a perder, trocar o paciente não pergunta', async () => {
    renderizar('p1');
    fireEvent.change(screen.getByLabelText('Paciente'), { target: { value: 'p2' } });
    await waitFor(() => expect(screen.getByLabelText('Paciente')).toHaveValue('p2'));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});

describe('fechar a página', () => {
  const fechar = () => { const ev = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(ev); return ev.defaultPrevented; };

  it('avisa quando há marcação não salva e deixa de avisar depois de salvar', async () => {
    renderizar('p1');
    expect(fechar()).toBe(false);
    await carregarFoto();
    expect(fechar()).toBe(true);
    fireEvent.click(screen.getByTestId('salvar-posicao'));
    await waitFor(() => expect(estadoDaAba(/Frente/)).toBe('salva'));
    expect(fechar()).toBe(false);
  });
});

describe('câmera do app em sequência', () => {
  it('depois de cada foto segue para a próxima posição com a instrução certa, sem reabrir; pular e terminar funcionam', async () => {
    renderizar();
    fireEvent.click(screen.getByRole('button', { name: /Tirar a foto no app/ }));
    expect(await screen.findByTestId('camera-titulo')).toHaveTextContent('Posição 1 de 4: Frente');
    expect(screen.getByTestId('camera-instrucao')).toHaveTextContent('Peça para ficar de frente para a câmera');

    fireEvent.click(screen.getByRole('button', { name: 'Capturar' }));
    await waitFor(() => expect(screen.getByTestId('camera-titulo')).toHaveTextContent('Posição 2 de 4: Perfil direito'));
    expect(screen.getByTestId('camera-instrucao')).toHaveTextContent('Peça para ficar de perfil, com o lado direito voltado para a câmera.');
    expect(screen.getByTestId('camera-ultima')).toHaveTextContent('Frente guardada.');
    expect(aba(/Perfil direito/)).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Capturar' }));
    await waitFor(() => expect(screen.getByTestId('camera-titulo')).toHaveTextContent('Posição 3 de 4: Perfil esquerdo'));
    expect(screen.getByTestId('camera-instrucao')).toHaveTextContent('Peça para ficar de perfil, com o lado esquerdo voltado para a câmera.');

    fireEvent.click(screen.getByRole('button', { name: 'Pular na câmera' }));
    await waitFor(() => expect(screen.getByTestId('camera-titulo')).toHaveTextContent('Posição 3 de 3: Costas'));
    fireEvent.click(screen.getByRole('button', { name: 'Capturar' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Câmera falsa' })).toBeNull());

    await waitFor(() => expect(h.preparar).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(estadoDaAba(/Costas/)).toBe('marcando'));
    expect(estadoDaAba(/Frente/)).toBe('marcando');
    expect(estadoDaAba(/Perfil direito/)).toBe('marcando');
    expect(estadoDaAba(/Perfil esquerdo/)).toBe('pulada');
    expect(aba(/Frente/)).toHaveAttribute('aria-selected', 'true');
  });

  it('para trocar a foto de uma posição, a câmera abre só para ela e fecha depois da foto', async () => {
    renderizar();
    await carregarFoto();
    fireEvent.click(aba(/Frente/));
    fireEvent.click(screen.getByRole('button', { name: 'Tirar a foto no app' }));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Tirar outra foto' }));
    expect(await screen.findByTestId('camera-titulo')).toHaveTextContent('avulsa: Frente');
    expect(screen.queryByRole('button', { name: 'Pular na câmera' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Capturar' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Câmera falsa' })).toBeNull());
    await waitFor(() => expect(h.preparar).toHaveBeenCalledTimes(2));
  });
});

describe('resumo da sessão', () => {
  it('lista as posições com as medidas e a tabela direito x esquerdo dos membros superiores (só aritmética)', async () => {
    renderizar();
    await carregarFoto(corpoFrente());
    fireEvent.click(screen.getByRole('button', { name: /Resumo da sessão/ }));
    const resumo = await screen.findByTestId('resumo-sessao');
    expect(within(screen.getByTestId('resumo-frente')).getByText('Linha dos ombros: 8,5° com a horizontal, lado direito mais alto.')).toBeInTheDocument();
    expect(screen.getByTestId('resumo-perfil_d')).toHaveTextContent('Ainda sem medidas nesta posição.');
    const tabela = within(screen.getByTestId('tabela-membros-superiores'));
    expect(tabela.getByText('Frente')).toBeInTheDocument();
    const linha = tabela.getByText('Alinhamento do braço').closest('tr')!;
    expect(linha).toHaveTextContent('12,5°');
    expect(linha).toHaveTextContent('14,4°');
    expect(linha).toHaveTextContent('−1,9°');
    expect(linha).toHaveTextContent('estimativa: confirme');
    expect(resumo).toHaveTextContent('Estimativa por foto: para comparar entre avaliações, repita na mesma distância, altura da câmera e roupa.');
    expect(resumo.textContent).not.toMatch(/normal|alterad|melhor|pior/i);
  });

  it('"Gerar PDF da sessão" chama o gerador com as posições preenchidas e respeita o interruptor "Incluir as fotos"', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ctxFalso() as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(() => 'data:image/jpeg;base64,AAAA');
    renderizar('p1');
    await carregarFoto(corpoFrente());
    fireEvent.click(aba(/Perfil direito/));
    await carregarFoto(corpoPerfil('D'));
    fireEvent.click(screen.getByRole('button', { name: /Resumo da sessão/ }));
    await screen.findByTestId('resumo-sessao');

    fireEvent.click(screen.getByRole('button', { name: /Gerar PDF da sessão/ }));
    await waitFor(() => expect(h.gerarSessao).toHaveBeenCalledTimes(1));
    const dados = h.gerarSessao.mock.calls[0][0];
    expect(dados.paciente).toBe('Mateus Souza');
    expect(dados.profissional).toBe('Rafael Lima · CREFITO 1234-F');
    expect(dados.data).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(dados.vistas.map((v: { posicao: string }) => v.posicao)).toEqual(['frente', 'perfil_d']);
    expect(dados.vistas.map((v: { vistaNome: string }) => v.vistaNome)).toEqual(['Frente', 'Perfil direito']);
    for (const v of dados.vistas) {
      expect(v.medidas.length).toBeGreaterThan(0);
      expect(v.metodo).toBe('automatica_conferida');
      expect(v.pontosAjustados).toBe(0);
      expect(v.imagem).toBe('data:image/jpeg;base64,AAAA');
      expect(v.anterior).toBeNull();
    }
    await waitFor(() => expect(h.entregar).toHaveBeenCalledWith(expect.objectContaining({ nome: 'Analise_angular_sessao_MATEUS.pdf', pacienteId: 'p1' })));

    fireEvent.click(screen.getByLabelText('Incluir as fotos'));
    fireEvent.click(screen.getByRole('button', { name: /Gerar PDF da sessão/ }));
    await waitFor(() => expect(h.gerarSessao).toHaveBeenCalledTimes(2));
    expect(h.gerarSessao.mock.calls[1][0].vistas.every((v: { imagem: string | null }) => v.imagem === null)).toBe(true);
  });

  it('o PDF e o resumo de uma posição só (sessão de uma posição) funcionam', async () => {
    renderizar();
    await carregarFoto(corpoFrente());
    fireEvent.click(screen.getByRole('button', { name: /Resumo da sessão/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Gerar PDF da sessão/ }));
    await waitFor(() => expect(h.gerarSessao).toHaveBeenCalledTimes(1));
    expect(h.gerarSessao.mock.calls[0][0].vistas.map((v: { posicao: string }) => v.posicao)).toEqual(['frente']);
    expect(h.gerarSessao.mock.calls[0][0].paciente).toBe('Paciente');
  });

  it('sem nenhuma medida o PDF da sessão fica desligado', async () => {
    renderizar();
    fireEvent.click(screen.getByRole('button', { name: /Resumo da sessão/ }));
    expect(await screen.findByRole('button', { name: /Gerar PDF da sessão/ })).toBeDisabled();
  });

  it('"Começar uma nova sessão" pede confirmação e esvazia a sessão', async () => {
    renderizar();
    await carregarFoto();
    fireEvent.click(screen.getByRole('button', { name: /Resumo da sessão/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Começar uma nova sessão' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Começar nova sessão' }));
    await waitFor(() => expect(estadoDaAba(/Frente/)).toBe('sem_foto'));
  });
});

describe('comparar com a avaliação anterior', () => {
  const meds = (graus: number, texto: string, id = 'ombros') => [{ id, graus, texto }];
  const extras = (vista: string, medidas: unknown[], mais: Record<string, unknown> = {}) => ({ vista, medidas, metodo: 'marcacao_manual', nivel_graus: null, escala_cm_por_px: null, opcoes: {}, ...mais });
  const nota = (id: string, created_at: string, dados_extras: unknown) => ({ id, created_at, paciente_id: 'p1', terapeuta_id: 'prof-1', tipo: 'analise_angular', titulo: 'x', descricao: 'x', dados_extras });
  const sessao = (id: string, iniciadaEm: string) => ({ id, ordem: 1, previstas: ['frente', 'perfil_d'], iniciadaEm });
  const NOTAS = [
    nota('n1', '2026-02-01T12:00:00Z', extras('frente', meds(5, 'Linha dos ombros: 5,0° com a horizontal, lado direito mais alto.'))),
    nota('n2', '2026-03-01T12:00:00Z', extras('frente', meds(6, 'Linha dos ombros: 6,0° com a horizontal, lado direito mais alto.'), { esquema: 2, sessao: sessao('s-1', '2026-03-01T12:00:00.000Z') })),
    nota('n3', '2026-03-01T12:05:00Z', extras('perfil', meds(3, 'Inclinação do tronco: 3,0°.', 'tronco-perfil'), { esquema: 2, lado_perfil: 'D', sessao: sessao('s-1', '2026-03-01T12:00:00.000Z') })),
    nota('n4', '2026-01-10T12:00:00Z', extras('perfil', meds(4, 'Inclinação do tronco: 4,0°.', 'tronco-perfil'))),
    nota('v1', '2026-03-05T12:00:00Z', { metodo: 'video_gesto', gesto: 'agachamento', capturas: [] }),
  ];

  it('oferece as avaliações com data e número de posições, usa a mais recente e mostra antes, agora e variação sem classificar', async () => {
    renderizar('p1', NOTAS);
    await carregarFoto(corpoFrente());
    const cartao = within(await screen.findByTestId('comparar-anterior'));
    const seletor = await cartao.findByLabelText('Avaliação anterior');
    await waitFor(() => expect(within(seletor).getAllByRole('option')).toHaveLength(2));
    expect(within(seletor).getAllByRole('option').map((o) => o.textContent)).toEqual(['01/03/2026 · 2 posições (mais recente)', '01/02/2026 · 1 posição']);
    const linha = cartao.getByText('Desnível dos ombros').closest('tr')!;
    expect(linha).toHaveTextContent('6,0°');
    expect(linha).toHaveTextContent('8,5°');
    expect(linha).toHaveTextContent('+2,5°');

    fireEvent.change(seletor, { target: { value: 'n1' } });
    await waitFor(() => expect(cartao.getByText('Desnível dos ombros').closest('tr')).toHaveTextContent('+3,5°'));
    expect(cartao.getByText('Desnível dos ombros').closest('tr')).toHaveTextContent('5,0°');
    expect(screen.getByTestId('comparar-anterior').textContent).not.toMatch(/melhorou|piorou|normal|alterad/i);
  });

  it('o perfil de nota antiga (sem lado) nunca é oferecido para perfil direito ou esquerdo, e a tela explica', async () => {
    renderizar('p1', NOTAS);
    fireEvent.click(aba(/Perfil direito/));
    await carregarFoto(corpoPerfil('D'));
    const cartao = within(await screen.findByTestId('comparar-anterior'));
    const seletor = await cartao.findByLabelText('Avaliação anterior');
    await waitFor(() => expect(within(seletor).getAllByRole('option')).toHaveLength(1));
    expect(within(seletor).getByRole('option')).toHaveTextContent('01/03/2026 · 2 posições');
    expect(cartao.getByText(/análises antigas de perfil sem o lado informado/)).toBeInTheDocument();

    fireEvent.click(aba(/Perfil esquerdo/));
    await carregarFoto(corpoPerfil('E'));
    expect(await screen.findByText(/Ainda não há análise angular de perfil esquerdo registrada/)).toBeInTheDocument();
  });

  it('no resumo, compara a sessão toda com a avaliação anterior mais recente, posição por posição', async () => {
    renderizar('p1', NOTAS);
    await carregarFoto(corpoFrente());
    fireEvent.click(aba(/Perfil direito/));
    await carregarFoto(corpoPerfil('D'));
    fireEvent.click(screen.getByRole('button', { name: /Resumo da sessão/ }));
    const bloco = within(await screen.findByTestId('comparacao-sessao'));
    expect(await bloco.findByText(/Comparando com a avaliação de 01\/03\/2026/)).toBeInTheDocument();
    expect(bloco.getByTestId('comparacao-frente')).toHaveTextContent('+2,5°');
    expect(bloco.getByTestId('comparacao-perfil_d')).toBeInTheDocument();
    expect(bloco.getAllByText(/Não estava marcada na avaliação anterior/, { selector: 'span' }).length).toBeGreaterThan(0);
  });

  it('a sessão em andamento não aparece como "avaliação anterior" de si mesma depois de salva', async () => {
    renderizar('p1', NOTAS);
    await carregarFoto(corpoFrente());
    await within(await screen.findByTestId('comparar-anterior')).findByLabelText('Avaliação anterior');
    fireEvent.click(screen.getByTestId('salvar-posicao'));
    await waitFor(() => expect(estadoDaAba(/Frente/)).toBe('salva'));
    const seletor = await within(screen.getByTestId('comparar-anterior')).findByLabelText('Avaliação anterior');
    await waitFor(() => expect(within(seletor).getAllByRole('option')).toHaveLength(2));
  });

  it('a consulta do histórico é só do tipo e do paciente e pede bem mais que 20 notas (a lista mistura vídeo e foto)', async () => {
    renderizar('p1', NOTAS);
    await carregarFoto();
    await waitFor(() => expect(h.banco.operacoes.some((o) => o.tipo === 'select' && o.tabela === 'notas_prontuario')).toBe(true));
    const consulta = h.banco.operacoes.find((o) => o.tipo === 'select' && o.tabela === 'notas_prontuario')!;
    expect(consulta.filtros).toContainEqual(['eq', 'tipo', 'analise_angular']);
    expect(consulta.filtros).toContainEqual(['eq', 'paciente_id', 'p1']);
    expect(h.limites.length).toBeGreaterThan(0);
    expect(Math.min(...h.limites)).toBeGreaterThanOrEqual(100);
    expect(LIMITE_DO_HISTORICO).toBeGreaterThan(20);
  });
});
