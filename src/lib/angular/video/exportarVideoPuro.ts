import { naturezaDasReferencias, referenciaPrincipal, situacaoDoValor, type NaturezaReferencia } from '@/lib/angular/analiseVideo/statusReferencia';
import type { CartaoMetricaUi } from '@/lib/angular/analiseVideo/tiposUi';
import { dataParaArquivo } from '@/lib/social/exportar';
import { FORMATOS, type FormatoSocial, type Retangulo } from '@/lib/social/formatos';
import type { ModoRosto } from '@/lib/social/rosto';
import type { Intervalo, TrilhaPose } from './tipos';

/*
 * Partes puras da exportação do vídeo analisado (sem canvas nem MediaRecorder): formatos, limites, escolha do tipo de arquivo,
 * mapeamento entre o tempo do vídeo e o tempo do arquivo gerado (câmera lenta), layout do quadro composto (vídeo, gráfico e
 * cartões de métricas), preparo dos textos e validações (inclusive a do consentimento do paciente). Tudo testável em Node.
 */

// ---------- formatos e limites ----------

export type FormatoVideo = 'original' | FormatoSocial;

export const ORDEM_FORMATOS_VIDEO: FormatoVideo[] = ['original', 'story', 'feed', 'quadrado'];

export const NOMES_FORMATO_VIDEO: Record<FormatoVideo, { nome: string; detalhe: string }> = {
  original: { nome: 'Original', detalhe: 'proporção do vídeo' },
  story: { nome: 'Story / Reels', detalhe: '9:16 · 1080×1920' },
  feed: { nome: 'Feed retrato', detalhe: '4:5 · 1080×1350' },
  quadrado: { nome: 'Quadrado', detalhe: '1:1 · 1080×1080' },
};

export const ehFormatoSocial = (f: FormatoVideo): f is FormatoSocial => f !== 'original';

export const VELOCIDADES_EXPORTACAO = [1, 0.5, 0.25, 0.1] as const;

export const LIMITES_EXPORTACAO = {
  /** Quadros por segundo do arquivo gerado. */
  fpsSaida: 30,
  /** O arquivo é gravado em tempo real: este é o tempo máximo que o profissional espera com a tela aberta. */
  duracaoMaximaSaidaS: 90,
  /** Trecho mínimo do vídeo de origem. */
  trechoMinimoS: 0.5,
  larguraMaxima: 1080,
  alturaMaxima: 1920,
  bitrateMinimo: 1_500_000,
  bitrateMaximo: 8_000_000,
} as const;

export type CodigoErroExportacao = 'sem_gravacao' | 'consentimento' | 'duracao' | 'trecho' | 'velocidade' | 'trilha' | 'fonte' | 'gravacao' | 'segundo_plano' | 'rosto';

export class ErroExportacao extends Error {
  readonly codigo: CodigoErroExportacao;
  constructor(codigo: CodigoErroExportacao, mensagem: string) {
    super(mensagem);
    this.name = 'ErroExportacao';
    this.codigo = codigo;
  }
}

export const ehErroExportacao = (e: unknown): e is ErroExportacao => e instanceof ErroExportacao;

/** Cancelamento pelo profissional: o nome "AbortError" é o mesmo do rastreio, então `ehCancelamento` reconhece os dois. */
export const erroDeCancelamento = (): Error => {
  const e = new Error('Gravação cancelada.');
  e.name = 'AbortError';
  return e;
};

// ---------- tipo de arquivo ----------

export interface EscolhaMime {
  /** Valor para `MediaRecorder` (com os codecs). */
  mime: string;
  extensao: 'mp4' | 'webm';
  /** O Instagram só aceita MP4 (H.264): WebM precisa de conversão antes de postar. */
  aceitoNoInstagram: boolean;
}

const MP4_H264 = [
  'video/mp4;codecs=avc1.640028',
  'video/mp4;codecs=avc1.4d0028',
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4;codecs=avc1',
  'video/mp4;codecs=h264',
];
const WEBM = ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm;codecs=h264', 'video/webm'];
// Sem codec declarado, o navegador escolhe: pode não ser H.264. Só entra se nada melhor existir.
const MP4_GENERICO = ['video/mp4'];

