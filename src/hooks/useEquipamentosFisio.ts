import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tabela } from '@/lib/dosagem/db';
import { useAuth } from '@/contexts/AuthContext';
import type { EquipamentoFisio, Modalidade } from '@/lib/dosagem/tipos';

// A tabela equipamentos_fisio é nova: enquanto ela não existir no banco, o
// cadastro some e a calculadora segue funcionando com os valores digitados.
const tabelaAusente = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache/i.test(e.message || ''));

export function useEquipamentosFisio() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['equipamentos-fisio', user?.id],
    enabled: !!user,
    retry: false,
    queryFn: async (): Promise<{ disponivel: boolean; itens: EquipamentoFisio[] }> => {
      const { data, error } = await tabela('equipamentos_fisio').select('*').eq('ativo', true).order('nome');
      if (error) {
        if (tabelaAusente(error)) return { disponivel: false, itens: [] };
        throw error;
      }
      return { disponivel: true, itens: (data || []) as EquipamentoFisio[] };
    },
  });
}

export type NovoEquipamento = Omit<EquipamentoFisio, 'id' | 'ativo'> & { id?: string };

export function useSalvarEquipamento() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (e: NovoEquipamento) => {
      const { id, ...resto } = e;
      const corpo = { ...resto, terapeuta_id: user!.id };
      const q = id
        ? tabela('equipamentos_fisio').update(corpo).eq('id', id)
        : tabela('equipamentos_fisio').insert(corpo);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipamentos-fisio'] }),
  });
}

export function useRemoverEquipamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await tabela('equipamentos_fisio').update({ ativo: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equipamentos-fisio'] }),
  });
}

export const equipamentosDoTipo = (itens: EquipamentoFisio[] | undefined, tipo: Modalidade) =>
  (itens || []).filter((i) => i.tipo === tipo);
