// O supabase.functions.invoke devolve um FunctionsHttpError genérico
// ("Edge Function returned a non-2xx status code") e esconde o corpo da
// resposta — onde está o motivo real ("Créditos de IA esgotados", etc.).
// Este helper extrai a mensagem verdadeira para mostrar ao usuário.
export async function erroDaFuncao(error: unknown): Promise<Error> {
  try {
    const ctx = (error as { context?: { json?: () => Promise<unknown> } })?.context;
    if (ctx && typeof ctx.json === 'function') {
      const body = (await ctx.json()) as { error?: string } | null;
      if (body?.error) return new Error(body.error);
    }
  } catch {
    // corpo não-JSON — cai na mensagem padrão abaixo
  }
  const msg = (error as { message?: string })?.message;
  return new Error(msg || 'Erro ao chamar a função');
}
