import { angulosPorQuadro, anguloJoelho, grausDaSerie } from './angulos';
import { janelaEmAmostras, preencherLacunas, suavizar, type Serie } from './suavizar';
import type { Lado, TrilhaPose } from './tipos';
import { estimarDirecao, pontoDoQuadro } from './trilha';

/**
 * Eventos do ciclo (contato inicial do pé e saída do pé do chão), detectados a partir da trilha.
 * São SUGESTÕES: o profissional confere no quadro a quadro e ajusta com `adicionarEvento`, `moverEvento` e `removerEvento`.
 * A precisão é de um quadro (1/fps): a 30 fps são ~33 ms, o que pesa nos tempos curtos da corrida.
 */
export interface EventoPasso {
  id: string;
  lado: Lado;
  tipo: 'contato' | 'saida';
  /** Índice do quadro na trilha. */
  i: number;
  t: number;
  /** true enquanto o evento é a sugestão automática; false depois que o profissional o criou ou moveu. */
  sugerido: boolean;
}

export interface OpcoesEventos {
  /** Para onde o paciente anda (+1 direita da imagem). Sem isto é estimado pela orientação dos pés. */
  direcao?: 1 | -1;
  /** Intervalo mínimo entre dois eventos do mesmo tipo e lado, em segundos. */
  distMinS?: number;
}

const DIST_MIN_MARCHA_S = 0.35;
const DIST_MIN_CORRIDA_S = 0.2;
const AMPLITUDE_MIN_PCT_ALTURA = 0.03;

const idDe = (lado: Lado, tipo: EventoPasso['tipo'], i: number) => `${lado}-${tipo}-${i}`;

const percentil = (valores: number[], p: number): number => {
  const v = [...valores].sort((a, b) => a - b);
  const pos = (v.length - 1) * p;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return v[lo] + (v[hi] - v[lo]) * (pos - lo);
};

const finitos = (s: Serie): number[] => Array.from(s).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

/** Preenche lacunas curtas e suaviza levemente: o suficiente para tirar o tremor do detector sem deslocar os picos. */
function prepararSerie(serie: Serie, fps: number): (number | null)[] {
  const cheia = preencherLacunas(serie, Math.max(1, Math.round(0.25 * fps)));
  return suavizar(cheia, janelaEmAmostras(0.12, fps), { metodo: 'savitzky_golay', ordem: 2 });
}

interface Candidato { i: number; v: number }

/**
 * Máximos (ou mínimos) locais com distância mínima e proeminência mínima. Em platôs fica o primeiro quadro; picos a menos de
 * meia distância mínima das pontas ficam de fora (a janela de comparação estaria cortada). A proeminência compara o pico com o ponto
 * mais baixo (mais alto, nos mínimos) de cada lado dentro de `alcance` quadros (padrão: a distância mínima).
 */
export function extremosLocais(serie: Serie, tipo: 'max' | 'min', distMin: number, proeminenciaMin: number, alcance = distMin): number[] {
  const s = Array.from(serie, (v) => (typeof v === 'number' && Number.isFinite(v) ? (tipo === 'max' ? v : -v) : null));
  const n = s.length;
  const h = Math.max(1, Math.floor(distMin / 2));
  const L = Math.max(2, Math.floor(alcance));
  const candidatos: Candidato[] = [];
  for (let i = h; i < n - h; i++) {
    const v = s[i];
    if (v === null) continue;
    let ehPico = true;
    for (let j = i - h; j <= i + h && ehPico; j++) {
      const w = s[j];
      if (w === null || j === i) continue;
      if (w > v || (w === v && j < i)) ehPico = false;
    }
    if (!ehPico) continue;
    let minEsq = Infinity, minDir = Infinity;
    for (let j = Math.max(0, i - L); j < i; j++) if (s[j] !== null) minEsq = Math.min(minEsq, s[j] as number);
    for (let j = i + 1; j <= Math.min(n - 1, i + L); j++) if (s[j] !== null) minDir = Math.min(minDir, s[j] as number);
    if (minEsq === Infinity && minDir === Infinity) continue;
    const piso = Math.max(minEsq === Infinity ? -Infinity : minEsq, minDir === Infinity ? -Infinity : minDir);
    if (v - piso >= proeminenciaMin) candidatos.push({ i, v });
  }
  const aceitos: Candidato[] = [];
  for (const c of [...candidatos].sort((a, b) => b.v - a.v)) {
    if (aceitos.every((a) => Math.abs(a.i - c.i) >= distMin)) aceitos.push(c);
  }
  return aceitos.map((c) => c.i).sort((a, b) => a - b);
}

