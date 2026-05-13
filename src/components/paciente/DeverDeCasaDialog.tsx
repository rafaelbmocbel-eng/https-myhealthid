import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import {
  Loader2, Plus, Search, Trash2, Check, Dumbbell,
  TrendingUp, MessageSquare, X, Sparkles
} from 'lucide-react';
import { format, parseISO, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pacienteId: string;
  pacienteNome: string;
  terapeutaId: string;
}

interface CatalogItem {
  id: string;
  nome: string;
  categoria: string;
  descricao: string | null;
  tempo_duracao: string | null;
  nivel_dificuldade: string;
  regiao_corporal: any;
}

interface Selecionado {
  origem: 'catalogo' | 'manual';
  catalogo_id?: string;
  nome: string;
  categoria: string;
  series: number;
  repeticoes: number;
  orientacoes: string;
}

const CATEGORIAS = ['Todas', 'Alongamento', 'Mobilidade', 'Fortalecimento', 'Postura', 'Respiração', 'Funcional', 'Propriocepção', 'Relaxamento'];

export default function DeverDeCasaDialog({ open, onOpenChange, pacienteId, pacienteNome, terapeutaId }: Props) {
  const { toast } = useToast();
  const [tab, setTab] = useState<'prescrever' | 'acompanhar'>('prescrever');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Catalog
  const [catalogo, setCatalogo] = useState<CatalogItem[]>([]);
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('Todas');

  // Plan being built
  const [titulo, setTitulo] = useState('Dever de Casa');
  const [frequencia, setFrequencia] = useState('3x por semana');
  const [duracao, setDuracao] = useState('15-20 min');
  const [selecionados, setSelecionados] = useState<Selecionado[]>([]);

  // Manual add form
  const [manualNome, setManualNome] = useState('');
  const [manualOrient, setManualOrient] = useState('');

  // Tracking tab
  const [treinosAtivos, setTreinosAtivos] = useState<any[]>([]);
  const [execucoes, setExecucoes] = useState<any[]>([]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      supabase.from('exercicios_biblioteca')
        .select('id, nome, categoria, descricao, tempo_duracao, nivel_dificuldade, regiao_corporal')
        .order('categoria').order('nome'),
      supabase.from('studio_treinos')
        .select('id, titulo, frequencia, duracao_estimada, created_at, ativo, publicado')
        .eq('paciente_id', pacienteId)
        .eq('ativo', true)
        .order('created_at', { ascending: false }),
      supabase.from('studio_execucoes')
        .select('id, treino_id, data_execucao, completo, nota_dor, feedback_aluno')
        .eq('paciente_id', pacienteId)
        .gte('data_execucao', subDays(new Date(), 30).toISOString())
        .order('data_execucao', { ascending: false }),
    ]).then(([cat, tre, exe]) => {
      setCatalogo((cat.data || []) as CatalogItem[]);
      setTreinosAtivos(tre.data || []);
      setExecucoes(exe.data || []);
      setLoading(false);
    });
  }, [open, pacienteId]);

  const filtered = useMemo(() => {
    return catalogo.filter(c => {
      if (categoria !== 'Todas' && c.categoria !== categoria) return false;
      if (busca && !c.nome.toLowerCase().includes(busca.toLowerCase())) return false;
      return true;
    });
  }, [catalogo, busca, categoria]);

  const addCatalogo = (c: CatalogItem) => {
    if (selecionados.find(s => s.catalogo_id === c.id)) return;
    setSelecionados(s => [...s, {
      origem: 'catalogo',
      catalogo_id: c.id,
      nome: c.nome,
      categoria: c.categoria,
      series: 2,
      repeticoes: 10,
      orientacoes: c.descricao || '',
    }]);
  };

  const addManual = () => {
    if (!manualNome.trim()) return;
    setSelecionados(s => [...s, {
      origem: 'manual',
      nome: manualNome.trim(),
      categoria: 'Customizado',
      series: 2,
      repeticoes: 10,
      orientacoes: manualOrient.trim(),
    }]);
    setManualNome('');
    setManualOrient('');
  };

  const remove = (idx: number) => setSelecionados(s => s.filter((_, i) => i !== idx));

  const updateField = (idx: number, field: keyof Selecionado, value: any) => {
    setSelecionados(s => s.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const handleSave = async () => {
    if (selecionados.length === 0) {
      toast({ title: 'Adicione ao menos uma atividade', variant: 'destructive' });
      return;
    }
    setSaving(true);

    const { data: treino, error: treinoErr } = await supabase
      .from('studio_treinos')
      .insert({
        paciente_id: pacienteId,
        terapeuta_id: terapeutaId,
        titulo: titulo.trim() || 'Dever de Casa',
        frequencia,
        duracao_estimada: duracao,
        objetivo: 'Cinético-funcional em casa',
        intensidade: 'Leve a moderada',
        publicado: true,
        ativo: true,
      })
      .select()
      .single();

    if (treinoErr || !treino) {
      toast({ title: 'Erro ao salvar', description: treinoErr?.message, variant: 'destructive' });
      setSaving(false);
      return;
    }

    const exercicios = selecionados.map((s, i) => ({
      treino_id: treino.id,
      nome_customizado: s.nome,
      grupo_muscular: s.categoria,
      series: s.series,
      repeticoes: s.repeticoes,
      orientacoes: s.orientacoes || null,
      ordem: i + 1,
    }));

    const { error: exErr } = await supabase.from('studio_treino_exercicios').insert(exercicios);

    if (exErr) {
      toast({ title: 'Erro ao salvar atividades', description: exErr.message, variant: 'destructive' });
      setSaving(false);
      return;
    }

    toast({ title: '✅ Dever de casa enviado', description: `${selecionados.length} atividade(s) já no portal de ${pacienteNome.split(' ')[0]}.` });
    setSelecionados([]);
    setTab('acompanhar');
    // Refetch tracking
    const [tre, exe] = await Promise.all([
      supabase.from('studio_treinos')
        .select('id, titulo, frequencia, duracao_estimada, created_at, ativo, publicado')
        .eq('paciente_id', pacienteId).eq('ativo', true)
        .order('created_at', { ascending: false }),
      supabase.from('studio_execucoes')
        .select('id, treino_id, data_execucao, completo, nota_dor, feedback_aluno')
        .eq('paciente_id', pacienteId)
        .gte('data_execucao', subDays(new Date(), 30).toISOString())
        .order('data_execucao', { ascending: false }),
    ]);
    setTreinosAtivos(tre.data || []);
    setExecucoes(exe.data || []);
    setSaving(false);
  };

  const desativarTreino = async (id: string) => {
    if (!confirm('Desativar esse plano? Ele sai do portal do paciente.')) return;
    await supabase.from('studio_treinos').update({ ativo: false, publicado: false }).eq('id', id);
    setTreinosAtivos(t => t.filter(x => x.id !== id));
    toast({ title: 'Plano desativado' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90dvh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 pb-2 border-b border-border/40 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Dumbbell className="icon-md text-primary" />
            Dever de Casa — {pacienteNome.split(' ')[0]}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-4 mt-3 grid grid-cols-2 shrink-0">
            <TabsTrigger value="prescrever" className="gap-1.5"><Plus className="icon-xs" /> Prescrever</TabsTrigger>
            <TabsTrigger value="acompanhar" className="gap-1.5"><TrendingUp className="icon-xs" /> Acompanhar</TabsTrigger>
          </TabsList>

          {/* PRESCREVER */}
          <TabsContent value="prescrever" className="flex-1 min-h-0 mt-3 mx-0 px-0">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="icon-md animate-spin text-primary" /></div>
            ) : (
              <div className="grid md:grid-cols-2 gap-0 h-full min-h-0">
                {/* LEFT: catalog */}
                <div className="flex flex-col min-h-0 border-r border-border/40">
                  <div className="px-4 pb-2 space-y-2 shrink-0">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 icon-xs text-muted-foreground" />
                      <Input
                        placeholder="Buscar atividade..."
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        className="pl-8 h-9 text-sm"
                        style={{ fontSize: '16px' }}
                      />
                    </div>
                    <div className="flex gap-1 overflow-x-auto pb-1">
                      {CATEGORIAS.map(c => (
                        <button
                          key={c}
                          onClick={() => setCategoria(c)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors ${
                            categoria === c ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                  <ScrollArea className="flex-1 px-4">
                    <div className="space-y-1.5 pb-4">
                      {filtered.map(c => {
                        const added = !!selecionados.find(s => s.catalogo_id === c.id);
                        return (
                          <button
                            key={c.id}
                            onClick={() => addCatalogo(c)}
                            disabled={added}
                            className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
                              added ? 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/10 cursor-not-allowed'
                                    : 'border-border/40 hover:border-primary/40 hover:bg-muted/30'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-foreground truncate">{c.nome}</div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <Badge variant="outline" className="text-[9px] h-4 px-1.5">{c.categoria}</Badge>
                                  {c.tempo_duracao && <span className="text-[10px] text-muted-foreground">{c.tempo_duracao}</span>}
                                </div>
                              </div>
                              {added ? <Check className="icon-sm text-emerald-600 shrink-0" /> : <Plus className="icon-sm text-muted-foreground shrink-0" />}
                            </div>
                          </button>
                        );
                      })}
                      {filtered.length === 0 && (
                        <p className="text-center text-xs text-muted-foreground py-6">Nada encontrado.</p>
                      )}
                    </div>

                    {/* Manual add */}
                    <div className="border-t border-border/40 pt-3 pb-4 space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Adicionar customizada</p>
                      <Input
                        placeholder="Nome da atividade"
                        value={manualNome}
                        onChange={(e) => setManualNome(e.target.value)}
                        className="h-9 text-sm"
                        style={{ fontSize: '16px' }}
                      />
                      <Textarea
                        placeholder="Orientações (opcional)"
                        value={manualOrient}
                        onChange={(e) => setManualOrient(e.target.value)}
                        className="text-sm resize-none h-14"
                        style={{ fontSize: '16px' }}
                      />
                      <Button onClick={addManual} variant="outline" size="sm" className="w-full gap-1.5" disabled={!manualNome.trim()}>
                        <Plus className="icon-xs" /> Adicionar
                      </Button>
                    </div>
                  </ScrollArea>
                </div>

                {/* RIGHT: plan being built */}
                <div className="flex flex-col min-h-0">
                  <div className="px-4 pb-2 space-y-2 shrink-0">
                    <Input
                      placeholder="Título do plano"
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                      className="h-9 text-sm font-semibold"
                      style={{ fontSize: '16px' }}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Frequência"
                        value={frequencia}
                        onChange={(e) => setFrequencia(e.target.value)}
                        className="h-8 text-xs"
                        style={{ fontSize: '16px' }}
                      />
                      <Input
                        placeholder="Duração"
                        value={duracao}
                        onChange={(e) => setDuracao(e.target.value)}
                        className="h-8 text-xs"
                        style={{ fontSize: '16px' }}
                      />
                    </div>
                  </div>

                  <ScrollArea className="flex-1 px-4">
                    <div className="space-y-2 pb-4">
                      {selecionados.length === 0 ? (
                        <Card className="p-6 text-center border-dashed">
                          <p className="text-xs text-muted-foreground">Escolha atividades do catálogo ao lado.</p>
                        </Card>
                      ) : selecionados.map((s, i) => (
                        <Card key={i} className="p-2.5">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold text-foreground">{s.nome}</div>
                              <Badge variant="outline" className="text-[9px] h-4 mt-0.5">{s.categoria}</Badge>
                            </div>
                            <button onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive">
                              <Trash2 className="icon-xs" />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <div>
                              <label className="text-[9px] font-semibold text-muted-foreground uppercase">Séries</label>
                              <Input
                                type="number"
                                min="1"
                                value={s.series}
                                onChange={(e) => updateField(i, 'series', parseInt(e.target.value) || 1)}
                                className="h-7 text-xs"
                                style={{ fontSize: '16px' }}
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-semibold text-muted-foreground uppercase">Reps/Tempo</label>
                              <Input
                                type="number"
                                min="1"
                                value={s.repeticoes}
                                onChange={(e) => updateField(i, 'repeticoes', parseInt(e.target.value) || 1)}
                                className="h-7 text-xs"
                                style={{ fontSize: '16px' }}
                              />
                            </div>
                          </div>
                          <Textarea
                            value={s.orientacoes}
                            onChange={(e) => updateField(i, 'orientacoes', e.target.value)}
                            placeholder="Orientações para o paciente"
                            className="text-[11px] resize-none h-12"
                            style={{ fontSize: '16px' }}
                          />
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>

                  <div className="p-4 border-t border-border/40 shrink-0">
                    <Button onClick={handleSave} disabled={saving || selecionados.length === 0} className="w-full gap-2 font-bold">
                      {saving ? <Loader2 className="icon-sm animate-spin" /> : <Check className="icon-sm" />}
                      Enviar ao portal ({selecionados.length})
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ACOMPANHAR */}
          <TabsContent value="acompanhar" className="flex-1 min-h-0 mt-3 mx-0 px-0">
            <ScrollArea className="h-full px-4 pb-4">
              {treinosAtivos.length === 0 ? (
                <Card className="p-8 text-center border-dashed">
                  <Dumbbell className="icon-lg text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm font-medium text-muted-foreground">Sem planos ativos</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Use a aba Prescrever para criar o primeiro.</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {treinosAtivos.map(t => {
                    const execs = execucoes.filter(e => e.treino_id === t.id);
                    const completas = execs.filter(e => e.completo).length;
                    const dorMedia = execs.length > 0
                      ? (execs.filter(e => e.nota_dor != null).reduce((a, e) => a + e.nota_dor, 0) / Math.max(1, execs.filter(e => e.nota_dor != null).length))
                      : null;
                    const ultima = execs[0];
                    return (
                      <Card key={t.id} className="p-3">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-foreground">{t.titulo}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {t.frequencia} · {t.duracao_estimada} · criado em {format(parseISO(t.created_at), "d MMM", { locale: ptBR })}
                            </div>
                          </div>
                          <button onClick={() => desativarTreino(t.id)} className="text-muted-foreground hover:text-destructive p-1">
                            <X className="icon-sm" />
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mb-2">
                          <div className="rounded-lg bg-muted/30 p-2 text-center">
                            <div className="text-base font-bold text-foreground">{completas}</div>
                            <div className="text-[9px] text-muted-foreground">execuções 30d</div>
                          </div>
                          <div className="rounded-lg bg-muted/30 p-2 text-center">
                            <div className={`text-base font-bold ${dorMedia != null && dorMedia > 5 ? 'text-red-500' : 'text-foreground'}`}>
                              {dorMedia != null ? dorMedia.toFixed(1) : '—'}
                            </div>
                            <div className="text-[9px] text-muted-foreground">dor média</div>
                          </div>
                          <div className="rounded-lg bg-muted/30 p-2 text-center">
                            <div className="text-[10px] font-semibold text-foreground">
                              {ultima?.data_execucao ? format(parseISO(ultima.data_execucao), "d MMM", { locale: ptBR }) : '—'}
                            </div>
                            <div className="text-[9px] text-muted-foreground">última</div>
                          </div>
                        </div>

                        {execs.filter(e => e.feedback_aluno).slice(0, 2).map(e => (
                          <div key={e.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/20 mt-2">
                            <MessageSquare className="icon-xs text-muted-foreground shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] text-foreground italic">"{e.feedback_aluno}"</p>
                              <p className="text-[9px] text-muted-foreground mt-0.5">
                                {e.data_execucao && format(parseISO(e.data_execucao), "d MMM", { locale: ptBR })}
                                {e.nota_dor != null && ` · dor ${e.nota_dor}/10`}
                              </p>
                            </div>
                          </div>
                        ))}
                      </Card>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
