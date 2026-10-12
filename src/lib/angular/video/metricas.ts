import { angulosPorQuadro, type AmostraAngulo } from './angulos';
import { detectarEventosCorrida, detectarEventosMarcha, eventosDo, extremosLocais, tempoDoEvento, type EventoPasso } from './eventos';
import { modeloDoGesto, type IdGesto, type ModeloGesto } from './modelos';
import { estatisticas, janelaEmAmostras, preencherLacunas, suavizar } from './suavizar';
import type { Lado, ResultadoMetrica, TrilhaPose } from './tipos';
import { deteccaoPct, estimarDirecao, pontoDoQuadro } from './trilha';

export interface ContextoMetricas {
  /** Eventos já conferidos pelo profissional. Sem isto são detectados automaticamente. */
  eventos?: EventoPasso[];
  /** Para onde o paciente está virado/andando (+1 direita da imagem). Sem isto é estimado pelos pés. */
  direcao?: 1 | -1;
  /** Centímetros por pixel no plano do paciente (a escala do vídeo). Sem isto as medidas em cm ficam sem valor. */
  escalaCmPorPx?: number | null;
  /** Câmera parada com o paciente se deslocando pelo quadro: habilita o comprimento da passada na corrida. */
  cameraFixa?: boolean;
  /** Janela de suavização dos ângulos em segundos (padrão 0,12 s; 0,08 s na corrida, onde os eventos são rápidos; 0 desliga). */
  suavizacaoS?: number;
}

export interface SerieRazao { t: number; valor: number | null }

/** Mínimo, máximo e amplitude de movimento (máximo − mínimo) de um ângulo ao longo do vídeo, com o instante de cada extremo. */
export interface AmplitudeArticular { min: number; max: number; adm: number; tMin: number; tMax: number; n: number }

/** Amplitude de uma série de ângulos (ignora as lacunas); null se não houver nenhuma amostra. */
export function amplitudeDaSerie(amostras: AmostraAngulo[]): AmplitudeArticular | null {
  let min = Infinity, max = -Infinity, tMin = 0, tMax = 0, n = 0;
  for (const a of amostras) {
    if (a.graus === null || !Number.isFinite(a.graus)) continue;
    n++;
    if (a.graus < min) { min = a.graus; tMin = a.t; }
    if (a.graus > max) { max = a.graus; tMax = a.t; }
  }
  return n ? { min, max, adm: max - min, tMin, tMax, n } : null;
}

export interface AnaliseGesto {
  modelo: IdGesto;
  direcao: 1 | -1;
  eventos: EventoPasso[];
  /** Ângulos do modelo, já suavizados, por id de articulação (uma amostra por quadro). */
  series: Record<string, AmostraAngulo[]>;
  /** Mínimo, máximo e amplitude de cada ângulo no vídeo inteiro (as séries suavizadas). */
  amplitudes: Record<string, AmplitudeArticular>;
  /** Séries que não são ângulos (razão joelho/tornozelo da aterrissagem). */
  razoes: Record<string, SerieRazao[]>;
  /** Quadro do contato da aterrissagem (modelo de salto), se achado. */
  aterrissagem: number | null;
  /** Quadros dos picos das repetições (agachamento e elevação do braço). */
  repeticoes: number[];
  metricas: ResultadoMetrica[];
  avisos: string[];
}

const JANELA_SUAVE_S = 0.12;
const JANELA_SUAVE_CORRIDA_S = 0.08;
const LADOS: Lado[] = ['D', 'E'];
const sfx = (l: Lado) => l.toLowerCase();
const nomeLado = (l: Lado) => (l === 'D' ? 'direito' : 'esquerdo');

export const FORMULA_ASSIMETRIA = 'IS = |D − E| ÷ ((D + E) ÷ 2) × 100 (0% = simetria perfeita)';

/** Índice de assimetria entre os lados, em %: |D − E| ÷ ((D + E) ÷ 2) × 100. Só para grandezas positivas. */
export function indiceAssimetria(d: number | null | undefined, e: number | null | undefined): number | null {
  if (d === null || d === undefined || e === null || e === undefined || !Number.isFinite(d) || !Number.isFinite(e)) return null;
  const m = (d + e) / 2;
  return m > 0 ? (Math.abs(d - e) / m) * 100 : null;
}

/** Razão de simetria, em %: menor ÷ maior × 100 (100% = simétrico). */
export function razaoSimetria(d: number | null | undefined, e: number | null | undefined): number | null {
  if (d === null || d === undefined || e === null || e === undefined || !Number.isFinite(d) || !Number.isFinite(e) || d <= 0 || e <= 0) return null;
  return (Math.min(d, e) / Math.max(d, e)) * 100;
}

const mediana = (v: number[]): number | null => {
  if (!v.length) return null;
  const o = [...v].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};

const percentil = (valores: number[], p: number): number => {
  const v = [...valores].sort((a, b) => a - b);
  const pos = (v.length - 1) * p;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return v[lo] + (v[hi] - v[lo]) * (pos - lo);
};

const validos = (s: readonly (number | null | undefined)[]): number[] => s.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

function resultado(metrica: string, nome: string, unidade: string, lado: Lado | null, valor: number | null, extra: Partial<ResultadoMetrica> = {}): ResultadoMetrica {
  return {
    id: lado ? `${metrica}_${sfx(lado)}` : metrica,
    metrica, nome: lado ? `${nome} (${nomeLado(lado)})` : nome, valor: valor !== null && Number.isFinite(valor) ? valor : null, unidade, lado, avisos: [], ...extra,
  };
}

