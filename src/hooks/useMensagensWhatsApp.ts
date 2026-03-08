import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface MensagemWhatsApp {
  id: string;
  terapeuta_id: string;
  paciente_id: string;
  tipo: string;
  template_id: string | null;
  mensagem: string;
  canal: string;
  status: string;
  created_at: string;
}

export function useMensagensWhatsApp(pacienteId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: mensagens = [], isLoading } = useQuery({
    queryKey: ['mensagens-whatsapp', user?.id, pacienteId],
    queryFn: async () => {
      let query = supabase
        .from('mensagens_whatsapp')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(200);

      if (pacienteId) {
        query = query.eq('paciente_id', pacienteId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as MensagemWhatsApp[];
    },
    enabled: !!user,
  });

  const logMensagem = useMutation({
    mutationFn: async (params: {
      paciente_id: string;
      mensagem: string;
      tipo?: string;
      template_id?: string;
    }) => {
      const { error } = await supabase.from('mensagens_whatsapp').insert({
        terapeuta_id: user!.id,
        paciente_id: params.paciente_id,
        mensagem: params.mensagem,
        tipo: params.tipo || 'manual',
        template_id: params.template_id || null,
        canal: 'whatsapp',
        status: 'enviada',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mensagens-whatsapp'] });
    },
  });

  // Group messages by patient for conversation list
  const conversas = (() => {
    const map: Record<string, { paciente_id: string; lastMessage: string; lastDate: string; count: number }> = {};
    mensagens.forEach(m => {
      if (!map[m.paciente_id]) {
        map[m.paciente_id] = { paciente_id: m.paciente_id, lastMessage: m.mensagem, lastDate: m.created_at, count: 0 };
      }
      map[m.paciente_id].count++;
    });
    return Object.values(map).sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime());
  })();

  return { mensagens, conversas, logMensagem, isLoading };
}
