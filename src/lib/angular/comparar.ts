import { MEDIDAS, nomeDoResultado } from './medidas';
import { ROTULO_VISTA_SESSAO, VISTAS_DA_SESSAO, type VistaSessao } from './tiposSessao';

export type UnidadeMedida = 'cm' | '%';

/** Medida como fica gravada em `dados_extras.medidas` da nota do prontuário. */
export interface MedidaSalva {
  id: string;
  graus: number;
  texto?: string;
  /** Sem isso, o valor é em graus (registros antigos). */
  unidade?: UnidadeMedida;
  /** Lado do desvio quando o valor tem sinal (ex.: "anterior", "valgo", "à frente do fio"); `graus` vem sem sinal. */
  sentido?: string;
}

export interface LinhaComparacao {
  id: string;
  nome: string;
  atual: MedidaSalva | null;
  anterior: MedidaSalva | null;
  /** atual − anterior, em graus, com uma casa; null se faltar um dos lados. */
  variacao: number | null;
}

const nomeDa = (id: string) => (id === 'sensor' ? 'Inclinação pelo sensor do celular' : nomeDoResultado(id) ?? id);

// Só mostra a variação numérica, sem dizer "melhorou" ou "piorou": não há referência
// publicada no app para classificar os ângulos, e o número não traz o lado (o lado vem no
// texto e em `sentido` de cada avaliação). Se o lado mudou entre as duas, subtrair os números
// seria enganoso: a variação fica em branco, como no comparador de fotos (`parearMedidas`).
export function compararMedidas(atual: MedidaSalva[], anterior: MedidaSalva[]): LinhaComparacao[] {
  const ids = [...new Set([...atual.map((m) => m.id), ...anterior.map((m) => m.id)])];
  return ids.map((id) => {
    const a = atual.find((m) => m.id === id) ?? null;
    const b = anterior.find((m) => m.id === id) ?? null;
    const sa = a ? sentidoDe(a) : null, sb = b ? sentidoDe(b) : null;
    const ladoTrocado = !!sa && !!sb && sa.categoria === sb.categoria && sa.lado !== sb.lado;
    return { id, nome: nomeDa(id), atual: a, anterior: b, variacao: a && b && !ladoTrocado ? Math.round((a.graus - b.graus) * 10) / 10 : null };
  });
}

const SUFIXOS: Record<UnidadeMedida, string> = { cm: ' cm', '%': '%' };
const sufixo = (u?: UnidadeMedida) => (u ? SUFIXOS[u] : '°');
const num = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const grau = (n: number | null | undefined, u?: UnidadeMedida) => (n == null ? '—' : `${num(n)}${sufixo(u)}`);