/** Média das observações (com n e desvio-padrão). Sem observações, o valor fica nulo. */
function media(metrica: string, nome: string, unidade: string, lado: Lado | null, obs: number[], extra: Partial<ResultadoMetrica> = {}): ResultadoMetrica {
  const est = estatisticas(obs);
  return resultado(metrica, nome, unidade, lado, est.media, { n: est.n, ...(est.dp !== null ? { dp: est.dp } : {}), ...extra });
}

/**
 * Assimetria entre os lados (|D − E| ÷ média × 100). Para grandezas de tempo, informa também o erro que um quadro de vídeo
 * causa no índice (100 ÷ (fps × tempo médio)), para não confundir resolução do vídeo com assimetria real.
 */
function assimetria(metrica: string, nome: string, d: ResultadoMetrica | undefined, e: ResultadoMetrica | undefined, origem: string, fps?: number): ResultadoMetrica {
  const valor = indiceAssimetria(d?.valor, e?.valor);
  const fmt = (r?: ResultadoMetrica) => (r?.valor === null || r?.valor === undefined ? '–' : r.valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 }));
  const maior = d?.valor !== null && d?.valor !== undefined && e?.valor !== null && e?.valor !== undefined && d.valor !== e.valor ? (d.valor > e.valor ? 'direito' : 'esquerdo') : null;
  const r = resultado(metrica, nome, '%', null, valor, {
    formula: FORMULA_ASSIMETRIA,
    detalhe: `${origem}: D = ${fmt(d)}, E = ${fmt(e)}${maior ? `; maior no lado ${maior}` : ''}.`,
  });
  const segundos = d?.valor !== null && d?.valor !== undefined && e?.valor !== null && e?.valor !== undefined
    ? ((d.valor + e.valor) / 2) / (d.unidade === 'ms' ? 1000 : 1)
    : null;
  if (fps && valor !== null && segundos && d?.unidade !== '°' && (d?.unidade === 's' || d?.unidade === 'ms')) {
    r.incerteza = 100 / (fps * segundos);
    if (valor <= r.incerteza) r.avisos.push(`A diferença entre os lados é menor que o erro de um quadro do vídeo (cerca de ${r.incerteza.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%): pode ser só a resolução do vídeo.`);
  }
  return r;
}

function construirSeries(modelo: ModeloGesto, trilha: TrilhaPose, direcao: 1 | -1, suavizacaoS: number): Record<string, AmostraAngulo[]> {
  const series: Record<string, AmostraAngulo[]> = {};
  const maxLacuna = Math.max(1, Math.round(0.25 * trilha.fps));
  for (const def of modelo.articulacoes) {
    const bruto = angulosPorQuadro(trilha, def, { direcao }).map((a) => a.graus);
    const cheio = preencherLacunas(bruto, maxLacuna);
    const suave = suavizacaoS > 0 ? suavizar(cheio, janelaEmAmostras(suavizacaoS, trilha.fps), { metodo: 'savitzky_golay', ordem: 2 }) : cheio;
    series[def.id] = trilha.quadros.map((q, i) => ({ t: q.t, graus: suave[i] }));
  }
  return series;
}

const grausDe = (series: Record<string, AmostraAngulo[]>, id: string): (number | null)[] => (series[id] ?? []).map((a) => a.graus);

/** Um ciclo completo de um pé: quadros (c0, c1, saida) para fatiar as séries e instantes (t0, t1, ts) para os tempos. */
interface Ciclo { lado: Lado; c0: number; c1: number; saida: number | null; t0: number; t1: number; ts: number | null; f0: number }

function ciclosDoLado(eventos: EventoPasso[], trilha: TrilhaPose, lado: Lado, min: number, max: number): Ciclo[] {
  const contatos = eventosDo(eventos, lado, 'contato');
  const saidas = eventosDo(eventos, lado, 'saida');
  const ciclos: Ciclo[] = [];
  for (let k = 0; k + 1 < contatos.length; k++) {
    const a = contatos[k], b = contatos[k + 1];
    const dur = tempoDoEvento(b) - tempoDoEvento(a);
    if (dur < min || dur > max) continue;
    const s = saidas.find((e) => e.i > a.i && e.i < b.i);
    ciclos.push({ lado, c0: a.i, c1: b.i, saida: s ? s.i : null, t0: tempoDoEvento(a), t1: tempoDoEvento(b), ts: s ? tempoDoEvento(s) : null, f0: (tempoDoEvento(a) - trilha.quadros[0].t) * trilha.fps });
  }
  return ciclos;
}

/** Valor da série num índice fracionário (interpolação linear entre os dois quadros vizinhos); null se algum deles não tiver valor. */
function amostrar(serie: (number | null)[], indice: number): number | null {
  const a = Math.floor(indice), b = Math.ceil(indice);
  const va = serie[a], vb = serie[b];
  if (typeof va !== 'number' || typeof vb !== 'number') return null;
  return a === b ? va : va + (vb - va) * (indice - a);
}

/** Quanto a série muda de um quadro para o vizinho em torno de cada índice: o erro de um valor lido num evento marcado com 1 quadro de incerteza. */
function variacaoPorQuadro(serie: (number | null)[], indices: number[]): number | undefined {
  const v = indices.map((i) => {
    const m = serie[i], a = serie[i - 1], d = serie[i + 1];
    if (typeof m !== 'number') return null;
    const passos = [a, d].filter((x): x is number => typeof x === 'number').map((x) => Math.abs(x - m));
    return passos.length ? Math.max(...passos) : null;
  }).filter((x): x is number => x !== null);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : undefined;
}

