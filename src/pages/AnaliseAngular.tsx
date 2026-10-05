import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Camera, ClipboardCheck, Copy, Loader2, Ruler, Sparkles, Trash2, Undo2, X } from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/components/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { PacienteSelect } from '@/components/paciente/PacienteSelect';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { tabela } from '@/lib/dosagem/db';
import { MEDIDAS, medidasDaVista, type Ponto, type Vista } from '@/lib/angular/medidas';
import { detectarPose } from '@/lib/angular/detector';
import { pontosAutomaticos } from '@/lib/angular/pose';
import { usePacienteDosagem, usePacientesLista } from '@/hooks/useProntuarioSeguranca';

const VISTAS: { id: Vista; nome: string }[] = [
  { id: 'frente', nome: 'Frente' },
  { id: 'perfil', nome: 'Perfil' },
  { id: 'costas', nome: 'Costas' },
];

const CORES = ['#ef4444', '#3b82f6', '#10b981'];

// Fase 1 da análise angular: foto estática com pontos marcados pelo profissional.
// A foto fica só no navegador (não é enviada); o que vai ao prontuário é o texto das medidas.
export default function AnaliseAngular() {
  const { user } = useAuth();
  const [sp, setSp] = useSearchParams();
  const pacienteId = sp.get('paciente') || '';
  const { data: lista = [] } = usePacientesLista(user?.id);
  const { data: paciente } = usePacienteDosagem(pacienteId || null);

  const [vista, setVista] = useState<Vista>('frente');
  const [foto, setFoto] = useState<{ url: string; w: number; h: number; img: HTMLImageElement } | null>(null);
  const [detectando, setDetectando] = useState(false);
  const [usouIA, setUsouIA] = useState(false);
  const [ativa, setAtiva] = useState<string>('ombros');
  const [pontos, setPontos] = useState<Record<string, Ponto[]>>({});
  const [salvando, setSalvando] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const arrastando = useRef<{ medida: string; indice: number } | null>(null);

  useEffect(() => () => { if (foto) URL.revokeObjectURL(foto.url); }, [foto]);

  const disponiveis = medidasDaVista(vista);
  const medidaAtiva = MEDIDAS.find((m) => m.id === ativa && m.vistas.includes(vista)) ?? disponiveis[0];
  const ptsAtiva = pontos[medidaAtiva.id] ?? [];
  const proximo = ptsAtiva.length < medidaAtiva.pontos.length ? medidaAtiva.pontos[ptsAtiva.length] : null;

  const resultados = useMemo(() => disponiveis.flatMap((m) => {
    const p = pontos[m.id];
    if (!p || p.length < m.pontos.length) return [];
    const r = m.calcular(p);
    return r ? [{ medida: m, ...r }] : [];
  }), [disponiveis, pontos]);

  const escolherFoto = (arquivo: File | undefined) => {
    if (!arquivo) return;
    if (!arquivo.type.startsWith('image/')) { toast.error('Escolha um arquivo de imagem.'); return; }
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => { setFoto({ url, w: img.naturalWidth, h: img.naturalHeight, img }); setPontos({}); setUsouIA(false); };
    img.onerror = () => { URL.revokeObjectURL(url); toast.error('Não consegui abrir essa imagem.'); };
    img.src = url;
  };

  const doEvento = (e: { clientX: number; clientY: number }): Ponto | null => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: Math.min(Math.max(p.x, 0), foto?.w ?? 0), y: Math.min(Math.max(p.y, 0), foto?.h ?? 0) };
  };

  const marcar = (e: React.PointerEvent<SVGSVGElement>) => {
    if (arrastando.current || !proximo) return;
    const p = doEvento(e);
    if (p) setPontos((s) => ({ ...s, [medidaAtiva.id]: [...(s[medidaAtiva.id] ?? []), p] }));
  };

  const arrastar = (e: React.PointerEvent<SVGSVGElement>) => {
    const alvo = arrastando.current;
    if (!alvo) return;
    const p = doEvento(e);
    if (!p) return;
    setPontos((s) => ({ ...s, [alvo.medida]: (s[alvo.medida] ?? []).map((q, i) => (i === alvo.indice ? p : q)) }));
  };

  const marcarAutomatico = async () => {
    if (!foto) return;
    setDetectando(true);
    try {
      const lm = await detectarPose(foto.img);
      if (!lm) { toast.error('Não achei o corpo na foto. Marque os pontos à mão.'); return; }
      const sugeridos = pontosAutomaticos(lm, vista, foto.w, foto.h);
      const ids = Object.keys(sugeridos);
      if (!ids.length) { toast.warning('O corpo apareceu cortado ou pouco nítido. Marque os pontos à mão.'); return; }
      setPontos((s) => ({ ...s, ...sugeridos }));
      setAtiva(ids[0]);
      setUsouIA(true);
      toast.success(`Marquei ${ids.length} medida(s). Confira cada ponto e arraste o que estiver fora do lugar.`);
    } catch {
      // Sem internet para baixar o modelo, ou navegador sem suporte: segue a marcação manual.
      toast.error('Não consegui carregar a marcação automática agora. Marque os pontos à mão.');
    } finally {
      setDetectando(false);
    }
  };

  const desfazer = () => setPontos((s) => ({ ...s, [medidaAtiva.id]: (s[medidaAtiva.id] ?? []).slice(0, -1) }));
  const limpar = () => setPontos((s) => ({ ...s, [medidaAtiva.id]: [] }));

  const texto = resultados.map((r) => `• ${r.texto}`).join('\n');
  const vistaNome = VISTAS.find((v) => v.id === vista)!.nome.toLowerCase();

  const copiar = async () => {
    try { await navigator.clipboard.writeText(`Análise angular — vista ${vistaNome}\n${texto}`); toast.success('Resumo copiado.'); }
    catch { toast.error('Não consegui copiar.'); }
  };

  const registrar = async () => {
    if (!paciente || !user || !resultados.length) return;
    setSalvando(true);
    try {
      const { error } = await tabela('notas_prontuario').insert({
        paciente_id: paciente.id,
        terapeuta_id: user.id,
        tipo: 'analise_angular',
        titulo: `Análise angular — vista ${vistaNome}`,
        descricao: `${texto}\n${usouIA ? 'Pontos sugeridos por detecção automática de pose e conferidos pelo profissional' : 'Pontos marcados manualmente'} em foto, com a horizontal e a vertical da imagem como referência; a foto não é armazenada.`,
        dados_extras: { vista, medidas: resultados.map((r) => ({ id: r.medida.id, graus: Math.round(r.valor * 10) / 10 })), metodo: usouIA ? 'automatica_conferida' : 'marcacao_manual' },
      });
      if (error) throw error;
      toast.success(`Análise registrada no prontuário de ${paciente.nome}.`);
    } catch (e) {
      toast.error((e as { message?: string })?.message || 'Não foi possível registrar.');
    } finally {
      setSalvando(false);
    }
  };

  const raio = foto ? Math.max(foto.w, foto.h) / 110 : 8;

  return (
    <AppLayout>
      <div className="container max-w-6xl space-y-5 py-6">
        <PageHeader back="/aplicacoes" title="Análise angular" subtitle="Meça ângulos e desníveis em uma foto do paciente. Marque os pontos e o app calcula." icon={<Ruler className="icon-md" />} />

        <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-3 sm:flex-row sm:items-center">
          <span className="shrink-0 text-sm font-medium">Paciente <span className="text-xs font-normal text-muted-foreground">(opcional)</span></span>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="min-w-0 flex-1">
              <PacienteSelect pacientes={lista} value={pacienteId} onValueChange={(v) => { const n = new URLSearchParams(sp); if (v) n.set('paciente', v); else n.delete('paciente'); setSp(n, { replace: true }); }} placeholder="Escolher para registrar no prontuário…" />
            </div>
            {pacienteId && <Button variant="ghost" size="icon" aria-label="Tirar paciente" onClick={() => { const n = new URLSearchParams(sp); n.delete('paciente'); setSp(n, { replace: true }); }}><X className="h-4 w-4" /></Button>}
          </div>
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-3">
            <div role="tablist" aria-label="Vista" className="grid grid-cols-3 gap-1.5 rounded-2xl bg-muted/60 p-1.5">
              {VISTAS.map((v) => (
                <button key={v.id} type="button" role="tab" aria-selected={vista === v.id} onClick={() => setVista(v.id)}
                  className={cn('rounded-xl px-3 py-2 text-sm font-semibold transition-all', vista === v.id ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                  {v.nome}
                </button>
              ))}
            </div>

            {!foto ? (
              <label className="flex min-h-[260px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card p-6 text-center">
                <Camera className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm font-semibold">Tirar ou escolher a foto ({vistaNome})</span>
                <span className="max-w-sm text-xs text-muted-foreground">Câmera parada na altura do meio do corpo, paciente inteiro no quadro, boa luz e roupa justa. A foto fica só neste aparelho.</span>
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => escolherFoto(e.target.files?.[0])} />
              </label>
            ) : (
              <div className="space-y-2">
                <div className="overflow-hidden rounded-2xl border border-border/60 bg-black">
                  <svg ref={svgRef} viewBox={`0 0 ${foto.w} ${foto.h}`} className="mx-auto block max-h-[75dvh] w-full touch-none select-none"
                    style={{ cursor: proximo ? 'crosshair' : 'default' }}
                    onPointerDown={marcar} onPointerMove={arrastar}
                    onPointerUp={() => { arrastando.current = null; }} onPointerCancel={() => { arrastando.current = null; }}>
                    <image href={foto.url} width={foto.w} height={foto.h} />
                    {disponiveis.map((m) => {
                      const p = pontos[m.id] ?? [];
                      const destaque = m.id === medidaAtiva.id;
                      return (
                        <g key={m.id} opacity={destaque ? 1 : 0.55}>
                          {p.length > 1 && <polyline points={p.map((q) => `${q.x},${q.y}`).join(' ')} fill="none" stroke="#facc15" strokeWidth={raio / 4} />}
                          {p.map((q, i) => (
                            <g key={i} onPointerDown={(e) => { e.stopPropagation(); (e.currentTarget.ownerSVGElement as SVGSVGElement).setPointerCapture(e.pointerId); arrastando.current = { medida: m.id, indice: i }; setAtiva(m.id); }} style={{ cursor: 'grab' }}>
                              <circle cx={q.x} cy={q.y} r={raio} fill={CORES[i % CORES.length]} stroke="#fff" strokeWidth={raio / 5} />
                              <text x={q.x} y={q.y} textAnchor="middle" dominantBaseline="central" fontSize={raio * 1.1} fill="#fff" fontWeight="700" pointerEvents="none">{i + 1}</text>
                            </g>
                          ))}
                        </g>
                      );
                    })}
                  </svg>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground" role="status">
                    {proximo ? <>Toque em: <strong className="text-foreground">{ptsAtiva.length + 1}. {proximo}</strong></> : 'Medida completa. Arraste um ponto para ajustar.'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" className="gap-1.5" onClick={marcarAutomatico} disabled={detectando}>
                      {detectando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Marcar automaticamente
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={desfazer} disabled={!ptsAtiva.length}><Undo2 className="h-3.5 w-3.5" /> Desfazer</Button>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={limpar} disabled={!ptsAtiva.length}><Trash2 className="h-3.5 w-3.5" /> Limpar</Button>
                    <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent">
                      <Camera className="h-3.5 w-3.5" /> Trocar foto
                      <input type="file" accept="image/*" className="sr-only" onChange={(e) => escolherFoto(e.target.files?.[0])} />
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-3 lg:sticky lg:top-4">
            <div className="space-y-1.5 rounded-2xl border border-border/60 bg-card p-3">
              <p className="text-sm font-semibold">Medidas</p>
              {disponiveis.map((m) => {
                const feito = (pontos[m.id]?.length ?? 0) >= m.pontos.length;
                return (
                  <button key={m.id} type="button" onClick={() => setAtiva(m.id)}
                    className={cn('flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                      m.id === medidaAtiva.id ? 'border-primary bg-primary/5' : 'border-border/60 hover:bg-muted/50')}>
                    <span>{m.nome}</span>
                    <span className="text-[11px] text-muted-foreground">{feito ? 'feita' : `${pontos[m.id]?.length ?? 0}/${m.pontos.length}`}</span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-3">
              <p className="text-sm font-semibold">Resultado</p>
              {resultados.length === 0 ? <p className="text-xs text-muted-foreground">Complete uma medida para ver o resultado.</p> : (
                <ul className="space-y-1.5 text-sm tabular-nums">{resultados.map((r) => <li key={r.medida.id}>{r.texto}</li>)}</ul>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button onClick={registrar} disabled={!paciente || !resultados.length || salvando} className="min-w-[180px] flex-1 gap-1.5">
                  {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />} Registrar no prontuário
                </Button>
                <Button variant="outline" onClick={copiar} disabled={!resultados.length} className="gap-1.5"><Copy className="h-4 w-4" /> Copiar</Button>
              </div>
              {!paciente && resultados.length > 0 && <p className="text-[11px] text-muted-foreground">Escolha um paciente no topo para registrar.</p>}
            </div>

            <p className="px-1 text-[11px] leading-snug text-muted-foreground">
              A marcação automática acha centros de articulação, não os pontos ósseos da clínica (acrômio, crista ilíaca, C7, trocânter): use como ponto de partida, confira e ajuste. O ângulo craniovertebral sempre é marcado à mão. Os ângulos usam a horizontal e a vertical da foto como referência: com a câmera torta, os desníveis saem errados. Servem para acompanhar a evolução entre fotos feitas do mesmo jeito; não definem diagnóstico.
            </p>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}
