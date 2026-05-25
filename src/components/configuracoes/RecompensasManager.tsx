import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Edit2, Trash2, Gift, Sparkles, Loader2, Check, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useRecompensasCatalogoPro, useResgatesPro, NIVEIS_ORDEM, NIVEL_LABEL, NIVEL_COR,
  RecompensaCatalogo, NivelPaciente, ResgateStatus
} from '@/hooks/useRecompensas';
import { cn } from '@/lib/utils';

interface FormState {
  id?: string;
  titulo: string;
  descricao: string;
  xp_custo: number;
  estoque: string;
  nivel_minimo: NivelPaciente;
  ativa: boolean;
}

const EMPTY: FormState = {
  titulo: '', descricao: '', xp_custo: 100, estoque: '', nivel_minimo: 'bronze', ativa: true,
};

export default function RecompensasManager() {
  const { toast } = useToast();
  const { catalogo, isLoading, upsert, remove, saving } = useRecompensasCatalogoPro();
  const { resgates, atualizarStatus } = useResgatesPro();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);

  const openEdit = (r?: RecompensaCatalogo) => {
    if (r) setForm({
      id: r.id, titulo: r.titulo, descricao: r.descricao || '',
      xp_custo: r.xp_custo, estoque: r.estoque?.toString() || '',
      nivel_minimo: r.nivel_minimo, ativa: r.ativa,
    });
    else setForm(EMPTY);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.titulo.trim() || form.xp_custo < 1) {
      toast({ title: 'Preencha título e XP', variant: 'destructive' }); return;
    }
    try {
      await upsert({
        id: form.id, titulo: form.titulo, descricao: form.descricao || null,
        xp_custo: form.xp_custo, estoque: form.estoque ? Number(form.estoque) : null,
        nivel_minimo: form.nivel_minimo, ativa: form.ativa,
      } as any);
      toast({ title: form.id ? 'Atualizado' : 'Recompensa criada' });
      setOpen(false);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Remover esta recompensa?')) return;
    try { await remove(id); toast({ title: 'Removida' }); }
    catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }); }
  };

  const handleStatus = async (id: string, status: ResgateStatus) => {
    try { await atualizarStatus({ id, status }); toast({ title: 'Status atualizado' }); }
    catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }); }
  };

  const pendentes = resgates.filter(r => r.status === 'solicitado' || r.status === 'aprovado');

  return (
    <div className="space-y-6">
      {/* Catálogo */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><Gift className="w-4 h-4" /> Catálogo de recompensas</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Defina prêmios que os pacientes podem trocar por XP</p>
          </div>
          <Button size="sm" onClick={() => openEdit()}><Plus className="w-4 h-4 mr-1" />Nova</Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : catalogo.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma recompensa cadastrada. Comece com algo simples (ex: "Sessão extra de 15min — 200 XP").
          </CardContent></Card>
        ) : (
          <div className="grid gap-2">
            {catalogo.map(r => (
              <Card key={r.id}><CardContent className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{r.titulo}</span>
                    {!r.ativa && <Badge variant="outline" className="text-[10px]">Inativa</Badge>}
                    <Badge variant="outline" className={cn('text-[10px]', NIVEL_COR[r.nivel_minimo])}>
                      {NIVEL_LABEL[r.nivel_minimo]}+
                    </Badge>
                  </div>
                  {r.descricao && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{r.descricao}</p>}
                  <div className="text-[10px] text-muted-foreground mt-1 flex gap-3">
                    <span className="text-primary font-semibold">{r.xp_custo} XP</span>
                    {r.estoque !== null && <span>Estoque: {r.estoque}</span>}
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Edit2 className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => handleRemove(r.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </CardContent></Card>
            ))}
          </div>
        )}
      </section>

      {/* Resgates */}
      <section>
        <h3 className="font-semibold mb-3">Resgates recentes {pendentes.length > 0 && (
          <Badge className="ml-2 bg-amber-100 text-amber-700 border-0">{pendentes.length} pendentes</Badge>
        )}</h3>
        {resgates.length === 0 ? (
          <Card><CardContent className="p-4 text-center text-xs text-muted-foreground">
            Nenhum resgate ainda.
          </CardContent></Card>
        ) : (
          <div className="grid gap-2">
            {resgates.slice(0, 30).map(r => (
              <Card key={r.id}><CardContent className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {r.paciente?.nome} {r.paciente?.sobrenome} · {r.recompensa?.titulo}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(r.resgatado_em).toLocaleString('pt-BR')} · {r.xp_gasto} XP
                  </div>
                </div>
                <Select value={r.status} onValueChange={(v) => handleStatus(r.id, v as ResgateStatus)}>
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solicitado">Solicitado</SelectItem>
                    <SelectItem value="aprovado">Aprovado</SelectItem>
                    <SelectItem value="entregue">Entregue</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent></Card>
            ))}
          </div>
        )}
      </section>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{form.id ? 'Editar' : 'Nova'} recompensa</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })}
                placeholder="Ex: Sessão extra de 15min" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })}
                placeholder="Detalhes opcionais" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Custo (XP) *</Label>
                <Input type="number" min={1} value={form.xp_custo}
                  onChange={e => setForm({ ...form, xp_custo: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Estoque (vazio = ilimitado)</Label>
                <Input type="number" min={0} value={form.estoque}
                  onChange={e => setForm({ ...form, estoque: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Nível mínimo</Label>
              <Select value={form.nivel_minimo} onValueChange={(v) => setForm({ ...form, nivel_minimo: v as NivelPaciente })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NIVEIS_ORDEM.map(n => <SelectItem key={n} value={n}>{NIVEL_LABEL[n]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Ativa</Label>
              <Switch checked={form.ativa} onCheckedChange={(v) => setForm({ ...form, ativa: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
