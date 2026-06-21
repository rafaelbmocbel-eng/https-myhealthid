export interface BreadcrumbEntry {
  label: string;
  path?: string;
}

const PROFESSIONAL_ROUTES: { path: string; label: string }[] = [
  { path: '/agenda', label: 'Agenda' },
  { path: '/pacientes', label: 'Pacientes' },
  { path: '/pendencias', label: 'Pendências' },
  { path: '/crm', label: 'CRM' },
  { path: '/eventos', label: 'Eventos' },
  { path: '/configuracoes', label: 'Configurações' },
  { path: '/base-cientifica', label: 'Base Científica' },
];

/** Breadcrumbs do app do profissional. Retorna [] na home (/hoje) para não poluir a tela inicial. */
export function getProfessionalBreadcrumbs(pathname: string): BreadcrumbEntry[] {
  if (pathname === '/hoje' || pathname === '/inicio-app') return [];

  if (pathname.startsWith('/pacientes/') && pathname !== '/pacientes/') {
    return [
      { label: 'Início', path: '/hoje' },
      { label: 'Pacientes', path: '/pacientes' },
      { label: 'Perfil do paciente' },
    ];
  }

  const match = PROFESSIONAL_ROUTES.find((r) => pathname === r.path || pathname.startsWith(`${r.path}/`));
  if (!match) return [];

  return [
    { label: 'Início', path: '/hoje' },
    { label: match.label },
  ];
}

const PATIENT_ROUTES: { path: string; label: string }[] = [
  { path: '/paciente/saude', label: 'Saúde' },
  { path: '/paciente/diario', label: 'Diário' },
  { path: '/paciente/evolucao', label: 'Evolução e Prontuários' },
  { path: '/paciente/exercicios', label: 'Treinos' },
  { path: '/paciente/agenda', label: 'Agenda' },
  { path: '/paciente/questionarios', label: 'Questionários' },
  { path: '/paciente/pagamentos', label: 'Pagamentos' },
  { path: '/paciente/eventos', label: 'Eventos' },
  { path: '/paciente/chat', label: 'Mensagens' },
  { path: '/paciente/perfil', label: 'Perfil' },
  { path: '/paciente/plano', label: 'Plano' },
  { path: '/paciente/historia', label: 'Histórico' },
  { path: '/paciente/recompensas', label: 'Recompensas' },
];

/** Breadcrumbs do portal do paciente. Retorna [] no dashboard para não poluir a tela inicial. */
export function getPatientBreadcrumbs(pathname: string): BreadcrumbEntry[] {
  if (pathname === '/paciente/dashboard') return [];

  const match = PATIENT_ROUTES.find((r) => pathname === r.path || pathname.startsWith(`${r.path}/`));
  if (!match) return [];

  return [
    { label: 'Início', path: '/paciente/dashboard' },
    { label: match.label },
  ];
}
