import { format } from '@/lib/dateSafe';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { reprocessarComplemento } from './reprocessarComplemento';

const ROTULOS: Record<string, string> = {
  resumo_clinico: 'Resumo Clínico',
  dor: 'Análise da Dor',
  funcionalidade: 'Funcionalidade',
  psicossocial: 'Fatores Psicossociais',
  red_flags: 'Red Flags',
  hipoteses: 'Hipóteses Diagnósticas',
  cif: 'Mapeamento CIF',
  insights: 'Insights',
};

const MARCADOR_EDICAO = /\n*--- Edição do profissional \([^)]*\) ---[\s\S]*?(?=\n\n--- |$)/g;

// Edições feitas à mão fora do próprio plano (quadro clínico, dor...). O plano
// só é refeito a partir delas; a seção 'diretriz' editada já É o plano.
export function edicoesClinicas(resultado: any): Record<string, string> {
  const editadas = resultado?._secoes?.editadas || {};
  return Object.fromEntries(
    Object.entries(editadas).filter(([k, v]) => k !== 'diretriz' && typeof v === 'string' && v.trim()),
  ) as Record<string, string>;
}

/** O profissional editou a avaliação depois da última vez que o plano foi refeito. */
export function planoDesatualizado(resultado: any): boolean {
  if (!Object.keys(edicoesClinicas(resultado)).length) return false;
  const sincronizado = resultado?._secoes?.plano_sincronizado_em;
  if (!sincronizado) return true;
  const editado = resultado?._secoes?.editadas_em;
  return !!editado && new Date(editado).getTime() > new Date(sincronizado).getTime();
}

/**
 * Refaz a avaliação (inclusive o plano de reabilitação em fases) usando as edições
 * do profissional como bloco prioritário, e reaplica as edições por cima.
 */
export async function atualizarPlanoComEdicoes(params: {
  avaliacaoId: string;
  terapeutaId: string;
  editadas?: Record<string, string>;
  rotulos?: Record<string, string>;
}) {
  const { data: row, error } = await (supabase as any)
    .from('avaliacoes_voz')
    .select('id, paciente_id, resultado, transcricao, servico, queixa_principal, classificacao_severidade')
    .eq('id', params.avaliacaoId)
    .maybeSingle();
  if (error) throw error;
  if (!row) throw new Error('Avaliação não encontrada.');

  const resultado = typeof row.resultado === 'string' ? JSON.parse(row.resultado) : (row.resultado || {});
  const editadas = params.editadas
    ? Object.fromEntries(Object.entries(params.editadas).filter(([k, v]) => k !== 'diretriz' && (v || '').trim()))
    : edicoesClinicas(resultado);
  const rotulos = { ...ROTULOS, ...(params.rotulos || {}) };
  const complemento = Object.entries(editadas)
    .map(([k, v]) => `${rotulos[k] || k}: ${String(v).trim()}`)
    .join('\n\n');
  if (!complemento) throw new Error('Nenhuma edição para levar ao plano.');

  const { data: pac } = await (supabase as any).from('pacientes').select('nome').eq('id', row.paciente_id).maybeSingle();

  const stamp = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  // As edições são reenviadas inteiras a cada atualização; remove o bloco
  // anterior para a transcrição não acumular cópias.
  const base = String(row.transcricao || '').replace(MARCADOR_EDICAO, '');
  const merged = `${base}\n\n--- Edição do profissional (${stamp}) ---\n${complemento}`;

  await reprocessarComplemento({
    avaliacaoId: row.id,
    pacienteId: row.paciente_id,
    terapeutaId: params.terapeutaId,
    patientName: pac?.nome || 'Paciente',
    serviceType: row.servico || 'identidade',
    finalTranscript: merged,
    prevResultado: resultado,
    prevQueixaPrincipal: row.queixa_principal,
    prevSeveridade: row.classificacao_severidade,
    notaProntuarioTitulo: `Avaliação atualizada com edições do profissional — ${row.classificacao_severidade || 'N/A'}`,
    notaProntuarioDescricao: `📝 Plano de tratamento refeito com as edições do profissional.\n\n${complemento.slice(0, 500)}`,
  });

  // Reaplica as edições (a IA não pode apagá-las) e marca o plano como em dia.
  const { data: novo } = await (supabase as any).from('avaliacoes_voz').select('resultado').eq('id', row.id).maybeSingle();
  const r = (novo?.resultado as any) || {};
  const agora = new Date().toISOString();
  await (supabase as any).from('avaliacoes_voz').update({
    resultado: {
      ...r,
      _secoes: {
        ...(r._secoes || {}),
        editadas: { ...(r._secoes?.editadas || {}), ...(params.editadas || {}) },
        plano_sincronizado_em: agora,
      },
    },
  }).eq('id', row.id);
}
