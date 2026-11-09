import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const nativo = vi.hoisted(() => ({
  ativo: false,
  transporte: { requestDevice: async (): Promise<never> => { throw new Error('plugin nativo de mentira'); } },
}));
vi.mock('../lib/dinamometria/bleNativo', () => ({
  rodandoNoAppNativo: () => nativo.ativo,
  bluetoothNativo: nativo.transporte,
}));

import {
  MAX_QUADROS_HEX,
  ModuloEmg,
  bluetoothDoAmbiente,
  ehIosNoNavegador,
  mensagemSemBluetooth,
  type LoteDeAmostras,
  type OpcoesModuloEmg,
  type StatusModulo,
} from '../lib/emg/moduloEmg';
import {
  ModuloSimulado,
  VERSAO_HARDWARE_SIMULADA,
  VERSAO_SOFTWARE_SIMULADA,
  criarBluetoothSimulado,
  sinalEmgSintetico,
  type BluetoothSimulado,
  type OpcoesModuloSimulado,
} from '../lib/emg/simulador';
import type {
  CaracteristicaBle,
  DispositivoBle,
  EventoValorBle,
  OpcoesRequestDevice,
  ServidorGattBle,
  TransporteBle,
} from '../lib/emg/tiposBle';

// ---------------------------------------------------------------------------
// Apoio: valores e quadros montados a partir da spec (docs/emg-protocolo-runew2.md),
// nunca com as funções do código testado.
// ---------------------------------------------------------------------------

const EPOCA = 1661961600000;
const TS_FIXO = 1_700_000_000_000;

// Exemplos de comando do item 2 da spec.
const CMD_BATERIA = 'AA 03 81 0B 89 BB';
const CMD_TAXA = 'AA 03 81 06 84 BB';
const CMD_FILTRO_DESLIGADO = 'AA 04 80 0F 00 8B BB';
const CMD_VERSAO_HW = 'AA 03 81 01 83 BB';
const CMD_VERSAO_SW = 'AA 03 81 02 80 BB';
// AA 0C 80 11 <modo> <ts 8 bytes BE> XOR BB, com ts = 1_700_000_000_000 = 00 00 01 8B CF E5 68 00.
const CMD_INICIAR = 'AA 0C 80 11 03 00 00 01 8B CF E5 68 00 56 BB';
const CMD_PARAR = 'AA 0C 80 11 00 00 00 01 8B CF E5 68 00 55 BB';

function hex(b: ArrayLike<number>): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

function be48(v: number): number[] {
  const n = BigInt(v);
  const saida: number[] = [];
  for (let s = 40n; s >= 0n; s -= 8n) saida.push(Number((n >> s) & 0xffn));
  return saida;
}

/** A5 LEN ADDR LEN^ADDR corpo... 5A, com LEN = corpo + 2 (total = LEN + 3). */
function quadro(addr: number, corpo: number[]): Uint8Array {
  const len = corpo.length + 2;
  return Uint8Array.from([0xa5, len, addr, len ^ addr, ...corpo, 0x5a]);
}

interface BrutoDaSpec {
  base: number;
  deltas: number[];
  tsEpocaMs: number;
  extra?: boolean;
}

/** Quadro 0x11 modo 3: ts48 (BE, desde a época), float32 LE da base e deltas int16 LE. */
function brutoDaSpec({ base, deltas, tsEpocaMs, extra = true }: BrutoDaSpec): Uint8Array {
  const f = new DataView(new ArrayBuffer(4));
  f.setFloat32(0, base, true);
  const bytesBase = Array.from(new Uint8Array(f.buffer));
  const bytesDeltas = deltas.flatMap((d) => [d & 0xff, (d >> 8) & 0xff]);
  return quadro(0x11, [0x03, ...be48(tsEpocaMs - EPOCA), ...bytesBase, ...bytesDeltas, ...(extra ? [0xee] : [])]);
}

function amplitudeEm(x: ArrayLike<number>, fHz: number, fsHz: number): number {
  let re = 0;
  let im = 0;
  for (let i = 0; i < x.length; i++) {
    const w = (2 * Math.PI * fHz * i) / fsHz;
    re += x[i] * Math.cos(w);
    im -= x[i] * Math.sin(w);
  }
  return (2 * Math.hypot(re, im)) / x.length;
}

function rmsDe(x: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] * x[i];
  return Math.sqrt(s / x.length);
}

function juntar(lotes: LoteDeAmostras[], campo: 'brutas' | 'filtradas'): Float64Array {
  const total = lotes.reduce((n, l) => n + l[campo].length, 0);
  const saida = new Float64Array(total);
  let pos = 0;
  for (const l of lotes) {
    saida.set(l[campo], pos);
    pos += l[campo].length;
  }
  return saida;
}

function maxDiferenca(a: ArrayLike<number>, b: ArrayLike<number>): number {
  expect(a.length).toBe(b.length);
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
  return m;
}

// ---------------------------------------------------------------------------
// Bluetooth com espião: o simulador real por baixo, e por cima o que o teste precisa ver ou provocar.
// ---------------------------------------------------------------------------

type ModoDeEscrita = 'normal' | 'travar' | 'falhar';

class Espiao {
  conexoes = 0;
  pedidosDeDispositivo = 0;
  ultimasOpcoes: OpcoesRequestDevice | null = null;
  falharProximasConexoes = 0;
  ocultarServicos = false;
  atrasoNotificacoesMs = 0;
  duracaoEscritaMs = 0;
  /** O módulo recebe e responde na hora, mas a promessa da escrita só resolve depois disto. */
  demoraParaConfirmarEscritaMs = 0;
  /** Devolve false para descartar o pedaço (nunca chega ao serviço). */
  filtroNotificacao: ((pedaco: Uint8Array) => boolean) | null = null;
  aoEscrever: ((bytes: Uint8Array, tentativa: number) => ModoDeEscrita) | null = null;
  escritas: { bytes: Uint8Array; tMs: number }[] = [];
  escritasSimultaneasMax = 0;
  readonly ouvintesNotificacao = new Set<(ev: EventoValorBle) => void>();
  readonly ouvintesQueda = new Set<(ev: unknown) => void>();
  readonly transporte: TransporteBle;

  private dispositivo: DispositivoBle | null = null;
  private base: DispositivoBle | null = null;
  private tentativas = 0;
  private emAndamento = 0;

  constructor(private readonly bt: BluetoothSimulado) {
    this.transporte = {
      requestDevice: async (opcoes) => {
        this.pedidosDeDispositivo++;
        this.ultimasOpcoes = opcoes;
        return this.envolverDispositivo(await bt.requestDevice(opcoes));
      },
    };
  }

  derrubar(): void {
    this.bt.derrubar();
  }

  /** O GATT do módulo simulado (por baixo do espião) está conectado. */
  get conectado(): boolean {
    return this.base?.gatt.connected ?? false;
  }

  private envolverDispositivo(d: DispositivoBle): DispositivoBle {
    if (this.dispositivo) return this.dispositivo;
    this.base = d;
    const gatt = {
      get connected(): boolean {
        return d.gatt.connected;
      },
      connect: async (): Promise<ServidorGattBle> => {
        this.conexoes++;
        if (this.falharProximasConexoes > 0) {
          this.falharProximasConexoes--;
          throw new Error('falha de conexão de mentira');
        }
        return this.envolverServidor(await d.gatt.connect());
      },
      disconnect: (): void => d.gatt.disconnect(),
    };
    this.dispositivo = {
      get name(): string | undefined {
        return d.name;
      },
      gatt,
      addEventListener: (tipo, ouvinte) => {
        this.ouvintesQueda.add(ouvinte);
        d.addEventListener(tipo, ouvinte);
      },
      removeEventListener: (tipo, ouvinte) => {
        this.ouvintesQueda.delete(ouvinte);
        d.removeEventListener(tipo, ouvinte);
      },
    };
    return this.dispositivo;
  }

  private envolverServidor(s: ServidorGattBle): ServidorGattBle {
    return {
      getPrimaryServices: async () => {
        const servicos = await s.getPrimaryServices();
        if (this.ocultarServicos) return [];
        return servicos.map((sv) => ({
          uuid: sv.uuid,
          getCharacteristics: async () => (await sv.getCharacteristics()).map((c) => this.envolverCaracteristica(c)),
        }));
      },
    };
  }

  private envolverCaracteristica(c: CaracteristicaBle): CaracteristicaBle {
    const proxies = new Map<(ev: EventoValorBle) => void, (ev: EventoValorBle) => void>();
    return {
      get uuid(): string {
        return c.uuid;
      },
      get properties() {
        return c.properties;
      },
      get value(): DataView | undefined {
        return c.value;
      },
      addEventListener: (tipo, ouvinte) => {
        this.ouvintesNotificacao.add(ouvinte);
        const proxy = (ev: EventoValorBle): void => {
          const v = ev.target.value as DataView;
          const bytes = new Uint8Array(v.buffer, v.byteOffset, v.byteLength).slice();
          if (this.filtroNotificacao && !this.filtroNotificacao(bytes)) return;
          const entregar = (): void => ouvinte({ target: { value: new DataView(bytes.buffer) } } as unknown as EventoValorBle);
          if (this.atrasoNotificacoesMs > 0) setTimeout(entregar, this.atrasoNotificacoesMs);
          else entregar();
        };
        proxies.set(ouvinte, proxy);
        c.addEventListener(tipo, proxy);
      },
      removeEventListener: (tipo, ouvinte) => {
        this.ouvintesNotificacao.delete(ouvinte);
        const proxy = proxies.get(ouvinte);
        if (!proxy) return;
        proxies.delete(ouvinte);
        c.removeEventListener(tipo, proxy);
      },
      startNotifications: () => c.startNotifications(),
      writeValue: (dados) => this.escrever(c, dados, false),
      writeValueWithoutResponse: (dados) => this.escrever(c, dados, true),
    };
  }

  private async escrever(c: CaracteristicaBle, dados: Uint8Array, semResposta: boolean): Promise<void> {
    const n = this.tentativas++;
    this.escritas.push({ bytes: Uint8Array.from(dados), tMs: Date.now() });
    const modo = this.aoEscrever ? this.aoEscrever(dados, n) : 'normal';
    if (modo === 'travar') return new Promise<void>(() => undefined);
    if (modo === 'falhar') throw new Error('GATT operation already in progress.');
    this.emAndamento++;
    this.escritasSimultaneasMax = Math.max(this.escritasSimultaneasMax, this.emAndamento);
    try {
      if (this.duracaoEscritaMs > 0) await new Promise<void>((resolve) => setTimeout(resolve, this.duracaoEscritaMs));
      if (semResposta) await c.writeValueWithoutResponse(dados);
      else await c.writeValue(dados);
      if (this.demoraParaConfirmarEscritaMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, this.demoraParaConfirmarEscritaMs));
      }
    } finally {
      this.emAndamento--;
    }
  }
}

// ---------------------------------------------------------------------------
// Cenário: módulo simulado + Bluetooth + serviço, com relógio e esperas controlados pelo teste.
// ---------------------------------------------------------------------------

interface Cenario {
  sim: ModuloSimulado;
  bt: BluetoothSimulado;
  espiao: Espiao;
  modulo: ModuloEmg;
  /** Todas as esperas pedidas pelo serviço, em ms, na ordem. */
  esperas: number[];
  status: StatusModulo[];
}

interface OpcoesCenario {
  sim?: OpcoesModuloSimulado;
  bt?: { nome?: string; latenciaMs?: number };
  servico?: OpcoesModuloEmg;
}

const criados: ModuloEmg[] = [];

