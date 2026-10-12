import type { AnaliseParaExportar } from '@/lib/angular/analise';
import marcaBranca from '@/assets/logo-myhealthid-mark-branco.png';
import { protegerRosto } from './borrar';
import { fonteCss, garantirFontesSociais, medidorDoCanvas } from './fontes';
import { FORMATOS, layoutEfetivo, type FormatoSocial, type LayoutArte, type Retangulo, type TituloModo } from './formatos';
import { ENQUADRAMENTO_PADRAO, janelaDaImagem, type Enquadramento, type ModoAjuste } from './geometria';
import { ALTURA_CAPITAL, calcularLayoutSocial, larguraDoTexto, type LayoutSocial, type Medidor, type PilulaLayout, type RotuloLayout, type SeloLayout, type TituloLayout } from './layout';
import type { CaixaRosto, ModoRosto } from './rosto';

/*
 * Compositor da arte social: pinta no canvas o que `calcularLayoutSocial` decidiu. Funciona com uma ou
 * duas fotos já marcadas (saída do comparador ou da análise) e, na etapa do vídeo, com um quadro de
 * vídeo dentro da mesma moldura (`desenharMolduraSocial`).
 */

export interface OpcoesArte {
  formato: FormatoSocial;
  layout: LayoutArte;
  tituloModo?: TituloModo;
  titulo?: string;
  legenda?: string;
  /** Perfis sem o "@", no máximo três. */
  perfis?: string[];
  /** Mantém o texto fora das faixas que a interface do Instagram cobre no story. Sem isso, usa margens finas. */
  margensStories?: boolean;
  rotulos?: string[];
  datas?: string[];
  mostrarDatas?: boolean;
  modoAjuste?: ModoAjuste | ModoAjuste[];
  enquadramentos?: Enquadramento[];
  modoRosto?: ModoRosto;
  /** Região do rosto de cada foto (fração da foto); sem ela, o modo de rosto não desenha nada. */
  rostos?: (CaixaRosto | null | undefined)[];
}

export interface SeloImagem { imagem: CanvasImageSource; /** "logo" ganha um fundo claro para qualquer logo ser legível; "marca" é a marca branca do app. */ tipo: 'marca' | 'logo' }

export interface RecursosArte {
  selo?: SeloImagem | null;
  avatar?: CanvasImageSource | null;
}

export interface PainelPronto { fonte: CanvasImageSource; largura: number; altura: number }

export const COR_FUNDO_TOPO = '#0a0f1c';
export const COR_FUNDO_BASE = '#101b30';
const RAIO_FOTO = 28;

export function dimensoesDaFonte(src: CanvasImageSource): { w: number; h: number } {
  if ('naturalWidth' in src && src.naturalWidth) return { w: src.naturalWidth, h: src.naturalHeight };
  if ('videoWidth' in src && src.videoWidth) return { w: src.videoWidth, h: src.videoHeight };
  const s = src as { width?: number | { baseVal?: { value: number } }; height?: number | { baseVal?: { value: number } } };
  return { w: typeof s.width === 'number' ? s.width : 0, h: typeof s.height === 'number' ? s.height : 0 };
}

// ---------- carregamento ----------

export function carregarImagem(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, falha) => {
    const img = new Image();
    if (/^https?:/i.test(url)) img.crossOrigin = 'anonymous';
    img.onload = () => ok(img);
    img.onerror = () => falha(new Error('Não consegui abrir a imagem.'));
    img.src = url;
  });
}

/** Painéis prontos para pintar: canvases e bitmaps entram como vieram; endereços viram imagens carregadas. */
export async function prepararPaineis(arte: AnaliseParaExportar): Promise<PainelPronto[]> {
  return Promise.all(arte.paineis.map(async (p) => {
    const fonte: CanvasImageSource = typeof p.imagem === 'string' ? await carregarImagem(p.imagem) : p.imagem;
    const d = dimensoesDaFonte(fonte);
    return { fonte, largura: d.w || p.largura, altura: d.h || p.altura };
  }));
}

