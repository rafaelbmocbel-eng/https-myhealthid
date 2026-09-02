// O PostgREST (Supabase) corta cada resposta em 1000 linhas. Consultas que
// agregam TODAS as linhas de um terapeuta (agendamentos, sessões, etc.) para
// classificar/contar no cliente estouravam esse teto silenciosamente — trazendo
// só as primeiras 1000 e deixando dados de fora (ex.: pacientes sumindo da lista
// de inadimplentes). Este helper pagina em blocos de 1000 via `.range()` até
// buscar tudo (com um teto de segurança).
type PagedResult<T> = { data: T[] | null; error: unknown };

export async function selectTudoPaginado<T = any>(
  build: (from: number, to: number) => PromiseLike<PagedResult<T>>,
  opts: { pageSize?: number; max?: number } = {},
): Promise<T[]> {
  const pageSize = opts.pageSize ?? 1000;
  const max = opts.max ?? 6000;
  const acc: T[] = [];
  for (let from = 0; from < max; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw error;
    if (data?.length) acc.push(...data);
    if (!data || data.length < pageSize) break;
  }
  return acc;
}
