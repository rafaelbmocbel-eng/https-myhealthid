// Gera as justificativas clínicas (até 500 caracteres) dos pedidos de guia CASSI para os códigos 301 (agulhamento seco) e
// 131 (EMG biofeedback). É apoio: o profissional revisa e edita antes de usar. Recebe SÓ diagnóstico, músculos e achados do
// exame; nome, CPF e carteirinha do cliente nunca chegam aqui nem à IA. Mesmo provedor (Gemini) das outras funções.
// O fluxo (nova tentativa, limite de 500, corte) fica em _shared/cassi-justificativa.ts; aqui só entram a rede e a autorização.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, requireUser } from "../_shared/auth.ts";
import { logUsoIA } from "../_shared/log-ia.ts";
import { LIMITE_CARACTERES, orquestrarJustificativas, RespostaIncompleta, validarEntrada } from "../_shared/cassi-justificativa.ts";

const MODELO = "gemini-2.5-flash";

function resposta(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

class LimiteDeUso extends Error {}

// A mensagem de erro leva só o status: o corpo da resposta do Gemini pode repetir trechos do pedido (diagnóstico, achados).
async function perguntarIA(chave: string, sistema: string, usuario: string): Promise<string> {
  const ctrl = new AbortController();
  const relogio = setTimeout(() => ctrl.abort(), 45_000);
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODELO,
        temperature: 0.3,
        messages: [{ role: "system", content: sistema }, { role: "user", content: usuario }],
        response_format: { type: "json_object" },
      }),
    });
    if (res.status === 429) throw new LimiteDeUso();
    if (!res.ok) throw new Error(`Gemini API: ${res.status}`);
    const json = await res.json();
    await logUsoIA("gerar-justificativa-cassi", MODELO, json?.usage);
    return json?.choices?.[0]?.message?.content ?? "";
  } finally {
    clearTimeout(relogio);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return resposta({ error: "Método não permitido." }, 405);

  let userId = "";
  try { ({ userId } = await requireUser(req)); } catch (r) { return r as Response; }

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const servico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const chave = Deno.env.get("GEMINI_API_KEY");
    if (!url || !servico || !chave) return resposta({ error: "Serviço de IA não configurado." }, 500);

    // Conta de cliente (portal) não tem perfil de profissional: não gasta a cota de IA do sistema.
    const admin = createClient(url, servico);
    const { data: perfil, error: erroPerfil } = await admin.from("profiles").select("user_id").eq("user_id", userId).maybeSingle();
    if (erroPerfil) throw new Error("Não consegui conferir o perfil.");
    if (!perfil) return resposta({ error: "Recurso disponível só para profissionais." }, 403);

    let corpo: unknown = null;
    try { corpo = await req.json(); } catch { corpo = null; }
    const entrada = validarEntrada(corpo);
    if (!entrada.ok) return resposta({ error: entrada.erro }, 400);

    const justificativas = await orquestrarJustificativas(entrada.dados, (sistema, usuario) => perguntarIA(chave, sistema, usuario));
    return resposta({ justificativas, limite: LIMITE_CARACTERES });
  } catch (e) {
    if (e instanceof LimiteDeUso) return resposta({ error: "Limite de uso atingido. Tente em instantes." }, 429);
    if (e instanceof RespostaIncompleta) return resposta({ error: "A IA não devolveu todas as justificativas. Tente de novo." }, 502);
    console.error("[gerar-justificativa-cassi]", (e as Error)?.message);
    return resposta({ error: "Não consegui gerar a justificativa agora. Tente de novo." }, 500);
  }
});
