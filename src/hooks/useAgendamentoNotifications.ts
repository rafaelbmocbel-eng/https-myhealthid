import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { withAuthLockRetry } from '@/lib/authLock';

export function useAgendamentoNotifications() {
  const { user, authReady } = useAuth();
  const { toast } = useToast();
  const [pendingCount, setPendingCount] = useState(0);

  // Fetch initial count of pending auto-agendamentos
  const fetchPendingCount = useCallback(async () => {
    if (!authReady || !user) return;
    const { count } = await withAuthLockRetry(async () =>
      await supabase
        .from('agendamentos')
        .select('*', { count: 'exact', head: true })
        .eq('terapeuta_id', user.id)
        .eq('status', 'pendente')
    );
    setPendingCount(count || 0);
  }, [user, authReady]);

  useEffect(() => {
    fetchPendingCount();
  }, [fetchPendingCount]);

  // Subscribe to realtime INSERT on agendamentos
  useEffect(() => {
    if (!authReady || !user) return;

    const channel = supabase
      .channel('agendamentos-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agendamentos',
          filter: `terapeuta_id=eq.${user.id}`,
        },
        (payload) => {
          const newAg = payload.new as any;
          if (newAg.status === 'pendente') {
            setPendingCount(prev => prev + 1);
            
            const dataInicio = new Date(newAg.data_inicio);
            const hora = dataInicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const dia = dataInicio.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

            toast({
              title: '📅 Novo auto-agendamento!',
              description: `Um paciente reservou o horário ${hora} do dia ${dia}. Confira na agenda.`,
              duration: 8000,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'agendamentos',
          filter: `terapeuta_id=eq.${user.id}`,
        },
        (payload) => {
          const oldStatus = (payload.old as any)?.status;
          const newStatus = (payload.new as any)?.status;
          // If status changed from pendente to something else, decrement
          if (oldStatus === 'pendente' && newStatus !== 'pendente') {
            setPendingCount(prev => Math.max(0, prev - 1));
          }
          // If status changed to pendente, increment
          if (oldStatus !== 'pendente' && newStatus === 'pendente') {
            setPendingCount(prev => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, authReady, toast]);

  const clearCount = useCallback(() => setPendingCount(0), []);

  return { pendingCount, clearCount, refetch: fetchPendingCount };
}
