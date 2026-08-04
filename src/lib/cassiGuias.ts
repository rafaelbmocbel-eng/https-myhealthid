// Regras de negócio do Controle de Guias CASSI (fase 1).
// Contagem por dias distintos e amarração à agenda ficam para a fase 2 — aqui
// `sessoes_realizadas` é informado pelo profissional.

export interface CodigoCassi {
  codigo: string;
  descricao: string;
  apenasPrimeiroDia?: boolean; // 144 (Avaliação) só existe no 1º dia da guia
}

// Catálogo de códigos de procedimento CASSI (PDF, Parte 4.1).
export const CODIGOS_CASSI: CodigoCassi[] = [
  { codigo: '144', descricao: 'Avaliação', apenasPrimeiroDia: true },
  { codigo: '012', descricao: 'Sessão de psicomotricidade' },
  { codigo: '160', descricao: 'Sessão de psicomotricidade' },
  { codigo: '185', descricao: 'Eletroterapia' },
];

export type GuiaStatus = 'aguardando' | 'ativa' | 'finalizada' | 'cancelada';

export interface GuiaCassi {
  id: string;
  paciente_id: string;
  matricula: string | null;
  numero_guia: string | null;
  data_pedido: string;
  data_resposta: string | null;
  sessoes_autorizadas: number;
  sessoes_realizadas: number;
  diagnostico: string | null;
  responsavel_tecnico: string | null;
  codigos: Array<{ codigo: string; descricao?: string; sessoes?: number; status?: string }>;
  status: GuiaStatus;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export type StatusPacienteKey =
  | 'sem_guia'
  | 'aguardando_cassi'
  | 'pronta_entregar'
  | 'pedir_nova'
  | 'ativa';

export interface StatusPaciente {
  key: StatusPacienteKey;
  label: string;
  // classes Tailwind (cores semânticas) para o selo
  cls: string;
  restantes: number;
}

export function sessoesRestantes(g: Pick<GuiaCassi, 'sessoes_autorizadas' | 'sessoes_realizadas'>): number {
  return Math.max(0, (g.sessoes_autorizadas || 0) - (g.sessoes_realizadas || 0));
}

// Status do paciente a partir da guia mais recente (PDF, Parte 4.9).
// `guia` = guia mais recente do paciente (ou null se não tem nenhuma).
export function statusPaciente(guia: GuiaCassi | null): StatusPaciente {
  if (!guia || guia.status === 'cancelada') {
    return { key: 'sem_guia', label: 'Sem guia', cls: 'bg-muted text-muted-foreground', restantes: 0 };
  }
  const restantes = sessoesRestantes(guia);

  // Última guia finalizada e não há nova em aberto → pedir nova.
  if (guia.status === 'finalizada') {
    return { key: 'pedir_nova', label: 'Pedir nova guia', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', restantes };
  }

  // Guia enviada sem resposta da CASSI.
  if (!guia.data_resposta) {
    return { key: 'aguardando_cassi', label: 'Aguardando CASSI', cls: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300', restantes };
  }

  // Todas as sessões autorizadas já realizadas.
  if (guia.sessoes_autorizadas > 0 && guia.sessoes_realizadas >= guia.sessoes_autorizadas) {
    return { key: 'pronta_entregar', label: 'Pronta para entregar', cls: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300', restantes: 0 };
  }

  // Restam ≤ 2 sessões → pedir nova guia.
  if (restantes <= 2) {
    return { key: 'pedir_nova', label: 'Pedir nova guia', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', restantes };
  }

  return { key: 'ativa', label: 'Guia ativa', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300', restantes };
}

// Precisa de guia nova (para a fila "Pedidos do mês").
export function precisaNovaGuia(guia: GuiaCassi | null): boolean {
  const s = statusPaciente(guia);
  return s.key === 'pedir_nova' || s.key === 'sem_guia';
}
