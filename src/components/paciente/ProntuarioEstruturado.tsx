import { useMemo, useState } from 'react';
import { format, parseISO } from '@/lib/dateSafe';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import {
  Stethoscope, Mic, Activity, Brain, ClipboardCheck, Calendar, ChevronDown,
  ChevronUp, FileText, History, Edit3, Trash2, Save, X, Loader2, TrendingUp,
} from 'lucide-react';
import type { NotaProntuario } from '@/hooks/useNotasProntuario';
import { cn } from '@/lib/utils';

const AVALIACAO_TIPOS = ['myid_resposta', 'avaliacao_profissional', 'avaliacao_voz'];
const DIRETRIZ_TIPOS = ['conduta_diretriz'];
const SESSAO_TIPOS = ['evolucao', 'sessao_confirmada', 'fechamento_sessao', 'sessao_falta'];

const TIPO_META: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  myid_resposta:         { label: 'MyID', icon: <Activity className="h-3.5 w-3.5" />, cls: 'text-primary' },
  avaliacao_profissional:{ label: 'Avaliação Presencial', icon: <Stethoscope className="h-3.5 w-3.5" />, cls: 'text-blue-600' },
  avaliacao_voz:         { label: 'Avaliação por Voz', icon: <Mic className="h-3.5 w-3.5" />, cls: 'text-indigo-600' },
  conduta_diretriz:      { label: 'Diretriz', icon: <Brain className="h-3.5 w-3.5" />, cls: 'text-violet-600' },
  evolucao:              { label: 'Evolução', icon: <TrendingUp className="h-3.5 w-3.5" />, cls: 'text-cyan-600' },
  sessao_confirmada:     { label: 'Sessão', icon: <ClipboardCheck className="h-3.5 w-3.5" />, cls: 'text-emerald-600' },
  fechamento_sessao:     { label: 'Fechamento', icon: <ClipboardCheck className="h-3.5 w-3.5" />, cls: 'text-lime-600' },
  sessao_falta:          { label: 'Falta', icon: <X className="h-3.5 w-3.5" />, cls: 'text-red-600' },
};

interface Props {
  notas: NotaProntuario[];
  isLoading?: boolean;
}