function criarCenario(opcoes: OpcoesCenario = {}): Cenario {
  const sim = new ModuloSimulado({ semente: 7, ...opcoes.sim });
  const bt = criarBluetoothSimulado(sim, opcoes.bt);
  const espiao = new Espiao(bt);
  const esperas: number[] = [];
  const modulo = new ModuloEmg({
    bluetooth: espiao.transporte,
    esperar: (ms) => {
      esperas.push(ms);
      return new Promise<void>((resolve) => setTimeout(resolve, ms));
    },
    agora: () => TS_FIXO,
    ...opcoes.servico,
  });
  criados.push(modulo);
  const status: StatusModulo[] = [];
  modulo.onStatus((s) => status.push(s));
  return { sim, bt, espiao, modulo, esperas, status };
}

async function passar(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}

/** Conecta e espera o suficiente para a taxa chegar (~1500 ms). */
async function conectarModulo(c: Cenario): Promise<void> {
  const p = c.modulo.conectar();
  await passar(1600);
  await p;
}

/**
 * Conecta e inicia: o iniciar() espera o filtro do hardware sair (~2000 ms). Termina com o aperto de
 * mão completo, inclusive a leitura das versões (~2750 ms), para nenhuma resposta atrasada atrapalhar.
 */
async function conectarEIniciar(c: Cenario): Promise<void> {
  await conectarModulo(c);
  const p = c.modulo.iniciar();
  await passar(1500);
  await p;
}

/** Manda parar e espera a confirmação do módulo (o simulador responde num timer). */
async function pararModulo(c: Cenario): Promise<void> {
  const p = c.modulo.parar();
  await passar(100);
  await p;
}

/** O módulo simulado produz `ms` de sinal e o Bluetooth entrega. */
async function gerar(c: Cenario, ms: number): Promise<void> {
  c.sim.avancar(ms);
  await passar(0);
}

function coletarLotes(c: Cenario): LoteDeAmostras[] {
  const lotes: LoteDeAmostras[] = [];
  c.modulo.onAmostras((l) => lotes.push(l));
  return lotes;
}

function comandosDoModulo(c: Cenario): string[] {
  return c.sim.comandosRecebidos.map(hex);
}

function estados(c: Cenario): string[] {
  return c.status.map((s) => s.estado);
}

/** Injeta bytes como se o módulo os tivesse notificado (passa pelo espião e pelo Bluetooth simulado). */
function injetar(c: Cenario, bytes: Uint8Array): void {
  c.sim.aoNotificar(bytes);
}

beforeEach(() => {
  vi.useFakeTimers();
  nativo.ativo = false;
});

afterEach(async () => {
  for (const m of criados.splice(0)) m.desconectar();
  await passar(5000);
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete (navigator as unknown as Record<string, unknown>).bluetooth;
  delete (navigator as unknown as Record<string, unknown>).wakeLock;
  delete (document as unknown as Record<string, unknown>).visibilityState;
});

// ---------------------------------------------------------------------------
// Ambiente
// ---------------------------------------------------------------------------

