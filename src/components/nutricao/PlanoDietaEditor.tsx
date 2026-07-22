import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';

interface Props { plano: any; pacienteId: string; onClose: () => void; }

// Editor do plano alimentar: refeição a refeição, item a item (alimento, porção,
// kcal, substituições). Salva no mesmo registro (coluna `plano`). Só o
// profissional edita — é a "página" editável do plano nutricional.
export default function PlanoDietaEditor({ plano, pacienteId, onClose }: Props) {
  const qc = useQueryClient();
  const [titulo, setTitulo] = useState<string>(plano.titulo || '');
  const [dieta, setDieta] = useState<any>(() => JSON.parse(JSON.stringify(plano.plano || {})));
  const refeicoes: any[] = Array.isArray(dieta.refeicoes) ? dieta.refeicoes : [];

  const atualizar = (mut: (d: any) => void) =>
    setDieta((prev: any) => { const d = JSON.parse(JSON.stringify(prev)); mut(d); return d; });
  const setRefField = (ri: number, campo: string, valor: any) =>
    atualizar((d) => { d.refeicoes[ri][campo] = valor; });
  const setItemField = (ri: number, ii: number, campo: string, valor: any) =>
    atualizar((d) => { d.refeicoes[ri].itens[ii][campo] = valor; });
  const addItem = (ri: number) =>
    atualizar((d) => { (d.refeicoes[ri].itens ||= []).push({ alimento: '', porcao: '', kcal: '' }); });
  const removerItem = (ri: number, ii: number) =>
    atualizar((d) => { d.refeicoes[ri].itens.splice(ii, 1); });
  const addRefeicao = () =>
    atualizar((d) => { (d.refeicoes ||= []).push({ nome: 'Nova refeição', horario: '', calorias: '', itens: [] }); });
  const removerRefeicao = (ri: number) =>
    atualizar((d) => { d.refeicoes.splice(ri, 1); });

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from('planos_alimentares')
        .update({ titulo: titulo || 'Plano alimentar', plano: dieta }).eq('id', plano.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Plano alimentar atualizado');
      qc.invalidateQueries({ queryKey: ['planos-alimentares', pacienteId] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar'),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-base">Editar plano alimentar</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Título</label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>

          {refeicoes.map((r: any, ri: number) => (
            <div key={ri} className="rounded-lg border border-border/40 p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <Input className="h-8 text-sm font-medium flex-1" placeholder="Refeição (ex.: Café da manhã)" value={r.nome || ''}
                  onChange={(e) => setRefField(ri, 'nome', e.target.value)} />
                <Input className="h-8 text-xs w-20" placeholder="Horário" value={r.horario || ''}
                  onChange={(e) => setRefField(ri, 'horario', e.target.value)} />
                <Input className="h-8 text-xs w-16" placeholder="kcal" value={r.calorias ?? ''}
                  onChange={(e) => setRefField(ri, 'calorias', e.target.value)} />
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" title="Remover refeição" onClick={() => removerRefeicao(ri)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
              {(r.itens || []).map((it: any, ii: number) => (
                <div key={ii} className="flex items-center gap-1.5 pl-2">
                  <Input className="h-8 text-sm flex-1" placeholder="Alimento" value={it.alimento || ''}
                    onChange={(e) => setItemField(ri, ii, 'alimento', e.target.value)} />
                  <Input className="h-8 text-xs w-24" placeholder="Porção" value={it.porcao || ''}
                    onChange={(e) => setItemField(ri, ii, 'porcao', e.target.value)} />
                  <Input className="h-8 text-xs w-16" placeholder="kcal" value={it.kcal ?? ''}
                    onChange={(e) => setItemField(ri, ii, 'kcal', e.target.value)} />
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" title="Remover alimento" onClick={() => removerItem(ri, ii)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 w-full" onClick={() => addItem(ri)}>
                <Plus className="h-3 w-3" /> Adicionar alimento
              </Button>
              <Input className="h-8 text-xs" placeholder="Substituições (opcional)" value={r.substituicoes || ''}
                onChange={(e) => setRefField(ri, 'substituicoes', e.target.value)} />
            </div>
          ))}

          <Button size="sm" variant="outline" className="w-full gap-1" onClick={addRefeicao}>
            <Plus className="h-3.5 w-3.5" /> Adicionar refeição
          </Button>

          <div className="flex gap-2 sticky bottom-0 bg-background pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1 gap-1.5" disabled={salvar.isPending} onClick={() => salvar.mutate()}>
              {salvar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar alterações
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
