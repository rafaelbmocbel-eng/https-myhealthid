import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ClipboardCheck, Copy, FileDown, Film, Hand, Loader2, Maximize2, MousePointer2, Pause, Play, Plus, Ruler, Sparkles, Trash2, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { parseNum } from '@/components/dosagem/comuns';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { tabela } from '@/lib/dosagem/db';
import { cmPorPixel, girar, rotacaoDoNivel, segmentosDaMedida, type Medida, type Ponto } from '@/lib/angular/medidas';
import { MEDIDAS_VIDEO, sugerirNoQuadro } from '@/lib/angular/medidasVideo';
import { detectarPose, detectarVideo } from '@/lib/angular/detector';
import LupaFoto from '@/components/angular/LupaFoto';
import { COR_REFERENCIA as COR_REF, ICONE_MEDIDA, LADO_MEDIDA } from '@/components/angular/iconesMedida';
import { useGestosFoto } from '@/hooks/useGestosFoto';
import type { Frame } from '@/lib/angular/marcha';
import { fotoComMarcacoes, type GrupoDesenho } from '@/lib/angular/relatorio';
import { gerarRelatorioVideo } from '@/lib/angular/relatorioVideo';
import { entregarPdf } from '@/lib/pdf/entrega';

const CORES = ['#ef4444', '#3b82f6', '#10b981', '#a855f7'];
const ZOOM_MAX = 5;
const FPS_OPCOES = [24, 30, 60, 120, 240];
const MAX_ANALISE_S = 30;
const FPS_ANALISE_MAX = 60;
const ANGULOS_AUTO = ['joelho-d', 'joelho-e', 'quadril-d', 'quadril-e', 'tornozelo-d', 'tornozelo-e'] as const;
const LIGACOES: [number, number][] = [[11, 12], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 29], [29, 31], [28, 30], [30, 32], [11, 13], [13, 15], [12, 14], [14, 16]];
const COR_LADO = { d: '#2A78D6', e: '#EB6834' };
const nf = (n: number, d = 1) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const valorTexto = (v: number, un?: 'cm') => `${nf(v)}${un === 'cm' ? ' cm' : '°'}`;

interface Captura {
  uid: string;
  medida: Medida;
  t: number;
  quadro: number;
  pontos: Ponto[];
  valor: number;
  texto: string;
  imagem: { url: string; w: number; h: number } | null;
}

const valorNoQuadro = (id: string, lm: Frame['lm'], w: number, h: number, giro: number | null): number | null => {
  const m = MEDIDAS_VIDEO.find((x) => x.id === id);
  const pts = m && lm ? sugerirNoQuadro(id, lm, w, h) : null;
  if (!m || !pts) return null;
  return m.calcular(giro ? pts.map((q) => girar(q, -giro)) : pts)?.valor ?? null;
};

function GraficoAngulos({ titulo, d, e, fps, t, dur, onSeek }: { titulo: string; d: number[]; e: number[]; fps: number; t: number; dur: number; onSeek: (t: number) => void }) {
  const todos = [...d, ...e].filter((v) => Number.isFinite(v));
  if (todos.length < 2) return null;
  const min = Math.min(...todos), max = Math.max(...todos), span = max - min || 1;
  const W = 320, H = 120, L = 32, R = 6, T = 8, B = 16;
  const X = (i: number) => L + ((i / fps) / dur) * (W - L - R);
  const Y = (v: number) => T + (1 - (v - min) / span) * (H - T - B);
  const caminho = (serie: number[]) => serie.map((v, i) => (Number.isFinite(v) ? `${Number.isFinite(serie[i - 1]) ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}` : '')).join(' ');
  return (
    <figure className="space-y-1">
      <figcaption className="text-xs font-medium">{titulo}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full cursor-pointer" role="img" aria-label={titulo}
        onClick={(ev) => { const r = ev.currentTarget.getBoundingClientRect(); const f = ((ev.clientX - r.left) / r.width * W - L) / (W - L - R); onSeek(Math.min(Math.max(f, 0), 1) * dur); }}>
        {[min, (min + max) / 2, max].map((v) => (
          <g key={v}><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="currentColor" opacity={0.12} /><text x={L - 4} y={Y(v)} textAnchor="end" dominantBaseline="central" fontSize={9} fill="currentColor" opacity={0.6}>{Math.round(v)}°</text></g>
        ))}
        <path d={caminho(d)} fill="none" stroke={COR_LADO.d} strokeWidth={1.8} strokeLinejoin="round" />
        <path d={caminho(e)} fill="none" stroke={COR_LADO.e} strokeWidth={1.8} strokeLinejoin="round" />
        <line x1={X(t * fps)} x2={X(t * fps)} y1={T} y2={H - B} stroke="currentColor" strokeWidth={1} opacity={0.6} />
        <text x={L} y={H - 3} fontSize={9} fill="currentColor" opacity={0.6}>0 s</text>
        <text x={W - R} y={H - 3} textAnchor="end" fontSize={9} fill="currentColor" opacity={0.6}>{nf(dur, 1)} s</text>
      </svg>
    </figure>
  );
}

