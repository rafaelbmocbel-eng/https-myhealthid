import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Hand, Maximize2, MousePointer2, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGestosFoto } from '@/hooks/useGestosFoto';
import { ItensSvg } from '@/components/angular/MarcacaoSvg';
import { contextoDesenho, itensDoAngulo, ordenarCamadas, separarRotulos, type ContextoDesenho } from '@/lib/angular/desenho';
import { escalaDoEstilo, escalaNaTela, type EstiloMarcacao } from '@/lib/angular/estilo';
import { limitar, quadrosDoDeslize, sensibilidadeDoDeslize } from '@/lib/angular/analiseVideo/tempo';
import { AUMENTO_LUPA } from '@/components/angular/LupaFoto';
import { ladoDe } from '@/lib/angular/video/tipos';
import { alcaMaisProxima } from '@/lib/angular/analiseVideo/marcacoes';
import LupaQuadro from './LupaQuadro';
import { COR_CENTRO, COR_LADO, type AlcaUi, type LigacaoUi, type MarcacaoAnguloUi, type PontoPx, type PontosDoQuadro } from '@/lib/angular/analiseVideo/tiposUi';

const ZOOM_MAX = 5;
const ESP_MIN_TELA_PX = 0.33;
// Alvo de toque da alça de cada ponto (px de tela): maior que o ponto desenhado para o dedo acertar.
const TOQUE_ALCA_PX = 26;
const MOVIMENTO_MINIMO_PX = 0.25;
const TOQUE_PARADO_PX = 10;
const PREFIXO_EXTRA = 'extra:';
// A lupa amplia só um pedaço da tela: um quadro de até 1600 px de lado basta e evita travar o primeiro toque em vídeos 4K no celular.
const LADO_MAX_LUPA_PX = 1600;

export interface CamadaApi {
  /** Pixels de tela → unidades do vídeo, para tamanhos que não dependem do zoom. */
  css: (px: number) => number;
  /** Liga um ponto da camada ao arrasto (chame no onPointerDown do ponto). */
  pressionar: (e: React.PointerEvent, id: string, indice: number) => void;
  /** Contexto de desenho no estilo escolhido, já na escala da tela. */
  contexto: ContextoDesenho;
  /** A camada está dentro da lupa: sem interação. */
  naLupa: boolean;
}

interface Props {
  url: string;
  /** Tamanho do vídeo em pixels; as coordenadas dos pontos estão nessa escala. */
  largura: number;
  altura: number;
  videoRef: RefObject<HTMLVideoElement>;
  quadro: number;
  nQuadros: number;
  pontos: PontosDoQuadro | null;
  ligacoes: LigacaoUi[];
  alcas: AlcaUi[];
  /** Onde sugerir os pontos que o detector perdeu neste quadro: viram alças tracejadas que o profissional arrasta até o lugar certo. */
  fantasmas?: PontosDoQuadro;
  /** Ângulos do quadro, calculados dos pontos recebidos (com o ponto arrastado já na posição do dedo). */
  marcacoesDe: (p: PontosDoQuadro) => MarcacaoAnguloUi[];
  estilo: EstiloMarcacao;
  mostrarEsqueleto: boolean;
  mostrarAngulos: boolean;
  /** Pode arrastar os pontos (desligado durante a reprodução). */
  podeCorrigir: boolean;
  aoCorrigir: (nome: string, ponto: PontoPx) => void;
  aoDeslizar: (quadro: number) => void;
  /** O vídeo está tocando: um toque na imagem pausa, para corrigir os pontos no quadro parado. */
  tocando?: boolean;
  aoPausar?: () => void;
  alturaMaxDvh?: number;
  /**
   * Camada extra dentro do SVG (medidas feitas à mão), nas coordenadas do vídeo. Recebe a conversão de pixels de tela
   * em unidades do vídeo e o gancho para tornar seus pontos arrastáveis (o arrasto volta em `aoArrastarExtra`).
   */
  camadaExtra?: (api: CamadaApi) => ReactNode;
  aoArrastarExtra?: (id: string, indice: number, p: PontoPx) => void;
  aviso?: string | null;
  /** Evento do toque na imagem, quando uma ferramenta de marcação está ativa (impede o deslizar de quadros). */
  gestosExtra?: { podeMarcar: boolean; aoMarcar: (p: PontoPx) => void; bloqueiaDeslize?: boolean };
}

