// ============================================================================
// LINKS PÚBLICOS — DOMÍNIO CANÔNICO
// ----------------------------------------------------------------------------
// Esta é a ÚNICA fonte de verdade do domínio público da aplicação.
// Qualquer mudança aqui afeta TODOS os links compartilháveis (portal, MyID,
// avaliação, agenda, cadastro, funil, eventos).
//
// REGRAS DE PROTEÇÃO (para nunca quebrar links de pacientes em uso):
//
// 1. CANONICAL_DOMAIN é a URL oficial. Sempre validada por testes.
// 2. KNOWN_ALIASES lista domínios antigos/com typo que devem ser tratados como
//    válidos para LEITURA (paciente já tem o link salvo) mas o app vai
//    redirecionar para o canônico via <script> em index.html.
// 3. Se algum dia o domínio canônico mudar, ADICIONAR o antigo em
//    KNOWN_ALIASES antes de trocar — assim links antigos continuam abrindo.
// ============================================================================

export const CANONICAL_DOMAIN = 'https-myhealthid.lovable.app';
export const CANONICAL_URL = `https://${CANONICAL_DOMAIN}`;

/**
 * Domínios reconhecidos como "nosso app em produção".
 * Inclui o canônico + qualquer alias histórico que pacientes possam ter salvo.
 * Aliases serão redirecionados via index.html script.
 */
export const KNOWN_PRODUCTION_DOMAINS: readonly string[] = [
  CANONICAL_DOMAIN,
  // Aliases / typos históricos — manter aqui para que o redirect funcione:
  'myhealthid.lovable.app',
  // Domínios customizados do cliente devem ser adicionados aqui quando
  // forem conectados (ex.: 'app.myhealthid.com.br')
];

/** Detecta se um origin é ambiente de dev/preview do Lovable (precisa de login). */
function isDevOrigin(origin: string): boolean {
  return (
    origin.includes('github') ||
    origin.includes('id-preview') ||
    origin.includes('preview--') ||
    origin.includes('lovableproject.com')
  );
}

/**
 * Retorna a URL base canônica para gerar links compartilháveis.
 * - Em dev/preview → força o domínio canônico (preview é privado).
 * - Em produção (canônico ou alias conhecido) → usa o canônico.
 * - Em domínio customizado desconhecido → usa o origin atual.
 */
export function getBaseUrl(): string {
  if (typeof window === 'undefined') return CANONICAL_URL;

  const origin = window.location.origin;
  const host = window.location.hostname;

  if (isDevOrigin(origin)) return CANONICAL_URL;

  // Se estamos em um alias conhecido ou no canônico → sempre emitir links canônicos
  if (KNOWN_PRODUCTION_DOMAINS.includes(host)) return CANONICAL_URL;

  // Domínio customizado ainda não catalogado: confia no origin
  return origin;
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
