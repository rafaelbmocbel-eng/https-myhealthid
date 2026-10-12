import { alturaEmPixels, girar, medidasDaVista, type ContextoMedida, type Medida, type OlharPara, type Ponto, type RefCompasso, type UnidadePrumo, type UnidadeResultado, type Vista } from './medidas';
import type { MedidaSalva } from './comparar';
import { contextoDesenho, itensDaMedida, ordenarCamadas, separarRotulos, type ItemDesenho } from './desenho';
import { pintarItens } from './desenharCanvas';
import { escalaDoEstiloNaArte, rotuloValor, type EstiloMarcacao } from './estilo';

/*
 * Estado serializável de uma análise em foto e o que se tira dele: resultados, itens de desenho,
 * a foto marcada (canvas) e o pacote para a arte social. A tela, o PDF, o comparador e a arte
 * usam as mesmas funções, por isso as marcações saem iguais em todos.
 */

export interface OpcoesAnalise {
  /** Referência do compasso com referência. */
  compassoRef: RefCompasso;
  /** Unidade em que o fio de prumo informa o desvio. */
  unidadePrumo: UnidadePrumo;
  /** Para onde o paciente olha na foto de perfil (lado da imagem). */
  olhaPara: OlharPara;
}

export const OPCOES_ANALISE_PADRAO: OpcoesAnalise = { compassoRef: 'baixo', unidadePrumo: 'graus', olhaPara: 'direita' };

export interface AnaliseFotoJson {
  vista: Vista;
  /** Tamanho da foto original, em px. */
  largura: number;
  altura: number;
  /** Pontos marcados de cada medida, em px da foto, na ordem de marcação. */
  pontos: Record<string, Ponto[]>;
  /** Correção de nível (graus) já resolvida, a partir de uma referência marcada ou do sensor; null sem correção. */
  giro: number | null;
  /** Centímetros por pixel já resolvidos a partir da escala marcada; null sem escala. */
  cmPorPx: number | null;
  opcoes: OpcoesAnalise;
}

/** Análise de uma foto. Tudo é JSON, exceto `imagem`, que fica fora de `analiseParaJson`. */
export interface AnaliseFoto extends AnaliseFotoJson {
  /** Fonte desenhável da foto (img, canvas ou bitmap). Não é gravada em lugar nenhum. */
  imagem?: CanvasImageSource | null;
}

export function analiseParaJson(a: AnaliseFoto): AnaliseFotoJson {
  const { imagem: _imagem, ...resto } = a;
  void _imagem;
  return JSON.parse(JSON.stringify(resto)) as AnaliseFotoJson;
}

const ehPonto = (p: unknown): p is Ponto => !!p && typeof p === 'object' && Number.isFinite((p as Ponto).x) && Number.isFinite((p as Ponto).y);

/** Lê uma análise vinda de JSON; null se faltar o essencial. Pontos inválidos são descartados. */
export function analiseDeJson(bruto: unknown): AnaliseFotoJson | null {
  if (!bruto || typeof bruto !== 'object') return null;
  const o = bruto as Record<string, unknown>;
  if (o.vista !== 'frente' && o.vista !== 'costas' && o.vista !== 'perfil') return null;
  const largura = Number(o.largura), altura = Number(o.altura);
  if (!(largura > 0) || !(altura > 0)) return null;
  const pontos: Record<string, Ponto[]> = {};
  if (o.pontos && typeof o.pontos === 'object') {
    for (const [id, lista] of Object.entries(o.pontos as Record<string, unknown>)) {
      if (Array.isArray(lista)) pontos[id] = lista.filter(ehPonto).map((p) => ({ x: p.x, y: p.y }));
    }
  }
  const op = (o.opcoes && typeof o.opcoes === 'object' ? o.opcoes : {}) as Partial<OpcoesAnalise>;
  const refs: RefCompasso[] = ['baixo', 'cima', 'esquerda', 'direita'];
  const unidades: UnidadePrumo[] = ['graus', 'cm', 'pct'];
  const numOuNulo = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return {
    vista: o.vista, largura, altura, pontos,
    giro: numOuNulo(o.giro), cmPorPx: numOuNulo(o.cmPorPx),
    opcoes: {
      compassoRef: refs.includes(op.compassoRef as RefCompasso) ? (op.compassoRef as RefCompasso) : OPCOES_ANALISE_PADRAO.compassoRef,
      unidadePrumo: unidades.includes(op.unidadePrumo as UnidadePrumo) ? (op.unidadePrumo as UnidadePrumo) : OPCOES_ANALISE_PADRAO.unidadePrumo,
      olhaPara: op.olhaPara === 'esquerda' ? 'esquerda' : 'direita',
    },
  };
}

