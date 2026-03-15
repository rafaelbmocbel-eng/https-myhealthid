import { supabase } from '@/integrations/supabase/client';

/**
 * Gera automaticamente uma nota de prontuário quando uma sessão é confirmada.
 */
export async function gerarNotaSessaoConfirmada(params: {
  pacienteId: string;
  terapeutaId: string;
  dataAtendimento: string;
  tipoAtendimento?: string;
  duracaoMinutos?: number;
  observacoes?: string;
  condutaRealizada?: string;
  agendamentoId?: string;
}) {
  const { pacienteId, terapeutaId, dataAtendimento, tipoAtendimento, duracaoMinutos, observacoes, condutaRealizada, agendamentoId } = params;

  const descricao = `✅ ATENDIMENTO CONFIRMADO

📅 Data: ${new Date(dataAtendimento).toLocaleDateString('pt-BR')}
⏱️ Duração: ${duracaoMinutos || 45} minutos
🏷️ Tipo: ${tipoAtendimento || 'Retorno'}

${condutaRealizada ? `📋 CONDUTA REALIZADA:\n${condutaRealizada}\n` : ''}${observacoes ? `📝 Observações:\n${observacoes}` : ''}`;

  try {
    await (supabase as any).from('notas_prontuario').insert({
      paciente_id: pacienteId,
      terapeuta_id: terapeutaId,
      tipo: 'sessao_confirmada',
      titulo: `Sessão ${tipoAtendimento || 'Retorno'} — ${new Date(dataAtendimento).toLocaleDateString('pt-BR')}`,
      descricao,
      dados_extras: { agendamento_id: agendamentoId, duracao: duracaoMinutos, tipo: tipoAtendimento },
      referencia_id: agendamentoId || null,
    });
  } catch (err) {
    console.warn('Erro ao gerar nota de sessão:', err);
  }
}

/**
 * Gera nota de prontuário quando diário do paciente é preenchido (daily_log).
 */
export async function gerarNotaDiario(params: {
  pacienteId: string;
  terapeutaId: string;
  mood: number;
  pain: number;
  energy: number;
  sleepHours: number;
  notes?: string;
  logId?: string;
}) {
  const { pacienteId, terapeutaId, mood, pain, energy, sleepHours, notes, logId } = params;

  const moodLabels = ['', '😔 Muito Ruim', '😟 Ruim', '😐 Neutro', '🙂 Bom', '😊 Muito Bom'];
  const energyLabels = ['', '⚡ Muito Baixa', '⚡ Baixa', '⚡ Média', '⚡ Alta', '⚡ Muito Alta'];

  const descricao = `📱 DIÁRIO DO PACIENTE (Auto-reportado)

😊 Humor: ${moodLabels[mood] || mood}/5
🩹 Dor: ${pain}/10
⚡ Energia: ${energyLabels[energy] || energy}/5
😴 Sono: ${sleepHours}h
${notes ? `\n📝 Observações do paciente:\n"${notes}"` : ''}`;

  try {
    await (supabase as any).from('notas_prontuario').insert({
      paciente_id: pacienteId,
      terapeuta_id: terapeutaId,
      tipo: 'diario_paciente',
      titulo: `Diário — Dor ${pain}/10, Humor ${mood}/5, Sono ${sleepHours}h`,
      descricao,
      dados_extras: { mood, pain, energy, sleepHours, notes },
      referencia_id: logId || null,
    });
  } catch (err) {
    console.warn('Erro ao gerar nota de diário:', err);
  }
}

/**
 * Gera nota de prontuário quando avaliação profissional é salva.
 */
