import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';
import { Dumbbell, FileUp, Loader2, Trash2, FileDown, Copy, Save, FlaskConical, X } from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/components/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { lerPlanilha, type Aba } from '@/lib/dinamometria/planilha';
import {
  type Avaliacao, type Analise, type Criterios, type Inspecao, type Mapa, type ResultadoCurva, type Slot, type Status, type Unidade, type Lado, type Sujeito,
  SLOTS, UF, REGIOES, CRITERIOS_PADRAO, num, fmt, nomeSlot, dataBR, inspecionar, extrair, analisarCurva, analisar, interpretar,
  resumoCurtoAnalise, stLSI, stDesvio, stFadiga, stOsc, stZ, curvaSimulada, clamp,
} from '@/lib/dinamometria/analise';
import { gerarRelatorioDinamometria } from '@/lib/dinamometria/relatorio';

const COR: Record<Lado, string> = { D: '#2A78D6', E: '#EB6834' };
const CHAVE_CRITERIOS = 'dinamometria_criterios_v1';

interface SlotRascunho { arquivo: string; abas?: Aba[]; abaIdx?: number; insp?: Inspecao | null; mapa?: Mapa | null; res: ResultadoCurva | null }
interface Registro { id: string; data: string; av: Avaliacao; obs: string }

function lerCriterios(): Criterios {
  try {
    const s = localStorage.getItem(CHAVE_CRITERIOS);
    return s ? { ...CRITERIOS_PADRAO, ...JSON.parse(s) } : CRITERIOS_PADRAO;
  } catch {
    // localStorage indisponível (modo privado): segue com o padrão
    return CRITERIOS_PADRAO;
  }
}

function idadeDe(nasc?: string | null): number | null {
  if (!nasc) return null;
  const d = new Date(nasc);
  if (Number.isNaN(d.getTime())) return null;
  const h = new Date();
  let i = h.getFullYear() - d.getFullYear();
  if (h.getMonth() < d.getMonth() || (h.getMonth() === d.getMonth() && h.getDate() < d.getDate())) i--;
  return i;
}

function Pilula({ st }: { st: Status }) {
  if (!st) return null;
  const cls = {
    ok: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    warn: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
    bad: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
    info: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  }[st[0]];
  const icone = { ok: '✓', warn: '!', bad: '✕', info: 'i' }[st[0]];
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap', cls)}>{icone} {st[1]}</span>;
}

function Bolinha({ lado }: { lado: Lado }) {
  return <span className="inline-block h-2.5 w-2.5 rounded-sm mr-1.5 align-middle" style={{ background: COR[lado] }} />;
}

// Une as curvas D e E numa grade de tempo comum para o gráfico e o tooltip.
function linhasCurva(av: Avaliacao, g: 'ag' | 'an', u: Unidade) {
  const d = av.slots[`${g}D` as Slot]?.curva, e = av.slots[`${g}E` as Slot]?.curva;
  const curvas = [d, e].filter(Boolean) as { t: number[]; f: number[] }[];
  if (!curvas.length) return [];
  const t0 = Math.min(...curvas.map(c => c.t[0])), t1 = Math.max(...curvas.map(c => c.t[c.t.length - 1]));
  const interp = (c: { t: number[]; f: number[] } | undefined, x: number) => {
    if (!c || x < c.t[0] || x > c.t[c.t.length - 1]) return null;
    let lo = 0, hi = c.t.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c.t[m] <= x) lo = m; else hi = m; }
    const span = c.t[hi] - c.t[lo] || 1;
    return (c.f[lo] + ((c.f[hi] - c.f[lo]) * (x - c.t[lo])) / span) / UF[u];
  };
  const passo = Math.max(0.01, (t1 - t0) / 400);
  const out: { t: number; D: number | null; E: number | null }[] = [];
  for (let x = t0; x <= t1 + 1e-9; x += passo) out.push({ t: +x.toFixed(3), D: interp(d, x), E: interp(e, x) });
  return out;
}