export const CANDIDATOS_MIME: string[] = [...MP4_H264, ...WEBM, ...MP4_GENERICO];

export const extensaoDoMime = (mime: string): 'mp4' | 'webm' => (/^video\/mp4/i.test(mime) ? 'mp4' : 'webm');

/**
 * Melhor tipo de arquivo que o navegador grava: MP4 com H.264 quando existir (é o que o Instagram aceita), senão WebM.
 * `suporta` é o `MediaRecorder.isTypeSupported` (injetável para testar).
 */
export function escolherMime(suporta: (mime: string) => boolean): EscolhaMime | null {
  for (const mime of CANDIDATOS_MIME) {
    let ok = false;
    try {
      ok = suporta(mime);
    } catch {
      // Alguns navegadores lançam erro para tipo que não conhecem: tratam como não suportado.
      ok = false;
    }
    if (ok) {
      const extensao = extensaoDoMime(mime);
      return { mime, extensao, aceitoNoInstagram: extensao === 'mp4' && /avc1|h264/i.test(mime) };
    }
  }
  return null;
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** "Elevação do braço" → "elevacao-do-braco": o nome do arquivo nunca leva dados do paciente. */
export function nomeSeguroParaArquivo(texto: string, max = 24): string {
  return semAcento(texto).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/, '');
}

export function nomeArquivoVideo(formato: FormatoVideo, gesto: string | undefined, extensao: string, data: Date = new Date()): string {
  const g = gesto ? nomeSeguroParaArquivo(gesto) : '';
  return `analise-${g ? `${g}-` : ''}${formato}-${dataParaArquivo(data)}.${extensao}`;
}

/** Bits por segundo do arquivo: proporcional ao tamanho do quadro, dentro de limites que o celular aguenta gravar em tempo real. */
export function bitrateDoVideo(largura: number, altura: number, fps: number = LIMITES_EXPORTACAO.fpsSaida): number {
  const bruto = largura * altura * fps * 0.09;
  return Math.round(Math.min(LIMITES_EXPORTACAO.bitrateMaximo, Math.max(LIMITES_EXPORTACAO.bitrateMinimo, bruto)));
}

// ---------- tempo: do vídeo ao arquivo ----------

const limitar = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/** Duração do arquivo gerado: o trecho dividido pela velocidade (0,25× deixa o trecho 4 vezes mais longo). */
export const duracaoDaSaida = (intervalo: Intervalo, velocidade: number): number => Math.max(0, intervalo.fim - intervalo.inicio) / velocidade;

/** Instante do vídeo de origem que aparece no instante `tSaida` do arquivo gerado. */
export const tempoDaFonte = (tSaida: number, intervalo: Intervalo, velocidade: number): number => limitar(intervalo.inicio + tSaida * velocidade, intervalo.inicio, intervalo.fim);

/** Instante do arquivo gerado em que aparece o instante `tFonte` do vídeo de origem. */
export const tempoDaSaida = (tFonte: number, intervalo: Intervalo, velocidade: number): number => (limitar(tFonte, intervalo.inicio, intervalo.fim) - intervalo.inicio) / velocidade;

/**
 * Índice do quadro da trilha que aparece no instante `tSaida` do arquivo gerado: o último quadro que já começou (como num player), de
 * modo que em câmera lenta cada quadro aparece pelo mesmo tempo, do primeiro ao último.
 */
export function quadroNaSaida(trilha: TrilhaPose, tSaida: number, intervalo: Intervalo, velocidade: number): number {
  const n = trilha.quadros.length;
  if (!n) return 0;
  const i = Math.floor((tempoDaFonte(tSaida, intervalo, velocidade) - trilha.quadros[0].t) * trilha.fps + 1e-6);
  return Math.min(n - 1, Math.max(0, Number.isFinite(i) ? i : 0));
}