/** Garante a alternância contato → saída em cada lado: de dois eventos iguais seguidos, mantém o mais marcado. */
function alternar(brutos: { i: number; tipo: EventoPasso['tipo']; v: number }[]): { i: number; tipo: EventoPasso['tipo'] }[] {
  const ordem = [...brutos].sort((a, b) => a.i - b.i);
  const saida: { i: number; tipo: EventoPasso['tipo']; v: number }[] = [];
  for (const e of ordem) {
    const ult = saida[saida.length - 1];
    if (ult && ult.tipo === e.tipo) {
      if (e.v > ult.v) saida[saida.length - 1] = e;
    } else saida.push(e);
  }
  return saida.map(({ i, tipo }) => ({ i, tipo }));
}

const montar = (trilha: TrilhaPose, lado: Lado, achados: { i: number; tipo: EventoPasso['tipo'] }[]): EventoPasso[] =>
  achados.map((a) => ({ id: idDe(lado, a.tipo, a.i), lado, tipo: a.tipo, i: a.i, t: trilha.quadros[a.i].t, sugerido: true }));

const ordenar = (lista: EventoPasso[]): EventoPasso[] => [...lista].sort((a, b) => a.i - b.i || (a.lado < b.lado ? -1 : 1));

/**
 * Marcha: o contato inicial é o instante em que o calcanhar chega mais à frente da pelve, e a saída do pé, o instante em que a
 * ponta do pé chega mais atrás — a posição do pé em relação à pelve não depende de a câmera estar parada, acompanhar ou ser esteira
 * (mesma ideia dos métodos puramente cinemáticos de Zeni et al., 2008; PMID 17723303, validados com marcadores, não com pose em vídeo).
 */
export function detectarEventosMarcha(trilha: TrilhaPose, opcoes: OpcoesEventos = {}): EventoPasso[] {
  const d = opcoes.direcao ?? estimarDirecao(trilha);
  const distMin = Math.max(2, Math.round((opcoes.distMinS ?? DIST_MIN_MARCHA_S) * trilha.fps));
  const eventos: EventoPasso[] = [];
  for (const lado of ['D', 'E'] as const) {
    const s = lado.toLowerCase();
    const relativo = (primeiro: string, reserva: string) => trilha.quadros.map((q) => {
      const pelve = pontoDoQuadro(q, 'quadril_medio') ?? pontoDoQuadro(q, `quadril_${s}`);
      const pe = pontoDoQuadro(q, primeiro) ?? pontoDoQuadro(q, reserva);
      return pelve && pe ? d * (pe.x - pelve.x) : null;
    });
    const calcanhar = prepararSerie(relativo(`calcanhar_${s}`, `tornozelo_${s}`), trilha.fps);
    const ponta = prepararSerie(relativo(`pe_${s}`, `tornozelo_${s}`), trilha.fps);
    const vals = finitos(calcanhar);
    if (vals.length < distMin * 2) continue;
    const amplitude = percentil(vals, 0.95) - percentil(vals, 0.05);
    if (amplitude < AMPLITUDE_MIN_PCT_ALTURA * trilha.altura) continue;
    const prom = amplitude * 0.3;
    const brutos = [
      ...extremosLocais(calcanhar, 'max', distMin, prom).map((i) => ({ i, tipo: 'contato' as const, v: calcanhar[i] as number })),
      ...extremosLocais(ponta, 'min', distMin, prom).map((i) => ({ i, tipo: 'saida' as const, v: -(ponta[i] as number) })),
    ];
    eventos.push(...montar(trilha, lado, alternar(brutos)));
  }
  return ordenar(eventos);
}

/**
 * Corrida: o contato inicial é o primeiro quadro em que o calcanhar chega à sua posição mais baixa (Fellin et al., 2010; PMID 20478742:
 * mínimo da altura do marcador do calcanhar, com erro absoluto de cerca de 22–25 ms em marcadores), e a saída do pé é o pico de extensão do
 * joelho que antecede a fase de balanço (mesmo estudo: erro de cerca de 5 ms). Em vídeo comum o erro é de um ou dois quadros.
 */
