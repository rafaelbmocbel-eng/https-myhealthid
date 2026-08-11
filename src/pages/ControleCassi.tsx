import { useState, useMemo, useEffect, useRef, type CSSProperties } from 'react';
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
import { ArrowLeft, Plus, Loader2, FileText, Save, Trash2, ClipboardList, AlertTriangle, CalendarClock, CheckCircle2, Circle, Download, UserPlus, Search, Pencil, CreditCard, Phone, Settings, Copy, MessageCircle, MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { CODIGOS_CASSI, statusPaciente, precisaNovaGuia, venceuPrazoProximaGuia, sessoesRestantes, type GuiaCassi, type GuiaStatus } from '@/lib/cassiGuias';

interface Paciente { id: string; nome: string; sobrenome: string | null; email: string | null; telefone: string | null; carteirinha: string | null; codigos_cassi: string[]; guias_por_mes?: number | null; guia_solicitada_em?: string | null; cassi_encerrado_em?: string | null; cassi_encerrado_motivo?: string | null; cassi_diagnostico?: string | null; cassi_confirmado_mes?: string | null; }

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

interface CodigoCfg { codigo: string; descricao: string; valor: number; codigo_oficial?: string; }
interface ResponsavelCfg { nome: string; percentual: number; }

// Configuração CASSI do profissional (códigos com valor + imposto por guia +
// responsáveis/repasse). Se ainda não configurou, cai nos códigos padrão com valor 0.
function useCassiConfig() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['cassi-config', user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any).from('cassi_config')
        .select('codigos, imposto_por_guia, imposto_percentual, minha_parte_percentual, responsaveis, nome_clinica, nome_profissional, cidade').eq('terapeuta_id', user!.id).maybeSingle();
      const codigos: CodigoCfg[] = Array.isArray(data?.codigos) && data.codigos.length
        ? data.codigos
        : CODIGOS_CASSI.map((c) => ({ codigo: c.codigo, descricao: c.descricao, valor: 0 }));
      const responsaveis: ResponsavelCfg[] = Array.isArray(data?.responsaveis) ? data.responsaveis : [];
      return {
        codigos, responsaveis,
        imposto_por_guia: Number(data?.imposto_por_guia || 0),
        imposto_percentual: Number(data?.imposto_percentual || 0),
        minha_parte_percentual: Number(data?.minha_parte_percentual || 0),
        nome_clinica: (data?.nome_clinica as string) || '',
        nome_profissional: (data?.nome_profissional as string) || '',
        cidade: (data?.cidade as string) || '',
      };
    },
    enabled: !!user,
  });
}

