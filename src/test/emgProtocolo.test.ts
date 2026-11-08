import { describe, expect, it } from 'vitest';
import {
  AcumuladorDeQuadros,
  DIVISOR_EEG,
  DIVISOR_EMG,
  ENDERECO,
  EPOCA_RELOGIO_MODULO_MS,
  MODO,
  PREFIXO_NOME,
  UUID_ESCRITA,
  UUID_NOTIFICACAO,
  UUID_SERVICO,
  cmd,
  interpretarQuadro,
  montarComando,
  nomeDoChip,
  numeroDoSensor,
  type EventoModulo,
  type Quadro,
} from '../lib/emg/protocolo';

// ---------------------------------------------------------------------------
// Apoio: codificador próprio, montado só a partir de docs/emg-protocolo-runew2.md.
// Nada aqui importa funções de implementação além das exportadas acima.
// ---------------------------------------------------------------------------

const EPOCA = 1661961600000;

function hex(b: ArrayLike<number>): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

function deHex(s: string): Uint8Array {
  return Uint8Array.from(s.trim().split(/\s+/).map((x) => parseInt(x, 16)));
}

function be48(v: number): number[] {
  const n = BigInt(v);
  const saida: number[] = [];
  for (let s = 40n; s >= 0n; s -= 8n) saida.push(Number((n >> s) & 0xffn));
  return saida;
}

function f32le(v: number): number[] {
  const dv = new DataView(new ArrayBuffer(4));
  dv.setFloat32(0, v, true);
  return [dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)];
}

function i16le(v: number): number[] {
  const x = v & 0xffff;
  return [x & 0xff, x >> 8];
}

function u16be(v: number): number[] {
  return [v >> 8, v & 0xff];
}

function ascii(s: string): number[] {
  return Array.from(s, (c) => c.charCodeAt(0));
}

function xorDe(bytes: number[]): number {
  return bytes.reduce((acc, x) => acc ^ x, 0);
}

interface OpcoesQuadro {
  /** Variante da spec sem o byte "??" antes do 5A (LEN = payload + 2). */
  semChecksum?: boolean;
  chk?: number;
}

/** A5 LEN ADDR LEN^ADDR PAYLOAD [??] 5A, total = LEN + 3. */
function quadro(addr: number, payload: number[], op: OpcoesQuadro = {}): Uint8Array {
  const len = payload.length + (op.semChecksum ? 2 : 3);
  const cabecalho = [0xa5, len, addr, len ^ addr];
  const corpo = [...cabecalho, ...payload];
  if (!op.semChecksum) corpo.push(op.chk ?? xorDe([len, addr, ...payload]));
  corpo.push(0x5a);
  return Uint8Array.from(corpo);
}

function quadroBruto(canal: 'emg' | 'eeg', ts48: number, base: number, deltas: number[], op: OpcoesQuadro = {}): Uint8Array {
  const modo = canal === 'emg' ? 3 : 4;
  const payload = [modo, ...be48(ts48), ...f32le(base)];
  for (const d of deltas) payload.push(...i16le(d));
  return quadro(0x11, payload, op);
}

function quadroRms(ts48: number, valores: number[], op: OpcoesQuadro = {}): Uint8Array {
  const payload = [0x01, ...be48(ts48)];
  for (const v of valores) payload.push(...u16be(v));
  return quadro(0x11, payload, op);
}

function quadroHistorico(ts48: number, valores: number[], op: OpcoesQuadro = {}): Uint8Array {
  const payload = [...be48(ts48)];
  for (const v of valores) payload.push(...u16be(v));
  return quadro(0x07, payload, op);
}

function quadroBateria(pct: number): Uint8Array {
  // 7 bytes de payload: o byte 6 do payload cai em f[10].
  return quadro(0x0b, [0x00, 0x0f, 0xa0, 0x10, 0x00, 0x00, pct]);
}

function comoQuadro(bytes: Uint8Array): Quadro {
  return { bytes, len: bytes[1], endereco: bytes[2] };
}

function decodificar(bytes: Uint8Array, op?: { incluirPrimeiraAmostra?: boolean }): EventoModulo {
  return interpretarQuadro(comoQuadro(bytes), op);
}

function evento<T extends EventoModulo['tipo']>(e: EventoModulo, tipo: T): Extract<EventoModulo, { tipo: T }> {
  expect(e.tipo).toBe(tipo);
  return e as Extract<EventoModulo, { tipo: T }>;
}

function concatenar(partes: Uint8Array[]): Uint8Array {
  const total = partes.reduce((n, p) => n + p.length, 0);
  const saida = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) {
    saida.set(p, pos);
    pos += p.length;
  }
  return saida;
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

function inteiro(rnd: () => number, min: number, max: number): number {
  return min + Math.floor(rnd() * (max - min + 1));
}

function proximoAcumulado(acumulador: AcumuladorDeQuadros, pedacos: Uint8Array[]): Quadro[] {
  const saida: Quadro[] = [];
  for (const p of pedacos) saida.push(...acumulador.push(p));
  return saida;
}

function hexDosQuadros(quadros: Quadro[]): string[] {
  return quadros.map((q) => hex(q.bytes));
}

function proximoPerto(real: number, esperado: number): void {
  // O acumulado em double perde ~1e-10 por passo quando as somas parciais chegam a 1e6.
  const tolerancia = Math.max(1e-6, 1e-12 * Math.abs(esperado));
  expect(Math.abs(real - esperado)).toBeLessThanOrEqual(tolerancia);
}

// Quadros de referência escritos à mão em hexa (cálculo feito fora do código testado).
const GOLDEN_BRUTO_EMG = 'A5 16 11 07 03 00 00 00 00 03 E8 00 00 80 3F E1 7A 1F 85 00 00 01 00 77 5A';
const GOLDEN_BRUTO_EEG_SEM_CHK = 'A5 13 11 02 04 00 00 00 00 03 E8 00 00 80 3F 23 31 DD CE 01 00 5A';
const GOLDEN_RMS = 'A5 12 11 03 01 00 00 3A DE 68 B1 01 02 FF FF 00 00 12 34 77 5A';
const GOLDEN_HISTORICO = 'A5 0F 07 08 00 00 3A DE 68 B1 00 0A 01 00 FF FE 77 5A';

// ---------------------------------------------------------------------------

describe('EMG protocolo: identificação do módulo', () => {
  it('usa os UUIDs e o prefixo de nome da spec', () => {
    expect(UUID_SERVICO).toBe('0000fff0-0000-1000-8000-00805f9b34fb');
    expect(UUID_ESCRITA).toBe('0000fff3-0000-1000-8000-00805f9b34fb');
    expect(UUID_NOTIFICACAO).toBe('0000fff4-0000-1000-8000-00805f9b34fb');
    expect(PREFIXO_NOME).toBe('RunE W2');
  });

  it.each([
    ['RunE W2 1', 1],
    ['RunE W2 0', 0],
    ['RunE W2 9', 9],
    ['RunE W2 3 extra', 3],
    ['RunE W2 12', 1],
  ])('numeroDoSensor(%j) = %j', (nome, esperado) => {
    expect(numeroDoSensor(nome)).toBe(esperado);
  });

  it.each([
    [''],
    ['RunE W2'],
    ['RunE W2 '],
    ['RunE W2 x'],
    ['RunE W2-1'],
    ['runE W2 1'],
    [' RunE W2 1'],
    ['XRunE W2 1'],
    ['RunE W3 1'],
    ['RunE  W2 1'],
  ])('numeroDoSensor(%j) = null', (nome) => {
    expect(numeroDoSensor(nome)).toBeNull();
  });

  it('não quebra com entrada que não é texto', () => {
    expect(numeroDoSensor(undefined as unknown as string)).toBeNull();
    expect(numeroDoSensor(null as unknown as string)).toBeNull();
    expect(numeroDoSensor(42 as unknown as string)).toBeNull();
  });
});