export default function Dinamometria() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [aba, setAba] = useState('resultado');
  const [crit, setCrit] = useState<Criterios>(lerCriterios);
  const [critForm, setCritForm] = useState<Record<string, string>>({});
  const [verId, setVerId] = useState<string | null>(null);
  const [confirmaExcluir, setConfirmaExcluir] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const [dataAv, setDataAv] = useState(() => new Date().toISOString().slice(0, 10));
  const [regiao, setRegiao] = useState('joelho');
  const [braco, setBraco] = useState('');
  const [suj, setSuj] = useState({ idade: '', sexo: 'M' as 'M' | 'F', peso: '', dominante: 'D' as Lado, acometido: 'N' as Lado | 'N', modalidade: '' });
  const [obs, setObs] = useState('');
  const [visivel, setVisivel] = useState(true);
  const [slots, setSlots] = useState<Partial<Record<Slot, SlotRascunho>>>({});
  const [lendo, setLendo] = useState<Slot | null>(null);
  const [sobre, setSobre] = useState<Slot | null>(null);

  const { data: paciente } = useQuery({
    queryKey: ['dinamometria-paciente', id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await (supabase as any).from('pacientes').select('id, nome, sobrenome, data_nascimento, sexo, genero').eq('id', id).maybeSingle();
      return data as { id: string; nome: string; sobrenome: string; data_nascimento: string | null; sexo: string | null; genero: string | null } | null;
    },
  });

  const { data: exames = [], isLoading } = useQuery({
    queryKey: ['exames-presenciais', id, 'dinamometria'],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await (supabase as any).from('exames_presenciais')
        .select('id, tipo, data_exame, dados, created_at')
        .eq('paciente_id', id)
        .in('tipo', ['dinamometria', 'bioimpedancia'])
        .order('data_exame', { ascending: true })
        .order('created_at', { ascending: true });
      return (data || []) as { id: string; tipo: string; data_exame: string; dados: any }[];
    },
  });

  const registros: Registro[] = useMemo(
    () => exames.filter(e => e.tipo === 'dinamometria' && e.dados?.analise?.versao === 1).map(e => ({ id: e.id, data: e.data_exame, av: e.dados.analise as Avaliacao, obs: e.dados.observacoes || '' })),
    [exames],
  );
  const pesoBio = useMemo(() => {
    const b = [...exames].reverse().find(e => e.tipo === 'bioimpedancia' && e.dados?.peso_kg);
    return b ? Number(b.dados.peso_kg) : null;
  }, [exames]);

  const nomePaciente = paciente ? `${paciente.nome} ${paciente.sobrenome || ''}`.trim() : 'Paciente';

  // Preenche os dados do paciente uma vez, a partir do cadastro e da última avaliação.
  const [preenchido, setPreenchido] = useState(false);
  useEffect(() => {
    if (preenchido || !paciente || isLoading) return;
    const ult = registros[registros.length - 1]?.av.sujeito;
    const sx = String(paciente.sexo || paciente.genero || '').toLowerCase();
    setSuj({
      idade: String(idadeDe(paciente.data_nascimento) ?? ult?.idade ?? ''),
      sexo: sx.startsWith('f') ? 'F' : sx.startsWith('m') ? 'M' : (ult?.sexo || 'M'),
      peso: String(pesoBio ?? ult?.peso ?? ''),
      dominante: ult?.dominante || 'D',
      acometido: ult?.acometido || 'N',
      modalidade: ult?.modalidade || '',
    });
    if (registros.length) { setRegiao(registros[registros.length - 1].av.regiao); setBraco(registros[registros.length - 1].av.braco ? String(registros[registros.length - 1].av.braco) : ''); }
    else setAba('nova');
    setPreenchido(true);
  }, [paciente, isLoading, registros, pesoBio, preenchido]);

  const u = crit.unidade;
  const disp = (N?: number | null) => (N == null ? null : N / UF[u]);
  const R = REGIOES[regiao] || REGIOES.joelho;

  // ───── Importação ─────
  const processar = (s: SlotRascunho): SlotRascunho => {
    if (!s.abas || s.abaIdx == null || !s.mapa) return s;
    if (s.mapa.forca == null) return { ...s, res: { erro: 'Escolha a coluna de força.' } };
    const ex = extrair(s.abas[s.abaIdx].linhas, s.mapa);
    return { ...s, res: analisarCurva(ex.t, ex.f, crit.platoMin) };
  };

  const carregarArquivo = async (k: Slot, file: File) => {
    setLendo(k);
    try {
      const abas = await lerPlanilha(file);
      let abaIdx = 0, insp: Inspecao | null = null;
      for (let i = 0; i < abas.length; i++) { const r = inspecionar(abas[i].linhas); if (r) { abaIdx = i; insp = r; break; } }
      if (!insp) { setSlots(p => ({ ...p, [k]: { arquivo: file.name, abas, abaIdx: 0, insp: null, mapa: null, res: { erro: 'Não encontrei colunas numéricas neste arquivo.' } } })); return; }
      setSlots(p => ({ ...p, [k]: processar({ arquivo: file.name, abas, abaIdx, insp, mapa: insp.mapa, res: null }) }));
    } catch (e: any) {
      toast.error(e?.message || `Não consegui ler ${file.name}.`);
    } finally {
      setLendo(null);
    }
  };

  const ajustarMapa = (k: Slot, patch: Partial<Mapa>) => setSlots(p => {
    const s = p[k];
    if (!s?.mapa) return p;
    return { ...p, [k]: processar({ ...s, mapa: { ...s.mapa, ...patch } }) };
  });

  const trocarAba = (k: Slot, idx: number) => setSlots(p => {
    const s = p[k];
    if (!s?.abas) return p;
    const insp = inspecionar(s.abas[idx].linhas);
    if (!insp) return { ...p, [k]: { ...s, abaIdx: idx, insp: null, mapa: null, res: { erro: 'Esta aba não tem colunas numéricas.' } } };
    return { ...p, [k]: processar({ ...s, abaIdx: idx, insp, mapa: insp.mapa }) };
  });

  const usarExemplo = () => {
    const sp: Record<Slot, [number, number]> = { agD: [101, 13], agE: [93, 18], anD: [57, 20], anE: [51, 30] };
    const novo: Partial<Record<Slot, SlotRascunho>> = {};
    SLOTS.forEach((k, j) => { const c = curvaSimulada(sp[k][0], sp[k][1], 999 + j * 31); novo[k] = { arquivo: `exemplo_${k}.xlsx (simulado)`, res: analisarCurva(c.t, c.f, crit.platoMin) }; });
    setSlots(novo);
    setRegiao('joelho');
    if (!braco) setBraco('36');
    toast.message('Curvas simuladas carregadas. Troque pelos arquivos reais antes de salvar.');
  };

  const avaliacaoRascunho = (): Avaliacao | null => {
    const out: Avaliacao['slots'] = {};
    for (const k of SLOTS) { const r = slots[k]?.res; if (r && 'metricas' in r) out[k] = { arquivo: slots[k]!.arquivo, metricas: r.metricas, curva: r.curva }; }
    if (!Object.keys(out).length) return null;
    const sujeito: Sujeito = { idade: num(suj.idade), sexo: suj.sexo, peso: num(suj.peso), dominante: suj.dominante, acometido: suj.acometido, modalidade: suj.modalidade || undefined };
    return { versao: 1, regiao, braco: num(braco), sujeito, slots: out };
  };

  const salvar = useMutation({
    mutationFn: async () => {
      if (!user || !id) throw new Error('Sem sessão');
      const av = avaliacaoRascunho();
      if (!av) throw new Error('Importe pelo menos um arquivo válido.');
      const ant = [...registros].reverse().find(r => r.data <= dataAv);
      const A = analisar(av, crit);
      const laudo = interpretar(av, A, crit, ant ? { data: ant.data, av: ant.av } : null).join('\n\n');
      const { data, error } = await (supabase as any).from('exames_presenciais').insert({
        paciente_id: id,
        terapeuta_id: user.id,
        tipo: 'dinamometria',
        data_exame: dataAv,
        dados: { resultado: laudo, observacoes: obs || undefined, analise: av },
        resumo: resumoCurtoAnalise(av, A, crit),
        visivel_paciente: visivel,
      }).select('id').single();
      if (error) throw error;
      return data?.id as string;
    },
    onSuccess: (novoId) => {
      toast.success('Avaliação salva nos exames presenciais do paciente');
      setSlots({}); setObs('');
      setVerId(novoId || null);
      setAba('resultado');
      qc.invalidateQueries({ queryKey: ['exames-presenciais', id] });
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao salvar'),
  });

  const excluir = useMutation({
    mutationFn: async (exId: string) => {
      const { error } = await (supabase as any).from('exames_presenciais').delete().eq('id', exId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Avaliação excluída'); setVerId(null); setConfirmaExcluir(false); qc.invalidateQueries({ queryKey: ['exames-presenciais', id] }); },
    onError: (e: any) => toast.error(e?.message || 'Erro ao excluir'),
  });

  // ───── Avaliação em foco ─────
  const idx = verId ? registros.findIndex(r => r.id === verId) : registros.length - 1;
  const atual = idx >= 0 ? registros[idx] : null;
  const anterior = idx > 0 ? registros[idx - 1] : null;
  const A: Analise | null = atual ? analisar(atual.av, crit) : null;
  const texto = atual && A ? interpretar(atual.av, A, crit, anterior ? { data: anterior.data, av: anterior.av } : null) : [];

  const copiar = async () => {
    if (!atual) return;
    const txt = `${nomePaciente} · Dinamometria ${REGIOES[atual.av.regiao]?.l || ''} · ${dataBR(atual.data)}\n\n${texto.join('\n\n')}`;
    try { await navigator.clipboard.writeText(txt); toast.success('Interpretação copiada'); } catch { toast.error('Não foi possível copiar neste aparelho'); }
  };

  const pdf = async () => {
    if (!atual || !A) return;
    setGerandoPdf(true);
    try {
      await gerarRelatorioDinamometria({
        paciente: nomePaciente,
        profissional: profile ? `${profile.nome} ${profile.sobrenome || ''}`.trim() + (profile.crefito ? ` · CREFITO ${profile.crefito}` : '') : undefined,
        data: atual.data, av: atual.av, A, c: crit,
        anterior: anterior ? { data: anterior.data, av: anterior.av } : null,
        historico: registros.slice(0, idx + 1).map(r => ({ data: r.data, score: analisar(r.av, crit).score })),
      });
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao gerar o PDF');
    } finally {
      setGerandoPdf(false);
    }
  };

  const salvarCriterios = () => {
    const novo: Criterios = { ...crit };
    for (const [k, v] of Object.entries(critForm)) {
      if (k === 'unidade') (novo as any)[k] = v;
      else { const n = num(v); if (n != null) (novo as any)[k] = n; }
    }
    setCrit(novo); setCritForm({});
    try { localStorage.setItem(CHAVE_CRITERIOS, JSON.stringify(novo)); } catch { /* sem armazenamento local: vale só nesta sessão */ }
    toast.success('Critérios salvos neste aparelho');
  };

  const podeSalvar = SLOTS.some(k => { const r = slots[k]?.res; return r && 'metricas' in r; });
  const temSimulado = Object.values(slots).some(s => s?.arquivo.includes('simulado'));

  // ───── Render ─────
  const cardSlot = (k: Slot) => {
    const s = slots[k];
    const lado = k.endsWith('D') ? 'D' : 'E';
    const r = s?.res;
    const ok = r && 'metricas' in r ? r : null;
    return (
      <div
        key={k}
        onDragOver={e => { e.preventDefault(); setSobre(k); }}
        onDragLeave={() => setSobre(null)}
        onDrop={e => { e.preventDefault(); setSobre(null); const f = e.dataTransfer.files?.[0]; if (f) carregarArquivo(k, f); }}
        className={cn('rounded-xl border-2 border-dashed p-3 space-y-2 min-w-0 transition-colors', sobre === k ? 'border-primary bg-primary/5' : 'border-border/60 bg-muted/20')}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="font-semibold text-sm"><Bolinha lado={lado} />{nomeSlot(regiao, k)}</span>
          <div className="flex gap-1.5">
            <Button asChild size="sm" variant="outline" className="relative overflow-hidden">
              <label className="cursor-pointer">
                {lendo === k ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <FileUp className="h-3.5 w-3.5 mr-1" />}
                {s ? 'Trocar' : 'Escolher arquivo'}
                <input type="file" accept=".xlsx,.csv,.txt" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => { const f = e.target.files?.[0]; if (f) carregarArquivo(k, f); e.target.value = ''; }} />
              </label>
            </Button>
            {s && <Button size="sm" variant="ghost" onClick={() => setSlots(p => { const n = { ...p }; delete n[k]; return n; })} title="Remover"><X className="h-4 w-4" /></Button>}
          </div>
        </div>
        {s ? <p className="text-xs font-mono text-muted-foreground break-all">{s.arquivo}</p> : <p className="text-xs text-muted-foreground">Arraste aqui o .xlsx ou .csv exportado pelo dinamômetro.</p>}
        {s?.insp && s.mapa && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {s.abas && s.abas.length > 1 && (
              <div className="space-y-0.5 col-span-2 sm:col-span-4">
                <Label className="text-[11px]">Aba</Label>
                <Select value={String(s.abaIdx)} onValueChange={v => trocarAba(k, Number(v))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{s.abas.map((a, i) => <SelectItem key={i} value={String(i)}>{a.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-0.5">
              <Label className="text-[11px]">Tempo</Label>
              <Select value={s.mapa.tempo == null ? 'none' : String(s.mapa.tempo)} onValueChange={v => ajustarMapa(k, { tempo: v === 'none' ? null : Number(v) })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem coluna (usar Hz)</SelectItem>
                  {s.insp.colunas.map(c => <SelectItem key={c.idx} value={String(c.idx)}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {s.mapa.tempo == null ? (
              <div className="space-y-0.5">
                <Label className="text-[11px]">Frequência (Hz)</Label>
                <Input className="h-8 text-xs" inputMode="numeric" defaultValue={s.mapa.hz} onBlur={e => ajustarMapa(k, { hz: num(e.target.value) || 100 })} />
              </div>
            ) : (
              <div className="space-y-0.5">
                <Label className="text-[11px]">Unid. do tempo</Label>
                <Select value={s.mapa.unidadeTempo} onValueChange={v => ajustarMapa(k, { unidadeTempo: v as Mapa['unidadeTempo'] })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="auto">Automático</SelectItem><SelectItem value="s">segundos</SelectItem><SelectItem value="ms">milissegundos</SelectItem></SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-0.5">
              <Label className="text-[11px]">Força</Label>
              <Select value={String(s.mapa.forca)} onValueChange={v => ajustarMapa(k, { forca: Number(v) })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{s.insp.colunas.map(c => <SelectItem key={c.idx} value={String(c.idx)}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-0.5">
              <Label className="text-[11px]">Unid. da força</Label>
              <Select value={s.mapa.unidade} onValueChange={v => ajustarMapa(k, { unidade: v as Unidade })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{(['kgf', 'N', 'lbf'] as Unidade[]).map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {!s.insp.unidadeCerta && <p className="col-span-2 sm:col-span-4 text-[11px] text-amber-700 dark:text-amber-400">O arquivo não diz a unidade da força: confirme acima.</p>}
          </div>
        )}
        {r && 'erro' in r && <p className="text-xs rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 px-2 py-1.5">{r.erro} Ajuste as colunas acima.</p>}
        {ok && (
          <>
            <p className="text-xs text-muted-foreground">
              Pico <b className="font-mono text-foreground">{fmt(disp(ok.metricas.pico), 1)} {u}</b> · {ok.metricas.reps.length} rep. · {ok.metricas.hz} Hz · {fmt(ok.metricas.duracao, 1)} s
              {ok.metricas.fadiga == null && ' · fadiga não calculada (contração curta)'}
            </p>
            <div className="h-16">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ok.curva.t.map((t, i) => ({ t, f: ok.curva.f[i] }))} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                  <Line type="linear" dataKey="f" stroke={COR[lado]} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    );
  };

  const graficoCurva = (g: 'ag' | 'an', titulo: string) => {
    if (!atual) return null;
    const dados = linhasCurva(atual.av, g, u);
    if (!dados.length) return null;
    return (
      <Card className="p-4 space-y-2 min-w-0">
        <p className="font-semibold text-sm">Curva · {titulo}</p>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dados} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
              <CartesianGrid strokeDasharray="0" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tickFormatter={v => `${fmt(Math.abs(v) < 1e-9 ? 0 : v, 0)} s`} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => fmt(v, 0)} width={44} />
              <Tooltip formatter={(v: any, n: any) => [`${fmt(Number(v), 1)} ${u}`, n === 'D' ? 'Direito' : 'Esquerdo']} labelFormatter={v => `${fmt(Number(v), 2)} s após o início`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend formatter={v => (v === 'D' ? 'Direito' : 'Esquerdo')} wrapperStyle={{ fontSize: 12 }} />
              <Line type="linear" dataKey="D" stroke={COR.D} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
              <Line type="linear" dataKey="E" stroke={COR.E} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px] text-muted-foreground">Curvas alinhadas no início da contração ({u}).</p>
      </Card>
    );
  };

  const evolucao = useMemo(() => registros.map(r => {
    const a = analisar(r.av, crit);
    const p = (k: Slot) => { const v = r.av.slots[k]?.metricas.pico; return v == null ? null : +(v / UF[crit.unidade]).toFixed(1); };
    return { data: dataBR(r.data).slice(0, 5), dataFull: r.data, score: a.score, agD: p('agD'), agE: p('agE'), anD: p('anD'), anE: p('anE'), lsiAg: a.lsiAg?.v ?? null, lsiAn: a.lsiAn?.v ?? null, regiao: r.av.regiao };
  }), [registros, crit]);

  const camposCrit: [keyof Criterios, string, string?][] = [
    ['lsiPleno', 'Simetria plena (%)', 'Grindem 2016: ≥ 90%'], ['lsiZero', 'Simetria zero (%)'],
    ['razaoTol', 'Razão: desvio pleno (%)', 'Desvio da referência'], ['razaoZero', 'Razão: desvio zero (%)'],
    ['fadPleno', 'Fadiga plena (%)', 'Pior índice entre os músculos'], ['fadZero', 'Fadiga zero (%)'],
    ['oscPleno', 'Oscilação plena (%)'], ['oscZero', 'Oscilação zero (%)'],
    ['mudanca', 'Mudança real (%)', 'Troque pelo erro de medida do serviço'], ['platoMin', 'Platô mínimo p/ fadiga (s)'],
  ];

  return (
    <AppLayout>
      <div className="container max-w-6xl py-6 space-y-5">
        <PageHeader
          title="Análise de dinamometria"
          subtitle={nomePaciente}
          eyebrow="Exames presenciais"
          icon={<Dumbbell className="icon-md" />}
          back={id ? `/pacientes/${id}` : true}
        />

        <Tabs value={aba} onValueChange={setAba}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="nova">Nova avaliação</TabsTrigger>
            <TabsTrigger value="resultado">Resultado</TabsTrigger>
            <TabsTrigger value="evolucao">Evolução</TabsTrigger>
            <TabsTrigger value="criterios">Critérios</TabsTrigger>
          </TabsList>

          {/* ─── Nova avaliação ─── */}
          <TabsContent value="nova" className="space-y-4 mt-4">
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="font-semibold">Dados da avaliação</p>
                <Button size="sm" variant="outline" onClick={usarExemplo}><FlaskConical className="h-3.5 w-3.5 mr-1" />Testar com curvas simuladas</Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1"><Label className="text-xs">Data</Label><Input type="date" value={dataAv} onChange={e => setDataAv(e.target.value)} /></div>
                <div className="space-y-1 col-span-2 md:col-span-1">
                  <Label className="text-xs">Articulação</Label>
                  <Select value={regiao} onValueChange={setRegiao}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(REGIOES).map(([k, r]) => <SelectItem key={k} value={k}>{r.l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {R.torque && <div className="space-y-1"><Label className="text-xs">Braço de alavanca (cm)</Label><Input inputMode="decimal" value={braco} onChange={e => setBraco(e.target.value)} placeholder="Para a norma" /></div>}
                <div className="space-y-1"><Label className="text-xs">Idade (anos)</Label><Input inputMode="numeric" value={suj.idade} onChange={e => setSuj(s => ({ ...s, idade: e.target.value }))} /></div>
                <div className="space-y-1">
                  <Label className="text-xs">Sexo</Label>
                  <Select value={suj.sexo} onValueChange={v => setSuj(s => ({ ...s, sexo: v as 'M' | 'F' }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="M">Masculino</SelectItem><SelectItem value="F">Feminino</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">Peso (kg){pesoBio ? ' · da bioimpedância' : ''}</Label><Input inputMode="decimal" value={suj.peso} onChange={e => setSuj(s => ({ ...s, peso: e.target.value }))} /></div>
                <div className="space-y-1">
                  <Label className="text-xs">Lado dominante</Label>
                  <Select value={suj.dominante} onValueChange={v => setSuj(s => ({ ...s, dominante: v as Lado }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="D">Direito</SelectItem><SelectItem value="E">Esquerdo</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Lado acometido</Label>
                  <Select value={suj.acometido} onValueChange={v => setSuj(s => ({ ...s, acometido: v as Lado | 'N' }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="N">Nenhum</SelectItem><SelectItem value="D">Direito</SelectItem><SelectItem value="E">Esquerdo</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 col-span-2"><Label className="text-xs">Modalidade / atividade</Label><Input value={suj.modalidade} onChange={e => setSuj(s => ({ ...s, modalidade: e.target.value }))} placeholder="Ex.: futebol, corrida" /></div>
              </div>
              <p className="text-xs text-muted-foreground">Um arquivo por músculo e lado. O app encontra as colunas de tempo e força, separa as repetições e usa a melhor. Para medir fadiga, a contração precisa ficar alta por pelo menos {crit.platoMin} s.</p>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{SLOTS.map(cardSlot)}</div>

            <Card className="p-4 space-y-3">
              <div className="space-y-1"><Label className="text-xs">Observações</Label><Textarea rows={3} value={obs} onChange={e => setObs(e.target.value)} placeholder="Posição, dor durante o teste, protocolo…" /></div>
              <div className="flex items-center gap-2"><Switch id="din-visivel" checked={visivel} onCheckedChange={setVisivel} /><Label htmlFor="din-visivel" className="text-sm">Mostrar o laudo no portal do cliente</Label></div>
              <Button disabled={!podeSalvar || temSimulado || salvar.isPending} onClick={() => salvar.mutate()} className="gap-1.5">
                {salvar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Analisar e salvar
              </Button>
              {temSimulado && <p className="text-xs text-amber-700 dark:text-amber-400">Curvas simuladas servem só para conhecer a tela e não são salvas. Troque pelos arquivos reais para salvar.</p>}
            </Card>
          </TabsContent>

          {/* ─── Resultado ─── */}
          <TabsContent value="resultado" className="space-y-4 mt-4">
            {isLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : !atual || !A ? (
              <Card className="p-8 text-center space-y-3">
                <p className="font-semibold">Nenhuma avaliação de dinamometria ainda.</p>
                <p className="text-sm text-muted-foreground">Importe os arquivos do dinamômetro na aba Nova avaliação.</p>
                <Button onClick={() => setAba('nova')}>Nova avaliação</Button>
              </Card>
            ) : (
              <>
                <Card className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{A.R.l} · {dataBR(atual.data)}{registros.length > 1 && ` · avaliação ${idx + 1} de ${registros.length}`}</p>
                      <p className="text-lg font-semibold">{nomePaciente}</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {registros.length > 1 && (
                        <Select value={atual.id} onValueChange={v => { setVerId(v); setConfirmaExcluir(false); }}>
                          <SelectTrigger className="h-9 w-auto min-w-[180px]"><SelectValue /></SelectTrigger>
                          <SelectContent>{[...registros].reverse().map(r => <SelectItem key={r.id} value={r.id}>{dataBR(r.data)} · {REGIOES[r.av.regiao]?.l}</SelectItem>)}</SelectContent>
                        </Select>
                      )}
                      <Button size="sm" variant="outline" onClick={copiar}><Copy className="h-3.5 w-3.5 mr-1" />Copiar interpretação</Button>
                      <Button size="sm" onClick={pdf} disabled={gerandoPdf}>{gerandoPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <FileDown className="h-3.5 w-3.5 mr-1" />}Relatório PDF</Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Score de força</p>
                      <div className="flex items-baseline gap-2"><span className="text-7xl font-extrabold tabular-nums leading-none">{A.score ?? '—'}</span><span className="text-xl text-muted-foreground font-semibold">/100</span></div>
                      <div className="flex items-center gap-2"><span className="text-base font-bold uppercase tracking-wide">{A.categoria?.[1] || 'Sem dados'}</span></div>
                      <div className="relative pt-2">
                        <div className="grid h-2.5 gap-0.5" style={{ gridTemplateColumns: '59fr 15fr 15fr 11fr' }}>
                          <i className="rounded-sm bg-red-400/40" /><i className="rounded-sm bg-amber-400/50" /><i className="rounded-sm bg-emerald-400/30" /><i className="rounded-sm bg-emerald-500/60" />
                        </div>
                        {A.score != null && <span className="absolute top-0.5 h-5 w-[3px] rounded bg-foreground -translate-x-1/2" style={{ left: `${A.score}%` }} />}
                        <div className="grid text-[10px] text-muted-foreground mt-1" style={{ gridTemplateColumns: '59fr 15fr 15fr 11fr' }}><span>0–59 Crítico</span><span>60–74 Regular</span><span>75–89 Bom</span><span>90+</span></div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {([['Simetria bilateral', A.comps.sim], ['Agonista × antagonista', A.comps.raz], ['Resistência à fadiga', A.comps.fad], ['Estabilidade da curva', A.comps.est]] as [string, number | null][]).map(([l, v]) => (
                        <div key={l} className="space-y-1">
                          <div className="flex justify-between text-sm"><span className="font-medium">{l}</span><span className="font-mono text-muted-foreground">{v == null ? 'n/d' : `${fmt(v, 0)} / 25`}</span></div>
                          <div className="h-2 rounded bg-muted overflow-hidden"><div className="h-full rounded bg-foreground" style={{ width: `${v == null ? 0 : (v / 25) * 100}%` }} /></div>
                        </div>
                      ))}
                      <p className="text-[11px] text-muted-foreground">Componentes sem dados ficam fora do cálculo e o score é reescalonado para 100.</p>
                    </div>
                  </div>
                </Card>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {([['ag', A.R.ag, A.lsiAg], ['an', A.R.an, A.lsiAn]] as const).map(([g, nome, L]) => (
                    <Card key={g} className="p-4 space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Simetria · {nome}</p>
                      <div className="flex items-center justify-between gap-2"><span className="text-3xl font-extrabold tabular-nums">{L ? `${fmt(L.v, 0)}%` : '—'}</span><Pilula st={stLSI(L?.v)} /></div>
                      <div className="text-sm space-y-0.5">
                        {(['D', 'E'] as Lado[]).map(l => <div key={l} className="flex justify-between"><span className="text-muted-foreground"><Bolinha lado={l} />{l === 'D' ? 'Direito' : 'Esquerdo'}</span><span className="font-mono">{fmt(disp(atual.av.slots[`${g}${l}` as Slot]?.metricas.pico), 1)} {u}</span></div>)}
                      </div>
                    </Card>
                  ))}
                  {(['D', 'E'] as Lado[]).map(l => {
                    const x = A.razoes[l];
                    return (
                      <Card key={l} className="p-4 space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{A.R.razaoL.split(' (')[0]} · {l === 'D' ? 'Direito' : 'Esquerdo'}</p>
                        <div className="flex items-center justify-between gap-2"><span className="text-3xl font-extrabold tabular-nums">{x ? `${fmt(x.r * 100, 0)}%` : '—'}</span><Pilula st={stDesvio(x?.desvio, crit)} /></div>
                        <div className="text-sm flex justify-between"><span className="text-muted-foreground">Referência</span><span className="font-mono">{x?.refTxt || '—'}</span></div>
                      </Card>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {graficoCurva('ag', A.R.ag)}
                  {graficoCurva('an', A.R.an)}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
                  <Card className="p-4 space-y-3">
                    <p className="font-semibold text-sm">Índice de fadiga</p>
                    {SLOTS.filter(k => A.slots[k]).map(k => {
                      const f = A.slots[k]!.fadiga;
                      const escala = Math.max(crit.fadZero, 50);
                      return (
                        <div key={k} className="grid grid-cols-[130px_1fr_48px] gap-2 items-center text-sm">
                          <span className="truncate">{nomeSlot(atual.av.regiao, k)}</span>
                          <span className="relative h-3.5 rounded bg-muted border border-border/50">
                            <b className="absolute inset-y-0 left-0 rounded" style={{ width: `${f == null ? 0 : clamp((f / escala) * 100, 0, 100)}%`, background: COR[k.endsWith('D') ? 'D' : 'E'] }} />
                            <i className="absolute -top-1 -bottom-1 w-0.5 bg-muted-foreground" style={{ left: `${(crit.fadPleno / escala) * 100}%` }} title={`Limite ${crit.fadPleno}%`} />
                          </span>
                          <span className="font-mono text-right">{f == null ? 'n/d' : `${fmt(f, 0)}%`}</span>
                        </div>
                      );
                    })}
                    <p className="text-[11px] text-muted-foreground">(Força máxima em 1 s − força no último segundo) ÷ força máxima. A linha marca o limite de {crit.fadPleno}%.</p>
                  </Card>
                  <Card className="p-4 space-y-2">
                    <p className="font-semibold text-sm">Interpretação automática</p>
                    {texto.map((p, i) => <p key={i} className="text-sm leading-relaxed">{p}</p>)}
                  </Card>
                </div>

                <Card className="p-4 space-y-2">
                  <p className="font-semibold text-sm">Métricas da curva</p>
                  <div className="overflow-x-auto rounded-lg border border-border/50">
                    <table className="w-full text-sm min-w-[860px]">
                      <thead className="bg-muted/50 text-xs text-muted-foreground">
                        <tr>
                          {['Músculo', `Pico (${u})`, 'N/kg', 'Norma (idade e sexo)', 'Tempo até pico (s)', `RFD 0–100 ms (${u}/s)`, `RFD 0–200 ms (${u}/s)`, `Impulso (${u}·s)`, 'Fadiga', 'Oscilação', 'Rep.'].map(h => <th key={h} className="px-2.5 py-2 text-left font-semibold whitespace-nowrap">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {SLOTS.filter(k => A.slots[k]).map(k => {
                          const s = A.slots[k]!;
                          return (
                            <tr key={k} className="border-t border-border/40">
                              <td className="px-2.5 py-2 whitespace-nowrap"><Bolinha lado={k.endsWith('D') ? 'D' : 'E'} />{nomeSlot(atual.av.regiao, k)}</td>
                              <td className="px-2.5 py-2 font-mono">{fmt(disp(s.pico), 1)}</td>
                              <td className="px-2.5 py-2 font-mono">{s.nkg == null ? '—' : fmt(s.nkg, 1)}</td>
                              <td className="px-2.5 py-2">{s.precisaBraco ? <span className="text-xs text-muted-foreground">informe o braço de alavanca</span> : s.z == null ? '—' : <span className="flex items-center gap-1.5 whitespace-nowrap"><span className="font-mono">{fmt(s.pctNorma, 0)}% · z {fmt(s.z, 1)}</span><Pilula st={stZ(s.z)} /></span>}</td>
                              <td className="px-2.5 py-2 font-mono">{fmt(s.ttp, 2)}</td>
                              <td className="px-2.5 py-2 font-mono">{s.rfd100 == null ? '—' : fmt(disp(s.rfd100), 0)}</td>
                              <td className="px-2.5 py-2 font-mono">{s.rfd200 == null ? '—' : fmt(disp(s.rfd200), 0)}</td>
                              <td className="px-2.5 py-2 font-mono">{fmt(disp(s.impulso), 0)}</td>
                              <td className="px-2.5 py-2">{s.fadiga == null ? '—' : <span className="flex items-center gap-1.5 whitespace-nowrap"><span className="font-mono">{fmt(s.fadiga, 0)}%</span><Pilula st={stFadiga(s.fadiga, crit)} /></span>}</td>
                              <td className="px-2.5 py-2">{s.oscilacao == null ? '—' : <span className="flex items-center gap-1.5 whitespace-nowrap"><span className="font-mono">{fmt(s.oscilacao, 1)}%</span><Pilula st={stOsc(s.oscilacao, crit)} /></span>}</td>
                              <td className="px-2.5 py-2 font-mono">{s.reps.length}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Pico = maior média móvel de 50 ms, descontada a linha de base. Oscilação = desvio em torno da tendência do platô, em % da média. Norma: McKay et al., 2017, membro dominante{A.R.torque ? '; joelho em torque (força × braço de alavanca), medido com dinamômetro fixo' : ''}.</p>
                </Card>

                {atual.obs && <Card className="p-4"><p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Observações</p><p className="text-sm mt-1">{atual.obs}</p></Card>}

                <div className="flex gap-2 items-center flex-wrap">
                  {confirmaExcluir ? (
                    <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm">
                      Excluir a avaliação de {dataBR(atual.data)}? Não dá para desfazer.
                      <Button size="sm" variant="destructive" disabled={excluir.isPending} onClick={() => excluir.mutate(atual.id)}>Excluir</Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmaExcluir(false)}>Cancelar</Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmaExcluir(true)}><Trash2 className="h-3.5 w-3.5 mr-1" />Excluir esta avaliação</Button>
                  )}
                </div>
              </>
            )}
          </TabsContent>

          {/* ─── Evolução ─── */}
          <TabsContent value="evolucao" className="space-y-4 mt-4">
            {evolucao.length < 2 ? (
              <Card className="p-8 text-center text-sm text-muted-foreground">A evolução aparece a partir da segunda avaliação.</Card>
            ) : (
              <>
                <Card className="p-4 space-y-2">
                  <p className="font-semibold text-sm">Score de força</p>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={evolucao} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
                        <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="data" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: any) => [v, 'Score']} />
                        <ReferenceLine y={90} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" label={{ value: 'Excelente', position: 'insideTopLeft', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                        <ReferenceLine y={75} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" label={{ value: 'Bom', position: 'insideTopLeft', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                        <Line dataKey="score" stroke={COR.D} strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {(['ag', 'an'] as const).map(g => (
                    <Card key={g} className="p-4 space-y-2 min-w-0">
                      <p className="font-semibold text-sm">Pico · {g === 'ag' ? R.ag : R.an} ({u})</p>
                      <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={evolucao} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
                            <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
                            <XAxis dataKey="data" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: any, n: any) => [`${fmt(Number(v), 1)} ${u}`, String(n).endsWith('D') ? 'Direito' : 'Esquerdo']} />
                            <Legend formatter={v => (String(v).endsWith('D') ? 'Direito' : 'Esquerdo')} wrapperStyle={{ fontSize: 12 }} />
                            <Line dataKey={`${g}D`} stroke={COR.D} strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} connectNulls />
                            <Line dataKey={`${g}E`} stroke={COR.E} strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} connectNulls />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>
                  ))}
                </div>
                <Card className="p-4 space-y-2">
                  <p className="font-semibold text-sm">Histórico</p>
                  <div className="overflow-x-auto rounded-lg border border-border/50">
                    <table className="w-full text-sm min-w-[720px]">
                      <thead className="bg-muted/50 text-xs text-muted-foreground">
                        <tr>{['Data', 'Articulação', 'Score', ...SLOTS.map(k => `${nomeSlot(regiao, k)} (${u})`), 'Simetria ag.', 'Simetria ant.'].map(h => <th key={h} className="px-2.5 py-2 text-left font-semibold whitespace-nowrap">{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {[...evolucao].reverse().map((e, i, arr) => {
                          const prev = arr[i + 1];
                          return (
                            <tr key={e.dataFull + i} className="border-t border-border/40">
                              <td className="px-2.5 py-2 whitespace-nowrap">{dataBR(e.dataFull)}</td>
                              <td className="px-2.5 py-2 whitespace-nowrap">{REGIOES[e.regiao]?.l}</td>
                              <td className="px-2.5 py-2 font-mono font-semibold">{e.score ?? '—'}</td>
                              {SLOTS.map(k => {
                                const v = e[k], p = prev?.[k];
                                const d = v != null && p ? ((v - p) / p) * 100 : null;
                                return <td key={k} className="px-2.5 py-2 font-mono whitespace-nowrap">{fmt(v, 1)}{d != null && <span className={cn('ml-1 text-[11px]', Math.abs(d) >= crit.mudanca ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{d >= 0 ? '+' : ''}{fmt(d, 0)}%</span>}</td>;
                              })}
                              <td className="px-2.5 py-2 font-mono">{e.lsiAg == null ? '—' : `${fmt(e.lsiAg, 0)}%`}</td>
                              <td className="px-2.5 py-2 font-mono">{e.lsiAn == null ? '—' : `${fmt(e.lsiAn, 0)}%`}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Variações em negrito passaram de {crit.mudanca}%, o limite de mudança real definido nos critérios.</p>
                </Card>
              </>
            )}
          </TabsContent>

          {/* ─── Critérios ─── */}
          <TabsContent value="criterios" className="space-y-4 mt-4">
            <Card className="p-4 space-y-3">
              <p className="font-semibold">Critérios do score de força</p>
              <p className="text-sm text-muted-foreground max-w-3xl">O score soma quatro componentes de 25 pontos. Cada um recebe 25 pontos ao atingir o valor "pleno" e 0 ao chegar no valor "zero", com pontuação proporcional entre eles. É um índice interno do serviço: só a simetria ≥ 90% e as referências das razões vêm diretamente da literatura. Os critérios ficam salvos neste aparelho.</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Unidade de exibição</Label>
                  <Select value={critForm.unidade ?? crit.unidade} onValueChange={v => setCritForm(f => ({ ...f, unidade: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{(['kgf', 'N', 'lbf'] as Unidade[]).map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {camposCrit.map(([k, l, dica]) => (
                  <div key={k} className="space-y-1">
                    <Label className="text-xs">{l}</Label>
                    <Input inputMode="decimal" value={critForm[k] ?? String(crit[k])} onChange={e => setCritForm(f => ({ ...f, [k]: e.target.value }))} />
                    {dica && <p className="text-[10px] text-muted-foreground">{dica}</p>}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button onClick={salvarCriterios}>Salvar critérios</Button>
                <Button variant="outline" onClick={() => { setCrit(CRITERIOS_PADRAO); setCritForm({}); try { localStorage.removeItem(CHAVE_CRITERIOS); } catch { /* sem armazenamento local */ } toast.success('Critérios restaurados'); }}>Restaurar padrão</Button>
              </div>
            </Card>
            <Card className="p-4 space-y-2 text-sm">
              <p className="font-semibold">Como cada número é calculado</p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground max-w-4xl">
                <li><b className="text-foreground">Pico:</b> maior média móvel de 50 ms da melhor repetição, descontada a linha de base (5º percentil do registro).</li>
                <li><b className="text-foreground">Início da contração:</b> primeiro ponto acima de 2% do pico ou de 3 desvios padrão da linha de base. Tempo até o pico e RFD contam a partir dele.</li>
                <li><b className="text-foreground">RFD 0–100 e 0–200 ms:</b> ganho de força nesses intervalos ÷ tempo. Só é calculada com amostragem de pelo menos 50 Hz.</li>
                <li><b className="text-foreground">Índice de fadiga:</b> (maior média de 1 s − média do último segundo do platô) ÷ maior média × 100. Exige platô acima de 50% do pico por {crit.platoMin} s ou mais.</li>
                <li><b className="text-foreground">Oscilação:</b> desvio dos valores em torno da reta de tendência do platô ÷ média × 100. Separa instabilidade da queda por fadiga.</li>
                <li><b className="text-foreground">Simetria:</b> lado acometido ÷ lado sadio; sem lado acometido, menor ÷ maior. ≥ 90% é o critério de retorno ao esporte (Grindem et al., 2016).</li>
                <li><b className="text-foreground">Razão agonista × antagonista:</b> comparada à razão das médias de McKay et al. (2017) para idade e sexo; no quadril, adução/abdução ≥ 0,80 (Tyler et al., 2001).</li>
              </ul>
              <p className="text-xs text-muted-foreground pt-1">
                Referências: <a className="underline" href="https://doi.org/10.1212/WNL.0000000000003466" target="_blank" rel="noopener noreferrer">McKay 2017</a> · <a className="underline" href="https://doi.org/10.1136/bjsports-2016-096031" target="_blank" rel="noopener noreferrer">Grindem 2016</a> · <a className="underline" href="https://doi.org/10.1177/03635465010290020301" target="_blank" rel="noopener noreferrer">Tyler 2001</a>
              </p>
            </Card>
          </TabsContent>
        </Tabs>
        {id && <p className="text-xs text-muted-foreground">As avaliações ficam nos <Link className="underline" to={`/pacientes/${id}`}>exames presenciais do paciente</Link> e o resumo entra nos planos de IA.</p>}
      </div>
    </AppLayout>
  );
}