/** Um quadro de vídeo (canvas) como arte de uma foto só, para a etapa do vídeo reaproveitar o diálogo e o compositor. */
export function arteDeQuadroDeVideo(quadro: HTMLCanvasElement, o: { rotulo?: string; data?: string; titulo?: string; legenda?: string } = {}): AnaliseParaExportar {
  return {
    titulo: o.titulo, legenda: o.legenda,
    paineis: [{ rotulo: o.rotulo ?? '', data: o.data, imagem: quadro, largura: quadro.width, altura: quadro.height }],
    medidas: [],
  };
}

/** A marca branca do app como selo. */
export async function carregarMarcaDoApp(): Promise<SeloImagem> {
  return { imagem: await carregarImagem(marcaBranca), tipo: 'marca' };
}

/** Logo da clínica; se não carregar (rede, CORS), cai na marca do app. */
export async function carregarSeloDaClinica(logoUrl: string | undefined | null): Promise<SeloImagem> {
  if (logoUrl) {
    try {
      return { imagem: await carregarImagem(logoUrl), tipo: 'logo' };
    } catch {
      // Logo inacessível ou sem permissão de CORS (deixaria o canvas "sujo" e impediria o PNG): usa a marca do app.
    }
  }
  return carregarMarcaDoApp();
}

// ---------- pintura ----------

function caminho(ctx: CanvasRenderingContext2D, r: Retangulo, raio: number) {
  const k = Math.min(raio, r.w / 2, r.h / 2);
  ctx.beginPath();
  ctx.moveTo(r.x + k, r.y);
  ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, k);
  ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, k);
  ctx.arcTo(r.x, r.y + r.h, r.x, r.y, k);
  ctx.arcTo(r.x, r.y, r.x + r.w, r.y, k);
  ctx.closePath();
}

function criarCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function desenharFundo(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, COR_FUNDO_TOPO);
  g.addColorStop(1, COR_FUNDO_BASE);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const luz = ctx.createRadialGradient(W * 0.12, H * 0.06, 0, W * 0.12, H * 0.06, W * 0.95);
  luz.addColorStop(0, 'rgba(96,165,250,0.13)');
  luz.addColorStop(1, 'rgba(96,165,250,0)');
  ctx.fillStyle = luz;
  ctx.fillRect(0, 0, W, H);
  const luzBase = ctx.createRadialGradient(W * 0.95, H * 0.98, 0, W * 0.95, H * 0.98, W * 0.8);
  luzBase.addColorStop(0, 'rgba(76,175,80,0.08)');
  luzBase.addColorStop(1, 'rgba(76,175,80,0)');
  ctx.fillStyle = luzBase;
  ctx.fillRect(0, 0, W, H);
}

/** Sobras da foto "inteira": a própria foto, ampliada e desfocada, escurecida. */
function desenharFundoDesfocado(ctx: CanvasRenderingContext2D, p: PainelPronto, caixa: Retangulo) {
  const pw = 10, ph = Math.max(4, Math.round((10 * caixa.h) / caixa.w));
  const pequeno = criarCanvas(pw, ph);
  const pc = pequeno.getContext('2d');
  if (!pc) return;
  pc.imageSmoothingEnabled = true;
  pc.imageSmoothingQuality = 'high';
  const e = Math.max(pw / p.largura, ph / p.altura);
  pc.drawImage(p.fonte, (pw - p.largura * e) / 2, (ph - p.altura * e) / 2, p.largura * e, p.altura * e);
  let atual = pequeno;
  const alvoW = Math.ceil(caixa.w), alvoH = Math.ceil(caixa.h);
  for (let passo = 0; passo < 8 && (atual.width < alvoW || atual.height < alvoH); passo++) {
    const prox = criarCanvas(Math.min(alvoW, atual.width * 3), Math.min(alvoH, atual.height * 3));
    const c = prox.getContext('2d');
    if (!c) break;
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(atual, 0, 0, prox.width, prox.height);
    atual = prox;
  }
  ctx.drawImage(atual, caixa.x, caixa.y, caixa.w, caixa.h);
  ctx.fillStyle = 'rgba(6,10,20,0.62)';
  ctx.fillRect(caixa.x, caixa.y, caixa.w, caixa.h);
}

