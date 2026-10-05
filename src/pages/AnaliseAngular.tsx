import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Camera, ClipboardCheck, Copy, FileDown, Film, Grid3x3, Hand, Loader2, Maximize2, MousePointer2, Ruler, Smartphone, Sparkles, Trash2, Undo2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/components/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PacienteSelect } from '@/components/paciente/PacienteSelect';
import MarchaVideo from '@/components/angular/MarchaVideo';
import CameraNivel from '@/components/angular/CameraNivel';
import NivelCelular from '@/components/angular/NivelCelular';
import { parseNum } from '@/components/dosagem/comuns';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { tabela } from '@/lib/dosagem/db';
import { cmPorPixel, girar, medidasDaVista, rotacaoDoNivel, segmentosDaMedida, type GrupoMedida, type Medida, type Ponto, type Vista } from '@/lib/angular/medidas';
import { giroDaFoto } from '@/lib/angular/sensor';
import { detectarPose } from '@/lib/angular/detector';
import { pontosAutomaticos } from '@/lib/angular/pose';
import { compararMedidas, grau, variacaoTexto, type MedidaSalva } from '@/lib/angular/comparar';
import { fotoComMarcacoes, gerarRelatorioAngular, type GrupoDesenho } from '@/lib/angular/relatorio';
import { entregarPdf } from '@/lib/pdf/entrega';
import { usePacienteDosagem, usePacientesLista } from '@/hooks/useProntuarioSeguranca';

const VISTAS: { id: Vista; nome: string }[] = [
  { id: 'frente', nome: 'Frente' },
  { id: 'perfil', nome: 'Perfil' },
  { id: 'costas', nome: 'Costas' },
];

const GRUPOS: { id: GrupoMedida; titulo: string }[] = [
  { id: 'postura', titulo: 'Postura' },
  { id: 'ferramenta', titulo: 'Ferramentas' },
  { id: 'referencia', titulo: 'Referências da foto' },
];

const CORES = ['#ef4444', '#3b82f6', '#10b981', '#a855f7'];
const COR_REFERENCIA: Record<string, string> = { nivel: '#22d3ee', escala: '#fb923c' };
const ZOOM_MAX = 5;

const nf = (n: number, d = 1) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const rotuloValor = (v: number, un?: 'cm') => `${nf(v)}${un === 'cm' ? ' cm' : '°'}`;

