import { anguloEm } from './medidas';
import type { Landmark } from './pose';

export interface Frame { t: number; lm: Landmark[] | null }
export type Lado = 'D' | 'E';

// Índices do modelo de 33 pontos do MediaPipe (esquerdo/direito do paciente).
const IDX = {
  E: { quadril: 23, joelho: 25, tornozelo: 27, calcanhar: 29, pe: 31 },
  D: { quadril: 24, joelho: 26, tornozelo: 28, calcanhar: 30, pe: 32 },
} as const;

const VIS = 0.3;
const PONTOS_CURVA = 101;

export interface EventoMarcha { lado: Lado; tipo: 'contato' | 'saida'; t: number }

export interface ResultadoMarcha {
  /** +1 se o paciente anda para a direita da imagem, −1 para a esquerda. */
  direcao: 1 | -1;
  duracaoS: number;
  deteccaoPct: number;
  eventos: EventoMarcha[];
  passos: number;
  cadencia: number | null;
  tempoPassoMedioS: number | null;
  /** Tempo médio do passo que começa no contato do lado D (até o contato do E) e vice-versa. */
  tempoPasso: { D: number | null; E: number | null };
  /** menor/maior dos dois tempos de passo, em %. */
  simetriaTempoPct: number | null;
  apoioPct: { D: number | null; E: number | null };
  ciclos: { D: number; E: number };
  curvas: Record<'joelho' | 'quadril', Record<Lado, number[] | null>>;
  flexaoMaxJoelho: Record<Lado, number | null>;
  amplitude: Record<'joelho' | 'quadril', Record<Lado, number | null>>;
  avisos: string[];
}

const media = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);

function suavizar(v: number[]): number[] {
  return v.map((_, i) => {
    const a = v[Math.max(0, i - 1)], b = v[i], c = v[Math.min(v.length - 1, i + 1)];
    return (a + 2 * b + c) / 4;
  });
}

// Preenche lacunas (NaN) por interpolação linear; descarta séries com pouco dado.
function preencher(v: number[]): number[] | null {
  const ok = v.filter((x) => Number.isFinite(x)).length;
  if (ok < Math.max(8, v.length * 0.5)) return null;
  const out = [...v];
  let i = 0;
  while (i < out.length) {
    if (Number.isFinite(out[i])) { i++; continue; }
    let j = i;
    while (j < out.length && !Number.isFinite(out[j])) j++;
    const ant = i > 0 ? out[i - 1] : out[j];
    const prox = j < out.length ? out[j] : ant;
    for (let k = i; k < j; k++) out[k] = ant + ((prox - ant) * (k - i + 1)) / (j - i + 1);
    i = j;
  }
  return out;
}

function extremos(serie: number[], t: number[], tipo: 'max' | 'min', distMinS: number, prominencia: number): number[] {
  const dt = (t[t.length - 1] - t[0]) / Math.max(1, t.length - 1) || 1 / 30;
  const jan = Math.max(1, Math.round(distMinS / dt / 2));
  const s = tipo === 'max' ? serie : serie.map((x) => -x);
  const achados: { i: number; v: number }[] = [];
  for (let i = jan; i < s.length - jan; i++) {
    let ehPico = true;
    let menor = s[i];
    for (let k = i - jan; k <= i + jan; k++) {
      if (s[k] > s[i]) { ehPico = false; break; }
      if (s[k] < menor) menor = s[k];
    }
    if (ehPico && s[i] - menor >= prominencia) achados.push({ i, v: s[i] });
  }
  // Platôs: mantém o primeiro de cada grupo muito próximo.
  const finais: { i: number; v: number }[] = [];
  for (const a of achados) {
    const ult = finais[finais.length - 1];
    if (ult && (a.i - ult.i) * dt < distMinS) { if (a.v > ult.v) finais[finais.length - 1] = a; } else finais.push(a);
  }
  return finais.map((a) => t[a.i]);
}

function reamostrar(t: number[], v: number[], t0: number, t1: number): number[] {
  const out: number[] = [];
  let j = 0;
  for (let k = 0; k < PONTOS_CURVA; k++) {
    const alvo = t0 + ((t1 - t0) * k) / (PONTOS_CURVA - 1);
    while (j < t.length - 2 && t[j + 1] < alvo) j++;
    const f = (alvo - t[j]) / ((t[j + 1] - t[j]) || 1);
    out.push(v[j] + (v[j + 1] - v[j]) * Math.min(1, Math.max(0, f)));
  }
  return out;
}

