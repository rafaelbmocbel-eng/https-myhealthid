export interface LinhaDeDisparo {
  gatilho: string | null;
  status: string | null;
}

// Linha 'simulado' é ensaio do motor de mensagens: nenhuma mensagem saiu, então não conta no resumo.
function ehSimulado(d: LinhaDeDisparo): boolean {
  return d.status === "simulado" || String(d.gatilho ?? "").startsWith("simulado:");
}

export function resumirDisparos(linhas: LinhaDeDisparo[]): { enviados7d: number; gatilhoTop: string } {
  const reais = linhas.filter((d) => !ehSimulado(d));
  const contagem: Record<string, number> = {};
  reais.forEach((d) => { contagem[String(d.gatilho)] = (contagem[String(d.gatilho)] || 0) + 1; });
  const top = Object.entries(contagem).sort((a, b) => b[1] - a[1])[0];
  return {
    enviados7d: reais.filter((d) => d.status === "enviado").length,
    gatilhoTop: top ? `${top[0]} (${top[1]})` : "—",
  };
}
