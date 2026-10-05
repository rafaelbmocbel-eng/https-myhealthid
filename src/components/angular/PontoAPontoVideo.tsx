import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ClipboardCheck, Copy, FileDown, Film, Loader2, Pause, Play, Plus, Sparkles, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { parseNum } from '@/components/dosagem/comuns';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { tabela } from '@/lib/dosagem/db';
import { cmPorPixel, girar, rotacaoDoNivel, segmentosDaMedida, type Medida, type Ponto } from '@/lib/angular/medidas';
import { MEDIDAS_VIDEO, sugerirNoQuadro } from '@/lib/angular/medidasVideo';
import { detectarPose } from '@/lib/angular/detector';
import { fotoComMarcacoes, type GrupoDesenho } from '@/lib/angular/relatorio';
import { gerarRelatorioVideo } from '@/lib/angular/relatorioVideo';
import { entregarPdf } from '@/lib/pdf/entrega';

const CORES = ['#ef4444', '#3b82f6', '#10b981', '#a855f7'];
const COR_REF: Record<string, string> = { nivel: '#22d3ee', escala: '#fb923c' };
const FPS_OPCOES = [24, 30, 60, 120, 240];
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

// Análise angular ponto a ponto no vídeo: o profissional para em um quadro, marca os pontos (ou deixa o app
// sugerir pela pose), guarda a medida daquele instante e segue para outro quadro. O vídeo fica só no aparelho.
export default function PontoAPontoVideo({ paciente }: { paciente: { id: string; nome: string; sobrenome?: string | null } | null | undefined }) {
  const { user, profile } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const arrastando = useRef<{ medida: string; indice: number } | null>(null);
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

  useEffect(() => () => { if (arquivo) URL.revokeObjectURL(arquivo.url); }, [arquivo]);

  const quadro = Math.round(t * fps);
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

  const marcar = (e: React.PointerEvent<SVGSVGElement>) => {
    if (tocando || arrastando.current || !proximo) return;
    const p = doEvento(e);
    if (p) definirPontos(medida, (a) => [...a, p]);
  };
  const arrastar = (e: React.PointerEvent<SVGSVGElement>) => {
    const alvo = arrastando.current;
    const p = alvo && doEvento(e);
    if (!alvo || !p) return;
    const m = MEDIDAS_VIDEO.find((x) => x.id === alvo.medida);
    if (m) definirPontos(m, (a) => a.map((q, i) => (i === alvo.indice ? p : q)));
  };

  const sugerir = async () => {
    const v = videoRef.current;
    if (!v || !arquivo || ehRef) return;
    setSugerindo(true);
    try {
      v.pause(); setTocando(false);
      const lm = await detectarPose(v);
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

  const raio = arquivo ? Math.max(arquivo.w, arquivo.h) / 85 : 8;
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
          <g key={i} style={{ cursor: 'move' }} onPointerDown={(e) => { if (tocando) return; e.stopPropagation(); (e.currentTarget.ownerSVGElement as SVGSVGElement).setPointerCapture(e.pointerId); arrastando.current = { medida: m.id, indice: i }; setAtiva(m.id); }}>
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
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-black">
              <div className="relative mx-auto" style={{ width: `min(100%, calc(70dvh * ${(arquivo.w / arquivo.h).toFixed(4)}))` }}>
                <video ref={videoRef} src={arquivo.url} muted playsInline preload="auto" className="block w-full" />
                <svg ref={svgRef} viewBox={`0 0 ${arquivo.w} ${arquivo.h}`} className="absolute inset-0 h-full w-full touch-none select-none" style={{ cursor: proximo && !tocando ? 'crosshair' : 'default' }}
                  onPointerDown={marcar} onPointerMove={arrastar} onPointerUp={() => { arrastando.current = null; }} onPointerCancel={() => { arrastando.current = null; }}>
                  {Object.entries(refs).map(([id, p]) => { const m = MEDIDAS_VIDEO.find((x) => x.id === id); return m && p.length ? desenharMedida(m, p, m.id === medida.id) : null; })}
                  {!tocando && daqui.map((c) => desenharMedida(c.medida, c.pontos, false, c))}
                  {!tocando && !ehRef && (pontos[medida.id]?.length ?? 0) > 0 && desenharMedida(medida, pontos[medida.id]!, true, resultadoAtual ?? undefined)}
                </svg>
              </div>
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

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground" role="status">
                {tocando ? 'Pause o vídeo no quadro que quer medir.' : proximo ? <>Toque em: <strong className="text-foreground">{ptsAtiva.length + 1}. {proximo}</strong></> : ehRef ? 'Referência completa. Arraste um ponto para ajustar.' : 'Medida completa. Guarde a medida deste quadro ou ajuste os pontos.'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {!ehRef && <Button size="sm" className="gap-1.5" onClick={sugerir} disabled={sugerindo || tocando}>{sugerindo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Sugerir pontos</Button>}
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => definirPontos(medida, (a) => a.slice(0, -1))} disabled={!ptsAtiva.length}><Undo2 className="h-3.5 w-3.5" /> Desfazer</Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => definirPontos(medida, () => [])} disabled={!ptsAtiva.length}><Trash2 className="h-3.5 w-3.5" /> Limpar</Button>
                <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent">
                  <Film className="h-3.5 w-3.5" /> Trocar vídeo
                  <input type="file" accept="video/*" className="sr-only" onChange={(e) => escolher(e.target.files?.[0])} />
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      <aside className="space-y-3 lg:sticky lg:top-4">
        <div className="space-y-1.5 rounded-2xl border border-border/60 bg-card p-3">
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