export async function gerarNotaAvaliacaoProfissional(params: {
  pacienteId: string;
  terapeutaId: string;
  tipoAvaliacao: 'identidade' | 'cob_zero';
  resumoScores: Record<string, number>;
  classificacao?: string;
  observacoes?: string;
  avaliacaoId?: string;
}) {
  const { pacienteId, terapeutaId, tipoAvaliacao, resumoScores, classificacao, observacoes, avaliacaoId } = params;

  const tipoLabel = tipoAvaliacao === 'identidade' ? 'Método Identidade' : 'COB° ZERO';

  const scoresText = Object.entries(resumoScores)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `• ${k}: ${Number(v).toFixed(1)}`)
    .join('\n');

  const descricao = `🩺 AVALIAÇÃO PROFISSIONAL — ${tipoLabel}

📊 SCORES REGISTRADOS:
${scoresText}

${classificacao ? `🎯 Classificação: ${classificacao}` : ''}
${observacoes ? `\n📝 Observações do profissional:\n${observacoes}` : ''}

Avaliação realizada presencialmente pelo terapeuta.`;

  try {
    await (supabase as any).from('notas_prontuario').insert({
      paciente_id: pacienteId,
      terapeuta_id: terapeutaId,
      tipo: 'avaliacao_profissional',
      titulo: `Avaliação ${tipoLabel}${classificacao ? ` — ${classificacao}` : ''}`,
      descricao,
      dados_extras: { tipo: tipoAvaliacao, scores: resumoScores, classificacao },
      referencia_id: avaliacaoId || null,
    });
  } catch (err) {
    console.warn('Erro ao gerar nota de avaliação profissional:', err);
  }
}

/**
 * Gera nota quando treino é executado pelo paciente.
 */
export async function gerarNotaTreinoExecutado(params: {
  pacienteId: string;
  terapeutaId: string;
  treinoTitulo: string;
  duracaoMinutos?: number;
  notaDor?: number;
  feedbackAluno?: string;
  execucaoId?: string;
}) {
  const { pacienteId, terapeutaId, treinoTitulo, duracaoMinutos, notaDor, feedbackAluno, execucaoId } = params;

  const descricao = `🏋️ TREINO EXECUTADO PELO PACIENTE

📋 Treino: ${treinoTitulo}
${duracaoMinutos ? `⏱️ Duração: ${duracaoMinutos} minutos` : ''}
${notaDor !== undefined ? `🩹 Dor durante: ${notaDor}/10` : ''}
${feedbackAluno ? `\n💬 Feedback do paciente:\n"${feedbackAluno}"` : ''}`;

  try {
    await (supabase as any).from('notas_prontuario').insert({
      paciente_id: pacienteId,
      terapeuta_id: terapeutaId,
      tipo: 'treino_executado',
      titulo: `Treino "${treinoTitulo}" executado${notaDor !== undefined ? ` — Dor ${notaDor}/10` : ''}`,
      descricao,
      dados_extras: { treino: treinoTitulo, duracao: duracaoMinutos, dor: notaDor },
      referencia_id: execucaoId || null,
    });
  } catch (err) {
    console.warn('Erro ao gerar nota de treino:', err);
  }
}

/**
 * Gera nota de conduta baseada em diretriz de tratamento.
 */
export async function gerarNotaConduta(params: {
  pacienteId: string;
  terapeutaId: string;
  diretrizTitulo: string;
  faseTratamento?: string;
  tecnicasAplicadas?: string[];
  observacoes?: string;
  protocoloId?: string;
}) {
  const { pacienteId, terapeutaId, diretrizTitulo, faseTratamento, tecnicasAplicadas, observacoes, protocoloId } = params;

  const tecnicasText = tecnicasAplicadas && tecnicasAplicadas.length > 0
    ? tecnicasAplicadas.map(t => `• ${t}`).join('\n')
    : 'Não especificadas';

  const descricao = `🧠 CONDUTA BASEADA EM DIRETRIZ DE TRATAMENTO

📋 Diretriz: ${diretrizTitulo}
${faseTratamento ? `📌 Fase: ${faseTratamento}` : ''}

🔧 TÉCNICAS APLICADAS:
${tecnicasText}

${observacoes ? `📝 Observações:\n${observacoes}` : ''}`;

  try {
    await (supabase as any).from('notas_prontuario').insert({
      paciente_id: pacienteId,
      terapeuta_id: terapeutaId,
      tipo: 'conduta_diretriz',
      titulo: `Conduta — ${diretrizTitulo}${faseTratamento ? ` (${faseTratamento})` : ''}`,
      descricao,
      dados_extras: { diretriz: diretrizTitulo, fase: faseTratamento, tecnicas: tecnicasAplicadas },
      referencia_id: protocoloId || null,
    });
  } catch (err) {
    console.warn('Erro ao gerar nota de conduta:', err);
  }
}
