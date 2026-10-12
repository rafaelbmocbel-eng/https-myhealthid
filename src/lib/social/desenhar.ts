import type { AnaliseParaExportar } from '@/lib/angular/analise';
import marcaBranca from '@/assets/logo-myhealthid-mark-branco.png';
import { protegerRosto } from './borrar';
import { fonteCss, garantirFontesSociais, medidorDoCanvas } from './fontes';
import { FORMATOS, layoutEfetivo, type FormatoSocial, type LayoutArte, type Retangulo, type TituloModo } from './formatos';
import { ENQUADRAMENTO_PADRAO, janelaDaImagem, type Enquadramento, type ModoAjuste, type PerfilMarcas } from './geometria';
import { ALTURA_CAPITAL, calcularLayoutSocial, larguraDoTexto, type LayoutSocial, type Medidor, type PilulaLayout, type RotuloLayout, type SeloLayout, type TituloLayout } from './layout';
import { caixaRostoPadrao, type CaixaRosto, type ModoRosto } from './rosto';

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
  /**
   * Como esconder o rosto. Sem informar, vale 'desfoque': mostrar o rosto exige 'nenhum' explícito, e só com a
   * autorização do paciente (o diálogo `ExportarSocialDialog` cobra essa autorização; quem desenha direto precisa cobrar).
   */
  modoRosto?: ModoRosto;
  /** Região do rosto de cada foto (fração da foto); sem ela, vale a caixa padrão do alto da foto (`caixaRostoPadrao`). */
  rostos?: (CaixaRosto | null | undefined)[];
}

export interface SeloImagem { imagem: CanvasImageSource; /** "logo" ganha um fundo claro para qualquer logo ser legível; "marca" é a marca branca do app. */ tipo: 'marca' | 'logo' }

export interface RecursosArte {
  selo?: SeloImagem | null;
  avatar?: CanvasImageSource | null;
}

export interface PainelPronto {
  fonte: CanvasImageSource;
  largura: number;
  altura: number;
  /** Foto limpa e marcações em camadas, do tamanho de `fonte`: o rosto é escondido na foto e as marcações vêm por cima. */
  camadas?: { foto: CanvasImageSource; marcacoes: CanvasImageSource };
  /** Refaz as marcações para a foto ocupar tantos pixels da arte por pixel dela; sem isso, vale `camadas.marcacoes` como veio. */
  marcacoesNaEscala?: (pxArtePorPxFoto: number) => CanvasImageSource | null;
}

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

// Camadas de tamanho diferente deslocariam as marcações em relação à foto: nesse caso vale a imagem já marcada.
function camadasCombinam(c: { foto: CanvasImageSource; marcacoes: CanvasImageSource }, d: { w: number; h: number }): boolean {
  const igual = (src: CanvasImageSource) => {
    const t = dimensoesDaFonte(src);
    return t.w === d.w && t.h === d.h;
  };
  return igual(c.foto) && igual(c.marcacoes);
}

