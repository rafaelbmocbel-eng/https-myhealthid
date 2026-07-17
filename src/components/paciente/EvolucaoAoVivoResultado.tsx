import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Flame, CheckCircle2, Zap, TrendingUp } from 'lucide-react';
import { subDays } from 'date-fns';

interface Props { pacienteId: string; }

// Camada VIVA do resultado: o MyID (número clínico) só muda numa nova avaliação,
// mas o esforço do cliente muda TODO dia. Esta banda fica acima do resultado e
// se atualiza conforme ele cumpre a Jornada — sequência, tarefas de hoje e XP —
// deixando claro que cada tarefa cuida de um foco da avaliação.
export default function EvolucaoAoVivoResultado({ pacienteId }: Props) {
  const { data } = useQuery({
    queryKey: ['evolucao-viva-resultado', pacienteId],
    queryFn: async () => {
      const hoje = new Date().toISOString().split('T')[0];
      const [checkins, logs, pac] = await Promise.all([
        (supabase as any).from('missao_checkins')
          .select('missao_key').eq('paciente_id', pacienteId).eq('data', hoje),
        supabase.from('daily_logs')
          .select('created_at').eq('paciente_id', pacienteId)
          .order('created_at', { ascending: false }).limit(30),
        supabase.from('pacientes').select('xp_total').eq('id', pacienteId).maybeSingle(),
      ]);

      // Sequência de dias com diário (mesma regra da Jornada)
      const streakLogs = logs.data || [];
      let streak = 0;
      const t = new Date();
      for (let i = 0; i < 30; i++) {
        const d = subDays(t, i).toISOString().split('T')[0];
        const tem = streakLogs.some((l: any) => String(l.created_at).startsWith(d));
        if (tem) streak++; else if (i > 0) break;
      }

      return {
        tarefasHoje: (checkins.data || []).length,
        streak,
        xp: Number((pac.data as any)?.xp_total) || 0,
      };
    },
  });

  if (!data) return null;

  const tiles = [
    { icon: Flame, cor: 'text-orange-600', bg: 'bg-orange-500/10', valor: data.streak, rot: data.streak === 1 ? 'dia seguido' : 'dias seguidos' },
    { icon: CheckCircle2, cor: 'text-emerald-600', bg: 'bg-emerald-500/10', valor: data.tarefasHoje, rot: data.tarefasHoje === 1 ? 'tarefa hoje' : 'tarefas hoje' },
    { icon: Zap, cor: 'text-violet-600', bg: 'bg-violet-500/10', valor: data.xp, rot: 'XP acumulado' },
  ];

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/[0.04] p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="h-4 w-4 text-primary" />
        <p className="text-sm font-bold text-foreground">Sua evolução ao vivo</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((t, i) => (
          <div key={i} className="rounded-lg border border-border/40 bg-background/60 p-3 text-center">
            <div className={`w-8 h-8 rounded-lg ${t.bg} flex items-center justify-center mx-auto mb-1.5`}>
              <t.icon className={`h-4 w-4 ${t.cor}`} />
            </div>
            <p className="text-lg font-black tabular-nums leading-none">{t.valor}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{t.rot}</p>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
        Cada tarefa da sua <strong>Jornada</strong> cuida de um foco desta avaliação. Continue cumprindo —
        na sua próxima avaliação MyID o número abaixo reflete tudo o que você fez. 💪
      </p>
    </div>
  );
}
