import { CONF_MINIMA, type Lado, type TrilhaPose } from '../video/tipos';
import { pontoDoQuadro } from '../video/trilha';
import { mediana, validos } from './estatistica';
import { processarSerie, type SerieProcessada } from './incerteza';

/*
 * Séries por quadro das medidas que não são ângulos (deslocamentos normalizados), com o sinal documentado em protocolos.ts.
 * Cada função devolve a série BRUTA (null onde falta ponto) e a referência em pixels usada para normalizar, que serve para
 * converter a medida em cm quando o profissional informa a escala. A suavização e a incerteza ficam em `processarSerie`.
 */

export interface SerieBruta { bruto: (number | null)[]; refPx: number | null }

/** Série processada de um deslocamento, com a referência (px) que o normaliza. */
export interface Fonte extends SerieProcessada { refPx: number | null }

const sfx = (lado: Lado) => lado.toLowerCase();

export const comoFonte = (s: SerieBruta, fps: number, suavizacaoS: number): Fonte => ({ ...processarSerie(s.bruto, fps, suavizacaoS), refPx: s.refPx });

/** Comprimento do pé (calcanhar–ponta) em pixels: a mediana no vídeo, porque o pé é rígido e o ruído de um quadro não deve mexer na escala. */
export function comprimentoDoPe(trilha: TrilhaPose, lado: Lado): number | null {
  const d: number[] = [];
  for (const q of trilha.quadros) {
    const c = pontoDoQuadro(q, `calcanhar_${sfx(lado)}`, CONF_MINIMA), p = pontoDoQuadro(q, `pe_${sfx(lado)}`, CONF_MINIMA);
    if (c && p) {
      const l = Math.hypot(p.x - c.x, p.y - c.y);
      if (l > 0) d.push(l);
    }
  }
  return mediana(d);
}

/**
 * Avanço do joelho: (x do joelho − x da ponta do pé) × direção ÷ comprimento do pé × 100. Positivo = joelho à frente da ponta do pé.
 * Só observação medida: nenhum limite é aplicado.
 */
export function brutoAvanco(trilha: TrilhaPose, lado: Lado, direcao: 1 | -1): SerieBruta {
  const comprimento = comprimentoDoPe(trilha, lado);
  const bruto = trilha.quadros.map((q) => {
    if (comprimento === null) return null;
    const j = pontoDoQuadro(q, `joelho_${sfx(lado)}`, CONF_MINIMA), p = pontoDoQuadro(q, `pe_${sfx(lado)}`, CONF_MINIMA);
    return j && p ? ((direcao * (j.x - p.x)) / comprimento) * 100 : null;
  });
  return { bruto, refPx: comprimento };
}

/**
 * Profundidade: distância vertical do quadril abaixo do joelho ÷ comprimento da coxa × 100, média dos lados com pontos.
 * 0 = quadril na altura do joelho; positivo = abaixo; negativo = acima.
 */
export function brutoProfundidade(trilha: TrilhaPose): SerieBruta {
  const coxas: number[] = [];
  const bruto = trilha.quadros.map((q) => {
    const porLado: number[] = [];
    for (const lado of ['D', 'E'] as const) {
      const h = pontoDoQuadro(q, `quadril_${sfx(lado)}`, CONF_MINIMA), j = pontoDoQuadro(q, `joelho_${sfx(lado)}`, CONF_MINIMA);
      if (!h || !j) continue;
      const coxa = Math.hypot(h.x - j.x, h.y - j.y);
      if (coxa > 0) {
        porLado.push(((h.y - j.y) / coxa) * 100);
        coxas.push(coxa);
      }
    }
    return porLado.length ? porLado.reduce((s, v) => s + v, 0) / porLado.length : null;
  });
  return { bruto, refPx: mediana(coxas) };
}

/** Sentido do lado direito do paciente na imagem: +1 se o quadril D fica à direita do E (paciente de costas), −1 se à esquerda (de frente). */
export function sentidoDoLadoDireito(trilha: TrilhaPose): 1 | -1 {
  let soma = 0;
  for (const q of trilha.quadros) {
    const d = pontoDoQuadro(q, 'quadril_d', CONF_MINIMA), e = pontoDoQuadro(q, 'quadril_e', CONF_MINIMA);
    if (d && e) soma += d.x - e.x;
  }
  return soma >= 0 ? 1 : -1;
}

/**
 * Deslocamento lateral da pelve: (x do ponto médio dos quadris − x do ponto médio dos tornozelos) ÷ distância horizontal entre os
 * tornozelos × 100, positivo para o lado direito do paciente. Frames com os tornozelos praticamente alinhados ficam sem valor,
 * porque a divisão deixa de ter sentido.
 */
export function brutoDesvioPelve(trilha: TrilhaPose): SerieBruta {
  const sentido = sentidoDoLadoDireito(trilha);
  const baseMin = Math.max(1, 0.01 * trilha.largura);
  const bases: number[] = [];
  const bruto = trilha.quadros.map((q) => {
    const hd = pontoDoQuadro(q, 'quadril_d', CONF_MINIMA), he = pontoDoQuadro(q, 'quadril_e', CONF_MINIMA);
    const td = pontoDoQuadro(q, 'tornozelo_d', CONF_MINIMA), te = pontoDoQuadro(q, 'tornozelo_e', CONF_MINIMA);
    if (!hd || !he || !td || !te) return null;
    const base = Math.abs(td.x - te.x);
    if (!(base >= baseMin)) return null;
    bases.push(base);
    return ((sentido * ((hd.x + he.x) / 2 - (td.x + te.x) / 2)) / base) * 100;
  });
  return { bruto, refPx: mediana(bases) };
}

/** Posição vertical (y da imagem, em pixels) do ponto médio dos quadris: cresce quando a pelve desce. */
export function brutoAlturaPelve(trilha: TrilhaPose): SerieBruta {
  const bruto = trilha.quadros.map((q) => pontoDoQuadro(q, 'quadril_medio', CONF_MINIMA)?.y ?? null);
  return { bruto, refPx: null };
}

/** Distância vertical entre o ponto médio dos quadris e o dos tornozelos, em pixels: a referência da descida da pelve. */
export function brutoQuadrilTornozelo(trilha: TrilhaPose): SerieBruta {
  const bruto = trilha.quadros.map((q) => {
    const h = pontoDoQuadro(q, 'quadril_medio', CONF_MINIMA), t = pontoDoQuadro(q, 'tornozelo_medio', CONF_MINIMA);
    return h && t ? t.y - h.y : null;
  });
  return { bruto, refPx: mediana(validos(bruto).filter((v) => v > 0)) };
}
