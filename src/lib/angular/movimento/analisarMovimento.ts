import { angulosPorQuadro, type AmostraAngulo } from '../video/angulos';
import { janelaEmAmostras, suavizar } from '../video/suavizar';
import { detectarEventosMarcha, type EventoPasso } from '../video/eventos';
import type { Lado, TrilhaPose } from '../video/tipos';
import { deteccaoPct, estimarDirecao } from '../video/trilha';
import { detectarAchados } from './achados';
import { finito, percentil, resumir, validos } from './estatistica';
import { FATOR_COBERTURA, fpsEfetivo, incertezaAngularGeral, JANELA_SUAVIZACAO_S, processarSerie, quadroDaTrilha, type SerieProcessada } from './incerteza';
import { calcularMedidas, quadrosDeIncertezaDoTempo } from './medidasPorRepeticao';
import { DESCRICAO_INCERTEZA, formulaDaIncerteza, indisponiveisDoProtocolo, protocoloDo } from './protocolos';
import { marcarDuracoesDiscrepantes, repeticoesDaMarcha, repeticoesDoAgachamento, segmentarPicos } from './repeticoes';
import {
  brutoAlturaPelve, brutoAvanco, brutoDesvioPelve, brutoProfundidade, brutoQuadrilTornozelo, comoFonte, type Fonte,
} from './seriesDerivadas';
import type { AnaliseMovimento, ChaveLado, IdProtocolo, MedidaPorRepeticao, OpcoesAnalise, Protocolo, Repeticao } from './tipos';

/*
 * Motor da Etapa 3 (agente M): trilha de pose → repetições, medidas por repetição e por lado, resumos, incerteza do vídeo e achados.
 * Puro, determinístico, sem rede e sem modelo de linguagem. Mede e descreve; não treina, não dá nota e não diagnostica.
 *
 * Parâmetros de engenharia da segmentação (não são limites clínicos; `protocolo.segmentacao` descreve o método, e estes são os números):
 *  - agachamento de lado: amplitude mínima de 20° na flexão média do joelho, como o motor de métricas (metricas.ts);
 *  - agachamento de frente: descida mínima do ponto médio dos quadris de 6% da distância vertical quadril–tornozelo;
 *  - dois fundos distam pelo menos 0,8 s; início e fim por histerese (5% e 15% da amplitude, ver repeticoes.ts);
 *  - os marcos são localizados numa série com uma suavização extra de 0,3 s; as medidas são lidas na série suavizada normal.
 */

const AMPLITUDE_MIN_JOELHO_GRAUS = 20;
const DESCIDA_MIN_QUADRIL = 0.06;
const DIST_MIN_FUNDOS_S = 0.8;
const MIN_REPETICOES_COM_VALOR = 3;

const sfx = (l: Lado) => l.toLowerCase();

const trilhaVazia = (): TrilhaPose => ({ fps: 30, largura: 1, altura: 1, quadros: [] });

/**
 * Trilha com a estrutura que o motor lê: sem lista de quadros vira vazia, quadro sem pontos vira quadro sem pontos e taxa de quadros
 * implausível é trocada pela efetiva (com aviso). A trilha recebida não é alterada.
 */
function trilhaSegura(trilha: TrilhaPose | null | undefined): { trilha: TrilhaPose; avisos: string[] } {
  if (!trilha || !Array.isArray(trilha.quadros)) return { trilha: trilhaVazia(), avisos: [] };
  const integro = trilha.quadros.every((q) => !!q && typeof q === 'object' && !!q.pontos && typeof q.pontos === 'object');
  const { fps, declarada } = fpsEfetivo(trilha);
  if (integro && declarada) return { trilha, avisos: [] };
  return {
    trilha: {
      fps, largura: trilha.largura, altura: trilha.altura,
      quadros: integro ? trilha.quadros : trilha.quadros.map((q, i) => ({ i, t: q?.t as number, pontos: q && typeof q.pontos === 'object' && q.pontos ? q.pontos : {} })),
    },
    avisos: declarada ? [] : [`A taxa de quadros da trilha (${String(trilha.fps)}) não é plausível: usei ${Math.round(fps * 100) / 100} quadros/s, pelos tempos dos quadros.`],
  };
}

/** Janela, em segundos, da suavização extra usada só para localizar os marcos das repetições. */
const JANELA_MARCOS_S = 0.3;

/**
 * Série de referência para localizar início, fundo e fim: a suavizada mais uma passada de 0,3 s. O cruzamento de um nível numa série
 * ruidosa oscila de um quadro para o outro e faria a duração da repetição variar mais que o erro de um quadro; as medidas continuam
 * lidas na série suavizada normal.
 */