// Análise angular ponto a ponto no vídeo: o profissional para em um quadro, marca os pontos (ou deixa o app
// sugerir pela pose), guarda a medida daquele instante e segue para outro quadro. O vídeo fica só no aparelho.
export default function PontoAPontoVideo({ paciente }: { paciente: { id: string; nome: string; sobrenome?: string | null } | null | undefined }) {
  const { user, profile } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const caixaRef = useRef<HTMLDivElement>(null);
  const rolagemRef = useRef<HTMLDivElement>(null);
  const lupaFonte = useRef<{ t: number; url: string } | null>(null);
  const [arquivo, setArquivo] = useState<{ url: string; w: number; h: number; dur: number } | null>(null);
  const [fps, setFps] = useState(30);
  const [t, setT] = useState(0);
  const [tocando, setTocando] = useState(false);
  const [velocidade, setVelocidade] = useState(0.25);
  const [ativa, setAtiva] = useState('joelho-d');
  const [pontos, setPontos] = useState<Record<string, Ponto[]>>({});
  const [refs, setRefs] = useState<Record<string, Ponto[]>>({});
  const [capturas, setCapturas] = useState<Captura[]>([]);
  const [escalaCm, setEscalaCm] = useState('');
  const [nivelTipo, setNivelTipo] = useState<'horizontal' | 'vertical'>('horizontal');
  const [sugerindo, setSugerindo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const analiseRef = useRef<HTMLVideoElement>(null);
  const quadrosRef = useRef<Frame[]>([]);
  const [nQuadros, setNQuadros] = useState(0);
  const [progresso, setProgresso] = useState<number | null>(null);
  const [esqueleto, setEsqueleto] = useState(true);
  const [mostrarAngulos, setMostrarAngulos] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [mover, setMover] = useState(false);

  useEffect(() => () => { if (arquivo) URL.revokeObjectURL(arquivo.url); }, [arquivo]);

  const quadro = Math.round(t * fps);
  const fpsAnalise = Math.min(fps, FPS_ANALISE_MAX);
  const quadroAuto: Frame | undefined = nQuadros > 0 ? quadrosRef.current[Math.round(t * fpsAnalise)] : undefined;
  const medida: Medida = MEDIDAS_VIDEO.find((m) => m.id === ativa) ?? MEDIDAS_VIDEO[0];
  const ehRef = !!medida.auxiliar;
  const ptsAtiva = (ehRef ? refs[medida.id] : pontos[medida.id]) ?? [];
  const proximo = ptsAtiva.length < medida.pontos.length ? medida.pontos[ptsAtiva.length] : null;

  const giro = useMemo(() => {
    const p = refs.nivel;
    return p && p.length >= 2 ? rotacaoDoNivel(p[0], p[1], nivelTipo) : null;
  }, [refs.nivel, nivelTipo]);
  const cmPorPx = useMemo(() => {
    const p = refs.escala, cm = parseNum(escalaCm);
    return p && p.length >= 2 && cm ? cmPorPixel(p[0], p[1], cm) : null;
  }, [refs.escala, escalaCm]);

  // Análise automática do vídeo inteiro (esqueleto em cada quadro), em um vídeo escondido para não travar a marcação manual.
  useEffect(() => {
    if (!arquivo) return;
    let cancelado = false;
    quadrosRef.current = [];
    setNQuadros(0); setProgresso(0);
    const espera = window.setTimeout(async () => {
      const v = analiseRef.current;
      if (!v) return;
      try {
        await detectarVideo(v, {
          fps: fpsAnalise, maxSegundos: MAX_ANALISE_S, cancelado: () => cancelado, onProgresso: (p) => { if (!cancelado) setProgresso(p); },
          onQuadro: (i, q) => { quadrosRef.current[i] = q; if (i % 4 === 0) setNQuadros(i + 1); },
        });
        if (!cancelado) setNQuadros(quadrosRef.current.length);
      } catch {
        // Sem internet para baixar o modelo ou navegador sem suporte: segue só a marcação manual.
        if (!cancelado) toast.error('Não consegui carregar a detecção automática agora. Marque os pontos à mão.');
      } finally {
        if (!cancelado) setProgresso(null);
      }
    }, 400);
    return () => { cancelado = true; window.clearTimeout(espera); };
  }, [arquivo, fpsAnalise]);

  const calcular = (m: Medida, p: Ponto[]) => (p.length >= m.pontos.length ? m.calcular(giro ? p.map((q) => girar(q, -giro)) : p, { cmPorPx }) : null);
  const resultadoAtual = !ehRef ? calcular(medida, pontos[medida.id] ?? []) : null;

  const escolher = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('video/')) { toast.error('Escolha um arquivo de vídeo.'); return; }
    const url = URL.createObjectURL(f);
    const v = document.createElement('video');
    v.preload = 'metadata'; v.muted = true; v.playsInline = true;
    v.onloadedmetadata = () => {
      setArquivo({ url, w: v.videoWidth, h: v.videoHeight, dur: v.duration });
      setPontos({}); setRefs({}); setCapturas([]); setT(0); setTocando(false);
    };
    v.onerror = () => { URL.revokeObjectURL(url); toast.error('Não consegui abrir esse vídeo.'); };
    v.src = url;
  };

  // Ao mudar de quadro, os pontos em andamento ficam para trás (as referências de nível e escala continuam).
  const irPara = (novo: number) => {
    const v = videoRef.current;
    if (!v || !arquivo) return;
    const alvo = Math.min(Math.max(novo, 0), arquivo.dur);
    v.pause(); setTocando(false);
    v.currentTime = alvo; setT(alvo); setPontos({});
  };
  const passo = (n: number) => irPara(Math.round(t * fps + n) / fps);

  const alternar = () => {
    const v = videoRef.current;
    if (!v) return;
    if (tocando) { v.pause(); setTocando(false); setT(v.currentTime); setPontos({}); return; }
    v.playbackRate = velocidade;
    void v.play();
    setTocando(true);
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !tocando) return;
    let id = 0;
    const tick = () => { setT(v.currentTime); id = requestAnimationFrame(tick); };
    const fim = () => { setTocando(false); setT(v.currentTime); };
    id = requestAnimationFrame(tick);
    v.addEventListener('ended', fim);
    return () => { cancelAnimationFrame(id); v.removeEventListener('ended', fim); };
  }, [tocando]);

  useEffect(() => { if (videoRef.current) videoRef.current.playbackRate = velocidade; }, [velocidade]);

  const doEvento = (e: { clientX: number; clientY: number }): Ponto | null => {
    const ctm = svgRef.current?.getScreenCTM();
    if (!ctm || !arquivo) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: Math.min(Math.max(p.x, 0), arquivo.w), y: Math.min(Math.max(p.y, 0), arquivo.h) };
  };

  const definirPontos = (m: Medida, fn: (p: Ponto[]) => Ponto[]) => {
    if (m.auxiliar) setRefs((s) => ({ ...s, [m.id]: fn(s[m.id] ?? []) }));
    else setPontos((s) => ({ ...s, [m.id]: fn(s[m.id] ?? []) }));
  };

  const gestos = useGestosFoto({
    svgRef, rolagemRef, caixaRef, zoom, setZoom, zoomMax: ZOOM_MAX, mover, noPonto: doEvento, podeMarcar: !!proximo && !tocando,
    aoMarcar: (p) => definirPontos(medida, (a) => [...a, p]),
    aoArrastar: (id, indice, p) => { const m = MEDIDAS_VIDEO.find((x) => x.id === id); if (m) definirPontos(m, (a) => a.map((q, i) => (i === indice ? p : q))); },
    aoIniciarArrasto: (id) => setAtiva(id),
  });

  // A lupa mostra o quadro parado: copia o quadro atual do vídeo para uma imagem, uma vez por instante.
  const quadroParaLupa = (): string => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return '';
    if (lupaFonte.current?.t === t) return lupaFonte.current.url;
    const cv = document.createElement('canvas');
    cv.width = v.videoWidth; cv.height = v.videoHeight;
    cv.getContext('2d')?.drawImage(v, 0, 0);
    const url = cv.toDataURL('image/jpeg', 0.85);
    lupaFonte.current = { t, url };
    return url;
  };

  const sugerir = async () => {
    const v = videoRef.current;
    if (!v || !arquivo || ehRef) return;
    setSugerindo(true);
    try {
      v.pause(); setTocando(false);
      const lm = quadroAuto?.lm ?? await detectarPose(v);
      if (!lm) { toast.error('Não achei o corpo neste quadro. Marque os pontos à mão.'); return; }
      const sug = sugerirNoQuadro(medida.id, lm, arquivo.w, arquivo.h);
      if (!sug) { toast.warning('Os pontos desta medida não estão nítidos neste quadro. Marque à mão ou escolha outro quadro.'); return; }
      setPontos((s) => ({ ...s, [medida.id]: sug }));
      toast.success('Pontos sugeridos. Confira e arraste o que estiver fora do lugar.');
    } catch {
      // Sem internet para baixar o modelo ou navegador sem suporte.
      toast.error('Não consegui carregar a detecção agora. Marque os pontos à mão.');
    } finally {
      setSugerindo(false);
    }
  };

  const desenhos = (): GrupoDesenho[] => {
    const cur = pontos[medida.id];
    const grupos: GrupoDesenho[] = [];
    if (cur?.length) grupos.push({ pontos: cur, segmentos: segmentosDaMedida(medida).filter(([i, j]) => i < cur.length && j < cur.length), cor: '#facc15', rotulo: resultadoAtual ? valorTexto(resultadoAtual.valor, medida.unidade) : undefined });
    return grupos;
  };

  const guardar = () => {
    const v = videoRef.current;
    if (!v || !resultadoAtual || ehRef) return;
    const imagem = fotoComMarcacoes(v, desenhos(), 900);
    setCapturas((c) => [...c, {
      uid: crypto.randomUUID(), medida, t: Math.round(t * 1000) / 1000, quadro, pontos: pontos[medida.id]!,
      valor: resultadoAtual.valor, texto: resultadoAtual.texto, imagem,
    }].sort((a, b) => a.t - b.t));
    setPontos((s) => ({ ...s, [medida.id]: [] }));
    toast.success('Medida guardada neste quadro.');
  };

  const angulosDoQuadro = quadroAuto?.lm && arquivo
    ? ANGULOS_AUTO.flatMap((id) => {
      const m = MEDIDAS_VIDEO.find((x) => x.id === id)!;
      const pts = sugerirNoQuadro(id, quadroAuto.lm!, arquivo.w, arquivo.h);
      const r = pts ? calcular(m, pts) : null;
      return pts && r ? [{ m, pts, r }] : [];
    })
    : [];

  const guardarAuto = (item: { m: Medida; pts: Ponto[]; r: { valor: number; texto: string } }) => {
    const v = videoRef.current;
    if (!v) return;
    const imagem = fotoComMarcacoes(v, [{ pontos: item.pts, segmentos: segmentosDaMedida(item.m), cor: '#facc15', rotulo: valorTexto(item.r.valor, item.m.unidade) }], 900);
    setCapturas((c) => [...c, { uid: crypto.randomUUID(), medida: item.m, t: Math.round(t * 1000) / 1000, quadro, pontos: item.pts, valor: item.r.valor, texto: item.r.texto, imagem }].sort((a, b) => a.t - b.t));
    toast.success(`${item.m.nome} guardado neste quadro.`);
  };

  const series = useMemo(() => {
    if (!arquivo || nQuadros === 0) return null;
    const mk = (id: string) => Array.from({ length: nQuadros }, (_, i) => valorNoQuadro(id, quadrosRef.current[i]?.lm ?? null, arquivo.w, arquivo.h, giro) ?? NaN);
    return { joelhoD: mk('joelho-d'), joelhoE: mk('joelho-e'), quadrilD: mk('quadril-d'), quadrilE: mk('quadril-e') };
    // quadrosRef é mutável; nQuadros marca quando há quadros novos.
  }, [arquivo, nQuadros, giro]);

  const texto = capturas.map((c) => `• ${nf(c.t, 2)} s (quadro ${c.quadro}) — ${c.texto}`).join('\n');
  const nota = giro !== null && Math.abs(giro) >= 0.05 ? `Imagem nivelada por uma referência ${nivelTipo} marcada (correção de ${nf(Math.abs(giro))}°).` : undefined;

  const copiar = async () => {
    try { await navigator.clipboard.writeText(`Análise angular em vídeo (ponto a ponto)\n${texto}`); toast.success('Resumo copiado.'); }
    catch { toast.error('Não consegui copiar.'); }
  };

  const registrar = async () => {
    if (!paciente || !user || !capturas.length) return;
    setSalvando(true);
    try {
      const { error } = await tabela('notas_prontuario').insert({
        paciente_id: paciente.id, terapeuta_id: user.id, tipo: 'analise_angular',
        titulo: 'Análise angular — ponto a ponto em vídeo',
        descricao: `${texto}\nPontos marcados pelo profissional em quadros do vídeo (${fps} quadros por segundo). ${nota ?? 'Os ângulos usam a horizontal e a vertical da imagem como referência.'} O vídeo não é armazenado.`,
        dados_extras: {
          metodo: 'video_ponto_a_ponto', fps,
          capturas: capturas.map((c) => ({ id: c.medida.id, t: c.t, quadro: c.quadro, valor: Math.round(c.valor * 10) / 10, ...(c.medida.unidade ? { unidade: c.medida.unidade } : {}) })),
          nivel_graus: giro, escala_cm_por_px: cmPorPx,
        },
      });
      if (error) throw error;
      toast.success(`Análise registrada no prontuário de ${paciente.nome}.`);
    } catch (e) {
      toast.error((e as { message?: string })?.message || 'Não foi possível registrar.');
    } finally {
      setSalvando(false);
    }
  };

  const gerarPdf = async () => {
    if (!capturas.length) return;
    setGerando(true);
    try {
      const { blob, nome } = await gerarRelatorioVideo({
        paciente: paciente ? `${paciente.nome} ${paciente.sobrenome ?? ''}`.trim() : 'Paciente',
        profissional: profile ? `${profile.nome} ${profile.sobrenome || ''}`.trim() + (profile.crefito ? ` · CREFITO ${profile.crefito}` : '') : undefined,
        data: new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        fps, notaExtra: nota,
        capturas: capturas.map((c) => ({ t: c.t, quadro: c.quadro, nome: c.medida.nome, valorTexto: valorTexto(c.valor, c.medida.unidade), texto: c.texto, imagem: c.imagem })),
      });
      entregarPdf({ blob, nome, pacienteId: paciente?.id ?? null, titulo: 'Análise angular em vídeo' });
    } catch {
      toast.error('Não consegui gerar o PDF.');
    } finally {
      setGerando(false);
    }
  };

  const raio = arquivo ? Math.max(arquivo.w, arquivo.h) / 85 / Math.sqrt(zoom) : 8;
  const daqui = capturas.filter((c) => Math.abs(c.t - t) < 0.5 / fps + 1e-6);
  const semEscala = medida.id === 'regua' && !cmPorPx;

  const desenharMedida = (m: Medida, p: Ponto[], destaque: boolean, r?: { valor: number }) => {
    const cor = COR_REF[m.id] ?? '#facc15';
    return (
      <g key={`${m.id}-${p.length}`} opacity={destaque ? 1 : 0.6}>
        {segmentosDaMedida(m).filter(([i, j]) => i < p.length && j < p.length).map(([i, j]) => (
          <line key={`${i}-${j}`} x1={p[i].x} y1={p[i].y} x2={p[j].x} y2={p[j].y} stroke={cor} strokeWidth={raio / 4} strokeLinecap="round" />
        ))}
        {p.map((q, i) => (
          <g key={i} style={{ cursor: 'move' }} onPointerDown={(e) => { if (!tocando) gestos.aoPressionarPonto(e, m.id, i); }}>
            <circle cx={q.x} cy={q.y} r={raio} fill={CORES[i % CORES.length]} stroke="#fff" strokeWidth={raio / 5} />
            <text x={q.x} y={q.y} textAnchor="middle" dominantBaseline="central" fontSize={raio * 1.1} fill="#fff" fontWeight="700" pointerEvents="none">{i + 1}</text>
          </g>
        ))}
        {r && p.length > 0 && (
          <text x={p.reduce((s, q) => s + q.x, 0) / p.length} y={p.reduce((s, q) => s + q.y, 0) / p.length - raio * 2} textAnchor="middle" dominantBaseline="central"
            fontSize={raio * 1.4} fontWeight="700" fill="#fff" stroke="#000" strokeWidth={raio / 2.5} strokeLinejoin="round" paintOrder="stroke" pointerEvents="none">{valorTexto(r.valor, m.unidade)}</text>
        )}
      </g>
    );
  };

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-3">
        {!arquivo ? (
          <label className="flex min-h-[260px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card p-6 text-center">
            <Film className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-semibold">Gravar ou escolher o vídeo</span>
            <span className="max-w-md text-xs text-muted-foreground">Câmera parada, de lado, com o corpo inteiro no quadro. Para medir o movimento com precisão, grave em câmera lenta (120 ou 240 quadros por segundo) e informe isso ao abrir. O vídeo fica só neste aparelho.</span>
            <input type="file" accept="video/*" className="sr-only" onChange={(e) => escolher(e.target.files?.[0])} />
          </label>
        ) : (
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <div ref={caixaRef} className="relative min-w-0 flex-1">
                <div ref={rolagemRef} className="max-h-[70dvh] overflow-auto rounded-2xl border border-border/60 bg-black">
                  <div className="relative mx-auto" style={{ width: `min(${zoom * 100}%, calc(70dvh * ${(arquivo.w / arquivo.h).toFixed(4)} * ${zoom}))` }}>
                    <video ref={videoRef} src={arquivo.url} muted playsInline preload="auto" className="block w-full" />
                    <svg ref={svgRef} viewBox={`0 0 ${arquivo.w} ${arquivo.h}`} className={cn('absolute inset-0 h-full w-full select-none [-webkit-touch-callout:none]', !mover && 'touch-none')} style={{ cursor: mover ? 'grab' : proximo && !tocando ? 'crosshair' : 'default' }}
                      onContextMenu={(e) => e.preventDefault()} {...gestos.handlers}>
                  {esqueleto && !tocando && quadroAuto?.lm && (
                    <g pointerEvents="none">
                      {LIGACOES.map(([a, b]) => {
                        const A = quadroAuto.lm![a], B = quadroAuto.lm![b];
                        if (!A || !B || (A.visibility ?? 1) < 0.3 || (B.visibility ?? 1) < 0.3) return null;
                        const cor = a % 2 === 0 && b % 2 === 0 ? COR_LADO.d : a % 2 === 1 && b % 2 === 1 ? COR_LADO.e : '#e5e7eb';
                        return <line key={`${a}-${b}`} x1={A.x * arquivo.w} y1={A.y * arquivo.h} x2={B.x * arquivo.w} y2={B.y * arquivo.h} stroke={cor} strokeOpacity={0.85} strokeWidth={raio / 4} strokeLinecap="round" />;
                      })}
                    </g>
                  )}
                  {Object.entries(refs).map(([id, p]) => { const m = MEDIDAS_VIDEO.find((x) => x.id === id); return m && p.length ? desenharMedida(m, p, m.id === medida.id) : null; })}
                  {!tocando && daqui.map((c) => desenharMedida(c.medida, c.pontos, false, c))}
                  {!tocando && !ehRef && (pontos[medida.id]?.length ?? 0) > 0 && desenharMedida(medida, pontos[medida.id]!, true, resultadoAtual ?? undefined)}
                    </svg>
                  </div>
                </div>
                {gestos.lupa && (
                  <LupaFoto lupa={gestos.lupa} href={quadroParaLupa()} w={arquivo.w} h={arquivo.h} svgRef={svgRef} caixaRef={caixaRef}
                    pontos={ptsAtiva} segmentos={segmentosDaMedida(medida)} comNovo={gestos.novoAtivo} />
                )}
              </div>

              <nav aria-label="Ferramentas de medida" className="flex max-h-[70dvh] w-12 shrink-0 flex-col gap-1 overflow-y-auto rounded-2xl border border-border/60 bg-card p-1">
                {([['postura', MEDIDAS_VIDEO.filter((m) => !m.auxiliar)], ['referencia', MEDIDAS_VIDEO.filter((m) => m.auxiliar)]] as const).map(([g, itens], gi) => (
                  <div key={g} className="flex flex-col gap-1">
                    {gi > 0 && <span className="mx-1 h-px bg-border" aria-hidden />}
                    {itens.map((m) => {
                      const Icone = ICONE_MEDIDA[m.id] ?? Ruler;
                      const feita = ((m.auxiliar ? refs[m.id] : pontos[m.id])?.length ?? 0) >= m.pontos.length;
                      const ativa = m.id === medida.id;
                      return (
                        <button key={m.id} type="button" onClick={() => setAtiva(m.id)} aria-pressed={ativa} aria-label={m.nome} title={m.nome}
                          className={cn('relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors', ativa ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
                          <Icone className="h-5 w-5" style={!ativa && COR_REF[m.id] ? { color: COR_REF[m.id] } : undefined} />
                          {LADO_MEDIDA[m.id] && <span className="absolute bottom-0.5 right-0.5 text-[9px] font-bold leading-none">{LADO_MEDIDA[m.id]}</span>}
                          {feita && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-card" aria-hidden />}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </nav>
            </div>

            <video ref={analiseRef} src={arquivo.url} muted playsInline preload="auto" aria-hidden className="pointer-events-none fixed -left-[9999px] top-0 h-px w-px opacity-0" />
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/60 bg-card px-3 py-2 text-xs" role="status">
              {progresso !== null ? (
                <span className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Achando as articulações em cada quadro… {Math.round(progresso * 100)}% (você já pode marcar à mão)</span>
              ) : nQuadros > 0 ? (
                <span className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-400"><Sparkles className="h-3.5 w-3.5" /> Articulações detectadas em {quadrosRef.current.filter((q) => q?.lm).length} de {nQuadros} quadros</span>
              ) : <span className="text-muted-foreground">Detecção automática indisponível: marque os pontos à mão.</span>}
            </div>
            <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-2">
              <input type="range" min={0} max={Math.max(1, Math.floor(arquivo.dur * fps))} value={quadro} onChange={(e) => irPara(Number(e.target.value) / fps)} className="w-full" aria-label="Quadro do vídeo" />
              <div className="flex flex-wrap items-center gap-1">
                <Button size="icon" variant="ghost" className="h-9 w-9" aria-label="Voltar 10 quadros" onClick={() => passo(-10)}><ChevronsLeft className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-9 w-9" aria-label="Voltar 1 quadro" onClick={() => passo(-1)}><ChevronLeft className="h-4 w-4" /></Button>
                <Button size="icon" variant="outline" className="h-9 w-9" aria-label={tocando ? 'Pausar' : 'Reproduzir'} onClick={alternar}>{tocando ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</Button>
                <Button size="icon" variant="ghost" className="h-9 w-9" aria-label="Avançar 1 quadro" onClick={() => passo(1)}><ChevronRight className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-9 w-9" aria-label="Avançar 10 quadros" onClick={() => passo(10)}><ChevronsRight className="h-4 w-4" /></Button>
                <span className="ml-1 text-xs font-medium tabular-nums">{nf(t, 2)} s · quadro {quadro}</span>
                <span className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <label className="flex items-center gap-1">Vel.
                    <select value={velocidade} onChange={(e) => setVelocidade(Number(e.target.value))} className="h-8 rounded-md border border-input bg-background px-1 text-xs" aria-label="Velocidade de reprodução">
                      {[0.1, 0.25, 0.5, 1].map((x) => <option key={x} value={x}>{x}×</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-1">Gravado a
                    <select value={fps} onChange={(e) => setFps(Number(e.target.value))} className="h-8 rounded-md border border-input bg-background px-1 text-xs" aria-label="Quadros por segundo do vídeo">
                      {FPS_OPCOES.map((x) => <option key={x} value={x}>{x} q/s</option>)}
                    </select>
                  </label>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-border/60 bg-card p-1" role="toolbar" aria-label="Ações do vídeo">
              {!ehRef && (
                <>
                  <Button size="sm" className="h-9 gap-1.5" onClick={sugerir} disabled={sugerindo || tocando} title="Sugerir os pontos da medida neste quadro">
                    {sugerindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} <span className="hidden sm:inline">Sugerir</span>
                  </Button>
                  <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
                </>
              )}
              <Button size="icon" variant="ghost" className="h-9 w-9" aria-label="Desfazer o último ponto" title="Desfazer" onClick={() => definirPontos(medida, (a) => a.slice(0, -1))} disabled={!ptsAtiva.length}><Undo2 className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" className="h-9 w-9" aria-label="Limpar a medida" title="Limpar a medida" onClick={() => definirPontos(medida, () => [])} disabled={!ptsAtiva.length}><Trash2 className="h-4 w-4" /></Button>
              <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
              <Button size="icon" variant="ghost" className="h-9 w-9" aria-label="Diminuir zoom" title="Diminuir zoom" onClick={() => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)))} disabled={zoom <= 1}><ZoomOut className="h-4 w-4" /></Button>
              <span className="min-w-[2.6rem] text-center text-xs font-semibold tabular-nums">{Math.round(zoom * 100)}%</span>
              <Button size="icon" variant="ghost" className="h-9 w-9" aria-label="Aumentar zoom" title="Aumentar zoom" onClick={() => setZoom((z) => Math.min(ZOOM_MAX, +(z + 0.5).toFixed(1)))} disabled={zoom >= ZOOM_MAX}><ZoomIn className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" className="h-9 w-9" aria-label="Ajustar à tela" title="Ajustar à tela" onClick={() => { setZoom(1); setMover(false); }}><Maximize2 className="h-4 w-4" /></Button>
              <Button size="icon" variant={mover ? 'default' : 'ghost'} className="h-9 w-9" aria-pressed={mover} aria-label={mover ? 'Voltar a marcar' : 'Mover o vídeo com um dedo'} title={mover ? 'Voltar a marcar' : 'Mover o vídeo com um dedo'} onClick={() => setMover((m) => !m)} disabled={zoom <= 1}>
                {mover ? <Hand className="h-4 w-4" /> : <MousePointer2 className="h-4 w-4" />}
              </Button>
              <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
              <Button size="icon" variant={esqueleto ? 'default' : 'ghost'} className="h-9 w-9" aria-pressed={esqueleto} aria-label="Mostrar o esqueleto" title="Mostrar o esqueleto" onClick={() => setEsqueleto((v) => !v)}><Activity className="h-4 w-4" /></Button>
              <Button size="sm" variant={mostrarAngulos ? 'default' : 'ghost'} className="h-9 px-2.5 text-xs font-bold" aria-pressed={mostrarAngulos} aria-label="Mostrar os ângulos sobre o vídeo" title="Mostrar os ângulos sobre o vídeo" onClick={() => setMostrarAngulos((v) => !v)}>°</Button>
              <label className="ml-auto inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md hover:bg-accent" title="Trocar o vídeo" aria-label="Trocar o vídeo">
                <Film className="h-4 w-4" />
                <input type="file" accept="video/*" className="sr-only" onChange={(e) => escolher(e.target.files?.[0])} />
              </label>
            </div>

            <p className="text-xs text-muted-foreground" role="status">
              <strong className="text-foreground">{medida.nome}.</strong>{' '}
              {tocando ? 'Pause o vídeo no quadro que quer medir.' : mover ? 'Modo mover: arraste o vídeo com um dedo.'
                : proximo ? <>Toque e segure para ver a lupa; solte para marcar <strong className="text-foreground">{ptsAtiva.length + 1}. {proximo}</strong>.</>
                  : ehRef ? 'Referência completa. Arraste um ponto para ajustar.' : 'Medida completa. Guarde a medida deste quadro ou ajuste os pontos.'}
              {' '}Dois dedos: zoom e mover.
            </p>
          </div>
        )}
      </div>

      <aside className="space-y-3 lg:sticky lg:top-4">
        <div className="space-y-1.5 rounded-2xl border border-border/60 bg-card p-3">
          <details className="rounded-xl border border-border/60 p-2.5">
            <summary className="cursor-pointer text-sm font-semibold">Todas as medidas</summary>
            <div className="mt-2 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Medir neste quadro</p>
          {MEDIDAS_VIDEO.filter((m) => !m.auxiliar).map((m) => {
            const n = pontos[m.id]?.length ?? 0;
            return (
              <button key={m.id} type="button" aria-pressed={m.id === medida.id} onClick={() => setAtiva(m.id)}
                className={cn('flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors', m.id === medida.id ? 'border-primary bg-primary/5' : 'border-border/60 hover:bg-muted/50')}>
                <span>{m.nome}</span>
                <span className={cn('text-[11px] tabular-nums', n >= m.pontos.length ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground')}>{n >= m.pontos.length ? 'pronta' : `${n}/${m.pontos.length}`}</span>
              </button>
            );
          })}
          <p className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Referências do vídeo</p>
          {MEDIDAS_VIDEO.filter((m) => m.auxiliar).map((m) => {
            const n = refs[m.id]?.length ?? 0;
            return (
              <button key={m.id} type="button" aria-pressed={m.id === medida.id} onClick={() => setAtiva(m.id)}
                className={cn('flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors', m.id === medida.id ? 'border-primary bg-primary/5' : 'border-border/60 hover:bg-muted/50')}>
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COR_REF[m.id] }} aria-hidden />{m.nome}</span>
                <span className="text-[11px] tabular-nums text-muted-foreground">{m.id === 'nivel' && giro !== null ? `${nf(Math.abs(giro))}°` : m.id === 'escala' && cmPorPx ? 'calibrada' : `${n}/${m.pontos.length}`}</span>
              </button>
            );
          })}
            </div>
          </details>
          <p className="px-0.5 text-xs text-muted-foreground"><strong className="text-foreground">Ferramenta ativa:</strong> {medida.nome}</p>
          {medida.id === 'nivel' && (
            <div className="space-y-2 rounded-xl bg-muted/40 p-2.5 text-xs">
              <p className="text-muted-foreground">Marque 2 pontos sobre algo reto na vida real (chão, rodapé, fio de prumo) para corrigir o giro da imagem.</p>
              <div className="grid grid-cols-2 gap-1">
                {(['horizontal', 'vertical'] as const).map((tp) => (
                  <button key={tp} type="button" aria-pressed={nivelTipo === tp} onClick={() => setNivelTipo(tp)} className={cn('rounded-lg border px-2 py-1.5 font-medium capitalize', nivelTipo === tp ? 'border-primary bg-primary/10' : 'border-border/60')}>{tp}</button>
                ))}
              </div>
              {giro !== null && <p className="font-medium">{Math.abs(giro) < 0.05 ? 'Imagem já está nivelada.' : `Imagem girada ${nf(Math.abs(giro))}°: os ângulos saem corrigidos.`}</p>}
            </div>
          )}
          {medida.id === 'escala' && (
            <div className="space-y-2 rounded-xl bg-muted/40 p-2.5 text-xs">
              <p className="text-muted-foreground">Marque as pontas de um objeto de tamanho conhecido no plano do paciente e informe o comprimento.</p>
              <div className="flex items-center gap-2">
                <Input inputMode="decimal" value={escalaCm} onChange={(e) => setEscalaCm(e.target.value)} placeholder="Comprimento" className="h-9 text-[16px] sm:text-sm" aria-label="Comprimento do objeto em centímetros" />
                <span className="shrink-0 font-medium">cm</span>
              </div>
            </div>
          )}
          {semEscala && <p className="rounded-xl bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">Para medir em centímetros, primeiro calibre a escala.</p>}
        </div>

        {angulosDoQuadro.length > 0 && (
          <div className="space-y-1.5 rounded-2xl border border-border/60 bg-card p-3">
            <p className="text-sm font-semibold">Ângulos neste quadro (automático)</p>
            <ul className="space-y-1">
              {angulosDoQuadro.map((a) => (
                <li key={a.m.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>{a.m.nome}</span>
                  <span className="flex items-center gap-1.5 font-semibold tabular-nums">{valorTexto(a.r.valor, a.m.unidade)}
                    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Guardar ${a.m.nome}`} onClick={() => guardarAuto(a)} disabled={tocando}><Plus className="h-3.5 w-3.5" /></Button>
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-muted-foreground">Calculados pelas articulações detectadas. Para corrigir, escolha a medida em “Medir neste quadro”, toque em Sugerir pontos e arraste.</p>
          </div>
        )}

        {series && arquivo && (
          <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-3">
            <p className="text-sm font-semibold">Movimento ao longo do vídeo</p>
            <GraficoAngulos titulo="Flexão do joelho" d={series.joelhoD} e={series.joelhoE} fps={fpsAnalise} t={t} dur={arquivo.dur} onSeek={irPara} />
            <GraficoAngulos titulo="Flexão do quadril (tronco-coxa)" d={series.quadrilD} e={series.quadrilE} fps={fpsAnalise} t={t} dur={arquivo.dur} onSeek={irPara} />
            <p className="text-[11px] text-muted-foreground"><span style={{ color: COR_LADO.d }}>■</span> direito · <span style={{ color: COR_LADO.e }}>■</span> esquerdo · toque no gráfico para ir ao instante.</p>
          </div>
        )}

        <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-3">
          <p className="text-sm font-semibold">Neste quadro</p>
          {resultadoAtual ? <p className="text-sm tabular-nums">{resultadoAtual.texto}</p> : <p className="text-xs text-muted-foreground">Marque os pontos da medida para ver o valor.</p>}
          <Button className="w-full gap-1.5" onClick={guardar} disabled={!resultadoAtual || tocando}><Plus className="h-4 w-4" /> Guardar medida deste quadro</Button>
        </div>

        <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-3">
          <p className="text-sm font-semibold">Medidas guardadas ({capturas.length})</p>
          {capturas.length === 0 ? <p className="text-xs text-muted-foreground">Cada medida guardada fica com o instante do vídeo.</p> : (
            <ul className="space-y-1.5">
              {capturas.map((c) => (
                <li key={c.uid} className="flex items-center gap-2 rounded-xl border border-border/60 p-2 text-sm">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => irPara(c.t)} title="Ir para este quadro">
                    <span className="block truncate font-medium">{c.medida.nome}: {valorTexto(c.valor, c.medida.unidade)}</span>
                    <span className="block text-[11px] tabular-nums text-muted-foreground">{nf(c.t, 2)} s · quadro {c.quadro}</span>
                  </button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label="Remover medida" onClick={() => setCapturas((l) => l.filter((x) => x.uid !== c.uid))}><Trash2 className="h-3.5 w-3.5" /></Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={registrar} disabled={!paciente || !capturas.length || salvando} className="min-w-[180px] flex-1 gap-1.5">
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />} Registrar no prontuário
            </Button>
            <Button variant="outline" onClick={copiar} disabled={!capturas.length} className="gap-1.5"><Copy className="h-4 w-4" /> Copiar</Button>
            <Button variant="outline" onClick={gerarPdf} disabled={!capturas.length || gerando} className="gap-1.5">
              {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} Gerar PDF
            </Button>
          </div>
          {!paciente && capturas.length > 0 && <p className="text-[11px] text-muted-foreground">Escolha um paciente no topo para registrar.</p>}
        </div>

        <p className="px-1 text-[11px] leading-snug text-muted-foreground">
          O tempo de cada medida tem a precisão de um quadro ({nf(1000 / fps, 1)} ms a {fps} q/s). “Sugerir pontos” usa a pose do quadro e acha centros de articulação, não os pontos ósseos: confira e ajuste. Joelho e quadril saem como flexão (0° = estendido). Sem a referência de nível, os ângulos usam a horizontal e a vertical da imagem. Medida de acompanhamento, não é diagnóstico.
        </p>
      </aside>
    </div>
  );
}
