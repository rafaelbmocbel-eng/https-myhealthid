import { angulosPorQuadro, type AmostraAngulo } from '../video/angulos';
import { detectarEventosMarcha, type EventoPasso } from '../video/eventos';
import type { Lado, TrilhaPose } from '../video/tipos';
import { deteccaoPct, estimarDirecao } from '../video/trilha';
import { detectarAchados } from './achados';
import { finito, percentil, validos } from './estatistica';
import { incertezaAngularGeral, JANELA_SUAVIZACAO_S, processarSerie, quadroDaTrilha, type SerieProcessada } from './incerteza';
import { calcularMedidas } from './medidasPorRepeticao';
import { DESCRICAO_INCERTEZA, formulaDaIncerteza, indisponiveisDoProtocolo, protocoloDo } from './protocolos';
import { marcarDuracoesDiscrepantes, repeticoesDaMarcha, repeticoesDoAgachamento, segmentarPicos } from './repeticoes';
import {
  brutoAlturaPelve, brutoAvanco, brutoDesvioPelve, brutoProfundidade, brutoQuadrilTornozelo, comoFonte, type Fonte,
} from './seriesDerivadas';
import type { AnaliseMovimento, IdProtocolo, OpcoesAnalise, Protocolo, Repeticao } from './tipos';

/*
 * Motor da Etapa 3 (agente M): trilha de pose → repetições, medidas por repetição e por lado, resumos, incerteza do vídeo e achados.
 * Puro, determinístico, sem rede e sem modelo de linguagem. Mede e descreve; não treina, não dá nota e não diagnostica.
 *
 * Decisões de engenharia da segmentação (não são limites clínicos; o laudo as mostra em `protocolo.segmentacao`):
 *  - agachamento de lado: amplitude mínima de 20° na flexão média do joelho, como o motor de métricas (metricas.ts);
 *  - agachamento de frente: descida mínima do quadril de 6% da distância vertical quadril–tornozelo;
 *  - dois fundos distam pelo menos 0,8 s; início e fim por histerese (ver repeticoes.ts).
 */

const AMPLITUDE_MIN_JOELHO_GRAUS = 20;
const DESCIDA_MIN_QUADRIL = 0.06;
const DIST_MIN_FUNDOS_S = 0.8;
const MIN_REPETICOES_COM_VALOR = 3;

const sfx = (l: Lado) => l.toLowerCase();

const trilhaVazia = (): TrilhaPose => ({ fps: 30, largura: 1, altura: 1, quadros: [] });

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

function segmentarAgachamentoLateral(trilha: TrilhaPose, angulos: Record<string, SerieProcessada>, fps: number): Segmentacao {
  const joelhos = ['joelho_d', 'joelho_e'].map((id) => angulos[id]).filter((s): s is SerieProcessada => !!s);
  const referencia = mediaDasSeries(joelhos.map((s) => s.suave), trilha.quadros.length);
  const ruido = incertezaAngularGeral(joelhos.map((s) => s.u)) ?? 0;
  const brutas = segmentarPicos(referencia, fps, { amplitudeMin: AMPLITUDE_MIN_JOELHO_GRAUS, proeminenciaMin: AMPLITUDE_MIN_JOELHO_GRAUS, distMinS: DIST_MIN_FUNDOS_S, ruido });
  const avisos: string[] = [];
  if (!brutas.length) {
    avisos.push(`Não identifiquei repetições do agachamento (é preciso um pico de flexão do joelho com pelo menos ${AMPLITUDE_MIN_JOELHO_GRAUS}° de amplitude): confira se o movimento aparece inteiro no trecho analisado.`);
  }
  return { repeticoes: repeticoesDoAgachamento(trilha, brutas), eventos: [], avisos };
}