const completa = (m: Medida, p: Ponto[] | undefined): p is Ponto[] => !!p && p.length >= m.pontos.length;
const corrigir = (p: Ponto[], giro: number | null) => (giro ? p.map((q) => girar(q, -giro)) : p);

/** Altura do paciente na foto (px), se a referência de altura estiver marcada. */
export function alturaDaAnalise(a: AnaliseFotoJson): number | null {
  const p = a.pontos.altura;
  return p && p.length >= 2 ? alturaEmPixels(corrigir(p.slice(0, 2), a.giro)) : null;
}

export function contextoDaAnalise(a: AnaliseFotoJson): ContextoMedida {
  return { cmPorPx: a.cmPorPx, vista: a.vista, refCompasso: a.opcoes.compassoRef, unidadePrumo: a.opcoes.unidadePrumo, olhaPara: a.opcoes.olhaPara, alturaPx: alturaDaAnalise(a) };
}

export interface ResultadoAnalise {
  /** Identifica o resultado entre avaliações; no fio de prumo inclui a unidade (cm, pct, graus). */
  id: string;
  medidaId: string;
  nome: string;
  /** Valor medido; com sinal em inclinação pélvica, retropé e fio de prumo. */
  valor: number;
  unidade: UnidadeResultado;
  texto: string;
  /** Lado do desvio, quando o valor tem sinal (ex.: "anterior", "valgo", "à frente do fio"). */
  sentido?: string;
  /** Nome curto que antecede o valor no rótulo (fio de prumo). */
  curto?: string;
  /** Índice do ponto onde o rótulo é desenhado (fio de prumo). */
  ponto?: number;
}

/** Resultado de cada medida completa, já corrigido pelo nível e com a escala. */
export function calcularResultados(a: AnaliseFotoJson): ResultadoAnalise[] {
  const ctx = contextoDaAnalise(a);
  return medidasDaVista(a.vista).flatMap((m): ResultadoAnalise[] => {
    if (m.auxiliar) return [];
    const p = a.pontos[m.id];
    if (!completa(m, p)) return [];
    const pts = corrigir(p, a.giro);
    if (m.calcularVarios) {
      return m.calcularVarios(pts, ctx).map((r) => ({
        id: `${m.id}-${r.id}`, medidaId: m.id, nome: r.nome, valor: r.valor, unidade: r.unidade, texto: r.texto, sentido: r.sentido, curto: r.curto, ponto: r.ponto,
      }));
    }
    const r = m.calcular(pts, ctx);
    return r ? [{ id: m.id, medidaId: m.id, nome: m.nome, valor: r.valor, unidade: m.unidade === 'cm' ? 'cm' : 'graus', texto: r.texto, sentido: r.sentido }] : [];
  });
}

/** Por que o fio de prumo ainda não mostra resultado na unidade escolhida (null se nada falta). */
export function faltaReferenciaDoPrumo(a: AnaliseFotoJson): string | null {
  if (a.opcoes.unidadePrumo === 'cm' && !a.cmPorPx) return 'Para ver o desvio em centímetros, calibre a escala (em “Referências da foto”).';
  if (a.opcoes.unidadePrumo === 'pct' && !alturaDaAnalise(a)) return 'Para ver o desvio em % da altura, marque a altura do paciente (em “Referências da foto”).';
  return null;
}

/**
 * Medidas como ficam gravadas na nota do prontuário (`dados_extras.medidas`). O valor vai em módulo e o lado em
 * `sentido` (varo, valgo, anterior, à frente do fio...), como em `MedidaSalva`: o sinal do cálculo nunca vai para as tabelas.
 */
export function medidasSalvas(rs: ResultadoAnalise[]): MedidaSalva[] {
  return rs.map((r) => ({
    id: r.id, graus: Math.round(Math.abs(r.valor) * 10) / 10, texto: r.texto,
    ...(r.unidade === 'cm' ? { unidade: 'cm' as const } : r.unidade === '%' ? { unidade: '%' as const } : {}),
    ...(r.sentido ? { sentido: r.sentido } : {}),
  }));
}

/** "118,4°", "12,3 cm" ou "2,1%"; o valor sai sem sinal (o lado fica no texto do resultado). */
export function formatarResultado(r: Pick<ResultadoAnalise, 'valor' | 'unidade'>, casas: 0 | 1 = 1): string {
  return rotuloValor(Math.abs(r.valor), r.unidade, casas);
}

const baixoNaImagem = (giro: number | null): Ponto => (giro ? girar({ x: 0, y: 1 }, giro) : { x: 0, y: 1 });

/**
 * Onde fica a alça de arrastar do fio de prumo: no topo da linha, longe dos pontos (orelha, ombro,
 * quadril e joelho ficam colados no fio, e uma linha com área de toque os bloquearia).
 */
