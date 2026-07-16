// Monitoramento de erros (Sentry): avisa quando algo quebra em produção,
// antes de um cliente reclamar. Só liga quando houver uma DSN configurada —
// sem DSN, não faz nada (zero custo em dev/preview).
//
// A DSN não é segredo (ela vai no bundle do navegador por design); cole a sua
// abaixo ou defina VITE_SENTRY_DSN no ambiente de build.
import * as Sentry from '@sentry/react';

const SENTRY_DSN = (import.meta.env.VITE_SENTRY_DSN as string | undefined) || '';

export function initMonitoring(app: 'profissional' | 'paciente') {
  if (!SENTRY_DSN || !import.meta.env.PROD) return;
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: 'production',
    release: undefined,
    initialScope: { tags: { app } },
    // Só erros — sem rastreamento de performance (mantém o bundle leve e
    // a cota gratuita do Sentry folgada)
    tracesSampleRate: 0,
    // Ruído conhecido que não é bug do app
    ignoreErrors: [
      'ResizeObserver loop',
      'Failed to fetch dynamically imported module',
      'Importing a module script failed',
      'AbortError',
      'Load failed',
    ],
  });
}
