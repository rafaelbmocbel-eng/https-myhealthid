import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AcumuladorDeQuadros,
  MODO,
  PREFIXO_NOME,
  UUID_ESCRITA,
  UUID_NOTIFICACAO,
  UUID_SERVICO,
  cmd,
  interpretarQuadro,
  type EventoModulo,
} from '../lib/emg/protocolo';
import { LIMIAR_REDE_ATENCAO, LIMIAR_REDE_RUIM, qualidadeDoSinal } from '../lib/emg/metricas';
import {
  MAX_AMOSTRAS_POR_QUADRO,
  ModuloSimulado,
  VERSAO_HARDWARE_SIMULADA,
  VERSAO_SOFTWARE_SIMULADA,
  criarBluetoothSimulado,
  montarQuadroBruto,
  montarQuadroRms,
  montarResposta,
  sinalEmgSintetico,
} from '../lib/emg/simulador';
import type { CaracteristicaBle, DispositivoBle, EventoValorBle } from '../lib/emg/tiposBle';

// ---------------------------------------------------------------------------
// Apoio: tudo aqui sai da spec (docs/emg-protocolo-runew2.md), não do código testado.
// ---------------------------------------------------------------------------

const EPOCA = 1661961600000;
const PASSO_UV = 1 / 3.1457;
const PASSO_EEG_UV = 1 / 12.5786;

function hex(b: ArrayLike<number>): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

function deHex(s: string): Uint8Array {
  return Uint8Array.from(s.trim().split(/\s+/).map((x) => parseInt(x, 16)));
}

function xorDe(bytes: ArrayLike<number>): number {
  let x = 0;
  for (let i = 0; i < bytes.length; i++) x ^= bytes[i];
  return x;
}

function be48(v: number): number[] {
  const n = BigInt(v);
  const saida: number[] = [];
  for (let s = 40n; s >= 0n; s -= 8n) saida.push(Number((n >> s) & 0xffn));
  return saida;
}

/** AA LEN RW ADDR DATA XOR BB, montado à mão (XOR de LEN até o último DATA). */
function comando(rw: number, addr: number, dados: number[] = []): Uint8Array {
  const len = dados.length + 3;
  const meio = [len, rw, addr, ...dados];
  return Uint8Array.from([0xaa, ...meio, xorDe(meio), 0xbb]);
}

function mulberry32(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rmsDe(x: ArrayLike<number>, ini = 0, fim = x.length): number {
  let soma = 0;
  for (let i = ini; i < fim; i++) soma += x[i] * x[i];
  return Math.sqrt(soma / (fim - ini));
}

function trecho(x: Float64Array, fs: number, deS: number, ateS: number): Float64Array {
  return x.subarray(Math.round(deS * fs), Math.round(ateS * fs));
}

function maxAbs(x: ArrayLike<number>): number {
  let m = 0;
  for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i]));
  return m;
}

/** Amplitude (µV) da componente em fHz, por DFT direta; exata quando o trecho tem ciclos inteiros. */
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

/** Potência média por bin (periodograma) entre fIni e fFim, em passos de 1/duração. */
function potenciaNaBanda(x: ArrayLike<number>, fsHz: number, fIni: number, fFim: number): number {
  const passo = fsHz / x.length;
  let soma = 0;
  let n = 0;
  for (let f = fIni; f <= fFim + 1e-9; f += passo) {
    const a = amplitudeEm(x, f, fsHz);
    soma += (a * a) / 2;
    n++;
  }
  return soma / n;
}

function correlacao(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < a.length; i++) {
    sab += a[i] * b[i];
    saa += a[i] * a[i];
    sbb += b[i] * b[i];
  }
  return sab / Math.sqrt(saa * sbb);
}

type Bruto = Extract<EventoModulo, { tipo: 'bruto' }>;

function decodificar(pedacos: Uint8Array[]): { eventos: EventoModulo[]; descartados: number; pendentes: number } {
  const acumulador = new AcumuladorDeQuadros();
  const eventos: EventoModulo[] = [];
  for (const p of pedacos) {
    for (const q of acumulador.push(p)) eventos.push(interpretarQuadro(q));
  }
  return { eventos, descartados: acumulador.descartados, pendentes: acumulador.pendentes };
}

function brutos(eventos: EventoModulo[]): Bruto[] {
  return eventos.filter((e): e is Bruto => e.tipo === 'bruto');
}

function emendar(quadros: Bruto[]): Float64Array {
  const total = quadros.reduce((n, q) => n + q.amostras.length, 0);
  const saida = new Float64Array(total);
  let pos = 0;
  for (const q of quadros) {
    saida.set(q.amostras, pos);
    pos += q.amostras.length;
  }
  return saida;
}

function ligar(modulo: ModuloSimulado): Uint8Array[] {
  const pedacos: Uint8Array[] = [];
  modulo.aoNotificar = (p) => {
    pedacos.push(p.slice());
  };
  return pedacos;
}

/** 8 bytes big-endian, como o timestamp do comando 0x11. */
function be64(v: number): number[] {
  return [0, 0, ...be48(v)];
}

const INICIAR_EMG = comando(0x80, 0x11, [0x03, ...be64(1700000000000)]);
const PARAR = comando(0x80, 0x11, [0x00, ...be64(1700000001000)]);

/** Comando de leitura do 0x0B com o LEN trocado e o XOR recalculado, para isolar a checagem do LEN. */
function comandoComLenForcado(len: number): Uint8Array {
  const meio = [len, 0x81, 0x0b];
  return Uint8Array.from([0xaa, ...meio, xorDe(meio), 0xbb]);
}

/** Módulo já adquirindo, com os pedaços coletados (sem o ack do início). */
function moduloAdquirindo(opcoes: ConstructorParameters<typeof ModuloSimulado>[0] = {}): {
  modulo: ModuloSimulado;
  pedacos: Uint8Array[];
} {
  const modulo = new ModuloSimulado(opcoes);
  const pedacos = ligar(modulo);
  modulo.receberComando(INICIAR_EMG);
  pedacos.length = 0;
  return { modulo, pedacos };
}

function emitirTudo(opcoes: ConstructorParameters<typeof ModuloSimulado>[0], ms: number): Bruto[] {
  const { modulo, pedacos } = moduloAdquirindo(opcoes);
  modulo.avancar(ms);
  return brutos(decodificar(pedacos).eventos);
}

/** Layout do quadro bruto lido à mão, sem passar por protocolo.ts. */
function destrinchar(q: Uint8Array, comExtra: boolean) {
  const dv = new DataView(q.buffer, q.byteOffset, q.byteLength);
  const len = q[1];
  const nDeltas = (len - 13 - (comExtra ? 1 : 0)) / 2;
  const deltas: number[] = [];
  for (let i = 0; i < nDeltas; i++) deltas.push(dv.getInt16(15 + 2 * i, true));
  return {
    total: q.length,
    inicio: q[0],
    len,
    endereco: q[2],
    verificacaoCabecalho: q[3],
    modo: q[4],
    ts48: q.subarray(5, 11),
    base: dv.getFloat32(11, true),
    nDeltas,
    deltas,
    extra: comExtra ? q[q.length - 2] : null,
    fim: q[q.length - 1],
  };
}

// ---------------------------------------------------------------------------
// sinalEmgSintetico
// ---------------------------------------------------------------------------