export interface PlanoDeSaida {
  duracaoSaidaS: number;
  /** Quadros do arquivo gerado. */
  quadrosSaida: number;
  /** Quadros da trilha dentro do trecho. */
  quadrosFonte: number;
  /** Quantos quadros do arquivo mostram cada quadro da trilha (câmera lenta repete o quadro). */
  repeticoesPorQuadro: number;
}

export function planejarSaida(o: { intervalo: Intervalo; velocidade: number; fpsRastreio: number; fpsSaida?: number }): PlanoDeSaida {
  const fpsSaida = o.fpsSaida ?? LIMITES_EXPORTACAO.fpsSaida;
  const duracaoSaidaS = duracaoDaSaida(o.intervalo, o.velocidade);
  const quadrosFonte = Math.max(1, Math.round((o.intervalo.fim - o.intervalo.inicio) * o.fpsRastreio));
  return {
    duracaoSaidaS,
    quadrosSaida: Math.max(1, Math.round(duracaoSaidaS * fpsSaida)),
    quadrosFonte,
    repeticoesPorQuadro: fpsSaida / (o.fpsRastreio * o.velocidade),
  };
}

/** Maior trecho (s) do vídeo de origem que cabe no limite de duração do arquivo, na velocidade escolhida. */
export const trechoMaximoS = (velocidade: number): number => LIMITES_EXPORTACAO.duracaoMaximaSaidaS * velocidade;

/** Trecho de partida: o analisado, cortado no que cabe no limite de duração do arquivo. */
export function trechoPadrao(limites: Intervalo, velocidade: number): Intervalo {
  return { inicio: limites.inicio, fim: Math.min(limites.fim, limites.inicio + trechoMaximoS(velocidade)) };
}

/**
 * Mantém o trecho dentro de `limites`, com no mínimo `minimo` s e no máximo `maxDuracao` s. O lado que o profissional moveu manda;
 * o outro cede (e vale também quando a velocidade muda e o trecho deixa de caber).
 */
export function ajustarTrecho(t: Intervalo, limites: Intervalo, ladoMovido: 'inicio' | 'fim', maxDuracao: number, minimo: number = LIMITES_EXPORTACAO.trechoMinimoS): Intervalo {
  const minimoReal = Math.min(minimo, Math.max(0, limites.fim - limites.inicio));
  let inicio = limitar(t.inicio, limites.inicio, limites.fim), fim = limitar(t.fim, limites.inicio, limites.fim);
  if (ladoMovido === 'inicio') {
    inicio = Math.min(inicio, fim - minimoReal);
    if (fim - inicio > maxDuracao) fim = inicio + maxDuracao;
  } else {
    fim = Math.max(fim, inicio + minimoReal);
    if (fim - inicio > maxDuracao) inicio = fim - maxDuracao;
  }
  return { inicio: Math.max(limites.inicio, inicio), fim: Math.min(limites.fim, fim) };
}

/** Passos de uma barra de progresso de 0 a 1 a partir do instante do arquivo. */
export const progressoDaSaida = (tSaida: number, duracaoSaidaS: number): number => (duracaoSaidaS > 0 ? limitar(tSaida / duracaoSaidaS, 0, 1) : 1);

// ---------- textos ----------

