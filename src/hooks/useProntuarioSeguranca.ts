import { useQuery } from '@tanstack/react-query';
import { tabela } from '@/lib/dosagem/db';
import { idadeEmAnos, type TextoProntuario } from '@/lib/dosagem/seguranca';

export interface PacienteDosagem {
  id: string;
  nome: string;
  sobrenome: string | null;
  idade: number | null;
  sexo: string | null;
  textos: TextoProntuario[];
}

// Reúne o que o prontuário já sabe do paciente (condições, medicamentos,
// achados, história, diagnósticos) para acender alertas de segurança. Só lê.
export function usePacienteDosagem(pacienteId: string | null) {
  return useQuery({
    queryKey: ['dosagem-paciente', pacienteId],
    enabled: !!pacienteId,
    queryFn: async (): Promise<PacienteDosagem | null> => {
      const [pac, eventos, historia, diags] = await Promise.all([
        tabela('pacientes')
          .select('id, nome, sobrenome, data_nascimento, sexo, alergias, condicoes_preexistentes, historia_atual, historico_clinico, medicamentos_uso, observacoes, queixa_principal')
          .eq('id', pacienteId).maybeSingle(),
        tabela('eventos_clinicos_anatomicos').select('tipo_achado, status').eq('paciente_id', pacienteId).neq('status', 'resolvido'),
        tabela('historia_vida_paciente').select('titulo, descricao, resolvido').eq('paciente_id', pacienteId),
        tabela('diagnosticos_paciente').select('cid_descricao, observacao, ativo').eq('paciente_id', pacienteId),
      ]);
      const p = pac.data;
      if (!p) return null;
      const textos: TextoProntuario[] = [];
      const add = (origem: string, t: unknown) => { if (typeof t === 'string' && t.trim()) textos.push({ origem, texto: t }); };
      add('Condições preexistentes', p.condicoes_preexistentes);
      add('Medicamentos em uso', p.medicamentos_uso);
      add('Histórico clínico', p.historico_clinico);
      add('História atual', p.historia_atual);
      add('Queixa principal', p.queixa_principal);
      add('Alergias', p.alergias);
      add('Observações', p.observacoes);
      for (const e of (eventos.data || []) as { tipo_achado: string }[]) add('Avatar clínico', e.tipo_achado);
      for (const h of (historia.data || []) as { titulo: string; descricao: string; resolvido: boolean }[]) {
        if (!h.resolvido) add('História de vida', `${h.titulo || ''} ${h.descricao || ''}`);
      }
      for (const d of (diags.data || []) as { cid_descricao: string; observacao: string; ativo: boolean }[]) {
        if (d.ativo !== false) add('Diagnósticos', `${d.cid_descricao || ''} ${d.observacao || ''}`);
      }
      return { id: p.id, nome: p.nome, sobrenome: p.sobrenome, idade: idadeEmAnos(p.data_nascimento), sexo: p.sexo, textos };
    },
  });
}

export function usePacientesLista(terapeutaId: string | undefined) {
  return useQuery({
    queryKey: ['dosagem-pacientes', terapeutaId],
    enabled: !!terapeutaId,
    queryFn: async () => {
      const { data } = await tabela('pacientes').select('id, nome, sobrenome').eq('terapeuta_id', terapeutaId).eq('ativo', true).order('nome').limit(1000);
      return (data || []) as { id: string; nome: string; sobrenome: string }[];
    },
  });
}
