import type { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ReprocessarComplementoInput {
  avaliacaoId: string;
  pacienteId: string;
  terapeutaId: string;
  patientName: string;
  serviceType: string;
  /** Transcrição final já mesclada (texto anterior + complemento), pronta para reprocessar. */
  finalTranscript: string;
  audioBase64?: string;
  audioMimeType?: string;
  prevResultado?: unknown;
  prevQueixaPrincipal?: string | null;
  prevSeveridade?: string | null;
  notaProntuarioTitulo: string;
  notaProntuarioDescricao: string;
}

export interface ReprocessarComplementoResult {
  assessment: any;
  transcricaoFinal: string;
  painFindingsCount: number;
}

/**
 * Reprocessa uma avaliação por voz/texto já existente após receber um complemento
 * (novo áudio ou texto). Centraliza em um único lugar tudo que uma atualização de
 * avaliação precisa fazer — reanalisar com a IA, re-extrair o mapa de dor, manter o
 * Avatar Clínico sincronizado e registrar no prontuário — para evitar que cada tela
 * que oferece "Complementar avaliação" implemente (e esqueça) esses passos de forma diferente.
 */
export async function reprocessarComplemento(
  input: ReprocessarComplementoInput,
): Promise<ReprocessarComplementoResult> {
  const body: Record<string, unknown> = {
    transcript: input.finalTranscript,
    serviceType: input.serviceType,
    patientName: input.patientName,
  };
  if (input.audioBase64) {
    body.audioBase64 = input.audioBase64;
    body.audioMimeType = input.audioMimeType || 'audio/webm';
  }

  const { data, error } = await supabase.functions.invoke('voice-assessment', { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  if (!data?.assessment) throw new Error('A IA não retornou uma avaliação válida.');

  const cleanResult = JSON.parse(JSON.stringify(data.assessment));
  const transcricaoFinal: string = data.transcricao && data.transcricao.length > input.finalTranscript.length
    ? data.transcricao
    : input.finalTranscript;

  // Re-extrai o mapa de dor a partir da transcrição final, para manter o Avatar Clínico sincronizado
  let painFindings: Array<{ region_id: string; intensity: number; structures: string[] }> = [];
  try {
    const { REGIONS, STRUCTURES } = await import('@/components/presencial/Body3DAvatar');
    const regions = REGIONS.map(r => ({ id: r.id, label: `${r.label} (${r.view === 'back' ? 'posterior' : 'anterior'})` }));
    const catalog = Object.fromEntries(
      Object.entries(STRUCTURES).map(([rid, cats]) => [rid, { categories: cats as Record<string, string[]> }]),
    );
    const { data: painData, error: painErr } = await supabase.functions.invoke('extract-pain-from-voice', {
      body: { transcript: transcricaoFinal, regions, catalog },
    });
    if (painErr || painData?.error) throw new Error(painData?.error || painErr?.message || 'Falha na extração de dor');
    painFindings = painData?.findings || [];
  } catch (e) {
    console.warn('[reprocessarComplemento] extração de dor falhou', e);
  }

  const prevMeta = (input.prevResultado as any)?._meta || {};
  const mapaDor: Record<string, number> | null = painFindings.length > 0
    ? Object.fromEntries(painFindings.map(f => [f.region_id, f.intensity]))
    : prevMeta.mapa_dor ?? null;
  cleanResult._meta = {
    ...prevMeta,
    ...(cleanResult._meta || {}),
    savedAt: new Date().toISOString(),
    mapa_dor: mapaDor,
  };

  const { error: updErr } = await (supabase as any).from('avaliacoes_voz').update({
    resultado: cleanResult,
    transcricao: transcricaoFinal,
    queixa_principal: cleanResult.queixa_principal || input.prevQueixaPrincipal,
    classificacao_severidade: cleanResult.classificacao_severidade || input.prevSeveridade,
  }).eq('id', input.avaliacaoId);
  if (updErr) throw updErr;

  // Atualiza o Avatar Clínico com as novas regiões de dor, sem duplicar achados já existentes
  if (painFindings.length > 0) {
    try {
      const { data: existentes } = await supabase
        .from('eventos_clinicos_anatomicos' as any)
        .select('regiao_id')
        .eq('paciente_id', input.pacienteId);
      const jaExistem = new Set((existentes || []).map((e: any) => e.regiao_id as string));
      const novos = painFindings.filter(f => !jaExistem.has(f.region_id));
      if (novos.length > 0) {
        const hoje = new Date().toISOString().split('T')[0];
        const eventos = novos.map(f => ({
          paciente_id: input.pacienteId,
          terapeuta_id: input.terapeutaId,
          regiao_id: f.region_id,
          sistema: 'musculoesqueletico',
          tipo_achado: cleanResult.queixa_principal || 'Complemento de avaliação por voz — IA',
          tipo_diagnostico: 'achado_clinico',
          severidade: Math.min(5, Math.max(1, Math.round(f.intensity / 2))),
          status: 'ativo',
          origem: 'voz_ia',
          data_inicio: hoje,
          notas_clinicas: cleanResult.resumo_clinico || null,
          visivel_paciente: false,
          metadata: { termo: f.structures?.join(', ') || 'dor relatada', avaliacao_origem: 'voz_ia_complemento' },
        }));
        const { error: insErr } = await supabase.from('eventos_clinicos_anatomicos' as any).insert(eventos);
        if (insErr) throw insErr;
      }
    } catch (e) {
      console.warn('[reprocessarComplemento] atualização do avatar clínico falhou', e);
    }
  }

  try {
    await (supabase as any).from('notas_prontuario').insert({
      paciente_id: input.pacienteId,
      terapeuta_id: input.terapeutaId,
      tipo: 'avaliacao_voz',
      titulo: input.notaProntuarioTitulo,
      descricao: input.notaProntuarioDescricao,
      dados_extras: { voice_assessment_id: input.avaliacaoId },
      referencia_id: input.avaliacaoId,
    });
  } catch { /* nota já pode existir para esta avaliação — duplicata não é crítica */ }

  return { assessment: cleanResult, transcricaoFinal, painFindingsCount: painFindings.length };
}

/** Invalida todas as caches que dependem de uma avaliação por voz/texto — avaliação, timeline, insights e avatar clínico. */
export function invalidarCachesAvaliacaoVoz(qc: QueryClient, pacienteId: string) {
  qc.invalidateQueries({ queryKey: ['avaliacao-voz-latest'] });
  qc.invalidateQueries({ queryKey: ['avaliacao-voz-latest-presencial'] });
  qc.invalidateQueries({ queryKey: ['avaliacoes-voz-presencial'] });
  qc.invalidateQueries({ queryKey: ['avaliacoes-voz'] });
  qc.invalidateQueries({ queryKey: ['eventos-anatomicos', pacienteId] });
  qc.invalidateQueries({ queryKey: ['eventos-anatomicos-count', pacienteId] });
  qc.invalidateQueries({ queryKey: ['timeline_completa', pacienteId] });
  qc.invalidateQueries({ queryKey: ['paciente-insights-aval', pacienteId] });
  qc.invalidateQueries({ queryKey: ['paciente-insights-avatar', pacienteId] });
  qc.invalidateQueries({ queryKey: ['notas-prontuario'] });
  qc.invalidateQueries({ queryKey: ['evolucao-paciente'] });
  qc.invalidateQueries({ queryKey: ['prontuario'] });
}
