import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';

interface Props { diretriz: any; area: string; pacienteId: string; onClose: () => void; }

// Editor ESTRUTURADO do plano por fase. O profissional edita título/foco/duração,
// condutas concretas, exames a solicitar, orientações ao paciente, metas e
// marcadores — não só as orientações. O que salvar vale para o plano do cliente.

// Editor genérico de uma lista de strings (condutas / exames / orientações).
function ListaStr({ titulo, itens, placeholder, onSet, onAdd, onRemove }: {
  titulo: string;
  itens: string[];
  placeholder: string;
  onSet: (idx: number, v: string) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</p>
      {itens.map((v, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Input className="h-8 text-sm flex-1" placeholder={placeholder} value={v || ''} onChange={(e) => onSet(i, e.target.value)} />
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" title="Remover" aria-label="Remover" onClick={() => onRemove(i)}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      ))}
      <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 w-full" onClick={onAdd}>
        <Plus className="h-3 w-3" /> Acrescentar
      </Button>
    </div>
  );
}

export default function DiretrizTecnicasEditor({ diretriz, area, pacienteId, onClose }: Props) {
  const qc = useQueryClient();
  const [conteudo, setConteudo] = useState<any>(() => JSON.parse(JSON.stringify(diretriz.conteudo || {})));
  const fases: any[] = Array.isArray(conteudo.fases) ? conteudo.fases : [];

  const atualizar = (mut: (d: any) => void) =>
    setConteudo((prev: any) => { const d = JSON.parse(JSON.stringify(prev)); mut(d); return d; });

  const setCampoFase = (fi: number, campo: string, valor: any) => atualizar((d) => { d.fases[fi][campo] = valor; });
  // Listas de string (condutas | exames_solicitar | orientacoes)
  const setStr = (fi: number, campo: string, idx: number, valor: string) => atualizar((d) => { d.fases[fi][campo][idx] = valor; });
  const addStr = (fi: number, campo: string) => atualizar((d) => { (d.fases[fi][campo] ||= []).push(''); });
  const rmStr = (fi: number, campo: string, idx: number) => atualizar((d) => { d.fases[fi][campo].splice(idx, 1); });
  // Metas [{descricao, como_medir}]
  const setMeta = (fi: number, idx: number, k: string, v: string) => atualizar((d) => { d.fases[fi].metas[idx][k] = v; });
  const addMeta = (fi: number) => atualizar((d) => { (d.fases[fi].metas ||= []).push({ descricao: '', como_medir: '' }); });
  const rmMeta = (fi: number, idx: number) => atualizar((d) => { d.fases[fi].metas.splice(idx, 1); });
  // Marcadores [{nome, atual, alvo}]
  const setMarc = (fi: number, idx: number, k: string, v: string) => atualizar((d) => { d.fases[fi].marcadores[idx][k] = v; });
  const addMarc = (fi: number) => atualizar((d) => { (d.fases[fi].marcadores ||= []).push({ nome: '', atual: '', alvo: '' }); });
  const rmMarc = (fi: number, idx: number) => atualizar((d) => { d.fases[fi].marcadores.splice(idx, 1); });

  const salvar = useMutation({
    mutationFn: async () => {
      // Limpa entradas vazias antes de salvar.
      const limpo = JSON.parse(JSON.stringify(conteudo));
      (limpo.fases || []).forEach((f: any) => {
        ['condutas', 'exames_solicitar', 'orientacoes'].forEach((campo) => {
          if (Array.isArray(f[campo])) f[campo] = f[campo].filter((o: string) => o && o.trim());
        });
        if (Array.isArray(f.metas)) f.metas = f.metas.filter((m: any) => m?.descricao && m.descricao.trim());
        if (Array.isArray(f.marcadores)) f.marcadores = f.marcadores.filter((m: any) => m?.nome && m.nome.trim());
      });
      const { error } = await (supabase as any).from('diretrizes_profissionais')
        .update({ conteudo: limpo }).eq('id', diretriz.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Plano atualizado');
      qc.invalidateQueries({ queryKey: ['diretriz-prof', area, pacienteId] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar'),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-base">Editar o plano de tratamento</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-[11px] text-muted-foreground">
            Ajuste as fases: condutas, exames, orientações, metas e marcadores. O que você salvar vale para o plano do cliente.
          </p>

          {fases.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Este plano não tem fases para editar.</p>
          )}

          {fases.map((f: any, fi: number) => (
            <div key={fi} className="rounded-lg border border-border/40 p-3 space-y-3">
              {/* Cabeçalho da fase: título, foco, duração */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground">Fase {f.numero ?? fi + 1}</p>
                <Input className="h-8 text-sm font-medium" placeholder="Título da fase" value={f.titulo || ''}
                  onChange={(e) => setCampoFase(fi, 'titulo', e.target.value)} />
                <div className="flex gap-1.5">
                  <Input className="h-8 text-sm flex-1" placeholder="Foco (ex.: controle da dor)" value={f.foco || ''}
                    onChange={(e) => setCampoFase(fi, 'foco', e.target.value)} />
                  <Input type="number" min={1} className="h-8 text-sm w-24" placeholder="semanas"
                    value={f.duracao_semanas ?? ''} onChange={(e) => setCampoFase(fi, 'duracao_semanas', Number(e.target.value) || 0)} />
                </div>
              </div>

              <ListaStr titulo="Condutas (o que fazer/prescrever)" itens={f.condutas || []} placeholder="Conduta concreta"
                onSet={(i, v) => setStr(fi, 'condutas', i, v)} onAdd={() => addStr(fi, 'condutas')} onRemove={(i) => rmStr(fi, 'condutas', i)} />

              <ListaStr titulo="Exames a solicitar" itens={f.exames_solicitar || []} placeholder="Exame ou avaliação"
                onSet={(i, v) => setStr(fi, 'exames_solicitar', i, v)} onAdd={() => addStr(fi, 'exames_solicitar')} onRemove={(i) => rmStr(fi, 'exames_solicitar', i)} />

              <ListaStr titulo="Orientações ao paciente" itens={f.orientacoes || []} placeholder="Orientação"
                onSet={(i, v) => setStr(fi, 'orientacoes', i, v)} onAdd={() => addStr(fi, 'orientacoes')} onRemove={(i) => rmStr(fi, 'orientacoes', i)} />

              {/* Metas */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Metas</p>
                {(f.metas || []).map((m: any, i: number) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Input className="h-8 text-sm flex-1" placeholder="Meta" value={m?.descricao || ''} onChange={(e) => setMeta(fi, i, 'descricao', e.target.value)} />
                    <Input className="h-8 text-sm flex-1" placeholder="Como medir" value={m?.como_medir || ''} onChange={(e) => setMeta(fi, i, 'como_medir', e.target.value)} />
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" title="Remover" aria-label="Remover meta" onClick={() => rmMeta(fi, i)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 w-full" onClick={() => addMeta(fi)}>
                  <Plus className="h-3 w-3" /> Acrescentar meta
                </Button>
              </div>

              {/* Marcadores */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Marcadores</p>
                {(f.marcadores || []).map((m: any, i: number) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Input className="h-8 text-sm flex-1" placeholder="Marcador" value={m?.nome || ''} onChange={(e) => setMarc(fi, i, 'nome', e.target.value)} />
                    <Input className="h-8 text-sm w-20" placeholder="Atual" value={m?.atual || ''} onChange={(e) => setMarc(fi, i, 'atual', e.target.value)} />
                    <Input className="h-8 text-sm w-20" placeholder="Alvo" value={m?.alvo || ''} onChange={(e) => setMarc(fi, i, 'alvo', e.target.value)} />
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" title="Remover" aria-label="Remover marcador" onClick={() => rmMarc(fi, i)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 w-full" onClick={() => addMarc(fi)}>
                  <Plus className="h-3 w-3" /> Acrescentar marcador
                </Button>
              </div>
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