const dist = (a: PontoPx, b: PontoPx) => Math.hypot(a.x - b.x, a.y - b.y);
const corDoPonto = (nome: string) => {
  const lado = ladoDe(nome);
  return lado ? COR_LADO[lado] : COR_CENTRO;
};

// Vídeo parado no quadro, com esqueleto e ângulos no estilo escolhido, pontos arrastáveis (com lupa), deslizar para
// trocar de quadro e zoom com dois dedos. Quem manda no tempo do vídeo é o pai; aqui só se desenha e se arrasta.
export default function PlayerQuadros({
  url, largura, altura, videoRef, quadro, nQuadros, pontos, ligacoes, alcas, fantasmas, marcacoesDe, estilo, mostrarEsqueleto, mostrarAngulos, podeCorrigir,
  aoCorrigir, aoDeslizar, tocando = false, aoPausar, alturaMaxDvh = 46, camadaExtra, aoArrastarExtra, aviso, gestosExtra,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const caixaRef = useRef<HTMLDivElement>(null);
  const rolagemRef = useRef<HTMLDivElement>(null);
  const lupaFonte = useRef<{ chave: string; url: string } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [mover, setMover] = useState(false);
  const [larguraTela, setLarguraTela] = useState(0);
  const [previa, setPrevia] = useState<{ nome: string; x: number; y: number } | null>(null);
  const previaRef = useRef<{ nome: string; x: number; y: number } | null>(null);
  const arrasto = useRef<{ nome: string; inicio: PontoPx } | null>(null);
  const deslize = useRef<{ x0: number; q0: number; id: number } | null>(null);
  const dedos = useRef(new Set<number>());
  const toqueRapido = useRef<{ x: number; y: number; id: number } | null>(null);
  const aoCorrigirRef = useRef(aoCorrigir);
  aoCorrigirRef.current = aoCorrigir;

  useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const medir = () => setLarguraTela(el.getBoundingClientRect().width);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [zoom, largura, url]);

  const pxPorUnidade = larguraTela > 0 ? larguraTela / largura : 0;
  const css = (px: number) => (pxPorUnidade > 0 ? px / pxPorUnidade : px * 2);

  const doEvento = (e: { clientX: number; clientY: number }): PontoPx | null => {
    const ctm = svgRef.current?.getScreenCTM();
    if (!ctm) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: limitar(p.x, 0, largura), y: limitar(p.y, 0, altura) };
  };

  const gestos = useGestosFoto({
    svgRef, rolagemRef, caixaRef, zoom, setZoom, zoomMax: ZOOM_MAX, mover, noPonto: doEvento,
    podeMarcar: !!gestosExtra?.podeMarcar && !mover,
    aoMarcar: (p) => gestosExtra?.aoMarcar(p),
    aoArrastar: (nome, i, p) => {
      if (nome.startsWith(PREFIXO_EXTRA)) { aoArrastarExtra?.(nome.slice(PREFIXO_EXTRA.length), i, p); return; }
      const n = { nome, x: p.x, y: p.y };
      previaRef.current = n;
      setPrevia(n);
    },
    aoIniciarArrasto: (nome) => {
      const atual = nome.startsWith(PREFIXO_EXTRA) ? undefined : pontos?.[nome] ?? fantasmas?.[nome];
      arrasto.current = atual ? { nome, inicio: { x: atual.x, y: atual.y } } : null;
      deslize.current = null;
    },
  });

  // O ponto só vale ao soltar o dedo: a lupa fecha e a correção entra de uma vez, como um quadro-chave.
  useEffect(() => {
    if (gestos.lupa) return;
    const a = arrasto.current;
    if (!a) return;
    arrasto.current = null;
    const p = previaRef.current;
    previaRef.current = null;
    setPrevia(null);
    if (p && p.nome === a.nome && dist(p, a.inicio) > MOVIMENTO_MINIMO_PX) aoCorrigirRef.current(p.nome, { x: p.x, y: p.y });
  }, [gestos.lupa]);

  // A pose de outro quadro nunca herda uma prévia do anterior.
  useEffect(() => { previaRef.current = null; setPrevia(null); arrasto.current = null; }, [quadro]);

  const pontosVisiveis = useMemo<PontosDoQuadro | null>(() => {
    if (!previa || (!pontos?.[previa.nome] && !fantasmas?.[previa.nome])) return pontos;
    return { ...pontos, [previa.nome]: { x: previa.x, y: previa.y, manual: true } };
  }, [pontos, fantasmas, previa]);

  const k = escalaNaTela(escalaDoEstilo(largura, altura, zoom), pxPorUnidade, estilo.tamanhoRotulo);
  const contexto = useMemo(
    () => contextoDesenho(largura, altura, estilo, { k, espMin: pxPorUnidade > 0 ? (estilo.espessura * ESP_MIN_TELA_PX) / pxPorUnidade : 0 }),
    [largura, altura, estilo, k, pxPorUnidade],
  );
  const itens = useMemo(() => {
    if (!pontosVisiveis || !mostrarAngulos) return [];
    const ctx = contexto;
    const todos = marcacoesDe(pontosVisiveis).flatMap((m) => itensDoAngulo(m.vertice, m.a, m.b, ctx, { graus: m.graus, tracejadoB: m.tracejadoB, semPontas: true }));
    return separarRotulos(ordenarCamadas(todos), largura, altura);
  }, [pontosVisiveis, mostrarAngulos, marcacoesDe, contexto, largura, altura]);

  const quadroParaLupa = (): string => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return '';
    const chave = `${url}#${quadro}`;
    if (lupaFonte.current?.chave === chave) return lupaFonte.current.url;
    const cv = document.createElement('canvas');
    const reducao = Math.min(1, LADO_MAX_LUPA_PX / Math.max(v.videoWidth, v.videoHeight));
    cv.width = Math.max(1, Math.round(v.videoWidth * reducao)); cv.height = Math.max(1, Math.round(v.videoHeight * reducao));
    cv.getContext('2d')?.drawImage(v, 0, 0, cv.width, cv.height);
    const u = cv.toDataURL('image/jpeg', 0.85);
    lupaFonte.current = { chave, url: u };
    return u;
  };

  const nomesFantasma = useMemo(() => alcas.filter((al) => !pontosVisiveis?.[al.nome] && !!fantasmas?.[al.nome]), [alcas, pontosVisiveis, fantasmas]);
  const alcasAtivas = podeCorrigir && (!!pontosVisiveis || nomesFantasma.length > 0) && !mover;
  const larguraLinha = css(2.6), raioPonto = css(4.2), raioAlca = css(8), raioToque = css(TOQUE_ALCA_PX);
  const proporcao = altura > 0 ? largura / altura : 1.78;
  const nomeArrastado = previa?.nome ?? null;

  // A alça mais perto do dedo (dentro do alvo de toque) é a que vai ser arrastada: com pontos próximos (joelhos cruzando na
  // marcha), a ordem de desenho não decide, a distância decide.
  const alcaMaisPerto = (e: React.PointerEvent<SVGSVGElement>): string | null => {
    if (!alcasAtivas) return null;
    const dedo = doEvento(e);
    if (!dedo) return null;
    return alcaMaisProxima({ ...fantasmas, ...pontosVisiveis }, alcas.map((al) => al.nome), dedo, raioToque);
  };

  const aoPressionar = (e: React.PointerEvent<SVGSVGElement>) => {
    const alca = dedos.current.size === 0 ? alcaMaisPerto(e) : null;
    if (alca) {
      dedos.current.add(e.pointerId);
      gestos.aoPressionarPonto(e, alca, 0);
      return;
    }
    gestos.handlers.onPointerDown(e);
    dedos.current.add(e.pointerId);
    toqueRapido.current = tocando && dedos.current.size === 1 ? { x: e.clientX, y: e.clientY, id: e.pointerId } : null;
    const livre = dedos.current.size === 1 && !(mover && zoom > 1) && !gestosExtra?.podeMarcar && !gestosExtra?.bloqueiaDeslize && !arrasto.current;
    if (livre) {
      deslize.current = { x0: e.clientX, q0: quadro, id: e.pointerId };
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch {
        // Captura indisponível (ponteiro já liberado): o deslizar segue só enquanto o dedo estiver sobre a imagem.
      }
    } else {
      deslize.current = null;
    }
  };
  const aoMover = (e: React.PointerEvent<SVGSVGElement>) => {
    gestos.handlers.onPointerMove(e);
    const d = deslize.current;
    if (!d || d.id !== e.pointerId || dedos.current.size > 1) return;
    const sens = sensibilidadeDoDeslize(caixaRef.current?.clientWidth ?? 360, nQuadros);
    const alvo = limitar(d.q0 + quadrosDoDeslize(e.clientX - d.x0, sens), 0, Math.max(0, nQuadros - 1));
    if (alvo !== quadro) aoDeslizar(alvo);
  };
  const aoSoltar = (e: React.PointerEvent<SVGSVGElement>) => {
    const t = toqueRapido.current;
    toqueRapido.current = null;
    if (t && t.id === e.pointerId && dedos.current.size === 1 && Math.hypot(e.clientX - t.x, e.clientY - t.y) < TOQUE_PARADO_PX) aoPausar?.();
    dedos.current.delete(e.pointerId);
    if (deslize.current?.id === e.pointerId) deslize.current = null;
    gestos.handlers.onPointerUp(e);
  };
  const aoCancelar = (e: React.PointerEvent<SVGSVGElement>) => {
    toqueRapido.current = null;
    dedos.current.delete(e.pointerId);
    if (deslize.current?.id === e.pointerId) deslize.current = null;
    gestos.handlers.onPointerCancel(e);
  };

  const botaoZoom = 'flex h-11 w-11 items-center justify-center rounded-xl border border-white/30 bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/70 disabled:opacity-40';

  return (
    <div ref={caixaRef} className="relative" data-testid="player-quadros">
      <div ref={rolagemRef} className="overflow-auto rounded-2xl border border-border/60 bg-black" style={{ maxHeight: `${alturaMaxDvh}dvh` }}>
        <div className="relative mx-auto" style={{ width: `min(${zoom * 100}%, calc(${alturaMaxDvh}dvh * ${proporcao.toFixed(4)} * ${zoom}))` }}>
          <video ref={videoRef} src={url} muted playsInline preload="auto" className="block w-full" data-testid="video-analise" />
          <svg
            ref={svgRef} viewBox={`0 0 ${largura} ${altura}`} data-testid="camada-marcacoes"
            className={cn('absolute inset-0 h-full w-full select-none [-webkit-touch-callout:none]', !(mover && zoom > 1) && 'touch-none')}
            style={{ cursor: mover ? 'grab' : gestosExtra?.podeMarcar ? 'crosshair' : 'default' }}
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={aoPressionar} onPointerMove={aoMover} onPointerUp={aoSoltar} onPointerCancel={aoCancelar}
          >
            {pontosVisiveis && mostrarEsqueleto && (
              <g pointerEvents="none" strokeLinecap="round">
                {ligacoes.map((l) => {
                  const a = pontosVisiveis[l.a], b = pontosVisiveis[l.b];
                  return a && b ? <line key={`${l.a}-${l.b}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={l.lado ? COR_LADO[l.lado] : COR_CENTRO} strokeOpacity={0.85} strokeWidth={larguraLinha} /> : null;
                })}
              </g>
            )}
            {camadaExtra?.({ css, pressionar: (e, id, i) => { dedos.current.add(e.pointerId); gestos.aoPressionarPonto(e, `${PREFIXO_EXTRA}${id}`, i); }, contexto, naLupa: false })}
            {pontosVisiveis && mostrarEsqueleto && !alcasAtivas && (
              <g pointerEvents="none">
                {alcas.map((al) => { const p = pontosVisiveis[al.nome]; return p ? <circle key={al.nome} cx={p.x} cy={p.y} r={raioPonto} fill={p.manual ? '#fbbf24' : corDoPonto(al.nome)} stroke="#fff" strokeWidth={css(1.5)} /> : null; })}
              </g>
            )}
            {alcasAtivas && nomesFantasma.map((al) => {
              const p = fantasmas![al.nome];
              return (
                <g key={`fantasma-${al.nome}`} pointerEvents="none" data-testid={`alca-fantasma-${al.nome}`} aria-label={`${al.rotulo}: ponto não detectado neste quadro; arraste para posicionar`}>
                  <circle cx={p.x} cy={p.y} r={raioToque} fill="transparent" />
                  <circle cx={p.x} cy={p.y} r={raioAlca} fill={corDoPonto(al.nome)} fillOpacity={0.18} stroke="#fff" strokeWidth={css(2)} strokeDasharray={`${css(4)} ${css(3)}`} />
                </g>
              );
            })}
            {alcasAtivas && alcas.map((al) => {
              const p = pontosVisiveis?.[al.nome];
              if (!p) return null;
              const ativo = nomeArrastado === al.nome;
              return (
                <g key={al.nome} pointerEvents="none" data-testid={`alca-${al.nome}`} aria-label={`${al.rotulo}: arraste para corrigir`}>
                  <circle cx={p.x} cy={p.y} r={raioToque} fill="transparent" />
                  <circle cx={p.x} cy={p.y} r={ativo ? raioAlca * 1.2 : raioAlca} fill={p.manual ? '#fbbf24' : corDoPonto(al.nome)} fillOpacity={0.92} stroke="#fff" strokeWidth={css(2)} />
                  {p.manual && <circle cx={p.x} cy={p.y} r={raioAlca * 0.38} fill="#78350f" />}
                </g>
              );
            })}
            <ItensSvg itens={itens} />
          </svg>
        </div>
      </div>

      <div className="absolute right-2 top-2 flex flex-col gap-1.5">
        <button type="button" className={botaoZoom} aria-label="Aumentar zoom" onClick={() => setZoom((z) => Math.min(ZOOM_MAX, +(z + 0.5).toFixed(1)))} disabled={zoom >= ZOOM_MAX}><ZoomIn className="h-5 w-5" /></button>
        <button type="button" className={botaoZoom} aria-label="Diminuir zoom" onClick={() => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)))} disabled={zoom <= 1}><ZoomOut className="h-5 w-5" /></button>
        {zoom > 1 && (
          <>
            <button type="button" className={botaoZoom} aria-label="Ajustar à tela" onClick={() => { setZoom(1); setMover(false); }}><Maximize2 className="h-5 w-5" /></button>
            <button type="button" className={cn(botaoZoom, mover && 'border-white bg-primary')} aria-pressed={mover} aria-label={mover ? 'Voltar a corrigir os pontos' : 'Mover a imagem com um dedo'} onClick={() => setMover((m) => !m)}>
              {mover ? <Hand className="h-5 w-5" /> : <MousePointer2 className="h-5 w-5" />}
            </button>
          </>
        )}
      </div>

      {aviso && <p className="pointer-events-none absolute left-2 top-2 max-w-[70%] rounded-lg bg-black/65 px-2.5 py-1.5 text-xs font-medium text-white" role="status">{aviso}</p>}

      {gestos.lupa && (
        <LupaQuadro lupa={gestos.lupa} href={quadroParaLupa()} w={largura} h={altura} svgRef={svgRef} caixaRef={caixaRef} pontos={pontosVisiveis ?? {}} ligacoes={ligacoes} nomeAtivo={nomeArrastado} extra={camadaExtra?.({ css: (px) => css(px) / AUMENTO_LUPA, pressionar: () => undefined, contexto, naLupa: true })} />
      )}
    </div>
  );
}
