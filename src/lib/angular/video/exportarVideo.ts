import { TEMA_ESCURO, pintarGrafico } from '@/lib/angular/analiseVideo/graficoCanvas';
import { layoutDoGrafico, type BandaGrafico, type LayoutGrafico, type MarcadorGrafico, type SerieGrafico } from '@/lib/angular/analiseVideo/graficoLayout';
import { itensDoQuadroAnalisado } from '@/lib/angular/analiseVideo/marcacoes';
import { seriesDoGrupo } from '@/lib/angular/analiseVideo/resultados';
import { tempoDeExibicao } from '@/lib/angular/analiseVideo/tempo';
import { COR_LADO, type CartaoMetricaUi } from '@/lib/angular/analiseVideo/tiposUi';
import { pintarItens } from '@/lib/angular/desenharCanvas';
import { contextoDesenho } from '@/lib/angular/desenho';
import { escalaDoEstiloNaArte, type EstiloMarcacao } from '@/lib/angular/estilo';
import { protegerRosto } from '@/lib/social/borrar';
import { desenharMolduraSocial, layoutDaArte, type OpcoesArte, type RecursosArte, type SeloImagem } from '@/lib/social/desenhar';
import { fonteCss, garantirFontesSociais } from '@/lib/social/fontes';
import { FORMATOS, type FormatoSocial, type Retangulo, type TituloModo } from '@/lib/social/formatos';
import { janelaDaImagem } from '@/lib/social/geometria';
import { escalarCaixaRosto, type CaixaRosto, type ModoRosto } from '@/lib/social/rosto';
import { legendaDosAngulos, type DefinicaoAngulo } from './angulos';
import {
  ErroExportacao, LIMITES_EXPORTACAO, RODAPE_VIDEO, RODAPE_VIDEO_COM_AVISO, erroDeCancelamento, avaliarSuporteGravacao, bitrateDoVideo, calcularLayoutConteudo, duracaoDaSaida,
  ehFormatoSocial, itensDeCartoes, itensDeLinhas, prefixoDaReferencia, progressoDaSaida, quadroNaSaida, quebrarTexto, rotuloTempo, rotuloVelocidade, tamanhoOriginal, truncarTexto,
  validarExportacao,
  type FormatoVideo, type ItemMetricaVideo, type LayoutConteudo, type SuporteGravacao,
} from './exportarVideoPuro';
import { corrigirDuracaoDoBlob } from './webmDuracao';
import { caixasDoRosto, resumoDoRosto, semPontosDoRosto, type CaixaDoQuadro, type OrigemCaixa } from './rostoPorQuadro';
import { garantirDuracao } from './rastrear';
import type { Intervalo, QuadroPose, TrilhaPose } from './tipos';
import { indiceNoTempo } from './trilha';

export * from './exportarVideoPuro';

/*
 * Exportação do vídeo analisado: percorre o trecho escolhido quadro a quadro, desenha cada quadro num canvas (o vídeo com o rosto coberto,
 * as linhas e os ângulos no estilo escolhido, o gráfico ângulo × tempo com o cursor, os cartões de métricas e, se pedido, a moldura do
 * Instagram) e grava o canvas com `MediaRecorder`. A gravação acontece em tempo real, então o arquivo dura o trecho dividido pela velocidade.
 *
 * Estilo "stop-motion": a cada quadro rastreado, o vídeo, as marcações e o cursor do gráfico mudam juntos e ficam parados até o quadro
 * seguinte. Em câmera lenta cada quadro rastreado aparece por mais tempo no arquivo.
 *
 * Privacidade: o rosto é coberto no próprio quadro, antes de qualquer marcação, moldura ou gráfico ser desenhado; o quadro só segue para a
 * gravação depois de coberto. Mostrar o rosto exige `modoRosto: 'nenhum'` explícito e a autorização do paciente.
 */

// ---------- opções ----------

/** Moldura da arte para redes sociais ao redor do vídeo (título, legenda, perfis e selo). */
export interface OpcoesSocial {
  /** O paciente autorizou o uso da imagem. Sem isso o vídeo com moldura não é gerado. */
  autorizado: boolean;
  titulo?: string;
  legenda?: string;
  /** Perfis sem o "@", no máximo três. */
  perfis?: string[];
  margensStories?: boolean;
  tituloModo?: TituloModo;
  rotulo?: string;
  data?: string;
  selo?: SeloImagem | null;
  avatar?: CanvasImageSource | null;
}

export interface AjusteRosto { mulLargura: number; mulAltura: number }

export interface OpcoesExportarVideo {
  /** Elemento <video> da análise: dele só se lê o endereço; a exportação usa uma cópia oculta e não mexe no player. */
  video: HTMLVideoElement;
  trilha: TrilhaPose;
  /** Ângulos desenhados no quadro e curvas do gráfico. */
  definicoes: DefinicaoAngulo[];
  estilo: EstiloMarcacao;
  formato: FormatoVideo;
  /** 1, 0,5, 0,25 ou 0,1. */
  velocidade: number;
  mostrarGrafico: boolean;
  mostrarMetricas: boolean;
  moldura?: OpcoesSocial;
  /** 'desfoque' ou 'tarja' cobrem o rosto; 'nenhum' mostra (exige autorização). */
  modoRosto: ModoRosto;
  /** Trecho do vídeo, em segundos. */
  intervalo: Intervalo;
  onProgresso?: (p: number) => void;
  sinal?: AbortSignal;

  /** Sentido do paciente no quadro (1 = para a direita), como na tela de análise. */
  direcao?: 1 | -1;
  /** Nome do gesto, no canto do vídeo e no nome do arquivo. */
  titulo?: string;
  /** Texto das métricas (uma linha por métrica); usado quando não há `cartoes`. */
  linhasMetricas?: string[];
  /** Cartões estruturados, com o símbolo de dentro/fora da referência. Têm prioridade sobre `linhasMetricas`. */
  cartoes?: CartaoMetricaUi[];
  /** Curvas já calculadas pela tela de análise (as mesmas do gráfico dela); sem isso, são calculadas a partir de `definicoes`. */
  series?: SerieGrafico[];
  marcadores?: MarcadorGrafico[];
  /** Faixas de referência confirmadas em fonte. Sem faixa, o gráfico não desenha nenhuma. */
  bandas?: BandaGrafico[];
  /** Consentimento do paciente para mostrar o rosto no formato original. */
  autorizado?: boolean;
  /** Tamanho da área do rosto (1 = o calculado pelos pontos de pose). */
  ajusteRosto?: AjusteRosto;
  /** Caixa usada onde o rosto não foi localizado. */
  caixaFixa?: CaixaRosto;
  /** Folga sobre a área do rosto (padrão: `FOLGA_ROSTO_VIDEO`); `ajusteRosto` é o ajuste do profissional, aplicado por cima. */
  folgaRosto?: AjusteRosto;
  mostrarEsqueleto?: boolean;
  mostrarAngulos?: boolean;
  /** Cópia do vídeo já aberta por `abrirFonteDeVideo` (a prévia e a exportação dividem a mesma). */
  fonte?: FonteDeVideo;
  /** Como percorrer o vídeo. Padrão: reprodução (suave) com queda automática para busca por quadro. */
  modoFonte?: 'auto' | 'reproducao' | 'busca';
}

