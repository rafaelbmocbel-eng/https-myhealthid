import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';
import { Dumbbell, FileUp, Loader2, Trash2, Copy, Save, FlaskConical, X, Bluetooth, Eye } from 'lucide-react';
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
import CapturaCelulaDialog, { type CapturaCelula } from '@/components/dinamometria/CapturaCelulaDialog';
import ExecucaoProtocoloDialog, { type ConfigProtocolo, type Etapa } from '@/components/dinamometria/ExecucaoProtocoloDialog';
import BancadaTeste, { type EtapaBancada } from '@/components/dinamometria/BancadaTeste';
import PreviaPdfDialog from '@/components/dinamometria/PreviaPdfDialog';
import { celula, type StatusCelula } from '@/lib/dinamometria/celulaBle';
import {
  type Avaliacao, type Analise, type Criterios, type Inspecao, type Mapa, type Movimento, type ResultadoCurva, type Sessao, type Slot, type Status, type Unidade, type Lado, type Sujeito,
  SLOTS, UF, REGIOES, CRITERIOS_PADRAO, num, fmt, nomeSlot, dataBR, inspecionar, extrair, analisarCurva, analisar, interpretar,
  resumoCurtoAnalise, stLSI, stDesvio, simetriaSlot, SLOTS_POR_LADO, falhaPlato, stFadiga, stOsc, stZ, curvaSimulada, clamp, movimentosDaAnalise, metricasDePico,
} from '@/lib/dinamometria/analise';
import { gerarRelatorioDinamometria, gerarRelatorioCliente, gruposBarras, type GrupoBarras, type ItemRelatorio } from '@/lib/dinamometria/relatorio';
import { mapaMuscularSVG, itensAvatar, COR_STATUS } from '@/lib/dinamometria/anatomia';
import { achadosDor, AVISO_DOR } from '@/lib/dinamometria/dor';
import { REFERENCIAS, REF, linkPubMed } from '@/lib/dinamometria/referencias';

const COR: Record<Lado, string> = { D: '#2A78D6', E: '#EB6834' };
const CHAVE_CRITERIOS = 'dinamometria_criterios_v2';

interface SlotRascunho { arquivo: string; abas?: Aba[]; abaIdx?: number; insp?: Inspecao | null; mapa?: Mapa | null; res: ResultadoCurva | null }
interface Registro { id: string; data: string; movs: Avaliacao[]; obs: string }
type Modo = 'curva' | 'pico';
const chave = (regiao: string, k: Slot) => `${regiao}:${k}`;

