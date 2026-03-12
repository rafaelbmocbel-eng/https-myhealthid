// URL oficial do projeto - substitua pelo seu domínio oficial se necessário
const PRODUCTION_URL = 'https://myhealthid.lovable.app';

export function getBaseUrl() {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return PRODUCTION_URL || '';
}

export function getAvaliacaoUrl(token: string) {
  return `${getBaseUrl()}/avaliacao/${token}`;
}

export function getAgendaUrl(token: string) {
  return `${getBaseUrl()}/agenda/${token}`;
}

export function getPortalUrl(professionalId: string) {
  return `${getBaseUrl()}/paciente/cadastro?ref=${professionalId}`;
}

export function getPersonalPortalUrl(token: string) {
  return `${getBaseUrl()}/portal/${token}`;
}
