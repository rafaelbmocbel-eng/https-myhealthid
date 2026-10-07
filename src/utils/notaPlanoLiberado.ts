import { supabase } from '@/integrations/supabase/client';

// Grava uma nota no prontuário quando um plano (treino/reabilitação ou nutrição)
// é LIBERADO ao cliente — pra o plano entrar na evolução/prontuário e fechar o
// ciclo (avaliação → diretriz/plano → liberado → prontuário). Nunca bloqueia a
// liberação do plano em si: devolve true se a nota foi gravada e false se não
// (o supabase-js não lança em erro de RLS/rede, devolve { error }).
export async function registrarNotaPlanoLiberado(params: {
  pacienteId: string;
  terapeutaId: string;
  area: 'treino' | 'nutricao';
  titulo?: string | null;
  planoId?: string | null;
  // Versão do plano, risco da revisão de segurança, justificativa do profissional
  // etc. Entram em dados_extras sem sobrescrever area/plano_id/evento.
  dadosExtras?: Record<string, unknown> | null;
}): Promise<boolean> {
  const { pacienteId, terapeutaId, area, titulo, planoId, dadosExtras } = params;
  if (!pacienteId || !terapeutaId) return false;
  const areaLabel = area === 'treino' ? 'Plano de treino / reabilitação' : 'Plano nutricional';
  const nome = titulo || areaLabel;
  try {
    const { error } = await (supabase as any).from('notas_prontuario').insert({
      paciente_id: pacienteId,
      terapeuta_id: terapeutaId,
      // tipo reconhecido pelo prontuário (rótulo "Diretriz")
      tipo: 'conduta_diretriz',
      titulo: `${areaLabel} liberado — ${nome}`,
      descricao: `📋 ${areaLabel.toUpperCase()} LIBERADO AO CLIENTE\n\nPlano: ${nome}\n\nDisponibilizado no portal do cliente. Passa a fazer parte do plano terapêutico vigente.`,
      dados_extras: { ...(dadosExtras ?? {}), area, plano_id: planoId || null, evento: 'plano_liberado' },
      referencia_id: planoId || null,
    });
    if (error) {
      console.warn('[notaPlanoLiberado] não gravou a nota no prontuário:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[notaPlanoLiberado] falha ao gravar a nota no prontuário:', e);
    return false;
  }
}
