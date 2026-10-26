import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { selectTudoPaginado } from '@/lib/supabasePaginado';
import { normalizarLancamentos, type GuiaLancada } from '@/lib/cassiFaturamento';

const TABELA = 'cassi_financeiro_clientes';
const SEM_CLIENTES: ReadonlySet<string> = new Set<string>();
const SEM_LANCAMENTOS: ReadonlyMap<string, GuiaLancada[]> = new Map<string, GuiaLancada[]>();

// Lista de clientes de cada mês na aba Faturamento do Controle CASSI, com o que foi lançado em cada um (códigos e
// quantidades por guia). Lê os meses de `de` a `ate` ('AAAA-MM', inclusive).
export function useClientesFinanceiroCassi(de: string, ate: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const chave = ['cassi-financeiro-clientes', user?.id] as const;
  const invalidar = () => qc.invalidateQueries({ queryKey: chave });

  const consulta = useQuery({
    queryKey: [...chave, de, ate],
    queryFn: async () => {
      // Paginado e em ordem fixa: o PostgREST corta cada resposta em 1000 linhas sem avisar, e uma lista cortada
      // tiraria clientes da conta do mês em silêncio.
      const linhas = await selectTudoPaginado<{ mes: string; paciente_id: string; lancamentos: unknown }>((de1, ate1) =>
        (supabase as any).from(TABELA)
          .select('mes, paciente_id, lancamentos')
          .eq('terapeuta_id', user!.id)
          .gte('mes', de).lte('mes', ate)
          .order('mes', { ascending: true }).order('paciente_id', { ascending: true })
          .range(de1, ate1));
      const porMes = new Map<string, Map<string, GuiaLancada[]>>();
      for (const r of linhas) {
        if (!porMes.has(r.mes)) porMes.set(r.mes, new Map());
        porMes.get(r.mes)!.set(r.paciente_id, normalizarLancamentos(r.lancamentos));
      }
      return porMes;
    },
    enabled: !!user,
  });

  const porMes = consulta.data;
  // Os conjuntos são montados uma vez por leitura: quem chama pode usá-los como dependência de useMemo.
  const idsPorMes = useMemo(() => {
    const m = new Map<string, ReadonlySet<string>>();
    for (const [mes, clientes] of porMes ?? []) m.set(mes, new Set(clientes.keys()));
    return m;
  }, [porMes]);
  const doMes = useMemo(
    () => (mes: string): ReadonlySet<string> => idsPorMes.get(mes) ?? SEM_CLIENTES,
    [idsPorMes],
  );
  const lancamentosDoMes = useMemo(
    () => (mes: string): ReadonlyMap<string, GuiaLancada[]> => porMes?.get(mes) ?? SEM_LANCAMENTOS,
    [porMes],
  );

  // A lista é relida em qualquer desfecho (uma gravação que falha no meio de várias deixa parte feita). No sucesso a mutação espera a
  // leitura (o editor só fecha com a lista já nova); na falha não espera: o aviso e o botão voltam na hora, sem "Salvando…" até a releitura.
  // networkMode 'always': sem rede a gravação falha na hora em vez de ficar pausada com o botão em "Salvando…" para sempre.
  const relerSeFalhou = (_dados: unknown, erro: unknown) => {
    if (erro) { void invalidar(); return undefined; }
    return invalidar();
  };
  const aoFalhar = (acao: string) => (e: unknown) => {
    toast.error(`Não consegui ${acao}: ${(e as { message?: string })?.message || 'erro'}`);
  };

  const adicionar = useMutation({
    mutationFn: async ({ mes, ids }: { mes: string; ids: string[] }) => {
      if (ids.length === 0) return;
      const linhas = ids.map((id) => ({ terapeuta_id: user!.id, mes, paciente_id: id }));
      const { error } = await (supabase as any).from(TABELA)
        .upsert(linhas, { onConflict: 'terapeuta_id,mes,paciente_id', ignoreDuplicates: true });
      if (error) throw error;
    },
    onSettled: relerSeFalhou,
    networkMode: 'always',
    onError: aoFalhar('adicionar à lista'),
  });

  // Grava o lançamento (guias com códigos e quantidades) de um ou mais clientes do mês. Cada cliente é uma linha;
  // as gravações seguem juntas e, se alguma falhar, avisa e não esconde o erro. Com `somenteSeVazio` só grava em quem
  // continua sem lançamento no banco (preencher com a agenda não pode apagar o que outro aparelho lançou nesse meio-tempo):
  // quem já tinha fica intocado e volta em `pulados`.
  const lancar = useMutation<{ pulados: string[] }, unknown, { mes: string; itens: Array<{ id: string; guias: GuiaLancada[] }>; somenteSeVazio?: boolean }>({
    mutationFn: async ({ mes, itens, somenteSeVazio = false }) => {
      if (itens.length === 0) return { pulados: [] };
      const resultados = await Promise.all(itens.map(({ id, guias }) => {
        let q = (supabase as any).from(TABELA).update({ lancamentos: normalizarLancamentos(guias) })
          .eq('terapeuta_id', user!.id).eq('mes', mes).eq('paciente_id', id);
        // O valor vai como TEXTO: o PostgREST compara o jsonb da coluna com '[]' (um array viraria outro filtro).
        if (somenteSeVazio) q = q.eq('lancamentos', '[]');
        return q.select('paciente_id');
      }));
      const falha = resultados.find((r: { error?: unknown }) => r?.error);
      if (falha) throw falha.error;
      // O banco não reclama quando nenhuma linha casa (o cliente foi tirado da lista em outra tela): sem isto o
      // lançamento "salvaria" sem gravar nada.
      const semLinha = itens.map((item, i) => ({ id: item.id, vazio: !resultados[i]?.data || resultados[i].data.length === 0 })).filter((x) => x.vazio).map((x) => x.id);
      if (somenteSeVazio) return { pulados: semLinha };
      if (semLinha.length > 0) throw new Error('o cliente não está mais na lista deste mês');
      return { pulados: [] };
    },
    onSettled: relerSeFalhou,
    networkMode: 'always',
    onError: aoFalhar('salvar os códigos e as sessões'),
  });

  const remover = useMutation({
    mutationFn: async ({ mes, id }: { mes: string; id: string }) => {
      const { error } = await (supabase as any).from(TABELA).delete()
        .eq('terapeuta_id', user!.id).eq('mes', mes).eq('paciente_id', id);
      if (error) throw error;
    },
    onSettled: relerSeFalhou,
    networkMode: 'always',
    onError: aoFalhar('tirar da lista'),
  });

  const limpar = useMutation({
    mutationFn: async ({ mes }: { mes: string }) => {
      const { error } = await (supabase as any).from(TABELA).delete()
        .eq('terapeuta_id', user!.id).eq('mes', mes);
      if (error) throw error;
    },
    onSettled: relerSeFalhou,
    networkMode: 'always',
    onError: aoFalhar('limpar a lista'),
  });

  return {
    doMes,
    lancamentosDoMes,
    carregando: consulta.isLoading,
    // Só é erro se não há lista nenhuma para mostrar: uma busca em segundo plano que falha mantém a lista que já veio.
    erro: consulta.isError && !consulta.data,
    recarregar: () => consulta.refetch(),
    adicionar, lancar, remover, limpar,
    ocupado: adicionar.isPending || remover.isPending || limpar.isPending || lancar.isPending,
  };
}
