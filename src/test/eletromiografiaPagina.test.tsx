import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Profiler } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { criarBancoFalso, type BancoFalso } from './helpers/bancoFalso';

const h = vi.hoisted(() => {
  // Fuso de Brasília: às 23h30 locais já é o dia seguinte em UTC, e a data do exame tem de ser a do calendário local.
  process.env.TZ = 'America/Sao_Paulo';
  return {
    banco: null as unknown as BancoFalso,
    sucesso: vi.fn(),
    erro: vi.fn(),
    baixar: vi.fn(),
    plano: null as null | { modulos: string[] },
    superAdmin: false,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (t: string) => h.banco.from(t), rpc: (n: string, a?: Record<string, unknown>) => h.banco.rpc(n, a) },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'prof-1' } }) }));
vi.mock('@/components/AppLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('sonner', () => ({ toast: { success: h.sucesso, error: h.erro } }));
vi.mock('@/lib/pdf/entrega', () => ({ baixarBlob: (blob: Blob, nome: string) => h.baixar(blob, nome) }));
vi.mock('@/hooks/useIsSuperAdmin', () => ({ useIsSuperAdmin: () => h.superAdmin }));
vi.mock('@/hooks/usePlanoAtivo', async (importarOriginal) => {
  const original = await importarOriginal<typeof import('@/hooks/usePlanoAtivo')>();
  return { ...original, usePlanoAtivo: () => ({ data: h.plano, isLoading: false }) };
});

// O seletor de paciente (cmdk) mede e rola a lista; o jsdom não tem nenhum dos dois.
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
Element.prototype.scrollIntoView = vi.fn();

import Aplicacoes from '@/pages/Aplicacoes';
import Eletromiografia from '@/pages/Eletromiografia';
import ModuloGuard from '@/components/planos/ModuloGuard';
import { criarDemonstracao } from '@/components/emg/demonstracao';
import { fabricaPadrao, type AjustesDoModulo, type FabricaDoModulo } from '@/components/emg/fabrica';
import { EXAMES_PRESENCIAIS, tipoExame } from '@/lib/examesPresenciais';
import { ModuloEmg } from '@/lib/emg/moduloEmg';
import { ModuloSimulado, criarBluetoothSimulado, type BluetoothSimulado } from '@/lib/emg/simulador';
import type { TransporteBle } from '@/lib/emg/tiposBle';

// ---------------------------------------------------------------------------
// Mundo de teste: módulo simulado de verdade por baixo, sem Bluetooth real. Os tempos são do relógio
// falso do vitest; o simulador corre pelo setInterval dele (iniciarRelogio), então "passar(ms)" é tempo de sinal.
// ---------------------------------------------------------------------------

interface Mundo {
  fabrica: FabricaDoModulo;
  /** Os ajustes com que a tela pediu cada módulo real. */
  ajustesPedidos: Array<AjustesDoModulo | undefined>;
  simulados: ModuloSimulado[];
  bluetooths: BluetoothSimulado[];
  modulos: ModuloEmg[];
}

interface OpcoesMundo {
  fsHz?: 500 | 1000;
  amostrasPorQuadro?: number;
  bluetooth?: boolean;
  /** O seletor de dispositivos do navegador falha (por exemplo, a pessoa cancela a escolha). */
  pedidoFalha?: Error;
}

let mundos: Mundo[] = [];

function criarMundo(opcoes: OpcoesMundo = {}): Mundo {
  const { fsHz = 500, amostrasPorQuadro = 50, bluetooth = true, pedidoFalha } = opcoes;
  const mundo: Mundo = {
    ajustesPedidos: [],
    simulados: [],
    bluetooths: [],
    modulos: [],
    fabrica: {
      temBluetooth: () => bluetooth,
      mensagemSemBluetooth: () => 'Mensagem de teste: sem Bluetooth.',
      criarReal: (ajustes) => {
        mundo.ajustesPedidos.push(ajustes);
        const sim = new ModuloSimulado({ fsHz, semente: 11, amostrasPorQuadro, mtu: 185, bateriaPct: 77 });
        const bt = criarBluetoothSimulado(sim);
        const transporte: TransporteBle = pedidoFalha
          ? {
              requestDevice: () => {
                throw pedidoFalha;
              },
            }
          : bt;
        const modulo = new ModuloEmg({ bluetooth: transporte, redeHz: ajustes?.redeHz, incluirPrimeiraAmostra: ajustes?.incluirPrimeiraAmostra });
        sim.iniciarRelogio();
        mundo.simulados.push(sim);
        mundo.bluetooths.push(bt);
        mundo.modulos.push(modulo);
        return modulo;
      },
      criarDemonstracao,
    },
  };
  mundos.push(mundo);
  return mundo;
}

async function passar(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function numeroDe(texto: string | null | undefined): number {
  const m = /-?\d+(?:[.,]\d+)?/.exec(texto ?? '');
  if (!m) return Number.NaN;
  return Number(m[0].replace(',', '.'));
}

const PACIENTES = [
  { id: 'p1', nome: 'Ana', sobrenome: 'Souza', terapeuta_id: 'prof-1', ativo: true },
  { id: 'p2', nome: 'Bruno', sobrenome: 'Lima', terapeuta_id: 'prof-1', ativo: true },
];

interface Montagem {
  qc: QueryClient;
  perfil: { commits: number };
  unmount: () => void;
}

function montar(fabrica: FabricaDoModulo, rota = '/eletromiografia?paciente=p1'): Montagem {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  const perfil = { commits: 0 };
  const { unmount } = render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[rota]}>
        <Profiler id="emg" onRender={() => void perfil.commits++}>
          <Eletromiografia fabrica={fabrica} />
        </Profiler>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { qc, perfil, unmount };
}

const botao = (nome: string | RegExp): HTMLButtonElement => screen.getByRole('button', { name: nome }) as HTMLButtonElement;
const texto = (testid: string): string => screen.getByTestId(testid).textContent ?? '';

async function conectarReal(): Promise<void> {
  fireEvent.click(botao('Conectar módulo'));
  // Aperto de mão (~2 s) + início da aquisição; depois a tela ainda lê o módulo 2 vezes por segundo.
  await passar(4000);
}

// Agenda uma rajada do "paciente" no sinal do módulo simulado, em segundos A PARTIR DE AGORA.
function rajada(mundo: Mundo, aPartirDeAgoraS: number, duracaoS: number, amplitudeUv: number): void {
  const sim = mundo.simulados[mundo.simulados.length - 1];
  sim.contrair(sim.tempoS + aPartirDeAgoraS, duracaoS, amplitudeUv);
}

async function gravarRepouso(): Promise<void> {
  fireEvent.click(botao('Iniciar repouso'));
  await passar(3000 + 5000 + 600); // contagem de 3 s + 5 s gravados
}

async function gravarCvm(mundo: Mundo, tentativa: number, amplitudeUv: number): Promise<void> {
  // A gravação vai de +3 s a +8 s depois do toque: a rajada fica no miolo dela.
  rajada(mundo, 3.4, 4.2, amplitudeUv);
  fireEvent.click(botao(`Iniciar tentativa ${tentativa}`));
  await passar(3000 + 5000 + 600);
}

async function gravarTarefaComTresContracoes(mundo: Mundo): Promise<void> {
  rajada(mundo, 3 + 1.0, 1.5, 80);
  rajada(mundo, 3 + 4.0, 1.5, 80);
  rajada(mundo, 3 + 7.0, 1.5, 80);
  fireEvent.click(botao('Iniciar tarefa'));
  await passar(3000 + 9800);
  fireEvent.click(botao('Parar tarefa'));
  await passar(100);
}

async function protocoloCompleto(mundo: Mundo): Promise<void> {
  await gravarRepouso();
  await gravarCvm(mundo, 1, 150);
  await gravarCvm(mundo, 2, 140);
  await gravarCvm(mundo, 3, 150);
  await gravarTarefaComTresContracoes(mundo);
}

// Segura a próxima escrita no banco até o teste liberar: é o "insert em andamento" de uma rede lenta.
function segurarEscrita(): { liberar: () => void } {
  let liberar: () => void = () => undefined;
  const segura = new Promise<void>((resolver) => {
    liberar = resolver;
  });
  h.banco.antesDeEscrever(() => segura);
  return { liberar };
}

// O seletor é um combobox: o nome vem do rótulo "Paciente" (aria-labelledby), e o texto que ele mostra é quem está escolhido agora.
async function escolherPacienteNaLista(atual: RegExp, novo: RegExp): Promise<void> {
  const seletor = screen.getByRole('combobox', { name: /Paciente/ });
  expect(seletor).toHaveTextContent(atual);
  fireEvent.click(seletor);
  await passar(10);
  fireEvent.click(screen.getByRole('option', { name: novo }));
  await passar(10);
}

// O PostgREST devolve a linha criada em insert().select().single(); o banco falso devolve null. Aqui a linha nova volta com o id,
// como no banco de verdade (a tela guarda esse id para atualizar o mesmo exame em vez de criar outro).
function insertDevolveOId(banco: BancoFalso): void {
  const deVerdade = banco.from;
  banco.from = (tabela: string) => {
    const consulta = deVerdade(tabela) as { then: (...args: unknown[]) => unknown };
    if (tabela === 'exames_presenciais') {
      const entao = consulta.then.bind(consulta);
      consulta.then = (resolver: unknown, rejeitar: unknown) =>
        entao((resposta: { data: unknown; error: unknown }) => {
          const linhas = banco.tabelas.exames_presenciais;
          const resultado = resposta.data === null && !resposta.error ? { ...resposta, data: { id: linhas[linhas.length - 1]?.id } } : resposta;
          return (resolver as (v: unknown) => unknown)(resultado);
        }, rejeitar);
    }
    return consulta;
  };
}

// A leitura da lista de pacientes falha enquanto `estado.falhar` for verdadeiro (rede ou permissão): o banco falso só falha escritas.
function pacientesComErroDeLeitura(estado: { falhar: boolean }): void {
  const deVerdade = h.banco.from;
  h.banco.from = (tabela: string) => {
    const consulta = deVerdade(tabela) as { then: (...args: unknown[]) => unknown };
    if (tabela === 'pacientes' && estado.falhar) {
      consulta.then = (resolver: unknown, rejeitar: unknown) =>
        Promise.resolve({ data: null, error: { message: 'sem rede de mentira' } }).then(
          resolver as (v: unknown) => unknown,
          rejeitar as (e: unknown) => unknown,
        );
    }
    return consulta;
  };
}

// O jsdom não desenha: o contexto de mentira guarda só os pontos do traço do sinal (cor do tema claro) e esquece tudo a cada clearRect.
function simularCanvas(): { traco: () => Array<{ x: number; y: number }>; restaurar: () => void } {
  let traco: Array<{ x: number; y: number }> = [];
  let cor = '';
  const ctx = {
    get strokeStyle() {
      return cor;
    },
    set strokeStyle(v: string) {
      cor = v;
    },
    lineWidth: 1,
    setTransform: () => undefined,
    clearRect: () => {
      traco = [];
    },
    beginPath: () => undefined,
    moveTo: (x: number, y: number) => {
      if (cor === '#1e3a5f') traco.push({ x, y });
    },
    lineTo: () => undefined,
    stroke: () => undefined,
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ctx) as never);
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
  const originais = {
    clientWidth: Object.getOwnPropertyDescriptor(proto, 'clientWidth'),
    clientHeight: Object.getOwnPropertyDescriptor(proto, 'clientHeight'),
  };
  Object.defineProperty(proto, 'clientWidth', { configurable: true, get: () => 200 });
  Object.defineProperty(proto, 'clientHeight', { configurable: true, get: () => 100 });
  return {
    traco: () => traco.map((ponto) => ({ ...ponto })),
    restaurar: () => {
      for (const [nome, descritor] of Object.entries(originais)) {
        if (descritor) Object.defineProperty(proto, nome, descritor);
        else Reflect.deleteProperty(proto, nome);
      }
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 8, 23, 30, 0));
  h.banco = criarBancoFalso({ pacientes: PACIENTES.map((p) => ({ ...p })), exames_presenciais: [] });
  insertDevolveOId(h.banco);
  h.sucesso.mockClear();
  h.erro.mockClear();
  h.baixar.mockClear();
  h.plano = { modulos: ['aplicacoes'] };
  h.superAdmin = false;
  mundos = [];
});

