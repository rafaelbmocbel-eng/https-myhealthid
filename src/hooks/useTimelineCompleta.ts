import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type TipoEvento =
  | 'historia_vida'
  | 'agendamento'
  | 'sessao_concluida'
  | 'pagamento'
  | 'myid'
  | 'nota_prontuario'
  | 'evolucao'
  | 'evento_anatomico'
  | 'exame'
  | 'diagnostico'
  | 'avaliacao_voz'
  | 'escala'
  | 'composicao_corporal'
  | 'mensagem_whatsapp';

export interface EventoTimeline {
  id: string;
  tipo: TipoEvento;
  data: string;
  titulo: string;
  descricao?: string;
  sistema_corporal?: string;
  severidade?: number;
  metadata?: any;
}

const TIPO_CORES: Record<TipoEvento, string> = {
  historia_vida:       'text-rose-700 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800',
  agendamento:         'text-violet-700 bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800',
  sessao_concluida:    'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
  pagamento:           'text-green-700 bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800',
  myid:                'text-pink-700 bg-pink-50 dark:bg-pink-950/40 border-pink-200 dark:border-pink-800',
  nota_prontuario:     'text-amber-700 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
  evolucao:            'text-cyan-700 bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-800',
  evento_anatomico:    'text-purple-700 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800',
  exame:               'text-blue-700 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800',
  diagnostico:         'text-red-700 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800',
  avaliacao_voz:       'text-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800',
  escala:              'text-teal-700 bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800',
  composicao_corporal: 'text-orange-700 bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800',
  mensagem_whatsapp:   'text-sky-700 bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800',
};

const TIPO_LABELS: Record<TipoEvento, string> = {
  historia_vida:       'História de vida',
  agendamento:         'Agendamento',
  sessao_concluida:    'Sessão concluída',
  pagamento:           'Pagamento',
  myid:                'MyID',
  nota_prontuario:     'Nota clínica',
  evolucao:            'Evolução',
  evento_anatomico:    'Achado clínico',
  exame:               'Exame',
  diagnostico:         'Diagnóstico',
  avaliacao_voz:       'Avaliação de voz',
  escala:              'Escala/Questionário',
  composicao_corporal: 'Composição corporal',
  mensagem_whatsapp:   'WhatsApp',
};

export { TIPO_CORES, TIPO_LABELS };

