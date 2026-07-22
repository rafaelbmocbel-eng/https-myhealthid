import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';

interface Props { diretriz: any; area: string; pacienteId: string; onClose: () => void; }

// Editor das TÉCNICAS/orientações da diretriz (por fase). O profissional muda,
// acrescenta ou remove técnica em cada fase e salva na própria diretriz.
export default function DiretrizTecnicasEditor({ diretriz, area, pacienteId, onClose }: Props) {
  const qc = useQueryClient();
  const [conteudo, setConteudo] = useState<any>(() => JSON.parse(JSON.stringify(diretriz.conteudo || {})));
  const fases: any[] = Array.isArray(conteudo.fases) ? conteudo.fases : [];

  const atualizar = (mut: (d: any) => void) =>
    setConteudo((prev: any) => { const d = JSON.parse(JSON.stringify(prev)); mut(d); return d; });
  const setTec = (fi: number, ti: number, valor: string) =>
    atualizar((d) => { d.fases[fi].orientacoes[ti] = valor; });
  const addTec = (fi: number) =>
    atualizar((d) => { (d.fases[fi].orientacoes ||= []).push(''); });
  const removerTec = (fi: number, ti: number) =>
    atualizar((d) => { d.fases[fi].orientacoes.splice(ti, 1); });

  const salvar = useMutation({
    mutationFn: async () => {
      // Limpa técnicas vazias antes de salvar.
      const limpo = JSON.parse(JSON.stringify(conteudo));
      (limpo.fases || []).forEach((f: any) => {
        if (Array.isArray(f.orientacoes)) f.orientacoes = f.orientacoes.filter((o: string) => o && o.trim());
      });
      const { error } = await (supabase as any).from('diretrizes_profissionais')
        .update({ conteudo: limpo }).eq('id', diretriz.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Diretriz atualizada');
      qc.invalidateQueries({ queryKey: ['diretriz-prof', area, pacienteId] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar'),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-base">Editar técnicas da diretriz</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-[11px] text-muted-foreground">
            Ajuste, acrescente ou remova as técnicas/orientações de cada fase. O que você salvar vale para o plano do cliente.
          </p>

          {fases.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Esta diretriz não tem fases para editar.</p>
          )}

          {fases.map((f: any, fi: number) => (
            <div key={fi} className="rounded-lg border border-border/40 p-3 space-y-2">
              <p className="font-semibold text-sm">
                Fase {f.numero ?? fi + 1} — {f.titulo || ''}
                {f.foco ? <span className="text-muted-foreground font-normal"> · {f.foco}</span> : null}
              </p>
              {(f.orientacoes || []).map((o: string, ti: number) => (
                <div key={ti} className="flex items-center gap-1.5">
                  <Input className="h-8 text-sm flex-1" placeholder="Técnica / orientação" value={o || ''}
                    onChange={(e) => setTec(fi, ti, e.target.value)} />
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" title="Remover" onClick={() => removerTec(fi, ti)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 w-full" onClick={() => addTec(fi)}>
                <Plus className="h-3 w-3" /> Acrescentar técnica
              </Button>
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
    </Dialog>
  );
}
