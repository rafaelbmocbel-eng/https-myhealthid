import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DoorOpen, CheckCircle2, Clock, Loader2, User } from 'lucide-react';
import { useSalaEspera } from '@/hooks/useListaEspera';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function SalaEsperaVirtual() {
  const { aguardando, semCheckIn, isLoading, checkIn, desfazerCheckIn } = useSalaEspera();
  const total = aguardando.length + semCheckIn.length;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs relative">
          <DoorOpen className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sala de espera</span>
          {aguardando.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 h-4 min-w-[16px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center">
              {aguardando.length}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-4 pt-4 pb-2 border-b">
          <SheetTitle className="flex items-center gap-2">
            <DoorOpen className="h-4 w-4 text-emerald-500" />
            Sala de espera — hoje
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}

          {!isLoading && total === 0 && (
            <div className="text-center py-12">
              <DoorOpen className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum paciente agendado para hoje</p>
            </div>
          )}

          {aguardando.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  Na clínica ({aguardando.length})
                </span>
              </div>
              <div className="space-y-2">
                {aguardando.map((ag: any) => (
                  <PacienteCard
                    key={ag.id}
                    ag={ag}
                    checkedIn
                    onCheckIn={() => desfazerCheckIn.mutate(ag.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {semCheckIn.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground">
                  Aguardando chegada ({semCheckIn.length})
                </span>
              </div>
              <div className="space-y-2">
                {semCheckIn.map((ag: any) => (
                  <PacienteCard
                    key={ag.id}
                    ag={ag}
                    checkedIn={false}
                    onCheckIn={() => checkIn.mutate(ag.id)}
                  />
                ))}
              </div>
            </section>
          )}

          <div className="rounded-xl bg-muted/40 p-3 mt-2">
            <p className="text-[11px] text-muted-foreground">
              <strong>Dica:</strong> O paciente pode fazer check-in automaticamente enviando <strong>"CHEGUEI"</strong> pelo WhatsApp.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PacienteCard({ ag, checkedIn, onCheckIn }: { ag: any; checkedIn: boolean; onCheckIn: () => void }) {
  const nome = ag.pacientes ? `${ag.pacientes.nome} ${ag.pacientes.sobrenome}` : (ag.titulo || 'Paciente');
  const hora = format(parseISO(ag.data_inicio), 'HH:mm');
  const horaFim = format(parseISO(ag.data_fim), 'HH:mm');

  return (
    <div className={cn(
      'rounded-xl border p-3 flex items-center gap-3 transition-colors',
      checkedIn ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-border/60 bg-card',
    )}>
      <div className={cn(
        'h-9 w-9 rounded-full flex items-center justify-center shrink-0',
        checkedIn ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-muted',
      )}>
        {checkedIn
          ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          : <User className="h-4 w-4 text-muted-foreground" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">{nome}</div>
        <div className="text-[11px] text-muted-foreground">
          {hora}–{horaFim}
          {checkedIn && ag.checked_in_em && (
            <span className="text-emerald-600 ml-2">
              · chegou às {format(new Date(ag.checked_in_em), 'HH:mm')}
            </span>
          )}
        </div>
      </div>
      <Button
        size="sm"
        variant={checkedIn ? 'ghost' : 'outline'}
        className={cn('h-7 px-2 text-[11px] shrink-0', checkedIn ? 'text-muted-foreground' : 'border-emerald-400 text-emerald-700 hover:bg-emerald-50')}
        onClick={onCheckIn}
      >
        {checkedIn ? 'Desfazer' : 'Check-in'}
      </Button>
    </div>
  );
}