const paraMarcos = (serie: (number | null)[], fps: number): (number | null)[] => suavizar(serie, janelaEmAmostras(JANELA_MARCOS_S, fps), { metodo: 'savitzky_golay', ordem: 2 });

/** Média, quadro a quadro, das séries com valor (null quando nenhuma tem). */
function mediaDasSeries(series: (number | null)[][], n: number): (number | null)[] {
  return Array.from({ length: n }, (_, i) => {
    const v = series.map((s) => s[i]).filter(finito);
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
  });
}

function construirDeslocamentos(p: Protocolo, trilha: TrilhaPose, direcao: 1 | -1, fps: number, suavizacaoS: number): Record<string, Fonte> {
  const f: Record<string, Fonte> = {};
  const ids = new Set(p.medidas.map((m) => m.id));
  if (ids.has('avanco_joelho_fundo')) {
    for (const lado of ['D', 'E'] as const) f[`avanco_${sfx(lado)}`] = comoFonte(brutoAvanco(trilha, lado, direcao), fps, suavizacaoS);
  }
  if (ids.has('profundidade_quadril')) f.profundidade = comoFonte(brutoProfundidade(trilha), fps, suavizacaoS);
  if (ids.has('desvio_lateral_pelve_fundo')) f.desvio_pelve = comoFonte(brutoDesvioPelve(trilha), fps, suavizacaoS);
  if (ids.has('descida_pelve') || (p.gesto === 'agachamento' && p.planoFilmado === 'frontal')) {
    f.altura_pelve = comoFonte(brutoAlturaPelve(trilha), fps, suavizacaoS);
    f.quadril_tornozelo = comoFonte(brutoQuadrilTornozelo(trilha), fps, suavizacaoS);
  }
  return f;
}

interface Segmentacao { repeticoes: Repeticao[]; eventos: EventoPasso[]; avisos: string[] }

function segmentarAgachamentoLateral(tempos: readonly number[], angulos: Record<string, SerieProcessada>, fps: number): Segmentacao {
  const joelhos = ['joelho_d', 'joelho_e'].map((id) => angulos[id]).filter((s): s is SerieProcessada => !!s);
  const referencia = paraMarcos(mediaDasSeries(joelhos.map((s) => s.suave), tempos.length), fps);
  const ruido = (incertezaAngularGeral(joelhos.map((s) => s.u)) ?? 0) / FATOR_COBERTURA;
  const brutas = segmentarPicos(referencia, fps, { amplitudeMin: AMPLITUDE_MIN_JOELHO_GRAUS, proeminenciaMin: AMPLITUDE_MIN_JOELHO_GRAUS, distMinS: DIST_MIN_FUNDOS_S, ruido });
  const avisos: string[] = [];
  if (!brutas.length) {
    avisos.push(`Não identifiquei repetições do agachamento (é preciso um pico de flexão do joelho com pelo menos ${AMPLITUDE_MIN_JOELHO_GRAUS}° de amplitude): confira se o movimento aparece inteiro no trecho analisado.`);
  }
  return { repeticoes: repeticoesDoAgachamento(tempos, brutas), eventos: [], avisos };
}

function segmentarAgachamentoFrontal(trilha: TrilhaPose, tempos: readonly number[], desloc: Record<string, Fonte>, fps: number): Segmentacao {
  const altura = desloc.altura_pelve;
  const escalaVertical = percentil(validos(desloc.quadril_tornozelo?.bruto ?? []).filter((v) => v > 0), 0.9) ?? 0.45 * trilha.altura;
  const minimo = DESCIDA_MIN_QUADRIL * escalaVertical;
  const brutas = altura
    ? segmentarPicos(paraMarcos(altura.suave, fps), fps, { amplitudeMin: minimo, proeminenciaMin: minimo, distMinS: DIST_MIN_FUNDOS_S, ruido: (altura.u ?? 0) / FATOR_COBERTURA })
    : [];
  const avisos: string[] = [];
  if (!brutas.length) {
    avisos.push(`Não identifiquei repetições do agachamento (é preciso uma descida do ponto médio dos quadris de pelo menos ${Math.round(DESCIDA_MIN_QUADRIL * 100)}% da distância vertical quadril–tornozelo): confira se o corpo inteiro aparece de frente e se o movimento está no trecho analisado.`);
  }
  return { repeticoes: repeticoesDoAgachamento(tempos, brutas), eventos: [], avisos };
}