export function detectarEventosCorrida(trilha: TrilhaPose, opcoes: OpcoesEventos = {}): EventoPasso[] {
  const d = opcoes.direcao ?? estimarDirecao(trilha);
  const distMin = Math.max(2, Math.round((opcoes.distMinS ?? DIST_MIN_CORRIDA_S) * trilha.fps));
  const eventos: EventoPasso[] = [];
  for (const lado of ['D', 'E'] as const) {
    const s = lado.toLowerCase();
    const altura = prepararSerie(trilha.quadros.map((q) => (pontoDoQuadro(q, `calcanhar_${s}`) ?? pontoDoQuadro(q, `tornozelo_${s}`))?.y ?? null), trilha.fps);
    const vals = finitos(altura);
    if (vals.length < distMin * 2) continue;
    const amplitude = percentil(vals, 0.97) - percentil(vals, 0.03);
    if (amplitude < AMPLITUDE_MIN_PCT_ALTURA * trilha.altura) continue;

    // O calcanhar fica no ponto mais baixo (maior y) durante todo o apoio: o contato é o começo desse trecho.
    const contatos = extremosLocais(altura, 'max', distMin, amplitude * 0.25, Math.round(0.5 * trilha.fps)).map((pico) => {
      const limite = (altura[pico] as number) - amplitude * 0.12;
      let i = pico;
      while (i > 0 && i > pico - distMin && altura[i - 1] !== null && (altura[i - 1] as number) >= limite) i--;
      return i;
    });
    for (const i of contatos) eventos.push({ id: idDe(lado, 'contato', i), lado, tipo: 'contato', i, t: trilha.quadros[i].t, sugerido: true });

    const joelho = prepararSerie(grausDaSerie(angulosPorQuadro(trilha, anguloJoelho(lado), { direcao: d })), trilha.fps);
    const passadas = contatos.slice(1).map((c, k) => c - contatos[k]);
    const tipica = passadas.length ? percentil(passadas, 0.5) : distMin * 4;
    contatos.forEach((c, k) => {
      const proximo = k + 1 < contatos.length ? contatos[k + 1] : Math.min(trilha.quadros.length, c + Math.round(tipica));
      if (k + 1 >= contatos.length && trilha.quadros.length - c < tipica * 0.9) return;
      const fim = proximo - 1;
      if (fim - c < 3) return;
      let pico = -1;
      for (let j = Math.max(c + 1, c + Math.floor((fim - c) * 0.15)); j <= fim; j++) {
        const v = joelho[j];
        if (v !== null && (pico < 0 || v > (joelho[pico] as number))) pico = j;
      }
      if (pico < 0) return;
      let apoio = -1;
      for (let j = c; j <= c + Math.floor((pico - c) * 0.5); j++) {
        const v = joelho[j];
        if (v !== null && (apoio < 0 || v > (joelho[apoio] as number))) apoio = j;
      }
      if (apoio < 0) return;
      let saida = -1;
      for (let j = apoio; j <= pico; j++) {
        const v = joelho[j];
        if (v !== null && (saida < 0 || v < (joelho[saida] as number))) saida = j;
      }
      if (saida > c) eventos.push({ id: idDe(lado, 'saida', saida), lado, tipo: 'saida', i: saida, t: trilha.quadros[saida].t, sugerido: true });
    });
  }
  return ordenar(eventos);
}

// ---------- edição pelo profissional ----------

const limitarIndice = (trilha: TrilhaPose, i: number) => Math.min(trilha.quadros.length - 1, Math.max(0, Math.round(i)));

/** Cria um evento no quadro `i` (substitui um evento igual que já exista no mesmo quadro). */
export function adicionarEvento(lista: EventoPasso[], trilha: TrilhaPose, lado: Lado, tipo: EventoPasso['tipo'], i: number): EventoPasso[] {
  if (!trilha.quadros.length) return lista;
  const k = limitarIndice(trilha, i);
  const id = idDe(lado, tipo, k);
  const sem = lista.filter((e) => e.id !== id);
  return ordenar([...sem, { id, lado, tipo, i: k, t: trilha.quadros[k].t, sugerido: false }]);
}

/** Move um evento para outro quadro (ele deixa de ser sugestão). */
export function moverEvento(lista: EventoPasso[], trilha: TrilhaPose, id: string, novoIndice: number): EventoPasso[] {
  const alvo = lista.find((e) => e.id === id);
  if (!alvo || !trilha.quadros.length) return lista;
  return adicionarEvento(lista.filter((e) => e.id !== id), trilha, alvo.lado, alvo.tipo, novoIndice);
}

export const removerEvento = (lista: EventoPasso[], id: string): EventoPasso[] => lista.filter((e) => e.id !== id);

export const eventosDo = (lista: EventoPasso[], lado: Lado, tipo: EventoPasso['tipo']): EventoPasso[] =>
  lista.filter((e) => e.lado === lado && e.tipo === tipo).sort((a, b) => a.i - b.i);