export function alcaDoPrumo(apoio: Ponto, altura: number, giro: number | null, fracaoDoTopo = 0.05): Ponto {
  const baixo = baixoNaImagem(giro);
  if (baixo.y < 1e-6) return apoio;
  const t = (apoio.y - Math.min(altura * fracaoDoTopo, Math.max(apoio.y - 1, 0))) / baixo.y;
  return { x: apoio.x - baixo.x * t, y: apoio.y - baixo.y * t };
}

/** Novo apoio quando a alça é arrastada até `p`: o fio passa por `p` e o apoio mantém a altura. */
export function apoioPelaAlca(p: Ponto, apoio: Ponto, giro: number | null, largura: number): Ponto {
  const baixo = baixoNaImagem(giro);
  if (baixo.y < 1e-6) return apoio;
  const s = (apoio.y - p.y) / baixo.y;
  return { x: Math.min(Math.max(p.x + baixo.x * s, 0), largura), y: apoio.y };
}

export interface OpcoesItens {
  /** Zoom da tela: o desenho cresce menos que a foto. Ignorado se `k` vier. */
  zoom?: number;
  /** Escala do estilo já resolvida (na tela, ver `escalaNaTela`). */
  k?: number;
  /** Inclui nível, escala e altura. */
  auxiliares?: boolean;
  /** Espessura mínima das retas em px da foto (só na tela). */
  espMinima?: number;
}

/** Itens de desenho de todas as medidas marcadas, prontos para o SVG ou o canvas pintarem. */
export function itensDaAnalise(a: AnaliseFotoJson, estilo: EstiloMarcacao, o: OpcoesItens = {}): ItemDesenho[] {
  const c = contextoDesenho(a.largura, a.altura, estilo, { zoom: o.zoom, k: o.k, giro: a.giro, espMin: o.espMinima });
  const casas = estilo.casasRotulo ?? 1;
  const resultados = calcularResultados(a);
  const itens = medidasDaVista(a.vista).flatMap((m) => {
    const p = a.pontos[m.id];
    if (!p?.length || (m.auxiliar && o.auxiliares === false)) return [];
    const meus = resultados.filter((r) => r.medidaId === m.id);
    const rot: { principal?: string; porPonto?: Record<number, string> } = {};
    if (m.calcularVarios) {
      rot.porPonto = {};
      for (const r of meus) if (r.ponto !== undefined) rot.porPonto[r.ponto] = `${r.curto ?? ''} ${formatarResultado(r, casas)}`.trim();
    } else if (meus[0]) {
      rot.principal = formatarResultado(meus[0], casas);
    }
    return itensDaMedida(m, p, rot, c, { olhaPara: a.opcoes.olhaPara, refCompasso: a.opcoes.compassoRef });
  });
  return separarRotulos(ordenarCamadas(itens), a.largura, a.altura);
}

export interface OpcoesCanvas extends OpcoesItens {
  /** Maior lado do canvas, em px (a foto é reduzida, nunca ampliada). */
  ladoMax?: number;
  /** Largura máxima do canvas, em px. */
  larguraMax?: number;
  /** Só a foto, sem marcações. */
  semMarcacoes?: boolean;
  /** Só as marcações, sobre fundo transparente. */
  semFoto?: boolean;
}

/**
 * Foto com as marcações num canvas. Espessura, arco e rótulo seguem o menor lado da foto, então
 * o resultado sai com a mesma proporção da tela, do PDF e da arte. Null sem foto ou sem canvas.
 */
export function canvasComMedidas(a: AnaliseFoto, estilo: EstiloMarcacao, o: OpcoesCanvas = {}): HTMLCanvasElement | null {
  if (!a.imagem || typeof document === 'undefined') return null;
  let reduz = Math.min(1, (o.ladoMax ?? 2160) / Math.max(a.largura, a.altura));
  if (o.larguraMax) reduz = Math.min(reduz, o.larguraMax / a.largura);
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(a.largura * reduz));
  cv.height = Math.max(1, Math.round(a.altura * reduz));
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  if (!o.semFoto) ctx.drawImage(a.imagem, 0, 0, cv.width, cv.height);
  if (!o.semMarcacoes) {
    ctx.scale(cv.width / a.largura, cv.height / a.altura);
    pintarItens(ctx, itensDaAnalise(a, estilo, { auxiliares: false, ...o, k: o.k }));
  }
  return cv;
}