const faixa = (serie: (number | null)[], de: number, ate: number): (number | null)[] => serie.slice(Math.max(0, de), Math.min(serie.length - 1, ate) + 1);

/** Extremo (máximo ou mínimo) das amostras válidas de um trecho; exige 70% de amostras válidas. */
function extremoNoTrecho(serie: (number | null)[], de: number, ate: number, tipo: 'max' | 'min' | 'faixa'): number | null {
  const trecho = faixa(serie, de, ate);
  const v = validos(trecho);
  if (!v.length || v.length < trecho.length * 0.7) return null;
  if (tipo === 'max') return Math.max(...v);
  if (tipo === 'min') return Math.min(...v);
  return Math.max(...v) - Math.min(...v);
}

function pontoDoPe(trilha: TrilhaPose, i: number, lado: Lado) {
  const q = trilha.quadros[i];
  return pontoDoQuadro(q, `calcanhar_${sfx(lado)}`) ?? pontoDoQuadro(q, `tornozelo_${sfx(lado)}`);
}

const PASSADA_MARCHA = { min: 0.6, max: 2.5 };
const PASSADA_CORRIDA = { min: 0.3, max: 1.6 };

function metricasLocomocao(trilha: TrilhaPose, eventos: EventoPasso[], series: Record<string, AmostraAngulo[]>, ctx: ContextoMetricas, direcao: 1 | -1, corrida: boolean): { metricas: ResultadoMetrica[]; avisos: string[] } {
  const avisos: string[] = [];
  const out: ResultadoMetrica[] = [];
  const quadroMs = 1000 / trilha.fps;
  const lim = corrida ? PASSADA_CORRIDA : PASSADA_MARCHA;
  const ciclos: Record<Lado, Ciclo[]> = { D: ciclosDoLado(eventos, trilha, 'D', lim.min, lim.max), E: ciclosDoLado(eventos, trilha, 'E', lim.min, lim.max) };

  if (!eventos.some((e) => e.tipo === 'contato')) avisos.push('Não achei contatos do pé no chão: os tempos do ciclo ficam sem valor. Marque-os no quadro a quadro.');
  else if (ciclos.D.length + ciclos.E.length < 3) avisos.push('Poucos ciclos completos: os valores ficam instáveis. Grave mais passos ou confira os eventos.');
  if (corrida && trilha.fps < 120) {
    avisos.push(`Com ${Math.round(trilha.fps)} quadros/s cada quadro vale cerca de ${Math.round(quadroMs)} ms de erro nos tempos de contato e de voo. Souza (2016; PMID 26616185) cita câmeras com taxas maiores (por exemplo, ≥120 Hz) como mais adequadas à corrida: grave em câmera lenta, se o celular permitir.`);
  }

  // cadência: mediana dos intervalos entre contatos consecutivos (os dois pés); com um pé só, a passada vale dois passos
  const contatos = eventos.filter((e) => e.tipo === 'contato').sort((a, b) => a.i - b.i);
  const intervalos: number[] = [];
  for (let k = 0; k + 1 < contatos.length; k++) {
    const dt = tempoDoEvento(contatos[k + 1]) - tempoDoEvento(contatos[k]);
    if (contatos[k].lado !== contatos[k + 1].lado && dt >= 0.12 && dt <= 1.5) intervalos.push(dt);
  }
  const passadas = [...ciclos.D, ...ciclos.E].map((c) => c.t1 - c.t0);
  let cadencia: number | null = null;
  let cadenciasPorPasso: number[] = [];
  let origemCadencia = '';
  if (intervalos.length >= 2) {
    cadencia = 60 / (mediana(intervalos) as number);
    cadenciasPorPasso = intervalos.map((x) => 60 / x);
    origemCadencia = 'mediana dos intervalos entre contatos consecutivos dos dois pés';
  } else if (passadas.length >= 2) {
    cadencia = 120 / (mediana(passadas) as number);
    cadenciasPorPasso = passadas.map((x) => 120 / x);
    origemCadencia = 'mediana do tempo da passada de um pé (uma passada = 2 passos)';
  }
  const estCad = estatisticas(cadenciasPorPasso);
  out.push(resultado('cadencia', 'Cadência', 'passos/min', null, cadencia, {
    n: cadenciasPorPasso.length, ...(estCad.dp !== null ? { dp: estCad.dp } : {}),
    formula: 'cadência = 60 ÷ mediana do intervalo entre contatos consecutivos (s)', detalhe: origemCadencia ? `Calculada pela ${origemCadencia}.` : undefined,
  }));

  const porLado = <T,>(f: (l: Lado) => T): Record<Lado, T> => ({ D: f('D'), E: f('E') });

  // tempo da passada
  const tempoPassada = porLado((l) => media('tempo_passada', 'Tempo da passada', 's', l, ciclos[l].map((c) => c.t1 - c.t0), { incerteza: 1 / trilha.fps, formula: 'contato do pé até o próximo contato do mesmo pé' }));
  out.push(tempoPassada.D, tempoPassada.E);

  if (!corrida) {
    // tempo do passo: contato de um pé até o contato do outro
    const passo: Record<Lado, number[]> = { D: [], E: [] };
    for (let k = 0; k + 1 < contatos.length; k++) {
      const a = contatos[k], b = contatos[k + 1];
      const dt = tempoDoEvento(b) - tempoDoEvento(a);
      if (a.lado !== b.lado && dt >= 0.2 && dt <= 1.5) passo[a.lado].push(dt);
    }
    const tp = porLado((l) => media('tempo_passo', 'Tempo do passo', 's', l, passo[l], { incerteza: 1 / trilha.fps, formula: 'contato deste pé até o contato do pé oposto' }));
    out.push(tp.D, tp.E);

    const apoio = porLado((l) => ciclos[l].filter((c) => c.ts !== null).map((c) => ({ ap: (c.ts as number) - c.t0, ciclo: c.t1 - c.t0 })));
    const tApoio = porLado((l) => media('tempo_apoio', 'Tempo de apoio', 's', l, apoio[l].map((x) => x.ap), { incerteza: 1 / trilha.fps, formula: 'contato do pé até a saída do mesmo pé' }));
    const pApoio = porLado((l) => media('apoio_pct', 'Apoio (% do ciclo)', '% do ciclo', l, apoio[l].map((x) => (x.ap / x.ciclo) * 100), { formula: 'tempo de apoio ÷ tempo da passada × 100' }));
    const tBal = porLado((l) => media('tempo_balanco', 'Tempo de balanço', 's', l, apoio[l].map((x) => x.ciclo - x.ap), { incerteza: 1 / trilha.fps, formula: 'saída do pé até o próximo contato do mesmo pé' }));
    const pBal = porLado((l) => media('balanco_pct', 'Balanço (% do ciclo)', '% do ciclo', l, apoio[l].map((x) => (1 - x.ap / x.ciclo) * 100), { formula: 'tempo de balanço ÷ tempo da passada × 100' }));
    out.push(tApoio.D, tApoio.E, pApoio.D, pApoio.E, tBal.D, tBal.E, pBal.D, pBal.E);

    const pico = porLado((l) => media('flexao_joelho_pico_balanco', 'Pico de flexão do joelho no balanço', '°', l,
      ciclos[l].map((c) => extremoNoTrecho(grausDe(series, `joelho_${sfx(l)}`), c.saida ?? Math.round(c.c0 + (c.c1 - c.c0) * 0.5), c.c1, 'max')).filter((v): v is number => v !== null),
      { formula: 'maior flexão do joelho entre a saída do pé e o contato seguinte' }));
    out.push(pico.D, pico.E);

    out.push(assimetria('assimetria_tempo_passo', 'Assimetria do tempo de passo (D×E)', out.find((r) => r.id === 'tempo_passo_d'), out.find((r) => r.id === 'tempo_passo_e'), 'Tempo do passo', trilha.fps));
    out.push(assimetria('assimetria_tempo_apoio', 'Assimetria do tempo de apoio (D×E)', tApoio.D, tApoio.E, 'Tempo de apoio', trilha.fps));
  } else {
    const cont = porLado((l) => ciclos[l].filter((c) => c.ts !== null).map((c) => ((c.ts as number) - c.t0) * 1000));
    const tc = porLado((l) => media('tempo_contato', 'Tempo de contato', 'ms', l, cont[l], { incerteza: quadroMs, formula: 'contato do pé até a saída do mesmo pé' }));
    out.push(tc.D, tc.E);

    const voos: number[] = [];
    for (const l of LADOS) {
      const outros = eventosDo(eventos, l === 'D' ? 'E' : 'D', 'contato');
      for (const c of ciclos[l]) {
        if (c.saida === null || c.ts === null) continue;
        const prox = outros.find((e) => e.i > (c.saida as number));
        const dt = prox ? (tempoDoEvento(prox) - c.ts) * 1000 : null;
        if (dt !== null && dt >= 0 && dt < 600) voos.push(dt);
      }
    }
    out.push(media('tempo_voo', 'Tempo de voo', 'ms', null, voos, { incerteza: quadroMs, formula: 'saída de um pé até o contato do pé oposto', detalhe: 'Instantes em que nenhum pé toca o chão.' }));

    const noContato = (id: string, l: Lado | null, extra: Partial<ResultadoMetrica>, metrica: string, nome: string, formula: string) => {
      const serie = grausDe(series, id);
      const ciclosDe = l ? ciclos[l] : [...ciclos.D, ...ciclos.E];
      const obs = ciclosDe.map((c) => amostrar(serie, c.f0)).filter((x): x is number => x !== null);
      const incerteza = variacaoPorQuadro(serie, ciclosDe.map((c) => c.c0));
      return media(metrica, nome, '°', l, obs, { formula, ...(incerteza !== undefined ? { incerteza } : {}), ...extra });
    };
    const cj = porLado((l) => noContato(`joelho_${sfx(l)}`, l, { detalhe: 'O valor muda depressa perto do contato: a incerteza é quanto ele varia de um quadro para o vizinho.' },
      'flexao_joelho_contato', 'Flexão do joelho no contato', 'flexão do joelho no instante do contato'));
    const pj = porLado((l) => media('flexao_joelho_pico_apoio', 'Pico de flexão do joelho no apoio', '°', l,
      ciclos[l].filter((c) => c.saida !== null).map((c) => extremoNoTrecho(grausDe(series, `joelho_${sfx(l)}`), c.c0, c.saida as number, 'max')).filter((v): v is number => v !== null),
      { formula: 'maior flexão do joelho entre o contato e a saída do pé' }));
    const tib = porLado((l) => noContato(`tibia_${sfx(l)}`, l, {},
      'angulo_tibia_contato', 'Ângulo da tíbia no contato', 'inclinação da perna (joelho → tornozelo) com a vertical no instante do contato; positivo = tornozelo à frente do joelho'));
    out.push(cj.D, cj.E, pj.D, pj.E, tib.D, tib.E);

    out.push(noContato('tronco', null, {}, 'inclinacao_tronco_contato', 'Inclinação do tronco no contato', 'inclinação do tronco com a vertical nos instantes de contato; positivo = para a frente'));

    out.push(assimetria('assimetria_tempo_contato', 'Assimetria do tempo de contato (D×E)', tc.D, tc.E, 'Tempo de contato', trilha.fps));
  }

  // amplitudes articulares por ciclo (média) ou, sem ciclos, da série inteira
  const juntas = corrida ? ['quadril', 'joelho'] : ['quadril', 'joelho', 'tornozelo'];
  for (const j of juntas) {
    const nomeJ = `Amplitude do ${j}`;
    const res = porLado((l) => {
      const serie = grausDe(series, `${j}_${sfx(l)}`);
      const porCiclo = ciclos[l].map((c) => extremoNoTrecho(serie, c.c0, c.c1, 'faixa')).filter((v): v is number => v !== null);
      if (porCiclo.length) return media(`adm_${j}`, nomeJ, '°', l, porCiclo, { formula: 'maior − menor ângulo dentro de cada ciclo; média dos ciclos' });
      const v = validos(serie);
      const r = resultado(`adm_${j}`, nomeJ, '°', l, v.length >= 3 ? Math.max(...v) - Math.min(...v) : null, { n: v.length, formula: 'maior − menor ângulo do vídeo inteiro (sem ciclos completos)' });
      if (r.valor !== null) r.avisos.push('Sem ciclos completos: a amplitude vem do vídeo inteiro.');
      return r;
    });
    out.push(res.D, res.E);
  }
  const admJoelho = (l: Lado) => out.find((r) => r.id === `adm_joelho_${sfx(l)}`);
  out.push(assimetria('assimetria_adm_joelho', 'Assimetria da amplitude do joelho (D×E)', admJoelho('D'), admJoelho('E'), 'Amplitude do joelho'));

  const tronco = validos(grausDe(series, 'tronco'));
  out.push(media('inclinacao_tronco', 'Inclinação do tronco', '°', null, tronco, { formula: 'média da inclinação do tronco (quadril → ombro) com a vertical; positivo = para a frente' }));

  // comprimentos e velocidade (precisam da escala)
  const esc = ctx.escalaCmPorPx && ctx.escalaCmPorPx > 0 ? ctx.escalaCmPorPx : null;
  const faltaEscala = 'Informe a escala (cm) para calcular.';
  const stridePorLado: Record<Lado, number[]> = { D: [], E: [] };
  if (!corrida) {
    const passoCm = porLado((l) => {
      const outro: Lado = l === 'D' ? 'E' : 'D';
      const obs = esc
        ? eventosDo(eventos, l, 'contato').map((c) => {
          const a = pontoDoPe(trilha, c.i, l), b = pontoDoPe(trilha, c.i, outro);
          return a && b ? direcao * (a.x - b.x) * esc : null;
        }).filter((v): v is number => v !== null && v > 0)
        : [];
      const r = media('comprimento_passo', 'Comprimento do passo', 'cm', l, obs, { formula: 'distância horizontal entre os calcanhares no contato deste pé' });
      if (!esc) r.avisos.push(faltaEscala);
      return r;
    });
    out.push(passoCm.D, passoCm.E);
    const passada = passoCm.D.valor !== null && passoCm.E.valor !== null ? passoCm.D.valor + passoCm.E.valor : null;
    const rp = resultado('comprimento_passada', 'Comprimento da passada', 'cm', null, passada, { formula: 'passo direito + passo esquerdo' });
    if (!esc) rp.avisos.push(faltaEscala);
    out.push(rp);
    const tpass = validos([tempoPassada.D.valor, tempoPassada.E.valor]);
    const vel = passada !== null && tpass.length ? passada / (tpass.reduce((s, v) => s + v, 0) / tpass.length) : null;
    const rv = resultado('velocidade_marcha', 'Velocidade estimada', 'cm/s', null, vel, {
      formula: 'comprimento da passada ÷ tempo da passada',
      detalhe: 'Estimativa a partir de passada e tempo; a câmera precisa ficar perpendicular à direção da marcha.',
    });
    if (!esc) rv.avisos.push(faltaEscala);
    out.push(rv);
  } else {
    for (const l of LADOS) {
      if (esc && ctx.cameraFixa) {
        for (const c of ciclos[l]) {
          const a = pontoDoPe(trilha, c.c0, l), b = pontoDoPe(trilha, c.c1, l);
          if (a && b) {
            const cm = direcao * (b.x - a.x) * esc;
            if (cm > 0) stridePorLado[l].push(cm);
          }
        }
      }
    }
    const todas = [...stridePorLado.D, ...stridePorLado.E];
    const rp = media('comprimento_passada', 'Comprimento da passada', 'cm', null, todas, { formula: 'deslocamento horizontal do calcanhar entre dois contatos do mesmo pé (câmera parada)' });
    if (!esc) rp.avisos.push(faltaEscala);
    else if (!ctx.cameraFixa) rp.avisos.push('Só vale com a câmera parada e o corredor atravessando o quadro (não em esteira nem com câmera que acompanha).');
    out.push(rp);
    const tpass = validos([tempoPassada.D.valor, tempoPassada.E.valor]);
    const vel = rp.valor !== null && tpass.length ? rp.valor / (tpass.reduce((s, v) => s + v, 0) / tpass.length) : null;
    const rv = resultado('velocidade_corrida', 'Velocidade estimada', 'cm/s', null, vel, { formula: 'comprimento da passada ÷ tempo da passada' });
    if (rp.avisos.length) rv.avisos.push(...rp.avisos);
    out.push(rv);
  }

  return { metricas: out, avisos };
}

