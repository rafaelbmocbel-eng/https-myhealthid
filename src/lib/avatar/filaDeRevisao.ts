// A fila de revisão do Avatar Clínico: quais achados aguardam a revisão do profissional logado. Esta é a ÚNICA definição da
// regra: o cartão do Avatar (AvatarClinicoCard) e o aviso da Linha do tempo clínica usam esta função, para o número do aviso
// nunca divergir do que o Avatar mostra. Função pura: não lê o banco nem grava nada.

export const TIPO_RELATO_DO_PACIENTE = 'relato_paciente';
export const TIPO_HISTORICO_RELATADO = 'historico_relatado';
// Os únicos tipos que a fila olha: quem lê do banco pode pedir só estes (a regra confere de novo).
export const TIPOS_QUE_ENTRAM_NA_FILA = [TIPO_RELATO_DO_PACIENTE, TIPO_HISTORICO_RELATADO] as const;
export const STATUS_RESOLVIDO = 'resolvido';
// Com 3 rejeições de profissionais distintos o achado é arquivado e sai da fila.
export const REJEICOES_PARA_ARQUIVAR = 3;

// Só o que a regra lê do evento. Qualquer campo pode vir com tipo errado do banco: a regra nunca lança por causa disso.
export interface EventoDaFila {
  tipo_diagnostico?: unknown;
  status?: unknown;
  metadata?: unknown;
}

export interface FilaDeRevisao<T> {
  // Relato do paciente que ainda não foi resolvido.
  relatosDoPaciente: T[];
  // Histórico relatado que este profissional ainda não revisou, não foi descartado e tem menos de 3 rejeições.
  historicoRelatado: T[];
  // Histórico relatado descartado ou com 3 rejeições ou mais: fica só para consulta.
  descartadosPorConsenso: T[];
}

function metadataDe(evento: EventoDaFila): Record<string, unknown> {
  const { metadata } = evento;
  return metadata !== null && typeof metadata === 'object' ? (metadata as Record<string, unknown>) : {};
}

// Mesmo resultado que o Avatar tinha quando a regra estava escrita nele: lista de ids, ou texto (onde vale a busca de trecho
// que `includes` faz). Qualquer outro valor derrubava a tela com TypeError; aqui só conta como "não revisou".
function jaRevisou(metadata: Record<string, unknown>, profissionalId: string | undefined): boolean {
  const ids = metadata.revisado_por_ids || [];
  if (Array.isArray(ids)) return ids.includes(profissionalId);
  if (typeof ids === 'string') return ids.includes(profissionalId as string);
  return false;
}

function quantasRejeicoes(metadata: Record<string, unknown>): number {
  const rejeicoes = metadata.rejeicoes as { length?: unknown } | null | undefined;
  return Number(rejeicoes?.length || 0);
}

function relatoDoPacienteAguardando(evento: EventoDaFila): boolean {
  return evento.tipo_diagnostico === TIPO_RELATO_DO_PACIENTE && evento.status !== STATUS_RESOLVIDO;
}

function historicoAguardando(evento: EventoDaFila, profissionalId: string | undefined): boolean {
  if (evento.tipo_diagnostico !== TIPO_HISTORICO_RELATADO) return false;
  const metadata = metadataDe(evento);
  return !jaRevisou(metadata, profissionalId) && !metadata.descartado && quantasRejeicoes(metadata) < REJEICOES_PARA_ARQUIVAR;
}

function historicoDescartado(evento: EventoDaFila): boolean {
  if (evento.tipo_diagnostico !== TIPO_HISTORICO_RELATADO) return false;
  const metadata = metadataDe(evento);
  return Boolean(metadata.descartado) || quantasRejeicoes(metadata) >= REJEICOES_PARA_ARQUIVAR;
}

export function filaDeRevisao<T extends EventoDaFila>(eventos: readonly T[], profissionalId: string | undefined): FilaDeRevisao<T> {
  return {
    relatosDoPaciente: eventos.filter(relatoDoPacienteAguardando),
    historicoRelatado: eventos.filter((e) => historicoAguardando(e, profissionalId)),
    descartadosPorConsenso: eventos.filter(historicoDescartado),
  };
}

export function totalAguardandoRevisao(fila: Pick<FilaDeRevisao<unknown>, 'relatosDoPaciente' | 'historicoRelatado'>): number {
  return fila.relatosDoPaciente.length + fila.historicoRelatado.length;
}
