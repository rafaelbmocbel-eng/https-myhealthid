/** Erro de uma edge function, com o `codigo` e o status HTTP do corpo da resposta quando existirem. */
export class ErroFuncao extends Error {
  readonly codigo: string | null;
  readonly status: number | null;

  constructor(mensagem: string, codigo: string | null = null, status: number | null = null) {
    super(mensagem);
    this.name = 'ErroFuncao';
    this.codigo = codigo;
    this.status = status;
  }
}

// O supabase.functions.invoke devolve um FunctionsHttpError genérico
// ("Edge Function returned a non-2xx status code") e esconde o corpo da
// resposta — onde está o motivo real ("Créditos de IA esgotados", etc.).
// Este helper extrai a mensagem verdadeira para mostrar ao usuário.
export async function erroDaFuncao(error: unknown): Promise<ErroFuncao> {
  try {
    const ctx = (error as { context?: { json?: () => Promise<unknown>; status?: unknown } })?.context;
    if (ctx && typeof ctx.json === 'function') {
      const body = (await ctx.json()) as { error?: string; codigo?: unknown } | null;
      if (body?.error) {
        const codigo = typeof body.codigo === 'string' && body.codigo ? body.codigo : null;
        const status = typeof ctx.status === 'number' ? ctx.status : null;
        return new ErroFuncao(body.error, codigo, status);
      }
    }
  } catch {
    // corpo não-JSON — cai na mensagem padrão abaixo
  }
  const msg = (error as { message?: string })?.message;
  return new ErroFuncao(msg || 'Erro ao chamar a função');
}
