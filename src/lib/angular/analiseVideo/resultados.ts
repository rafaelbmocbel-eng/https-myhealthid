import type { BandaGrafico, MarcadorGrafico, SerieGrafico } from './graficoLayout';
import { COR_LADO, type CartaoMetricaUi, type ContextoUi, type EventoUi, type ModeloUi, type ReferenciaUi, type StatusReferencia, type ValorMetricaUi } from './tiposUi';
import { angulosPorQuadro, type AmostraAngulo, type DefinicaoAngulo } from '@/lib/angular/video/angulos';
import type { EventoPasso } from '@/lib/angular/video/eventos';
import type { ModeloGesto } from '@/lib/angular/video/modelos';
import { REFERENCIAS, descreverFaixa, descreverLimite, montarCartao, type ReferenciaBiomecanica } from '@/lib/angular/video/referencias';
import { indiceAssimetria } from '@/lib/angular/video/metricas';
import { janelaEmAmostras, suavizar } from '@/lib/angular/video/suavizar';
import type { ResultadoMetrica, TrilhaPose } from '@/lib/angular/video/tipos';

/*
 * Do motor para a tela: grupos de articulações (um gráfico por grupo, uma curva por lado), eventos e bandas de
 * referência. A trilha nunca é alterada: a suavização vale só para a curva mostrada.
 */

export interface GrupoArticulacao {
  id: string;
  nome: string;
  defs: DefinicaoAngulo[];
}

const SEM_LADO = (id: string) => id.replace(/_(d|e)$/, '');
const NOME_SEM_LADO = (nome: string) => nome.replace(/\s+(direito|esquerdo)$/i, '');

/** Agrupa as definições do modelo: "Joelho direito" e "Joelho esquerdo" viram o grupo "Joelho", com as duas curvas. */
export function gruposDeArticulacoes(defs: DefinicaoAngulo[]): GrupoArticulacao[] {
  const grupos: GrupoArticulacao[] = [];
  for (const d of defs) {
    const id = SEM_LADO(d.id);
    const g = grupos.find((x) => x.id === id);
    if (g) g.defs.push(d);
    else grupos.push({ id, nome: NOME_SEM_LADO(d.nome), defs: [d] });
  }
  return grupos;
}

/** Grupo mostrado ao abrir: o do primeiro ângulo do gráfico padrão do modelo. */
export function grupoInicial(modelo: ModeloGesto, grupos: GrupoArticulacao[]): string {
  const alvo = modelo.graficoPadrao[0];
  return grupos.find((g) => g.defs.some((d) => d.id === alvo))?.id ?? grupos[0]?.id ?? '';
}

export const SUAVIZACAO_PADRAO_S = 0.1;

/** Curva de cada ângulo do grupo, quadro a quadro, com suavização leve só para o desenho (lacunas continuam lacunas). */
export function seriesDoGrupo(trilha: TrilhaPose, grupo: GrupoArticulacao, direcao: 1 | -1, o: { suavizarS?: number | null } = {}): SerieGrafico[] {
  const janelaS = o.suavizarS === undefined ? SUAVIZACAO_PADRAO_S : o.suavizarS;
  return grupo.defs.map((d, k) => {
    const amostras = angulosPorQuadro(trilha, d, { direcao });
    const valores = janelaS ? suavizar(amostras.map((a) => a.graus), janelaEmAmostras(janelaS, trilha.fps)) : amostras.map((a) => a.graus);
    const lado = d.lado ?? undefined;
    return {
      id: d.id,
      rotulo: lado ?? NOME_SEM_LADO(d.nome),
      lado,
      cor: lado ? COR_LADO[lado] : ['#0f766e', '#7c3aed'][k % 2],
      pontos: amostras.map((a, i) => ({ t: a.t, v: valores[i] })),
    };
  });
}

/** Curva de cada ângulo do grupo a partir das séries que a análise do gesto já calculou (as mesmas das métricas). */
export function seriesDoGrupoDaAnalise(grupo: GrupoArticulacao, series: Record<string, AmostraAngulo[]>): SerieGrafico[] {
  return grupo.defs.flatMap((d, k) => {
    const amostras = series[d.id];
    if (!amostras) return [];
    const lado = d.lado ?? undefined;
    return [{
      id: d.id,
      rotulo: lado ?? NOME_SEM_LADO(d.nome),
      lado,
      cor: lado ? COR_LADO[lado] : ['#0f766e', '#7c3aed'][k % 2],
      pontos: amostras.map((a) => ({ t: a.t, v: a.graus })),
    }];
  });
}

export const eventoParaUi = (e: EventoPasso): EventoUi => ({ id: e.id, tipo: e.tipo, lado: e.lado, i: e.i, t: e.t, origem: e.sugerido ? 'auto' : 'manual' });