/** Painéis prontos para pintar: canvases e bitmaps entram como vieram; endereços viram imagens carregadas. */
export async function prepararPaineis(arte: AnaliseParaExportar): Promise<PainelPronto[]> {
  return Promise.all(arte.paineis.map(async (p) => {
    const fonte: CanvasImageSource = typeof p.imagem === 'string' ? await carregarImagem(p.imagem) : p.imagem;
    const d = dimensoesDaFonte(fonte);
    const pronto: PainelPronto = { fonte, largura: d.w || p.largura, altura: d.h || p.altura };
    if (p.camadas && camadasCombinam(p.camadas, d)) {
      pronto.camadas = p.camadas;
      if (p.marcacoesNaEscala) pronto.marcacoesNaEscala = p.marcacoesNaEscala;
    }
    return pronto;
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

const FAIXAS_DO_PERFIL = 48;

/** Onde estão as marcações da foto (camada só com elas, fundo transparente): a soma da opacidade por coluna e por linha, em 48 faixas. Null sem marcações ou sem leitura do canvas. */
export function perfilDasMarcacoes(camada: CanvasImageSource, largura: number, altura: number): PerfilMarcas | null {
  if (!(largura > 0) || !(altura > 0) || typeof document === 'undefined') return null;
  const e = Math.min(1, 192 / Math.max(largura, altura));
  const w = Math.max(1, Math.round(largura * e)), h = Math.max(1, Math.round(altura * e));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  try {
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(camada, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    const colunas = new Array<number>(FAIXAS_DO_PERFIL).fill(0), linhas = new Array<number>(FAIXAS_DO_PERFIL).fill(0);
    let total = 0;
    for (let y = 0; y < h; y++) {
      const fy = Math.min(FAIXAS_DO_PERFIL - 1, Math.floor((y / h) * FAIXAS_DO_PERFIL));
      for (let x = 0; x < w; x++) {
        const a = data[(y * w + x) * 4 + 3];
        if (a === 0) continue;
        colunas[Math.min(FAIXAS_DO_PERFIL - 1, Math.floor((x / w) * FAIXAS_DO_PERFIL))] += a;
        linhas[fy] += a;
        total += a;
      }
    }
    if (!(total > 0)) return null;
    return { colunas: colunas.map((v) => v / total), linhas: linhas.map((v) => v / total) };
  } catch {
    // Canvas contaminado (imagem de outra origem) ou sem leitura de pixels: segue sem saber onde estão as marcações.
    return null;
  } finally {
    liberarCanvas(c);
  }
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

const liberarCanvas = (c: HTMLCanvasElement) => {
  // Zerar o tamanho devolve a memória na hora; o Safari do iPhone demora a recolher canvas descartado.
  c.width = 0;
  c.height = 0;
};

/** A própria foto, ampliada e desfocada, no tamanho da caixa (sem o escurecimento). Null sem canvas. */
function gerarFundoDesfocado(p: PainelPronto, caixa: Retangulo): HTMLCanvasElement | null {
  const pw = 10, ph = Math.max(4, Math.round((10 * caixa.h) / caixa.w));
  const pequeno = criarCanvas(pw, ph);
  const pc = pequeno.getContext('2d');
  if (!pc) return null;
  pc.imageSmoothingEnabled = true;
  pc.imageSmoothingQuality = 'high';
  const e = Math.max(pw / p.largura, ph / p.altura);
  pc.drawImage(p.fonte, (pw - p.largura * e) / 2, (ph - p.altura * e) / 2, p.largura * e, p.altura * e);
  let atual = pequeno;
  const alvoW = Math.ceil(caixa.w), alvoH = Math.ceil(caixa.h);
  for (let passo = 0; passo < 8 && (atual.width < alvoW || atual.height < alvoH); passo++) {
    const prox = criarCanvas(Math.min(alvoW, atual.width * 3), Math.min(alvoH, atual.height * 3));
    const c = prox.getContext('2d');
    if (!c) { liberarCanvas(prox); break; }
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(atual, 0, 0, prox.width, prox.height);
    liberarCanvas(atual);
    atual = prox;
  }
  return atual;
}

// O fundo só depende da foto e do tamanho da caixa, mas é caro de montar e a prévia redesenha a cada gesto.
// A chave é o painel (objeto novo a cada chamada de `desenharMolduraSocial`, então um quadro de vídeo reaproveitado nunca fica velho).
const fundosDesfocados = new WeakMap<PainelPronto, { chave: string; canvas: HTMLCanvasElement }>();

/** Sobras da foto "inteira": a própria foto, ampliada e desfocada, escurecida. */
function desenharFundoDesfocado(ctx: CanvasRenderingContext2D, p: PainelPronto, caixa: Retangulo) {
  const chave = `${Math.ceil(caixa.w)}x${Math.ceil(caixa.h)}:${p.largura}x${p.altura}`;
  let guardado = fundosDesfocados.get(p);
  if (guardado?.chave !== chave) {
    if (guardado) liberarCanvas(guardado.canvas);
    fundosDesfocados.delete(p);
    const canvas = gerarFundoDesfocado(p, caixa);
    guardado = canvas ? { chave, canvas } : undefined;
    if (guardado) fundosDesfocados.set(p, guardado);
  }
  if (!guardado) return;
  ctx.drawImage(guardado.canvas, caixa.x, caixa.y, caixa.w, caixa.h);
  ctx.fillStyle = 'rgba(6,10,20,0.62)';
  ctx.fillRect(caixa.x, caixa.y, caixa.w, caixa.h);
}

// Refazer as marcações custa um canvas do tamanho da foto: guarda a camada da última escala e só refaz quando o
// tamanho da foto na arte muda de verdade (passos de ~9%, que não se distinguem no desenho).
const camadasDeMarcacao = new WeakMap<PainelPronto, { passo: number; camada: CanvasImageSource }>();
const PASSOS_POR_OITAVA = 8;

function marcacoesDoPainel(p: PainelPronto, escala: number): CanvasImageSource | undefined {
  if (!p.camadas) return undefined;
  if (!p.marcacoesNaEscala || !(escala > 0)) return p.camadas.marcacoes;
  const passo = Math.round(Math.log2(escala) * PASSOS_POR_OITAVA);
  const guardada = camadasDeMarcacao.get(p);
  if (guardada?.passo === passo) return guardada.camada;
  const camada = p.marcacoesNaEscala(2 ** (passo / PASSOS_POR_OITAVA));
  if (!camada) return p.camadas.marcacoes;
  if (guardada && guardada.camada instanceof HTMLCanvasElement) liberarCanvas(guardada.camada);
  camadasDeMarcacao.set(p, { passo, camada });
  return camada;
}

function desenharPainel(
  ctx: CanvasRenderingContext2D, caixa: Retangulo, p: PainelPronto, modo: ModoAjuste, enq: Enquadramento, rosto: CaixaRosto, modoRosto: ModoRosto, escala: number,
) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  // Sombra não acompanha a transformação do contexto: sem multiplicar, a prévia teria um halo maior que o do arquivo.
  ctx.shadowBlur = 38 * escala;
  ctx.shadowOffsetY = 12 * escala;
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
    const base = p.camadas?.foto ?? p.fonte;
    ctx.drawImage(base, j.origem.x, j.origem.y, j.origem.w, j.origem.h, j.destino.x, j.destino.y, j.destino.w, j.destino.h);
    if (modoRosto !== 'nenhum') protegerRosto(ctx, base, p.largura, p.altura, j, caixa, rosto, modoRosto);
    const marcacoes = marcacoesDoPainel(p, j.escala);
    if (marcacoes) ctx.drawImage(marcacoes, j.origem.x, j.origem.y, j.origem.w, j.origem.h, j.destino.x, j.destino.y, j.destino.w, j.destino.h);
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
  usados.forEach((p, i) => desenharPainel(ctx, layout.paineis[i], p, ajusteDe(o, i), enquadramentoDe(o, i), o.rostos?.[i] ?? caixaRostoPadrao(p.largura, p.altura), o.modoRosto ?? 'desfoque', escala));
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
 *
 * Esta função não pede a autorização do paciente: quem exporta precisa cobrá-la (o caminho completo é
 * `arteDeQuadroDeVideo` + `ExportarSocialDialog`). Sem `opcoes.modoRosto` o rosto sai desfocado numa caixa padrão
 * no alto do quadro; mostrar o rosto exige `modoRosto: 'nenhum'` explícito.
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