describe('EMG protocolo: constantes', () => {
  it('ENDERECO traz exatamente os endereços do item 2 da spec, sem repetição', () => {
    const esperados = [0x01, 0x02, 0x03, 0x04, 0x06, 0x07, 0x09, 0x0b, 0x0c, 0x0d, 0x0f, 0x11, 0x12, 0x13, 0x14, 0x17, 0x18, 0x19, 0x1d];
    const valores = Object.values(ENDERECO).sort((a, b) => a - b);
    expect(valores).toEqual(esperados);
  });

  it('MODO segue o item 2 (0x11)', () => {
    expect(MODO).toEqual({ PARAR: 0, RMS: 1, BRUTO_FLOAT: 2, EMG: 3, EEG: 4 });
  });

  it('época do relógio do módulo é 2022-08-31T16:00Z e os divisores são os da spec', () => {
    expect(EPOCA_RELOGIO_MODULO_MS).toBe(1661961600000);
    expect(EPOCA_RELOGIO_MODULO_MS).toBe(Date.UTC(2022, 7, 31, 16, 0, 0));
    expect(DIVISOR_EMG).toBe(3.1457);
    expect(DIVISOR_EEG).toBe(12.5786);
  });
});

describe('EMG protocolo: montarComando e cmd', () => {
  it('gera os comandos dourados da spec byte a byte', () => {
    expect(hex(cmd.versaoHardware())).toBe('AA 03 81 01 83 BB');
    expect(hex(cmd.versaoSoftware())).toBe('AA 03 81 02 80 BB');
    expect(hex(cmd.taxaDeAmostragem())).toBe('AA 03 81 06 84 BB');
    expect(hex(cmd.bateria())).toBe('AA 03 81 0B 89 BB');
    expect(hex(cmd.filtroHardware(false))).toBe('AA 04 80 0F 00 8B BB');
  });

  it('liga o filtro de hardware com DATA = 01', () => {
    expect(hex(cmd.filtroHardware(true))).toBe('AA 04 80 0F 01 8A BB');
  });

  it('iniciar EMG bruto tem LEN 0x0C (modo + 8 de timestamp + 3) e, como todo quadro, LEN + 3 bytes', () => {
    const c = cmd.iniciar(MODO.EMG, 1700000000000);
    expect(c[1]).toBe(0x0c);
    expect(c.length).toBe(15);
    expect(c.length).toBe(c[1] + 3);
    expect(hex(c)).toBe('AA 0C 80 11 03 00 00 01 8B CF E5 68 00 56 BB');
  });

  it('iniciar usa timestamp de 8 bytes big-endian e o modo pedido', () => {
    expect(hex(cmd.iniciar(MODO.RMS, 0))).toBe('AA 0C 80 11 01 00 00 00 00 00 00 00 00 9C BB');
    expect(cmd.iniciar(MODO.EEG, 0)[4]).toBe(4);
    expect(cmd.iniciar(MODO.BRUTO_FLOAT, 0)[4]).toBe(2);
  });

  it('parar é a escrita em 0x11 com modo 0', () => {
    expect(hex(cmd.parar(1700000000000))).toBe('AA 0C 80 11 00 00 00 01 8B CF E5 68 00 55 BB');
  });

  it('aceita o maior inteiro seguro como timestamp', () => {
    const c = cmd.iniciar(MODO.EMG, Number.MAX_SAFE_INTEGER);
    expect(hex(c.subarray(5, 13))).toBe('00 1F FF FF FF FF FF FF');
  });

  it('histórico RMS é leitura de 0x07 com ts[8] e quantidade[2] big-endian', () => {
    const c = cmd.historicoRms(1700000000000, 300);
    expect(hex(c)).toBe('AA 0D 81 07 00 00 01 8B CF E5 68 00 01 2C 6E BB');
    expect(c.length).toBe(16);
    expect(hex(cmd.historicoRms(0, 0).subarray(12, 14))).toBe('00 00');
    expect(hex(cmd.historicoRms(0, 65535).subarray(12, 14))).toBe('FF FF');
  });

  it('reset escreve 0x01 em 0x13', () => {
    expect(hex(cmd.reset())).toBe('AA 04 80 13 01 96 BB');
  });

  it('cabeçalho, LEN, XOR e rodapé valem para qualquer comando (semente fixa)', () => {
    const rnd = mulberry32(2024);
    for (let it = 0; it < 300; it++) {
      const escrita = rnd() < 0.5;
      const addr = inteiro(rnd, 0, 255);
      const dados = Array.from({ length: inteiro(rnd, 0, 252) }, () => inteiro(rnd, 0, 255));
      const c = montarComando(escrita, addr, dados);
      expect(c.length).toBe(dados.length + 6);
      expect(c[0]).toBe(0xaa);
      expect(c[1]).toBe(dados.length + 3);
      expect(c[2]).toBe(escrita ? 0x80 : 0x81);
      expect(c[3]).toBe(addr);
      expect(Array.from(c.subarray(4, 4 + dados.length))).toEqual(dados);
      expect(c[c.length - 1]).toBe(0xbb);
      // XOR de LEN até o último byte de DATA, conferido pela propriedade: tudo de LEN ao XOR dá zero.
      expect(xorDe(Array.from(c.subarray(1, c.length - 1)))).toBe(0);
    }
  });

  it('dados é opcional e aceita Array, Uint8Array e array-like', () => {
    expect(hex(montarComando(false, 0x01))).toBe('AA 03 81 01 83 BB');
    expect(hex(montarComando(false, 0x01, []))).toBe('AA 03 81 01 83 BB');
    expect(hex(montarComando(true, 0x0f, [0]))).toBe('AA 04 80 0F 00 8B BB');
    expect(hex(montarComando(true, 0x0f, Uint8Array.of(0)))).toBe('AA 04 80 0F 00 8B BB');
    expect(hex(montarComando(true, 0x0f, { length: 1, 0: 0 }))).toBe('AA 04 80 0F 00 8B BB');
  });

  it('não altera o array de dados recebido', () => {
    const dados = [1, 2, 3];
    montarComando(true, 0x19, dados);
    expect(dados).toEqual([1, 2, 3]);
  });

  it('aceita até 252 bytes de dados (LEN 255) e recusa 253', () => {
    const c = montarComando(true, 0x19, new Array(252).fill(0xff));
    expect(c.length).toBe(258);
    expect(c[1]).toBe(255);
    expect(xorDe(Array.from(c.subarray(1, c.length - 1)))).toBe(0);
    expect(() => montarComando(true, 0x19, new Array(253).fill(0))).toThrow(RangeError);
  });

  it.each([[256], [-1], [1.5], [Number.NaN], [Number.POSITIVE_INFINITY], [0x1ff]])('recusa byte de dado inválido %j', (valor) => {
    expect(() => montarComando(true, 0x19, [0, valor])).toThrow(RangeError);
  });

  it.each([[256], [-1], [0.5], [Number.NaN]])('recusa endereço inválido %j', (endereco) => {
    expect(() => montarComando(false, endereco)).toThrow(RangeError);
  });

  it('aceita os extremos 0 e 255 em endereço e dados', () => {
    const c = montarComando(true, 255, [0, 255]);
    expect(hex(c)).toBe('AA 05 80 FF 00 FF 85 BB');
  });

  it.each([[-1], [1.5], [Number.NaN], [Number.POSITIVE_INFINITY], [Number.MAX_SAFE_INTEGER + 1]])('recusa timestamp inválido %j', (ts) => {
    expect(() => cmd.iniciar(MODO.EMG, ts)).toThrow(RangeError);
    expect(() => cmd.parar(ts)).toThrow(RangeError);
    expect(() => cmd.historicoRms(ts, 1)).toThrow(RangeError);
  });

  it.each([[256], [-1], [1.5], [Number.NaN]])('recusa modo inválido %j', (modo) => {
    expect(() => cmd.iniciar(modo, 0)).toThrow(RangeError);
  });

  it.each([[-1], [65536], [1.5], [Number.NaN]])('recusa quantidade de histórico inválida %j', (n) => {
    expect(() => cmd.historicoRms(0, n)).toThrow(RangeError);
  });
});

