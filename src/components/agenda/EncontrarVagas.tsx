import { useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarSearch, UserCheck, AlertTriangle, ChevronDown } from 'lucide-react';
import { addDays, addMinutes, format, parseISO, startOfDay } from '@/lib/dateSafe';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Agendamento, ConfigAgenda, Paciente } from '@/hooks/useAgenda';
import type { MembroEquipe } from '@/hooks/useEquipe';

type Periodo = 'hoje' | 'semana' | 'mes';
const DIAS_PERIODO: Record<Periodo, number> = { hoje: 1, semana: 7, mes: 30 };
const CHAVE_DIA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'] as const;

interface Vaga { inicio: Date; restantes: number }

interface Props {
  agendamentos: Agendamento[];
  pacientes: Paciente[];
  config: ConfigAgenda;
  equipe: MembroEquipe[];
  onAgendar: (inicio: Date, membroId?: string) => void;
  onAbrir: (ag: Agendamento) => void;
}

// Horários do dia pelas MESMAS regras da agenda pública: turnos do dia (ou o
// horário corrido), duração padrão + intervalo entre sessões.
function horariosDoDia(dia: Date, config: ConfigAgenda): Date[] {
  const chave = CHAVE_DIA[dia.getDay()];
  const dias = (config.dias_semana || {}) as Record<string, boolean>;
  if (!dias[chave]) return [];
  const duracao = config.duracao_padrao || 45;
  const intervalo = config.intervalo_entre_sessoes || 0;
  const turnos = config.turnos?.[chave];
  const paraMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + (m || 0); };
  const blocos = turnos && turnos.length > 0
    ? turnos.map(t => ({ ini: paraMin(t.inicio || '08:00'), fim: paraMin(t.fim || '18:00') }))
    : [{ ini: paraMin(config.horario_inicio || '08:00'), fim: paraMin(config.horario_fim || '18:00') }];
  const out: Date[] = [];
  for (const b of blocos) {
    for (let m = b.ini; m + duracao <= b.fim; m += duracao + intervalo) {
      const d = new Date(dia);
      d.setHours(Math.floor(m / 60), m % 60, 0, 0);
      out.push(d);
    }
  }
  return out;
}

const nomePaciente = (ag: Agendamento, pacientes: Paciente[]) => {
  if (ag.pacientes) return `${ag.pacientes.nome} ${ag.pacientes.sobrenome || ''}`.trim();
  const p = pacientes.find(x => x.id === ag.paciente_id);
  return p ? `${p.nome} ${p.sobrenome || ''}`.trim() : ag.titulo || 'Paciente';
};

