import { supabase } from '@/integrations/supabase/client';

// Grava uma nota no prontuário quando um plano (treino/reabilitação ou nutrição)
// é LIBERADO ao cliente — pra o plano entrar na evolução/prontuário e fechar o
// ciclo (avaliação → diretriz/plano → liberado → prontuário). Silenciosa em erro:
// nunca bloqueia a liberação do plano em si.
export async function registrarNotaPlanoLiberado(params: {
  pacienteId: string;
  terapeutaId: string;
  area: 'treino' | 'nutricao';
  titulo?: string | null;
  planoId?: string | null;
}): Promise<void> {
  const { pacienteId, terapeutaId, area, titulo, planoId } = params;
  if (!pacienteId || !terapeutaId) return;
  const areaLabel = area === 'treino' ? 'Plano de treino / reabilitação' : 'Plano nutricional';
  const nome = titulo || areaLabel;
  try {
    await (supabase as any).from('notas_prontuario').insert({
      paciente_id: pacienteId,
      terapeuta_id: terapeutaId,
      // tipo reconhecido pelo prontuário (rótulo "Diretriz")
      tipo: 'conduta_diretriz',
      titulo: `${areaLabel} liberado — ${nome}`,
      descricao: `📋 ${areaLabel.toUpperCase()} LIBERADO AO CLIENTE\n\nPlano: ${nome}\n\nDisponibilizado no portal do cliente. Passa a fazer parte do plano terapêutico vigente.`,
      dados_extras: { area, plano_id: planoId || null, evento: 'plano_liberado' },
      referencia_id: planoId || null,
    });
  } catch {
    // não bloqueia a liberação
  }
}
