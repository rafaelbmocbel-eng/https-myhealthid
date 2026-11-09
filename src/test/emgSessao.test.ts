import { describe, expect, it } from 'vitest';
import {
  DURACAO_MAX_ETAPA_S,
  DURACAO_MIN_CONTRACAO_MS,
  GravadorDeSessao,
  JANELA_CVM_MS,
  JANELA_ENVELOPE_DETECCAO_MS,
  JANELA_ENVELOPE_SALVO_MS,
  JUNTAR_CONTRACOES_MS,
  K_CONTRACAO,
  MAX_CONTRACOES_NO_LAUDO,
  PARAMETROS_ANALISE,
  PISO_CONTRACAO_UV,
  PROTOCOLO_SESSAO,
  REPOUSO_MIN_S,
  csvDoSinal,
  laudoTexto,
  paraGravar,
  resumirSessao,
  resumoCurto,
  rotuloDoCanal,
  type CanalEmg,
  type ContracaoResumo,
  type EtapaDeSinal,
  type ResumoSessao,
} from '../lib/emg/sessao';
import { detectarContracoes, envelopeRms, rmsEmJanelas } from '../lib/emg/metricas';

// ---------------------------------------------------------------------------
// Apoio: sinais sintéticos montados aqui, com amplitude conhecida. Os valores esperados saem da
// definição (senoide de pico A tem RMS A/√2; ruído de desvio σ tem RMS σ), não do código testado.
// ---------------------------------------------------------------------------

const FS = 500;
const CANAL: CanalEmg = { id: '1', musculo: 'Quadríceps', lado: 'D' };
const RAIZ2 = Math.SQRT2;