export default function EncontrarVagas({ agendamentos, pacientes, config, equipe, onAgendar, onAbrir }: Props) {
  const [aberto, setAberto] = useState(false);
  const [periodo, setPeriodo] = useState<Periodo>('semana');
  const [membroId, setMembroId] = useState<string>('todos');
  const [diasVisiveis, setDiasVisiveis] = useState(7);

  const equipeAtiva = useMemo(() => equipe.filter(m => m.ativo !== false), [equipe]);

  const dados = useMemo(() => {
    if (!aberto) return null;
    const agora = new Date();
    const hoje = startOfDay(agora);
    const duracao = config.duracao_padrao || 45;
    const capacidade = config.vagas_por_horario || 1;
    const ativos = agendamentos
      .filter(a => a.status !== 'cancelado')
      .map(a => ({ ag: a, ini: parseISO(a.data_inicio).getTime(), fim: parseISO(a.data_fim).getTime() }));

    const vagasPorDia: { dia: Date; vagas: Vaga[] }[] = [];
    const livresPorMembro = new Map<string, number>();
    const totalPorMembro = new Map<string, number>();
    let totalHorarios = 0;

    for (let i = 0; i < DIAS_PERIODO[periodo]; i++) {
      const dia = addDays(hoje, i);
      const vagasDia: Vaga[] = [];
      for (const ini of horariosDoDia(dia, config)) {
        if (ini.getTime() <= agora.getTime()) continue;
        totalHorarios++;
        const fim = addMinutes(ini, duracao).getTime();
        const cruzam = ativos.filter(a => ini.getTime() < a.fim && fim > a.ini);
        // Bloqueio (almoço, folga) fecha o horário inteiro, não só uma vaga.
        const haVagaGeral = cruzam.length < capacidade && !cruzam.some(a => a.ag.status === 'bloqueado');
        // Cada profissional atende um por vez; a clínica tem o limite de vagas por horário.
        for (const m of equipeAtiva) {
          totalPorMembro.set(m.id, (totalPorMembro.get(m.id) || 0) + 1);
          const ocupado = cruzam.some(a => (a.ag as { membro_equipe_id?: string | null }).membro_equipe_id === m.id);
          if (haVagaGeral && !ocupado) livresPorMembro.set(m.id, (livresPorMembro.get(m.id) || 0) + 1);
        }
        const livreNoFiltro = membroId === 'todos'
          ? haVagaGeral
          : haVagaGeral && !cruzam.some(a => (a.ag as { membro_equipe_id?: string | null }).membro_equipe_id === membroId);
        if (livreNoFiltro) vagasDia.push({ inicio: ini, restantes: capacidade - cruzam.length });
      }
      if (vagasDia.length) vagasPorDia.push({ dia, vagas: vagasDia });
    }

    const ranking = equipeAtiva
      .map(m => {
        const livres = livresPorMembro.get(m.id) || 0;
        const total = totalPorMembro.get(m.id) || 0;
        return { membro: m, livres, ocupacao: total ? Math.round(((total - livres) / total) * 100) : 0 };
      })
      .sort((a, b) => b.livres - a.livres);

    // Clientes que costumam faltar: 3+ sessões encerradas e faltou em metade ou mais.
    const historico = new Map<string, { faltas: number; encerradas: number }>();
    for (const a of agendamentos) {
      if (!a.paciente_id || parseISO(a.data_inicio).getTime() > agora.getTime()) continue;
      if (a.status !== 'faltou' && a.status !== 'concluido') continue;
      const h = historico.get(a.paciente_id) || { faltas: 0, encerradas: 0 };
      h.encerradas++;
      if (a.status === 'faltou') h.faltas++;
      historico.set(a.paciente_id, h);
    }
    const limite = addDays(hoje, DIAS_PERIODO[periodo]).getTime();
    const possiveis = ativos
      .filter(({ ag, ini }) => ini > agora.getTime() && ini < limite && ag.paciente_id
        && (ag.status === 'confirmado' || ag.status === 'pendente')
        && (membroId === 'todos' || (ag as { membro_equipe_id?: string | null }).membro_equipe_id === membroId))
      .map(({ ag, ini }) => ({ ag, ini, h: historico.get(ag.paciente_id!) }))
      .filter(x => x.h && x.h.encerradas >= 3 && x.h.faltas / x.h.encerradas >= 0.5)
      .sort((a, b) => a.ini - b.ini);

    const totalVagas = vagasPorDia.reduce((s, d) => s + d.vagas.length, 0);
    return { vagasPorDia, ranking, possiveis, totalVagas, totalHorarios };
  }, [aberto, agendamentos, config, equipeAtiva, periodo, membroId]);

  const rotuloDia = (d: Date) => format(d, "EEE, dd/MM", { locale: ptBR });

  return (
    <Sheet open={aberto} onOpenChange={(v) => { setAberto(v); if (v) setDiasVisiveis(7); }}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" className="h-9 px-3 rounded-xl gap-1 text-xs sm:text-sm" title="Encontrar vagas livres">
          <CalendarSearch className="h-4 w-4" /> <span className="hidden sm:inline">Vagas</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><CalendarSearch className="h-4 w-4 text-primary" /> Encontrar vagas</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          <div className="flex gap-0.5 rounded-xl bg-muted/50 p-0.5 text-xs">
            {(['hoje', 'semana', 'mes'] as Periodo[]).map(p => (
              <button key={p} type="button" onClick={() => { setPeriodo(p); setDiasVisiveis(7); }}
                className={cn('flex-1 px-3 py-1.5 rounded-lg font-medium transition-all',
                  periodo === p ? 'bg-background text-foreground shadow-sm ring-1 ring-border/40' : 'text-muted-foreground hover:text-foreground')}>
                {p === 'hoje' ? 'Hoje' : p === 'semana' ? 'Próximos 7 dias' : 'Próximos 30 dias'}
              </button>
            ))}
          </div>

          {equipeAtiva.length > 0 && (
            <Select value={membroId} onValueChange={setMembroId}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos" className="text-xs">Todos os profissionais</SelectItem>
                {equipeAtiva.map(m => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: m.cor }} />{m.nome}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {dados && (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                <p className="text-2xl font-black tabular-nums text-emerald-700 dark:text-emerald-400">{dados.totalVagas}</p>
                <p className="text-[11px] text-muted-foreground">horários livres{dados.totalHorarios ? ` de ${dados.totalHorarios}` : ''}</p>
              </div>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="text-2xl font-black tabular-nums text-amber-700 dark:text-amber-400">{dados.possiveis.length}</p>
                <p className="text-[11px] text-muted-foreground">possíveis vagas (quem costuma faltar)</p>
              </div>
            </div>
          )}

          {/* Profissional mais livre */}
          {dados && membroId === 'todos' && dados.ranking.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><UserCheck className="h-3.5 w-3.5" /> Profissional mais livre</h3>
              <ul className="space-y-1.5">
                {dados.ranking.map(({ membro, livres, ocupacao }) => (
                  <li key={membro.id}>
                    <button type="button" onClick={() => setMembroId(membro.id)}
                      className="w-full text-left rounded-lg border border-border/50 px-3 py-2 hover:bg-muted/40 transition-colors">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: membro.cor }} />
                        <span className="font-semibold truncate flex-1">{membro.nome}</span>
                        <span className="text-xs font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{livres} livres</span>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${ocupacao}%`, background: membro.cor }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{ocupacao}% da agenda ocupada no período</p>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Possíveis vagas */}
          {dados && dados.possiveis.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Possíveis vagas</h3>
              <p className="text-[11px] text-muted-foreground">Clientes que faltaram em metade ou mais das últimas sessões. Vale confirmar antes e ter alguém da lista de espera.</p>
              <ul className="space-y-1.5">
                {dados.possiveis.map(({ ag, ini, h }) => (
                  <li key={ag.id}>
                    <button type="button" onClick={() => { setAberto(false); onAbrir(ag); }}
                      className="w-full text-left rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 hover:bg-amber-500/10 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold truncate">{nomePaciente(ag, pacientes)}</span>
                        <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">{rotuloDia(new Date(ini))} · {format(new Date(ini), 'HH:mm')}</span>
                      </div>
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                        Faltou {h!.faltas} de {h!.encerradas} sessões ({Math.round((h!.faltas / h!.encerradas) * 100)}%)
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Vagas livres por dia */}
          {dados && (
            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Horários livres</h3>
              {dados.vagasPorDia.length === 0 ? (
                <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-4 text-center">
                  Nenhum horário livre no período{membroId !== 'todos' ? ' para esse profissional' : ''}. Confira os dias e turnos em Config → Agenda.
                </p>
              ) : (
                <>
                  {dados.vagasPorDia.slice(0, diasVisiveis).map(({ dia, vagas }) => (
                    <div key={dia.toISOString()} className="rounded-lg border border-border/50 p-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold capitalize">{rotuloDia(dia)}</span>
                        <span className="text-[10px] text-muted-foreground">{vagas.length} livre{vagas.length > 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {vagas.map(v => (
                          <button key={v.inicio.toISOString()} type="button"
                            onClick={() => { setAberto(false); onAgendar(v.inicio, membroId !== 'todos' ? membroId : undefined); }}
                            className="rounded-md border border-emerald-500/40 bg-emerald-500/5 px-2 py-1 text-xs font-semibold tabular-nums text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/15 transition-colors"
                            title="Agendar neste horário">
                            {format(v.inicio, 'HH:mm')}
                            {(config.vagas_por_horario || 1) > 1 && <span className="ml-1 text-[10px] opacity-70">({v.restantes})</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {dados.vagasPorDia.length > diasVisiveis && (
                    <Button variant="ghost" size="sm" className="w-full text-xs gap-1" onClick={() => setDiasVisiveis(n => n + 7)}>
                      <ChevronDown className="h-3.5 w-3.5" /> Ver mais dias ({dados.vagasPorDia.length - diasVisiveis})
                    </Button>
                  )}
                  <p className="text-[10px] text-muted-foreground">Toque num horário para agendar.</p>
                </>
              )}
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
