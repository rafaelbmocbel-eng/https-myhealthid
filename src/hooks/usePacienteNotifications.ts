import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isToday, parseISO } from 'date-fns';

interface PacienteNotifications {
  pendingQuestionarios: number;
  pendingPagamentos: number;
  proximaConsulta: boolean;
  diarioHoje: boolean;
  streak: number;
}

export function usePacienteNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<PacienteNotifications>({
    pendingQuestionarios: 0,
    pendingPagamentos: 0,
    proximaConsulta: false,
    diarioHoje: false,
    streak: 0,
  });

  useEffect(() => {
    if (!userId) return;

    const fetch = async () => {
      const { data: pac } = await supabase
        .from('pacientes')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      if (!pac) return;

      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [questRes, pagRes, agendaRes, diarioRes, streakRes] = await Promise.all([
        supabase.from('myid_avaliacoes')
          .select('id', { count: 'exact', head: true })
          .eq('paciente_id', pac.id)
          .neq('status', 'concluido'),
        supabase.from('pagamentos_paciente')
          .select('id', { count: 'exact', head: true })
          .eq('paciente_id', pac.id)
          .eq('status', 'pendente'),
        supabase.from('agendamentos')
          .select('id', { count: 'exact', head: true })
          .eq('paciente_id', pac.id)
          .gte('data_inicio', now.toISOString())
          .lte('data_inicio', tomorrow.toISOString())
          .in('status', ['confirmado', 'pendente']),
        supabase.from('daily_logs')
          .select('created_at')
          .eq('paciente_id', pac.id)
          .order('created_at', { ascending: false })
          .limit(1),
        // Get last 30 daily logs for streak calculation
        supabase.from('daily_logs')
          .select('created_at')
          .eq('paciente_id', pac.id)
          .order('created_at', { ascending: false })
          .limit(30),
      ]);

      const diarioHoje = diarioRes.data && diarioRes.data.length > 0
        ? isToday(parseISO(diarioRes.data[0].created_at))
        : false;

      // Calculate streak
      let streak = 0;
      if (streakRes.data) {
        const dates = streakRes.data.map(d => {
          const dt = new Date(d.created_at);
          return `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
        });
        const uniqueDates = [...new Set(dates)];
        const today = new Date();
        for (let i = 0; i < 30; i++) {
          const checkDate = new Date(today);
          checkDate.setDate(checkDate.getDate() - i);
          const key = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
          if (uniqueDates.includes(key)) {
            streak++;
          } else if (i > 0) {
            break;
          }
        }
      }

      setNotifications({
        pendingQuestionarios: questRes.count || 0,
        pendingPagamentos: pagRes.count || 0,
        proximaConsulta: (agendaRes.count || 0) > 0,
        diarioHoje,
        streak,
      });
    };

    fetch();
    const interval = setInterval(fetch, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, [userId]);

  return notifications;
}
