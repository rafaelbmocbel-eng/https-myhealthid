// Busca na internet a ficha técnica de um aparelho (laser, ultrassom, ondas de
// choque) para pré-preencher o cadastro. A IA só LOCALIZA e COPIA o trecho da
// fonte; o servidor descarta qualquer valor cujo número não esteja no trecho
// citado, ou cuja fonte não seja do modelo exato. O profissional sempre confere.
import { corsHeaders, requireUser } from "../_shared/auth.ts";
import { extrairJson, montarPrompt, TIPOS, validarFicha, type TipoAparelho } from "../_shared/ficha-aparelho.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    await requireUser(req);
  } catch (r) {
    if (r instanceof Response) return r;
    return json({ ok: false, motivo: "nao_autorizado" }, 401);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const fabricante = String(body?.fabricante ?? "").trim().slice(0, 80);
    const modelo = String(body?.modelo ?? "").trim().slice(0, 80);
    const tipo = String(body?.tipo ?? "") as TipoAparelho;
    if (!TIPOS.includes(tipo)) return json({ ok: false, motivo: "tipo_invalido" }, 400);
    if (!fabricante && !modelo) return json({ ok: false, motivo: "informe_fabricante_ou_modelo" }, 400);

    const chave = Deno.env.get("GEMINI_API_KEY");
    if (!chave) return json({ ok: false, motivo: "busca_nao_configurada" });
    const modeloIA = Deno.env.get("GEMINI_MODEL_BUSCA") || "gemini-2.5-flash";

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45000);
    let resp: Response;
    try {
      resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modeloIA}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": chave },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: montarPrompt({ fabricante, modelo, tipo }) }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0 },
        }),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!resp.ok) {
      console.error("buscar-ficha-aparelho: IA respondeu", resp.status);
      return json({ ok: false, motivo: "busca_indisponivel" });
    }
    const dados = await resp.json();
    const cand = dados?.candidates?.[0];
    const texto = (cand?.content?.parts ?? []).map((p: { text?: string }) => p?.text ?? "").join("");
    const fontes: { url: string; titulo: string }[] = [];
    for (const c of cand?.groundingMetadata?.groundingChunks ?? []) {
      const url = c?.web?.uri;
      if (url && !fontes.some((f) => f.url === url)) fontes.push({ url, titulo: c?.web?.title || url });
    }

    const r = validarFicha(extrairJson(texto), tipo);
    const encontrado = r.modeloConfere && Object.keys(r.campos).length > 0 && fontes.length > 0;
    return json({
      ok: true,
      encontrado,
      campos: encontrado ? r.campos : {},
      evidencias: encontrado ? r.evidencias : {},
      descartados: r.descartados,
      fontes: fontes.slice(0, 5),
      motivo: encontrado ? undefined : (!r.modeloConfere ? "modelo_nao_localizado" : fontes.length === 0 ? "sem_fonte" : "sem_campos"),
    });
  } catch (e) {
    console.error("buscar-ficha-aparelho:", (e as Error)?.message);
    return json({ ok: false, motivo: "erro" });
  }
});
