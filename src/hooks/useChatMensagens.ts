import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

export interface ChatMensagem {
  id: string;
  terapeuta_id: string;
  paciente_id: string;
  remetente: 'terapeuta' | 'paciente' | 'sistema';
  mensagem: string;
  tipo: string;
  lida: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export function useChatMensagens(pacienteId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const queryKey = ['chat-mensagens', user?.id, pacienteId];

  const { data: mensagens = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!pacienteId) return [];
      const { data, error } = await supabase
        .from('chat_mensagens')
        .select('*')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data || []) as ChatMensagem[];
    },
    enabled: !!user && !!pacienteId,
  });

  // Realtime subscription
  useEffect(() => {
    if (!pacienteId) return;
    const channel = supabase
      .channel(`chat-${pacienteId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_mensagens',
        filter: `paciente_id=eq.${pacienteId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [pacienteId, queryClient]);

  const enviarMensagem = useMutation({
    mutationFn: async (params: {
      paciente_id: string;
      terapeuta_id: string;
      mensagem: string;
      remetente: 'terapeuta' | 'paciente';
      tipo?: string;
    }) => {
      const { error } = await supabase.from('chat_mensagens').insert({
        terapeuta_id: params.terapeuta_id,
        paciente_id: params.paciente_id,
        remetente: params.remetente,
        mensagem: params.mensagem,
        tipo: params.tipo || 'manual',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const marcarComoLida = useMutation({
    mutationFn: async (mensagemIds: string[]) => {
      const { error } = await supabase
        .from('chat_mensagens')
        .update({ lida: true })
        .in('id', mensagemIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const naoLidas = mensagens.filter(m => !m.lida);

  return { mensagens, enviarMensagem, marcarComoLida, naoLidas, isLoading };
}

// Hook for therapist to list all conversations with unread counts
export function useChatConversas() {
  const { user } = useAuth();

  const { data: conversas = [], isLoading } = useQuery({
    queryKey: ['chat-conversas', user?.id],
    queryFn: async () => {
      // Get all messages grouped by patient
      const { data, error } = await supabase
        .from('chat_mensagens')
        .select('paciente_id, mensagem, created_at, lida, remetente')
        .eq('terapeuta_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) throw error;

      const map: Record<string, {
        paciente_id: string;
        lastMessage: string;
        lastDate: string;
        naoLidas: number;
        total: number;
      }> = {};

      (data || []).forEach((m: any) => {
        if (!map[m.paciente_id]) {
          map[m.paciente_id] = {
            paciente_id: m.paciente_id,
            lastMessage: m.mensagem,
            lastDate: m.created_at,
            naoLidas: 0,
            total: 0,
          };
        }
        map[m.paciente_id].total++;
        if (!m.lida && m.remetente === 'paciente') {
          map[m.paciente_id].naoLidas++;
        }
      });

      return Object.values(map).sort((a, b) =>
        new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime()
      );
    },
    enabled: !!user,
  });

  return { conversas, isLoading };
}