export const variacaoTexto = (v: number | null, u?: UnidadeMedida) =>
  v === null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${num(Math.abs(v))}${sufixo(u)}`;

// ---------------------------------------------------------------------------
// Comparação de duas fotos (lado a lado): a mesma medida marcada nas duas.
// ---------------------------------------------------------------------------

/** Para onde a medida "pende": o lado do desnível, do desvio ou do valor com sinal. */
export interface Sentido {
  /** Tipo de sentido: só se compara lado com lado do mesmo tipo. */
  categoria: string;
  lado: string;
  /** Texto curto para mostrar sob o valor. */
  rotulo: string;
}

const PADROES_SENTIDO: { re: RegExp; ler: (m: RegExpMatchArray) => Sentido }[] = [
  { re: /lado (direito|esquerdo) mais alto/i, ler: (m) => ({ categoria: 'alto', lado: m[1].toLowerCase(), rotulo: `${m[1].toLowerCase()} mais alto` }) },
  { re: /desviado para a (direita|esquerda) da imagem/i, ler: (m) => ({ categoria: 'desvio', lado: `${m[1].toLowerCase()} da imagem`, rotulo: `desvio para a ${m[1].toLowerCase()} da imagem` }) },
  { re: /sobe para a (direita|esquerda) da imagem/i, ler: (m) => ({ categoria: 'sobe', lado: `${m[1].toLowerCase()} da imagem`, rotulo: `sobe para a ${m[1].toLowerCase()} da imagem` }) },
];

/** Lê do texto do resultado o lado do desnível ou do desvio; null se o texto não traz lado. */
export function sentidoDoTexto(texto?: string): Sentido | null {
  if (!texto) return null;
  for (const { re, ler } of PADROES_SENTIDO) {
    const m = texto.match(re);
    if (m) return ler(m);
  }
  return null;
}

/** Sentido de uma medida: o informado pelo cálculo ou, nos desníveis, o lido do texto. Valor zero não tem lado. */
export function sentidoDe(m: Pick<MedidaSalva, 'graus' | 'texto' | 'sentido'>): Sentido | null {
  if (m.graus === 0) return null;
  if (m.sentido) return { categoria: 'informado', lado: m.sentido, rotulo: m.sentido };
  return sentidoDoTexto(m.texto);
}

export type MotivoSemDiferenca = 'falta-antes' | 'falta-depois' | 'unidades-diferentes' | 'lado-trocado';

export interface LinhaPareada {
  id: string;
  nome: string;
  antes: MedidaSalva | null;
  depois: MedidaSalva | null;
  /** Unidade comum às duas (undefined = graus). */
  unidade?: UnidadeMedida;
  /** depois − antes, com uma casa, na mesma unidade; null quando não dá para comparar (veja `motivo`). */
  diferenca: number | null;
  motivo?: MotivoSemDiferenca;
  sentidoAntes: Sentido | null;
  sentidoDepois: Sentido | null;
}

// Os resultados do fio de prumo têm id composto (prumo-perfil-orelha-cm): entram na ordem da medida de origem.
const ordemDaMedida = (id: string) => {
  let i = MEDIDAS.findIndex((m) => m.id === id);
  if (i < 0) i = MEDIDAS.findIndex((m) => id.startsWith(`${m.id}-`));
  return i < 0 ? Number.MAX_SAFE_INTEGER : i;
};

/**
 * Casa as medidas das duas fotos pelo id e calcula depois − antes. Nunca mistura unidades
 * (° com cm) nem compara desníveis de lados opostos: nesses casos devolve `diferenca: null`
 * e o motivo. Não classifica a mudança como melhora ou piora.
 */
export function parearMedidas(antes: MedidaSalva[], depois: MedidaSalva[]): LinhaPareada[] {
  const ids = [...new Set([...antes.map((m) => m.id), ...depois.map((m) => m.id)])];
  ids.sort((x, y) => ordemDaMedida(x) - ordemDaMedida(y));
  return ids.map((id) => {
    const a = antes.find((m) => m.id === id) ?? null;
    const d = depois.find((m) => m.id === id) ?? null;
    const sentidoAntes = a ? sentidoDe(a) : null;
    const sentidoDepois = d ? sentidoDe(d) : null;
    const base = { id, nome: nomeDa(id), antes: a, depois: d, sentidoAntes, sentidoDepois };
    if (!a) return { ...base, unidade: d?.unidade, diferenca: null, motivo: 'falta-antes' as const };
    if (!d) return { ...base, unidade: a.unidade, diferenca: null, motivo: 'falta-depois' as const };
    if (a.unidade !== d.unidade) return { ...base, diferenca: null, motivo: 'unidades-diferentes' as const };
    if (sentidoAntes && sentidoDepois && sentidoAntes.categoria === sentidoDepois.categoria && sentidoAntes.lado !== sentidoDepois.lado) {
      return { ...base, unidade: a.unidade, diferenca: null, motivo: 'lado-trocado' as const };
    }
    const dif = Math.round((d.graus - a.graus) * 10) / 10;
    return { ...base, unidade: a.unidade, diferenca: dif === 0 ? 0 : dif };
  });
}

/** Frase curta que explica por que uma linha não tem diferença numérica. */
export function motivoTexto(l: Pick<LinhaPareada, 'motivo' | 'sentidoAntes' | 'sentidoDepois'>, rotuloAntes = 'Pré', rotuloDepois = 'Pós'): string | null {
  switch (l.motivo) {
    case 'falta-antes': return `Falta marcar na foto ${rotuloAntes}.`;
    case 'falta-depois': return `Falta marcar na foto ${rotuloDepois}.`;
    case 'unidades-diferentes': return 'As duas fotos têm unidades diferentes (° e cm): não dá para subtrair.';
    case 'lado-trocado': return `O lado mudou (${l.sentidoAntes?.rotulo} para ${l.sentidoDepois?.rotulo}): subtrair os números seria enganoso.`;
    default: return null;
  }
}

export const TEXTO_NAO_CLASSIFICA = 'A diferença é só numérica: não indica melhora ou piora. Vale para fotos feitas do mesmo jeito (distância, altura da câmera e posição do paciente).';

/** Forma mínima de um resultado de análise (a mesma de `ResultadoAnalise`) para virar `MedidaSalva`. */
export interface ResultadoParaComparar { id: string; valor: number; unidade: 'graus' | 'cm' | '%'; texto: string; sentido?: string }

/**
 * Resultados de uma foto como medidas comparáveis. O valor vai sem sinal e o lado em `sentido`:
 * a diferença entre duas fotos só vale entre valores do mesmo lado (ver `parearMedidas`).
 */
export const medidasParaComparar = (rs: ResultadoParaComparar[]): MedidaSalva[] =>
  rs.map((r) => ({
    id: r.id, graus: Math.round(Math.abs(r.valor) * 10) / 10, texto: r.texto,
    ...(r.unidade === 'cm' ? { unidade: 'cm' as const } : r.unidade === '%' ? { unidade: '%' as const } : {}),
    ...(r.sentido ? { sentido: r.sentido } : {}),
  }));

/** "118,0° → 144,0° (+26,0°)" — o valor de cada medida na arte compartilhada. */
export function valorParaExportar(l: LinhaPareada): string | null {
  if (!l.antes || !l.depois) return null;
  const lado = (v: string, s: Sentido | null) => (l.motivo === 'lado-trocado' && s ? `${v} (${s.rotulo})` : v);
  const par = `${lado(grau(l.antes.graus, l.antes.unidade), l.sentidoAntes)} → ${lado(grau(l.depois.graus, l.depois.unidade), l.sentidoDepois)}`;
  return l.diferenca === null ? par : `${par} (${variacaoTexto(l.diferenca, l.unidade)})`;
}

export interface MedidaExportada { nome: string; valor: string }

/** Só as medidas que existem nas duas fotos entram na arte. */
export const medidasParaExportar = (linhas: LinhaPareada[]): MedidaExportada[] =>
  linhas.flatMap((l) => {
    const valor = valorParaExportar(l);
    return valor ? [{ nome: l.nome, valor }] : [];
  });

// ---------------------------------------------------------------------------
// Comparação de duas sessões (avaliações) posição por posição: frente, perfis e costas.
// ---------------------------------------------------------------------------

/** Posição de uma nota: as quatro da sessão mais o perfil de nota antiga, que nunca teve o lado gravado. */
export type PosicaoDaNota = VistaSessao | 'perfil_sem_lado';

/** Ordem de exibição: a ordem de fotografar e, por último, o perfil sem lado informado. */
export const POSICOES_DA_NOTA: readonly PosicaoDaNota[] = [...VISTAS_DA_SESSAO, 'perfil_sem_lado'];

export const ROTULO_POSICAO_DA_NOTA: Record<PosicaoDaNota, string> = {
  ...ROTULO_VISTA_SESSAO,
  perfil_sem_lado: 'Perfil (lado não informado)',
};

/** O que a comparação precisa de uma posição: as medidas e a correção de nível da foto. */
export interface PosicaoParaComparar {
  medidas: MedidaSalva[];
  /** Correção de nível da foto, em graus. null, 0 ou ausente = sem correção registrada. */
  nivelGraus?: number | null;
}

/** Uma avaliação para comparar: as posições feitas e o esquema (versão do formato) em que foram gravadas. */
export interface SessaoParaComparar {
  esquema?: number;
  posicoes: Partial<Record<PosicaoDaNota, PosicaoParaComparar>>;
}

export interface LinhaSessao extends LinhaPareada {
  /** Por que a linha não tem diferença numérica (ou que a medida é nova); null quando é só a subtração. */
  explicacao: string | null;
}

export type SituacaoPosicao = 'ambas' | 'so_atual' | 'so_anterior';

export type TipoAviso = 'nivel_diferente' | 'posicao_ausente' | 'esquemas_diferentes' | 'perfil_sem_lado';

/** Aviso neutro: descreve uma diferença entre as avaliações sem julgá-la e sem exigir valor de referência. */
export interface AvisoComparacao {
  tipo: TipoAviso;
  posicao?: PosicaoDaNota;
  texto: string;
}

export interface ComparacaoPosicao {
  posicao: PosicaoDaNota;
  rotulo: string;
  situacao: SituacaoPosicao;
  /** Medidas pareadas (anterior → atual); vazio quando a posição só existe em uma das avaliações. */
  linhas: LinhaSessao[];
  avisos: AvisoComparacao[];
}

export interface ComparacaoSessoes {
  /** Só as posições que existem em pelo menos uma das duas, na ordem de POSICOES_DA_NOTA. */
  posicoes: ComparacaoPosicao[];
  /** Avisos que valem para a comparação toda (formatos diferentes, perfil sem lado). */
  avisos: AvisoComparacao[];
  textoNaoClassifica: typeof TEXTO_NAO_CLASSIFICA;
}

/** Frase de uma linha da comparação entre sessões; null quando a linha é só a subtração. */
export function explicacaoDaLinhaSessao(l: Pick<LinhaPareada, 'motivo' | 'sentidoAntes' | 'sentidoDepois'>): string | null {
  switch (l.motivo) {
    case 'falta-depois': return 'Estava marcada na avaliação anterior; falta marcar agora.';
    case 'falta-antes': return 'Não estava marcada na avaliação anterior.';
    case 'unidades-diferentes': return 'As duas avaliações têm unidades diferentes (° e cm): não dá para subtrair.';
    case 'lado-trocado': return motivoTexto(l);
    default: return null;
  }
}

const nivelCorrigido = (n: number | null | undefined) => typeof n === 'number' && Number.isFinite(n) && n !== 0;
const temMedidas = (p: PosicaoParaComparar | undefined): p is PosicaoParaComparar => !!p && p.medidas.length > 0;
// Posição sem nenhuma medida não conta como feita.
const feita = (s: SessaoParaComparar, posicao: PosicaoDaNota) => {
  const p = s.posicoes[posicao];
  return temMedidas(p) ? p : undefined;
};

function avisoDeNivel(posicao: PosicaoDaNota, atual: PosicaoParaComparar, anterior: PosicaoParaComparar): AvisoComparacao | null {
  const a = nivelCorrigido(atual.nivelGraus), b = nivelCorrigido(anterior.nivelGraus);
  if (a === b) return null;
  const quem = a ? 'nesta avaliação' : 'na avaliação anterior';
  const outra = a ? 'na anterior' : 'nesta';
  const graus = Math.abs((a ? atual.nivelGraus : anterior.nivelGraus) as number);
  return {
    tipo: 'nivel_diferente', posicao,
    texto: `${ROTULO_POSICAO_DA_NOTA[posicao]}: ${quem} a foto foi nivelada (correção de ${num(graus)}°); ${outra} não consta correção de nível. Os ângulos podem não ser comparáveis.`,
  };
}

/**
 * Compara duas avaliações posição por posição. Cada posição presente nas duas usa `parearMedidas`
 * (a mesma regra do comparador de fotos: nunca mistura unidades nem lados opostos). Posição de uma
 * só avaliação vira `so_atual` ou `so_anterior`; medida que só existia antes aparece como "falta marcar agora".
 * O perfil de nota antiga (sem lado) só se compara com outro perfil sem lado, nunca com perfil direito ou esquerdo.
 * Não classifica nada como melhora ou piora.
 */
export function compararSessoes(atual: SessaoParaComparar, anterior: SessaoParaComparar): ComparacaoSessoes {
  const posicoes: ComparacaoPosicao[] = [];
  for (const posicao of POSICOES_DA_NOTA) {
    const a = feita(atual, posicao), b = feita(anterior, posicao);
    if (!a && !b) continue;
    const rotulo = ROTULO_POSICAO_DA_NOTA[posicao];
    if (!b) {
      posicoes.push({ posicao, rotulo, situacao: 'so_atual', linhas: [], avisos: [{ tipo: 'posicao_ausente', posicao, texto: `${rotulo}: só nesta avaliação; a anterior não tem essa posição.` }] });
      continue;
    }
    if (!a) {
      posicoes.push({ posicao, rotulo, situacao: 'so_anterior', linhas: [], avisos: [{ tipo: 'posicao_ausente', posicao, texto: `${rotulo}: estava na avaliação anterior e ainda não foi feita nesta.` }] });
      continue;
    }
    const linhas = parearMedidas(b.medidas, a.medidas).map((l) => ({ ...l, explicacao: explicacaoDaLinhaSessao(l) }));
    const avisos: AvisoComparacao[] = [];
    if (posicao === 'perfil_sem_lado') {
      avisos.push({ tipo: 'perfil_sem_lado', posicao, texto: 'Perfil sem lado informado nas duas avaliações: confirme que é o mesmo lado antes de comparar.' });
    }
    const nivel = avisoDeNivel(posicao, a, b);
    if (nivel) avisos.push(nivel);
    posicoes.push({ posicao, rotulo, situacao: 'ambas', linhas, avisos });
  }

  const avisos: AvisoComparacao[] = [];
  if (typeof atual.esquema === 'number' && typeof anterior.esquema === 'number' && atual.esquema !== anterior.esquema) {
    avisos.push({
      tipo: 'esquemas_diferentes',
      texto: `As avaliações foram salvas em versões diferentes do aplicativo (formato ${atual.esquema} e formato ${anterior.esquema}): algumas medidas podem existir só em uma delas.`,
    });
  }
  const comLado = (s: SessaoParaComparar) => !!feita(s, 'perfil_d') || !!feita(s, 'perfil_e');
  const semLado = (s: SessaoParaComparar) => !!feita(s, 'perfil_sem_lado');
  if ((semLado(atual) && !semLado(anterior) && comLado(anterior)) || (semLado(anterior) && !semLado(atual) && comLado(atual))) {
    avisos.push({ tipo: 'perfil_sem_lado', texto: 'Perfil sem lado informado (avaliação antiga) não é comparado com perfil direito ou esquerdo: não dá para saber de que lado foi a foto.' });
  }
  return { posicoes, avisos, textoNaoClassifica: TEXTO_NAO_CLASSIFICA };
}