/**
 * Folga extra sobre a área do rosto estimada pelos pontos de pose, aplicada além da margem do módulo de rosto. Num vídeo o rosto se
 * vira e se inclina, e de perfil a estimativa da cabeça tem o centro deslocado para a frente (o nariz puxa a média): errar para menos
 * deixaria a nuca à mostra, errar para mais só cobre um pouco de pescoço. O profissional ainda ajusta o tamanho na prévia.
 */
export const FOLGA_ROSTO_VIDEO: AjusteRosto = { mulLargura: 1.3, mulAltura: 1.1 };

export interface ResumoDoRosto { porOrigem: Record<OrigemCaixa, number>; semRosto: boolean }

// ---------- suporte ----------

/** O navegador grava vídeo a partir de um canvas? Traz a mensagem pronta para o profissional quando não grava. */
export function suporteDeGravacao(): SuporteGravacao {
  const temMediaRecorder = typeof MediaRecorder !== 'undefined';
  const temCaptureStream = typeof HTMLCanvasElement !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function';
  return avaliarSuporteGravacao({ temMediaRecorder, temCaptureStream, suporta: (m) => temMediaRecorder && MediaRecorder.isTypeSupported(m) });
}

// ---------- cópia oculta do vídeo ----------

type VideoComQuadros = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (agora: number, meta: { mediaTime: number }) => void) => number;
  cancelVideoFrameCallback?: (id: number) => void;
};

export interface FonteDeVideo { el: HTMLVideoElement; liberar: () => void }

const esperarMs = (ms: number, sinal?: AbortSignal) => new Promise<void>((ok, falha) => {
  if (sinal?.aborted) { falha(erroDeCancelamento()); return; }
  const id = window.setTimeout(() => { sinal?.removeEventListener('abort', aoCancelar); ok(); }, ms);
  const aoCancelar = () => { window.clearTimeout(id); falha(erroDeCancelamento()); };
  sinal?.addEventListener('abort', aoCancelar, { once: true });
});

/**
 * Abre uma cópia do vídeo, escondida mas ligada à página (alguns navegadores só decodificam e entregam quadros de vídeo que estão na
 * página). O player da análise continua livre: a exportação não o move nem o toca.
 */
export async function abrirFonteDeVideo(video: HTMLVideoElement, sinal?: AbortSignal): Promise<FonteDeVideo> {
  const src = video.currentSrc || video.src;
  if (!src) throw new ErroExportacao('fonte', 'O vídeo não está disponível para gerar o arquivo. Abra a análise de novo.');
  const el = document.createElement('video') as VideoComQuadros;
  el.muted = true;
  el.defaultMuted = true;
  el.playsInline = true;
  el.preload = 'auto';
  el.setAttribute('playsinline', '');
  el.setAttribute('aria-hidden', 'true');
  Object.assign(el.style, { position: 'fixed', right: '0', bottom: '0', width: '2px', height: '2px', opacity: '0.01', pointerEvents: 'none', zIndex: '-1' });
  document.body.appendChild(el);
  const liberar = () => {
    el.pause();
    el.removeAttribute('src');
    el.load();
    el.remove();
  };
  try {
    await new Promise<void>((ok, falha) => {
      const limpar = () => { window.clearTimeout(id); el.removeEventListener('loadeddata', aoCarregar); el.removeEventListener('error', aoFalhar); sinal?.removeEventListener('abort', aoCancelar); };
      const aoCarregar = () => { limpar(); ok(); };
      const aoFalhar = () => { limpar(); falha(new ErroExportacao('fonte', 'Não consegui abrir o vídeo para gerar o arquivo.')); };
      const aoCancelar = () => { limpar(); falha(erroDeCancelamento()); };
      const id = window.setTimeout(() => { limpar(); falha(new ErroExportacao('fonte', 'O vídeo demorou demais para abrir. Tente de novo.')); }, 20000);
      el.addEventListener('loadeddata', aoCarregar);
      el.addEventListener('error', aoFalhar);
      sinal?.addEventListener('abort', aoCancelar, { once: true });
      el.src = src;
      if (el.readyState >= 2) aoCarregar();
    });
    await garantirDuracao(el);
  } catch (e) {
    liberar();
    throw e;
  }
  return { el, liberar };
}

/**
 * Mostra o quadro de `t` e espera ele estar pronto para ser desenhado. Registra o aviso de quadro apresentado antes da busca (quando o
 * navegador tem) porque o Safari às vezes avisa "buscou" antes de o quadro novo estar na tela.
 */
export function buscarQuadro(el: HTMLVideoElement, t: number, limiteMs = 4000, sinal?: AbortSignal): Promise<void> {
  const v = el as VideoComQuadros;
  return new Promise<void>((ok, falha) => {
    if (sinal?.aborted) { falha(erroDeCancelamento()); return; }
    const alvo = Number.isFinite(el.duration) ? Math.min(Math.max(0, t), el.duration) : Math.max(0, t);
    if (Math.abs(el.currentTime - alvo) < 1e-3 && el.readyState >= 2 && !el.seeking) { ok(); return; }
    let buscou = false, apresentou = typeof v.requestVideoFrameCallback !== 'function', encerrou = false;
    let idQuadro = 0, idFolga = 0;
    const fim = (erro?: Error) => {
      if (encerrou) return;
      encerrou = true;
      window.clearTimeout(idLimite);
      window.clearTimeout(idFolga);
      el.removeEventListener('seeked', aoBuscar);
      sinal?.removeEventListener('abort', aoCancelar);
      if (idQuadro && typeof v.cancelVideoFrameCallback === 'function') v.cancelVideoFrameCallback(idQuadro);
      if (erro) falha(erro); else ok();
    };
    // Cancelar (ou fechar o diálogo) não espera a busca: sem isto o "seeked" que nunca chega prende a gravação até o limite de tempo.
    const aoCancelar = () => fim(erroDeCancelamento());
    const aoBuscar = () => {
      buscou = true;
      if (apresentou) { fim(); return; }
      idFolga = window.setTimeout(() => fim(), 120);
    };
    const idLimite = window.setTimeout(() => fim(), limiteMs);
    el.addEventListener('seeked', aoBuscar);
    sinal?.addEventListener('abort', aoCancelar, { once: true });
    if (!apresentou) idQuadro = v.requestVideoFrameCallback!(() => { apresentou = true; if (buscou) fim(); });
    el.currentTime = alvo;
  });
}

// ---------- desenho ----------

const FUNDO_PAINEL = 'rgba(255,255,255,0.06)';
const BORDA_PAINEL = 'rgba(255,255,255,0.14)';
const FUNDO_VIDEO = '#05080f';
const FUNDO_QUADRO = '#0a0f1c';
const COR_DENTRO = '#34d399';
const COR_FORA = '#fbbf24';
const RAIO_ARTE = 28;