export const marcadoresDeEventos = (eventos: EventoPasso[]): MarcadorGrafico[] => eventos.map((e) => ({ id: e.id, t: e.t, tipo: e.tipo, lado: e.lado }));

/** Metrica de pico → grupo de articulação que ela delimita. Só vira banda no gráfico se houver faixa confirmada em fonte. */
const GRUPO_DA_METRICA: Record<string, string> = {
  adm_joelho: 'joelho', adm_quadril: 'quadril', adm_tornozelo: 'tornozelo',
  flexao_joelho_max: 'joelho', flexao_quadril_max: 'quadril', dorsiflexao_max: 'tornozelo',
  flexao_joelho_pico_balanco: 'joelho', flexao_joelho_pico_apoio: 'joelho',
  elevacao_max: 'elevacao', valgo_max: 'valgo',
};

/**
 * Faixas de referência para o gráfico do grupo: só referências 'confirmada' em unidade de graus, aplicáveis ao gesto e que
 * delimitam o pico do grupo. Sem nenhuma, devolve lista vazia e o gráfico não desenha banda. Nunca inventa limite.
 */
export function bandasDoGrupo(grupoId: string, modeloId: string, referencias: ReferenciaBiomecanica[] = REFERENCIAS): BandaGrafico[] {
  return referencias
    .filter((r) => r.estatuto === 'confirmada' && r.unidade === '°' && GRUPO_DA_METRICA[r.metrica] === grupoId && (!r.aplicaA || r.aplicaA.includes(modeloId)) && (r.faixa.min !== undefined || r.faixa.max !== undefined))
    .map((r) => {
      const { min, max } = r.faixa;
      const faixa = min !== undefined && max !== undefined ? `${min} a ${max}°` : min !== undefined ? `≥ ${min}°` : `≤ ${max}°`;
      return { id: r.chave, min, max, rotulo: `Referência do pico: ${faixa} (${r.fonte.rotulo ?? r.fonte.citacao}${r.fonte.pmid ? `, PMID ${r.fonte.pmid}` : ''})` };
    });
}

export const modeloParaUi = (m: ModeloGesto): ModeloUi => ({
  id: m.id,
  nome: m.nome,
  vista: m.vista === 'lateral' ? 'Vista lateral' : 'Vista frontal',
  descricao: m.descricao,
  itens: m.metricas.filter((x) => !x.requerEscala).slice(0, 6).map((x) => x.nome.toLowerCase()),
  comEventos: m.eventos !== null,
});

// ---------- cartões de métricas ----------

const DECIMAIS_POR_UNIDADE: Record<string, number> = { '': 0, ms: 0, s: 2, 'razão': 2, 'passos/min': 0, '°': 1, '%': 1 };

/** "62,3°", "1,10 s", "230 ms", "112 passos/min", "58,4% do ciclo"; null vira "—". */
export function formatarMetrica(valor: number | null, unidade: string): string {
  if (valor === null || !Number.isFinite(valor)) return '—';
  const casas = DECIMAIS_POR_UNIDADE[unidade] ?? (unidade.startsWith('%') ? 1 : 1);
  const num = valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  if (unidade === '') return num;
  return unidade === '°' || unidade.startsWith('%') ? `${num}${unidade}` : `${num} ${unidade}`;
}

const SEM_LADO_NO_NOME = (nome: string) => nome.replace(/\s*\((direito|esquerdo)\)\s*$/i, '');

const referenciaParaUi = (r: ReferenciaBiomecanica): ReferenciaUi => ({
  chave: r.chave, faixa: descreverFaixa(r), populacao: r.populacao, citacao: r.fonte.citacao, rotulo: r.fonte.rotulo, pmid: r.fonte.pmid, nota: r.nota, tipo: r.tipo,
  limiteMin: descreverLimite(r, 'min'), limiteMax: descreverLimite(r, 'max'),
});

/**
 * Cartões das métricas: uma por métrica, com os dois lados juntos. O status de cada valor vem do motor
 * (`montarCartao`): só referência confirmada em fonte classifica; o resto fica "sem referência".
 */
