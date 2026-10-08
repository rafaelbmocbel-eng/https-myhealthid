import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { eEquipeCientifica } from '@/lib/chancelaApi';

export const EQUIPE_CIENTIFICA_STALE_MS = 30 * 60 * 1000;

/**
 * True quando o usuário logado faz parte da equipe científica MyHealthID
 * (flag `profiles.equipe_cientifica`, via RPC `eh_equipe_cientifica`). Qualquer
 * falha conta como "não é da equipe": o banco é quem autoriza de fato. A falha
 * fica como ERRO da consulta (não como `false` em cache): a próxima montagem ou o
 * foco da janela tenta de novo, em vez de esconder a fila por `staleTime`.
 */
export function useEquipeCientifica(): { ehEquipe: boolean; loading: boolean } {
  const { user } = useAuth();
  const userId = user?.id;

  const { data, isLoading } = useQuery({
    queryKey: ['eh-equipe-cientifica', userId],
    enabled: !!userId,
    staleTime: EQUIPE_CIENTIFICA_STALE_MS,
    gcTime: EQUIPE_CIENTIFICA_STALE_MS,
    retry: false,
    queryFn: eEquipeCientifica,
  });

  return { ehEquipe: data === true, loading: !!userId && isLoading };
}