describe('EMG protocolo: AcumuladorDeQuadros', () => {
  const taxa = quadro(0x06, [1]);
  const bateria = quadroBateria(87);
  const versao = quadro(0x01, ascii('V1.2.3'));
  const rms = quadroRms(123456, [10, 20, 65535]);
  const bruto = quadroBruto('emg', 5000, 12.5, [1, -1, 100, -100, 32767, -32768]);
  const fluxo = [taxa, bateria, versao, rms, bruto];
  const fluxoHex = fluxo.map(hex);

  it('devolve nada para pedaço vazio', () => {
    const ac = new AcumuladorDeQuadros();
    expect(ac.push(new Uint8Array(0))).toEqual([]);
    expect(ac.pendentes).toBe(0);
    expect(ac.descartados).toBe(0);
  });

  it('extrai um quadro inteiro com len, endereço e bytes corretos', () => {
    const ac = new AcumuladorDeQuadros();
    const q = ac.push(bateria);
    expect(q).toHaveLength(1);
    expect(hex(q[0].bytes)).toBe(hex(bateria));
    expect(q[0].len).toBe(bateria[1]);
    expect(q[0].endereco).toBe(0x0b);
    expect(ac.pendentes).toBe(0);
    expect(ac.descartados).toBe(0);
  });

  it('extrai os quadros de referência da spec', () => {
    const ac = new AcumuladorDeQuadros();
    const q = ac.push(concatenar([deHex(GOLDEN_BRUTO_EMG), deHex(GOLDEN_RMS), deHex(GOLDEN_HISTORICO), deHex(GOLDEN_BRUTO_EEG_SEM_CHK)]));
    expect(q.map((x) => x.endereco)).toEqual([0x11, 0x11, 0x07, 0x11]);
    expect(q.map((x) => x.len)).toEqual([0x16, 0x12, 0x0f, 0x13]);
  });

  it('junta vários quadros num pedaço só', () => {
    const ac = new AcumuladorDeQuadros();
    const q = ac.push(concatenar(fluxo));
    expect(hexDosQuadros(q)).toEqual(fluxoHex);
    expect(ac.descartados).toBe(0);
    expect(ac.pendentes).toBe(0);
  });

  it('reconstrói o fluxo cortado em TODA fronteira de byte', () => {
    const tudo = concatenar(fluxo);
    for (let corte = 0; corte <= tudo.length; corte++) {
      const ac = new AcumuladorDeQuadros();
      const q = proximoAcumulado(ac, [tudo.subarray(0, corte), tudo.subarray(corte)]);
      expect(hexDosQuadros(q), `corte em ${corte}`).toEqual(fluxoHex);
      expect(ac.descartados, `corte em ${corte}`).toBe(0);
      expect(ac.pendentes).toBe(0);
    }
  });

  it('reconstrói cada quadro cortado em toda fronteira, sozinho', () => {
    for (const f of fluxo) {
      for (let corte = 1; corte < f.length; corte++) {
        const ac = new AcumuladorDeQuadros();
        expect(ac.push(f.subarray(0, corte)), `${hex(f)} corte ${corte}`).toEqual([]);
        const q = ac.push(f.subarray(corte));
        expect(hexDosQuadros(q)).toEqual([hex(f)]);
      }
    }
  });

  it('reconstrói em pedaços de 1 byte', () => {
    const tudo = concatenar(fluxo);
    const ac = new AcumuladorDeQuadros();
    const pedacos: Uint8Array[] = [];
    for (let i = 0; i < tudo.length; i++) pedacos.push(tudo.subarray(i, i + 1));
    const q = proximoAcumulado(ac, pedacos);
    expect(hexDosQuadros(q)).toEqual(fluxoHex);
    expect(ac.descartados).toBe(0);
    expect(ac.pendentes).toBe(0);
  });

  it('reconstrói com dois cortes em quaisquer posições (curtos)', () => {
    const curtos = [taxa, quadro(0x0f, [0]), quadro(0x06, [0])];
    const tudo = concatenar(curtos);
    const esperado = curtos.map(hex);
    for (let a = 0; a <= tudo.length; a++) {
      for (let b = a; b <= tudo.length; b++) {
        const ac = new AcumuladorDeQuadros();
        const q = proximoAcumulado(ac, [tudo.subarray(0, a), tudo.subarray(a, b), tudo.subarray(b)]);
        expect(hexDosQuadros(q), `cortes ${a},${b}`).toEqual(esperado);
      }
    }
  });

  it('reconstrói com fragmentação aleatória de semente fixa', () => {
    const rnd = mulberry32(77);
    for (let rodada = 0; rodada < 60; rodada++) {
      const quadros: Uint8Array[] = [];
      for (let i = 0; i < 12; i++) {
        const deltas = Array.from({ length: inteiro(rnd, 0, 100) }, () => inteiro(rnd, -32768, 32767));
        quadros.push(quadroBruto('emg', inteiro(rnd, 0, 2 ** 40), rnd() * 100, deltas));
        quadros.push(quadroBateria(inteiro(rnd, 0, 100)));
      }
      const tudo = concatenar(quadros);
      const ac = new AcumuladorDeQuadros();
      const pedacos: Uint8Array[] = [];
      let pos = 0;
      while (pos < tudo.length) {
        const tam = inteiro(rnd, 1, 40);
        pedacos.push(tudo.subarray(pos, pos + tam));
        pos += tam;
      }
      const q = proximoAcumulado(ac, pedacos);
      expect(hexDosQuadros(q)).toEqual(quadros.map(hex));
      expect(ac.descartados).toBe(0);
    }
  });

  it('aceita pedaço que é uma janela (byteOffset diferente de zero) de um buffer maior', () => {
    const grande = new Uint8Array(100);
    grande.fill(0xee);
    grande.set(bateria, 37);
    const ac = new AcumuladorDeQuadros();
    const q = ac.push(grande.subarray(37, 37 + bateria.length));
    expect(hexDosQuadros(q)).toEqual([hex(bateria)]);
  });

  it('não depende do pedaço depois do push (o chamador pode reaproveitar o buffer)', () => {
    const metade = Math.floor(bruto.length / 2);
    const reaproveitado = new Uint8Array(bruto.subarray(0, metade));
    const ac = new AcumuladorDeQuadros();
    expect(ac.push(reaproveitado)).toEqual([]);
    reaproveitado.fill(0);
    const q = ac.push(bruto.subarray(metade));
    expect(hexDosQuadros(q)).toEqual([hex(bruto)]);
  });

  it('entrega cópias: alterar o quadro emitido não corrompe os próximos', () => {
    const ac = new AcumuladorDeQuadros();
    const corte = bateria.length + 3;
    const primeiro = ac.push(concatenar([bateria, taxa]).subarray(0, corte));
    primeiro[0].bytes.fill(0);
    const resto = ac.push(concatenar([bateria, taxa]).subarray(corte));
    expect(hexDosQuadros(resto)).toEqual([hex(taxa)]);
  });

  it('descarta lixo antes do A5 e conta os bytes descartados', () => {
    const ac = new AcumuladorDeQuadros();
    const lixo = Uint8Array.of(0x00, 0x01, 0xff, 0x5a, 0x10);
    const q = ac.push(concatenar([lixo, bateria]));
    expect(hexDosQuadros(q)).toEqual([hex(bateria)]);
    expect(ac.descartados).toBe(5);
  });

  it('lixo contendo A5 falso (cabeçalho que não bate) é descartado byte a byte', () => {
    const lixo = Uint8Array.of(0xa5, 0xa5, 0x01, 0x02, 0xa5);
    const ac = new AcumuladorDeQuadros();
    const q = ac.push(concatenar([lixo, taxa, bateria]));
    expect(hexDosQuadros(q)).toEqual([hex(taxa), hex(bateria)]);
    expect(ac.descartados).toBe(5);
  });

  it('A5 isolado no fim do pedaço fica pendente até chegar o resto', () => {
    const ac = new AcumuladorDeQuadros();
    expect(ac.push(Uint8Array.of(0xa5))).toEqual([]);
    expect(ac.pendentes).toBe(1);
    const q = ac.push(taxa.subarray(1));
    expect(hexDosQuadros(q)).toEqual([hex(taxa)]);
  });

  it('XOR de cabeçalho errado: descarta o quadro e segue para o próximo', () => {
    const ruim = Uint8Array.from(bateria);
    ruim[3] ^= 0x01;
    expect(Array.from(ruim.subarray(1)).includes(0xa5)).toBe(false);
    const ac = new AcumuladorDeQuadros();
    const q = ac.push(concatenar([ruim, taxa]));
    expect(hexDosQuadros(q)).toEqual([hex(taxa)]);
    expect(ac.descartados).toBe(ruim.length);
  });

  it('5A faltando no fim: descarta o quadro e segue para o próximo', () => {
    const ruim = Uint8Array.from(bateria);
    ruim[ruim.length - 1] = 0x00;
    expect(Array.from(ruim.subarray(1)).includes(0xa5)).toBe(false);
    const ac = new AcumuladorDeQuadros();
    const q = ac.push(concatenar([ruim, taxa, bateria]));
    expect(hexDosQuadros(q)).toEqual([hex(taxa), hex(bateria)]);
    expect(ac.descartados).toBe(ruim.length);
  });

  it('5A faltando no último quadro do pedaço: descarta sem ficar pendente', () => {
    const ruim = Uint8Array.from(taxa);
    ruim[ruim.length - 1] = 0x00;
    const ac = new AcumuladorDeQuadros();
    expect(ac.push(ruim)).toEqual([]);
    expect(ac.pendentes).toBe(0);
    expect(ac.descartados).toBe(ruim.length);
  });

  it('o byte antes do 5A não é validado (pode ter qualquer valor)', () => {
    const ac = new AcumuladorDeQuadros();
    for (let chk = 0; chk < 256; chk++) {
      const q = ac.push(quadro(0x0b, [0, 0, 0, 0, 0, 0, 50], { chk }));
      expect(q).toHaveLength(1);
    }
    expect(ac.descartados).toBe(0);
  });

  it('quadro com LEN abaixo do mínimo (cabeçalho coerente e 5A no lugar) é recusado', () => {
    const ac = new AcumuladorDeQuadros();
    expect(ac.push(Uint8Array.of(0xa5, 0x01, 0x5b, 0x5a))).toEqual([]);
    expect(ac.push(Uint8Array.of(0xa5, 0x00, 0x5a, 0x5a, 0x5a))).toEqual([]);
    expect(ac.pendentes).toBe(0);
    expect(ac.descartados).toBe(9);
  });

  it('aceita o quadro de confirmação mínimo, sem payload', () => {
    const ac = new AcumuladorDeQuadros();
    const comChk = ac.push(quadro(0x0f, []));
    const semChk = ac.push(quadro(0x13, [], { semChecksum: true }));
    expect(comChk.map((q) => [q.len, q.endereco])).toEqual([[3, 0x0f]]);
    expect(semChk.map((q) => [q.len, q.endereco])).toEqual([[2, 0x13]]);
    expect(semChk[0].bytes.length).toBe(5);
  });

  it('aceita o quadro máximo (LEN 255, 258 bytes) mesmo cortado em toda fronteira', () => {
    const payload = Array.from({ length: 252 }, (_, i) => (i * 7) & 0xff);
    const enorme = quadro(0x11, payload);
    expect(enorme[1]).toBe(255);
    expect(enorme.length).toBe(258);
    for (let corte = 1; corte < enorme.length; corte++) {
      const ac = new AcumuladorDeQuadros();
      ac.push(enorme.subarray(0, corte));
      const q = ac.push(enorme.subarray(corte));
      expect(q, `corte ${corte}`).toHaveLength(1);
      expect(q[0].bytes.length).toBe(258);
    }
  });

  it('LEN absurdo com cabeçalho coerente: espera, não trava e depois recupera os quadros reais', () => {
    const falso = Uint8Array.of(0xa5, 0xff, 0x01, 0xfe);
    const reais: Uint8Array[] = [];
    for (let i = 0; i < 30; i++) reais.push(quadro(0x06, [1, 2, 3, 4, 5, 6, 7, 8]));
    const tudo = concatenar([falso, ...reais]);
    expect(reais[0].length).toBe(14);
    expect(tudo[257]).not.toBe(0x5a);

    const ac = new AcumuladorDeQuadros();
    const antes = ac.push(tudo.subarray(0, 100));
    expect(antes).toEqual([]);
    expect(ac.pendentes).toBeLessThanOrEqual(258);
    const depois = ac.push(tudo.subarray(100));
    expect(hexDosQuadros(depois)).toEqual(reais.map(hex));
    expect(ac.descartados).toBe(4);
  });

  it('LEN absurdo seguido de silêncio: buffer fica limitado e reset() limpa', () => {
    const ac = new AcumuladorDeQuadros();
    expect(ac.push(Uint8Array.of(0xa5, 0xff, 0x01, 0xfe, 0x00, 0x00))).toEqual([]);
    expect(ac.pendentes).toBe(6);
    ac.reset();
    expect(ac.pendentes).toBe(0);
    expect(hexDosQuadros(ac.push(taxa))).toEqual([hex(taxa)]);
  });

  it('ruído aleatório: não lança, não cresce sem limite e só emite quadros bem formados', () => {
    const rnd = mulberry32(31337);
    const ac = new AcumuladorDeQuadros();
    let pico = 0;
    for (let i = 0; i < 400; i++) {
      const pedaco = new Uint8Array(inteiro(rnd, 1, 600));
      for (let j = 0; j < pedaco.length; j++) {
        // Muitos A5/5A e LENs plausíveis para exercitar a ressincronização.
        const sorteio = rnd();
        if (sorteio < 0.1) pedaco[j] = 0xa5;
        else if (sorteio < 0.2) pedaco[j] = 0x5a;
        else pedaco[j] = inteiro(rnd, 0, 255);
      }
      for (const q of ac.push(pedaco)) {
        expect(q.bytes[0]).toBe(0xa5);
        expect(q.bytes.length).toBe(q.len + 3);
        expect(q.bytes[q.bytes.length - 1]).toBe(0x5a);
        expect(q.bytes[3]).toBe(q.bytes[1] ^ q.bytes[2]);
        expect(q.endereco).toBe(q.bytes[2]);
      }
      pico = Math.max(pico, ac.pendentes);
    }
    expect(pico).toBeLessThanOrEqual(258);
    expect(ac.descartados).toBeGreaterThan(0);
  });

  it('um pedaço gigante de lixo (1 MB) é consumido sem estourar o buffer', () => {
    const rnd = mulberry32(9);
    const lixo = new Uint8Array(1024 * 1024);
    for (let i = 0; i < lixo.length; i++) lixo[i] = inteiro(rnd, 0, 0x7f);
    const ac = new AcumuladorDeQuadros();
    expect(ac.push(lixo)).toEqual([]);
    expect(ac.pendentes).toBe(0);
    expect(ac.descartados).toBe(lixo.length);
  });

  it('um pedaço gigante com quadros válidos no meio não perde nenhum', () => {
    const quadros: Uint8Array[] = [];
    for (let i = 0; i < 2000; i++) quadros.push(quadroBateria(i % 101));
    const ac = new AcumuladorDeQuadros();
    const q = ac.push(concatenar(quadros));
    expect(q).toHaveLength(2000);
    expect(q.map((x) => x.bytes[10])).toEqual(quadros.map((_, i) => i % 101));
  });

  it('depois de ruído, volta a reconhecer quadros válidos', () => {
    const rnd = mulberry32(5);
    const ac = new AcumuladorDeQuadros();
    const ruido = new Uint8Array(50000);
    for (let i = 0; i < ruido.length; i++) ruido[i] = inteiro(rnd, 0, 255);
    ac.push(ruido);
    // Zeros fecham qualquer quadro falso pendente (o 5A esperado cairia em um zero).
    ac.push(new Uint8Array(300));
    const q = ac.push(concatenar([taxa, bateria]));
    expect(hexDosQuadros(q)).toEqual([hex(taxa), hex(bateria)]);
    expect(ac.pendentes).toBe(0);
  });

  it('reset() descarta o quadro pela metade e zera o contador', () => {
    const ac = new AcumuladorDeQuadros();
    ac.push(Uint8Array.of(0x00, 0x01));
    expect(ac.descartados).toBe(2);
    ac.push(bruto.subarray(0, 10));
    expect(ac.pendentes).toBe(10);
    ac.reset();
    expect(ac.pendentes).toBe(0);
    expect(ac.descartados).toBe(0);
    expect(ac.push(bruto.subarray(10))).toEqual([]);
    expect(hexDosQuadros(ac.push(taxa))).toEqual([hex(taxa)]);
  });
});