afterEach(() => {
  cleanup();
  for (const m of mundos) for (const s of m.simulados) s.pararRelogio();
  for (const m of mundos) for (const mod of m.modulos) mod.desconectar();
  vi.useRealTimers();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'clipboard');
});

// ---------------------------------------------------------------------------
// Rota, card e acesso
// ---------------------------------------------------------------------------

describe('Eletromiografia: rota, card e acesso', () => {
  it('a rota /eletromiografia é carregada sob demanda e passa pelas guardas de profissional e de módulo', () => {
    const app = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');
    expect(app).toMatch(/const Eletromiografia = lazyWithRetry\(\(\) => import\("\.\/pages\/Eletromiografia"\)\)/);
    const linha = app.split('\n').find((l) => l.includes('path="/eletromiografia"'));
    expect(linha).toBeDefined();
    expect(linha).toContain('<ProfessionalGuard>');
    expect(linha).toContain('<ModuloGuard modulo="aplicacoes">');
    expect(linha).toContain('<Eletromiografia />');
    // A guarda de módulo fica por dentro da de profissional, como nas outras aplicações.
    expect(linha!.indexOf('<ProfessionalGuard>')).toBeLessThan(linha!.indexOf('<ModuloGuard'));
  });

  it('sem o módulo "aplicacoes" no plano, a página leva para os preços; com ele, abre', async () => {
    const mundo = criarMundo();
    const rota = (
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/eletromiografia']}>
          <Routes>
            <Route
              path="/eletromiografia"
              element={
                <ModuloGuard modulo="aplicacoes">
                  <Eletromiografia fabrica={mundo.fabrica} />
                </ModuloGuard>
              }
            />
            <Route path="/precos" element={<p>página de preços</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    h.plano = { modulos: ['agenda', 'pacientes'] };
    const primeira = render(rota);
    await passar(10);
    expect(screen.getByText('página de preços')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Eletromiografia' })).not.toBeInTheDocument();
    primeira.unmount();

    h.plano = { modulos: ['agenda', 'aplicacoes'] };
    render(rota);
    await passar(10);
    expect(screen.getByRole('heading', { name: 'Eletromiografia' })).toBeInTheDocument();
    expect(screen.queryByText('página de preços')).not.toBeInTheDocument();
  });

  it('o hub Aplicações tem o card "Eletromiografia", que abre a página direto ou com o paciente escolhido', async () => {
    vi.useRealTimers();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    function Local() {
      const l = useLocation();
      return <p data-testid="local">{`${l.pathname}${l.search}`}</p>;
    }
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/aplicacoes']}>
          <Aplicacoes />
          <Local />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const card = screen.getByRole('button', { name: /^Eletromiografia\./ });
    expect(card).toBeInTheDocument();
    expect(card.querySelector('svg')).not.toBeNull();

    fireEvent.click(card);
    expect(screen.getByTestId('local').textContent).toBe('/eletromiografia');
  });

  it('pelo botão "com paciente" do card, a rota leva o paciente na URL', async () => {
    vi.useRealTimers();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    function Local() {
      const l = useLocation();
      return <p data-testid="local">{`${l.pathname}${l.search}`}</p>;
    }
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/aplicacoes']}>
          <Aplicacoes />
          <Local />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Eletromiografia com paciente' }));
    const ana = await screen.findByRole('button', { name: /Ana Souza/ });
    fireEvent.click(ana);
    expect(screen.getByTestId('local').textContent).toBe('/eletromiografia?paciente=p1');
  });

  it('o tipo de exame "eletromiografia" existe, pede interpretação profissional e entra no resumo da lista', () => {
    const t = tipoExame('eletromiografia');
    expect(t).toBeDefined();
    expect(t!.nome).toBe('Eletromiografia');
    expect(t!.nota).toMatch(/Pede interpretação por um profissional/);
    expect(t!.campos.map((c) => c.key)).toEqual(['resultado', 'observacoes']);
    expect(EXAMES_PRESENCIAIS.filter((e) => e.id === 'eletromiografia')).toHaveLength(1);
    // Ids únicos: um tipo novo não pode repetir o de outro exame.
    const ids = EXAMES_PRESENCIAIS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// Conexão
// ---------------------------------------------------------------------------

describe('Eletromiografia: conexão', () => {
  it('antes de conectar: protocolo travado e explicação visível', async () => {
    const mundo = criarMundo();
    montar(mundo.fabrica);
    await passar(10);
    expect(texto('estado-modulo')).toContain('Desconectado');
    expect(botao('Iniciar repouso')).toBeDisabled();
    expect(botao('Iniciar tentativa 1')).toBeDisabled();
    expect(botao('Iniciar tarefa')).toBeDisabled();
    expect(screen.getByTestId('protocolo-sem-sinal')).toBeInTheDocument();
    expect(screen.getByText(/O resultado aparece aqui depois da primeira etapa gravada/)).toBeInTheDocument();
  });

  it('sem Bluetooth no navegador: botão desligado e mensagem clara; a demonstração continua disponível', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (X11; Linux x86_64) Chrome/130');
    montar(fabricaPadrao);
    await passar(10);
    expect(botao('Conectar módulo')).toBeDisabled();
    expect(screen.getByTestId('sem-bluetooth').textContent).toBe('Este navegador não tem Bluetooth. Use o Chrome no Android ou no computador.');
    expect(botao('Modo demonstração (sem aparelho)')).toBeEnabled();
  });

  it('no iPhone, fora do app, a mensagem é a do iPhone (Bluefy ou app nativo)', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1');
    montar(fabricaPadrao);
    await passar(10);
    const msg = screen.getByTestId('sem-bluetooth').textContent ?? '';
    expect(msg).toMatch(/iPhone/);
    expect(msg).toMatch(/Bluefy/);
    expect(botao('Conectar módulo')).toBeDisabled();
  });

  it('com Bluetooth, conecta ao módulo, mostra taxa lida, bateria e libera o protocolo', async () => {
    const mundo = criarMundo({ fsHz: 500 });
    montar(mundo.fabrica);
    await conectarReal();
    expect(texto('estado-modulo')).toContain('Lendo o sinal');
    expect(texto('estado-modulo')).toContain('RunE W2');
    expect(texto('taxa-modulo')).toContain('500 Hz');
    expect(texto('bateria-modulo')).toContain('77 %');
    expect(screen.queryByTestId('aviso-taxa-assumida')).not.toBeInTheDocument();
    expect(screen.queryByTestId('aviso-demonstracao')).not.toBeInTheDocument();
    expect(botao('Iniciar repouso')).toBeEnabled();
    expect(screen.queryByTestId('sem-bluetooth')).not.toBeInTheDocument();
    // Enquanto lê, não dá para conectar de novo, mas dá para desconectar.
    expect(botao('Conectar módulo')).toBeDisabled();
    fireEvent.click(botao('Desconectar'));
    await passar(500);
    expect(texto('estado-modulo')).toContain('Desconectado');
    expect(botao('Conectar módulo')).toBeEnabled();
    expect(botao('Iniciar repouso')).toBeDisabled();
  });

  it('a pessoa cancela a escolha do módulo: mostra o motivo e deixa tentar de novo', async () => {
    const cancelou = Object.assign(new Error('User cancelled the requestDevice() chooser.'), { name: 'NotFoundError' });
    const mundo = criarMundo({ pedidoFalha: cancelou });
    montar(mundo.fabrica);
    fireEvent.click(botao('Conectar módulo'));
    await passar(200);
    expect(screen.getByRole('alert').textContent).toMatch(/Nenhum módulo foi escolhido/);
    expect(texto('estado-modulo')).toContain('Desconectado');
    expect(botao('Conectar módulo')).toBeEnabled();
  });

  it('modo demonstração: conecta sozinho, avisa que é simulado, mostra RMS maior que zero e o selo de qualidade', async () => {
    montar(fabricaPadrao);
    fireEvent.click(botao('Modo demonstração (sem aparelho)'));
    await passar(12000);
    expect(texto('estado-modulo')).toContain('Lendo o sinal');
    expect(texto('taxa-modulo')).toContain('1000 Hz');
    expect(texto('bateria-modulo')).toContain('82 %');
    expect(screen.getByTestId('aviso-demonstracao').textContent).toMatch(/simulado/);
    // O RMS é lido do buffer 5 vezes por segundo: em vários instantes ele nunca é zero nem "—".
    for (let i = 0; i < 6; i++) {
      const rms = numeroDe(texto('rms-uv'));
      expect(rms, `RMS no instante ${i}`).toBeGreaterThan(0);
      await passar(700);
    }
    expect(texto('selo-qualidade')).toMatch(/Sinal (bom|pede atenção|ruim)/);
    expect(botao('Iniciar repouso')).toBeEnabled();
  });

  it('a taxa assumida (módulo que não respondeu à leitura da taxa) aparece como aviso no cartão', async () => {
    const mundo = criarMundo();
    const original = mundo.fabrica.criarReal;
    mundo.fabrica.criarReal = () => {
      const modulo = original();
      const sim = mundo.simulados[mundo.simulados.length - 1];
      const receber = sim.receberComando.bind(sim);
      // A leitura da taxa (AA 03 81 06 84 BB) cai no vazio: o módulo não responde, e o serviço assume 500 Hz.
      sim.receberComando = (bytes: Uint8Array) => {
        if (bytes[2] === 0x81 && bytes[3] === 0x06) return;
        receber(bytes);
      };
      return modulo;
    };
    montar(mundo.fabrica);
    fireEvent.click(botao('Conectar módulo'));
    await passar(7000);
    expect(screen.getByTestId('aviso-taxa-assumida').textContent).toMatch(/Taxa assumida/);
    expect(texto('taxa-modulo')).toContain('500 Hz');
  });
});

// ---------------------------------------------------------------------------
// Protocolo guiado e resultado
// ---------------------------------------------------------------------------

describe('Eletromiografia: protocolo guiado', () => {
  it('repouso: contagem de 3 s, gravação de 5 s e depois o resumo; refazer substitui, não soma', async () => {
    const mundo = criarMundo();
    montar(mundo.fabrica);
    await conectarReal();

    fireEvent.click(botao('Iniciar repouso'));
    await passar(300);
    expect(screen.getByTestId('etapa-ativa').textContent).toMatch(/Prepare-se: relaxe o músculo/);
    expect(numeroDe(texto('contagem'))).toBe(3);
    await passar(1500);
    expect(numeroDe(texto('contagem'))).toBe(2);
    await passar(1500 + 600);
    // Passou dos 3 s: agora grava.
    expect(screen.getByTestId('etapa-ativa').textContent).toMatch(/Gravando o repouso/);
    await passar(5000);
    expect(screen.queryByTestId('etapa-ativa')).not.toBeInTheDocument();
    expect(texto('repouso-feito')).toMatch(/Gravado: 5,0 s/);
    expect(screen.getByTestId('cartao-ruido').textContent).not.toMatch(/—/);
    const ruido = numeroDe(within(screen.getByTestId('cartao-ruido')).getByText(/µV$/).textContent);
    // O módulo simulado tem 2 µV de ruído de repouso.
    expect(ruido).toBeGreaterThan(1);
    expect(ruido).toBeLessThan(4);

    fireEvent.click(botao('Refazer repouso'));
    await passar(3000 + 5000 + 600);
    expect(screen.getAllByTestId('repouso-feito')).toHaveLength(1);
    // Refazer substitui o repouso: o resumo não fala em "mais de um repouso".
    expect(screen.queryByTestId('avisos-resumo')?.textContent ?? '').not.toMatch(/Mais de um repouso/);
  });

  it('cancelar a etapa na contagem não grava nada', async () => {
    const mundo = criarMundo();
    montar(mundo.fabrica);
    await conectarReal();
    fireEvent.click(botao('Iniciar repouso'));
    await passar(1200);
    expect(screen.getByTestId('etapa-ativa')).toBeInTheDocument();
    fireEvent.click(botao('Cancelar etapa'));
    await passar(300);
    expect(screen.queryByTestId('etapa-ativa')).not.toBeInTheDocument();
    expect(screen.queryByTestId('repouso-feito')).not.toBeInTheDocument();
    expect(screen.getByText(/O resultado aparece aqui depois da primeira etapa gravada/)).toBeInTheDocument();
  });

  it('protocolo completo (repouso, 3 CVM, tarefa) chega ao resumo com CVM, contrações e gráfico do envelope', async () => {
    const mundo = criarMundo();
    montar(mundo.fabrica);
    await conectarReal();
    await protocoloCompleto(mundo);

    // CVM: o maior RMS de 1 s entre as tentativas. Rajada de 150 µV de pico = 150/√2 ≈ 106 µV de RMS (doc do simulador).
    const cvm = numeroDe(within(screen.getByTestId('cartao-cvm')).getAllByText(/µV/)[0].textContent);
    expect(cvm).toBeGreaterThan(90);
    expect(cvm).toBeLessThan(120);
    expect(screen.getByTestId('cartao-cvm').textContent).toMatch(/3 tentativas/);
    expect(screen.getByTestId('lista-cvm').querySelectorAll('li')).toHaveLength(3);

    // Três rajadas de 1,5 s separadas por 1,5 s: três contrações.
    expect(numeroDe(within(screen.getByTestId('cartao-contracoes')).getAllByText(/./)[1].textContent)).toBe(3);
    expect(screen.getAllByTestId('contracao')).toHaveLength(3);
    // 80 µV de pico ≈ 57 µV de RMS ≈ 53 % da CVM de ≈106 µV: o pico do envelope fica na faixa de 40 a 75 %.
    const pico = numeroDe(screen.getByTestId('cartao-pico').textContent!.replace('PICO', ''));
    expect(screen.getByTestId('cartao-pico').textContent).toMatch(/% da CVM/);
    expect(pico).toBeGreaterThan(40);
    expect(pico).toBeLessThan(75);
    expect(screen.getByTestId('cartao-rms-medio').textContent).toMatch(/% da CVM/);
    expect(screen.getByTestId('grafico-envelope')).toBeInTheDocument();
    expect(screen.getByTestId('tarefa-feita').textContent).toMatch(/Gravada: 9,\d s/);
    // O protocolo previsto está completo: nada de aviso de "só 2 tentativas" ou de "sem repouso".
    const avisos = screen.queryByTestId('avisos-resumo')?.textContent ?? '';
    expect(avisos).not.toMatch(/Sem repouso/);
    expect(avisos).not.toMatch(/Só \d tentativas?/);
  });

  it('refazer a última CVM tira só a última tentativa', async () => {
    const mundo = criarMundo();
    montar(mundo.fabrica);
    await conectarReal();
    await gravarRepouso();
    await gravarCvm(mundo, 1, 150);
    await gravarCvm(mundo, 2, 150);
    expect(screen.getByTestId('lista-cvm').querySelectorAll('li')).toHaveLength(2);
    expect(screen.getByTestId('descanso-cvm').textContent).toMatch(/Descanso sugerido: \d+ s/);

    rajada(mundo, 3.4, 4.2, 150);
    fireEvent.click(botao('Refazer a última'));
    await passar(3000 + 5000 + 600);
    expect(screen.getByTestId('lista-cvm').querySelectorAll('li')).toHaveLength(2);
  });

  it('a conexão cai no meio da etapa: a etapa é descartada com aviso e o módulo religa sozinho', async () => {
    const mundo = criarMundo();
    montar(mundo.fabrica);
    await conectarReal();
    fireEvent.click(botao('Iniciar repouso'));
    await passar(4000);
    expect(screen.getByTestId('etapa-ativa').textContent).toMatch(/Gravando/);

    act(() => mundo.bluetooths[0].derrubar());
    await passar(100);
    expect(texto('estado-modulo')).toContain('Religando');
    expect(screen.getByTestId('aviso-etapa').textContent).toMatch(/A conexão com o módulo caiu durante a etapa/);
    expect(screen.queryByTestId('etapa-ativa')).not.toBeInTheDocument();
    expect(screen.queryByTestId('repouso-feito')).not.toBeInTheDocument();

    // Reconecta sozinho (espera de 0,5 s + aperto de mão) e volta a ler.
    await passar(6000);
    expect(texto('estado-modulo')).toContain('Lendo o sinal');
    expect(botao('Iniciar repouso')).toBeEnabled();
  });

  it('nada de estado por amostra: 5 s de sinal a 500 amostras por segundo não rendem renderizações por lote', async () => {
    // 5 amostras por quadro: 100 lotes por segundo. Se cada lote renderizasse, seriam 500 renderizações em 5 s.
    const mundo = criarMundo({ fsHz: 500, amostrasPorQuadro: 5 });
    const { perfil } = montar(mundo.fabrica);
    await conectarReal();
    const antes = perfil.commits;
    await passar(5000);
    const durante = perfil.commits - antes;
    expect(mundo.modulos[0].quadrosRecebidos).toBeGreaterThan(400);
    expect(durante).toBeLessThan(80);
  });
});

// ---------------------------------------------------------------------------
// Salvar no prontuário
// ---------------------------------------------------------------------------

describe('Eletromiografia: salvar no prontuário', () => {
  it('sem paciente escolhido, o botão fica bloqueado e explica o motivo; o CSV continua disponível', async () => {
    const mundo = criarMundo();
    montar(mundo.fabrica, '/eletromiografia');
    await conectarReal();
    await gravarRepouso();

    expect(botao('Salvar no prontuário')).toBeDisabled();
    expect(texto('ajuda-salvar')).toMatch(/Escolha um paciente no alto da página para salvar no prontuário/);
    expect(botao('Baixar CSV do sinal')).toBeEnabled();
    fireEvent.click(botao('Salvar no prontuário'));
    await passar(100);
    expect(h.banco.escritas()).toHaveLength(0);
  });

  it('sem nenhuma etapa gravada, não há o que salvar', async () => {
    const mundo = criarMundo();
    montar(mundo.fabrica);
    await conectarReal();
    expect(botao('Salvar no prontuário')).toBeDisabled();
    expect(texto('ajuda-salvar')).toMatch(/Grave pelo menos uma etapa/);
    expect(botao('Baixar CSV do sinal')).toBeDisabled();
  });

  it('com paciente: grava em exames_presenciais, escondido do cliente, com a análise versão 1 e sem sinal bruto', async () => {
    const mundo = criarMundo();
    montar(mundo.fabrica);
    await conectarReal();
    await passar(100);
    expect(screen.getByText('Ana Souza')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Músculo medido' }), { target: { value: 'Reto femoral' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Direito' }));
    await protocoloCompleto(mundo);
    fireEvent.change(screen.getByLabelText('Observações'), { target: { value: '  Posição sentada, joelho a 90°.  ' } });

    expect(screen.getByRole('switch', { name: 'Mostrar ao cliente' })).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(botao('Salvar no prontuário'));
    await passar(200);

    const escritas = h.banco.escritas();
    expect(escritas).toHaveLength(1);
    expect(escritas[0].tabela).toBe('exames_presenciais');
    expect(escritas[0].tipo).toBe('insert');
    const linha = escritas[0].payload as Record<string, unknown>;
    expect(linha.paciente_id).toBe('p1');
    expect(linha.terapeuta_id).toBe('prof-1');
    expect(linha.tipo).toBe('eletromiografia');
    expect(linha.visivel_paciente).toBe(false);
    // 23:30 de 8/11/2026 em Brasília (já 9/11 em UTC): vale o dia local.
    expect(new Date().toISOString().slice(0, 10), 'o fuso do teste vale').toBe('2026-11-09');
    expect(linha.data_exame).toBe('2026-11-08');
    expect(linha.resumo).toMatch(/^EMG de superfície — Reto femoral D: CVM de \d+ µV; 3 contrações, pico de \d+ % da CVM\.$/);

    const dados = linha.dados as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(Object.keys(dados).sort()).toEqual(['analise', 'observacoes', 'resultado', 'versao_laudo']);
    expect(dados.versao_laudo).toBe(1);
    expect(dados.observacoes).toBe('Posição sentada, joelho a 90°.');
    expect(dados.resultado).toMatch(/^Eletromiografia \(EMG\) de superfície — Reto femoral D/);
    expect(dados.resultado).toMatch(/a interpretação é do profissional/i);
    expect(dados.analise.versao).toBe(1);
    expect(dados.analise.fsHz).toBe(500);
    expect(dados.analise.canais).toEqual([{ id: '1', musculo: 'Reto femoral', lado: 'D' }]);
    expect(dados.analise.resumo.contracoes).toHaveLength(3);
    expect(dados.analise.observacoes).toBe('Posição sentada, joelho a 90°.');
    // Sem sinal bruto: cada etapa leva só tipo, duração e o envelope de 20 Hz.
    expect(dados.analise.etapas.map((e: { tipo: string }) => e.tipo)).toEqual(['repouso', 'cvm', 'cvm', 'cvm', 'tarefa']);
    for (const etapa of dados.analise.etapas) {
      expect(Object.keys(etapa).sort()).toEqual(['duracaoS', 'envelope20Hz', 'tipo']);
    }
    // Repouso de 5 s a 20 valores por segundo = 100 valores (e não 2500 amostras de 500 Hz).
    expect(dados.analise.etapas[0].envelope20Hz).toHaveLength(100);
    expect(JSON.stringify(dados).length).toBeLessThan(40_000);

    expect(h.sucesso).toHaveBeenCalledTimes(1);
    expect(botao('Salvo no prontuário')).toBeDisabled();
    expect(texto('ajuda-salvar')).toMatch(/Salvo no prontuário de Ana Souza/);
    expect(screen.getByRole('link', { name: 'Abrir o prontuário' })).toHaveAttribute('href', '/pacientes/p1');
  });

  it('o interruptor "Mostrar ao cliente" liga a visibilidade; mudar as observações permite salvar de novo', async () => {
    const mundo = criarMundo();
    montar(mundo.fabrica);
    await conectarReal();
    await gravarRepouso();

    fireEvent.click(screen.getByRole('switch', { name: 'Mostrar ao cliente' }));
    expect(screen.getByRole('switch', { name: 'Mostrar ao cliente' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(botao('Salvar no prontuário'));
    await passar(200);
    expect((h.banco.escritas()[0].payload as Record<string, unknown>).visivel_paciente).toBe(true);
    expect(botao('Salvo no prontuário')).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Observações'), { target: { value: 'Corrigindo o posicionamento' } });
    expect(botao('Atualizar exame salvo')).toBeEnabled();
  });

  it('erro do banco: avisa com a mensagem, não marca como salvo e deixa tentar de novo', async () => {
    const mundo = criarMundo();
    montar(mundo.fabrica);
    await conectarReal();
    await gravarRepouso();
    h.banco.falharEscritaQuando((op) => op.tabela === 'exames_presenciais', 'permissão negada de mentira');

    fireEvent.click(botao('Salvar no prontuário'));
    await passar(200);
    expect(h.erro).toHaveBeenCalledWith('permissão negada de mentira');
    expect(h.sucesso).not.toHaveBeenCalled();
    expect(h.banco.tabelas.exames_presenciais).toHaveLength(0);
    expect(botao('Salvar no prontuário')).toBeEnabled();

    h.banco.falharEscritaQuando(null);
    fireEvent.click(botao('Salvar no prontuário'));
    await passar(200);
    expect(h.banco.tabelas.exames_presenciais).toHaveLength(1);
    expect(h.sucesso).toHaveBeenCalledTimes(1);
  });

  it('depois de salvar, mudar "Mostrar ao cliente" libera salvar de novo; voltar ao que foi gravado volta a mostrar "Salvo"', async () => {
    const mundo = criarMundo();
    montar(mundo.fabrica);
    await conectarReal();
    await gravarRepouso();

    fireEvent.click(screen.getByRole('switch', { name: 'Mostrar ao cliente' }));
    fireEvent.click(botao('Salvar no prontuário'));
    await passar(200);
    expect((h.banco.escritas()[0].payload as Record<string, unknown>).visivel_paciente).toBe(true);
    expect(botao('Salvo no prontuário')).toBeDisabled();

    // A tela passa a mostrar "desligado", mas o banco guarda "ligado": tem de dar para salvar de novo.
    fireEvent.click(screen.getByRole('switch', { name: 'Mostrar ao cliente' }));
    expect(botao('Atualizar exame salvo')).toBeEnabled();
    expect(texto('ajuda-salvar')).not.toMatch(/^Salvo/);

    // Igual ao que foi gravado outra vez: está salvo.
    fireEvent.click(screen.getByRole('switch', { name: 'Mostrar ao cliente' }));
    expect(botao('Salvo no prontuário')).toBeDisabled();

    fireEvent.click(screen.getByRole('switch', { name: 'Mostrar ao cliente' }));
    fireEvent.click(botao('Atualizar exame salvo'));
    await passar(200);
    const escritas = h.banco.escritas();
    expect(escritas).toHaveLength(2);
    expect(escritas[1].tipo).toBe('update');
    expect((escritas[1].payload as Record<string, unknown>).visivel_paciente).toBe(false);
    expect(botao('Salvo no prontuário')).toBeDisabled();
  });

  it('editar as observações durante o salvamento não deixa a tela em "Salvo": o texto novo não foi para o banco', async () => {
    const mundo = criarMundo();
    montar(mundo.fabrica);
    await conectarReal();
    await gravarRepouso();
    fireEvent.change(screen.getByLabelText('Observações'), { target: { value: 'Primeira frase' } });

    const { liberar } = segurarEscrita();
    fireEvent.click(botao('Salvar no prontuário'));
    await passar(50);
    expect(h.banco.escritas()).toHaveLength(0);
    // Enquanto o insert não volta, os campos que entram no exame ficam travados.
    expect(screen.getByLabelText('Observações')).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Mostrar ao cliente' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Músculo medido' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Esquerdo' })).toBeDisabled();

    // Mesmo travado, um evento de mudança pode chegar (preenchimento do teclado do celular): a tela não pode dizer "Salvo".
    fireEvent.change(screen.getByLabelText('Observações'), { target: { value: 'Primeira frase e mais uma' } });
    liberar();
    await passar(200);

    const escritas = h.banco.escritas();
    expect(escritas).toHaveLength(1);
    const dados = (escritas[0].payload as Record<string, Record<string, unknown>>).dados;
    expect(dados.observacoes).toBe('Primeira frase');
    expect(botao('Atualizar exame salvo')).toBeEnabled();
    expect(texto('ajuda-salvar')).not.toMatch(/Salvo no prontuário/);
    expect(screen.getByLabelText('Observações')).toBeEnabled();
  });

  it('trocar de paciente durante o salvamento não marca "Salvo" para o paciente novo, que não recebeu nada', async () => {
    const mundo = criarMundo();
    montar(mundo.fabrica);
    await conectarReal();
    await passar(100);
    await gravarRepouso();

    const { liberar } = segurarEscrita();
    fireEvent.click(botao('Salvar no prontuário'));
    await passar(50);
    await escolherPacienteNaLista(/Ana Souza/, /Bruno Lima/);
    expect(screen.getByText('Bruno Lima')).toBeInTheDocument();
    liberar();
    await passar(200);

    expect(h.banco.tabelas.exames_presenciais).toHaveLength(1);
    expect(h.banco.tabelas.exames_presenciais[0].paciente_id).toBe('p1');
    expect(botao('Salvar no prontuário')).toBeEnabled();
    expect(texto('ajuda-salvar')).not.toMatch(/Salvo no prontuário/);

    fireEvent.click(botao('Salvar no prontuário'));
    await passar(200);
    expect(h.banco.tabelas.exames_presenciais.map((l) => l.paciente_id)).toEqual(['p1', 'p2']);
    expect(texto('ajuda-salvar')).toMatch(/Salvo no prontuário de Bruno Lima/);
  });

  it.each([
    ['de outro profissional', { id: 'p-alheio', nome: 'Carla', sobrenome: 'Dias', terapeuta_id: 'prof-2', ativo: true }],
    ['inativo', { id: 'p-inativo', nome: 'Davi', sobrenome: 'Melo', terapeuta_id: 'prof-1', ativo: false }],
  ])('?paciente= com um paciente %s (fora da lista): salvar fica bloqueado, nada é gravado e pede para escolher', async (_quem, intruso) => {
    h.banco.tabelas.pacientes.push({ ...intruso });
    const mundo = criarMundo();
    montar(mundo.fabrica, `/eletromiografia?paciente=${intruso.id}`);
    await conectarReal();
    await passar(100);
    await gravarRepouso();

    expect(screen.getByTestId('paciente-nao-encontrado').textContent).toMatch(/não está na sua lista de pacientes ativos/);
    expect(screen.queryByRole('button', { name: 'Tirar paciente' })).not.toBeInTheDocument();
    expect(botao('Salvar no prontuário')).toBeDisabled();
    expect(texto('ajuda-salvar')).toMatch(/Escolha um paciente no alto da página para salvar no prontuário/);
    fireEvent.click(botao('Salvar no prontuário'));
    await passar(100);
    expect(h.banco.escritas()).toHaveLength(0);

    // Escolhendo alguém da lista, libera, e o exame vai para quem foi escolhido (nunca para o id do link).
    await escolherPacienteNaLista(/Escolher o paciente/, /Ana Souza/);
    expect(screen.queryByTestId('paciente-nao-encontrado')).not.toBeInTheDocument();
    fireEvent.click(botao('Salvar no prontuário'));
    await passar(200);
    expect(h.banco.escritas()).toHaveLength(1);
    expect((h.banco.escritas()[0].payload as Record<string, unknown>).paciente_id).toBe('p1');
  });

  it('enquanto a lista de pacientes carrega, salvar fica bloqueado e o botão explica; carregou, libera', async () => {
    let liberarLista: () => void = () => undefined;
    const lista = new Promise<void>((resolver) => {
      liberarLista = resolver;
    });
    const deVerdade = h.banco.from;
    h.banco.from = (tabela: string) => {
      const consulta = deVerdade(tabela) as { then: (...args: unknown[]) => unknown };
      if (tabela === 'pacientes') {
        const entao = consulta.then.bind(consulta);
        consulta.then = (...args: unknown[]) => lista.then(() => entao(...args));
      }
      return consulta;
    };
    const mundo = criarMundo();
    montar(mundo.fabrica);
    await conectarReal();
    await gravarRepouso();

    expect(botao('Salvar no prontuário')).toBeDisabled();
    expect(texto('ajuda-salvar')).toMatch(/^Carregando pacientes…/);
    fireEvent.click(botao('Salvar no prontuário'));
    await passar(100);
    expect(h.banco.escritas()).toHaveLength(0);
    expect(screen.queryByTestId('paciente-nao-encontrado')).not.toBeInTheDocument();

    liberarLista();
    await passar(100);
    expect(botao('Salvar no prontuário')).toBeEnabled();
    expect(texto('ajuda-salvar')).not.toMatch(/Carregando/);
    fireEvent.click(botao('Salvar no prontuário'));
    await passar(200);
    expect((h.banco.escritas()[0].payload as Record<string, unknown>).paciente_id).toBe('p1');
  });

  it('o resultado da demonstração é simulado: não vai para o prontuário e o motivo aparece', async () => {
    montar(fabricaPadrao);
    fireEvent.click(botao('Modo demonstração (sem aparelho)'));
    await passar(6000);
    fireEvent.click(botao('Iniciar repouso'));
    await passar(3000 + 5000 + 600);
    expect(screen.getByTestId('repouso-feito')).toBeInTheDocument();

    expect(botao('Salvar no prontuário')).toBeDisabled();
    expect(texto('ajuda-salvar')).toMatch(/demonstração \(sinal simulado\)/);
    fireEvent.click(botao('Salvar no prontuário'));
    await passar(100);
    expect(h.banco.escritas()).toHaveLength(0);
  });

  it('trocar da demonstração para o módulo real descarta as etapas simuladas', async () => {
    const mundo = criarMundo();
    montar({ ...fabricaPadrao, temBluetooth: () => true, criarReal: mundo.fabrica.criarReal });
    fireEvent.click(botao('Modo demonstração (sem aparelho)'));
    await passar(6000);
    fireEvent.click(botao('Iniciar repouso'));
    await passar(3000 + 5000 + 600);
    expect(screen.getByTestId('repouso-feito')).toBeInTheDocument();

    fireEvent.click(botao('Desconectar'));
    await passar(500);
    fireEvent.click(botao('Conectar módulo'));
    await passar(4000);
    expect(screen.queryByTestId('repouso-feito')).not.toBeInTheDocument();
    expect(screen.getByTestId('aviso-etapa').textContent).toMatch(/descartadas/);
    expect(botao('Salvar no prontuário')).toBeDisabled();
    expect(texto('ajuda-salvar')).toMatch(/Grave pelo menos uma etapa/);
  });
});

// ---------------------------------------------------------------------------
// Nova medida: músculo e lado travados com etapas gravadas
// ---------------------------------------------------------------------------

describe('Eletromiografia: nova medida', () => {
  it('com etapas gravadas, músculo e lado ficam travados com o motivo; "Nova medida" descarta com confirmação e o outro lado sai limpo', async () => {
    const mundo = criarMundo();
    montar(mundo.fabrica);
    await conectarReal();
    await passar(100);
    const campoMusculo = screen.getByRole('combobox', { name: 'Músculo medido' });
    fireEvent.change(campoMusculo, { target: { value: 'Reto femoral' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Direito' }));
    // Sem etapas, nada trava e não há o que descartar.
    expect(campoMusculo).toBeEnabled();
    expect(screen.queryByTestId('canal-travado')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nova medida' })).not.toBeInTheDocument();

    await gravarRepouso();
    await gravarCvm(mundo, 1, 150);
    fireEvent.change(screen.getByLabelText('Observações'), { target: { value: 'Lado direito, sentado' } });

    expect(campoMusculo).toBeDisabled();
    for (const nome of ['Direito', 'Esquerdo', 'Sem lado']) expect(screen.getByRole('radio', { name: nome })).toBeDisabled();
    expect(texto('canal-travado')).toMatch(/Para medir o outro lado, comece uma nova medida/);
    fireEvent.click(screen.getByRole('radio', { name: 'Esquerdo' }));
    expect(screen.getByRole('radio', { name: 'Direito' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Esquerdo' })).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(botao('Salvar no prontuário'));
    await passar(200);
    expect(botao('Salvo no prontuário')).toBeDisabled();

    // Pede confirmação; "Voltar" não descarta nada.
    fireEvent.click(botao('Nova medida'));
    expect(screen.getByTestId('confirmar-nova-medida')).toBeInTheDocument();
    expect(screen.getByTestId('repouso-feito')).toBeInTheDocument();
    fireEvent.click(botao('Não descartar'));
    expect(screen.queryByTestId('confirmar-nova-medida')).not.toBeInTheDocument();
    expect(screen.getByTestId('repouso-feito')).toBeInTheDocument();
    expect(screen.getByTestId('lista-cvm').querySelectorAll('li')).toHaveLength(1);

    fireEvent.click(botao('Nova medida'));
    fireEvent.click(botao('Descartar e começar'));
    await passar(10);
    // Saem as etapas, as observações e o "Salvo"; músculo e lado voltam a poder mudar (e ficam como estavam).
    expect(screen.queryByTestId('repouso-feito')).not.toBeInTheDocument();
    expect(screen.queryByTestId('lista-cvm')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Observações')).toHaveValue('');
    expect(botao('Salvar no prontuário')).toBeDisabled();
    expect(texto('ajuda-salvar')).toMatch(/Grave pelo menos uma etapa/);
    expect(screen.getByText(/O resultado aparece aqui depois da primeira etapa gravada/)).toBeInTheDocument();
    expect(campoMusculo).toBeEnabled();
    expect(campoMusculo).toHaveValue('Reto femoral');
    expect(screen.queryByTestId('canal-travado')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nova medida' })).not.toBeInTheDocument();

    // O outro lado: só o que foi gravado agora vai para o exame, com o rótulo novo.
    fireEvent.click(screen.getByRole('radio', { name: 'Esquerdo' }));
    expect(screen.getByRole('radio', { name: 'Esquerdo' })).toHaveAttribute('aria-checked', 'true');
    await gravarRepouso();
    fireEvent.click(botao('Salvar no prontuário'));
    await passar(200);

    const escritas = h.banco.escritas();
    expect(escritas).toHaveLength(2);
    const lado = (i: number) => (escritas[i].payload as Record<string, Record<string, any>>).dados; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(lado(0).analise.canais[0].lado).toBe('D');
    expect(lado(0).analise.etapas.map((e: { tipo: string }) => e.tipo)).toEqual(['repouso', 'cvm']);
    expect(lado(0).observacoes).toBe('Lado direito, sentado');
    expect(lado(1).analise.canais).toEqual([{ id: '1', musculo: 'Reto femoral', lado: 'E' }]);
    expect(lado(1).analise.etapas.map((e: { tipo: string }) => e.tipo)).toEqual(['repouso']);
    expect(lado(1).analise.resumo.tentativasCvm).toBe(0);
    expect(lado(1).observacoes).toBeUndefined();
  });

  it('enquanto salva, "Nova medida" não deixa descartar', async () => {
    const mundo = criarMundo();
    montar(mundo.fabrica);
    await conectarReal();
    await passar(100);
    await gravarRepouso();
    fireEvent.click(botao('Nova medida'));

    const { liberar } = segurarEscrita();
    fireEvent.click(botao('Salvar no prontuário'));
    await passar(50);
    expect(botao('Descartar e começar')).toBeDisabled();
    liberar();
    await passar(200);
    expect(botao('Descartar e começar')).toBeEnabled();
  });
});

// ---------------------------------------------------------------------------
// Lista de pacientes: erro de leitura, teto e nome acessível
// ---------------------------------------------------------------------------

describe('Eletromiografia: lista de pacientes', () => {
  it('o seletor tem nome acessível: o rótulo "Paciente" dá nome ao combobox, que mostra quem está escolhido', async () => {
    const mundo = criarMundo();
    montar(mundo.fabrica);
    await passar(100);
    const seletor = screen.getByRole('combobox', { name: /^Paciente/ });
    expect(seletor).toHaveTextContent('Ana Souza');
    expect(seletor).toHaveAttribute('aria-labelledby', 'emg-paciente-rotulo');
    expect(document.getElementById('emg-paciente-rotulo')?.textContent).toMatch(/^Paciente/);
  });

  it('falha ao ler os pacientes: diz que não carregou (e não culpa o link), bloqueia salvar com o motivo certo e "Tentar de novo" recarrega', async () => {
    const estado = { falhar: true };
    pacientesComErroDeLeitura(estado);
    const mundo = criarMundo();
    montar(mundo.fabrica, '/eletromiografia?paciente=p1');
    await conectarReal();
    await passar(100);
    await gravarRepouso();

    expect(screen.getByTestId('erro-pacientes').textContent).toMatch(/Não consegui carregar seus pacientes\./);
    expect(screen.queryByTestId('paciente-nao-encontrado')).not.toBeInTheDocument();
    expect(botao('Salvar no prontuário')).toBeDisabled();
    expect(texto('ajuda-salvar')).toMatch(/Não consegui carregar seus pacientes/);
    expect(texto('ajuda-salvar')).not.toMatch(/Escolha um paciente/);
    fireEvent.click(botao('Salvar no prontuário'));
    await passar(100);
    expect(h.banco.escritas()).toHaveLength(0);

    estado.falhar = false;
    fireEvent.click(botao('Tentar de novo'));
    await passar(100);
    expect(screen.queryByTestId('erro-pacientes')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Paciente/ })).toHaveTextContent('Ana Souza');
    expect(botao('Salvar no prontuário')).toBeEnabled();
    fireEvent.click(botao('Salvar no prontuário'));
    await passar(200);
    expect((h.banco.escritas()[0].payload as Record<string, unknown>).paciente_id).toBe('p1');
  });

  it('com a lista no teto de 1000 pacientes avisa que só os primeiros aparecem; com menos, não avisa', async () => {
    for (let i = 0; i < 998; i++) {
      h.banco.tabelas.pacientes.push({ id: `extra-${i}`, nome: `Extra ${i}`, sobrenome: 'Teste', terapeuta_id: 'prof-1', ativo: true });
    }
    expect(h.banco.tabelas.pacientes).toHaveLength(1000);
    const mundo = criarMundo();
    const primeira = montar(mundo.fabrica);
    await passar(100);
    expect(screen.getByTestId('aviso-limite-pacientes').textContent).toBe('Mostrando os primeiros 1000 pacientes.');
    primeira.unmount();
    cleanup();

    h.banco.tabelas.pacientes.pop();
    montar(mundo.fabrica);
    await passar(100);
    expect(screen.getByRole('combobox', { name: /Paciente/ })).toHaveTextContent('Ana Souza');
    expect(screen.queryByTestId('aviso-limite-pacientes')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Salvar de novo: atualiza o mesmo exame ou cria outro
// ---------------------------------------------------------------------------

describe('Eletromiografia: salvar de novo', () => {
  type LinhaExame = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

  it('só observações e visibilidade mudaram depois de salvar: "Atualizar exame salvo" muda a MESMA linha, sem criar outra', async () => {
    const mundo = criarMundo();
    montar(mundo.fabrica);
    await conectarReal();
    await gravarRepouso();
    fireEvent.change(screen.getByLabelText('Observações'), { target: { value: 'Primeira versão' } });
    fireEvent.click(botao('Salvar no prontuário'));
    await passar(200);
    expect(h.banco.tabelas.exames_presenciais).toHaveLength(1);
    const gravada = h.banco.tabelas.exames_presenciais[0] as LinhaExame;
    const idOriginal = gravada.id;
    expect(idOriginal).toBeTruthy();
    const analiseOriginal = JSON.parse(JSON.stringify(gravada.dados.analise));

    fireEvent.change(screen.getByLabelText('Observações'), { target: { value: 'Segunda versão, joelho a 90°' } });
    fireEvent.click(screen.getByRole('switch', { name: 'Mostrar ao cliente' }));
    expect(screen.queryByRole('button', { name: 'Salvar no prontuário' })).not.toBeInTheDocument();
    expect(texto('ajuda-salvar')).toMatch(/Esta medida já está salva no prontuário\. Atualizar muda esse mesmo exame, sem criar outro\./);
    fireEvent.click(botao('Atualizar exame salvo'));
    await passar(200);

    const linhas = h.banco.tabelas.exames_presenciais as LinhaExame[];
    expect(linhas).toHaveLength(1);
    expect(linhas[0].id).toBe(idOriginal);
    expect(linhas[0].dados.observacoes).toBe('Segunda versão, joelho a 90°');
    expect(linhas[0].visivel_paciente).toBe(true);
    expect(Object.keys(linhas[0].dados).sort()).toEqual(['analise', 'observacoes', 'resultado', 'versao_laudo']);
    expect(linhas[0].dados.versao_laudo).toBe(1);
    expect(linhas[0].dados.analise.observacoes).toBe('Segunda versão, joelho a 90°');
    // O sinal é o mesmo: o resto da análise não muda.
    expect({ ...linhas[0].dados.analise, observacoes: undefined }).toEqual({ ...analiseOriginal, observacoes: undefined });
    expect(linhas[0].resumo).toMatch(/^EMG de superfície/);
    expect(linhas[0].paciente_id).toBe('p1');
    expect(linhas[0].data_exame).toBe('2026-11-08');

    const escritas = h.banco.escritas();
    expect(escritas.map((e) => e.tipo)).toEqual(['insert', 'update']);
    expect(escritas[1].tabela).toBe('exames_presenciais');
    expect(escritas[1].filtros).toContainEqual(['eq', 'id', idOriginal]);
    // O update leva só os campos de dados, o resumo e a visibilidade: paciente, profissional, tipo e data ficam como estão.
    expect(Object.keys(escritas[1].payload as object).sort()).toEqual(['dados', 'resumo', 'visivel_paciente']);
    expect(h.sucesso).toHaveBeenLastCalledWith('Eletromiografia atualizada nos exames presenciais do paciente');
    expect(botao('Salvo no prontuário')).toBeDisabled();
    expect(texto('ajuda-salvar')).toMatch(/Salvo no prontuário de Ana Souza/);

    // Tirar a observação também atualiza: o campo some do exame, não fica a frase antiga.
    fireEvent.change(screen.getByLabelText('Observações'), { target: { value: '' } });
    fireEvent.click(botao('Atualizar exame salvo'));
    await passar(200);
    expect(h.banco.tabelas.exames_presenciais).toHaveLength(1);
    // No banco de verdade o JSON não leva campo indefinido: o que vale é a frase antiga não ter ficado.
    expect((h.banco.tabelas.exames_presenciais[0] as LinhaExame).dados.observacoes).toBeUndefined();
    expect((h.banco.tabelas.exames_presenciais[0] as LinhaExame).dados.analise.observacoes).toBeNull();
  });

  it('salvar, trocar de paciente e salvar: são dois exames (um por paciente), sem "Atualizar"', async () => {
    const mundo = criarMundo();
    montar(mundo.fabrica);
    await conectarReal();
    await passar(100);
    await gravarRepouso();
    fireEvent.click(botao('Salvar no prontuário'));
    await passar(200);

    await escolherPacienteNaLista(/Ana Souza/, /Bruno Lima/);
    expect(screen.queryByRole('button', { name: 'Atualizar exame salvo' })).not.toBeInTheDocument();
    expect(botao('Salvar no prontuário')).toBeEnabled();
    fireEvent.click(botao('Salvar no prontuário'));
    await passar(200);

    expect(h.banco.escritas().map((e) => e.tipo)).toEqual(['insert', 'insert']);
    expect((h.banco.tabelas.exames_presenciais as LinhaExame[]).map((l) => l.paciente_id)).toEqual(['p1', 'p2']);
    expect(texto('ajuda-salvar')).toMatch(/Salvo no prontuário de Bruno Lima/);
  });

  it('salvar e depois gravar mais uma etapa: o sinal mudou, então é um exame novo (não sobrescreve o que foi salvo)', async () => {
    const mundo = criarMundo();
    montar(mundo.fabrica);
    await conectarReal();
    await gravarRepouso();
    fireEvent.click(botao('Salvar no prontuário'));
    await passar(200);

    await gravarCvm(mundo, 1, 150);
    expect(screen.queryByRole('button', { name: 'Atualizar exame salvo' })).not.toBeInTheDocument();
    fireEvent.click(botao('Salvar no prontuário'));
    await passar(200);

    const linhas = h.banco.tabelas.exames_presenciais as LinhaExame[];
    expect(h.banco.escritas().map((e) => e.tipo)).toEqual(['insert', 'insert']);
    expect(linhas.map((l) => l.dados.analise.etapas.map((e: { tipo: string }) => e.tipo))).toEqual([['repouso'], ['repouso', 'cvm']]);
  });

  it('atualizar falha no banco: mostra o motivo, não marca "Salvo" e a linha segue como estava; tentar de novo funciona', async () => {
    const mundo = criarMundo();
    montar(mundo.fabrica);
    await conectarReal();
    await gravarRepouso();
    fireEvent.change(screen.getByLabelText('Observações'), { target: { value: 'Antes' } });
    fireEvent.click(botao('Salvar no prontuário'));
    await passar(200);

    fireEvent.change(screen.getByLabelText('Observações'), { target: { value: 'Depois' } });
    h.banco.falharEscritaQuando((op) => op.tipo === 'update', 'permissão negada de mentira');
    h.sucesso.mockClear();
    fireEvent.click(botao('Atualizar exame salvo'));
    await passar(200);
    expect(h.erro).toHaveBeenCalledWith('permissão negada de mentira');
    expect(h.sucesso).not.toHaveBeenCalled();
    expect((h.banco.tabelas.exames_presenciais[0] as LinhaExame).dados.observacoes).toBe('Antes');
    expect(botao('Atualizar exame salvo')).toBeEnabled();
    expect(texto('ajuda-salvar')).not.toMatch(/^Salvo no prontuário/);
    expect(screen.queryByRole('button', { name: 'Salvo no prontuário' })).not.toBeInTheDocument();

    h.banco.falharEscritaQuando(null);
    fireEvent.click(botao('Atualizar exame salvo'));
    await passar(200);
    expect(h.banco.tabelas.exames_presenciais).toHaveLength(1);
    expect((h.banco.tabelas.exames_presenciais[0] as LinhaExame).dados.observacoes).toBe('Depois');
    expect(botao('Salvo no prontuário')).toBeDisabled();
  });

  it('o exame salvo foi excluído do prontuário: o banco não altera nada, a tela avisa em vez de dizer "Salvo" e o próximo toque cria um novo', async () => {
    const mundo = criarMundo();
    montar(mundo.fabrica);
    await conectarReal();
    await gravarRepouso();
    fireEvent.click(botao('Salvar no prontuário'));
    await passar(200);
    h.banco.tabelas.exames_presenciais.splice(0);

    fireEvent.change(screen.getByLabelText('Observações'), { target: { value: 'Nova frase' } });
    fireEvent.click(botao('Atualizar exame salvo'));
    await passar(200);
    expect(h.erro).toHaveBeenCalledWith(expect.stringMatching(/Não encontrei o exame salvo antes/));
    expect(h.banco.tabelas.exames_presenciais).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Salvo no prontuário' })).not.toBeInTheDocument();

    fireEvent.click(botao('Salvar no prontuário'));
    await passar(200);
    expect(h.banco.tabelas.exames_presenciais).toHaveLength(1);
    expect((h.banco.tabelas.exames_presenciais[0] as LinhaExame).dados.observacoes).toBe('Nova frase');
    expect(h.banco.escritas().map((e) => e.tipo)).toEqual(['insert', 'update', 'insert']);
  });
});

// ---------------------------------------------------------------------------
// Foco e gráfico congelado
// ---------------------------------------------------------------------------

describe('Eletromiografia: foco e gráfico congelado', () => {
  it('ao iniciar uma etapa o foco vai para "Cancelar etapa": o botão "Iniciar" que tinha o foco saiu da tela', async () => {
    const mundo = criarMundo();
    montar(mundo.fabrica);
    await conectarReal();
    const iniciar = botao('Iniciar repouso');
    iniciar.focus();
    expect(document.activeElement).toBe(iniciar);

    fireEvent.click(iniciar);
    await passar(300);
    expect(screen.getByTestId('etapa-ativa')).toBeInTheDocument();
    expect(document.activeElement).toBe(botao('Cancelar etapa'));
  });

  it('Nova medida: a confirmação recebe o foco e, ao desistir, o foco volta para "Nova medida"', async () => {
    const mundo = criarMundo();
    montar(mundo.fabrica);
    await conectarReal();
    await gravarRepouso();

    const abrir = botao('Nova medida');
    abrir.focus();
    fireEvent.click(abrir);
    expect(document.activeElement).toBe(botao('Não descartar'));
    fireEvent.click(botao('Não descartar'));
    expect(document.activeElement).toBe(botao('Nova medida'));
  });

  it('congelar e desconectar: o traço congelado continua na tela e a legenda é verdadeira; descongelar mostra "Sem sinal"', async () => {
    const canvas = simularCanvas();
    try {
      const mundo = criarMundo({ fsHz: 500 });
      montar(mundo.fabrica);
      await conectarReal();
      await passar(2000);
      expect(canvas.traco().length).toBeGreaterThan(0);

      fireEvent.click(screen.getByRole('button', { name: /Congelar/ }));
      await passar(200);
      const congelado = canvas.traco();
      expect(congelado.length).toBeGreaterThan(0);

      fireEvent.click(botao('Desconectar'));
      await passar(500);
      expect(texto('estado-modulo')).toContain('Desconectado');
      expect(screen.getByRole('button', { name: /Descongelar/ })).toHaveAttribute('aria-pressed', 'true');
      expect(texto('grafico-legenda')).toMatch(/gráfico congelado/);
      expect(screen.queryByTestId('aviso-sem-sinal')).not.toBeInTheDocument();
      // A mesma foto do sinal, nos mesmos pontos: o traço não sumiu com a taxa do módulo.
      expect(canvas.traco()).toEqual(congelado);

      fireEvent.click(screen.getByRole('button', { name: /Descongelar/ }));
      await passar(200);
      expect(texto('aviso-sem-sinal')).toBe('Sem sinal. Conecte o módulo ou use o modo demonstração.');
      expect(canvas.traco()).toHaveLength(0);
      expect(texto('grafico-legenda')).not.toMatch(/congelado/);
    } finally {
      canvas.restaurar();
    }
  });

  it('reconectar com o gráfico congelado volta ao vivo: o traço novo não nasce parado', async () => {
    const canvas = simularCanvas();
    try {
      const mundo = criarMundo({ fsHz: 500 });
      montar(mundo.fabrica);
      await conectarReal();
      await passar(2000);
      fireEvent.click(screen.getByRole('button', { name: /Congelar/ }));
      fireEvent.click(botao('Desconectar'));
      await passar(500);
      expect(screen.getByRole('button', { name: /Descongelar/ })).toBeInTheDocument();

      await conectarReal();
      await passar(2000);
      expect(screen.getByRole('button', { name: /Congelar/ })).toHaveAttribute('aria-pressed', 'false');
      expect(texto('grafico-legenda')).not.toMatch(/congelado/);
      const agora = canvas.traco();
      expect(agora.length).toBeGreaterThan(0);
      await passar(600);
      expect(canvas.traco()).not.toEqual(agora);
    } finally {
      canvas.restaurar();
    }
  });
});

// ---------------------------------------------------------------------------
// CSV, dados recebidos e ciclo de vida
// ---------------------------------------------------------------------------

describe('Eletromiografia: CSV, dados recebidos e ciclo de vida', () => {
  it('baixa o CSV do sinal com o nome do músculo e a data local no nome do arquivo', async () => {
    const mundo = criarMundo();
    montar(mundo.fabrica);
    await conectarReal();
    fireEvent.change(screen.getByRole('combobox', { name: 'Músculo medido' }), { target: { value: 'Vasto lateral' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Esquerdo' }));
    await gravarRepouso();

    fireEvent.click(botao('Baixar CSV do sinal'));
    expect(h.baixar).toHaveBeenCalledTimes(1);
    const [blob, nome] = h.baixar.mock.calls[0] as [Blob, string];
    expect(nome).toBe('emg-vasto-lateral-e-2026-11-08.csv');
    const leitura = new Promise<string>((resolver, rejeitar) => {
      const leitor = new FileReader();
      leitor.onload = () => resolver(String(leitor.result));
      leitor.onerror = () => rejeitar(leitor.error);
      leitor.readAsText(blob);
    });
    // O FileReader do jsdom termina por timers, que aqui são falsos: avança o relógio para ele acabar.
    await passar(100);
    const conteudo = await leitura;
    const linhas = conteudo.trimEnd().split('\n');
    // O FileReader tira o BOM UTF-8 ao ler como texto; o BOM em si é conferido em emgSessao.test.ts.
    expect(linhas[0]).toBe('etapa;tempo_s;sinal_uV');
    expect(linhas[1]).toMatch(/^repouso_1;0;-?\d/);
    // 5 s a 500 Hz = 2500 amostras, mais o cabeçalho.
    expect(linhas).toHaveLength(2501);
    expect(linhas[2]).toMatch(/^repouso_1;0,002;/);
  });

  it('"Ver dados recebidos" vem recolhido; aberto mostra contadores e quadros em hexadecimal, e Copiar leva o diagnóstico', async () => {
    const mundo = criarMundo();
    montar(mundo.fabrica);
    await conectarReal();
    expect(screen.queryByTestId('contador-quadros')).not.toBeInTheDocument();

    fireEvent.click(botao('Ver dados recebidos'));
    await passar(1200);
    expect(numeroDe(texto('contador-quadros'))).toBeGreaterThan(10);
    expect(texto('contador-invalidos')).toBe('0');
    expect(texto('contador-descartados')).toBe('0');
    expect(texto('contador-lacunas')).toBe('0');
    const hex = texto('quadros-hex').trim().split('\n');
    expect(hex.length).toBeLessThanOrEqual(20);
    expect(hex.length).toBeGreaterThan(0);
    for (const linha of hex) {
      expect(linha).toMatch(/^A5( [0-9A-F]{2})+ 5A$/);
    }
    expect(texto('linhas-servico')).toMatch(/taxa de amostragem: 500 Hz/);

    const escrever = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: escrever }, configurable: true });
    fireEvent.click(botao('Copiar'));
    await passar(50);
    expect(escrever).toHaveBeenCalledTimes(1);
    const copiado = escrever.mock.calls[0][0] as string;
    expect(copiado).toMatch(/^My Health ID: diagnóstico do módulo EMG/);
    expect(copiado).toMatch(/Modo: módulo real/);
    expect(copiado).toMatch(/Taxa de amostragem: 500 Hz \(lida do módulo\)/);
    expect(copiado).toMatch(/Bateria: 77 %/);
    expect(copiado).toMatch(/\n\s*\d+\. A5 /);
    expect(h.sucesso).toHaveBeenCalledWith(expect.stringMatching(/Diagnóstico copiado/));
    expect(screen.queryByTestId('diagnostico-manual')).not.toBeInTheDocument();
  });

  it('Copiar sem permissão da área de transferência não quebra: mostra o texto para copiar à mão', async () => {
    const mundo = criarMundo();
    montar(mundo.fabrica);
    await conectarReal();
    fireEvent.click(botao('Ver dados recebidos'));
    const escrever = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: escrever }, configurable: true });
    fireEvent.click(botao('Copiar'));
    await passar(50);
    expect(escrever).toHaveBeenCalled();
    expect((screen.getByTestId('diagnostico-manual') as HTMLTextAreaElement).value).toMatch(/diagnóstico do módulo EMG/);
    expect(h.erro).toHaveBeenCalledWith(expect.stringMatching(/Não consegui copiar sozinho/));
  });

  it('Copiar funciona mesmo sem aparelho conectado (diagnóstico vazio, sem erro)', async () => {
    const mundo = criarMundo();
    montar(mundo.fabrica);
    await passar(10);
    fireEvent.click(botao('Ver dados recebidos'));
    expect(texto('quadros-hex')).toMatch(/Nenhum quadro recebido ainda/);
    const escrever = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: escrever }, configurable: true });
    fireEvent.click(botao('Copiar'));
    await passar(50);
    const copiado = escrever.mock.calls[0][0] as string;
    expect(copiado).toMatch(/Modo: nenhum/);
    expect(copiado).toMatch(/Módulo: não conectado/);
    expect(copiado).toMatch(/\(nenhum quadro recebido\)/);
  });

  it('desmontar a página desconecta o módulo: manda parar o aparelho e não sobra relógio rodando', async () => {
    const mundo = criarMundo();
    const { unmount, qc } = montar(mundo.fabrica);
    await conectarReal();
    const sim = mundo.simulados[0];
    expect(sim.adquirindo).toBe(true);
    const desconectar = vi.spyOn(mundo.modulos[0], 'desconectar');

    unmount();
    expect(desconectar).toHaveBeenCalledTimes(1);
    await passar(3000);
    // "Parar" (0x11 modo 0) chegou ao aparelho e o serviço soltou o Bluetooth.
    expect(sim.adquirindo).toBe(false);
    expect(mundo.modulos[0].status.estado).toBe('desconectado');
    const recebidos = sim.comandosRecebidos.filter((c) => c[3] === 0x11);
    expect(recebidos[recebidos.length - 1][4]).toBe(0x00);

    // Nenhuma amostra nova chega à tela depois de desmontar.
    const quadros = mundo.modulos[0].quadrosRecebidos;
    await passar(2000);
    expect(mundo.modulos[0].quadrosRecebidos).toBe(quadros);
    sim.pararRelogio();
    qc.clear();
    await passar(1000);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('desmontar durante a demonstração encerra o simulador e deixa zero relógios pendentes', async () => {
    const { unmount, qc } = montar(fabricaPadrao);
    fireEvent.click(botao('Modo demonstração (sem aparelho)'));
    await passar(5000);
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();
    await passar(10_000);
    qc.clear();
    await passar(1000);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('desmontar no meio da preparação da demonstração (módulo ainda carregando) também não vaza', async () => {
    const { unmount, qc } = montar(fabricaPadrao);
    fireEvent.click(botao('Modo demonstração (sem aparelho)'));
    unmount();
    await passar(10_000);
    qc.clear();
    await passar(1000);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ajustes para o teste: padrão 60 Hz e amostra-base ligada; mudar vale na próxima conexão e trava com o módulo conectado', async () => {
    const mundo = criarMundo();
    montar(mundo.fabrica);
    await passar(10);
    fireEvent.click(botao('Ver dados recebidos'));
    expect(screen.getByRole('radio', { name: '60 Hz (Brasil)' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('switch', { name: 'Quadro bruto traz a amostra-base' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('radio', { name: '50 Hz' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Quadro bruto traz a amostra-base' }));

    await conectarReal();
    expect(mundo.ajustesPedidos).toEqual([{ redeHz: 50, incluirPrimeiraAmostra: false }]);
    expect(screen.getByRole('radio', { name: '60 Hz (Brasil)' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Quadro bruto traz a amostra-base' })).toBeDisabled();

    const escrever = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: escrever }, configurable: true });
    fireEvent.click(botao('Copiar'));
    await passar(50);
    expect(escrever.mock.calls[0][0]).toContain('Ajustes de teste: rede elétrica de 50 Hz · amostra-base do quadro bruto NÃO incluída');

    fireEvent.click(botao('Desconectar'));
    await passar(500);
    expect(screen.getByRole('radio', { name: '60 Hz (Brasil)' })).toBeEnabled();
  });

  it('o rodapé de ressalva e o texto de posicionamento estão na página', async () => {
    const mundo = criarMundo();
    montar(mundo.fabrica);
    await passar(10);
    expect(
      screen.getByText(
        'Medida de apoio. Os valores em µV dependem de eletrodo, pele e posicionamento; compare, sempre que possível, em % da CVM do próprio paciente. A interpretação é do profissional.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Pele limpa e seca; posicione os eletrodos conforme a recomendação SENIAM para o músculo.')).toBeInTheDocument();
  });
});
