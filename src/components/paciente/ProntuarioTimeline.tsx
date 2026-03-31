import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import {
  FileText, Activity, Stethoscope, Heart, ClipboardCheck,
  Dumbbell, Calendar, AlertTriangle, Brain, RefreshCw, Loader2,
  Edit3, Save, X, Mic, Trash2, TrendingUp,
} from 'lucide-react';
import type { NotaProntuario } from '@/hooks/useNotasProntuario';

const TIPO_CONFIG: Record<string, { icon: React.ReactNode; gradient: string; label: string; order: number }> = {
  myid_resposta: {
    icon: <Activity className="h-4 w-4" />,
    gradient: 'from-primary/20 to-primary/5 text-primary border-primary/20',
    label: 'MyID Respondido',
    order: 1,
  },
  avaliacao_profissional: {
    icon: <Stethoscope className="h-4 w-4" />,
    gradient: 'from-blue-500/15 to-blue-500/5 text-blue-700 border-blue-200',
    label: 'Avaliação Profissional',
    order: 2,
  },
  avaliacao_voz: {
    icon: <Mic className="h-4 w-4" />,
    gradient: 'from-indigo-500/15 to-indigo-500/5 text-indigo-700 border-indigo-200',
    label: 'Avaliação por Voz',
    order: 3,
  },
  conduta_diretriz: {
    icon: <Brain className="h-4 w-4" />,
    gradient: 'from-violet-500/15 to-violet-500/5 text-violet-700 border-violet-200',
    label: 'Diretriz de Tratamento',
    order: 4,
  },
  sessao_confirmada: {
    icon: <ClipboardCheck className="h-4 w-4" />,
    gradient: 'from-emerald-500/15 to-emerald-500/5 text-emerald-700 border-emerald-200',
    label: 'Sessão Confirmada',
    order: 5,
  },
  diario_paciente: {
    icon: <Heart className="h-4 w-4" />,
    gradient: 'from-rose-500/15 to-rose-500/5 text-rose-700 border-rose-200',
    label: 'Diário do Paciente',
    order: 6,
  },
  treino_executado: {
    icon: <Dumbbell className="h-4 w-4" />,
    gradient: 'from-amber-500/15 to-amber-500/5 text-amber-700 border-amber-200',
    label: 'Treino Executado',
    order: 7,
  },
  soap_note: {
    icon: <FileText className="h-4 w-4" />,
    gradient: 'from-teal-500/15 to-teal-500/5 text-teal-700 border-teal-200',
    label: 'Nota SOAP',
    order: 8,
  },
  sessao_falta: {
    icon: <X className="h-4 w-4" />,
    gradient: 'from-red-500/15 to-red-500/5 text-red-700 border-red-200',
    label: 'Falta',
    order: 9,
  },
  geral: {
    icon: <FileText className="h-4 w-4" />,
    gradient: 'from-muted to-muted/50 text-muted-foreground border-border',
    label: 'Nota',
    order: 10,
  },
};

interface Props {
  notas: NotaProntuario[];
  isLoading?: boolean;
  pacienteNome?: string;
}

