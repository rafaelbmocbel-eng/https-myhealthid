import { supabase } from '@/integrations/supabase/client';

// Lead real = contato que ainda NÃO era cliente quando a conversa começou.
// Cliente antigo falando da sessão fica no Zap, mas fora do funil de vendas e
// das métricas. Lead que virou cliente depois continua (é a conversão).
// Margem de 1 min: a ficha criada junto com a conversa ainda conta como lead.
export async function filtrarLeadsReais<T extends { paciente_id: string | null; created_at?: string | null }>(
  convs: T[],
): Promise<T[]> {
  const pacIds = [...new Set(convs.map((c) => c.paciente_id).filter(Boolean))] as string[];
  const criadoEm: Record<string, string> = {};
  for (let i = 0; i < pacIds.length; i += 200) {
    const { data, error } = await supabase.from('pacientes').select('id, created_at').in('id', pacIds.slice(i, i + 200));
    if (error) throw error;
    (data || []).forEach((p) => { criadoEm[p.id] = p.created_at; });
  }
  return convs.filter((c) => {
    const pacCriado = c.paciente_id ? criadoEm[c.paciente_id] : null;
    return !pacCriado || !c.created_at || new Date(pacCriado).getTime() >= new Date(c.created_at).getTime() - 60_000;
  });
}