function retanguloArredondado(ctx: CanvasRenderingContext2D, r: Retangulo, raio: number) {
  const k = Math.min(raio, r.w / 2, r.h / 2);
  ctx.beginPath();
  ctx.moveTo(r.x + k, r.y);
  ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, k);
  ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, k);
  ctx.arcTo(r.x, r.y + r.h, r.x, r.y, k);
  ctx.arcTo(r.x, r.y, r.x + r.w, r.y, k);
  ctx.closePath();
}

function painel(ctx: CanvasRenderingContext2D, r: Retangulo, raio: number) {
  retanguloArredondado(ctx, r, raio);
  ctx.fillStyle = FUNDO_PAINEL;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = BORDA_PAINEL;
  ctx.stroke();
}

function criarCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

const liberarCanvas = (c: HTMLCanvasElement) => { c.width = 0; c.height = 0; };

function contexto2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext('2d');
  if (!ctx) throw new ErroExportacao('gravacao', 'Este navegador não consegue montar o quadro do vídeo.');
  return ctx;
}

/** Faixa do topo, parte fixa: o nome do gesto e a velocidade e, embaixo, o aviso de que é uma estimativa por vídeo. */
function desenharBarraFixa(ctx: CanvasRenderingContext2D, l: LayoutConteudo, etiqueta: string, rodape: string) {
  const f = l.fonte, b = l.barra;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(b.x, b.y + b.h - 1, b.w, 1);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = fonteCss('forte', f * 0.88);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(truncarTexto(etiqueta, b.w * 0.58, (t) => ctx.measureText(t).width), b.x + l.margem, b.y + b.h * 0.38 + f * 0.03);
  ctx.font = fonteCss('texto', f * 0.6);
  ctx.fillStyle = 'rgba(255,255,255,0.62)';
  ctx.fillText(truncarTexto(rodape, b.w - 2 * l.margem, (t) => ctx.measureText(t).width), b.x + l.margem, b.y + b.h * 0.78 + f * 0.02);
  ctx.restore();
}

/** Faixa do topo, parte que muda a cada quadro: o instante e o número do quadro. */
function desenharTempo(ctx: CanvasRenderingContext2D, l: LayoutConteudo, texto: string) {
  const f = l.fonte, b = l.barra;
  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  ctx.font = fonteCss('texto', f * 0.84);
  ctx.fillStyle = 'rgba(255,255,255,0.86)';
  ctx.fillText(texto, b.x + b.w - l.margem, b.y + b.h * 0.38 + f * 0.03);
  ctx.restore();
}

/** 'neutro' é o "fora" de uma faixa que não é de normalidade (média de grupos, limiar): informa sem alertar. */
function iconeStatus(ctx: CanvasRenderingContext2D, status: 'dentro' | 'fora' | 'neutro', cx: number, cy: number, r: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = status === 'dentro' ? COR_DENTRO : status === 'fora' ? COR_FORA : 'rgba(255,255,255,0.45)';
  ctx.fill();
  ctx.strokeStyle = '#0a0f1c';
  ctx.lineWidth = Math.max(1.4, r * 0.28);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (status === 'dentro') {
    ctx.moveTo(cx - r * 0.48, cy + r * 0.02);
    ctx.lineTo(cx - r * 0.1, cy + r * 0.4);
    ctx.lineTo(cx + r * 0.52, cy - r * 0.36);
  } else if (status === 'fora') {
    ctx.moveTo(cx, cy - r * 0.5);
    ctx.lineTo(cx, cy + r * 0.12);
    ctx.moveTo(cx, cy + r * 0.45);
    ctx.lineTo(cx, cy + r * 0.46);
  } else {
    ctx.moveTo(cx, cy - r * 0.48);
    ctx.lineTo(cx, cy - r * 0.47);
    ctx.moveTo(cx, cy - r * 0.1);
    ctx.lineTo(cx, cy + r * 0.5);
  }
  ctx.stroke();
  ctx.restore();
}

function desenharCartoes(ctx: CanvasRenderingContext2D, l: LayoutConteudo, itens: ItemMetricaVideo[]) {
  if (!l.cartoes || !itens.length) return;
  const f = l.fonte;
  const g = l.espacoCartoes;
  const wCard = (l.cartoes.w - (l.colunas - 1) * g) / l.colunas;
  const ocultos = Math.max(0, itens.length - l.cartoesVisiveis);
  const lista: (ItemMetricaVideo | { resto: number })[] = ocultos > 0 ? [...itens.slice(0, l.cartoesVisiveis - 1), { resto: ocultos + 1 }] : itens;
  const pad = f * 0.55;
  lista.forEach((it, k) => {
    const col = k % l.colunas, lin = Math.floor(k / l.colunas);
    const r: Retangulo = { x: l.cartoes!.x + col * (wCard + g), y: l.cartoes!.y + lin * (l.alturaCartao + g), w: wCard, h: l.alturaCartao };
    painel(ctx, r, f * 0.5);
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    const largTexto = r.w - 2 * pad;
    if ('resto' in it) {
      ctx.font = fonteCss('forte', f * 0.9);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText(truncarTexto(`+${it.resto} ${it.resto === 1 ? 'métrica' : 'métricas'} no PDF`, largTexto, (t) => ctx.measureText(t).width), r.x + pad, r.y + r.h / 2 + f * 0.3);
      ctx.restore();
      return;
    }
    ctx.font = fonteCss('texto', f * 0.76);
    ctx.fillStyle = 'rgba(255,255,255,0.74)';
    ctx.fillText(truncarTexto(it.comAviso ? `${it.titulo} *` : it.titulo, largTexto, (t) => ctx.measureText(t).width), r.x + pad, r.y + pad + f * 0.72);

    // valores: "D 62,3°  E 60,1°", cada lado na sua cor, com o símbolo de dentro/fora da faixa quando há referência
    const yValor = r.y + pad + f * 0.72 + f * 1.3;
    ctx.font = fonteCss('forte', f * 1.15);
    let x = r.x + pad;
    const rIcone = f * 0.42;
    const tamanhos = it.valores.map((v) => {
      const etiqueta = v.lado ? `${v.lado}` : '';
      const tamEtiqueta = etiqueta ? ctx.measureText(etiqueta).width + f * 0.28 : 0;
      const tamValor = ctx.measureText(v.texto).width;
      const precisaIcone = v.status === 'dentro' || v.status === 'fora' || v.status === 'fora_neutro';
      return { etiqueta, tamEtiqueta, tamValor, precisaIcone, total: tamEtiqueta + tamValor + (precisaIcone ? rIcone * 2.5 : 0) };
    });
    // O erro de medida do vídeo (ex.: "± 6,2%") só entra se couber junto de todos os valores; senão fica no PDF.
    ctx.font = fonteCss('texto', f * 0.6);
    const tamIncerteza = it.valores.map((v) => (v.incerteza ? ctx.measureText(v.incerteza).width + f * 0.3 : 0));
    const somaComIncerteza = tamanhos.reduce((a, t, k) => a + t.total + tamIncerteza[k] + f * 0.7, 0);
    const comIncerteza = somaComIncerteza <= r.w - 2 * pad + f * 0.7;
    ctx.font = fonteCss('forte', f * 1.15);
    for (const [k, v] of it.valores.entries()) {
      const { etiqueta, tamEtiqueta, tamValor, precisaIcone, total } = tamanhos[k];
      if (x + total > r.x + r.w - pad + 1) break;
      if (etiqueta) { ctx.fillStyle = COR_LADO[v.lado as 'D' | 'E']; ctx.fillText(etiqueta, x, yValor); }
      ctx.fillStyle = '#ffffff';
      ctx.fillText(v.texto, x + tamEtiqueta, yValor);
      x += tamEtiqueta + tamValor;
      if (precisaIcone) { iconeStatus(ctx, v.status === 'dentro' ? 'dentro' : v.status === 'fora' ? 'fora' : 'neutro', x + rIcone * 1.5, yValor - f * 0.4, rIcone); x += rIcone * 2.5; }
      if (comIncerteza && v.incerteza) {
        ctx.font = fonteCss('texto', f * 0.6);
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText(v.incerteza, x + f * 0.15, yValor);
        ctx.font = fonteCss('forte', f * 1.15);
        x += tamIncerteza[k];
      }
      x += f * 0.7;
    }

    ctx.fillStyle = it.referencia ? 'rgba(167,243,208,0.92)' : 'rgba(255,255,255,0.5)';
    const textoRef = it.referencia ? `${prefixoDaReferencia(it.natureza)}${it.referencia}` : 'sem referência';
    // A referência com a fonte e o PMID vale mais que o tamanho da letra: encolhe um pouco antes de cortar com reticências.
    let tamRef = f * 0.64;
    ctx.font = fonteCss('texto', tamRef);
    const larguraRef = ctx.measureText(textoRef).width;
    if (larguraRef > largTexto) {
      tamRef = Math.max(f * 0.5, (tamRef * largTexto) / larguraRef);
      ctx.font = fonteCss('texto', tamRef);
    }
    ctx.fillText(truncarTexto(textoRef, largTexto, (t) => ctx.measureText(t).width), r.x + pad, r.y + r.h - pad * 0.7);
    ctx.restore();
  });
}