export function analisarMarcha(frames: Frame[], w: number, h: number): ResultadoMarcha | { erro: string } {
  const comPose = frames.filter((f) => f.lm);
  if (frames.length < 20) return { erro: 'Vídeo curto demais: grave pelo menos 4 passos.' };
  const deteccaoPct = (comPose.length / frames.length) * 100;
  if (deteccaoPct < 50) return { erro: 'O corpo foi detectado em poucos quadros. Grave de lado, com o corpo inteiro no quadro e boa luz.' };

  const t = frames.map((f) => f.t);
  const px = (f: Frame, i: number) => {
    const l = f.lm?.[i];
    return l && (l.visibility ?? 1) >= VIS ? { x: l.x * w, y: l.y * h } : null;
  };

  // Direção: para onde os pés apontam (calcanhar → ponta do pé).
  let somaDir = 0;
  for (const f of frames) for (const lado of ['D', 'E'] as const) {
    const c = px(f, IDX[lado].calcanhar), p = px(f, IDX[lado].pe);
    if (c && p) somaDir += p.x - c.x;
  }
  const direcao: 1 | -1 = somaDir >= 0 ? 1 : -1;

  const avisos: string[] = [];
  const xRel: Record<Lado, number[] | null> = { D: null, E: null };
  const joelho: Record<Lado, number[] | null> = { D: null, E: null };
  const quadril: Record<Lado, number[] | null> = { D: null, E: null };

  for (const lado of ['D', 'E'] as const) {
    const I = IDX[lado];
    const xs: number[] = [], jo: number[] = [], qu: number[] = [];
    for (const f of frames) {
      const q = px(f, I.quadril), j = px(f, I.joelho), a = px(f, I.tornozelo);
      xs.push(q && a ? direcao * (a.x - q.x) : NaN);
      const ang = q && j && a ? anguloEm(q, j, a) : null;
      jo.push(ang === null ? NaN : 180 - ang);
      qu.push(q && j ? (Math.atan2(direcao * (j.x - q.x), j.y - q.y) * 180) / Math.PI : NaN);
    }
    const px_ = preencher(xs), jo_ = preencher(jo), qu_ = preencher(qu);
    xRel[lado] = px_ ? suavizar(px_) : null;
    joelho[lado] = jo_ ? suavizar(jo_) : null;
    quadril[lado] = qu_ ? suavizar(qu_) : null;
    if (!px_) avisos.push(`Lado ${lado === 'D' ? 'direito' : 'esquerdo'} pouco visível: sem eventos da marcha nesse lado.`);
  }

  const eventos: EventoMarcha[] = [];
  for (const lado of ['D', 'E'] as const) {
    const x = xRel[lado];
    if (!x) continue;
    const amp = Math.max(...x) - Math.min(...x);
    const prom = amp * 0.25;
    for (const tt of extremos(x, t, 'max', 0.35, prom)) eventos.push({ lado, tipo: 'contato', t: tt });
    for (const tt of extremos(x, t, 'min', 0.35, prom)) eventos.push({ lado, tipo: 'saida', t: tt });
  }
  eventos.sort((a, b) => a.t - b.t);

  const contatos = eventos.filter((e) => e.tipo === 'contato');
  const passos = Math.max(0, contatos.length - 1);
  const duracaoS = t[t.length - 1] - t[0];
  const cadencia = contatos.length >= 3 ? (passos / (contatos[contatos.length - 1].t - contatos[0].t)) * 60 : null;

  const passoDe: Record<Lado, number[]> = { D: [], E: [] };
  for (let i = 0; i < contatos.length - 1; i++) {
    const a = contatos[i], b = contatos[i + 1];
    if (a.lado !== b.lado) passoDe[a.lado].push(b.t - a.t);
  }
  const tempoPasso = { D: media(passoDe.D), E: media(passoDe.E) };
  const todosPassos = [...passoDe.D, ...passoDe.E];
  const simetriaTempoPct = tempoPasso.D && tempoPasso.E ? (Math.min(tempoPasso.D, tempoPasso.E) / Math.max(tempoPasso.D, tempoPasso.E)) * 100 : null;

  const apoioPct: Record<Lado, number | null> = { D: null, E: null };
  const ciclos: Record<Lado, number> = { D: 0, E: 0 };
  const curvas: ResultadoMarcha['curvas'] = { joelho: { D: null, E: null }, quadril: { D: null, E: null } };

  for (const lado of ['D', 'E'] as const) {
    const cs = contatos.filter((e) => e.lado === lado).map((e) => e.t);
    const saidas = eventos.filter((e) => e.lado === lado && e.tipo === 'saida').map((e) => e.t);
    const apoios: number[] = [];
    const acJ: number[][] = [], acQ: number[][] = [];
    for (let i = 0; i < cs.length - 1; i++) {
      const dur = cs[i + 1] - cs[i];
      if (dur < 0.6 || dur > 2.5) continue;
      ciclos[lado]++;
      const so = saidas.find((s) => s > cs[i] && s < cs[i + 1]);
      if (so !== undefined) apoios.push(((so - cs[i]) / dur) * 100);
      if (joelho[lado]) acJ.push(reamostrar(t, joelho[lado]!, cs[i], cs[i + 1]));
      if (quadril[lado]) acQ.push(reamostrar(t, quadril[lado]!, cs[i], cs[i + 1]));
    }
    apoioPct[lado] = media(apoios);
    const mediaCurva = (a: number[][]) => (a.length ? Array.from({ length: PONTOS_CURVA }, (_, k) => a.reduce((s, c) => s + c[k], 0) / a.length) : null);
    curvas.joelho[lado] = mediaCurva(acJ);
    curvas.quadril[lado] = mediaCurva(acQ);
  }

  const maxDe = (c: number[] | null) => (c ? Math.max(...c) : null);
  const ampDe = (c: number[] | null) => (c ? Math.max(...c) - Math.min(...c) : null);

  if (passos < 4) avisos.push('Poucos passos detectados: os valores ficam instáveis. Grave pelo menos 6 passos seguidos.');
  if (deteccaoPct < 85) avisos.push(`O corpo foi detectado em ${Math.round(deteccaoPct)}% dos quadros: confira a gravação (corpo inteiro, luz, roupa justa).`);
  avisos.push('Na gravação de lado, a perna mais distante da câmera é menos confiável: use os ângulos da perna mais próxima.');

  return {
    direcao, duracaoS, deteccaoPct, eventos, passos, cadencia,
    tempoPassoMedioS: media(todosPassos),
    tempoPasso, simetriaTempoPct, apoioPct, ciclos, curvas,
    flexaoMaxJoelho: { D: maxDe(curvas.joelho.D), E: maxDe(curvas.joelho.E) },
    amplitude: { joelho: { D: ampDe(curvas.joelho.D), E: ampDe(curvas.joelho.E) }, quadril: { D: ampDe(curvas.quadril.D), E: ampDe(curvas.quadril.E) } },
    avisos,
  };
}
