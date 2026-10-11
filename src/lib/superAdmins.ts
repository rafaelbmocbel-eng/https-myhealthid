// Super-admins do produto (dono do app). Lista pura, sem React, para a lógica de src/lib também poder usá-la.
// Mantido em sincronia com o SUPER_ADMINS de usePodeChancelar e do edge function admin-metrics.
export const SUPER_ADMINS = ['rafaelbmocbel@gmail.com'];

export function ehEmailDeSuperAdmin(email: string | null | undefined): boolean {
  return !!email && SUPER_ADMINS.includes(email.toLowerCase());
}