/** Quadros dos picos das repetições: máximos proeminentes da série (agachamento: flexão do joelho; ombro: elevação). */
function picosDeRepeticao(serie: (number | null)[], fps: number, distMinS: number): number[] {
  const v = validos(serie);
  if (v.length < 5) return [];
  const amplitude = percentil(v, 0.95) - percentil(v, 0.05);
  const proeminencia = Math.max(20, amplitude * 0.4);
  if (amplitude < 20) return [];
  return extremosLocais(serie, 'max', Math.max(3, Math.round(distMinS * fps)), proeminencia, Math.round(distMinS * fps * 1.5));
}

const mediaDeLados = (a: (number | null)[], b: (number | null)[]): (number | null)[] =>
  a.map((x, i) => {
    const y = b[i];
    const ok = [x, y].filter((n): n is number => typeof n === 'number');
    return ok.length ? ok.reduce((s, n) => s + n, 0) / ok.length : null;
  });

function metricasAgachamento(trilha: TrilhaPose, series: Record<string, AmostraAngulo[]>): { metricas: ResultadoMetrica[]; avisos: string[]; picos: number[] } {
  const avisos: string[] = [];
  const out: ResultadoMetrica[] = [];
  const referencia = mediaDeLados(grausDe(series, 'joelho_d'), grausDe(series, 'joelho_e'));
  const picos = picosDeRepeticao(referencia, trilha.fps, 0.8);
  out.push(resultado('repeticoes', 'Repetições', '', null, picos.length, { formula: 'picos de flexão do joelho com amplitude mínima de 20°', detalhe: picos.length ? undefined : 'Nenhuma repetição clara: confira se o agachamento aparece inteiro no vídeo.' }));
  const intervalos = picos.slice(1).map((p, k) => trilha.quadros[p].t - trilha.quadros[picos[k]].t);
  out.push(media('tempo_repeticao', 'Tempo por repetição', 's', null, intervalos, { incerteza: 1 / trilha.fps, formula: 'intervalo entre dois fundos consecutivos do agachamento' }));

  const nosPicos = (serie: (number | null)[]) => {
    const v = picos.map((p) => serie[p]).filter((x): x is number => typeof x === 'number');
    if (v.length) return v;
    const todos = validos(serie);
    return todos.length ? [Math.max(...todos)] : [];
  };
  for (const [metrica, nome, id] of [['flexao_joelho_max', 'Flexão máxima do joelho', 'joelho'], ['flexao_quadril_max', 'Flexão máxima do quadril', 'quadril'], ['dorsiflexao_max', 'Dorsiflexão máxima do tornozelo', 'tornozelo']] as const) {
    for (const l of LADOS) out.push(media(metrica, nome, '°', l, nosPicos(grausDe(series, `${id}_${sfx(l)}`)), { formula: picos.length ? 'valor no fundo de cada repetição; média das repetições' : 'maior valor do vídeo' }));
  }
  out.push(media('inclinacao_tronco_max', 'Inclinação máxima do tronco', '°', null, nosPicos(grausDe(series, 'tronco')), { formula: 'inclinação do tronco com a vertical no fundo de cada repetição; positivo = para a frente' }));

  const prof: number[] = [];
  for (const p of picos) {
    for (const l of LADOS) {
      const q = trilha.quadros[p];
      const q0 = pontoDoQuadro(q, `quadril_${sfx(l)}`), j = pontoDoQuadro(q, `joelho_${sfx(l)}`);
      if (q0 && j) {
        const coxa = Math.hypot(q0.x - j.x, q0.y - j.y);
        if (coxa > 0) prof.push(((q0.y - j.y) / coxa) * 100);
      }
    }
  }
  out.push(media('profundidade_quadril', 'Profundidade (quadril em relação ao joelho)', '% da coxa', null, prof, {
    formula: '(altura do quadril − altura do joelho) ÷ comprimento da coxa × 100, no fundo; 0 = coxa horizontal, positivo = quadril abaixo do joelho',
  }));

  for (const l of LADOS) {
    const serie = grausDe(series, `joelho_${sfx(l)}`);
    const v = validos(serie);
    out.push(resultado('adm_joelho', 'Amplitude do joelho', '°', l, v.length >= 3 ? Math.max(...v) - Math.min(...v) : null, { n: v.length, formula: 'maior − menor flexão do joelho no vídeo' }));
  }
  if (!picos.length) avisos.push('Não achei repetições do agachamento: os valores máximos vêm do vídeo inteiro.');
  return { metricas: out, avisos, picos };
}

