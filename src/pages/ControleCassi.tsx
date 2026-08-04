import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Loader2, FileText, Save, Trash2, ClipboardList, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { CODIGOS_CASSI, statusPaciente, precisaNovaGuia, sessoesRestantes, type GuiaCassi, type GuiaStatus } from '@/lib/cassiGuias';

interface Paciente { id: string; nome: string; sobrenome: string | null; }

// Rascunho do formulário de guia.
interface DraftGuia {
  id?: string;
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
        .select('*')
        .eq('terapeuta_id', user!.id)
        .order('data_pedido', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as GuiaCassi[];
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
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-3 space-y-4">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
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

  const salvar = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Sem sessão');
      const sb: any = supabase;
      const codigos = CODIGOS_CASSI.filter((c) => d.codigos.includes(c.codigo)).map((c) => ({ codigo: c.codigo, descricao: c.descricao }));
      const payload = {
        numero_guia: d.numero_guia || null,
        data_pedido: d.data_pedido || hojeISO(),
        data_resposta: d.data_resposta || null,
        sessoes_autorizadas: Number(d.sessoes_autorizadas) || 0,
        sessoes_realizadas: Number(d.sessoes_realizadas) || 0,
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

  const restantes = sessoesRestantes({ sessoes_autorizadas: Number(d.sessoes_autorizadas) || 0, sessoes_realizadas: Number(d.sessoes_realizadas) || 0 });

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
              <Input type="number" min={0} value={d.sessoes_realizadas} onChange={(e) => set('sessoes_realizadas', parseInt(e.target.value) || 0)} />
              <p className="text-[10px] text-muted-foreground mt-0.5">Restam {restantes}</p>
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
