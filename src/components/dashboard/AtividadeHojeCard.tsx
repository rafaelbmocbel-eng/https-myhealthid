import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { UserPlus, ClipboardCheck, Mic, CalendarCheck, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Item = {
  paciente_id: string;
  nome: string;
  tipos: Set<'criado' | 'myid' | 'voz' | 'sessao'>;
  hora: string; // ISO mais recente
};

/**
 * Card "Atividade de hoje" — lista pacientes que foram:
 *  - criados hoje, ou
 *  - avaliados hoje (MyID concluído ou avaliação de voz), ou
 *  - tiveram sessão registrada hoje (controle_sessoes).
 */
export default function AtividadeHojeCard() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['atividade-hoje', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const inicio = new Date();
      inicio.setHours(0, 0, 0, 0);
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

  if (isLoading) {
    return (
      <Card className="p-4 mb-3">
        <div className="flex justify-center"><Loader2 className="icon-sm animate-spin text-muted-foreground" /></div>
      </Card>
    );
  }

  const itens = data || [];

  return (
    <Card className="p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarCheck className="icon-sm text-primary" />
          <h3 className="text-sm font-semibold">Atividade de hoje</h3>
        </div>
        <Badge variant="secondary" className="text-[10px]">
          {itens.length} {itens.length === 1 ? 'paciente' : 'pacientes'}
        </Badge>
      </div>

      {itens.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          Nenhum paciente criado ou avaliado hoje ainda.
        </p>
      ) : (
        <ul className="divide-y divide-border/40">
          {itens.map((it) => (
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
                <span className="text-[10px] text-muted-foreground tabular-nums ml-1">
                  {format(new Date(it.hora), 'HH:mm', { locale: ptBR })}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