/** Quadro do contato da aterrissagem: primeiro retorno dos tornozelos ao chão depois de estarem no ar. */
export function detectarAterrissagem(trilha: TrilhaPose): number | null {
  const bruto = trilha.quadros.map((q) => {
    const ys = ['tornozelo_d', 'tornozelo_e'].map((n) => pontoDoQuadro(q, n)?.y).filter((v): v is number => typeof v === 'number');
    return ys.length ? ys.reduce((s, v) => s + v, 0) / ys.length : null;
  });
  const y = suavizar(preencherLacunas(bruto, Math.max(1, Math.round(0.25 * trilha.fps))), janelaEmAmostras(0.1, trilha.fps), { metodo: 'media_movel' });
  const v = validos(y);
  if (v.length < 5) return null;
  const chao = percentil(v, 0.9), topo = Math.min(...v);
  const alcance = chao - topo;
  if (alcance < 0.04 * trilha.altura) return null;
  let f0 = -1;
  for (let i = 0; i < y.length; i++) {
    if (y[i] !== null && (y[i] as number) < chao - 0.25 * alcance) { f0 = i; break; }
  }
  if (f0 < 0) return null;
  for (let i = f0 + 1; i < y.length; i++) {
    if (y[i] !== null && (y[i] as number) >= chao - 0.1 * alcance) return i;
  }
  return null;
}

