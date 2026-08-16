// Reexporta o date-fns, mas com um `format()` TOLERANTE a datas inválidas.
//
// Motivo: várias telas fazem `format(new Date(campo), '...')`. Se `campo` vier
// nulo/vazio/inválido do banco, o `new Date(...)` vira "Invalid Date" e o
// `format` do date-fns lança `RangeError: Invalid time value`, derrubando a tela
// inteira (a tela "Algo travou por aqui"). Aqui o format simplesmente devolve ''
// nesses casos, evitando o crash — sem precisar mexer em cada local de uso.
//
// Uso: em vez de `import { format } from 'date-fns'`, importe de '@/lib/dateSafe'.
// Todo o resto do date-fns continua disponível normalmente (export *).
export * from 'date-fns';

import { format as dfFormat } from 'date-fns';

type FmtOptions = Parameters<typeof dfFormat>[2];

export function format(date: string | number | Date, formatStr: string, options?: FmtOptions): string {
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    return dfFormat(d, formatStr, options);
  } catch {
    return '';
  }
}
