import { FAMILIA_ROTULO } from '@/lib/angular/estilo';
import { COR_LADO } from './tiposUi';
import { layoutDoGrafico, valorNoTempo, type BandaGrafico, type LayoutGrafico, type MarcadorGrafico, type SerieGrafico } from './graficoLayout';

/*
 * O gráfico ângulo x tempo pintado num canvas (PDF e vídeo exportado), a partir do mesmo layout da tela.
 */

export interface TemaGrafico {
  fundo: string;
  texto: string;
  grade: string;
  eixo: string;
  cursor: string;
}

export const TEMA_CLARO: TemaGrafico = { fundo: '#ffffff', texto: '#4a5262', grade: '#e6e8ec', eixo: '#c3c6ce', cursor: '#1f2937' };
export const TEMA_ESCURO: TemaGrafico = { fundo: '#101b30', texto: '#cbd5e1', grade: 'rgba(255,255,255,0.12)', eixo: 'rgba(255,255,255,0.3)', cursor: '#ffffff' };

export interface OpcoesPintura {
  tema?: TemaGrafico;
  /** Instante do cursor (o quadro atual), se houver. */
  cursorT?: number;
  /** Fundo opaco; sem isso o canvas fica como estava. */
  comFundo?: boolean;
  /** Espessura da curva, na unidade do layout. */
  larguraCurva?: number;
  unidade?: string;
}

const nf = (v: number, c = 1) => v.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });

/** Pinta um layout já calculado. O canvas precisa ter as proporções do layout; use `escala` para o canvas maior que ele. */
export function pintarGrafico(ctx: CanvasRenderingContext2D, layout: LayoutGrafico, series: SerieGrafico[], bandas: BandaGrafico[], o: OpcoesPintura = {}): void {
  const tema = o.tema ?? TEMA_CLARO;
  const { area, fonte } = layout;
  ctx.save();
  if (o.comFundo) { ctx.fillStyle = tema.fundo; ctx.fillRect(0, 0, layout.largura, layout.altura); }
  ctx.font = `${fonte}px ${FAMILIA_ROTULO}`;

  for (const b of layout.bandas) {
    ctx.fillStyle = 'rgba(16,185,129,0.16)';
    ctx.fillRect(area.x0, b.y0, area.x1 - area.x0, Math.max(0, b.y1 - b.y0));
    ctx.strokeStyle = 'rgba(16,185,129,0.65)'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    for (const y of [b.y0, b.y1]) { ctx.beginPath(); ctx.moveTo(area.x0, y); ctx.lineTo(area.x1, y); ctx.stroke(); }
    ctx.setLineDash([]);
  }

  ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
  for (const tk of layout.ticksY) {
    ctx.strokeStyle = tema.grade; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(area.x0, tk.y); ctx.lineTo(area.x1, tk.y); ctx.stroke();
    ctx.fillStyle = tema.texto; ctx.fillText(tk.rotulo, area.x0 - fonte * 0.4, tk.y);
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (const tk of layout.ticksX) { ctx.fillStyle = tema.texto; ctx.fillText(tk.rotulo, tk.x, area.y1 + fonte * 0.6); }
  ctx.strokeStyle = tema.eixo; ctx.beginPath(); ctx.moveTo(area.x0, area.y1); ctx.lineTo(area.x1, area.y1); ctx.stroke();

  for (const m of layout.marcadores) {
    const cor = m.lado ? COR_LADO[m.lado] : '#71717a';
    ctx.strokeStyle = cor; ctx.globalAlpha = 0.8; ctx.lineWidth = 1.2;
    ctx.setLineDash(m.tipo === 'contato' ? [] : [3, 3]);
    ctx.beginPath(); ctx.moveTo(m.x, area.y0); ctx.lineTo(m.x, area.y1); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    if (m.tipo === 'contato') {
      ctx.fillStyle = cor; ctx.beginPath(); ctx.moveTo(m.x - 4, area.y0 - 1); ctx.lineTo(m.x + 4, area.y0 - 1); ctx.lineTo(m.x, area.y0 + 6); ctx.closePath(); ctx.fill();
    } else if (m.tipo === 'saida') {
      ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(m.x, area.y0 + 2, 3.2, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(m.x, area.y0 - 2); ctx.lineTo(m.x + 4, area.y0 + 2); ctx.lineTo(m.x, area.y0 + 6); ctx.lineTo(m.x - 4, area.y0 + 2); ctx.closePath(); ctx.stroke();
    }
  }

  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = o.larguraCurva ?? 2.2;
  for (const c of layout.caminhos) {
    ctx.strokeStyle = c.cor;
    ctx.stroke(new Path2D(c.d));
  }

  if (o.cursorT !== undefined) {
    const x = layout.xDoTempo(o.cursorT);
    ctx.strokeStyle = tema.cursor; ctx.lineWidth = 1.4; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.moveTo(x, area.y0); ctx.lineTo(x, area.y1); ctx.stroke(); ctx.globalAlpha = 1;
    for (const s of series) {
      const v = valorNoTempo(s, o.cursorT);
      if (v === null) continue;
      ctx.fillStyle = s.cor; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, layout.yDoValor(v), 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }
  ctx.restore();
  void bandas;
}

export interface GraficoParaCanvas {
  series: SerieGrafico[];
  marcadores?: MarcadorGrafico[];
  bandas?: BandaGrafico[];
  t0: number;
  duracao: number;
  unidade?: string;
}

/** Cria um canvas com o gráfico (largura × altura em px de saída; a escala interna é a do layout). Null sem canvas (testes). */
export function canvasDoGrafico(g: GraficoParaCanvas, largura: number, altura: number, o: OpcoesPintura & { escala?: number; fonte?: number } = {}): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const escala = o.escala ?? 2;
  const cv = document.createElement('canvas');
  cv.width = Math.round(largura * escala); cv.height = Math.round(altura * escala);
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  ctx.scale(escala, escala);
  const layout = layoutDoGrafico(g.series, g.marcadores ?? [], g.bandas ?? [], { largura, altura, t0: g.t0, duracao: g.duracao, unidade: g.unidade ?? o.unidade, fonte: o.fonte });
  pintarGrafico(ctx, layout, g.series, g.bandas ?? [], { comFundo: true, ...o });
  return cv;
}

export const textoDoValor = (v: number | null, unidade = '°') => (v === null ? '—' : `${nf(v)}${unidade}`);
