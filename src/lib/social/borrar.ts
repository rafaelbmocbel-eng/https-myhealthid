import type { Retangulo } from './formatos';
import { posicaoNaArte, type JanelaImagem } from './geometria';
import type { CaixaRosto, ModoRosto } from './rosto';

/*
 * Esconde o rosto direto nos pixels da arte, antes de qualquer exportação: o desfoque é feito por
 * reduções e ampliações sucessivas (funciona em todos os navegadores, inclusive os que não têm
 * `ctx.filter`) e a tarja é opaca, então não há como recuperar o rosto pelo arquivo.
 */

const criarCanvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
};

/** Caixa do rosto na arte (px), segundo o enquadramento atual da foto. */
export function caixaDoRostoNaArte(rosto: CaixaRosto, janela: JanelaImagem, imgW: number, imgH: number, caixaPainel: Retangulo): Retangulo {
  const c = posicaoNaArte(janela, imgW, imgH, rosto.cx, rosto.cy, caixaPainel);
  const w = rosto.w * imgW * janela.escala, h = rosto.h * imgH * janela.escala;
  return { x: c.x - w / 2, y: c.y - h / 2, w, h };
}

function caminhoArredondado(ctx: CanvasRenderingContext2D, r: Retangulo, raio: number) {
  const k = Math.min(raio, r.w / 2, r.h / 2);
  ctx.beginPath();
  ctx.moveTo(r.x + k, r.y);
  ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, k);
  ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, k);
  ctx.arcTo(r.x, r.y + r.h, r.x, r.y, k);
  ctx.arcTo(r.x, r.y, r.x + r.w, r.y, k);
  ctx.closePath();
}

// Zerar o tamanho devolve a memória na hora; o Safari do iPhone demora a recolher canvas descartado, e a prévia refaz isto a cada gesto.
const liberarCanvas = (c: HTMLCanvasElement) => {
  c.width = 0;
  c.height = 0;
};

/** Amplia `origem` até `w`×`h` em passos de 2x, para o resultado sair liso e não em blocos. Os passos intermediários são liberados; `origem` não. */
function ampliarSuave(origem: HTMLCanvasElement, w: number, h: number): HTMLCanvasElement {
  let atual = origem;
  const alvoW = Math.ceil(w), alvoH = Math.ceil(h);
  for (let passo = 0; passo < 8 && (atual.width < alvoW || atual.height < alvoH); passo++) {
    const prox = criarCanvas(Math.min(alvoW, atual.width * 2), Math.min(alvoH, atual.height * 2));
    const c = prox.getContext('2d');
    if (!c) { liberarCanvas(prox); return atual; }
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(atual, 0, 0, prox.width, prox.height);
    if (atual !== origem) liberarCanvas(atual);
    atual = prox;
  }
  return atual;
}

/** Devolve false quando não conseguiu desfocar (canvas temporário não alocado): quem chama põe a tarja no lugar. */
function desfocarRegiao(ctx: CanvasRenderingContext2D, fonte: CanvasImageSource, imgW: number, imgH: number, rosto: CaixaRosto, janela: JanelaImagem, caixaPainel: Retangulo): boolean {
  // A região é um pouco maior que a caixa: o desfoque esmaece nas bordas e o rosto fica no miolo opaco.
  const w = rosto.w * 1.1, h = rosto.h * 1.1;
  const x0 = Math.max(0, rosto.cx - w / 2), x1 = Math.min(1, rosto.cx + w / 2);
  const y0 = Math.max(0, rosto.cy - h / 2), y1 = Math.min(1, rosto.cy + h / 2);
  if (x1 <= x0 || y1 <= y0) return true;
  const a = posicaoNaArte(janela, imgW, imgH, x0, y0, caixaPainel), b = posicaoNaArte(janela, imgW, imgH, x1, y1, caixaPainel);
  const dx = a.x, dy = a.y, dw = b.x - a.x, dh = b.y - a.y;
  if (dw < 2 || dh < 2) return true;

  // Cerca de 9 células na menor dimensão: some traço de olho, boca e contorno, e a cor da pele fica.
  const celula = Math.max(4, Math.min(dw, dh) / 9);
  const pequeno = criarCanvas(dw / celula, dh / celula);
  const pc = pequeno.getContext('2d');
  if (!pc) { liberarCanvas(pequeno); return false; }
  pc.imageSmoothingEnabled = true;
  pc.imageSmoothingQuality = 'high';
  pc.drawImage(fonte, x0 * imgW, y0 * imgH, (x1 - x0) * imgW, (y1 - y0) * imgH, 0, 0, pequeno.width, pequeno.height);

  const tmp = ampliarSuave(pequeno, Math.ceil(dw), Math.ceil(dh));
  const final = criarCanvas(dw, dh);
  const fc = final.getContext('2d');
  if (!fc) { liberarCanvas(final); liberarCanvas(tmp); liberarCanvas(pequeno); return false; }
  fc.imageSmoothingEnabled = true;
  fc.imageSmoothingQuality = 'high';
  fc.drawImage(tmp, 0, 0, final.width, final.height);

  // Borda esmaecida: o borrão se funde à foto em vez de parecer um adesivo.
  fc.globalCompositeOperation = 'destination-in';
  fc.save();
  fc.translate(final.width / 2, final.height / 2);
  fc.scale(1, final.height / final.width);
  const R = final.width / 2;
  const g = fc.createRadialGradient(0, 0, R * 0.8, 0, 0, R);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  fc.fillStyle = g;
  fc.fillRect(-R, -R, R * 2, R * 2);
  fc.restore();

  ctx.drawImage(final, dx, dy, dw, dh);
  liberarCanvas(final);
  liberarCanvas(tmp);
  liberarCanvas(pequeno);
  return true;
}

function pintarTarja(ctx: CanvasRenderingContext2D, imgW: number, imgH: number, janela: JanelaImagem, caixaPainel: Retangulo, rosto: CaixaRosto) {
  const r = caixaDoRostoNaArte(rosto, janela, imgW, imgH, caixaPainel);
  if (r.w < 2 || r.h < 2) return;
  ctx.save();
  caminhoArredondado(ctx, r, Math.min(r.w, r.h) * 0.16);
  ctx.fillStyle = '#080c16';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.stroke();
  ctx.restore();
}

/**
 * Pinta o desfoque ou a tarja sobre o rosto. Deve ser chamado com o clip da caixa da foto já ativo.
 * Se o desfoque não puder ser feito (memória de canvas esgotada, comum no iPhone), a tarja cobre no lugar: o rosto não fica à mostra
 * em silêncio. Devolve false só quando nada pôde ser coberto (enquadramento inválido); quem chama decide o que fazer.
 */
export function protegerRosto(
  ctx: CanvasRenderingContext2D, fonte: CanvasImageSource, imgW: number, imgH: number, janela: JanelaImagem, caixaPainel: Retangulo, rosto: CaixaRosto, modo: Exclude<ModoRosto, 'nenhum'>,
): boolean {
  if (!(janela.escala > 0)) return false;
  if (modo === 'desfoque' && desfocarRegiao(ctx, fonte, imgW, imgH, rosto, janela, caixaPainel)) return true;
  pintarTarja(ctx, imgW, imgH, janela, caixaPainel, rosto);
  return true;
}
