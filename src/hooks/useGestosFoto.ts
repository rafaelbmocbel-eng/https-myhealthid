import { useLayoutEffect, useRef, useState, type PointerEvent as PE, type RefObject } from 'react';
import type { Ponto } from '@/lib/angular/medidas';

export interface LupaEstado { ponto: Ponto; cx: number; cy: number }

interface Opcoes {
  svgRef: RefObject<SVGSVGElement>;
  rolagemRef: RefObject<HTMLDivElement>;
  caixaRef: RefObject<HTMLDivElement>;
  zoom: number;
  setZoom: (z: number) => void;
  zoomMax: number;
  /** Modo mover: o dedo único rola a foto em vez de marcar. */
  mover: boolean;
  /** Ponto da imagem sob o dedo. */
  noPonto: (e: { clientX: number; clientY: number }) => Ponto | null;
  /** Há um próximo ponto da medida ativa a marcar. */
  podeMarcar: boolean;
  aoMarcar: (p: Ponto) => void;
  aoArrastar: (medida: string, indice: number, p: Ponto) => void;
  aoIniciarArrasto?: (medida: string) => void;
}

const limitar = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/**
 * Gestos da foto ou do vídeo: um dedo marca e arrasta pontos mostrando uma lupa (o ponto só vale ao soltar);
 * dois dedos fazem zoom e movem a imagem. Os ponteiros ficam em refs para não renderizar a cada movimento.
 */
export function useGestosFoto(o: Opcoes) {
  const ponteiros = useRef(new Map<number, { x: number; y: number }>());
  const gesto = useRef<{ dist: number; zoom: number; fx: number; fy: number } | null>(null);
  const ancora = useRef<{ fx: number; fy: number; ox: number; oy: number } | null>(null);
  const novoPonto = useRef<number | null>(null);
  const arrastando = useRef<{ medida: string; indice: number } | null>(null);
  const [lupa, setLupa] = useState<LupaEstado | null>(null);
  const [novoAtivo, setNovoAtivo] = useState(false);
  const op = useRef(o);
  op.current = o;

  const aplicarAncora = () => {
    const c = op.current.rolagemRef.current, a = ancora.current;
    if (!c || !a) return;
    c.scrollLeft = a.fx * c.scrollWidth - a.ox;
    c.scrollTop = a.fy * c.scrollHeight - a.oy;
  };
  useLayoutEffect(() => { aplicarAncora(); }, [o.zoom]);

  const mostrarLupa = (e: { clientX: number; clientY: number }, ponto: Ponto) => {
    const r = op.current.caixaRef.current?.getBoundingClientRect();
    if (r) setLupa({ ponto, cx: e.clientX - r.left, cy: e.clientY - r.top });
  };
  const fecharLupa = () => { setLupa(null); setNovoAtivo(false); };
  const dedos = () => [...ponteiros.current.values()];
  const anotar = (e: PE) => { ponteiros.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); };

  const iniciarGesto = () => {
    novoPonto.current = null; arrastando.current = null; fecharLupa();
    const c = op.current.rolagemRef.current;
    const [a, b] = dedos();
    if (!c || !a || !b) return;
    const r = c.getBoundingClientRect();
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    gesto.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: op.current.zoom, fx: (c.scrollLeft + mx - r.left) / c.scrollWidth, fy: (c.scrollTop + my - r.top) / c.scrollHeight };
  };

  const atualizarGesto = () => {
    const g = gesto.current, c = op.current.rolagemRef.current;
    const [a, b] = dedos();
    if (!g || !c || !a || !b) return;
    const r = c.getBoundingClientRect();
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const novo = limitar(g.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / g.dist), 1, op.current.zoomMax);
    ancora.current = { fx: g.fx, fy: g.fy, ox: mx - r.left, oy: my - r.top };
    if (Math.abs(novo - op.current.zoom) < 0.01) aplicarAncora(); else op.current.setZoom(novo);
  };

  const onPointerDown = (e: PE<SVGSVGElement>) => {
    anotar(e);
    if (ponteiros.current.size === 2) { iniciarGesto(); return; }
    if (ponteiros.current.size > 2 || op.current.mover || arrastando.current || !op.current.podeMarcar) return;
    const p = op.current.noPonto(e);
    if (!p) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    novoPonto.current = e.pointerId;
    setNovoAtivo(true);
    mostrarLupa(e, p);
  };

  const aoPressionarPonto = (e: PE, medida: string, indice: number) => {
    if (op.current.mover) return;
    e.stopPropagation();
    anotar(e);
    if (ponteiros.current.size > 1) { iniciarGesto(); return; }
    op.current.svgRef.current?.setPointerCapture(e.pointerId);
    arrastando.current = { medida, indice };
    op.current.aoIniciarArrasto?.(medida);
    const p = op.current.noPonto(e);
    if (p) mostrarLupa(e, p);
  };

  const onPointerMove = (e: PE<SVGSVGElement>) => {
    if (ponteiros.current.has(e.pointerId)) ponteiros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ponteiros.current.size >= 2) { atualizarGesto(); return; }
    const p = op.current.noPonto(e);
    if (!p) return;
    const alvo = arrastando.current;
    if (alvo) {
      op.current.aoArrastar(alvo.medida, alvo.indice, p);
      mostrarLupa(e, p);
    } else if (novoPonto.current === e.pointerId) {
      mostrarLupa(e, p);
    }
  };

  const onPointerUp = (e: PE<SVGSVGElement>) => {
    const eraGesto = ponteiros.current.size >= 2;
    ponteiros.current.delete(e.pointerId);
    if (eraGesto) { gesto.current = null; ancora.current = null; novoPonto.current = null; arrastando.current = null; fecharLupa(); return; }
    if (novoPonto.current === e.pointerId && op.current.podeMarcar) {
      const p = op.current.noPonto(e);
      if (p) op.current.aoMarcar(p);
    }
    novoPonto.current = null; arrastando.current = null; fecharLupa();
  };

  const onPointerCancel = (e: PE<SVGSVGElement>) => {
    ponteiros.current.delete(e.pointerId);
    novoPonto.current = null; arrastando.current = null; fecharLupa();
    if (ponteiros.current.size < 2) { gesto.current = null; ancora.current = null; }
  };

  return { lupa, novoAtivo, aoPressionarPonto, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel } };
}
