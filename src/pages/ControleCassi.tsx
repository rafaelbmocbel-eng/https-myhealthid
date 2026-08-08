import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gerarDatasSessoes } from '@/lib/feriados';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Loader2, FileText, Save, Trash2, ClipboardList, AlertTriangle, CalendarClock, CheckCircle2, Circle, Download, UserPlus, Search, Pencil, CreditCard, Phone, Settings, Copy, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { CODIGOS_CASSI, statusPaciente, precisaNovaGuia, sessoesRestantes, type GuiaCassi, type GuiaStatus } from '@/lib/cassiGuias';

interface Paciente { id: string; nome: string; sobrenome: string | null; email: string | null; telefone: string | null; carteirinha: string | null; codigos_cassi: string[]; }

// Rascunho do formulário de guia.
interface DraftGuia {
  id?: string;
  matricula: string;
  numero_guia: string;
  data_pedido: string;
  data_resposta: string;
  sessoes_autorizadas: number;
  sessoes_realizadas: number;
  diagnostico: string;
  responsavel_tecnico: string;
  codigos: string[];
  status: GuiaStatus;
  observacoes: string;
}

const hojeISO = () => new Date().toISOString().slice(0, 10);

interface CodigoCfg { codigo: string; descricao: string; valor: number; }
interface ResponsavelCfg { nome: string; percentual: number; }

// Configuração CASSI do profissional (códigos com valor + imposto por guia +
// responsáveis/repasse). Se ainda não configurou, cai nos códigos padrão com valor 0.
function useCassiConfig() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['cassi-config', user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any).from('cassi_config')
        .select('codigos, imposto_por_guia, responsaveis').eq('terapeuta_id', user!.id).maybeSingle();
      const codigos: CodigoCfg[] = Array.isArray(data?.codigos) && data.codigos.length
        ? data.codigos
        : CODIGOS_CASSI.map((c) => ({ codigo: c.codigo, descricao: c.descricao, valor: 0 }));
      const responsaveis: ResponsavelCfg[] = Array.isArray(data?.responsaveis) ? data.responsaveis : [];
      return { codigos, responsaveis, imposto_por_guia: Number(data?.imposto_por_guia || 0) };
    },
    enabled: !!user,
  });
}

