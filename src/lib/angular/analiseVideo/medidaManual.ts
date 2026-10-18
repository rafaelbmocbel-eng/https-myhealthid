import { itensDaMedida, type ContextoDesenho, type ItemDesenho } from '@/lib/angular/desenho';
import { rotuloValor } from '@/lib/angular/estilo';
import { girar, type Medida, type Ponto } from '@/lib/angular/medidas';
import { indiceMaisProximo } from './tempo';
import type { QuadroPose } from '@/lib/angular/video/tipos';
import { pontoDoQuadro } from '@/lib/angular/video/trilha';

/*
 * Medidas feitas à mão em um quadro do vídeo (ponto a ponto): o profissional para no quadro, marca os pontos da
 * ferramenta e guarda o valor com o instante. As funções são puras para tela, PDF e quadro exportado desenharem igual.
 */

export interface ResultadoManual { valor: number; texto: string; unidade: 'graus' | 'cm' }

export interface CapturaManual {
  uid: string;
  medidaId: string;
  nome: string;
  /** Instante no vídeo e quadro (da trilha, ou do vídeo inteiro na marcação sem rastreio). */
  t: number;
  quadro: number;
  pontos: Ponto[];
  valor: number;
  unidade: 'graus' | 'cm';
  texto: string;
}

const corrigido = (p: Ponto[], giro: number | null): Ponto[] => (giro ? p.map((q) => girar(q, -giro)) : p);

/** Valor da medida com todos os pontos marcados, corrigido pelo nível; null se faltar ponto ou a medida não calcular. */
export function resultadoManual(m: Medida, pontos: Ponto[], giro: number | null, cmPorPx: number | null): ResultadoManual | null {
  if (m.auxiliar || pontos.length < m.pontos.length) return null;
  const r = m.calcular(corrigido(pontos, giro), { cmPorPx });
  return r ? { valor: r.valor, texto: r.texto, unidade: m.unidade === 'cm' ? 'cm' : 'graus' } : null;
}

export const textoDoValor = (valor: number, unidade: 'graus' | 'cm', casas: 0 | 1 = 1): string => rotuloValor(Math.abs(valor), unidade, casas);

/** Itens de desenho (estilo escolhido) de uma medida marcada à mão; sem todos os pontos, só as retas e os pontos já postos. */
export function itensManuais(m: Medida, pontos: Ponto[], c: ContextoDesenho, o: { giro: number | null; cmPorPx: number | null }): ItemDesenho[] {
  if (!pontos.length) return [];
  const r = resultadoManual(m, pontos, o.giro, o.cmPorPx);
  const principal = r ? textoDoValor(r.valor, r.unidade, c.estilo.casasRotulo ?? 1) : undefined;
  const ctx = o.giro ? { ...c, giro: o.giro } : c;
  return itensDaMedida(m, pontos, { principal }, ctx);
}


const PARTES_SUGERIDAS: Record<string, string[]> = {
  joelho: ['quadril', 'joelho', 'tornozelo'], quadril: ['ombro', 'quadril', 'joelho'], tornozelo: ['joelho', 'tornozelo', 'pe'], 'tronco-perfil': ['ombro', 'quadril'],
};

/**
 * Pontos de uma medida de articulação sugeridos pelo corpo rastreado no quadro (centros articulares, não pontos ósseos:
 * o profissional confere e arrasta). Sem lado no id, usa o lado mais confiável. Null se a medida não tem sugestão ou falta ponto.
 */
export function sugerirDaTrilha(id: string, quadro: QuadroPose | undefined): Ponto[] | null {
  if (!quadro) return null;
  const base = id.replace(/-(d|e)$/, '');
  const partes = PARTES_SUGERIDAS[base];
  if (!partes) return null;
  const confianca = (l: 'd' | 'e') => partes.reduce((s, p) => s + (quadro.pontos[`${p}_${l}`]?.conf ?? 0), 0);
  const lado: 'd' | 'e' = id.endsWith('-d') ? 'd' : id.endsWith('-e') ? 'e' : confianca('e') >= confianca('d') ? 'e' : 'd';
  const pts = partes.map((p) => pontoDoQuadro(quadro, `${p}_${lado}`));
  return pts.every((p): p is { x: number; y: number } => p !== null) ? pts : null;
}

