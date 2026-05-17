import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface WAConversa {
  id: string;
  terapeuta_id: string;
  paciente_id: string | null;
  telefone: string;
  nome_contato: string | null;
  ultima_mensagem: string | null;
  ultima_mensagem_em: string | null;
  ultima_direcao: 'entrada' | 'saida' | null;
  nao_lidas: number;
  arquivada: boolean;
  tags: string[] | null;
  bot_ativo?: boolean;
  intencao_atual?: string | null;
  lead_score?: number;
}

export interface WAMensagem {
  id: string;
  conversa_id: string;
  terapeuta_id: string;
  direcao: 'entrada' | 'saida';
  tipo: 'texto' | 'audio' | 'imagem' | 'documento' | 'video' | 'sistema';
  conteudo: string | null;
  midia_url: string | null;
  transcricao: string | null;
  status: string;
  created_at: string;
}

export function useWhatsappConversas() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['wa-conversas', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_conversas')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .eq('arquivada', false)
        .order('ultima_mensagem_em', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as WAConversa[];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`wa-conv-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_conversas', filter: `terapeuta_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ['wa-conversas', user.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  return query;
}

export function useWhatsappMensagens(conversaId: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['wa-msgs', conversaId],
    queryFn: async () => {
      if (!conversaId) return [] as WAMensagem[];
      const { data, error } = await supabase
        .from('whatsapp_mensagens_inbox')
        .select('*')
        .eq('conversa_id', conversaId)
        .order('created_at', { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data || []) as WAMensagem[];
    },
    enabled: !!conversaId && !!user,
  });

  useEffect(() => {
    if (!conversaId) return;
    const ch = supabase
      .channel(`wa-msgs-${conversaId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_mensagens_inbox', filter: `conversa_id=eq.${conversaId}` },
        () => qc.invalidateQueries({ queryKey: ['wa-msgs', conversaId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conversaId, qc]);

  const enviar = useMutation({
    mutationFn: async ({ conversa, texto }: { conversa: WAConversa; texto: string }) => {
      // 1) registra como "enviando"
      const { data: msg, error: insErr } = await supabase
        .from('whatsapp_mensagens_inbox')
        .insert({
          conversa_id: conversa.id,
          terapeuta_id: user!.id,
          direcao: 'saida',
          tipo: 'texto',
          conteudo: texto,
          status: 'enviando',
        })
        .select('id').single();
      if (insErr) throw insErr;

      // 2) envia via Z-API
      const { error: sendErr } = await supabase.functions.invoke('send-whatsapp', {
        body: { phone: conversa.telefone, message: texto },
      });

      // 3) atualiza status
      await supabase
        .from('whatsapp_mensagens_inbox')
        .update({ status: sendErr ? 'erro' : 'enviada', erro: sendErr?.message ?? null })
        .eq('id', msg.id);

      if (sendErr) throw sendErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wa-msgs', conversaId] });
      qc.invalidateQueries({ queryKey: ['wa-conversas', user?.id] });
    },
  });

  const marcarLida = useMutation({
    mutationFn: async () => {
      if (!conversaId) return;
      await supabase.from('whatsapp_conversas').update({ nao_lidas: 0 }).eq('id', conversaId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa-conversas', user?.id] }),
  });

  return { ...query, enviar, marcarLida };
}