function mulberry32(semente: number): () => number {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ruido(n: number, sigma: number, semente: number): Float64Array {
  const rnd = mulberry32(semente);
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const u1 = 1 - rnd();
    const u2 = rnd();
    x[i] = sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
  return x;
}

// Soma uma senoide de 80 Hz (espectro de EMG; em 500 Hz cabem 8 ciclos exatos em 100 ms) de pico
// `picoUv` entre `iniS` e `fimS`. Altera e devolve o próprio vetor.
function comRajada(x: Float64Array, iniS: number, fimS: number, picoUv: number, fs = FS): Float64Array {
  const ini = Math.round(iniS * fs);
  const fim = Math.round(fimS * fs);
  for (let i = ini; i < fim; i++) x[i] += picoUv * Math.sin((2 * Math.PI * 80 * i) / fs);
  return x;
}

function etapa(tipo: EtapaDeSinal['tipo'], amostras: ArrayLike<number>): EtapaDeSinal {
  return { tipo, amostras };
}

// Sessão completa: CVM de 3 tentativas (picos 100, 140 e 120 µV: a maior é a do meio) e tarefa com
// 3 rajadas de 2 s, 2 s e 1 s, de pico 70, 140 e 35 µV (metade, igual e um quarto da maior CVM).
const CVM_ESPERADA_UV = 140 / RAIZ2;

function etapasPadrao(): EtapaDeSinal[] {
  const tarefa = ruido(20 * FS, 2, 15);
  comRajada(tarefa, 3, 5, 70);
  comRajada(tarefa, 8, 10, 140);
  comRajada(tarefa, 13, 14, 35);
  return [
    etapa('repouso', ruido(5 * FS, 2, 11)),
    etapa('cvm', comRajada(ruido(5 * FS, 2, 12), 1, 4, 100)),
    etapa('cvm', comRajada(ruido(5 * FS, 2, 13), 1, 4, 140)),
    etapa('cvm', comRajada(ruido(5 * FS, 2, 14), 1, 4, 120)),
    etapa('tarefa', tarefa),
  ];
}

function perto(valor: number | null, esperado: number, tolRelativa: number): void {
  expect(valor).not.toBeNull();
  expect(Math.abs((valor as number) - esperado) / esperado).toBeLessThan(tolRelativa);
}

// ---------------------------------------------------------------------------
// GravadorDeSessao
// ---------------------------------------------------------------------------

describe('GravadorDeSessao: estado e erros', () => {
  it('começa sem etapa, sem etapas e sem resumo', () => {
    const g = new GravadorDeSessao({ fsHz: FS, canal: CANAL });
    expect(g.etapaAtual).toBeNull();
    expect(g.duracaoEtapaS).toBe(0);
    expect(g.etapas).toEqual([]);
    expect(g.resumo()).toBeNull();
  });

  it.each([0, -500, NaN, Infinity])('fsHz inválido %s lança RangeError', (fs) => {
    expect(() => new GravadorDeSessao({ fsHz: fs, canal: CANAL })).toThrow(RangeError);
  });

  it('finalizar sem etapa lança erro claro, antes e depois de uma etapa', () => {
    const g = new GravadorDeSessao({ fsHz: FS, canal: CANAL });
    expect(() => g.finalizarEtapa()).toThrow(/Nenhuma etapa em andamento/);
    g.iniciarEtapa('repouso');
    g.finalizarEtapa();
    expect(() => g.finalizarEtapa()).toThrow(/Nenhuma etapa em andamento/);
  });

  it('iniciar uma etapa com outra em andamento lança erro e preserva a gravação', () => {
    const g = new GravadorDeSessao({ fsHz: FS, canal: CANAL });
    g.iniciarEtapa('repouso');
    g.receber([1, 2, 3]);
    expect(() => g.iniciarEtapa('cvm')).toThrow(/"repouso" ainda está em andamento/);
    expect(g.etapaAtual).toBe('repouso');
    g.receber([4]);
    const r = g.finalizarEtapa();
    expect(r.tipo).toBe('repouso');
    expect(Array.from(r.amostras)).toEqual([1, 2, 3, 4]);
  });

  it('tipo de etapa desconhecido lança erro', () => {
    const g = new GravadorDeSessao({ fsHz: FS, canal: CANAL });
    // @ts-expect-error -- testa chamador sem checagem de tipos (JS) com um tipo que não existe
    expect(() => g.iniciarEtapa('forca')).toThrow(/Tipo de etapa desconhecido/);
    expect(g.etapaAtual).toBeNull();
  });

  it('o canal informado é copiado: mexer no original não muda o gravador', () => {
    const canal: CanalEmg = { id: '2', musculo: 'Bíceps', lado: 'E' };
    const g = new GravadorDeSessao({ fsHz: FS, canal });
    canal.musculo = 'Outro';
    expect(g.canal.musculo).toBe('Bíceps');
  });
});

describe('GravadorDeSessao: gravação das etapas', () => {
  it('acompanha etapaAtual e duracaoEtapaS conforme recebe amostras', () => {
    const g = new GravadorDeSessao({ fsHz: FS, canal: CANAL });
    g.iniciarEtapa('tarefa');
    expect(g.etapaAtual).toBe('tarefa');
    expect(g.duracaoEtapaS).toBe(0);
    g.receber(new Float64Array(FS));
    expect(g.duracaoEtapaS).toBeCloseTo(1, 12);
    g.receber(new Float64Array(FS / 2));
    expect(g.duracaoEtapaS).toBeCloseTo(1.5, 12);
    const r = g.finalizarEtapa();
    expect(g.etapaAtual).toBeNull();
    expect(g.duracaoEtapaS).toBe(0);
    expect(r.duracaoS).toBeCloseTo(1.5, 12);
  });

  it('guarda as amostras na ordem exata, mesmo atravessando o crescimento do buffer interno', () => {
    const g = new GravadorDeSessao({ fsHz: FS, canal: CANAL });
    const total = 30000;
    g.iniciarEtapa('tarefa');
    // Blocos de 7 amostras (e um resto) para não alinhar com nenhuma potência de 2.
    for (let i = 0; i < total; i += 7) {
      const bloco: number[] = [];
      for (let j = i; j < Math.min(total, i + 7); j++) bloco.push(j);
      g.receber(bloco);
    }
    const r = g.finalizarEtapa();
    expect(r.amostras.length).toBe(total);
    let ok = true;
    for (let i = 0; i < total; i++) {
      if (r.amostras[i] !== i) {
        ok = false;
        break;
      }
    }
    expect(ok).toBe(true);
  });

  it('um bloco enorme de uma vez também entra inteiro', () => {
    const g = new GravadorDeSessao({ fsHz: FS, canal: CANAL });
    g.iniciarEtapa('cvm');
    g.receber(ruido(40000, 1, 3));
    expect(g.finalizarEtapa().amostras.length).toBe(40000);
  });

  it('aceita Float32Array, Int16Array e arrays comuns', () => {
    const g = new GravadorDeSessao({ fsHz: FS, canal: CANAL });
    g.iniciarEtapa('repouso');
    g.receber(Float32Array.of(0.5, 1.5));
    g.receber(Int16Array.of(-2, 3));
    g.receber([4.25]);
    expect(Array.from(g.finalizarEtapa().amostras)).toEqual([0.5, 1.5, -2, 3, 4.25]);
  });

  it('receber fora de etapa é ignorado (antes de iniciar e depois de finalizar)', () => {
    const g = new GravadorDeSessao({ fsHz: FS, canal: CANAL });
    g.receber([9, 9, 9]);
    expect(g.duracaoEtapaS).toBe(0);
    g.iniciarEtapa('repouso');
    g.receber([1, 2]);
    g.finalizarEtapa();
    g.receber([7, 7, 7, 7]);
    g.iniciarEtapa('cvm');
    g.receber([5]);
    const r = g.finalizarEtapa();
    expect(Array.from(r.amostras)).toEqual([5]);
    expect(Array.from(g.etapas[0].amostras)).toEqual([1, 2]);
  });

  it('o resultado de uma etapa não é afetado pelas gravações seguintes', () => {
    const g = new GravadorDeSessao({ fsHz: FS, canal: CANAL });
    g.iniciarEtapa('repouso');
    g.receber([1, 2, 3]);
    const primeira = g.finalizarEtapa();
    g.iniciarEtapa('cvm');
    g.receber([100, 200, 300, 400]);
    g.finalizarEtapa();
    expect(Array.from(primeira.amostras)).toEqual([1, 2, 3]);
  });

  it('calcula RMS e pico de 1 s da etapa (sinal alternado ±A tem RMS exatamente A)', () => {
    const g = new GravadorDeSessao({ fsHz: FS, canal: CANAL });
    const x = new Float64Array(2 * FS);
    for (let i = 0; i < x.length; i++) x[i] = i % 2 === 0 ? 10 : -10;
    g.iniciarEtapa('cvm');
    g.receber(x);
    const r = g.finalizarEtapa();
    expect(r.rmsUv).toBeCloseTo(10, 9);
    expect(r.picoRms1sUv).toBeCloseTo(10, 9);
  });

  it('etapa com menos de 1 s tem pico de 1 s igual a 0 (não vira referência de CVM)', () => {
    const g = new GravadorDeSessao({ fsHz: FS, canal: CANAL });
    g.iniciarEtapa('cvm');
    g.receber(new Float64Array(FS - 1).fill(50));
    const r = g.finalizarEtapa();
    expect(r.picoRms1sUv).toBe(0);
    expect(r.rmsUv).toBeCloseTo(50, 9);
  });

  it('numera as etapas do mesmo tipo (tentativas de CVM) a partir de 1', () => {
    const g = new GravadorDeSessao({ fsHz: FS, canal: CANAL });
    const tipos = ['repouso', 'cvm', 'cvm', 'tarefa', 'cvm'] as const;
    const numeros: number[] = [];
    for (const t of tipos) {
      g.iniciarEtapa(t);
      g.receber([1]);
      numeros.push(g.finalizarEtapa().numero);
    }
    expect(numeros).toEqual([1, 1, 2, 1, 3]);
    expect(g.etapas.map((e) => e.tipo)).toEqual([...tipos]);
  });

  it('cancelarEtapa abandona a etapa sem guardá-la e libera a próxima', () => {
    const g = new GravadorDeSessao({ fsHz: FS, canal: CANAL });
    g.iniciarEtapa('cvm');
    g.receber([1, 2, 3]);
    g.cancelarEtapa();
    expect(g.etapaAtual).toBeNull();
    expect(g.duracaoEtapaS).toBe(0);
    expect(g.etapas).toEqual([]);
    expect(() => g.finalizarEtapa()).toThrow(/Nenhuma etapa em andamento/);
    g.iniciarEtapa('cvm');
    g.receber([8]);
    expect(Array.from(g.finalizarEtapa().amostras)).toEqual([8]);
    expect(() => g.cancelarEtapa()).not.toThrow();
  });

  it('descartarUltimaEtapa devolve a última e a numeração se ajusta', () => {
    const g = new GravadorDeSessao({ fsHz: FS, canal: CANAL });
    expect(g.descartarUltimaEtapa()).toBeNull();
    g.iniciarEtapa('cvm');
    g.receber([1]);
    g.finalizarEtapa();
    g.iniciarEtapa('cvm');
    g.receber([2]);
    const segunda = g.finalizarEtapa();
    expect(g.descartarUltimaEtapa()).toBe(segunda);
    expect(g.etapas.length).toBe(1);
    g.iniciarEtapa('cvm');
    g.receber([3]);
    expect(g.finalizarEtapa().numero).toBe(2);
  });

  it('etapas devolve uma cópia da lista', () => {
    const g = new GravadorDeSessao({ fsHz: FS, canal: CANAL });
    g.iniciarEtapa('repouso');
    g.receber([1]);
    g.finalizarEtapa();
    const lista = g.etapas as unknown as unknown[];
    lista.length = 0;
    expect(g.etapas.length).toBe(1);
  });

  it('corta no teto de duração, marca a etapa e o resumo avisa', () => {
    const fs = 100;
    const g = new GravadorDeSessao({ fsHz: fs, canal: CANAL });
    g.iniciarEtapa('tarefa');
    const limite = DURACAO_MAX_ETAPA_S * fs;
    g.receber(new Float64Array(limite - 10).fill(1));
    expect(g.duracaoEtapaS).toBeCloseTo(DURACAO_MAX_ETAPA_S - 0.1, 9);
    g.receber(new Float64Array(500).fill(2));
    g.receber(new Float64Array(500).fill(3));
    const r = g.finalizarEtapa();
    expect(r.truncada).toBe(true);
    expect(r.amostras.length).toBe(limite);
    expect(r.amostras[limite - 11]).toBe(1);
    expect(r.amostras[limite - 1]).toBe(2);
    expect(g.resumo()?.avisos.join(' ')).toMatch(/foi cortada/);
  });

  it('etapa que termina exatamente no teto não é marcada como cortada', () => {
    const fs = 10;
    const g = new GravadorDeSessao({ fsHz: fs, canal: CANAL });
    g.iniciarEtapa('tarefa');
    g.receber(new Float64Array(DURACAO_MAX_ETAPA_S * fs));
    expect(g.finalizarEtapa().truncada).toBe(false);
  });

  it('marcarCortada marca só a etapa em andamento: sem etapa não faz nada e a marca não passa para a próxima', () => {
    const g = new GravadorDeSessao({ fsHz: FS, canal: CANAL });
    g.marcarCortada();
    g.iniciarEtapa('tarefa');
    expect(g.finalizarEtapa().truncada).toBe(false);
    g.iniciarEtapa('tarefa');
    g.receber([1, 2, 3]);
    g.marcarCortada();
    const cortada = g.finalizarEtapa();
    expect(cortada.truncada).toBe(true);
    expect(cortada.amostras.length).toBe(3);
    expect(g.resumo()?.avisos.join(' ')).toMatch(/atingiu o limite de 900 s e foi cortada/);
    g.iniciarEtapa('tarefa');
    expect(g.finalizarEtapa().truncada).toBe(false);
  });

  it('resumo() usa só etapas finalizadas e bate com resumirSessao', () => {
    const g = new GravadorDeSessao({ fsHz: FS, canal: CANAL });
    const etapas = etapasPadrao();
    // Entra em blocos de 25 amostras (50 ms), como chegariam do filtro.
    for (const e of etapas) {
      g.iniciarEtapa(e.tipo);
      for (let i = 0; i < e.amostras.length; i += 25) {
        g.receber(Array.from({ length: 25 }, (_, j) => e.amostras[i + j]));
      }
      g.finalizarEtapa();
    }
    g.iniciarEtapa('tarefa');
    g.receber(ruido(5 * FS, 2, 99));
    expect(g.resumo()).toEqual(resumirSessao(etapas, FS, CANAL));
  });
});

// ---------------------------------------------------------------------------
// resumirSessao: sessão completa
// ---------------------------------------------------------------------------

describe('resumirSessao: sessão completa', () => {
  const resumo = resumirSessao(etapasPadrao(), FS, CANAL);

  it('ruído basal e RMS do repouso refletem o ruído gravado (σ = 2 µV)', () => {
    perto(resumo.repousoRmsUv, 2, 0.05);
    perto(resumo.ruidoBasalRmsUv, 2, 0.1);
    expect(resumo.ruidoBasalRmsUv as number).toBeLessThanOrEqual(resumo.repousoRmsUv as number);
    expect(resumo.duracaoRepousoS).toBe(5);
    expect(resumo.duracaoTarefaS).toBe(20);
    expect(resumo.qualidade?.nivel).toBe('bom');
  });

  it('a CVM é o maior pico entre as tentativas (a do meio), não a média nem a última', () => {
    expect(resumo.tentativasCvm).toBe(3);
    perto(resumo.cvmUv, CVM_ESPERADA_UV, 0.02);
    perto(resumo.cvmPorTentativaUv[0], 100 / RAIZ2, 0.02);
    perto(resumo.cvmPorTentativaUv[1], 140 / RAIZ2, 0.02);
    perto(resumo.cvmPorTentativaUv[2], 120 / RAIZ2, 0.02);
    expect(resumo.cvmUv).toBe(Math.max(...resumo.cvmPorTentativaUv));
  });

  it('acha as 3 rajadas da tarefa, nos instantes e com a duração certos', () => {
    expect(resumo.contracoes.length).toBe(3);
    const esperadas = [
      { ini: 3, fim: 5 },
      { ini: 8, fim: 10 },
      { ini: 13, fim: 14 },
    ];
    // O envelope de 100 ms alarga a rajada em até meia janela de cada lado.
    const tol = JANELA_ENVELOPE_DETECCAO_MS / 1000;
    resumo.contracoes.forEach((c, i) => {
      expect(Math.abs(c.inicioS - esperadas[i].ini)).toBeLessThan(tol);
      expect(Math.abs(c.fimS - esperadas[i].fim)).toBeLessThan(tol);
      expect(c.duracaoS).toBeCloseTo(c.fimS - c.inicioS, 9);
    });
  });

  it('%CVM de cada contração é coerente: metade da amplitude da CVM dá ≈ 50 %', () => {
    const [a, b, c] = resumo.contracoes;
    // Pico de janela de 100 ms de senoide + ruído passa um pouco do valor teórico.
    expect(a.picoPctCvm).not.toBeNull();
    expect(Math.abs((a.picoPctCvm as number) - 50)).toBeLessThan(3);
    expect(Math.abs((b.picoPctCvm as number) - 100)).toBeLessThan(3);
    expect(Math.abs((c.picoPctCvm as number) - 25)).toBeLessThan(2);
    // O RMS médio inclui as rampas das bordas do envelope (50 ms de cada lado), então fica até
    // uns 6 % abaixo do teórico numa rajada de 1 s e uns 3 % numa de 2 s.
    expect(Math.abs((a.rmsMedioPctCvm as number) - 50)).toBeLessThan(3);
    expect(Math.abs((b.rmsMedioPctCvm as number) - 100)).toBeLessThan(5);
    expect(Math.abs((c.rmsMedioPctCvm as number) - 25)).toBeLessThan(2.5);
    for (const x of resumo.contracoes) {
      expect(x.rmsMedioUv).toBeLessThanOrEqual(x.picoUv);
      expect(x.picoUv / (resumo.cvmUv as number)).toBeCloseTo((x.picoPctCvm as number) / 100, 9);
    }
  });

  it('picoPctCvmMax é o maior pico em % da CVM, e a ordem das contrações é a do tempo', () => {
    expect(resumo.picoPctCvmMax).toBe(Math.max(...resumo.contracoes.map((x) => x.picoPctCvm as number)));
    expect(resumo.picoPctCvmMax as number).toBeGreaterThan(90);
    for (let i = 1; i < resumo.contracoes.length; i++) {
      expect(resumo.contracoes[i].inicioS).toBeGreaterThan(resumo.contracoes[i - 1].fimS);
    }
  });

  it('sessão boa só traz o aviso fixo de que a saturação não é verificada', () => {
    expect(resumo.avisos).toEqual([
      'A qualidade do sinal vale só para o repouso e foi medida depois do filtro. A saturação do sensor não é verificada na CVM nem na tarefa: se ele saturar na contração máxima, a CVM fica subestimada e o % da CVM, inflado.',
    ]);
  });

  it('linha de base: limiar = média + k·desvio e piso = média + piso absoluto', () => {
    const lb = resumo.linhaDeBase;
    expect(lb).not.toBeNull();
    if (lb === null) return;
    expect(lb.limiarUv).toBeCloseTo(lb.mediaUv + K_CONTRACAO * lb.desvioUv, 9);
    expect(lb.pisoPicoUv).toBeCloseTo(lb.mediaUv + PISO_CONTRACAO_UV, 9);
    perto(lb.mediaUv, 2, 0.05);
    for (const c of resumo.contracoes) expect(c.picoUv).toBeGreaterThanOrEqual(lb.pisoPicoUv);
  });

  it('guarda o canal no resumo, como cópia', () => {
    expect(resumo.canal).toEqual(CANAL);
    expect(resumo.canal).not.toBe(CANAL);
  });

  it('a ordem das etapas na lista não muda o resultado (só o tipo conta)', () => {
    const e = etapasPadrao();
    // Tarefa e repouso trocam de lugar com a CVM; as tentativas de CVM mantêm a ordem entre si
    // (cvmPorTentativaUv lista na ordem gravada).
    const embaralhada = [e[4], e[1], e[0], e[2], e[3]];
    expect(JSON.stringify(resumirSessao(embaralhada, FS, CANAL))).toBe(JSON.stringify(resumo));
  });

  it('funciona a 1000 Hz com as mesmas amplitudes', () => {
    const fs = 1000;
    const tarefa = ruido(12 * fs, 2, 21);
    comRajada(tarefa, 3, 5, 70, fs);
    comRajada(tarefa, 8, 10, 140, fs);
    const r = resumirSessao(
      [
        etapa('repouso', ruido(5 * fs, 2, 22)),
        etapa('cvm', comRajada(ruido(5 * fs, 2, 23), 1, 4, 140, fs)),
        etapa('tarefa', tarefa),
      ],
      fs,
      CANAL,
    );
    expect(r.contracoes.length).toBe(2);
    expect(Math.abs((r.contracoes[0].rmsMedioPctCvm as number) - 50)).toBeLessThan(4);
    expect(Math.abs((r.contracoes[1].rmsMedioPctCvm as number) - 100)).toBeLessThan(5);
  });
});

// ---------------------------------------------------------------------------
// resumirSessao: sem CVM, sem repouso, repouso curto etc.
// ---------------------------------------------------------------------------

describe('resumirSessao: CVM', () => {
  it('sem CVM: %CVM fica null, o pico máximo também, e há aviso', () => {
    const e = etapasPadrao().filter((x) => x.tipo !== 'cvm');
    const r = resumirSessao(e, FS, CANAL);
    expect(r.cvmUv).toBeNull();
    expect(r.tentativasCvm).toBe(0);
    expect(r.cvmPorTentativaUv).toEqual([]);
    expect(r.contracoes.length).toBe(3);
    for (const c of r.contracoes) {
      expect(c.picoPctCvm).toBeNull();
      expect(c.rmsMedioPctCvm).toBeNull();
      expect(c.picoUv).toBeGreaterThan(10);
    }
    expect(r.picoPctCvmMax).toBeNull();
    expect(r.avisos.some((a) => /Sem CVM gravada/.test(a))).toBe(true);
  });

  it('menos tentativas que o protocolo prevê avisa, com singular e plural', () => {
    const e = etapasPadrao();
    const duas = resumirSessao(
      e.filter((x, i) => x.tipo !== 'cvm' || i < 3),
      FS,
      CANAL,
    );
    expect(duas.tentativasCvm).toBe(2);
    expect(duas.avisos.join(' ')).toContain(`Só 2 tentativas de CVM (o protocolo prevê ${PROTOCOLO_SESSAO.cvmTentativas})`);
    const uma = resumirSessao(
      e.filter((x, i) => x.tipo !== 'cvm' || i === 1),
      FS,
      CANAL,
    );
    expect(uma.avisos.join(' ')).toContain('Só 1 tentativa de CVM');
  });

  it('tentativas com menos de 1 s não dão CVM: null e aviso', () => {
    const curta = ruido(FS - 1, 80, 31);
    const r = resumirSessao([etapa('repouso', ruido(5 * FS, 2, 32)), etapa('cvm', curta)], FS, CANAL);
    expect(r.cvmUv).toBeNull();
    expect(r.tentativasCvm).toBe(0);
    expect(r.cvmPorTentativaUv).toEqual([]);
    expect(r.avisos.join(' ')).toMatch(/menos de 1 s: não foi possível calcular a CVM/);
  });

  it('tentativa de CVM com menos de 1 s é ignorada com aviso: sem 0 na lista, e o "Só N" conta as válidas', () => {
    const e = etapasPadrao();
    // Tentativas de 0,8 s, 5 s e 5 s: só as duas de 5 s valem.
    const r = resumirSessao(
      [
        e[0],
        etapa('cvm', comRajada(ruido(Math.round(0.8 * FS), 2, 33), 0, 0.8, 100)),
        e[2],
        e[3],
      ],
      FS,
      CANAL,
    );
    expect(r.tentativasCvm).toBe(2);
    expect(r.cvmPorTentativaUv.length).toBe(2);
    expect(r.cvmPorTentativaUv.every((v) => v > 50)).toBe(true);
    perto(r.cvmUv, 140 / RAIZ2, 0.02);
    const avisos = r.avisos.join(' ');
    expect(avisos).toContain('1 tentativa de CVM com menos de 1 s foi ignorada.');
    expect(avisos).toContain(`Só 2 tentativas de CVM (o protocolo prevê ${PROTOCOLO_SESSAO.cvmTentativas})`);
    const laudo = laudoTexto(r, CANAL);
    expect(laudo).toMatch(/2 tentativas \([\d,]+ · [\d,]+ µV\)/);
    expect(laudo).not.toMatch(/\b0,0 µV/);

    // Com duas curtas o verbo vai para o plural; com 3 válidas mais uma curta não há "Só N".
    const duasCurtas = resumirSessao(
      [e[0], e[2], etapa('cvm', ruido(FS - 1, 2, 34)), etapa('cvm', ruido(10, 2, 35))],
      FS,
      CANAL,
    ).avisos.join(' ');
    expect(duasCurtas).toContain('2 tentativas de CVM com menos de 1 s foram ignoradas.');
    const tresMaisUma = resumirSessao([e[0], e[1], e[2], e[3], etapa('cvm', ruido(FS - 1, 2, 36))], FS, CANAL);
    expect(tresMaisUma.tentativasCvm).toBe(3);
    expect(tresMaisUma.avisos.join(' ')).toContain('1 tentativa de CVM com menos de 1 s foi ignorada.');
    expect(tresMaisUma.avisos.join(' ')).not.toMatch(/Só \d tentativas?/);
  });

  it('CVM colada no ruído de repouso avisa', () => {
    const r = resumirSessao(
      [
        etapa('repouso', ruido(5 * FS, 2, 41)),
        etapa('cvm', ruido(5 * FS, 2, 42)),
        etapa('cvm', ruido(5 * FS, 2, 43)),
        etapa('cvm', ruido(5 * FS, 2, 44)),
      ],
      FS,
      CANAL,
    );
    expect(r.avisos.join(' ')).toMatch(/muito perto do ruído de repouso/);
  });

  it('tentativa de CVM sem nenhuma amostra é ignorada', () => {
    const r = resumirSessao(
      [etapa('repouso', ruido(5 * FS, 2, 51)), etapa('cvm', []), etapa('cvm', comRajada(ruido(5 * FS, 2, 52), 1, 4, 100))],
      FS,
      CANAL,
    );
    expect(r.tentativasCvm).toBe(1);
    perto(r.cvmUv, 100 / RAIZ2, 0.03);
  });
});

describe('resumirSessao: limites do que é verificado (saturação)', () => {
  const AVISO_SATURACAO = /A qualidade do sinal vale só para o repouso e foi medida depois do filtro\. A saturação do sensor não é verificada na CVM nem na tarefa/;

  it('com CVM ou tarefa gravada, o aviso diz que a qualidade é só do repouso filtrado e que a saturação não é verificada', () => {
    const e = etapasPadrao();
    expect(resumirSessao(e, FS, CANAL).avisos.join(' ')).toMatch(AVISO_SATURACAO);
    expect(resumirSessao([e[0], e[1]], FS, CANAL).avisos.join(' ')).toMatch(AVISO_SATURACAO);
    expect(resumirSessao([e[0], e[4]], FS, CANAL).avisos.join(' ')).toMatch(AVISO_SATURACAO);
  });

  it('sem CVM nem tarefa não há o que dizer: o aviso não aparece (só repouso, ou nada)', () => {
    expect(resumirSessao([etapasPadrao()[0]], FS, CANAL).avisos.join(' ')).not.toMatch(/saturação/);
    expect(resumirSessao([], FS, CANAL).avisos.join(' ')).not.toMatch(/saturação/);
  });

  it('o aviso chega ao laudo, mesmo com repouso "boa", e explica o efeito na CVM', () => {
    const r = resumirSessao(etapasPadrao(), FS, CANAL);
    expect(r.qualidade?.nivel).toBe('bom');
    const t = laudoTexto(r, CANAL);
    expect(t).toContain('qualidade do sinal: boa');
    expect(t).toMatch(/Avisos do registro:\n- A qualidade do sinal vale só para o repouso/);
    expect(t).toContain('a CVM fica subestimada e o % da CVM, inflado');
  });
});

describe('resumirSessao: repouso', () => {
  it('sem repouso: não detecta contrações, não inventa ruído basal e avisa', () => {
    const r = resumirSessao(etapasPadrao().filter((x) => x.tipo !== 'repouso'), FS, CANAL);
    expect(r.contracoes).toEqual([]);
    expect(r.picoPctCvmMax).toBeNull();
    expect(r.ruidoBasalRmsUv).toBeNull();
    expect(r.repousoRmsUv).toBeNull();
    expect(r.qualidade).toBeNull();
    expect(r.linhaDeBase).toBeNull();
    expect(r.duracaoRepousoS).toBe(0);
    expect(r.avisos.join(' ')).toMatch(/Sem repouso gravado/);
    // A CVM não depende do repouso.
    perto(r.cvmUv, CVM_ESPERADA_UV, 0.02);
  });

  it('repouso com menos de 3 s: mede o ruído, mas não detecta contrações e orienta repetir', () => {
    const curto = ruido(Math.round(2.5 * FS), 2, 61);
    const e = etapasPadrao().map((x) => (x.tipo === 'repouso' ? etapa('repouso', curto) : x));
    const r = resumirSessao(e, FS, CANAL);
    expect(r.contracoes).toEqual([]);
    expect(r.linhaDeBase).toBeNull();
    expect(r.ruidoBasalRmsUv).not.toBeNull();
    expect(r.duracaoRepousoS).toBeCloseTo(2.5, 9);
    expect(r.avisos.join(' ')).toMatch(/Repouso de 2,5 s é curto demais \(mínimo de 3 s\)/);
  });

  it('repouso de exatamente 3 s já serve', () => {
    expect(REPOUSO_MIN_S).toBe(3);
    const e = etapasPadrao().map((x) => (x.tipo === 'repouso' ? etapa('repouso', ruido(3 * FS, 2, 71)) : x));
    const r = resumirSessao(e, FS, CANAL);
    expect(r.linhaDeBase).not.toBeNull();
    expect(r.contracoes.length).toBe(3);
  });

  it('um instante a menos que 3 s não serve', () => {
    const e = etapasPadrao().map((x) => (x.tipo === 'repouso' ? etapa('repouso', ruido(3 * FS - 1, 2, 72)) : x));
    expect(resumirSessao(e, FS, CANAL).linhaDeBase).toBeNull();
  });

  it('com mais de um repouso vale o último (refazer substitui) e avisa', () => {
    const e = etapasPadrao();
    const ruidoso = etapa('repouso', ruido(5 * FS, 30, 81));
    const r = resumirSessao([ruidoso, ...e], FS, CANAL);
    expect(r.avisos.join(' ')).toMatch(/Mais de um repouso gravado: foi usado o último/);
    perto(r.ruidoBasalRmsUv, 2, 0.1);
    expect(r.contracoes.length).toBe(3);
    // Invertendo, o repouso ruidoso passa a valer: limiar muito mais alto e qualidade ruim.
    const r2 = resumirSessao([...e, ruidoso], FS, CANAL);
    perto(r2.repousoRmsUv, 30, 0.05);
    expect(r2.qualidade?.nivel).toBe('ruim');
  });

  it('repouso com ruído alto: qualidade ruim aparece nos avisos', () => {
    const e = etapasPadrao().map((x) => (x.tipo === 'repouso' ? etapa('repouso', ruido(5 * FS, 25, 91)) : x));
    const r = resumirSessao(e, FS, CANAL);
    expect(r.qualidade?.nivel).toBe('ruim');
    expect(r.avisos.join(' ')).toMatch(/Qualidade do sinal no repouso: ruim \(.*ruído basal muito alto/);
  });

  it('repouso com linha plana (sensor solto): qualidade ruim e aviso, sem quebrar', () => {
    const e = etapasPadrao().map((x) => (x.tipo === 'repouso' ? etapa('repouso', new Float64Array(5 * FS)) : x));
    const r = resumirSessao(e, FS, CANAL);
    expect(r.qualidade?.linhaPlana).toBe(true);
    expect(r.avisos.join(' ')).toMatch(/linha plana/);
    for (const c of r.contracoes) expect(Number.isFinite(c.picoUv)).toBe(true);
  });

  it('repouso em que o músculo se mexeu avisa que não ficou estável', () => {
    const repouso = comRajada(ruido(5 * FS, 2, 101), 2, 3.5, 60);
    const e = etapasPadrao().map((x) => (x.tipo === 'repouso' ? etapa('repouso', repouso) : x));
    const r = resumirSessao(e, FS, CANAL);
    expect(r.avisos.join(' ')).toMatch(/O repouso não ficou estável/);
  });

  it('repouso limpo não dispara o aviso de instabilidade', () => {
    expect(resumirSessao(etapasPadrao(), FS, CANAL).avisos.join(' ')).not.toMatch(/não ficou estável/);
  });

  it('repouso sem nenhuma amostra conta como sem repouso', () => {
    const e = etapasPadrao().map((x) => (x.tipo === 'repouso' ? etapa('repouso', []) : x));
    const r = resumirSessao(e, FS, CANAL);
    expect(r.linhaDeBase).toBeNull();
    expect(r.avisos.join(' ')).toMatch(/Sem repouso gravado/);
  });
});

describe('resumirSessao: tarefa', () => {
  it('sem tarefa: sem contrações e sem aviso de "nenhuma contração"', () => {
    const r = resumirSessao(etapasPadrao().filter((x) => x.tipo !== 'tarefa'), FS, CANAL);
    expect(r.contracoes).toEqual([]);
    expect(r.duracaoTarefaS).toBe(0);
    expect(r.linhaDeBase).not.toBeNull();
    expect(r.avisos.join(' ')).not.toMatch(/Nenhuma contração detectada/);
  });

  it('tarefa só de ruído: nenhuma contração, com aviso', () => {
    const e = etapasPadrao().map((x) => (x.tipo === 'tarefa' ? etapa('tarefa', ruido(20 * FS, 2, 111)) : x));
    const r = resumirSessao(e, FS, CANAL);
    expect(r.contracoes).toEqual([]);
    expect(r.picoPctCvmMax).toBeNull();
    expect(r.avisos.join(' ')).toMatch(/Nenhuma contração detectada na tarefa/);
  });

  it('rajada curta (50 ms) é descartada, mesmo muito forte; rajada de 400 ms vale', () => {
    const curta = comRajada(ruido(10 * FS, 2, 121), 4, 4.05, 300);
    const longa = comRajada(ruido(10 * FS, 2, 122), 4, 4.4, 300);
    const base = etapasPadrao().filter((x) => x.tipo !== 'tarefa');
    expect(DURACAO_MIN_CONTRACAO_MS).toBe(300);
    expect(resumirSessao([...base, etapa('tarefa', curta)], FS, CANAL).contracoes).toEqual([]);
    const r = resumirSessao([...base, etapa('tarefa', longa)], FS, CANAL);
    expect(r.contracoes.length).toBe(1);
    expect(Math.abs(r.contracoes[0].inicioS - 4)).toBeLessThan(0.1);
  });

  it('um estalo de 1 amostra (artefato de cabo) não vira contração', () => {
    const t = ruido(10 * FS, 2, 131);
    t[2500] = 5000;
    const base = etapasPadrao().filter((x) => x.tipo !== 'tarefa');
    expect(resumirSessao([...base, etapa('tarefa', t)], FS, CANAL).contracoes).toEqual([]);
  });

  it('piso absoluto: rajada fraca que passa de k·desvio mas não de 5 µV acima do repouso é descartada', () => {
    // Repouso muito quieto (σ = 0,5 µV): o limiar de k·desvio fica ~0,6 µV acima da média.
    const quieto = etapa('repouso', ruido(5 * FS, 0.5, 141));
    const fraca = comRajada(ruido(10 * FS, 0.5, 142), 3, 5, 6); // RMS ≈ 4,3 µV < 0,5 + 5
    const forte = comRajada(ruido(10 * FS, 0.5, 142), 3, 5, 10); // RMS ≈ 7,1 µV > 0,5 + 5
    const rFraca = resumirSessao([quieto, etapa('tarefa', fraca)], FS, CANAL);
    const rForte = resumirSessao([quieto, etapa('tarefa', forte)], FS, CANAL);
    // Prova de que a rajada fraca passaria só com k: o detector cru a enxerga.
    const lb = rFraca.linhaDeBase;
    expect(lb).not.toBeNull();
    const basal = rmsEmJanelas(quieto.amostras, FS, JANELA_ENVELOPE_DETECCAO_MS, 1000 / FS).rms;
    const cruas = detectarContracoes(envelopeRms(fraca, FS, JANELA_ENVELOPE_DETECCAO_MS), FS, {
      repouso: basal,
      k: K_CONTRACAO,
      duracaoMinMs: DURACAO_MIN_CONTRACAO_MS,
    });
    expect(cruas.length).toBe(1);
    expect(rFraca.contracoes).toEqual([]);
    expect(rForte.contracoes.length).toBe(1);
  });

  it('duas gravações de tarefa são emendadas: tempos seguem o total e há aviso', () => {
    const a = comRajada(ruido(6 * FS, 2, 151), 1, 3, 100);
    const b = comRajada(ruido(6 * FS, 2, 152), 1, 3, 100);
    const base = etapasPadrao().filter((x) => x.tipo !== 'tarefa');
    const r = resumirSessao([...base, etapa('tarefa', a), etapa('tarefa', b)], FS, CANAL);
    expect(r.duracaoTarefaS).toBe(12);
    expect(r.contracoes.length).toBe(2);
    expect(Math.abs(r.contracoes[0].inicioS - 1)).toBeLessThan(0.1);
    expect(Math.abs(r.contracoes[1].inicioS - 7)).toBeLessThan(0.1);
    expect(r.avisos.join(' ')).toMatch(/Mais de uma gravação de tarefa/);
  });

  it('amostras não finitas na tarefa não quebram nem geram números inválidos', () => {
    const t = comRajada(ruido(10 * FS, 2, 161), 3, 5, 100);
    t[100] = NaN;
    t[101] = Infinity;
    t[102] = -Infinity;
    const base = etapasPadrao().filter((x) => x.tipo !== 'tarefa');
    const r = resumirSessao([...base, etapa('tarefa', t)], FS, CANAL);
    expect(r.contracoes.length).toBe(1);
    for (const c of r.contracoes) {
      for (const v of [c.inicioS, c.fimS, c.duracaoS, c.picoUv, c.rmsMedioUv, c.picoPctCvm, c.rmsMedioPctCvm]) {
        expect(Number.isFinite(v)).toBe(true);
      }
    }
  });
});

describe('resumirSessao: entradas e bordas', () => {
  it('lista vazia: resumo vazio com os avisos de falta de repouso e de CVM', () => {
    const r = resumirSessao([], FS, CANAL);
    expect(r.contracoes).toEqual([]);
    expect(r.cvmUv).toBeNull();
    expect(r.ruidoBasalRmsUv).toBeNull();
    expect(r.duracaoTarefaS).toBe(0);
    expect(r.avisos.length).toBe(2);
  });

  it('etapas todas vazias equivalem à lista vazia', () => {
    const r = resumirSessao([etapa('repouso', []), etapa('cvm', []), etapa('tarefa', [])], FS, CANAL);
    expect(r).toEqual(resumirSessao([], FS, CANAL));
  });

  it.each([0, -1, NaN, Infinity])('fsHz inválido %s lança RangeError', (fs) => {
    expect(() => resumirSessao([], fs, CANAL)).toThrow(RangeError);
  });

  it('não altera as amostras recebidas', () => {
    const e = etapasPadrao();
    const copia = e.map((x) => Float64Array.from(x.amostras));
    resumirSessao(e, FS, CANAL);
    e.forEach((x, i) => expect(Array.from(x.amostras)).toEqual(Array.from(copia[i])));
  });

  it('é determinístico: duas chamadas dão o mesmo resumo', () => {
    const e = etapasPadrao();
    expect(resumirSessao(e, FS, CANAL)).toEqual(resumirSessao(e, FS, CANAL));
  });
});

// ---------------------------------------------------------------------------
// Falso positivo: 300 sementes de ruído branco
// ---------------------------------------------------------------------------

describe('falso positivo em ruído puro (300 sementes)', () => {
  const SEMENTES = 300;
  const SIGMAS = [0.5, 1, 2, 4, 10, 25];

  it('sessão com repouso e tarefa só de ruído branco: nenhuma contração em nenhuma semente', () => {
    let comFalso = 0;
    for (let semente = 1; semente <= SEMENTES; semente++) {
      const sigma = SIGMAS[semente % SIGMAS.length];
      const r = resumirSessao(
        [etapa('repouso', ruido(5 * FS, sigma, semente)), etapa('tarefa', ruido(15 * FS, sigma, 10_000 + semente))],
        FS,
        CANAL,
      );
      if (r.contracoes.length > 0) comFalso++;
    }
    expect(comFalso).toBe(0);
  }, 60_000);

  it('só os parâmetros k e duração mínima já bastam, sem o piso (o piso é margem extra)', () => {
    let comFalso = 0;
    for (let semente = 1; semente <= SEMENTES; semente++) {
      const sigma = SIGMAS[semente % SIGMAS.length];
      const basal = rmsEmJanelas(ruido(REPOUSO_MIN_S * FS, sigma, semente), FS, JANELA_ENVELOPE_DETECCAO_MS, 1000 / FS).rms;
      const env = envelopeRms(ruido(15 * FS, sigma, 20_000 + semente), FS, JANELA_ENVELOPE_DETECCAO_MS);
      const c = detectarContracoes(env, FS, {
        repouso: basal,
        k: K_CONTRACAO,
        duracaoMinMs: DURACAO_MIN_CONTRACAO_MS,
        juntarMs: JUNTAR_CONTRACOES_MS,
      });
      if (c.length > 0) comFalso++;
    }
    expect(comFalso).toBe(0);
  }, 60_000);

  it('o achado da etapa 1 se reproduz com k = 3 e repouso de 1 s: muito falso positivo', () => {
    let comFalso = 0;
    for (let semente = 1; semente <= SEMENTES; semente++) {
      const env = envelopeRms(ruido(15 * FS, 2, 30_000 + semente), FS, JANELA_ENVELOPE_DETECCAO_MS);
      const basal = rmsEmJanelas(ruido(1 * FS, 2, 40_000 + semente), FS, JANELA_ENVELOPE_DETECCAO_MS, 1000 / FS).rms;
      const c = detectarContracoes(env, FS, { repouso: basal, k: 3, duracaoMinMs: 100 });
      if (c.length > 0) comFalso++;
    }
    expect(comFalso).toBeGreaterThan(SEMENTES * 0.1);
  }, 60_000);

  it('ruído colorido (autorregressivo, mais lento que o branco) também não gera contração', () => {
    let comFalso = 0;
    for (let semente = 1; semente <= 100; semente++) {
      const colorir = (w: Float64Array): Float64Array => {
        const x = new Float64Array(w.length);
        let y = 0;
        for (let i = 0; i < w.length; i++) {
          y = 0.7 * y + w[i];
          x[i] = y;
        }
        return x;
      };
      const r = resumirSessao(
        [
          etapa('repouso', colorir(ruido(5 * FS, 2, semente))),
          etapa('tarefa', colorir(ruido(15 * FS, 2, 50_000 + semente))),
        ],
        FS,
        CANAL,
      );
      if (r.contracoes.length > 0) comFalso++;
    }
    expect(comFalso).toBe(0);
  }, 60_000);
});

// ---------------------------------------------------------------------------
// paraGravar
// ---------------------------------------------------------------------------

describe('paraGravar', () => {
  const etapas = etapasPadrao();
  const resumo = resumirSessao(etapas, FS, CANAL);
  const dados = paraGravar(resumo, etapas, FS, CANAL, 'Dor leve ao final');

  it('monta o formato versão 1', () => {
    expect(dados.versao).toBe(1);
    expect(dados.fsHz).toBe(FS);
    expect(dados.canais).toEqual([CANAL]);
    expect(dados.observacoes).toBe('Dor leve ao final');
    expect(dados.etapas.map((e) => e.tipo)).toEqual(['repouso', 'cvm', 'cvm', 'cvm', 'tarefa']);
    expect(dados.etapas.map((e) => e.duracaoS)).toEqual([5, 5, 5, 5, 20]);
  });

  it('grava os parâmetros usados na análise', () => {
    expect(dados.parametros).toEqual({
      k: 5,
      pisoUv: 5,
      repousoMinS: 3,
      duracaoMinContracaoMs: 300,
      juntarMs: 100,
      janelas: { deteccaoMs: 100, cvmMs: 1000, envelopeSalvoMs: 50 },
    });
    expect(dados.parametros).toEqual(PARAMETROS_ANALISE);
    expect(dados.parametros).not.toBe(PARAMETROS_ANALISE);
    dados.parametros.janelas.cvmMs = 1;
    expect(PARAMETROS_ANALISE.janelas.cvmMs).toBe(JANELA_CVM_MS);
    dados.parametros.janelas.cvmMs = JANELA_CVM_MS;
  });

  it('o envelope tem um valor a cada 50 ms (20 Hz): 25 amostras a 500 Hz', () => {
    expect(JANELA_ENVELOPE_SALVO_MS).toBe(50);
    expect(dados.etapas[0].envelope20Hz.length).toBe(100); // 5 s
    expect(dados.etapas[4].envelope20Hz.length).toBe(400); // 20 s
  });

  it('valores do envelope: RMS de 50 ms arredondado a 0,1 µV, conferido bloco a bloco', () => {
    // 1 s com ±10 µV alternados (RMS 10), 1 s com ±20, 1 s com ±12,34 (arredonda para 12,3) e 1 s com ±12,36 (12,4).
    const x = new Float64Array(4 * FS);
    const amplitudes = [10, 20, 12.34, 12.36];
    for (let i = 0; i < x.length; i++) {
      const a = amplitudes[Math.floor(i / FS)];
      x[i] = i % 2 === 0 ? a : -a;
    }
    const e = etapa('tarefa', x);
    const d = paraGravar(resumirSessao([e], FS, CANAL), [e], FS, CANAL);
    const env = d.etapas[0].envelope20Hz;
    expect(env.length).toBe(80);
    expect(env.slice(0, 20)).toEqual(new Array(20).fill(10));
    expect(env.slice(20, 40)).toEqual(new Array(20).fill(20));
    expect(env.slice(40, 60)).toEqual(new Array(20).fill(12.3));
    expect(env.slice(60, 80)).toEqual(new Array(20).fill(12.4));
  });

  it('com ruído, cada valor bate com o RMS do bloco de 25 amostras calculado à mão', () => {
    const x = etapas[0].amostras;
    const env = dados.etapas[0].envelope20Hz;
    for (let j = 0; j < env.length; j++) {
      let soma = 0;
      for (let i = j * 25; i < (j + 1) * 25; i++) soma += x[i] * x[i];
      const esperado = Math.round(Math.sqrt(soma / 25) * 10) / 10;
      expect(env[j]).toBeCloseTo(esperado, 9);
    }
  });

  it('todo valor do envelope tem no máximo 1 casa decimal e é finito', () => {
    for (const e of dados.etapas) {
      for (const v of e.envelope20Hz) {
        expect(Number.isFinite(v)).toBe(true);
        expect(Math.abs(Math.round(v * 10) / 10 - v)).toBeLessThan(1e-9);
      }
    }
  });

  it('não leva o sinal bruto: nenhuma amostra, só o envelope', () => {
    const json = JSON.stringify(dados);
    expect(json).not.toContain('amostras');
    expect(Object.keys(dados.etapas[0]).sort()).toEqual(['duracaoS', 'envelope20Hz', 'tipo']);
  });

  it('ida e volta por JSON.stringify/parse não perde nada', () => {
    expect(JSON.parse(JSON.stringify(dados))).toEqual(dados);
  });

  it('o resumo guardado só difere do original pelo arredondamento', () => {
    const g = dados.resumo;
    expect(Math.abs((g.cvmUv as number) - (resumo.cvmUv as number))).toBeLessThanOrEqual(0.005 + 1e-9);
    expect(Math.abs((g.ruidoBasalRmsUv as number) - (resumo.ruidoBasalRmsUv as number))).toBeLessThanOrEqual(0.005 + 1e-9);
    expect(g.tentativasCvm).toBe(resumo.tentativasCvm);
    expect(g.avisos).toEqual(resumo.avisos);
    expect(g.contracoes.length).toBe(resumo.contracoes.length);
    g.contracoes.forEach((c, i) => {
      const o = resumo.contracoes[i];
      expect(Math.abs(c.inicioS - o.inicioS)).toBeLessThanOrEqual(0.0005 + 1e-9);
      expect(Math.abs(c.duracaoS - o.duracaoS)).toBeLessThanOrEqual(0.0005 + 1e-9);
      expect(Math.abs(c.picoUv - o.picoUv)).toBeLessThanOrEqual(0.005 + 1e-9);
      expect(Math.abs((c.picoPctCvm as number) - (o.picoPctCvm as number))).toBeLessThanOrEqual(0.05 + 1e-9);
    });
    expect(Math.abs((g.picoPctCvmMax as number) - (resumo.picoPctCvmMax as number))).toBeLessThanOrEqual(0.05 + 1e-9);
  });

  it('nulls do resumo (sem CVM, sem repouso) sobrevivem à ida e volta', () => {
    const so = [etapa('tarefa', ruido(5 * FS, 2, 7))];
    const r = resumirSessao(so, FS, CANAL);
    const d = paraGravar(r, so, FS, CANAL);
    const volta = JSON.parse(JSON.stringify(d)) as typeof d;
    expect(volta).toEqual(d);
    expect(volta.resumo.cvmUv).toBeNull();
    expect(volta.resumo.qualidade).toBeNull();
    expect(volta.resumo.linhaDeBase).toBeNull();
    expect(volta.resumo.picoPctCvmMax).toBeNull();
  });

  it('60 s a 500 Hz: o JSON é uma fração do bruto e cabe folgado numa linha de exames_presenciais', () => {
    const tarefa = ruido(60 * FS, 2, 77);
    comRajada(tarefa, 10, 15, 80);
    comRajada(tarefa, 30, 36, 120);
    const e = [
      etapa('repouso', ruido(5 * FS, 2, 78)),
      etapa('cvm', comRajada(ruido(5 * FS, 2, 79), 1, 4, 140)),
      etapa('tarefa', tarefa),
    ];
    const r = resumirSessao(e, FS, CANAL);
    const d = paraGravar(r, e, FS, CANAL);
    const json = JSON.stringify(d);
    const bruto = JSON.stringify(Array.from(tarefa)).length;
    expect(bruto).toBeGreaterThan(400_000);
    expect(json.length).toBeLessThan(12_000);
    expect(json.length * 20).toBeLessThan(bruto);
  });

  it('observações: remove espaços das pontas; vazio ou só espaços vira null', () => {
    const base = [resumo, etapas, FS, CANAL] as const;
    expect(paraGravar(...base, '  texto  ').observacoes).toBe('texto');
    expect(paraGravar(...base, '').observacoes).toBeNull();
    expect(paraGravar(...base, '  \n ').observacoes).toBeNull();
    expect(paraGravar(...base).observacoes).toBeNull();
  });

  it('bordas: etapa vazia ou menor que 50 ms dá envelope vazio; não finitos não viram NaN', () => {
    const e = [etapa('repouso', []), etapa('cvm', new Float64Array(24).fill(3)), etapa('tarefa', [NaN, Infinity, ...new Array(48).fill(2)])];
    const d = paraGravar(resumirSessao(e, FS, CANAL), e, FS, CANAL);
    expect(d.etapas[0]).toEqual({ tipo: 'repouso', duracaoS: 0, envelope20Hz: [] });
    expect(d.etapas[1].envelope20Hz).toEqual([]);
    expect(d.etapas[2].envelope20Hz.length).toBe(2);
    expect(d.etapas[2].envelope20Hz.every(Number.isFinite)).toBe(true);
    expect(JSON.parse(JSON.stringify(d))).toEqual(d);
  });

  it('fsHz inválido lança RangeError', () => {
    expect(() => paraGravar(resumo, etapas, 0, CANAL)).toThrow(RangeError);
    expect(() => paraGravar(resumo, etapas, NaN, CANAL)).toThrow(RangeError);
  });

  it('a 1000 Hz o envelope também sai a 20 Hz (50 amostras por valor)', () => {
    const e = [etapa('tarefa', ruido(2 * 1000, 2, 5))];
    const d = paraGravar(resumirSessao(e, 1000, CANAL), e, 1000, CANAL);
    expect(d.etapas[0].envelope20Hz.length).toBe(40);
  });
});

// ---------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------

function contracao(parcial: Partial<ContracaoResumo> = {}): ContracaoResumo {
  return {
    inicioS: 3,
    fimS: 5,
    duracaoS: 2,
    picoUv: 120,
    rmsMedioUv: 80,
    picoPctCvm: 50,
    rmsMedioPctCvm: 33,
    ...parcial,
  };
}

function resumoManual(parcial: Partial<ResumoSessao> = {}): ResumoSessao {
  return {
    canal: CANAL,
    duracaoRepousoS: 5,
    duracaoTarefaS: 20,
    ruidoBasalRmsUv: 1.8,
    repousoRmsUv: 2,
    qualidade: { ruidoBasalRms: 1.8, contaminacaoRede: 0.01, linhaPlana: false, saturacao: false, nivel: 'bom', motivos: [] },
    linhaDeBase: { mediaUv: 2, desvioUv: 0.2, limiarUv: 3, pisoPicoUv: 7 },
    tentativasCvm: 3,
    cvmPorTentativaUv: [230.2, 245.3, 240.1],
    cvmUv: 245.3,
    contracoes: [contracao(), contracao({ picoUv: 155, picoPctCvm: 63.4 }), contracao(), contracao()],
    picoPctCvmMax: 63.4,
    avisos: [],
    ...parcial,
  };
}

const PALAVRAS_DE_CONCLUSAO = /diagn[óo]stic|\bnormal\b|anormal|patol[óo]gic|d[ée]ficit|fraqueza|les[ãa]o|doen[çc]a|disfun[çc][ãa]o|atrofia|insuficien/i;
const LIXO = /undefined|NaN|\bnull\b|Infinity|\[object/;

function cenariosDeTexto(): Array<{ nome: string; resumo: ResumoSessao }> {
  return [
    { nome: 'completo', resumo: resumoManual() },
    { nome: 'sem CVM', resumo: resumoManual({ cvmUv: null, tentativasCvm: 0, cvmPorTentativaUv: [], picoPctCvmMax: null, contracoes: [contracao({ picoPctCvm: null, rmsMedioPctCvm: null })], avisos: ['Sem CVM gravada: os valores ficam em µV e não puderam ser normalizados em % da CVM.'] }) },
    { nome: 'sem contrações', resumo: resumoManual({ contracoes: [], picoPctCvmMax: null, avisos: ['Nenhuma contração detectada na tarefa.'] }) },
    { nome: 'sem tarefa', resumo: resumoManual({ duracaoTarefaS: 0, contracoes: [], picoPctCvmMax: null }) },
    { nome: 'sem repouso', resumo: resumoManual({ duracaoRepousoS: 0, ruidoBasalRmsUv: null, repousoRmsUv: null, qualidade: null, linhaDeBase: null, contracoes: [], picoPctCvmMax: null, avisos: ['Sem repouso gravado.'] }) },
    { nome: 'vazio', resumo: resumirSessao([], FS, CANAL) },
    { nome: 'pipeline real', resumo: resumirSessao(etapasPadrao(), FS, CANAL) },
  ];
}

describe('rotuloDoCanal', () => {
  it('junta músculo e lado; sem lado fica só o músculo; sem nome usa o id', () => {
    expect(rotuloDoCanal({ id: '1', musculo: 'Quadríceps', lado: 'D' })).toBe('Quadríceps D');
    expect(rotuloDoCanal({ id: '1', musculo: ' Bíceps ', lado: 'E' })).toBe('Bíceps E');
    expect(rotuloDoCanal({ id: '1', musculo: 'Trapézio', lado: '-' })).toBe('Trapézio');
    expect(rotuloDoCanal({ id: '3', musculo: '  ', lado: 'D' })).toBe('canal 3 D');
  });
});

describe('resumoCurto', () => {
  it('segue o modelo da especificação', () => {
    expect(resumoCurto(resumoManual(), CANAL)).toBe(
      'EMG de superfície — Quadríceps D: CVM de 245 µV; 4 contrações, pico de 63 % da CVM.',
    );
  });

  it('usa vírgula decimal e uma casa abaixo de 100 µV; singular com uma contração', () => {
    const r = resumoManual({ cvmUv: 45.34, contracoes: [contracao()], picoPctCvmMax: 100.4 });
    expect(resumoCurto(r, CANAL)).toBe('EMG de superfície — Quadríceps D: CVM de 45,3 µV; 1 contração, pico de 100 % da CVM.');
  });

  it('sem CVM mostra o maior pico em µV e diz que não houve normalização', () => {
    const r = resumoManual({
      cvmUv: null,
      picoPctCvmMax: null,
      contracoes: [contracao({ picoUv: 87.4, picoPctCvm: null }), contracao({ picoUv: 60, picoPctCvm: null })],
    });
    expect(resumoCurto(r, CANAL)).toBe(
      'EMG de superfície — Quadríceps D: sem CVM registrada; 2 contrações, pico de 87,4 µV absolutos (sem normalização pela CVM; não comparáveis entre pessoas ou sessões).',
    );
  });

  it('com CVM o resumo vem em % da CVM e não leva a ressalva de µV absolutos', () => {
    expect(resumoCurto(resumoManual(), CANAL)).not.toMatch(/absolutos|comparáveis/);
  });

  it('descreve cada situação sem inventar contração', () => {
    expect(resumoCurto(resumoManual({ contracoes: [], picoPctCvmMax: null }), CANAL)).toBe(
      'EMG de superfície — Quadríceps D: CVM de 245 µV; nenhuma contração detectada na tarefa.',
    );
    expect(resumoCurto(resumoManual({ duracaoTarefaS: 0, contracoes: [], picoPctCvmMax: null }), CANAL)).toBe(
      'EMG de superfície — Quadríceps D: CVM de 245 µV; tarefa não gravada.',
    );
    expect(resumoCurto(resumoManual({ linhaDeBase: null, contracoes: [], picoPctCvmMax: null }), CANAL)).toBe(
      'EMG de superfície — Quadríceps D: CVM de 245 µV; contrações não detectadas (sem repouso utilizável).',
    );
  });

  it('usa o canal passado: lado esquerdo, sem lado e sem nome de músculo', () => {
    expect(resumoCurto(resumoManual(), { id: '2', musculo: 'Glúteo médio', lado: 'E' })).toMatch(/^EMG de superfície — Glúteo médio E: /);
    expect(resumoCurto(resumoManual(), { id: '2', musculo: 'Reto abdominal', lado: '-' })).toMatch(/^EMG de superfície — Reto abdominal: /);
    expect(resumoCurto(resumoManual(), { id: '4', musculo: '', lado: '-' })).toMatch(/^EMG de superfície — canal 4: /);
  });

  it('é uma frase só: sem quebra de linha, termina em ponto', () => {
    for (const { resumo } of cenariosDeTexto()) {
      const t = resumoCurto(resumo, CANAL);
      expect(t).not.toContain('\n');
      expect(t.endsWith('.')).toBe(true);
      expect(t.startsWith('EMG de superfície — Quadríceps D: ')).toBe(true);
    }
  });

  it('não conclui nada: sem diagnóstico nem termos de conclusão clínica, e sem lixo de formatação', () => {
    for (const { nome, resumo } of cenariosDeTexto()) {
      const t = resumoCurto(resumo, CANAL);
      expect(t, nome).not.toMatch(PALAVRAS_DE_CONCLUSAO);
      expect(t, nome).not.toMatch(LIXO);
    }
  });
});

describe('laudoTexto', () => {
  it('traz a ressalva: interpretação é do profissional e µV absolutos dependem de eletrodo e pele', () => {
    const t = laudoTexto(resumoManual(), CANAL);
    expect(t).toMatch(/a interpretação é do profissional/);
    expect(t).toMatch(/µV absolutos dependem do eletrodo, da preparação da pele/);
    expect(t).toMatch(/% da CVM/);
    expect(t.startsWith('Eletromiografia (EMG) de superfície — Quadríceps D')).toBe(true);
  });

  it('descreve repouso, CVM e tarefa com os números do resumo, em português com vírgula decimal', () => {
    const t = laudoTexto(resumoManual(), CANAL);
    expect(t).toContain('Repouso: 5,0 s gravados; ruído basal de 1,8 µV (RMS); RMS do repouso de 2,0 µV; qualidade do sinal: boa.');
    expect(t).toContain('CVM (contração voluntária máxima): 3 tentativas (230 · 245 · 240 µV); referência adotada de 245 µV');
    expect(t).toContain('Tarefa: 20,0 s gravados; 4 contrações detectadas.');
    expect(t).toContain('1. início em 3,0 s, duração de 2,0 s, pico de 120 µV (50 % da CVM), RMS médio de 80,0 µV (33 % da CVM).');
    expect(t).toContain('Maior pico: 63 % da CVM.');
    expect(t).not.toMatch(/\d\.\d/);
  });

  it('descreve o critério de detecção com os parâmetros reais', () => {
    const t = laudoTexto(resumoManual(), CANAL);
    expect(t).toContain(`envelope RMS de ${JANELA_ENVELOPE_DETECCAO_MS} ms`);
    expect(t).toContain(`${K_CONTRACAO} desvios-padrão`);
    expect(t).toContain(`${PISO_CONTRACAO_UV} µV acima da média do repouso`);
    expect(t).toContain(`${DURACAO_MIN_CONTRACAO_MS} ms`);
  });

  it('sem CVM: não escreve % da CVM nas contrações e explica', () => {
    const r = resumoManual({
      cvmUv: null,
      tentativasCvm: 0,
      cvmPorTentativaUv: [],
      picoPctCvmMax: null,
      contracoes: [contracao({ picoPctCvm: null, rmsMedioPctCvm: null })],
    });
    const t = laudoTexto(r, CANAL);
    expect(t).toContain(
      'CVM (contração voluntária máxima): não registrada; os valores ficam em µV absolutos, sem normalização pela CVM, e não são comparáveis entre pessoas nem entre sessões.',
    );
    expect(t).toContain('1. início em 3,0 s, duração de 2,0 s, pico de 120 µV, RMS médio de 80,0 µV.');
    expect(t).not.toContain('Maior pico');
  });

  it('lista os avisos e as observações do profissional; observação em branco é ignorada', () => {
    const r = resumoManual({ avisos: ['Só 2 tentativas de CVM (o protocolo prevê 3).', 'Outro aviso.'] });
    const t = laudoTexto(r, CANAL, '  Paciente refere desconforto na 2ª série.  ');
    expect(t).toContain('Avisos do registro:\n- Só 2 tentativas de CVM (o protocolo prevê 3).\n- Outro aviso.');
    expect(t).toContain('Observações do profissional: Paciente refere desconforto na 2ª série.');
    expect(laudoTexto(r, CANAL, '   ')).not.toContain('Observações do profissional');
    expect(laudoTexto(resumoManual(), CANAL)).not.toContain('Avisos do registro');
  });

  it('limita a lista de contrações e diz quantas ficaram de fora', () => {
    const muitas = Array.from({ length: MAX_CONTRACOES_NO_LAUDO + 5 }, (_, i) => contracao({ inicioS: i * 3 }));
    const t = laudoTexto(resumoManual({ contracoes: muitas }), CANAL);
    expect(t).toContain(`${MAX_CONTRACOES_NO_LAUDO}. início`);
    expect(t).not.toContain(`${MAX_CONTRACOES_NO_LAUDO + 1}. início`);
    expect(t).toContain('… e mais 5 contrações nos dados do exame.');
    const uma = laudoTexto(resumoManual({ contracoes: Array.from({ length: MAX_CONTRACOES_NO_LAUDO + 1 }, () => contracao()) }), CANAL);
    expect(uma).toContain('… e mais 1 contração nos dados do exame.');
  });

  it('situações sem dado: repouso, tarefa e contrações descritos sem inventar', () => {
    const semRepouso = laudoTexto(cenariosDeTexto()[4].resumo, CANAL);
    expect(semRepouso).toContain('Repouso: não gravado.');
    expect(semRepouso).toContain('contrações não detectadas por falta de um repouso utilizável');
    const semTarefa = laudoTexto(cenariosDeTexto()[3].resumo, CANAL);
    expect(semTarefa).toContain('Tarefa: não gravada.');
    expect(semTarefa).not.toContain('Contrações na tarefa');
    const nenhuma = laudoTexto(cenariosDeTexto()[2].resumo, CANAL);
    expect(nenhuma).toContain('Tarefa: 20,0 s gravados; nenhuma contração detectada.');
    const vazio = laudoTexto(cenariosDeTexto()[5].resumo, CANAL);
    expect(vazio).toContain('Repouso: não gravado.');
    expect(vazio).toContain('Tarefa: não gravada.');
  });

  it('não conclui nada em nenhum cenário (nem a palavra diagnóstico) e não vaza lixo de formatação', () => {
    for (const { nome, resumo } of cenariosDeTexto()) {
      const t = laudoTexto(resumo, CANAL);
      expect(t, nome).not.toMatch(PALAVRAS_DE_CONCLUSAO);
      expect(t, nome).not.toMatch(LIXO);
      expect(t, nome).toMatch(/interpretação é do profissional/);
    }
  });

  it('a observação do profissional é repassada como escrita (a responsabilidade é dele)', () => {
    const t = laudoTexto(resumoManual(), CANAL, 'Hipótese: déficit de ativação.');
    expect(t).toContain('Observações do profissional: Hipótese: déficit de ativação.');
  });
});

// ---------------------------------------------------------------------------
// csvDoSinal
// ---------------------------------------------------------------------------

describe('csvDoSinal', () => {
  // Excel em português do Brasil: separador ";", vírgula decimal e BOM UTF-8 no começo.
  const BOM = String.fromCharCode(0xfeff);

  it('cabeçalho, nomes das etapas, tempo desde o início de cada etapa, ";" entre colunas e vírgula decimal', () => {
    const csv = csvDoSinal([etapa('repouso', [1.5, -2.25]), etapa('tarefa', [3])], 500);
    expect(csv).toBe(`${BOM}etapa;tempo_s;sinal_uV\nrepouso_1;0;1,5\nrepouso_1;0,002;-2,25\ntarefa_1;0;3\n`);
  });

  it('começa com o BOM UTF-8 (EF BB BF) uma vez só, e o cabeçalho vem logo depois', () => {
    const csv = csvDoSinal([etapa('tarefa', [1, 2])], 500);
    expect(Array.from(new TextEncoder().encode(csv).slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(csv.indexOf(BOM)).toBe(0);
    expect(csv.lastIndexOf(BOM)).toBe(0);
    expect(csv.slice(1).split('\n')[0]).toBe('etapa;tempo_s;sinal_uV');
  });

  it('numera as etapas do mesmo tipo na ordem da lista', () => {
    const csv = csvDoSinal([etapa('cvm', [1]), etapa('cvm', [2]), etapa('tarefa', [3]), etapa('cvm', [4])], 1000);
    expect(csv.split('\n').filter(Boolean)).toEqual([
      `${BOM}etapa;tempo_s;sinal_uV`,
      'cvm_1;0;1',
      'cvm_2;0;2',
      'tarefa_1;0;3',
      'cvm_3;0;4',
    ]);
  });

  it('vazio quando não há amostra: sem etapas, ou só etapas sem amostras', () => {
    expect(csvDoSinal([], 500)).toBe('');
    expect(csvDoSinal([etapa('repouso', []), etapa('tarefa', new Float64Array(0))], 500)).toBe('');
  });

  it('etapa vazia no meio não aparece, mas ocupa o número', () => {
    const csv = csvDoSinal([etapa('cvm', []), etapa('cvm', [7])], 500);
    expect(csv).toBe(`${BOM}etapa;tempo_s;sinal_uV\ncvm_2;0;7\n`);
  });

  it('toda linha tem 3 campos separados por ";" (nunca ponto decimal) e dá para ler de volta', () => {
    const x = ruido(1000, 12.3456, 9);
    const csv = csvDoSinal([etapa('tarefa', x)], 500);
    const linhas = csv.trimEnd().split('\n');
    expect(linhas.length).toBe(x.length + 1);
    for (let i = 1; i < linhas.length; i++) {
      expect(linhas[i]).not.toContain('.');
      const campos = linhas[i].split(';');
      expect(campos.length).toBe(3);
      expect(campos[0]).toBe('tarefa_1');
      expect(Number(campos[1].replace(',', '.'))).toBeCloseTo((i - 1) / 500, 9);
      expect(Math.abs(Number(campos[2].replace(',', '.')) - x[i - 1])).toBeLessThanOrEqual(0.0005 + 1e-9);
    }
  });

  it('arredonda µV a 3 casas e o tempo a 1 µs, sem notação científica', () => {
    const csv = csvDoSinal([etapa('tarefa', [1.23456, 0.0004, 123456.789123])], 333);
    expect(csv.split('\n')[1]).toBe('tarefa_1;0;1,235');
    expect(csv.split('\n')[2]).toBe('tarefa_1;0,003003;0');
    expect(csv.split('\n')[3]).toBe('tarefa_1;0,006006;123456,789');
    expect(csv).not.toMatch(/e[+-]?\d/);
  });

  it('amostra não finita vira célula vazia', () => {
    const csv = csvDoSinal([etapa('tarefa', [NaN, Infinity, -Infinity, 2])], 500);
    expect(csv.split('\n').slice(1, 5)).toEqual(['tarefa_1;0;', 'tarefa_1;0,002;', 'tarefa_1;0,004;', 'tarefa_1;0,006;2']);
  });

  it('fsHz inválido lança RangeError', () => {
    expect(() => csvDoSinal([etapa('tarefa', [1])], 0)).toThrow(RangeError);
    expect(() => csvDoSinal([], NaN)).toThrow(RangeError);
  });

  it('aceita as etapas do gravador (Float64Array) e mantém a ordem gravada', () => {
    const g = new GravadorDeSessao({ fsHz: FS, canal: CANAL });
    g.iniciarEtapa('repouso');
    g.receber([1, 2]);
    g.finalizarEtapa();
    g.iniciarEtapa('tarefa');
    g.receber([3]);
    g.finalizarEtapa();
    expect(csvDoSinal(g.etapas, FS)).toBe(`${BOM}etapa;tempo_s;sinal_uV\nrepouso_1;0;1\nrepouso_1;0,002;2\ntarefa_1;0;3\n`);
  });
});

describe('constantes do protocolo', () => {
  it('seguem a especificação: repouso 5 s, 3 tentativas de CVM de 5 s, descanso sugerido de 30 s', () => {
    expect(PROTOCOLO_SESSAO).toEqual({ repousoS: 5, cvmTentativas: 3, cvmDuracaoS: 5, cvmDescansoSugeridoS: 30 });
  });

  it('k é 5 e o piso absoluto é 5 µV', () => {
    expect(K_CONTRACAO).toBe(5);
    expect(PISO_CONTRACAO_UV).toBe(5);
    expect(REPOUSO_MIN_S).toBeLessThanOrEqual(PROTOCOLO_SESSAO.repousoS);
  });
});