/** Marcas que existem no gráfico, uma entrada por tipo (e por legenda, nas marcas "outro"). */
function legendaDasMarcas(marcadores: MarcadorGrafico[]): { tipo: MarcadorGrafico['tipo']; texto: string }[] {
  const lista: { tipo: MarcadorGrafico['tipo']; texto: string }[] = [];
  const tem = (tipo: MarcadorGrafico['tipo']) => marcadores.some((m) => m.tipo === tipo);
  if (tem('contato')) lista.push({ tipo: 'contato', texto: 'contato do pé' });
  if (tem('saida')) lista.push({ tipo: 'saida', texto: 'saída do pé' });
  for (const m of marcadores) {
    if (m.tipo === 'outro' && m.legenda && !lista.some((e) => e.texto === m.legenda)) lista.push({ tipo: 'outro', texto: m.legenda });
  }
  return lista;
}

/** Mesmos desenhos que as marcas do gráfico (triângulo, círculo, losango), em cinza, para a legenda. */
function glifoDaMarca(ctx: CanvasRenderingContext2D, tipo: MarcadorGrafico['tipo'], x: number, y: number, r: number) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = Math.max(1.2, r * 0.3);
  ctx.beginPath();
  if (tipo === 'contato') {
    ctx.moveTo(x - r, y - r * 0.8);
    ctx.lineTo(x + r, y - r * 0.8);
    ctx.lineTo(x, y + r);
    ctx.closePath();
    ctx.fill();
  } else if (tipo === 'saida') {
    ctx.arc(x, y, r * 0.9, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

interface AreaGrafico {
  layout: LayoutGrafico;
  /** Canto superior esquerdo do gráfico no quadro composto. */
  x: number;
  y: number;
  series: SerieGrafico[];
  bandas: BandaGrafico[];
  larguraCurva: number;
}

function prepararGrafico(ctx: CanvasRenderingContext2D, l: LayoutConteudo, entrada: { titulo: string; legendaSinal: string; series: SerieGrafico[]; marcadores: MarcadorGrafico[]; bandas: BandaGrafico[]; t0: number; duracao: number }): AreaGrafico | null {
  const r = l.grafico;
  if (!r) return null;
  const f = l.fonte;
  const pad = Math.round(f * 0.5), cab = Math.round(f * 1.7);
  painel(ctx, r, f * 0.5);

  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = fonteCss('forte', f * 0.9);
  ctx.fillStyle = '#ffffff';
  const yCab = r.y + pad + cab / 2 - pad * 0.4;
  let xLegenda = r.x + r.w - pad;
  ctx.font = fonteCss('forte', f * 0.8);
  for (const s of [...entrada.series].reverse()) {
    const w = ctx.measureText(s.rotulo).width;
    xLegenda -= w;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(s.rotulo, xLegenda, yCab);
    xLegenda -= f * 0.45;
    ctx.fillStyle = s.cor;
    ctx.beginPath();
    ctx.arc(xLegenda, yCab, f * 0.27, 0, Math.PI * 2);
    ctx.fill();
    xLegenda -= f * 0.75;
  }
  ctx.font = fonteCss('forte', f * 0.9);
  const larguraTitulo = Math.min(ctx.measureText(`${entrada.titulo} (°)`).width, r.w * 0.45);
  // Legenda das marcas do gráfico (contato, saída, picos): entra o que couber ao lado do título.
  const limiteEsq = r.x + pad + larguraTitulo + f * 1.2;
  ctx.font = fonteCss('texto', f * 0.6);
  for (const e of [...legendaDasMarcas(entrada.marcadores)].reverse()) {
    const w = ctx.measureText(e.texto).width;
    if (xLegenda - w - f * 1.0 < limiteEsq) break;
    xLegenda -= w;
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.textAlign = 'left';
    ctx.fillText(e.texto, xLegenda, yCab);
    xLegenda -= f * 0.5;
    glifoDaMarca(ctx, e.tipo, xLegenda, yCab, f * 0.26);
    xLegenda -= f * 1.0;
  }
  ctx.font = fonteCss('forte', f * 0.9);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(truncarTexto(`${entrada.titulo} (°)`, Math.max(20, xLegenda - (r.x + pad)), (t) => ctx.measureText(t).width), r.x + pad, yCab);

  // Notas do pé do gráfico: o sentido do sinal dos ângulos (sem ele, "−12°" não diz se é extensão) e as faixas de referência com fonte.
  const notas: { linhas: string[]; cor: string }[] = [];
  ctx.font = fonteCss('texto', f * 0.62);
  const medir = (t: string) => ctx.measureText(t).width;
  if (entrada.legendaSinal) notas.push({ linhas: quebrarTexto(entrada.legendaSinal, r.w - 2 * pad, medir, 2), cor: 'rgba(255,255,255,0.66)' });
  if (entrada.bandas.length) notas.push({ linhas: quebrarTexto(entrada.bandas.map((b) => b.rotulo).join(' · '), r.w - 2 * pad, medir, 2), cor: 'rgba(167,243,208,0.92)' });
  const totalLinhas = notas.reduce((a, n) => a + n.linhas.length, 0);
  const hNota = totalLinhas ? Math.round(totalLinhas * f * 0.8 + pad * 0.3) : 0;
  if (totalLinhas) {
    ctx.textBaseline = 'alphabetic';
    let yLinha = r.y + r.h - pad * 0.5 - (totalLinhas - 1) * f * 0.8;
    for (const n of notas) {
      ctx.fillStyle = n.cor;
      for (const ln of n.linhas) { ctx.fillText(ln, r.x + pad, yLinha); yLinha += f * 0.8; }
    }
  }
  ctx.restore();

  const larg = r.w - 2 * pad;
  const alt = Math.max(20, r.h - cab - hNota - pad);
  const layout = layoutDoGrafico(entrada.series, entrada.marcadores, entrada.bandas, { largura: larg, altura: alt, t0: 0, duracao: entrada.duracao, unidade: '°', fonte: Math.max(9, Math.round(f * 0.7)) });
  return { layout, x: r.x + pad, y: r.y + cab, series: entrada.series, bandas: entrada.bandas, larguraCurva: Math.max(2, f * 0.13) };
}

// ---------- renderizador ----------

export interface Renderizador {
  /** Canvas que a gravação captura (e que a prévia mostra). */
  saida: HTMLCanvasElement;
  largura: number;
  altura: number;
  /** Onde ficam o vídeo, o gráfico e os cartões no quadro composto (antes da moldura). */
  layout: LayoutConteudo;
  /** Leva um retângulo do quadro composto para o arquivo (a moldura do Instagram coloca o quadro dentro de uma caixa). */
  naSaida: (r: Retangulo) => Retangulo;
  /** Área coberta no quadro `indice`, em pixels do arquivo; null se o rosto estiver à mostra. */
  rostoNaSaida: (indice: number) => Retangulo | null;
  /** Desenha o quadro `indice` da trilha, com o vídeo já posicionado nele. */
  desenhar: (indice: number) => void;
  /** Marca o canvas de saída como repintado, sem mudar a imagem: o Chrome só codifica um quadro novo quando o canvas é repintado. */
  repintar: () => void;
  caixas: CaixaDoQuadro[];
  resumoRosto: ResumoDoRosto;
  liberar: () => void;
}

const subtrair = (s: SerieGrafico, t0: number): SerieGrafico => ({ ...s, pontos: s.pontos.map((p) => ({ t: p.t - t0, v: p.v })) });

function nomeDoGrupo(defs: DefinicaoAngulo[]): string {
  const nomes: string[] = [];
  for (const d of defs) {
    const n = d.nome.replace(/\s+(direito|esquerdo)$/i, '');
    if (!nomes.includes(n)) nomes.push(n);
  }
  return nomes.join(' · ');
}

export async function prepararRenderizador(op: OpcoesExportarVideo, el: HTMLVideoElement): Promise<Renderizador> {
  await garantirFontesSociais();
  const { trilha, intervalo } = op;
  const vw = trilha.largura, vh = trilha.altura;
  const direcao = op.direcao ?? 1;
  const t0 = intervalo.inicio;
  const duracao = Math.max(0.1, intervalo.fim - intervalo.inicio);

  // Curvas do gráfico: só o trecho exportado, com o tempo contado a partir do início dele.
  const brutas = op.series ?? (op.definicoes.length ? seriesDoGrupo(trilha, { id: 'exportacao', nome: nomeDoGrupo(op.definicoes), defs: op.definicoes }, direcao) : []);
  const seriesRel = brutas.map((s) => subtrair({ ...s, pontos: s.pontos.filter((p) => p.t >= t0 - 1e-6 && p.t <= intervalo.fim + 1e-6) }, t0));
  const temGrafico = op.mostrarGrafico && seriesRel.some((s) => s.pontos.some((p) => p.v !== null));
  const marcadoresRel = (op.marcadores ?? []).map((m) => ({ ...m, t: m.t - t0 }));
  const bandas = op.bandas ?? [];

  const itensMetricas = op.mostrarMetricas ? (op.cartoes?.length ? itensDeCartoes(op.cartoes) : itensDeLinhas(op.linhasMetricas ?? [])) : [];

  // ---- tamanho do quadro composto e do arquivo ----
  const social = ehFormatoSocial(op.formato);
  let layout: LayoutConteudo;
  let saida: HTMLCanvasElement;
  let caixaArte: Retangulo | null = null;
  let moldura: { opcoesArte: Omit<OpcoesArte, 'formato' | 'layout'>; recursos: RecursosArte } | null = null;
  const formatoSocial = social ? (op.formato as FormatoSocial) : null;
  if (social && formatoSocial) {
    const m = op.moldura;
    const recursos: RecursosArte = { selo: m?.selo ?? null, avatar: m?.avatar ?? null };
    const opcoesArte: Omit<OpcoesArte, 'formato' | 'layout'> = {
      titulo: m?.titulo, tituloModo: m?.tituloModo, legenda: m?.legenda, perfis: m?.perfis, margensStories: m?.margensStories !== false,
      rotulos: [m?.rotulo ?? ''], datas: [m?.data ?? ''], mostrarDatas: !!m?.data, modoAjuste: 'inteira',
      // O conteúdo já chega com o rosto coberto por este módulo; a arte não deve cobrir de novo um pedaço do gráfico.
      modoRosto: 'nenhum',
    };
    const arte = layoutDaArte({ ...opcoesArte, formato: formatoSocial, layout: 'unica' }, 1, recursos);
    caixaArte = arte.paineis[0];
    layout = calcularLayoutConteudo({ larguraVideo: vw, alturaVideo: vh, largura: Math.round(caixaArte.w), altura: Math.round(caixaArte.h), grafico: temGrafico, nCartoes: itensMetricas.length });
    saida = criarCanvas(FORMATOS[formatoSocial].largura, FORMATOS[formatoSocial].altura);
    moldura = { opcoesArte, recursos };
  } else {
    layout = tamanhoOriginal(vw, vh, temGrafico, itensMetricas.length);
    saida = criarCanvas(layout.largura, layout.altura);
  }
  const conteudo = social ? criarCanvas(layout.largura, layout.altura) : saida;
  const ctxC = contexto2d(conteudo);
  const ctxS = social ? contexto2d(saida) : ctxC;

  const etiquetaTopo = [op.titulo, op.velocidade !== 1 ? `câmera lenta ${rotuloVelocidade(op.velocidade)}` : ''].filter(Boolean).join(' · ');

  // ---- camada fixa: fundo, painéis, título do gráfico e cartões ----
  const base = criarCanvas(layout.largura, layout.altura);
  const ctxB = contexto2d(base);
  ctxB.fillStyle = FUNDO_QUADRO;
  ctxB.fillRect(0, 0, layout.largura, layout.altura);
  ctxB.fillStyle = FUNDO_VIDEO;
  ctxB.fillRect(layout.areaVideo.x, layout.areaVideo.y, layout.areaVideo.w, layout.areaVideo.h);
  desenharBarraFixa(ctxB, layout, etiquetaTopo, itensMetricas.some((i) => i.comAviso) ? RODAPE_VIDEO_COM_AVISO : RODAPE_VIDEO);
  const area = temGrafico ? prepararGrafico(ctxB, layout, { titulo: nomeDoGrupo(op.definicoes) || 'Ângulo', legendaSinal: legendaDosAngulos(op.definicoes), series: seriesRel, marcadores: marcadoresRel, bandas, t0, duracao }) : null;
  desenharCartoes(ctxB, layout, itensMetricas);

  // ---- rosto ----
  const caixas = caixasDoRosto(trilha, op.caixaFixa ? { caixaFixa: op.caixaFixa } : {});
  const resumo = resumoDoRosto(caixas);
  const folga = op.folgaRosto ?? FOLGA_ROSTO_VIDEO;
  const ajuste = { mulLargura: folga.mulLargura * (op.ajusteRosto?.mulLargura ?? 1), mulAltura: folga.mulAltura * (op.ajusteRosto?.mulAltura ?? 1) };
  const rv = layout.video;
  const janela = janelaDaImagem(rv, vw, vh, 'inteira');

  const k = escalaDoEstiloNaArte(rv.w / vw);
  const escalaX = rv.w / vw, escalaY = rv.h / vh;
  const f = layout.fonte;

  const caixaDoIndice = (indice: number) => escalarCaixaRosto(caixas[Math.min(caixas.length - 1, Math.max(0, indice))].caixa, ajuste.mulLargura, ajuste.mulAltura);
  const naSaida = (r: Retangulo): Retangulo => {
    if (!caixaArte) return r;
    const ex = caixaArte.w / layout.largura, ey = caixaArte.h / layout.altura;
    return { x: caixaArte.x + r.x * ex, y: caixaArte.y + r.y * ey, w: r.w * ex, h: r.h * ey };
  };
  const rostoNaSaida = (indice: number): Retangulo | null => {
    if (op.modoRosto === 'nenhum') return null;
    const c = caixaDoIndice(indice);
    return naSaida({ x: rv.x + (c.cx - c.w / 2) * rv.w, y: rv.y + (c.cy - c.h / 2) * rv.h, w: c.w * rv.w, h: c.h * rv.h });
  };

  function cobrirRosto(indice: number) {
    if (op.modoRosto === 'nenhum') return;
    const caixa = caixaDoIndice(indice);
    ctxC.save();
    ctxC.beginPath();
    ctxC.rect(rv.x, rv.y, rv.w, rv.h);
    ctxC.clip();
    let coberto = false;
    try {
      coberto = protegerRosto(ctxC, el, vw, vh, janela, rv, caixa, op.modoRosto);
    } catch {
      // Se o desfoque falhar, a tarja sólida cobre a mesma área (abaixo).
      coberto = false;
    }
    // O rosto nunca segue para o arquivo sem cobertura, nem quando o desfoque desiste em silêncio.
    if (!coberto) {
      ctxC.fillStyle = '#080c16';
      ctxC.fillRect(rv.x + (caixa.cx - caixa.w / 2) * rv.w, rv.y + (caixa.cy - caixa.h / 2) * rv.h, caixa.w * rv.w, caixa.h * rv.h);
    }
    ctxC.restore();
  }

  function desenhar(indice: number) {
    const i = Math.min(trilha.quadros.length - 1, Math.max(0, indice));
    const quadro = trilha.quadros[i];
    ctxC.drawImage(base, 0, 0);

    ctxC.save();
    ctxC.beginPath();
    ctxC.rect(rv.x, rv.y, rv.w, rv.h);
    ctxC.clip();
    ctxC.imageSmoothingEnabled = true;
    ctxC.imageSmoothingQuality = 'high';
    ctxC.drawImage(el, rv.x, rv.y, rv.w, rv.h);
    ctxC.restore();
    cobrirRosto(i);

    const itens = itensDoQuadroAnalisado(semPontosDoRosto(quadro), contextoDesenho(vw, vh, op.estilo, { k }), { defs: op.definicoes, direcao, esqueleto: op.mostrarEsqueleto !== false, angulos: op.mostrarAngulos !== false });
    ctxC.save();
    ctxC.beginPath();
    ctxC.rect(rv.x, rv.y, rv.w, rv.h);
    ctxC.clip();
    ctxC.translate(rv.x, rv.y);
    ctxC.scale(escalaX, escalaY);
    pintarItens(ctxC, itens);
    ctxC.restore();

    const tRel = Math.min(duracao, Math.max(0, quadro.t - t0));
    desenharTempo(ctxC, layout, `${rotuloTempo(tRel)} · quadro ${i + 1}`);

    if (area) {
      ctxC.save();
      ctxC.translate(area.x, area.y);
      pintarGrafico(ctxC, area.layout, area.series, area.bandas, { tema: TEMA_ESCURO, cursorT: tRel, larguraCurva: area.larguraCurva });
      ctxC.restore();
    }

    if (social && caixaArte) {
      ctxS.save();
      retanguloArredondado(ctxS, caixaArte, RAIO_ARTE);
      ctxS.clip();
      ctxS.drawImage(conteudo, 0, 0, conteudo.width, conteudo.height, caixaArte.x, caixaArte.y, caixaArte.w, caixaArte.h);
      // O contorno por quadro fica dentro do recorte (metade interna, refeita a cada quadro): a metade de fora não é repintada e
      // acumularia opacidade quadro a quadro. Ela é desenhada uma só vez, na moldura.
      contornoDaArte(ctxS, caixaArte);
      ctxS.restore();
    }
  }

  function contornoDaArte(c: CanvasRenderingContext2D, caixa: Retangulo) {
    retanguloArredondado(c, caixa, RAIO_ARTE);
    c.lineWidth = 2;
    c.strokeStyle = 'rgba(255,255,255,0.16)';
    c.stroke();
  }

  function repintar() {
    ctxS.save();
    ctxS.globalCompositeOperation = 'copy';
    ctxS.drawImage(saida, 0, 0);
    ctxS.restore();
  }

  // A moldura (fundo, título, selo, legenda, perfis) é pintada uma vez; depois só o miolo muda a cada quadro.
  if (formatoSocial && moldura) {
    ctxC.drawImage(base, 0, 0);
    desenharMolduraSocial(ctxS, formatoSocial, moldura.opcoesArte, conteudo, moldura.recursos, 1);
    if (caixaArte) contornoDaArte(ctxS, caixaArte);
  }

  return {
    saida, largura: saida.width, altura: saida.height, layout, naSaida, rostoNaSaida, desenhar, repintar, caixas,
    resumoRosto: { porOrigem: resumo, semRosto: resumo.fixa > 0 },
    liberar: () => { liberarCanvas(base); if (conteudo !== saida) liberarCanvas(conteudo); liberarCanvas(saida); },
  };
}

// ---------- prévia ----------

export interface Previa {
  canvas: HTMLCanvasElement;
  largura: number;
  altura: number;
  resumoRosto: ResumoDoRosto;
  nQuadros: number;
  /** Índice do quadro da trilha que corresponde ao instante `t` do vídeo. */
  mostrar: (indice: number) => Promise<void>;
  liberar: () => void;
}

/** Quadro de conferência com as mesmas opções da exportação (o rosto coberto, o gráfico, a moldura): é o que o arquivo terá. */
export async function criarPrevia(op: OpcoesExportarVideo): Promise<Previa> {
  const proprio = !op.fonte;
  const fonte = op.fonte ?? await abrirFonteDeVideo(op.video, op.sinal);
  let r: Renderizador;
  try {
    r = await prepararRenderizador(op, fonte.el);
  } catch (e) {
    if (proprio) fonte.liberar();
    throw e;
  }
  let liberada = false;
  const mostrar = async (indice: number) => {
    // Depois de liberada a prévia não mexe mais no vídeo: a gravação pode já estar usando a mesma cópia.
    if (liberada) return;
    const i = Math.min(op.trilha.quadros.length - 1, Math.max(0, indice));
    await buscarQuadro(fonte.el, tempoDeExibicao(op.trilha.quadros[i].t, op.trilha.fps), undefined, op.sinal);
    if (liberada) return;
    r.desenhar(i);
  };
  return {
    canvas: r.saida, largura: r.largura, altura: r.altura, resumoRosto: r.resumoRosto, nQuadros: op.trilha.quadros.length, mostrar,
    liberar: () => { liberada = true; r.liberar(); if (proprio) fonte.liberar(); },
  };
}

// ---------- gravação ----------

interface FonteTemporal {
  modo: 'reproducao' | 'busca';
  /** Prepara o vídeo para o primeiro quadro. */
  iniciar: () => Promise<void>;
  /** Um passo do relógio: no modo busca, mostra e desenha o quadro devido; na reprodução o desenho acontece no aviso de quadro. */
  passo: (tSaida: number) => Promise<void>;
  terminou: (tSaida: number) => boolean;
  parar: () => void;
}

function fonteDeBusca(op: OpcoesExportarVideo, el: HTMLVideoElement, r: Renderizador, duracaoSaida: number): FonteTemporal {
  let desenhado = -1;
  return {
    modo: 'busca',
    iniciar: async () => undefined,
    passo: async (tSaida) => {
      const i = quadroNaSaida(op.trilha, tSaida, op.intervalo, op.velocidade);
      if (i === desenhado) return;
      await buscarQuadro(el, tempoDeExibicao(op.trilha.quadros[i].t, op.trilha.fps), undefined, op.sinal);
      r.desenhar(i);
      desenhado = i;
    },
    terminou: (tSaida) => tSaida >= duracaoSaida,
    parar: () => undefined,
  };
}

function fonteDeReproducao(op: OpcoesExportarVideo, el: HTMLVideoElement, r: Renderizador, duracaoSaida: number, aoErro: (e: unknown) => void): FonteTemporal | null {
  const v = el as VideoComQuadros;
  if (typeof v.requestVideoFrameCallback !== 'function') return null;
  const { trilha, intervalo } = op;
  let desenhado = -1, ultimaMidia = intervalo.inicio, idCallback = 0, ativo = false, ultimoQuadroEm = performance.now();
  const aoQuadro = (_agora: number, meta: { mediaTime: number }) => {
    if (!ativo) return;
    ultimoQuadroEm = performance.now();
    ultimaMidia = meta.mediaTime;
    const i = indiceNoTempo(trilha, meta.mediaTime);
    if (i !== desenhado && meta.mediaTime <= intervalo.fim + 0.5 / trilha.fps) {
      try {
        r.desenhar(i);
        desenhado = i;
      } catch (e) {
        aoErro(e);
        return;
      }
    }
    idCallback = v.requestVideoFrameCallback!(aoQuadro);
  };
  return {
    modo: 'reproducao',
    iniciar: async () => {
      await buscarQuadro(el, tempoDeExibicao(trilha.quadros[indiceNoTempo(trilha, intervalo.inicio)].t, trilha.fps), undefined, op.sinal);
      el.playbackRate = op.velocidade;
      await Promise.race([
        el.play(),
        new Promise<void>((_, falha) => { window.setTimeout(() => falha(new Error('O vídeo não começou a tocar.')), 4000); }),
      ]);
      ativo = true;
      ultimoQuadroEm = performance.now();
      idCallback = v.requestVideoFrameCallback!(aoQuadro);
    },
    passo: async () => {
      // Se o navegador parar de entregar quadros, a exportação não fica pendurada: o chamador troca para a busca por quadro.
      if (performance.now() - ultimoQuadroEm > 2500 && !el.ended && ultimaMidia < intervalo.fim - 0.25) throw new ErroExportacao('fonte', 'O vídeo parou de responder durante a gravação.');
    },
    terminou: (tSaida) => ultimaMidia >= intervalo.fim - 0.5 / trilha.fps || el.ended || tSaida > duracaoSaida * 1.5 + 3,
    parar: () => {
      ativo = false;
      el.pause();
      if (idCallback && typeof v.cancelVideoFrameCallback === 'function') v.cancelVideoFrameCallback(idCallback);
    },
  };
}

async function pedirTelaAcesa(): Promise<{ release: () => Promise<void> } | null> {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request: (tipo: 'screen') => Promise<{ release: () => Promise<void> }> } };
    return nav.wakeLock ? await nav.wakeLock.request('screen') : null;
  } catch {
    // Sem permissão para manter a tela acesa: a gravação segue, o profissional só precisa tocar na tela se ela apagar.
    return null;
  }
}