describe('EMG protocolo: interpretarQuadro, respostas simples', () => {
  it('versão de hardware e de software (texto UTF-8 até LEN+1, exclusive)', () => {
    expect(evento(decodificar(quadro(0x01, ascii('HW-2.0'))), 'versao_hw').texto).toBe('HW-2.0');
    expect(evento(decodificar(quadro(0x02, ascii('V1.2.3'))), 'versao_sw').texto).toBe('V1.2.3');
    expect(evento(decodificar(quadro(0x02, [0x56, 0xc3, 0xa9])), 'versao_sw').texto).toBe('Vé');
  });

  it('versão: o byte antes do 5A e o 5A ficam fora do texto', () => {
    const f = deHex('A5 06 01 07 41 42 43 99 5A');
    expect(f[1]).toBe(6);
    expect(evento(decodificar(f), 'versao_hw').texto).toBe('ABC');
  });

  it('versão sem payload vira texto vazio', () => {
    expect(evento(decodificar(quadro(0x01, [])), 'versao_hw').texto).toBe('');
  });

  it('taxa de amostragem: 0 = 500 Hz, 1 = 1000 Hz', () => {
    expect(decodificar(quadro(0x06, [0]))).toEqual({ tipo: 'taxa', hz: 500 });
    expect(decodificar(quadro(0x06, [1]))).toEqual({ tipo: 'taxa', hz: 1000 });
    expect(decodificar(deHex('A5 04 06 02 01 00 5A'))).toEqual({ tipo: 'taxa', hz: 1000 });
  });

  it.each([[2], [3], [127], [255]])('taxa com código %j é inválida', (codigo) => {
    expect(decodificar(quadro(0x06, [codigo])).tipo).toBe('invalido');
  });

  it('taxa sem nenhum dado é inválida', () => {
    expect(decodificar(quadro(0x06, [], { semChecksum: true })).tipo).toBe('invalido');
  });

  it.each([[0], [1], [57], [99], [100]])('bateria %j%% vem de f[10]', (pct) => {
    expect(decodificar(quadroBateria(pct))).toEqual({ tipo: 'bateria', pct });
  });

  it('bateria vem de f[10] e não de outro byte', () => {
    const f = deHex('A5 0A 0B 01 11 22 33 44 55 66 2A 77 5A');
    expect(f[1]).toBe(10);
    expect(decodificar(f)).toEqual({ tipo: 'bateria', pct: 0x2a });
  });

  it.each([[101], [200], [255]])('bateria fora de 0..100 (%j) é inválida', (pct) => {
    expect(decodificar(quadroBateria(pct)).tipo).toBe('invalido');
  });

  it('bateria com quadro curto demais para f[10] é inválida', () => {
    expect(decodificar(quadro(0x0b, [0x00, 0x0f, 0xa0])).tipo).toBe('invalido');
    expect(decodificar(quadro(0x0b, [])).tipo).toBe('invalido');
  });

  it('ID do chip analógico devolve o código cru; nomeDoChip traduz', () => {
    expect(decodificar(quadro(0x17, [125]))).toEqual({ tipo: 'chip', codigo: 125 });
    expect(decodificar(quadro(0x17, [126]))).toEqual({ tipo: 'chip', codigo: 126 });
    expect(decodificar(quadro(0x17, [7]))).toEqual({ tipo: 'chip', codigo: 7 });
    expect(nomeDoChip(125)).toBe('LH001-91');
    expect(nomeDoChip(126)).toBe('LH001-99');
    expect(nomeDoChip(7)).toBeNull();
  });

  it('tipo de hardware 0..3', () => {
    expect(decodificar(quadro(0x1d, [0]))).toEqual({ tipo: 'hardware', modelo: 'EMG-Module' });
    expect(decodificar(quadro(0x1d, [1]))).toEqual({ tipo: 'hardware', modelo: 'EEG-Module' });
    expect(decodificar(quadro(0x1d, [2]))).toEqual({ tipo: 'hardware', modelo: 'EMG-Pro' });
    expect(decodificar(quadro(0x1d, [3]))).toEqual({ tipo: 'hardware', modelo: 'EEG-Pro' });
  });

  it.each([[4], [5], [255]])('tipo de hardware %j é inválido', (codigo) => {
    expect(decodificar(quadro(0x1d, [codigo])).tipo).toBe('invalido');
  });

  it('chip e hardware sem dados são inválidos', () => {
    expect(decodificar(quadro(0x17, [], { semChecksum: true })).tipo).toBe('invalido');
    expect(decodificar(quadro(0x1d, [], { semChecksum: true })).tipo).toBe('invalido');
  });

  it.each([
    [ENDERECO.FILTRO_HARDWARE],
    [ENDERECO.RESET],
    [ENDERECO.SLEEP],
    [ENDERECO.LED],
    [ENDERECO.NUMERO_DISPOSITIVO],
    [ENDERECO.MAC],
    [0x7e],
  ])('qualquer outro endereço (%i) vira ack com o próprio endereço', (addr) => {
    expect(decodificar(quadro(addr, [0x01]))).toEqual({ tipo: 'ack', endereco: addr });
    expect(decodificar(quadro(addr, []))).toEqual({ tipo: 'ack', endereco: addr });
  });

  it('0x11 com modo parar, ou sem modo algum, é ack', () => {
    expect(decodificar(quadro(0x11, [0x00]))).toEqual({ tipo: 'ack', endereco: 0x11 });
    expect(decodificar(quadro(0x11, [0x00, 0, 0, 0, 0, 0, 0, 0, 0]))).toEqual({ tipo: 'ack', endereco: 0x11 });
    expect(decodificar(quadro(0x11, [], { semChecksum: true }))).toEqual({ tipo: 'ack', endereco: 0x11 });
  });

  it('0x11 com modo desconhecido ou legado (0x02) é inválido', () => {
    const base = [...be48(0), ...f32le(1)];
    expect(decodificar(quadro(0x11, [0x02, ...base, 1, 2])).tipo).toBe('invalido');
    expect(decodificar(quadro(0x11, [0x09, ...base, 1, 2])).tipo).toBe('invalido');
    expect(decodificar(quadro(0x11, [0xff, ...base])).tipo).toBe('invalido');
  });
});

