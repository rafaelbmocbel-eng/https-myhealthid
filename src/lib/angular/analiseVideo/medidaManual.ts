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

/**
 * Leva as medidas guardadas para uma trilha nova (outra taxa ou outro trecho): cada uma passa a apontar o quadro mais perto do seu
 * instante. As que ficam a mais de um quadro de qualquer quadro da trilha (fora do trecho rastreado) são descartadas e contadas.
 */
export function remapearCapturas(capturas: readonly CapturaManual[], tempos: readonly number[]): { capturas: CapturaManual[]; descartadas: number } {
  if (!tempos.length) return { capturas: [], descartadas: capturas.length };
  const passo = tempos.length > 1 ? (tempos[tempos.length - 1] - tempos[0]) / (tempos.length - 1) : Infinity;
  const mantidas: CapturaManual[] = [];
  for (const c of capturas) {
    const i = indiceMaisProximo(tempos, c.t);
    if (Math.abs(tempos[i] - c.t) > passo + 1e-6) continue;
    mantidas.push(i === c.quadro ? c : { ...c, quadro: i });
  }
  return { capturas: mantidas, descartadas: capturas.length - mantidas.length };
}
