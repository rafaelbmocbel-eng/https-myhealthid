export const DIAS_MYID_VENCIDO = 30;
const DIA_MS = 86_400_000;

interface AvaliacaoMyid {
  paciente_id: string | null;
  updated_at: string;
}

// Vencido é a ÚLTIMA avaliação de cada cliente ter 30 dias ou mais (a mesma regra do gatilho automático): quem já
// refez o MyID tem uma avaliação nova e sai do segmento, mesmo com avaliações antigas guardadas.
export function idsComMyidVencido(avaliacoes: AvaliacaoMyid[], idsBase: string[], agora: number): string[] {
  const ultima = new Map<string, number>();
  for (const a of avaliacoes) {
    const quando = Date.parse(a.updated_at);
    if (!a.paciente_id || Number.isNaN(quando)) continue;
    const anterior = ultima.get(a.paciente_id);
    if (anterior === undefined || quando > anterior) ultima.set(a.paciente_id, quando);
  }
  return idsBase.filter((id) => {
    const quando = ultima.get(id);
    return quando !== undefined && agora - quando >= DIAS_MYID_VENCIDO * DIA_MS;
  });
}