/**
 * Gera o vídeo analisado e devolve o arquivo. A gravação é em tempo real e exige a tela aberta: o arquivo dura o trecho dividido pela
 * velocidade (no máximo `LIMITES_EXPORTACAO.duracaoMaximaSaidaS`). Cancelar rejeita com `AbortError`; os demais problemas viram `ErroExportacao`
 * com mensagem em português.
 */
export async function exportarVideoAnalise(op: OpcoesExportarVideo): Promise<Blob> {
  const problema = validarExportacao({
    formato: op.formato, velocidade: op.velocidade, intervalo: op.intervalo, nQuadros: op.trilha.quadros.length, modoRosto: op.modoRosto,
    autorizadoMoldura: op.moldura?.autorizado === true, autorizado: op.autorizado === true,
  });
  if (problema) throw problema;
  const suporte = suporteDeGravacao();
  if (!suporte.ok || !suporte.escolha) throw new ErroExportacao('sem_gravacao', suporte.motivo ?? 'Este aparelho não grava vídeo.');
  if (op.sinal?.aborted) throw erroDeCancelamento();

  const proprio = !op.fonte;
  const fonte = op.fonte ?? await abrirFonteDeVideo(op.video, op.sinal);
  let renderizador: Renderizador | null = null;
  let trava: { release: () => Promise<void> } | null = null;
  let fonteTempo: FonteTemporal | null = null;
  let fluxo: MediaStream | null = null;
  let gravador: MediaRecorder | null = null;
  let erroSegundoPlano: ErroExportacao | null = null;
  let erroDeDesenho: unknown = null;
  let erroGravacao: ErroExportacao | null = null;
  const aoOcultar = () => {
    if (document.visibilityState === 'hidden') erroSegundoPlano = new ErroExportacao('segundo_plano', 'A gravação parou porque o app saiu da tela. Mantenha o app aberto até o fim e tente de novo.');
  };

  try {
    renderizador = await prepararRenderizador(op, fonte.el);
    const r = renderizador;
    const duracaoSaida = duracaoDaSaida(op.intervalo, op.velocidade);
    const fps = LIMITES_EXPORTACAO.fpsSaida;
    const periodo = 1000 / fps;
    trava = await pedirTelaAcesa();
    document.addEventListener('visibilitychange', aoOcultar);

    // Primeiro quadro pronto antes de gravar, para o arquivo não começar vazio.
    const iInicio = quadroNaSaida(op.trilha, 0, op.intervalo, op.velocidade);
    await buscarQuadro(fonte.el, tempoDeExibicao(op.trilha.quadros[iInicio].t, op.trilha.fps), undefined, op.sinal);
    r.desenhar(iInicio);

    fluxo = r.saida.captureStream(0);
    const faixa = fluxo.getVideoTracks()[0] as (MediaStreamTrack & { requestFrame?: () => void }) | undefined;
    const manual = !!faixa && typeof faixa.requestFrame === 'function';
    if (!manual) {
      fluxo.getTracks().forEach((t) => t.stop());
      fluxo = r.saida.captureStream(fps);
    }
    const empurrar = () => { if (manual) faixa!.requestFrame!(); };
    const gravadorParado = () => gravador?.state === 'inactive';

    const opcoesGravador: MediaRecorderOptions = { mimeType: suporte.escolha.mime, videoBitsPerSecond: bitrateDoVideo(r.largura, r.altura, fps) };
    gravador = new MediaRecorder(fluxo, opcoesGravador);
    const pedacos: Blob[] = [];
    gravador.ondataavailable = (e) => { if (e.data && e.data.size > 0) pedacos.push(e.data); };
    const parou = new Promise<void>((ok, falha) => {
      gravador!.onstop = () => ok();
      gravador!.onerror = () => {
        // O laço de gravação olha `erroGravacao` a cada passo: o erro aparece na hora, e não só ao fim do trecho.
        erroGravacao = new ErroExportacao('gravacao', 'O navegador interrompeu a gravação do vídeo. Tente de novo com um trecho menor.');
        falha(erroGravacao);
      };
    });
    parou.catch(() => {
      // A rejeição é tratada onde `parou` é aguardada ou, antes disso, pelo laço (via `erroGravacao`); aqui só evita rejeição sem tratamento.
    });

    // Reprodução suave quando o navegador entrega os quadros; busca por quadro quando não (ou quando a reprodução falha).
    const aoErroDesenho = (e: unknown) => { erroDeDesenho = e; };
    if (op.modoFonte !== 'busca') {
      const tentativa = fonteDeReproducao(op, fonte.el, r, duracaoSaida, aoErroDesenho);
      const querReproducao = op.modoFonte === 'reproducao' || op.velocidade >= 0.5;
      if (tentativa && querReproducao) {
        try {
          await tentativa.iniciar();
          fonteTempo = tentativa;
        } catch {
          // O vídeo não tocou (política de reprodução ou taxa não aceita): segue pela busca quadro a quadro.
          tentativa.parar();
        }
      }
    }
    if (!fonteTempo) {
      fonteTempo = fonteDeBusca(op, fonte.el, r, duracaoSaida);
      await fonteTempo.iniciar();
    }

    // Sem fatias de tempo: o Chrome entrega o WebM já finalizado (com duração e índice de posições) e o Safari, um MP4 inteiro.
    gravador.start();
    empurrar();
    const inicio = performance.now();
    let n = 0;
    for (;;) {
      if (op.sinal?.aborted) throw erroDeCancelamento();
      if (erroSegundoPlano) throw erroSegundoPlano;
      if (erroDeDesenho) throw erroDeDesenho;
      if (erroGravacao) throw erroGravacao;
      if (gravadorParado()) throw new ErroExportacao('gravacao', 'O navegador interrompeu a gravação do vídeo. Tente de novo com um trecho menor.');
      const tSaida = (performance.now() - inicio) / 1000;
      if (fonteTempo.terminou(tSaida)) break;
      try {
        await fonteTempo.passo(tSaida);
      } catch (e) {
        if (!(e instanceof ErroExportacao) || fonteTempo.modo !== 'reproducao') throw e;
        // A reprodução emperrou: continua pelo mesmo relógio, buscando o quadro devido a cada instante.
        fonteTempo.parar();
        fonteTempo = fonteDeBusca(op, fonte.el, r, duracaoSaida);
      }
      empurrar();
      op.onProgresso?.(progressoDaSaida(tSaida, duracaoSaida));
      n = Math.max(n + 1, Math.ceil((performance.now() - inicio) / periodo));
      const espera = inicio + n * periodo - performance.now();
      if (espera > 0) await esperarMs(espera, op.sinal);
    }
    const duracaoReal = (performance.now() - inicio) / 1000;
    fonteTempo.parar();
    empurrar();
    await esperarMs(periodo * 2, op.sinal);
    // Sem repintar, o Chrome não codifica quadro novo: o último quadro analisado ficaria com tempo zero e o arquivo sairia mais curto.
    r.repintar();
    empurrar();
    // Só `stop()`: pedir um pedaço antes (`requestData`) obriga o Chrome a fechar o cabeçalho cedo, com uma duração provisória de 1 ms.
    if (gravador.state !== 'inactive') gravador.stop();
    await parou;
    op.onProgresso?.(1);

    const tipo = gravador.mimeType || suporte.escolha.mime;
    const blob = new Blob(pedacos, { type: tipo });
    if (blob.size === 0) throw new ErroExportacao('gravacao', 'O vídeo saiu vazio. Tente de novo (ou com um trecho menor).');
    return await corrigirDuracaoDoBlob(blob, duracaoReal);
  } finally {
    document.removeEventListener('visibilitychange', aoOcultar);
    fonteTempo?.parar();
    if (gravador && gravador.state !== 'inactive') {
      gravador.ondataavailable = null;
      gravador.onstop = null;
      gravador.onerror = null;
      try {
        gravador.stop();
      } catch {
        // A gravação já tinha terminado ou falhado: nada a parar.
      }
    }
    fluxo?.getTracks().forEach((t) => t.stop());
    renderizador?.liberar();
    if (proprio) fonte.liberar();
    if (trava) {
      trava.release().catch(() => {
        // O sistema já tinha solto a trava de tela (ao minimizar o app, por exemplo): nada a fazer.
      });
    }
  }
}