function segmentarMarcha(trilha: TrilhaPose, opcoes: OpcoesAnalise, direcao: 1 | -1): Segmentacao {
  const n = trilha.quadros.length;
  const recebidos = opcoes.eventos ?? detectarEventosMarcha(trilha, { direcao });
  const eventos = recebidos.filter((e) => Number.isInteger(e.i) && e.i >= 0 && e.i < n && finito(e.t));
  const avisos: string[] = [];
  if (eventos.length < recebidos.length) avisos.push(`${recebidos.length - eventos.length} evento(s) de contato ou saída do pé estavam fora do trecho analisado e foram ignorados.`);
  if (!eventos.some((e) => e.tipo === 'contato')) avisos.push('Não achei contatos do pé no chão: sem eles não há passadas. Marque os contatos e as saídas no quadro a quadro.');
  const r = repeticoesDaMarcha(eventos);
  if (r.ignoradas) avisos.push(`${r.ignoradas} intervalo(s) entre contatos do mesmo pé fora de 0,6 a 2,5 s foram ignorados (provável contato perdido ou pausa): confira os eventos.`);
  if (r.semSaida) avisos.push(`${r.semSaida} passada(s) sem a saída do pé marcada ficaram sem medidas: marque a saída do pé no quadro a quadro.`);
  return { repeticoes: r.repeticoes, eventos, avisos };
}

function contarPorLado(repeticoes: Repeticao[]): Record<Lado, number> {
  const c: Record<Lado, number> = { D: 0, E: 0 };
  for (const r of repeticoes) if (r.lado && !r.sinalizadores.includes('incompleta')) c[r.lado]++;
  return c;
}

function analisar(p: Protocolo, trilha: TrilhaPose, opcoes: OpcoesAnalise): AnaliseMovimento {
  const quadros = trilha.quadros;
  const quadroS = quadroDaTrilha(trilha);
  const fps = 1 / quadroS;
  const tempos = quadros.map((q, i) => (finito(q.t) ? q.t : i * quadroS));
  const direcao = opcoes.direcao ?? (quadros.length ? estimarDirecao(trilha) : 1);
  const suavizacaoS = finito(opcoes.suavizacaoS) && opcoes.suavizacaoS >= 0 ? opcoes.suavizacaoS : JANELA_SUAVIZACAO_S;
  const avisos: string[] = [];

  if (!quadros.length) avisos.push('A trilha não tem quadros: não há o que analisar.');
  else if (deteccaoPct(trilha) < 70) {
    avisos.push(`O corpo foi detectado de forma confiável em ${Math.round(deteccaoPct(trilha))}% dos quadros: confira a gravação (corpo inteiro, luz, roupa justa) e corrija os pontos.`);
  }
  if (suavizacaoS === 0) avisos.push(`Suavização desligada: as medidas usam a série bruta e a incerteza vem do resíduo contra uma suavização de ${JANELA_SUAVIZACAO_S.toString().replace('.', ',')} s.`);

  const angulos: Record<string, SerieProcessada> = {};
  for (const def of p.articulacoes) {
    angulos[def.id] = processarSerie(angulosPorQuadro(trilha, def, { direcao }).map((a) => a.graus), fps, suavizacaoS);
  }
  const deslocamentos = construirDeslocamentos(p, trilha, direcao, fps, suavizacaoS);

  let seg: Segmentacao;
  if (!quadros.length) seg = { repeticoes: [], eventos: [], avisos: [] };
  else if (p.gesto === 'marcha') seg = segmentarMarcha(trilha, opcoes, direcao);
  else if (p.planoFilmado === 'frontal') seg = segmentarAgachamentoFrontal(trilha, tempos, deslocamentos, fps);
  else seg = segmentarAgachamentoLateral(tempos, angulos, fps);
  const { repeticoes, eventos } = seg;
  avisos.push(...seg.avisos);
  marcarDuracoesDiscrepantes(repeticoes, quadrosDeIncertezaDoTempo(p) * quadroS);

  const { medidas, resumos, refsPx, comPontosAusentes } = calcularMedidas({ protocolo: p, repeticoes, angulos, deslocamentos, quadroS });
  for (const i of comPontosAusentes) {
    const r = repeticoes[i];
    if (r && !r.sinalizadores.includes('pontos_ausentes')) r.sinalizadores.push('pontos_ausentes');
  }

  const rotulo = p.rotuloRepeticao;
  const completas = repeticoes.filter((r) => !r.sinalizadores.includes('incompleta'));
  if (repeticoes.length - completas.length > 0) {
    const k = repeticoes.length - completas.length;
    avisos.push(`${k} ${k === 1 ? rotulo.singular + ' incompleta ficou' : rotulo.plural + ' incompletas ficaram'} na lista sem medidas: o movimento toca a ponta do trecho analisado ou falta o evento que o fecha.`);
  }
  if (p.gesto === 'marcha') {
    const por = contarPorLado(repeticoes);
    if (completas.length && (por.D < MIN_REPETICOES_COM_VALOR || por.E < MIN_REPETICOES_COM_VALOR)) {
      avisos.push(`Há ${por.D} passada(s) completa(s) do pé direito e ${por.E} do esquerdo: a comparação entre os lados exige pelo menos ${MIN_REPETICOES_COM_VALOR} por pé (grave pelo menos 10 passos, 5 de cada pé).`);
    }
  } else if (completas.length > 0 && completas.length < MIN_REPETICOES_COM_VALOR) {
    avisos.push(`Foram identificadas ${completas.length} ${completas.length === 1 ? rotulo.singular : rotulo.plural} completa(s): com menos de ${MIN_REPETICOES_COM_VALOR}, a variação, a tendência e a comparação entre os lados não são calculadas.`);
  }

  const criterios = opcoes.criterios ?? [];
  const achados = detectarAchados({
    protocolo: p, repeticoes, medidas, resumos, refsPx, criterios,
    escalaCmPorPixel: finito(opcoes.escalaCmPorPixel) && opcoes.escalaCmPorPixel > 0 ? opcoes.escalaCmPorPixel : null,
  });

  const series: Record<string, AmostraAngulo[]> = {};
  for (const def of p.articulacoes) {
    series[def.id] = quadros.map((_, i) => ({ t: tempos[i], graus: angulos[def.id].suave[i] ?? null }));
  }
  const usadas = Object.values(angulos);

  return {
    protocolo: p.id,
    planoFilmado: p.planoFilmado,
    direcao,
    repeticoes,
    medidas,
    resumos,
    achados,
    indisponiveis: indisponiveisDoProtocolo(p),
    incerteza: {
      angularGraus: incertezaAngularGeral(usadas.map((s) => s.u)),
      quadroS,
      nAmostras: usadas.reduce((s, x) => s + x.nAmostras, 0),
      formula: formulaDaIncerteza(p),
      descricao: DESCRICAO_INCERTEZA,
    },
    series,
    eventos,
    avisos,
  };
}

