import { useQuery } from '@tanstack/react-query';
import { useEquipeCientifica } from '@/hooks/useEquipeCientifica';
import { INTERVALO_PENDENTES_MS } from '@/lib/chancela';
import { contarPendentesChancela } from '@/lib/chancelaApi';

export const CHAVE_PENDENTES_CHANCELA = ['chancela-pendentes'] as const;

/** Quantos planos aguardam chancela. Só consulta para quem é da equipe científica. */
export function useChancelaPendentes(): number {
  const { ehEquipe } = useEquipeCientifica();
  const { data } = useQuery({
    queryKey: CHAVE_PENDENTES_CHANCELA,
    enabled: ehEquipe,
    staleTime: INTERVALO_PENDENTES_MS / 2,
    refetchInterval: INTERVALO_PENDENTES_MS,
    retry: false,
    queryFn: async () => {
      try {
        return await contarPendentesChancela();
      } catch {
        // Contador é só um aviso: falha de rede não deve gerar erro na tela.
        return 0;
      }
    },
  });
  return ehEquipe ? data ?? 0 : 0;
}
