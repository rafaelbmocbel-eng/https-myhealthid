import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import LupaFoto from '@/components/angular/LupaFoto';
import { ItensSvg } from '@/components/angular/MarcacaoSvg';
import { useGestosFoto } from '@/hooks/useGestosFoto';
import { cn } from '@/lib/utils';
import { alcaDoPrumo, itensDaAnalise, type AnaliseFoto } from '@/lib/angular/analise';
import { ajustarNaCaixa } from '@/lib/angular/compararLayout';
import { escalaDoEstilo, escalaNaTela, type EstiloMarcacao } from '@/lib/angular/estilo';
import type { Medida, Ponto } from '@/lib/angular/medidas';

export interface FotoPainel { url: string; w: number; h: number; img: HTMLImageElement }

/** Sufixo do identificador da alça do fio de prumo nos gestos (a alça só desloca o fio na horizontal). */
export const SUFIXO_ALCA = ':alca';

// Raio de toque dos pontos arrastáveis, em pixels de tela: maior na medida ativa, para as outras não roubarem o toque de quem marca perto.
const TOQUE_ATIVA = 24;
const TOQUE_OUTRAS = 12;
// A prévia pequena nunca afina as retas abaixo de ~1/3 de pixel de tela por unidade de espessura do estilo.
const ESP_MIN_TELA_PX = 0.33;

interface Props {
  foto: FotoPainel | null;
  /** Pontos, nível e opções da foto; as marcações saem daqui. */
  analise: AnaliseFoto;
  /** Medidas da vista (para saber de quem é cada ponto arrastável). */
  medidas: Medida[];
  estilo: EstiloMarcacao;
  zoom: number;
  setZoom: (z: number) => void;
  zoomMax: number;
  /** Largura/altura da caixa que contém a foto. */
  razao: number;
  /** Altura máxima da caixa, em CSS (ex.: "70dvh"). */
  alturaMax?: string;
  /** Edição: um dedo marca e arrasta pontos; sem isso, só zoom e rolagem. */
  editavel?: boolean;
  /** Edição com a foto presa ao dedo (rolar em vez de marcar). */
  mover?: boolean;
  medidaAtiva?: string;
  pontosAtiva?: Ponto[];
  segmentosAtiva?: [number, number][];
  podeMarcar?: boolean;
  aoMarcar?: (p: Ponto) => void;
  aoArrastar?: (medida: string, indice: number, p: Ponto) => void;
  aoIniciarArrasto?: (medida: string) => void;
  rolagemRef: RefObject<HTMLDivElement>;
  aoRolar?: () => void;
  /** Mostrado no lugar da foto enquanto não há foto. */
  vazio?: ReactNode;
  descricao: string;
}