/** Análise com a estrutura completa e nenhum valor, para quando nada pôde ser calculado. */
function analiseSemMedidas(p: Protocolo, trilha: TrilhaPose, opcoes: OpcoesAnalise, avisos: string[]): AnaliseMovimento {
  const resumos: AnaliseMovimento['resumos'] = {};
  const medidas = p.medidas.map((def) => {
    const lados: ChaveLado[] = def.porLado ? ['D', 'E'] : ['unico'];
    const valores: MedidaPorRepeticao['valores'] = {};
    const incerteza: MedidaPorRepeticao['incerteza'] = {};
    resumos[def.id] = {};
    for (const l of lados) {
      valores[l] = [];
      incerteza[l] = null;
      resumos[def.id][l] = resumir([]);
    }
    return { def, valores, incerteza, avisos: [] };
  });
  return {
    protocolo: p.id, planoFilmado: p.planoFilmado, direcao: opcoes.direcao ?? 1, repeticoes: [], medidas, resumos, achados: [],
    indisponiveis: indisponiveisDoProtocolo(p),
    incerteza: { angularGraus: null, quadroS: quadroDaTrilha(trilha), nAmostras: 0, formula: formulaDaIncerteza(p), descricao: DESCRICAO_INCERTEZA },
    series: Object.fromEntries(p.articulacoes.filter((d) => !!d).map((d) => [d.id, [] as AmostraAngulo[]])), eventos: [], avisos,
  };
}

/**
 * Analisa uma trilha no protocolo escolhido. Nunca lança por dados ruins (trilha vazia, poucos pontos, lacunas): devolve listas
 * vazias e explica em `avisos`. Só um id de protocolo desconhecido lança (erro de programação, como em `protocoloDo`).
 */
export function analisarMovimento(protocolo: Protocolo | IdProtocolo, trilha: TrilhaPose, opcoes: OpcoesAnalise = {}): AnaliseMovimento {
  const p = typeof protocolo === 'string' ? protocoloDo(protocolo) : protocolo;
  const { trilha: t, avisos: avisosDaTrilha } = trilhaSegura(trilha);
  try {
    const a = analisar(p, t, opcoes);
    a.avisos.unshift(...avisosDaTrilha);
    return a;
  } catch (erro) {
    // Rede de segurança: um erro inesperado não derruba a tela do profissional; o aviso torna o problema visível.
    const motivo = erro instanceof Error ? erro.message : String(erro);
    return analiseSemMedidas(p, t, opcoes, [...avisosDaTrilha, `Erro interno ao analisar este vídeo (${motivo}). Nenhuma medida foi calculada.`]);
  }
}