export const rotuloVelocidade = (v: number): string => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}×`;

export const rotuloTempo = (t: number, casas = 2): string => `${t.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })} s`;

/** Corta o texto para caber em `larguraMax`, terminando em reticências. */
export function truncarTexto(texto: string, larguraMax: number, medir: (t: string) => number): string {
  if (medir(texto) <= larguraMax) return texto;
  const ELIPSE = '…';
  if (medir(ELIPSE) > larguraMax) return '';
  let lo = 0, hi = texto.length;
  while (lo < hi) {
    const meio = Math.ceil((lo + hi) / 2);
    if (medir(texto.slice(0, meio).trimEnd() + ELIPSE) <= larguraMax) lo = meio; else hi = meio - 1;
  }
  return texto.slice(0, lo).trimEnd() + ELIPSE;
}

/** Quebra o texto em linhas de até `larguraMax`, por palavras (uma palavra maior que a linha é cortada). */
export function quebrarTexto(texto: string, larguraMax: number, medir: (t: string) => number, maxLinhas = Infinity): string[] {
  const palavras = texto.split(/\s+/).filter(Boolean);
  const linhas: string[] = [];
  let atual = '';
  const fechar = () => { if (atual) linhas.push(atual); atual = ''; };
  for (const p of palavras) {
    const tentativa = atual ? `${atual} ${p}` : p;
    if (medir(tentativa) <= larguraMax) { atual = tentativa; continue; }
    fechar();
    let resto = p;
    while (medir(resto) > larguraMax && resto.length > 1) {
      let n = resto.length - 1;
      while (n > 1 && medir(resto.slice(0, n)) > larguraMax) n--;
      linhas.push(resto.slice(0, n));
      resto = resto.slice(n);
    }
    atual = resto;
  }
  fechar();
  if (linhas.length > maxLinhas) {
    const corte = linhas.slice(0, maxLinhas);
    corte[maxLinhas - 1] = truncarTexto(`${corte[maxLinhas - 1]}…`, larguraMax, medir).replace(/…{2,}$/, '…');
    return corte;
  }
  return linhas;
}

// ---------- cartões de métricas do vídeo ----------

/** 'fora_neutro': fora de uma faixa que não é de normalidade (média de grupos ou limiar), mostrado sem alerta. */
export type StatusMetricaVideo = 'dentro' | 'fora' | 'fora_neutro' | 'sem_referencia' | 'desconhecido';

export interface ValorMetricaVideo {
  lado: 'D' | 'E' | null;
  texto: string;
  status: StatusMetricaVideo;
  /** Erro de medida que o vídeo impõe, curto (ex.: "± 6,2%"). */
  incerteza?: string;
}

/** Um cartão de métrica no vídeo: título, valores (um por lado) e a referência com a fonte, quando existe. */
export interface ItemMetricaVideo {
  titulo: string;
  valores: ValorMetricaVideo[];
  /** Faixa e fonte, ex.: "127,2 a 146,2 cm/s · Bohannon, 1997 · PMID 9143432". Null sem referência confirmada. */
  referencia: string | null;
  /** O que a faixa é (normalidade, média de grupos ou limiar); só existe com referência. */
  natureza?: NaturezaReferencia;
  /** Há ressalvas desta métrica (erro de um quadro, poucos ciclos...): o cartão leva um asterisco e o detalhe vai no PDF. */
  comAviso?: boolean;
}

/** Rodapé fixo do vídeo analisado: a pose estimada em vídeo comum não é medida de laboratório nem diagnóstico. */
export const RODAPE_VIDEO = 'Estimativa por vídeo · não é diagnóstico';
export const RODAPE_VIDEO_COM_AVISO = 'Estimativa por vídeo · não é diagnóstico · * ver ressalvas no PDF';

/** Início do texto da referência no cartão: só a faixa de normalidade se chama "Ref."; os outros tipos dizem o que são. */
export const prefixoDaReferencia = (natureza: NaturezaReferencia | undefined): string =>
  natureza === 'faixa_de_medias' ? 'Médias de grupos: ' : natureza === 'limiar_heuristico' ? 'Limiar: ' : 'Ref.: ';

/**
 * Cartões estruturados da tela de análise. Só entra como referência o que o motor confirmou em fonte (`referencias`). O cartão mostra a
 * faixa que explica o "dentro" (ou, se nenhuma contém o valor, a primeira): nunca uma faixa que o valor não satisfaz ao lado de um "dentro".
 */
export function itensDeCartoes(cartoes: CartaoMetricaUi[]): ItemMetricaVideo[] {
  return cartoes.flatMap((c) => {
    if (!c.valores.length || c.valores.every((v) => v.texto === '—')) return [];
    const r = referenciaPrincipal(c);
    const referencia = r ? `${r.faixa} · ${r.rotulo ?? r.citacao}${r.pmid ? ` · PMID ${r.pmid}` : ''}` : null;
    const natureza = naturezaDasReferencias(c.referencias);
    const valores = c.valores.map((v): ValorMetricaVideo => ({
      lado: v.lado, texto: v.texto,
      status: v.status === 'fora' && !situacaoDoValor('fora', natureza).alerta ? 'fora_neutro' : v.status,
      ...(v.incertezaCurta ? { incerteza: v.incertezaCurta } : {}),
    }));
    return [{ titulo: c.titulo, valores, referencia, ...(r ? { natureza } : {}), ...(c.avisos.length ? { comAviso: true } : {}) }];
  });
}

const RE_REFERENCIA = /\s*\(referência:\s*(.*)\)\s*$/i;

/** Separa "• Título: D 62° · E 60° (referência: faixa, fonte)" em partes. */
export function separarReferencia(linha: string): { principal: string; referencia: string | null } {
  const sem = linha.replace(/^\s*[•\-–]\s*/, '').trim();
  const m = RE_REFERENCIA.exec(sem);
  if (!m) return { principal: sem, referencia: null };
  return { principal: sem.slice(0, m.index).trim(), referencia: m[1].replace(/\s*;\s*/g, ' · ').trim() || null };
}

/** Linhas de texto das métricas (uma por métrica) viram cartões simples, sem o símbolo de dentro/fora. */
export function itensDeLinhas(linhas: string[]): ItemMetricaVideo[] {
  return linhas.flatMap((l) => {
    const { principal, referencia } = separarReferencia(l);
    if (!principal) return [];
    const corte = principal.indexOf(':');
    const titulo = corte > 0 ? principal.slice(0, corte).trim() : principal;
    const resto = corte > 0 ? principal.slice(corte + 1).trim() : '';
    if (!resto) return [{ titulo, valores: [], referencia }];
    const valores: ValorMetricaVideo[] = resto.split(/\s·\s/).map((v) => {
      const lado = /^([DE])\s/.exec(v);
      return { lado: lado ? (lado[1] as 'D' | 'E') : null, texto: lado ? v.slice(lado[0].length).trim() : v.trim(), status: 'desconhecido' as const };
    });
    return [{ titulo, valores, referencia }];
  });
}

// ---------- layout do quadro composto ----------

export interface EntradaLayoutConteudo {
  larguraVideo: number;
  alturaVideo: number;
  /** Largura do quadro composto, em px. */
  largura: number;
  /** Altura fixa (a caixa da arte social). Sem ela, a altura segue o conteúdo, até `alturaMaxima`. */
  altura?: number;
  alturaMaxima?: number;
  grafico: boolean;
  nCartoes: number;
}

export interface LayoutConteudo {
  largura: number;
  altura: number;
  /** Faixa no topo com o nome do gesto, a velocidade, o tempo e o número do quadro: o vídeo fica limpo. */
  barra: Retangulo;
  video: Retangulo;
  /** Área disponível para o vídeo (o vídeo fica centralizado nela). */
  areaVideo: Retangulo;
  grafico: Retangulo | null;
  cartoes: Retangulo | null;
  colunas: 1 | 2;
  alturaCartao: number;
  espacoCartoes: number;
  /** Quantos espaços de cartão há; se forem menos que as métricas, o último espaço vira "+N métricas no PDF". */
  cartoesVisiveis: number;
  /** Corpo base do texto, em px. */
  fonte: number;
  margem: number;
}

export const par = (n: number): number => Math.max(2, 2 * Math.round(n / 2));

/** No formato original o vídeo cresce para baixo: mais cartões que isto viram "+N métricas no PDF". */
export const MAX_CARTOES_ORIGINAL = 8;

const FRACAO_GRAFICO = 0.3;
const FRACAO_GRAFICO_MIN = 0.2;
const FRACAO_CARTOES_MAX = 0.3;
const FRACAO_VIDEO_MIN = 0.34;

function medidasBase(W: number) {
  const margem = Math.max(6, Math.round(W * 0.022));
  const fonte = Math.max(11, Math.round(W * 0.026));
  return { margem, fonte, colunas: (W >= 560 ? 2 : 1) as 1 | 2, alturaCartao: Math.round(fonte * 3.8), espacoCartoes: Math.max(4, Math.round(margem * 0.6)), alturaBarra: Math.round(fonte * 2.2) };
}

function cartoesNaAltura(n: number, colunas: number, alturaCartao: number, espaco: number, linhasMax: number): { linhas: number; visiveis: number; altura: number } {
  const linhas = Math.max(1, Math.min(Math.ceil(n / colunas), linhasMax));
  return { linhas, visiveis: Math.min(n, linhas * colunas), altura: linhas * alturaCartao + (linhas - 1) * espaco };
}

function ajustarVideo(area: Retangulo, aw: number, ah: number): Retangulo {
  const e = Math.min(area.w / aw, area.h / ah);
  const w = Math.max(2, Math.round(aw * e)), h = Math.max(2, Math.round(ah * e));
  return { x: area.x + Math.round((area.w - w) / 2), y: area.y + Math.round((area.h - h) / 2), w, h };
}

function layoutNatural(e: EntradaLayoutConteudo, W: number): LayoutConteudo {
  const b = medidasBase(W);
  const barra: Retangulo = { x: 0, y: 0, w: W, h: b.alturaBarra };
  const hv = par((W * e.alturaVideo) / e.larguraVideo);
  let y = barra.h + hv;
  let grafico: Retangulo | null = null;
  let cartoes: Retangulo | null = null;
  let visiveis = 0;
  if (e.grafico) {
    const h = Math.round(W * FRACAO_GRAFICO);
    y += b.margem;
    grafico = { x: b.margem, y, w: W - 2 * b.margem, h };
    y += h;
  }
  if (e.nCartoes > 0) {
    const c = cartoesNaAltura(Math.min(e.nCartoes, MAX_CARTOES_ORIGINAL), b.colunas, b.alturaCartao, b.espacoCartoes, Infinity);
    visiveis = c.visiveis;
    y += b.margem;
    cartoes = { x: b.margem, y, w: W - 2 * b.margem, h: c.altura };
    y += c.altura;
  }
  const altura = par(grafico || cartoes ? y + b.margem : barra.h + hv);
  const areaVideo = { x: 0, y: barra.h, w: W, h: hv };
  return { largura: W, altura, barra, video: areaVideo, areaVideo, grafico, cartoes, colunas: b.colunas, alturaCartao: b.alturaCartao, espacoCartoes: b.espacoCartoes, cartoesVisiveis: visiveis, fonte: b.fonte, margem: b.margem };
}

function layoutFixo(e: EntradaLayoutConteudo, W: number, H: number): LayoutConteudo {
  const b = medidasBase(W);
  const barra: Retangulo = { x: 0, y: 0, w: W, h: b.alturaBarra };
  const linhasMaxCartoes = Math.max(1, Math.floor((H * FRACAO_CARTOES_MAX + b.espacoCartoes) / (b.alturaCartao + b.espacoCartoes)));
  const c = e.nCartoes > 0 ? cartoesNaAltura(e.nCartoes, b.colunas, b.alturaCartao, b.espacoCartoes, linhasMaxCartoes) : null;
  const hCartoes = c ? c.altura : 0;
  let hGrafico = e.grafico ? Math.min(Math.round(W * FRACAO_GRAFICO), Math.round(H * FRACAO_GRAFICO)) : 0;
  const reservado = () => barra.h + (e.grafico ? b.margem + hGrafico : 0) + (c ? b.margem + hCartoes : 0) + (e.grafico || c ? b.margem : 0);
  const minVideo = Math.round(H * FRACAO_VIDEO_MIN);
  // Se o vídeo ficaria pequeno demais, o gráfico encolhe até o mínimo antes de o vídeo ceder.
  if (e.grafico && H - reservado() < minVideo) hGrafico = Math.max(Math.round(W * FRACAO_GRAFICO_MIN), hGrafico - (minVideo - (H - reservado())));
  const hAreaVideo = Math.max(2, H - reservado());
  const areaVideo = { x: 0, y: barra.h, w: W, h: hAreaVideo };
  let y = barra.h + hAreaVideo;
  let grafico: Retangulo | null = null;
  let cartoes: Retangulo | null = null;
  if (e.grafico) { y += b.margem; grafico = { x: b.margem, y, w: W - 2 * b.margem, h: hGrafico }; y += hGrafico; }
  if (c) { y += b.margem; cartoes = { x: b.margem, y, w: W - 2 * b.margem, h: hCartoes }; }
  return {
    largura: W, altura: H, barra, video: ajustarVideo(areaVideo, e.larguraVideo, e.alturaVideo), areaVideo, grafico, cartoes, colunas: b.colunas,
    alturaCartao: b.alturaCartao, espacoCartoes: b.espacoCartoes, cartoesVisiveis: c ? c.visiveis : 0, fonte: b.fonte, margem: b.margem,
  };
}

/** O vídeo deixa faixas vazias (mais estreito ou mais baixo que a área dele)? Nesse caso a área ganha um fundo desfocado em vez de tarja preta. */
export const temSobraNaArea = (video: Retangulo, area: Retangulo): boolean => video.w < area.w - 1 || video.h < area.h - 1;

/** Retângulo, no destino `dw`×`dh`, que o vídeo `vw`×`vh` ocupa ao cobri-lo inteiro sem distorcer, centralizado (pode passar das bordas). */
export function retanguloQueCobre(vw: number, vh: number, dw: number, dh: number): Retangulo {
  const e = Math.max(dw / Math.max(1, vw), dh / Math.max(1, vh));
  const w = vw * e, h = vh * e;
  return { x: (dw - w) / 2, y: (dh - h) / 2, w, h };
}

/**
 * Onde ficam o vídeo, o gráfico e os cartões no quadro composto. Com `altura` (a caixa da arte social) tudo é encaixado nela e
 * o vídeo cede espaço aos painéis; sem `altura` o vídeo ocupa a largura toda e os painéis vêm abaixo. Todas as medidas são inteiras e
 * o quadro tem largura e altura pares (exigência dos codecs).
 */
export function calcularLayoutConteudo(e: EntradaLayoutConteudo): LayoutConteudo {
  if (!(e.larguraVideo > 0) || !(e.alturaVideo > 0) || !(e.largura > 0)) throw new Error('Dimensões inválidas para o quadro do vídeo.');
  let W = par(e.largura);
  if (e.altura !== undefined) return layoutFixo(e, W, par(e.altura));
  const max = e.alturaMaxima ?? LIMITES_EXPORTACAO.alturaMaxima;
  let l = layoutNatural(e, W);
  // Encolhe a largura na proporção; `par` arredonda para o par mais próximo e poderia devolver a mesma largura, então cada volta
  // desce pelo menos 2 px (o laço termina porque a largura cai sempre) e nunca passa do máximo.
  for (let i = 0; l.altura > max && W > 120 && i < 400; i++) {
    const proporcional = 2 * Math.floor((W * max) / l.altura / 2);
    W = Math.max(2, Math.min(proporcional, W - 2));
    l = layoutNatural(e, W);
  }
  return l;
}

/** Tamanho do quadro composto do formato "original": a largura do vídeo, no máximo 1080, e a altura que o conteúdo pede, no máximo 1920. */
export function tamanhoOriginal(larguraVideo: number, alturaVideo: number, grafico: boolean, nCartoes: number): LayoutConteudo {
  const largura = Math.min(LIMITES_EXPORTACAO.larguraMaxima, Math.max(480, larguraVideo));
  return calcularLayoutConteudo({ larguraVideo, alturaVideo, largura, grafico, nCartoes, alturaMaxima: LIMITES_EXPORTACAO.alturaMaxima });
}

export const dimensoesDoFormato = (f: FormatoSocial): { largura: number; altura: number } => ({ largura: FORMATOS[f].largura, altura: FORMATOS[f].altura });

// ---------- validação ----------

export interface EntradaValidacao {
  formato: FormatoVideo;
  velocidade: number;
  intervalo: Intervalo;
  nQuadros: number;
  modoRosto: ModoRosto;
  /** Consentimento do paciente para a moldura social. */
  autorizadoMoldura: boolean;
  /** Consentimento do paciente para mostrar o rosto fora da moldura (formato original). */
  autorizado?: boolean;
}

export const MENSAGEM_CONSENTIMENTO = 'Marque a autorização do paciente para usar a imagem antes de gerar o vídeo.';

/** Primeiro problema que impede a exportação (ou null). As mensagens vão direto para o profissional. */
export function validarExportacao(e: EntradaValidacao): ErroExportacao | null {
  if (e.nQuadros < 2) return new ErroExportacao('trilha', 'Não há quadros analisados suficientes para gerar o vídeo.');
  if (!(e.velocidade > 0.05) || e.velocidade > 2) return new ErroExportacao('velocidade', 'Escolha uma velocidade entre 0,1× e 1×.');
  if (!Number.isFinite(e.intervalo.inicio) || !Number.isFinite(e.intervalo.fim) || e.intervalo.fim - e.intervalo.inicio < LIMITES_EXPORTACAO.trechoMinimoS) {
    return new ErroExportacao('trecho', `O trecho precisa ter pelo menos ${LIMITES_EXPORTACAO.trechoMinimoS.toLocaleString('pt-BR')} s.`);
  }
  const saida = duracaoDaSaida(e.intervalo, e.velocidade);
  if (saida > LIMITES_EXPORTACAO.duracaoMaximaSaidaS + 1e-6) {
    const maxFonte = Math.floor(trechoMaximoS(e.velocidade) * 10) / 10;
    return new ErroExportacao('duracao', `O vídeo ficaria com ${Math.round(saida)} s e o máximo é ${LIMITES_EXPORTACAO.duracaoMaximaSaidaS} s. Escolha um trecho de até ${maxFonte.toLocaleString('pt-BR')} s ou uma velocidade maior.`);
  }
  if (ehFormatoSocial(e.formato) && !e.autorizadoMoldura) return new ErroExportacao('consentimento', MENSAGEM_CONSENTIMENTO);
  if (e.modoRosto === 'nenhum' && !(e.autorizadoMoldura || e.autorizado)) return new ErroExportacao('consentimento', 'Para mostrar o rosto, marque a autorização do paciente. Sem ela, o rosto sai coberto.');
  return null;
}

export const MENSAGEM_SEM_GRAVACAO =
  'Este aparelho não consegue gravar vídeo pelo navegador (falta o gravador de vídeo). Atualize o navegador ou o sistema (no iPhone, iOS 14.3 ou mais novo) e tente de novo. Enquanto isso, use “Quadro” para o Instagram ou o PDF.';

export interface SuporteGravacao { ok: boolean; motivo?: string; escolha?: EscolhaMime }

/** O ambiente grava vídeo a partir de um canvas? `ambiente` é injetável para testar. */
export function avaliarSuporteGravacao(ambiente: { temMediaRecorder: boolean; temCaptureStream: boolean; suporta: (mime: string) => boolean }): SuporteGravacao {
  if (!ambiente.temMediaRecorder || !ambiente.temCaptureStream) return { ok: false, motivo: MENSAGEM_SEM_GRAVACAO };
  const escolha = escolherMime(ambiente.suporta);
  if (!escolha) return { ok: false, motivo: MENSAGEM_SEM_GRAVACAO };
  return { ok: true, escolha };
}

/** Aviso (não bloqueia) sobre o tipo de arquivo, para o formato escolhido. */
export function avisoDoTipoDeArquivo(escolha: EscolhaMime | undefined, formato: FormatoVideo): string | null {
  if (!escolha || escolha.aceitoNoInstagram) return null;
  if (!ehFormatoSocial(formato)) return null;
  return `Este aparelho grava em ${escolha.extensao.toUpperCase()}. O Instagram só aceita MP4 (H.264): para postar, converta o arquivo antes (ou grave pelo celular, que costuma gerar MP4).`;
}
