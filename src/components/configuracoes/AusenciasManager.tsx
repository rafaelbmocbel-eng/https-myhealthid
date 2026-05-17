import { useState } from 'react';
import { useAusencias, Ausencia } from '@/hooks/useAusencias';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CalendarOff, Plus, Trash2, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatRange = (a: Ausencia) => {
  const ini = format(parseISO(a.data_inicio), "dd 'de' MMM", { locale: ptBR });
  const fim = format(parseISO(a.data_fim), "dd 'de' MMM yyyy", { locale: ptBR });
  if (a.data_inicio === a.data_fim) return format(parseISO(a.data_inicio), "dd 'de' MMM yyyy", { locale: ptBR });
  return `${ini} → ${fim}`;
};

export default function AusenciasManager() {
  const { ausencias, loading, create, remove } = useAusencias();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    data_inicio: '',
    data_fim: '',
    motivo: '',
    dia_inteiro: true,
    hora_inicio: '08:00',
    hora_fim: '18:00',
  });

  const reset = () => setForm({ data_inicio: '', data_fim: '', motivo: '', dia_inteiro: true, hora_inicio: '08:00', hora_fim: '18:00' });

  const handleSave = async () => {
    if (!form.data_inicio) return;
    await create.mutateAsync({
      data_inicio: form.data_inicio,
      data_fim: form.data_fim || form.data_inicio,
      motivo: form.motivo || null,
      dia_inteiro: form.dia_inteiro,
      hora_inicio: form.dia_inteiro ? null : form.hora_inicio,
      hora_fim: form.dia_inteiro ? null : form.hora_fim,
    });
    reset();
    setOpen(false);
  };

  return (
    <div className="clinical-card mb-4 sm:mb-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <CalendarOff className="icon-sm text-primary shrink-0" />
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Ausências e Feriados</h2>
        </div>
        <Button size="sm" variant="outline" className="gap-1 h-8" onClick={() => setOpen(true)}>
          <Plus className="icon-xs" /> Nova
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Datas bloqueadas na sua agenda (férias, feriados, congressos). Aparece também no link público de agendamento.
      </p>

      {loading ? (
        <div className="h-16 flex items-center justify-center"><Loader2 className="icon-md animate-spin text-primary" /></div>
      ) : ausencias.length === 0 ? (
        <div className="text-center py-6 text-xs text-muted-foreground border border-dashed rounded-xl">
          Nenhuma ausência registrada.
        </div>
      ) : (
        <div className="space-y-2">
          {ausencias.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-muted/30 border border-border/40">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{a.motivo || 'Indisponível'}</p>
                <p className="text-xs text-muted-foreground">
                  {formatRange(a)}
                  {!a.dia_inteiro && a.hora_inicio && ` · ${a.hora_inicio.slice(0,5)}–${a.hora_fim?.slice(0,5)}`}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => remove.mutate(a.id)}
              >
                <Trash2 className="icon-sm" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova ausência</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block">Data inicial</Label>
                <Input type="date" value={form.data_inicio} onChange={(e) => setForm(f => ({ ...f, data_inicio: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Data final</Label>
                <Input type="date" value={form.data_fim} onChange={(e) => setForm(f => ({ ...f, data_fim: e.target.value }))} min={form.data_inicio} />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Motivo (opcional)</Label>
              <Input value={form.motivo} onChange={(e) => setForm(f => ({ ...f, motivo: e.target.value }))} placeholder="Ex: Férias, Congresso, Feriado" />
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
              <Label className="text-sm">Dia inteiro</Label>
              <Switch checked={form.dia_inteiro} onCheckedChange={(v) => setForm(f => ({ ...f, dia_inteiro: v }))} />
            </div>
            {!form.dia_inteiro && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1.5 block">De</Label>
                  <Input type="time" value={form.hora_inicio} onChange={(e) => setForm(f => ({ ...f, hora_inicio: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Até</Label>
                  <Input type="time" value={form.hora_fim} onChange={(e) => setForm(f => ({ ...f, hora_fim: e.target.value }))} />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.data_inicio || create.isPending}>
              {create.isPending && <Loader2 className="icon-sm animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
