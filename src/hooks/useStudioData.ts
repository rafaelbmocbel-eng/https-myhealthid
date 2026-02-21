import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// ── Treinos ──────────────────────────────────────────────────────────────────
export function useStudioTreinos(pacienteId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: treinos = [], isLoading } = useQuery({
    queryKey: ['studio-treinos', user?.id, pacienteId],
    queryFn: async () => {
      let q = (supabase as any)
        .from('studio_treinos')
        .select('*, studio_treino_exercicios(count)')
        .eq('terapeuta_id', user!.id)
        .order('ordem');
      if (pacienteId) q = q.eq('paciente_id', pacienteId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!pacienteId,
  });

  const criarTreino = useMutation({
    mutationFn: async (payload: { paciente_id: string; titulo: string; objetivo?: string; duracao_estimada?: string; intensidade?: string; frequencia?: string; periodizacao_id?: string }) => {
      const { data, error } = await (supabase as any)
        .from('studio_treinos')
        .insert({ ...payload, terapeuta_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Treino criado! ✅' });
      qc.invalidateQueries({ queryKey: ['studio-treinos'] });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const atualizarTreino = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { error } = await (supabase as any).from('studio_treinos').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['studio-treinos'] });
    },
  });

  const deletarTreino = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('studio_treinos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Treino removido' });
      qc.invalidateQueries({ queryKey: ['studio-treinos'] });
    },
  });

  return { treinos, isLoading, criarTreino, atualizarTreino, deletarTreino };
}

// ── Exercícios do Treino ─────────────────────────────────────────────────────
export function useStudioExercicios(treinoId?: string) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: exercicios = [], isLoading } = useQuery({
    queryKey: ['studio-treino-exercicios', treinoId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('studio_treino_exercicios')
        .select('*')
        .eq('treino_id', treinoId!)
        .order('ordem');
      if (error) throw error;
      return data || [];
    },
    enabled: !!treinoId,
  });

  const adicionarExercicio = useMutation({
    mutationFn: async (payload: any) => {
      const { data, error } = await (supabase as any)
        .from('studio_treino_exercicios')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['studio-treino-exercicios', treinoId] }),
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const atualizarExercicio = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { error } = await (supabase as any).from('studio_treino_exercicios').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['studio-treino-exercicios', treinoId] }),
  });

  const removerExercicio = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('studio_treino_exercicios').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['studio-treino-exercicios', treinoId] }),
  });

  return { exercicios, isLoading, adicionarExercicio, atualizarExercicio, removerExercicio };
}

// ── Execuções ────────────────────────────────────────────────────────────────
export function useStudioExecucoes(pacienteId?: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: execucoes = [], isLoading } = useQuery({
    queryKey: ['studio-execucoes', pacienteId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('studio_execucoes')
        .select('*, studio_treinos(titulo)')
        .eq('paciente_id', pacienteId!)
        .eq('terapeuta_id', user!.id)
        .order('data_execucao', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!pacienteId,
  });

  const registrarExecucao = useMutation({
    mutationFn: async (payload: any) => {
      const { data, error } = await (supabase as any)
        .from('studio_execucoes')
        .insert({ ...payload, terapeuta_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Sessão registrada! ✅' });
      qc.invalidateQueries({ queryKey: ['studio-execucoes'] });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  return { execucoes, isLoading, registrarExecucao };
}

// ── Medidas ──────────────────────────────────────────────────────────────────
export function useStudioMedidas(pacienteId?: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: medidas = [], isLoading } = useQuery({
    queryKey: ['studio-medidas', pacienteId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('studio_medidas')
        .select('*')
        .eq('paciente_id', pacienteId!)
        .eq('terapeuta_id', user!.id)
        .order('data_medida', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!pacienteId,
  });

  const salvarMedida = useMutation({
    mutationFn: async (payload: any) => {
      const { data, error } = await (supabase as any)
        .from('studio_medidas')
        .insert({ ...payload, terapeuta_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Medidas salvas! ✅' });
      qc.invalidateQueries({ queryKey: ['studio-medidas'] });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  return { medidas, isLoading, salvarMedida };
}

// ── Notas do Educador ────────────────────────────────────────────────────────
export function useStudioNotas(pacienteId?: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: notas = [], isLoading } = useQuery({
    queryKey: ['studio-notas', pacienteId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('studio_notas')
        .select('*')
        .eq('paciente_id', pacienteId!)
        .eq('terapeuta_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!pacienteId,
  });

  const adicionarNota = useMutation({
    mutationFn: async (payload: { paciente_id: string; conteudo: string; tipo?: string }) => {
      const { data, error } = await (supabase as any)
        .from('studio_notas')
        .insert({ ...payload, terapeuta_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['studio-notas'] });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const deletarNota = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('studio_notas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['studio-notas'] }),
  });

  return { notas, isLoading, adicionarNota, deletarNota };
}

// ── Periodizações ────────────────────────────────────────────────────────────
export function useStudioPeriodizacoes(pacienteId?: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: periodizacoes = [], isLoading } = useQuery({
    queryKey: ['studio-periodizacoes', pacienteId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('studio_periodizacoes')
        .select('*')
        .eq('paciente_id', pacienteId!)
        .eq('terapeuta_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!pacienteId,
  });

  const criarPeriodizacao = useMutation({
    mutationFn: async (payload: any) => {
      const { data, error } = await (supabase as any)
        .from('studio_periodizacoes')
        .insert({ ...payload, terapeuta_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Periodização criada! ✅' });
      qc.invalidateQueries({ queryKey: ['studio-periodizacoes'] });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  return { periodizacoes, isLoading, criarPeriodizacao };
}