describe('sinalEmgSintetico', () => {
  const base = { fsHz: 1000, duracaoS: 2, semente: 7 };

  it('devolve round(duração · fs) amostras finitas, em 500 e 1000 Hz', () => {
    for (const fs of [500, 1000]) {
      const x = sinalEmgSintetico({ fsHz: fs, duracaoS: 1.5, semente: 3 });
      expect(x).toBeInstanceOf(Float64Array);
      expect(x.length).toBe(fs * 1.5);
      expect(x.every(Number.isFinite)).toBe(true);
    }
    expect(sinalEmgSintetico({ ...base, duracaoS: 0 }).length).toBe(0);
    expect(sinalEmgSintetico({ ...base, duracaoS: 0.0004 }).length).toBe(0);
    expect(sinalEmgSintetico({ ...base, duracaoS: 0.0006 }).length).toBe(1);
  });

  it('é determinístico por semente: igual com a mesma, diferente e não correlacionado com outra', () => {
    const opcoes = { ...base, rajadas: [{ inicioS: 0.5, fimS: 1.5, amplitudeUv: 100 }], redeUv: 3 };
    const a = sinalEmgSintetico(opcoes);
    const b = sinalEmgSintetico({ ...opcoes });
    expect(Array.from(b)).toEqual(Array.from(a));

    const outra = sinalEmgSintetico({ ...opcoes, semente: 8 });
    expect(Array.from(outra)).not.toEqual(Array.from(a));
    // Só o ruído muda: a rede (3 µV, fase sorteada pela semente) é pequena frente à rajada.
    expect(Math.abs(correlacao(a, outra))).toBeLessThan(0.15);
  });

  it('o começo do sinal não depende da duração pedida', () => {
    const curto = sinalEmgSintetico({ ...base, duracaoS: 1 });
    const longo = sinalEmgSintetico({ ...base, duracaoS: 3 });
    expect(Array.from(longo.subarray(0, curto.length))).toEqual(Array.from(curto));
  });

  it('sem rajada o RMS é o ruído basal (padrão e informado)', () => {
    const padrao = sinalEmgSintetico({ fsHz: 1000, duracaoS: 10, semente: 11 });
    expect(rmsDe(padrao)).toBeGreaterThan(2 * 0.95);
    expect(rmsDe(padrao)).toBeLessThan(2 * 1.05);
    for (const [fs, basal] of [[1000, 0.7], [500, 5], [1000, 12]]) {
      const x = sinalEmgSintetico({ fsHz: fs, duracaoS: 10, semente: 12, ruidoBasalUv: basal });
      expect(Math.abs(rmsDe(x) / basal - 1)).toBeLessThan(0.05);
    }
  });

  it('ruído basal 0 sem rajada nem rede é linha plana em zero', () => {
    const x = sinalEmgSintetico({ ...base, ruidoBasalUv: 0 });
    expect(maxAbs(x)).toBe(0);
  });

  it('a rajada tem RMS A/√2 no platô e o repouso fica no ruído basal', () => {
    for (const fs of [500, 1000]) {
      for (const amplitude of [40, 200, 900]) {
        const x = sinalEmgSintetico({
          fsHz: fs,
          duracaoS: 5,
          semente: 21,
          rajadas: [{ inicioS: 1, fimS: 4, amplitudeUv: amplitude }],
        });
        const platoRms = rmsDe(trecho(x, fs, 1.05, 3.95));
        expect(Math.abs(platoRms / (amplitude / Math.SQRT2) - 1)).toBeLessThan(0.08);
        const antes = rmsDe(trecho(x, fs, 0, 0.95));
        const depois = rmsDe(trecho(x, fs, 4.05, 5));
        expect(Math.abs(antes / 2 - 1)).toBeLessThan(0.15);
        expect(Math.abs(depois / 2 - 1)).toBeLessThan(0.15);
      }
    }
  });

  it('com amplitude pequena o ruído basal soma em potência: √(basal² + A²/2)', () => {
    const x = sinalEmgSintetico({
      fsHz: 1000,
      duracaoS: 6,
      semente: 22,
      ruidoBasalUv: 2,
      rajadas: [{ inicioS: 1, fimS: 5, amplitudeUv: 4 }],
    });
    const esperado = Math.sqrt(2 * 2 + (4 * 4) / 2);
    expect(Math.abs(rmsDe(trecho(x, 1000, 1.05, 4.95)) / esperado - 1)).toBeLessThan(0.08);
  });

  it('duas rajadas somam em potência quando se sobrepõem e mantêm a razão entre amplitudes', () => {
    const separadas = sinalEmgSintetico({
      fsHz: 1000,
      duracaoS: 8,
      semente: 23,
      rajadas: [
        { inicioS: 1, fimS: 3, amplitudeUv: 100 },
        { inicioS: 5, fimS: 7, amplitudeUv: 300 },
      ],
    });
    const razao = rmsDe(trecho(separadas, 1000, 5.05, 6.95)) / rmsDe(trecho(separadas, 1000, 1.05, 2.95));
    expect(Math.abs(razao / 3 - 1)).toBeLessThan(0.08);

    const juntas = sinalEmgSintetico({
      fsHz: 1000,
      duracaoS: 5,
      semente: 24,
      rajadas: [
        { inicioS: 1, fimS: 3, amplitudeUv: 100 },
        { inicioS: 2, fimS: 4, amplitudeUv: 100 },
      ],
    });
    // Sobreposição em [2,3): potência 2 · (100/√2)² (+ 2² de basal).
    const esperado = Math.sqrt(2 * (100 * 100) / 2 + 4);
    expect(Math.abs(rmsDe(trecho(juntas, 1000, 2.05, 2.95)) / esperado - 1)).toBeLessThan(0.08);
  });

  it('as rampas são suaves e a rajada não vaza para fora de [inicioS, fimS)', () => {
    const x = sinalEmgSintetico({
      fsHz: 1000,
      duracaoS: 4,
      semente: 25,
      rajadas: [{ inicioS: 1, fimS: 3, amplitudeUv: 600 }],
    });
    const plato = rmsDe(trecho(x, 1000, 1.05, 2.95));
    // Primeiros 10 ms da subida: a envoltória ainda está abaixo de ~10 %.
    expect(rmsDe(trecho(x, 1000, 1, 1.01))).toBeLessThan(0.15 * plato);
    expect(rmsDe(trecho(x, 1000, 2.99, 3))).toBeLessThan(0.15 * plato);
    // Fora do intervalo só há ruído basal (2 µV): nada perto dos ~400 µV da rajada.
    expect(maxAbs(trecho(x, 1000, 0, 1))).toBeLessThan(9 * 2);
    expect(maxAbs(trecho(x, 1000, 3, 4))).toBeLessThan(9 * 2);
    expect(maxAbs(trecho(x, 1000, 1.05, 2.95))).toBeGreaterThan(300);
  });

  it('rajada mais curta que as duas rampas continua válida', () => {
    const x = sinalEmgSintetico({
      fsHz: 1000,
      duracaoS: 1,
      semente: 26,
      rajadas: [{ inicioS: 0.4, fimS: 0.46, amplitudeUv: 500 }],
    });
    expect(x.every(Number.isFinite)).toBe(true);
    expect(maxAbs(trecho(x, 1000, 0.4, 0.46))).toBeGreaterThan(50);
    expect(maxAbs(trecho(x, 1000, 0, 0.4))).toBeLessThan(18);
    expect(maxAbs(trecho(x, 1000, 0.46, 1))).toBeLessThan(18);
  });

  it('o ruído é de banda larga: quase nada abaixo de 20 Hz frente a 90-110 Hz', () => {
    const x = sinalEmgSintetico({ fsHz: 1000, duracaoS: 4, semente: 27, ruidoBasalUv: 10 });
    const baixo = potenciaNaBanda(x, 1000, 3, 7);
    const meio = potenciaNaBanda(x, 1000, 90, 110);
    expect(meio).toBeGreaterThan(0);
    expect(baixo / meio).toBeLessThan(0.01);
  });

  it('a rede entra como senoide de amplitude redeUv na frequência pedida', () => {
    for (const [fs, redeHz] of [[1000, 60], [500, 60], [1000, 50]]) {
      const x = sinalEmgSintetico({ fsHz: fs, duracaoS: 5, semente: 31, redeUv: 20, redeHz });
      const medida = amplitudeEm(x, redeHz, fs);
      expect(Math.abs(medida / 20 - 1)).toBeLessThan(0.03);
    }
  });

  it('sem redeHz a rede é de 60 Hz; sem redeUv não há rede', () => {
    const com = sinalEmgSintetico({ ...base, duracaoS: 5, redeUv: 15 });
    expect(Math.abs(amplitudeEm(com, 60, 1000) / 15 - 1)).toBeLessThan(0.03);
    expect(amplitudeEm(com, 50, 1000)).toBeLessThan(1);
    const sem = sinalEmgSintetico({ ...base, duracaoS: 5 });
    expect(amplitudeEm(sem, 60, 1000)).toBeLessThan(0.5);
  });

  it('a rede continua igual durante a rajada e ligá-la não muda o ruído', () => {
    const rajadas = [{ inicioS: 1, fimS: 3, amplitudeUv: 400 }];
    const comRede = sinalEmgSintetico({ ...base, duracaoS: 4, rajadas, redeUv: 10 });
    const semRede = sinalEmgSintetico({ ...base, duracaoS: 4, rajadas });
    const diferenca = new Float64Array(comRede.length);
    for (let i = 0; i < diferenca.length; i++) diferenca[i] = comRede[i] - semRede[i];
    // A diferença é só a senoide: amplitude 10 em todo o trecho, dentro e fora da rajada.
    expect(Math.abs(amplitudeEm(diferenca, 60, 1000) / 10 - 1)).toBeLessThan(1e-9);
    expect(Math.abs(rmsDe(trecho(diferenca, 1000, 1.5, 2.5)) - 10 / Math.SQRT2)).toBeLessThan(1e-3);
  });

  it('rejeita parâmetros inválidos com RangeError', () => {
    const ruins: Array<Partial<Parameters<typeof sinalEmgSintetico>[0]>> = [
      { fsHz: 0 },
      { fsHz: -500 },
      { fsHz: Number.NaN },
      { duracaoS: -1 },
      { duracaoS: Number.POSITIVE_INFINITY },
      { semente: Number.NaN },
      { ruidoBasalUv: -1 },
      { redeUv: -1 },
      { redeUv: 5, redeHz: 500 },
      { redeUv: 5, redeHz: 0 },
      { rajadas: [{ inicioS: 1, fimS: 1, amplitudeUv: 10 }] },
      { rajadas: [{ inicioS: 2, fimS: 1, amplitudeUv: 10 }] },
      { rajadas: [{ inicioS: 0, fimS: 1, amplitudeUv: -10 }] },
      { rajadas: [{ inicioS: Number.NaN, fimS: 1, amplitudeUv: 10 }] },
    ];
    for (const ruim of ruins) {
      expect(() => sinalEmgSintetico({ ...base, ...ruim })).toThrow(RangeError);
    }
  });

  it('a rede na Nyquist só é recusada quando redeUv > 0', () => {
    expect(() => sinalEmgSintetico({ fsHz: 500, duracaoS: 1, semente: 1, redeHz: 500 })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// montarQuadroBruto / montarQuadroRms / montarResposta
// ---------------------------------------------------------------------------

describe('montarQuadroBruto', () => {
  it('quadro de referência montado à mão (com e sem o byte extra)', () => {
    const amostras = Float64Array.of(0.5, 1.5, 1.0);
    const ts = EPOCA + 0x0102030405;
    // base 0,5 = 3F000000 LE; deltas: round(1·3,1457)=3 e round((1 - 1,45369)·3,1457)=-1.
    expect(hex(montarQuadroBruto(amostras, ts))).toBe(
      'A5 12 11 03 03 00 01 02 03 04 05 00 00 00 3F 03 00 FF FF 3E 5A',
    );
    expect(hex(montarQuadroBruto(amostras, ts, { comByteAntesDoFim: false }))).toBe(
      'A5 11 11 00 03 00 01 02 03 04 05 00 00 00 3F 03 00 FF FF 5A',
    );
  });

  it('deltas de malha fechada: 0, 1, 0, -1 µV dão 3, -3, -3 contagens', () => {
    const q = montarQuadroBruto(Float64Array.of(0, 1, 0, -1), EPOCA, { comByteAntesDoFim: false });
    expect(destrinchar(q, false).deltas).toEqual([3, -3, -3]);
  });

  it('o canal EEG usa modo 4 e divisor 12,5786', () => {
    const q = montarQuadroBruto(Float64Array.of(0, 1, -1), EPOCA, { canal: 'eeg', comByteAntesDoFim: false });
    const d = destrinchar(q, false);
    expect(d.modo).toBe(4);
    // round(1·12,5786)=13; depois (-1 - 13/12,5786)·12,5786 = -25,5786 -> -26.
    expect(d.deltas).toEqual([13, -26]);
    const emg = montarQuadroBruto(Float64Array.of(0, 1, -1), EPOCA, { comByteAntesDoFim: false });
    expect(destrinchar(emg, false).modo).toBe(3);
  });

  it('LEN é par com o byte extra e ímpar sem ele, e o total é LEN + 3', () => {
    for (const n of [1, 2, 3, 49, 50, 115, MAX_AMOSTRAS_POR_QUADRO]) {
      const x = new Float64Array(n).fill(1.25);
      const com = montarQuadroBruto(x, EPOCA + 10);
      const sem = montarQuadroBruto(x, EPOCA + 10, { comByteAntesDoFim: false });
      expect(com[1] % 2).toBe(0);
      expect(sem[1] % 2).toBe(1);
      expect(com.length).toBe(com[1] + 3);
      expect(sem.length).toBe(sem[1] + 3);
      expect(com[1]).toBe(14 + 2 * (n - 1));
      expect(sem[1]).toBe(13 + 2 * (n - 1));
    }
  });

  it('campos fixos: A5, ADDR 0x11, LEN^ADDR, ts48 big-endian, byte extra = XOR de LEN ao último dado, 5A', () => {
    const rnd = mulberry32(5);
    for (const comExtra of [true, false]) {
      const x = Float64Array.from({ length: 50 }, () => (rnd() - 0.5) * 400);
      const ms = 123456789;
      const q = montarQuadroBruto(x, EPOCA + ms, { comByteAntesDoFim: comExtra });
      const d = destrinchar(q, comExtra);
      expect(d.inicio).toBe(0xa5);
      expect(d.endereco).toBe(0x11);
      expect(d.verificacaoCabecalho).toBe(d.len ^ 0x11);
      expect(d.modo).toBe(3);
      expect(Array.from(d.ts48)).toEqual(be48(ms));
      expect(d.base).toBeCloseTo(x[0], 3);
      expect(d.nDeltas).toBe(49);
      expect(d.fim).toBe(0x5a);
      if (comExtra) {
        expect(d.extra).toBe(xorDe(q.subarray(1, q.length - 2)));
      }
    }
  });

  it('o carimbo é arredondado ao ms e aceita o limite do relógio de 48 bits', () => {
    const q = montarQuadroBruto(Float64Array.of(1), EPOCA + 1000.4);
    expect(Array.from(destrinchar(q, true).ts48)).toEqual(be48(1000));
    const maximo = montarQuadroBruto(Float64Array.of(1), EPOCA + 2 ** 48 - 1);
    expect(Array.from(destrinchar(maximo, true).ts48)).toEqual([255, 255, 255, 255, 255, 255]);
    const zero = montarQuadroBruto(Float64Array.of(1), EPOCA);
    expect(Array.from(destrinchar(zero, true).ts48)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('ida e volta pelo protocolo: erro de no máximo meio degrau, nas duas variantes e taxas', () => {
    for (const fs of [500, 1000]) {
      for (const comExtra of [true, false]) {
        const sinal = sinalEmgSintetico({
          fsHz: fs,
          duracaoS: 4,
          semente: 41,
          rajadas: [{ inicioS: 1, fimS: 3, amplitudeUv: 700 }],
          redeUv: 8,
        });
        const acumulador = new AcumuladorDeQuadros();
        const lidas: number[] = [];
        for (let ini = 0; ini + 50 <= sinal.length; ini += 50) {
          const ts = EPOCA + Math.round(((ini + 49) * 1000) / fs);
          const quadro = montarQuadroBruto(sinal.subarray(ini, ini + 50), ts, { comByteAntesDoFim: comExtra });
          const quadros = acumulador.push(quadro);
          expect(quadros).toHaveLength(1);
          const e = interpretarQuadro(quadros[0]);
          expect(e.tipo).toBe('bruto');
          if (e.tipo === 'bruto') {
            expect(e.canal).toBe('emg');
            expect(e.tsMs).toBe(ts);
            lidas.push(...e.amostras);
          }
        }
        expect(lidas).toHaveLength(sinal.length);
        let pior = 0;
        for (let i = 0; i < lidas.length; i++) pior = Math.max(pior, Math.abs(lidas[i] - sinal[i]));
        expect(pior).toBeLessThanOrEqual(PASSO_UV);
        expect(pior).toBeLessThanOrEqual(PASSO_UV / 2 + 1e-3);
        expect(acumulador.descartados).toBe(0);
      }
    }
  });

  it('ida e volta com sinal aleatório de semente fixa e quadros de tamanhos variados', () => {
    const rnd = mulberry32(2024);
    for (const n of [1, 2, 7, 50, 116]) {
      for (const comExtra of [true, false]) {
        const x = Float64Array.from({ length: n }, () => (rnd() - 0.5) * 1500);
        const q = montarQuadroBruto(x, EPOCA + 5000, { comByteAntesDoFim: comExtra });
        const { eventos } = decodificar([q]);
        const [e] = brutos(eventos);
        expect(e.amostras).toHaveLength(n);
        for (let i = 0; i < n; i++) expect(Math.abs(e.amostras[i] - x[i])).toBeLessThanOrEqual(PASSO_UV / 2 + 1e-3);
      }
    }
  });

  it('EEG: ida e volta com meio degrau de 1/12,5786', () => {
    const rnd = mulberry32(77);
    const x = Float64Array.from({ length: 50 }, () => (rnd() - 0.5) * 100);
    const q = montarQuadroBruto(x, EPOCA + 20, { canal: 'eeg' });
    const [e] = brutos(decodificar([q]).eventos);
    expect(e.canal).toBe('eeg');
    for (let i = 0; i < x.length; i++) expect(Math.abs(e.amostras[i] - x[i])).toBeLessThanOrEqual(PASSO_EEG_UV / 2 + 1e-3);
  });

  it('malha fechada: rampa de 0,4 degrau por amostra não acumula erro (malha aberta chegaria a 46 degraus)', () => {
    const n = MAX_AMOSTRAS_POR_QUADRO;
    const x = Float64Array.from({ length: n }, (_, i) => 100 + i * 0.4 * PASSO_UV);
    const [e] = brutos(decodificar([montarQuadroBruto(x, EPOCA + 1)]).eventos);
    for (let i = 0; i < n; i++) expect(Math.abs(e.amostras[i] - x[i])).toBeLessThanOrEqual(PASSO_UV / 2 + 1e-3);
    expect(e.amostras[n - 1] - e.amostras[0]).toBeGreaterThan(0.9 * (n - 1) * 0.4 * PASSO_UV);
  });

  it('delta saturado em ±32767 e o erro se desfaz nas amostras seguintes', () => {
    const maxUv = 32767 / 3.1457;
    const subida = Float64Array.of(0, 20000, 20000, 20000, 20000);
    const [a] = brutos(decodificar([montarQuadroBruto(subida, EPOCA + 1)]).eventos);
    expect(a.amostras[1]).toBeCloseTo(maxUv, 3);
    expect(Math.abs(a.amostras[2] - 20000)).toBeLessThanOrEqual(PASSO_UV / 2 + 1e-3);
    expect(Math.abs(a.amostras[4] - 20000)).toBeLessThanOrEqual(PASSO_UV / 2 + 1e-3);

    const descida = Float64Array.of(0, -20000, -20000, -20000);
    const [b] = brutos(decodificar([montarQuadroBruto(descida, EPOCA + 1)]).eventos);
    expect(b.amostras[1]).toBeCloseTo(-maxUv, 3);
    expect(Math.abs(b.amostras[3] + 20000)).toBeLessThanOrEqual(PASSO_UV / 2 + 1e-3);
  });

  it('delta de exatamente 32767 contagens não satura', () => {
    const alvo = 32767 / 3.1457;
    const [e] = brutos(decodificar([montarQuadroBruto(Float64Array.of(0, alvo), EPOCA + 1)]).eventos);
    expect(destrinchar(montarQuadroBruto(Float64Array.of(0, alvo), EPOCA + 1), true).deltas).toEqual([32767]);
    expect(Math.abs(e.amostras[1] - alvo)).toBeLessThanOrEqual(PASSO_UV / 2 + 1e-3);
  });

  it('116 amostras (115 deltas) cabem com LEN 244; 117 não', () => {
    const q = montarQuadroBruto(new Float64Array(116), EPOCA + 1);
    expect(q[1]).toBe(244);
    expect(q.length).toBe(247);
    expect(() => montarQuadroBruto(new Float64Array(117), EPOCA + 1)).toThrow(RangeError);
    expect(() => montarQuadroBruto(new Float64Array(117), EPOCA + 1, { comByteAntesDoFim: false })).toThrow(RangeError);
  });

  it('rejeita entradas inválidas', () => {
    expect(() => montarQuadroBruto(new Float64Array(0), EPOCA)).toThrow(RangeError);
    expect(() => montarQuadroBruto(Float64Array.of(1, Number.NaN), EPOCA)).toThrow(RangeError);
    expect(() => montarQuadroBruto(Float64Array.of(Number.POSITIVE_INFINITY), EPOCA)).toThrow(RangeError);
    expect(() => montarQuadroBruto(Float64Array.of(1), EPOCA - 1)).toThrow(RangeError);
    expect(() => montarQuadroBruto(Float64Array.of(1), Number.NaN)).toThrow(RangeError);
    expect(() => montarQuadroBruto(Float64Array.of(1), EPOCA + 2 ** 48)).toThrow(RangeError);
  });

  it('não altera o vetor de entrada', () => {
    const x = Float64Array.of(1.1, 2.2, 3.3);
    const copia = Array.from(x);
    montarQuadroBruto(x, EPOCA + 1);
    expect(Array.from(x)).toEqual(copia);
  });
});

describe('montarQuadroRms', () => {
  it('quadro de referência montado à mão', () => {
    const ts = EPOCA + 0x0a0b;
    expect(hex(montarQuadroRms([1, 258], ts))).toBe('A5 0E 11 1F 01 00 00 00 00 0A 0B 00 01 01 02 02 5A');
    expect(hex(montarQuadroRms([1, 258], ts, { comByteAntesDoFim: false }))).toBe(
      'A5 0D 11 1C 01 00 00 00 00 0A 0B 00 01 01 02 5A',
    );
  });

  it('o protocolo decodifica valores e carimbo nas duas variantes', () => {
    const valores = [0, 1, 255, 256, 65535, 1234];
    for (const comExtra of [true, false]) {
      const [e] = decodificar([montarQuadroRms(valores, EPOCA + 987654, { comByteAntesDoFim: comExtra })]).eventos;
      expect(e).toEqual({ tipo: 'rms', tsUltimoMs: EPOCA + 987654, valores, intervaloMs: 50 });
    }
  });

  it('arredonda valores não inteiros e aceita lista vazia', () => {
    const [e] = decodificar([montarQuadroRms([2.4, 2.6], EPOCA + 50)]).eventos;
    expect(e.tipo === 'rms' && e.valores).toEqual([2, 3]);
    const [vazio] = decodificar([montarQuadroRms([], EPOCA + 50)]).eventos;
    expect(vazio.tipo === 'rms' && vazio.valores).toEqual([]);
  });

  it('rejeita valor fora de uint16, não finito, carimbo ruim e quadro grande demais', () => {
    expect(() => montarQuadroRms([-1], EPOCA)).toThrow(RangeError);
    expect(() => montarQuadroRms([65536], EPOCA)).toThrow(RangeError);
    expect(() => montarQuadroRms([Number.NaN], EPOCA)).toThrow(RangeError);
    expect(() => montarQuadroRms([1], EPOCA - 1)).toThrow(RangeError);
    // LEN = 10 + 2n: 117 valores dão 244; 118 passam.
    expect(montarQuadroRms(new Array<number>(117).fill(5), EPOCA)[1]).toBe(244);
    expect(() => montarQuadroRms(new Array<number>(118).fill(5), EPOCA)).toThrow(RangeError);
  });
});

describe('montarResposta', () => {
  it('quadros de referência montados à mão', () => {
    expect(hex(montarResposta(0x06, [1]))).toBe('A5 04 06 02 01 01 5A');
    expect(hex(montarResposta(0x06, [1], { comByteAntesDoFim: false }))).toBe('A5 03 06 05 01 5A');
    expect(hex(montarResposta(0x0f, []))).toBe('A5 03 0F 0C 00 5A');
    expect(hex(montarResposta(0x0f, [], { comByteAntesDoFim: false }))).toBe('A5 02 0F 0D 5A');
    expect(hex(montarResposta(0x20, [0xff, 0x0f]))).toBe('A5 05 20 25 FF 0F F0 5A');
  });

  it('o total é LEN + 3 e o byte extra é o XOR de LEN até o último dado', () => {
    const rnd = mulberry32(9);
    for (const n of [0, 1, 6, 40, 252]) {
      const payload = Array.from({ length: n }, () => Math.floor(rnd() * 256));
      const q = montarResposta(0x33, payload);
      expect(q.length).toBe(q[1] + 3);
      expect(q[3]).toBe(q[1] ^ 0x33);
      expect(q[q.length - 2]).toBe(xorDe(q.subarray(1, q.length - 2)));
      expect(Array.from(q.subarray(4, 4 + n))).toEqual(payload);
    }
  });

  it('LEN cabe em 1 byte: 252 bytes de payload com byte extra, 253 sem', () => {
    expect(montarResposta(1, new Array<number>(252).fill(1))[1]).toBe(255);
    expect(() => montarResposta(1, new Array<number>(253).fill(1))).toThrow(RangeError);
    expect(montarResposta(1, new Array<number>(253).fill(1), { comByteAntesDoFim: false })[1]).toBe(255);
    expect(() => montarResposta(1, new Array<number>(254).fill(1), { comByteAntesDoFim: false })).toThrow(RangeError);
  });

  it('rejeita endereço e bytes fora de 0..255', () => {
    expect(() => montarResposta(256, [])).toThrow(RangeError);
    expect(() => montarResposta(-1, [])).toThrow(RangeError);
    expect(() => montarResposta(1.5, [])).toThrow(RangeError);
    expect(() => montarResposta(1, [256])).toThrow(RangeError);
    expect(() => montarResposta(1, [-1])).toThrow(RangeError);
    expect(() => montarResposta(1, [0.5])).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// ModuloSimulado: comandos e respostas
// ---------------------------------------------------------------------------

describe('ModuloSimulado: respostas aos comandos dourados da spec', () => {
  it('taxa de amostragem: 0 é 500 Hz e 1 é 1000 Hz', () => {
    const quinhentos = new ModuloSimulado({ fsHz: 500 });
    const a = ligar(quinhentos);
    quinhentos.receberComando(deHex('AA 03 81 06 84 BB'));
    expect(a.map(hex)).toEqual(['A5 04 06 02 00 00 5A']);
    expect(decodificar(a).eventos).toEqual([{ tipo: 'taxa', hz: 500 }]);

    const mil = new ModuloSimulado({ fsHz: 1000 });
    const b = ligar(mil);
    mil.receberComando(deHex('AA 03 81 06 84 BB'));
    expect(b.map(hex)).toEqual(['A5 04 06 02 01 01 5A']);
    expect(decodificar(b).eventos).toEqual([{ tipo: 'taxa', hz: 1000 }]);
  });

  it('bateria: o percentual vai em f[10] (0, 1, 73 e 100)', () => {
    for (const pct of [0, 1, 73, 100]) {
      const modulo = new ModuloSimulado({ bateriaPct: pct });
      const p = ligar(modulo);
      modulo.receberComando(deHex('AA 03 81 0B 89 BB'));
      const quadro = Uint8Array.from(p.flatMap((x) => Array.from(x)));
      expect(quadro[2]).toBe(0x0b);
      expect(quadro[10]).toBe(pct);
      expect(quadro[1] + 3).toBe(quadro.length);
      expect(decodificar(p).eventos).toEqual([{ tipo: 'bateria', pct }]);
    }
  });

  it('a bateria pode mudar durante o uso e fica entre 0 e 100', () => {
    const modulo = new ModuloSimulado({ bateriaPct: 90 });
    const p = ligar(modulo);
    modulo.bateriaPct = 12;
    modulo.receberComando(cmd.bateria());
    modulo.bateriaPct = 250;
    modulo.receberComando(cmd.bateria());
    modulo.bateriaPct = -5;
    modulo.receberComando(cmd.bateria());
    expect(decodificar(p).eventos).toEqual([
      { tipo: 'bateria', pct: 12 },
      { tipo: 'bateria', pct: 100 },
      { tipo: 'bateria', pct: 0 },
    ]);
  });

  it('versões de hardware e de software são texto, nas duas variantes do byte extra', () => {
    for (const comExtra of [true, false]) {
      const modulo = new ModuloSimulado({ comByteAntesDoFim: comExtra });
      const p = ligar(modulo);
      modulo.receberComando(deHex('AA 03 81 01 83 BB'));
      modulo.receberComando(deHex('AA 03 81 02 80 BB'));
      expect(decodificar(p).eventos).toEqual([
        { tipo: 'versao_hw', texto: VERSAO_HARDWARE_SIMULADA },
        { tipo: 'versao_sw', texto: VERSAO_SOFTWARE_SIMULADA },
      ]);
    }
  });

  it('escrita em 0x0F (desligar o filtro do hardware) devolve confirmação do endereço 0x0F', () => {
    const modulo = new ModuloSimulado();
    const p = ligar(modulo);
    modulo.receberComando(deHex('AA 04 80 0F 00 8B BB'));
    expect(p.map(hex)).toEqual(['A5 03 0F 0C 00 5A']);
    expect(decodificar(p).eventos).toEqual([{ tipo: 'ack', endereco: 0x0f }]);
  });

  it('qualquer outro endereço devolve um ack com o mesmo ADDR, em leitura ou escrita', () => {
    const modulo = new ModuloSimulado();
    const p = ligar(modulo);
    modulo.receberComando(cmd.reset());
    modulo.receberComando(comando(0x80, 0x0c, [1]));
    modulo.receberComando(comando(0x81, 0x03));
    modulo.receberComando(comando(0x81, 0x7e));
    modulo.receberComando(comando(0x80, 0x09, [1]));
    modulo.receberComando(comando(0x81, 0x11));
    expect(decodificar(p).eventos).toEqual([
      { tipo: 'ack', endereco: 0x13 },
      { tipo: 'ack', endereco: 0x0c },
      { tipo: 'ack', endereco: 0x03 },
      { tipo: 'ack', endereco: 0x7e },
      { tipo: 'ack', endereco: 0x09 },
      { tipo: 'ack', endereco: 0x11 },
    ]);
  });

  it('escrever num endereço que também se lê (0x06, 0x0B) só confirma: não muda a taxa nem a bateria', () => {
    const modulo = new ModuloSimulado({ fsHz: 1000, bateriaPct: 60 });
    const p = ligar(modulo);
    modulo.receberComando(comando(0x80, 0x06, [0]));
    modulo.receberComando(comando(0x80, 0x0b, [10]));
    // Ack sem dados: A5 LEN ADDR LEN^ADDR 00 5A (o 00 é o XOR do payload vazio).
    expect(p.map(hex)).toEqual(['A5 03 06 05 00 5A', 'A5 03 0B 08 00 5A']);
    p.length = 0;
    modulo.receberComando(cmd.taxaDeAmostragem());
    modulo.receberComando(cmd.bateria());
    expect(decodificar(p).eventos).toEqual([
      { tipo: 'taxa', hz: 1000 },
      { tipo: 'bateria', pct: 60 },
    ]);
  });

  it('os comandos de cmd.* de protocolo.ts dão as mesmas respostas que os bytes da spec', () => {
    const a = new ModuloSimulado({ bateriaPct: 40, fsHz: 500 });
    const b = new ModuloSimulado({ bateriaPct: 40, fsHz: 500 });
    const pa = ligar(a);
    const pb = ligar(b);
    for (const [pronto, literal] of [
      [cmd.versaoHardware(), 'AA 03 81 01 83 BB'],
      [cmd.versaoSoftware(), 'AA 03 81 02 80 BB'],
      [cmd.taxaDeAmostragem(), 'AA 03 81 06 84 BB'],
      [cmd.bateria(), 'AA 03 81 0B 89 BB'],
      [cmd.filtroHardware(false), 'AA 04 80 0F 00 8B BB'],
    ] as Array<[Uint8Array, string]>) {
      a.receberComando(pronto);
      b.receberComando(deHex(literal));
    }
    expect(pa.map(hex)).toEqual(pb.map(hex));
    expect(decodificar(pa).eventos.map((e) => e.tipo)).toEqual(['versao_hw', 'versao_sw', 'taxa', 'bateria', 'ack']);
  });

  it('tipo de hardware (0x1D): mudo por padrão; com responderTipoHardware devolve o modelo', () => {
    const mudo = new ModuloSimulado({ modelo: 'EMG-Pro' });
    const pm = ligar(mudo);
    mudo.receberComando(comando(0x81, 0x1d));
    expect(pm).toHaveLength(0);
    expect(mudo.comandosRecebidos).toHaveLength(1);

    for (const [modelo, codigo] of [['EMG-Module', 0], ['EEG-Module', 1], ['EMG-Pro', 2], ['EEG-Pro', 3]] as const) {
      for (const comExtra of [true, false]) {
        const m = new ModuloSimulado({ modelo, responderTipoHardware: true, comByteAntesDoFim: comExtra });
        const p = ligar(m);
        m.receberComando(comando(0x81, 0x1d));
        const quadro = Uint8Array.from(p.flatMap((x) => Array.from(x)));
        expect(quadro[2]).toBe(0x1d);
        expect(quadro[4]).toBe(codigo);
        expect(decodificar(p).eventos).toEqual([{ tipo: 'hardware', modelo }]);
      }
    }
  });
});

describe('ModuloSimulado: validação dos comandos', () => {
  const valido = deHex('AA 03 81 0B 89 BB');

  it('comandos inválidos são ignorados e registrados em comandosInvalidos', () => {
    const quebrado: Array<[string, Uint8Array]> = [
      ['XOR errado', deHex('AA 03 81 0B 88 BB')],
      ['sem AA', deHex('AB 03 81 0B 89 BB')],
      ['sem BB', deHex('AA 03 81 0B 89 BA')],
      ['LEN diferente do tamanho (XOR coerente)', comandoComLenForcado(4)],
      ['LEN curto (XOR coerente)', comandoComLenForcado(2)],
      ['RW desconhecido (XOR coerente)', Uint8Array.from([0xaa, 0x03, 0x82, 0x0b, 0x03 ^ 0x82 ^ 0x0b, 0xbb])],
      ['curto demais', deHex('AA 03 81 0B BB')],
      ['vazio', new Uint8Array(0)],
      ['truncado', deHex('AA 03 81')],
      ['lixo', deHex('00 11 22 33 44 55 66')],
    ];
    const modulo = new ModuloSimulado();
    const p = ligar(modulo);
    for (const [, bytes] of quebrado) modulo.receberComando(bytes);
    expect(p).toHaveLength(0);
    expect(modulo.comandosRecebidos).toHaveLength(0);
    expect(modulo.comandosInvalidos.map(hex)).toEqual(quebrado.map(([, b]) => hex(b)));

    modulo.receberComando(valido);
    expect(modulo.comandosRecebidos.map(hex)).toEqual([hex(valido)]);
    expect(p).toHaveLength(1);
  });

  it('comando de iniciar com XOR errado não inicia a aquisição', () => {
    const modulo = new ModuloSimulado();
    const p = ligar(modulo);
    const ruim = Uint8Array.from(INICIAR_EMG);
    ruim[ruim.length - 2] ^= 0x01;
    modulo.receberComando(ruim);
    expect(modulo.adquirindo).toBe(false);
    modulo.avancar(1000);
    expect(p).toHaveLength(0);
    expect(modulo.comandosInvalidos).toHaveLength(1);
  });

  it('guarda cópias: mexer no array depois não altera o registro nem o comportamento', () => {
    const modulo = new ModuloSimulado();
    ligar(modulo);
    const bytes = Uint8Array.from(valido);
    modulo.receberComando(bytes);
    bytes.fill(0);
    expect(hex(modulo.comandosRecebidos[0])).toBe(hex(valido));
    const ruim = deHex('AA 03 81 0B 88 BB');
    modulo.receberComando(ruim);
    ruim.fill(0);
    expect(hex(modulo.comandosInvalidos[0])).toBe('AA 03 81 0B 88 BB');
  });

  it('um comando de iniciar sem dados confirma e não inicia; modos 1, 2 e 4 só confirmam', () => {
    const modulo = new ModuloSimulado();
    const p = ligar(modulo);
    modulo.receberComando(comando(0x80, 0x11, []));
    for (const modo of [MODO.RMS, MODO.BRUTO_FLOAT, MODO.EEG, 9]) {
      modulo.receberComando(cmd.iniciar(modo, 1700000000000));
    }
    expect(modulo.adquirindo).toBe(false);
    modulo.avancar(2000);
    expect(decodificar(p).eventos).toEqual(new Array(5).fill({ tipo: 'ack', endereco: 0x11 }));
  });
});

// ---------------------------------------------------------------------------
// ModuloSimulado: aquisição
// ---------------------------------------------------------------------------

describe('ModuloSimulado: iniciar, parar e quadros brutos', () => {
  it('modo 3 inicia (com ack do 0x11) e modo 0 para: nenhum quadro depois', () => {
    const modulo = new ModuloSimulado();
    const p = ligar(modulo);
    expect(modulo.adquirindo).toBe(false);
    modulo.receberComando(cmd.iniciar(MODO.EMG, 1700000000000));
    expect(modulo.adquirindo).toBe(true);
    expect(decodificar(p).eventos).toEqual([{ tipo: 'ack', endereco: 0x11 }]);

    p.length = 0;
    modulo.avancar(1000);
    const antes = brutos(decodificar(p).eventos);
    expect(antes).toHaveLength(20);

    p.length = 0;
    modulo.receberComando(cmd.parar(1700000001000));
    expect(modulo.adquirindo).toBe(false);
    expect(decodificar(p).eventos).toEqual([{ tipo: 'ack', endereco: 0x11 }]);

    p.length = 0;
    modulo.avancar(5000);
    expect(p).toHaveLength(0);
    expect(modulo.comandosRecebidos).toHaveLength(2);
  });

  it('as amostras de um quadro parcial se perdem ao parar', () => {
    const { modulo, pedacos } = moduloAdquirindo();
    modulo.avancar(30);
    modulo.receberComando(PARAR);
    pedacos.length = 0;
    modulo.receberComando(INICIAR_EMG);
    pedacos.length = 0;
    modulo.avancar(30);
    expect(pedacos).toHaveLength(0);
    modulo.avancar(20);
    expect(brutos(decodificar(pedacos).eventos)).toHaveLength(1);
  });

  it('iniciar de novo com a aquisição em andamento só confirma (não reinicia o sinal nem o tempo)', () => {
    const { modulo, pedacos } = moduloAdquirindo();
    modulo.avancar(100);
    modulo.receberComando(INICIAR_EMG);
    modulo.avancar(100);
    const eventos = decodificar(pedacos).eventos;
    expect(eventos.filter((e) => e.tipo === 'ack')).toHaveLength(1);
    const q = brutos(eventos);
    expect(q.map((e) => e.tsMs - EPOCA)).toEqual([49, 99, 149, 199]);
  });

  it('cada quadro tem 50 amostras e o carimbo é o do último ponto: 49 ms a 1 kHz, 98 ms a 500 Hz', () => {
    const mil = emitirTudo({ fsHz: 1000 }, 500);
    expect(mil).toHaveLength(10);
    expect(mil.every((q) => q.amostras.length === 50 && q.canal === 'emg')).toBe(true);
    expect(mil.map((q) => q.tsMs - EPOCA)).toEqual([49, 99, 149, 199, 249, 299, 349, 399, 449, 499]);

    const quinhentos = emitirTudo({ fsHz: 500 }, 500);
    expect(quinhentos).toHaveLength(5);
    expect(quinhentos.map((q) => q.tsMs - EPOCA)).toEqual([98, 198, 298, 398, 498]);
  });

  it('o relógio do módulo corre mesmo parado: o carimbo conta desde que o módulo ligou', () => {
    const modulo = new ModuloSimulado();
    const p = ligar(modulo);
    modulo.avancar(1000);
    modulo.receberComando(INICIAR_EMG);
    p.length = 0;
    modulo.avancar(50);
    const [q] = brutos(decodificar(p).eventos);
    expect(q.tsMs).toBe(EPOCA + 1000 + 49);
  });

  it('amostrasPorQuadro muda o tamanho do quadro e o intervalo entre carimbos', () => {
    const q10 = emitirTudo({ amostrasPorQuadro: 10 }, 100);
    expect(q10).toHaveLength(10);
    expect(q10.every((q) => q.amostras.length === 10)).toBe(true);
    expect(q10.map((q) => q.tsMs - EPOCA)[1]).toBe(19);

    const q1 = emitirTudo({ amostrasPorQuadro: 1 }, 5);
    expect(q1).toHaveLength(5);
    expect(q1.map((q) => q.tsMs - EPOCA)).toEqual([0, 1, 2, 3, 4]);

    const q116 = emitirTudo({ amostrasPorQuadro: 116 }, 232);
    expect(q116).toHaveLength(2);
    expect(q116[0].amostras).toHaveLength(116);
  });

  it('avancar em passos de qualquer tamanho dá os mesmos bytes que um único avanço', () => {
    const a = moduloAdquirindo({ semente: 5 });
    a.modulo.avancar(7000);
    const b = moduloAdquirindo({ semente: 5 });
    for (let i = 0; i < 1000; i++) b.modulo.avancar(7);
    const c = moduloAdquirindo({ semente: 5 });
    for (let i = 0; i < 14000; i++) c.modulo.avancar(0.5);
    const lista = (ps: Uint8Array[]) => ps.map(hex).join('|');
    expect(a.pedacos.length).toBeGreaterThan(0);
    expect(lista(b.pedacos)).toBe(lista(a.pedacos));
    expect(lista(c.pedacos)).toBe(lista(a.pedacos));
  });

  it('avancar(0) não gera nada e quadros parciais esperam o resto', () => {
    const { modulo, pedacos } = moduloAdquirindo();
    modulo.avancar(0);
    modulo.avancar(30);
    expect(pedacos).toHaveLength(0);
    modulo.avancar(19);
    expect(pedacos).toHaveLength(0);
    modulo.avancar(1);
    expect(brutos(decodificar(pedacos).eventos)).toHaveLength(1);
  });

  it('fora da aquisição avancar não gera nada', () => {
    const modulo = new ModuloSimulado();
    const p = ligar(modulo);
    modulo.avancar(10000);
    expect(p).toHaveLength(0);
    expect(modulo.quadrosEmitidos).toBe(0);
  });

  it('rejeita avanço negativo, não finito ou absurdo', () => {
    const modulo = new ModuloSimulado();
    expect(() => modulo.avancar(-1)).toThrow(RangeError);
    expect(() => modulo.avancar(Number.NaN)).toThrow(RangeError);
    expect(() => modulo.avancar(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => modulo.avancar(10 * 60 * 1000 + 1)).toThrow(RangeError);
    expect(() => modulo.avancar(10 * 60 * 1000)).not.toThrow();
  });

  it('o sinal decodificado segue sinalEmgSintetico com as mesmas opções, nas duas variantes e taxas', () => {
    for (const fs of [500, 1000] as const) {
      for (const comExtra of [true, false]) {
        const { modulo, pedacos } = moduloAdquirindo({
          fsHz: fs,
          semente: 99,
          ruidoBasalUv: 3,
          redeUv: 6,
          comByteAntesDoFim: comExtra,
        });
        modulo.contrair(1, 1.5, 150);
        modulo.avancar(4000);
        const lido = emendar(brutos(decodificar(pedacos).eventos));
        const referencia = sinalEmgSintetico({
          fsHz: fs,
          duracaoS: 4,
          semente: 99,
          ruidoBasalUv: 3,
          redeUv: 6,
          rajadas: [{ inicioS: 1, fimS: 2.5, amplitudeUv: 150 }],
        });
        expect(lido).toHaveLength(referencia.length);
        let pior = 0;
        for (let i = 0; i < lido.length; i++) pior = Math.max(pior, Math.abs(lido[i] - referencia[i]));
        expect(pior).toBeLessThanOrEqual(PASSO_UV / 2 + 1e-3);
      }
    }
  });

  it('contrair levanta o RMS do sinal que o app recebe, com A/√2', () => {
    const { modulo, pedacos } = moduloAdquirindo({ semente: 14 });
    modulo.contrair(1, 2, 300);
    modulo.avancar(4000);
    const x = emendar(brutos(decodificar(pedacos).eventos));
    expect(Math.abs(rmsDe(trecho(x, 1000, 1.05, 2.95)) / (300 / Math.SQRT2) - 1)).toBeLessThan(0.08);
    expect(rmsDe(trecho(x, 1000, 0, 0.95))).toBeLessThan(3);
    expect(rmsDe(trecho(x, 1000, 3.05, 4))).toBeLessThan(3);
  });

  it('contrair com o módulo em andamento usa tempoS como "agora"', () => {
    const { modulo, pedacos } = moduloAdquirindo({ semente: 15 });
    expect(modulo.tempoS).toBe(0);
    modulo.avancar(1000);
    expect(modulo.tempoS).toBe(1);
    modulo.contrair(modulo.tempoS, 1.5, 200);
    modulo.avancar(3000);
    const x = emendar(brutos(decodificar(pedacos).eventos));
    expect(rmsDe(trecho(x, 1000, 0, 0.95))).toBeLessThan(3);
    expect(Math.abs(rmsDe(trecho(x, 1000, 1.05, 2.45)) / (200 / Math.SQRT2) - 1)).toBeLessThan(0.1);
    expect(rmsDe(trecho(x, 1000, 2.55, 4))).toBeLessThan(3);
  });

  it('rajadas agendadas valem em toda aquisição até limparContracoes()', () => {
    const modulo = new ModuloSimulado({ semente: 16 });
    const p = ligar(modulo);
    modulo.contrair(0.5, 1, 250);
    const rodar = () => {
      modulo.receberComando(INICIAR_EMG);
      p.length = 0;
      modulo.avancar(2000);
      const x = emendar(brutos(decodificar(p).eventos));
      modulo.receberComando(PARAR);
      return x;
    };
    const primeira = rodar();
    const segunda = rodar();
    expect(Array.from(segunda)).toEqual(Array.from(primeira));
    expect(rmsDe(trecho(primeira, 1000, 0.6, 1.4))).toBeGreaterThan(100);

    modulo.limparContracoes();
    const calma = rodar();
    expect(rmsDe(trecho(calma, 1000, 0.6, 1.4))).toBeLessThan(3);
  });

  it('contrair rejeita parâmetros inválidos', () => {
    const modulo = new ModuloSimulado();
    expect(() => modulo.contrair(0, 0, 100)).toThrow(RangeError);
    expect(() => modulo.contrair(0, -1, 100)).toThrow(RangeError);
    expect(() => modulo.contrair(0, 1, -100)).toThrow(RangeError);
    expect(() => modulo.contrair(Number.NaN, 1, 100)).toThrow(RangeError);
    expect(() => modulo.contrair(0, Number.NaN, 100)).toThrow(RangeError);
    expect(() => modulo.contrair(0, 1, Number.NaN)).toThrow(RangeError);
  });

  it('é determinístico por semente: bytes iguais com a mesma, diferentes com outra', () => {
    const rodar = (semente?: number) => {
      const { modulo, pedacos } = moduloAdquirindo(semente === undefined ? {} : { semente });
      modulo.contrair(0.2, 0.5, 120);
      modulo.avancar(1000);
      return pedacos.map(hex).join('|');
    };
    expect(rodar(3)).toBe(rodar(3));
    expect(rodar(3)).not.toBe(rodar(4));
    expect(rodar()).toBe(rodar());
    expect(rodar()).toBe(rodar(1));
  });

  it('reiniciar a aquisição recomeça o sinal da semente (mesmas amostras, carimbos novos)', () => {
    const modulo = new ModuloSimulado({ semente: 8 });
    const p = ligar(modulo);
    const rodar = () => {
      modulo.receberComando(INICIAR_EMG);
      p.length = 0;
      modulo.avancar(500);
      const q = brutos(decodificar(p).eventos);
      modulo.receberComando(PARAR);
      return q;
    };
    const a = rodar();
    const b = rodar();
    expect(Array.from(emendar(b))).toEqual(Array.from(emendar(a)));
    expect(b[0].tsMs - a[0].tsMs).toBeGreaterThan(0);
    expect(b[0].tsMs - EPOCA).toBe(500 + 49);
  });

  it('o modo 4 (EEG) só confirma, mesmo num módulo EEG: só o EMG é simulado', () => {
    const modulo = new ModuloSimulado({ modelo: 'EEG-Module' });
    const p = ligar(modulo);
    modulo.receberComando(cmd.iniciar(MODO.EEG, 1700000000000));
    modulo.avancar(1000);
    expect(modulo.adquirindo).toBe(false);
    expect(decodificar(p).eventos).toEqual([{ tipo: 'ack', endereco: 0x11 }]);
  });
});

describe('ModuloSimulado: perda de quadros', () => {
  it('perderQuadros(n) descarta os próximos n quadros e deixa uma lacuna no carimbo', () => {
    const { modulo, pedacos } = moduloAdquirindo();
    modulo.avancar(200);
    modulo.perderQuadros(2);
    modulo.avancar(400);
    const q = brutos(decodificar(pedacos).eventos);
    // 600 ms = 12 quadros; os de 249 e 299 ms se perdem.
    const tss = q.map((e) => e.tsMs - EPOCA);
    expect(tss).toEqual([49, 99, 149, 199, 349, 399, 449, 499, 549, 599]);
    const saltos = tss.slice(1).map((t, i) => t - tss[i]);
    expect(saltos).toEqual([50, 50, 50, 150, 50, 50, 50, 50, 50]);
    expect(modulo.quadrosEmitidos).toBe(10);
    expect(modulo.quadrosPerdidos).toBe(2);
  });

  it('o conteúdo dos quadros seguintes continua alinhado com o tempo (a lacuna não desloca o sinal)', () => {
    const { modulo, pedacos } = moduloAdquirindo({ semente: 17 });
    modulo.contrair(0, 1, 200);
    modulo.perderQuadros(3);
    modulo.avancar(1000);
    const q = brutos(decodificar(pedacos).eventos);
    expect(q).toHaveLength(17);
    const referencia = sinalEmgSintetico({
      fsHz: 1000,
      duracaoS: 1,
      semente: 17,
      rajadas: [{ inicioS: 0, fimS: 1, amplitudeUv: 200 }],
    });
    const lido = emendar(q);
    for (let i = 0; i < lido.length; i++) {
      expect(Math.abs(lido[i] - referencia[150 + i])).toBeLessThanOrEqual(PASSO_UV / 2 + 1e-3);
    }
  });

  it('perdas além dos quadros disponíveis ficam para os próximos; perderQuadros(0) não faz nada', () => {
    const { modulo, pedacos } = moduloAdquirindo();
    modulo.perderQuadros(0);
    modulo.perderQuadros(3);
    modulo.avancar(100);
    expect(pedacos).toHaveLength(0);
    modulo.avancar(100);
    expect(brutos(decodificar(pedacos).eventos)).toHaveLength(1);
    expect(modulo.quadrosPerdidos).toBe(3);
  });

  it('perder quadros não perde respostas a comandos', () => {
    const { modulo, pedacos } = moduloAdquirindo();
    modulo.perderQuadros(5);
    modulo.receberComando(cmd.bateria());
    expect(decodificar(pedacos).eventos).toEqual([{ tipo: 'bateria', pct: 85 }]);
  });

  it('rejeita n negativo, fracionário ou não finito', () => {
    const modulo = new ModuloSimulado();
    expect(() => modulo.perderQuadros(-1)).toThrow(RangeError);
    expect(() => modulo.perderQuadros(1.5)).toThrow(RangeError);
    expect(() => modulo.perderQuadros(Number.NaN)).toThrow(RangeError);
  });
});

describe('ModuloSimulado: fragmentação por MTU', () => {
  it('nenhum pedaço passa de mtu bytes, e a remontagem dá os mesmos quadros em qualquer mtu', () => {
    const referencia = moduloAdquirindo({ mtu: 65535, semente: 6 });
    referencia.modulo.avancar(1000);
    const esperado = referencia.pedacos.map(hex);
    expect(esperado).toHaveLength(20);

    for (const mtu of [1, 7, 20, 23, 114, 115, 116, 244]) {
      const { modulo, pedacos } = moduloAdquirindo({ mtu, semente: 6 });
      modulo.avancar(1000);
      expect(Math.max(...pedacos.map((x) => x.length))).toBeLessThanOrEqual(mtu);
      const juntos = Uint8Array.from(pedacos.flatMap((x) => Array.from(x)));
      expect(hex(juntos)).toBe(esperado.join(' '));

      const { eventos, descartados, pendentes } = decodificar(pedacos);
      expect(brutos(eventos)).toHaveLength(20);
      expect(descartados).toBe(0);
      expect(pendentes).toBe(0);
    }
  });

  it('mtu 20 parte o quadro de 115 bytes em 5 pedaços de 20 e 1 de 15; mtu 244 manda inteiro', () => {
    const vinte = moduloAdquirindo({ mtu: 20 });
    vinte.modulo.avancar(50);
    expect(vinte.pedacos.map((x) => x.length)).toEqual([20, 20, 20, 20, 20, 15]);

    const grande = moduloAdquirindo({ mtu: 244 });
    grande.modulo.avancar(50);
    expect(grande.pedacos.map((x) => x.length)).toEqual([115]);

    const cheio = moduloAdquirindo({ mtu: 244, amostrasPorQuadro: 116 });
    cheio.modulo.avancar(116);
    expect(cheio.pedacos.map((x) => x.length)).toEqual([244, 3]);
  });

  it('respostas também são fragmentadas (padrão mtu 20 e mtu 3)', () => {
    const modulo = new ModuloSimulado({ mtu: 3, bateriaPct: 55 });
    const p = ligar(modulo);
    modulo.receberComando(cmd.bateria());
    expect(p.every((x) => x.length <= 3)).toBe(true);
    expect(p.length).toBeGreaterThan(1);
    expect(decodificar(p).eventos).toEqual([{ tipo: 'bateria', pct: 55 }]);

    const padrao = new ModuloSimulado();
    expect(padrao.mtu).toBe(20);
    expect(padrao.amostrasPorQuadro).toBe(50);
  });

  it('o pedaço entregue é uma cópia: o módulo não reaproveita o buffer', () => {
    const { modulo } = moduloAdquirindo();
    const guardados: Uint8Array[] = [];
    modulo.aoNotificar = (p) => {
      guardados.push(p);
    };
    modulo.avancar(100);
    const fotos = guardados.map(hex);
    modulo.avancar(100);
    expect(guardados.slice(0, fotos.length).map(hex)).toEqual(fotos);
  });
});

describe('ModuloSimulado: qualidade do sinal que o app recebe', () => {
  function sinalDeRepouso(opcoes: ConstructorParameters<typeof ModuloSimulado>[0]): Float64Array {
    return emendar(emitirTudo(opcoes, 3000));
  }

  it('repouso sem rede: nível bom, ruído basal perto do pedido e sem contaminação da rede', () => {
    const q = qualidadeDoSinal(sinalDeRepouso({ semente: 2 }), 1000);
    expect(q.nivel).toBe('bom');
    expect(q.linhaPlana).toBe(false);
    expect(q.saturacao).toBe(false);
    expect(q.contaminacaoRede).toBeLessThan(LIMIAR_REDE_ATENCAO);
    // O ruído basal da métrica é o MENOR RMS de janela de 1 s, então fica um pouco abaixo do pedido.
    expect(q.ruidoBasalRms).toBeGreaterThan(2 * 0.85);
    expect(q.ruidoBasalRms).toBeLessThan(2 * 1.1);
  });

  it('interferência da rede aparece: 1,5 µV dá atenção e 15 µV dá ruim', () => {
    const leve = qualidadeDoSinal(sinalDeRepouso({ semente: 2, redeUv: 1.5 }), 1000);
    expect(leve.contaminacaoRede).toBeGreaterThanOrEqual(LIMIAR_REDE_ATENCAO);
    expect(leve.contaminacaoRede).toBeLessThan(LIMIAR_REDE_RUIM);
    expect(leve.nivel).toBe('atencao');

    const forte = qualidadeDoSinal(sinalDeRepouso({ semente: 2, redeUv: 15 }), 1000);
    expect(forte.contaminacaoRede).toBeGreaterThanOrEqual(LIMIAR_REDE_RUIM);
    expect(forte.nivel).toBe('ruim');
    expect(forte.motivos.some((m) => m.includes('rede'))).toBe(true);
  });

  it('a interferência é medida na frequência certa: 60 Hz acusa, 50 Hz não', () => {
    const x = sinalDeRepouso({ semente: 2, redeUv: 15 });
    expect(qualidadeDoSinal(x, 1000, 60).contaminacaoRede).toBeGreaterThan(0.5);
    expect(qualidadeDoSinal(x, 1000, 50).contaminacaoRede).toBeLessThan(0.05);
  });

  it('ruído basal alto vira atenção na qualidade (ruidoBasalUv 6)', () => {
    const q = qualidadeDoSinal(sinalDeRepouso({ semente: 2, ruidoBasalUv: 6 }), 1000);
    expect(q.ruidoBasalRms).toBeGreaterThan(5);
    expect(q.ruidoBasalRms).toBeLessThan(6 * 1.1);
    expect(q.nivel).toBe('atencao');
  });

  it('o mesmo vale a 500 Hz', () => {
    const limpo = qualidadeDoSinal(sinalDeRepouso({ fsHz: 500, semente: 3 }), 500);
    expect(limpo.nivel).toBe('bom');
    const sujo = qualidadeDoSinal(sinalDeRepouso({ fsHz: 500, semente: 3, redeUv: 15 }), 500);
    expect(sujo.nivel).toBe('ruim');
  });
});

describe('ModuloSimulado: construtor', () => {
  it('rejeita opções inválidas com RangeError', () => {
    const ruins: Array<ConstructorParameters<typeof ModuloSimulado>[0]> = [
      { fsHz: 250 as unknown as 500 },
      { fsHz: 2000 as unknown as 500 },
      { semente: Number.NaN },
      { bateriaPct: -1 },
      { bateriaPct: 101 },
      { bateriaPct: Number.NaN },
      { modelo: 'Outro' as unknown as 'EMG-Pro' },
      { mtu: 0 },
      { mtu: 1.5 },
      { mtu: Number.NaN },
      { amostrasPorQuadro: 0 },
      { amostrasPorQuadro: MAX_AMOSTRAS_POR_QUADRO + 1 },
      { amostrasPorQuadro: 2.5 },
      { ruidoBasalUv: -1 },
      { redeUv: -1 },
    ];
    for (const ruim of ruins) expect(() => new ModuloSimulado(ruim)).toThrow(RangeError);
  });

  it('aceita os extremos válidos e expõe os padrões', () => {
    expect(() => new ModuloSimulado({ bateriaPct: 0, mtu: 1, amostrasPorQuadro: 1, semente: -5 })).not.toThrow();
    expect(() => new ModuloSimulado({ bateriaPct: 100, amostrasPorQuadro: MAX_AMOSTRAS_POR_QUADRO })).not.toThrow();
    const m = new ModuloSimulado();
    expect(m.fsHz).toBe(1000);
    expect(m.modelo).toBe('EMG-Module');
    expect(m.adquirindo).toBe(false);
    expect(m.comandosRecebidos).toEqual([]);
    expect(m.comandosInvalidos).toEqual([]);
  });

  it('sem ouvinte, aoNotificar padrão não quebra', () => {
    const m = new ModuloSimulado();
    expect(() => {
      m.receberComando(cmd.bateria());
      m.receberComando(INICIAR_EMG);
      m.avancar(200);
    }).not.toThrow();
  });
});

describe('ModuloSimulado: relógio em tempo real', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('iniciarRelogio chama avancar a cada ~50 ms de relógio real até pararRelogio', () => {
    const { modulo, pedacos } = moduloAdquirindo();
    modulo.iniciarRelogio();
    vi.advanceTimersByTime(1000);
    expect(modulo.quadrosEmitidos).toBe(20);
    expect(brutos(decodificar(pedacos).eventos)).toHaveLength(20);

    modulo.pararRelogio();
    vi.advanceTimersByTime(2000);
    expect(modulo.quadrosEmitidos).toBe(20);
  });

  it('chamar iniciarRelogio duas vezes não dobra a velocidade; parar sem iniciar não quebra', () => {
    const { modulo } = moduloAdquirindo();
    modulo.pararRelogio();
    modulo.iniciarRelogio();
    modulo.iniciarRelogio();
    vi.advanceTimersByTime(1000);
    expect(modulo.quadrosEmitidos).toBe(20);
    modulo.pararRelogio();
    modulo.pararRelogio();
  });

  it('pode ser religado depois de parado, sem recuperar o tempo parado', () => {
    const { modulo } = moduloAdquirindo();
    modulo.iniciarRelogio();
    vi.advanceTimersByTime(500);
    modulo.pararRelogio();
    vi.advanceTimersByTime(10000);
    modulo.iniciarRelogio();
    vi.advanceTimersByTime(500);
    expect(modulo.quadrosEmitidos).toBe(20);
  });

  it('um salto grande do relógio (aba em segundo plano) é limitado a 500 ms por passo', () => {
    const { modulo } = moduloAdquirindo();
    modulo.iniciarRelogio();
    vi.setSystemTime(Date.now() + 30000);
    vi.advanceTimersByTime(50);
    expect(modulo.quadrosEmitidos).toBe(10);
  });

  it('relógio do sistema andando para trás não gera quadros', () => {
    const { modulo } = moduloAdquirindo();
    modulo.iniciarRelogio();
    vi.setSystemTime(Date.now() - 5000);
    vi.advanceTimersByTime(50);
    expect(modulo.quadrosEmitidos).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// criarBluetoothSimulado
// ---------------------------------------------------------------------------

const FILTRO_PADRAO = { filters: [{ namePrefix: PREFIXO_NOME }], optionalServices: [UUID_SERVICO] };

function proximoTick(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

async function conectar(bt: ReturnType<typeof criarBluetoothSimulado>, pedido = FILTRO_PADRAO) {
  const dispositivo = await bt.requestDevice(pedido);
  const servidor = await dispositivo.gatt.connect();
  const [servico] = await servidor.getPrimaryServices();
  const caracteristicas = await servico.getCharacteristics();
  const escrita = caracteristicas.find((c) => c.uuid === UUID_ESCRITA) as CaracteristicaBle;
  const notificacao = caracteristicas.find((c) => c.uuid === UUID_NOTIFICACAO) as CaracteristicaBle;
  return { dispositivo, servidor, servico, escrita, notificacao };
}

function escutar(notificacao: CaracteristicaBle): Uint8Array[] {
  const recebidos: Uint8Array[] = [];
  notificacao.addEventListener('characteristicvaluechanged', (ev: EventoValorBle) => {
    const v = ev.target.value as DataView;
    recebidos.push(new Uint8Array(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength)));
  });
  return recebidos;
}

describe('criarBluetoothSimulado: descoberta e GATT', () => {
  it('requestDevice devolve "RunE W2 1" com o serviço fff0 e as características fff3 e fff4', async () => {
    const bt = criarBluetoothSimulado(new ModuloSimulado());
    const dispositivo = await bt.requestDevice(FILTRO_PADRAO);
    expect(dispositivo.name).toBe('RunE W2 1');
    expect(dispositivo.gatt.connected).toBe(false);

    const servidor = await dispositivo.gatt.connect();
    expect(dispositivo.gatt.connected).toBe(true);
    const servicos = await servidor.getPrimaryServices();
    expect(servicos.map((s) => s.uuid)).toEqual(['0000fff0-0000-1000-8000-00805f9b34fb']);
    const caracteristicas = await servicos[0].getCharacteristics();
    expect(caracteristicas.map((c) => c.uuid)).toEqual([
      '0000fff3-0000-1000-8000-00805f9b34fb',
      '0000fff4-0000-1000-8000-00805f9b34fb',
    ]);
    const [escrita, notificacao] = caracteristicas;
    expect(escrita.properties.writeWithoutResponse).toBe(true);
    expect(escrita.properties.write).toBeFalsy();
    expect(escrita.properties.notify).toBeFalsy();
    expect(notificacao.properties.notify).toBe(true);
    expect(notificacao.properties.writeWithoutResponse).toBeFalsy();
  });

  it('o nome pode ser trocado e o mesmo dispositivo volta a cada pedido', async () => {
    const bt = criarBluetoothSimulado(new ModuloSimulado(), { nome: 'RunE W2 3' });
    const a = await bt.requestDevice(FILTRO_PADRAO);
    const b = await bt.requestDevice(FILTRO_PADRAO);
    expect(a.name).toBe('RunE W2 3');
    expect(b).toBe(a);
  });

  it('connect repetido devolve o mesmo servidor sem derrubar nada', async () => {
    const bt = criarBluetoothSimulado(new ModuloSimulado());
    const d = await bt.requestDevice(FILTRO_PADRAO);
    const [a, b] = await Promise.all([d.gatt.connect(), d.gatt.connect()]);
    expect(b).toBe(a);
    expect(await d.gatt.connect()).toBe(a);
  });

  it('filtros: prefixo do nome e serviço combinam; outro nome ou serviço dá NotFoundError', async () => {
    const bt = criarBluetoothSimulado(new ModuloSimulado());
    await expect(bt.requestDevice({ filters: [{ namePrefix: 'RunE' }] })).resolves.toBeDefined();
    await expect(bt.requestDevice({ filters: [{ services: [UUID_SERVICO] }] })).resolves.toBeDefined();
    await expect(bt.requestDevice({ filters: [{ services: ['0xfff0'] }] })).resolves.toBeDefined();
    await expect(bt.requestDevice({ filters: [{ namePrefix: 'FBLOCK' }, { namePrefix: 'RunE W2' }] })).resolves.toBeDefined();
    await expect(bt.requestDevice({ acceptAllDevices: true, optionalServices: [UUID_SERVICO] })).resolves.toBeDefined();

    for (const pedido of [
      { filters: [{ namePrefix: 'FBLOCK' }] },
      { filters: [{ namePrefix: 'RunE W3' }] },
      { filters: [{ services: ['0000180f-0000-1000-8000-00805f9b34fb'] }] },
      { filters: [{ namePrefix: 'RunE', services: ['0000180f-0000-1000-8000-00805f9b34fb'] }] },
    ]) {
      await expect(bt.requestDevice(pedido)).rejects.toMatchObject({ name: 'NotFoundError' });
    }
  });

  it('sem filters nem acceptAllDevices, requestDevice dá TypeError como o navegador', async () => {
    const bt = criarBluetoothSimulado(new ModuloSimulado());
    await expect(bt.requestDevice({})).rejects.toBeInstanceOf(TypeError);
    await expect(bt.requestDevice({ filters: [] })).rejects.toBeInstanceOf(TypeError);
  });

  it('serviço não declarado em filters nem em optionalServices não aparece (NotFoundError)', async () => {
    const bt = criarBluetoothSimulado(new ModuloSimulado());
    const d = await bt.requestDevice({ filters: [{ namePrefix: 'RunE' }] });
    const servidor = await d.gatt.connect();
    await expect(servidor.getPrimaryServices()).rejects.toMatchObject({ name: 'NotFoundError' });

    const d2 = await bt.requestDevice({ filters: [{ namePrefix: 'RunE' }], optionalServices: ['0xfff0'] });
    const servidor2 = await d2.gatt.connect();
    await expect(servidor2.getPrimaryServices()).resolves.toHaveLength(1);
  });

  it('rejeita latenciaMs inválida', () => {
    expect(() => criarBluetoothSimulado(new ModuloSimulado(), { latenciaMs: -1 })).toThrow(RangeError);
    expect(() => criarBluetoothSimulado(new ModuloSimulado(), { latenciaMs: Number.NaN })).toThrow(RangeError);
  });
});

describe('criarBluetoothSimulado: escritas e notificações', () => {
  it('escrita em fff3 chega ao módulo e a resposta volta pela fff4 só depois de a escrita terminar', async () => {
    const modulo = new ModuloSimulado({ fsHz: 500 });
    const bt = criarBluetoothSimulado(modulo);
    const { escrita, notificacao } = await conectar(bt);
    const recebidos = escutar(notificacao);
    await notificacao.startNotifications();

    await escrita.writeValueWithoutResponse(deHex('AA 03 81 06 84 BB'));
    expect(modulo.comandosRecebidos.map(hex)).toEqual(['AA 03 81 06 84 BB']);
    // A confirmação não pode ter chegado antes de a escrita voltar (corrida do "ack perdido").
    expect(recebidos).toHaveLength(0);
    await proximoTick();
    expect(recebidos.map(hex)).toEqual(['A5 04 06 02 00 00 5A']);
  });

  it('sequência completa: iniciar, receber quadros fragmentados, remontar e decodificar', async () => {
    const modulo = new ModuloSimulado({ mtu: 20, semente: 4 });
    const bt = criarBluetoothSimulado(modulo);
    const { escrita, notificacao } = await conectar(bt);
    const recebidos = escutar(notificacao);
    await notificacao.startNotifications();
    await escrita.writeValueWithoutResponse(cmd.iniciar(MODO.EMG, 1700000000000));
    await proximoTick();
    expect(decodificar(recebidos).eventos).toEqual([{ tipo: 'ack', endereco: 0x11 }]);

    recebidos.length = 0;
    modulo.avancar(1000);
    // Com latência 0 os dados de avancar() chegam na hora.
    const { eventos, descartados } = decodificar(recebidos);
    expect(brutos(eventos)).toHaveLength(20);
    expect(descartados).toBe(0);
    expect(recebidos.every((p) => p.length <= 20)).toBe(true);

    const referencia = sinalEmgSintetico({ fsHz: 1000, duracaoS: 1, semente: 4 });
    const lido = emendar(brutos(eventos));
    for (let i = 0; i < lido.length; i++) {
      expect(Math.abs(lido[i] - referencia[i])).toBeLessThanOrEqual(PASSO_UV / 2 + 1e-3);
    }
  });

  it('a confirmação chega antes dos dados quando avancar() vem logo depois da escrita', async () => {
    const modulo = new ModuloSimulado();
    const bt = criarBluetoothSimulado(modulo);
    const { escrita, notificacao } = await conectar(bt);
    const recebidos = escutar(notificacao);
    await notificacao.startNotifications();
    await escrita.writeValueWithoutResponse(cmd.iniciar(MODO.EMG, 1700000000000));
    modulo.avancar(100);
    await proximoTick();
    expect(decodificar(recebidos).eventos.map((e) => e.tipo)).toEqual(['ack', 'bruto', 'bruto']);
  });

  it('value é um DataView independente: copiado, com offset 0 e do tamanho do pedaço', async () => {
    const modulo = new ModuloSimulado({ mtu: 20 });
    const bt = criarBluetoothSimulado(modulo);
    const { notificacao } = await conectar(bt);
    const vistos: DataView[] = [];
    notificacao.addEventListener('characteristicvaluechanged', (ev) => {
      vistos.push(ev.target.value as DataView);
    });
    await notificacao.startNotifications();
    modulo.receberComando(INICIAR_EMG);
    modulo.avancar(50);
    await proximoTick();
    expect(vistos.length).toBeGreaterThan(1);
    expect(vistos.every((v) => v instanceof DataView && v.byteOffset === 0)).toBe(true);
    expect(vistos[0].byteLength).toBe(vistos[0].buffer.byteLength);
    expect(new Set(vistos.map((v) => v.buffer)).size).toBe(vistos.length);
    expect(notificacao.value).toBe(vistos[vistos.length - 1]);
  });

  it('sem startNotifications nada chega; depois dele, chega', async () => {
    const modulo = new ModuloSimulado();
    const bt = criarBluetoothSimulado(modulo);
    const { notificacao } = await conectar(bt);
    const recebidos = escutar(notificacao);
    modulo.receberComando(cmd.bateria());
    await proximoTick();
    expect(recebidos).toHaveLength(0);

    await notificacao.startNotifications();
    modulo.receberComando(cmd.bateria());
    await proximoTick();
    expect(recebidos).toHaveLength(1);
  });

  it('removeEventListener para de receber', async () => {
    const modulo = new ModuloSimulado();
    const bt = criarBluetoothSimulado(modulo);
    const { notificacao } = await conectar(bt);
    let chamadas = 0;
    const ouvinte = () => {
      chamadas++;
    };
    notificacao.addEventListener('characteristicvaluechanged', ouvinte);
    await notificacao.startNotifications();
    modulo.receberComando(cmd.bateria());
    await proximoTick();
    notificacao.removeEventListener('characteristicvaluechanged', ouvinte);
    modulo.receberComando(cmd.bateria());
    await proximoTick();
    expect(chamadas).toBe(1);
  });

  it('um ouvinte que lança não impede os outros nem o módulo', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const modulo = new ModuloSimulado();
      const bt = criarBluetoothSimulado(modulo);
      const { notificacao } = await conectar(bt);
      let segundo = 0;
      notificacao.addEventListener('characteristicvaluechanged', () => {
        throw new Error('ouvinte com defeito');
      });
      notificacao.addEventListener('characteristicvaluechanged', () => {
        segundo++;
      });
      await notificacao.startNotifications();
      expect(() => modulo.receberComando(cmd.bateria())).not.toThrow();
      await proximoTick();
      expect(segundo).toBe(1);
      expect(erro).toHaveBeenCalledTimes(1);
    } finally {
      erro.mockRestore();
    }
  });

  it('operações que o GATT real recusa também são recusadas aqui', async () => {
    const bt = criarBluetoothSimulado(new ModuloSimulado());
    const { escrita, notificacao } = await conectar(bt);
    await expect(escrita.writeValue(cmd.bateria())).rejects.toMatchObject({ name: 'NotSupportedError' });
    await expect(escrita.startNotifications()).rejects.toMatchObject({ name: 'NotSupportedError' });
    await expect(notificacao.writeValueWithoutResponse(cmd.bateria())).rejects.toMatchObject({ name: 'NotSupportedError' });
    await expect(notificacao.writeValue(cmd.bateria())).rejects.toMatchObject({ name: 'NotSupportedError' });
  });

  it('o comando é copiado na escrita: mexer no array depois não muda o que o módulo recebe', async () => {
    const modulo = new ModuloSimulado();
    const bt = criarBluetoothSimulado(modulo, { latenciaMs: 5 });
    const { escrita } = await conectar(bt);
    const bytes = deHex('AA 03 81 0B 89 BB');
    const pronta = escrita.writeValueWithoutResponse(bytes);
    bytes.fill(0);
    await pronta;
    expect(modulo.comandosRecebidos.map(hex)).toEqual(['AA 03 81 0B 89 BB']);
  });
});

describe('criarBluetoothSimulado: quedas e reconexão', () => {
  it('derrubar() avisa uma vez, marca desconectado, recusa escritas e para as notificações', async () => {
    const modulo = new ModuloSimulado();
    const bt = criarBluetoothSimulado(modulo);
    const { dispositivo, escrita, notificacao } = await conectar(bt);
    const recebidos = escutar(notificacao);
    await notificacao.startNotifications();
    let quedas = 0;
    dispositivo.addEventListener('gattserverdisconnected', () => {
      quedas++;
    });

    bt.derrubar();
    expect(quedas).toBe(1);
    expect(dispositivo.gatt.connected).toBe(false);
    await expect(escrita.writeValueWithoutResponse(cmd.bateria())).rejects.toMatchObject({ name: 'NetworkError' });
    await expect(notificacao.startNotifications()).rejects.toMatchObject({ name: 'NetworkError' });
    modulo.receberComando(cmd.bateria());
    await proximoTick();
    expect(recebidos).toHaveLength(0);

    bt.derrubar();
    expect(quedas).toBe(1);
  });

  it('connect() de novo religa, mas é preciso buscar as características e assinar de novo', async () => {
    const modulo = new ModuloSimulado();
    const bt = criarBluetoothSimulado(modulo);
    const primeira = await conectar(bt);
    const recebidosAntigos = escutar(primeira.notificacao);
    await primeira.notificacao.startNotifications();

    bt.derrubar();
    const servidor = await primeira.dispositivo.gatt.connect();
    expect(primeira.dispositivo.gatt.connected).toBe(true);
    const [servico] = await servidor.getPrimaryServices();
    const [escrita, notificacao] = await servico.getCharacteristics();

    // Objetos da conexão antiga ficam inertes.
    await expect(primeira.escrita.writeValueWithoutResponse(cmd.bateria())).rejects.toMatchObject({ name: 'InvalidStateError' });
    expect(escrita).not.toBe(primeira.escrita);

    const recebidos = escutar(notificacao);
    modulo.receberComando(cmd.bateria());
    await proximoTick();
    expect(recebidos).toHaveLength(0);

    await notificacao.startNotifications();
    await escrita.writeValueWithoutResponse(cmd.bateria());
    await proximoTick();
    expect(recebidos.map((p) => hex(p))).toHaveLength(1);
    expect(recebidosAntigos).toHaveLength(0);
  });

  it('a aquisição do módulo segue durante a queda: os quadros do intervalo se perdem e o carimbo salta', async () => {
    const modulo = new ModuloSimulado();
    const bt = criarBluetoothSimulado(modulo);
    const { notificacao } = await conectar(bt);
    const recebidos = escutar(notificacao);
    await notificacao.startNotifications();
    modulo.receberComando(INICIAR_EMG);
    await proximoTick();
    recebidos.length = 0;
    modulo.avancar(100);

    bt.derrubar();
    expect(modulo.adquirindo).toBe(true);
    modulo.avancar(500);
    expect(modulo.quadrosEmitidos).toBe(12);

    const d = await bt.requestDevice(FILTRO_PADRAO);
    const servidor = await d.gatt.connect();
    const [servico] = await servidor.getPrimaryServices();
    const [, novaNotificacao] = await servico.getCharacteristics();
    const depois = escutar(novaNotificacao);
    await novaNotificacao.startNotifications();
    modulo.avancar(100);

    const antes = brutos(decodificar(recebidos).eventos).map((e) => e.tsMs - EPOCA);
    const retomada = brutos(decodificar(depois).eventos).map((e) => e.tsMs - EPOCA);
    expect(antes).toEqual([49, 99]);
    expect(retomada).toEqual([649, 699]);
  });

  it('gatt.disconnect() também avisa a queda, uma vez, e perde o que estava a caminho', async () => {
    const modulo = new ModuloSimulado();
    const bt = criarBluetoothSimulado(modulo);
    const { dispositivo, escrita, notificacao } = await conectar(bt);
    const recebidos = escutar(notificacao);
    await notificacao.startNotifications();
    let quedas = 0;
    dispositivo.addEventListener('gattserverdisconnected', () => {
      quedas++;
    });

    // A confirmação desta escrita ainda está a caminho quando a conexão cai.
    await escrita.writeValueWithoutResponse(cmd.bateria());
    dispositivo.gatt.disconnect();
    dispositivo.gatt.disconnect();
    expect(quedas).toBe(1);
    expect(dispositivo.gatt.connected).toBe(false);
    await proximoTick();
    expect(recebidos).toHaveLength(0);
  });

  it('modulo.derrubarConexao() derruba a conexão pelo lado do módulo', async () => {
    const modulo = new ModuloSimulado();
    expect(modulo.derrubarConexao).toBeUndefined();
    const bt = criarBluetoothSimulado(modulo);
    const { dispositivo } = await conectar(bt);
    let quedas = 0;
    dispositivo.addEventListener('gattserverdisconnected', () => {
      quedas++;
    });
    modulo.derrubarConexao?.();
    expect(quedas).toBe(1);
    expect(dispositivo.gatt.connected).toBe(false);
  });

  it('removeEventListener de gattserverdisconnected funciona', async () => {
    const bt = criarBluetoothSimulado(new ModuloSimulado());
    const { dispositivo } = await conectar(bt);
    let quedas = 0;
    const ouvinte = () => {
      quedas++;
    };
    dispositivo.addEventListener('gattserverdisconnected', ouvinte);
    dispositivo.removeEventListener('gattserverdisconnected', ouvinte);
    bt.derrubar();
    expect(quedas).toBe(0);
  });

  it('o ouvinte de queda recebe um evento cujo target é o dispositivo', async () => {
    const bt = criarBluetoothSimulado(new ModuloSimulado());
    const { dispositivo } = await conectar(bt);
    let alvo: unknown = null;
    dispositivo.addEventListener('gattserverdisconnected', (ev) => {
      alvo = (ev as { target: DispositivoBle }).target;
    });
    bt.derrubar();
    expect(alvo).toBe(dispositivo);
  });
});

describe('criarBluetoothSimulado: latência', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('cada operação demora latenciaMs e as notificações chegam atrasadas, na ordem', async () => {
    const modulo = new ModuloSimulado({ mtu: 20 });
    const bt = criarBluetoothSimulado(modulo, { latenciaMs: 30 });

    let achou = false;
    const pedido = bt.requestDevice(FILTRO_PADRAO).then((d) => {
      achou = true;
      return d;
    });
    await vi.advanceTimersByTimeAsync(29);
    expect(achou).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const dispositivo = await pedido;
    expect(achou).toBe(true);

    const conexao = dispositivo.gatt.connect();
    await vi.advanceTimersByTimeAsync(30);
    const servidor = await conexao;
    expect(dispositivo.gatt.connected).toBe(true);
    const servicos = servidor.getPrimaryServices();
    await vi.advanceTimersByTimeAsync(30);
    const caracteristicas = (await servicos)[0].getCharacteristics();
    await vi.advanceTimersByTimeAsync(30);
    const [escrita, notificacao] = await caracteristicas;
    const recebidos = escutar(notificacao);
    const assinatura = notificacao.startNotifications();
    await vi.advanceTimersByTimeAsync(30);
    await assinatura;

    const escrito = escrita.writeValueWithoutResponse(cmd.iniciar(MODO.EMG, 1700000000000));
    await vi.advanceTimersByTimeAsync(30);
    await escrito;
    expect(modulo.adquirindo).toBe(true);
    expect(recebidos).toHaveLength(0);

    modulo.avancar(100);
    expect(recebidos).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(29);
    expect(recebidos).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    const { eventos, descartados } = decodificar(recebidos);
    expect(eventos.map((e) => e.tipo)).toEqual(['ack', 'bruto', 'bruto']);
    expect(descartados).toBe(0);
  });

  it('a queda cancela o que estava a caminho', async () => {
    const modulo = new ModuloSimulado();
    const bt = criarBluetoothSimulado(modulo, { latenciaMs: 10 });
    const pedido = bt.requestDevice(FILTRO_PADRAO);
    await vi.advanceTimersByTimeAsync(10);
    const dispositivo = await pedido;
    const conexao = dispositivo.gatt.connect();
    await vi.advanceTimersByTimeAsync(10);
    const servidor = await conexao;
    const servicos = servidor.getPrimaryServices();
    await vi.advanceTimersByTimeAsync(10);
    const caracteristicas = (await servicos)[0].getCharacteristics();
    await vi.advanceTimersByTimeAsync(10);
    const [escrita, notificacao] = await caracteristicas;
    const recebidos = escutar(notificacao);
    const assinatura = notificacao.startNotifications();
    await vi.advanceTimersByTimeAsync(10);
    await assinatura;

    const escrito = escrita.writeValueWithoutResponse(cmd.bateria());
    bt.derrubar();
    await vi.advanceTimersByTimeAsync(100);
    await expect(escrito).resolves.toBeUndefined();
    expect(modulo.comandosRecebidos).toHaveLength(0);
    expect(recebidos).toHaveLength(0);
  });
});
