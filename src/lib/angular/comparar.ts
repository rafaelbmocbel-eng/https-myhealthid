import { MEDIDAS } from './medidas';

/** Medida como fica gravada em `dados_extras.medidas` da nota do prontuário. */
export interface MedidaSalva { id: string; graus: number; texto?: string; /** Sem isso, o valor é em graus (registros antigos). */ unidade?: 'cm' }

export interface LinhaComparacao {
  id: string;
  nome: string;
  atual: MedidaSalva | null;
  anterior: MedidaSalva | null;
  /** atual − anterior, em graus, com uma casa; null se faltar um dos lados. */
  variacao: number | null;
}

const nomeDa = (id: string) => (id === 'sensor' ? 'Inclinação pelo sensor do celular' : MEDIDAS.find((m) => m.id === id)?.nome ?? id);

// Só mostra a variação numérica, sem dizer "melhorou" ou "piorou": não há referência
// publicada no app para classificar os ângulos, e nos desníveis o número não traz o lado
// (o lado vem no texto de cada avaliação).
export function compararMedidas(atual: MedidaSalva[], anterior: MedidaSalva[]): LinhaComparacao[] {
  const ids = [...new Set([...atual.map((m) => m.id), ...anterior.map((m) => m.id)])];
  return ids.map((id) => {
    const a = atual.find((m) => m.id === id) ?? null;
    const b = anterior.find((m) => m.id === id) ?? null;
    return { id, nome: nomeDa(id), atual: a, anterior: b, variacao: a && b ? Math.round((a.graus - b.graus) * 10) / 10 : null };
  });
}

const sufixo = (u?: 'cm') => (u === 'cm' ? ' cm' : '°');
const num = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const grau = (n: number | null | undefined, u?: 'cm') => (n == null ? '—' : `${num(n)}${sufixo(u)}`);

export const variacaoTexto = (v: number | null, u?: 'cm') =>
  v === null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${num(Math.abs(v))}${sufixo(u)}`;