const JANELA_ATERRISSAGEM_S = 0.5;

function metricasSalto(trilha: TrilhaPose, series: Record<string, AmostraAngulo[]>): { metricas: ResultadoMetrica[]; avisos: string[]; contato: number | null; razao: SerieRazao[] } {
  const avisos: string[] = [];
  const out: ResultadoMetrica[] = [];
  const contato = detectarAterrissagem(trilha);

  const brutos = trilha.quadros.map((q) => {
    const jd = pontoDoQuadro(q, 'joelho_d'), je = pontoDoQuadro(q, 'joelho_e'), td = pontoDoQuadro(q, 'tornozelo_d'), te = pontoDoQuadro(q, 'tornozelo_e');
    if (!jd || !je || !td || !te) return null;
    const ankle = Math.abs(td.x - te.x);
    return ankle > 1 ? Math.abs(jd.x - je.x) / ankle : null;
  });
  const lisa = suavizar(preencherLacunas(brutos, Math.max(1, Math.round(0.25 * trilha.fps))), janelaEmAmostras(0.12, trilha.fps), { metodo: 'savitzky_golay', ordem: 2 });
  const razao = trilha.quadros.map((q, i): SerieRazao => ({ t: q.t, valor: lisa[i] }));

  if (contato === null) {
    avisos.push('Não achei a aterrissagem (os pés saindo e voltando ao chão): as medidas da aterrissagem ficam sem valor.');
    for (const l of LADOS) {
      out.push(resultado('valgo_contato', 'Desvio do joelho no contato', '°', l, null));
      out.push(resultado('valgo_max', 'Desvio máximo do joelho na aterrissagem', '°', l, null));
    }
    out.push(resultado('kasr_contato', 'Razão joelho/tornozelo no contato', 'razão', null, null));
    out.push(resultado('kasr_min', 'Menor razão joelho/tornozelo na aterrissagem', 'razão', null, null));
    return { metricas: out, avisos, contato, razao };
  }

  const fim = Math.min(trilha.quadros.length - 1, contato + Math.round(JANELA_ATERRISSAGEM_S * trilha.fps));
  for (const l of LADOS) {
    const serie = grausDe(series, `valgo_${sfx(l)}`);
    out.push(resultado('valgo_contato', 'Desvio do joelho no contato', '°', l, serie[contato] ?? null, {
      formula: 'desvio do joelho em relação à reta quadril–tornozelo no quadro do contato; positivo = para dentro (valgo)', detalhe: 'Projeção 2D no plano frontal.',
    }));
    const janela = validos(faixa(serie, contato, fim));
    out.push(resultado('valgo_max', 'Desvio máximo do joelho na aterrissagem', '°', l, janela.length ? Math.max(...janela) : null, {
      formula: `maior desvio para dentro nos ${JANELA_ATERRISSAGEM_S.toLocaleString('pt-BR')} s seguintes ao contato`, detalhe: 'Projeção 2D no plano frontal.',
    }));
  }
  const janelaRazao = validos(faixa(lisa, contato, fim));
  out.push(resultado('kasr_contato', 'Razão joelho/tornozelo no contato', 'razão', null, lisa[contato] ?? null, {
    formula: 'distância horizontal entre os joelhos ÷ distância horizontal entre os tornozelos', detalhe: '1 = joelhos tão separados quanto os tornozelos; menor que 1 = joelhos mais próximos que os pés.',
  }));
  out.push(resultado('kasr_min', 'Menor razão joelho/tornozelo na aterrissagem', 'razão', null, janelaRazao.length ? Math.min(...janelaRazao) : null, {
    formula: `menor razão joelho/tornozelo nos ${JANELA_ATERRISSAGEM_S.toLocaleString('pt-BR')} s seguintes ao contato`,
  }));
  return { metricas: out, avisos, contato, razao };
}