describe('bluetoothDoAmbiente e mensagens', () => {
  it('sem Bluetooth no navegador e fora do app: null', () => {
    expect(bluetoothDoAmbiente()).toBeNull();
  });

  it('no navegador usa navigator.bluetooth', () => {
    const falso = { requestDevice: async () => { throw new Error('x'); } };
    Object.defineProperty(navigator, 'bluetooth', { configurable: true, value: falso });
    expect(bluetoothDoAmbiente()).toBe(falso);
  });

  it('no app nativo usa o plugin, mesmo que o navegador tivesse Bluetooth', () => {
    Object.defineProperty(navigator, 'bluetooth', { configurable: true, value: { requestDevice: async () => { throw new Error('x'); } } });
    nativo.ativo = true;
    expect(bluetoothDoAmbiente()).toBe(nativo.transporte);
  });

  it('a mensagem do iPhone no navegador cita o Bluefy; nos demais, o Chrome', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
    );
    expect(ehIosNoNavegador()).toBe(true);
    expect(mensagemSemBluetooth()).toMatch(/iPhone/);
    expect(mensagemSemBluetooth()).toMatch(/Bluefy/);
    nativo.ativo = true;
    expect(ehIosNoNavegador()).toBe(false);
    nativo.ativo = false;
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0');
    expect(ehIosNoNavegador()).toBe(false);
    expect(mensagemSemBluetooth()).toMatch(/Chrome/);
    expect(mensagemSemBluetooth()).not.toMatch(/iPhone/);
  });

  it('criar o serviço não toca no Bluetooth; opções inválidas são recusadas', () => {
    expect(() => new ModuloEmg()).not.toThrow();
    expect(() => new ModuloEmg({ redeHz: 55 as unknown as 50 })).toThrow(RangeError);
    const m = new ModuloEmg();
    expect(m.status).toEqual({ estado: 'desconectado' });
    expect(m.taxaHz).toBeNull();
    expect(m.bateriaPct).toBeNull();
    expect(m.hardware).toBeNull();
    expect(m.versaoHw).toBeNull();
    expect(m.versaoSw).toBeNull();
    expect(m.quadrosRecebidos).toBe(0);
    expect(m.ultimosQuadrosHex).toEqual([]);
    expect(m.diagnostico).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Conexão
// ---------------------------------------------------------------------------

describe('ModuloEmg: fluxo de conexão', () => {
  it('procura pelo prefixo do nome e pede os serviços fff0 e de bateria', async () => {
    const c = criarCenario();
    await conectarModulo(c);
    expect(c.espiao.ultimasOpcoes).toEqual({
      filters: [{ namePrefix: 'RunE W2' }],
      optionalServices: ['0000fff0-0000-1000-8000-00805f9b34fb', '0000180f-0000-1000-8000-00805f9b34fb'],
    });
  });

  it('manda bateria, taxa e filtro do hardware desligado, nesta ordem e nos tempos da spec; depois as versões', async () => {
    const c = criarCenario();
    const t0 = Date.now();
    const p = c.modulo.conectar();
    await passar(999);
    expect(c.espiao.escritas).toHaveLength(0);
    await passar(1601);
    await p;
    await passar(1500);

    expect(comandosDoModulo(c)).toEqual([CMD_BATERIA, CMD_TAXA, CMD_FILTRO_DESLIGADO, CMD_VERSAO_HW, CMD_VERSAO_SW]);
    const tempos = c.espiao.escritas.map((e) => e.tMs - t0);
    expect(tempos[0]).toBeGreaterThanOrEqual(1000);
    expect(tempos[0]).toBeLessThan(1100);
    expect(tempos[1]).toBeGreaterThanOrEqual(1500);
    expect(tempos[1]).toBeLessThan(1600);
    expect(tempos[2]).toBeGreaterThanOrEqual(2000);
    expect(tempos[2]).toBeLessThan(2100);
  });

  it('conectar() resolve quando a taxa chega (cerca de 1,5 s), não aos 4 s', async () => {
    const c = criarCenario({ sim: { fsHz: 1000 } });
    let resolvido = false;
    const p = c.modulo.conectar().then(() => {
      resolvido = true;
    });
    await passar(1490);
    expect(resolvido).toBe(false);
    expect(c.modulo.status.estado).toBe('conectando');
    await passar(110);
    expect(resolvido).toBe(true);
    await p;
    expect(c.modulo.status).toEqual({ estado: 'conectado', nome: 'RunE W2 1' });
    expect(estados(c)).toEqual(['conectando', 'conectando', 'conectado']);
  });

  it.each([500, 1000] as const)('lê a taxa de %i Hz do módulo e não a marca como suposição', async (fs) => {
    const c = criarCenario({ sim: { fsHz: fs } });
    await conectarModulo(c);
    expect(c.modulo.taxaHz).toBe(fs);
    expect(c.modulo.taxaAssumida).toBe(false);
  });

  it('lê a bateria, avisa quem assinou e, depois, as versões de hardware e de software', async () => {
    const c = criarCenario({ sim: { bateriaPct: 73 } });
    const avisos: number[] = [];
    c.modulo.onBateria((pct) => avisos.push(pct));
    await conectarModulo(c);
    expect(c.modulo.bateriaPct).toBe(73);
    expect(avisos).toEqual([73]);
    expect(c.modulo.versaoHw).toBeNull();
    await passar(1500);
    expect(c.modulo.versaoHw).toBe(VERSAO_HARDWARE_SIMULADA);
    expect(c.modulo.versaoSw).toBe(VERSAO_SOFTWARE_SIMULADA);
  });

  it('sem resposta de taxa: aos 4 s assume 500 Hz e marca "taxa assumida" no diagnóstico', async () => {
    const c = criarCenario({ sim: { fsHz: 1000 } });
    c.espiao.filtroNotificacao = () => false;
    let resolvido = false;
    const p = c.modulo.conectar().then(() => {
      resolvido = true;
    });
    await passar(3999);
    expect(resolvido).toBe(false);
    await passar(1);
    expect(resolvido).toBe(true);
    await p;
    expect(c.modulo.taxaHz).toBe(500);
    expect(c.modulo.taxaAssumida).toBe(true);
    expect(c.modulo.diagnostico.some((l) => l.includes('taxa assumida'))).toBe(true);
    expect(c.modulo.status.estado).toBe('conectado');
  });

  it('uma resposta de taxa que chega tarde corrige a suposição', async () => {
    const c = criarCenario();
    c.espiao.filtroNotificacao = () => false;
    const p = c.modulo.conectar();
    await passar(4000);
    await p;
    expect(c.modulo.taxaHz).toBe(500);
    // A5 LEN=04 ADDR=06 CHK payload=[1] extra 5A: taxa 1000 Hz.
    injetar(c, quadro(0x06, [0x01, 0x00]));
    c.espiao.filtroNotificacao = null;
    injetar(c, quadro(0x06, [0x01, 0x00]));
    expect(c.modulo.taxaHz).toBe(1000);
    expect(c.modulo.taxaAssumida).toBe(false);
  });

  it('conectar() duas vezes seguidas é uma conexão só; já conectado, não faz nada', async () => {
    const c = criarCenario();
    const a = c.modulo.conectar();
    const b = c.modulo.conectar();
    expect(b).toBe(a);
    await passar(1600);
    await Promise.all([a, b]);
    expect(c.espiao.pedidosDeDispositivo).toBe(1);
    await c.modulo.conectar();
    expect(c.espiao.pedidosDeDispositivo).toBe(1);
    expect(c.espiao.conexoes).toBe(1);
  });

  it('sem transporte informado, usa o do ambiente; no app nativo, o plugin', async () => {
    const sim = new ModuloSimulado({ semente: 7 });
    const espiao = new Espiao(criarBluetoothSimulado(sim));
    Object.defineProperty(navigator, 'bluetooth', { configurable: true, value: espiao.transporte });
    const noNavegador = new ModuloEmg();
    criados.push(noNavegador);
    const p = noNavegador.conectar();
    await passar(1600);
    await p;
    expect(espiao.pedidosDeDispositivo).toBe(1);
    expect(noNavegador.status.estado).toBe('conectado');
    expect(noNavegador.taxaHz).toBe(1000);
    noNavegador.desconectar();

    nativo.ativo = true;
    const noApp = new ModuloEmg();
    const erro = await noApp.conectar().then(
      () => null,
      (e: unknown) => e as Error,
    );
    expect(erro?.message).toMatch(/plugin nativo de mentira/);
    expect(espiao.pedidosDeDispositivo).toBe(1);
  });

  it('com os padrões (setTimeout e Date.now) o aperto de mão é o mesmo e o iniciar leva a hora do relógio', async () => {
    vi.setSystemTime(1_750_000_000_000);
    const sim = new ModuloSimulado({ semente: 7 });
    const modulo = new ModuloEmg({ bluetooth: criarBluetoothSimulado(sim) });
    criados.push(modulo);
    const p = modulo.conectar();
    await passar(1600);
    await p;
    const i = modulo.iniciar();
    await passar(700);
    await i;
    expect(sim.comandosRecebidos.slice(0, 3).map(hex)).toEqual([CMD_BATERIA, CMD_TAXA, CMD_FILTRO_DESLIGADO]);
    const inicio = sim.comandosRecebidos[3];
    expect(Array.from(inicio.subarray(0, 5))).toEqual([0xaa, 0x0c, 0x80, 0x11, 0x03]);
    let ts = 0;
    for (const b of inicio.subarray(5, 13)) ts = ts * 256 + b;
    // O comando sai logo depois do filtro, em ~2000 ms de relógio simulado.
    expect(ts).toBeGreaterThanOrEqual(1_750_000_002_000);
    expect(ts).toBeLessThan(1_750_000_002_200);
  });

  it('só um ouvinte de notificação e um de queda enquanto conectado', async () => {
    const c = criarCenario();
    await conectarModulo(c);
    expect(c.espiao.ouvintesNotificacao.size).toBe(1);
    expect(c.espiao.ouvintesQueda.size).toBe(1);
  });
});

describe('ModuloEmg: falhas ao conectar', () => {
  async function falha(c: Cenario, ate = 1600): Promise<Error> {
    const r = c.modulo.conectar().then(
      () => new Error('não falhou'),
      (e: unknown) => e as Error,
    );
    await passar(ate);
    return r;
  }

  it('sem Bluetooth: recusa com a mensagem para o usuário e registra no status', async () => {
    const m = new ModuloEmg({ bluetooth: null });
    const erro = await m.conectar().then(
      () => null,
      (e: unknown) => e as Error,
    );
    expect(erro?.message).toBe(mensagemSemBluetooth());
    expect(m.status).toEqual({ estado: 'desconectado', erro: mensagemSemBluetooth() });
  });

  it('no iPhone sem o app, a mensagem é a do iPhone', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1');
    const m = new ModuloEmg();
    const erro = await m.conectar().then(
      () => null,
      (e: unknown) => e as Error,
    );
    expect(erro?.message).toMatch(/iPhone/);
    expect(erro?.message).toMatch(/Bluefy/);
  });

  it('nenhum módulo com esse nome (ou lista fechada): mensagem clara, volta a desconectado', async () => {
    const c = criarCenario({ bt: { nome: 'Outro aparelho' } });
    const erro = await falha(c);
    expect(erro.message).toMatch(/Nenhum módulo foi escolhido/);
    expect(c.modulo.status).toEqual({ estado: 'desconectado', erro: erro.message });
    expect(estados(c)).toEqual(['conectando', 'desconectado']);
  });

  it('falha ao ligar o GATT: rejeita, desconecta e deixa o erro no status', async () => {
    const c = criarCenario();
    c.espiao.falharProximasConexoes = 1;
    const erro = await falha(c);
    expect(erro.message).toMatch(/Não consegui conectar ao módulo: falha de conexão de mentira/);
    expect(c.modulo.status.estado).toBe('desconectado');
    expect(c.modulo.status.erro).toBe(erro.message);
    expect(c.espiao.ouvintesQueda.size).toBe(0);
    await passar(60_000);
    expect(c.espiao.conexoes).toBe(1);
  });

  it('o módulo não mostra o serviço fff0: explica e anota no diagnóstico', async () => {
    const c = criarCenario();
    c.espiao.ocultarServicos = true;
    const erro = await falha(c);
    expect(erro.message).toMatch(/fff0/);
    expect(c.modulo.status.estado).toBe('desconectado');
    expect(c.modulo.diagnostico.join('\n')).toMatch(/nenhum serviço encontrado/);
  });

  it('a conexão cai durante a configuração: falha, sem reconectar sozinho', async () => {
    const c = criarCenario();
    const r = c.modulo.conectar().then(
      () => new Error('não falhou'),
      (e: unknown) => e as Error,
    );
    await passar(1200);
    c.espiao.derrubar();
    await passar(100);
    const erro = await r;
    expect(erro.message).toMatch(/caiu durante a configuração/);
    expect(c.modulo.status.estado).toBe('desconectado');
    await passar(60_000);
    expect(c.espiao.conexoes).toBe(1);
    expect(c.espiao.ouvintesNotificacao.size).toBe(0);
    expect(c.espiao.ouvintesQueda.size).toBe(0);
  });

  it('desconectar() no meio do conectar() cancela, sem deixar conexão nem ouvinte', async () => {
    const c = criarCenario();
    const r = c.modulo.conectar().then(
      () => new Error('não falhou'),
      (e: unknown) => e as Error,
    );
    await passar(700);
    c.modulo.desconectar();
    const erro = await r;
    expect(erro.message).toMatch(/cancelada/i);
    await passar(60_000);
    expect(c.modulo.status).toEqual({ estado: 'desconectado' });
    expect(c.espiao.ouvintesNotificacao.size).toBe(0);
    expect(c.espiao.ouvintesQueda.size).toBe(0);
    expect(c.espiao.conexoes).toBe(1);
    expect(c.espiao.escritas).toHaveLength(0);
  });

  it('um conectar() novo depois de cancelar o antigo com desconectar() vale, e o antigo falha sozinho', async () => {
    const c = criarCenario();
    const antigo = c.modulo.conectar().then(
      () => new Error('não falhou'),
      (e: unknown) => e as Error,
    );
    await passar(500);
    c.modulo.desconectar();
    const novo = c.modulo.conectar();
    expect(novo).not.toBe(antigo);
    await passar(1700);
    await novo;
    expect((await antigo).message).toMatch(/cancelada/i);
    expect(c.modulo.status).toEqual({ estado: 'conectado', nome: 'RunE W2 1' });
    expect(c.espiao.ouvintesNotificacao.size).toBe(1);
    expect(c.espiao.ouvintesQueda.size).toBe(1);
    expect(c.modulo.taxaHz).toBe(1000);
  });

  it('depois de uma falha dá para conectar de novo, com contadores e diagnóstico novos', async () => {
    const c = criarCenario();
    c.espiao.falharProximasConexoes = 1;
    await falha(c);
    expect(c.modulo.diagnostico.length).toBeGreaterThan(0);
    await conectarModulo(c);
    expect(c.modulo.status.estado).toBe('conectado');
    expect(c.modulo.status.erro).toBeUndefined();
    expect(c.modulo.diagnostico.join('\n')).not.toMatch(/falha de conexão de mentira/);
  });

  it('reconectar é recusado enquanto o serviço religa sozinho', async () => {
    const c = criarCenario();
    await conectarModulo(c);
    c.espiao.falharProximasConexoes = 99;
    c.espiao.derrubar();
    await passar(0);
    expect(c.modulo.status.estado).toBe('reconectando');
    await expect(c.modulo.conectar()).rejects.toThrow(/reconectando/);
  });
});

// ---------------------------------------------------------------------------
// Iniciar e parar
// ---------------------------------------------------------------------------

describe('ModuloEmg: iniciar e parar', () => {
  it('iniciar() manda o 0x11 modo 3 com o relógio injetado, direto: nada de pedir o tipo 0x1D', async () => {
    const c = criarCenario();
    await conectarEIniciar(c);
    const cmds = comandosDoModulo(c);
    expect(cmds).toContain(CMD_INICIAR);
    expect(c.sim.comandosRecebidos.some((b) => b[3] === 0x1d)).toBe(false);
    expect(c.sim.adquirindo).toBe(true);
    expect(c.modulo.status.estado).toBe('adquirindo');
  });

  it('o 0x11 só sai quando o usuário pede, e depois do filtro do hardware', async () => {
    const c = criarCenario();
    const p = c.modulo.conectar();
    await passar(5000);
    await p;
    expect(c.sim.comandosRecebidos.some((b) => b[3] === 0x11)).toBe(false);
    expect(c.modulo.status.estado).toBe('conectado');

    const c2 = criarCenario();
    await conectarModulo(c2); // ~1500 ms: o filtro ainda não saiu
    expect(comandosDoModulo(c2)).toEqual([CMD_BATERIA, CMD_TAXA]);
    const p2 = c2.modulo.iniciar();
    await passar(700);
    await p2;
    expect(comandosDoModulo(c2).slice(0, 4)).toEqual([CMD_BATERIA, CMD_TAXA, CMD_FILTRO_DESLIGADO, CMD_INICIAR]);
  });

  it('iniciar() sem conexão recusa; parar() sem conexão não faz nada', async () => {
    const m = new ModuloEmg({ bluetooth: null });
    await expect(m.iniciar()).rejects.toThrow(/Conecte ao módulo/);
    await expect(m.parar()).resolves.toBeUndefined();
    await expect(m.perguntarTipoDeHardware()).rejects.toThrow(/Conecte/);
  });

  it('iniciar() duas vezes seguidas manda um comando só; já adquirindo não repete', async () => {
    const c = criarCenario();
    await conectarModulo(c);
    const a = c.modulo.iniciar();
    const b = c.modulo.iniciar();
    expect(b).toBe(a);
    await passar(700);
    await Promise.all([a, b]);
    await c.modulo.iniciar();
    expect(comandosDoModulo(c).filter((h) => h === CMD_INICIAR)).toHaveLength(1);
  });

  it('parar() manda o comando de parar, volta a "conectado" e o módulo para', async () => {
    const c = criarCenario();
    await conectarEIniciar(c);
    const p = c.modulo.parar();
    await passar(100);
    await p;
    expect(comandosDoModulo(c)).toContain(CMD_PARAR);
    expect(c.sim.adquirindo).toBe(false);
    expect(c.modulo.status.estado).toBe('conectado');
    expect(estados(c).slice(-2)).toEqual(['adquirindo', 'conectado']);
  });

  it('depois de parar() nenhuma amostra é entregue, nem as de quadros que ainda estavam a caminho', async () => {
    const c = criarCenario();
    const lotes = coletarLotes(c);
    await conectarEIniciar(c);
    await gerar(c, 500);
    const antes = lotes.length;
    expect(antes).toBe(10);
    await pararModulo(c);
    await passar(100);
    const recebidos = c.modulo.quadrosRecebidos;
    injetar(c, brutoDaSpec({ base: 1, deltas: [1, 2, 3], tsEpocaMs: EPOCA + 600_000 }));
    expect(lotes).toHaveLength(antes);
    expect(c.modulo.quadrosRecebidos).toBe(recebidos + 1);
  });

  it('parar() chamado antes de o iniciar() ter começado cancela o início', async () => {
    const c = criarCenario();
    await conectarModulo(c);
    const iniciando = c.modulo.iniciar();
    await passar(100);
    const parando = c.modulo.parar();
    await passar(1000);
    await Promise.all([iniciando, parando]);
    expect(c.sim.comandosRecebidos.some((b) => b[3] === 0x11 && b[4] === 0x03)).toBe(false);
    expect(c.modulo.status.estado).toBe('conectado');
    expect(c.sim.adquirindo).toBe(false);
  });

  it('dá para iniciar de novo depois de parar: o módulo recomeça e o filtro do app é zerado', async () => {
    const c = criarCenario();
    const lotes = coletarLotes(c);
    await conectarEIniciar(c);
    const degrau = (i: number) => brutoDaSpec({ base: 1000, deltas: new Array(49).fill(0), tsEpocaMs: EPOCA + 1_000_000 + i * 50 });
    injetar(c, degrau(0));
    injetar(c, degrau(1));
    const primeiro = lotes[0].filtradas.slice();
    const segundo = lotes[1].filtradas.slice();
    expect(maxDiferenca(primeiro, segundo)).toBeGreaterThan(1); // com estado, o 2º quadro não repete o 1º

    await pararModulo(c);
    await passar(100);
    const p = c.modulo.iniciar();
    await passar(100);
    await p;
    injetar(c, degrau(2));
    expect(c.sim.adquirindo).toBe(true);
    expect(maxDiferenca(lotes[2].filtradas, primeiro)).toBeLessThan(1e-9);
  });

  it('quando a escrita do iniciar falha, iniciar() rejeita e o estado volta a "conectado"', async () => {
    const c = criarCenario();
    await conectarModulo(c);
    c.espiao.aoEscrever = (bytes) => (bytes[3] === 0x11 ? 'falhar' : 'normal');
    const r = c.modulo.iniciar().then(
      () => new Error('não falhou'),
      (e: unknown) => e as Error,
    );
    await passar(1000);
    const erro = await r;
    expect(erro.message).toMatch(/GATT operation already in progress/);
    expect(c.modulo.status.estado).toBe('conectado');
    expect(c.sim.adquirindo).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Amostras
// ---------------------------------------------------------------------------

describe('ModuloEmg: amostras brutas e filtradas', () => {
  it.each([
    [1000, true],
    [500, true],
    [1000, false],
    [500, false],
  ] as const)('a %i Hz (byte extra antes do 5A: %s) as brutas reproduzem o sinal do módulo', async (fs, extra) => {
    const c = criarCenario({ sim: { fsHz: fs, comByteAntesDoFim: extra, semente: 11 } });
    const lotes = coletarLotes(c);
    await conectarEIniciar(c);
    await gerar(c, 2000);

    const referencia = sinalEmgSintetico({ fsHz: fs, duracaoS: 2, semente: 11 });
    const brutas = juntar(lotes, 'brutas');
    expect(brutas.length).toBe(referencia.length);
    // Quantização da spec: um degrau de 1/3,1457 µV, erro de até meio degrau.
    expect(maxDiferenca(brutas, referencia)).toBeLessThan(0.2);
    for (const l of lotes) {
      expect(l.fsHz).toBe(fs);
      expect(l.filtradas.length).toBe(l.brutas.length);
    }
    expect(lotes).toHaveLength(c.sim.quadrosEmitidos);
  });

  it('com incluirPrimeiraAmostra desligado descarta a amostra-base de cada quadro', async () => {
    const c = criarCenario({ sim: { semente: 3 }, servico: { incluirPrimeiraAmostra: false } });
    const lotes = coletarLotes(c);
    await conectarEIniciar(c);
    await gerar(c, 1000);
    const referencia = sinalEmgSintetico({ fsHz: 1000, duracaoS: 1, semente: 3 });
    const esperado = referencia.filter((_, i) => i % 50 !== 0);
    expect(lotes.every((l) => l.brutas.length === 49 && l.filtradas.length === 49)).toBe(true);
    expect(maxDiferenca(juntar(lotes, 'brutas'), esperado)).toBeLessThan(0.2);
  });

  it('decodifica um quadro montado à mão: base float32 e deltas em contagens de 3,1457', async () => {
    const c = criarCenario();
    const lotes = coletarLotes(c);
    await conectarEIniciar(c);
    // 31457 / 3,1457 = 10000 µV
    injetar(c, brutoDaSpec({ base: 0.5, deltas: [31457, -31457, 0], tsEpocaMs: EPOCA + 123_456 }));
    expect(lotes).toHaveLength(1);
    expect(Array.from(lotes[0].brutas)).toEqual([0.5, expect.closeTo(10000.5, 6), expect.closeTo(0.5, 6), expect.closeTo(0.5, 6)]);
    expect(lotes[0].tsMs).toBe(EPOCA + 123_456);
    expect(lotes[0].fsHz).toBe(1000);
    expect(lotes[0].filtradas).toHaveLength(4);
  });

  it('o carimbo entregue é o do quadro, no relógio do módulo (época + ms)', async () => {
    const c = criarCenario();
    const lotes = coletarLotes(c);
    await conectarEIniciar(c);
    await gerar(c, 100);
    // Quadros de 50 amostras a 1000 Hz: o último ponto do 1º quadro é o de índice 49 (49 ms).
    expect(lotes.map((l) => l.tsMs)).toEqual([EPOCA + 49, EPOCA + 99]);
  });

  it('os dois sinais vêm sempre do mesmo tamanho, mesmo em quadros de 1 amostra', async () => {
    const c = criarCenario();
    const lotes = coletarLotes(c);
    await conectarEIniciar(c);
    injetar(c, brutoDaSpec({ base: 5, deltas: [], tsEpocaMs: EPOCA + 10 }));
    injetar(c, brutoDaSpec({ base: 5, deltas: [3], tsEpocaMs: EPOCA + 12 }));
    expect(lotes.map((l) => [l.brutas.length, l.filtradas.length])).toEqual([[1, 1], [2, 2]]);
  });

  it('o filtro do app tira o nível contínuo e mantém as brutas intactas', async () => {
    const c = criarCenario();
    const lotes = coletarLotes(c);
    await conectarEIniciar(c);
    for (let i = 0; i < 60; i++) {
      injetar(c, brutoDaSpec({ base: 1000, deltas: new Array(49).fill(0), tsEpocaMs: EPOCA + 1_000_000 + i * 50 }));
    }
    const ultimo = lotes[lotes.length - 1];
    expect(Math.min(...ultimo.brutas)).toBe(1000);
    expect(Math.max(...ultimo.brutas)).toBe(1000);
    expect(Math.max(...Array.from(ultimo.filtradas, Math.abs))).toBeLessThan(2);
  });

  describe.each([500, 1000] as const)('rede de 60 Hz a %i Hz', (fs) => {
    async function medir(servico: OpcoesModuloEmg = {}) {
      const c = criarCenario({ sim: { fsHz: fs, redeUv: 300, semente: 21 }, servico });
      const lotes = coletarLotes(c);
      await conectarEIniciar(c);
      await gerar(c, 5000);
      // Janela de 2 s com ciclos inteiros de 60 Hz, depois do transiente do filtro.
      const de = 2 * fs;
      const ate = 4 * fs;
      const brutas = juntar(lotes, 'brutas').subarray(de, ate);
      const filtradas = juntar(lotes, 'filtradas').subarray(de, ate);
      return { brutas, filtradas };
    }

    it('as filtradas atenuam a rede e as brutas a preservam', async () => {
      const { brutas, filtradas } = await medir();
      const bruta = amplitudeEm(brutas, 60, fs);
      const filtrada = amplitudeEm(filtradas, 60, fs);
      expect(bruta).toBeGreaterThan(285);
      expect(bruta).toBeLessThan(315);
      expect(filtrada).toBeLessThan(0.02 * bruta);
    });

    it('com a rede configurada para 50 Hz o 60 Hz passa (a opção chega ao filtro)', async () => {
      const { brutas, filtradas } = await medir({ redeHz: 50 });
      const bruta = amplitudeEm(brutas, 60, fs);
      const filtrada = amplitudeEm(filtradas, 60, fs);
      expect(filtrada).toBeGreaterThan(0.8 * bruta);
    });
  });

  it('o filtro não apaga o sinal útil: o RMS da contração filtrada fica perto do bruto', async () => {
    const c = criarCenario({ sim: { ruidoBasalUv: 0.5 } });
    c.sim.contrair(1, 2, 400);
    const lotes = coletarLotes(c);
    await conectarEIniciar(c);
    await gerar(c, 4000);
    const brutas = juntar(lotes, 'brutas').subarray(1500, 2500);
    const filtradas = juntar(lotes, 'filtradas').subarray(1500, 2500);
    const razao = rmsDe(filtradas) / rmsDe(brutas);
    expect(razao).toBeGreaterThan(0.85);
    expect(razao).toBeLessThan(1.05);
  });
});

// ---------------------------------------------------------------------------
// Fragmentação, lixo e quadros inválidos
// ---------------------------------------------------------------------------

describe('ModuloEmg: remontagem e quadros ruins', () => {
  it.each([1, 7, 20, 244])('o MTU de %i bytes não muda o resultado', async (mtu) => {
    const c = criarCenario({ sim: { mtu, semente: 5 } });
    const lotes = coletarLotes(c);
    await conectarEIniciar(c);
    await gerar(c, 1000);
    expect(c.modulo.bytesDescartados).toBe(0);
    expect(c.modulo.quadrosInvalidos).toBe(0);
    expect(lotes).toHaveLength(20);
    expect(maxDiferenca(juntar(lotes, 'brutas'), sinalEmgSintetico({ fsHz: 1000, duracaoS: 1, semente: 5 }))).toBeLessThan(0.2);
  });

  it('quadros colados num pedaço só e quadros fatiados byte a byte são lidos igual', async () => {
    const c = criarCenario();
    const lotes = coletarLotes(c);
    await conectarEIniciar(c);
    const q1 = brutoDaSpec({ base: 1, deltas: [10, 10], tsEpocaMs: EPOCA + 100 });
    const q2 = brutoDaSpec({ base: 2, deltas: [20], tsEpocaMs: EPOCA + 200, extra: false });
    const colados = new Uint8Array(q1.length + q2.length);
    colados.set(q1, 0);
    colados.set(q2, q1.length);
    injetar(c, colados);
    expect(lotes.map((l) => l.brutas.length)).toEqual([3, 2]);
    for (const b of q1) injetar(c, Uint8Array.of(b));
    expect(lotes.map((l) => l.brutas.length)).toEqual([3, 2, 3]);
    expect(c.modulo.bytesDescartados).toBe(0);
    expect(c.modulo.quadrosRecebidos).toBeGreaterThanOrEqual(3);
  });

  it('lixo entre quadros conta em bytesDescartados e não derruba nem estraga o quadro seguinte', async () => {
    const c = criarCenario();
    const lotes = coletarLotes(c);
    await conectarEIniciar(c);
    const antes = c.modulo.bytesDescartados;
    const bom = brutoDaSpec({ base: 7, deltas: [0, 0], tsEpocaMs: EPOCA + 500 });
    const lixo = Uint8Array.of(0x00, 0x13, 0x37, 0xff, 0x00);
    const misturado = new Uint8Array(lixo.length + bom.length);
    misturado.set(lixo, 0);
    misturado.set(bom, lixo.length);
    injetar(c, misturado);
    expect(c.modulo.bytesDescartados - antes).toBe(5);
    expect(lotes).toHaveLength(1);
    expect(Array.from(lotes[0].brutas)).toEqual([7, 7, 7]);
    expect(c.modulo.status.estado).toBe('adquirindo');
    expect(c.modulo.diagnostico.some((l) => l.includes('fora de quadro'))).toBe(true);
  });

  it('A5 falso (cabeçalho que não bate) também é lixo e o quadro bom que vem junto sobrevive', async () => {
    const c = criarCenario();
    const lotes = coletarLotes(c);
    await conectarEIniciar(c);
    const antes = c.modulo.bytesDescartados;
    const bom = brutoDaSpec({ base: 3, deltas: [], tsEpocaMs: EPOCA + 40 });
    const falso = Uint8Array.of(0xa5, 0x20, 0x11, 0x00); // LEN^ADDR não bate com o 4º byte
    const misturado = new Uint8Array(falso.length + bom.length);
    misturado.set(falso, 0);
    misturado.set(bom, falso.length);
    injetar(c, misturado);
    expect(c.modulo.bytesDescartados - antes).toBe(4);
    expect(lotes).toHaveLength(1);
  });

  it('quadro com moldura boa e conteúdo estranho conta em quadrosInvalidos e a captura segue', async () => {
    const c = criarCenario();
    const lotes = coletarLotes(c);
    await conectarEIniciar(c);
    const recebidosAntes = c.modulo.quadrosRecebidos;
    // 0x11 com modo 0x07: não existe na spec.
    injetar(c, quadro(0x11, [0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]));
    // Bruto curto demais: modo 3 sem espaço para o float32.
    injetar(c, quadro(0x11, [0x03, 0x00, 0x00]));
    // Taxa com código fora de 0/1.
    injetar(c, quadro(0x06, [0x09, 0x00]));
    expect(c.modulo.quadrosInvalidos).toBe(3);
    expect(c.modulo.quadrosRecebidos).toBe(recebidosAntes + 3);
    expect(c.modulo.taxaHz).toBe(1000);
    injetar(c, brutoDaSpec({ base: 1, deltas: [1], tsEpocaMs: EPOCA + 700 }));
    expect(lotes).toHaveLength(1);
    expect(c.modulo.status.estado).toBe('adquirindo');
    expect(c.modulo.diagnostico.some((l) => l.includes('quadro inválido'))).toBe(true);
  });

  it('o diagnóstico não se enche: um defeito repetido aparece poucas vezes, mas o contador conta todos', async () => {
    const c = criarCenario();
    await conectarEIniciar(c);
    for (let i = 0; i < 50; i++) injetar(c, quadro(0x11, [0x07, 0x00]));
    expect(c.modulo.quadrosInvalidos).toBe(50);
    const linhas = c.modulo.diagnostico.filter((l) => l.startsWith('quadro inválido: modo de aquisição desconhecido'));
    expect(linhas).toHaveLength(3);
    expect(c.modulo.diagnostico.some((l) => l.includes('não serão listadas'))).toBe(true);
  });

  it('quadro bruto de EEG não vira amostra de EMG', async () => {
    const c = criarCenario();
    const lotes = coletarLotes(c);
    await conectarEIniciar(c);
    // modo 4 = EEG
    const eeg = brutoDaSpec({ base: 1, deltas: [1, 2], tsEpocaMs: EPOCA + 100 });
    eeg[4] = 0x04;
    injetar(c, eeg);
    expect(lotes).toHaveLength(0);
    expect(c.modulo.quadrosInvalidos).toBe(0);
  });

  it('notificação sem valor ou ouvinte quebrado não escapa para o Bluetooth', async () => {
    const c = criarCenario();
    await conectarEIniciar(c);
    expect(() => {
      for (const ouvinte of c.espiao.ouvintesNotificacao) {
        ouvinte({ target: {} } as unknown as EventoValorBle);
        ouvinte({ target: undefined } as unknown as EventoValorBle);
        ouvinte(undefined as unknown as EventoValorBle);
      }
    }).not.toThrow();
    expect(c.modulo.status.estado).toBe('adquirindo');
  });
});

// ---------------------------------------------------------------------------
// ACK e fila de escrita
// ---------------------------------------------------------------------------

describe('ModuloEmg: ACK e fila de escrita', () => {
  function acompanhar(p: Promise<unknown>): { resolvido: boolean } {
    const estado = { resolvido: false };
    void p.then(() => {
      estado.resolvido = true;
    });
    return estado;
  }

  it('parar() resolve assim que o módulo confirma, sem esperar o limite de 1,5 s', async () => {
    const c = criarCenario();
    await conectarEIniciar(c);
    const p = acompanhar(c.modulo.parar());
    await passar(50);
    expect(p.resolvido).toBe(true);
    expect(c.modulo.diagnostico.some((l) => l.includes('não respondeu'))).toBe(false);
  });

  it('ACK com atraso: resolve quando chega, não antes', async () => {
    const c = criarCenario();
    await conectarEIniciar(c);
    c.espiao.atrasoNotificacoesMs = 700;
    const p = acompanhar(c.modulo.parar());
    await passar(650);
    expect(p.resolvido).toBe(false);
    await passar(100);
    expect(p.resolvido).toBe(true);
    expect(c.modulo.diagnostico.some((l) => l.includes('não respondeu'))).toBe(false);
  });

  it('o ACK que chega antes de a escrita terminar também vale', async () => {
    const c = criarCenario();
    await conectarEIniciar(c);
    c.espiao.demoraParaConfirmarEscritaMs = 200;
    const p = acompanhar(c.modulo.parar());
    await passar(150);
    expect(p.resolvido).toBe(false);
    await passar(100);
    expect(p.resolvido).toBe(true);
    expect(c.modulo.diagnostico.some((l) => l.includes('não respondeu'))).toBe(false);
  });

  it('sem ACK: resolve aos 1,5 s, anota no diagnóstico e não trava', async () => {
    const c = criarCenario();
    await conectarEIniciar(c);
    c.espiao.filtroNotificacao = () => false;
    const p = acompanhar(c.modulo.parar());
    await passar(1400);
    expect(p.resolvido).toBe(false);
    await passar(200);
    expect(p.resolvido).toBe(true);
    expect(c.modulo.diagnostico.some((l) => l.includes('0x11') && l.includes('não respondeu'))).toBe(true);
    expect(c.modulo.status.estado).toBe('conectado');
  });

  it('esperar o ACK não trava a fila: o comando seguinte sai logo, sem esperar os 1,5 s', async () => {
    const c = criarCenario();
    await conectarModulo(c);
    await passar(3500);
    c.espiao.filtroNotificacao = () => false;
    const antes = c.espiao.escritas.length;
    const iniciando = c.modulo.iniciar();
    await passar(100);
    const parando = c.modulo.parar();
    await passar(200);
    const novas = c.espiao.escritas.slice(antes);
    expect(novas.map((e) => hex(e.bytes))).toEqual([CMD_INICIAR, CMD_PARAR]);
    expect(novas[1].tMs - novas[0].tMs).toBeLessThan(300);
    await passar(3000);
    await Promise.all([iniciando, parando]);
  });

  it('um quadro de outro endereço não vale como ACK; um quadro de dados do mesmo endereço vale', async () => {
    const c = criarCenario();
    await conectarEIniciar(c);
    // Só as confirmações curtas do 0x11 somem; quadros de dados continuam chegando.
    c.espiao.filtroNotificacao = (pedaco) => !(pedaco[0] === 0xa5 && pedaco[2] === 0x11 && pedaco.length <= 8);
    const p = acompanhar(c.modulo.parar());
    await passar(300);
    injetar(c, quadro(0x0b, [0, 0, 0, 0, 0, 0, 50, 0])); // bateria: outro ADDR
    await passar(300);
    expect(p.resolvido).toBe(false);
    injetar(c, brutoDaSpec({ base: 1, deltas: [1], tsEpocaMs: EPOCA + 900 })); // ADDR 0x11: serve de ACK
    await passar(10);
    expect(p.resolvido).toBe(true);
  });

  it('escrita que não responde não trava a fila: repete e o comando chega uma vez só', async () => {
    const c = criarCenario();
    await conectarEIniciar(c);
    const alvo = c.espiao.escritas.length; // índice da próxima tentativa de escrita
    c.espiao.aoEscrever = (_b, tentativa) => (tentativa === alvo ? 'travar' : 'normal');
    const p = c.modulo.parar();
    await passar(1400);
    expect(c.sim.comandosRecebidos.map(hex)).not.toContain(CMD_PARAR);
    await passar(300);
    await p;
    expect(c.sim.comandosRecebidos.map(hex).filter((h) => h === CMD_PARAR)).toHaveLength(1);
    expect(c.modulo.diagnostico.some((l) => l.includes('a escrita não respondeu'))).toBe(true);
    // E a fila continua andando.
    const p2 = c.modulo.iniciar();
    await passar(300);
    await p2;
    expect(c.sim.adquirindo).toBe(true);
  });

  it('escrita que falha duas vezes funciona na 3ª; falhando as 3, rejeita e a fila segue livre', async () => {
    const c = criarCenario();
    await conectarModulo(c);
    await passar(3500);
    const base = c.espiao.escritas.length;
    c.espiao.aoEscrever = (_b, t) => (t - base < 2 ? 'falhar' : 'normal');
    const ok = c.modulo.parar();
    await passar(400);
    await ok;
    expect(c.sim.comandosRecebidos.map(hex).filter((h) => h === CMD_PARAR)).toHaveLength(1);
    expect(c.modulo.diagnostico.filter((l) => l.includes('tentativa')).length).toBeGreaterThanOrEqual(2);

    const base2 = c.espiao.escritas.length;
    c.espiao.aoEscrever = (_b, t) => (t - base2 < 3 ? 'falhar' : 'normal');
    const r = c.modulo.parar().then(
      () => new Error('não falhou'),
      (e: unknown) => e as Error,
    );
    await passar(1000);
    expect((await r).message).toMatch(/Não consegui mandar o módulo parar: GATT operation already in progress/);
    // Nada ficou preso na fila.
    c.espiao.aoEscrever = null;
    const depois = c.modulo.parar();
    await passar(300);
    await expect(depois).resolves.toBeUndefined();
    expect(c.sim.comandosRecebidos.map(hex).filter((h) => h === CMD_PARAR)).toHaveLength(2);
  });

  it('nunca há duas escritas ao mesmo tempo: a fila é serial', async () => {
    const c = criarCenario();
    c.espiao.duracaoEscritaMs = 30;
    await conectarModulo(c);
    await passar(1000);
    const a = c.modulo.iniciar();
    const b = c.modulo.parar();
    const d = c.modulo.perguntarTipoDeHardware();
    await passar(3000);
    await Promise.allSettled([a, b, d]);
    expect(c.espiao.escritas.length).toBeGreaterThanOrEqual(5);
    expect(c.espiao.escritasSimultaneasMax).toBe(1);
  });

  it('mesmo com a escrita lenta, as escritas saem na ordem em que foram pedidas', async () => {
    const c = criarCenario();
    c.espiao.duracaoEscritaMs = 200;
    const p = c.modulo.conectar();
    await passar(3500);
    await p;
    expect(c.sim.comandosRecebidos.map(hex).slice(0, 3)).toEqual([CMD_BATERIA, CMD_TAXA, CMD_FILTRO_DESLIGADO]);
  });
});

// ---------------------------------------------------------------------------
// Queda e reconexão
// ---------------------------------------------------------------------------

describe('ModuloEmg: queda de conexão', () => {
  it('queda durante a aquisição: reconecta, refaz o aperto de mão e retoma; as amostras voltam', async () => {
    const c = criarCenario({ sim: { semente: 9 } });
    const lotes = coletarLotes(c);
    await conectarEIniciar(c);
    await gerar(c, 200);
    expect(lotes).toHaveLength(4);
    c.esperas.length = 0;
    const comandosAntes = c.sim.comandosRecebidos.length;

    c.espiao.derrubar();
    await passar(0);
    expect(c.modulo.status.estado).toBe('reconectando');
    expect(c.modulo.status.nome).toBe('RunE W2 1');
    c.sim.avancar(1000); // o módulo continua e os quadros do intervalo se perdem
    await passar(3000);

    expect(c.modulo.status.estado).toBe('adquirindo');
    expect(c.esperas[0]).toBe(500);
    const novos = c.sim.comandosRecebidos.slice(comandosAntes).map(hex);
    expect(novos).toEqual([CMD_BATERIA, CMD_TAXA, CMD_FILTRO_DESLIGADO, CMD_INICIAR]);

    const antes = lotes.length;
    await gerar(c, 200);
    expect(lotes.length - antes).toBe(4);
    expect(estados(c).slice(-3)).toEqual(['adquirindo', 'reconectando', 'adquirindo']);
    expect(c.espiao.ouvintesNotificacao.size).toBe(1);
    expect(c.espiao.ouvintesQueda.size).toBe(1);
    // O salto do carimbo no intervalo perdido é só um aviso, sem mexer no sinal.
    expect(c.modulo.lacunasSuspeitas).toBe(1);
    expect(lotes.every((l) => l.brutas.length === 50 && l.filtradas.every(Number.isFinite))).toBe(true);
  });

  it('queda enquanto o iniciar() espera o filtro do hardware: ele falha e, ao voltar, fica só conectado', async () => {
    const c = criarCenario();
    await conectarModulo(c);
    const r = c.modulo.iniciar().then(
      () => new Error('não falhou'),
      (e: unknown) => e as Error,
    );
    await passar(100);
    c.espiao.derrubar();
    await passar(100);
    expect((await r).message).toBe('Sem conexão com o módulo.');
    await passar(6000);
    expect(c.modulo.status.estado).toBe('conectado');
    expect(c.sim.comandosRecebidos.some((b) => b[3] === 0x11)).toBe(false);
    expect(c.sim.adquirindo).toBe(false);
  });

  it('queda sem aquisição: volta a "conectado" e não manda iniciar', async () => {
    const c = criarCenario();
    await conectarModulo(c);
    await passar(3000);
    const antes = c.sim.comandosRecebidos.length;
    c.espiao.derrubar();
    await passar(3500);
    expect(c.modulo.status.estado).toBe('conectado');
    const novos = c.sim.comandosRecebidos.slice(antes).map(hex);
    expect(novos).toEqual([CMD_BATERIA, CMD_TAXA, CMD_FILTRO_DESLIGADO]);
    expect(estados(c).slice(-3)).toEqual(['conectado', 'reconectando', 'conectado']);
  });

  it('o filtro é zerado depois da reconexão', async () => {
    const c = criarCenario();
    const lotes = coletarLotes(c);
    await conectarEIniciar(c);
    const degrau = (i: number) => brutoDaSpec({ base: 1000, deltas: new Array(49).fill(0), tsEpocaMs: EPOCA + 2_000_000 + i * 50 });
    injetar(c, degrau(0));
    injetar(c, degrau(1));
    const fresco = lotes[0].filtradas.slice();
    expect(maxDiferenca(fresco, lotes[1].filtradas)).toBeGreaterThan(1);
    c.espiao.derrubar();
    await passar(3500);
    expect(c.modulo.status.estado).toBe('adquirindo');
    injetar(c, degrau(2));
    expect(maxDiferenca(lotes[2].filtradas, fresco)).toBeLessThan(1e-9);
  });

  it('parar() que falhou na escrita e depois a queda do link: a reconexão manda o parar que faltou', async () => {
    const c = criarCenario();
    await conectarEIniciar(c);
    let falharParar = true;
    c.espiao.aoEscrever = (b) => (falharParar && b[3] === 0x11 && b[4] === 0x00 ? 'falhar' : 'normal');
    const r = c.modulo.parar().then(
      () => new Error('não falhou'),
      (e: unknown) => e as Error,
    );
    await passar(1000);
    expect((await r).message).toMatch(/Não consegui mandar o módulo parar/);
    expect(c.sim.adquirindo).toBe(true);

    falharParar = false;
    c.espiao.derrubar();
    await passar(4000);
    expect(c.modulo.status.estado).toBe('conectado');
    expect(c.sim.adquirindo).toBe(false);
    expect(comandosDoModulo(c).filter((h) => h === CMD_PARAR)).toHaveLength(1);
    expect(comandosDoModulo(c).filter((h) => h === CMD_INICIAR)).toHaveLength(1);
  });

  it('desconectar() durante a escrita do iniciar: o módulo para e a conexão seguinte começa limpa, sem parar de graça', async () => {
    const c = criarCenario();
    c.espiao.duracaoEscritaMs = 40;
    await conectarModulo(c);
    await passar(3000);
    const p = c.modulo.iniciar().then(
      () => 'ok',
      () => 'rejeitou',
    );
    await passar(5);
    c.modulo.desconectar();
    await passar(2000);
    await p;
    expect(c.sim.adquirindo).toBe(false);
    expect(c.modulo.status.estado).toBe('desconectado');
    // Nova conexão sem iniciar: desconectar() não manda parar (o campo não ficou ligado).
    const antes = comandosDoModulo(c).filter((h) => h === CMD_PARAR).length;
    await conectarModulo(c);
    await passar(3000);
    c.modulo.desconectar();
    await passar(2000);
    expect(comandosDoModulo(c).filter((h) => h === CMD_PARAR).length).toBe(antes);
  });

  it('espera crescente de 0,5 s a 8 s e desiste depois de 12 tentativas, avisando no status', async () => {
    const c = criarCenario();
    await conectarEIniciar(c);
    c.esperas.length = 0;
    c.espiao.falharProximasConexoes = 999;
    const conexoesAntes = c.espiao.conexoes;
    c.espiao.derrubar();
    await passar(200_000);
    expect(c.esperas).toEqual([500, 1000, 2000, 4000, 8000, 8000, 8000, 8000, 8000, 8000, 8000, 8000]);
    expect(c.espiao.conexoes - conexoesAntes).toBe(12);
    expect(c.modulo.status.estado).toBe('desconectado');
    expect(c.modulo.status.erro).toMatch(/12 tentativas/);
    expect(c.modulo.diagnostico.filter((l) => l.includes('falhou')).length).toBe(12);
    expect(c.espiao.ouvintesQueda.size).toBe(0);
    expect(c.espiao.ouvintesNotificacao.size).toBe(0);
    await passar(100_000);
    expect(c.espiao.conexoes - conexoesAntes).toBe(12);
  });

  it('reconecta na 3ª tentativa depois de 0,5 s, 1 s e 2 s de espera', async () => {
    const c = criarCenario();
    await conectarEIniciar(c);
    c.esperas.length = 0;
    c.espiao.falharProximasConexoes = 2;
    c.espiao.derrubar();
    await passar(10_000);
    expect(c.esperas.slice(0, 3)).toEqual([500, 1000, 2000]);
    expect(c.modulo.status.estado).toBe('adquirindo');
    expect(c.modulo.status.erro).toBeUndefined();
  });

  it('serviço ausente na reconexão conta como tentativa perdida e tenta de novo', async () => {
    const c = criarCenario();
    await conectarModulo(c);
    await passar(3000);
    c.espiao.ocultarServicos = true;
    c.espiao.derrubar();
    await passar(1700);
    expect(c.modulo.status.estado).toBe('reconectando');
    expect(c.modulo.diagnostico.some((l) => l.includes('tentativa 1 de 12 falhou'))).toBe(true);
    c.espiao.ocultarServicos = false;
    await passar(10_000);
    expect(c.modulo.status.estado).toBe('conectado');
  });

  it('parar() durante a reconexão cancela a retomada automática', async () => {
    const c = criarCenario();
    await conectarEIniciar(c);
    c.espiao.derrubar();
    await passar(100);
    expect(c.modulo.status.estado).toBe('reconectando');
    await c.modulo.parar();
    await passar(5000);
    expect(c.modulo.status.estado).toBe('conectado');
    expect(c.sim.comandosRecebidos.filter((b) => b[3] === 0x11 && b[4] === 0x03)).toHaveLength(1);
    // O módulo seguia adquirindo durante a queda: ao voltar, o serviço manda parar.
    expect(comandosDoModulo(c)).toContain(CMD_PARAR);
    expect(c.sim.adquirindo).toBe(false);
  });

  it('a conexão cai de novo durante o aperto de mão da reconexão: tenta mais uma vez', async () => {
    const c = criarCenario();
    await conectarEIniciar(c);
    c.esperas.length = 0;
    c.espiao.derrubar();
    await passar(500 + 1200);
    expect(c.espiao.conexoes).toBe(2);
    c.espiao.derrubar();
    await passar(60_000);
    expect(c.modulo.status.estado).toBe('adquirindo');
    expect(c.espiao.conexoes).toBe(3);
    expect(c.modulo.diagnostico.some((l) => l.includes('caiu de novo'))).toBe(true);
  });

  /**
   * Derruba a conexão uma vez e deixa a reconexão chegar ao comando 0x11 (aperto de mão: 0,5 s de espera
   * + 2 s; a escrita sai por volta de 2,54 s), com as notificações bloqueadas para o ACK nunca chegar.
   * Quem chama derruba de novo, dentro da janela de 1,5 s do ACK.
   */
  async function reconexaoComAckPendente(c: Cenario, aoEscreverComando: (b: Uint8Array) => boolean): Promise<void> {
    c.espiao.filtroNotificacao = () => false;
    c.espiao.derrubar();
    await passar(500 + 2000 + 300);
    expect(c.espiao.conexoes).toBe(2);
    expect(c.modulo.status.estado).toBe('reconectando');
    expect(c.sim.comandosRecebidos.slice(-1).every(aoEscreverComando)).toBe(true);
  }

  it('a conexão cai de novo com o ACK da reconexão pendente: não registra "reconectado" e tenta outra vez', async () => {
    const c = criarCenario();
    await conectarEIniciar(c);
    await reconexaoComAckPendente(c, (b) => hex(b) === CMD_INICIAR);

    c.espiao.derrubar();
    c.espiao.filtroNotificacao = null;
    await passar(60_000);

    expect(c.espiao.conexoes).toBe(3);
    expect(c.espiao.conectado).toBe(true);
    expect(c.modulo.status.estado).toBe('adquirindo');
    expect(c.modulo.diagnostico.some((l) => l.includes('reconectado na tentativa 1'))).toBe(false);
    expect(c.modulo.diagnostico.some((l) => l.includes('reconectado na tentativa 2'))).toBe(true);
    const lotes = coletarLotes(c);
    await gerar(c, 100);
    expect(lotes).toHaveLength(2);
    expect(c.modulo.quadrosRecebidos).toBeGreaterThan(0);
  });

  it('a conexão cai com o ACK da reconexão pendente e não volta mais: desiste, sem ficar "adquirindo" com a sessão morta', async () => {
    const c = criarCenario();
    await conectarEIniciar(c);
    await reconexaoComAckPendente(c, (b) => hex(b) === CMD_INICIAR);

    c.espiao.falharProximasConexoes = 999;
    c.espiao.derrubar();
    await passar(300_000);

    // A 1ª tentativa (a do ACK pendente) conta como perdida: 1 conexão original + 12 tentativas.
    expect(c.espiao.conexoes).toBe(13);
    expect(c.modulo.status.estado).toBe('desconectado');
    expect(c.modulo.status.erro).toMatch(/12 tentativas/);
    expect(c.espiao.conectado).toBe(false);
    expect(c.espiao.ouvintesQueda.size).toBe(0);
    expect(c.espiao.ouvintesNotificacao.size).toBe(0);
  });

  it('a conexão cai com o ACK do "parar" da reconexão pendente: a retomada manda "parar" de novo na próxima', async () => {
    const c = criarCenario();
    await conectarEIniciar(c);
    c.espiao.filtroNotificacao = () => false;
    c.espiao.derrubar();
    await passar(100);
    expect(c.modulo.status.estado).toBe('reconectando');
    await c.modulo.parar();
    c.espiao.filtroNotificacao = null;
    await reconexaoComAckPendente(c, (b) => hex(b) === CMD_PARAR);

    c.espiao.derrubar();
    await passar(60_000);

    // Sem a confirmação o parar não vale como entregue: a tentativa seguinte manda de novo.
    expect(c.espiao.conexoes).toBe(3);
    expect(c.espiao.conectado).toBe(true);
    expect(c.modulo.status.estado).toBe('conectado');
    expect(c.sim.comandosRecebidos.filter((b) => hex(b) === CMD_PARAR)).toHaveLength(2);
    expect(c.sim.adquirindo).toBe(false);
  });
});

describe('ModuloEmg: desconectar()', () => {
  it('não reconecta e tira os ouvintes do Bluetooth', async () => {
    const c = criarCenario();
    await conectarEIniciar(c);
    expect(c.espiao.ouvintesNotificacao.size).toBe(1);
    c.modulo.desconectar();
    expect(c.modulo.status).toEqual({ estado: 'desconectado' });
    expect(c.espiao.ouvintesNotificacao.size).toBe(0);
    expect(c.espiao.ouvintesQueda.size).toBe(0);
    await passar(120_000);
    expect(c.espiao.conexoes).toBe(1);
    expect(c.espiao.pedidosDeDispositivo).toBe(1);
    expect(estados(c).slice(-2)).toEqual(['adquirindo', 'desconectado']);
  });

  it('adquirindo: manda "parar" antes de soltar o Bluetooth', async () => {
    const c = criarCenario();
    await conectarEIniciar(c);
    expect(c.espiao.conectado).toBe(true);
    c.modulo.desconectar();
    await passar(100);
    expect(comandosDoModulo(c)).toContain(CMD_PARAR);
    expect(c.sim.adquirindo).toBe(false);
    expect(c.espiao.conectado).toBe(false);
  });

  it('parar() e desconectar() em seguida (desmonte da tela): o "parar" sai mesmo assim e o módulo para', async () => {
    const c = criarCenario();
    await conectarEIniciar(c);
    expect(c.sim.adquirindo).toBe(true);
    const r = c.modulo.parar().then(
      () => 'ok',
      (e: unknown) => (e as Error).message,
    );
    c.modulo.desconectar();
    await passar(3000);
    expect(c.sim.adquirindo).toBe(false);
    expect(comandosDoModulo(c).filter((h) => h === CMD_PARAR)).toHaveLength(1);
    expect(c.espiao.conectado).toBe(false);
    expect(c.modulo.status).toEqual({ estado: 'desconectado' });
    expect(await r).toBe('ok');
  });

  it('parar() já em escrita quando o desconectar() chega: a escrita do desconectar() espera a vez (fila serial)', async () => {
    const c = criarCenario();
    await conectarEIniciar(c);
    c.espiao.duracaoEscritaMs = 30;
    const r = c.modulo.parar().then(
      () => 'ok',
      (e: unknown) => (e as Error).message,
    );
    await passar(10);
    c.modulo.desconectar();
    await passar(3000);
    expect(c.sim.adquirindo).toBe(false);
    expect(c.espiao.escritasSimultaneasMax).toBe(1);
    expect(c.espiao.conectado).toBe(false);
    expect(await r).toBe('ok');
  });

  it('parar() já confirmado e depois desconectar(): não manda um 2º "parar"', async () => {
    const c = criarCenario();
    await conectarEIniciar(c);
    await pararModulo(c);
    expect(comandosDoModulo(c).filter((h) => h === CMD_PARAR)).toHaveLength(1);
    c.modulo.desconectar();
    await passar(3000);
    expect(comandosDoModulo(c).filter((h) => h === CMD_PARAR)).toHaveLength(1);
    expect(c.espiao.conectado).toBe(false);
  });

  it('o "parar" do desmonte que nunca responde não segura o Bluetooth por mais de 1,5 s', async () => {
    const c = criarCenario();
    await conectarEIniciar(c);
    c.espiao.aoEscrever = (b) => (hex(b) === CMD_PARAR ? 'travar' : 'normal');
    const r = c.modulo.parar().then(
      () => 'ok',
      (e: unknown) => (e as Error).message,
    );
    c.modulo.desconectar();
    await passar(1400);
    expect(c.espiao.conectado).toBe(true);
    await passar(200);
    expect(c.espiao.conectado).toBe(false);
    expect(await r).toBe('ok');
  });

  it('só conectado (sem aquisição): solta sem mandar nada', async () => {
    const c = criarCenario();
    await conectarModulo(c);
    await passar(3000);
    const antes = c.espiao.escritas.length;
    c.modulo.desconectar();
    expect(c.espiao.conectado).toBe(false);
    await passar(100);
    expect(c.espiao.escritas.length).toBe(antes);
  });

  it('durante a reconexão: cancela e não faz mais tentativas', async () => {
    const c = criarCenario();
    await conectarEIniciar(c);
    c.espiao.falharProximasConexoes = 999;
    c.espiao.derrubar();
    await passar(1600);
    expect(c.modulo.status.estado).toBe('reconectando');
    const antes = c.espiao.conexoes;
    c.modulo.desconectar();
    await passar(200_000);
    expect(c.espiao.conexoes).toBe(antes);
    expect(c.modulo.status).toEqual({ estado: 'desconectado' });
    expect(c.espiao.ouvintesQueda.size).toBe(0);
  });

  it('é seguro chamar de novo, e sem nunca ter conectado', async () => {
    const m = new ModuloEmg({ bluetooth: null });
    expect(() => {
      m.desconectar();
      m.desconectar();
    }).not.toThrow();
    const c = criarCenario();
    await conectarModulo(c);
    c.modulo.desconectar();
    expect(() => c.modulo.desconectar()).not.toThrow();
  });

  it('dá para conectar de novo logo depois, sem a conexão antiga derrubar a nova', async () => {
    const c = criarCenario();
    await conectarEIniciar(c);
    c.modulo.desconectar();
    const p = c.modulo.conectar();
    await passar(1700);
    await p;
    await passar(3000);
    expect(c.modulo.status.estado).toBe('conectado');
    expect(c.espiao.ouvintesNotificacao.size).toBe(1);
    expect(c.espiao.ouvintesQueda.size).toBe(1);
    const lotes = coletarLotes(c);
    const i = c.modulo.iniciar();
    await passar(700);
    await i;
    await gerar(c, 100);
    expect(lotes.length).toBeGreaterThan(0);
  });

  it('os inscritos continuam inscritos depois de desconectar e reconectar', async () => {
    const c = criarCenario();
    const lotes = coletarLotes(c);
    await conectarEIniciar(c);
    c.modulo.desconectar();
    await passar(200);
    await conectarEIniciar(c);
    await gerar(c, 100);
    expect(lotes.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Tipo de hardware (EEG)
// ---------------------------------------------------------------------------

describe('ModuloEmg: módulo de EEG', () => {
  it('se o módulo diz que é de EEG, iniciar() recusa com erro claro e nada é enviado', async () => {
    const c = criarCenario({ sim: { modelo: 'EEG-Module', responderTipoHardware: true } });
    await conectarModulo(c);
    expect(c.modulo.hardware).toBeNull();
    const p = c.modulo.perguntarTipoDeHardware();
    await passar(100);
    expect(await p).toBe('EEG-Module');
    expect(comandosDoModulo(c)).toContain('AA 03 81 1D 9F BB');
    expect(c.modulo.status.erro).toMatch(/Este módulo é de EEG/);

    const erro = await c.modulo.iniciar().then(
      () => null,
      (e: unknown) => e as Error,
    );
    expect(erro?.message).toMatch(/^Este módulo é de EEG/);
    await passar(3000);
    expect(c.sim.comandosRecebidos.some((b) => b[3] === 0x11)).toBe(false);
    expect(c.modulo.status.estado).toBe('conectado');
  });

  it.each([
    [0, false],
    [1, true],
    [2, false],
    [3, true],
  ])('tipo 0x1D = %i: recusa o início? %s', async (codigo, recusa) => {
    const c = criarCenario();
    await conectarModulo(c);
    injetar(c, quadro(0x1d, [codigo, 0x00]));
    expect(c.modulo.hardware).toBe(['EMG-Module', 'EEG-Module', 'EMG-Pro', 'EEG-Pro'][codigo]);
    const r = c.modulo.iniciar().then(
      () => 'iniciou',
      (e: unknown) => (e as Error).message,
    );
    await passar(1000);
    const resultado = await r;
    if (recusa) expect(resultado).toMatch(/Este módulo é de EEG/);
    else expect(resultado).toBe('iniciou');
  });

  it('se o aviso de EEG chega com a aquisição em andamento, ela é parada', async () => {
    const c = criarCenario();
    await conectarEIniciar(c);
    injetar(c, quadro(0x1d, [1, 0x00]));
    await passar(200);
    expect(c.modulo.status.estado).toBe('conectado');
    expect(c.modulo.status.erro).toMatch(/EEG/);
    expect(comandosDoModulo(c)).toContain(CMD_PARAR);
    expect(c.sim.adquirindo).toBe(false);
  });

  it('módulo mudo para a pergunta: devolve null e anota que não respondeu', async () => {
    const c = criarCenario(); // responderTipoHardware falso: o simulador não responde ao 0x1D
    await conectarModulo(c);
    const p = c.modulo.perguntarTipoDeHardware();
    await passar(1700);
    expect(await p).toBeNull();
    expect(c.modulo.diagnostico.some((l) => l.includes('0x1D') && l.includes('não respondeu'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Lacunas de carimbo
// ---------------------------------------------------------------------------

describe('ModuloEmg: lacunas suspeitas', () => {
  it.each([500, 1000] as const)('sem perda a %i Hz: nenhuma lacuna em 10 s', async (fs) => {
    const c = criarCenario({ sim: { fsHz: fs } });
    await conectarEIniciar(c);
    await gerar(c, 10_000);
    expect(c.modulo.lacunasSuspeitas).toBe(0);
    expect(c.modulo.quadrosRecebidos).toBeGreaterThanOrEqual(100);
  });

  it('cada trecho perdido é uma lacuna, e o sinal recebido não é preenchido nem alterado', async () => {
    const c = criarCenario({ sim: { semente: 13 } });
    const lotes = coletarLotes(c);
    await conectarEIniciar(c);
    await gerar(c, 500);
    c.sim.perderQuadros(1);
    await gerar(c, 500);
    c.sim.perderQuadros(3);
    await gerar(c, 500);
    expect(c.sim.quadrosPerdidos).toBe(4);
    expect(c.modulo.lacunasSuspeitas).toBe(2);
    expect(lotes).toHaveLength(30 - 4);
    expect(lotes.every((l) => l.brutas.length === 50)).toBe(true);
    // O que chegou é exatamente o sinal original menos os quadros perdidos.
    const referencia = sinalEmgSintetico({ fsHz: 1000, duracaoS: 1.5, semente: 13 });
    const perdidos = new Set([10, 20, 21, 22]);
    const esperado: number[] = [];
    for (let q = 0; q < 30; q++) {
      if (!perdidos.has(q)) esperado.push(...Array.from(referencia.subarray(q * 50, q * 50 + 50)));
    }
    expect(maxDiferenca(juntar(lotes, 'brutas'), Float64Array.from(esperado))).toBeLessThan(0.2);
    expect(c.modulo.diagnostico.some((l) => l.includes('lacuna suspeita'))).toBe(true);
  });

  it('carimbo que não avança é anotado no diagnóstico, sem contar como lacuna', async () => {
    const c = criarCenario();
    await conectarEIniciar(c);
    injetar(c, brutoDaSpec({ base: 1, deltas: [1], tsEpocaMs: EPOCA + 5000 }));
    injetar(c, brutoDaSpec({ base: 1, deltas: [1], tsEpocaMs: EPOCA + 5000 }));
    expect(c.modulo.lacunasSuspeitas).toBe(0);
    expect(c.modulo.diagnostico.some((l) => l.includes('não avançou'))).toBe(true);
  });

  it('um novo iniciar() recomeça a conta: o 1º quadro da nova aquisição nunca é lacuna', async () => {
    const c = criarCenario();
    await conectarEIniciar(c);
    await gerar(c, 200);
    await pararModulo(c);
    await passar(100);
    c.sim.avancar(60_000);
    const p = c.modulo.iniciar();
    await passar(100);
    await p;
    await gerar(c, 200);
    expect(c.modulo.lacunasSuspeitas).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Diagnóstico
// ---------------------------------------------------------------------------

describe('ModuloEmg: diagnóstico e ouvintes', () => {
  it('ultimosQuadrosHex guarda só os 20 mais recentes, em hexadecimal, iguais ao que onQuadro entregou', async () => {
    const c = criarCenario();
    const vistos: string[] = [];
    c.modulo.onQuadro((h) => vistos.push(h));
    await conectarEIniciar(c);
    await gerar(c, 2000);
    expect(MAX_QUADROS_HEX).toBe(20);
    expect(vistos.length).toBeGreaterThan(40);
    const guardados = c.modulo.ultimosQuadrosHex;
    expect(guardados).toHaveLength(20);
    expect(guardados).toEqual(vistos.slice(-20));
    expect(guardados.every((h) => /^A5( [0-9A-F]{2})+ 5A$/.test(h))).toBe(true);
    // Um quadro bruto de 50 amostras com o byte extra: LEN = 14 + 2·49 = 112 = 0x70; total 115 bytes.
    const ultimo = guardados[19].split(' ');
    expect(ultimo).toHaveLength(115);
    expect(ultimo.slice(0, 3)).toEqual(['A5', '70', '11']);
    expect(ultimo[4]).toBe('03');
  });

  it('ultimosQuadrosHex e diagnostico devolvem cópias: mexer nelas não estraga o serviço', async () => {
    const c = criarCenario();
    await conectarEIniciar(c);
    c.modulo.ultimosQuadrosHex.push('lixo');
    c.modulo.diagnostico.push('lixo');
    expect(c.modulo.ultimosQuadrosHex).not.toContain('lixo');
    expect(c.modulo.diagnostico).not.toContain('lixo');
  });

  it('o diagnóstico lista o serviço e as características que o módulo mostrou', async () => {
    const c = criarCenario();
    await conectarModulo(c);
    const texto = c.modulo.diagnostico.join('\n');
    expect(texto).toMatch(/fff0/);
    expect(texto).toMatch(/fff3 \[writeWithoutResponse\]/);
    expect(texto).toMatch(/fff4 \[notify\]/);
  });

  it('os contadores zeram a cada novo conectar() e atravessam a reconexão', async () => {
    const c = criarCenario();
    await conectarEIniciar(c);
    await gerar(c, 500);
    const antes = c.modulo.quadrosRecebidos;
    expect(antes).toBeGreaterThan(10);
    c.espiao.derrubar();
    await passar(3500);
    expect(c.modulo.quadrosRecebidos).toBeGreaterThanOrEqual(antes);
    c.modulo.desconectar();
    await passar(200);
    const p = c.modulo.conectar();
    await passar(1700);
    await p;
    expect(c.modulo.quadrosRecebidos).toBeLessThan(10);
    expect(c.modulo.lacunasSuspeitas).toBe(0);
    expect(c.modulo.bytesDescartados).toBe(0);
  });

  it('um ouvinte que lança não derruba o serviço nem impede os outros', async () => {
    const c = criarCenario();
    const bons: number[] = [];
    c.modulo.onAmostras(() => {
      throw new Error('ouvinte ruim de amostras');
    });
    c.modulo.onAmostras((l) => bons.push(l.brutas.length));
    c.modulo.onQuadro(() => {
      throw new Error('ouvinte ruim de quadro');
    });
    c.modulo.onBateria(() => {
      throw new Error('ouvinte ruim de bateria');
    });
    c.modulo.onStatus(() => {
      throw new Error('ouvinte ruim de status');
    });
    await conectarEIniciar(c);
    await gerar(c, 200);
    expect(bons).toEqual([50, 50, 50, 50]);
    expect(c.modulo.status.estado).toBe('adquirindo');
    const texto = c.modulo.diagnostico.join('\n');
    expect(texto).toMatch(/ouvinte ruim de amostras/);
    expect(texto).toMatch(/ouvinte ruim de bateria/);
    expect(texto).toMatch(/ouvinte ruim de status/);
  });

  it('cancelar a inscrição funciona, inclusive de dentro do próprio ouvinte', async () => {
    const c = criarCenario();
    let chamadas = 0;
    const cancelar = c.modulo.onAmostras(() => {
      chamadas++;
      cancelar();
    });
    let outras = 0;
    c.modulo.onAmostras(() => {
      outras++;
    });
    await conectarEIniciar(c);
    await gerar(c, 200);
    expect(chamadas).toBe(1);
    expect(outras).toBe(4);
  });

  it('o status que o ouvinte recebe tem nome e erro quando há', async () => {
    const c = criarCenario();
    await conectarEIniciar(c);
    expect(c.status[c.status.length - 1]).toEqual({ estado: 'adquirindo', nome: 'RunE W2 1' });
    expect(c.status.some((s) => s.estado === 'conectando' && s.nome === 'RunE W2 1')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tela ligada
// ---------------------------------------------------------------------------

describe('ModuloEmg: tela ligada enquanto conectado', () => {
  function falsoWakeLock() {
    const liberadores: (() => void)[] = [];
    const sentinelas: { release: ReturnType<typeof vi.fn> }[] = [];
    const request = vi.fn(async () => {
      const sentinela = {
        release: vi.fn(async () => undefined),
        addEventListener: (_tipo: string, fn: () => void) => {
          liberadores.push(fn);
        },
      };
      sentinelas.push(sentinela);
      return sentinela;
    });
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
    return { request, liberadores, sentinelas };
  }

  it('pede a trava ao conectar, pede de novo ao voltar a ficar visível e solta ao desconectar', async () => {
    const wl = falsoWakeLock();
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    const adicionar = vi.spyOn(document, 'addEventListener');
    const remover = vi.spyOn(document, 'removeEventListener');
    const c = criarCenario();
    await conectarModulo(c);
    expect(wl.request).toHaveBeenCalledTimes(1);
    expect(wl.request).toHaveBeenCalledWith('screen');
    expect(adicionar.mock.calls.filter(([t]) => t === 'visibilitychange')).toHaveLength(1);

    // O navegador soltou a trava (tela apagou); ao voltar, o serviço pede outra.
    wl.liberadores[0]();
    document.dispatchEvent(new Event('visibilitychange'));
    await passar(0);
    expect(wl.request).toHaveBeenCalledTimes(2);
    // Com a trava ainda ativa, não pede em dobro.
    document.dispatchEvent(new Event('visibilitychange'));
    await passar(0);
    expect(wl.request).toHaveBeenCalledTimes(2);

    c.modulo.desconectar();
    await passar(0);
    expect(wl.sentinelas[1].release).toHaveBeenCalledTimes(1);
    expect(remover.mock.calls.filter(([t]) => t === 'visibilitychange')).toHaveLength(1);
    // Depois de desconectado, voltar a ficar visível não pede nada.
    document.dispatchEvent(new Event('visibilitychange'));
    await passar(0);
    expect(wl.request).toHaveBeenCalledTimes(2);
    delete (document as unknown as Record<string, unknown>).visibilityState;
  });

  it('mantém a trava durante a reconexão e solta quando desiste', async () => {
    const wl = falsoWakeLock();
    const c = criarCenario();
    await conectarModulo(c);
    c.espiao.falharProximasConexoes = 999;
    c.espiao.derrubar();
    await passar(5000);
    expect(c.modulo.status.estado).toBe('reconectando');
    expect(wl.sentinelas[0].release).not.toHaveBeenCalled();
    await passar(200_000);
    expect(c.modulo.status.estado).toBe('desconectado');
    expect(wl.sentinelas[0].release).toHaveBeenCalledTimes(1);
  });

  it('sem suporte a wake lock tudo segue normal', async () => {
    const c = criarCenario();
    await conectarModulo(c);
    expect(c.modulo.status.estado).toBe('conectado');
  });

  it('wake lock que recusa não atrapalha a conexão', async () => {
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: { request: vi.fn(async () => { throw new Error('NotAllowedError'); }) },
    });
    const c = criarCenario();
    await conectarModulo(c);
    expect(c.modulo.status.estado).toBe('conectado');
  });
});

// ---------------------------------------------------------------------------
// Independência entre instâncias
// ---------------------------------------------------------------------------

describe('ModuloEmg: dois módulos ao mesmo tempo não se misturam', () => {
  it('cada um recebe só o seu sinal, na sua taxa, com seus contadores e sua bateria', async () => {
    const a = criarCenario({ sim: { fsHz: 1000, semente: 101, bateriaPct: 80 }, bt: { nome: 'RunE W2 1' } });
    const b = criarCenario({ sim: { fsHz: 500, semente: 202, bateriaPct: 30, mtu: 244 }, bt: { nome: 'RunE W2 2' } });
    const lotesA = coletarLotes(a);
    const lotesB = coletarLotes(b);

    const pa = a.modulo.conectar();
    const pb = b.modulo.conectar();
    await passar(1600);
    await Promise.all([pa, pb]);
    expect(a.modulo.taxaHz).toBe(1000);
    expect(b.modulo.taxaHz).toBe(500);
    expect(a.modulo.bateriaPct).toBe(80);
    expect(b.modulo.bateriaPct).toBe(30);
    expect(a.modulo.status.nome).toBe('RunE W2 1');
    expect(b.modulo.status.nome).toBe('RunE W2 2');

    // Só o A adquire.
    const ia = a.modulo.iniciar();
    await passar(700);
    await ia;
    await gerar(a, 1000);
    await gerar(b, 1000);
    expect(lotesA).toHaveLength(20);
    expect(lotesB).toHaveLength(0);
    expect(b.sim.adquirindo).toBe(false);
    expect(b.modulo.status.estado).toBe('conectado');
    expect(maxDiferenca(juntar(lotesA, 'brutas'), sinalEmgSintetico({ fsHz: 1000, duracaoS: 1, semente: 101 }))).toBeLessThan(0.2);

    // Agora o B também, e o A segue sem receber o sinal do B.
    const ib = b.modulo.iniciar();
    await passar(700);
    await ib;
    await gerar(a, 1000);
    await gerar(b, 1000);
    expect(lotesA).toHaveLength(40);
    expect(lotesB).toHaveLength(10);
    expect(lotesB.every((l) => l.fsHz === 500)).toBe(true);
    expect(lotesA.every((l) => l.fsHz === 1000)).toBe(true);
    expect(maxDiferenca(juntar(lotesB, 'brutas'), sinalEmgSintetico({ fsHz: 500, duracaoS: 1, semente: 202 }))).toBeLessThan(0.2);

    // Cair e desconectar um não mexe no outro.
    b.espiao.derrubar();
    await passar(100);
    expect(b.modulo.status.estado).toBe('reconectando');
    expect(a.modulo.status.estado).toBe('adquirindo');
    a.modulo.desconectar();
    await passar(3500);
    expect(a.modulo.status.estado).toBe('desconectado');
    expect(b.modulo.status.estado).toBe('adquirindo');
    expect(a.modulo.quadrosRecebidos).not.toBe(b.modulo.quadrosRecebidos);
    expect(a.espiao.ouvintesNotificacao.size).toBe(0);
    expect(b.espiao.ouvintesNotificacao.size).toBe(1);
    expect(b.sim.comandosRecebidos.some((cm) => cm[3] === 0x11 && cm[4] === 0x00)).toBe(false);
  });
});
