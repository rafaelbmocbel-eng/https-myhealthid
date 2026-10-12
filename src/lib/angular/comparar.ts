import { MEDIDAS, nomeDoResultado } from './medidas';

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
// publicada no app para classificar os ângulos, e nos desníveis o número não traz o lado
// (o lado vem no texto de cada avaliação).
export function compararMedidas(atual: MedidaSalva[], anterior: MedidaSalva[]): LinhaComparacao[] {
  const ids = [...new Set([...atual.map((m) => m.id), ...anterior.map((m) => m.id)])];
  return ids.map((id) => {
    const a = atual.find((m) => m.id === id) ?? null;
    const b = anterior.find((m) => m.id === id) ?? null;
    return { id, nome: nomeDa(id), atual: a, anterior: b, variacao: a && b ? Math.round((a.graus - b.graus) * 10) / 10 : null };
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
