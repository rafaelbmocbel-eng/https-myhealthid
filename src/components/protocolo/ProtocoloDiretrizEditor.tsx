import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Brain, ChevronDown, ChevronUp, Clock, Dumbbell, Target,
  Pencil, Plus, X, BookOpen, Sparkles, Loader2, Check, Save,
} from 'lucide-react';
import type {
  DiretrizSnapshot, DiretrizSnapshotPhase, DiretrizSnapshotExercise, DiretrizSnapshotTechnique,
} from '@/lib/protocoloSnapshot';

interface Props {
  protocoloId: string;
  snapshot: DiretrizSnapshot;
  faseAtual: number;
  queixa?: string;
}

type Tipo = 'exercicios' | 'tecnicas';
type PickerState = { faseIdx: number; tipo: Tipo } | null;

const EVID_COLORS: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  B: 'bg-amber-100 text-amber-700 border-amber-200',
  C: 'bg-slate-100 text-slate-700 border-slate-200',
};

function evidBadge(nivel?: string) {
  if (!nivel) return null;
  const cls = EVID_COLORS[nivel.toUpperCase()] || EVID_COLORS.C;
  return <Badge variant="outline" className={`text-[10px] ${cls}`}>Evid. {nivel.toUpperCase()}</Badge>;
}

