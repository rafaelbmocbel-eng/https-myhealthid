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

/** Busca global: retorna IDs de conversas cujas mensagens contêm o termo. */
export function useGlobalMessageSearch(termo: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['wa-msg-search', user?.id, termo],
    queryFn: async () => {
      const q = termo.trim();
      if (!user || q.length < 3) return [] as string[];
      const safe = q.replace(/[%,]/g, ' ');
      const { data, error } = await supabase
        .from('whatsapp_mensagens_inbox')
        .select('conversa_id')
        .eq('terapeuta_id', user.id)
        .or(`conteudo.ilike.%${safe}%,transcricao.ilike.%${safe}%`)
        .limit(300);
      if (error) throw error;
      return Array.from(new Set((data || []).map((r: any) => r.conversa_id as string)));
    },
    enabled: !!user && termo.trim().length >= 3,
    staleTime: 10_000,
  });
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

/** SLA helpers */
export type SLAStatus = 'ok' | 'em_breve' | 'atrasado' | 'respondido' | 'sem_sla';

export function getSLAStatus(c: { sla_responder_ate?: string | null; primeiro_resposta_em?: string | null }): {
  status: SLAStatus; minutos: number;
} {
  if (!c.sla_responder_ate) return { status: 'sem_sla', minutos: 0 };
  if (c.primeiro_resposta_em) return { status: 'respondido', minutos: 0 };
  const diff = (new Date(c.sla_responder_ate).getTime() - Date.now()) / 60000;
  if (diff < 0) return { status: 'atrasado', minutos: Math.abs(Math.round(diff)) };
  if (diff < 10) return { status: 'em_breve', minutos: Math.round(diff) };
  return { status: 'ok', minutos: Math.round(diff) };
}

/** Filtros salvos */
export interface WAFiltroSalvo {
  id: string;
  nome: string;
  filtros: Record<string, any>;
  ordem: number;
}

export function useWhatsappFiltrosSalvos() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['wa-filtros', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_filtros_salvos')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .order('ordem', { ascending: true });
      if (error) throw error;
      return (data || []) as WAFiltroSalvo[];
    },
    enabled: !!user,
  });
  const salvar = useMutation({
    mutationFn: async (f: { nome: string; filtros: Record<string, any> }) => {
      const { error } = await supabase.from('whatsapp_filtros_salvos').insert({
        terapeuta_id: user!.id, nome: f.nome, filtros: f.filtros,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa-filtros', user?.id] }),
  });
  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('whatsapp_filtros_salvos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa-filtros', user?.id] }),
  });
  return { ...query, salvar, remover };
}

/** Atribuir conversa */
export function useAtribuirConversa() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ conversa_id, atribuido_a }: { conversa_id: string; atribuido_a: string | null }) => {
      const { error } = await supabase.from('whatsapp_conversas')
        .update({ atribuido_a }).eq('id', conversa_id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa-conversas', user?.id] }),
  });
}
