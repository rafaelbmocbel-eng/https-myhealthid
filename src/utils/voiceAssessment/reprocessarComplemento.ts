import { supabase } from '@/integrations/supabase/client';

/**
 * Retorna o conjunto de `regiao_id` com achado ATIVO (não resolvido) no Avatar Clínico
 * do paciente. Achados com status 'resolvido' não contam como duplicata — uma dor que
 * já foi tratada e volta a aparecer deve gerar um novo registro, não ser silenciosamente
 * descartada por já ter existido um dia.
 */
export async function regioesAtivasNoAvatar(pacienteId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('eventos_clinicos_anatomicos' as any)
    .select('regiao_id, status')
    .eq('paciente_id', pacienteId);
  const ativas = new Set<string>();
  (data || []).forEach((e: any) => {
    if (e.status !== 'resolvido') ativas.add(e.regiao_id as string);
  });
  return ativas;
}
