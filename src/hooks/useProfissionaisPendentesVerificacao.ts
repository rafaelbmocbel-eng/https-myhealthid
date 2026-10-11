import { useQuery } from '@tanstack/react-query';
import { CHAVE_PROFISSIONAIS_ADMIN, INTERVALO_PENDENTES_MS, contarProfissionaisAdmin } from '@/lib/chancela';
import { buscarProfissionaisAdmin } from '@/lib/chancelaApi';

/**
 * Quantos profissionais aguardam verificação (registro informado, ainda sem verificação): o número do
 * rótulo da aba Administração. Divide a chave de cache com a lista da própria aba, então abrir a aba
 * não repete a chamada. Só consulta quando `habilitado` (o super-admin); falha vira 0, porque é só um aviso.
 */
export function useProfissionaisPendentesVerificacao(habilitado: boolean): number {
  const { data } = useQuery({
    queryKey: CHAVE_PROFISSIONAIS_ADMIN,
    enabled: habilitado,
    staleTime: 15_000,
    refetchInterval: INTERVALO_PENDENTES_MS,
    retry: false,
    queryFn: buscarProfissionaisAdmin,
  });
  return habilitado && data ? contarProfissionaisAdmin(data).pendentes : 0;
}