export function cartoesDeMetricas(metricas: ResultadoMetrica[], modelo: ModeloGesto): CartaoMetricaUi[] {
  const nomes = new Map(modelo.metricas.map((m) => [m.metrica, m.nome]));
  const ordem: string[] = [];
  const porMetrica = new Map<string, ResultadoMetrica[]>();
  for (const r of metricas) {
    if (!porMetrica.has(r.metrica)) { porMetrica.set(r.metrica, []); ordem.push(r.metrica); }
    porMetrica.get(r.metrica)!.push(r);
  }
  return ordem.map((chave) => {
    const rs = porMetrica.get(chave)!;
    const cartoes = rs.map((r) => montarCartao(r, modelo.id));
    const referencias = new Map<string, ReferenciaUi>();
    const contexto = new Map<string, ContextoUi>();
    for (const c of cartoes) {
      for (const a of c.avaliacoes) referencias.set(a.ref.chave, referenciaParaUi(a.ref));
      for (const x of c.contexto) contexto.set(`${x.fonte.pmid ?? x.fonte.citacao}|${x.texto.slice(0, 40)}`, { texto: x.texto, citacao: x.fonte.citacao, pmid: x.fonte.pmid });
    }
    const valores: ValorMetricaUi[] = rs.map((r, k) => {
      const dentroDe = cartoes[k].avaliacoes.filter((a) => a.classe === 'dentro').map((a) => a.ref.chave);
      return {
        lado: r.lado,
        texto: formatarMetrica(r.valor, r.unidade),
        status: (cartoes[k].classe satisfies StatusReferencia) as StatusReferencia,
        ...(r.incerteza !== undefined ? { incerteza: `± ${formatarMetrica(r.incerteza, r.unidade)} (resolução do vídeo)`, incertezaCurta: `± ${formatarMetrica(r.incerteza, r.unidade)}` } : {}),
        ...(dentroDe.length ? { dentroDe } : {}),
      };
    });
    const primeiro = rs[0];
    const observacoes = rs.find((r) => r.n !== undefined && r.n > 0);
    const detalhe = [primeiro.detalhe, observacoes ? `${observacoes.n} ${observacoes.n === 1 ? 'observação' : 'observações'}${observacoes.dp !== undefined ? `, desvio-padrão ${formatarMetrica(observacoes.dp, observacoes.unidade)}` : ''}` : undefined].filter(Boolean).join(' · ');
    return {
      chave,
      titulo: nomes.get(chave) ?? SEM_LADO_NO_NOME(primeiro.nome),
      valores,
      ...(detalhe ? { detalhe } : {}),
      referencias: [...referencias.values()],
      contexto: [...contexto.values()],
      ...(primeiro.formula ? { formula: primeiro.formula } : {}),
      avisos: [...new Set(rs.flatMap((r) => r.avisos))],
    };
  });
}

/** Marcas extras do gráfico: repetições (agachamento, elevação do braço) e a aterrissagem do salto. */
export function marcadoresExtras(trilha: TrilhaPose, repeticoes: number[], aterrissagem: number | null): MarcadorGrafico[] {
  const m: MarcadorGrafico[] = repeticoes.flatMap((i, k) => (trilha.quadros[i] ? [{ id: `rep-${i}`, t: trilha.quadros[i].t, tipo: 'outro' as const, rotulo: `Pico ${k + 1}`, legenda: 'pico da repetição' }] : []));
  if (aterrissagem !== null && trilha.quadros[aterrissagem]) m.push({ id: `aterr-${aterrissagem}`, t: trilha.quadros[aterrissagem].t, tipo: 'outro', rotulo: 'Aterrissagem', legenda: 'aterrissagem' });
  return m;
}

// ---------- comparação entre os lados ----------

export interface ResumoSerie { min: number | null; max: number | null; adm: number | null; media: number | null; n: number }

/** Mínimo, máximo, amplitude (máximo − mínimo) e média das amostras válidas da curva. */
export function resumoDaSerie(s: SerieGrafico): ResumoSerie {
  const v = s.pontos.flatMap((p) => (p.v !== null && Number.isFinite(p.v) ? [p.v] : []));
  if (!v.length) return { min: null, max: null, adm: null, media: null, n: 0 };
  const min = Math.min(...v), max = Math.max(...v);
  return { min, max, adm: max - min, media: v.reduce((a, b) => a + b, 0) / v.length, n: v.length };
}

export interface LinhaLados {
  grupoId: string;
  nome: string;
  D: ResumoSerie;
  E: ResumoSerie;
  /** Índice de assimetria da amplitude, %: |D − E| ÷ ((D + E) ÷ 2) × 100. Null se faltar um dos lados. */
  assimetriaAdm: number | null;
}

/** Resumo D × E de cada articulação que tem as duas curvas. */
export function compararLados(grupos: GrupoArticulacao[], series: Record<string, AmostraAngulo[]>): LinhaLados[] {
  return grupos.flatMap((g) => {
    const s = seriesDoGrupoDaAnalise(g, series);
    const d = s.find((x) => x.lado === 'D'), e = s.find((x) => x.lado === 'E');
    if (!d || !e) return [];
    const rd = resumoDaSerie(d), re = resumoDaSerie(e);
    return [{ grupoId: g.id, nome: g.nome, D: rd, E: re, assimetriaAdm: indiceAssimetria(rd.adm, re.adm) }];
  });
}
