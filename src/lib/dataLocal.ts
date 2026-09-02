// "Hoje" no fuso horário do Brasil (America/Sao_Paulo), como 'YYYY-MM-DD'.
//
// Motivo: `new Date().toISOString().slice(0,10)` devolve o dia em UTC. No Brasil
// (UTC-3), das ~21h à meia-noite o "dia" em UTC já é o seguinte — então marcar
// "feito hoje", chaves de XP, streaks e filtros de "eventos de hoje" viravam o
// dia cedo demais (cliente re-marcava e ganhava XP em dobro, streak quebrava,
// eventos de hoje sumiam). Este helper ancora "hoje" no fuso do Brasil.
const _fmtDiaBR = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Data de "hoje" no fuso do Brasil no formato 'YYYY-MM-DD'. */
export function hojeLocalISO(): string {
  return _fmtDiaBR.format(new Date());
}