export default function ProntuarioEstruturado({ notas, isLoading }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [avaliacaoAtualAberta, setAvaliacaoAtualAberta] = useState(true);
  const [historicoAberto, setHistoricoAberto] = useState(false);

  const { avaliacaoAtual, historicoAvaliacoes, diretrizVigente, sessoes } = useMemo(() => {
    const porData = [...notas].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    const avals = porData.filter(n => AVALIACAO_TIPOS.includes(n.tipo));
    const diretrizes = porData.filter(n => DIRETRIZ_TIPOS.includes(n.tipo));
    const sess = porData.filter(n => SESSAO_TIPOS.includes(n.tipo));
    return {
      avaliacaoAtual: avals[0] || null,
      historicoAvaliacoes: avals.slice(1),
      diretrizVigente: diretrizes[0] || null,
      sessoes: sess,
    };
  }, [notas]);

  const salvarEdicao = async (id: string) => {
    setSavingEdit(true);
    try {
      const { error } = await (supabase as any).from('notas_prontuario').update({ descricao: editText }).eq('id', id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['notas-prontuario'] });
      setEditingId(null);
      toast({ title: 'Registro atualizado ✅' });
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    } finally {
      setSavingEdit(false);
    }
  };

  const excluir = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await (supabase as any).from('notas_prontuario').delete().eq('id', deleteTarget);
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

  const acoesNota = (nota: NotaProntuario) => (
    <div className="flex items-center gap-0.5 shrink-0">
      <Button size="icon" variant="ghost" className="h-6 w-6 opacity-50 hover:opacity-100"
        onClick={() => { setEditingId(nota.id); setEditText(nota.descricao); }} title="Editar">
        <Edit3 className="h-3 w-3" />
      </Button>
      <Button size="icon" variant="ghost" className="h-6 w-6 opacity-40 hover:opacity-100 hover:text-destructive"
        onClick={() => setDeleteTarget(nota.id)} title="Excluir">
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );

  const corpoNota = (nota: NotaProntuario, colapsavel = false) =>
    editingId === nota.id ? (
      <div className="space-y-2">
        <Textarea value={editText} onChange={e => setEditText(e.target.value)}
          className="min-h-[120px] text-xs font-sans bg-background rounded-lg" />
        <div className="flex gap-2">
          <Button size="sm" className="h-7 text-[11px] gap-1" onClick={() => salvarEdicao(nota.id)} disabled={savingEdit}>
            {savingEdit ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Salvar
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setEditingId(null)}>Cancelar</Button>
        </div>
      </div>
    ) : (
      <pre className={cn(
        'whitespace-pre-wrap break-words text-[11px] text-foreground/75 leading-relaxed font-sans',
        colapsavel && !avaliacaoAtualAberta && 'line-clamp-2',
      )}>
        {nota.descricao}
      </pre>
    );

  if (isLoading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}</div>;
  }

  if (notas.length === 0) {
    return (
      <div className="text-center py-14 px-6">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <FileText className="h-6 w-6 text-primary/40" />
        </div>
        <p className="font-bold text-sm mb-1">Prontuário vazio</p>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
          Avaliações, diretrizes e sessões confirmadas aparecem aqui automaticamente.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ═══ 1. AVALIAÇÃO ATUAL ═══ */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Stethoscope className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-black">Avaliação atual</h3>
        </div>
        {avaliacaoAtual ? (
          <div className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-3.5">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn('flex items-center gap-1', TIPO_META[avaliacaoAtual.tipo]?.cls)}>
                  {TIPO_META[avaliacaoAtual.tipo]?.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold leading-tight truncate">{avaliacaoAtual.titulo}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {format(parseISO(avaliacaoAtual.created_at), "dd 'de' MMMM, yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
              {acoesNota(avaliacaoAtual)}
            </div>
            {corpoNota(avaliacaoAtual, true)}
            {editingId !== avaliacaoAtual.id && avaliacaoAtual.descricao.length > 140 && (
              <button
                className="mt-2 text-[11px] font-semibold text-primary flex items-center gap-1 hover:underline"
                onClick={() => setAvaliacaoAtualAberta(v => !v)}
              >
                {avaliacaoAtualAberta ? <><ChevronUp className="h-3 w-3" /> Ver menos</> : <><ChevronDown className="h-3 w-3" /> Ver mais</>}
              </button>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic px-1">Nenhuma avaliação registrada ainda.</p>
        )}
      </section>

      {/* ═══ 2. HISTÓRICO DE AVALIAÇÕES ═══ */}
      {historicoAvaliacoes.length > 0 && (
        <section>
          <button
            className="w-full flex items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2 hover:bg-muted/50 transition-colors"
            onClick={() => setHistoricoAberto(v => !v)}
          >
            <History className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-bold">Histórico de avaliações</span>
            <Badge variant="secondary" className="text-[10px] h-4">{historicoAvaliacoes.length}</Badge>
            <span className="ml-auto">
              {historicoAberto ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </span>
          </button>
          {historicoAberto && (
            <div className="space-y-2 mt-2 pl-1">
              {historicoAvaliacoes.map(nota => (
                <div key={nota.id} className="rounded-xl border bg-card p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn('flex items-center gap-1', TIPO_META[nota.tipo]?.cls)}>{TIPO_META[nota.tipo]?.icon}</span>
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold leading-tight truncate">{nota.titulo}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {format(parseISO(nota.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    {acoesNota(nota)}
                  </div>
                  {corpoNota(nota)}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ═══ 3. DIRETRIZ VIGENTE ═══ */}
      {diretrizVigente && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Brain className="h-4 w-4 text-violet-600" />
            <h3 className="text-sm font-black">Diretriz vigente</h3>
            <Badge variant="outline" className="text-[9px] h-4 border-emerald-300 text-emerald-700 bg-emerald-50">Ativa</Badge>
          </div>
          <div className="rounded-2xl border border-violet-200/60 bg-violet-500/[0.04] p-3.5">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="min-w-0">
                <p className="text-[13px] font-bold leading-tight truncate">{diretrizVigente.titulo}</p>
                <p className="text-[10px] text-muted-foreground">
                  Vigente desde {format(parseISO(diretrizVigente.created_at), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
              {acoesNota(diretrizVigente)}
            </div>
            {corpoNota(diretrizVigente)}
          </div>
        </section>
      )}

      {/* ═══ 4. SESSÕES (alinhadas com a diretriz) ═══ */}
      {sessoes.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-black">Sessões</h3>
            <span className="text-[10px] text-muted-foreground">{sessoes.length} registro(s)</span>
          </div>
          <div className="relative space-y-2 before:absolute before:left-[7px] before:top-1 before:bottom-1 before:w-px before:bg-border/60">
            {sessoes.map(nota => {
              const meta = TIPO_META[nota.tipo] || TIPO_META.evolucao;
              const mantida = (nota.dados_extras as any)?.conduta_mantida;
              return (
                <div key={nota.id} className="relative pl-5">
                  <span className={cn('absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-background flex items-center justify-center',
                    nota.tipo === 'sessao_falta' ? 'bg-red-500' : 'bg-emerald-500')} />
                  <div className="rounded-xl border bg-card p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <span className={cn('flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide', meta.cls)}>
                          {meta.icon} {meta.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {format(parseISO(nota.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                        {mantida && (
                          <Badge variant="outline" className="text-[9px] h-4 border-emerald-300 text-emerald-700 bg-emerald-50">
                            Conduta mantida
                          </Badge>
                        )}
                      </div>
                      {acoesNota(nota)}
                    </div>
                    <p className="text-[12px] font-semibold leading-tight mb-1">{nota.titulo}</p>
                    {corpoNota(nota)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={excluir} disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