describe('EMG protocolo: interpretarQuadro, RMS e histórico', () => {
  it('RMS de referência da spec', () => {
    const e = evento(decodificar(deHex(GOLDEN_RMS)), 'rms');
    expect(e.tsUltimoMs).toBe(987654321 + EPOCA);
    expect(e.tsUltimoMs).toBe(1662949254321);
    expect(e.valores).toEqual([0x0102, 0xffff, 0, 0x1234]);
    expect(e.intervaloMs).toBe(50);
  });

  it('RMS valor i = f[11+2i]*256 + f[12+2i]', () => {
    const f = deHex('A5 10 11 01 01 00 00 00 00 00 01 00 01 01 00 00 FF 99 5A');
    expect(f[1]).toBe(16);
    const e = evento(decodificar(f), 'rms');
    expect(e.valores).toEqual([1, 256, 255]);
    expect(e.tsUltimoMs).toBe(1 + EPOCA);
  });

  it('RMS sem valores (só o carimbo) devolve lista vazia', () => {
    const e = evento(decodificar(quadroRms(1000, [])), 'rms');
    expect(e.valores).toEqual([]);
    expect(e.tsUltimoMs).toBe(1000 + EPOCA);
  });

  it('RMS usa os 48 bits do carimbo, até o máximo', () => {
    const maximo = 2 ** 48 - 1;
    expect(evento(decodificar(quadroRms(maximo, [1])), 'rms').tsUltimoMs).toBe(maximo + EPOCA);
    expect(evento(decodificar(quadroRms(0, [1])), 'rms').tsUltimoMs).toBe(EPOCA);
    expect(evento(decodificar(quadroRms(2 ** 32, [1])), 'rms').tsUltimoMs).toBe(2 ** 32 + EPOCA);
    expect(evento(decodificar(quadroRms(2 ** 32 - 1, [1])), 'rms').tsUltimoMs).toBe(2 ** 32 - 1 + EPOCA);
  });

  it('RMS ida e volta, com e sem o byte extra antes do 5A (semente fixa)', () => {
    const rnd = mulberry32(4242);
    for (let it = 0; it < 200; it++) {
      const semChecksum = it % 2 === 1;
      const maxN = semChecksum ? 123 : 122;
      const valores = Array.from({ length: inteiro(rnd, 0, maxN) }, () => inteiro(rnd, 0, 65535));
      const ts = inteiro(rnd, 0, 2 ** 48 - 1);
      const f = quadroRms(ts, valores, { semChecksum, chk: inteiro(rnd, 0, 255) });
      const e = evento(decodificar(f), 'rms');
      expect(e.valores).toEqual(valores);
      expect(e.tsUltimoMs).toBe(ts + EPOCA);
    }
  });

  it('histórico RMS de referência da spec', () => {
    const e = evento(decodificar(deHex(GOLDEN_HISTORICO)), 'historico_rms');
    expect(e.tsMs).toBe(987654321 + EPOCA);
    expect(e.valores).toEqual([10, 256, 65534]);
  });

  it('histórico RMS ida e volta, com e sem o byte extra (semente fixa)', () => {
    const rnd = mulberry32(99);
    for (let it = 0; it < 200; it++) {
      const semChecksum = it % 2 === 1;
      const valores = Array.from({ length: inteiro(rnd, 0, 120) }, () => inteiro(rnd, 0, 65535));
      const ts = inteiro(rnd, 0, 2 ** 48 - 1);
      const e = evento(decodificar(quadroHistorico(ts, valores, { semChecksum })), 'historico_rms');
      expect(e.valores).toEqual(valores);
      expect(e.tsMs).toBe(ts + EPOCA);
    }
  });

  it('histórico RMS vazio devolve lista vazia', () => {
    expect(evento(decodificar(quadroHistorico(5, [])), 'historico_rms').valores).toEqual([]);
  });

  it('RMS e histórico curtos demais para o carimbo são inválidos', () => {
    expect(decodificar(quadro(0x11, [0x01, 0, 0, 0])).tipo).toBe('invalido');
    expect(decodificar(quadro(0x07, [0, 0, 0])).tipo).toBe('invalido');
    expect(decodificar(quadro(0x07, [], { semChecksum: true })).tipo).toBe('invalido');
  });
});

