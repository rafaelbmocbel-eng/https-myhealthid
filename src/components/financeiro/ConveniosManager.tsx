import { useState } from 'react';
import { useConvenios, type Convenio } from '@/hooks/useConvenios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Archive, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const empty: Partial<Convenio> = { nome: '', valor_padrao: null, prazo_repasse_dias: 30, codigo_tuss: '', observacoes: '' };

export default function ConveniosManager() {
  const { convenios, loading, upsert, remove } = useConvenios();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Convenio>>(empty);

  const startNew = () => { setForm(empty); setOpen(true); };
  const startEdit = (c: Convenio) => { setForm(c); setOpen(true); };

  const save = async () => {
    if (!form.nome?.trim()) return;
    await upsert.mutateAsync({
      ...form,
      nome: form.nome.trim(),
      valor_padrao: form.valor_padrao ? Number(form.valor_padrao) : null,
      prazo_repasse_dias: form.prazo_repasse_dias ? Number(form.prazo_repasse_dias) : 30,
    } as any);
    setOpen(false);
  };

  return (
    <Card className="rounded-xl border-border/40 shadow-xs p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Building2 className="icon-sm text-primary" />
          <h3 className="h-section">Convênios</h3>
        </div>
        <Button size="sm" onClick={startNew}><Plus className="icon-xs mr-1" />Novo</Button>
      </div>

      {loading ? (
        <p className="text-caption">Carregando…</p>
      ) : convenios.length === 0 ? (
        <p className="text-caption">Nenhum convênio cadastrado. Adicione planos como Unimed, Bradesco, SulAmérica…</p>
      ) : (
        <div className="space-y-2">
          {convenios.map((c) => (
            <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-card/50">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{c.nome}</span>
                  {c.codigo_tuss && <Badge variant="outline" className="text-micro">{c.codigo_tuss}</Badge>}
                </div>
                <div className="text-micro text-muted-foreground mt-0.5">
                  {c.valor_padrao != null ? `R$ ${Number(c.valor_padrao).toFixed(2)} / sessão` : 'Sem valor padrão'}
                  {' · '}Repasse em {c.prazo_repasse_dias ?? 30} dias
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => startEdit(c)}><Pencil className="icon-xs" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove.mutate(c.id)}><Archive className="icon-xs" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? 'Editar convênio' : 'Novo convênio'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input value={form.nome ?? ''} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Unimed" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor padrão (R$)</Label>
                <Input type="number" step="0.01" value={form.valor_padrao ?? ''} onChange={(e) => setForm({ ...form, valor_padrao: e.target.value as any })} />
              </div>
              <div>
                <Label>Prazo repasse (dias)</Label>
                <Input type="number" value={form.prazo_repasse_dias ?? 30} onChange={(e) => setForm({ ...form, prazo_repasse_dias: e.target.value as any })} />
              </div>
            </div>
            <div>
              <Label>Código TUSS (opcional)</Label>
              <Input value={form.codigo_tuss ?? ''} onChange={(e) => setForm({ ...form, codigo_tuss: e.target.value })} />
            </div>
            <div>
              <Label>Observações</Label>
              <Input value={form.observacoes ?? ''} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!form.nome?.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
