import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Lock, Loader2 } from 'lucide-react';
import { eachDayOfInterval, parseISO, format, getDay, setHours, setMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const DIAS_SEMANA = [
  { label: 'Dom', value: 0 },
  { label: 'Seg', value: 1 },
  { label: 'Ter', value: 2 },
  { label: 'Qua', value: 3 },
  { label: 'Qui', value: 4 },
  { label: 'Sex', value: 5 },
  { label: 'Sáb', value: 6 },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCriar: (items: { data_inicio: string; data_fim: string; status: string; tipo_atendimento: string; titulo: string }[]) => Promise<void>;
}

export default function BloqueioEmLote({ open, onOpenChange, onCriar }: Props) {
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [horaInicio, setHoraInicio] = useState('08:00');
  const [horaFim, setHoraFim] = useState('18:00');
  const [diasSelecionados, setDiasSelecionados] = useState<number[]>([1, 2, 3, 4, 5]);
  const [motivo, setMotivo] = useState('Férias');
  const [loading, setLoading] = useState(false);

  function toggleDia(v: number) {
    setDiasSelecionados(d => d.includes(v) ? d.filter(x => x !== v) : [...d, v]);
  }

  async function handleCriar() {
    if (!dataInicio || !dataFim || !horaInicio || !horaFim) { toast.error('Preencha todas as datas e horários'); return; }
    if (diasSelecionados.length === 0) { toast.error('Selecione ao menos um dia da semana'); return; }
    if (dataFim < dataInicio) { toast.error('Data fim deve ser após data início'); return; }

    setLoading(true);
    try {
      const dias = eachDayOfInterval({ start: parseISO(dataInicio), end: parseISO(dataFim) });
      const [hIni, mIni] = horaInicio.split(':').map(Number);
      const [hFim, mFim] = horaFim.split(':').map(Number);

      const items = dias
        .filter(d => diasSelecionados.includes(getDay(d)))
        .map(d => {
          const ini = setMinutes(setHours(d, hIni), mIni);
          const fim = setMinutes(setHours(d, hFim), mFim);
          return {
            data_inicio: ini.toISOString(),
            data_fim: fim.toISOString(),
            status: 'bloqueado',
            tipo_atendimento: 'bloqueio',
            titulo: motivo || 'Bloqueado',
          };
        });

      if (items.length === 0) { toast.error('Nenhum dia encontrado com os critérios selecionados'); return; }

      await onCriar(items);
      toast.success(`${items.length} bloqueio${items.length > 1 ? 's' : ''} criado${items.length > 1 ? 's' : ''}`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  const diasCount = (() => {
    if (!dataInicio || !dataFim || dataFim < dataInicio) return 0;
    const dias = eachDayOfInterval({ start: parseISO(dataInicio), end: parseISO(dataFim) });
    return dias.filter(d => diasSelecionados.includes(getDay(d))).length;
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-slate-500" />
            Bloqueio em lote
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Motivo do bloqueio</Label>
            <Input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex: Férias, Feriado, Congresso..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Data início *</Label>
              <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Data fim *</Label>
              <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} min={dataInicio} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Hora início *</Label>
              <Input type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Hora fim *</Label>
              <Input type="time" value={horaFim} onChange={e => setHoraFim(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-xs mb-2 block">Dias da semana</Label>
            <div className="flex gap-1.5 flex-wrap">
              {DIAS_SEMANA.map(d => (
                <label key={d.value} className="flex items-center gap-1.5 cursor-pointer select-none">
                  <Checkbox
                    checked={diasSelecionados.includes(d.value)}
                    onCheckedChange={() => toggleDia(d.value)}
                  />
                  <span className="text-xs">{d.label}</span>
                </label>
              ))}
            </div>
          </div>

          {diasCount > 0 && (
            <div className="rounded-lg bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm text-center">
              <span className="font-semibold text-slate-700 dark:text-slate-300">{diasCount} dia{diasCount > 1 ? 's' : ''}</span>
              <span className="text-muted-foreground"> serão bloqueados de {horaInicio} às {horaFim}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleCriar}
            disabled={loading || diasCount === 0}
            className="gap-1.5"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            Bloquear {diasCount > 0 ? `${diasCount} dia${diasCount > 1 ? 's' : ''}` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