function metricasOmbro(trilha: TrilhaPose, series: Record<string, AmostraAngulo[]>): { metricas: ResultadoMetrica[]; avisos: string[]; picos: number[] } {
  const avisos: string[] = [];
  const out: ResultadoMetrica[] = [];
  const combinada = mediaDeLados(grausDe(series, 'elevacao_d'), grausDe(series, 'elevacao_e'));
  const picos = picosDeRepeticao(combinada, trilha.fps, 1);
  const meia = Math.max(2, Math.round(trilha.fps * 0.5));

  const maxPorRepeticao = (serie: (number | null)[]): number[] => {
    if (!picos.length) {
      const v = validos(serie);
      return v.length ? [Math.max(...v)] : [];
    }
    return picos.map((p) => extremoNoTrecho(serie, p - meia, p + meia, 'max')).filter((x): x is number => x !== null);
  };

  const emax = { D: media('elevacao_max', 'Elevação máxima do braço', '°', 'D', maxPorRepeticao(grausDe(series, 'elevacao_d')), { formula: picos.length ? 'maior elevação em cada repetição; média das repetições' : 'maior elevação do vídeo' }), E: media('elevacao_max', 'Elevação máxima do braço', '°', 'E', maxPorRepeticao(grausDe(series, 'elevacao_e')), { formula: picos.length ? 'maior elevação em cada repetição; média das repetições' : 'maior elevação do vídeo' }) };
  out.push(emax.D, emax.E);
  for (const l of LADOS) out.push(media('elevacao_tronco_max', 'Elevação máxima em relação ao tronco', '°', l, maxPorRepeticao(grausDe(series, `elevacao_tronco_${sfx(l)}`)), { formula: 'maior ângulo entre o braço e o tronco; média das repetições' }));

  const tempos: number[] = [];
  picos.forEach((p, k) => {
    const de = k > 0 ? picos[k - 1] : 0;
    let repouso = -1;
    for (let i = de; i <= p; i++) {
      const v = combinada[i];
      if (v !== null && (repouso < 0 || v < (combinada[repouso] as number))) repouso = i;
    }
    if (repouso >= 0 && repouso < p) tempos.push(trilha.quadros[p].t - trilha.quadros[repouso].t);
  });
  out.push(media('tempo_ate_pico', 'Tempo até o pico', 's', null, tempos, { incerteza: 1 / trilha.fps, formula: 'do ponto mais baixo anterior até o pico de cada repetição' }));
  out.push(assimetria('assimetria_elevacao', 'Assimetria da elevação máxima (D×E)', emax.D, emax.E, 'Elevação máxima'));

  const lateral = grausDe(series, 'tronco_lateral');
  const desvios: number[] = [];
  picos.forEach((p, k) => {
    const de = k > 0 ? picos[k - 1] : 0;
    let repouso = -1;
    for (let i = de; i <= p; i++) {
      const v = combinada[i];
      if (v !== null && (repouso < 0 || v < (combinada[repouso] as number))) repouso = i;
    }
    const a = lateral[p], b = repouso >= 0 ? lateral[repouso] : null;
    if (typeof a === 'number' && typeof b === 'number') desvios.push(a - b);
  });
  out.push(media('compensacao_tronco', 'Compensação do tronco', '°', null, desvios, {
    formula: 'inclinação lateral do tronco no pico − inclinação no ponto mais baixo anterior; positivo = para a direita da imagem',
  }));

  if (!picos.length) avisos.push('Não achei repetições da elevação: os valores máximos vêm do vídeo inteiro.');
  return { metricas: out, avisos, picos };
}

