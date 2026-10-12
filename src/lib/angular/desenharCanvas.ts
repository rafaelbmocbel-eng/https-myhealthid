import { contextoDesenho, itensDaReta, itensDoAngulo, itensDoPrumo, itemRotulo, type ItemDesenho } from './desenho';
import { FAMILIA_ROTULO, type EstiloMarcacao } from './estilo';
import type { OlharPara, Ponto } from './medidas';

/** Pinta os itens num canvas cujo sistema de coordenadas é o da foto. `opacidadePorGrupo` esmaece medidas inteiras. */
export function pintarItens(ctx: CanvasRenderingContext2D, itens: ItemDesenho[], opacidadePorGrupo?: Record<string, number>): void {
  for (const it of itens) {
    ctx.save();
    ctx.globalAlpha = (it.tipo === 'reta' ? it.opacidade ?? 1 : 1) * (it.grupo !== undefined ? opacidadePorGrupo?.[it.grupo] ?? 1 : 1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (it.tipo === 'reta') {
      ctx.setLineDash(it.tracejado ?? []);
      if (it.halo) {
        ctx.strokeStyle = it.halo.cor; ctx.lineWidth = it.halo.largura;
        ctx.beginPath(); ctx.moveTo(it.a.x, it.a.y); ctx.lineTo(it.b.x, it.b.y); ctx.stroke();
      }
      ctx.strokeStyle = it.cor; ctx.lineWidth = it.largura;
      ctx.beginPath(); ctx.moveTo(it.a.x, it.a.y); ctx.lineTo(it.b.x, it.b.y); ctx.stroke();
    } else if (it.tipo === 'arco') {
      const passes = it.halo ? [{ cor: it.halo.cor, largura: it.halo.largura }, { cor: it.cor, largura: it.largura }] : [{ cor: it.cor, largura: it.largura }];
      for (const passe of passes) {
        ctx.strokeStyle = passe.cor; ctx.lineWidth = passe.largura;
        ctx.beginPath(); ctx.arc(it.centro.x, it.centro.y, it.raio, it.inicio, it.inicio + it.delta, it.delta < 0); ctx.stroke();
      }
    } else if (it.tipo === 'ponto') {
      ctx.beginPath(); ctx.arc(it.x, it.y, it.raio, 0, Math.PI * 2);
      ctx.fillStyle = it.cor; ctx.fill();
      ctx.lineWidth = it.larguraAnel; ctx.strokeStyle = it.anel; ctx.stroke();
    } else {
      const x = it.x - it.largura / 2, y = it.y - it.altura / 2, r = it.altura / 2;
      if (it.fundo) {
        ctx.beginPath();
        ctx.moveTo(x + r, y); ctx.lineTo(x + it.largura - r, y); ctx.arc(x + it.largura - r, y + r, r, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(x + r, y + it.altura); ctx.arc(x + r, y + r, r, Math.PI / 2, (3 * Math.PI) / 2); ctx.closePath();
        ctx.fillStyle = it.fundo; ctx.fill();
        if (it.larguraBorda > 0) { ctx.lineWidth = it.larguraBorda; ctx.strokeStyle = it.borda; ctx.stroke(); }
      }
      ctx.font = `700 ${it.fonte}px ${FAMILIA_ROTULO}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const ty = it.y + it.fonte * 0.04;
      if (it.contorno && it.larguraContorno > 0) { ctx.lineWidth = it.larguraContorno; ctx.strokeStyle = it.contorno; ctx.strokeText(it.texto, it.x, ty); }
      ctx.fillStyle = it.cor; ctx.fillText(it.texto, it.x, ty);
    }
    ctx.restore();
  }
}

const contextoDoCanvas = (ctx: CanvasRenderingContext2D, estilo: EstiloMarcacao) =>
  contextoDesenho(ctx.canvas.width, ctx.canvas.height, estilo);

/** Ângulo com vértice, dois braços, arco, pontas e rótulo; `graus` vira o texto (ex.: "118°"). */
export function desenharAngulo(ctx: CanvasRenderingContext2D, vertice: Ponto, a: Ponto, b: Ponto, estilo: EstiloMarcacao, graus: number): void {
  pintarItens(ctx, itensDoAngulo(vertice, a, b, contextoDoCanvas(ctx, estilo), { graus }));
}

export function desenharReta(ctx: CanvasRenderingContext2D, a: Ponto, b: Ponto, estilo: EstiloMarcacao): void {
  pintarItens(ctx, itensDaReta(a, b, contextoDoCanvas(ctx, estilo)));
}

export function desenharRotulo(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number, estilo: EstiloMarcacao): void {
  pintarItens(ctx, [itemRotulo(texto, x, y, contextoDoCanvas(ctx, estilo))]);
}

/** Fio de prumo: a vertical pelo apoio, os pontos e o desvio de cada um (`rotulo` já formatado). */
export function desenharPrumo(ctx: CanvasRenderingContext2D, apoio: Ponto, pontos: { ponto: Ponto; rotulo?: string }[], estilo: EstiloMarcacao, o: { giro?: number; olhaPara?: OlharPara } = {}): void {
  const c = contextoDesenho(ctx.canvas.width, ctx.canvas.height, estilo, { giro: o.giro });
  pintarItens(ctx, itensDoPrumo(apoio, pontos, c, o.olhaPara));
}
