// Edge function: pings Lovable AI Gateway with a tiny request to detect
// whether credits are available. Returns a normalized status payload.
// Designed to be called periodically from the client (cached ~5 min).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Status = "active" | "exhausted" | "rate_limited" | "unconfigured" | "error";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const checkedAt = new Date().toISOString();

  if (!LOVABLE_API_KEY) {
    return json({
      status: "unconfigured" as Status,
      httpStatus: 0,
      message: "LOVABLE_API_KEY não configurada",
      checkedAt,
    });
  }

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      }),
    });

    if (resp.ok) {
      // Drain body to release connection
      try { await resp.text(); } catch { /* ignore */ }
      return json({
        status: "active" as Status,
        httpStatus: resp.status,
        message: "Créditos disponíveis",
        checkedAt,
      });
    }

    let bodyText = "";
    try { bodyText = await resp.text(); } catch { /* ignore */ }

    let status: Status = "error";
    let message = `Erro ${resp.status}`;
    if (resp.status === 402) {
      status = "exhausted";
      message = "Créditos do Lovable AI esgotados";
    } else if (resp.status === 429) {
      status = "rate_limited";
      message = "Limite de requisições atingido (rate limit)";
    } else if (resp.status === 401 || resp.status === 403) {
      status = "unconfigured";
      message = "Chave da IA inválida ou sem permissão";
    }

    return json({
      status,
      httpStatus: resp.status,
      message,
      detail: bodyText.slice(0, 300),
      checkedAt,
    });
  } catch (err) {
    return json({
      status: "error" as Status,
      httpStatus: 0,
      message: err instanceof Error ? err.message : "Falha ao contatar gateway",
      checkedAt,
    });
  }
});

function json(payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
