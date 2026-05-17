import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface WATemplate {
  id: string;
  atalho: string;
  titulo: string;
  conteudo: string;
  categoria: string;
  uso_count: number;
}

export function useWhatsappTemplates() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['wa-templates', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .order('uso_count', { ascending: false });
      if (error) throw error;
      return (data || []) as WATemplate[];
    },
    enabled: !!user,
  });

  const salvar = useMutation({
    mutationFn: async (t: Partial<WATemplate> & { atalho: string; titulo: string; conteudo: string }) => {
      const { error } = await supabase.from('whatsapp_templates').upsert({
        ...t,
        terapeuta_id: user!.id,
        categoria: t.categoria || 'geral',
      }, { onConflict: 'terapeuta_id,atalho' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa-templates', user?.id] }),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('whatsapp_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa-templates', user?.id] }),
  });

  const incrementarUso = async (id: string) => {
    const atual = query.data?.find(t => t.id === id)?.uso_count ?? 0;
    await supabase.from('whatsapp_templates')
      .update({ uso_count: atual + 1 })
      .eq('id', id);
    qc.invalidateQueries({ queryKey: ['wa-templates', user?.id] });
  };

  return { ...query, salvar, remover, incrementarUso };
}

export interface WANota {
  id: string;
  conversa_id: string;
  conteudo: string;
  created_at: string;
}

export function useWhatsappNotas(conversaId: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['wa-notas', conversaId],
    queryFn: async () => {
      if (!conversaId) return [] as WANota[];
      const { data, error } = await supabase
        .from('whatsapp_notas')
        .select('*')
        .eq('conversa_id', conversaId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as WANota[];
    },
    enabled: !!conversaId && !!user,
  });

  const adicionar = useMutation({
    mutationFn: async (conteudo: string) => {
      if (!conversaId) return;
      const { error } = await supabase.from('whatsapp_notas').insert({
        conversa_id: conversaId,
        terapeuta_id: user!.id,
        conteudo,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa-notas', conversaId] }),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('whatsapp_notas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa-notas', conversaId] }),
  });

  return { ...query, adicionar, remover };
}