function segmentarAgachamentoFrontal(trilha: TrilhaPose, desloc: Record<string, Fonte>, fps: number): Segmentacao {
  const altura = desloc.altura_pelve;
  const escalaVertical = percentil(validos(desloc.quadril_tornozelo?.bruto ?? []).filter((v) => v > 0), 0.9) ?? 0.45 * trilha.altura;
  const minimo = DESCIDA_MIN_QUADRIL * escalaVertical;
  const brutas = altura
    ? segmentarPicos(altura.suave, fps, { amplitudeMin: minimo, proeminenciaMin: minimo, distMinS: DIST_MIN_FUNDOS_S, ruido: altura.u ?? 0 })
    : [];
  const avisos: string[] = [];
  if (!brutas.length) {
    avisos.push(`Não identifiquei repetições do agachamento (é preciso uma descida do ponto médio dos quadris de pelo menos ${Math.round(DESCIDA_MIN_QUADRIL * 100)}% da distância vertical quadril–tornozelo): confira se o corpo inteiro aparece de frente e se o movimento está no trecho analisado.`);
  }
  return { repeticoes: repeticoesDoAgachamento(trilha, brutas), eventos: [], avisos };
}

function segmentarMarcha(trilha: TrilhaPose, opcoes: OpcoesAnalise, direcao: 1 | -1): Segmentacao {
  const n = trilha.quadros.length;
  const recebidos = opcoes.eventos ?? detectarEventosMarcha(trilha, { direcao });
  const eventos = recebidos.filter((e) => Number.isInteger(e.i) && e.i >= 0 && e.i < n && finito(e.t));
  const avisos: string[] = [];
  if (eventos.length < recebidos.length) avisos.push(`${recebidos.length - eventos.length} evento(s) de contato ou saída do pé estavam fora do trecho analisado e foram ignorados.`);
  if (!eventos.some((e) => e.tipo === 'contato')) avisos.push('Não achei contatos do pé no chão: sem eles não há passadas. Marque os contatos e as saídas no quadro a quadro.');
  const r = repeticoesDaMarcha(trilha, eventos);
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
  else if (p.planoFilmado === 'frontal') seg = segmentarAgachamentoFrontal(trilha, deslocamentos, fps);
  else seg = segmentarAgachamentoLateral(trilha, angulos, fps);
  const { repeticoes, eventos } = seg;
  avisos.push(...seg.avisos);
  marcarDuracoesDiscrepantes(repeticoes, quadroS);

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
    series[def.id] = quadros.map((q, i) => ({ t: q.t, graus: angulos[def.id].suave[i] ?? null }));
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

/**
 * Analisa uma trilha no protocolo escolhido. Nunca lança por dados ruins (trilha vazia, poucos pontos, lacunas): devolve listas
 * vazias e explica em `avisos`. Só um id de protocolo desconhecido lança (erro de programação, como em `protocoloDo`).
 */
export function analisarMovimento(protocolo: Protocolo | IdProtocolo, trilha: TrilhaPose, opcoes: OpcoesAnalise = {}): AnaliseMovimento {
  const p = typeof protocolo === 'string' ? protocoloDo(protocolo) : protocolo;
  const t = trilha && Array.isArray(trilha.quadros) ? trilha : trilhaVazia();
  try {
    return analisar(p, t, opcoes);
  } catch (erro) {
    // Rede de segurança: um erro inesperado não derruba a tela do profissional; o aviso torna o problema visível.
    const motivo = erro instanceof Error ? erro.message : String(erro);
    return {
      protocolo: p.id, planoFilmado: p.planoFilmado, direcao: opcoes.direcao ?? 1, repeticoes: [],
      medidas: p.medidas.map((def) => ({ def, valores: {}, incerteza: {}, avisos: [] })), resumos: {}, achados: [], indisponiveis: indisponiveisDoProtocolo(p),
      incerteza: { angularGraus: null, quadroS: quadroDaTrilha(t), nAmostras: 0, formula: formulaDaIncerteza(p), descricao: DESCRICAO_INCERTEZA },
      series: {}, eventos: [], avisos: [`Erro interno ao analisar este vídeo (${motivo}). Nenhuma medida foi calculada.`],
    };
  }
}
