import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface MembroEquipe {
  id: string;
  terapeuta_id: string;
  nome: string;
  cor: string;
  ativo: boolean;
  created_at: string;
}

const CORES_PREDEFINIDAS = [
  '#3B82F6', // Azul
  '#10B981', // Verde
  '#F59E0B', // Amarelo
  '#EF4444', // Vermelho
  '#8B5CF6', // Roxo
  '#EC4899', // Rosa
  '#06B6D4', // Ciano
  '#F97316', // Laranja
];

export { CORES_PREDEFINIDAS };

export function useEquipe() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [membros, setMembros] = useState<MembroEquipe[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) { setMembros([]); setLoading(false); return; }
    const { data, error } = await supabase
      .from('equipe_membros')
      .select('*')
      .eq('terapeuta_id', user.id)
      .order('created_at');
    if (error) console.error('[useEquipe]', error);
    setMembros((data as MembroEquipe[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { void fetch(); }, [fetch]);

  const addMembro = async (nome: string, cor: string) => {
    if (!user) return;
    const { error } = await supabase.from('equipe_membros').insert({ terapeuta_id: user.id, nome, cor });
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Membro adicionado! 👥' });
    await fetch();
  };

  const updateMembro = async (id: string, data: Partial<Pick<MembroEquipe, 'nome' | 'cor' | 'ativo'>>) => {
    const { error } = await supabase.from('equipe_membros').update(data).eq('id', id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    await fetch();
  };

  const removeMembro = async (id: string) => {
    const { error } = await supabase.from('equipe_membros').delete().eq('id', id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Membro removido' });
    await fetch();
  };

  return { membros, loading, addMembro, updateMembro, removeMembro, refresh: fetch };
}
