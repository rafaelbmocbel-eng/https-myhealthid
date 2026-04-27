// URL oficial do projeto publicado (acessível publicamente sem login Lovable)
const PRODUCTION_URL = 'https://https-myhealthid.lovable.app';

export function getBaseUrl() {
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;

    // Ambientes de desenvolvimento/preview do Lovable são PRIVADOS e exigem login.
    // Sempre force o uso do domínio público publicado para links compartilháveis.
    const isDev =
      origin.includes('github') ||
      origin.includes('id-preview') ||
      origin.includes('preview--') ||
      origin.includes('lovableproject.com');

    if (isDev && PRODUCTION_URL) {
      return PRODUCTION_URL;
    }

    return origin;
  }
  return PRODUCTION_URL || '';
}

export function getPortalUrl(token: string) {
  return `${getBaseUrl()}/portal/${token}`;
}

export function getAvaliacaoUrl(token: string) {
  return `${getBaseUrl()}/avaliacao/${token}`;
}

export function getAgendaUrl(token: string) {
  return `${getBaseUrl()}/agenda/${token}`;
}

export function getMyIdUrl(token: string) {
  return `${getBaseUrl()}/myid/responder/${token}`;
}

export function getCadastroUrl(slug: string) {
  return `${getBaseUrl()}/cadastro/${slug}`;
}

export function getFunilUrl(slug: string) {
  return `${getBaseUrl()}/funil/${slug}`;
}

export function getEventoUrl(slug: string) {
  return `${getBaseUrl()}/evento/${slug}`;
}
