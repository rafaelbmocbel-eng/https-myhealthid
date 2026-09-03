import { supabase } from '@/integrations/supabase/client';

// Credita XP no banco e LOGA se falhar. Antes cada chamada era um
// `void supabase.rpc('ganhar_xp', ...)` (dispara-e-esquece): se o crédito
// falhasse (rede/RLS), o toast já tinha dito "+XP" mas o saldo não mudava, e o
// cliente percebia a discrepância na próxima visita. Aqui a falha ao menos fica
// registrada no console para diagnóstico.
export function ganharXP(pacienteId: string, chave: string, xp: number): void {
  void (supabase as any)
    .rpc('ganhar_xp', { p_paciente_id: pacienteId, p_chave: chave, p_xp: xp })
    .then((r: any) => {
      if (r?.error) console.warn('[xp] falha ao creditar XP', { chave, xp, error: r.error });
    });
}
