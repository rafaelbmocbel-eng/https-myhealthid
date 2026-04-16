import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { CalendarDays, Clock, Loader2, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { format, addDays, startOfDay, setHours, setMinutes, isBefore, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Props {
  terapeutaId: string;
  pacienteId: string;
  onAgendado: (data: Date) => void;
  onCancel: () => void;
}

const DAY_KEYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

export default function ChatSlotPicker({ terapeutaId, pacienteId, onAgendado, onCancel }: Props) {
  const [selectedDay, setSelectedDay] = useState(0); // offset from today
  const [confirmingSlot, setConfirmingSlot] = useState<Date | null>(null);
  const [booking, setBooking] = useState(false);
  const { toast } = useToast();

  // Fetch agenda config
  const { data: config } = useQuery({
    queryKey: ['config-agenda-chat', terapeutaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('config_agenda')
        .select('*')
        .eq('terapeuta_id', terapeutaId)
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch existing appointments for the selected day
  const targetDate = addDays(new Date(), selectedDay + 1); // start from tomorrow
  const dayStart = startOfDay(targetDate).toISOString();
  const dayEnd = startOfDay(addDays(targetDate, 1)).toISOString();

  const { data: existingAgs = [], isLoading } = useQuery({
    queryKey: ['agendamentos-chat', terapeutaId, dayStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agendamentos')
        .select('data_inicio, data_fim, status')
        .eq('terapeuta_id', terapeutaId)
        .gte('data_inicio', dayStart)
        .lt('data_inicio', dayEnd)
        .neq('status', 'cancelado');
      if (error) throw error;
      return data || [];
    },
  });

  // Generate available slots
  const generateSlots = (): Date[] => {
    if (!config) return [];

    const diasSemana = config.dias_semana as Record<string, boolean>;
    const dayKey = DAY_KEYS[targetDate.getDay()];
    if (!diasSemana[dayKey]) return [];

    const [startH, startM] = (config.horario_inicio as string).split(':').map(Number);
    const [endH, endM] = (config.horario_fim as string).split(':').map(Number);
    const duration = config.duracao_padrao || 45;
    const interval = config.intervalo_entre_sessoes || 0;
    const step = duration + interval;

    const slots: Date[] = [];
    let current = setMinutes(setHours(targetDate, startH), startM);
    const end = setMinutes(setHours(targetDate, endH), endM);

    while (isBefore(current, end)) {
      const slotEnd = new Date(current.getTime() + duration * 60000);

      // Check if slot overlaps with existing appointments
      const isOccupied = existingAgs.some(ag => {
        const agStart = new Date(ag.data_inicio);
        const agEnd = new Date(ag.data_fim);
        return isBefore(current, agEnd) && isAfter(slotEnd, agStart);
      });

      if (!isOccupied) {
        slots.push(new Date(current));
      }

      current = new Date(current.getTime() + step * 60000);
    }

    return slots;
  };

  const slots = generateSlots();
  const dayLabel = format(targetDate, "EEEE, dd 'de' MMMM", { locale: ptBR });

  const handleConfirm = async () => {
    if (!confirmingSlot || !config) return;
    setBooking(true);

    const duration = config.duracao_padrao || 45;
    const dataFim = new Date(confirmingSlot.getTime() + duration * 60000);

    const { error } = await supabase.from('agendamentos').insert({
      terapeuta_id: terapeutaId,
      paciente_id: pacienteId,
      data_inicio: confirmingSlot.toISOString(),
      data_fim: dataFim.toISOString(),
      status: 'pendente',
      tipo_atendimento: 'retorno',
      titulo: 'Agendamento via Chat',
    });

    setBooking(false);

    if (error) {
      toast({ title: 'Erro ao agendar', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: '✅ Sessão agendada!', description: `${format(confirmingSlot, "dd/MM 'às' HH:mm")}` });
    onAgendado(confirmingSlot);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-3 space-y-3 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <CalendarDays className="h-4 w-4 text-primary" />
        <span>Agendar sessão</span>
        <button onClick={onCancel} className="ml-auto text-xs text-muted-foreground hover:text-foreground">✕</button>
      </div>

      {/* Day navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={selectedDay <= 0}
          onClick={() => setSelectedDay(d => d - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs font-medium capitalize">{dayLabel}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={selectedDay >= 13}
          onClick={() => setSelectedDay(d => d + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Slots */}
      {isLoading || !config ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : slots.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">
          Nenhum horário disponível neste dia. Tente outro dia →
        </p>
      ) : confirmingSlot ? (
        <div className="text-center space-y-2 py-2">
          <p className="text-sm">
            Confirmar <strong>{format(confirmingSlot, "dd/MM 'às' HH:mm")}</strong>?
          </p>
          <div className="flex gap-2 justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmingSlot(null)}
              disabled={booking}
            >
              Voltar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={booking}
            >
              {booking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
              Confirmar
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5 max-h-36 overflow-y-auto">
          {slots.map(slot => (
            <Button
              key={slot.toISOString()}
              variant="outline"
              size="sm"
              className="text-xs h-8"
              onClick={() => setConfirmingSlot(slot)}
            >
              <Clock className="h-3 w-3 mr-1" />
              {format(slot, 'HH:mm')}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