export default function ProtocoloDiretrizEditor({ protocoloId, snapshot, faseAtual, queixa }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [fases, setFases] = useState<DiretrizSnapshotPhase[]>(() => snapshot.fases);
  const [abertas, setAbertas] = useState<Set<number>>(
    () => new Set([Math.min(Math.max(faseAtual - 1, 0), Math.max(snapshot.fases.length - 1, 0))]),
  );
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [picker, setPicker] = useState<PickerState>(null);
  const [dirty, setDirty] = useState(false);

  const toggle = (i: number) => {
    setAbertas(p => {
      const n = new Set(p);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });
  };

  const updateFase = (idx: number, patch: Partial<DiretrizSnapshotPhase>) => {
    setFases(prev => prev.map((f, i) => i === idx ? { ...f, ...patch } : f));
    setDirty(true);
  };

  const addExercicio = (idx: number, ex: DiretrizSnapshotExercise) => {
    updateFase(idx, { exercicios: [...(fases[idx].exercicios ?? []), ex] });
  };
  const removeExercicio = (idx: number, exIdx: number) => {
    updateFase(idx, { exercicios: (fases[idx].exercicios ?? []).filter((_, i) => i !== exIdx) });
  };
  const updateExercicio = (idx: number, exIdx: number, patch: Partial<DiretrizSnapshotExercise>) => {
    updateFase(idx, { exercicios: (fases[idx].exercicios ?? []).map((e, i) => i === exIdx ? { ...e, ...patch } : e) });
  };

  const addTecnica = (idx: number, t: DiretrizSnapshotTechnique) => {
    updateFase(idx, { tecnicas: [...(fases[idx].tecnicas ?? []), t] });
  };
  const removeTecnica = (idx: number, tIdx: number) => {
    updateFase(idx, { tecnicas: (fases[idx].tecnicas ?? []).filter((_, i) => i !== tIdx) });
  };
  const updateTecnica = (idx: number, tIdx: number, patch: Partial<DiretrizSnapshotTechnique>) => {
    updateFase(idx, { tecnicas: (fases[idx].tecnicas ?? []).map((t, i) => i === tIdx ? { ...t, ...patch } : t) });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      // 1. fetch protocol scores
      const { data: prot, error: e1 } = await supabase
        .from('protocolos' as any).select('scores_avaliacao').eq('id', protocoloId).single();
      if (e1) throw e1;
      const scores: any = (prot as any)?.scores_avaliacao || {};
      const novoSnapshot: DiretrizSnapshot = { ...snapshot, fases };
      const novoScores = { ...scores, diretriz_snapshot: novoSnapshot };

      const { error: e2 } = await (supabase as any).from('protocolos')
        .update({ scores_avaliacao: novoScores }).eq('id', protocoloId);
      if (e2) throw e2;

      // 2. update protocolo_fases (objetivos + frequencia + duração)
      const { data: dbFases } = await supabase
        .from('protocolo_fases' as any).select('id, numero_fase').eq('protocolo_id', protocoloId);
      for (const f of fases) {
        const match = (dbFases as any[] | null)?.find(d => d.numero_fase === f.numero);
        if (match) {
          await (supabase as any).from('protocolo_fases').update({
            objetivos: [f.objetivo, ...(f.demandasAlvo || []), ...(f.criteriosProgressao || [])].filter(Boolean),
            sessoes_por_semana: f.frequenciaSemanal || 2,
            titulo: f.titulo,
          }).eq('id', match.id);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['protocolo', protocoloId] });
      qc.invalidateQueries({ queryKey: ['protocolo-fases', protocoloId] });
      setDirty(false);
      setEditingIdx(null);
      toast({ title: 'Diretriz atualizada' });
    },
    onError: (err: any) => toast({ title: 'Erro ao salvar', description: err?.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-4 mb-6">
      {dirty && (
        <div className="sticky top-2 z-20 flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 backdrop-blur p-3">
          <span className="text-sm font-medium text-foreground">Alterações não salvas</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setFases(snapshot.fases); setDirty(false); setEditingIdx(null); }}>Descartar</Button>
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar diretriz
            </Button>
          </div>
        </div>
      )}

      {fases.map((fase, idx) => {
        const isOpen = abertas.has(idx);
        const isAtual = faseAtual === fase.numero;
        const editing = editingIdx === idx;

        return (
          <div
            key={`${fase.numero}-${idx}`}
            className={`rounded-xl border border-border bg-card overflow-hidden ${isAtual ? 'ring-2 ring-primary/20' : ''}`}
          >
            <button
              type="button"
              onClick={() => toggle(idx)}
              className={`w-full flex items-center justify-between gap-4 p-4 text-left transition-colors ${isAtual ? 'bg-primary/5' : 'bg-muted/30 hover:bg-muted/50'}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${isAtual ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                  {fase.numero}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground">{fase.titulo}</span>
                    {isAtual && <Badge>Fase atual</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2 mt-1">
                    <span>Semanas {fase.semanas}</span>
                    {(fase.frequenciaSemanal ?? 0) > 0 && <span>{fase.frequenciaSemanal}x/sem</span>}
                    <span>{fase.exercicios?.length ?? 0} exerc.</span>
                    <span>{fase.tecnicas?.length ?? 0} técn.</span>
                  </div>
                </div>
              </div>
              {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
            </button>

            {isOpen && (
              <div className="p-4 space-y-4">
                {/* Cabeçalho de edição */}
                <div className="flex items-center justify-end">
                  {editing ? (
                    <Button size="sm" variant="outline" onClick={() => setEditingIdx(null)} className="gap-1">
                      <Check className="h-3.5 w-3.5" /> Concluir edição
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setEditingIdx(idx)} className="gap-1">
                      <Pencil className="h-3.5 w-3.5" /> Editar fase
                    </Button>
                  )}
                </div>

                {/* Objetivo + parâmetros */}
                <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Target className="h-4 w-4 text-primary" /> Objetivo da fase
                  </div>
                  {editing ? (
                    <>
                      <Textarea
                        value={fase.objetivo}
                        onChange={e => updateFase(idx, { objetivo: e.target.value })}
                        rows={2}
                        className="text-sm"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-xs text-muted-foreground">
                          Frequência (x/semana)
                          <Input
                            type="number" min={1} max={7}
                            value={fase.frequenciaSemanal || ''}
                            onChange={e => updateFase(idx, { frequenciaSemanal: Number(e.target.value) || 0 })}
                            className="mt-1 h-8"
                          />
                        </label>
                        <label className="text-xs text-muted-foreground">
                          Duração da sessão
                          <Input
                            value={fase.duracaoSessao || ''}
                            placeholder="ex.: 45 min"
                            onChange={e => updateFase(idx, { duracaoSessao: e.target.value })}
                            className="mt-1 h-8"
                          />
                        </label>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Demandas alvo</div>
                        <div className="flex flex-wrap gap-1.5">
                          {(fase.demandasAlvo ?? []).map((d, i) => (
                            <Badge key={i} variant="secondary" className="gap-1 text-xs">
                              {d}
                              <button onClick={() => updateFase(idx, { demandasAlvo: (fase.demandasAlvo ?? []).filter((_, k) => k !== i) })}>
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                          <AddChip onAdd={(v) => updateFase(idx, { demandasAlvo: [...(fase.demandasAlvo ?? []), v] })} />
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Critérios de progressão / alta da fase</div>
                        <div className="flex flex-wrap gap-1.5">
                          {(fase.criteriosProgressao ?? []).map((d, i) => (
                            <Badge key={i} variant="secondary" className="gap-1 text-xs">
                              {d}
                              <button onClick={() => updateFase(idx, { criteriosProgressao: (fase.criteriosProgressao ?? []).filter((_, k) => k !== i) })}>
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                          <AddChip onAdd={(v) => updateFase(idx, { criteriosProgressao: [...(fase.criteriosProgressao ?? []), v] })} />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">{fase.objetivo || 'Sem objetivo definido'}</p>
                      {(fase.demandasAlvo?.length ?? 0) > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {(fase.demandasAlvo ?? []).map((d, i) => <Badge key={i} variant="secondary" className="text-xs">{d}</Badge>)}
                        </div>
                      )}
                      {(fase.criteriosProgressao?.length ?? 0) > 0 && (
                        <div className="pt-2">
                          <div className="text-xs text-muted-foreground mb-1">Critérios</div>
                          <div className="flex flex-wrap gap-2">
                            {(fase.criteriosProgressao ?? []).map((d, i) => <Badge key={i} variant="outline" className="text-xs">{d}</Badge>)}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Exercícios + Técnicas */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <ListaItens
                    titulo="Exercícios"
                    icon={<Dumbbell className="h-4 w-4 text-primary" />}
                    itens={fase.exercicios ?? []}
                    editing={editing}
                    onAddCatalogo={() => setPicker({ faseIdx: idx, tipo: 'exercicios' })}
                    onAddIA={() => setPicker({ faseIdx: idx, tipo: 'exercicios' })}
                    onRemove={(i) => removeExercicio(idx, i)}
                    onUpdate={(i, patch) => updateExercicio(idx, i, patch as any)}
                    tipo="exercicios"
                  />
                  <ListaItens
                    titulo="Técnicas"
                    icon={<Brain className="h-4 w-4 text-primary" />}
                    itens={fase.tecnicas ?? []}
                    editing={editing}
                    onAddCatalogo={() => setPicker({ faseIdx: idx, tipo: 'tecnicas' })}
                    onAddIA={() => setPicker({ faseIdx: idx, tipo: 'tecnicas' })}
                    onRemove={(i) => removeTecnica(idx, i)}
                    onUpdate={(i, patch) => updateTecnica(idx, i, patch as any)}
                    tipo="tecnicas"
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}

      {picker && (
        <PickerDialog
          open={!!picker}
          onClose={() => setPicker(null)}
          tipo={picker.tipo}
          fase={fases[picker.faseIdx]}
          queixa={queixa}
          onSelectExercicio={(ex) => { addExercicio(picker.faseIdx, ex); }}
          onSelectTecnica={(t) => { addTecnica(picker.faseIdx, t); }}
        />
      )}
    </div>
  );
}

/* ───────────────────── Sub-components ───────────────────── */

function AddChip({ onAdd }: { onAdd: (v: string) => void }) {
  const [val, setVal] = useState('');
  const [open, setOpen] = useState(false);
  if (!open) return <button onClick={() => setOpen(true)} className="text-xs text-primary hover:underline">+ adicionar</button>;
  return (
    <div className="flex items-center gap-1">
      <Input
        autoFocus value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && val.trim()) { onAdd(val.trim()); setVal(''); setOpen(false); } }}
        className="h-6 w-32 text-xs"
        placeholder="ex.: dor ↓"
      />
      <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => { if (val.trim()) { onAdd(val.trim()); setVal(''); } setOpen(false); }}>ok</Button>
    </div>
  );
}

function ListaItens({
  titulo, icon, itens, editing, onAddCatalogo, onAddIA, onRemove, onUpdate, tipo,
}: {
  titulo: string;
  icon: React.ReactNode;
  itens: (DiretrizSnapshotExercise | DiretrizSnapshotTechnique)[];
  editing: boolean;
  onAddCatalogo: () => void;
  onAddIA: () => void;
  onRemove: (i: number) => void;
  onUpdate: (i: number, patch: any) => void;
  tipo: Tipo;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {icon} {titulo}
        </div>
        {editing && (
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={onAddCatalogo}>
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Button>
        )}
      </div>

      {itens.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/10 p-4 text-sm text-muted-foreground">
          Nenhum item nesta fase.
        </div>
      ) : (
        itens.map((it: any, i) => (
          <div key={i} className="rounded-xl border border-border bg-background p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm text-foreground">{it.nome}</div>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  {it.categoria && <Badge variant="outline" className="text-[10px]">{it.categoria}</Badge>}
                  {evidBadge(it.nivel_evidencia)}
                  {tipo === 'exercicios' && (it.series || it.repeticoes) && (
                    <span className="text-xs text-muted-foreground">{it.series || '-'}×{it.repeticoes || '-'}</span>
                  )}
                  {it.duracao && (
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {it.duracao}
                    </span>
                  )}
                  {tipo === 'tecnicas' && it.frequencia && <span className="text-xs text-muted-foreground">{it.frequencia}</span>}
                </div>
              </div>
              {editing && (
                <button onClick={() => onRemove(i)} className="text-muted-foreground hover:text-destructive p-1">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {it.motivo && <p className="text-xs text-primary">↳ {it.motivo}</p>}
            {editing && tipo === 'exercicios' && (
              <div className="grid grid-cols-3 gap-1.5">
                <Input value={it.series ?? ''} onChange={e => onUpdate(i, { series: e.target.value })} placeholder="séries" className="h-7 text-xs" />
                <Input value={it.repeticoes ?? ''} onChange={e => onUpdate(i, { repeticoes: e.target.value })} placeholder="reps" className="h-7 text-xs" />
                <Input value={it.duracao ?? ''} onChange={e => onUpdate(i, { duracao: e.target.value })} placeholder="duração" className="h-7 text-xs" />
              </div>
            )}
            {editing && tipo === 'tecnicas' && (
              <div className="grid grid-cols-2 gap-1.5">
                <Input value={it.duracao ?? ''} onChange={e => onUpdate(i, { duracao: e.target.value })} placeholder="duração" className="h-7 text-xs" />
                <Input value={it.frequencia ?? ''} onChange={e => onUpdate(i, { frequencia: e.target.value })} placeholder="frequência" className="h-7 text-xs" />
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

/* ───────────────────── Picker dialog (catálogo + IA) ───────────────────── */

function PickerDialog({
  open, onClose, tipo, fase, queixa, onSelectExercicio, onSelectTecnica,
}: {
  open: boolean;
  onClose: () => void;
  tipo: Tipo;
  fase: DiretrizSnapshotPhase;
  queixa?: string;
  onSelectExercicio: (ex: DiretrizSnapshotExercise) => void;
  onSelectTecnica: (t: DiretrizSnapshotTechnique) => void;
}) {
  const [tab, setTab] = useState<'catalogo' | 'ia'>('catalogo');
  const [search, setSearch] = useState('');
  const [iaSugestoes, setIaSugestoes] = useState<any[] | null>(null);
  const [iaLoading, setIaLoading] = useState(false);
  const { toast } = useToast();

  const { data: catalogo = [], isLoading: catLoading } = useQuery({
    queryKey: ['catalogo', tipo],
    queryFn: async () => {
      if (tipo === 'exercicios') {
        const { data, error } = await supabase.from('exercicios_biblioteca').select('*').limit(200);
        if (error) throw error;
        return data || [];
      }
      const { data, error } = await supabase.from('tecnicas_tratamento').select('*').limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const filtrados = (catalogo as any[]).filter(c =>
    !search || c.nome?.toLowerCase().includes(search.toLowerCase()) || c.categoria?.toLowerCase().includes(search.toLowerCase()),
  );

  const carregarIA = async () => {
    setIaLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('sugerir-diretriz-fase', {
        body: {
          tipo, faseNumero: fase.numero, faseTitulo: fase.titulo,
          objetivo: fase.objetivo, queixa,
          jaSelecionados: (tipo === 'exercicios' ? fase.exercicios : fase.tecnicas).map((x: any) => x.nome),
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setIaSugestoes((data as any)?.sugestoes || []);
    } catch (err: any) {
      toast({ title: 'Erro na IA', description: err?.message, variant: 'destructive' });
    } finally {
      setIaLoading(false);
    }
  };

  const selecionarCatalogo = (item: any) => {
    if (tipo === 'exercicios') {
      onSelectExercicio({
        nome: item.nome,
        categoria: item.categoria || 'Exercício',
        series: 3, repeticoes: 12,
        duracao: item.tempo_duracao || '',
        motivo: '', descricao: item.descricao || '',
        instrucoes: Array.isArray(item.instrucoes) ? item.instrucoes : [],
      });
    } else {
      onSelectTecnica({
        nome: item.nome,
        descricao: item.descricao || '',
        duracao: item.parametros?.duracao || '',
        frequencia: item.parametros?.frequencia || '',
        motivo: item.indicacoes || '',
        categoria: item.categoria,
        ...(item.nivel_evidencia ? { nivel_evidencia: item.nivel_evidencia } as any : {}),
      } as any);
    }
  };

  const selecionarIA = (s: any) => {
    if (tipo === 'exercicios') {
      onSelectExercicio({
        nome: s.nome, categoria: s.categoria,
        series: s.series || 3, repeticoes: s.repeticoes || 12,
        duracao: s.duracao || '',
        motivo: s.motivo || '', descricao: '', instrucoes: [],
        ...(s.nivel_evidencia ? { nivel_evidencia: s.nivel_evidencia } as any : {}),
      } as any);
    } else {
      onSelectTecnica({
        nome: s.nome, descricao: '', duracao: s.duracao || '',
        frequencia: s.frequencia || '', motivo: s.motivo || '', categoria: s.categoria,
        ...(s.nivel_evidencia ? { nivel_evidencia: s.nivel_evidencia } as any : {}),
      } as any);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar {tipo === 'exercicios' ? 'exercício' : 'técnica'} — Fase {fase.numero}</DialogTitle>
          <DialogDescription>Escolha do catálogo ou peça sugestões baseadas em evidência à IA.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-1 bg-muted rounded-lg p-1">
          <button
            onClick={() => setTab('catalogo')}
            className={`flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${tab === 'catalogo' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
          >
            <BookOpen className="h-4 w-4" /> Catálogo
          </button>
          <button
            onClick={() => setTab('ia')}
            className={`flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${tab === 'ia' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
          >
            <Sparkles className="h-4 w-4" /> Sugestões IA
          </button>
        </div>

        {tab === 'catalogo' && (
          <div className="space-y-2">
            <Input placeholder="Buscar…" value={search} onChange={e => setSearch(e.target.value)} />
            {catLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" /> carregando catálogo…</div>
            ) : filtrados.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Nenhum item encontrado.</div>
            ) : (
              <div className="space-y-1.5 max-h-[50dvh] overflow-y-auto">
                {filtrados.map((it: any) => (
                  <button key={it.id} onClick={() => selecionarCatalogo(it)}
                    className="w-full text-left rounded-lg border border-border bg-card hover:bg-muted/40 p-3 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{it.nome}</div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {it.categoria && <Badge variant="outline" className="text-[10px]">{it.categoria}</Badge>}
                          {evidBadge(it.nivel_evidencia)}
                        </div>
                        {it.descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{it.descricao}</p>}
                      </div>
                      <Plus className="h-4 w-4 text-primary shrink-0 mt-1" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'ia' && (
          <div className="space-y-3">
            {!iaSugestoes && !iaLoading && (
              <Button onClick={carregarIA} className="w-full gap-2">
                <Sparkles className="h-4 w-4" /> Gerar 5 sugestões para esta fase
              </Button>
            )}
            {iaLoading && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> consultando IA clínica…
              </div>
            )}
            {iaSugestoes && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{iaSugestoes.length} sugestões</span>
                  <Button size="sm" variant="ghost" onClick={carregarIA} disabled={iaLoading}>Gerar outras</Button>
                </div>
                <div className="space-y-1.5 max-h-[50dvh] overflow-y-auto">
                  {iaSugestoes.map((s, i) => (
                    <button key={i} onClick={() => selecionarIA(s)}
                      className="w-full text-left rounded-lg border border-border bg-card hover:bg-muted/40 p-3 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{s.nome}</div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {s.categoria && <Badge variant="outline" className="text-[10px]">{s.categoria}</Badge>}
                            {evidBadge(s.nivel_evidencia)}
                            {tipo === 'exercicios' && (s.series || s.repeticoes) && (
                              <span className="text-xs text-muted-foreground">{s.series}×{s.repeticoes}</span>
                            )}
                            {s.duracao && <span className="text-xs text-muted-foreground">{s.duracao}</span>}
                          </div>
                          {s.motivo && <p className="text-xs text-primary mt-1">↳ {s.motivo}</p>}
                        </div>
                        <Plus className="h-4 w-4 text-primary shrink-0 mt-1" />
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
