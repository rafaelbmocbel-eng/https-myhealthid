import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { AvaliacaoIdentidade } from '@/types/identidade';
import { AvaliacaoCobZero } from '@/types/cobzero';

// ── Método Identidade ─────────────────────────────────────────────────────────

export function useAvaliacoesIdentidade(pacienteId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: avaliacoes = [], isLoading } = useQuery({
    queryKey: ['avaliacoes-identidade', user?.id, pacienteId],
    queryFn: async () => {
      let query = (supabase as any)
        .from('avaliacoes_identidade')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .order('created_at', { ascending: false });
      if (pacienteId) query = query.eq('paciente_id', pacienteId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const salvarMutation = useMutation({
    mutationFn: async ({ avaliacao, pacienteId }: { avaliacao: AvaliacaoIdentidade; pacienteId: string }) => {
      const payload = {
        terapeuta_id: user!.id,
        paciente_id: pacienteId,
        paciente_nome: avaliacao.pacienteNome,
        data_avaliacao: avaliacao.dataAvaliacao,
        dados_avaliacao: avaliacao as any,
        id_final: avaliacao.idFinal,
        classificacao: avaliacao.classificacao,
        score_e: avaliacao.bloco6.scoreE,
        score_p: avaliacao.bloco4.scoreP,
        score_c: avaliacao.bloco5.scoreC,
        score_f: avaliacao.bloco1.scoreF,
        score_d: avaliacao.bloco2.scoreD,
        score_r: avaliacao.bloco5.scoreR,
        score_efi: avaliacao.bloco3.scoreEFI,
      };
      const { data, error } = await (supabase as any)
        .from('avaliacoes_identidade')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: '✅ Avaliação salva!', description: 'Histórico atualizado com sucesso.' });
      qc.invalidateQueries({ queryKey: ['avaliacoes-identidade'] });
    },
    onError: (e: any) => {
      toast({ title: 'Erro ao salvar avaliação', description: e.message, variant: 'destructive' });
    },
  });

  const deletarMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('avaliacoes_identidade')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Avaliação excluída' });
      qc.invalidateQueries({ queryKey: ['avaliacoes-identidade'] });
    },
  });

  return { avaliacoes, isLoading, salvar: salvarMutation.mutateAsync, deletar: deletarMutation.mutate, salvando: salvarMutation.isPending };
}

// ── COB° ZERO ─────────────────────────────────────────────────────────────────

export function useAvaliacoesCobZero(pacienteId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: avaliacoes = [], isLoading } = useQuery({
    queryKey: ['avaliacoes-cob-zero', user?.id, pacienteId],
    queryFn: async () => {
      let query = (supabase as any)
        .from('avaliacoes_cob_zero')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .order('created_at', { ascending: false });
      if (pacienteId) query = query.eq('paciente_id', pacienteId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const salvarMutation = useMutation({
    mutationFn: async ({ avaliacao, pacienteId }: { avaliacao: AvaliacaoCobZero; pacienteId: string }) => {
      const payload = {
        terapeuta_id: user!.id,
        paciente_id: pacienteId,
        paciente_nome: avaliacao.pacienteNome,
        data_avaliacao: avaliacao.dataAvaliacao,
        dados_avaliacao: avaliacao as any,
        cobb_angle: avaliacao.etapaLenke.cobbAngle,
        lenke_type: avaliacao.etapaLenke.lenkeType,
        risco_level: avaliacao.etapaRisco.riskLevel,
        risco_percentage: avaliacao.etapaRisco.riskPercentage,
        score_e: avaliacao.scoreE,
      };
      const { data, error } = await (supabase as any)
        .from('avaliacoes_cob_zero')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: '✅ Avaliação COB° ZERO salva!', description: 'Histórico atualizado com sucesso.' });
      qc.invalidateQueries({ queryKey: ['avaliacoes-cob-zero'] });
    },
    onError: (e: any) => {
      toast({ title: 'Erro ao salvar avaliação', description: e.message, variant: 'destructive' });
    },
  });

  const deletarMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('avaliacoes_cob_zero')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Avaliação excluída' });
      qc.invalidateQueries({ queryKey: ['avaliacoes-cob-zero'] });
    },
  });

  return { avaliacoes, isLoading, salvar: salvarMutation.mutateAsync, deletar: deletarMutation.mutate, salvando: salvarMutation.isPending };
}
