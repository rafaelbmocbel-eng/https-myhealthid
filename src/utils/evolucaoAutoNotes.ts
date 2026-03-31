import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Gera nota de evolução automática quando sessão é marcada como "Atendido".
 * Inclui "conduta mantida" + referência à diretriz vigente + fase atual.
 */
export async function gerarEvolucaoSessaoConcluida(params: {
  pacienteId: string;
  terapeutaId: string;
  dataAtendimento: string;
  tipoAtendimento?: string;
  duracaoMinutos?: number;
  agendamentoId?: string;
}) {
  const { pacienteId, terapeutaId, dataAtendimento, tipoAtendimento, duracaoMinutos, agendamentoId } = params;

  try {
    // Fetch active guideline
    const { data: diretriz } = await (supabase as any)
      .from('protocolos')
      .select('id, titulo, objetivo_geral, frequencia, duracao_total, scores_avaliacao')
      .eq('paciente_id', pacienteId)
      .eq('terapeuta_id', terapeutaId)
      .eq('status', 'ativo')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Fetch current phase progression
    let faseInfo = '';
    if (diretriz?.id) {
      const { data: progressao } = await (supabase as any)
        .from('protocolo_progressao')
        .select('fase_atual, semana_atual')
        .eq('protocolo_id', diretriz.id)
        .maybeSingle();

      if (progressao) {
        faseInfo = `\n📌 Fase atual: ${progressao.fase_atual} · Semana ${progressao.semana_atual}`;
      }
    }

    const dataFormatada = format(new Date(dataAtendimento), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    const tipo = tipoAtendimento || 'Retorno';

    let descricao: string;

    if (diretriz) {
      descricao = `📝 EVOLUÇÃO — Sessão ${tipo}

📅 ${dataFormatada}
⏱️ Duração: ${duracaoMinutos || 45} min

✅ CONDUTA TERAPÊUTICA MANTIDA
Diretriz vigente: ${diretriz.titulo}
Objetivo: ${diretriz.objetivo_geral || 'N/I'}${faseInfo}

Atendimento realizado conforme plano terapêutico vigente. Sem alterações na conduta.`;
    } else {
      descricao = `📝 EVOLUÇÃO — Sessão ${tipo}

📅 ${dataFormatada}
⏱️ Duração: ${duracaoMinutos || 45} min

✅ Atendimento realizado.
⚠️ Sem diretriz de tratamento vigente associada.`;
    }

    await (supabase as any).from('notas_prontuario').insert({
      paciente_id: pacienteId,
      terapeuta_id: terapeutaId,
      tipo: 'evolucao',
      titulo: `Evolução — ${tipo} ${format(new Date(dataAtendimento), 'dd/MM/yyyy', { locale: ptBR })}`,
      descricao,
      dados_extras: {
        agendamento_id: agendamentoId,
        duracao: duracaoMinutos,
        tipo_atendimento: tipoAtendimento,
        diretriz_id: diretriz?.id || null,
        conduta_mantida: !!diretriz,
      },
      referencia_id: agendamentoId || null,
    });
  } catch (err) {
    console.warn('Erro ao gerar evolução automática:', err);
  }
}

/**
 * Gera nota de evolução quando uma nova diretriz é criada.
 * Resume objetivo, fases e técnicas.
 */
export async function gerarEvolucaoDiretrizCriada(params: {
  pacienteId: string;
  terapeutaId: string;
  protocoloId: string;
  titulo: string;
  objetivo: string;
  duracaoTotal: string;
  frequencia: string;
  totalFases: number;
  totalTecnicas: number;
  totalExercicios: number;
  fasesResumo: string;
  demandas?: string;
}) {
  const {
    pacienteId, terapeutaId, protocoloId, titulo, objetivo,
    duracaoTotal, frequencia, totalFases, totalTecnicas,
    totalExercicios, fasesResumo, demandas,
  } = params;

  try {
    const descricao = `📋 NOVA DIRETRIZ DE TRATAMENTO

🔄 ${titulo}
🎯 Objetivo: ${objetivo}
📆 Duração: ${duracaoTotal} · Frequência: ${frequencia}
${demandas ? `⚡ Demandas prioritárias: ${demandas}` : ''}

📊 Estrutura: ${totalFases} fases, ${totalTecnicas} técnicas, ${totalExercicios} exercícios
${fasesResumo}

Nova diretriz estabelecida. A partir desta data, todas as sessões seguirão este plano terapêutico.`;

    await (supabase as any).from('notas_prontuario').insert({
      paciente_id: pacienteId,
      terapeuta_id: terapeutaId,
      tipo: 'evolucao',
      titulo: `Evolução — Nova Diretriz Estabelecida`,
      descricao,
      dados_extras: {
        tipo_evolucao: 'nova_diretriz',
        protocolo_id: protocoloId,
        total_fases: totalFases,
        total_tecnicas: totalTecnicas,
      },
      referencia_id: protocoloId,
    });
  } catch (err) {
    console.warn('Erro ao gerar evolução de diretriz:', err);
  }
}

/**
 * Gera nota de evolução quando a fase do tratamento muda.
 */
export async function gerarEvolucaoMudancaFase(params: {
  pacienteId: string;
  terapeutaId: string;
  protocoloId: string;
  diretrizTitulo: string;
  faseAnterior: number;
  faseNova: number;
  faseTitulo?: string;
}) {
  const { pacienteId, terapeutaId, protocoloId, diretrizTitulo, faseAnterior, faseNova, faseTitulo } = params;

  try {
    const descricao = `🔄 MUDANÇA DE FASE NO TRATAMENTO

📋 Diretriz: ${diretrizTitulo}
📌 Transição: Fase ${faseAnterior} → Fase ${faseNova}${faseTitulo ? ` (${faseTitulo})` : ''}

Paciente progrediu para a próxima fase do plano terapêutico. Critérios da fase anterior foram atingidos.`;

    await (supabase as any).from('notas_prontuario').insert({
      paciente_id: pacienteId,
      terapeuta_id: terapeutaId,
      tipo: 'evolucao',
      titulo: `Evolução — Progressão para Fase ${faseNova}`,
      descricao,
      dados_extras: {
        tipo_evolucao: 'mudanca_fase',
        protocolo_id: protocoloId,
        fase_anterior: faseAnterior,
        fase_nova: faseNova,
      },
      referencia_id: protocoloId,
    });
  } catch (err) {
    console.warn('Erro ao gerar evolução de mudança de fase:', err);
  }
}

/**
 * Gera nota de evolução quando uma diretriz é alterada/editada.
 */
export async function gerarEvolucaoDiretrizAlterada(params: {
  pacienteId: string;
  terapeutaId: string;
  protocoloId: string;
  diretrizTitulo: string;
  resumoAlteracoes: string;
}) {
  const { pacienteId, terapeutaId, protocoloId, diretrizTitulo, resumoAlteracoes } = params;

  try {
    const descricao = `✏️ DIRETRIZ DE TRATAMENTO ALTERADA

📋 Diretriz: ${diretrizTitulo}

📝 Alterações realizadas:
${resumoAlteracoes}

O plano terapêutico foi atualizado. As próximas sessões seguirão a diretriz revisada.`;

    await (supabase as any).from('notas_prontuario').insert({
      paciente_id: pacienteId,
      terapeuta_id: terapeutaId,
      tipo: 'evolucao',
      titulo: `Evolução — Diretriz Atualizada`,
      descricao,
      dados_extras: {
        tipo_evolucao: 'diretriz_alterada',
        protocolo_id: protocoloId,
      },
      referencia_id: protocoloId,
    });
  } catch (err) {
    console.warn('Erro ao gerar evolução de diretriz alterada:', err);
  }
}