describe('EMG protocolo: interpretarQuadro, EMG/EEG bruto', () => {
  it('EMG bruto de referência: base float32 e deltas de int16 little-endian', () => {
    const e = evento(decodificar(deHex(GOLDEN_BRUTO_EMG)), 'bruto');
    expect(e.canal).toBe('emg');
    expect(e.tsMs).toBe(1000 + EPOCA);
    expect(e.amostras).toBeInstanceOf(Float64Array);
    expect(e.amostras.length).toBe(5);
    const esperado = [1, 10001, 1, 1, 1.3178942683663413];
    esperado.forEach((v, i) => expect(e.amostras[i]).toBeCloseTo(v, 9));
  });

  it('com incluirPrimeiraAmostra=false, só as n amostras seguintes à base', () => {
    const e = evento(decodificar(deHex(GOLDEN_BRUTO_EMG), { incluirPrimeiraAmostra: false }), 'bruto');
    expect(e.amostras.length).toBe(4);
    [10001, 1, 1, 1.3178942683663413].forEach((v, i) => expect(e.amostras[i]).toBeCloseTo(v, 9));
  });

  it('incluirPrimeiraAmostra explícito true equivale ao padrão', () => {
    const f = deHex(GOLDEN_BRUTO_EMG);
    expect(Array.from(evento(decodificar(f, { incluirPrimeiraAmostra: true }), 'bruto').amostras)).toEqual(
      Array.from(evento(decodificar(f), 'bruto').amostras),
    );
    expect(Array.from(evento(decodificar(f, {}), 'bruto').amostras)).toHaveLength(5);
  });

  it('EEG bruto de referência (divisor 12.5786), na variante sem byte extra', () => {
    const f = deHex(GOLDEN_BRUTO_EEG_SEM_CHK);
    expect(f[1]).toBe(0x13);
    const e = evento(decodificar(f), 'bruto');
    expect(e.canal).toBe('eeg');
    expect(e.tsMs).toBe(1000 + EPOCA);
    expect(e.amostras.length).toBe(4);
    [1, 1001.03180004134, 1, 1.0795001033501344].forEach((v, i) => expect(e.amostras[i]).toBeCloseTo(v, 9));
  });

  it('um delta de +1 vale 1/3.1457 no EMG e 1/12.5786 no EEG', () => {
    const emg = evento(decodificar(quadroBruto('emg', 0, 0, [1])), 'bruto');
    const eeg = evento(decodificar(quadroBruto('eeg', 0, 0, [1])), 'bruto');
    expect(emg.amostras[1]).toBeCloseTo(0.3178942683663413, 12);
    expect(eeg.amostras[1]).toBeCloseTo(0.07950010335013435, 12);
  });

  it('deltas negativos subtraem (complemento de dois, little-endian)', () => {
    const f = quadro(0x11, [3, ...be48(0), ...f32le(100), 0xff, 0xff, 0x00, 0x80]);
    const e = evento(decodificar(f), 'bruto');
    expect(e.amostras[1]).toBeCloseTo(100 - 1 / 3.1457, 9);
    expect(e.amostras[2]).toBeCloseTo(100 - 1 / 3.1457 - 32768 / 3.1457, 6);
  });

  it('sem deltas (LEN 14): só a base, ou nada sem a primeira amostra', () => {
    const f = quadroBruto('emg', 7, 2.5, []);
    expect(f[1]).toBe(14);
    expect(Array.from(evento(decodificar(f), 'bruto').amostras)).toEqual([2.5]);
    expect(evento(decodificar(f, { incluirPrimeiraAmostra: false }), 'bruto').amostras.length).toBe(0);
  });

  it('um delta: LEN 16 com byte extra, LEN 15 sem', () => {
    const comChk = quadroBruto('emg', 0, 0, [31457]);
    const semChk = quadroBruto('emg', 0, 0, [31457], { semChecksum: true });
    expect(comChk[1]).toBe(16);
    expect(semChk[1]).toBe(15);
    expect(evento(decodificar(comChk), 'bruto').amostras[1]).toBeCloseTo(10000, 9);
    expect(evento(decodificar(semChk), 'bruto').amostras[1]).toBeCloseTo(10000, 9);
  });

  it('o byte antes do 5A não vira amostra quando o quadro tem o byte extra', () => {
    const base = quadroBruto('emg', 0, 0, [1, 2, 3], { chk: 0x00 });
    const outro = quadroBruto('emg', 0, 0, [1, 2, 3], { chk: 0xff });
    const a = evento(decodificar(base), 'bruto').amostras;
    const b = evento(decodificar(outro), 'bruto').amostras;
    expect(a.length).toBe(4);
    expect(Array.from(b)).toEqual(Array.from(a));
  });

  it('o número de amostras segue (LEN-13)/2 com divisão inteira', () => {
    const rnd = mulberry32(1);
    for (let n = 0; n <= 120; n++) {
      const deltas = Array.from({ length: n }, () => inteiro(rnd, -100, 100));
      const comChk = quadroBruto('emg', 0, 0, deltas);
      const semChk = quadroBruto('emg', 0, 0, deltas, { semChecksum: true });
      expect(Math.floor((comChk[1] - 13) / 2)).toBe(n);
      expect(Math.floor((semChk[1] - 13) / 2)).toBe(n);
      expect(evento(decodificar(comChk), 'bruto').amostras.length).toBe(n + 1);
      expect(evento(decodificar(semChk), 'bruto').amostras.length).toBe(n + 1);
    }
  });

  it('ida e volta com deltas aleatórios de semente fixa (soma inteira exata como referência)', () => {
    const rnd = mulberry32(20240607);
    for (let it = 0; it < 400; it++) {
      const canal = it % 2 === 0 ? 'emg' : 'eeg';
      const divisor = canal === 'emg' ? 3.1457 : 12.5786;
      const semChecksum = it % 3 === 0;
      const maxN = semChecksum ? 121 : 120;
      const n = inteiro(rnd, 0, maxN);
      const deltas = Array.from({ length: n }, () => inteiro(rnd, -32768, 32767));
      const base = Math.fround((rnd() - 0.5) * 10000);
      const ts = inteiro(rnd, 0, 2 ** 48 - 1);
      const f = quadroBruto(canal, ts, base, deltas, { semChecksum, chk: inteiro(rnd, 0, 255) });
      expect(f.length).toBeLessThanOrEqual(258);

      const e = evento(decodificar(f), 'bruto');
      expect(e.canal).toBe(canal);
      expect(e.tsMs).toBe(ts + EPOCA);
      expect(e.amostras.length).toBe(n + 1);
      proximoPerto(e.amostras[0], base);
      let soma = 0;
      deltas.forEach((d, i) => {
        soma += d;
        proximoPerto(e.amostras[i + 1], base + soma / divisor);
      });

      const sem = evento(decodificar(f, { incluirPrimeiraAmostra: false }), 'bruto');
      expect(sem.amostras.length).toBe(n);
      expect(Array.from(sem.amostras)).toEqual(Array.from(e.amostras.subarray(1)));
    }
  });

  it('ida e volta passando pelo acumulador com fragmentação aleatória', () => {
    const rnd = mulberry32(808);
    const quadros: Uint8Array[] = [];
    const esperados: { n: number; base: number }[] = [];
    for (let i = 0; i < 80; i++) {
      const n = inteiro(rnd, 0, 100);
      const base = Math.fround(rnd() * 50);
      quadros.push(quadroBruto('emg', i, base, Array.from({ length: n }, () => inteiro(rnd, -500, 500))));
      esperados.push({ n, base });
    }
    const tudo = concatenar(quadros);
    const ac = new AcumuladorDeQuadros();
    const eventos: EventoModulo[] = [];
    let pos = 0;
    while (pos < tudo.length) {
      const tam = inteiro(rnd, 1, 64);
      for (const q of ac.push(tudo.subarray(pos, pos + tam))) eventos.push(interpretarQuadro(q));
      pos += tam;
    }
    expect(eventos).toHaveLength(80);
    eventos.forEach((ev, i) => {
      const e = evento(ev, 'bruto');
      expect(e.tsMs).toBe(i + EPOCA);
      expect(e.amostras.length).toBe(esperados[i].n + 1);
      expect(e.amostras[0]).toBe(esperados[i].base);
    });
  });

  it('base float32 negativa e valores especiais finitos', () => {
    expect(evento(decodificar(quadroBruto('emg', 0, -123.5, [])), 'bruto').amostras[0]).toBe(-123.5);
    expect(evento(decodificar(quadroBruto('emg', 0, 0, [])), 'bruto').amostras[0]).toBe(0);
    expect(evento(decodificar(quadroBruto('emg', 0, 3.4028234663852886e38, [])), 'bruto').amostras[0]).toBe(3.4028234663852886e38);
  });

  it('base NaN ou infinita invalida o quadro em vez de contaminar as amostras', () => {
    const modo = [3, ...be48(0)];
    expect(decodificar(quadro(0x11, [...modo, 0x00, 0x00, 0xc0, 0x7f, 1, 0])).tipo).toBe('invalido');
    expect(decodificar(quadro(0x11, [...modo, 0x00, 0x00, 0x80, 0x7f, 1, 0])).tipo).toBe('invalido');
    expect(decodificar(quadro(0x11, [...modo, 0x00, 0x00, 0x80, 0xff, 1, 0])).tipo).toBe('invalido');
  });

  it('bruto curto demais para a base é inválido', () => {
    expect(decodificar(quadro(0x11, [3])).tipo).toBe('invalido');
    expect(decodificar(quadro(0x11, [3, ...be48(0)])).tipo).toBe('invalido');
    expect(decodificar(quadro(0x11, [3, ...be48(0), 0x00, 0x00])).tipo).toBe('invalido');
    expect(decodificar(quadro(0x11, [4, ...be48(0), 0x00, 0x00, 0x80], { semChecksum: true })).tipo).toBe('invalido');
  });

  it('bytes sobrando depois do 5A (Quadro com buffer maior que LEN+3) não viram amostras', () => {
    const f = deHex(GOLDEN_BRUTO_EMG);
    const maior = concatenar([f, Uint8Array.of(1, 2, 3, 4, 5, 6)]);
    const e = interpretarQuadro({ bytes: maior, len: f[1], endereco: f[2] });
    expect(evento(e, 'bruto').amostras.length).toBe(5);
  });

  it('quadro lido de uma janela do buffer (byteOffset diferente de zero)', () => {
    const f = deHex(GOLDEN_BRUTO_EMG);
    const grande = new Uint8Array(f.length + 20).fill(0xee);
    grande.set(f, 9);
    const e = interpretarQuadro({ bytes: grande.subarray(9, 9 + f.length), len: f[1], endereco: f[2] });
    expect(evento(e, 'bruto').amostras.length).toBe(5);
    expect(evento(e, 'bruto').tsMs).toBe(1000 + EPOCA);
  });
});