const fmtBRL = (v: number) => `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;
// Valor bruto de uma guia num mês. Soma código a código:
//  - 144 (avaliação) é um dia EXTRA separado → cobra 1x (se houve ≥1 sessão);
//  - códigos de tratamento cobram por dia de tratamento, limitado à quantidade
//    autorizada de CADA código (um código pode ter passado com menos, ou "não
//    passado" = 0). Se o código não tem quantidade própria, usa os dias do mês.
// `valorDe` resolve o valor de cada código pela config.
function brutoGuia(codigos: Array<{ codigo: string; sessoes?: number }>, sessoes: number, valorDe: (c: string) => number): number {
  let total = 0;
  for (const c of (codigos || [])) {
    if (c.codigo === '144') {
      if ((c.sessoes ?? 1) >= 1 && sessoes >= 1) total += valorDe('144');
    } else {
      const cap = c.sessoes != null ? c.sessoes : sessoes;
      total += valorDe(c.codigo) * Math.max(0, Math.min(sessoes, cap));
    }
  }
  return total;
}

// Soma da guia para o RELATÓRIO de produção: cada código pela sua quantidade
// autorizada (144 = 1). É o "Soma" da linha no arquivo entregue à clínica.
function somaGuia(codigos: Array<{ codigo: string; sessoes?: number }>, valorDe: (c: string) => number): number {
  return (codigos || []).reduce((s, c) => s + (Number(c.sessoes) || 0) * valorDe(c.codigo), 0);
}

// Dias de tratamento da guia = campo "sessoes_autorizadas"; se ficou 0, usa a
// MAIOR quantidade entre os códigos de tratamento (o profissional às vezes só
// preenche a qtd nos códigos). Assim o controle de sessões (X/Y) sempre aparece.
function diasTratGuia(g: { sessoes_autorizadas?: number; codigos?: Array<{ codigo: string; sessoes?: number }> }): number {
  if (g.sessoes_autorizadas && g.sessoes_autorizadas > 0) return g.sessoes_autorizadas;
  const trat = (g.codigos || []).filter((c) => c.codigo !== '144').map((c) => Number(c.sessoes) || 0);
  return trat.length ? Math.max(...trat) : 0;
}

// Projeta a data de TÉRMINO da guia (10ª sessão) contando dias úteis corridos
// (seg–sex) a partir da resposta da CASSI (ou do pedido). Regra: a guia só é
// debitada no mês em que essa data cair — se passar do fim do mês, vai pro
// próximo. Retorna 'YYYY-MM-DD' ou null se faltar data/sessões.
function projetarFimGuia(guia: { data_resposta?: string | null; data_pedido?: string | null; sessoes_autorizadas?: number }): string | null {
  const inicioStr = guia.data_resposta || guia.data_pedido;
  const n = guia.sessoes_autorizadas || 0;
  if (!inicioStr || n <= 0) return null;
  const datas = gerarDatasSessoes(new Date(`${inicioStr}T00:00:00`), n, [1, 2, 3, 4, 5]);
  const ultima = datas[datas.length - 1];
  if (!ultima) return null;
  return `${ultima.getFullYear()}-${String(ultima.getMonth() + 1).padStart(2, '0')}-${String(ultima.getDate()).padStart(2, '0')}`;
}

export default function ControleCassi() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editando, setEditando] = useState<{ paciente: Paciente; guia: GuiaCassi | null } | null>(null);
  const [view, setView] = useState<'clientes' | 'ativas' | 'outro' | 'pedir' | 'faturamento'>('ativas');
  // Sub-aba do painel: guias ativas (padrão, "em linha" com controle de sessões)
  // ou a lista completa de pacientes.
  const [aba, setAba] = useState<'ativas' | 'pacientes'>('ativas');
  const [busca, setBusca] = useState('');
  const [cadastro, setCadastro] = useState<Paciente | 'novo' | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [verEncerrados, setVerEncerrados] = useState(false);
  const [filtro2mes, setFiltro2mes] = useState(false);
  // Filtro do painel de ações do "Este mês": foca em quem precisa de atenção.
  const [focoMes, setFocoMes] = useState<'todos' | 'guia' | 'acabando' | 'confirmar'>('todos');

  // Pacientes CASSI do profissional.
  const { data: pacientes = [], isLoading: loadingPac } = useQuery({
    queryKey: ['cassi-pacientes', user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('pacientes')
        .select('id, nome, sobrenome, email, telefone, carteirinha, codigos_cassi, guias_por_mes, guia_solicitada_em, cassi_encerrado_em, cassi_encerrado_motivo, cassi_diagnostico, cassi_confirmado_mes')
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

  // Sessões (agendamentos) ligadas às guias — o Controle reflete a AGENDA ao
  // vivo, sem depender de abrir cada guia. (Mesma queryKey do Relatório/Envios.)
  const { data: agSessoes = [] } = useQuery({
    queryKey: ['cassi-ags-guia', user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('agendamentos')
        .select('guia_cassi_id, data_inicio, status, tipo_atendimento')
        .eq('terapeuta_id', user!.id).not('guia_cassi_id', 'is', null);
      if (error) throw error;
      return (data || []) as Array<{ guia_cassi_id: string; data_inicio: string; status: string; tipo_atendimento?: string }>;
    },
    enabled: !!user,
  });

  // Por guia: dias de tratamento gerados na agenda e quantos já foram realizados
  // (passados e não cancelados/faltados). A avaliação é dia extra e não conta.
  const realPorGuia = useMemo(() => {
    const agora = Date.now();
    const ger = new Map<string, Set<string>>();
    const rea = new Map<string, Set<string>>();
    for (const a of agSessoes) {
      if (!a.guia_cassi_id || a.tipo_atendimento === 'avaliacao' || a.status === 'cancelado') continue;
      const dt = new Date(a.data_inicio);
      const ymd = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      if (!ger.has(a.guia_cassi_id)) ger.set(a.guia_cassi_id, new Set());
      ger.get(a.guia_cassi_id)!.add(ymd);
      if (dt.getTime() < agora && a.status !== 'faltou' && a.status !== 'bloqueado' && a.status !== 'pendente') {
        if (!rea.has(a.guia_cassi_id)) rea.set(a.guia_cassi_id, new Set());
        rea.get(a.guia_cassi_id)!.add(ymd);
      }
    }
    const m = new Map<string, { geradas: number; realizadas: number }>();
    for (const id of new Set([...ger.keys(), ...rea.keys()])) {
      m.set(id, { geradas: ger.get(id)?.size || 0, realizadas: rea.get(id)?.size || 0 });
    }
    return m;
  }, [agSessoes]);

  // Guias com a contagem de realizadas vinda da Agenda (quando há sessões geradas).
  const guiasEff = useMemo(() => guias.map((g) => {
    const r = realPorGuia.get(g.id);
    return r && r.geradas > 0 ? { ...g, sessoes_realizadas: r.realizadas } : g;
  }), [guias, realPorGuia]);

  // Guia mais recente por paciente.
  const guiaPorPaciente = useMemo(() => {
    const m = new Map<string, GuiaCassi>();
    for (const g of guiasEff) if (!m.has(g.paciente_id)) m.set(g.paciente_id, g);
    return m;
  }, [guiasEff]);

  // Ativos = não encerrados. Encerrados ficam de fora das listas (mas dá pra ver/reativar).
  const pacientesAtivos = useMemo(() => pacientes.filter((p) => !p.cassi_encerrado_em), [pacientes]);
  const encerrados = useMemo(() => pacientes.filter((p) => !!p.cassi_encerrado_em), [pacientes]);

  const encerrarCliente = async (id: string, motivo: string) => {
    const { error } = await (supabase as any).from('pacientes')
      .update({ cassi_encerrado_em: new Date().toISOString(), cassi_encerrado_motivo: motivo || null }).eq('id', id);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Cliente encerrado');
    qc.invalidateQueries({ queryKey: ['cassi-pacientes', user?.id] });
  };
  const reativarCliente = async (id: string) => {
    const { error } = await (supabase as any).from('pacientes')
      .update({ cassi_encerrado_em: null, cassi_encerrado_motivo: null }).eq('id', id);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Cliente reativado');
    qc.invalidateQueries({ queryKey: ['cassi-pacientes', user?.id] });
  };
  const definirGuiasMes = async (id: string, n: number) => {
    const { error } = await (supabase as any).from('pacientes').update({ guias_por_mes: n }).eq('id', id);
    if (error) { toast.error('Erro: ' + error.message); return; }
    qc.invalidateQueries({ queryKey: ['cassi-pacientes', user?.id] });
  };
  // Excluir cliente (remove do controle — pra duplicados/erros). Soft delete: some
  // das listas mas não apaga o histórico do banco.
  const excluirCliente = async (id: string) => {
    const { error } = await (supabase as any).from('pacientes').update({ ativo: false }).eq('id', id);
    if (error) { toast.error('Erro ao excluir: ' + error.message); return; }
    toast.success('Cliente excluído do controle');
    qc.invalidateQueries({ queryKey: ['cassi-pacientes', user?.id] });
  };

  const linhas = useMemo(() =>
    pacientesAtivos.map((p) => {
      const guia = guiaPorPaciente.get(p.id) || null;
      return { paciente: p, guia, status: statusPaciente(guia) };
    }), [pacientesAtivos, guiaPorPaciente]);

  // "Pedido aberto" = já demos baixa (solicitamos) e a guia nova ainda não chegou
  // (nenhuma guia com data_pedido >= a data da solicitação).
  const pedidoAberto = (p: Paciente): boolean => {
    const sol = p.guia_solicitada_em ? p.guia_solicitada_em.slice(0, 10) : null;
    if (!sol) return false;
    const ultimo = guiaPorPaciente.get(p.id)?.data_pedido || null;
    return !ultimo || ultimo < sol;
  };
  // Precisa pedir guia (sem guia / acabando / 2ª guia do mês) E ainda não foi pedida.
  const pedidosDoMes = useMemo(() => linhas.filter((l) =>
    (precisaNovaGuia(l.guia) || venceuPrazoProximaGuia(l.guia, l.paciente.guias_por_mes))
    && !pedidoAberto(l.paciente)
  ), [linhas, guiaPorPaciente]);
  // Guias já pedidas, aguardando a CASSI liberar.
  const guiasPedidas = useMemo(() => linhas.filter((l) => pedidoAberto(l.paciente)), [linhas, guiaPorPaciente]);

  // Dar baixa: marca que a(s) guia(s) foram pedidas → saem de "Pedir guia".
  const darBaixaPedidos = async (ids: string[]) => {
    if (!ids.length) return;
    const { error } = await (supabase as any).from('pacientes')
      .update({ guia_solicitada_em: new Date().toISOString() }).in('id', ids);
    if (error) { toast.error('Erro ao dar baixa: ' + error.message); return; }
    toast.success(`${ids.length} pedido(s) registrado(s)`);
    qc.invalidateQueries({ queryKey: ['cassi-pacientes', user?.id] });
  };
  const desfazerPedido = async (id: string) => {
    const { error } = await (supabase as any).from('pacientes')
      .update({ guia_solicitada_em: null }).eq('id', id);
    if (error) { toast.error('Erro: ' + error.message); return; }
    qc.invalidateQueries({ queryKey: ['cassi-pacientes', user?.id] });
  };
  const guiasAtivasLista = useMemo(() => guiasEff.filter((g) => g.status === 'ativa'), [guiasEff]);
  // Aba "Este mês": mês vigente + mês passado (pra carregar os pacientes que
  // continuam). Um por paciente (guia mais recente).
  const mesVigente = mesAtualISO();
  const mesAnterior = useMemo(() => {
    const [a, m] = mesVigente.split('-').map(Number);
    const d = new Date(a, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, [mesVigente]);
  const prodMesGuia = (g: GuiaCassi) => {
    const fim = projetarFimGuia(g);
    return fim ? fim.slice(0, 7) : (g.data_resposta || g.data_pedido || '').slice(0, 7);
  };
  // Roster do mês: cliente ativo com guia ATIVA fechando este mês, ou cuja guia
  // mais recente fechou no mês passado (carrega pra continuar este mês).
  const rosterEsteMes = useMemo(() => linhas.filter((l) => {
    if (l.paciente.cassi_confirmado_mes === mesVigente) return true; // confirmado neste mês
    // Cliente de 2 guias/mês que precisa de pedido: sempre aparece aqui.
    const p2 = (l.paciente.guias_por_mes || 1) >= 2;
    if (p2 && (precisaNovaGuia(l.guia) || venceuPrazoProximaGuia(l.guia, l.paciente.guias_por_mes))) return true;
    const g = l.guia;
    if (!g) return false;
    const pm = prodMesGuia(g);
    if (g.status === 'ativa' && pm === mesVigente) return true;
    if (pm === mesAnterior) return true;
    return false;
  }), [linhas, mesVigente, mesAnterior]);
  const guiasAtivas = rosterEsteMes.length;

  // Confirmar (1 clique) que o cliente tem guia ativa neste mês — mesmo com guia
  // de mês anterior (3 meses pra debitar). Marca o mês confirmado no cadastro.
  const confirmarGuiaMes = async (id: string) => {
    const { error } = await (supabase as any).from('pacientes').update({ cassi_confirmado_mes: mesVigente }).eq('id', id);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Guia confirmada neste mês');
    qc.invalidateQueries({ queryKey: ['cassi-pacientes', user?.id] });
  };
  const desconfirmarGuiaMes = async (id: string) => {
    const { error } = await (supabase as any).from('pacientes').update({ cassi_confirmado_mes: null }).eq('id', id);
    if (error) { toast.error('Erro: ' + error.message); return; }
    qc.invalidateQueries({ queryKey: ['cassi-pacientes', user?.id] });
  };
  // Clientes marcados como 2 guias/mês (controle explícito de quem usa 2/mês).
  const clientes2mes = useMemo(() => linhas.filter((l) => (l.paciente.guias_por_mes || 1) >= 2), [linhas]);

  // Paciente por id (para montar o objeto ao abrir/editar guia a partir da linha da guia).
  const pacienteById = useMemo(() => new Map(pacientes.map((p) => [p.id, p])), [pacientes]);
  const pacDaGuia = (g: GuiaCassi & { pacientes?: { nome: string; sobrenome: string | null } }): Paciente =>
    pacienteById.get(g.paciente_id) || {
      id: g.paciente_id, nome: g.pacientes?.nome || 'Paciente', sobrenome: g.pacientes?.sobrenome ?? null,
      email: null, telefone: null, carteirinha: null, codigos_cassi: [], guias_por_mes: 1,
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
        <div className="max-w-5xl mx-auto px-3 py-2.5 flex flex-col gap-2 md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
            <div className="ml-1 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold">Controle CASSI</span>
            </div>
            <Button size="icon" variant="ghost" className="ml-auto h-8 w-8 md:hidden" title="Configurações CASSI" onClick={() => setConfigOpen(true)}>
              <Settings className="h-4 w-4" />
            </Button>
          </div>
          <div className="md:ml-auto flex items-center gap-1.5 min-w-0">
            <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5 flex-nowrap overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {([['clientes', 'Clientes'], ['ativas', 'Este mês'], ['outro', 'Fechamentos'], ['pedir', 'Pedir guias'], ['faturamento', 'Faturamento']] as const).map(([v, label]) => (
                <button key={v} onClick={() => setView(v)}
                  className={`text-[12px] px-2.5 py-1 rounded-md font-medium whitespace-nowrap shrink-0 ${view === v ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>
                  {label}
                  {v === 'pedir' && pedidosDoMes.length > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center min-w-[15px] h-[15px] px-1 rounded-full bg-amber-500 text-white text-[9px] font-bold align-middle">{pedidosDoMes.length}</span>
                  )}
                </button>
              ))}
            </div>
            <Button size="icon" variant="ghost" className="hidden md:inline-flex h-8 w-8" title="Configurações CASSI" onClick={() => setConfigOpen(true)}>
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-3 space-y-4">
        {!loading && (
          <p className="text-[12px] text-muted-foreground -mb-1 px-0.5">
            {view === 'clientes' ? 'Todos os clientes CASSI — buscar, cadastrar e ativar no mês.'
              : view === 'ativas' ? `${MESES_PT[Number(mesVigente.slice(5, 7)) - 1]}/${mesVigente.slice(2, 4)} · quem está em tratamento neste mês.`
              : view === 'outro' ? 'Guias que fecham em outros meses.'
              : view === 'pedir' ? 'Monte e envie os pedidos de novas guias.'
              : 'Cálculo do mês e relatórios de produção.'}
          </p>
        )}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : view === 'clientes' ? (
          <ClientesCassi
            pacientes={pacientes}
            guias={guiasEff}
            onCadastro={(p) => setCadastro(p)}
            onNovo={() => setCadastro('novo')}
            onGuia={(p, g) => setEditando({ paciente: p, guia: g })}
            onDefinirGuiasMes={definirGuiasMes}
            onExcluir={excluirCliente}
            onAtivar={reativarCliente}
            onConfirmarMes={confirmarGuiaMes}
            onPedirGuia={() => setView('pedir')}
            mesVigente={mesVigente}
          />
        ) : view === 'faturamento' ? (
          <FinanceiroCassi />
        ) : view === 'outro' ? (
          <EnviosCassi onAbrir={(g) => setEditando({ paciente: pacDaGuia(g), guia: g })} />
        ) : view === 'pedir' ? (
          <>
            {pedidosDoMes.length > 0 ? (
              <PedirGuiasPanel
                linhas={pedidosDoMes}
                onNovaGuia={(pac) => setEditando({ paciente: pac, guia: null })}
                onDarBaixa={darBaixaPedidos}
              />
            ) : guiasPedidas.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-10">Ninguém precisa de guia nova agora. 🎉</p>
            ) : null}

            {guiasPedidas.length > 0 && (
              <div className="rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50/60 dark:bg-sky-950/20 overflow-hidden">
                <div className="px-3 py-2 flex items-center gap-2 border-b border-sky-200/60 dark:border-sky-900/60">
                  <CalendarClock className="h-4 w-4 text-sky-600 shrink-0" />
                  <span className="text-sm font-bold text-sky-800 dark:text-sky-300">Guias pedidas — aguardando CASSI ({guiasPedidas.length})</span>
                </div>
                <div className="divide-y divide-sky-200/50 dark:divide-sky-900/50">
                  {guiasPedidas.map(({ paciente }) => (
                    <div key={paciente.id} className="flex items-center gap-2 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{paciente.nome} {paciente.sobrenome || ''}</p>
                        {paciente.guia_solicitada_em && (
                          <p className="text-[11px] text-muted-foreground">pedida em {fmtData(paciente.guia_solicitada_em.slice(0, 10))}</p>
                        )}
                      </div>
                      <Button size="sm" variant="outline" className="h-8 gap-1.5 text-[12px] shrink-0" onClick={() => setEditando({ paciente, guia: null })}>
                        <Plus className="h-3.5 w-3.5" /> Registrar guia
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 text-[11px] text-muted-foreground shrink-0" onClick={() => desfazerPedido(paciente.id)}>
                        desfazer
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          /* Ativas do mês (home): procurar cliente + cadastrar; a lista mostra os
             resultados da busca (todos os clientes) ou as guias ativas. */
          <>
            <div className="rounded-xl border border-border/50 bg-background p-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="h-4 w-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <Input className="h-9 pl-8" placeholder="Procurar cliente (nome, carteirinha ou telefone)…"
                    value={busca} onChange={(e) => setBusca(e.target.value)} />
                </div>
                <Button size="sm" className="gap-1.5 h-9 shrink-0" onClick={() => setCadastro('novo')}>
                  <UserPlus className="h-4 w-4" /> <span className="hidden sm:inline">Adicionar cliente</span>
                </Button>
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <button onClick={() => setFiltro2mes((v) => !v)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border font-medium ${filtro2mes ? 'bg-violet-600 text-white border-violet-600' : 'bg-background border-border text-muted-foreground'}`}>
                  2 guias/mês ({clientes2mes.length})
                </button>
                {filtro2mes ? (
                  <span className="text-[11px] text-muted-foreground">só clientes de 2/mês · toque no lápis pra mudar de 1↔2</span>
                ) : busca ? (
                  <span className="text-[11px] text-muted-foreground">{linhasFiltradas.length} encontrado(s)</span>
                ) : null}
              </div>
            </div>

            {(filtro2mes || busca) ? (
              (filtro2mes ? clientes2mes : linhasFiltradas).length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  {filtro2mes ? 'Nenhum cliente marcado como 2 guias/mês. Abra um cliente (lápis) e mude pra 2/mês.' : 'Nenhum cliente encontrado.'}
                </p>
              ) : (
                <div className="grid gap-2 lg:grid-cols-2">
                  {(filtro2mes ? clientes2mes : linhasFiltradas).map(({ paciente, guia, status }) => (
                    <div key={paciente.id} className="rounded-xl border border-border/50 bg-background p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate flex items-center gap-1.5">
                            {paciente.nome} {paciente.sobrenome || ''}
                            {(paciente.guias_por_mes || 1) >= 2 && (
                              <span className="text-[9px] uppercase font-bold text-violet-600 border border-violet-300 dark:border-violet-800 rounded px-1 shrink-0">2/mês</span>
                            )}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <Badge className={`text-[10px] ${status.cls}`}>{status.label}</Badge>
                            {pedidoAberto(paciente) && (
                              <Badge className="text-[10px] bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300">guia pedida</Badge>
                            )}
                            {guia && (
                              <span className="text-[11px] text-muted-foreground tabular-nums">{guia.sessoes_realizadas}/{diasTratGuia(guia)} sessões</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
                            {paciente.carteirinha && <span className="inline-flex items-center gap-1"><CreditCard className="h-3 w-3" /> {paciente.carteirinha}</span>}
                            {paciente.telefone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {paciente.telefone}</span>}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0 sm:justify-end">
                          {paciente.cassi_confirmado_mes === mesVigente ? (
                            <span className="text-[11px] font-bold text-emerald-700 px-1">no mês ✓</span>
                          ) : (
                            <Button size="sm" className="h-8 gap-1.5 text-[12px] bg-emerald-600 hover:bg-emerald-700 text-white" title="Adicionar a Este mês"
                              onClick={() => confirmarGuiaMes(paciente.id)}>
                              <CheckCircle2 className="h-3.5 w-3.5" /> Este mês
                            </Button>
                          )}
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
            ) : (
              rosterEsteMes.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  Ninguém em tratamento neste mês ainda. Crie guias na aba <b>Clientes</b> ou use <b>Adicionar cliente</b>.
                </p>
              ) : (() => {
                // Decora cada linha com o estado semântico pra colorir, ordenar e contar.
                const linhasMes = rosterEsteMes.map(({ paciente, guia }) => {
                  const aut = guia ? diasTratGuia(guia) : 0;
                  const real = guia?.sessoes_realizadas || 0;
                  const restantes = Math.max(0, aut - real);
                  const pct = aut > 0 ? Math.min(100, Math.round((real / aut) * 100)) : 0;
                  const confirmado = paciente.cassi_confirmado_mes === mesVigente;
                  const ativaEsteMes = guia?.status === 'ativa' && prodMesGuia(guia) === mesVigente;
                  const ok = confirmado || ativaEsteMes;
                  const prazoVenceu = venceuPrazoProximaGuia(guia, paciente.guias_por_mes);
                  const precisaPedido = (paciente.guias_por_mes || 1) >= 2 && !ok && (precisaNovaGuia(guia) || prazoVenceu);
                  const acabando = !precisaPedido && !!guia && aut > 0 && restantes <= 2;
                  const estado: 'guia' | 'acabando' | 'confirmar' | 'ok' =
                    precisaPedido ? 'guia' : acabando ? 'acabando' : ok ? 'ok' : 'confirmar';
                  const fimISO = guia ? projetarFimGuia(guia) : null;
                  return { paciente, guia, aut, real, restantes, pct, confirmado, ok, prazoVenceu, precisaPedido, estado, fimISO };
                });
                const nGuia = linhasMes.filter((l) => l.estado === 'guia').length;
                const nAcab = linhasMes.filter((l) => l.estado === 'acabando').length;
                const nConf = linhasMes.filter((l) => l.estado === 'confirmar').length;
                const ordem = { guia: 0, acabando: 1, confirmar: 2, ok: 3 };
                const filtradas = (focoMes === 'todos' ? linhasMes : linhasMes.filter((l) => l.estado === focoMes))
                  .slice().sort((a, b) => ordem[a.estado] - ordem[b.estado]);

                const chips = [
                  { key: 'guia' as const, n: nGuia, icon: '⚠', label: 'precisam de guia', tone: 'danger' },
                  { key: 'acabando' as const, n: nAcab, icon: '⏳', label: 'acabando sessões', tone: 'warn' },
                  { key: 'confirmar' as const, n: nConf, icon: '☐', label: 'a confirmar', tone: 'neutral' },
                ];

                return (
                  <div className="space-y-3">
                    {/* Painel de ações — o que precisa de atenção agora */}
                    <div className="grid grid-cols-3 gap-2">
                      {chips.map((c) => {
                        const active = focoMes === c.key;
                        const toneCls = c.tone === 'danger'
                          ? 'border-rose-200 dark:border-rose-900/70 bg-rose-50/70 dark:bg-rose-950/20'
                          : c.tone === 'warn'
                          ? 'border-amber-200 dark:border-amber-900/70 bg-amber-50/70 dark:bg-amber-950/20'
                          : 'border-border/60 bg-background';
                        const numCls = c.tone === 'danger' ? 'text-rose-600 dark:text-rose-400'
                          : c.tone === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-foreground';
                        return (
                          <button key={c.key} onClick={() => setFocoMes(active ? 'todos' : c.key)}
                            className={`rounded-xl border p-2.5 text-left transition-all ${toneCls} ${active ? 'ring-2 ring-primary/50' : 'hover:brightness-[0.99]'}`}>
                            <span className={`block text-lg font-black tabular-nums leading-none ${numCls}`}>{c.icon} {c.n}</span>
                            <span className="block text-[10.5px] text-muted-foreground font-semibold mt-1 leading-tight">{c.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    {focoMes !== 'todos' && (
                      <button onClick={() => setFocoMes('todos')} className="text-[12px] text-primary font-medium">← ver todos ({linhasMes.length})</button>
                    )}

                    {filtradas.length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground py-6">Ninguém nesse grupo agora. 🎉</p>
                    ) : (
                      <div className="grid gap-2 lg:grid-cols-2">
                        {filtradas.map((l) => {
                          const { paciente, guia } = l;
                          const stripe = l.estado === 'guia' ? 'before:bg-rose-500'
                            : l.estado === 'acabando' ? 'before:bg-amber-500'
                            : l.estado === 'ok' ? 'before:bg-emerald-500' : 'before:bg-slate-400';
                          const fim = l.fimISO ? `${l.fimISO.slice(8, 10)}/${l.fimISO.slice(5, 7)}` : null;
                          const gpm = paciente.guias_por_mes || 1;
                          const nome = `${paciente.nome} ${paciente.sobrenome || ''}`.trim();
                          // Ação principal do card — só uma, conforme o estado.
                          const primary = l.precisaPedido ? (
                            <Button size="sm" className="w-full h-9 gap-1.5 text-[13px] bg-rose-600 hover:bg-rose-700 text-white" onClick={() => setView('pedir')}>
                              <AlertTriangle className="h-4 w-4" /> Pedir guia
                            </Button>
                          ) : !l.ok ? (
                            <Button size="sm" className="w-full h-9 gap-1.5 text-[13px] bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => confirmarGuiaMes(paciente.id)}>
                              <CheckCircle2 className="h-4 w-4" /> Confirmar
                            </Button>
                          ) : guia ? (
                            <Button size="sm" variant="outline" className="w-full h-9 gap-1.5 text-[13px]" onClick={() => setEditando({ paciente, guia })}>
                              <FileText className="h-4 w-4" /> Ver guia
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" className="w-full h-9 gap-1.5 text-[13px]" onClick={() => setEditando({ paciente, guia: null })}>
                              <Plus className="h-4 w-4" /> Nova guia
                            </Button>
                          );
                          return (
                            <div key={paciente.id} className={`relative overflow-hidden rounded-xl border border-border/60 bg-background pl-4 pr-3 py-2.5 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 ${stripe}`}>
                              <div className="flex items-start gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="text-[15px] font-bold truncate leading-tight">{nome}</p>
                                    {gpm >= 2 && <span className="text-[9px] uppercase font-bold text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-900/30 rounded px-1 shrink-0">2/mês</span>}
                                    {l.confirmado && <span className="text-[9px] uppercase font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/30 rounded px-1 shrink-0">confirmada</span>}
                                  </div>
                                  {guia && l.aut > 0 ? (
                                    <>
                                      <div className="flex items-center gap-2 mt-1.5">
                                        <div className="h-1.5 flex-1 max-w-[170px] rounded-full bg-muted overflow-hidden">
                                          <div className={`h-full ${l.restantes <= 2 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${l.pct}%` }} />
                                        </div>
                                        <span className="text-[14px] font-extrabold tabular-nums shrink-0">{l.real}/{l.aut}</span>
                                      </div>
                                      <p className="text-[11px] text-muted-foreground mt-1">
                                        {l.prazoVenceu ? 'Hora de pedir a próxima guia'
                                          : fim ? `termina ~${fim}${l.restantes <= 2 ? ` · faltam ${l.restantes}` : ''}`
                                          : `${l.restantes} sessões restantes`}
                                      </p>
                                    </>
                                  ) : l.precisaPedido ? (
                                    <p className="text-[12px] text-rose-700 dark:text-rose-300 mt-1 font-medium">Precisa de nova guia — monte em “Pedir guias”</p>
                                  ) : l.ok ? (
                                    <p className="text-[12px] text-emerald-700 dark:text-emerald-400 mt-1">Guia confirmada — registre nº e sessões pra acompanhar</p>
                                  ) : (
                                    <p className="text-[12px] text-muted-foreground mt-1">Do mês passado — confirme se a guia está ativa</p>
                                  )}
                                </div>
                                {/* Menu com as ações secundárias — menos botão à vista, menos erro */}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground shrink-0" title="Mais ações">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-56">
                                    <DropdownMenuLabel className="text-[11px] truncate">{nome}</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {guia && (
                                      <DropdownMenuItem onClick={() => setEditando({ paciente, guia })}>
                                        <FileText className="h-3.5 w-3.5 mr-2" /> Ver guia
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={() => setEditando({ paciente, guia: null })}>
                                      <Plus className="h-3.5 w-3.5 mr-2" /> Nova guia
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setView('pedir')}>
                                      <AlertTriangle className="h-3.5 w-3.5 mr-2" /> Pedir guia
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setCadastro(paciente)}>
                                      <Pencil className="h-3.5 w-3.5 mr-2" /> Editar cadastro
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => definirGuiasMes(paciente.id, gpm >= 2 ? 1 : 2)}>
                                      <CreditCard className="h-3.5 w-3.5 mr-2" /> Mudar para {gpm >= 2 ? '1' : '2'} guia/mês
                                    </DropdownMenuItem>
                                    {l.confirmado && (
                                      <DropdownMenuItem onClick={() => desconfirmarGuiaMes(paciente.id)}>
                                        <Circle className="h-3.5 w-3.5 mr-2" /> Desfazer confirmação
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-destructive focus:text-destructive"
                                      onClick={() => { if (confirm(`Retirar "${nome}" deste mês? (encerra — dá pra reativar depois)`)) encerrarCliente(paciente.id, 'Retirado do mês'); }}>
                                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Retirar deste mês
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                              <div className="mt-2.5">{primary}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()
            )}

            {/* Encerrados — quem não continua (viagem, alta, desistência). Dá pra reativar. */}
            {encerrados.length > 0 && (
              <div className="pt-1">
                <button onClick={() => setVerEncerrados((v) => !v)} className="text-[12px] text-muted-foreground hover:text-foreground">
                  {verEncerrados ? 'ocultar' : 'ver'} encerrados ({encerrados.length})
                </button>
                {verEncerrados && (
                  <div className="space-y-1.5 mt-2">
                    {encerrados.map((p) => (
                      <div key={p.id} className="rounded-lg border border-border/50 bg-muted/20 p-2.5 flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{p.nome} {p.sobrenome || ''}</p>
                          <p className="text-[11px] text-muted-foreground">
                            encerrado{p.cassi_encerrado_motivo ? ` · ${p.cassi_encerrado_motivo}` : ''}
                          </p>
                        </div>
                        <Button size="sm" variant="outline" className="h-8 text-[12px] shrink-0" onClick={() => reativarCliente(p.id)}>Reativar</Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
          onEncerrar={async (id, motivo) => { await encerrarCliente(id, motivo); setCadastro(null); }}
          onReativar={async (id) => { await reativarCliente(id); setCadastro(null); }}
        />
      )}

      {configOpen && <ConfigCassiDialog onClose={() => setConfigOpen(false)} />}
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
    diagnostico: guia?.diagnostico || paciente.cassi_diagnostico || base?.diagnostico || '',
    responsavel_tecnico: (guia ?? base)?.responsavel_tecnico || '',
    codigos: (guia ?? base)?.codigos?.map((c) => c.codigo)
      || (paciente.codigos_cassi?.length ? paciente.codigos_cassi : ['012']),
    status: guia?.status || 'aguardando',
    observacoes: guia?.observacoes || '',
  }));

  const [duasPorMes, setDuasPorMes] = useState<boolean>((paciente.guias_por_mes || 1) >= 2);
  // Quantidade de sessões autorizada POR código (144 = 1 dia extra de avaliação).
  const [sesCod, setSesCod] = useState<Record<string, number>>(() => {
    const src = (guia ?? base)?.codigos;
    const m: Record<string, number> = {};
    if (src?.length) for (const c of src) m[c.codigo] = c.sessoes ?? (c.codigo === '144' ? 1 : (guia?.sessoes_autorizadas || 10));
    return m;
  });
  const set = <K extends keyof DraftGuia>(k: K, v: DraftGuia[K]) => setD((p) => ({ ...p, [k]: v }));
  const toggleCodigo = (codigo: string) => {
    const has = d.codigos.includes(codigo);
    if (!has && !(codigo in sesCod)) {
      setSesCod((s) => ({ ...s, [codigo]: codigo === '144' ? 1 : (Number(d.sessoes_autorizadas) || 10) }));
    }
    setD((p) => ({ ...p, codigos: has ? p.codigos.filter((c) => c !== codigo) : [...p.codigos, codigo] }));
  };
  const setQtd = (cod: string, v: string) => setSesCod((s) => ({ ...s, [cod]: Math.max(0, parseInt(v) || 0) }));

  const qc = useQueryClient();
  const { data: cfg } = useCassiConfig();
  const codigosDisp: CodigoCfg[] = cfg?.codigos ?? CODIGOS_CASSI.map((c) => ({ codigo: c.codigo, descricao: c.descricao, valor: 0 }));

  // Fase 2 — sessões (agendamentos REAIS) ligadas a esta guia.
  const { data: sessoes = [] } = useQuery({
    queryKey: ['guia-sessoes', guia?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('agendamentos')
        .select('id, data_inicio, status, tipo_atendimento').eq('guia_cassi_id', guia!.id)
        .order('data_inicio', { ascending: true });
      if (error) throw error;
      return (data || []) as Array<{ id: string; data_inicio: string; status: string; tipo_atendimento?: string }>;
    },
    enabled: !!guia?.id,
  });

  // Contagem por DIAS DISTINTOS (1 dia = 1 sessão). A avaliação é um dia extra e
  // NÃO entra na contagem dos dias de tratamento.
  const soTratamento = useMemo(() => sessoes.filter((s) => s.tipo_atendimento !== 'avaliacao' && s.status !== 'cancelado'), [sessoes]);
  const geradas = useMemo(() => new Set(soTratamento.map((s) => s.data_inicio.slice(0, 10))).size, [soTratamento]);
  const realizadas = useMemo(() => {
    const agora = Date.now();
    return new Set(
      soTratamento.filter((s) => new Date(s.data_inicio).getTime() < agora && s.status !== 'faltou' && s.status !== 'bloqueado' && s.status !== 'pendente')
        .map((s) => s.data_inicio.slice(0, 10)),
    ).size;
  }, [soTratamento]);

  const [gerForm, setGerForm] = useState({ inicio: guia?.data_resposta || guia?.data_pedido || hojeISO(), horario: '08:00' });

  const gerarAgenda = useMutation({
    mutationFn: async () => {
      if (!user || !guia?.id) throw new Error('Salve a guia antes de gerar a agenda.');
      const faltam = Math.max(0, (guia.sessoes_autorizadas || 0) - geradas);
      if (faltam <= 0) throw new Error('Todas as sessões autorizadas já estão na agenda.');
      const [hh, mm] = (gerForm.horario || '08:00').split(':').map((n) => parseInt(n, 10));
      // Avaliação (144) é um dia EXTRA no começo. Tratamento em dias úteis seguidos
      // (seg–sex), pra caber 2 guias no mês.
      const temAvaliacao = (guia.codigos || []).some((c) => c.codigo === '144') || d.codigos.includes('144');
      const incluiAval = temAvaliacao && geradas === 0;
      const total = faltam + (incluiAval ? 1 : 0);
      const datas = gerarDatasSessoes(new Date(`${gerForm.inicio}T00:00:00`), total, [1, 2, 3, 4, 5]);
      const rows = datas.map((dt, idx) => {
        const aval = incluiAval && idx === 0;
        const ini = new Date(dt); ini.setHours(hh || 8, mm || 0, 0, 0);
        const fim = new Date(ini.getTime() + 45 * 60000);
        return {
          terapeuta_id: user.id, paciente_id: paciente.id,
          data_inicio: ini.toISOString(), data_fim: fim.toISOString(),
          status: 'confirmado', tipo_atendimento: aval ? 'avaliacao' : 'retorno',
          titulo: `${aval ? 'Avaliação' : 'Sessão'} CASSI${guia.numero_guia ? ` · guia ${guia.numero_guia}` : ''}`,
          guia_cassi_id: guia.id, cor: aval ? '#8b5cf6' : '#0ea5e9',
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
      const codigos = codigosDisp.filter((c) => d.codigos.includes(c.codigo))
        .map((c) => ({ codigo: c.codigo, descricao: c.descricao, sessoes: c.codigo === '144' ? 1 : (sesCod[c.codigo] ?? 0) }));
      // Dias de tratamento: usa o campo; se ficou 0, deriva da maior qtd dos códigos.
      const maxTrat = Math.max(0, ...codigos.filter((c) => c.codigo !== '144').map((c) => Number(c.sessoes) || 0));
      const payload = {
        matricula: d.matricula || null,
        numero_guia: d.numero_guia || null,
        data_pedido: d.data_pedido || hojeISO(),
        data_resposta: d.data_resposta || null,
        sessoes_autorizadas: (Number(d.sessoes_autorizadas) || 0) || maxTrat,
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
      // Modificador de guias/mês do cliente (só grava se mudou).
      if (duasPorMes !== ((paciente.guias_por_mes || 1) >= 2)) {
        await sb.from('pacientes').update({ guias_por_mes: duasPorMes ? 2 : 1 }).eq('id', paciente.id);
      }
      // Carteirinha = matrícula: se o cadastro está sem carteirinha, completa com
      // a matrícula da guia (não sobrescreve uma já preenchida).
      if (d.matricula.trim() && !(paciente.carteirinha || '').trim()) {
        await sb.from('pacientes').update({ carteirinha: d.matricula.trim() }).eq('id', paciente.id);
      }
      // Diagnóstico fica fixo no cadastro (só muda quando o profissional muda).
      if (d.diagnostico.trim() && d.diagnostico.trim() !== (paciente.cassi_diagnostico || '').trim()) {
        await sb.from('pacientes').update({ cassi_diagnostico: d.diagnostico.trim() }).eq('id', paciente.id);
      }
    },
    onSuccess: () => {
      toast.success(editandoExistente ? 'Guia atualizada' : 'Guia criada');
      qc.invalidateQueries({ queryKey: ['cassi-pacientes', user?.id] });
      onSaved();
    },
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
              <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Carteirinha (matrícula)</label>
              <Input value={d.matricula} onChange={(e) => set('matricula', e.target.value)} placeholder="nº do cartão CASSI" />
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
              <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Dias de tratamento</label>
              <Input type="number" min={0} value={d.sessoes_autorizadas} onChange={(e) => set('sessoes_autorizadas', parseInt(e.target.value) || 0)} />
              <p className="text-[10px] text-muted-foreground mt-0.5">Sem contar a avaliação</p>
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
            <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Códigos e sessões autorizadas</label>
            <div className="space-y-1.5 mt-1">
              {codigosDisp.map((c) => {
                const ativo = d.codigos.includes(c.codigo);
                const ev = c.codigo === '144';
                return (
                  <div key={c.codigo} className="flex items-center gap-2">
                    <button type="button" onClick={() => toggleCodigo(c.codigo)}
                      className={`text-[11px] px-2 py-1.5 rounded-lg border flex-1 text-left ${ativo ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground'}`}>
                      {c.codigo} · {c.descricao}{ev ? ' · avaliação' : ''}
                    </button>
                    {ativo && (ev ? (
                      <span className="text-[11px] text-muted-foreground w-[5.5rem] text-right shrink-0">1 dia extra</span>
                    ) : (
                      <div className="flex items-center gap-1 w-[5.5rem] shrink-0">
                        <Input type="number" min={0} className="h-8 text-sm tabular-nums" value={sesCod[c.codigo] ?? ''} onChange={(e) => setQtd(c.codigo, e.target.value)} />
                        <span className="text-[10px] text-muted-foreground">sess.</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Quantidade por código. Se um código não passou, deixe <b>0</b> ou desmarque. A avaliação (144) é um dia extra separado.</p>
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
            <div>
              <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Guias por mês</label>
              <div className="flex gap-1.5 mt-1">
                {[1, 2].map((n) => (
                  <button type="button" key={n} onClick={() => setDuasPorMes(n === 2)}
                    className={`flex-1 text-[12px] py-1.5 rounded-lg border font-medium ${(duasPorMes ? 2 : 1) === n ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground'}`}>
                    {n}/mês
                  </button>
                ))}
              </div>
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
                    Gerar {Math.max(0, (Number(d.sessoes_autorizadas) || 0) - geradas)} sessões (dias úteis)
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
    const header = ['Paciente', 'Carteirinha', 'Status', 'Códigos', 'Autorização', 'Avaliação', 'Realizadas', 'Autorizadas'];
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
        <Input className="h-9 flex-1 min-w-[180px]" placeholder="Buscar paciente ou carteirinha…" value={busca} onChange={(e) => setBusca(e.target.value)} />
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
              <th className="text-left font-semibold px-3 py-2">Carteirinha</th>
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
function PacienteCassiEditor({ paciente, onClose, onSaved, onEncerrar, onReativar }: {
  paciente: Paciente | null;
  onClose: () => void;
  onSaved: () => void;
  onEncerrar?: (id: string, motivo: string) => Promise<void> | void;
  onReativar?: (id: string) => Promise<void> | void;
}) {
  const { user } = useAuth();
  const { data: cfg } = useCassiConfig();
  const codigosDisp: CodigoCfg[] = cfg?.codigos ?? CODIGOS_CASSI.map((c) => ({ codigo: c.codigo, descricao: c.descricao, valor: 0 }));
  const editando = !!paciente;
  const encerrado = !!paciente?.cassi_encerrado_em;
  const [motivoEnc, setMotivoEnc] = useState('Alta (ficou bom)');
  const [f, setF] = useState(() => ({
    nome: paciente?.nome || '',
    sobrenome: paciente?.sobrenome || '',
    carteirinha: paciente?.carteirinha || '',
    diagnostico: paciente?.cassi_diagnostico || '',
    email: paciente?.email || '',
    telefone: paciente?.telefone || '',
  }));
  const [codigos, setCodigos] = useState<string[]>(paciente?.codigos_cassi || []);
  const [guiasPorMes, setGuiasPorMes] = useState<number>(paciente?.guias_por_mes && paciente.guias_por_mes >= 2 ? 2 : 1);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const toggleCod = (c: string) => setCodigos((p) => p.includes(c) ? p.filter((x) => x !== c) : [...p, c]);

  // Modo de cadastro (só ao criar): novo do zero, ou buscar um paciente que já
  // está no app (não-CASSI) e marcá-lo como cliente CASSI.
  const [modo, setModo] = useState<'novo' | 'existente'>('novo');
  const [busca, setBusca] = useState('');
  const [alvoId, setAlvoId] = useState<string | null>(null);
  const [alvoEncerrado, setAlvoEncerrado] = useState(false); // alvo é CASSI encerrado (reativar)
  const termo = busca.trim().replace(/[%,()]/g, '').trim();

  const { data: achados = [], isFetching } = useQuery({
    queryKey: ['cassi-buscar-paciente', user?.id, termo],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('pacientes')
        .select('id, nome, sobrenome, email, telefone, carteirinha, codigos_cassi, plano_saude, guias_por_mes, cassi_encerrado_em')
        .eq('terapeuta_id', user!.id).eq('ativo', true)
        .or(`nome.ilike.%${termo}%,sobrenome.ilike.%${termo}%`)
        .order('nome', { ascending: true }).limit(30);
      if (error) throw error;
      // Mostra: não-CASSI (pra adicionar) e CASSI ENCERRADO (pra reativar). Tira só
      // os CASSI ativos (esses já aparecem no Controle).
      return (data || []).filter((p: any) => !/cassi/i.test(String(p.plano_saude || '')) || !!p.cassi_encerrado_em);
    },
    enabled: !!user && !editando && modo === 'existente' && termo.length >= 2,
  });

  const resetNovo = () => {
    setF({ nome: '', sobrenome: '', carteirinha: '', diagnostico: '', email: '', telefone: '' });
    setCodigos([]); setGuiasPorMes(1); setAlvoId(null); setAlvoEncerrado(false);
  };
  const escolher = (p: any) => {
    setF({ nome: p.nome || '', sobrenome: p.sobrenome || '', carteirinha: p.carteirinha || '', diagnostico: p.cassi_diagnostico || '', email: p.email || '', telefone: p.telefone || '' });
    setCodigos(Array.isArray(p.codigos_cassi) ? p.codigos_cassi : []);
    setGuiasPorMes(Number(p.guias_por_mes) >= 2 ? 2 : 1);
    setAlvoId(p.id);
    setAlvoEncerrado(!!p.cassi_encerrado_em);
  };

  const salvar = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Sem sessão');
      if (!f.nome.trim()) throw new Error('Informe o nome.');
      const sb: any = supabase;
      const payload = {
        nome: f.nome.trim(),
        sobrenome: f.sobrenome.trim() || '',
        carteirinha: f.carteirinha.trim() || null,
        cassi_diagnostico: f.diagnostico.trim() || null,
        email: f.email.trim() || null,
        telefone: f.telefone.replace(/\D/g, '') || null,
        codigos_cassi: codigos,
        guias_por_mes: guiasPorMes,
      };
      if (editando) {
        const { error } = await sb.from('pacientes').update(payload).eq('id', paciente!.id);
        if (error) throw error;
      } else if (alvoId) {
        // Converte (não-CASSI) ou reativa (CASSI encerrado) um paciente existente.
        const upd: any = { ...payload, plano_saude: 'CASSI' };
        if (alvoEncerrado) { upd.cassi_encerrado_em = null; upd.cassi_encerrado_motivo = null; }
        const { error } = await sb.from('pacientes').update(upd).eq('id', alvoId);
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
    onSuccess: () => { toast.success(editando ? 'Cadastro atualizado' : alvoId ? (alvoEncerrado ? 'Cliente reativado' : 'Cliente adicionado ao CASSI') : 'Cliente cadastrado'); onSaved(); },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar'),
  });

  const buscando = !editando && modo === 'existente' && !alvoId;
  const titulo = editando ? 'Editar cadastro' : alvoId ? (alvoEncerrado ? 'Reativar cliente' : 'Adicionar ao CASSI') : 'Cadastrar cliente CASSI';

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md w-[95vw] max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-base">{titulo}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {!editando && (
            <div className="flex gap-1.5">
              <button type="button" onClick={resetNovo}
                className={`flex-1 text-[12px] py-1.5 rounded-lg border font-medium ${modo === 'novo' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground'}`}
                style={{ opacity: modo === 'novo' ? 1 : undefined }}>
                Novo cliente
              </button>
              <button type="button" onClick={() => { setModo('existente'); setAlvoId(null); }}
                className={`flex-1 text-[12px] py-1.5 rounded-lg border font-medium ${modo === 'existente' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground'}`}>
                Buscar no app
              </button>
            </div>
          )}

          {buscando ? (
            <div className="space-y-2">
              <div className="relative">
                <Search className="h-4 w-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                <Input className="h-9 pl-8" placeholder="Buscar paciente por nome…" value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus />
              </div>
              {termo.length < 2 ? (
                <p className="text-[12px] text-muted-foreground text-center py-4">Digite ao menos 2 letras para buscar clientes já cadastrados no app.</p>
              ) : isFetching ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : achados.length === 0 ? (
                <p className="text-[12px] text-muted-foreground text-center py-4">Ninguém encontrado com esse nome (ou já é CASSI).</p>
              ) : (
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {achados.map((p: any) => {
                    const enc = !!p.cassi_encerrado_em;
                    return (
                      <button key={p.id} type="button" onClick={() => escolher(p)}
                        className="w-full text-left rounded-lg border border-border/50 px-2.5 py-2 hover:bg-muted/50 flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{p.nome} {p.sobrenome || ''}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {enc ? 'CASSI encerrado — reativar' : p.plano_saude ? `Plano: ${p.plano_saude}` : ''}{(enc || p.plano_saude) && p.telefone ? ' · ' : ''}{p.telefone || ''}
                          </p>
                        </div>
                        {enc
                          ? <span className="text-[10px] font-bold text-emerald-700 shrink-0">reativar</span>
                          : <Plus className="h-4 w-4 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
              <Button variant="outline" className="w-full" onClick={onClose}>Cancelar</Button>
            </div>
          ) : (
          <>
          {alvoId && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 flex items-center gap-2">
              <p className="text-[12px] flex-1">{alvoEncerrado ? <>Reativando <b>{f.nome} {f.sobrenome}</b> — volta pras listas do Controle.</> : <>Marcando <b>{f.nome} {f.sobrenome}</b> (já no app) como cliente CASSI.</>}</p>
              <button type="button" className="text-[11px] text-primary shrink-0" onClick={() => setAlvoId(null)}>trocar</button>
            </div>
          )}
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
            <Input value={f.carteirinha} onChange={(e) => set('carteirinha', e.target.value)} placeholder="nº do cartão CASSI" />
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Diagnóstico médico</label>
            <Input value={f.diagnostico} onChange={(e) => set('diagnostico', e.target.value)} placeholder="fica fixo — pré-preenche os pedidos" />
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
          <div>
            <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Guias por mês</label>
            <div className="flex gap-1.5 mt-1">
              {[1, 2].map((n) => (
                <button type="button" key={n} onClick={() => setGuiasPorMes(n)}
                  className={`flex-1 text-[12px] py-1.5 rounded-lg border font-medium ${guiasPorMes === n ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground'}`}>
                  {n} guia{n > 1 ? 's' : ''}/mês
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">2/mês avisa pra pedir a próxima guia ~13 dias após a resposta da CASSI.</p>
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
          <p className="text-[10px] text-muted-foreground">{alvoId ? 'Passa a ser CASSI e aparece no Controle. Mantém o histórico e o cadastro que já tinha no app.' : 'Entra como CASSI, ativo. Os códigos da guia você define ao criar a guia.'}</p>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1 gap-1.5" disabled={salvar.isPending} onClick={() => salvar.mutate()}>
              {salvar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
            </Button>
          </div>

          {/* Encerrar / reativar acompanhamento (só ao editar um cliente existente) */}
          {editando && paciente && (
            <div className="pt-2 mt-1 border-t border-border/40">
              {encerrado ? (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-muted-foreground">
                    Encerrado{paciente.cassi_encerrado_motivo ? ` · ${paciente.cassi_encerrado_motivo}` : ''}. Não aparece nas listas.
                  </p>
                  <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={() => onReativar?.(paciente.id)}>Reativar</Button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Encerrar acompanhamento (sai das listas)</label>
                  <div className="flex items-center gap-1.5">
                    <select value={motivoEnc} onChange={(e) => setMotivoEnc(e.target.value)}
                      className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm">
                      {['Alta (ficou bom)', 'Viagem', 'Desistiu / não continua', 'Mudou de cidade', 'Outro'].map((mo) => <option key={mo} value={mo}>{mo}</option>)}
                    </select>
                    <Button size="sm" variant="ghost" className="h-9 text-destructive hover:text-destructive shrink-0"
                      onClick={() => { if (confirm('Encerrar o acompanhamento CASSI deste cliente? Ele sai das listas mas o histórico fica guardado.')) onEncerrar?.(paciente.id, motivoEnc); }}>
                      Encerrar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
          </>
          )}
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
  const [impostoPct, setImpostoPct] = useState('0');
  const [minhaParte, setMinhaParte] = useState('0');
  const [responsaveis, setResponsaveis] = useState<ResponsavelCfg[]>([]);
  const [nomeClinica, setNomeClinica] = useState('');
  const [nomeProf, setNomeProf] = useState('');
  const [cidade, setCidade] = useState('');
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    if (cfg && !pronto) {
      setCodigos(cfg.codigos.map((c) => ({ ...c })));
      setImpostoPct(String(cfg.imposto_percentual || 0));
      setMinhaParte(String(cfg.minha_parte_percentual || 0));
      setResponsaveis((cfg.responsaveis || []).map((r) => ({ ...r })));
      setNomeClinica(cfg.nome_clinica || '');
      setNomeProf(cfg.nome_profissional || '');
      setCidade(cfg.cidade || '');
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
        .map((c) => ({ codigo: c.codigo.trim(), descricao: c.descricao.trim(), valor: Number(c.valor) || 0, codigo_oficial: (c.codigo_oficial || '').trim() }));
      const respLimpos = responsaveis.filter((r) => r.nome.trim())
        .map((r) => ({ nome: r.nome.trim(), percentual: Number(r.percentual) || 0 }));
      const { error } = await (supabase as any).from('cassi_config').upsert({
        terapeuta_id: user.id,
        codigos: limpos,
        imposto_por_guia: 0, // migrado para percentual
        imposto_percentual: parseFloat(impostoPct.replace(',', '.')) || 0,
        minha_parte_percentual: parseFloat(minhaParte.replace(',', '.')) || 0,
        responsaveis: respLimpos,
        nome_clinica: nomeClinica.trim(),
        nome_profissional: nomeProf.trim(),
        cidade: cidade.trim(),
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
              <p className="text-[11px] text-muted-foreground mb-2">Os códigos que você usa, o código oficial (aparece no relatório) e quanto vale cada um.</p>
              <div className="space-y-2">
                {codigos.map((c, i) => (
                  <div key={i} className="rounded-lg border border-border/50 p-2 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Input className="h-8 w-16 text-sm" value={c.codigo} onChange={(e) => setCod(i, 'codigo', e.target.value)} placeholder="000" />
                      <Input className="h-8 flex-1 text-sm" value={c.descricao} onChange={(e) => setCod(i, 'descricao', e.target.value)} placeholder="descrição" />
                      <Button size="icon" variant="ghost" className="h-8 w-7 shrink-0" title="Remover" onClick={() => rmCod(i)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Input className="h-8 flex-1 text-sm tabular-nums" value={c.codigo_oficial || ''} onChange={(e) => setCod(i, 'codigo_oficial', e.target.value)} placeholder="código oficial (ex: 50000012)" />
                      <div className="flex items-center gap-1 w-28">
                        <span className="text-[11px] text-muted-foreground">R$</span>
                        <Input className="h-8 text-sm tabular-nums" value={String(c.valor)} onChange={(e) => setCod(i, 'valor', e.target.value)} placeholder="0,00" inputMode="decimal" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Button size="sm" variant="outline" className="mt-2 h-8 gap-1 w-full" onClick={addCod}>
                <Plus className="h-3.5 w-3.5" /> Adicionar código
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Imposto por guia (%)</label>
                <Input className="h-9" value={impostoPct} onChange={(e) => setImpostoPct(e.target.value)} inputMode="decimal" placeholder="ex: 14" />
                <p className="text-[10px] text-muted-foreground mt-0.5">Descontado do bruto de cada guia.</p>
              </div>
              <div>
                <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Sua parte (%)</label>
                <Input className="h-9" value={minhaParte} onChange={(e) => setMinhaParte(e.target.value)} inputMode="decimal" placeholder="ex: 45" />
                <p className="text-[10px] text-muted-foreground mt-0.5">Do líquido (após imposto). O resto fica com a clínica.</p>
              </div>
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

            <div>
              <p className="text-sm font-bold mb-0.5">Dados do relatório</p>
              <p className="text-[11px] text-muted-foreground mb-2">Aparecem no cabeçalho e na assinatura do relatório de produção entregue à clínica.</p>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Clínica</label>
                    <Input className="h-9" value={nomeClinica} onChange={(e) => setNomeClinica(e.target.value)} placeholder="ex: MoviMED" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Cidade</label>
                    <Input className="h-9" value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="ex: Belém" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Seu nome (assinatura)</label>
                  <Input className="h-9" value={nomeProf} onChange={(e) => setNomeProf(e.target.value)} placeholder="ex: Rafael Marcus Braga Mocbel" />
                </div>
              </div>
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
function PedirGuiasPanel({ linhas, onNovaGuia, onDarBaixa }: {
  linhas: Array<{ paciente: Paciente; guia: GuiaCassi | null }>;
  onNovaGuia: (p: Paciente) => void;
  onDarBaixa: (ids: string[]) => Promise<void> | void;
}) {
  const { data: cfg } = useCassiConfig();
  const codigosDisp: CodigoCfg[] = cfg?.codigos ?? CODIGOS_CASSI.map((c) => ({ codigo: c.codigo, descricao: c.descricao, valor: 0 }));
  const [dandoBaixa, setDandoBaixa] = useState(false);
  const [verTexto, setVerTexto] = useState(false);

  // Motivo de cada cliente estar na lista (sem guia / acabando / 2ª guia do mês).
  const motivos = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of linhas) {
      m.set(l.paciente.id, venceuPrazoProximaGuia(l.guia, l.paciente.guias_por_mes)
        ? '2ª guia do mês' : statusPaciente(l.guia).label);
    }
    return m;
  }, [linhas]);

  const novoItem = (l: { paciente: Paciente; guia: GuiaCassi | null }): ItemPedido => ({
    id: l.paciente.id,
    nome: `${l.paciente.nome} ${l.paciente.sobrenome || ''}`.trim(),
    sel: true,
    carteirinha: l.paciente.carteirinha || l.guia?.matricula || '',
    diagnostico: l.paciente.cassi_diagnostico || l.guia?.diagnostico || '',
    codigos: (l.paciente.codigos_cassi?.length ? l.paciente.codigos_cassi : (l.guia?.codigos?.map((c) => c.codigo) || [])).slice(0, 3),
  });
  const [itens, setItens] = useState<ItemPedido[]>(() => linhas.map(novoItem));
  // Mantém os itens em sincronia com a lista (ex.: depois de dar baixa), preservando
  // as edições dos que continuam.
  const idsKey = linhas.map((l) => l.paciente.id).join(',');
  useEffect(() => {
    setItens((prev) => {
      const byId = new Map(prev.map((i) => [i.id, i]));
      return linhas.map((l) => byId.get(l.paciente.id) || novoItem(l));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

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
  const semCarteirinha = selecionados.filter((i) => !i.carteirinha.trim()).length;
  const texto = [
    `*Solicitação de novas guias CASSI* (${selecionados.length} cliente${selecionados.length === 1 ? '' : 's'})`,
    '',
    ...selecionados.map((i, idx) =>
      `${idx + 1}. *${i.nome}*\nCarteirinha: ${i.carteirinha || '—'}\nCódigos: ${i.codigos.join(', ') || '—'}\nDiagnóstico: ${i.diagnostico || '—'}`
    ),
  ].join('\n');

  const copiar = async () => {
    try { await navigator.clipboard.writeText(texto); toast.success('Texto copiado!'); }
    catch { toast.error('Não consegui copiar — selecione e copie manualmente.'); }
  };
  const enviarWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');

  const label = (t: string) => <label className="text-[10px] uppercase text-muted-foreground tracking-wide">{t}</label>;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-bold">Montar pedido</h2>
        <span className="text-[12px] text-muted-foreground">{selecionados.length} selecionado(s)</span>
      </div>

      {/* Cards dos clientes — compactos */}
      <div className="space-y-1.5">
        {itens.map((it) => {
          const semCart = it.sel && !it.carteirinha.trim();
          return (
            <div key={it.id} className={`rounded-lg border transition-colors ${it.sel ? (semCart ? 'border-rose-300 dark:border-rose-800 bg-rose-50/30 dark:bg-rose-950/10' : 'border-primary/40 bg-primary/5') : 'border-border/50'}`}>
              <button onClick={() => upd(it.id, { sel: !it.sel })} className="w-full flex items-center gap-2 px-2.5 py-2 text-left">
                {it.sel ? <CheckCircle2 className="h-4 w-4 text-primary shrink-0" /> : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />}
                <span className="text-sm font-semibold flex-1 min-w-0 truncate">{it.nome}</span>
                {motivos.get(it.id) && (
                  <span className={`text-[9px] uppercase font-bold rounded px-1 shrink-0 ${motivos.get(it.id) === '2ª guia do mês' ? 'text-violet-700 bg-violet-100 dark:bg-violet-900/30' : 'text-amber-700 bg-amber-100 dark:bg-amber-900/30'}`}>
                    {motivos.get(it.id)}
                  </span>
                )}
              </button>

              {it.sel && (
                <div className="px-2.5 pb-2.5 space-y-1.5">
                  <div className="grid grid-cols-2 gap-1.5">
                    <Input className={`h-8 text-xs ${semCart ? 'border-rose-400 dark:border-rose-700' : ''}`}
                      value={it.carteirinha} onChange={(e) => upd(it.id, { carteirinha: e.target.value })} placeholder="Carteirinha (nº CASSI)" />
                    <Input className="h-8 text-xs" value={it.diagnostico} onChange={(e) => upd(it.id, { diagnostico: e.target.value })} placeholder="Diagnóstico" />
                  </div>
                  {semCart && <p className="text-[10px] text-rose-600">Sem carteirinha — preencha pra poder pedir.</p>}
                  <div className="flex items-center gap-1 flex-wrap">
                    {codigosDisp.map((c) => {
                      const on = it.codigos.includes(c.codigo);
                      return (
                        <button key={c.codigo} type="button" onClick={() => toggleCod(it.id, c.codigo)}
                          className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${on ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground'}`}>
                          {c.codigo}
                        </button>
                      );
                    })}
                    <button className="text-[10px] text-muted-foreground underline underline-offset-2 ml-auto" onClick={() => onNovaGuia(linhas.find((l) => l.paciente.id === it.id)!.paciente)}>
                      registrar manual
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Ações */}
      <div className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-2 sticky bottom-2">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="gap-1.5" disabled={selecionados.length === 0} onClick={copiar}>
            <Copy className="h-4 w-4" /> Copiar
          </Button>
          <Button className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" disabled={selecionados.length === 0} onClick={enviarWhatsApp}>
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </Button>
        </div>
        {semCarteirinha > 0 && (
          <p className="text-[11px] text-rose-600 text-center">
            {semCarteirinha} sem carteirinha — preencha antes de dar baixa.
          </p>
        )}
        <Button
          className="w-full gap-1.5"
          disabled={selecionados.length === 0 || semCarteirinha > 0 || dandoBaixa}
          onClick={async () => {
            setDandoBaixa(true);
            try {
              await Promise.all(selecionados.map((i) => {
                const payload: any = { codigos_cassi: i.codigos };
                if (i.carteirinha.trim()) payload.carteirinha = i.carteirinha.trim();
                if (i.diagnostico.trim()) payload.cassi_diagnostico = i.diagnostico.trim();
                return (supabase as any).from('pacientes').update(payload).eq('id', i.id);
              }));
              await onDarBaixa(selecionados.map((i) => i.id));
              toast.success('Baixa registrada — foram pra "aguardando CASSI".');
            } finally { setDandoBaixa(false); }
          }}
        >
          {dandoBaixa ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Dar baixa ({selecionados.length})
        </Button>
        <button className="w-full text-[11px] text-muted-foreground" onClick={() => setVerTexto((v) => !v)}>
          {verTexto ? 'ocultar mensagem' : 'ver a mensagem que vai no WhatsApp'}
        </button>
        {verTexto && <Textarea readOnly value={texto} rows={Math.min(10, Math.max(4, selecionados.length * 4))} className="text-xs font-mono bg-background" />}
      </div>
    </div>
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
  const [relatorioOpen, setRelatorioOpen] = useState(false);
  const [verSnap, setVerSnap] = useState<any | null>(null);

  // Relatórios salvos (snapshots congelados).
  const { data: salvos = [] } = useQuery({
    queryKey: ['relatorios-cassi', user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('relatorios_cassi').select('id, mes, titulo, dados, criado_em')
        .eq('terapeuta_id', user!.id).order('mes', { ascending: false });
      if (error) throw error;
      return (data || []) as Array<{ id: string; mes: string; titulo: string; dados: any; criado_em: string }>;
    },
    enabled: !!user,
  });

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
        .select('id, paciente_id, data_inicio, status, tipo_atendimento')
        .eq('terapeuta_id', user!.id)
        .gte('data_inicio', de).lt('data_inicio', ate);
      if (error) throw error;
      return (data || []) as Array<{ id: string; paciente_id: string | null; data_inicio: string; status: string; tipo_atendimento?: string }>;
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
      if (a.tipo_atendimento === 'avaliacao') continue; // dia extra, não é dia de tratamento
      if (a.status === 'cancelado' || a.status === 'faltou' || a.status === 'bloqueado' || a.status === 'pendente') continue;
      const d = new Date(a.data_inicio);
      if (d.getFullYear() !== ano || d.getMonth() !== m - 1) continue; // mês local
      if (d.getTime() > agora) continue; // ainda não aconteceu
      sessoesPorPac.set(a.paciente_id, (sessoesPorPac.get(a.paciente_id) || 0) + 1);
    }

    const valorDe = (c: string) => cfg?.codigos.find((x) => x.codigo === c)?.valor || 0;
    const impostoPct = cfg?.imposto_percentual || 0;
    const impostoFixo = cfg?.imposto_por_guia || 0;

    const linhas = [...sessoesPorPac.entries()]
      .filter(([, n]) => n > 0)
      .map(([pid, sessoes]) => {
        const guia = guiaPorPac.get(pid) || null;
        const codigos = guia?.codigos?.length
          ? guia.codigos
          : (codigosPac.get(pid)?.length ? codigosPac.get(pid)!.map((c) => ({ codigo: c })) : [{ codigo: '012' }]);
        const bruto = brutoGuia(codigos, sessoes, valorDe);
        // Imposto por guia: percentual do bruto (novo) ou o valor fixo antigo.
        const imposto = impostoPct > 0 ? bruto * (impostoPct / 100) : impostoFixo;
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

    // Divisão principal: sua parte (% do líquido) e o que fica com a clínica.
    const minhaPct = cfg?.minha_parte_percentual || 0;
    const suaParte = totLiquido * (minhaPct / 100);
    const parteClinica = totLiquido - suaParte;

    return {
      linhas, totBruto, totImposto, totLiquido, totSessoes, impostoPct,
      minhaPct, suaParte, parteClinica,
      repasses, totRepasse, ficaComVoce: totLiquido - totRepasse,
    };
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
  // A CASSI paga a clínica ~3 meses depois das guias entregues no mês.
  const dRec = new Date(ano, m - 1 + 3, 1);
  const mesRecebimento = `${MESES_PT[dRec.getMonth()]} ${dRec.getFullYear()}`;

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
          <Button size="sm" className="h-8 gap-1.5" onClick={() => setRelatorioOpen(true)}>
            <FileText className="h-3.5 w-3.5" /> Relatório
          </Button>
        </div>
      </div>

      {relatorioOpen && <RelatorioProducao mes={mes} onClose={() => setRelatorioOpen(false)} />}

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
          { label: `Imposto${calc.impostoPct ? ` (${calc.impostoPct}%)` : ''}`, valor: `− ${fmtBRL(calc.totImposto)}`, cls: 'text-rose-600' },
          { label: 'Líquido', valor: fmtBRL(calc.totLiquido), cls: '' },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-border/50 bg-background p-3">
            <p className={`text-lg font-black tabular-nums leading-none ${c.cls}`}>{c.valor}</p>
            <p className="text-[10px] uppercase text-muted-foreground tracking-wide mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Divisão: sua parte × clínica */}
      {calc.totLiquido > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 p-3">
            <p className="text-2xl font-black tabular-nums leading-none text-emerald-700 dark:text-emerald-400">{fmtBRL(calc.suaParte)}</p>
            <p className="text-[10px] uppercase text-muted-foreground tracking-wide mt-1">Sua parte{calc.minhaPct ? ` · ${calc.minhaPct}%` : ''}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-background p-3">
            <p className="text-2xl font-black tabular-nums leading-none">{fmtBRL(calc.parteClinica)}</p>
            <p className="text-[10px] uppercase text-muted-foreground tracking-wide mt-1">Clínica</p>
          </div>
        </div>
      )}

      {calc.totLiquido > 0 && (
        <div className="rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50/60 dark:bg-sky-950/20 p-3 flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-sky-600 shrink-0" />
          <p className="text-[12px] text-sky-800 dark:text-sky-300">
            A CASSI paga a clínica ~3 meses depois. Previsão deste fechamento: <b className="capitalize">{mesRecebimento}</b>.
          </p>
        </div>
      )}

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
          {(cfg?.responsaveis?.length || 0) > 0 && calc.repasses.length > 0 && (
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

      {/* Relatórios salvos (snapshots congelados) */}
      {salvos.length > 0 && (
        <div className="rounded-xl border border-border/50 bg-background overflow-hidden">
          <div className="px-3 py-2 border-b border-border/50 bg-muted/30">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Relatórios salvos</p>
          </div>
          <div className="divide-y divide-border/40">
            {salvos.map((r) => (
              <button key={r.id} onClick={() => setVerSnap(r.dados)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 text-left">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{r.titulo || r.mes}</p>
                  <p className="text-[11px] text-muted-foreground">
                    sua parte {fmtBRL(r.dados?.sua_parte || 0)} · {Array.isArray(r.dados?.rows) ? r.dados.rows.length : 0} linhas
                  </p>
                </div>
                <span className="text-[11px] text-primary shrink-0">abrir ›</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {verSnap && <RelatorioSnapshotView dados={verSnap} onClose={() => setVerSnap(null)} />}
    </div>
  );
}

// ── Relatório de produção (o arquivo entregue à clínica no fim do mês) ─────────
// Uma linha por guia, com a quantidade de cada código e a soma. Total, desconto
// do imposto (%) e a sua parte (%). Pronto para imprimir / salvar em PDF.
function RelatorioProducao({ mes, onClose }: { mes: string; onClose: () => void }) {
  const { user } = useAuth();
  const { data: cfg } = useCassiConfig();
  const [mesRel, setMesRel] = useState(mes);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  // Gera um PDF de verdade do relatório (html2canvas + jsPDF) e baixa. Multipágina
  // se passar de uma folha A4. As libs são importadas sob demanda.
  const baixarPdf = async () => {
    const el = document.getElementById('relatorio-print');
    if (!el) return;
    setGerandoPdf(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'), import('jspdf'),
      ]);
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const img = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pw) / canvas.width;
      let heightLeft = imgH;
      let position = 0;
      pdf.addImage(img, 'JPEG', 0, position, pw, imgH);
      heightLeft -= ph;
      while (heightLeft > 0) {
        position -= ph;
        pdf.addPage();
        pdf.addImage(img, 'JPEG', 0, position, pw, imgH);
        heightLeft -= ph;
      }
      pdf.save(`relatorio-cassi-${mesRel}.pdf`);
    } catch (e: any) {
      toast.error('Não consegui gerar o PDF — use "Imprimir" e salve como PDF.');
      console.error('[Relatorio] PDF falhou:', e);
    } finally {
      setGerandoPdf(false);
    }
  };

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

  const cods = cfg?.codigos || [];
  const valorDe = (c: string) => cods.find((x) => x.codigo === c)?.valor || 0;
  const colAval = cods.find((c) => c.codigo === '144');
  const colsTrat = cods.filter((c) => c.codigo !== '144');
  const columns = [...(colAval ? [colAval] : []), ...colsTrat];

  // Agendamentos ligados a guias — para saber em que mês cada guia foi concluída.
  const { data: ags = [] } = useQuery({
    queryKey: ['cassi-ags-guia', user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('agendamentos')
        .select('guia_cassi_id, data_inicio, status, tipo_atendimento')
        .eq('terapeuta_id', user!.id).not('guia_cassi_id', 'is', null);
      if (error) throw error;
      return (data || []) as Array<{ guia_cassi_id: string; data_inicio: string; status: string; tipo_atendimento?: string }>;
    },
    enabled: !!user,
  });

  // Mês de produção de cada guia = mês da ÚLTIMA sessão de tratamento realizada
  // (a guia "fechou" nesse mês). Sem agenda, cai na data de resposta/pedido.
  const mesFimPorGuia = useMemo(() => {
    const ultima = new Map<string, string>(); // guiaId -> maior data local YYYY-MM-DD (agendada ou realizada)
    for (const a of ags) {
      if (!a.guia_cassi_id || a.tipo_atendimento === 'avaliacao') continue;
      if (a.status === 'cancelado') continue;
      const dt = new Date(a.data_inicio);
      const ymd = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      const cur = ultima.get(a.guia_cassi_id);
      if (!cur || ymd > cur) ultima.set(a.guia_cassi_id, ymd);
    }
    return ultima;
  }, [ags]);
  const mesProducao = (g: GuiaCassi) => {
    const fim = mesFimPorGuia.get(g.id) || projetarFimGuia(g);
    return fim ? fim.slice(0, 7) : '';
  };

  const candidatas = useMemo(
    () => guias.filter((g) => g.status !== 'cancelada' && somaGuia(g.codigos, valorDe) > 0)
      .sort((a, b) => `${a.pacientes?.nome || ''}`.localeCompare(`${b.pacientes?.nome || ''}`, 'pt-BR')),
    [guias, valorDe],
  );

  // Seleção automática: guias cujo mês de produção = mês do relatório.
  const autoSel = useMemo(() => {
    const s = new Set<string>();
    for (const g of candidatas) if (mesProducao(g) === mesRel) s.add(g.id);
    return s;
  }, [candidatas, mesRel, mesFimPorGuia]);

  const [sel, setSel] = useState<Set<string>>(new Set());
  const autoSig = useMemo(() => [...autoSel].sort().join(','), [autoSel]);
  const lastSig = useRef<string | null>(null);
  useEffect(() => {
    // Reaplica a seleção automática quando muda o mês ou quando os dados chegam
    // (o conteúdo do auto muda). Ajustes manuais valem até isso acontecer.
    if (lastSig.current !== autoSig) { lastSig.current = autoSig; setSel(new Set(autoSel)); }
  }, [autoSig, autoSel]);
  const toggle = (id: string) => setSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const qtd = (g: GuiaCassi, cod: string) => Number((g.codigos || []).find((c) => c.codigo === cod)?.sessoes) || 0;
  const rows = candidatas.filter((g) => sel.has(g.id));
  const bruto = rows.reduce((s, g) => s + somaGuia(g.codigos, valorDe), 0);
  const imp = cfg?.imposto_percentual || 0;
  const aposImp = bruto * (1 - imp / 100);
  const minha = cfg?.minha_parte_percentual || 0;
  const suaParte = aposImp * (minha / 100);

  const [ano, m] = mesRel.split('-').map(Number);
  const mesNome = (MESES_PT[m - 1] || '').toUpperCase();
  const hoje = new Date();
  const dataAssin = `${cfg?.cidade ? cfg.cidade + ', ' : ''}${String(hoje.getDate()).padStart(2, '0')} de ${MESES_PT[hoje.getMonth()]} de ${hoje.getFullYear()}`;

  const qc = useQueryClient();
  const [salvando, setSalvando] = useState(false);
  // Salva o relatório atual como snapshot congelado (substitui o do mesmo mês).
  const salvarSnapshot = async () => {
    if (!user || rows.length === 0) return;
    setSalvando(true);
    try {
      const dados = {
        nome_clinica: cfg?.nome_clinica || '',
        nome_profissional: cfg?.nome_profissional || '',
        cidade: cfg?.cidade || '',
        mes_label: mesNome,
        data_assinatura: `${String(hoje.getDate()).padStart(2, '0')} de ${MESES_PT[hoje.getMonth()]} de ${hoje.getFullYear()}`,
        columns: columns.map((c) => ({ codigo: c.codigo, oficial: c.codigo_oficial || c.codigo, label: c.codigo === '144' ? 'Avaliação' : 'Código' })),
        rows: rows.map((g) => ({ nome: `${g.pacientes?.nome || ''} ${g.pacientes?.sobrenome || ''}`.trim(), q: columns.map((c) => qtd(g, c.codigo)), soma: somaGuia(g.codigos, valorDe) })),
        total_bruto: bruto, imposto_pct: imp, apos_imposto: aposImp, minha_pct: minha, sua_parte: suaParte,
      };
      const titulo = `${(MESES_PT[m - 1] || '').replace(/^./, (ch) => ch.toUpperCase())}/${ano}`;
      await (supabase as any).from('relatorios_cassi').delete().eq('terapeuta_id', user.id).eq('mes', mesRel);
      const { error } = await (supabase as any).from('relatorios_cassi').insert({ terapeuta_id: user.id, mes: mesRel, titulo, dados });
      if (error) throw error;
      toast.success('Relatório salvo!');
      qc.invalidateQueries({ queryKey: ['relatorios-cassi', user.id] });
    } catch (e: any) { toast.error(e.message || 'Erro ao salvar'); }
    finally { setSalvando(false); }
  };

  const th: CSSProperties = { background: '#12314a', color: '#fff', border: '1px solid #0b2136', padding: '6px 8px', fontWeight: 700, fontSize: 12, textAlign: 'center' };
  const td: CSSProperties = { border: '1px solid #cbd5e1', padding: '6px 8px', fontSize: 12 };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl w-[96vw] max-h-[92vh] overflow-y-auto">
        <style>{`@media print {
          body * { visibility: hidden !important; }
          #relatorio-print, #relatorio-print * { visibility: visible !important; }
          #relatorio-print { position: absolute !important; left: 0; top: 0; width: 100%; max-height: none !important; overflow: visible !important; }
          .no-print { display: none !important; }
        }`}</style>

        <DialogHeader className="no-print">
          <DialogTitle className="text-base">Relatório de produção — entregar à clínica</DialogTitle>
        </DialogHeader>

        {/* Controles (não saem na impressão) */}
        <div className="no-print space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div>
              <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Mês do relatório</label>
              <Input type="month" value={mesRel} onChange={(e) => e.target.value && setMesRel(e.target.value)} className="h-8 w-[9.5rem] text-sm" />
            </div>
            <div className="ml-auto mt-4 flex items-center gap-1.5">
              <Button size="sm" variant="outline" className="h-8 gap-1.5" disabled={salvando || rows.length === 0} onClick={salvarSnapshot}>
                {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => window.print()}>
                <FileText className="h-3.5 w-3.5" /> Imprimir
              </Button>
              <Button size="sm" className="h-8 gap-1.5" disabled={gerandoPdf} onClick={baixarPdf}>
                {gerandoPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Baixar PDF
              </Button>
            </div>
          </div>

          {(!cfg?.nome_clinica || !cods.some((c) => c.valor > 0)) && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-2.5 text-[11px] text-amber-800 dark:text-amber-300">
              Preencha em <b>Configurações</b>: nome da clínica, cidade, seu nome, os valores e o código oficial de cada código, o imposto (%) e a sua parte (%).
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Guias no relatório ({rows.length})</p>
              <button className="text-[11px] text-primary" onClick={() => setSel(new Set(autoSel))}>Selecionar automático</button>
            </div>
            <p className="text-[11px] text-muted-foreground mb-1.5">
              Selecionadas automaticamente as guias que <b>fecharam</b> em {MESES_PT[m - 1]} {ano}. Desmarque/marque se precisar.
            </p>
            <div className="space-y-1 max-h-48 overflow-y-auto rounded-lg border border-border/50 p-1.5">
              {candidatas.length === 0 ? (
                <p className="text-[12px] text-muted-foreground text-center py-3">Nenhuma guia para listar.</p>
              ) : candidatas.map((g) => {
                const mp = mesProducao(g);
                const doMes = mp === mesRel;
                return (
                  <label key={g.id} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-muted/50 cursor-pointer">
                    <input type="checkbox" checked={sel.has(g.id)} onChange={() => toggle(g.id)} className="h-4 w-4 accent-primary" />
                    <span className="text-[12px] flex-1 truncate">{g.pacientes?.nome} {g.pacientes?.sobrenome || ''}</span>
                    {!doMes && mp && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {(() => { const [ya, ma] = mp.split('-').map(Number); return `${MESES_PT[ma - 1]?.slice(0, 3)}/${String(ya).slice(2)}`; })()}
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{fmtBRL(somaGuia(g.codigos, valorDe))}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Relatório imprimível */}
        <div id="relatorio-print" style={{ background: '#fff', color: '#111', padding: 16 }}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            {cfg?.nome_clinica && <p style={{ fontSize: 22, fontWeight: 800, letterSpacing: 1 }}>{cfg.nome_clinica}</p>}
            <p style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>RELATÓRIO FINANCEIRO DOS CONVÊNIOS — MÊS DE {mesNome}</p>
            {cfg?.nome_profissional && <p style={{ fontSize: 13, fontWeight: 700 }}>FISIOTERAPEUTA {cfg.nome_profissional.toUpperCase()}</p>}
            <p style={{ fontSize: 20, fontWeight: 800, marginTop: 8 }}>CASSI</p>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left' }}>Nome do Paciente</th>
                {columns.map((c) => (
                  <th key={c.codigo} style={th}>
                    {c.codigo === '144' ? 'Avaliação' : 'Código'}<br />({c.codigo_oficial || c.codigo})
                  </th>
                ))}
                <th style={th}>Soma</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td style={{ ...td, textAlign: 'center' }} colSpan={columns.length + 2}>Selecione as guias acima.</td></tr>
              ) : rows.map((g) => (
                <tr key={g.id}>
                  <td style={td}>{g.pacientes?.nome} {g.pacientes?.sobrenome || ''}</td>
                  {columns.map((c) => (
                    <td key={c.codigo} style={{ ...td, textAlign: 'center' }}>{qtd(g, c.codigo)}</td>
                  ))}
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtBRL(somaGuia(g.codigos, valorDe))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 240, border: '2px solid #7a6a1e', padding: 10 }}>
              <p style={{ fontSize: 13, fontWeight: 800 }}>VALOR TOTAL:</p>
              <p style={{ fontSize: 13 }}>{fmtBRL(bruto)} − {imp}%: {fmtBRL(aposImp)}</p>
            </div>
            <div style={{ flex: 1, minWidth: 240, border: '2px solid #7a6a1e', padding: 10 }}>
              <p style={{ fontSize: 13, fontWeight: 800 }}>VALOR COM A PORCENTAGEM ({minha}%):</p>
              <p style={{ fontSize: 13 }}>{fmtBRL(suaParte)}</p>
            </div>
          </div>

          <p style={{ textAlign: 'right', fontWeight: 700, marginTop: 28 }}>{dataAssin}</p>
          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <div style={{ borderTop: '1px solid #111', width: 300, margin: '0 auto' }} />
            {cfg?.nome_profissional && <p style={{ fontWeight: 700, marginTop: 4 }}>{cfg.nome_profissional}</p>}
          </div>
        </div>

        <div className="no-print flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Fechar</Button>
          <Button variant="outline" className="flex-1 gap-1.5" onClick={() => window.print()}>
            <FileText className="h-4 w-4" /> Imprimir
          </Button>
          <Button className="flex-1 gap-1.5" disabled={gerandoPdf} onClick={baixarPdf}>
            {gerandoPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Baixar PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Aba "Envios": guias que serão enviadas (debitadas) em cada mês ────────────
// A guia entra no mês em que a 10ª sessão (dias úteis corridos) TERMINA. Se
// passar do fim do mês, cai no próximo. Projeta o fim mesmo sem agenda gerada.
function EnviosCassi({ onAbrir }: {
  onAbrir: (g: GuiaCassi & { pacientes?: { nome: string; sobrenome: string | null } }) => void;
}) {
  const { user } = useAuth();
  const { data: cfg } = useCassiConfig();
  const [mes, setMes] = useState<string>(() => mesAtualISO());

  const { data: guias = [], isLoading } = useQuery({
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

  const { data: ags = [] } = useQuery({
    queryKey: ['cassi-ags-guia', user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('agendamentos')
        .select('guia_cassi_id, data_inicio, status, tipo_atendimento')
        .eq('terapeuta_id', user!.id).not('guia_cassi_id', 'is', null);
      if (error) throw error;
      return (data || []) as Array<{ guia_cassi_id: string; data_inicio: string; status: string; tipo_atendimento?: string }>;
    },
    enabled: !!user,
  });

  // Data de término real por guia (última sessão de tratamento agendada/realizada).
  const fimRealPorGuia = useMemo(() => {
    const ultima = new Map<string, string>();
    for (const a of ags) {
      if (!a.guia_cassi_id || a.tipo_atendimento === 'avaliacao') continue;
      if (a.status === 'cancelado') continue;
      const dt = new Date(a.data_inicio);
      const ymd = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      const cur = ultima.get(a.guia_cassi_id);
      if (!cur || ymd > cur) ultima.set(a.guia_cassi_id, ymd);
    }
    return ultima;
  }, [ags]);
  const fimGuia = (g: GuiaCassi) => fimRealPorGuia.get(g.id) || projetarFimGuia(g);

  const valorDe = (c: string) => cfg?.codigos.find((x) => x.codigo === c)?.valor || 0;

  const lista = useMemo(() =>
    guias.filter((g) => g.status !== 'cancelada')
      .map((g) => ({ g, fim: fimGuia(g) }))
      .filter((x): x is { g: GuiaCassi & { pacientes?: { nome: string; sobrenome: string | null } }; fim: string } => !!x.fim && x.fim.slice(0, 7) === mes)
      .sort((a, b) => (a.fim < b.fim ? -1 : a.fim > b.fim ? 1 : 0)),
    [guias, fimRealPorGuia, mes]);

  const totalBruto = lista.reduce((s, x) => s + somaGuia(x.g.codigos, valorDe), 0);

  const irMes = (delta: number) => {
    const [a, m] = mes.split('-').map(Number);
    const d = new Date(a, m - 1 + delta, 1);
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const [ano, m] = mes.split('-').map(Number);
  const ehMesAtual = mes === mesAtualISO();

  return (
    <div className="space-y-4">
      {/* Navegação de mês */}
      <div className="rounded-xl border border-border/50 bg-background p-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => irMes(-1)} title="Mês anterior">‹</Button>
          <div className="text-center min-w-[9rem]">
            <p className="text-sm font-bold capitalize leading-none">{MESES_PT[m - 1]} {ano}</p>
            <p className="text-[10px] uppercase text-muted-foreground tracking-wide mt-0.5">Guias a enviar</p>
          </div>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => irMes(1)} title="Próximo mês">›</Button>
        </div>
        <div className="flex items-center gap-1.5">
          {ehMesAtual && (
            <Button size="sm" variant="outline" className="h-8" onClick={() => irMes(1)}>Próximo mês ›</Button>
          )}
          <Input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} className="h-8 w-[9.5rem] text-sm" />
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground px-1">
        A guia entra no mês em que a <b>10ª sessão</b> (dias úteis corridos) termina. Se passar do fim do mês, ela cai no <b>próximo</b>.
      </p>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border/50 bg-background p-3">
          <p className="text-2xl font-black tabular-nums leading-none">{lista.length}</p>
          <p className="text-[10px] uppercase text-muted-foreground tracking-wide mt-1">Guias a enviar</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-background p-3">
          <p className="text-2xl font-black tabular-nums leading-none">{fmtBRL(totalBruto)}</p>
          <p className="text-[10px] uppercase text-muted-foreground tracking-wide mt-1">Bruto do mês</p>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : lista.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-10">
          Nenhuma guia termina em {MESES_PT[m - 1]} {ano}.<br />
          <span className="text-[12px]">Use ‹ › para ver outros meses.</span>
        </p>
      ) : (
        <div className="grid gap-2 lg:grid-cols-2">
          {lista.map(({ g, fim }) => {
            const aut = g.sessoes_autorizadas || 0;
            const real = g.sessoes_realizadas || 0;
            const completa = aut > 0 && real >= aut;
            const projetada = !fimRealPorGuia.has(g.id); // fim veio da projeção (sem agenda)
            const [, fm, fd] = fim.split('-');
            return (
              <button key={g.id} onClick={() => onAbrir(g)}
                className="w-full text-left rounded-xl border border-border/50 bg-background px-3 py-2.5 hover:bg-muted/40 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{g.pacientes?.nome} {g.pacientes?.sobrenome || ''}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[11px] text-muted-foreground tabular-nums">{real}/{aut} sessões</span>
                      <span className="text-[11px] text-muted-foreground">·</span>
                      <span className="text-[11px] text-muted-foreground">termina {fd}/{fm}{projetada ? ' (previsto)' : ''}</span>
                      {completa ? (
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">completa</Badge>
                      ) : (
                        <Badge className="text-[10px] bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300">em andamento</Badge>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-semibold tabular-nums shrink-0">{fmtBRL(somaGuia(g.codigos, valorDe))}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Visualizador de um relatório SALVO (snapshot congelado) ───────────────────
function RelatorioSnapshotView({ dados, onClose }: { dados: any; onClose: () => void }) {
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const cols: Array<{ codigo: string; oficial?: string; label?: string }> = Array.isArray(dados?.columns) ? dados.columns : [];
  const rows: Array<{ nome: string; q: number[]; soma: number }> = Array.isArray(dados?.rows) ? dados.rows : [];
  const th: CSSProperties = { background: '#12314a', color: '#fff', border: '1px solid #0b2136', padding: '6px 8px', fontWeight: 700, fontSize: 12, textAlign: 'center' };
  const td: CSSProperties = { border: '1px solid #cbd5e1', padding: '6px 8px', fontSize: 12 };

  const baixarPdf = async () => {
    const el = document.getElementById('relatorio-snap-print');
    if (!el) return;
    setGerandoPdf(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const img = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pw) / canvas.width;
      let heightLeft = imgH; let position = 0;
      pdf.addImage(img, 'JPEG', 0, position, pw, imgH); heightLeft -= ph;
      while (heightLeft > 0) { position -= ph; pdf.addPage(); pdf.addImage(img, 'JPEG', 0, position, pw, imgH); heightLeft -= ph; }
      pdf.save(`relatorio-cassi-${dados?.mes_label || 'salvo'}.pdf`);
    } catch (e) { toast.error('Não consegui gerar o PDF — use "Imprimir".'); console.error(e); }
    finally { setGerandoPdf(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl w-[96vw] max-h-[92vh] overflow-y-auto">
        <style>{`@media print {
          body * { visibility: hidden !important; }
          #relatorio-snap-print, #relatorio-snap-print * { visibility: visible !important; }
          #relatorio-snap-print { position: absolute !important; left: 0; top: 0; width: 100%; max-height: none !important; overflow: visible !important; }
          .no-print { display: none !important; }
        }`}</style>
        <DialogHeader className="no-print"><DialogTitle className="text-base">Relatório salvo — {dados?.mes_label}</DialogTitle></DialogHeader>

        <div id="relatorio-snap-print" style={{ background: '#fff', color: '#111', padding: 16 }}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            {dados?.nome_clinica && <p style={{ fontSize: 22, fontWeight: 800, letterSpacing: 1 }}>{dados.nome_clinica}</p>}
            <p style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>RELATÓRIO FINANCEIRO DOS CONVÊNIOS — MÊS DE {dados?.mes_label}</p>
            {dados?.nome_profissional && <p style={{ fontSize: 13, fontWeight: 700 }}>FISIOTERAPEUTA {String(dados.nome_profissional).toUpperCase()}</p>}
            <p style={{ fontSize: 20, fontWeight: 800, marginTop: 8 }}>CASSI</p>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left' }}>Nome do Paciente</th>
                {cols.map((c, i) => (<th key={i} style={th}>{c.label || 'Código'}<br />({c.oficial || c.codigo})</th>))}
                <th style={th}>Soma</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={td}>{r.nome}</td>
                  {cols.map((_, j) => (<td key={j} style={{ ...td, textAlign: 'center' }}>{r.q?.[j] ?? 0}</td>))}
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtBRL(r.soma)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 240, border: '2px solid #7a6a1e', padding: 10 }}>
              <p style={{ fontSize: 13, fontWeight: 800 }}>VALOR TOTAL:</p>
              <p style={{ fontSize: 13 }}>{fmtBRL(dados?.total_bruto || 0)} − {dados?.imposto_pct || 0}%: {fmtBRL(dados?.apos_imposto || 0)}</p>
            </div>
            <div style={{ flex: 1, minWidth: 240, border: '2px solid #7a6a1e', padding: 10 }}>
              <p style={{ fontSize: 13, fontWeight: 800 }}>VALOR COM A PORCENTAGEM ({dados?.minha_pct || 0}%):</p>
              <p style={{ fontSize: 13 }}>{fmtBRL(dados?.sua_parte || 0)}</p>
            </div>
          </div>
          <p style={{ textAlign: 'right', fontWeight: 700, marginTop: 28 }}>{dados?.cidade ? dados.cidade + ', ' : ''}{dados?.data_assinatura}</p>
          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <div style={{ borderTop: '1px solid #111', width: 300, margin: '0 auto' }} />
            {dados?.nome_profissional && <p style={{ fontWeight: 700, marginTop: 4 }}>{dados.nome_profissional}</p>}
          </div>
        </div>

        <div className="no-print flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Fechar</Button>
          <Button variant="outline" className="flex-1 gap-1.5" onClick={() => window.print()}><FileText className="h-4 w-4" /> Imprimir</Button>
          <Button className="flex-1 gap-1.5" disabled={gerandoPdf} onClick={baixarPdf}>
            {gerandoPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Baixar PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Aba "Clientes": diretório completo (alfabético, busca, por mês) ───────────
function ClientesCassi({ pacientes, guias, onCadastro, onNovo, onGuia, onDefinirGuiasMes, onExcluir, onAtivar, onConfirmarMes, onPedirGuia, mesVigente }: {
  pacientes: Paciente[];
  guias: Array<GuiaCassi & { pacientes?: { nome: string; sobrenome: string | null } }>;
  onCadastro: (p: Paciente) => void;
  onNovo: () => void;
  onGuia: (paciente: Paciente, guia: GuiaCassi | null) => void;
  onDefinirGuiasMes: (id: string, n: number) => void;
  onExcluir: (id: string) => void;
  onAtivar: (id: string) => void;
  onConfirmarMes: (id: string) => void;
  onPedirGuia: () => void;
  mesVigente: string;
}) {
  const { user } = useAuth();
  const [busca, setBusca] = useState('');
  const [mes, setMes] = useState(''); // '' = total (todos os meses)

  // Sessões no mês escolhido, por paciente (só busca quando um mês é selecionado).
  const { data: ags = [] } = useQuery({
    queryKey: ['cassi-clientes-ags-mes', user?.id, mes],
    queryFn: async () => {
      const [ano, m] = mes.split('-').map(Number);
      const de = new Date(ano, m - 1, 0).toISOString();
      const ate = new Date(ano, m, 2).toISOString();
      const { data, error } = await (supabase as any).from('agendamentos')
        .select('paciente_id, data_inicio, status, tipo_atendimento')
        .eq('terapeuta_id', user!.id).gte('data_inicio', de).lt('data_inicio', ate);
      if (error) throw error;
      return (data || []) as Array<{ paciente_id: string | null; data_inicio: string; status: string; tipo_atendimento?: string }>;
    },
    enabled: !!user && !!mes,
  });

  const sessoesMesPorPac = useMemo(() => {
    const out = new Map<string, number>();
    if (!mes) return out;
    const [ano, mm] = mes.split('-').map(Number);
    const agora = Date.now();
    const sets = new Map<string, Set<string>>();
    for (const a of ags) {
      if (!a.paciente_id || a.tipo_atendimento === 'avaliacao') continue;
      if (a.status === 'cancelado' || a.status === 'faltou' || a.status === 'bloqueado' || a.status === 'pendente') continue;
      const d = new Date(a.data_inicio);
      if (d.getFullYear() !== ano || d.getMonth() !== mm - 1 || d.getTime() > agora) continue;
      const ymd = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!sets.has(a.paciente_id)) sets.set(a.paciente_id, new Set());
      sets.get(a.paciente_id)!.add(ymd);
    }
    for (const [id, s] of sets) out.set(id, s.size);
    return out;
  }, [ags, mes]);

  const guiasPorPac = useMemo(() => {
    const m = new Map<string, Array<GuiaCassi>>();
    for (const g of guias) {
      if (!m.has(g.paciente_id)) m.set(g.paciente_id, []);
      m.get(g.paciente_id)!.push(g);
    }
    return m;
  }, [guias]);

  // Guias fechadas por mês (mês de término projetado) — base pra detectar 2/mês.
  const guiasPorMesMap = (gs: GuiaCassi[]) => {
    const porMes = new Map<string, number>();
    for (const g of gs) {
      if (g.status === 'cancelada') continue;
      const fim = projetarFimGuia(g);
      const mm = fim ? fim.slice(0, 7) : (g.data_resposta || g.data_pedido || '').slice(0, 7);
      if (mm) porMes.set(mm, (porMes.get(mm) || 0) + 1);
    }
    return porMes;
  };

  // Resumo: quantos fazem 2/mês (detectado pelos dados) e quantos estão marcados.
  const resumo = useMemo(() => {
    let fazem2 = 0, marcados2 = 0;
    for (const p of pacientes) {
      if (p.cassi_encerrado_em) continue;
      if ((p.guias_por_mes || 1) >= 2) marcados2++;
      const max = Math.max(0, ...[...guiasPorMesMap(guiasPorPac.get(p.id) || []).values()]);
      if (max >= 2) fazem2++;
    }
    return { fazem2, marcados2 };
  }, [pacientes, guiasPorPac]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return pacientes
      .filter((p) => !q || `${p.nome} ${p.sobrenome || ''}`.toLowerCase().includes(q)
        || (p.carteirinha || '').toLowerCase().includes(q))
      .sort((a, b) => `${a.nome} ${a.sobrenome || ''}`.localeCompare(`${b.nome} ${b.sobrenome || ''}`, 'pt-BR'));
  }, [pacientes, busca]);

  const [mAno, mMes] = mes ? mes.split('-').map(Number) : [0, 0];
  const mesLabel = mes ? `${MESES_PT[mMes - 1]}/${String(mAno).slice(2)}` : '';

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border/50 bg-background p-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input className="h-9 pl-8" placeholder="Procurar cliente (nome ou carteirinha)…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <Button size="sm" className="gap-1.5 h-9 shrink-0" onClick={onNovo}>
            <UserPlus className="h-4 w-4" /> <span className="hidden sm:inline">Cadastrar cliente</span>
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-muted-foreground shrink-0">Sessões do mês:</label>
          <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="h-8 w-[9.5rem] text-sm" />
          {mes && <button className="text-[11px] text-primary" onClick={() => setMes('')}>ver total</button>}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground px-1">
        {lista.length} cliente(s) · {mes ? `sessões feitas em ${mesLabel}` : 'total de sessões já feitas'} · ordem alfabética
      </p>

      <div className="grid gap-2 lg:grid-cols-2">
        {lista.map((p) => {
          const gs = guiasPorPac.get(p.id) || [];
          const ativa = gs.find((g) => g.status === 'ativa') || null;
          const ultima = gs[0] || null;
          const totalFeitas = gs.reduce((s, g) => s + (g.sessoes_realizadas || 0), 0);
          const ativo = !p.cassi_encerrado_em;
          const marcado = (p.guias_por_mes || 1) >= 2;
          const mesFeitas = sessoesMesPorPac.get(p.id) || 0;
          // Detecta pelos DADOS: quantas guias fecham por mês (histórico e no mês selecionado).
          const porMes = guiasPorMesMap(gs);
          const maxNoMes = porMes.size ? Math.max(...porMes.values()) : 0;
          const noMesSel = mes ? (porMes.get(mes) || 0) : 0;
          const detecta2 = maxNoMes >= 2; // já fez 2 guias num mesmo mês
          return (
            <div key={p.id} className="rounded-xl border border-border/50 bg-background p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{p.nome} {p.sobrenome || ''}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <Badge className={`text-[10px] ${ativo ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}`}>
                      {ativo ? 'Ativo' : 'Encerrado'}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                    {ativa ? <span>Guia ativa: <b className="text-foreground">{ativa.sessoes_realizadas}/{diasTratGuia(ativa)}</b></span> : <span>Sem guia ativa</span>}
                    {mes
                      ? <span> · {mesLabel}: <b className="text-foreground">{mesFeitas}</b> sessões · <b className="text-foreground">{noMesSel}</b> guia(s)</span>
                      : <span> · total feitas: <b className="text-foreground">{totalFeitas}</b> · máx <b className="text-foreground">{maxNoMes}</b> guia(s)/mês</span>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0 sm:justify-end">
                  {!ativo ? (
                    <Button size="sm" variant="outline" className="h-8 text-[12px] gap-1 text-emerald-700 border-emerald-300 dark:border-emerald-800" onClick={() => onAtivar(p.id)}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Ativar
                    </Button>
                  ) : p.cassi_confirmado_mes === mesVigente ? (
                    <span className="text-[11px] font-bold text-emerald-700 px-1" title="Já está em Este mês">no mês ✓</span>
                  ) : (
                    <Button size="sm" className="h-8 text-[12px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" title="Ativar guia — aparece em Este mês" onClick={() => onConfirmarMes(p.id)}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Este mês
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-8 w-8" title="Editar cadastro" onClick={() => onCadastro(p)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {gs.length === 0 ? (
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 text-[12px] text-amber-700 border-amber-300 dark:border-amber-800" title="Pedir guia (vai pra aba Pedir guias)" onClick={onPedirGuia}>
                      <AlertTriangle className="h-3.5 w-3.5" /> Pedir guia
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 text-[12px]" onClick={() => onGuia(p, ativa || ultima)}>
                      <FileText className="h-3.5 w-3.5" /> Guia
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" title="Excluir cliente (duplicado/erro)"
                    onClick={() => { if (confirm(`Excluir "${p.nome} ${p.sobrenome || ''}" do Controle CASSI? Use para tirar duplicados/erros.`)) onExcluir(p.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
        {lista.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nenhum cliente.</p>}
      </div>
    </div>
  );
}
