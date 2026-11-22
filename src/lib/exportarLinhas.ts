// Linha 'simulado' de agente_disparos é ensaio do motor de mensagens: nenhuma mensagem saiu, então não vai para o backup.
export function linhasParaExportar<T extends Record<string, unknown>>(tabela: string, linhas: T[]): T[] {
  if (tabela !== "agente_disparos") return linhas;
  return linhas.filter((linha) => linha.status !== "simulado");
}
