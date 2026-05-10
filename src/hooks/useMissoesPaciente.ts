import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PacienteMissao {
  id: string;
  paciente_id: string;
  terapeuta_id: string;
  source_key: string | null;
  origem: 'myid' | 'presencial' | 'manual' | string;
  titulo: string;
  descricao: string | null;
  acao_imediata: string | null;
  categoria: 'urgente' | 'importante' | 'oportunidade' | 'positivo' | string;
  xp_recompensa: number;
  ativo: boolean;
  ordem: number;
  created_at: string;
  updated_at: string;
}

export interface MissaoOverride {
  titulo?: string;
  descricao?: string;
  acao_imediata?: string;
  ativo?: boolean;
}

/** Slugify any string to a stable source_key */
export function toSourceKey(prefix: string, raw: string) {
  const s = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `${prefix}:${s}`;
}

const queryKey = (pacienteId?: string) => ['paciente-missoes', pacienteId];

export function useMissoesPaciente(pacienteId?: string) {
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: queryKey(pacienteId),
    enabled: !!pacienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('paciente_missoes')
        .select('*')
        .eq('paciente_id', pacienteId!)
        .order('ordem', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as PacienteMissao[];
    },
  });

  // Realtime subscription so patient sees pro edits live
  useEffect(() => {
    if (!pacienteId) return;
    const channel = supabase
      .channel(`paciente-missoes-${pacienteId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'paciente_missoes', filter: `paciente_id=eq.${pacienteId}` },
        () => qc.invalidateQueries({ queryKey: queryKey(pacienteId) })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [pacienteId, qc]);

  const overrides: Record<string, PacienteMissao> = {};
  const manuais: PacienteMissao[] = [];
  for (const row of data) {
    if (row.source_key) overrides[row.source_key] = row;
    else manuais.push(row);
  }

  const upsertOverride = useMutation({
    mutationFn: async (params: {
      source_key: string;
      origem?: string;
      categoria: string;
      xp_recompensa: number;
      terapeuta_id: string;
      override: MissaoOverride;
      defaults: { titulo: string; descricao?: string; acao_imediata?: string };
    }) => {
      const existing = overrides[params.source_key];
      const payload = {
        paciente_id: pacienteId!,
        terapeuta_id: params.terapeuta_id,
        source_key: params.source_key,
        origem: params.origem || existing?.origem || 'myid',
        categoria: params.categoria,
        xp_recompensa: params.xp_recompensa,
        titulo: params.override.titulo ?? existing?.titulo ?? params.defaults.titulo,
        descricao: params.override.descricao ?? existing?.descricao ?? params.defaults.descricao ?? null,
        acao_imediata: params.override.acao_imediata ?? existing?.acao_imediata ?? params.defaults.acao_imediata ?? null,
        ativo: params.override.ativo ?? existing?.ativo ?? true,
      };
      const { error } = await supabase
        .from('paciente_missoes')
        .upsert(payload, { onConflict: 'paciente_id,source_key' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey(pacienteId) }),
  });

  const addManual = useMutation({
    mutationFn: async (params: {
      terapeuta_id: string;
      titulo: string;
      descricao?: string;
      acao_imediata?: string;
      categoria?: string;
      xp_recompensa?: number;
    }) => {
      const { error } = await supabase.from('paciente_missoes').insert({
        paciente_id: pacienteId!,
        terapeuta_id: params.terapeuta_id,
        source_key: null,
        origem: 'manual',
        titulo: params.titulo,
        descricao: params.descricao || null,
        acao_imediata: params.acao_imediata || null,
        categoria: params.categoria || 'importante',
        xp_recompensa: params.xp_recompensa ?? 10,
        ativo: true,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey(pacienteId) }),
  });

  const removeMissao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('paciente_missoes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey(pacienteId) }),
  });

  /**
   * Apply overrides to a list of auto-generated missions and append manual missions.
   * Inactive overrides cause the auto mission to be filtered out.
   */
  function mergeAuto<T extends { titulo: string; descricao?: string; acaoImediata?: string }>(
    autos: T[],
    getKey: (a: T) => string,
    toManual: (m: PacienteMissao) => T
  ): T[] {
    const merged: T[] = [];
    for (const auto of autos) {
      const key = getKey(auto);
      const ov = overrides[key];
      if (ov && ov.ativo === false) continue;
      if (ov) {
        merged.push({
          ...auto,
          titulo: ov.titulo ?? auto.titulo,
          descricao: ov.descricao ?? auto.descricao,
          acaoImediata: ov.acao_imediata ?? auto.acaoImediata,
        } as T);
      } else {
        merged.push(auto);
      }
    }
    for (const m of manuais.filter((x) => x.ativo)) merged.push(toManual(m));
    return merged;
  }

  return {
    rows: data,
    overrides,
    manuais,
    isLoading,
    upsertOverride,
    addManual,
    removeMissao,
    mergeAuto,
  };
}
