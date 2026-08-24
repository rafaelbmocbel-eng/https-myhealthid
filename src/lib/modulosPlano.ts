// Catálogo único de funcionalidades (módulos) que os planos liberam.
// A chave é o que fica em planos.modulos[] e é checado por temAcessoModulo().
// Fonte única: usado no Admin (editar o que cada plano abre) e na página de Preços.
export const MODULOS_CATALOGO: Record<string, string> = {
  agenda: 'Agenda completa com drag and drop',
  pacientes: 'Gestão ilimitada de pacientes',
  myid: 'Avaliação MyID com 11 dimensões',
  portal_paciente: 'Portal do paciente gamificado (PWA)',
  eventos: 'Módulo de eventos com inscrições',
  prontuario: 'Prontuário eletrônico (SOAP)',
  crm: 'CRM completo de vendas e retenção',
  funil_vendas: 'Funil de vendas com chatbot público',
  pacotes_sessoes: 'Gestão de pacotes de sessões',
  financeiro_avancado: 'Financeiro avançado e conciliação',
  relatorios: 'Relatórios e dashboards',
  multi_profissional: 'Multi-profissional na mesma clínica',
  painel_dono: 'Painel do dono com visão consolidada',
  comissoes: 'Gestão de comissões por profissional',
};

/** Lista de chaves na ordem do catálogo. */
export const MODULOS_KEYS = Object.keys(MODULOS_CATALOGO);

// Base GRÁTIS: o que fica liberado para quem NÃO tem assinatura ativa.
// O restante das funcionalidades exige um plano que as inclua.
export const MODULOS_FREE: string[] = ['agenda', 'pacientes', 'myid', 'prontuario'];

/** Rótulo amigável de um módulo (cai na própria chave se não catalogado). */
export const rotuloModulo = (k: string): string => MODULOS_CATALOGO[k] ?? k;
