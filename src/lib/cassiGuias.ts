// Regras de negócio do Controle de Guias CASSI (fase 1).
// Contagem por dias distintos e amarração à agenda ficam para a fase 2 — aqui
// `sessoes_realizadas` é informado pelo profissional.
import { gerarDatasSessoes } from '@/lib/feriados';

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
  // Ciclo físico da guia (assinatura pelo paciente → recolher → financeiro).
  assinatura?: AssinaturaGuia;
  recolhida_em?: string | null;
  enviada_financeiro_em?: string | null;
  created_at: string;
  updated_at: string;
}

// Assinatura física da guia pelo paciente.
export type AssinaturaGuia = 'nao' | 'inteira' | 'metade';

export interface PassoFisico {
  // Próximo passo físico da guia; null = ainda em uso (não chegou nesse ponto).
  key: 'assinar' | 'recolher' | 'enviar' | 'enviada' | null;
  label: string;
}

// Onde a guia está no ciclo FÍSICO (assinar → recolher → enviar ao financeiro).
// Independe de "pedir a próxima": uma guia pode estar em "recolher" e o cliente
// já precisar pedir outra ao mesmo tempo.
export function passoFisicoGuia(g: Pick<GuiaCassi, 'assinatura' | 'recolhida_em' | 'enviada_financeiro_em' | 'status' | 'sessoes_autorizadas' | 'sessoes_realizadas'>): PassoFisico {
  if (g.enviada_financeiro_em) return { key: 'enviada', label: 'Enviada ao financeiro' };
  if (g.assinatura && g.assinatura !== 'nao') {
    if (!g.recolhida_em) return { key: 'recolher', label: 'Recolher guia assinada' };
    return { key: 'enviar', label: 'Enviar ao financeiro' };
  }
  // Sessões esgotadas e ainda não assinada → pronta para assinar/recolher.
  if (g.status !== 'cancelada' && g.sessoes_autorizadas > 0 && g.sessoes_realizadas >= g.sessoes_autorizadas) {
    return { key: 'assinar', label: 'Assinar e recolher' };
  }
  return { key: null, label: '' };
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

// Precisa de guia nova (para a fila "Pedidos do mês"). Vale quando faltam ≤ 2
// sessões (pedir_nova), quando a guia foi toda usada (pronta_entregar) e quando
// não há guia (sem_guia) — assim há tempo hábil de pedir a próxima.
export function precisaNovaGuia(guia: GuiaCassi | null): boolean {
  const s = statusPaciente(guia);
  return s.key === 'pedir_nova' || s.key === 'sem_guia' || s.key === 'pronta_entregar';
}

// Prazo p/ pedir a PRÓXIMA guia do cliente de 2 guias/mês (compat.: mantido para
// quem importa a constante). A regra atual é por DIAS ÚTEIS — ver dataProximoPedido.
export const PRAZO_PROXIMA_GUIA_DIAS = 13;

// Data em que a PRÓXIMA (2ª) guia deve ser PEDIDA, para cliente de 2 guias/mês.
// Regra: é a DATA DO FIM DAS 10 SESSÕES — o app projeta o 10º dia útil de sessão
// a partir do aceite da CASSI (ou, na falta, do pedido). Assim mostramos a DATA
// em si (não uma frase). 1 guia/mês não usa data fixa (segue por sessões).
// Retorna 'YYYY-MM-DD' ou null.
export function dataProximoPedido(
  guia: GuiaCassi | null,
  guiasPorMes: number | null | undefined,
): string | null {
  if (!guia || (guiasPorMes || 1) < 2) return null;
  if (guia.status === 'cancelada') return null;
  const inicio = (guia.data_resposta || guia.data_pedido || '').slice(0, 10);
  if (!inicio) return null;
  const base = new Date(`${inicio}T00:00:00`);
  if (Number.isNaN(base.getTime())) return null;
  const datas = gerarDatasSessoes(base, 10, [1, 2, 3, 4, 5]); // 10 sessões em dias úteis
  const ult = datas[datas.length - 1];
  if (!ult) return null;
  return `${ult.getFullYear()}-${String(ult.getMonth() + 1).padStart(2, '0')}-${String(ult.getDate()).padStart(2, '0')}`;
}

// True quando já chegou (ou passou) a data de pedir a próxima guia do cliente de
// 2 guias/mês — aí ele entra automaticamente em "Pedir guia".
export function venceuPrazoProximaGuia(
  guia: GuiaCassi | null,
  guiasPorMes: number | null | undefined,
): boolean {
  if (!guia || (guiasPorMes || 1) < 2) return false;
  if (guia.status !== 'ativa') return false;
  const alvo = dataProximoPedido(guia, guiasPorMes);
  if (!alvo) return false;
  const hoje = new Date();
  const hojeISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  return hojeISO >= alvo;
}
