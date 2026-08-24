// Registrador de uso de IA. Grava tokens e custo estimado de cada chamada ao
// Gemini em `ai_usage_log`, para o Guardião de Custo medir o gasto diário e
// alertar ANTES de estourar cota/fatura. Nunca lança — falha aqui não pode
// derrubar a geração. Usa o campo `usage` que o Gemini (OpenAI-compat) devolve.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Preço aproximado por 1M de tokens (USD). Ajuste conforme a tabela vigente do
// Gemini — serve para estimativa/alerta, não para cobrança.
const PRECO: Record<string, { in: number; out: number }> = {
  "gemini-2.5-flash": { in: 0.30, out: 2.50 },
  "gemini-2.5-flash-lite": { in: 0.10, out: 0.40 },
  "gemini-3.1-flash-lite": { in: 0.10, out: 0.40 },
  "gemini-embedding-001": { in: 0.15, out: 0 },
};

export async function logUsoIA(functionName: string, model: string, usage: any): Promise<void> {
  try {
    const pin = Number(usage?.prompt_tokens ?? usage?.promptTokens ?? 0) || 0;
    const pout = Number(usage?.completion_tokens ?? usage?.completionTokens ?? 0) || 0;
    // Sem usage não dá para estimar — não grava lixo.
    if (pin === 0 && pout === 0) return;
    const p = PRECO[model] ?? { in: 0.30, out: 2.50 };
    const custo = (pin / 1e6) * p.in + (pout / 1e6) * p.out;
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return;
    const admin = createClient(url, key);
    await admin.from("ai_usage_log").insert({
      function_name: functionName,
      model,
      prompt_tokens: pin,
      completion_tokens: pout,
      est_cost_usd: custo,
    });
  } catch (e) {
    console.warn("[log-ia] falhou (não bloqueia):", e);
  }
}
