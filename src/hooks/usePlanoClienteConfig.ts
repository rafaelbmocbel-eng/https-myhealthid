import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { CONFIG_PLANO_CLIENTE_PADRAO, type ConfigPlanoCliente } from '@/lib/chancela';
import { buscarConfigPlanoCliente } from '@/lib/chancelaApi';

export const CHAVE_CONFIG_PLANO_CLIENTE = ['plano-cliente-config'] as const;
export const CONFIG_PLANO_CLIENTE_STALE_MS = 60 * 1000;

/**
 * Configuração do plano do cliente Premium (RPC `plano_cliente_config`):
 * - `nutricao_premium_ativa`: o plano nutricional Premium já está disponível?
 * - `prazo_chancela_dias_uteis`: prazo da equipe para chancelar, em dias úteis.
 *
 * Enquanto carrega, e quando a leitura falha, `config` é o padrão SEGURO (nutrição desligada,
 * prazo de 2 dias úteis): na dúvida, nada de nutrição chega ao cliente. A falha fica como erro da
 * consulta (`falhou`), não como padrão em cache: a próxima montagem ou o foco da janela tenta de novo.
 */
export function usePlanoClienteConfig(): { config: ConfigPlanoCliente; loading: boolean; falhou: boolean } {
  const { user } = useAuth();
  const userId = user?.id;

  const { data, isLoading, isError } = useQuery({
    queryKey: [...CHAVE_CONFIG_PLANO_CLIENTE, userId],
    enabled: !!userId,
    staleTime: CONFIG_PLANO_CLIENTE_STALE_MS,
    retry: false,
    queryFn: buscarConfigPlanoCliente,
  });

  return { config: data ?? CONFIG_PLANO_CLIENTE_PADRAO, loading: !!userId && isLoading, falhou: isError };
}