describe('EMG protocolo: interpretarQuadro nunca lança', () => {
  const amostras: Uint8Array[] = [
    deHex(GOLDEN_BRUTO_EMG),
    deHex(GOLDEN_BRUTO_EEG_SEM_CHK),
    deHex(GOLDEN_RMS),
    deHex(GOLDEN_HISTORICO),
    quadroBateria(50),
    quadro(0x06, [1]),
    quadro(0x01, ascii('V1')),
    quadro(0x1d, [2]),
    quadro(0x17, [125]),
    quadro(0x0f, [0]),
  ];

  it('quadro truncado em qualquer ponto é inválido', () => {
    for (const f of amostras) {
      for (let tam = 0; tam < f.length; tam++) {
        const truncado = f.subarray(0, tam);
        const e = interpretarQuadro({ bytes: truncado, len: f[1], endereco: f[2] });
        expect(e.tipo, `${hex(f)} cortado em ${tam}`).toBe('invalido');
      }
    }
  });

  it('o quadro inteiro, esse sim, é interpretado', () => {
    for (const f of amostras) {
      expect(decodificar(f).tipo).not.toBe('invalido');
    }
  });

  it('bytes vazios, curtos, A5 ausente e campos inconsistentes são inválidos', () => {
    expect(interpretarQuadro({ bytes: new Uint8Array(0), len: 0, endereco: 0 }).tipo).toBe('invalido');
    expect(interpretarQuadro({ bytes: Uint8Array.of(0xa5, 0x03, 0x06), len: 3, endereco: 6 }).tipo).toBe('invalido');
    const f = quadro(0x06, [1]);
    expect(interpretarQuadro({ bytes: Uint8Array.from(f).fill(0x00, 0, 1), len: f[1], endereco: f[2] }).tipo).toBe('invalido');
    expect(interpretarQuadro({ bytes: f, len: f[1] + 1, endereco: f[2] }).tipo).toBe('invalido');
    expect(interpretarQuadro({ bytes: f, len: f[1], endereco: 0x0b }).tipo).toBe('invalido');
  });

  it('entradas absurdas viram inválido', () => {
    expect(interpretarQuadro(null as unknown as Quadro).tipo).toBe('invalido');
    expect(interpretarQuadro(undefined as unknown as Quadro).tipo).toBe('invalido');
    expect(interpretarQuadro({} as unknown as Quadro).tipo).toBe('invalido');
    expect(interpretarQuadro({ bytes: 'abc', len: 3, endereco: 1 } as unknown as Quadro).tipo).toBe('invalido');
    expect(interpretarQuadro(comoQuadro(deHex(GOLDEN_RMS)), null as unknown as undefined).tipo).toBe('rms');
  });

  it('o invalido sempre explica o motivo', () => {
    const e = evento(decodificar(quadro(0x06, [9])), 'invalido');
    expect(e.motivo.length).toBeGreaterThan(0);
  });

  it('quadros aleatórios bem formados por fora, de conteúdo qualquer (semente fixa)', () => {
    const rnd = mulberry32(555);
    const enderecos = [0x01, 0x02, 0x06, 0x07, 0x0b, 0x11, 0x17, 0x1d, 0x0f, 0x13];
    for (let it = 0; it < 6000; it++) {
      const len = inteiro(rnd, 0, 255);
      const addr = rnd() < 0.8 ? enderecos[inteiro(rnd, 0, enderecos.length - 1)] : inteiro(rnd, 0, 255);
      const total = len + 3;
      const bytes = new Uint8Array(total);
      for (let i = 0; i < total; i++) bytes[i] = inteiro(rnd, 0, 255);
      bytes[0] = 0xa5;
      bytes[1] = len;
      bytes[2] = addr;
      if (total > 3) bytes[3] = len ^ addr;
      bytes[total - 1] = 0x5a;
      if (addr === 0x11 && total > 4 && rnd() < 0.7) bytes[4] = inteiro(rnd, 0, 4);

      const e = interpretarQuadro({ bytes, len, endereco: addr });
      switch (e.tipo) {
        case 'bruto':
          expect(e.amostras.length).toBeLessThanOrEqual(Math.floor((len - 13) / 2) + 1);
          expect(Array.from(e.amostras).every((v) => Number.isFinite(v))).toBe(true);
          break;
        case 'rms':
          expect(e.valores.length).toBeLessThanOrEqual(Math.floor((len - 9) / 2));
          expect(e.valores.every((v) => Number.isInteger(v) && v >= 0 && v <= 65535)).toBe(true);
          break;
        case 'historico_rms':
          expect(e.valores.length).toBeLessThanOrEqual(Math.floor((len - 8) / 2));
          break;
        case 'bateria':
          expect(e.pct).toBeGreaterThanOrEqual(0);
          expect(e.pct).toBeLessThanOrEqual(100);
          break;
        case 'taxa':
          expect([500, 1000]).toContain(e.hz);
          break;
        default:
          break;
      }
    }
  });
});

