import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Trash2, Save, Repeat } from 'lucide-react';
import { toast } from 'sonner';
import SeletorExercicios, { type ExercicioEscolhido } from './SeletorExercicios';

interface Props {
  plano: any;          // linha de planos_treino (id, titulo, estrutura, ...)
  pacienteId: string;
  onClose: () => void;
}

// Editor do plano de treino gerado pela IA — o profissional ajusta antes/depois
// de liberar (séries, reps, carga, descanso, observações; adiciona/remove
// exercícios; renomeia sessões). Salva de volta em planos_treino.estrutura.
export default function PlanoTreinoEditor({ plano, pacienteId, onClose }: Props) {
  const qc = useQueryClient();
  const [titulo, setTitulo] = useState<string>(plano.titulo || '');
  // deep clone para editar sem mexer no original até salvar
  const [est, setEst] = useState<any>(() => JSON.parse(JSON.stringify(plano.estrutura || {})));
  // Seletor da biblioteca. Sem `ei` = adicionar; com `ei` = TROCAR aquele exercício.
  const [seletor, setSeletor] = useState<{ fi: number; si: number; ei?: number } | null>(null);

  const fases: any[] = Array.isArray(est.fases) ? est.fases : [];

  const atualizar = (mut: (draft: any) => void) => {
    setEst((prev: any) => { const d = JSON.parse(JSON.stringify(prev)); mut(d); return d; });
  };
  const setExField = (fi: number, si: number, ei: number, campo: string, valor: any) =>
    atualizar((d) => { d.fases[fi].sessoes[si].exercicios[ei][campo] = valor; });
  const removerEx = (fi: number, si: number, ei: number) =>
    atualizar((d) => { d.fases[fi].sessoes[si].exercicios.splice(ei, 1); });
  const addExDaBiblioteca = (fi: number, si: number, ex: ExercicioEscolhido) =>
    atualizar((d) => {
      (d.fases[fi].sessoes[si].exercicios ||= []).push({
        id: ex.id,
        nome: ex.nome || '',
        gif_url: ex.gif_url || undefined,
        orientacoes: ex.orientacoes || undefined,
        series: ex.series ?? 3,
        reps: ex.reps ?? '12',
        carga: '',
        descanso_s: ex.descanso_s ?? 45,
        obs: '',
      });
    });
  // Troca o exercício por outro da biblioteca, mantendo a programação que o
  // profissional já definiu (séries, reps, carga, descanso, observação).
  const trocarExDaBiblioteca = (fi: number, si: number, ei: number, ex: ExercicioEscolhido) =>
    atualizar((d) => {
      const cur = d.fases[fi].sessoes[si].exercicios[ei] || {};
      d.fases[fi].sessoes[si].exercicios[ei] = {
        ...cur,
        id: ex.id,
        nome: ex.nome || '',
        gif_url: ex.gif_url || undefined,
        orientacoes: ex.orientacoes || undefined,
      };
    });
  const setSessaoNome = (fi: number, si: number, valor: string) =>
    atualizar((d) => { d.fases[fi].sessoes[si].nome = valor; });

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from('planos_treino')
        .update({ titulo: titulo || 'Plano de treino', estrutura: est }).eq('id', plano.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Plano atualizado');
      qc.invalidateQueries({ queryKey: ['planos-treino', pacienteId] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar'),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-base">Editar plano de treino</DialogTitle></DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Título</label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Resumo / estratégia</label>
            <Textarea rows={2} value={est.resumo || ''} onChange={(e) => atualizar((d) => { d.resumo = e.target.value; })} />
          </div>

          {fases.map((fase: any, fi: number) => (
            <div key={fi} className="rounded-lg border border-border/40 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">{fase.nome || `Fase ${fi + 1}`}</span>
                <span className="text-[10px] text-muted-foreground">{fase.semanas} sem</span>
              </div>

              {(fase.sessoes || []).map((s: any, si: number) => (
                <div key={si} className="rounded-md bg-muted/20 p-2.5 space-y-2">
                  <Input className="h-8 text-sm font-medium" value={s.nome || ''} placeholder="Nome do treino"
                    onChange={(e) => setSessaoNome(fi, si, e.target.value)} />

                  {(s.exercicios || []).map((ex: any, ei: number) => (
                    <div key={ei} className="rounded-md border border-border/30 p-2 space-y-1.5 bg-background">
                      <div className="flex items-center gap-1.5">
                        <Input className="h-8 text-sm flex-1" placeholder="Exercício" value={ex.nome || ''}
                          onChange={(e) => setExField(fi, si, ei, 'nome', e.target.value)} />
                        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" title="Trocar exercício (buscar na biblioteca)" onClick={() => setSeletor({ fi, si, ei })}>
                          <Repeat className="h-3.5 w-3.5 text-primary" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => removerEx(fi, si, ei)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        <Input className="h-8 text-xs" placeholder="Séries" value={ex.series ?? ''}
                          onChange={(e) => setExField(fi, si, ei, 'series', e.target.value)} />
                        <Input className="h-8 text-xs" placeholder="Reps" value={ex.reps ?? ''}
                          onChange={(e) => setExField(fi, si, ei, 'reps', e.target.value)} />
                        <Input className="h-8 text-xs" placeholder="Carga" value={ex.carga ?? ''}
                          onChange={(e) => setExField(fi, si, ei, 'carga', e.target.value)} />
                        <Input className="h-8 text-xs" placeholder="Desc. (s)" value={ex.descanso_s ?? ''}
                          onChange={(e) => setExField(fi, si, ei, 'descanso_s', Number(e.target.value) || e.target.value)} />
                      </div>
                      <Input className="h-8 text-xs" placeholder="Observação (execução, cuidado…)" value={ex.obs ?? ''}
                        onChange={(e) => setExField(fi, si, ei, 'obs', e.target.value)} />
                    </div>
                  ))}

                  <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 w-full" onClick={() => setSeletor({ fi, si })}>
                    <Plus className="h-3 w-3" /> Adicionar exercício (da biblioteca, por categoria)
                  </Button>
                </div>
              ))}
            </div>
          ))}

          <div className="flex gap-2 sticky bottom-0 bg-background pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1 gap-1.5" disabled={salvar.isPending} onClick={() => salvar.mutate()}>
              {salvar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar alterações
            </Button>
          </div>
        </div>
      </DialogContent>

      <SeletorExercicios
        open={!!seletor}
        onOpenChange={(o) => { if (!o) setSeletor(null); }}
        onPick={(ex) => {
          if (!seletor) return;
          if (seletor.ei != null) trocarExDaBiblioteca(seletor.fi, seletor.si, seletor.ei, ex);
          else addExDaBiblioteca(seletor.fi, seletor.si, ex);
        }}
      />
    </Dialog>
  );
}