const fmtBRL = (v: number) => `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;
// Valor bruto de uma guia num mês: 144 (avaliação) conta 1x; os demais códigos por
// sessão realizada. `valorDe` resolve o valor de cada código pela config.
function brutoGuia(codigos: Array<{ codigo: string }>, sessoes: number, valorDe: (c: string) => number): number {
  const cods = (codigos || []).map((c) => c.codigo);
  const porSessao = cods.filter((c) => c !== '144').reduce((s, c) => s + valorDe(c), 0);
  const av = cods.includes('144') && sessoes >= 1 ? valorDe('144') : 0;
  return sessoes * porSessao + av;
}

export default function ControleCassi() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editando, setEditando] = useState<{ paciente: Paciente; guia: GuiaCassi | null } | null>(null);
  const [view, setView] = useState<'painel' | 'planilha' | 'financeiro'>('painel');
  // Sub-aba do painel: guias ativas (padrão, "em linha" com controle de sessões)
  // ou a lista completa de pacientes.
  const [aba, setAba] = useState<'ativas' | 'pacientes'>('ativas');
  const [busca, setBusca] = useState('');
  const [cadastro, setCadastro] = useState<Paciente | 'novo' | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [pedidosOpen, setPedidosOpen] = useState(false);

  // Pacientes CASSI do profissional.
  const { data: pacientes = [], isLoading: loadingPac } = useQuery({
    queryKey: ['cassi-pacientes', user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('pacientes')
        .select('id, nome, sobrenome, email, telefone, carteirinha, codigos_cassi')
        .eq('terapeuta_id', user!.id)
        .eq('ativo', true)
        // Mesmo critério da aba Pacientes: qualquer plano_saude que contenha "cassi"
        // (independe de maiúscula/minúscula/grafia). Antes era .eq('CASSI') exato,
        // que escondia clientes gravados como "Cassi", via convênio, etc.
        .ilike('plano_saude', '%cassi%')
        .order('nome', { ascending: true });
      if (error) throw error;
      return (data || []) as Paciente[];
    },
    enabled: !!user,
  });

  // Todas as guias do profissional (agrupamos por paciente no cliente).
  const { data: guias = [], isLoading: loadingGuias } = useQuery({
    queryKey: ['guias-cassi', user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('guias_cassi')
        .select('*, pacientes(nome, sobrenome)')
        .eq('terapeuta_id', user!.id)
        .order('data_pedido', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Array<GuiaCassi & { pacientes?: { nome: string; sobrenome: string | null } }>;
    },
    enabled: !!user,
  });

  // Guia mais recente por paciente.
  const guiaPorPaciente = useMemo(() => {
    const m = new Map<string, GuiaCassi>();
    for (const g of guias) if (!m.has(g.paciente_id)) m.set(g.paciente_id, g);
    return m;
  }, [guias]);

  const linhas = useMemo(() =>
    pacientes.map((p) => {
      const guia = guiaPorPaciente.get(p.id) || null;
      return { paciente: p, guia, status: statusPaciente(guia) };
    }), [pacientes, guiaPorPaciente]);

  const pedidosDoMes = useMemo(() => linhas.filter((l) => precisaNovaGuia(l.guia)), [linhas]);
  const guiasAtivasLista = useMemo(() => guias.filter((g) => g.status === 'ativa'), [guias]);
  const guiasAtivas = guiasAtivasLista.length;

  // Paciente por id (para montar o objeto ao abrir/editar guia a partir da linha da guia).
  const pacienteById = useMemo(() => new Map(pacientes.map((p) => [p.id, p])), [pacientes]);
  const pacDaGuia = (g: GuiaCassi & { pacientes?: { nome: string; sobrenome: string | null } }): Paciente =>
    pacienteById.get(g.paciente_id) || {
      id: g.paciente_id, nome: g.pacientes?.nome || 'Paciente', sobrenome: g.pacientes?.sobrenome ?? null,
      email: null, telefone: null, carteirinha: null, codigos_cassi: [],
    };

  // Guias ativas filtradas pela busca (por nome do paciente).
  const ativasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return guiasAtivasLista;
    return guiasAtivasLista.filter((g) =>
      `${g.pacientes?.nome || ''} ${g.pacientes?.sobrenome || ''}`.toLowerCase().includes(q));
  }, [guiasAtivasLista, busca]);

  // Filtro de busca (nome, carteirinha ou telefone).
  const linhasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return linhas;
    return linhas.filter((l) => {
      const p = l.paciente;
      return `${p.nome} ${p.sobrenome || ''}`.toLowerCase().includes(q)
        || (p.carteirinha || '').toLowerCase().includes(q)
        || (p.telefone || '').toLowerCase().includes(q);
    });
  }, [linhas, busca]);

  const loading = loadingPac || loadingGuias;

  return (
    <div className="min-h-[100dvh] bg-muted/30">
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b border-border/50" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-3xl mx-auto px-3 py-2.5 flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
          <div className="ml-2 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold">Controle CASSI</span>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
              <button onClick={() => setView('painel')}
                className={`text-[12px] px-2.5 py-1 rounded-md font-medium ${view === 'painel' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>
                Painel
              </button>
              <button onClick={() => setView('planilha')}
                className={`text-[12px] px-2.5 py-1 rounded-md font-medium ${view === 'planilha' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>
                Planilha
              </button>
              <button onClick={() => setView('financeiro')}
                className={`text-[12px] px-2.5 py-1 rounded-md font-medium ${view === 'financeiro' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>
                Mês
              </button>
            </div>
            <Button size="icon" variant="ghost" className="h-8 w-8" title="Configurações CASSI" onClick={() => setConfigOpen(true)}>
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className={`${view === 'painel' ? 'max-w-3xl' : 'max-w-5xl'} mx-auto p-3 space-y-4`}>
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : view === 'financeiro' ? (
          <FinanceiroCassi />
        ) : view === 'planilha' ? (
          <PlanilhaGuias
            guias={guias}
            onAbrir={(g) => setEditando({ paciente: { id: g.paciente_id, nome: g.pacientes?.nome || 'Paciente', sobrenome: g.pacientes?.sobrenome ?? null, email: null, telefone: null, carteirinha: null, codigos_cassi: [] }, guia: g })}
          />
        ) : (
          <>
            {/* Resumo + navegação (a "primeira página"). Os números são botões:
                Clientes → lista de pacientes; Guias ativas → guias em linha;
                Pedir guia → abre a lista com a mensagem pronta pro WhatsApp. */}
            <div className="rounded-xl border border-border/50 bg-background p-3 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => setAba('pacientes')}
                  className={`rounded-lg border p-2 text-left transition-colors ${aba === 'pacientes' ? 'border-primary/50 bg-primary/5' : 'border-border/50 hover:bg-muted/50'}`}>
                  <p className="text-2xl font-black tabular-nums leading-none">{pacientes.length}</p>
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wide mt-0.5">Pacientes</p>
                </button>
                <button onClick={() => setAba('ativas')}
                  className={`rounded-lg border p-2 text-left transition-colors ${aba === 'ativas' ? 'border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/20' : 'border-border/50 hover:bg-muted/50'}`}>
                  <p className="text-2xl font-black tabular-nums leading-none text-emerald-600">{guiasAtivas}</p>
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wide mt-0.5">Guias ativas</p>
                </button>
                <button onClick={() => setPedidosOpen(true)} disabled={pedidosDoMes.length === 0}
                  className={`rounded-lg border p-2 text-left transition-colors ${pedidosDoMes.length > 0 ? 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100 dark:hover:bg-amber-900/30' : 'border-border/50 opacity-60'}`}>
                  <p className="text-2xl font-black tabular-nums leading-none text-amber-600">{pedidosDoMes.length}</p>
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wide mt-0.5">Pedir guia ›</p>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="h-4 w-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <Input className="h-9 pl-8" placeholder="Encontrar cliente (nome, carteirinha ou telefone)…"
                    value={busca} onChange={(e) => setBusca(e.target.value)} />
                </div>
                <Button size="sm" className="gap-1.5 h-9 shrink-0" onClick={() => setCadastro('novo')}>
                  <UserPlus className="h-4 w-4" /> <span className="hidden sm:inline">Cadastrar cliente</span>
                </Button>
              </div>
            </div>

            {/* Pedidos do mês — banner-atalho pra mensagem do WhatsApp */}
            {pedidosDoMes.length > 0 && (
              <button onClick={() => setPedidosOpen(true)}
                className="w-full rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-3 flex items-center gap-2 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="text-sm font-bold text-amber-800 dark:text-amber-300 flex-1 text-left">
                  Pacientes para nova guia — {pedidosDoMes.length} · mensagem pronta pro WhatsApp
                </span>
                <span className="text-[11px] text-amber-700 dark:text-amber-400 shrink-0">abrir ›</span>
              </button>
            )}

            {aba === 'ativas' ? (
              /* Guias ativas "em linha" — controle de sessões */
              ativasFiltradas.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  Nenhuma guia ativa{busca ? ' para esta busca' : ''}.
                </p>
              ) : (
                <div className="space-y-2">
                  {ativasFiltradas.map((g) => {
                    const aut = g.sessoes_autorizadas || 0;
                    const real = g.sessoes_realizadas || 0;
                    const restantes = Math.max(0, aut - real);
                    const pct = aut > 0 ? Math.min(100, Math.round((real / aut) * 100)) : 0;
                    return (
                      <div key={g.id} className="rounded-xl border border-border/50 bg-background px-3 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate">{g.pacientes?.nome} {g.pacientes?.sobrenome || ''}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <div className="h-1.5 flex-1 max-w-[140px] rounded-full bg-muted overflow-hidden">
                                <div className={`h-full ${restantes <= 2 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{real}/{aut} sessões</span>
                              {restantes <= 2 && (
                                <Badge className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                  {restantes === 0 ? 'acabou' : `faltam ${restantes}`}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-[12px]" onClick={() => setEditando({ paciente: pacDaGuia(g), guia: g })}>
                              <FileText className="h-3.5 w-3.5" /> Ver guia
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-[12px]" onClick={() => setEditando({ paciente: pacDaGuia(g), guia: null })}>
                              <Plus className="h-3.5 w-3.5" /> Nova guia
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              /* Lista completa de pacientes CASSI */
              linhasFiltradas.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">Nenhum cliente encontrado.</p>
              ) : (
                <div className="space-y-2">
                  {linhasFiltradas.map(({ paciente, guia, status }) => (
                    <div key={paciente.id} className="rounded-xl border border-border/50 bg-background p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">{paciente.nome} {paciente.sobrenome || ''}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <Badge className={`text-[10px] ${status.cls}`}>{status.label}</Badge>
                            {guia && (
                              <span className="text-[11px] text-muted-foreground tabular-nums">
                                {guia.sessoes_realizadas}/{guia.sessoes_autorizadas} sessões
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
                            {paciente.carteirinha && <span className="inline-flex items-center gap-1"><CreditCard className="h-3 w-3" /> {paciente.carteirinha}</span>}
                            {paciente.telefone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {paciente.telefone}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button size="icon" variant="ghost" className="h-8 w-8" title="Editar cadastro" onClick={() => setCadastro(paciente)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {guia && (
                            <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-[12px]" onClick={() => setEditando({ paciente, guia })}>
                              <FileText className="h-3.5 w-3.5" /> Ver guia
                            </Button>
                          )}
                          <Button size="sm" variant={guia ? 'outline' : 'default'} className="h-8 gap-1.5 text-[12px]" onClick={() => setEditando({ paciente, guia: null })}>
                            <Plus className="h-3.5 w-3.5" /> Nova guia
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </>
        )}
      </div>

      {editando && (
        <GuiaEditor
          paciente={editando.paciente}
          guia={editando.guia}
          ultimaGuia={guiaPorPaciente.get(editando.paciente.id) || null}
          onClose={() => setEditando(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['guias-cassi', user?.id] });
            setEditando(null);
          }}
        />
      )}

      {cadastro && (
        <PacienteCassiEditor
          paciente={cadastro === 'novo' ? null : cadastro}
          onClose={() => setCadastro(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['cassi-pacientes', user?.id] });
            setCadastro(null);
          }}
        />
      )}

      {configOpen && <ConfigCassiDialog onClose={() => setConfigOpen(false)} />}

      {pedidosOpen && (
        <PedidosDialog
          linhas={pedidosDoMes}
          onClose={() => setPedidosOpen(false)}
          onNovaGuia={(pac) => { setPedidosOpen(false); setEditando({ paciente: pac, guia: null }); }}
        />
      )}
    </div>
  );
}

function GuiaEditor({ paciente, guia, ultimaGuia, onClose, onSaved }: {
  paciente: Paciente;
  guia: GuiaCassi | null;
  ultimaGuia: GuiaCassi | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const editandoExistente = !!guia;
  // Nova guia pré-preenche diagnóstico/responsável/códigos da última guia (PDF 4.8).
  const base = guia || ultimaGuia;
  const [d, setD] = useState<DraftGuia>(() => ({
    id: guia?.id,
    matricula: (guia ?? base)?.matricula || '',
    numero_guia: guia?.numero_guia || '',
    data_pedido: guia?.data_pedido || hojeISO(),
    data_resposta: guia?.data_resposta || '',
    sessoes_autorizadas: guia?.sessoes_autorizadas ?? 0,
    sessoes_realizadas: guia?.sessoes_realizadas ?? 0,
    diagnostico: (guia ?? base)?.diagnostico || '',
    responsavel_tecnico: (guia ?? base)?.responsavel_tecnico || '',
    codigos: (guia ?? base)?.codigos?.map((c) => c.codigo)
      || (paciente.codigos_cassi?.length ? paciente.codigos_cassi : ['012']),
    status: guia?.status || 'aguardando',
    observacoes: guia?.observacoes || '',
  }));

  const set = <K extends keyof DraftGuia>(k: K, v: DraftGuia[K]) => setD((p) => ({ ...p, [k]: v }));
  const toggleCodigo = (codigo: string) =>
    setD((p) => ({ ...p, codigos: p.codigos.includes(codigo) ? p.codigos.filter((c) => c !== codigo) : [...p.codigos, codigo] }));

  const qc = useQueryClient();
  const { data: cfg } = useCassiConfig();
  const codigosDisp: CodigoCfg[] = cfg?.codigos ?? CODIGOS_CASSI.map((c) => ({ codigo: c.codigo, descricao: c.descricao, valor: 0 }));

  // Fase 2 — sessões (agendamentos REAIS) ligadas a esta guia.
  const { data: sessoes = [] } = useQuery({
    queryKey: ['guia-sessoes', guia?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('agendamentos')
        .select('id, data_inicio, status').eq('guia_cassi_id', guia!.id)
        .order('data_inicio', { ascending: true });
      if (error) throw error;
      return (data || []) as Array<{ id: string; data_inicio: string; status: string }>;
    },
    enabled: !!guia?.id,
  });

  // Contagem por DIAS DISTINTOS (1 dia = 1 sessão), como o PDF exige.
  const geradas = useMemo(() => new Set(sessoes.map((s) => s.data_inicio.slice(0, 10))).size, [sessoes]);
  const realizadas = useMemo(() => {
    const agora = Date.now();
    return new Set(
      sessoes.filter((s) => new Date(s.data_inicio).getTime() < agora && s.status !== 'cancelado')
        .map((s) => s.data_inicio.slice(0, 10)),
    ).size;
  }, [sessoes]);

  const [gerForm, setGerForm] = useState({ inicio: guia?.data_resposta || guia?.data_pedido || hojeISO(), horario: '08:00' });

  const gerarAgenda = useMutation({
    mutationFn: async () => {
      if (!user || !guia?.id) throw new Error('Salve a guia antes de gerar a agenda.');
      const faltam = Math.max(0, (guia.sessoes_autorizadas || 0) - geradas);
      if (faltam <= 0) throw new Error('Todas as sessões autorizadas já estão na agenda.');
      const [hh, mm] = (gerForm.horario || '08:00').split(':').map((n) => parseInt(n, 10));
      const datas = gerarDatasSessoes(new Date(`${gerForm.inicio}T00:00:00`), faltam, [1, 3, 5]);
      const rows = datas.map((dt) => {
        const ini = new Date(dt); ini.setHours(hh || 8, mm || 0, 0, 0);
        const fim = new Date(ini.getTime() + 45 * 60000);
        return {
          terapeuta_id: user.id, paciente_id: paciente.id,
          data_inicio: ini.toISOString(), data_fim: fim.toISOString(),
          status: 'confirmado', tipo_atendimento: 'retorno',
          titulo: `Sessão CASSI${guia.numero_guia ? ` · guia ${guia.numero_guia}` : ''}`,
          guia_cassi_id: guia.id, cor: '#0ea5e9',
        };
      });
      const { error } = await (supabase as any).from('agendamentos').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Agenda de sessões gerada'); qc.invalidateQueries({ queryKey: ['guia-sessoes', guia?.id] }); },
    onError: (e: any) => toast.error(e.message || 'Erro ao gerar agenda'),
  });

  // Mantém a contagem de realizadas (datas que já passaram) sincronizada na guia,
  // para o selo de status ficar correto. O ref evita repetir a mesma escrita.
  const sincRef = useRef<number | null>(null);
  useEffect(() => {
    if (guia?.id && geradas > 0 && realizadas !== guia.sessoes_realizadas && sincRef.current !== realizadas) {
      sincRef.current = realizadas;
      (supabase as any).from('guias_cassi')
        .update({ sessoes_realizadas: realizadas, updated_at: new Date().toISOString() })
        .eq('id', guia.id)
        .then(() => qc.invalidateQueries({ queryKey: ['guias-cassi'] }));
    }
  }, [realizadas, geradas, guia?.id, guia?.sessoes_realizadas, qc]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Sem sessão');
      const sb: any = supabase;
      const codigos = codigosDisp.filter((c) => d.codigos.includes(c.codigo)).map((c) => ({ codigo: c.codigo, descricao: c.descricao }));
      const payload = {
        matricula: d.matricula || null,
        numero_guia: d.numero_guia || null,
        data_pedido: d.data_pedido || hojeISO(),
        data_resposta: d.data_resposta || null,
        sessoes_autorizadas: Number(d.sessoes_autorizadas) || 0,
        // Se há sessões na agenda, a contagem de realizadas vem delas (automática).
        sessoes_realizadas: geradas > 0 ? realizadas : (Number(d.sessoes_realizadas) || 0),
        diagnostico: d.diagnostico || null,
        responsavel_tecnico: d.responsavel_tecnico || null,
        codigos,
        status: d.status,
        observacoes: d.observacoes || null,
      };

      if (editandoExistente) {
        const { error } = await sb.from('guias_cassi')
          .update({ ...payload, updated_at: new Date().toISOString() }).eq('id', guia!.id);
        if (error) throw error;
      } else {
        // Nova guia: as guias anteriores em aberto viram finalizada (PDF 4.7).
        await sb.from('guias_cassi')
          .update({ status: 'finalizada', updated_at: new Date().toISOString() })
          .eq('paciente_id', paciente.id).eq('terapeuta_id', user.id).in('status', ['aguardando', 'ativa']);
        const { error } = await sb.from('guias_cassi').insert({
          terapeuta_id: user.id,
          paciente_id: paciente.id,
          ...payload,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(editandoExistente ? 'Guia atualizada' : 'Guia criada'); onSaved(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar'),
  });

  const excluir = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from('guias_cassi').delete().eq('id', guia!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Guia excluída'); onSaved(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao excluir'),
  });

  const realizadasEfetivas = geradas > 0 ? realizadas : (Number(d.sessoes_realizadas) || 0);
  const restantes = sessoesRestantes({ sessoes_autorizadas: Number(d.sessoes_autorizadas) || 0, sessoes_realizadas: realizadasEfetivas });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg w-[95vw] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            {editandoExistente ? 'Guia' : 'Nova guia'} — {paciente.nome} {paciente.sobrenome || ''}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Nº da guia</label>
              <Input value={d.numero_guia} onChange={(e) => set('numero_guia', e.target.value)} placeholder="ex: 123456" />
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Matrícula</label>
              <Input value={d.matricula} onChange={(e) => set('matricula', e.target.value)} placeholder="matrícula CASSI" />
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Responsável técnico</label>
              <Input value={d.responsavel_tecnico} onChange={(e) => set('responsavel_tecnico', e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Data do pedido</label>
              <Input type="date" value={d.data_pedido} onChange={(e) => set('data_pedido', e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Data resposta CASSI</label>
              <Input type="date" value={d.data_resposta} onChange={(e) => set('data_resposta', e.target.value)} />
              <p className="text-[10px] text-muted-foreground mt-0.5">Vazio = aguardando CASSI</p>
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Sessões autorizadas</label>
              <Input type="number" min={0} value={d.sessoes_autorizadas} onChange={(e) => set('sessoes_autorizadas', parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Sessões realizadas</label>
              <Input type="number" min={0}
                value={geradas > 0 ? realizadas : d.sessoes_realizadas}
                disabled={geradas > 0}
                onChange={(e) => set('sessoes_realizadas', parseInt(e.target.value) || 0)} />
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {geradas > 0 ? 'Conta automática pela agenda · ' : ''}Restam {restantes}
              </p>
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Diagnóstico</label>
            <Input value={d.diagnostico} onChange={(e) => set('diagnostico', e.target.value)} />
          </div>

          <div>
            <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Códigos</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {codigosDisp.map((c) => {
                const ativo = d.codigos.includes(c.codigo);
                return (
                  <button key={c.codigo} type="button" onClick={() => toggleCodigo(c.codigo)}
                    className={`text-[11px] px-2 py-1 rounded-full border ${ativo ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground'}`}>
                    {c.codigo} · {c.descricao}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Status da guia</label>
              <Select value={d.status} onValueChange={(v) => set('status', v as GuiaStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aguardando">Aguardando</SelectItem>
                  <SelectItem value="ativa">Ativa</SelectItem>
                  <SelectItem value="finalizada">Finalizada</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Observações</label>
            <Textarea rows={2} value={d.observacoes} onChange={(e) => set('observacoes', e.target.value)} />
          </div>

          {/* Agenda de sessões (fase 2) — só para guia já salva */}
          {editandoExistente ? (
            <div className="rounded-lg border border-sky-200 dark:border-sky-900 bg-sky-50/60 dark:bg-sky-950/20 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-sky-600" />
                <span className="text-sm font-bold text-sky-800 dark:text-sky-300">Agenda de sessões</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {geradas} de {d.sessoes_autorizadas} na agenda · <strong>{realizadas} realizadas</strong>. As sessões viram
                agendamentos reais (aparecem na Agenda) e as realizadas contam sozinhas pelas datas que já passaram.
              </p>

              {geradas < (Number(d.sessoes_autorizadas) || 0) && (
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Início</label>
                    <Input type="date" className="h-8" value={gerForm.inicio} onChange={(e) => setGerForm((p) => ({ ...p, inicio: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Horário</label>
                    <Input type="time" className="h-8 w-24" value={gerForm.horario} onChange={(e) => setGerForm((p) => ({ ...p, horario: e.target.value }))} />
                  </div>
                  <Button size="sm" className="h-8 gap-1.5" disabled={gerarAgenda.isPending} onClick={() => gerarAgenda.mutate()}>
                    {gerarAgenda.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="h-3.5 w-3.5" />}
                    Gerar {Math.max(0, (Number(d.sessoes_autorizadas) || 0) - geradas)} sessões (seg/qua/sex)
                  </Button>
                </div>
              )}

              {sessoes.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1 pt-1">
                  {sessoes.map((s) => {
                    const passou = new Date(s.data_inicio).getTime() < Date.now() && s.status !== 'cancelado';
                    return (
                      <div key={s.id} className="flex items-center gap-2 text-[12px]">
                        {passou
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          : <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                        <span className={passou ? 'text-foreground' : 'text-muted-foreground'}>
                          {new Date(s.data_inicio).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                          {' · '}{new Date(s.data_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {s.status === 'cancelado' && <span className="text-[10px] text-destructive">cancelada</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground rounded-lg border border-dashed border-border/60 p-2">
              💡 Salve a guia e reabra em <strong>Ver guia</strong> para gerar a agenda de sessões (dias úteis).
            </p>
          )}

          <div className="flex gap-2 pt-1">
            {editandoExistente && (
              <Button variant="ghost" size="icon" className="shrink-0" title="Excluir guia"
                disabled={excluir.isPending}
                onClick={() => { if (confirm('Excluir esta guia?')) excluir.mutate(); }}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1 gap-1.5" disabled={salvar.isPending} onClick={() => salvar.mutate()}>
              {salvar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type GuiaComPaciente = GuiaCassi & { pacientes?: { nome: string; sobrenome: string | null } };

const GUIA_STATUS_CLS: Record<GuiaStatus, string> = {
  aguardando: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  ativa: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  finalizada: 'bg-muted text-muted-foreground',
  cancelada: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

function fmtData(d: string | null): string {
  if (!d) return '—';
  const [y, m, dd] = d.slice(0, 10).split('-');
  return `${dd}/${m}/${y}`;
}

// Visão PANORÂMICA — todas as guias em tabela, com busca, filtro de status e CSV.
function PlanilhaGuias({ guias, onAbrir }: { guias: GuiaComPaciente[]; onAbrir: (g: GuiaComPaciente) => void }) {
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<'todos' | GuiaStatus>('todos');

  const nomeDe = (g: GuiaComPaciente) => `${g.pacientes?.nome || ''} ${g.pacientes?.sobrenome || ''}`.trim() || '—';
  const codigosDe = (g: GuiaComPaciente) => (g.codigos || []).map((c) => c.codigo).join(', ');

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return guias.filter((g) => {
      if (statusFiltro !== 'todos' && g.status !== statusFiltro) return false;
      if (!q) return true;
      return nomeDe(g).toLowerCase().includes(q) || (g.matricula || '').toLowerCase().includes(q);
    });
  }, [guias, busca, statusFiltro]);

  const exportarCSV = () => {
    const header = ['Paciente', 'Matrícula', 'Status', 'Códigos', 'Autorização', 'Avaliação', 'Realizadas', 'Autorizadas'];
    const cell = (v: unknown) => {
      const s = String(v ?? '');
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const linhas = filtradas.map((g) => [
      nomeDe(g), g.matricula || '', g.status, codigosDe(g),
      fmtData(g.data_resposta), fmtData(g.data_pedido),
      g.sessoes_realizadas, g.sessoes_autorizadas,
    ]);
    const csv = [header, ...linhas].map((r) => r.map(cell).join(';')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `guias-cassi-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-lg font-bold">Planilha</h1>
          <p className="text-[11px] text-muted-foreground">Todas as guias em tabela. Busque, filtre e exporte.</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={exportarCSV} disabled={filtradas.length === 0}>
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Input className="h-9 flex-1 min-w-[180px]" placeholder="Buscar paciente ou matrícula…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <Select value={statusFiltro} onValueChange={(v) => setStatusFiltro(v as 'todos' | GuiaStatus)}>
          <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="aguardando">Aguardando</SelectItem>
            <SelectItem value="ativa">Ativa</SelectItem>
            <SelectItem value="finalizada">Finalizada</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-[12px] text-muted-foreground shrink-0 tabular-nums">
          {filtradas.length} guia(s) · {new Set(filtradas.map((g) => g.paciente_id)).size} cliente(s)
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/50 bg-background">
        <table className="w-full text-[12.5px]">
          <thead className="bg-muted/50 text-[10px] uppercase text-muted-foreground">
            <tr>
              <th className="text-left font-semibold px-3 py-2">Paciente</th>
              <th className="text-left font-semibold px-3 py-2">Matrícula</th>
              <th className="text-left font-semibold px-3 py-2">Status</th>
              <th className="text-left font-semibold px-3 py-2">Códigos</th>
              <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Sessões</th>
              <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Autorização</th>
              <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Avaliação</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma guia.</td></tr>
            ) : filtradas.map((g) => (
              <tr key={g.id} className="border-t border-border/40 hover:bg-muted/30 cursor-pointer" onClick={() => onAbrir(g)}>
                <td className="px-3 py-2 font-medium">{nomeDe(g)}</td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground whitespace-nowrap">{g.matricula || '—'}</td>
                <td className="px-3 py-2"><Badge className={`text-[10px] ${GUIA_STATUS_CLS[g.status]}`}>{g.status}</Badge></td>
                <td className="px-3 py-2 whitespace-nowrap">{codigosDe(g) || '—'}</td>
                <td className="px-3 py-2 tabular-nums whitespace-nowrap">{g.sessoes_realizadas}/{g.sessoes_autorizadas}</td>
                <td className="px-3 py-2 tabular-nums whitespace-nowrap">{fmtData(g.data_resposta)}</td>
                <td className="px-3 py-2 tabular-nums whitespace-nowrap">{fmtData(g.data_pedido)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Cadastro/edição rápida de um cliente CASSI (nome, carteirinha, e-mail, telefone).
function PacienteCassiEditor({ paciente, onClose, onSaved }: {
  paciente: Paciente | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const { data: cfg } = useCassiConfig();
  const codigosDisp: CodigoCfg[] = cfg?.codigos ?? CODIGOS_CASSI.map((c) => ({ codigo: c.codigo, descricao: c.descricao, valor: 0 }));
  const editando = !!paciente;
  const [f, setF] = useState(() => ({
    nome: paciente?.nome || '',
    sobrenome: paciente?.sobrenome || '',
    carteirinha: paciente?.carteirinha || '',
    email: paciente?.email || '',
    telefone: paciente?.telefone || '',
  }));
  const [codigos, setCodigos] = useState<string[]>(paciente?.codigos_cassi || []);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const toggleCod = (c: string) => setCodigos((p) => p.includes(c) ? p.filter((x) => x !== c) : [...p, c]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Sem sessão');
      if (!f.nome.trim()) throw new Error('Informe o nome.');
      const sb: any = supabase;
      const payload = {
        nome: f.nome.trim(),
        sobrenome: f.sobrenome.trim() || '',
        carteirinha: f.carteirinha.trim() || null,
        email: f.email.trim() || null,
        telefone: f.telefone.replace(/\D/g, '') || null,
        codigos_cassi: codigos,
      };
      if (editando) {
        const { error } = await sb.from('pacientes').update(payload).eq('id', paciente!.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from('pacientes').insert({
          ...payload,
          terapeuta_id: user.id,
          plano_saude: 'CASSI',
          ativo: true,
          cadastro_status: 'completo',
          tipo_conta: 'clinico',
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(editando ? 'Cadastro atualizado' : 'Cliente cadastrado'); onSaved(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar'),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md w-[95vw]">
        <DialogHeader><DialogTitle className="text-base">{editando ? 'Editar cadastro' : 'Cadastrar cliente CASSI'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Nome</label>
              <Input value={f.nome} onChange={(e) => set('nome', e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Sobrenome</label>
              <Input value={f.sobrenome} onChange={(e) => set('sobrenome', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Carteirinha CASSI</label>
            <Input value={f.carteirinha} onChange={(e) => set('carteirinha', e.target.value)} placeholder="nº da carteirinha" />
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Códigos habituais</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {codigosDisp.map((c) => {
                const on = codigos.includes(c.codigo);
                return (
                  <button type="button" key={c.codigo} onClick={() => toggleCod(c.codigo)}
                    className={`text-[11px] px-2 py-1 rounded-full border ${on ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground'}`}>
                    {c.codigo} · {c.descricao}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Telefone</label>
              <Input value={f.telefone} onChange={(e) => set('telefone', e.target.value)} placeholder="DDD + número" />
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground tracking-wide">E-mail</label>
              <Input value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="para o portal" />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">Entra como CASSI, ativo. Os códigos da guia você define ao criar a guia.</p>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1 gap-1.5" disabled={salvar.isPending} onClick={() => salvar.mutate()}>
              {salvar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Configurações CASSI — códigos usados (com valor) e imposto por guia. Base do
// cálculo do mês (fase 4). Design enxuto: uma linha por código.
function ConfigCassiDialog({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: cfg, isLoading } = useCassiConfig();
  const [codigos, setCodigos] = useState<CodigoCfg[]>([]);
  const [imposto, setImposto] = useState('0');
  const [responsaveis, setResponsaveis] = useState<ResponsavelCfg[]>([]);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    if (cfg && !pronto) {
      setCodigos(cfg.codigos.map((c) => ({ ...c })));
      setImposto(String(cfg.imposto_por_guia || 0));
      setResponsaveis((cfg.responsaveis || []).map((r) => ({ ...r })));
      setPronto(true);
    }
  }, [cfg, pronto]);

  const setCod = (i: number, campo: keyof CodigoCfg, v: string) =>
    setCodigos((p) => p.map((c, idx) => idx === i ? { ...c, [campo]: campo === 'valor' ? (parseFloat(v.replace(',', '.')) || 0) : v } : c));
  const addCod = () => setCodigos((p) => [...p, { codigo: '', descricao: '', valor: 0 }]);
  const rmCod = (i: number) => setCodigos((p) => p.filter((_, idx) => idx !== i));

  const setResp = (i: number, campo: keyof ResponsavelCfg, v: string) =>
    setResponsaveis((p) => p.map((r, idx) => idx === i ? { ...r, [campo]: campo === 'percentual' ? (parseFloat(v.replace(',', '.')) || 0) : v } : r));
  const addResp = () => setResponsaveis((p) => [...p, { nome: '', percentual: 0 }]);
  const rmResp = (i: number) => setResponsaveis((p) => p.filter((_, idx) => idx !== i));

  const salvar = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Sem sessão');
      const limpos = codigos.filter((c) => c.codigo.trim())
        .map((c) => ({ codigo: c.codigo.trim(), descricao: c.descricao.trim(), valor: Number(c.valor) || 0 }));
      const respLimpos = responsaveis.filter((r) => r.nome.trim())
        .map((r) => ({ nome: r.nome.trim(), percentual: Number(r.percentual) || 0 }));
      const { error } = await (supabase as any).from('cassi_config').upsert({
        terapeuta_id: user.id,
        codigos: limpos,
        imposto_por_guia: parseFloat(imposto.replace(',', '.')) || 0,
        responsaveis: respLimpos,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'terapeuta_id' });
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Configuração salva'); qc.invalidateQueries({ queryKey: ['cassi-config', user?.id] }); onClose(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar'),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg w-[95vw] max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-base">Configurações CASSI</DialogTitle></DialogHeader>
        {isLoading || !pronto ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-bold mb-0.5">Códigos e valores</p>
              <p className="text-[11px] text-muted-foreground mb-2">Os códigos que você usa e quanto vale cada um — entram nas guias e no cálculo do mês.</p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] uppercase text-muted-foreground px-0.5">
                  <span className="w-14">Código</span><span className="flex-1">Descrição</span><span className="w-20">Valor R$</span><span className="w-7" />
                </div>
                {codigos.map((c, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Input className="h-8 w-14 text-sm" value={c.codigo} onChange={(e) => setCod(i, 'codigo', e.target.value)} placeholder="000" />
                    <Input className="h-8 flex-1 text-sm" value={c.descricao} onChange={(e) => setCod(i, 'descricao', e.target.value)} placeholder="descrição" />
                    <Input className="h-8 w-20 text-sm tabular-nums" value={String(c.valor)} onChange={(e) => setCod(i, 'valor', e.target.value)} placeholder="0,00" inputMode="decimal" />
                    <Button size="icon" variant="ghost" className="h-8 w-7 shrink-0" title="Remover" onClick={() => rmCod(i)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button size="sm" variant="outline" className="mt-2 h-8 gap-1 w-full" onClick={addCod}>
                <Plus className="h-3.5 w-3.5" /> Adicionar código
              </Button>
            </div>

            <div>
              <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Imposto por guia (R$)</label>
              <Input className="h-9 w-32" value={imposto} onChange={(e) => setImposto(e.target.value)} inputMode="decimal" placeholder="0,00" />
              <p className="text-[10px] text-muted-foreground mt-0.5">Descontado de cada guia no cálculo do mês.</p>
            </div>

            <div>
              <p className="text-sm font-bold mb-0.5">Responsáveis e repasse</p>
              <p className="text-[11px] text-muted-foreground mb-2">Quem atende e quanto (%) recebe do líquido das guias sob sua responsabilidade. O nome deve bater com o "Responsável técnico" da guia.</p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] uppercase text-muted-foreground px-0.5">
                  <span className="flex-1">Nome</span><span className="w-24">Repasse %</span><span className="w-7" />
                </div>
                {responsaveis.map((r, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Input className="h-8 flex-1 text-sm" value={r.nome} onChange={(e) => setResp(i, 'nome', e.target.value)} placeholder="Nome do responsável" />
                    <Input className="h-8 w-24 text-sm tabular-nums" value={String(r.percentual)} onChange={(e) => setResp(i, 'percentual', e.target.value)} placeholder="0" inputMode="decimal" />
                    <Button size="icon" variant="ghost" className="h-8 w-7 shrink-0" title="Remover" onClick={() => rmResp(i)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button size="sm" variant="outline" className="mt-2 h-8 gap-1 w-full" onClick={addResp}>
                <Plus className="h-3.5 w-3.5" /> Adicionar responsável
              </Button>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
              <Button className="flex-1 gap-1.5" disabled={salvar.isPending} onClick={() => salvar.mutate()}>
                {salvar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Pedidos do mês — lista dos clientes elegíveis (precisam de guia nova). O
// profissional marca quem vai pro pedido, ajusta carteirinha/diagnóstico/códigos
// (máx. 3) e gera um texto pronto para copiar (nome, carteirinha, diagnóstico, códigos).
interface ItemPedido {
  id: string; nome: string; sel: boolean;
  carteirinha: string; diagnostico: string; codigos: string[];
}
function PedidosDialog({ linhas, onClose, onNovaGuia }: {
  linhas: Array<{ paciente: Paciente; guia: GuiaCassi | null }>;
  onClose: () => void;
  onNovaGuia: (p: Paciente) => void;
}) {
  const { data: cfg } = useCassiConfig();
  const codigosDisp: CodigoCfg[] = cfg?.codigos ?? CODIGOS_CASSI.map((c) => ({ codigo: c.codigo, descricao: c.descricao, valor: 0 }));

  const [itens, setItens] = useState<ItemPedido[]>(() => linhas.map((l) => ({
    id: l.paciente.id,
    nome: `${l.paciente.nome} ${l.paciente.sobrenome || ''}`.trim(),
    sel: true,
    carteirinha: l.paciente.carteirinha || '',
    diagnostico: l.guia?.diagnostico || '',
    codigos: (l.paciente.codigos_cassi?.length ? l.paciente.codigos_cassi : (l.guia?.codigos?.map((c) => c.codigo) || [])).slice(0, 3),
  })));

  const upd = (id: string, patch: Partial<ItemPedido>) =>
    setItens((p) => p.map((it) => it.id === id ? { ...it, ...patch } : it));
  const toggleCod = (id: string, cod: string) =>
    setItens((p) => p.map((it) => {
      if (it.id !== id) return it;
      if (it.codigos.includes(cod)) return { ...it, codigos: it.codigos.filter((c) => c !== cod) };
      if (it.codigos.length >= 3) { toast.error('Máximo de 3 códigos por pedido'); return it; }
      return { ...it, codigos: [...it.codigos, cod] };
    }));

  const selecionados = itens.filter((i) => i.sel);
  // Mensagem pronta pro WhatsApp (usa *negrito* do WhatsApp e lista numerada).
  const texto = [
    `*Solicitação de novas guias CASSI* (${selecionados.length} cliente${selecionados.length === 1 ? '' : 's'})`,
    '',
    ...selecionados.map((i, idx) =>
      `${idx + 1}. *${i.nome}*\nCarteirinha: ${i.carteirinha || '—'}\nDiagnóstico: ${i.diagnostico || '—'}\nCódigos: ${i.codigos.join(', ') || '—'}`
    ),
  ].join('\n');

  const copiar = async () => {
    try { await navigator.clipboard.writeText(texto); toast.success('Texto copiado!'); }
    catch { toast.error('Não consegui copiar — selecione e copie manualmente.'); }
  };
  const enviarWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg w-[95vw] max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-base">Pedidos do mês — nova guia</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-[11px] text-muted-foreground">
            Marque quem vai entrar no pedido e ajuste carteirinha, diagnóstico e códigos (até 3). No fim, copie o texto pronto.
          </p>

          <div className="space-y-2">
            {itens.map((it) => (
              <div key={it.id} className={`rounded-lg border p-2.5 ${it.sel ? 'border-primary/40 bg-primary/5' : 'border-border/50 opacity-70'}`}>
                <div className="flex items-start gap-2">
                  <button onClick={() => upd(it.id, { sel: !it.sel })} className="mt-0.5 shrink-0" title={it.sel ? 'Tirar do pedido' : 'Incluir no pedido'}>
                    {it.sel ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                  </button>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="text-sm font-semibold truncate">{it.nome}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <Input className="h-8 text-xs" value={it.carteirinha} onChange={(e) => upd(it.id, { carteirinha: e.target.value })} placeholder="Carteirinha" />
                      <Input className="h-8 text-xs" value={it.diagnostico} onChange={(e) => upd(it.id, { diagnostico: e.target.value })} placeholder="Diagnóstico" />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {codigosDisp.map((c) => {
                        const on = it.codigos.includes(c.codigo);
                        return (
                          <button key={c.codigo} type="button" onClick={() => toggleCod(it.id, c.codigo)}
                            className={`text-[10px] px-1.5 py-0.5 rounded-full border ${on ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground'}`}>
                            {c.codigo}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 text-[11px] shrink-0" onClick={() => onNovaGuia(linhas.find((l) => l.paciente.id === it.id)!.paciente)}>
                    Criar guia
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Texto do pedido — pronto para copiar */}
          <div className="rounded-lg border border-border/50 bg-muted/30 p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Mensagem do pedido ({selecionados.length})</span>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="outline" className="h-7 gap-1.5 text-[11px]" disabled={selecionados.length === 0} onClick={copiar}>
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </Button>
                <Button size="sm" className="h-7 gap-1.5 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white" disabled={selecionados.length === 0} onClick={enviarWhatsApp}>
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </Button>
              </div>
            </div>
            <Textarea readOnly value={texto} rows={Math.min(12, Math.max(4, selecionados.length * 4))} className="text-xs font-mono bg-background" />
          </div>

          <Button variant="outline" className="w-full" onClick={onClose}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Fase 4: Cálculo do mês ────────────────────────────────────────────────
// Fechamento financeiro: para o mês escolhido, conta as sessões REALIZADAS na
// agenda de cada cliente CASSI (concluídas/confirmadas até hoje), multiplica
// pelos valores dos códigos da guia, desconta o imposto por guia e agrupa por
// responsável técnico aplicando o % de repasse. O "atendido" da agenda vira
// sessão faturada automaticamente — sem digitar de novo.
const MESES_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const mesAtualISO = () => new Date().toISOString().slice(0, 7); // YYYY-MM

function FinanceiroCassi() {
  const { user } = useAuth();
  const { data: cfg } = useCassiConfig();
  const [mes, setMes] = useState<string>(() => mesAtualISO());

  // Clientes CASSI (mesma query/cache do painel).
  const { data: pacientes = [] } = useQuery({
    queryKey: ['cassi-pacientes', user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('pacientes')
        .select('id, nome, sobrenome, email, telefone, carteirinha, codigos_cassi')
        .eq('terapeuta_id', user!.id).eq('ativo', true).ilike('plano_saude', '%cassi%')
        .order('nome', { ascending: true });
      if (error) throw error;
      return (data || []) as Paciente[];
    },
    enabled: !!user,
  });

  // Guias (mesma query/cache do painel).
  const { data: guias = [] } = useQuery({
    queryKey: ['guias-cassi', user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('guias_cassi').select('*, pacientes(nome, sobrenome)')
        .eq('terapeuta_id', user!.id)
        .order('data_pedido', { ascending: false }).order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Array<GuiaCassi & { pacientes?: { nome: string; sobrenome: string | null } }>;
    },
    enabled: !!user,
  });

  // Agendamentos do mês (com folga de ±1 dia p/ fuso; classificamos pelo mês local).
  const { data: agendamentos = [], isLoading } = useQuery({
    queryKey: ['cassi-agendamentos-mes', user?.id, mes],
    queryFn: async () => {
      const [ano, m] = mes.split('-').map(Number);
      const de = new Date(ano, m - 1, 0).toISOString();       // último dia do mês anterior
      const ate = new Date(ano, m, 2).toISOString();          // 2º dia do mês seguinte
      const { data, error } = await (supabase as any)
        .from('agendamentos')
        .select('id, paciente_id, data_inicio, status')
        .eq('terapeuta_id', user!.id)
        .gte('data_inicio', de).lt('data_inicio', ate);
      if (error) throw error;
      return (data || []) as Array<{ id: string; paciente_id: string | null; data_inicio: string; status: string }>;
    },
    enabled: !!user,
  });

  const calc = useMemo(() => {
    const [ano, m] = mes.split('-').map(Number);
    const agora = Date.now();
    const cassiIds = new Set(pacientes.map((p) => p.id));
    const nomePac = new Map(pacientes.map((p) => [p.id, `${p.nome} ${p.sobrenome || ''}`.trim()]));
    const codigosPac = new Map(pacientes.map((p) => [p.id, p.codigos_cassi || []]));

    // Guia mais recente por paciente (para códigos/responsável).
    const guiaPorPac = new Map<string, GuiaCassi>();
    for (const g of guias) if (!guiaPorPac.has(g.paciente_id)) guiaPorPac.set(g.paciente_id, g);

    // Conta sessões realizadas no mês local, por paciente CASSI.
    const sessoesPorPac = new Map<string, number>();
    for (const a of agendamentos) {
      if (!a.paciente_id || !cassiIds.has(a.paciente_id)) continue;
      if (a.status === 'cancelado' || a.status === 'faltou' || a.status === 'bloqueado' || a.status === 'pendente') continue;
      const d = new Date(a.data_inicio);
      if (d.getFullYear() !== ano || d.getMonth() !== m - 1) continue; // mês local
      if (d.getTime() > agora) continue; // ainda não aconteceu
      sessoesPorPac.set(a.paciente_id, (sessoesPorPac.get(a.paciente_id) || 0) + 1);
    }

    const valorDe = (c: string) => cfg?.codigos.find((x) => x.codigo === c)?.valor || 0;
    const imposto = cfg?.imposto_por_guia || 0;

    const linhas = [...sessoesPorPac.entries()]
      .filter(([, n]) => n > 0)
      .map(([pid, sessoes]) => {
        const guia = guiaPorPac.get(pid) || null;
        const codigos = guia?.codigos?.length
          ? guia.codigos
          : (codigosPac.get(pid)?.length ? codigosPac.get(pid)!.map((c) => ({ codigo: c })) : [{ codigo: '012' }]);
        const bruto = brutoGuia(codigos, sessoes, valorDe);
        const liquido = Math.max(0, bruto - imposto);
        return {
          pid,
          nome: nomePac.get(pid) || 'Cliente',
          responsavel: (guia?.responsavel_tecnico || '').trim(),
          sessoes, bruto, imposto, liquido,
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    const totBruto = linhas.reduce((s, l) => s + l.bruto, 0);
    const totImposto = linhas.reduce((s, l) => s + l.imposto, 0);
    const totLiquido = linhas.reduce((s, l) => s + l.liquido, 0);
    const totSessoes = linhas.reduce((s, l) => s + l.sessoes, 0);

    // Repasse por responsável (casa nome com a config, sem acento/caixa).
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    const pctDe = (nome: string) => {
      const r = (cfg?.responsaveis || []).find((x) => norm(x.nome) === norm(nome));
      return r ? r.percentual : null;
    };
    const porResp = new Map<string, { nome: string; liquido: number; sessoes: number; pct: number | null }>();
    for (const l of linhas) {
      const key = l.responsavel || '—';
      const cur = porResp.get(key) || { nome: l.responsavel || 'Sem responsável', liquido: 0, sessoes: 0, pct: pctDe(l.responsavel) };
      cur.liquido += l.liquido;
      cur.sessoes += l.sessoes;
      porResp.set(key, cur);
    }
    const repasses = [...porResp.values()].map((r) => ({
      ...r,
      repasse: r.pct != null ? r.liquido * (r.pct / 100) : 0,
    })).sort((a, b) => b.liquido - a.liquido);
    const totRepasse = repasses.reduce((s, r) => s + r.repasse, 0);

    return { linhas, totBruto, totImposto, totLiquido, totSessoes, repasses, totRepasse, ficaComVoce: totLiquido - totRepasse };
  }, [mes, pacientes, guias, agendamentos, cfg]);

  const irMes = (delta: number) => {
    const [ano, m] = mes.split('-').map(Number);
    const d = new Date(ano, m - 1 + delta, 1);
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const baixarCSV = () => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const linhas = [
      ['Cliente', 'Responsável', 'Sessões', 'Bruto', 'Imposto', 'Líquido'],
      ...calc.linhas.map((l) => [l.nome, l.responsavel || '—', l.sessoes, l.bruto.toFixed(2), l.imposto.toFixed(2), l.liquido.toFixed(2)]),
      [],
      ['TOTAL', '', calc.totSessoes, calc.totBruto.toFixed(2), calc.totImposto.toFixed(2), calc.totLiquido.toFixed(2)],
    ];
    const csv = linhas.map((r) => r.map(esc).join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cassi-${mes}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const [ano, m] = mes.split('-').map(Number);
  const semValores = !cfg?.codigos.some((c) => c.valor > 0);

  return (
    <div className="space-y-4">
      {/* Seletor de mês */}
      <div className="rounded-xl border border-border/50 bg-background p-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => irMes(-1)} title="Mês anterior">‹</Button>
          <div className="text-center min-w-[9rem]">
            <p className="text-sm font-bold capitalize leading-none">{MESES_PT[m - 1]} {ano}</p>
            <p className="text-[10px] uppercase text-muted-foreground tracking-wide mt-0.5">Cálculo do mês</p>
          </div>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => irMes(1)} title="Próximo mês">›</Button>
        </div>
        <div className="flex items-center gap-1.5">
          <Input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} className="h-8 w-[9.5rem] text-sm" />
          <Button size="sm" variant="outline" className="h-8 gap-1.5" disabled={calc.linhas.length === 0} onClick={baixarCSV}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        </div>
      </div>

      {semValores && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-3 text-[12px] text-amber-800 dark:text-amber-300">
          Defina os valores dos códigos em <b>Configurações</b> (ícone de engrenagem) para o cálculo somar corretamente.
        </div>
      )}

      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Sessões', valor: String(calc.totSessoes), cls: '' },
          { label: 'Bruto', valor: fmtBRL(calc.totBruto), cls: '' },
          { label: 'Imposto', valor: `− ${fmtBRL(calc.totImposto)}`, cls: 'text-rose-600' },
          { label: 'Líquido', valor: fmtBRL(calc.totLiquido), cls: 'text-emerald-600' },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-border/50 bg-background p-3">
            <p className={`text-lg font-black tabular-nums leading-none ${c.cls}`}>{c.valor}</p>
            <p className="text-[10px] uppercase text-muted-foreground tracking-wide mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : calc.linhas.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-10">
          Nenhuma sessão concluída na agenda neste mês.<br />
          <span className="text-[12px]">Marque as sessões como <b>atendido</b> na Agenda para elas entrarem no cálculo.</span>
        </p>
      ) : (
        <>
          {/* Por cliente */}
          <div className="rounded-xl border border-border/50 bg-background overflow-hidden">
            <div className="px-3 py-2 border-b border-border/50 bg-muted/30">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Por cliente</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase text-muted-foreground">
                    <th className="text-left font-medium px-3 py-1.5">Cliente</th>
                    <th className="text-center font-medium px-2 py-1.5">Sessões</th>
                    <th className="text-right font-medium px-2 py-1.5">Bruto</th>
                    <th className="text-right font-medium px-2 py-1.5">Imposto</th>
                    <th className="text-right font-medium px-3 py-1.5">Líquido</th>
                  </tr>
                </thead>
                <tbody>
                  {calc.linhas.map((l) => (
                    <tr key={l.pid} className="border-t border-border/40">
                      <td className="px-3 py-2">
                        <p className="font-medium truncate">{l.nome}</p>
                        {l.responsavel && <p className="text-[10px] text-muted-foreground">{l.responsavel}</p>}
                      </td>
                      <td className="text-center tabular-nums px-2 py-2">{l.sessoes}</td>
                      <td className="text-right tabular-nums px-2 py-2">{fmtBRL(l.bruto)}</td>
                      <td className="text-right tabular-nums px-2 py-2 text-rose-600">{l.imposto ? `− ${fmtBRL(l.imposto)}` : '—'}</td>
                      <td className="text-right tabular-nums px-3 py-2 font-semibold text-emerald-700 dark:text-emerald-400">{fmtBRL(l.liquido)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Repasse por responsável */}
          {calc.repasses.length > 0 && (
            <div className="rounded-xl border border-border/50 bg-background overflow-hidden">
              <div className="px-3 py-2 border-b border-border/50 bg-muted/30 flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Repasse por responsável</p>
                <p className="text-[11px] text-muted-foreground">Fica com você: <b className="text-foreground">{fmtBRL(calc.ficaComVoce)}</b></p>
              </div>
              <div className="divide-y divide-border/40">
                {calc.repasses.map((r) => (
                  <div key={r.nome} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{r.nome}</p>
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        {r.sessoes} sessão(ões) · líquido {fmtBRL(r.liquido)}
                        {r.pct == null && <span className="text-amber-600"> · sem % configurado</span>}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold tabular-nums text-violet-700 dark:text-violet-400">{fmtBRL(r.repasse)}</p>
                      {r.pct != null && <p className="text-[10px] text-muted-foreground">{r.pct}% de repasse</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground text-center px-4">
            Contamos como sessão realizada os agendamentos <b>atendidos/confirmados</b> na Agenda até hoje. Cancelados, faltas e horários bloqueados não entram.
          </p>
        </>
      )}
    </div>
  );
}