/** Foto marcada em JPEG reduzido para o PDF (inclui nível, escala e altura, como no relatório anterior). */
export function imagemParaPdf(a: AnaliseFoto, estilo: EstiloMarcacao, larguraMax = 1100): { url: string; w: number; h: number } | null {
  const cv = canvasComMedidas(a, estilo, { larguraMax, ladoMax: larguraMax * 2, auxiliares: true });
  return cv ? { url: cv.toDataURL('image/jpeg', 0.88), w: cv.width, h: cv.height } : null;
}

export interface PainelParaExportar {
  rotulo: string;
  data?: string;
  /** Foto já com as marcações, sem rótulos de arte. */
  imagem: HTMLCanvasElement | ImageBitmap | string;
  largura: number;
  altura: number;
  /**
   * A mesma imagem em duas camadas, do tamanho de `imagem`: a foto limpa e só as marcações (fundo transparente).
   * A arte esconde o rosto na foto limpa e só depois pinta as marcações, para o desfoque não apagar rótulos e linhas.
   */
  camadas?: { foto: HTMLCanvasElement | ImageBitmap; marcacoes: HTMLCanvasElement | ImageBitmap };
  /**
   * Refaz a camada de marcações para a foto aparecer na arte com `pxArtePorPxFoto` pixels da arte por pixel de `imagem`:
   * a espessura e o rótulo ficam do mesmo tamanho na arte, qualquer que seja o tamanho da foto na moldura.
   */
  marcacoesNaEscala?: (pxArtePorPxFoto: number) => HTMLCanvasElement | null;
}

/** Painel da arte social a partir de uma análise: a foto marcada e as camadas separadas. Null sem foto ou sem canvas. */
export function painelParaExportar(a: AnaliseFoto, estilo: EstiloMarcacao, o: { rotulo?: string; data?: string; ladoMax?: number } = {}): PainelParaExportar | null {
  const ladoMax = o.ladoMax ?? 2160;
  const imagem = canvasComMedidas(a, estilo, { ladoMax, auxiliares: false });
  const foto = canvasComMedidas(a, estilo, { ladoMax, semMarcacoes: true });
  const marcacoes = canvasComMedidas(a, estilo, { ladoMax, auxiliares: false, semFoto: true });
  if (!imagem) return null;
  // A foto do canvas pode ser menor que a original (`ladoMax`): o desenho é em pixels da original.
  const reducao = imagem.width / a.largura;
  const marcacoesNaEscala = (pxArtePorPxFoto: number) =>
    canvasComMedidas(a, estilo, { ladoMax, auxiliares: false, semFoto: true, k: escalaDoEstiloNaArte(pxArtePorPxFoto * reducao) });
  return {
    rotulo: o.rotulo ?? '', data: o.data, imagem, largura: imagem.width, altura: imagem.height,
    ...(foto && marcacoes ? { camadas: { foto, marcacoes }, marcacoesNaEscala } : {}),
  };
}

/** O que a arte social recebe: uma ou duas fotos marcadas e a lista de medidas. */
export interface AnaliseParaExportar {
  titulo?: string;
  legenda?: string;
  paineis: PainelParaExportar[];
  medidas: { nome: string; valor: string }[];
}

export interface OpcoesExportar {
  rotulo?: string;
  data?: string;
  titulo?: string;
  legenda?: string;
  ladoMax?: number;
}

/** Medidas como pares nome/valor para a arte: o valor sai sem sinal, seguido do lado quando há. */
export function medidasParaArte(rs: ResultadoAnalise[], casas: 0 | 1 = 1): { nome: string; valor: string }[] {
  return rs.map((r) => ({ nome: r.nome, valor: `${formatarResultado(r, casas)}${r.sentido ? ` (${r.sentido})` : ''}` }));
}

/** Pacote da foto marcada para a arte social; null se a foto não puder ser desenhada. */
export function analiseDaFotoParaExportar(a: AnaliseFoto, estilo: EstiloMarcacao, o: OpcoesExportar = {}): AnaliseParaExportar | null {
  const painel = painelParaExportar(a, estilo, o);
  if (!painel) return null;
  return {
    titulo: o.titulo, legenda: o.legenda,
    paineis: [painel],
    medidas: medidasParaArte(calcularResultados(a), estilo.casasRotulo ?? 1),
  };
}

/** Nome do arquivo da imagem baixada: só a vista e a data, nunca dados do paciente. */
export function nomeArquivoImagem(vista: Vista, data: Date = new Date(), extensao = 'png'): string {
  const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(data);
  return `analise-angular-${vista}-${d}.${extensao}`;
}

export function canvasParaBlob(cv: HTMLCanvasElement, tipo = 'image/png', qualidade?: number): Promise<Blob | null> {
  return new Promise((ok) => { cv.toBlob((b) => ok(b), tipo, qualidade); });
}

/** Baixa o arquivo no aparelho (no celular, vai para Arquivos ou Fotos). */
export function baixarBlob(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome; a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
