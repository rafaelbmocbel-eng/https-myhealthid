import { useState } from 'react';
import { useStudioTreinos, useStudioExercicios } from '@/hooks/useStudioData';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  Plus, Dumbbell, ChevronDown, ChevronUp, Trash2, GripVertical,
  Edit2, Save, X, Check, Loader2, Eye, Send,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  pacienteId: string;
  pacienteNome: string;
}

export default function StudioTreinosTab({ pacienteId, pacienteNome }: Props) {
  const { treinos, isLoading, criarTreino, deletarTreino, atualizarTreino } = useStudioTreinos(pacienteId);
  const [showNovoTreino, setShowNovoTreino] = useState(false);
  const [expandedTreino, setExpandedTreino] = useState<string | null>(null);
  const [novoTreino, setNovoTreino] = useState({ titulo: '', objetivo: 'Hipertrofia', duracao_estimada: '50-60 min', intensidade: 'Alta', frequencia: '2x por semana' });

  const handleCriar = async () => {
    if (!novoTreino.titulo.trim()) return;
    await criarTreino.mutateAsync({ paciente_id: pacienteId, ...novoTreino });
    setNovoTreino({ titulo: '', objetivo: 'Hipertrofia', duracao_estimada: '50-60 min', intensidade: 'Alta', frequencia: '2x por semana' });
    setShowNovoTreino(false);
  };

  const treinosAtivos = treinos.filter((t: any) => t.ativo);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-foreground">Treinos</h3>
          <p className="text-xs text-muted-foreground">{treinosAtivos.length} treino(s) ativo(s)</p>
        </div>
        <Button size="sm" className="bg-gradient-studio text-white gap-1" onClick={() => setShowNovoTreino(!showNovoTreino)}>
          <Plus className="h-3.5 w-3.5" /> Criar Treino
        </Button>
      </div>

      {/* Novo Treino Form */}
      {showNovoTreino && (
        <Card className="border-studio/30 border-2">
          <CardContent className="pt-4 pb-4 space-y-3">
            <Input placeholder="Nome do treino (ex: Treino A - Peito e Tríceps)" value={novoTreino.titulo} onChange={e => setNovoTreino(p => ({ ...p, titulo: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <Select value={novoTreino.objetivo} onValueChange={v => setNovoTreino(p => ({ ...p, objetivo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Hipertrofia">Hipertrofia</SelectItem>
                  <SelectItem value="Força">Força</SelectItem>
                  <SelectItem value="Resistência">Resistência</SelectItem>
                  <SelectItem value="Funcional">Funcional</SelectItem>
                  <SelectItem value="Reabilitação">Reabilitação</SelectItem>
                </SelectContent>
              </Select>
              <Select value={novoTreino.intensidade} onValueChange={v => setNovoTreino(p => ({ ...p, intensidade: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Leve">Leve</SelectItem>
                  <SelectItem value="Moderada">Moderada</SelectItem>
                  <SelectItem value="Alta">Alta</SelectItem>
                  <SelectItem value="Muito Alta">Muito Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Duração estimada" value={novoTreino.duracao_estimada} onChange={e => setNovoTreino(p => ({ ...p, duracao_estimada: e.target.value }))} />
              <Input placeholder="Frequência" value={novoTreino.frequencia} onChange={e => setNovoTreino(p => ({ ...p, frequencia: e.target.value }))} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowNovoTreino(false)}>Cancelar</Button>
              <Button size="sm" className="bg-gradient-studio text-white" onClick={handleCriar} disabled={criarTreino.isPending}>
                {criarTreino.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span className="ml-1">Salvar</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Treinos List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-studio" /></div>
      ) : treinosAtivos.length === 0 ? (
        <Card className="border-dashed border-2 border-studio/20">
          <CardContent className="py-12 text-center">
            <Dumbbell className="h-10 w-10 mx-auto mb-3 text-studio/30" />
            <p className="font-semibold text-foreground">Nenhum treino criado</p>
            <p className="text-sm text-muted-foreground mt-1">Crie o primeiro treino para {pacienteNome}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {treinosAtivos.map((treino: any) => (
            <TreinoCard
              key={treino.id}
              treino={treino}
              isExpanded={expandedTreino === treino.id}
              onToggle={() => setExpandedTreino(expandedTreino === treino.id ? null : treino.id)}
              onDelete={() => deletarTreino.mutate(treino.id)}
              onUpdate={(updates) => atualizarTreino.mutate({ id: treino.id, ...updates })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TreinoCard({ treino, isExpanded, onToggle, onDelete, onUpdate }: {
  treino: any; isExpanded: boolean; onToggle: () => void; onDelete: () => void; onUpdate: (u: any) => void;
}) {
  const { exercicios, adicionarExercicio, removerExercicio, atualizarExercicio } = useStudioExercicios(isExpanded ? treino.id : undefined);
  const [showAddEx, setShowAddEx] = useState(false);
  const [novoEx, setNovoEx] = useState({ nome_customizado: '', grupo_muscular: '', series: 3, repeticoes: 12, carga_kg: 0, descanso_segundos: 90, orientacoes: '' });

  const handleAddEx = async () => {
    if (!novoEx.nome_customizado.trim()) return;
    await adicionarExercicio.mutateAsync({
      treino_id: treino.id,
      ...novoEx,
      ordem: exercicios.length + 1,
    });
    setNovoEx({ nome_customizado: '', grupo_muscular: '', series: 3, repeticoes: 12, carga_kg: 0, descanso_segundos: 90, orientacoes: '' });
    setShowAddEx(false);
  };

  const exCount = treino.studio_treino_exercicios?.[0]?.count || exercicios.length;

  const INTENSIDADE_COLORS: Record<string, string> = {
    'Leve': 'bg-emerald-100 text-emerald-700',
    'Moderada': 'bg-amber-100 text-amber-700',
    'Alta': 'bg-orange-100 text-orange-700',
    'Muito Alta': 'bg-red-100 text-red-700',
  };

  return (
    <Card className={cn('border-2 transition-all', isExpanded ? 'border-studio/40 shadow-md' : 'border-border hover:border-studio/20')}>
      <CardContent className="pt-4 pb-3">
        {/* Header */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={onToggle}>
          <div className="h-10 w-10 rounded-xl bg-gradient-studio flex items-center justify-center shrink-0">
            <Dumbbell className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-foreground">{treino.titulo}</span>
              {treino.publicado && <Badge className="text-[9px] bg-emerald-100 text-emerald-700">Publicado</Badge>}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground">{exCount} exercícios</span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">{treino.duracao_estimada}</span>
              <Badge className={cn('text-[9px]', INTENSIDADE_COLORS[treino.intensidade] || 'bg-muted text-muted-foreground')}>
                {treino.intensidade}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>

        {/* Expanded: Exercícios */}
        {isExpanded && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Exercícios</span>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowAddEx(!showAddEx)}>
                <Plus className="h-3 w-3" /> Adicionar
              </Button>
            </div>

            {exercicios.map((ex: any, idx: number) => (
              <div key={ex.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 border">
                <span className="text-xs font-bold text-muted-foreground w-5">{idx + 1}.</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-foreground">{ex.nome_customizado || 'Exercício'}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {ex.series}×{ex.repeticoes} • {ex.carga_kg}kg • {ex.descanso_segundos}s desc • {ex.metodo}
                  </div>
                  {ex.orientacoes && <div className="text-[10px] text-studio mt-0.5">💡 {ex.orientacoes}</div>}
                </div>
                <Badge variant="outline" className="text-[9px] shrink-0">{ex.grupo_muscular || '—'}</Badge>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removerExercicio.mutate(ex.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}

            {/* Add Exercise Form */}
            {showAddEx && (
              <div className="p-3 rounded-lg border-2 border-studio/20 bg-studio-light/20 space-y-2">
                <Input placeholder="Nome do exercício" value={novoEx.nome_customizado} onChange={e => setNovoEx(p => ({ ...p, nome_customizado: e.target.value }))} className="h-8 text-sm" />
                <Input placeholder="Grupo muscular" value={novoEx.grupo_muscular} onChange={e => setNovoEx(p => ({ ...p, grupo_muscular: e.target.value }))} className="h-8 text-sm" />
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground">Séries</label>
                    <Input type="number" value={novoEx.series} onChange={e => setNovoEx(p => ({ ...p, series: +e.target.value }))} className="h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">Reps</label>
                    <Input type="number" value={novoEx.repeticoes} onChange={e => setNovoEx(p => ({ ...p, repeticoes: +e.target.value }))} className="h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">Carga (kg)</label>
                    <Input type="number" value={novoEx.carga_kg} onChange={e => setNovoEx(p => ({ ...p, carga_kg: +e.target.value }))} className="h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">Desc (s)</label>
                    <Input type="number" value={novoEx.descanso_segundos} onChange={e => setNovoEx(p => ({ ...p, descanso_segundos: +e.target.value }))} className="h-8 text-sm" />
                  </div>
                </div>
                <Textarea placeholder="Orientações para o aluno..." value={novoEx.orientacoes} onChange={e => setNovoEx(p => ({ ...p, orientacoes: e.target.value }))} className="text-sm min-h-[60px]" />
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" className="h-7" onClick={() => setShowAddEx(false)}>Cancelar</Button>
                  <Button size="sm" className="h-7 bg-gradient-studio text-white" onClick={handleAddEx} disabled={adicionarExercicio.isPending}>
                    <Save className="h-3 w-3 mr-1" /> Salvar
                  </Button>
                </div>
              </div>
            )}

            {/* Publish button */}
            <div className="flex gap-2 justify-end pt-2 border-t">
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                onClick={() => onUpdate({ publicado: !treino.publicado })}>
                {treino.publicado ? <><X className="h-3 w-3" /> Despublicar</> : <><Send className="h-3 w-3" /> Publicar para Aluno</>}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
