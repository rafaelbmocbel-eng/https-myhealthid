import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ConfiguracaoNaoSalva, codigosParaSalvar, type EscolhaDoModelo } from '@/lib/cassiModeloConfig';
import type { CodigoFaturavel } from '@/lib/cassiFaturamento';

type Resposta<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;
interface TabelaConfig {
  select: (colunas: string) => { eq: (coluna: string, valor: string) => { maybeSingle: () => Resposta<{ codigos: unknown }> } };
  update: (valores: Record<string, unknown>) => {
    eq: (coluna: string, valor: string) => { select: (colunas: string) => Resposta<Array<{ terapeuta_id: string }>> };
  };
}
// cassi_config ainda não está nos tipos gerados do cliente: este é o formato mínimo que a gravação usa.
const tabelaConfig = () => (supabase as unknown as { from: (tabela: string) => TabelaConfig }).from('cassi_config');

/**
 * Grava a escolha dos códigos pré-preenchidos na configuração do profissional. Mexe SÓ na coluna `codigos`, e parte do que está
 * no banco neste instante (não da tela): uma edição feita em outro aparelho não é sobrescrita. Não cria configuração; e só dá
 * por salvo se exatamente 1 linha foi atingida (o banco não reclama quando nenhuma linha casa).
 */
export async function gravarModeloDaGuia(uid: string, escolha: EscolhaDoModelo | null, catalogo: ReadonlyArray<CodigoFaturavel>): Promise<void> {
  const lida = await tabelaConfig().select('codigos').eq('terapeuta_id', uid).maybeSingle();
  if (lida.error) throw new Error(`a leitura das suas configurações falhou (${lida.error.message})`);
  if (!lida.data) throw new ConfiguracaoNaoSalva();
  const codigos = codigosParaSalvar(lida.data.codigos, escolha, catalogo);
  const gravada = await tabelaConfig().update({ codigos, updated_at: new Date().toISOString() }).eq('terapeuta_id', uid).select('terapeuta_id');
  if (gravada.error) throw new Error(gravada.error.message);
  if (!gravada.data || gravada.data.length !== 1) throw new Error('sua configuração não foi encontrada.');
}

// Gravação dos códigos pré-preenchidos. No sucesso a configuração é relida (a tela e as guias novas já usam a escolha).
export function useGravarModeloDaGuia() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ escolha, catalogo }: { escolha: EscolhaDoModelo | null; catalogo: ReadonlyArray<CodigoFaturavel> }) => {
      if (!user) throw new Error('Sem sessão');
      await gravarModeloDaGuia(user.id, escolha, catalogo);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cassi-config', user?.id] }),
    // Sem rede a gravação falha na hora, em vez de ficar pausada com o botão em "Salvando…" para sempre.
    networkMode: 'always',
  });
}
