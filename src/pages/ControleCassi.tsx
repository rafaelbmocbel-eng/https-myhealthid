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
import { ArrowLeft, Plus, Loader2, FileText, Save, Trash2, ClipboardList, AlertTriangle, CalendarClock, CheckCircle2, Circle, Download } from 'lucide-react';
import { toast } from 'sonner';
import { CODIGOS_CASSI, statusPaciente, precisaNovaGuia, sessoesRestantes, type GuiaCassi, type GuiaStatus } from '@/lib/cassiGuias';

interface Paciente { id: string; nome: string; sobrenome: string | null; }

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

export default function ControleCassi() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editando, setEditando] = useState<{ paciente: Paciente; guia: GuiaCassi | null } | null>(null);
  const [view, setView] = useState<'painel' | 'planilha'>('painel');

  // Pacientes CASSI do profissional.
  const { data: pacientes = [], isLoading: loadingPac } = useQuery({
    queryKey: ['cassi-pacientes', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pacientes')
        .select('id, nome, sobrenome')
        .eq('terapeuta_id', user!.id)
        .eq('ativo', true)
        .eq('plano_saude', 'CASSI')
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

  const loading = loadingPac || loadingGuias;

  return (
    <div className="min-h-[100dvh] bg-muted/30">
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b border-border/50">
        <div className="max-w-3xl mx-auto px-3 py-2.5 flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
          <div className="ml-2 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold">Controle CASSI</span>
          </div>
          <div className="ml-auto flex items-center gap-1 rounded-lg bg-muted p-0.5">
            <button onClick={() => setView('painel')}
              className={`text-[12px] px-2.5 py-1 rounded-md font-medium ${view === 'painel' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>
              Painel
            </button>
            <button onClick={() => setView('planilha')}
              className={`text-[12px] px-2.5 py-1 rounded-md font-medium ${view === 'planilha' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>
              Planilha
            </button>
          </div>
        </div>
      </div>

      <div className={`${view === 'planilha' ? 'max-w-5xl' : 'max-w-3xl'} mx-auto p-3 space-y-4`}>
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : view === 'planilha' ? (
          <PlanilhaGuias
            guias={guias}
            onAbrir={(g) => setEditando({ paciente: { id: g.paciente_id, nome: g.pacientes?.nome || 'Paciente', sobrenome: g.pacientes?.sobrenome ?? null }, guia: g })}
          />
        ) : pacientes.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum paciente com plano CASSI.</p>
            <p className="text-[11px] mt-1">Marque o paciente como CASSI no cadastro para ele aparecer aqui.</p>
          </div>
        ) : (
          <>
            {/* Pedidos do mês — fila de quem precisa de guia nova */}
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-bold text-amber-800 dark:text-amber-300">Pedidos do mês ({pedidosDoMes.length})</span>
              </div>
              {pedidosDoMes.length === 0 ? (
                <p className="text-[12px] text-amber-700/80 dark:text-amber-400/80">Nenhum pedido pendente. Tudo em dia. ✅</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {pedidosDoMes.map((l) => (
                    <button key={l.paciente.id}
                      onClick={() => setEditando({ paciente: l.paciente, guia: null })}
                      className="text-[12px] px-2.5 py-1 rounded-full bg-white dark:bg-background border border-amber-300 dark:border-amber-700 font-medium hover:bg-amber-100 dark:hover:bg-amber-900/30">
                      {l.paciente.nome} {l.paciente.sobrenome || ''} · {l.status.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Lista de pacientes CASSI com status da guia */}
            <div className="space-y-2">
              {linhas.map(({ paciente, guia, status }) => (
                <div key={paciente.id} className="rounded-xl border border-border/50 bg-background p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{paciente.nome} {paciente.sobrenome || ''}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <Badge className={`text-[10px] ${status.cls}`}>{status.label}</Badge>
                        {guia && (
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {guia.sessoes_realizadas}/{guia.sessoes_autorizadas} sessões
                            {guia.numero_guia ? ` · guia ${guia.numero_guia}` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
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
    codigos: (guia ?? base)?.codigos?.map((c) => c.codigo) || ['012'],
    status: guia?.status || 'aguardando',
    observacoes: guia?.observacoes || '',
  }));

  const set = <K extends keyof DraftGuia>(k: K, v: DraftGuia[K]) => setD((p) => ({ ...p, [k]: v }));
  const toggleCodigo = (codigo: string) =>
    setD((p) => ({ ...p, codigos: p.codigos.includes(codigo) ? p.codigos.filter((c) => c !== codigo) : [...p.codigos, codigo] }));

  const qc = useQueryClient();

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
      const codigos = CODIGOS_CASSI.filter((c) => d.codigos.includes(c.codigo)).map((c) => ({ codigo: c.codigo, descricao: c.descricao }));
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
              {CODIGOS_CASSI.map((c) => {
                const ativo = d.codigos.includes(c.codigo);
                return (
                  <button key={c.codigo} type="button" onClick={() => toggleCodigo(c.codigo)}
                    className={`text-[11px] px-2 py-1 rounded-full border ${ativo ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground'}`}>
                    {c.codigo} · {c.descricao}{c.apenasPrimeiroDia ? ' (1º dia)' : ''}
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
        <span className="text-[12px] text-muted-foreground shrink-0">{filtradas.length} guia(s)</span>
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
