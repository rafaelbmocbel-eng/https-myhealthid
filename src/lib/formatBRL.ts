// Formatador único de moeda BRL (pt-BR). Use em vez de toFixed/replace ad-hoc.
// Ex.: formatBRL(12500) => "R$ 12.500,00".
export function formatBRL(v: number | null | undefined): string {
  return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Variante sem centavos (para KPIs/gráficos onde o arredondado basta).
// Ex.: formatBRL0(12500) => "R$ 12.500".
export function formatBRL0(v: number | null | undefined): string {
  return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}
