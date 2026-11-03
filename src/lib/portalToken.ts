const paraHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/**
 * Token do link do portal do cliente (40 caracteres hexadecimais). `crypto.randomUUID` só existe em navegadores e WebViews
 * recentes e em contexto seguro; sem ele o cadastro falhava inteiro com um erro genérico. `getRandomValues` existe em todos
 * que têm `crypto`. Sem `crypto` nenhum, falhamos com uma mensagem clara em vez de gerar um token previsível.
 */
export function gerarPortalToken(): string {
  const c: Crypto | undefined = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID().replace(/-/g, '') + c.randomUUID().replace(/-/g, '').slice(0, 8);
  }
  if (c && typeof c.getRandomValues === 'function') {
    return paraHex(c.getRandomValues(new Uint8Array(20)));
  }
  throw new Error('Este navegador está desatualizado e não consegue gerar o link seguro do cliente. Atualize o navegador e tente de novo.');
}