describe('EMG protocolo: do byte ao evento', () => {
  it('sequência de conexão: bateria, taxa, versões e hardware, com fluxo bruto no meio', () => {
    const fluxo = concatenar([
      quadroBateria(64),
      quadro(0x06, [0]),
      quadro(0x0f, [0]),
      quadroBruto('emg', 100, 0, [31457, 31457]),
      quadro(0x01, ascii('EMG-HW')),
      quadro(0x02, ascii('1.0.9')),
      quadro(0x1d, [2]),
      quadro(0x17, [126]),
    ]);
    const ac = new AcumuladorDeQuadros();
    const tipos: EventoModulo[] = [];
    for (let i = 0; i < fluxo.length; i += 5) {
      for (const q of ac.push(fluxo.subarray(i, i + 5))) tipos.push(interpretarQuadro(q));
    }
    expect(tipos.map((e) => e.tipo)).toEqual(['bateria', 'taxa', 'ack', 'bruto', 'versao_hw', 'versao_sw', 'hardware', 'chip']);
    expect(tipos[0]).toEqual({ tipo: 'bateria', pct: 64 });
    expect(tipos[1]).toEqual({ tipo: 'taxa', hz: 500 });
    expect(tipos[2]).toEqual({ tipo: 'ack', endereco: 0x0f });
    const bruto = evento(tipos[3], 'bruto');
    expect(bruto.amostras[2]).toBeCloseTo(20000, 6);
    expect(tipos[4]).toEqual({ tipo: 'versao_hw', texto: 'EMG-HW' });
    expect(tipos[5]).toEqual({ tipo: 'versao_sw', texto: '1.0.9' });
    expect(tipos[6]).toEqual({ tipo: 'hardware', modelo: 'EMG-Pro' });
    expect(tipos[7]).toEqual({ tipo: 'chip', codigo: 126 });
  });
});
