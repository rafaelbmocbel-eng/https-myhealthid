export function getBaseUrl() {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
}

export function getAvaliacaoUrl(token: string) {
  return `${getBaseUrl()}/avaliacao/${token}`;
}

export function getAgendaUrl(token: string) {
  return `${getBaseUrl()}/agenda/${token}`;
}
