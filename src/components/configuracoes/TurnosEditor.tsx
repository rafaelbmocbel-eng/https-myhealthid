import { ConfigAgenda, TurnoBloco, TurnosPorDia } from '@/hooks/useAgenda';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Clock, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const DIAS: { key: keyof TurnosPorDia; label: string }[] = [
  { key: 'seg', label: 'Segunda' },
  { key: 'ter', label: 'Terça' },
  { key: 'qua', label: 'Quarta' },
  { key: 'qui', label: 'Quinta' },
  { key: 'sex', label: 'Sexta' },
  { key: 'sab', label: 'Sábado' },
  { key: 'dom', label: 'Domingo' },
];

interface Props {
  form: ConfigAgenda;
  onChange: (next: ConfigAgenda) => void;
}

export default function TurnosEditor({ form, onChange }: Props) {
  const turnos: TurnosPorDia = form.turnos || {};

  const getTurnosDoDia = (dia: keyof TurnosPorDia): TurnoBloco[] => {
    const t = turnos[dia];
    if (t && t.length > 0) return t;
    // Fallback: usa horario único se dia ativo
    if (form.dias_semana[dia as string]) {
      return [{
        inicio: form.horario_inicio?.slice(0, 5) || '08:00',
        fim: form.horario_fim?.slice(0, 5) || '18:00',
      }];
    }
    return [];
  };

  const setTurnosDoDia = (dia: keyof TurnosPorDia, novos: TurnoBloco[]) => {
    const ativo = novos.length > 0;
    onChange({
      ...form,
      turnos: { ...turnos, [dia]: novos },
      dias_semana: { ...form.dias_semana, [dia as string]: ativo },
    });
  };

  const adicionarTurno = (dia: keyof TurnosPorDia) => {
    const atuais = getTurnosDoDia(dia);
    const novo: TurnoBloco = atuais.length === 0
      ? { inicio: '08:00', fim: '12:00' }
      : { inicio: '14:00', fim: '18:00' };
    setTurnosDoDia(dia, [...atuais, novo]);
  };

  const removerTurno = (dia: keyof TurnosPorDia, idx: number) => {
    const atuais = getTurnosDoDia(dia);
    setTurnosDoDia(dia, atuais.filter((_, i) => i !== idx));
  };

  const editarTurno = (dia: keyof TurnosPorDia, idx: number, campo: 'inicio' | 'fim', valor: string) => {
    const atuais = getTurnosDoDia(dia);
    const novos = atuais.map((t, i) => i === idx ? { ...t, [campo]: valor } : t);
    setTurnosDoDia(dia, novos);
  };

  const toggleDia = (dia: keyof TurnosPorDia, ativo: boolean) => {
    if (ativo) {
      setTurnosDoDia(dia, [{ inicio: '08:00', fim: '18:00' }]);
    } else {
      setTurnosDoDia(dia, []);
    }
  };

  return (
    <div className="clinical-card mb-6">
      <div className="flex items-center gap-2 mb-2">
        <Clock className="icon-sm text-primary shrink-0" />
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Horários por Dia</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Defina <strong>vários blocos</strong> por dia (ex: manhã 08–12 e tarde 14–18). Dias sem turnos ficam livres na agenda.
      </p>

      <div className="space-y-3">
        {DIAS.map(({ key, label }) => {
          const blocos = getTurnosDoDia(key);
          const ativo = blocos.length > 0;
          return (
            <div
              key={key}
              className={cn(
                'rounded-xl border p-3 transition-colors',
                ativo ? 'border-primary/30 bg-primary/5' : 'border-dashed border-muted-foreground/20 bg-muted/20',
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Switch checked={ativo} onCheckedChange={(v) => toggleDia(key, v)} />
                  <Label className="text-sm font-medium cursor-pointer">{label}</Label>
                </div>
                {ativo && (
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => adicionarTurno(key)}>
                    <Plus className="icon-xs" /> Turno
                  </Button>
                )}
              </div>

              {ativo && (
                <div className="space-y-2">
                  {blocos.map((bloco, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={bloco.inicio}
                        onChange={(e) => editarTurno(key, idx, 'inicio', e.target.value)}
                        className="h-9 text-sm flex-1"
                      />
                      <span className="text-xs text-muted-foreground">até</span>
                      <Input
                        type="time"
                        value={bloco.fim}
                        onChange={(e) => editarTurno(key, idx, 'fim', e.target.value)}
                        className="h-9 text-sm flex-1"
                      />
                      {blocos.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => removerTurno(key, idx)}
                        >
                          <X className="icon-sm" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