/** Faixa de tempo que a trilha atual cobre; `passo` é o intervalo entre quadros, a tolerância das pontas. */
export interface TrechoDaTrilha { inicio: number; fim: number; passo: number }

/** Trecho coberto pelos instantes (crescentes) da trilha; null sem quadros. `fps` só vale para trilha de um quadro só. */
export function trechoDaTrilha(tempos: readonly number[], fps?: number): TrechoDaTrilha | null {
  if (!tempos.length) return null;
  const fim = tempos[tempos.length - 1];
  const passo = tempos.length > 1 ? (fim - tempos[0]) / (tempos.length - 1) : 1 / Math.max(1, fps ?? 30);
  return { inicio: tempos[0], fim, passo };
}

/** O instante cai no trecho? Vale até um quadro além de cada ponta, que é o que o quadro mais próximo ainda representa. */
export const instanteNoTrecho = (t: number, trecho: TrechoDaTrilha | null): boolean =>
  !!trecho && t >= trecho.inicio - trecho.passo - 1e-6 && t <= trecho.fim + trecho.passo + 1e-6;

/**
 * Separa as medidas guardadas entre as que valem na trilha atual e as que ficaram fora do trecho. É só leitura: nada é apagado nem
 * ganha campo novo (o arquivo salvo segue igual), e o `t` da medida continua valendo no mesmo vídeo, então ela volta a valer se um
 * trecho novo incluir o instante. As de dentro apontam o quadro mais perto do seu instante, também quando a taxa da trilha mudou.
 */
export function situarCapturas(capturas: readonly CapturaManual[], tempos: readonly number[], fps?: number): { dentro: CapturaManual[]; fora: CapturaManual[] } {
  const trecho = trechoDaTrilha(tempos, fps);
  const dentro: CapturaManual[] = [], fora: CapturaManual[] = [];
  for (const c of capturas) {
    if (!instanteNoTrecho(c.t, trecho)) { fora.push(c); continue; }
    const i = indiceMaisProximo(tempos, c.t);
    dentro.push(i === c.quadro ? c : { ...c, quadro: i });
  }
  return { dentro, fora };
}

/**
 * Leva as medidas guardadas para uma trilha nova (outra taxa ou outro trecho): as de dentro passam a apontar o quadro mais perto do seu
 * instante e as de fora ficam como estão, na lista, só contadas. Nenhuma é descartada.
 */
export function remapearCapturas(capturas: readonly CapturaManual[], tempos: readonly number[], fps?: number): { capturas: CapturaManual[]; foraDoTrecho: number } {
  const { dentro, fora } = situarCapturas(capturas, tempos, fps);
  const ordem = new Map(capturas.map((c, k) => [c.uid, k]));
  const todas = [...dentro, ...fora].sort((a, b) => a.t - b.t || (ordem.get(a.uid) ?? 0) - (ordem.get(b.uid) ?? 0));
  return { capturas: todas, foraDoTrecho: fora.length };
}

/**
 * Aviso de que medidas guardadas ficaram de fora de uma saída (PDF, resumo copiado, registro no prontuário). Quem lê depois só tem a
 * saída, então ela precisa dizer que existem outras medidas; o arquivo da análise guarda todas.
 */
export function notaMedidasForaDoTrecho(fora: number, saida: 'relatório' | 'resumo' | 'registro'): string | undefined {
  if (fora <= 0) return undefined;
  return `${fora} ${fora === 1 ? 'medida guardada em instante fora do trecho analisado não entrou' : 'medidas guardadas em instantes fora do trecho analisado não entraram'} neste ${saida}.`;
}
