import { afterEach, describe, expect, it } from 'vitest';
import {
  JANELA_RMS_VIVO_MS,
  dataLocalISO,
  decimarMinMax,
  degrauRedondo,
  desenharSinal,
  envelopeParaGrafico,
  lerCoresDoTema,
  maiorAbsoluto,
  nomeParaArquivo,
  numeroPt,
  pctPt,
  proximaEscala,
  rmsRecente,
  uvPt,
} from '../components/emg/desenho';
import { montarTextoDiagnostico, type DadosDoDiagnostico } from '../components/emg/diagnostico';
import { BufferCircular } from '../lib/emg/bufferCircular';

// Valores esperados feitos à mão (aritmética de posições e potências de 10), nunca com a fórmula do código.

describe('decimarMinMax', () => {
  it('10 amostras em 5 colunas: duas por coluna, mínimo e máximo de cada par', () => {
    const { min, max } = decimarMinMax([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 10, 5);
    expect(Array.from(min)).toEqual([0, 2, 4, 6, 8]);
    expect(Array.from(max)).toEqual([1, 3, 5, 7, 9]);
  });

  it('um pico no meio de uma coluna aparece no máximo e no mínimo, mesmo com muitas amostras por pixel', () => {
    const x = new Float64Array(1000).fill(0);
    x[503] = 80;
    x[507] = -60;
    const { min, max } = decimarMinMax(x, 1000, 10);
    // Amostras 500 a 599 ficam na coluna 5.
    expect(max[5]).toBe(80);
    expect(min[5]).toBe(-60);
    expect(Array.from(max).filter((v) => v !== 0)).toEqual([80]);
  });

  it('sinal mais curto que a janela fica encostado na direita, como num osciloscópio', () => {
    const { min, max } = decimarMinMax([1, 2, 3], 10, 10);
    for (let c = 0; c < 7; c++) {
      expect(Number.isNaN(min[c]), `coluna ${c}`).toBe(true);
      expect(Number.isNaN(max[c])).toBe(true);
    }
    expect([min[7], min[8], min[9]]).toEqual([1, 2, 3]);
    expect([max[7], max[8], max[9]]).toEqual([1, 2, 3]);
  });

  it('sinal mais longo que a janela usa só o final', () => {
    const x = Array.from({ length: 20 }, (_, i) => i);
    const { min } = decimarMinMax(x, 10, 10);
    expect(Array.from(min)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  });

  it('amostra não finita é ignorada e a coluna sem amostra fica vazia (NaN)', () => {
    const { min, max } = decimarMinMax([1, Number.NaN, 3], 3, 3);
    expect(min[0]).toBe(1);
    expect(Number.isNaN(min[1])).toBe(true);
    expect(Number.isNaN(max[1])).toBe(true);
    expect(max[2]).toBe(3);
    const infinito = decimarMinMax([Number.POSITIVE_INFINITY, 2], 2, 2);
    expect(Number.isNaN(infinito.min[0])).toBe(true);
    expect(infinito.min[1]).toBe(2);
  });

  it('bordas: zero colunas, sem amostras e janela inválida devolvem vazio, sem lançar', () => {
    expect(decimarMinMax([1, 2, 3], 3, 0).min).toHaveLength(0);
    expect(decimarMinMax([1, 2, 3], 3, -4).max).toHaveLength(0);
    expect(Array.from(decimarMinMax([], 10, 3).min).every(Number.isNaN)).toBe(true);
    expect(Array.from(decimarMinMax([1, 2], 0, 3).min).every(Number.isNaN)).toBe(true);
    expect(Array.from(decimarMinMax([1, 2], Number.NaN, 3).max).every(Number.isNaN)).toBe(true);
    // Colunas fracionárias valem o inteiro abaixo.
    expect(decimarMinMax([1, 2], 2, 2.9).min).toHaveLength(2);
  });
});

describe('maiorAbsoluto, degrauRedondo e proximaEscala', () => {
  it('maiorAbsoluto: maior módulo entre os finitos; vazio e só lixo dão 0', () => {
    expect(maiorAbsoluto([-3, 2, Number.NaN, 1])).toBe(3);
    expect(maiorAbsoluto([])).toBe(0);
    expect(maiorAbsoluto([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])).toBe(0);
    expect(maiorAbsoluto([0.5, -0.75])).toBe(0.75);
  });

  it('degrauRedondo: o menor 1, 2, 5 ou 10 vezes uma potência de 10 que cabe o valor', () => {
    const casos: Array<[number, number]> = [
      [1, 1],
      [1.1, 2],
      [2, 2],
      [2.1, 5],
      [5, 5],
      [5.1, 10],
      [11, 20],
      [99, 100],
      [100, 100],
      [101, 200],
      [0.3, 0.5],
      [0.05, 0.05],
      [7, 10],
      [1234, 2000],
    ];
    for (const [entrada, esperado] of casos) expect(degrauRedondo(entrada), `degrau de ${entrada}`).toBeCloseTo(esperado, 12);
  });

  it('degrauRedondo: entrada inválida (zero, negativa, NaN, infinita) vale 1', () => {
    for (const v of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) expect(degrauRedondo(v)).toBe(1);
  });

  it('proximaEscala: sobe na hora, desce só com folga grande e nunca passa do mínimo de 10 µV', () => {
    expect(proximaEscala(null, 0)).toBe(10);
    expect(proximaEscala(null, 3)).toBe(10);
    // Pico de 50 µV x 1,1 = 55: sobe para 100 sem esperar.
    expect(proximaEscala(10, 50)).toBe(100);
    // Sinal caiu para 20 µV (alvo 50): 50 não é menor que 45 (45 % de 100), então a escala fica.
    expect(proximaEscala(100, 20)).toBe(100);
    // Caiu para 10 µV (alvo 20 < 45): desce.
    expect(proximaEscala(100, 10)).toBe(20);
    expect(proximaEscala(100, 0)).toBe(10);
    // 19 µV x 1,1 = 20,9: já não cabe em 20, sobe para 50. Com 18 µV (19,8) ainda cabe e a escala fica.
    expect(proximaEscala(20, 19)).toBe(50);
    expect(proximaEscala(20, 18)).toBe(20);
  });
});

describe('rmsRecente', () => {
  it('RMS dos últimos 250 ms: valor constante dá o próprio valor, a 1000 Hz e a 500 Hz', () => {
    expect(JANELA_RMS_VIVO_MS).toBe(250);
    const b = new BufferCircular(2000);
    b.empurrar(new Float64Array(2000).fill(4));
    expect(rmsRecente(b, 1000)).toBeCloseTo(4, 12);
    expect(rmsRecente(b, 500)).toBeCloseTo(4, 12);
  });

  it('só olha o final: sinal antigo diferente não entra, e a janela é de 250 amostras a 1000 Hz', () => {
    const b = new BufferCircular(2000);
    b.empurrar(new Float64Array(1000).fill(100)); // antigo
    b.empurrar(Float64Array.from({ length: 250 }, (_, i) => (i % 2 === 0 ? 3 : -3))); // últimos 250 ms
    expect(rmsRecente(b, 1000)).toBeCloseTo(3, 12);
    // A 500 Hz a janela é de 125 amostras: ainda dentro do trecho de ±3.
    expect(rmsRecente(b, 500)).toBeCloseTo(3, 12);
  });

  it('sem uma janela inteira de amostras ainda não há valor', () => {
    const b = new BufferCircular(2000);
    b.empurrar(new Float64Array(249).fill(1));
    expect(rmsRecente(b, 1000)).toBeNull();
    b.empurrar([1]);
    expect(rmsRecente(b, 1000)).toBeCloseTo(1, 12);
  });

  it('janela customizada: 100 ms a 1000 Hz são 100 amostras', () => {
    const b = new BufferCircular(500);
    b.empurrar(new Float64Array(400).fill(0));
    b.empurrar(new Float64Array(100).fill(6));
    expect(rmsRecente(b, 1000, 100)).toBeCloseTo(6, 12);
    expect(rmsRecente(b, 1000, 200)).toBeCloseTo(Math.sqrt((100 * 36) / 200), 12);
  });
});

describe('envelopeParaGrafico', () => {
  it('limita o número de pontos: 1000 amostras em grupos de 3 dão 334 pontos (teto de 400)', () => {
    const e = envelopeParaGrafico(new Float64Array(1000).fill(10), 1000);
    expect(e.uv).toHaveLength(334);
    expect(e.tempoS).toHaveLength(334);
    expect(e.duracaoS).toBe(1);
    expect(e.tempoS[0]).toBeCloseTo(1.5 / 1000, 12);
    for (let i = 1; i < e.tempoS.length; i++) expect(e.tempoS[i]).toBeGreaterThan(e.tempoS[i - 1]);
  });

  it('sinal curto não é reduzido: um ponto por amostra', () => {
    const e = envelopeParaGrafico(new Float64Array(100).fill(1), 1000, 100, 400);
    expect(e.uv).toHaveLength(100);
  });

  it('guarda o maior valor de cada grupo: um pico de 100 µV RMS não some na redução', () => {
    // 1,5 s de silêncio, 0,3 s de onda quadrada de ±100 µV (RMS 100 µV) e silêncio de novo.
    const x = new Float64Array(3000).fill(0);
    for (let i = 1500; i < 1800; i++) x[i] = i % 2 === 0 ? 100 : -100;
    const e = envelopeParaGrafico(x, 1000, 100, 50);
    expect(e.uv.length).toBeLessThanOrEqual(50);
    const maior = Math.max(...e.uv);
    expect(maior).toBeGreaterThan(95);
    expect(maior).toBeLessThan(105);
    expect(e.uv[0]).toBeLessThan(1);
  });

  it('entrada vazia ou taxa inválida: sem pontos e sem lançar', () => {
    expect(envelopeParaGrafico([], 1000)).toEqual({ tempoS: [], uv: [], duracaoS: 0 });
    expect(envelopeParaGrafico([1, 2, 3], 0)).toEqual({ tempoS: [], uv: [], duracaoS: 0 });
    expect(envelopeParaGrafico([1, 2, 3], Number.NaN)).toEqual({ tempoS: [], uv: [], duracaoS: 0 });
  });
});

describe('formatação em português', () => {
  it('numeroPt usa vírgula decimal e traço para valor inválido', () => {
    expect(numeroPt(3.14159, 2)).toBe('3,14');
    expect(numeroPt(5, 0)).toBe('5');
    expect(numeroPt(-0.5, 1)).toBe('-0,5');
    expect(numeroPt(Number.NaN, 1)).toBe('—');
    expect(numeroPt(Number.POSITIVE_INFINITY, 1)).toBe('—');
  });

  it('uvPt: 1 casa abaixo de 100 µV e nenhuma de 100 em diante (também para negativos); vazio vira traço', () => {
    expect(uvPt(5.04)).toBe('5,0');
    expect(uvPt(99.94)).toBe('99,9');
    expect(uvPt(150.4)).toBe('150');
    expect(uvPt(-120.7)).toBe('-121');
    expect(uvPt(-5.04)).toBe('-5,0');
    expect(uvPt(0)).toBe('0,0');
    expect(uvPt(null)).toBe('—');
    expect(uvPt(undefined)).toBe('—');
    expect(uvPt(Number.NaN)).toBe('—');
  });

  it('pctPt: inteiro, vazio vira traço', () => {
    expect(pctPt(52.4)).toBe('52');
    expect(pctPt(52.6)).toBe('53');
    expect(pctPt(0)).toBe('0');
    expect(pctPt(null)).toBe('—');
  });

  it('dataLocalISO usa o calendário local, com zeros à esquerda (montado com partes locais: vale em qualquer fuso)', () => {
    expect(dataLocalISO(new Date(2026, 0, 5, 23, 59, 59))).toBe('2026-01-05');
    expect(dataLocalISO(new Date(2026, 11, 31, 0, 0, 0))).toBe('2026-12-31');
    expect(dataLocalISO(new Date(2026, 8, 9, 12))).toBe('2026-09-09');
    expect(dataLocalISO(new Date(2028, 1, 29, 6))).toBe('2028-02-29');
  });

  it('nomeParaArquivo: minúsculo, sem acento, com hífens, no máximo 40 caracteres e sem hífen sobrando', () => {
    expect(nomeParaArquivo('Quadríceps D')).toBe('quadriceps-d');
    expect(nomeParaArquivo('Gastrocnêmio medial E')).toBe('gastrocnemio-medial-e');
    expect(nomeParaArquivo('  --Reto   femoral!! ')).toBe('reto-femoral');
    expect(nomeParaArquivo('canal 1')).toBe('canal-1');
    expect(nomeParaArquivo('')).toBe('');
    expect(nomeParaArquivo('😀 !!!')).toBe('');
    expect(nomeParaArquivo('a'.repeat(100))).toHaveLength(40);
    // O corte em 40 cai logo depois de um hífen: nada de hífen no fim.
    const cortado = nomeParaArquivo(`${'a'.repeat(39)} bbbb`);
    expect(cortado).toBe('a'.repeat(39));
  });
});

describe('cores do gráfico', () => {
  afterEach(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.style.removeProperty('--primary');
  });

  it('sem os tokens do tema usa as cores de reserva, uma para o claro e outra para o escuro', () => {
    expect(lerCoresDoTema().tracado).toBe('#1e3a5f');
    document.documentElement.classList.add('dark');
    expect(lerCoresDoTema().tracado).toBe('#f5b82e');
  });

  it('com o token "H S% L%" do tema, devolve hsl() com vírgulas (o canvas entende em qualquer navegador)', () => {
    document.documentElement.style.setProperty('--primary', '220 60% 20%');
    const cores = lerCoresDoTema();
    // jsdom pode não resolver variáveis CSS; quando resolve, o formato tem de ser este.
    expect(['hsl(220, 60%, 20%)', '#1e3a5f']).toContain(cores.tracado);
  });
});

// ---------------------------------------------------------------------------
// desenharSinal com um contexto de mentira que anota o que foi desenhado.
// ---------------------------------------------------------------------------

interface Chamada {
  tipo: 'moveTo' | 'lineTo' | 'stroke' | 'clearRect';
  x?: number;
  y?: number;
  estilo?: string;
}

function contextoDeMentira(): { ctx: CanvasRenderingContext2D; chamadas: Chamada[] } {
  const chamadas: Chamada[] = [];
  const estado = { strokeStyle: '', lineWidth: 1 };
  const ctx = {
    get strokeStyle() {
      return estado.strokeStyle;
    },
    set strokeStyle(v: string) {
      estado.strokeStyle = v;
    },
    get lineWidth() {
      return estado.lineWidth;
    },
    set lineWidth(v: number) {
      estado.lineWidth = v;
    },
    clearRect: () => chamadas.push({ tipo: 'clearRect' }),
    beginPath: () => undefined,
    moveTo: (x: number, y: number) => chamadas.push({ tipo: 'moveTo', x, y, estilo: estado.strokeStyle }),
    lineTo: (x: number, y: number) => chamadas.push({ tipo: 'lineTo', x, y, estilo: estado.strokeStyle }),
    stroke: () => chamadas.push({ tipo: 'stroke', estilo: estado.strokeStyle }),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, chamadas };
}

const CORES = { tracado: 'TRACADO', grade: 'GRADE', zero: 'ZERO' };

describe('desenharSinal', () => {
  it('desenha o traçado de 5 µV com escala de ±10 µV a meia altura: y = 50 - (5/10) x 48 = 26', () => {
    const { ctx, chamadas } = contextoDeMentira();
    desenharSinal(ctx, {
      largura: 100,
      altura: 100,
      amostras: new Float64Array(1000).fill(5),
      tamanhoJanela: 1000,
      janelaS: 5,
      escala: 10,
      cores: CORES,
    });
    const traco = chamadas.filter((c) => c.tipo === 'moveTo' && c.estilo === 'TRACADO');
    expect(traco).toHaveLength(100); // uma coluna por pixel
    expect(traco[0].x).toBe(0.5);
    expect(traco[99].x).toBe(99.5);
    // Linha reta: o segmento ganha 1 px de espessura (±0,5) em volta de y = 26.
    for (const c of traco) expect(c.y).toBeCloseTo(25.5, 12);
    const linhasDoTraco = chamadas.filter((c) => c.tipo === 'lineTo' && c.estilo === 'TRACADO');
    for (const c of linhasDoTraco) expect(c.y).toBeCloseTo(26.5, 12);
    // Grade: 4 divisões de 1 s (janela de 5 s), 2 linhas horizontais em ±50 % da escala e a linha do zero.
    expect(chamadas.filter((c) => c.tipo === 'moveTo' && c.estilo === 'GRADE')).toHaveLength(6);
    const zero = chamadas.filter((c) => c.tipo === 'moveTo' && c.estilo === 'ZERO');
    expect(zero).toHaveLength(1);
    expect(zero[0].y).toBe(50.5);
    expect(chamadas[0].tipo).toBe('clearRect');
  });

  it('valores acima da escala são cortados na borda do gráfico, sem passar dele', () => {
    const { ctx, chamadas } = contextoDeMentira();
    desenharSinal(ctx, {
      largura: 10,
      altura: 100,
      amostras: Float64Array.from([5000, -5000]),
      tamanhoJanela: 2,
      janelaS: 1,
      escala: 10,
      cores: CORES,
    });
    const ys = chamadas.filter((c) => c.estilo === 'TRACADO' && (c.tipo === 'moveTo' || c.tipo === 'lineTo')).map((c) => c.y as number);
    expect(ys.length).toBeGreaterThan(0);
    for (const y of ys) {
      expect(y).toBeGreaterThanOrEqual(-0.5);
      expect(y).toBeLessThanOrEqual(100.5);
    }
  });

  it('sem amostras só desenha a grade e o zero, e nenhum traço', () => {
    const { ctx, chamadas } = contextoDeMentira();
    desenharSinal(ctx, { largura: 50, altura: 40, amostras: [], tamanhoJanela: 100, janelaS: 5, escala: 10, cores: CORES });
    expect(chamadas.some((c) => c.estilo === 'TRACADO' && c.tipo === 'moveTo')).toBe(false);
    expect(chamadas.some((c) => c.estilo === 'ZERO')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Texto do botão "Copiar" de "Ver dados recebidos"
// ---------------------------------------------------------------------------

function dados(extra: Partial<DadosDoDiagnostico> = {}): DadosDoDiagnostico {
  return {
    geradoEm: new Date(2026, 10, 8, 21, 30, 5),
    modo: 'real',
    ambiente: 'Mozilla/5.0 (Linux; Android 14) Chrome/130',
    estado: 'Lendo o sinal',
    nomeDoModulo: 'RunE W2 1',
    erro: null,
    taxaHz: 1000,
    taxaAssumida: false,
    taxaMedidaHz: 998.46,
    ajustes: { redeHz: 60, incluirPrimeiraAmostra: true },
    bateriaPct: 64,
    hardware: null,
    versaoHw: 'HW 1.2',
    versaoSw: null,
    quadrosRecebidos: 120,
    quadrosInvalidos: 2,
    bytesDescartados: 7,
    lacunasSuspeitas: 1,
    lotes: 118,
    amostras: 5900,
    filtrado: { amostras: 2000, media: 0.0123, rms: 12.5, min: -40.1, max: 43.2 },
    bruto: { amostras: 2000, media: 512.25, rms: 512.3, min: 480, max: 540 },
    quadrosHex: ['A5 0B 11 1A 03 00 5A', 'A5 03 0B 08 5A'],
    linhasDoServico: ['taxa de amostragem: 1000 Hz', 'lacuna suspeita: o carimbo saltou 300 ms'],
    parametrosDaAnalise: { k: 5, pisoUv: 5 },
    ...extra,
  };
}

describe('montarTextoDiagnostico', () => {
  it('traz tudo o que o desenvolvedor precisa, linha a linha', () => {
    const linhas = montarTextoDiagnostico(dados()).split('\n');
    expect(linhas[0]).toBe('My Health ID: diagnóstico do módulo EMG');
    expect(linhas[1]).toBe('Gerado em: 2026-11-08 21:30:05 (horário local do aparelho)');
    expect(linhas).toContain('Modo: módulo real');
    expect(linhas).toContain('Aparelho: Mozilla/5.0 (Linux; Android 14) Chrome/130');
    expect(linhas).toContain('Estado: Lendo o sinal');
    expect(linhas).toContain('Módulo: RunE W2 1');
    expect(linhas).toContain('Taxa de amostragem: 1000 Hz (lida do módulo)');
    expect(linhas).toContain('Taxa medida (amostras por segundo de relógio): 998.5');
    expect(linhas).toContain('Bateria: 64 %');
    expect(linhas).toContain('Ajustes de teste: rede elétrica de 60 Hz · amostra-base do quadro bruto incluída (padrão)');
    expect(linhas).toContain('Tipo do módulo (0x1D): não informado');
    expect(linhas).toContain('Versão de hardware: HW 1.2');
    expect(linhas).toContain('Versão de software: não informada');
    expect(linhas).toContain('Quadros recebidos: 120 · inválidos: 2 · bytes descartados: 7 · lacunas suspeitas: 1');
    expect(linhas).toContain('Lotes de amostras: 118 · amostras: 5900');
    expect(linhas).toContain('Sinal filtrado (últimos 2 s): 2000 amostras, média 0.01, RMS 12.50, mínimo -40.10, máximo 43.20');
    expect(linhas).toContain('Parâmetros da análise: {"k":5,"pisoUv":5}');
    expect(linhas).toContain('Últimos 2 quadros (hexadecimal, do mais antigo ao mais novo):');
    expect(linhas).toContain(' 1. A5 0B 11 1A 03 00 5A');
    expect(linhas).toContain(' 2. A5 03 0B 08 5A');
    expect(linhas).toContain('- taxa de amostragem: 1000 Hz');
    expect(linhas).toContain('- lacuna suspeita: o carimbo saltou 300 ms');
    expect(linhas.some((l) => l.startsWith('Erro mostrado'))).toBe(false);
  });

  it('os ajustes de teste fora do padrão aparecem em destaque; sem ajustes (demonstração) a linha some', () => {
    const t = montarTextoDiagnostico(dados({ ajustes: { redeHz: 50, incluirPrimeiraAmostra: false } }));
    expect(t).toContain('Ajustes de teste: rede elétrica de 50 Hz · amostra-base do quadro bruto NÃO incluída');
    expect(montarTextoDiagnostico(dados({ ajustes: null }))).not.toContain('Ajustes de teste');
  });

  it('taxa assumida é marcada em maiúsculas, e a demonstração diz que o sinal é simulado', () => {
    const t = montarTextoDiagnostico(dados({ taxaAssumida: true, taxaHz: 500, modo: 'demonstracao' }));
    expect(t).toContain('Taxa de amostragem: 500 Hz (ASSUMIDA: o módulo não respondeu à leitura)');
    expect(t).toContain('Modo: demonstração (sinal simulado)');
  });

  it('sem nada conectado: valores ausentes viram texto claro e não aparece "undefined" nem "NaN"', () => {
    const t = montarTextoDiagnostico(
      dados({
        modo: null,
        nomeDoModulo: null,
        ajustes: null,
        taxaHz: null,
        taxaMedidaHz: null,
        bateriaPct: null,
        versaoHw: null,
        quadrosRecebidos: 0,
        quadrosInvalidos: 0,
        bytesDescartados: 0,
        lacunasSuspeitas: 0,
        lotes: 0,
        amostras: 0,
        filtrado: null,
        bruto: null,
        quadrosHex: [],
        linhasDoServico: [],
        erro: 'Nenhum módulo foi escolhido.',
      }),
    );
    expect(t).toContain('Modo: nenhum');
    expect(t).toContain('Módulo: não conectado');
    expect(t).toContain('Erro mostrado: Nenhum módulo foi escolhido.');
    expect(t).toContain('Taxa de amostragem: desconhecida');
    expect(t).toContain('Taxa medida (amostras por segundo de relógio): ainda sem dados suficientes');
    expect(t).toContain('Bateria: não informada');
    expect(t).toContain('Sinal filtrado (últimos 2 s): sem amostras');
    expect(t).toContain('Sinal bruto (últimos 2 s): sem amostras');
    expect(t).toContain('(nenhum quadro recebido)');
    expect(t).toContain('(sem linhas)');
    expect(t).not.toMatch(/undefined|NaN/);
  });

  it('valores não finitos nas estatísticas aparecem como texto, sem quebrar', () => {
    const t = montarTextoDiagnostico(
      dados({ filtrado: { amostras: 1, media: Number.NaN, rms: Number.POSITIVE_INFINITY, min: 0, max: 0 } }),
    );
    expect(t).toContain('média NaN, RMS Infinity');
  });
});
