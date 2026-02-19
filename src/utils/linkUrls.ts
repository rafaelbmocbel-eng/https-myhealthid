// URL base for patient-facing links (published app, not preview)
const PUBLISHED_URL = 'https://core-axis-pro.lovable.app';

function getBaseUrl() {
  // In production (published), use origin; otherwise use the published URL
  // so patients never see the Lovable preview domain
  if (typeof window !== 'undefined' && window.location.origin.includes('lovable.app') && !window.location.origin.includes('preview')) {
    return window.location.origin;
  }
  return PUBLISHED_URL;
}

export function getAvaliacaoUrl(token: string) {
  return `${getBaseUrl()}/avaliacao/${token}`;
}

export function getAgendaUrl(token: string) {
  return `${getBaseUrl()}/agenda/${token}`;
}