// Análise angular em foto: o profissional marca os pontos (ou deixa o app sugerir) e o app calcula.
// Nível e escala corrigem a foto torta e dão medidas em centímetros. A foto fica só no navegador.
export default function AnaliseAngular() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [sp, setSp] = useSearchParams();
  const pacienteId = sp.get('paciente') || '';
  const modoAnalise = sp.get('modo') === 'marcha' ? 'marcha' : 'foto';
  const { data: lista = [] } = usePacientesLista(user?.id);
  const { data: paciente } = usePacienteDosagem(pacienteId || null);

  const [vista, setVista] = useState<Vista>('frente');
  const [foto, setFoto] = useState<{ url: string; w: number; h: number; img: HTMLImageElement } | null>(null);
  const [detectando, setDetectando] = useState(false);
  const [usouIA, setUsouIA] = useState(false);
  const [anteriorId, setAnteriorId] = useState('');
  const [comFoto, setComFoto] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [ativa, setAtiva] = useState<string>('ombros');
  const [pontos, setPontos] = useState<Record<string, Ponto[]>>({});
  const [salvando, setSalvando] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [mover, setMover] = useState(false);
  const [grade, setGrade] = useState(false);
  const [nivelTipo, setNivelTipo] = useState<'horizontal' | 'vertical'>('horizontal');
  const [escalaCm, setEscalaCm] = useState('');
  const [cameraAberta, setCameraAberta] = useState(false);
  const [inclinacaoCaptura, setInclinacaoCaptura] = useState<number | null>(null);
  const [inverterSensor, setInverterSensor] = useState(false);
  const [leituraSensor, setLeituraSensor] = useState<{ graus: number; texto: string } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const arrastando = useRef<{ medida: string; indice: number } | null>(null);

  useEffect(() => () => { if (foto) URL.revokeObjectURL(foto.url); }, [foto]);

  const disponiveis = medidasDaVista(vista);
  const medidaAtiva: Medida = disponiveis.find((m) => m.id === ativa) ?? disponiveis[0];
  const ptsAtiva = pontos[medidaAtiva.id] ?? [];
  const proximo = ptsAtiva.length < medidaAtiva.pontos.length ? medidaAtiva.pontos[ptsAtiva.length] : null;
  const completa = (m: Medida) => (pontos[m.id]?.length ?? 0) >= m.pontos.length;

  // Referências da foto: giro (nível) e escala (cm por pixel).
  const giroMarcado = useMemo(() => {
    const p = pontos.nivel;
    return p && p.length >= 2 ? rotacaoDoNivel(p[0], p[1], nivelTipo) : null;
  }, [pontos.nivel, nivelTipo]);
  const giroSensor = inclinacaoCaptura !== null ? giroDaFoto(inclinacaoCaptura, inverterSensor) : null;
  const giro = giroMarcado ?? giroSensor;
  const origemGiro = giroMarcado !== null ? 'uma referência marcada na foto' : 'o sensor do celular ao fotografar';
  const cmPorPx = useMemo(() => {
    const p = pontos.escala, cm = parseNum(escalaCm);
    return p && p.length >= 2 && cm ? cmPorPixel(p[0], p[1], cm) : null;
  }, [pontos.escala, escalaCm]);

  const resultados = useMemo(() => disponiveis.flatMap((m) => {
    if (m.auxiliar) return [];
    const p = pontos[m.id];
    if (!p || p.length < m.pontos.length) return [];
    const r = m.calcular(giro ? p.map((q) => girar(q, -giro)) : p, { cmPorPx });
    return r ? [{ medida: m, ...r }] : [];
  }), [disponiveis, pontos, giro, cmPorPx]);

  const medidasAtuais: MedidaSalva[] = [
    ...resultados.map((r) => ({ id: r.medida.id, graus: Math.round(r.valor * 10) / 10, texto: r.texto, ...(r.medida.unidade ? { unidade: r.medida.unidade } : {}) })),
    ...(leituraSensor ? [{ id: 'sensor', graus: Math.round(leituraSensor.graus * 10) / 10, texto: leituraSensor.texto }] : []),
  ];
  const temResultado = medidasAtuais.length > 0;

  const { data: historico = [] } = useQuery({
    queryKey: ['analise-angular-historico', pacienteId],
    enabled: !!pacienteId,
    queryFn: async () => {
      const { data, error } = await tabela('notas_prontuario').select('id, created_at, dados_extras')
        .eq('paciente_id', pacienteId).eq('tipo', 'analise_angular').order('created_at', { ascending: false }).limit(20);
      if (error) throw error;
      return (data ?? []) as { id: string; created_at: string; dados_extras: { vista?: Vista; medidas?: MedidaSalva[] } | null }[];
    },
  });
  const anterioresDaVista = historico.filter((h) => h.dados_extras?.vista === vista && h.dados_extras.medidas?.length);
  const anterior = anterioresDaVista.find((h) => h.id === anteriorId) ?? null;
  const comparacao = anterior ? compararMedidas(medidasAtuais, anterior.dados_extras!.medidas!).filter((l) => l.atual) : [];
  const dataBR = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const escolherFoto = (arquivo: File | undefined, inclinacao: number | null = null) => {
    if (!arquivo) return;
    if (!arquivo.type.startsWith('image/')) { toast.error('Escolha um arquivo de imagem.'); return; }
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => { setFoto({ url, w: img.naturalWidth, h: img.naturalHeight, img }); setPontos({}); setUsouIA(false); setZoom(1); setMover(false); setInclinacaoCaptura(inclinacao); setInverterSensor(false); };
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
    if (mover || arrastando.current || !proximo) return;
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

  const desfazer = () => setPontos((s) => ({ ...s, [medidaAtiva.id]: (s[medidaAtiva.id] ?? []).slice(0, -1) }));
  const limpar = () => setPontos((s) => ({ ...s, [medidaAtiva.id]: [] }));

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

  const texto = medidasAtuais.map((m) => `• ${m.texto}`).join('\n');
  const vistaNome = VISTAS.find((v) => v.id === vista)!.nome.toLowerCase();
  const notaNivel = giro !== null && Math.abs(giro) >= 0.05
    ? `Foto nivelada por ${origemGiro} (correção de ${nf(Math.abs(giro))}°); os ângulos valem para acompanhar a evolução entre fotos feitas do mesmo jeito.`
    : undefined;

  const copiar = async () => {
    try { await navigator.clipboard.writeText(`Análise angular — vista ${vistaNome}\n${texto}`); toast.success('Resumo copiado.'); }
    catch { toast.error('Não consegui copiar.'); }
  };

  const registrar = async () => {
    if (!paciente || !user || !temResultado) return;
    setSalvando(true);
    try {
      const { error } = await tabela('notas_prontuario').insert({
        paciente_id: paciente.id,
        terapeuta_id: user.id,
        tipo: 'analise_angular',
        titulo: `Análise angular — vista ${vistaNome}`,
        descricao: `${texto}\n${usouIA ? 'Pontos sugeridos por detecção automática de pose e conferidos pelo profissional' : 'Pontos marcados manualmente'} em foto. ${notaNivel ?? 'Os ângulos usam a horizontal e a vertical da imagem como referência.'} A foto não é armazenada.`,
        dados_extras: { vista, medidas: medidasAtuais, metodo: usouIA ? 'automatica_conferida' : 'marcacao_manual', nivel_graus: giro, escala_cm_por_px: cmPorPx },
      });
      if (error) throw error;
      toast.success(`Análise registrada no prontuário de ${paciente.nome}.`);
      qc.invalidateQueries({ queryKey: ['analise-angular-historico', pacienteId] });
    } catch (e) {
      toast.error((e as { message?: string })?.message || 'Não foi possível registrar.');
    } finally {
      setSalvando(false);
    }
  };

  const desenhos = (): GrupoDesenho[] => disponiveis.flatMap((m) => {
    const p = pontos[m.id];
    if (!p?.length) return [];
    const r = resultados.find((x) => x.medida.id === m.id);
    return [{ pontos: p, segmentos: segmentosDaMedida(m).filter(([i, j]) => i < p.length && j < p.length), cor: COR_REFERENCIA[m.id] ?? '#facc15', rotulo: r ? rotuloValor(r.valor, m.unidade) : undefined }];
  });

  const gerarPdf = async () => {
    if (!foto || !temResultado) return;
    setGerando(true);
    try {
      const imagem = comFoto ? fotoComMarcacoes(foto.img, desenhos()) : null;
      const { blob, nome } = await gerarRelatorioAngular({
        paciente: paciente ? `${paciente.nome} ${paciente.sobrenome ?? ''}`.trim() : 'Paciente',
        profissional: profile ? `${profile.nome} ${profile.sobrenome || ''}`.trim() + (profile.crefito ? ` · CREFITO ${profile.crefito}` : '') : undefined,
        data: new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        vistaNome,
        medidas: medidasAtuais,
        metodo: usouIA ? 'automatica_conferida' : 'marcacao_manual',
        anterior: anterior ? { data: dataBR(anterior.created_at), medidas: anterior.dados_extras!.medidas! } : null,
        imagem,
        notaExtra: notaNivel,
      });
      entregarPdf({ blob, nome, pacienteId: paciente?.id ?? null, titulo: 'Análise angular' });
    } catch {
      toast.error('Não consegui gerar o PDF.');
    } finally {
      setGerando(false);
    }
  };

  const base = foto ? Math.max(foto.w, foto.h) / 110 : 8;
  const raio = base / Math.sqrt(zoom);
  const proporcao = foto ? foto.w / foto.h : 1;
  const semEscala = medidaAtiva.id === 'regua' && !cmPorPx;
  const mudarModo = (id: 'foto' | 'marcha') => { const n = new URLSearchParams(sp); if (id === 'marcha') n.set('modo', 'marcha'); else n.delete('modo'); setSp(n, { replace: true }); };
  const mudarPaciente = (v: string) => { const n = new URLSearchParams(sp); if (v) n.set('paciente', v); else n.delete('paciente'); setSp(n, { replace: true }); };

  return (
    <AppLayout>
      <div className="container max-w-6xl space-y-5 py-6">
        <PageHeader back="/aplicacoes" title="Análise angular" subtitle="Meça ângulos e desníveis em uma foto, ou analise a marcha em um vídeo." icon={<Ruler className="icon-md" />} />

        <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-3 sm:flex-row sm:items-center">
          <span className="shrink-0 text-sm font-medium">Paciente <span className="text-xs font-normal text-muted-foreground">(opcional)</span></span>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="min-w-0 flex-1">
              <PacienteSelect pacientes={lista} value={pacienteId} onValueChange={mudarPaciente} placeholder="Escolher para registrar no prontuário…" />
            </div>
            {pacienteId && <Button variant="ghost" size="icon" aria-label="Tirar paciente" onClick={() => mudarPaciente('')}><X className="h-4 w-4" /></Button>}
          </div>
        </div>

        <div role="tablist" aria-label="Tipo de análise" className="grid grid-cols-2 gap-1.5 rounded-2xl bg-muted/60 p-1.5">
          {([['foto', 'Postura em foto', Camera], ['marcha', 'Marcha em vídeo', Film]] as const).map(([id, rotulo, Icone]) => (
            <button key={id} type="button" role="tab" aria-selected={modoAnalise === id} onClick={() => mudarModo(id)}
              className={cn('flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all', modoAnalise === id ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              <Icone className="h-4 w-4" /> {rotulo}
            </button>
          ))}
        </div>

        {modoAnalise === 'marcha' ? <MarchaVideo paciente={paciente} /> : (
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
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
                  <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={(e) => { e.preventDefault(); setCameraAberta(true); }}><Smartphone className="h-3.5 w-3.5" /> Tirar foto com nível</Button>
                </label>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-border/60 bg-card p-1.5">
                    <Button size="icon" variant="ghost" className="h-9 w-9" aria-label="Diminuir zoom" onClick={() => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)))} disabled={zoom <= 1}><ZoomOut className="h-4 w-4" /></Button>
                    <span className="min-w-[3rem] text-center text-xs font-semibold tabular-nums">{Math.round(zoom * 100)}%</span>
                    <Button size="icon" variant="ghost" className="h-9 w-9" aria-label="Aumentar zoom" onClick={() => setZoom((z) => Math.min(ZOOM_MAX, +(z + 0.5).toFixed(1)))} disabled={zoom >= ZOOM_MAX}><ZoomIn className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-9 w-9" aria-label="Ajustar à tela" onClick={() => { setZoom(1); setMover(false); }}><Maximize2 className="h-4 w-4" /></Button>
                    <span className="mx-1 h-5 w-px bg-border" aria-hidden />
                    <Button size="sm" variant={mover ? 'default' : 'ghost'} className="h-9 gap-1.5" aria-pressed={mover} onClick={() => setMover((m) => !m)} disabled={zoom <= 1} title="Com zoom, ligue para arrastar a foto com o dedo">
                      {mover ? <Hand className="h-4 w-4" /> : <MousePointer2 className="h-4 w-4" />} {mover ? 'Mover' : 'Marcar'}
                    </Button>
                    <Button size="sm" variant={grade ? 'default' : 'ghost'} className="h-9 gap-1.5" aria-pressed={grade} onClick={() => setGrade((g) => !g)}><Grid3x3 className="h-4 w-4" /> Grade</Button>
                  </div>

                  <div className="max-h-[75dvh] overflow-auto rounded-2xl border border-border/60 bg-black">
                    <svg ref={svgRef} viewBox={`0 0 ${foto.w} ${foto.h}`} className={cn('mx-auto block select-none', !mover && 'touch-none')}
                      style={{ width: `min(${zoom * 100}%, calc(75dvh * ${proporcao.toFixed(4)} * ${zoom}))`, cursor: mover ? 'grab' : proximo ? 'crosshair' : 'default' }}
                      onPointerDown={marcar} onPointerMove={arrastar}
                      onPointerUp={() => { arrastando.current = null; }} onPointerCancel={() => { arrastando.current = null; }}>
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
                      {disponiveis.map((m) => {
                        const p = pontos[m.id] ?? [];
                        const destaque = m.id === medidaAtiva.id;
                        const r = resultados.find((x) => x.medida.id === m.id);
                        const cor = COR_REFERENCIA[m.id] ?? '#facc15';
                        return (
                          <g key={m.id} opacity={destaque ? 1 : 0.6}>
                            {segmentosDaMedida(m).filter(([i, j]) => i < p.length && j < p.length).map(([i, j]) => (
                              <line key={`${i}-${j}`} x1={p[i].x} y1={p[i].y} x2={p[j].x} y2={p[j].y} stroke={cor} strokeWidth={raio / 4} strokeLinecap="round" />
                            ))}
                            {p.map((q, i) => (
                              <g key={i} onPointerDown={(e) => { if (mover) return; e.stopPropagation(); (e.currentTarget.ownerSVGElement as SVGSVGElement).setPointerCapture(e.pointerId); arrastando.current = { medida: m.id, indice: i }; setAtiva(m.id); }} style={{ cursor: mover ? 'grab' : 'move' }}>
                                <circle cx={q.x} cy={q.y} r={raio} fill={CORES[i % CORES.length]} stroke="#fff" strokeWidth={raio / 5} />
                                <text x={q.x} y={q.y} textAnchor="middle" dominantBaseline="central" fontSize={raio * 1.1} fill="#fff" fontWeight="700" pointerEvents="none">{i + 1}</text>
                              </g>
                            ))}
                            {r && p.length > 0 && (
                              <text x={p.reduce((s, q) => s + q.x, 0) / p.length} y={p.reduce((s, q) => s + q.y, 0) / p.length - raio * 2} textAnchor="middle" dominantBaseline="central"
                                fontSize={raio * 1.4} fontWeight="700" fill="#fff" stroke="#000" strokeWidth={raio / 2.5} strokeLinejoin="round" paintOrder="stroke" pointerEvents="none">{rotuloValor(r.valor, m.unidade)}</text>
                            )}
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground" role="status">
                      {mover ? 'Modo mover: arraste a foto. Toque em “Mover” para voltar a marcar.'
                        : proximo ? <>Toque em: <strong className="text-foreground">{ptsAtiva.length + 1}. {proximo}</strong></>
                          : 'Medida completa. Arraste um ponto para ajustar.'}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" className="gap-1.5" onClick={marcarAutomatico} disabled={detectando}>
                        {detectando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Marcar automaticamente
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={desfazer} disabled={!ptsAtiva.length}><Undo2 className="h-3.5 w-3.5" /> Desfazer</Button>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={limpar} disabled={!ptsAtiva.length}><Trash2 className="h-3.5 w-3.5" /> Limpar</Button>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setCameraAberta(true)}><Smartphone className="h-3.5 w-3.5" /> Foto com nível</Button>
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
              <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-3">
                {GRUPOS.map((g) => {
                  const itens = disponiveis.filter((m) => m.grupo === g.id);
                  if (!itens.length) return null;
                  return (
                    <div key={g.id} className="space-y-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.titulo}</p>
                      {itens.map((m) => {
                        const n = pontos[m.id]?.length ?? 0;
                        const feita = n >= m.pontos.length;
                        const estado = m.id === 'nivel' && giro !== null ? `${nf(Math.abs(giro))}°`
                          : m.id === 'escala' && cmPorPx ? 'calibrada'
                            : feita ? 'feita' : `${n}/${m.pontos.length}`;
                        return (
                          <button key={m.id} type="button" onClick={() => setAtiva(m.id)} aria-pressed={m.id === medidaAtiva.id}
                            className={cn('flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                              m.id === medidaAtiva.id ? 'border-primary bg-primary/5' : 'border-border/60 hover:bg-muted/50')}>
                            <span className="flex items-center gap-2">
                              {COR_REFERENCIA[m.id] && <span className="h-2.5 w-2.5 rounded-full" style={{ background: COR_REFERENCIA[m.id] }} aria-hidden />}
                              {m.nome}
                            </span>
                            <span className={cn('text-[11px] tabular-nums', feita ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground')}>{estado}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}

                {medidaAtiva.id === 'nivel' && (
                  <div className="space-y-2 rounded-xl bg-muted/40 p-2.5 text-xs">
                    <p className="text-muted-foreground">Marque 2 pontos sobre algo que na vida real é reto: o rodapé ou o chão (horizontal), um fio de prumo ou batente de porta (vertical). O app mede o giro da foto e corrige todos os ângulos.</p>
                    <div className="grid grid-cols-2 gap-1">
                      {(['horizontal', 'vertical'] as const).map((t) => (
                        <button key={t} type="button" aria-pressed={nivelTipo === t} onClick={() => setNivelTipo(t)}
                          className={cn('rounded-lg border px-2 py-1.5 font-medium capitalize', nivelTipo === t ? 'border-primary bg-primary/10' : 'border-border/60')}>{t}</button>
                      ))}
                    </div>
                    {giro !== null && <p className="font-medium">{Math.abs(giro) < 0.05 ? 'Foto já está nivelada.' : `Foto girada ${nf(Math.abs(giro))}° (por ${origemGiro}): todos os ângulos já saem corrigidos.`}</p>}
                    {giroMarcado === null && giroSensor !== null && (
                      <div className="space-y-1">
                        <p className="text-muted-foreground">Confira com a grade: as linhas devem acompanhar o chão. Se estiverem tortas para o lado errado, inverta.</p>
                        <Button size="sm" variant="outline" onClick={() => setInverterSensor((v) => !v)}>Inverter o sentido da correção</Button>
                      </div>
                    )}
                  </div>
                )}
                {medidaAtiva.id === 'escala' && (
                  <div className="space-y-2 rounded-xl bg-muted/40 p-2.5 text-xs">
                    <p className="text-muted-foreground">Marque as pontas de um objeto de tamanho conhecido, no mesmo plano do paciente (fita métrica, régua, marcador no chão), e informe o comprimento.</p>
                    <div className="flex items-center gap-2">
                      <Input inputMode="decimal" value={escalaCm} onChange={(e) => setEscalaCm(e.target.value)} placeholder="Comprimento" className="h-9 text-[16px] sm:text-sm" aria-label="Comprimento do objeto em centímetros" />
                      <span className="shrink-0 font-medium">cm</span>
                    </div>
                    {cmPorPx && <p className="font-medium">Escala pronta: a régua já mede em centímetros.</p>}
                  </div>
                )}
                {semEscala && <p className="rounded-xl bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">Para medir em centímetros, primeiro calibre a escala (em “Referências da foto”).</p>}
                {medidaAtiva.id === 'cobb' && <p className="rounded-xl bg-muted/40 p-2.5 text-xs text-muted-foreground">Marque as duas retas (por exemplo, as linhas das vértebras limite da curva). O app dá o ângulo entre elas. Em foto, é uma estimativa; o Cobb de referência vem da radiografia.</p>}
              </div>

              <NivelCelular onRegistrar={(graus, texto) => setLeituraSensor({ graus, texto })} />

              <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-3">
                <p className="text-sm font-semibold">Resultado</p>
                {!temResultado ? <p className="text-xs text-muted-foreground">Complete uma medida para ver o resultado.</p> : (
                  <ul className="space-y-1.5 text-sm tabular-nums">{medidasAtuais.map((m) => <li key={m.id}>{m.texto}</li>)}</ul>
                )}
                {notaNivel && <p className="text-[11px] text-muted-foreground">Correção de nível aplicada: {nf(Math.abs(giro ?? 0))}°.</p>}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button onClick={registrar} disabled={!paciente || !temResultado || salvando} className="min-w-[180px] flex-1 gap-1.5">
                    {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />} Registrar no prontuário
                  </Button>
                  <Button variant="outline" onClick={copiar} disabled={!temResultado} className="gap-1.5"><Copy className="h-4 w-4" /> Copiar</Button>
                </div>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Button variant="outline" onClick={gerarPdf} disabled={!temResultado || gerando} className="gap-1.5">
                    {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} Gerar PDF
                  </Button>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><input type="checkbox" checked={comFoto} onChange={(e) => setComFoto(e.target.checked)} /> Incluir a foto com as marcações</label>
                </div>
                {!paciente && temResultado && <p className="text-[11px] text-muted-foreground">Escolha um paciente no topo para registrar.</p>}
              </div>

              {paciente && (
                <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-3">
                  <p className="text-sm font-semibold">Comparar com avaliação anterior</p>
                  {anterioresDaVista.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Ainda não há análise angular de vista {vistaNome} registrada para este paciente.</p>
                  ) : (
                    <>
                      <select value={anteriorId} onChange={(e) => setAnteriorId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" aria-label="Avaliação anterior">
                        <option value="">Escolher uma avaliação…</option>
                        {anterioresDaVista.map((h) => <option key={h.id} value={h.id}>{dataBR(h.created_at)}</option>)}
                      </select>
                      {anterior && (comparacao.length === 0 ? <p className="text-xs text-muted-foreground">Complete uma medida para comparar.</p> : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs tabular-nums">
                            <thead><tr className="text-left text-muted-foreground"><th className="py-1 pr-2 font-medium">Medida</th><th className="px-2 font-medium">Antes</th><th className="px-2 font-medium">Agora</th><th className="pl-2 font-medium">Variação</th></tr></thead>
                            <tbody>{comparacao.map((l) => (
                              <tr key={l.id} className="border-t border-border/50"><td className="py-1.5 pr-2">{l.nome}</td><td className="px-2">{grau(l.anterior?.graus, l.atual?.unidade)}</td><td className="px-2">{grau(l.atual?.graus, l.atual?.unidade)}</td><td className="pl-2 font-medium">{variacaoTexto(l.variacao, l.atual?.unidade)}</td></tr>
                            ))}</tbody>
                          </table>
                          <p className="mt-1.5 text-[11px] text-muted-foreground">Nos desníveis o número não mostra o lado; veja a leitura de cada avaliação.</p>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              <p className="px-1 text-[11px] leading-snug text-muted-foreground">
                A marcação automática acha centros de articulação, não os pontos ósseos da clínica (acrômio, crista ilíaca, C7, trocânter): use como ponto de partida, confira e ajuste. O ângulo craniovertebral sempre é marcado à mão. Sem a referência de nível, os ângulos usam a horizontal e a vertical da foto: com a câmera torta, os desníveis saem errados. Serve para acompanhar a evolução entre fotos feitas do mesmo jeito; não define diagnóstico.
              </p>
            </aside>
          </div>
        )}
      </div>
      {cameraAberta && <CameraNivel onFechar={() => setCameraAberta(false)} onCapturar={(f, incl) => { setCameraAberta(false); escolherFoto(f, incl); }} />}
    </AppLayout>
  );
}