function lerCriterios(): Criterios {
  try {
    const s = localStorage.getItem(CHAVE_CRITERIOS);
    if (s) return { ...CRITERIOS_PADRAO, ...JSON.parse(s) };
    // A v1 tinha faixas de pontuação do score; só unidade, mudança e platô continuam valendo.
    const v1 = localStorage.getItem('dinamometria_criterios_v1');
    if (!v1) return CRITERIOS_PADRAO;
    const { unidade, mudanca, platoMin } = JSON.parse(v1);
    return { ...CRITERIOS_PADRAO, ...(unidade ? { unidade } : {}), ...(mudanca != null ? { mudanca } : {}), ...(platoMin != null ? { platoMin } : {}) };
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

const TINTA: Record<string, string> = {
  ok: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  warn: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  bad: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  info: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

// Valor com fundo verde, amarelo ou vermelho conforme a classificação.
function Sinal({ st, children }: { st: Status; children: ReactNode }) {
  if (!st) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-semibold whitespace-nowrap', TINTA[st[0]])} title={st[1]}>
      <i className="h-2 w-2 rounded-full" style={{ background: COR_STATUS[st[0]] }} />{children}
    </span>
  );
}

// Barras D × E com a faixa normal para idade e sexo (média ± 1 DP) ao fundo.
function Barras({ grupos, u }: { grupos: GrupoBarras[]; u: string }) {
  const max = Math.max(1, ...grupos.flatMap(g => [g.D, g.E, g.ref != null && g.min != null ? 2 * g.ref - g.min : null]).filter((v): v is number => v != null)) * 1.12;
  const pct = (v: number) => `${(v / max) * 100}%`;
  return (
    <div className="space-y-4">
      {grupos.map(g => (
        <div key={g.nome} className="space-y-1">
          <p className="text-sm font-semibold">{g.nome}</p>
          <div className="relative space-y-1.5 py-1">
            {g.ref != null && g.min != null && (
              <>
                <span className="absolute inset-y-0 rounded bg-emerald-500/15" style={{ left: `calc(1.25rem + (100% - 1.25rem) * ${g.min / max})`, width: `calc((100% - 1.25rem) * ${(2 * (g.ref - g.min)) / max})` }} />
                <span className="absolute inset-y-0 border-l-2 border-dashed border-emerald-600" style={{ left: `calc(1.25rem + (100% - 1.25rem) * ${g.ref / max})` }} />
              </>
            )}
            {(['D', 'E'] as Lado[]).map(l => {
              const v = g[l];
              return (
                <div key={l} className="relative flex items-center gap-1.5">
                  <span className="w-3.5 text-xs font-bold text-muted-foreground">{l}</span>
                  <div className="flex-1 flex items-center gap-1.5">
                    {v != null && <span className="h-5 rounded" style={{ width: pct(v), background: COR[l] }} />}
                    <span className="text-xs font-mono font-semibold whitespace-nowrap">{v == null ? '—' : `${fmt(v, 1)} ${u}`}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: COR.D }} />Direito</span>
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: COR.E }} />Esquerdo</span>
        {grupos.some(g => g.ref != null) ? <span className="flex items-center gap-1"><i className="h-2.5 w-3.5 rounded-sm bg-emerald-500/25" />Faixa normal para idade e sexo (tracejado = média)</span> : <span>Sem faixa normal: informe idade e sexo{grupos.length ? ' (no joelho, também o braço de alavanca)' : ''}.</span>}
      </div>
    </div>
  );
}

function Bolinha({ lado }: { lado: Lado }) {
  return <span className="inline-block h-2.5 w-2.5 rounded-sm mr-1.5 align-middle" style={{ background: COR[lado] }} />;
}

// Une as curvas D e E numa grade de tempo comum para o gráfico e o tooltip.
// Curva de falha do platô de D e E no mesmo eixo (% do pico × s após o pico).
function linhasFalha(av: Avaliacao, g: 'ag' | 'an') {
  const d = falhaPlato(av.slots[`${g}D` as Slot]?.curva), e = falhaPlato(av.slots[`${g}E` as Slot]?.curva);
  if (!d && !e) return null;
  const interp = (fp: typeof d, x: number) => {
    if (!fp || !fp.pts.length || x > fp.pts[fp.pts.length - 1][0]) return null;
    let lo = 0, hi = fp.pts.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (fp.pts[m][0] <= x) lo = m; else hi = m; }
    const [x0, y0] = fp.pts[lo], [x1, y1] = fp.pts[hi];
    return x1 === x0 ? y0 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  };
  const tMax = Math.max(d?.duracao || 0, e?.duracao || 0);
  const passo = Math.max(0.02, tMax / 300);
  const dados: { t: number; D: number | null; E: number | null }[] = [];
  for (let x = 0; x <= tMax + 1e-9; x += passo) dados.push({ t: +x.toFixed(3), D: interp(d, x), E: interp(e, x) });
  return { dados, d, e };
}

function linhasCurva(av: Avaliacao, g: 'ag' | 'an', u: Unidade) {
  const d = av.slots[`${g}D` as Slot]?.curva || undefined, e = av.slots[`${g}E` as Slot]?.curva || undefined;
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

// Suba quando mudar o texto do laudo/resumo: exames antigos são regravados ao abrir.
const VERSAO_LAUDO = 2;

export default function Dinamometria() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const pesoParam = searchParams.get('peso');
  const vindoDoTeste = searchParams.get('modo') === 'teste';
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [aba, setAba] = useState('resultado');
  const [crit, setCrit] = useState<Criterios>(lerCriterios);
  const [critForm, setCritForm] = useState<Record<string, string>>({});
  // ?exame=<id> abre direto o resultado daquele exame (vindo do histórico).
  const [verId, setVerId] = useState<string | null>(searchParams.get('exame'));
  const [regVer, setRegVer] = useState<string | null>(null);
  const [regEvo, setRegEvo] = useState<string | null>(null);
  const [confirmaExcluir, setConfirmaExcluir] = useState(false);
  const [gerando, setGerando] = useState<'tecnico' | 'cliente' | null>(null);
  const [detalhes, setDetalhes] = useState(false);

  const [dataAv, setDataAv] = useState(() => new Date().toISOString().slice(0, 10));
  const [regioes, setRegioes] = useState<string[]>(['joelho']);
  const [bracos, setBracos] = useState<Record<string, string>>({});
  const [modos, setModos] = useState<Record<string, Modo>>({});
  const [unidadePico, setUnidadePico] = useState<Unidade>('kgf');
  const [picos, setPicos] = useState<Record<string, string[]>>({});
  const [suj, setSuj] = useState({ idade: '', sexo: 'M' as 'M' | 'F', peso: '', dominante: 'D' as Lado, acometido: 'N' as Lado | 'N', modalidade: '' });
  const [obs, setObs] = useState('');
  const [visivel, setVisivel] = useState(true);
  const [slots, setSlots] = useState<Record<string, SlotRascunho>>({});
  const [lendo, setLendo] = useState<string | null>(null);
  const [capturaCk, setCapturaCk] = useState<string | null>(null);
  const [statusCelula, setStatusCelula] = useState<StatusCelula>(celula.status);
  useEffect(() => celula.onStatus(setStatusCelula), []);
  const [protoAberto, setProtoAberto] = useState(false);
  const [proto, setProto] = useState(() => {
    const padrao = { tempoForca: 5, repeticoes: 3, descanso: 30, preparo: 3, lado: 'D' as Lado, grupo: 'ag' as 'ag' | 'an', ordem: 'grupo' as 'grupo' | 'lado' };
    try { return { ...padrao, ...JSON.parse(localStorage.getItem('mh.din.protocolo') || '{}') }; } catch { return padrao; }
  });
  useEffect(() => { try { localStorage.setItem('mh.din.protocolo', JSON.stringify(proto)); } catch { /* sem armazenamento — só não lembra */ } }, [proto]);
  const [sobre, setSobre] = useState<string | null>(null);

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
    () => exames.filter(e => e.tipo === 'dinamometria').map(e => ({ id: e.id, data: e.data_exame, movs: movimentosDaAnalise(e.dados?.analise), obs: e.dados?.observacoes || '' })).filter(r => r.movs.length),
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
    const ultReg = registros[registros.length - 1];
    const ult = ultReg?.movs[0]?.sujeito;
    const sx = String(paciente.sexo || paciente.genero || '').toLowerCase();
    setSuj({
      idade: String(idadeDe(paciente.data_nascimento) ?? ult?.idade ?? ''),
      sexo: sx.startsWith('f') ? 'F' : sx.startsWith('m') ? 'M' : (ult?.sexo || 'M'),
      peso: String(pesoParam || (pesoBio ?? ult?.peso ?? '')),
      dominante: ult?.dominante || 'D',
      acometido: ult?.acometido || 'N',
      modalidade: ult?.modalidade || '',
    });
    if (ultReg) {
      setRegioes(ultReg.movs.map(m => m.regiao));
      const b: Record<string, string> = {};
      for (const m of ultReg.movs) if (m.braco) b[m.regiao] = String(m.braco);
      setBracos(b);
      const md: Record<string, Modo> = {};
      for (const m of ultReg.movs) md[m.regiao] = SLOTS.some(k => m.slots[k]?.curva) ? 'curva' : 'pico';
      setModos(md);
    } else setAba('nova');
    if (vindoDoTeste) setAba('nova');
    if (searchParams.get('exame')) setAba('resultado');
    setPreenchido(true);
  }, [paciente, isLoading, registros, pesoBio, preenchido]);

  const u = crit.unidade;
  const disp = (N?: number | null) => (N == null ? null : N / UF[u]);

  // ───── Importação ─────
  const processar = (s: SlotRascunho): SlotRascunho => {
    if (!s.abas || s.abaIdx == null || !s.mapa) return s;
    if (s.mapa.forca == null) return { ...s, res: { erro: 'Escolha a coluna de força.' } };
    const ex = extrair(s.abas[s.abaIdx].linhas, s.mapa);
    return { ...s, res: analisarCurva(ex.t, ex.f, crit.platoMin) };
  };

  const carregarArquivo = async (ck: string, file: File) => {
    setLendo(ck);
    try {
      const abas = await lerPlanilha(file);
      let abaIdx = 0, insp: Inspecao | null = null;
      for (let i = 0; i < abas.length; i++) { const r = inspecionar(abas[i].linhas); if (r) { abaIdx = i; insp = r; break; } }
      if (!insp) { setSlots(p => ({ ...p, [ck]: { arquivo: file.name, abas, abaIdx: 0, insp: null, mapa: null, res: { erro: 'Não encontrei colunas numéricas neste arquivo.' } } })); return; }
      setSlots(p => ({ ...p, [ck]: processar({ arquivo: file.name, abas, abaIdx, insp, mapa: insp.mapa, res: null }) }));
    } catch (e: any) {
      toast.error(e?.message || `Não consegui ler ${file.name}.`);
    } finally {
      setLendo(null);
    }
  };

  // Curva vinda direto da célula Bluetooth: mesma análise da planilha.
  const receberCaptura = (ck: string, c: CapturaCelula) => {
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setSlots(p => ({ ...p, [ck]: { arquivo: `${c.nome} — captura ${hora}`, res: analisarCurva(c.t, c.fN, crit.platoMin) } }));
  };

  const ajustarMapa = (ck: string, patch: Partial<Mapa>) => setSlots(p => {
    const s = p[ck];
    if (!s?.mapa) return p;
    return { ...p, [ck]: processar({ ...s, mapa: { ...s.mapa, ...patch } }) };
  });

  const trocarAba = (ck: string, idx: number) => setSlots(p => {
    const s = p[ck];
    if (!s?.abas) return p;
    const insp = inspecionar(s.abas[idx].linhas);
    if (!insp) return { ...p, [ck]: { ...s, abaIdx: idx, insp: null, mapa: null, res: { erro: 'Esta aba não tem colunas numéricas.' } } };
    return { ...p, [ck]: processar({ ...s, abaIdx: idx, insp, mapa: insp.mapa }) };
  });

  const alternarRegiao = (r: string) => setRegioes(p => (p.includes(r) ? (p.length > 1 ? p.filter(x => x !== r) : p) : [...p, r]));
  const modoDe = (r: string): Modo => modos[r] || 'curva';

  const usarExemplo = () => {
    const sp: Record<Slot, [number, number]> = { agD: [101, 13], agE: [93, 18], anD: [57, 20], anE: [51, 30] };
    const novo: Record<string, SlotRascunho> = {};
    SLOTS.forEach((k, j) => { const c = curvaSimulada(sp[k][0], sp[k][1], 999 + j * 31); novo[chave('joelho', k)] = { arquivo: `exemplo_${k}.xlsx (simulado)`, res: analisarCurva(c.t, c.f, crit.platoMin) }; });
    setSlots(p => ({ ...p, ...novo }));
    setRegioes(p => (p.includes('joelho') ? p : [...p, 'joelho']));
    setModos(p => ({ ...p, joelho: 'curva' }));
    setBracos(p => ({ ...p, joelho: p.joelho || '36' }));
    toast.message('Curvas simuladas carregadas no joelho. Troque pelos arquivos reais antes de salvar.');
  };

  const sessaoRascunho = (): Sessao | null => {
    const sujeito: Sujeito = { idade: num(suj.idade), sexo: suj.sexo, peso: num(suj.peso), dominante: suj.dominante, acometido: suj.acometido, modalidade: suj.modalidade || undefined };
    const movimentos: Movimento[] = [];
    for (const r of regioes) {
      const out: Movimento['slots'] = {};
      for (const k of SLOTS) {
        const ck = chave(r, k);
        if (modoDe(r) === 'pico') {
          const vals = (picos[ck] || []).map(v => num(v)).filter((v): v is number => v != null).map(v => v * UF[unidadePico]);
          const m = metricasDePico(vals);
          if (m) out[k] = { arquivo: 'valores de pico digitados', metricas: m, curva: null };
        } else {
          const res = slots[ck]?.res;
          if (res && 'metricas' in res) out[k] = { arquivo: slots[ck].arquivo, metricas: res.metricas, curva: res.curva };
        }
      }
      if (Object.keys(out).length) movimentos.push({ regiao: r, braco: num(bracos[r]), slots: out });
    }
    return movimentos.length ? { versao: 2, sujeito, movimentos } : null;
  };

  // Laudo e resumo gravados com regras antigas são regravados com as atuais
  // (as tabelas e gráficos já são calculados na hora a partir das curvas).
  const atualizandoLaudosRef = useRef(false);
  useEffect(() => {
    if (!user || !id || atualizandoLaudosRef.current) return;
    const velhos = exames.filter(e => e.tipo === 'dinamometria' && e.dados?.analise && (e.dados?.versao_laudo ?? 1) < VERSAO_LAUDO);
    if (!velhos.length) return;
    atualizandoLaudosRef.current = true;
    void (async () => {
      let n = 0;
      for (const e of velhos) {
        const movs = movimentosDaAnalise(e.dados.analise);
        if (!movs.length) continue;
        const laudo: string[] = [];
        const resumos: string[] = [];
        for (const av of movs) {
          const ant = [...registros].reverse().find(r => r.id !== e.id && r.data <= e.data_exame && r.movs.some(m => m.regiao === av.regiao));
          const A = analisar(av, crit);
          const antAv = ant?.movs.find(m => m.regiao === av.regiao);
          if (movs.length > 1) laudo.push(`${A.R.l.toUpperCase()}`);
          laudo.push(...interpretar(av, A, crit, ant && antAv ? { data: ant.data, av: antAv } : null));
          resumos.push(resumoCurtoAnalise(av, A, crit));
        }
        const { error } = await (supabase as any).from('exames_presenciais')
          .update({ dados: { ...e.dados, resultado: laudo.join('\n\n'), versao_laudo: VERSAO_LAUDO }, resumo: resumos.join(' | ') })
          .eq('id', e.id);
        if (!error) n++;
      }
      if (n) {
        toast.success(n === 1 ? 'Laudo da dinamometria atualizado com as regras atuais' : `${n} laudos de dinamometria atualizados com as regras atuais`);
        qc.invalidateQueries({ queryKey: ['exames-presenciais', id] });
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exames, user, id]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!user || !id) throw new Error('Sem sessão');
      const sessao = sessaoRascunho();
      if (!sessao) throw new Error('Importe um arquivo ou digite pelo menos um pico.');
      const movs = movimentosDaAnalise(sessao);
      const laudo: string[] = [];
      const resumos: string[] = [];
      for (const av of movs) {
        const ant = [...registros].reverse().find(r => r.data <= dataAv && r.movs.some(m => m.regiao === av.regiao));
        const A = analisar(av, crit);
        const antAv = ant?.movs.find(m => m.regiao === av.regiao);
        if (movs.length > 1) laudo.push(`${A.R.l.toUpperCase()}`);
        laudo.push(...interpretar(av, A, crit, ant && antAv ? { data: ant.data, av: antAv } : null));
        resumos.push(resumoCurtoAnalise(av, A, crit));
      }
      const { data, error } = await (supabase as any).from('exames_presenciais').insert({
        paciente_id: id,
        terapeuta_id: user.id,
        tipo: 'dinamometria',
        data_exame: dataAv,
        dados: { resultado: laudo.join('\n\n'), observacoes: obs || undefined, analise: sessao, versao_laudo: VERSAO_LAUDO },
        resumo: resumos.join(' | '),
        visivel_paciente: visivel,
      }).select('id').single();
      if (error) throw error;
      return data?.id as string;
    },
    onSuccess: (novoId) => {
      toast.success('Avaliação salva nos exames presenciais do paciente');
      setSlots({}); setPicos({}); setObs('');
      setVerId(novoId || null); setRegVer(null);
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
    onSuccess: () => { toast.success('Avaliação excluída'); setVerId(null); setRegVer(null); setConfirmaExcluir(false); qc.invalidateQueries({ queryKey: ['exames-presenciais', id] }); },
    onError: (e: any) => toast.error(e?.message || 'Erro ao excluir'),
  });

  // ───── Sessão e articulação em foco ─────
  const idx = verId ? registros.findIndex(r => r.id === verId) : registros.length - 1;
  const sessao = idx >= 0 ? registros[idx] : null;
  const analises = useMemo(() => (sessao ? sessao.movs.map(av => ({ av, A: analisar(av, crit) })) : []), [sessao, crit]);
  const atual = sessao ? (sessao.movs.find(m => m.regiao === regVer) || sessao.movs[0]) : null;
  const A: Analise | null = atual ? analisar(atual, crit) : null;
  const anteriorDe = (reg: Registro, regiao: string) => {
    const i = registros.indexOf(reg);
    for (let j = i - 1; j >= 0; j--) { const m = registros[j].movs.find(x => x.regiao === regiao); if (m) return { data: registros[j].data, av: m }; }
    return null;
  };
  const anterior = sessao && atual ? anteriorDe(sessao, atual.regiao) : null;
  const texto = atual && A ? interpretar(atual, A, crit, anterior) : [];
  const dores = useMemo(() => achadosDor(analises, crit), [analises, crit]);
  const avatares = useMemo(() => Object.fromEntries(analises.map(x => [
    x.av.regiao,
    mapaMuscularSVG(itensAvatar([x], crit, crit.unidade), dores.filter(a => a.regiao === x.av.regiao).flatMap(a => a.aneis), true),
  ])), [analises, crit, dores]);

  const copiar = async () => {
    if (!sessao) return;
    const partes = sessao.movs.map(av => {
      const a = analisar(av, crit);
      return `${a.R.l.toUpperCase()}\n${interpretar(av, a, crit, anteriorDe(sessao, av.regiao)).join('\n\n')}`;
    });
    const txt = `${nomePaciente} · Dinamometria · ${dataBR(sessao.data)}\n\n${partes.join('\n\n')}`;
    try { await navigator.clipboard.writeText(txt); toast.success('Interpretação copiada'); } catch { toast.error('Não foi possível copiar neste aparelho'); }
  };

  const dadosRelatorio = () => {
    if (!sessao) return null;
    const itens: ItemRelatorio[] = sessao.movs.map(av => ({
      av, A: analisar(av, crit), anterior: anteriorDe(sessao, av.regiao),
      historico: registros.slice(0, idx + 1).flatMap(r => { const m = r.movs.find(x => x.regiao === av.regiao); if (!m) return []; const a = analisar(m, crit); return [{ data: r.data, lsiAg: a.lsiAg?.v ?? null, lsiAn: a.lsiAn?.v ?? null }]; }),
    }));
    return {
      paciente: nomePaciente,
      profissional: profile ? `${profile.nome} ${profile.sobrenome || ''}`.trim() + (profile.crefito ? ` · CREFITO ${profile.crefito}` : '') : undefined,
      data: sessao.data, c: crit, itens,
    };
  };

  const [previaPdf, setPreviaPdf] = useState<{ blob: Blob; nome: string; titulo: string } | null>(null);
  const verPrevia = async (tipo: 'tecnico' | 'cliente') => {
    const d = dadosRelatorio();
    if (!d) return;
    setGerando(tipo);
    try {
      const r = tipo === 'tecnico' ? await gerarRelatorioDinamometria(d, true) : await gerarRelatorioCliente(d, true);
      if (r) setPreviaPdf({ ...r, titulo: tipo === 'tecnico' ? 'Prévia · relatório técnico' : 'Prévia · relatório do cliente' });
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao montar a prévia');
    } finally {
      setGerando(null);
    }
  };

  const pdf = async (tipo: 'tecnico' | 'cliente') => {
    const d = dadosRelatorio();
    if (!d) return;
    setGerando(tipo);
    try {
      if (tipo === 'tecnico') await gerarRelatorioDinamometria(d);
      else await gerarRelatorioCliente(d);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao gerar o PDF');
    } finally {
      setGerando(null);
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

  // Ordem do teste: começa pelo lado e grupo escolhidos. "grupo" = mesmo
  // músculo nos dois lados antes de trocar; "lado" = os dois músculos de um lado antes.
  const etapasTeste: Etapa[] = useMemo(() => {
    const outroLado: Lado = proto.lado === 'D' ? 'E' : 'D';
    const outroGrupo = proto.grupo === 'ag' ? 'an' : 'ag';
    const ordem: [string, Lado][] = proto.ordem === 'grupo'
      ? [[proto.grupo, proto.lado], [proto.grupo, outroLado], [outroGrupo, proto.lado], [outroGrupo, outroLado]]
      : [[proto.grupo, proto.lado], [outroGrupo, proto.lado], [proto.grupo, outroLado], [outroGrupo, outroLado]];
    return regioes.flatMap(r => ordem.map(([g, l]) => {
      const k = `${g}${l}` as Slot;
      return { id: chave(r, k), titulo: nomeSlot(r, k) };
    }));
  }, [regioes, proto]);
  const [etapasExec, setEtapasExec] = useState<Etapa[]>([]);
  const iniciarProtocolo = (ids: string[]) => {
    setModos(p => { const n = { ...p }; for (const r of regioes) n[r] = 'curva'; return n; });
    setEtapasExec(etapasTeste.filter(e => ids.includes(e.id)));
    setProtoAberto(true);
  };
  const etapasBancada: EtapaBancada[] = etapasTeste.map(e => {
    const res = slots[e.id]?.res;
    return {
      id: e.id, titulo: e.titulo, lado: (e.id.endsWith('D') ? 'D' : 'E') as Lado,
      picoKgf: res && 'metricas' in res ? res.metricas.pico / UF.kgf : null,
      erro: res && 'erro' in res ? res.erro : null,
    };
  });
  const configProto: ConfigProtocolo = { tempoForca: proto.tempoForca, repeticoes: proto.repeticoes, descanso: proto.descanso, preparo: proto.preparo };

  const podeSalvar = regioes.some(r => SLOTS.some(k => {
    const ck = chave(r, k);
    if (modoDe(r) === 'pico') return (picos[ck] || []).some(v => (num(v) ?? 0) > 0);
    const res = slots[ck]?.res;
    return res && 'metricas' in res;
  }));
  const temSimulado = regioes.some(r => modoDe(r) === 'curva' && SLOTS.some(k => slots[chave(r, k)]?.arquivo.includes('simulado')));
  // Prévia: a mesma análise do exame salvo, feita sobre o que já foi capturado.
  const previa = (() => {
    const ses = sessaoRascunho();
    if (!ses) return null;
    const movs = movimentosDaAnalise(ses);
    return movs.length ? movs.map(av => ({ av, A: analisar(av, crit) })) : null;
  })();

  // ───── Render: entrada ─────
  const cardSlot = (regiao: string, k: Slot) => {
    const ck = chave(regiao, k);
    const s = slots[ck];
    const lado = k.endsWith('D') ? 'D' : 'E';
    const r = s?.res;
    const ok = r && 'metricas' in r ? r : null;
    return (
      <div
        key={ck}
        onDragOver={e => { e.preventDefault(); setSobre(ck); }}
        onDragLeave={() => setSobre(null)}
        onDrop={e => { e.preventDefault(); setSobre(null); const f = e.dataTransfer.files?.[0]; if (f) carregarArquivo(ck, f); }}
        className={cn('rounded-xl border-2 border-dashed p-3 space-y-2 min-w-0 transition-colors', sobre === ck ? 'border-primary bg-primary/5' : 'border-border/60 bg-muted/20')}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="font-semibold text-sm"><Bolinha lado={lado} />{nomeSlot(regiao, k)}</span>
          <div className="flex gap-1.5">
            <Button asChild size="sm" variant="outline" className="relative overflow-hidden">
              <label className="cursor-pointer">
                {lendo === ck ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <FileUp className="h-3.5 w-3.5 mr-1" />}
                {s ? 'Trocar' : 'Escolher arquivo'}
                <input type="file" accept=".xlsx,.csv,.txt" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => { const f = e.target.files?.[0]; if (f) carregarArquivo(ck, f); e.target.value = ''; }} />
              </label>
            </Button>
            <Button size="sm" variant="outline" onClick={() => setCapturaCk(ck)} title="Capturar pela célula de carga Bluetooth">
              <Bluetooth className="h-3.5 w-3.5 mr-1" /> Célula
            </Button>
            {s && <Button size="sm" variant="ghost" onClick={() => setSlots(p => { const n = { ...p }; delete n[ck]; return n; })} title="Remover"><X className="h-4 w-4" /></Button>}
          </div>
        </div>
        {s ? <p className="text-xs font-mono text-muted-foreground break-all">{s.arquivo}</p> : <p className="text-xs text-muted-foreground">Capture pela célula Bluetooth ou arraste aqui o .xlsx/.csv exportado pelo dinamômetro.</p>}
        {s?.insp && s.mapa && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {s.abas && s.abas.length > 1 && (
              <div className="space-y-0.5 col-span-2 sm:col-span-4">
                <Label className="text-[11px]">Aba</Label>
                <Select value={String(s.abaIdx)} onValueChange={v => trocarAba(ck, Number(v))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{s.abas.map((a, i) => <SelectItem key={i} value={String(i)}>{a.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-0.5">
              <Label className="text-[11px]">Tempo</Label>
              <Select value={s.mapa.tempo == null ? 'none' : String(s.mapa.tempo)} onValueChange={v => ajustarMapa(ck, { tempo: v === 'none' ? null : Number(v) })}>
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
                <Input className="h-8 text-xs" inputMode="numeric" defaultValue={s.mapa.hz} onBlur={e => ajustarMapa(ck, { hz: num(e.target.value) || 100 })} />
              </div>
            ) : (
              <div className="space-y-0.5">
                <Label className="text-[11px]">Unid. do tempo</Label>
                <Select value={s.mapa.unidadeTempo} onValueChange={v => ajustarMapa(ck, { unidadeTempo: v as Mapa['unidadeTempo'] })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="auto">Automático</SelectItem><SelectItem value="s">segundos</SelectItem><SelectItem value="ms">milissegundos</SelectItem></SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-0.5">
              <Label className="text-[11px]">Força</Label>
              <Select value={String(s.mapa.forca)} onValueChange={v => ajustarMapa(ck, { forca: Number(v) })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{s.insp.colunas.map(c => <SelectItem key={c.idx} value={String(c.idx)}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-0.5">
              <Label className="text-[11px]">Unid. da força</Label>
              <Select value={s.mapa.unidade} onValueChange={v => ajustarMapa(ck, { unidade: v as Unidade })}>
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
            {ok.curva && (
              <div className="h-16">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={ok.curva.t.map((t, i) => ({ t, f: ok.curva.f[i] }))} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                    <Line type="linear" dataKey="f" stroke={COR[lado]} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const tabelaPicos = (regiao: string) => (
    <div className="overflow-x-auto rounded-lg border border-border/50">
      <table className="w-full text-sm min-w-[520px]">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="px-2.5 py-2 text-left font-semibold">Músculo</th>
            {[1, 2, 3].map(n => <th key={n} className="px-2.5 py-2 text-left font-semibold">Tentativa {n} ({unidadePico})</th>)}
            <th className="px-2.5 py-2 text-left font-semibold">Maior</th>
          </tr>
        </thead>
        <tbody>
          {SLOTS.map(k => {
            const ck = chave(regiao, k);
            const vals = picos[ck] || ['', '', ''];
            const nums = vals.map(v => num(v)).filter((v): v is number => v != null && v > 0);
            return (
              <tr key={ck} className="border-t border-border/40">
                <td className="px-2.5 py-1.5 whitespace-nowrap"><Bolinha lado={k.endsWith('D') ? 'D' : 'E'} />{nomeSlot(regiao, k)}</td>
                {[0, 1, 2].map(i => (
                  <td key={i} className="px-1.5 py-1.5">
                    <Input
                      id={`pico-${ck}-${i}`}
                      className="h-8 w-24 font-mono"
                      inputMode="decimal"
                      value={vals[i] || ''}
                      onChange={e => setPicos(p => { const v = [...(p[ck] || ['', '', ''])]; v[i] = e.target.value; return { ...p, [ck]: v }; })}
                    />
                  </td>
                ))}
                <td className="px-2.5 py-1.5 font-mono font-semibold">{nums.length ? fmt(Math.max(...nums), 1) : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const graficoFalha = (av: Avaliacao, g: 'ag' | 'an', titulo: string) => {
    const L = linhasFalha(av, g);
    if (!L) return null;
    return (
      <Card className="p-4 space-y-2 min-w-0">
        <p className="font-semibold text-sm">Curva de falha do platô · {titulo}</p>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={L.dados} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
              <CartesianGrid strokeDasharray="0" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="t" type="number" domain={[0, 'dataMax']} tickFormatter={v => `${fmt(v, 0)} s`} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis domain={[40, 100]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${fmt(v, 0)}%`} width={44} />
              <ReferenceLine y={100 - crit.fadBaixa} stroke="#22A35A" strokeDasharray="4 4" />
              <ReferenceLine y={100 - crit.fadAlta} stroke="#E04B3F" strokeDasharray="4 4" />
              <Tooltip formatter={(v: any, n: any) => [`${fmt(Number(v), 0)}% do pico`, n === 'D' ? 'Direito' : 'Esquerdo']} labelFormatter={v => `${fmt(Number(v), 1)} s após o pico`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend formatter={v => (v === 'D' ? 'Direito' : 'Esquerdo')} wrapperStyle={{ fontSize: 12 }} />
              <Line type="linear" dataKey="D" stroke={COR.D} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
              <Line type="linear" dataKey="E" stroke={COR.E} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Força em % do próprio pico, do pico até o fim do platô. Queda: D {L.d?.queda != null ? `${fmt(L.d.queda, 1)}%/s` : '—'} · E {L.e?.queda != null ? `${fmt(L.e.queda, 1)}%/s` : '—'}.
          Linhas tracejadas: limites de fadiga ({crit.fadBaixa}% e {crit.fadAlta}%).
        </p>
      </Card>
    );
  };

  const graficoCurva = (av: Avaliacao, g: 'ag' | 'an', titulo: string) => {
    const dados = linhasCurva(av, g, u);
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

  // ───── Evolução ─────
  const regioesHist = useMemo(() => Array.from(new Set(registros.flatMap(r => r.movs.map(m => m.regiao)))), [registros]);
  const regEvoAtual = regEvo && regioesHist.includes(regEvo) ? regEvo : regioesHist[0] || 'joelho';
  const REvo = REGIOES[regEvoAtual] || REGIOES.joelho;
  const evolucao = useMemo(() => registros.flatMap(r => {
    const m = r.movs.find(x => x.regiao === regEvoAtual);
    if (!m) return [];
    const a = analisar(m, crit);
    const p = (k: Slot) => { const v = m.slots[k]?.metricas.pico; return v == null ? null : +(v / UF[crit.unidade]).toFixed(1); };
    return [{ data: dataBR(r.data).slice(0, 5), dataFull: r.data, agD: p('agD'), agE: p('agE'), anD: p('anD'), anE: p('anE'), lsiAg: a.lsiAg?.v ?? null, lsiAn: a.lsiAn?.v ?? null }];
  }), [registros, crit, regEvoAtual]);

  const camposCrit: [keyof Criterios, string, string?][] = [
    ['lsiAdequado', 'Simetria adequada a partir de (%)', 'Grindem 2016: ≥ 90%'], ['lsiImportante', 'Déficit importante abaixo de (%)'],
    ['razaoTol', 'Razão adequada até (% de desvio)', 'Desvio da referência'], ['razaoLimite', 'Desequilíbrio acima de (% de desvio)'],
    ['fadBaixa', 'Fadiga baixa até (%)'], ['fadAlta', 'Fadiga alta acima de (%)'],
    ['oscEstavel', 'Curva estável até (% de oscilação)'], ['oscInstavel', 'Curva instável acima de (%)'],
    ['mudanca', 'Mudança real (%)', 'Troque pelo erro de medida do serviço'], ['platoMin', 'Platô mínimo p/ fadiga (s)'],
  ];

  return (
    <AppLayout>
      <div className="container max-w-6xl py-6 space-y-5">
        <PageHeader
          title="Análise de dinamometria"
          subtitle={nomePaciente}
          eyebrow="Aplicações"
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
              <div className="space-y-1.5">
                <Label className="text-xs">Articulações avaliadas nesta sessão</Label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(REGIOES).map(([k, r]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => alternarRegiao(k)}
                      aria-pressed={regioes.includes(k)}
                      className={cn('rounded-full border px-3 py-1 text-sm transition-colors', regioes.includes(k) ? 'border-primary bg-primary/10 text-foreground font-medium' : 'border-border text-muted-foreground hover:bg-muted')}
                    >
                      {r.l}
                    </button>
                  ))}
                </div>
              </div>
            </Card>

            {/* Bancada do teste com a célula Bluetooth */}
            <BancadaTeste
              status={statusCelula}
              bateria={celula.bateriaPct}
              bateriaVolts={celula.bateriaVolts}
              proto={proto}
              onProto={setProto}
              etapas={etapasBancada}
              nomeAg={regioes.length === 1 ? REGIOES[regioes[0]].ag : 'Agonista'}
              nomeAn={regioes.length === 1 ? REGIOES[regioes[0]].an : 'Antagonista'}
              titulo={regioes.map(r => REGIOES[r].l).join(' · ')}
              onConectar={() => celula.conectar().catch((e: any) => { if (e?.name !== 'NotFoundError') toast.error(e?.message || 'Não consegui conectar.'); })}
              onIniciar={(ids) => iniciarProtocolo(ids)}
              onCapturarUma={(ckId) => iniciarProtocolo([ckId])}
            />

            {previa && (
              <Card className="p-4 space-y-3 border-emerald-500/30">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Prévia do exame</p>
                    <p className="text-sm text-muted-foreground">Atualiza a cada captura · ainda não salvo</p>
                  </div>
                  <Button size="sm" className="gap-1.5" disabled={!podeSalvar || temSimulado || salvar.isPending} onClick={() => salvar.mutate()}>
                    {salvar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar exame
                  </Button>
                </div>
                {previa.map(({ av, A: Ap }) => (
                  <div key={av.regiao} className="space-y-3">
                    {previa.length > 1 && <p className="font-semibold text-sm">{Ap.R.l}</p>}
                    <div className="overflow-x-auto rounded-xl border border-border/50">
                      <table className="w-full text-sm min-w-[620px]">
                        <thead className="bg-muted/50 text-xs text-muted-foreground">
                          <tr>{['Músculo', `Pico (${u})`, 'Simetria', `${Ap.R.an}/${Ap.R.ag}`, 'Fadiga', 'Falha do platô', 'Oscilação'].map(h => <th key={h} className="px-2.5 py-2 text-left font-semibold whitespace-nowrap">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                          {SLOTS_POR_LADO.filter(k => Ap.slots[k]).map(k => {
                            const sl = Ap.slots[k]!;
                            const lado: Lado = k.endsWith('D') ? 'D' : 'E';
                            const doLado = SLOTS_POR_LADO.filter(x => x.endsWith(lado) && Ap.slots[x]);
                            const sim = simetriaSlot(Ap, k, crit);
                            const rz = Ap.razoes[lado];
                            const fp = falhaPlato(av.slots[k]?.curva);
                            return (
                              <tr key={k} className={cn('border-t border-border/40', doLado[0] === k && lado === 'E' && 'border-t-2 border-t-border')}>
                                <td className="px-2.5 py-2 whitespace-nowrap"><Bolinha lado={lado} />{nomeSlot(av.regiao, k)}</td>
                                <td className="px-2.5 py-2 font-mono font-semibold">{fmt(disp(sl.pico), 1)}</td>
                                <td className="px-2.5 py-2">{sim ? (sim.v >= 99.5 ? <span className="text-xs text-muted-foreground">100% · forte</span> : <span className="flex items-center gap-1.5 whitespace-nowrap"><span className="font-mono">{fmt(sim.v, 0)}%</span><Pilula st={sim.st} /></span>) : '—'}</td>
                                {doLado[0] === k && (
                                  <td rowSpan={doLado.length} className="px-2.5 py-2 align-middle border-l border-border/40">
                                    {rz ? <span className="flex flex-col gap-0.5"><span className="font-mono font-semibold">{lado} {fmt(rz.r * 100, 0)}%</span><Pilula st={rz.desvio == null ? ['info', 'Sem referência'] : stDesvio(rz.desvio, crit)} /></span> : '—'}
                                  </td>
                                )}
                                <td className="px-2.5 py-2">{sl.fadiga == null ? '—' : <span className="flex items-center gap-1.5 whitespace-nowrap"><span className="font-mono">{fmt(sl.fadiga, 0)}%</span><Pilula st={stFadiga(sl.fadiga, crit)} /></span>}</td>
                                <td className="px-2.5 py-2 font-mono whitespace-nowrap">{fp?.queda != null ? `${fmt(fp.queda, 1)}%/s` : '—'}</td>
                                <td className="px-2.5 py-2">{sl.oscilacao == null ? '—' : <span className="flex items-center gap-1.5 whitespace-nowrap"><span className="font-mono">{fmt(sl.oscilacao, 1)}%</span><Pilula st={stOsc(sl.oscilacao, crit)} /></span>}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {SLOTS.some(k => av.slots[k]?.curva) && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {graficoCurva(av, 'ag', Ap.R.ag)}
                        {graficoCurva(av, 'an', Ap.R.an)}
                        {graficoFalha(av, 'ag', Ap.R.ag)}
                        {graficoFalha(av, 'an', Ap.R.an)}
                      </div>
                    )}
                    <div className="rounded-xl bg-muted/40 p-3 space-y-1.5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Interpretação prévia</p>
                      {interpretar(av, Ap, crit, null).map((t, ix) => <p key={ix} className="text-sm leading-relaxed">{t}</p>)}
                    </div>
                  </div>
                ))}
              </Card>
            )}

            {regioes.map(r => {
              const Rg = REGIOES[r];
              const modo = modoDe(r);
              return (
                <Card key={r} className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="font-semibold">{Rg.l}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {Rg.torque && (
                        <div className="flex items-center gap-1.5">
                          <Label className="text-xs whitespace-nowrap">Braço de alavanca (cm)</Label>
                          <Input className="h-8 w-20" inputMode="decimal" value={bracos[r] || ''} onChange={e => setBracos(p => ({ ...p, [r]: e.target.value }))} />
                        </div>
                      )}
                      <div className="inline-flex rounded-lg border border-border p-0.5">
                        {([['curva', 'Arquivo Excel'], ['pico', 'Só os picos']] as [Modo, string][]).map(([m, l]) => (
                          <button key={m} type="button" onClick={() => setModos(p => ({ ...p, [r]: m }))} aria-pressed={modo === m} className={cn('rounded-md px-2.5 py-1 text-xs', modo === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>{l}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {modo === 'curva' ? (
                    <>
                      <p className="text-xs text-muted-foreground">Um arquivo por músculo e lado. O app encontra as colunas de tempo e força, separa as repetições e usa a melhor. Para medir fadiga, a contração precisa ficar alta por pelo menos {crit.platoMin} s.</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{SLOTS.map(k => cardSlot(r, k))}</div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-xs text-muted-foreground">Para dinamômetros que mostram só a força máxima. Digite até 3 tentativas; vale a maior. Fadiga, RFD e estabilidade não são calculadas.</p>
                        <div className="flex items-center gap-1.5">
                          <Label className="text-xs">Unidade</Label>
                          <Select value={unidadePico} onValueChange={v => setUnidadePico(v as Unidade)}>
                            <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                            <SelectContent>{(['kgf', 'N', 'lbf'] as Unidade[]).map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      {tabelaPicos(r)}
                    </>
                  )}
                </Card>
              );
            })}

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
            ) : !sessao || !atual || !A ? (
              <Card className="p-8 text-center space-y-3">
                <p className="font-semibold">Nenhuma avaliação de dinamometria ainda.</p>
                <p className="text-sm text-muted-foreground">Importe os arquivos do dinamômetro ou digite os picos na aba Nova avaliação.</p>
                <Button onClick={() => setAba('nova')}>Nova avaliação</Button>
              </Card>
            ) : (
              <>
                <Card className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{dataBR(sessao.data)}{registros.length > 1 && ` · avaliação ${idx + 1} de ${registros.length}`}</p>
                      <p className="text-lg font-semibold">{nomePaciente}</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {registros.length > 1 && (
                        <Select value={sessao.id} onValueChange={v => { setVerId(v); setRegVer(null); setConfirmaExcluir(false); }}>
                          <SelectTrigger className="h-9 w-auto min-w-[180px]"><SelectValue /></SelectTrigger>
                          <SelectContent>{[...registros].reverse().map(r => <SelectItem key={r.id} value={r.id}>{dataBR(r.data)} · {r.movs.map(m => REGIOES[m.regiao]?.l).join(', ')}</SelectItem>)}</SelectContent>
                        </Select>
                      )}
                      <Button size="sm" variant="outline" onClick={copiar}><Copy className="h-3.5 w-3.5 mr-1" />Copiar interpretação</Button>
                      <Button size="sm" variant="outline" onClick={() => verPrevia('tecnico')} disabled={!!gerando}>{gerando === 'tecnico' ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}Ver relatório técnico</Button>
                      <Button size="sm" onClick={() => verPrevia('cliente')} disabled={!!gerando}>{gerando === 'cliente' ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}Ver relatório do cliente</Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {([['ok', 'Bom'], ['warn', 'Atenção'], ['bad', 'Ruim']] as [string, string][]).map(([k, l]) => <span key={k} className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ background: COR_STATUS[k] }} />{l}</span>)}
                    <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-full border-2 border-dashed border-muted-foreground" />Possível ponto de dor</span>
                    <span>No avatar, a cor de cada lado junta a força para idade e sexo, a diferença entre os lados e o equilíbrio agonista × antagonista. Na vista de frente, o lado direito do paciente aparece à esquerda.</span>
                  </div>
                </Card>

                {analises.map(({ av, A: Ax }) => {
                  const R = Ax.R;
                  const pico = (k: Slot) => av.slots[k]?.metricas.pico;
                  const grupos = (['ag', 'an'] as const).filter(g => pico(`${g}D` as Slot) != null || pico(`${g}E` as Slot) != null);
                  const temFadiga = grupos.filter(g => Ax.slots[`${g}D` as Slot]?.fadiga != null || Ax.slots[`${g}E` as Slot]?.fadiga != null);
                  const ref = (Ax.razoes.D || Ax.razoes.E)?.refTxt;
                  return (
                    <Card key={av.regiao} className="p-4 space-y-4">
                      <p className="font-semibold">{R.l}</p>
                      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-4 items-center">
                        <div className="rounded-lg border border-border/50 bg-white w-full max-w-[460px] mx-auto [&_svg]:w-full [&_svg]:h-auto" dangerouslySetInnerHTML={{ __html: avatares[av.regiao] || '' }} />
                        <Barras grupos={gruposBarras(Ax, u)} u={u} />
                      </div>
                      <div className="overflow-x-auto rounded-lg border border-border/50">
                        <table className="w-full text-sm min-w-[680px]">
                          <thead className="bg-muted/50 text-xs text-muted-foreground">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold">Movimento</th>
                              <th className="px-3 py-2 text-left font-semibold"><Bolinha lado="D" />Direito</th>
                              <th className="px-3 py-2 text-left font-semibold"><Bolinha lado="E" />Esquerdo</th>
                              <th className="px-3 py-2 text-left font-semibold">Referência</th>
                              <th className="px-3 py-2 text-left font-semibold">Direito × esquerdo <span className="font-normal">(bom até {100 - crit.lsiAdequado}%)</span></th>
                            </tr>
                          </thead>
                          <tbody>
                            {grupos.map(g => {
                              const L = g === 'ag' ? Ax.lsiAg : Ax.lsiAn;
                              const st = L ? stLSI(L.v, crit) : null;
                              const sD = Ax.slots[`${g}D` as Slot], sE = Ax.slots[`${g}E` as Slot];
                              const esp = sD?.esperado ?? sE?.esperado, min = sD?.minimo ?? sE?.minimo;
                              const forca = (sl?: typeof sD) => (sl == null ? '—' : sl.z == null ? <span className="font-mono">{fmt(disp(sl.pico), 1)} {u}</span> : <Sinal st={stZ(sl.z)}>{fmt(disp(sl.pico), 1)} {u}</Sinal>);
                              return (
                                <tr key={g} className="border-t border-border/40">
                                  <td className="px-3 py-2"><span className="font-medium">Força · {g === 'ag' ? R.ag : R.an}</span>{(sD?.nkg ?? sE?.nkg) != null && <span className="block text-xs text-muted-foreground">D {fmt(sD?.nkg != null ? sD.nkg / UF[u] : null, 2)} · E {fmt(sE?.nkg != null ? sE.nkg / UF[u] : null, 2)} {u}/kg</span>}</td>
                                  <td className="px-3 py-2">{forca(sD)}</td>
                                  <td className="px-3 py-2">{forca(sE)}</td>
                                  <td className="px-3 py-2 text-xs whitespace-nowrap">{esp != null && min != null ? <>≈ {fmt(disp(esp), 1)} {u}<span className="block text-muted-foreground">normal ≥ {fmt(disp(min), 1)}</span></> : <span className="text-muted-foreground">—</span>}</td>
                                  <td className="px-3 py-2">{L ? <Sinal st={st}>{st?.[0] === 'ok' ? `Equilibrado (${fmt(L.v, 0)}%)` : `${L.fraco === 'D' ? 'Direito' : 'Esquerdo'} ${fmt(100 - L.v, 0)}% mais fraco`}</Sinal> : <span className="text-xs text-muted-foreground">Falta um dos lados</span>}</td>
                                </tr>
                              );
                            })}
                            {(Ax.razoes.D || Ax.razoes.E) && (
                              <tr className="border-t border-border/40">
                                <td className="px-3 py-2"><span className="font-medium">Agonista × antagonista</span><span className="block text-xs text-muted-foreground">{R.razaoL}</span></td>
                                {(['D', 'E'] as Lado[]).map(l => { const x = Ax.razoes[l]; return <td key={l} className="px-3 py-2">{x ? <Sinal st={x.desvio == null ? ['info', 'Sem referência'] : stDesvio(x.desvio, crit)}>{fmt(x.r * 100, 0)}%</Sinal> : '—'}</td>; })}
                                <td className="px-3 py-2 text-xs whitespace-nowrap">{ref || '—'}</td>
                                <td className="px-3 py-2 text-xs text-muted-foreground">Desequilíbrio aqui pode gerar dor na própria articulação.</td>
                              </tr>
                            )}
                            {temFadiga.map(g => (
                              <tr key={`f${g}`} className="border-t border-border/40">
                                <td className="px-3 py-2"><span className="font-medium">Índice de fadiga · {g === 'ag' ? R.ag : R.an}</span></td>
                                {(['D', 'E'] as Lado[]).map(l => { const f = Ax.slots[`${g}${l}` as Slot]?.fadiga; return <td key={l} className="px-3 py-2">{f == null ? '—' : <Sinal st={stFadiga(f, crit)}>{fmt(f, 0)}%</Sinal>}</td>; })}
                                <td className="px-3 py-2 text-xs whitespace-nowrap">até {crit.fadBaixa}%</td>
                                <td className="px-3 py-2 text-xs text-muted-foreground">Queda da força na contração sustentada.</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {!temFadiga.length && <p className="text-[11px] text-muted-foreground">{SLOTS.some(k => av.slots[k]?.curva) ? `Fadiga não calculada: a contração precisa ficar alta por pelo menos ${crit.platoMin} s.` : 'Fadiga exige o arquivo com a curva força × tempo (não sai só dos picos).'}</p>}
                      {SLOTS.some(k => av.slots[k]?.curva) && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                          {graficoCurva(av, 'ag', R.ag)}
                          {graficoCurva(av, 'an', R.an)}
                          {graficoFalha(av, 'ag', R.ag)}
                          {graficoFalha(av, 'an', R.an)}
                        </div>
                      )}
                    </Card>
                  );
                })}

                <Card className="p-4 space-y-3">
                  <p className="font-semibold">Relação com dores</p>
                  {dores.length ? (
                    <ul className="space-y-2.5">
                      {dores.map((a, i) => (
                        <li key={i} className="flex gap-2.5">
                          <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COR_STATUS[a.st?.[0] ?? 'info'] }} />
                          <span className="min-w-0"><span className="block text-sm font-medium">{a.titulo}</span><span className="block text-sm text-muted-foreground">{a.texto}</span>{a.refs.length > 0 && <span className="block text-[11px] text-muted-foreground mt-0.5">Ref.: {a.refs.map((r, k) => <span key={r}>{k > 0 && '; '}<a className="underline" href={linkPubMed(REF[r].pmid)} target="_blank" rel="noopener noreferrer">{REF[r].curta}</a></span>)}</span>}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-muted-foreground">Sem desequilíbrios que sugiram sobrecarga nas articulações avaliadas.</p>}
                  <p className="text-[11px] text-muted-foreground">{AVISO_DOR}</p>
                </Card>

                <Button variant="outline" className="w-full" onClick={() => setDetalhes(v => !v)} aria-expanded={detalhes}>
                  {detalhes ? 'Esconder detalhes técnicos' : 'Ver detalhes técnicos (métricas e interpretação)'}
                </Button>

                {detalhes && (<>
                {sessao.movs.length > 1 && (
                  <div className="flex flex-wrap gap-1.5">
                    {sessao.movs.map(m => (
                      <button key={m.regiao} type="button" onClick={() => setRegVer(m.regiao)} aria-pressed={m.regiao === atual.regiao} className={cn('rounded-full border px-3 py-1 text-sm', m.regiao === atual.regiao ? 'border-primary bg-primary/10 font-medium' : 'border-border text-muted-foreground hover:bg-muted')}>{REGIOES[m.regiao]?.l}</button>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
                  {SLOTS.some(k => A.slots[k]?.fadiga != null) && (
                    <Card className="p-4 space-y-3">
                      <p className="font-semibold text-sm">Índice de fadiga</p>
                      {SLOTS.filter(k => A.slots[k]).map(k => {
                        const f = A.slots[k]!.fadiga;
                        const escala = Math.max(crit.fadAlta * 1.5, 50);
                        return (
                          <div key={k} className="grid grid-cols-[130px_1fr_48px] gap-2 items-center text-sm">
                            <span className="truncate">{nomeSlot(atual.regiao, k)}</span>
                            <span className="relative h-3.5 rounded bg-muted border border-border/50">
                              <b className="absolute inset-y-0 left-0 rounded" style={{ width: `${f == null ? 0 : clamp((f / escala) * 100, 0, 100)}%`, background: COR[k.endsWith('D') ? 'D' : 'E'] }} />
                              <i className="absolute -top-1 -bottom-1 w-0.5 bg-muted-foreground" style={{ left: `${(crit.fadBaixa / escala) * 100}%` }} title={`Limite ${crit.fadBaixa}%`} />
                            </span>
                            <span className="font-mono text-right">{f == null ? 'n/d' : `${fmt(f, 0)}%`}</span>
                          </div>
                        );
                      })}
                      <p className="text-[11px] text-muted-foreground">(Força máxima em 1 s − força no último segundo) ÷ força máxima. A linha marca o limite de fadiga baixa ({crit.fadBaixa}%).</p>
                    </Card>
                  )}
                  <Card className="p-4 space-y-2">
                    <p className="font-semibold text-sm">Interpretação automática · {A.R.l}</p>
                    {texto.map((p, i) => <p key={i} className="text-sm leading-relaxed">{p}</p>)}
                  </Card>
                </div>

                <Card className="p-4 space-y-2">
                  <p className="font-semibold text-sm">Métricas · {A.R.l}</p>
                  <div className="overflow-x-auto rounded-lg border border-border/50">
                    <table className="w-full text-sm min-w-[1040px]">
                      <thead className="bg-muted/50 text-xs text-muted-foreground">
                        <tr>
                          {['Músculo', `Pico (${u})`, 'Simetria (mais forte = 100%)', `Razão ${A.R.an}/${A.R.ag}`, 'N/kg', 'Norma (idade e sexo)', 'Tempo até pico (s)', `RFD 0–100 ms (${u}/s)`, `RFD 0–200 ms (${u}/s)`, `Impulso (${u}·s)`, 'Fadiga', 'Falha do platô', 'Oscilação', 'Rep.'].map(h => <th key={h} className="px-2.5 py-2 text-left font-semibold whitespace-nowrap">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {SLOTS_POR_LADO.filter(k => A.slots[k]).map(k => {
                          const s = A.slots[k]!;
                          const lado: Lado = k.endsWith('D') ? 'D' : 'E';
                          // Razão do lado: uma célula para as linhas daquele lado (vizinhas).
                          const doLado = SLOTS_POR_LADO.filter(x => x.endsWith(lado) && A.slots[x]);
                          const primeiraDoLado = doLado[0] === k;
                          const sim = simetriaSlot(A, k, crit);
                          const rz = A.razoes[lado];
                          return (
                            <tr key={k} className={cn('border-t border-border/40', primeiraDoLado && lado === 'E' && 'border-t-2 border-t-border')}>
                              <td className="px-2.5 py-2 whitespace-nowrap"><Bolinha lado={lado} />{nomeSlot(atual.regiao, k)}</td>
                              <td className="px-2.5 py-2 font-mono">{fmt(disp(s.pico), 1)}</td>
                              <td className="px-2.5 py-2 border-l border-border/40">
                                {sim ? <span className="flex items-center gap-1.5 whitespace-nowrap"><span className="font-mono font-semibold">{fmt(sim.v, 0)}%</span>{sim.v < 99.5 ? <Pilula st={sim.st} /> : <span className="text-[11px] text-muted-foreground">mais forte</span>}</span> : '—'}
                              </td>
                              {primeiraDoLado && (
                                <td rowSpan={doLado.length} className="px-2.5 py-2 align-middle border-l border-border/40">
                                  {rz ? (
                                    <span className="flex flex-col gap-0.5" title={`${A.R.razaoL} · ${lado === 'D' ? 'direito' : 'esquerdo'} · referência ${rz.refTxt || '—'}`}>
                                      <span className="text-[11px] text-muted-foreground">{lado === 'D' ? 'Direito' : 'Esquerdo'}</span>
                                      <span className="font-mono font-semibold">{fmt(rz.r * 100, 0)}%</span>
                                      <Pilula st={rz.desvio == null ? ['info', 'Sem referência'] : stDesvio(rz.desvio, crit)} />
                                    </span>
                                  ) : '—'}
                                </td>
                              )}
                              <td className="px-2.5 py-2 font-mono">{s.nkg == null ? '—' : fmt(s.nkg, 1)}</td>
                              <td className="px-2.5 py-2">{s.precisaBraco ? <span className="text-xs text-muted-foreground">informe o braço de alavanca</span> : s.z == null ? '—' : <span className="flex items-center gap-1.5 whitespace-nowrap"><span className="font-mono">{fmt(s.pctNorma, 0)}% · z {fmt(s.z, 1)}</span><Pilula st={stZ(s.z)} /></span>}</td>
                              <td className="px-2.5 py-2 font-mono">{fmt(s.ttp, 2)}</td>
                              <td className="px-2.5 py-2 font-mono">{fmt(disp(s.rfd100), 0)}</td>
                              <td className="px-2.5 py-2 font-mono">{fmt(disp(s.rfd200), 0)}</td>
                              <td className="px-2.5 py-2 font-mono">{fmt(disp(s.impulso), 0)}</td>
                              <td className="px-2.5 py-2">{s.fadiga == null ? '—' : <span className="flex items-center gap-1.5 whitespace-nowrap"><span className="font-mono">{fmt(s.fadiga, 0)}%</span><Pilula st={stFadiga(s.fadiga, crit)} /></span>}</td>
                              <td className="px-2.5 py-2 font-mono whitespace-nowrap">{(() => { const fp = falhaPlato(atual.slots[k]?.curva); return fp?.queda != null ? `${fmt(fp.queda, 1)}%/s · ${fmt(fp.duracao, 1)} s` : '—'; })()}</td>
                              <td className="px-2.5 py-2">{s.oscilacao == null ? '—' : <span className="flex items-center gap-1.5 whitespace-nowrap"><span className="font-mono">{fmt(s.oscilacao, 1)}%</span><Pilula st={stOsc(s.oscilacao, crit)} /></span>}</td>
                              <td className="px-2.5 py-2 font-mono">{s.reps.length}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Pico = maior média móvel de 50 ms, descontada a linha de base (no modo "só os picos", o maior valor digitado). Oscilação = desvio em torno da tendência do platô, em % da média. Norma: McKay et al., 2017, membro dominante{A.R.torque ? '; joelho em torque (força × braço de alavanca), medido com dinamômetro fixo' : ''}.</p>
                </Card>

                </>)}

                {sessao.obs && <Card className="p-4"><p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Observações</p><p className="text-sm mt-1">{sessao.obs}</p></Card>}

                <div className="flex gap-2 items-center flex-wrap">
                  {confirmaExcluir ? (
                    <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm flex-wrap">
                      Excluir a avaliação de {dataBR(sessao.data)} (todas as articulações)? Não dá para desfazer.
                      <Button size="sm" variant="destructive" disabled={excluir.isPending} onClick={() => excluir.mutate(sessao.id)}>Excluir</Button>
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
            {regioesHist.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {regioesHist.map(r => (
                  <button key={r} type="button" onClick={() => setRegEvo(r)} aria-pressed={r === regEvoAtual} className={cn('rounded-full border px-3 py-1 text-sm', r === regEvoAtual ? 'border-primary bg-primary/10 font-medium' : 'border-border text-muted-foreground hover:bg-muted')}>{REGIOES[r]?.l}</button>
                ))}
              </div>
            )}
            {evolucao.length < 2 ? (
              <Card className="p-8 text-center text-sm text-muted-foreground">A evolução aparece a partir da segunda avaliação da mesma articulação.</Card>
            ) : (
              <>
                <Card className="p-4 space-y-2">
                  <p className="font-semibold text-sm">Simetria entre lados · {REvo.l}</p>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={evolucao} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
                        <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="data" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis domain={[(min: number) => Math.min(60, Math.floor(min / 10) * 10), 100]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: any, n: any) => [`${fmt(Number(v), 0)}%`, n === 'lsiAg' ? REvo.ag : REvo.an]} />
                        <Legend formatter={v => (v === 'lsiAg' ? REvo.ag : REvo.an)} wrapperStyle={{ fontSize: 12 }} />
                        <ReferenceLine y={crit.lsiAdequado} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" label={{ value: `Adequado (${crit.lsiAdequado}%)`, position: 'insideTopLeft', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                        <Line dataKey="lsiAg" stroke="#0F766E" strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} connectNulls />
                        <Line dataKey="lsiAn" stroke="#7C3AED" strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {(['ag', 'an'] as const).map(g => (
                    <Card key={g} className="p-4 space-y-2 min-w-0">
                      <p className="font-semibold text-sm">Pico · {g === 'ag' ? REvo.ag : REvo.an} ({u})</p>
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
                  <p className="font-semibold text-sm">Histórico · {REvo.l}</p>
                  <div className="overflow-x-auto rounded-lg border border-border/50">
                    <table className="w-full text-sm min-w-[680px]">
                      <thead className="bg-muted/50 text-xs text-muted-foreground">
                        <tr>{['Data', ...SLOTS.map(k => `${nomeSlot(regEvoAtual, k)} (${u})`), `Simetria ${REvo.ag}`, `Simetria ${REvo.an}`].map(h => <th key={h} className="px-2.5 py-2 text-left font-semibold whitespace-nowrap">{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {[...evolucao].reverse().map((e, i, arr) => {
                          const prev = arr[i + 1];
                          return (
                            <tr key={e.dataFull + i} className="border-t border-border/40">
                              <td className="px-2.5 py-2 whitespace-nowrap">{dataBR(e.dataFull)}</td>
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
              <p className="font-semibold">Critérios das valências</p>
              <p className="text-sm text-muted-foreground max-w-3xl">Cada valência (simetria, agonista × antagonista, fadiga e estabilidade) é classificada separadamente, sem nota única: até o primeiro limite fica verde, entre os dois limites fica amarelo e além do segundo fica vermelho. A simetria ≥ 90% e as referências das razões vêm da literatura; as faixas de fadiga e oscilação são do serviço e podem ser ajustadas. Os critérios ficam salvos neste aparelho.</p>
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
                <li><b className="text-foreground">Pico:</b> maior média móvel de 50 ms da melhor repetição, descontada a linha de base (5º percentil do registro). No modo "só os picos", o maior valor digitado.</li>
                <li><b className="text-foreground">Início da contração:</b> primeiro ponto acima de 2% do pico ou de 3 desvios padrão da linha de base. Tempo até o pico e RFD contam a partir dele.</li>
                <li><b className="text-foreground">RFD 0–100 e 0–200 ms:</b> ganho de força nesses intervalos ÷ tempo. Só é calculada com amostragem de pelo menos 50 Hz.</li>
                <li><b className="text-foreground">Índice de fadiga:</b> (maior média de 1 s − média do último segundo do platô) ÷ maior média × 100. Exige platô acima de 50% do pico por {crit.platoMin} s ou mais.</li>
                <li><b className="text-foreground">Oscilação:</b> desvio dos valores em torno da reta de tendência do platô ÷ média × 100. Separa instabilidade da queda por fadiga.</li>
                <li><b className="text-foreground">Força esperada:</b> média e desvio padrão de McKay et al. (2017) para idade e sexo; faixa normal = média ± 1 DP. Revisões mais recentes de valores com dinamômetro manual: Machado et al. (2025) e Benfica et al. (2018).</li>
                <li><b className="text-foreground">Simetria:</b> lado acometido ÷ lado sadio; sem lado acometido, menor ÷ maior. ≥ 90% é o critério de retorno ao esporte (Grindem et al., 2016; Kyritsis et al., 2016). Os cortes de 10–15% são os mais usados, mas com pouca evidência (Parkinson et al., 2021).</li>
                <li><b className="text-foreground">Razão agonista × antagonista:</b> comparada à razão das médias de McKay et al. (2017) para idade e sexo. No joelho isso dá I/Q isométrica ≈ 0,5, em linha com Ishøi et al. (2021) e Taketomi et al. (2024); o "ideal de 60–70%" vem de teste isocinético e não se aplica ao isométrico. No quadril, adução/abdução ≥ 0,80 (Tyler et al., 2001).</li>
                <li><b className="text-foreground">Fadiga e oscilação:</b> não há valores normais publicados para esse teste; as faixas são do serviço e servem para comparar o paciente com ele mesmo.</li>
              </ul>
            </Card>
            <Card className="p-4 space-y-2 text-sm">
              <p className="font-semibold">Referências científicas</p>
              <p className="text-xs text-muted-foreground">Conferidas no PubMed em 03/10/2026. Toque para abrir o artigo.</p>
              <ol className="list-decimal pl-5 space-y-1.5 max-w-4xl">
                {REFERENCIAS.map(x => (
                  <li key={x.id}>
                    <a className="underline" href={linkPubMed(x.pmid)} target="_blank" rel="noopener noreferrer">{x.completa}</a>
                    <span className="text-muted-foreground"> PMID {x.pmid}{x.doi ? ` · doi ${x.doi}` : ''}</span>
                    <span className="block text-xs text-muted-foreground">{x.uso}</span>
                  </li>
                ))}
              </ol>
            </Card>
          </TabsContent>
        </Tabs>
        {id && <p className="text-xs text-muted-foreground">As avaliações ficam nos <Link className="underline" to={`/pacientes/${id}`}>exames presenciais do paciente</Link> e o resumo entra nos planos de IA.</p>}
      </div>
      <PreviaPdfDialog arquivo={previaPdf} titulo={previaPdf?.titulo || ''} onClose={() => setPreviaPdf(null)} />
      <ExecucaoProtocoloDialog
        open={protoAberto}
        onOpenChange={setProtoAberto}
        etapas={etapasExec}
        config={configProto}
        modo="teste"
        onEtapa={(ck, r) => receberCaptura(ck, { t: r.t, fN: r.fN, nome: statusCelula.conectado ? statusCelula.nome : 'Célula' })}
        onFim={() => toast.success('Teste concluído. Confira as curvas e toque em "Analisar e salvar".')}
      />
      <CapturaCelulaDialog
        open={!!capturaCk}
        onOpenChange={(v) => { if (!v) setCapturaCk(null); }}
        titulo={capturaCk ? nomeSlot(capturaCk.split(':')[0], capturaCk.split(':')[1] as Slot) : ''}
        onConcluir={(c) => { if (capturaCk) receberCaptura(capturaCk, c); }}
      />
    </AppLayout>
  );
}
