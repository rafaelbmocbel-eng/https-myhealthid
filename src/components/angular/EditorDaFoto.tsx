import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Eye, EyeOff, Grid3x3, Hand, ImageDown, Loader2, Maximize2, MousePointer2, Palette, Trash2, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import LupaFoto from '@/components/angular/LupaFoto';
import PainelEstilo from '@/components/angular/PainelEstilo';
import { ItensSvg } from '@/components/angular/MarcacaoSvg';
import { ColunaDeFerramentas } from '@/components/angular/ColunaDeFerramentas';
import { useGestosFoto } from '@/hooks/useGestosFoto';
import type { VisaoDaFoto } from '@/hooks/useVisaoDaFoto';
import type { AcoesDaSessao, FotoDaPosicao, ItemPosicao, ResumoDoItem } from '@/hooks/useSessaoPostural';
import { alcaDoPrumo, apoioPelaAlca, itensDaAnalise } from '@/lib/angular/analise';
import { escalaDoEstilo, escalaNaTela, type EstiloMarcacao } from '@/lib/angular/estilo';
import { segmentosDaMedida, type Medida, type Ponto } from '@/lib/angular/medidas';
import type { VistaSessao } from '@/lib/angular/tiposSessao';

const CORES = ['#ef4444', '#3b82f6', '#10b981', '#a855f7'];
const ZOOM_MAX = 5;
// Alvo de toque mínimo (px de tela) das alças, para o dedo acertar mesmo com a foto pequena.
const TOQUE_ATIVA = 16;
const TOQUE_OUTRAS = 10;
// Marcando pontos novos o alvo é menor, para um ponto próximo do anterior não ser tomado por arrasto.
const TOQUE_MARCANDO = 5;
const TOQUE_ALCA = 18;
// A prévia pequena nunca afina as retas abaixo de ~1/3 de pixel de tela por unidade de espessura do estilo.
const ESP_MIN_TELA_PX = 0.33;
const SUFIXO_ALCA = ':alca';

interface Props {
  /** Outra posição ou outra foto: o zoom volta ao normal. */
  posicao: VistaSessao;
  foto: FotoDaPosicao;
  item: ItemPosicao;
  resumo: ResumoDoItem;
  disponiveis: Medida[];
  medidaAtiva: Medida;
  acoes: AcoesDaSessao;
  estilo: EstiloMarcacao;
  aoMudarEstilo: (e: EstiloMarcacao) => void;
  visao: VisaoDaFoto;
  baixando: boolean;
  aoBaixar: () => void;
  /** Antes dos botões de desfazer e zoom (o "Automático" da postura). */
  inicioDaBarra?: ReactNode;
  /** No fim da barra, à direita (tirar outra foto, trocar a foto). */
  fimDaBarra?: ReactNode;
  /** Entre a barra e o painel de estilo (avisos da marcação, ações da página). */
  aposABarra?: ReactNode;
}

/**
 * Foto com as marcações: toque para marcar, arraste para ajustar, lupa, zoom e mover, a coluna de ferramentas, a barra de ações
 * (desfazer, limpar, zoom, grade, estilo, ver só o desenho, baixar imagem) e o painel de estilo. A postura e a análise livre usam o mesmo editor.
 */
