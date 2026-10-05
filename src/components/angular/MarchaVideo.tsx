import { useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardCheck, Copy, Film, Loader2, Sparkles, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { tabela } from '@/lib/dosagem/db';
import { detectarVideo } from '@/lib/angular/detector';
import { analisarMarcha, type Frame, type Lado, type ResultadoMarcha } from '@/lib/angular/marcha';

const FPS = 30;
const MAX_S = 20;
// Ligações do esqueleto (pares de índices do modelo de 33 pontos), só as do corpo.
const LIGACOES: [number, number][] = [[11, 12], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 29], [29, 31], [28, 30], [30, 32], [11, 13], [13, 15], [12, 14], [14, 16]];
const COR: Record<Lado, string> = { D: '#2A78D6', E: '#EB6834' };

const n1 = (v: number | null | undefined, un = '') => (v == null ? '—' : `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${un}`);

function Curva({ titulo, d, e }: { titulo: string; d: number[] | null; e: number[] | null }) {
  const todos = [...(d ?? []), ...(e ?? [])];
  if (!todos.length) return null;
  const min = Math.min(...todos), max = Math.max(...todos);
  const span = max - min || 1;
  const W = 300, H = 120, L = 30, B = 16, T = 6;
  const X = (i: number) => L + (i / 100) * (W - L - 6);
  const Y = (v: number) => T + (1 - (v - min) / span) * (H - T - B);
  const linha = (c: number[]) => c.map((v, i) => `${X(i)},${Y(v)}`).join(' ');
  return (
    <figure className="space-y-1">
      <figcaption className="text-xs font-medium">{titulo}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${titulo}, média dos ciclos de 0 a 100%`}>
        {[min, (min + max) / 2, max].map((v) => (
          <g key={v}><line x1={L} x2={W - 6} y1={Y(v)} y2={Y(v)} stroke="currentColor" opacity={0.12} /><text x={L - 4} y={Y(v)} textAnchor="end" dominantBaseline="central" fontSize={9} fill="currentColor" opacity={0.6}>{Math.round(v)}°</text></g>
        ))}
        {[0, 50, 100].map((p) => <text key={p} x={X(p)} y={H - 3} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.6}>{p}%</text>)}
        {d && <polyline points={linha(d)} fill="none" stroke={COR.D} strokeWidth={2} strokeLinejoin="round" />}
        {e && <polyline points={linha(e)} fill="none" stroke={COR.E} strokeWidth={2} strokeLinejoin="round" />}
      </svg>
    </figure>
  );
}

export default function MarchaVideo({ paciente }: { paciente: { id: string; nome: string } | null | undefined }) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const cancelar = useRef(false);
  const [arquivo, setArquivo] = useState<{ url: string; w: number; h: number } | null>(null);
  const [progresso, setProgresso] = useState<number | null>(null);
  const [frames, setFrames] = useState<Frame[] | null>(null);
  const [quadro, setQuadro] = useState(0);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => () => { if (arquivo) URL.revokeObjectURL(arquivo.url); }, [arquivo]);

  const resultado = useMemo<ResultadoMarcha | { erro: string } | null>(
    () => (frames && arquivo ? analisarMarcha(frames, arquivo.w, arquivo.h) : null), [frames, arquivo]);
  const ok = resultado && !('erro' in resultado) ? resultado : null;

  const escolher = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('video/')) { toast.error('Escolha um arquivo de vídeo.'); return; }
    const url = URL.createObjectURL(f);
    const v = document.createElement('video');
    v.preload = 'metadata'; v.muted = true; v.playsInline = true;
    v.onloadedmetadata = () => { setArquivo({ url, w: v.videoWidth, h: v.videoHeight }); setFrames(null); setQuadro(0); };
    v.onerror = () => { URL.revokeObjectURL(url); toast.error('Não consegui abrir esse vídeo.'); };
    v.src = url;
  };

  const analisar = async () => {
    const v = videoRef.current;
    if (!v) return;
    cancelar.current = false;
    setProgresso(0); setFrames(null);
    try {
      const f = await detectarVideo(v, { fps: FPS, maxSegundos: MAX_S, onProgresso: setProgresso, cancelado: () => cancelar.current });
      if (!cancelar.current) setFrames(f);
    } catch {
      // Sem internet para baixar o modelo ou navegador sem suporte.
      toast.error('Não consegui carregar a análise automática agora. Tente de novo com internet.');
    } finally {
      setProgresso(null);
    }
  };

  const irParaQuadro = (i: number) => {
    setQuadro(i);
    if (videoRef.current && frames?.[i]) videoRef.current.currentTime = frames[i].t;
  };

  const texto = ok ? [
    `Vídeo de ${n1(ok.duracaoS)} s, andando para a ${ok.direcao === 1 ? 'direita' : 'esquerda'} da imagem; ${ok.passos} passos detectados.`,
    `Cadência: ${n1(ok.cadencia, ' passos/min')}. Tempo médio do passo: ${n1(ok.tempoPassoMedioS, ' s')}.`,
    `Tempo do passo: D→E ${n1(ok.tempoPasso.D, ' s')}, E→D ${n1(ok.tempoPasso.E, ' s')} (simetria ${n1(ok.simetriaTempoPct, '%')}).`,
    `Fase de apoio estimada: D ${n1(ok.apoioPct.D, '%')}, E ${n1(ok.apoioPct.E, '%')}.`,
    `Joelho: flexão máxima D ${n1(ok.flexaoMaxJoelho.D, '°')}, E ${n1(ok.flexaoMaxJoelho.E, '°')}; amplitude D ${n1(ok.amplitude.joelho.D, '°')}, E ${n1(ok.amplitude.joelho.E, '°')}.`,
    `Quadril (coxa em relação à vertical): amplitude D ${n1(ok.amplitude.quadril.D, '°')}, E ${n1(ok.amplitude.quadril.E, '°')}.`,
  ] : [];

  const copiar = async () => {
    try { await navigator.clipboard.writeText(`Análise de marcha por vídeo\n${texto.join('\n')}`); toast.success('Resumo copiado.'); }
    catch { toast.error('Não consegui copiar.'); }
  };

  const registrar = async () => {
    if (!ok || !paciente || !user) return;
    setSalvando(true);
    try {
      const { error } = await tabela('notas_prontuario').insert({
        paciente_id: paciente.id, terapeuta_id: user.id, tipo: 'analise_angular',
        titulo: 'Análise angular — marcha por vídeo',
        descricao: `${texto.join('\n')}\nPontos detectados automaticamente em vídeo gravado de lado, a ${FPS} quadros por segundo; eventos da marcha estimados pelo movimento do pé em relação ao quadril. Medida de acompanhamento, não é diagnóstico.`,
        dados_extras: {
          metodo: 'video_marcha', fps_analise: FPS, passos: ok.passos, cadencia: ok.cadencia, tempo_passo_s: ok.tempoPassoMedioS,
          simetria_tempo_pct: ok.simetriaTempoPct, apoio_pct: ok.apoioPct, flexao_max_joelho: ok.flexaoMaxJoelho, amplitude: ok.amplitude,
        },
      });
      if (error) throw error;
      toast.success(`Marcha registrada no prontuário de ${paciente.nome}.`);
    } catch (e) {
      toast.error((e as { message?: string })?.message || 'Não foi possível registrar.');
    } finally {
      setSalvando(false);
    }
  };

  const lmAtual = frames?.[quadro]?.lm ?? null;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-3">
        {!arquivo ? (
          <label className="flex min-h-[260px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card p-6 text-center">
            <Film className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-semibold">Gravar ou escolher o vídeo da caminhada</span>
            <span className="max-w-md text-xs text-muted-foreground">Grave de lado, com a câmera parada na altura do quadril, o corpo inteiro no quadro, o paciente andando em linha reta por pelo menos 6 passos, em boa luz e roupa justa. Até {MAX_S} s. O vídeo fica só neste aparelho.</span>
            <input type="file" accept="video/*" className="sr-only" onChange={(e) => escolher(e.target.files?.[0])} />
          </label>
        ) : (
          <div className="space-y-2">
            <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-black">
              <video ref={videoRef} src={arquivo.url} muted playsInline controls={!frames} className="mx-auto block max-h-[70dvh] w-full" />
              {frames && lmAtual && (
                <svg viewBox={`0 0 ${arquivo.w} ${arquivo.h}`} className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet">
                  {LIGACOES.map(([a, b]) => {
                    const A = lmAtual[a], B = lmAtual[b];
                    if (!A || !B || (A.visibility ?? 1) < 0.3 || (B.visibility ?? 1) < 0.3) return null;
                    return <line key={`${a}-${b}`} x1={A.x * arquivo.w} y1={A.y * arquivo.h} x2={B.x * arquivo.w} y2={B.y * arquivo.h} stroke="#facc15" strokeWidth={Math.max(arquivo.w, arquivo.h) / 300} />;
                  })}
                </svg>
              )}
            </div>
            {frames && (
              <div className="space-y-1">
                <input type="range" min={0} max={frames.length - 1} value={quadro} onChange={(e) => irParaQuadro(Number(e.target.value))} className="w-full" aria-label="Quadro do vídeo" />
                <p className="text-[11px] text-muted-foreground tabular-nums">Quadro {quadro + 1} de {frames.length} · {n1(frames[quadro]?.t, ' s')}{lmAtual ? '' : ' · corpo não detectado neste quadro'}</p>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" className="gap-1.5" onClick={analisar} disabled={progresso !== null}>
                {progresso !== null ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {progresso !== null ? `Analisando… ${Math.round(progresso * 100)}%` : 'Analisar a marcha'}
              </Button>
              {progresso !== null && <Button size="sm" variant="ghost" onClick={() => { cancelar.current = true; }}>Cancelar</Button>}
              <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent">
                <Film className="h-3.5 w-3.5" /> Trocar vídeo
                <input type="file" accept="video/*" className="sr-only" onChange={(e) => escolher(e.target.files?.[0])} />
              </label>
            </div>
            <p className="text-[11px] text-muted-foreground">A primeira análise baixa o modelo (cerca de 6 MB) e leva cerca de 1 minuto para cada 10 s de vídeo; deixe a tela aberta.</p>
          </div>
        )}
      </div>

      <aside className="space-y-3 lg:sticky lg:top-4">
        <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-3">
          <p className="text-sm font-semibold">Resultado da marcha</p>
          {!resultado && <p className="text-xs text-muted-foreground">Escolha o vídeo e toque em “Analisar a marcha”.</p>}
          {resultado && 'erro' in resultado && <p className="flex gap-1.5 text-xs text-destructive"><TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {resultado.erro}</p>}
          {ok && (
            <>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm tabular-nums">
                {([
                  ['Passos detectados', String(ok.passos)],
                  ['Cadência', n1(ok.cadencia, ' p/min')],
                  ['Tempo do passo', n1(ok.tempoPassoMedioS, ' s')],
                  ['Simetria do tempo', n1(ok.simetriaTempoPct, '%')],
                  ['Apoio D / E', `${n1(ok.apoioPct.D, '%')} / ${n1(ok.apoioPct.E, '%')}`],
                  ['Ciclos D / E', `${ok.ciclos.D} / ${ok.ciclos.E}`],
                  ['Flexão máx. joelho D / E', `${n1(ok.flexaoMaxJoelho.D, '°')} / ${n1(ok.flexaoMaxJoelho.E, '°')}`],
                  ['Amplitude joelho D / E', `${n1(ok.amplitude.joelho.D, '°')} / ${n1(ok.amplitude.joelho.E, '°')}`],
                  ['Amplitude quadril D / E', `${n1(ok.amplitude.quadril.D, '°')} / ${n1(ok.amplitude.quadril.E, '°')}`],
                ] as const).map(([k, v]) => (<div key={k} className="contents"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>))}
              </dl>
              <div className="grid gap-3 pt-1">
                <Curva titulo="Joelho (flexão) no ciclo da marcha" d={ok.curvas.joelho.D} e={ok.curvas.joelho.E} />
                <Curva titulo="Quadril (coxa × vertical) no ciclo da marcha" d={ok.curvas.quadril.D} e={ok.curvas.quadril.E} />
                <p className="text-[11px] text-muted-foreground"><span style={{ color: COR.D }}>■</span> direito · <span style={{ color: COR.E }}>■</span> esquerdo · média dos ciclos, de contato a contato do mesmo pé.</p>
              </div>
              <ul className="space-y-1 text-[11px] text-muted-foreground">{ok.avisos.map((a) => <li key={a}>• {a}</li>)}</ul>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button onClick={registrar} disabled={!paciente || salvando} className="min-w-[180px] flex-1 gap-1.5">
                  {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />} Registrar no prontuário
                </Button>
                <Button variant="outline" onClick={copiar} className="gap-1.5"><Copy className="h-4 w-4" /> Copiar</Button>
              </div>
              {!paciente && <p className="text-[11px] text-muted-foreground">Escolha um paciente no topo para registrar.</p>}
            </>
          )}
        </div>
        <p className="px-1 text-[11px] leading-snug text-muted-foreground">
          Com câmera comum (30 quadros por segundo) o tempo de cada passo tem erro de cerca de 0,03 s: serve para cadência, simetria e ângulos de quadril e joelho. Não mede comprimento do passo (sem escala) nem tornozelo ou rotações, e é uma medida de acompanhamento, não diagnóstico. Os eventos da marcha são estimados pelo movimento do pé em relação ao quadril.
        </p>
      </aside>
    </div>
  );
}
