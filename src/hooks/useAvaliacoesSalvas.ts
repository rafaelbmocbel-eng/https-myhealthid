import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { AvaliacaoMyID } from '@/types/myid';
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
    mutationFn: async ({ avaliacao, pacienteId }: { avaliacao: AvaliacaoMyID; pacienteId: string }) => {
      const isMyID = !!avaliacao.resultado;

      const payload = {
        terapeuta_id: user!.id,
        paciente_id: pacienteId,
        paciente_nome: avaliacao.pacienteNome,
        data_avaliacao: avaliacao.dataAvaliacao,
        dados_avaliacao: avaliacao as any,
        classificacao: avaliacao.resultado?.classificacao || 'N/A',

        // Novos campos MyID
        myid_score: avaliacao.resultado?.myidScore || 0,
        score_i: avaliacao.resultado?.componentScores.I || 0,
        score_n: avaliacao.resultado?.componentScores.N || 0,
        red_flags: avaliacao.resultado?.redFlagsDetected || false,
        red_flags_details: avaliacao.resultado?.redFlagAlerts || [],

        // Campos compartilhados (mapeados a partir do resultado MyID)
        score_p: avaliacao.resultado?.componentScores.P || 0,
        score_c: avaliacao.resultado?.componentScores.C || 0,
        score_d: avaliacao.resultado?.componentScores.D || 0,
        score_r: avaliacao.resultado?.componentScores.R || 0,
        score_efi: avaliacao.resultado?.componentScores.EFI || 0,

        // Campos que não existem mais (anulados)
        score_e: null,
        score_f: null,
        id_final: null,
      };
      const { data, error } = await (supabase as any)
        .from('avaliacoes_identidade')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;

      // ── Auto-register evolution record ──────────────────────────────
      try {
        // Fetch previous assessments for this patient (excluding the one just saved)
        const { data: previousAvals } = await (supabase as any)
          .from('avaliacoes_identidade')
          .select('id, created_at, score_e, score_p, score_c, score_f, score_d, score_r, score_efi, id_final, myid_score, score_i, score_n')
          .eq('paciente_id', pacienteId)
          .eq('terapeuta_id', user!.id)
          .neq('id', data.id)
          .order('created_at', { ascending: false })
          .limit(1);

        // Count existing evolution records for numbering
        const { count } = await (supabase as any)
          .from('evolucao_paciente')
          .select('id', { count: 'exact', head: true })
          .eq('paciente_id', pacienteId)
          .eq('terapeuta_id', user!.id);

        const numeroAvaliacao = (count || 0) + 1;
        const prev = previousAvals?.[0] || null;

        const scores = {
          score_e: data.score_e,
          score_p: data.score_p,
          score_c: data.score_c,
          score_f: data.score_f,
          score_d: data.score_d,
          score_r: data.score_r,
          score_efi: data.score_efi,
          score_i: data.score_i,
          score_n: data.score_n,
          myid_score: data.myid_score,
        };

        const deltas = prev
          ? {
            delta_e: (data.score_e ?? 0) - (prev.score_e ?? 0),
            delta_p: (data.score_p ?? 0) - (prev.score_p ?? 0),
            delta_c: (data.score_c ?? 0) - (prev.score_c ?? 0),
            delta_f: (data.score_f ?? 0) - (prev.score_f ?? 0),
            delta_d: (data.score_d ?? 0) - (prev.score_d ?? 0),
            delta_r: (data.score_r ?? 0) - (prev.score_r ?? 0),
            delta_efi: (data.score_efi ?? 0) - (prev.score_efi ?? 0),
            delta_i: (data.score_i ?? 0) - (prev.score_i ?? 0),
            delta_n: (data.score_n ?? 0) - (prev.score_n ?? 0),
            delta_id_final: (data.myid_score ?? data.id_final ?? 0) - (prev.myid_score ?? prev.id_final ?? 0),
          }
          : { delta_e: 0, delta_p: 0, delta_c: 0, delta_f: 0, delta_d: 0, delta_r: 0, delta_efi: 0, delta_i: 0, delta_n: 0, delta_id_final: 0 };

        const diasDesdeAnterior = prev
          ? Math.round((new Date(data.created_at).getTime() - new Date(prev.created_at).getTime()) / (1000 * 60 * 60 * 24))
          : null;

        await (supabase as any)
          .from('evolucao_paciente')
          .insert({
            paciente_id: pacienteId,
            terapeuta_id: user!.id,
            avaliacao_atual_id: data.id,
            avaliacao_anterior_id: prev?.id || null,
            numero_avaliacao: numeroAvaliacao,
            classificacao: data.classificacao,
            id_final: data.id_final,
            ...scores,
            ...deltas,
            dias_desde_anterior: diasDesdeAnterior,
          });
      } catch (evolErr) {
        console.warn('Evolução não registrada:', evolErr);
      }

      // ── Auto-generate prontuário note ──────────────────────────────
      try {
        const cs = avaliacao.resultado?.componentScores || {};
        const myidScore = avaliacao.resultado?.myidScore || 0;
        const classificacao = avaliacao.resultado?.classificacao || 'N/A';
        const redFlags = avaliacao.resultado?.redFlagsDetected || false;
        const redFlagAlerts = avaliacao.resultado?.redFlagAlerts || [];

        const myidFormatted = Number(myidScore).toFixed(1);
        const scoreD = Number(cs.D || 0).toFixed(1);
        const scoreEFI = Number(cs.EFI || 0).toFixed(1);
        const scoreP = Number(cs.P || 0).toFixed(1);
        const scoreI = Number(cs.I || 0).toFixed(1);
        const scoreN = Number(cs.N || 0).toFixed(1);
        const scoreR = Number(cs.R || 0).toFixed(1);
        const scoreC = Number(cs.C || 0).toFixed(1);

        const myidNum = Number(myidScore);
        const severityDesc = myidNum <= 29
          ? "SITUAÇÃO CRÍTICA — Sobrecarga sistêmica extrema."
          : myidNum <= 49
          ? "SOBRECARGA CRÍTICA — Demandas excedem capacidade de regulação."
          : myidNum <= 69
          ? "SOBRECARGA MODERADA — Desequilíbrio entre demandas e recuperação."
          : myidNum <= 84
          ? "BOA SAÚDE — Perfil bom com espaço para otimização."
          : "EXCELENTE — Boa capacidade de regulação.";

        const flagsText = redFlags && redFlagAlerts.length > 0
          ? `\n⚠️ RED FLAGS: ${redFlagAlerts.join(', ')}`
          : '';

        const descricao = `🩺 AVALIAÇÃO PROFISSIONAL — Método Identidade (MyID)

🎯 Score MyID-100: ${myidFormatted}/100 — ${classificacao}
📌 ${severityDesc}${flagsText}

📊 PERFIL:
• Dor (D): ${scoreD}/10
• Funcionalidade (EFI): ${scoreEFI}/10
• Psicológico (P): ${scoreP}/10
• Demanda (I): ${scoreI}/10
• Ruído (N): ${scoreN}/10
• Regulação (R): ${scoreR}/10
• Contexto (C): ${scoreC}/10

Avaliação realizada presencialmente pelo terapeuta via Método Identidade.`;

        await (supabase as any).from('notas_prontuario').insert({
          paciente_id: pacienteId,
          terapeuta_id: user!.id,
          tipo: 'avaliacao_profissional',
          titulo: `Avaliação MyID — Score ${myidFormatted}/100 (${classificacao})`,
          descricao,
          dados_extras: { avaliacao_id: data.id, myid_score: myidScore, classificacao, scores: cs },
          referencia_id: data.id,
        });
      } catch (noteErr) {
        console.warn('Nota de prontuário não registrada:', noteErr);
      }

      return data;
    },
    onSuccess: () => {
      toast({ title: '✅ Avaliação salva!', description: 'Histórico atualizado com sucesso.' });
      qc.invalidateQueries({ queryKey: ['avaliacoes-identidade'] });
      qc.invalidateQueries({ queryKey: ['evolucao-paciente'] });
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
