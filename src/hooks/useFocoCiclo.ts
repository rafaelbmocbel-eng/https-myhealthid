import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { alternarDimensaoDoFoco, MAXIMO_DIMENSOES_FOCO } from '@/utils/myid/focoCiclo';

export interface FocoCiclo {
  id: string;
  paciente_id: string;
  avaliacao_base_id: string | null;
  dimensoes: string[];
  criado_em: string;
  encerrado_em: string | null;
}

const COLUNAS = 'id, paciente_id, avaliacao_base_id, dimensoes, criado_em, encerrado_em';
export const chaveFocoCiclo = (pacienteId: string | undefined) => ['myid-foco-ciclo', pacienteId] as const;

// A tabela myid_foco_ciclo ainda não está nos tipos gerados do Supabase.
const tabela = () => (supabase as any).from('myid_foco_ciclo');

// O CHECK do banco exige encerrado_em >= criado_em, e criado_em nasce com o relógio do servidor: com o relógio do aparelho
// atrasado, encerrar logo depois de criar falharia. Nunca envia um instante anterior ao início do ciclo.
const agoraNaoAntesDe = (inicio: string | undefined) => new Date(Math.max(Date.now(), inicio ? Date.parse(inicio) || 0 : 0)).toISOString();

/** Foco do ciclo do MyID de um paciente: o ciclo aberto do profissional logado e as ações sobre ele. */
export function useFocoCiclo(pacienteId: string | undefined, habilitado: boolean) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const consulta = useQuery({
    queryKey: chaveFocoCiclo(pacienteId),
    enabled: !!pacienteId && !!user && habilitado,
    queryFn: async (): Promise<FocoCiclo | null> => {
      const { data, error } = await tabela().select(COLUNAS).eq('paciente_id', pacienteId).is('encerrado_em', null).maybeSingle();
      if (error) throw error;
      return (data as FocoCiclo | null) ?? null;
    },
  });

  const aoTerminar = { onSettled: () => qc.invalidateQueries({ queryKey: chaveFocoCiclo(pacienteId) }) };
  const aoFalhar = () => toast({
    title: 'Não foi possível salvar o foco do ciclo',
    description: 'Tente de novo em instantes.',
    variant: 'destructive',
  });

  const alternar = useMutation({
    mutationFn: async ({ dimensao, avaliacaoAtualId }: { dimensao: string; avaliacaoAtualId: string | null }) => {
      const atual = consulta.data ?? null;
      const proximo = alternarDimensaoDoFoco(atual?.dimensoes ?? [], dimensao);
      if (!proximo.ok) return proximo;

      if (!atual) {
        const { error } = await tabela().insert({
          paciente_id: pacienteId, terapeuta_id: user!.id, avaliacao_base_id: avaliacaoAtualId, dimensoes: proximo.dimensoes,
        });
        if (error) throw error;
      } else if (proximo.dimensoes.length === 0) {
        // Tirar a última dimensão encerra o ciclo (o ciclo encerrado guarda o histórico).
        const { error } = await tabela().update({ encerrado_em: agoraNaoAntesDe(atual.criado_em) }).eq('id', atual.id);
        if (error) throw error;
      } else {
        const { error } = await tabela().update({ dimensoes: proximo.dimensoes }).eq('id', atual.id);
        if (error) throw error;
      }
      return proximo;
    },
    onSuccess: (r) => {
      if ('motivo' in r && r.motivo === 'limite') {
        toast({ title: `O foco vai até ${MAXIMO_DIMENSOES_FOCO} dimensões`, description: 'Retire uma para marcar outra.' });
      }
    },
    onError: aoFalhar,
    ...aoTerminar,
  });

  const encerrar = useMutation({
    mutationFn: async () => {
      const atual = consulta.data;
      if (!atual) return;
      const { error } = await tabela().update({ encerrado_em: agoraNaoAntesDe(atual.criado_em) }).eq('id', atual.id);
      if (error) throw error;
    },
    onError: aoFalhar,
    ...aoTerminar,
  });

  // Recomeça o ciclo a partir do MyID atual, com as mesmas dimensões, numa única atualização.
  const reiniciar = useMutation({
    mutationFn: async (avaliacaoAtualId: string) => {
      const atual = consulta.data;
      if (!atual) return;
      const { error } = await tabela()
        .update({ avaliacao_base_id: avaliacaoAtualId, criado_em: new Date().toISOString() })
        .eq('id', atual.id);
      if (error) throw error;
    },
    onError: aoFalhar,
    ...aoTerminar,
  });

  return {
    foco: consulta.data ?? null,
    carregando: consulta.isLoading,
    erro: consulta.isError,
    alternar,
    encerrar,
    reiniciar,
    ocupado: alternar.isPending || encerrar.isPending || reiniciar.isPending,
  };
}
