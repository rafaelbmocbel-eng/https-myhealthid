import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { UserPlus, ClipboardCheck, Mic, CalendarCheck, Loader2 } from 'lucide-react';
import { format, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type Item = {
  paciente_id: string;
  nome: string;
  tipos: Set<'criado' | 'myid' | 'voz' | 'sessao'>;
  hora: string; // ISO mais recente
};

type Periodo = 'hoje' | '7d' | '30d';

const PERIODOS: { key: Periodo; label: string; dias: number }[] = [
  { key: 'hoje', label: 'Hoje', dias: 0 },
  { key: '7d', label: '7 dias', dias: 7 },
  { key: '30d', label: '30 dias', dias: 30 },
];

/**
 * Card "Atividade" — lista pacientes que foram criados, avaliados (MyID/voz)
 * ou tiveram sessão registrada. Permite filtrar por Hoje / 7 dias / 30 dias
 * para visualizar histórico de avaliações passadas.
 */
export default function AtividadeHojeCard() {
  const { user } = useAuth();
  const [periodo, setPeriodo] = useState<Periodo>('hoje');

  const { data, isLoading } = useQuery({
    queryKey: ['atividade-historico', user?.id, periodo],
    enabled: !!user,
    queryFn: async () => {
      const inicio = new Date();
      const cfg = PERIODOS.find(p => p.key === periodo)!;
      if (cfg.dias === 0) {
        inicio.setHours(0, 0, 0, 0);
      } else {
        inicio.setDate(inicio.getDate() - cfg.dias);
        inicio.setHours(0, 0, 0, 0);
      }
      const inicioISO = inicio.toISOString();

      const [pac, myid, voz, ses] = await Promise.all([
        supabase
          .from('pacientes')
          .select('id, nome, sobrenome, created_at')
          .eq('terapeuta_id', user!.id)
          .gte('created_at', inicioISO),
        supabase
          .from('avaliacoes_identidade')
          .select('paciente_id, created_at')
          .eq('terapeuta_id', user!.id)
          .gte('created_at', inicioISO),
        supabase
          .from('avaliacoes_voz')
          .select('paciente_id, paciente_nome, created_at')
          .eq('terapeuta_id', user!.id)
          .gte('created_at', inicioISO),
        supabase
          .from('controle_sessoes')
          .select('paciente_id, data_sessao')
          .eq('terapeuta_id', user!.id)
          .gte('data_sessao', inicioISO),
      ]);

      // Resolver nomes dos pacientes faltantes
      const idsExtras = new Set<string>();
      [...(myid.data || []), ...(voz.data || []), ...(ses.data || [])].forEach((r: any) => {
        if (r.paciente_id) idsExtras.add(r.paciente_id);
      });
      (pac.data || []).forEach((p: any) => idsExtras.delete(p.id));

      let nomesExtras: Record<string, string> = {};
      if (idsExtras.size > 0) {
        const { data: extras } = await supabase
          .from('pacientes')
          .select('id, nome, sobrenome')
          .in('id', Array.from(idsExtras));
        nomesExtras = Object.fromEntries(
          (extras || []).map((p: any) => [p.id, `${p.nome} ${p.sobrenome || ''}`.trim()]),
        );
      }

      const map = new Map<string, Item>();
      const push = (id: string | null, nome: string, tipo: Item['tipos'] extends Set<infer T> ? T : never, hora: string) => {
        if (!id) return;
        const cur = map.get(id);
        if (cur) {
          cur.tipos.add(tipo);
          if (hora > cur.hora) cur.hora = hora;
        } else {
          map.set(id, { paciente_id: id, nome, tipos: new Set([tipo]), hora });
        }
      };

      (pac.data || []).forEach((p: any) => push(p.id, `${p.nome} ${p.sobrenome || ''}`.trim(), 'criado', p.created_at));
      (myid.data || []).forEach((m: any) => push(m.paciente_id, nomesExtras[m.paciente_id] || 'Paciente', 'myid', m.created_at));
      (voz.data || []).forEach((v: any) => push(v.paciente_id, v.paciente_nome || nomesExtras[v.paciente_id] || 'Paciente', 'voz', v.created_at));
      (ses.data || []).forEach((s: any) => push(s.paciente_id, nomesExtras[s.paciente_id] || 'Paciente', 'sessao', s.data_sessao));

      return Array.from(map.values()).sort((a, b) => b.hora.localeCompare(a.hora));
    },
  });

  const itens = data || [];
  const tituloPeriodo = periodo === 'hoje' ? 'Atividade de hoje' : `Atividade — últimos ${periodo === '7d' ? '7' : '30'} dias`;

  return (
    <Card className="p-4 mb-3">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarCheck className="icon-sm text-primary shrink-0" />
          <h3 className="text-sm font-semibold truncate">{tituloPeriodo}</h3>
        </div>
        <div className="flex items-center gap-1">
          {PERIODOS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriodo(p.key)}
              className={cn(
                'h-6 px-2 text-[10px] rounded-md border transition-colors',
                periodo === p.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border/60 hover:bg-muted'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-2">
          <Loader2 className="icon-sm animate-spin text-muted-foreground" />
        </div>
      ) : itens.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          Nenhuma atividade no período selecionado.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-end mb-1">
            <Badge variant="secondary" className="text-[10px]">
              {itens.length} {itens.length === 1 ? 'paciente' : 'pacientes'}
            </Badge>
          </div>
          <ul className="divide-y divide-border/40 max-h-[420px] overflow-y-auto">
            {itens.map((it) => {
              const d = new Date(it.hora);
              const quando = isToday(d)
                ? format(d, 'HH:mm', { locale: ptBR })
                : format(d, "dd/MM 'às' HH:mm", { locale: ptBR });
              return (
                <li key={it.paciente_id} className="py-2 flex items-center justify-between gap-2">
                  <Link
                    to={`/pacientes/${it.paciente_id}`}
                    className="text-xs font-medium hover:underline truncate flex-1"
                  >
                    {it.nome}
                  </Link>
                  <div className="flex items-center gap-1 shrink-0">
                    {it.tipos.has('criado') && (
                      <Badge variant="outline" className="h-5 text-[9px] gap-1 px-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-400">
                        <UserPlus className="h-2.5 w-2.5" /> Novo
                      </Badge>
                    )}
                    {it.tipos.has('myid') && (
                      <Badge variant="outline" className="h-5 text-[9px] gap-1 px-1.5 border-primary/40 text-primary">
                        <ClipboardCheck className="h-2.5 w-2.5" /> MyID
                      </Badge>
                    )}
                    {it.tipos.has('voz') && (
                      <Badge variant="outline" className="h-5 text-[9px] gap-1 px-1.5 border-amber-500/40 text-amber-700 dark:text-amber-400">
                        <Mic className="h-2.5 w-2.5" /> Voz
                      </Badge>
                    )}
                    {it.tipos.has('sessao') && (
                      <Badge variant="outline" className="h-5 text-[9px] gap-1 px-1.5">
                        <CalendarCheck className="h-2.5 w-2.5" /> Sessão
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground tabular-nums ml-1 whitespace-nowrap">
                      {quando}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}
