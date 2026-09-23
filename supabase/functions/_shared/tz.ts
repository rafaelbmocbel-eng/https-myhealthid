// Horário oficial de Brasília (America/Sao_Paulo, UTC−3 fixo desde 2019).
// As edge functions rodam em UTC: entre 21h e 0h de Brasília o "hoje" em UTC
// já é o dia seguinte. Use estes helpers sempre que "hoje" importar.
const OFFSET_BR_MS = 3 * 3600000;

/** Data de hoje em Brasília no formato YYYY-MM-DD. */
export function hojeBR(): string {
  return new Date(Date.now() - OFFSET_BR_MS).toISOString().slice(0, 10);
}

/** Instante (ISO UTC) da meia-noite de hoje em Brasília. */
export function inicioDoDiaBR(): string {
  return new Date(`${hojeBR()}T00:00:00-03:00`).toISOString();
}