/**
 * Análise completa de um gesto sobre a trilha: eventos, séries de ângulos suavizadas e métricas.
 * A trilha original nunca é alterada; cada correção do profissional gera uma nova trilha e basta chamar de novo.
 */
export function analisarGesto(gesto: IdGesto | ModeloGesto, trilha: TrilhaPose, ctx: ContextoMetricas = {}): AnaliseGesto {
  const modelo = typeof gesto === 'string' ? modeloDoGesto(gesto) : gesto;
  const direcao = ctx.direcao ?? estimarDirecao(trilha);
  const series = construirSeries(modelo, trilha, direcao, ctx.suavizacaoS ?? (modelo.id === 'corrida' ? JANELA_SUAVE_CORRIDA_S : JANELA_SUAVE_S));
  const avisos: string[] = [];
  if (trilha.quadros.length && deteccaoPct(trilha) < 70) {
    avisos.push(`O corpo foi detectado de forma confiável em ${Math.round(deteccaoPct(trilha))}% dos quadros: confira a gravação (corpo inteiro, luz, roupa justa) e corrija os pontos.`);
  }

  let eventos: EventoPasso[] = [];
  let metricas: ResultadoMetrica[] = [];
  let razoes: Record<string, SerieRazao[]> = {};
  let aterrissagem: number | null = null;
  let repeticoes: number[] = [];

  if (modelo.id === 'marcha' || modelo.id === 'corrida') {
    eventos = ctx.eventos ?? (modelo.id === 'marcha' ? detectarEventosMarcha(trilha, { direcao }) : detectarEventosCorrida(trilha, { direcao }));
    const r = metricasLocomocao(trilha, eventos, series, ctx, direcao, modelo.id === 'corrida');
    metricas = r.metricas;
    avisos.push(...r.avisos);
  } else if (modelo.id === 'agachamento') {
    const r = metricasAgachamento(trilha, series);
    metricas = r.metricas; repeticoes = r.picos; avisos.push(...r.avisos);
  } else if (modelo.id === 'salto') {
    const r = metricasSalto(trilha, series);
    metricas = r.metricas; aterrissagem = r.contato; razoes = { kasr: r.razao }; avisos.push(...r.avisos);
  } else {
    const r = metricasOmbro(trilha, series);
    metricas = r.metricas; repeticoes = r.picos; avisos.push(...r.avisos);
  }

  const amplitudes: Record<string, AmplitudeArticular> = {};
  for (const [id, serie] of Object.entries(series)) {
    const a = amplitudeDaSerie(serie);
    if (a) amplitudes[id] = a;
  }

  return { modelo: modelo.id, direcao, eventos, series, amplitudes, razoes, aterrissagem, repeticoes, metricas, avisos };
}

/** Só as métricas, para quem não precisa das séries. */
export const calcularMetricas = (gesto: IdGesto | ModeloGesto, trilha: TrilhaPose, ctx: ContextoMetricas = {}): ResultadoMetrica[] => analisarGesto(gesto, trilha, ctx).metricas;