export function useTimelineCompleta(pacienteId: string | undefined) {
  return useQuery({
    queryKey: ['timeline_completa', pacienteId],
    enabled: !!pacienteId,
    queryFn: async () => {
      const ev: EventoTimeline[] = [];
      const pid = pacienteId!;

      // Paciente base info
      const { data: pac } = await supabase.from('pacientes')
        .select('telefone, terapeuta_id, nome, data_nascimento, queixa_principal')
        .eq('id', pid).maybeSingle();

      // 1. História de vida (tabela própria)
      const { data: historia } = await supabase.from('historia_vida_paciente')
        .select('*').eq('paciente_id', pid).order('data_evento', { ascending: false });
      (historia || []).forEach(h => ev.push({
        id: `hv-${h.id}`, tipo: 'historia_vida', data: h.data_evento + 'T12:00:00',
        titulo: h.titulo, descricao: h.descricao ?? undefined,
        sistema_corporal: h.sistema_corporal ?? undefined,
        severidade: h.severidade ?? undefined,
        metadata: { tipo_historia: h.tipo, resolvido: h.resolvido, profissional: h.profissional_registro },
      }));

      // Nascimento do paciente
      if (pac?.data_nascimento) {
        ev.push({
          id: `nasc-${pid}`, tipo: 'historia_vida', data: pac.data_nascimento + 'T12:00:00',
          titulo: 'Nascimento', descricao: undefined,
          metadata: { tipo_historia: 'nascimento', is_nascimento: true },
        });
      }

      // 2. Agendamentos (todos os status)
      const { data: ags } = await supabase.from('agendamentos')
        .select('id, data_inicio, status, titulo, tipo_atendimento, observacoes')
        .eq('paciente_id', pid).order('data_inicio', { ascending: false }).limit(200);
      (ags || []).forEach(a => {
        const tipo: TipoEvento = (a.status === 'concluido' || a.status === 'faltou') ? 'sessao_concluida' : 'agendamento';
        const statusLabel: Record<string, string> = {
          confirmado: 'Confirmada', pendente: 'Pendente', concluido: 'Concluída',
          cancelado: 'Cancelada', faltou: 'Faltou', bloqueado: 'Bloqueada',
        };
        ev.push({
          id: `ag-${a.id}`, tipo, data: a.data_inicio,
          titulo: `${statusLabel[a.status] || a.status}: ${a.titulo || a.tipo_atendimento || 'Sessão'}`,
          descricao: a.observacoes?.slice(0, 200) ?? undefined,
          metadata: { status: a.status, tipo_atendimento: a.tipo_atendimento },
        });
      });

      // 3. Notas do prontuário
      const { data: notas } = await supabase.from('notas_prontuario')
        .select('id, created_at, titulo, descricao, tipo').eq('paciente_id', pid)
        .order('created_at', { ascending: false }).limit(100);
      (notas || []).forEach(n => ev.push({
        id: `np-${n.id}`, tipo: 'nota_prontuario', data: n.created_at,
        titulo: n.titulo || 'Nota clínica',
        descricao: (n.descricao || '').slice(0, 300),
        metadata: { tipo_nota: n.tipo },
      }));

      // 4. MyID avaliações
      const { data: myids } = await supabase.from('myid_avaliacoes')
        .select('id, status, myid_score_parcial, updated_at, red_flags_detectadas, resultado_processado')
        .eq('paciente_id', pid).order('updated_at', { ascending: false }).limit(20);
      (myids || []).forEach(m => {
        const res = m.resultado_processado as any;
        ev.push({
          id: `myid-${m.id}`, tipo: 'myid', data: m.updated_at,
          titulo: `Impressão Digital MyID · ${m.status === 'concluido' ? `Score ${Math.round(m.myid_score_parcial || 0)}` : m.status}`,
          descricao: m.red_flags_detectadas ? '⚠️ Red flags detectados' : res?.queixa_principal ?? undefined,
          severidade: m.myid_score_parcial ? Math.round(m.myid_score_parcial / 25) : undefined,
          metadata: { score: m.myid_score_parcial, red_flags: m.red_flags_detectadas },
        });
      });

      // 5. Eventos clínicos anatômicos (achados do avatar)
      const { data: anatomicos } = await supabase.from('eventos_clinicos_anatomicos')
        .select('id, created_at, tipo_achado, sistema, severidade, status, regiao_id, diagnostico_cid, origem')
        .eq('paciente_id', pid).order('created_at', { ascending: false }).limit(100);
      (anatomicos || []).forEach(e => ev.push({
        id: `ea-${e.id}`, tipo: 'evento_anatomico', data: e.created_at,
        titulo: `${e.tipo_achado}${e.diagnostico_cid ? ` (${e.diagnostico_cid})` : ''}`,
        descricao: `${e.sistema} · ${e.regiao_id} · ${e.status}`,
        sistema_corporal: e.sistema ?? undefined,
        severidade: e.severidade ?? undefined,
        metadata: { status: e.status, origem: e.origem, regiao: e.regiao_id },
      }));

      // 6. Diagnósticos
      const { data: diags } = await supabase.from('diagnosticos_paciente')
        .select('id, data_diagnostico, cid_codigo, cid_descricao, ativo, created_at')
        .eq('paciente_id', pid).order('data_diagnostico', { ascending: false, nullsFirst: false });
      (diags || []).forEach(d => ev.push({
        id: `diag-${d.id}`, tipo: 'diagnostico',
        data: d.data_diagnostico ? d.data_diagnostico + 'T12:00:00' : d.created_at,
        titulo: `${d.cid_codigo ? `[${d.cid_codigo}] ` : ''}${d.cid_descricao || 'Diagnóstico'}`,
        descricao: d.ativo ? 'Ativo' : 'Inativo',
        metadata: { cid: d.cid_codigo, ativo: d.ativo },
      }));

      // 7. Exames importados
      const { data: exames } = await supabase.from('exames_importados')
        .select('id, created_at, tipo, dados_extraidos, data_exame')
        .eq('paciente_id', pid).order('data_exame', { ascending: false, nullsFirst: false });
      (exames || []).forEach(e => {
        const extraidos = (e.dados_extraidos as { nome_exame?: string; resumo?: string } | null) || {};
        ev.push({
          id: `ex-${e.id}`, tipo: 'exame',
          data: e.data_exame ? e.data_exame + 'T12:00:00' : e.created_at,
          titulo: extraidos.nome_exame || e.tipo || 'Exame',
          descricao: (extraidos.resumo || '').slice(0, 300),
        });
      });

      // 8. Avaliações de voz
      const { data: vozes } = await supabase.from('avaliacoes_voz')
        .select('id, created_at, classificacao_severidade, queixa_principal, resultado')
        .eq('paciente_id', pid).order('created_at', { ascending: false }).limit(20);
      (vozes || []).forEach(v => {
        const resultado = (v.resultado as { resumo_clinico?: string } | null) || {};
        ev.push({
          id: `voz-${v.id}`, tipo: 'avaliacao_voz', data: v.created_at,
          titulo: `Avaliação de voz${v.classificacao_severidade ? ` · ${v.classificacao_severidade}` : ''}`,
          descricao: (resultado.resumo_clinico || v.queixa_principal || '').slice(0, 200),
          metadata: { severidade: v.classificacao_severidade },
        });
      });

      // 9. Escalas psicológicas
      const ESCALA_NOMES: Record<string, string> = {
        phq9: 'PHQ-9 (Depressão)', gad7: 'GAD-7 (Ansiedade)', pss10: 'PSS-10 (Estresse)',
      };
      const { data: escalas } = await supabase.from('escalas_psicologia')
        .select('id, created_at, tipo_escala, pontuacao_total, classificacao')
        .eq('paciente_id', pid).order('created_at', { ascending: false }).limit(30);
      (escalas || []).forEach(e => ev.push({
        id: `esc-${e.id}`, tipo: 'escala', data: e.created_at,
        titulo: `${ESCALA_NOMES[e.tipo_escala] || e.tipo_escala} · ${e.pontuacao_total ?? '—'} pts`,
        descricao: e.classificacao ?? undefined,
        metadata: { pontuacao: e.pontuacao_total },
      }));

      // 10. Composição corporal + antropometria
      const { data: cc } = await supabase.from('body_composition')
        .select('id, created_at, weight_kg, height_cm, bmi, body_fat_pct')
        .eq('paciente_id', pid).order('created_at', { ascending: false }).limit(20);
      (cc || []).forEach(c => ev.push({
        id: `cc-${c.id}`, tipo: 'composicao_corporal', data: c.created_at,
        titulo: `Composição corporal · IMC ${Number(c.bmi || 0).toFixed(1)} · ${c.weight_kg}kg`,
        descricao: c.body_fat_pct ? `Gordura: ${c.body_fat_pct}%` : undefined,
        metadata: { peso: c.weight_kg, imc: c.bmi },
      }));

      // 11. Mensagens WhatsApp (amostra)
      if (pac?.telefone && pac?.terapeuta_id) {
        const tel = pac.telefone.replace(/\D/g, '');
        const { data: convs } = await supabase.from('whatsapp_conversas')
          .select('id').eq('terapeuta_id', pac.terapeuta_id).ilike('telefone', `%${tel.slice(-10)}%`);
        if (convs?.length) {
          const { data: msgs } = await (supabase as any).from('whatsapp_mensagens_inbox')
            .select('id, conteudo, transcricao, direcao, created_at, tipo')
            .in('conversa_id', convs.map((c: any) => c.id))
            .order('created_at', { ascending: false }).limit(30);
          (msgs || []).forEach((m: any) => ev.push({
            id: `wa-${m.id}`, tipo: 'mensagem_whatsapp', data: m.created_at,
            titulo: m.direcao === 'entrada' ? 'Paciente enviou mensagem' : 'Você respondeu via WhatsApp',
            descricao: (m.conteudo || m.transcricao || `[${m.tipo}]`).slice(0, 150),
            metadata: { direcao: m.direcao, tipo_msg: m.tipo },
          }));
        }
      }

      // Ordena tudo por data decrescente
      ev.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
      return ev;
    },
  });
}

export function useHistoriaVida(pacienteId: string | undefined) {
  return useQuery({
    queryKey: ['historia_vida', pacienteId],
    enabled: !!pacienteId,
    queryFn: async () => {
      const { data, error } = await supabase.from('historia_vida_paciente')
        .select('*').eq('paciente_id', pacienteId!).order('data_evento', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useHistoriaVidaMutation(pacienteId: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['historia_vida', pacienteId] });
    qc.invalidateQueries({ queryKey: ['timeline_completa', pacienteId] });
  };

  const adicionar = useMutation({
    mutationFn: async (item: {
      data_evento: string; tipo: string; titulo: string; descricao?: string | null;
      sistema_corporal?: string | null; severidade?: number; profissional_registro?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');
      const { error } = await supabase.from('historia_vida_paciente').insert({
        ...item, paciente_id: pacienteId, terapeuta_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('historia_vida_paciente').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { adicionar, remover };
}