export default function ProntuarioTimeline({ notas, isLoading, pacienteNome }: Props) {
  const [syncing, setSyncing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const handleEditNote = (nota: NotaProntuario) => {
    setEditingId(nota.id);
    setEditText(nota.descricao);
  };

  const handleSaveEdit = async (notaId: string) => {
    setSavingEdit(true);
    try {
      const { error } = await (supabase as any)
        .from('notas_prontuario')
        .update({ descricao: editText })
        .eq('id', notaId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['notas-prontuario'] });
      setEditingId(null);
      toast({ title: 'Nota atualizada! ✅' });
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteNote = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await (supabase as any)
        .from('notas_prontuario')
        .delete()
        .eq('id', deleteTarget);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['notas-prontuario'] });
      toast({ title: 'Registro excluído ✅' });
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleBackfill = async () => {
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');
      const { data, error } = await supabase.functions.invoke('backfill-prontuario', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { force: true },
      });
      if (error) throw error;
      toast({ title: `Histórico sincronizado! ✅`, description: `${data?.notas_criadas || 0} nota(s) gerada(s).` });
      qc.invalidateQueries({ queryKey: ['notas-prontuario'] });
    } catch (err: any) {
      toast({ title: 'Erro ao sincronizar', description: err.message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  // Sort notes by type priority within each day group
  const sortedNotas = [...notas].sort((a, b) => {
    const orderA = (TIPO_CONFIG[a.tipo] || TIPO_CONFIG.geral).order;
    const orderB = (TIPO_CONFIG[b.tipo] || TIPO_CONFIG.geral).order;
    // First by date descending
    const dateCompare = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    // Within same day, sort by type priority
    const dayA = format(parseISO(a.created_at), 'yyyy-MM-dd');
    const dayB = format(parseISO(b.created_at), 'yyyy-MM-dd');
    if (dayA === dayB) return orderA - orderB;
    return dateCompare;
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
      </div>
    );
  }

  if (sortedNotas.length === 0) {
    return (
      <div className="text-center py-16 px-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mx-auto mb-4">
          <FileText className="h-7 w-7 text-primary/40" />
        </div>
        <p className="font-bold text-sm text-foreground mb-1">Nenhum registro no prontuário</p>
        <p className="text-xs text-muted-foreground mb-5 max-w-xs mx-auto">
          Os resumos das avaliações MyID, avaliações presenciais e diretrizes de tratamento aparecerão aqui automaticamente.
        </p>
        <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={handleBackfill} disabled={syncing}>
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Sincronizar Histórico
        </Button>
      </div>
    );
  }

  // Group by date
  const grouped: Record<string, NotaProntuario[]> = {};
  sortedNotas.forEach(n => {
    const dateKey = format(parseISO(n.created_at), 'yyyy-MM-dd');
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(n);
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-black text-foreground">
              Registro Clínico {pacienteNome ? `— ${pacienteNome}` : ''}
            </h3>
            <p className="text-[10px] text-muted-foreground">{sortedNotas.length} registro(s) — editáveis</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs rounded-lg h-8" onClick={handleBackfill} disabled={syncing}>
          {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Sincronizar
        </Button>
      </div>

      <div className="space-y-8">
          {Object.entries(grouped).map(([dateKey, dayNotas]) => (
            <div key={dateKey}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2 bg-muted/60 rounded-lg px-3 py-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-bold text-muted-foreground">
                    {format(parseISO(dateKey), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                  </span>
                </div>
                <div className="flex-1 h-px bg-border/50" />
              </div>

              {/* Notes */}
              <div className="space-y-3 ml-1">
                {dayNotas.map(nota => {
                  const cfg = TIPO_CONFIG[nota.tipo] || TIPO_CONFIG.geral;
                  const hasRedFlags = nota.tipo === 'myid_resposta' && nota.dados_extras?.scores;

                  return (
                    <div
                      key={nota.id}
                      className={`relative rounded-2xl border bg-gradient-to-r ${cfg.gradient} overflow-hidden transition-all hover:shadow-md`}
                    >
                      <div className="p-4">
                        {/* Top row: badge + time + actions */}
                        <div className="flex items-center justify-between mb-2.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 bg-background/70 backdrop-blur-sm rounded-lg px-2.5 py-1">
                              {cfg.icon}
                              <span className="text-[10px] font-bold uppercase tracking-wide">{cfg.label}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground font-medium">
                              {format(parseISO(nota.created_at), 'HH:mm')}
                            </span>
                            {hasRedFlags && (
                              <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] gap-1 rounded-lg">
                                <AlertTriangle className="h-2.5 w-2.5" /> Red Flags
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {editingId !== nota.id && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
                                  onClick={() => handleEditNote(nota)}
                                  title="Editar resumo"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 rounded-lg opacity-40 hover:opacity-100 hover:text-destructive transition-all"
                                  onClick={() => setDeleteTarget(nota.id)}
                                  title="Excluir registro"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Title */}
                        <h4 className="text-[13px] font-bold text-foreground mb-2 leading-tight">{nota.titulo}</h4>

                        {/* Body — editable */}
                        {editingId === nota.id ? (
                          <div className="space-y-2.5">
                            <Textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className="min-h-[120px] break-words text-xs font-sans bg-background/80 border-border/60 rounded-xl focus:ring-primary/30"
                            />
                            <div className="flex gap-2">
                              <Button size="sm" className="h-7 text-[11px] gap-1.5 rounded-lg px-3" onClick={() => handleSaveEdit(nota.id)} disabled={savingEdit}>
                                {savingEdit ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                Salvar
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1 rounded-lg" onClick={() => setEditingId(null)}>
                                <X className="h-3 w-3" /> Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <pre className="whitespace-pre-wrap break-words text-[11px] text-foreground/70 leading-relaxed font-sans">
                            {nota.descricao}
                          </pre>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este registro do prontuário? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteNote}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