function desenharPainel(
  ctx: CanvasRenderingContext2D, caixa: Retangulo, p: PainelPronto, modo: ModoAjuste, enq: Enquadramento, rosto: CaixaRosto | null, modoRosto: ModoRosto,
) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 38;
  ctx.shadowOffsetY = 12;
  caminho(ctx, caixa, RAIO_FOTO);
  ctx.fillStyle = '#0a0f1a';
  ctx.fill();
  ctx.restore();

  ctx.save();
  caminho(ctx, caixa, RAIO_FOTO);
  ctx.clip();
  const j = janelaDaImagem(caixa, p.largura, p.altura, modo, enq);
  if (modo === 'inteira' && (j.destino.w < caixa.w - 1 || j.destino.h < caixa.h - 1)) desenharFundoDesfocado(ctx, p, caixa);
  if (j.escala > 0) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(p.fonte, j.origem.x, j.origem.y, j.origem.w, j.origem.h, j.destino.x, j.destino.y, j.destino.w, j.destino.h);
    if (rosto && modoRosto !== 'nenhum') protegerRosto(ctx, p.fonte, p.largura, p.altura, j, caixa, rosto, modoRosto);
  }
  ctx.restore();

  caminho(ctx, caixa, RAIO_FOTO);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.stroke();
}

function desenharTitulo(ctx: CanvasRenderingContext2D, t: TituloLayout) {
  ctx.save();
  ctx.font = fonteCss('titulo', t.fonte);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.translate(t.ancora.x, t.ancora.y);
  if (t.rotacao === -90) ctx.rotate(-Math.PI / 2);
  t.linhas.forEach((linha, i) => ctx.fillText(linha, 0, i * t.passo));
  ctx.restore();
}

function desenharRotulo(ctx: CanvasRenderingContext2D, r: RotuloLayout, medir: Medidor) {
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  const capTexto = ALTURA_CAPITAL.forte * r.fonte, capData = ALTURA_CAPITAL.texto * r.fonteData;
  if (r.rotacao === -90) {
    ctx.textAlign = 'center';
    let x = r.caixa.x;
    const girar = (texto: string, base: number, fonte: string, cor: string) => {
      ctx.save();
      ctx.translate(base, r.centro.y);
      ctx.rotate(-Math.PI / 2);
      ctx.font = fonte;
      ctx.fillStyle = cor;
      ctx.fillText(texto, 0, 0);
      ctx.restore();
    };
    if (r.texto) { x += capTexto; girar(r.texto, x, fonteCss('forte', r.fonte), '#ffffff'); }
    if (r.data) { x += (r.texto ? 12 : 0) + capData; girar(r.data, x, fonteCss('texto', r.fonteData), 'rgba(255,255,255,0.72)'); }
  } else {
    const wTexto = r.texto ? larguraDoTexto(medir, r.texto, r.fonte, 'forte') : 0;
    const wData = r.data ? larguraDoTexto(medir, r.data, r.fonteData, 'texto') : 0;
    const gap = r.texto && r.data ? 14 : 0;
    let x = r.centro.x - (wTexto + gap + wData) / 2;
    const base = r.centro.y + (r.texto ? capTexto : capData) / 2;
    ctx.textAlign = 'left';
    if (r.texto) { ctx.font = fonteCss('forte', r.fonte); ctx.fillStyle = '#ffffff'; ctx.fillText(r.texto, x, base); x += wTexto + gap; }
    if (r.data) { ctx.font = fonteCss('texto', r.fonteData); ctx.fillStyle = 'rgba(255,255,255,0.72)'; ctx.fillText(r.data, x, base); }
  }
  ctx.restore();
}

