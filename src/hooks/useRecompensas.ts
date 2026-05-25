import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type NivelPaciente = 'bronze' | 'prata' | 'ouro' | 'platina' | 'diamante';
export type ResgateStatus = 'solicitado' | 'aprovado' | 'entregue' | 'cancelado';

export interface RecompensaCatalogo {
  id: string;
  terapeuta_id: string;
  titulo: string;
  descricao: string | null;
  xp_custo: number;
  estoque: number | null;
  nivel_minimo: NivelPaciente;
  ativa: boolean;
  ordem: number;
  created_at: string;
}

export interface RecompensaResgate {
  id: string;
  paciente_id: string;
  terapeuta_id: string;
  recompensa_id: string;
  xp_gasto: number;
  status: ResgateStatus;
  observacao: string | null;
  resgatado_em: string;
  entregue_em: string | null;
  recompensa?: { titulo: string; descricao: string | null };
  paciente?: { nome: string; sobrenome: string };
}

export const NIVEIS_ORDEM: NivelPaciente[] = ['bronze', 'prata', 'ouro', 'platina', 'diamante'];
export const NIVEL_LIMITES: Record<NivelPaciente, number> = {
  bronze: 0, prata: 200, ouro: 500, platina: 1000, diamante: 2000,
};
export const NIVEL_LABEL: Record<NivelPaciente, string> = {
  bronze: 'Bronze', prata: 'Prata', ouro: 'Ouro', platina: 'Platina', diamante: 'Diamante',
};
export const NIVEL_COR: Record<NivelPaciente, string> = {
  bronze: 'text-amber-700 bg-amber-100',
  prata: 'text-slate-600 bg-slate-100',
  ouro: 'text-yellow-600 bg-yellow-100',
  platina: 'text-cyan-700 bg-cyan-100',
  diamante: 'text-violet-700 bg-violet-100',
};

export function proximoNivel(xp: number): { proximo: NivelPaciente | null; faltam: number } {
  for (const nivel of NIVEIS_ORDEM) {
    if (xp < NIVEL_LIMITES[nivel]) {
      return { proximo: nivel, faltam: NIVEL_LIMITES[nivel] - xp };
    }
  }
  return { proximo: null, faltam: 0 };
}

/** Hook para profissional gerenciar catálogo */
export function useRecompensasCatalogoPro() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: catalogo = [], isLoading } = useQuery({
    queryKey: ['recompensas-catalogo-pro', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('recompensas_catalogo')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .order('ordem', { ascending: true })
        .order('xp_custo', { ascending: true });
      if (error) throw error;
      return (data || []) as RecompensaCatalogo[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (rec: Partial<RecompensaCatalogo> & { titulo: string; xp_custo: number }) => {
      const payload = { ...rec, terapeuta_id: user!.id };
      const { data, error } = rec.id
        ? await (supabase as any).from('recompensas_catalogo').update(payload).eq('id', rec.id).select().single()
        : await (supabase as any).from('recompensas_catalogo').insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recompensas-catalogo-pro'] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('recompensas_catalogo').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recompensas-catalogo-pro'] }),
  });

  return { catalogo, isLoading, upsert: upsert.mutateAsync, remove: remove.mutateAsync, saving: upsert.isPending };
}

/** Hook para profissional ver resgates */
export function useResgatesPro() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: resgates = [], isLoading } = useQuery({
    queryKey: ['recompensas-resgates-pro', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('recompensas_resgates')
        .select('*, recompensa:recompensas_catalogo(titulo,descricao), paciente:pacientes(nome,sobrenome)')
        .eq('terapeuta_id', user!.id)
        .order('resgatado_em', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as RecompensaResgate[];
    },
  });

  const atualizarStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ResgateStatus }) => {
      const patch: any = { status };
      if (status === 'entregue') patch.entregue_em = new Date().toISOString();
      const { error } = await (supabase as any).from('recompensas_resgates').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recompensas-resgates-pro'] }),
  });

  return { resgates, isLoading, atualizarStatus: atualizarStatus.mutateAsync };
}

/** Hook para paciente ver catálogo do seu terapeuta + seus resgates */
export function useRecompensasPaciente(pacienteId?: string) {
  const qc = useQueryClient();

  const { data: catalogo = [], isLoading: loadingCat } = useQuery({
    queryKey: ['recompensas-catalogo-paciente', pacienteId],
    enabled: !!pacienteId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('recompensas_catalogo')
        .select('*')
        .eq('ativa', true)
        .order('xp_custo', { ascending: true });
      if (error) throw error;
      return (data || []) as RecompensaCatalogo[];
    },
  });

  const { data: meusResgates = [], isLoading: loadingResg } = useQuery({
    queryKey: ['recompensas-resgates-paciente', pacienteId],
    enabled: !!pacienteId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('recompensas_resgates')
        .select('*, recompensa:recompensas_catalogo(titulo,descricao)')
        .eq('paciente_id', pacienteId)
        .order('resgatado_em', { ascending: false });
      if (error) throw error;
      return (data || []) as RecompensaResgate[];
    },
  });

  const resgatar = useMutation({
    mutationFn: async (recompensaId: string) => {
      const { error } = await (supabase as any).from('recompensas_resgates').insert({
        paciente_id: pacienteId,
        recompensa_id: recompensaId,
        terapeuta_id: '00000000-0000-0000-0000-000000000000', // trigger sobrescreve
        xp_gasto: 0, // trigger sobrescreve
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recompensas-resgates-paciente'] });
      qc.invalidateQueries({ queryKey: ['paciente-xp'] });
    },
  });

  return {
    catalogo,
    meusResgates,
    isLoading: loadingCat || loadingResg,
    resgatar: resgatar.mutateAsync,
    resgatando: resgatar.isPending,
  };
}

/** Hook para ler XP + nível do paciente */
export function usePacienteXP(pacienteId?: string) {
  return useQuery({
    queryKey: ['paciente-xp', pacienteId],
    enabled: !!pacienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pacientes')
        .select('xp_total, nivel_atual')
        .eq('id', pacienteId!)
        .single();
      if (error) throw error;
      return data as { xp_total: number; nivel_atual: NivelPaciente };
    },
  });
}