export function EditorDaFoto({
  posicao, foto, item, resumo, disponiveis, medidaAtiva, acoes, estilo, aoMudarEstilo, visao, baixando, aoBaixar, inicioDaBarra, fimDaBarra, aposABarra,
}: Props) {
  const { grade, setGrade, semAlcas, setSemAlcas, painelEstilo, setPainelEstilo } = visao;
  const { analise, giro, temMarcacao: temPontosMarcados } = resumo;
  const pontos = item.pontos;
  const [zoom, setZoom] = useState(1);
  const [mover, setMover] = useState(false);
  const [larguraTela, setLarguraTela] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const caixaRef = useRef<HTMLDivElement>(null);
  const rolagemRef = useRef<HTMLDivElement>(null);

  // Outra posição ou outra foto: o zoom volta ao normal.
  useEffect(() => { setZoom(1); setMover(false); }, [posicao, foto]);

  // Largura do SVG na tela: converte pixels de tela em pixels da foto (alvos de toque e rótulo legível).
  useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const medir = () => setLarguraTela(el.getBoundingClientRect().width);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [foto, zoom, painelEstilo]);

  // Os botões de zoom ampliam em torno do centro do que está na tela (a pinça já ancora nos dedos).
  const centroZoom = useRef<{ fx: number; fy: number } | null>(null);
  const zoomBotao = (novo: (z: number) => number) => {
    const c = rolagemRef.current;
    if (c && c.scrollWidth > 0 && c.scrollHeight > 0) {
      centroZoom.current = { fx: (c.scrollLeft + c.clientWidth / 2) / c.scrollWidth, fy: (c.scrollTop + c.clientHeight / 2) / c.scrollHeight };
    }
    setZoom(novo);
  };
  useLayoutEffect(() => {
    const c = rolagemRef.current, k = centroZoom.current;
    centroZoom.current = null;
    if (!c || !k) return;
    c.scrollLeft = k.fx * c.scrollWidth - c.clientWidth / 2;
    c.scrollTop = k.fy * c.scrollHeight - c.clientHeight / 2;
  }, [zoom]);

  const ptsAtiva = pontos[medidaAtiva.id] ?? [];
  const proximo = ptsAtiva.length < medidaAtiva.pontos.length ? medidaAtiva.pontos[ptsAtiva.length] : null;
  // A medida ativa fica por último no SVG: onde pontos de medidas diferentes coincidem (pelve e quadril do joelho), o toque é dela.
  const medidasDasAlcas = useMemo(
    () => [...disponiveis].sort((a, b) => Number(a.id === medidaAtiva.id) - Number(b.id === medidaAtiva.id)),
    [disponiveis, medidaAtiva.id],
  );

  const kEstilo = escalaDoEstilo(foto.w, foto.h, zoom);
  const pxPorUnidade = larguraTela > 0 ? larguraTela / foto.w : 0;
  const itensTela = useMemo(
    () => itensDaAnalise(analise, estilo, { k: escalaNaTela(kEstilo, pxPorUnidade, estilo.tamanhoRotulo), espMinima: pxPorUnidade > 0 ? (estilo.espessura * ESP_MIN_TELA_PX) / pxPorUnidade : 0 }),
    [analise, estilo, kEstilo, pxPorUnidade],
  );
  const opacidadePorGrupo = useMemo(
    () => (semAlcas ? undefined : Object.fromEntries(disponiveis.filter((m) => m.id !== medidaAtiva.id).map((m) => [m.id, 0.6]))),
    [semAlcas, disponiveis, medidaAtiva.id],
  );

  const base = Math.max(foto.w, foto.h) / 110;
  const raio = base / Math.sqrt(zoom);
  const proporcao = foto.w / foto.h;
  const alturaMaxDvh = painelEstilo ? 55 : 75;
  const toquePx = (css: number) => (pxPorUnidade > 0 ? css / pxPorUnidade : raio * 2);

  const doEvento = (e: { clientX: number; clientY: number }): Ponto | null => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: Math.min(Math.max(p.x, 0), foto.w), y: Math.min(Math.max(p.y, 0), foto.h) };
  };

  // Um dedo marca e arrasta pontos (com a lupa); dois dedos fazem zoom e movem a foto.
  const gestos = useGestosFoto({
    svgRef, rolagemRef, caixaRef, zoom, setZoom, zoomMax: ZOOM_MAX, mover, noPonto: doEvento, podeMarcar: !!proximo,
    aoMarcar: (p) => acoes.marcar(posicao, medidaAtiva.id, p),
    aoArrastar: (medida, indice, p) => {
      if (medida.endsWith(SUFIXO_ALCA)) {
        // A alça do topo só desloca o fio na horizontal; o apoio mantém a altura.
        const id = medida.slice(0, -SUFIXO_ALCA.length);
        const apoio = pontos[id]?.[0];
        if (apoio) acoes.arrastar(posicao, id, 0, apoioPelaAlca(p, apoio, giro, foto.w));
        return;
      }
      acoes.arrastar(posicao, medida, indice, p);
    },
    aoIniciarArrasto: (medida) => acoes.ativar(posicao, medida.endsWith(SUFIXO_ALCA) ? medida.slice(0, -SUFIXO_ALCA.length) : medida),
  });

  const desfazer = () => acoes.desfazer(posicao, medidaAtiva.id);
  const limpar = () => acoes.limpar(posicao, medidaAtiva.id);

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <div ref={caixaRef} className="relative min-w-0 flex-1">
          <div ref={rolagemRef} className="overflow-auto rounded-2xl border border-border/60 bg-black" style={{ maxHeight: `${alturaMaxDvh}dvh` }}>
            <svg ref={svgRef} viewBox={`0 0 ${foto.w} ${foto.h}`} className={cn('mx-auto block max-w-none select-none [-webkit-touch-callout:none]', !mover && 'touch-none')}
              style={{ width: `min(${zoom * 100}%, calc(${alturaMaxDvh}dvh * ${proporcao.toFixed(4)} * ${zoom}))`, cursor: mover ? 'grab' : proximo ? 'crosshair' : 'default' }}
              onContextMenu={(e) => e.preventDefault()}
              {...gestos.handlers}>
              <image href={foto.url} width={foto.w} height={foto.h} />
              {grade && (
                <g transform={giro ? `rotate(${giro} ${foto.w / 2} ${foto.h / 2})` : undefined} stroke="#06b6d4" strokeOpacity={0.6} strokeWidth={base / 12} strokeDasharray={`${base / 2} ${base / 2}`} pointerEvents="none">
                  {Array.from({ length: 17 }, (_, i) => (
                    <g key={i}>
                      <line x1={-foto.w} x2={foto.w * 2} y1={(foto.h / 8) * (i - 4)} y2={(foto.h / 8) * (i - 4)} />
                      <line y1={-foto.h} y2={foto.h * 2} x1={(foto.w / 8) * (i - 4)} x2={(foto.w / 8) * (i - 4)} />
                    </g>
                  ))}
                </g>
              )}
              <ItensSvg itens={itensTela} opacidadePorGrupo={opacidadePorGrupo} />
              {!semAlcas && medidasDasAlcas.map((m) => {
                const p = pontos[m.id] ?? [];
                const destaque = m.id === medidaAtiva.id;
                const alca = destaque && m.desenho === 'prumo' && p.length > 0 ? alcaDoPrumo(p[0], foto.h, giro) : null;
                return (
                  <g key={m.id} opacity={destaque ? 1 : 0.6}>
                    {p.map((q, i) => (
                      <g key={i} onPointerDown={(e) => gestos.aoPressionarPonto(e, m.id, i)} style={{ cursor: mover ? 'grab' : 'move', pointerEvents: proximo && !destaque ? 'none' : undefined }}>
                        <circle cx={q.x} cy={q.y} r={Math.max(raio, toquePx(proximo ? TOQUE_MARCANDO : destaque ? TOQUE_ATIVA : TOQUE_OUTRAS))} fill="transparent" />
                        <circle cx={q.x} cy={q.y} r={raio} fill={CORES[i % CORES.length]} stroke="#fff" strokeWidth={raio / 5} />
                        <text x={q.x} y={q.y} textAnchor="middle" dominantBaseline="central" fontSize={raio * 1.1} fill="#fff" fontWeight="700" pointerEvents="none">{i + 1}</text>
                      </g>
                    ))}
                    {alca && (
                      <g onPointerDown={(e) => gestos.aoPressionarPonto(e, `${m.id}${SUFIXO_ALCA}`, 0)} style={{ cursor: mover ? 'grab' : 'ew-resize' }} data-testid="alca-prumo">
                        <circle cx={alca.x} cy={alca.y} r={toquePx(TOQUE_ALCA)} fill="transparent" />
                        <circle cx={alca.x} cy={alca.y} r={toquePx(12)} fill={estilo.cor} stroke="#fff" strokeWidth={toquePx(2)} />
                        <path d={`M ${alca.x - toquePx(6.5)} ${alca.y} H ${alca.x + toquePx(6.5)} M ${alca.x - toquePx(6.5)} ${alca.y} l ${toquePx(3)} ${-toquePx(3)} M ${alca.x - toquePx(6.5)} ${alca.y} l ${toquePx(3)} ${toquePx(3)} M ${alca.x + toquePx(6.5)} ${alca.y} l ${-toquePx(3)} ${-toquePx(3)} M ${alca.x + toquePx(6.5)} ${alca.y} l ${-toquePx(3)} ${toquePx(3)}`}
                          stroke="#111" strokeWidth={toquePx(2)} strokeLinecap="round" fill="none" pointerEvents="none" />
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {gestos.lupa && (
            <LupaFoto lupa={gestos.lupa} href={foto.url} w={foto.w} h={foto.h} svgRef={svgRef} caixaRef={caixaRef}
              pontos={ptsAtiva} segmentos={segmentosDaMedida(medidaAtiva)} comNovo={gestos.novoAtivo} />
          )}
        </div>

        <ColunaDeFerramentas disponiveis={disponiveis} pontos={pontos} ativaId={medidaAtiva.id} aoAtivar={(id) => acoes.ativar(posicao, id)} alturaMaxDvh={alturaMaxDvh} />
      </div>

      <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-border/60 bg-card p-1" role="toolbar" aria-label="Ações da foto">
        {inicioDaBarra}
        {inicioDaBarra && <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />}
        <Button size="icon" variant="ghost" className="h-10 w-10" aria-label="Desfazer o último ponto" title="Desfazer" onClick={desfazer} disabled={!ptsAtiva.length}><Undo2 className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" className="h-10 w-10" aria-label="Limpar a medida" title="Limpar a medida" onClick={limpar} disabled={!ptsAtiva.length}><Trash2 className="h-4 w-4" /></Button>
        <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
        <Button size="icon" variant="ghost" className="h-10 w-10" aria-label="Diminuir zoom" title="Diminuir zoom" onClick={() => zoomBotao((z) => Math.max(1, +(z - 0.5).toFixed(1)))} disabled={zoom <= 1}><ZoomOut className="h-4 w-4" /></Button>
        <span className="min-w-[2.6rem] text-center text-xs font-semibold tabular-nums">{Math.round(zoom * 100)}%</span>
        <Button size="icon" variant="ghost" className="h-10 w-10" aria-label="Aumentar zoom" title="Aumentar zoom" onClick={() => zoomBotao((z) => Math.min(ZOOM_MAX, +(z + 0.5).toFixed(1)))} disabled={zoom >= ZOOM_MAX}><ZoomIn className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" className="h-10 w-10" aria-label="Ajustar à tela" title="Ajustar à tela" onClick={() => { setZoom(1); setMover(false); }}><Maximize2 className="h-4 w-4" /></Button>
        <Button size="icon" variant={mover ? 'default' : 'ghost'} className="h-10 w-10" aria-pressed={mover} aria-label={mover ? 'Voltar a marcar' : 'Mover a foto com um dedo'} title={mover ? 'Voltar a marcar' : 'Mover a foto com um dedo'} onClick={() => setMover((m) => !m)} disabled={zoom <= 1}>
          {mover ? <Hand className="h-4 w-4" /> : <MousePointer2 className="h-4 w-4" />}
        </Button>
        <Button size="icon" variant={grade ? 'default' : 'ghost'} className="h-10 w-10" aria-pressed={grade} aria-label="Grade" title="Grade" onClick={() => setGrade((g) => !g)}><Grid3x3 className="h-4 w-4" /></Button>
        <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
        <Button size="icon" variant={painelEstilo ? 'default' : 'ghost'} className="h-10 w-10" aria-pressed={painelEstilo} aria-label="Estilo das linhas" title="Estilo das linhas (espessura, cor, arco e rótulo)" onClick={() => setPainelEstilo((v) => !v)}><Palette className="h-4 w-4" /></Button>
        <Button size="icon" variant={semAlcas ? 'default' : 'ghost'} className="h-10 w-10" aria-pressed={semAlcas} aria-label="Ver só o desenho" title="Ver só o desenho, sem as alças dos pontos" onClick={() => setSemAlcas((v) => !v)}>{semAlcas ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
        <Button size="icon" variant="ghost" className="h-10 w-10" aria-label="Baixar imagem" title="Baixar a foto com as marcações (PNG)" onClick={aoBaixar} disabled={!temPontosMarcados || baixando}>{baixando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageDown className="h-4 w-4" />}</Button>
        <span className="ml-auto flex items-center gap-1">{fimDaBarra}</span>
      </div>

      {aposABarra}

      {painelEstilo && <PainelEstilo estilo={estilo} aoMudar={aoMudarEstilo} aoFechar={() => setPainelEstilo(false)} />}

      <p className="text-xs text-muted-foreground" role="status">
        <strong className="text-foreground">{medidaAtiva.nome}.</strong>{' '}
        {mover ? 'Modo mover: arraste a foto com um dedo.'
          : proximo ? <>Toque e segure para ver a lupa; solte para marcar <strong className="text-foreground">{ptsAtiva.length + 1}. {proximo}</strong>.</>
            : 'Medida completa. Arraste um ponto para ajustar.'}
        {' '}Dois dedos: zoom e mover.
      </p>
    </div>
  );
}
