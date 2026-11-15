import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { hojeLocalISO } from '@/lib/dataLocal';

// Conta só eventos ativos, igual ao portal do paciente (PacienteEventos) e aos lembretes:
// evento desativado pelo profissional não acontece, então não entra na contagem do dia.
// Em erro do banco devolve 0 (como a tela já fazia), mas deixa o aviso no console para o erro não sumir.
export async function contarEventosDeHoje(
  cliente: SupabaseClient<Database>,
  terapeutaId: string,
): Promise<number> {
  const { count, error } = await cliente
    .from('eventos')
    .select('id', { count: 'exact', head: true })
    .eq('terapeuta_id', terapeutaId)
    .eq('ativo', true)
    .eq('data_evento', hojeLocalISO());
  if (error) {
    console.warn('[hoje] não foi possível contar os eventos de hoje:', error);
    return 0;
  }
  return count || 0;
}
