// URL oficial do projeto - substitua pelo seu domínio oficial se necessário
const PRODUCTION_URL = 'https://myhealthid.lovable.app';

export function getBaseUrl() {
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;

    // Se o origin contiver 'github.dev', 'github.codespaces' ou 'preview.lovable',
    // provavelmente estamos no ambiente de desenvolvimento.
    const isDev = origin.includes('github') || origin.includes('preview');

    if (isDev && PRODUCTION_URL) {
      return PRODUCTION_URL;
    }

    return origin;
  }
  return PRODUCTION_URL || '';
}

export function getPortalUrl(token: string) {
  return `${getBaseUrl()}/paciente/login?token=${token}&portal=1`;
}

export function getAvaliacaoUrl(token: string) {
  return `${getBaseUrl()}/avaliacao/${token}`;
}

export function getAgendaUrl(token: string) {
  return `${getBaseUrl()}/agenda/${token}`;
}