// Uma foto com as marcações por cima. Na comparação só dá zoom e rolagem; na edição marca e arrasta
// os pontos com a lupa, como na tela principal da análise.
export default function PainelComparacao({
  foto, analise, medidas, estilo, zoom, setZoom, zoomMax, razao, alturaMax = '75dvh', editavel = false, mover = false, medidaAtiva,
  pontosAtiva = [], segmentosAtiva = [], podeMarcar = false, aoMarcar, aoArrastar, aoIniciarArrasto, rolagemRef, aoRolar, vazio, descricao,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const caixaRef = useRef<HTMLDivElement>(null);
  const [caixa, setCaixa] = useState({ w: 0, h: 0 });

  // Mede a caixa externa (que não tem barra de rolagem), para a foto caber inteira sem laço de redimensionamento.
  useEffect(() => {
    const el = caixaRef.current;
    if (!el) return undefined;
    const medir = () => setCaixa({ w: el.clientWidth, h: el.clientHeight });
    medir();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [foto]);

  const noPonto = (e: { clientX: number; clientY: number }): Ponto | null => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm || !foto) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: Math.min(Math.max(p.x, 0), foto.w), y: Math.min(Math.max(p.y, 0), foto.h) };
  };

  const gestos = useGestosFoto({
    svgRef, rolagemRef, caixaRef, zoom, setZoom, zoomMax, mover: editavel ? mover : true, noPonto,
    podeMarcar: editavel && podeMarcar,
    aoMarcar: (p) => aoMarcar?.(p),
    aoArrastar: (medida, indice, p) => aoArrastar?.(medida, indice, p),
    aoIniciarArrasto,
  });

  const ajuste = foto ? ajustarNaCaixa(caixa.w, caixa.h, foto.w, foto.h) : { w: 0, h: 0 };
  const medido = ajuste.w > 0;
  const pxPorUnidade = foto && medido ? (ajuste.w * zoom) / foto.w : 0;

  const itens = useMemo(() => {
    if (!foto) return [];
    const k = escalaNaTela(escalaDoEstilo(foto.w, foto.h, zoom), pxPorUnidade, estilo.tamanhoRotulo);
    return itensDaAnalise(analise, estilo, {
      k, auxiliares: editavel, espMinima: pxPorUnidade > 0 ? (estilo.espessura * ESP_MIN_TELA_PX) / pxPorUnidade : 0,
    });
  }, [foto, analise, estilo, zoom, pxPorUnidade, editavel]);

  const opacidadePorGrupo = useMemo(
    () => (editavel ? Object.fromEntries(medidas.filter((m) => m.id !== medidaAtiva).map((m) => [m.id, 0.6])) : undefined),
    [editavel, medidas, medidaAtiva],
  );

  // Unidades da foto por pixel de tela: alças, anel e número ficam do mesmo tamanho em qualquer zoom.
  const un = pxPorUnidade > 0 ? 1 / pxPorUnidade : 1;
  const alcas = !editavel ? [] : medidas
    // Enquanto a medida ativa ainda recebe pontos, só os dela são arrastáveis: o quadril da medida do joelho
    // cai em cima do ponto da pelve, e a alça da pelve roubaria o toque de quem está marcando.
    .filter((m) => !podeMarcar || m.id === medidaAtiva)
    .flatMap((m) => (analise.pontos[m.id] ?? []).map((q, i) => ({ m, q, i })))
    .sort((a, b) => Number(a.m.id === medidaAtiva) - Number(b.m.id === medidaAtiva));
  const prumo = editavel ? medidas.find((m) => m.id === medidaAtiva && m.desenho === 'prumo') : undefined;
  const alcaPrumo = prumo && foto && (analise.pontos[prumo.id]?.length ?? 0) > 0 ? alcaDoPrumo(analise.pontos[prumo.id][0], foto.h, analise.giro) : null;
  const livreParaRolar = !editavel || mover;

  return (
    <div ref={caixaRef} className="relative mx-auto overflow-hidden rounded-2xl border border-border/60 bg-black" style={{ aspectRatio: String(razao), maxHeight: alturaMax, width: `min(100%, calc(${alturaMax} * ${razao}))` }}>
      {!foto ? (
        <div className="absolute inset-0 flex items-center justify-center p-2">{vazio}</div>
      ) : (
        <div ref={rolagemRef} onScroll={aoRolar} className="absolute inset-0 flex overflow-auto overscroll-contain">
          <svg
            ref={svgRef} viewBox={`0 0 ${foto.w} ${foto.h}`} role="img" aria-label={descricao}
            className={cn('m-auto block max-w-none shrink-0 select-none [-webkit-touch-callout:none]', !livreParaRolar && 'touch-none')}
            style={{
              width: medido ? ajuste.w * zoom : `${zoom * 100}%`,
              height: medido ? ajuste.h * zoom : undefined,
              touchAction: livreParaRolar ? 'pan-x pan-y' : undefined,
              cursor: !editavel ? 'default' : mover ? 'grab' : podeMarcar ? 'crosshair' : 'default',
            }}
            onContextMenu={(e) => e.preventDefault()}
            {...gestos.handlers}
          >
            <image href={foto.url} width={foto.w} height={foto.h} />
            <ItensSvg itens={itens} opacidadePorGrupo={opacidadePorGrupo} />
            {alcas.map(({ m, q, i }) => {
              const ativa = m.id === medidaAtiva;
              return (
                <g key={`${m.id}-${i}`} onPointerDown={(e) => gestos.aoPressionarPonto(e, m.id, i)} style={{ cursor: mover ? 'grab' : 'move' }}>
                  {ativa && (
                    <>
                      <circle cx={q.x} cy={q.y} r={15 * un} fill="none" stroke="#ffffff" strokeOpacity={0.9} strokeWidth={1.6 * un} pointerEvents="none" />
                      <text x={q.x + 19 * un} y={q.y - 19 * un} fontSize={13 * un} fontWeight={700} fill="#ffffff" stroke="#000000" strokeWidth={3 * un} paintOrder="stroke" textAnchor="middle" pointerEvents="none">{i + 1}</text>
                    </>
                  )}
                  <circle cx={q.x} cy={q.y} r={(ativa ? TOQUE_ATIVA : TOQUE_OUTRAS) * un} fill="transparent" />
                </g>
              );
            })}
            {prumo && alcaPrumo && (
              <g onPointerDown={(e) => gestos.aoPressionarPonto(e, `${prumo.id}${SUFIXO_ALCA}`, 0)} style={{ cursor: mover ? 'grab' : 'ew-resize' }} data-testid="alca-prumo">
                <circle cx={alcaPrumo.x} cy={alcaPrumo.y} r={TOQUE_ATIVA * un} fill="transparent" />
                <circle cx={alcaPrumo.x} cy={alcaPrumo.y} r={12 * un} fill={estilo.cor} stroke="#fff" strokeWidth={2 * un} />
                <path d={`M ${alcaPrumo.x - 6.5 * un} ${alcaPrumo.y} H ${alcaPrumo.x + 6.5 * un}`} stroke="#111" strokeWidth={2 * un} strokeLinecap="round" fill="none" pointerEvents="none" />
              </g>
            )}
          </svg>
        </div>
      )}
      {foto && editavel && gestos.lupa && (
        <LupaFoto lupa={gestos.lupa} href={foto.url} w={foto.w} h={foto.h} svgRef={svgRef} caixaRef={caixaRef} pontos={pontosAtiva} segmentos={segmentosAtiva} comNovo={gestos.novoAtivo} />
      )}
    </div>
  );
}
