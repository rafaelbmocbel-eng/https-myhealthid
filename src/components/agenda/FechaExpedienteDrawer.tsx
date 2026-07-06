import { useState, useMemo } from 'react';
import { format, parseISO, isToday, isBefore, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CheckCircle2, X, UserPlus, Clock, ClipboardCheck,
  AlertCircle, ChevronRight, Loader2, RotateCcw,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { PacienteSelect } from '@/components/paciente/PacienteSelect';
import { cn } from '@/lib/utils';
import type { Agendamento, Paciente } from '@/hooks/useAgenda';

interface Props {
  open: boolean;
  onClose: () => void;
  agendamentos: Agendamento[];
  pacientes: Paciente[];
  duracaoPadrao: number;
  onSessaoStatus: (ag: Agendamento, status: 'atendido' | 'faltou' | 'pendente') => Promise<void>;
  onAddWalkIn: (pacienteId: string, horario: string, tipo: string) => Promise<void>;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  concluido: { label: 'Atendido', cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400' },
  faltou:    { label: 'Faltou',   cls: 'bg-orange-500/10 text-orange-700 border-orange-500/20 dark:text-orange-400' },
  cancelado: { label: 'Cancelado', cls: 'bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-400' },
  confirmado: { label: 'Pendente', cls: 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400' },
  pendente:   { label: 'Pendente', cls: 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400' },
  bloqueado:  { label: 'Bloqueado', cls: 'bg-slate-500/10 text-slate-600 border-slate-500/20' },
};

const TIPOS = [
  { value: 'retorno', label: 'Retorno' },
  { value: 'avaliacao', label: 'Avaliação' },
  { value: 'outro', label: 'Outro' },
];

export default function FechaExpedienteDrawer({
  open, onClose, agendamentos, pacientes, duracaoPadrao, onSessaoStatus, onAddWalkIn,
}: Props) {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [walkInId, setWalkInId] = useState('');
  const [walkInHorario, setWalkInHorario] = useState(() => format(new Date(), 'HH:mm'));
  const [walkInTipo, setWalkInTipo] = useState('retorno');
  const [addingWalkIn, setAddingWalkIn] = useState(false);

  const hoje = useMemo(() => {
    const now = new Date();
    return agendamentos
      .filter(ag => ag.paciente_id && isToday(parseISO(ag.data_inicio)) && ag.status !== 'bloqueado')
      .sort((a, b) => parseISO(a.data_inicio).getTime() - parseISO(b.data_inicio).getTime());
  }, [agendamentos]);

  const passados = useMemo(() => hoje.filter(ag => isBefore(parseISO(ag.data_fim), new Date())), [hoje]);
  const futuros  = useMemo(() => hoje.filter(ag => !isBefore(parseISO(ag.data_fim), new Date())), [hoje]);

  const atendidos  = passados.filter(ag => ag.status === 'concluido').length;
  const faltaram   = passados.filter(ag => ag.status === 'faltou').length;
  const cancelados = passados.filter(ag => ag.status === 'cancelado').length;
  const pendentes  = passados.filter(ag => ag.status === 'confirmado' || ag.status === 'pendente').length;
  const total      = passados.length;
  const pct        = total > 0 ? Math.round(((atendidos + faltaram + cancelados) / total) * 100) : 100;

  const wrap = async (id: string, fn: () => Promise<void>) => {
    setLoading(p => ({ ...p, [id]: true }));
    try { await fn(); } finally { setLoading(p => ({ ...p, [id]: false })); }
  };

  const nomePaciente = (ag: Agendamento) => {
    const p = pacientes.find(x => x.id === ag.paciente_id);
    return p ? `${p.nome} ${p.sobrenome}` : ag.titulo || 'Paciente';
  };

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0 gap-0">
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <ClipboardCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <SheetTitle className="text-base">Fechar expediente</SheetTitle>
              <p className="text-xs text-muted-foreground capitalize">
                {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
              </p>
            </div>
          </div>

          {/* Resumo do dia */}
          <div className="grid grid-cols-4 gap-2 mt-3">
            {[
              { n: atendidos,  label: 'Atendidos', cls: 'text-emerald-600' },
              { n: faltaram,   label: 'Faltaram',  cls: 'text-orange-600' },
              { n: cancelados, label: 'Cancelados', cls: 'text-red-600' },
              { n: pendentes,  label: 'Pendentes', cls: 'text-amber-600' },
            ].map(({ n, label, cls }) => (
              <div key={label} className="rounded-xl border bg-card p-2 text-center">
                <p className={cn('text-xl font-black', cls)}>{n}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
              </div>
            ))}
          </div>

          {/* Barra de progresso */}
          {total > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span>{pct}% confirmados</span>
                <span>{total} no total</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', pct === 100 ? 'bg-emerald-500' : 'bg-primary')}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}
        </SheetHeader>

        {/* Lista de atendimentos */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">

          {/* Atendimentos passados */}
          {passados.length > 0 && (
            <section>
              <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-2">
                Atendimentos realizados hoje
              </p>
              <div className="space-y-2">
                {passados.map(ag => {
                  const isPendente = ag.status === 'confirmado' || ag.status === 'pendente';
                  const st = STATUS_LABEL[ag.status] || STATUS_LABEL.confirmado;
                  const dur = differenceInMinutes(parseISO(ag.data_fim), parseISO(ag.data_inicio));

                  return (
                    <div
                      key={ag.id}
                      className={cn(
                        'rounded-xl border p-3 transition-colors',
                        isPendente
                          ? 'border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/20'
                          : 'border-border bg-card',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{nomePaciente(ag)}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(parseISO(ag.data_inicio), 'HH:mm')} – {format(parseISO(ag.data_fim), 'HH:mm')}
                              <span className="text-muted-foreground/60">· {dur} min</span>
                            </span>
                          </div>
                          {ag.tipo_atendimento && (
                            <p className="text-[10px] text-muted-foreground/70 mt-0.5 capitalize">{ag.tipo_atendimento}</p>
                          )}
                        </div>
                        <Badge variant="outline" className={cn('text-[10px] shrink-0', st.cls)}>
                          {st.label}
                        </Badge>
                      </div>

                      {isPendente ? (
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-8 text-xs border-orange-300 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                            disabled={loading[ag.id]}
                            onClick={() => wrap(ag.id, () => onSessaoStatus(ag, 'faltou'))}
                          >
                            {loading[ag.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3 mr-1" />}
                            Faltou
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                            disabled={loading[ag.id]}
                            onClick={() => wrap(ag.id, () => onSessaoStatus(ag, 'atendido'))}
                          >
                            {loading[ag.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                            Atendido
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[11px] text-muted-foreground gap-1 px-2"
                          disabled={loading[ag.id]}
                          onClick={() => wrap(ag.id, () => onSessaoStatus(ag, 'pendente'))}
                        >
                          {loading[ag.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                          Desfazer
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Próximos do dia (ainda não aconteceram) */}
          {futuros.length > 0 && (
            <section>
              <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-2">
                Ainda não realizados hoje
              </p>
              <div className="space-y-1.5">
                {futuros.map(ag => {
                  const st = STATUS_LABEL[ag.status] || STATUS_LABEL.confirmado;
                  return (
                    <div key={ag.id} className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-foreground truncate">{nomePaciente(ag)}</p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(parseISO(ag.data_inicio), 'HH:mm')} – {format(parseISO(ag.data_fim), 'HH:mm')}
                        </p>
                      </div>
                      <Badge variant="outline" className={cn('text-[10px] shrink-0', st.cls)}>
                        {st.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {hoje.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <ClipboardCheck className="h-10 w-10 mb-3 opacity-30" />
              <p className="font-medium">Nenhum atendimento hoje</p>
            </div>
          )}

          {/* Adicionar paciente sem agendamento */}
          <section>
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-2">
              Atendimento avulso / encaixe
            </p>
            {!showWalkIn ? (
              <button
                onClick={() => setShowWalkIn(true)}
                className="w-full rounded-xl border border-dashed border-border/60 bg-card/50 hover:bg-card hover:border-primary/40 transition-colors py-3 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary"
              >
                <UserPlus className="h-4 w-4" />
                Registrar paciente que veio sem agendamento
                <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-50" />
              </button>
            ) : (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Novo atendimento avulso</p>
                  <button onClick={() => { setShowWalkIn(false); setWalkInId(''); }} className="p-1 rounded hover:bg-accent">
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Paciente</label>
                    <PacienteSelect
                      pacientes={pacientes}
                      value={walkInId}
                      onValueChange={setWalkInId}
                      placeholder="Selecionar paciente..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Horário de início</label>
                      <Input
                        type="time"
                        value={walkInHorario}
                        onChange={e => setWalkInHorario(e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
                      <Select value={walkInTipo} onValueChange={setWalkInTipo}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPOS.map(t => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Button
                  className="w-full h-9 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={!walkInId || addingWalkIn}
                  onClick={async () => {
                    setAddingWalkIn(true);
                    try {
                      await onAddWalkIn(walkInId, walkInHorario, walkInTipo);
                      setWalkInId('');
                      setWalkInHorario(format(new Date(), 'HH:mm'));
                      setWalkInTipo('retorno');
                      setShowWalkIn(false);
                    } finally {
                      setAddingWalkIn(false);
                    }
                  }}
                >
                  {addingWalkIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Registrar atendimento
                </Button>
              </div>
            )}
          </section>

          {pendentes > 0 && (
            <div className="rounded-xl border border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-200">
                <strong>{pendentes} atendimento{pendentes > 1 ? 's' : ''}</strong> ainda sem confirmação. Marque como atendido ou faltou antes de fechar.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-5 py-4 shrink-0 bg-card">
          {pendentes === 0 ? (
            <Button className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white h-10" onClick={onClose}>
              <CheckCircle2 className="h-4 w-4" /> Expediente encerrado ✓
            </Button>
          ) : (
            <Button variant="outline" className="w-full h-10 text-muted-foreground" onClick={onClose}>
              Fechar sem confirmar tudo
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