function desenharSelo(ctx: CanvasRenderingContext2D, s: SeloLayout, selo: SeloImagem) {
  const { cx, cy, r } = s;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  if (selo.tipo === 'logo') {
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
  } else {
    ctx.fillStyle = s.sobreFoto ? 'rgba(8,12,22,0.38)' : 'rgba(255,255,255,0.10)';
  }
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.38)';
  ctx.stroke();
  ctx.clip();
  const d = dimensoesDaFonte(selo.imagem);
  if (d.w > 0 && d.h > 0) {
    const lado = r * 2 * (selo.tipo === 'logo' ? 0.74 : 0.66);
    const e = Math.min(lado / d.w, lado / d.h);
    ctx.globalAlpha = selo.tipo === 'logo' ? 1 : 0.92;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(selo.imagem, cx - (d.w * e) / 2, cy - (d.h * e) / 2, d.w * e, d.h * e);
  }
  ctx.restore();
}

function desenharPilula(ctx: CanvasRenderingContext2D, p: PilulaLayout, avatar: CanvasImageSource | null | undefined) {
  ctx.save();
  caminho(ctx, p.caixa, p.caixa.h / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.20)';
  ctx.stroke();
  if (p.avatar) {
    const { cx, cy, r } = p.avatar;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fill();
    ctx.clip();
    const d = avatar ? dimensoesDaFonte(avatar) : { w: 0, h: 0 };
    if (avatar && d.w > 0 && d.h > 0) {
      const e = Math.max((r * 2) / d.w, (r * 2) / d.h);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(avatar, cx - (d.w * e) / 2, cy - (d.h * e) / 2, d.w * e, d.h * e);
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.stroke();
  }
  ctx.font = fonteCss('texto', p.fonte);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(p.texto, p.textoX, p.baseY);
  ctx.restore();
}

function desenharPerfis(ctx: CanvasRenderingContext2D, linhas: { texto: string; x: number; baseY: number; largura: number }[], fonte: number) {
  ctx.save();
  ctx.font = fonteCss('texto', fonte);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  for (const l of linhas) {
    ctx.fillText(l.texto, l.x, l.baseY);
    ctx.beginPath();
    ctx.moveTo(l.x - l.largura, l.baseY + 8);
    ctx.lineTo(l.x, l.baseY + 8);
    ctx.stroke();
  }
  ctx.restore();
}

const enquadramentoDe = (o: OpcoesArte, i: number): Enquadramento => o.enquadramentos?.[i] ?? ENQUADRAMENTO_PADRAO;
const ajusteDe = (o: OpcoesArte, i: number): ModoAjuste => (Array.isArray(o.modoAjuste) ? o.modoAjuste[i] : o.modoAjuste) ?? 'inteira';

/** Layout que `desenharArteSocial` usaria para estas opções (a prévia usa para saber onde cada foto cai). */
export function layoutDaArte(o: OpcoesArte, nPaineis: number, recursos: RecursosArte = {}, medir: Medidor = medidorDoCanvas): LayoutSocial {
  const mostrarDatas = o.mostrarDatas !== false;
  return calcularLayoutSocial({
    formato: o.formato, layout: o.layout, nPaineis, margensStories: o.margensStories !== false,
    titulo: o.titulo, tituloModo: o.tituloModo ?? 'vertical', rotulos: o.rotulos, datas: mostrarDatas ? o.datas : [],
    legenda: o.legenda, temAvatar: !!recursos.avatar, temSelo: !!recursos.selo, perfis: o.perfis,
  }, medir);
}

/**
 * Pinta a arte inteira no canvas de `ctx`, que deve ter `largura*escala` × `altura*escala` do formato.
 * Devolve o layout usado. As fontes precisam estar carregadas (`garantirFontesSociais`).
 */
export function desenharArteSocial(ctx: CanvasRenderingContext2D, o: OpcoesArte, paineis: PainelPronto[], recursos: RecursosArte = {}, escala = 1): LayoutSocial {
  const usados = paineis.slice(0, layoutEfetivo(o.layout, paineis.length) === 'unica' ? 1 : 2);
  const layout = layoutDaArte(o, usados.length, recursos);
  ctx.save();
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  ctx.clearRect(0, 0, layout.largura, layout.altura);
  desenharFundo(ctx, layout.largura, layout.altura);
  usados.forEach((p, i) => desenharPainel(ctx, layout.paineis[i], p, ajusteDe(o, i), enquadramentoDe(o, i), o.rostos?.[i] ?? null, o.modoRosto ?? 'nenhum'));
  if (layout.titulo) desenharTitulo(ctx, layout.titulo);
  layout.rotulos.forEach((r) => desenharRotulo(ctx, r, medidorDoCanvas));
  if (layout.selo && recursos.selo) desenharSelo(ctx, layout.selo, recursos.selo);
  if (layout.pilula) desenharPilula(ctx, layout.pilula, recursos.avatar);
  if (layout.perfis) desenharPerfis(ctx, layout.perfis.linhas, layout.perfis.fonte);
  ctx.restore();
  return layout;
}

/**
 * Moldura da arte (fundo, título, rótulo, selo, legenda e perfis) em volta de um único conteúdo, como um
 * quadro de vídeo. O canvas é ajustado ao formato. Para a etapa do vídeo: o conteúdo entra no lugar da foto.
 */
export function desenharMolduraSocial(
  ctx: CanvasRenderingContext2D, formato: FormatoSocial, opcoes: Omit<OpcoesArte, 'formato' | 'layout'>, conteudoCanvas: CanvasImageSource, recursos: RecursosArte = {}, escala = 1,
): LayoutSocial {
  const info = FORMATOS[formato];
  const w = Math.round(info.largura * escala), h = Math.round(info.altura * escala);
  if (ctx.canvas.width !== w || ctx.canvas.height !== h) {
    ctx.canvas.width = w;
    ctx.canvas.height = h;
  }
  const d = dimensoesDaFonte(conteudoCanvas);
  return desenharArteSocial(ctx, { ...opcoes, formato, layout: 'unica' }, [{ fonte: conteudoCanvas, largura: d.w, altura: d.h }], recursos, escala);
}

/** Cria um canvas do formato e pinta a arte nele; `escala` 1 é o arquivo final (1080 px de largura). */
export function renderizarArteSocial(o: OpcoesArte, paineis: PainelPronto[], recursos: RecursosArte = {}, escala = 1): { canvas: HTMLCanvasElement; layout: LayoutSocial } {
  const info = FORMATOS[o.formato];
  const canvas = criarCanvas(info.largura * escala, info.altura * escala);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Este navegador não consegue montar a imagem.');
  const layout = desenharArteSocial(ctx, o, paineis, recursos, escala);
  return { canvas, layout };
}

/** Carrega fontes e fotos e monta a arte: atalho para quem só quer o PNG a partir de um `AnaliseParaExportar`. */
export async function gerarArteSocial(arte: AnaliseParaExportar, o: OpcoesArte, recursos: RecursosArte = {}, escala = 1): Promise<{ canvas: HTMLCanvasElement; layout: LayoutSocial }> {
  await garantirFontesSociais();
  const paineis = await prepararPaineis(arte);
  const definidas = Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as unknown as OpcoesArte;
  return renderizarArteSocial({ titulo: arte.titulo, legenda: arte.legenda, rotulos: arte.paineis.map((p) => p.rotulo), datas: arte.paineis.map((p) => p.data ?? ''), ...definidas }, paineis, recursos, escala);
}
