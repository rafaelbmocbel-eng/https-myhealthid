// Importa uma bioimpedância a partir de foto(s)/print(s) do laudo do aparelho
// (ou do texto de um link). Usa Gemini Vision e devolve os campos já no formato
// do card de exames presenciais — o profissional confere e salva.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireUser, corsHeaders } from "../_shared/auth.ts";

// As chaves DEVEM bater com src/lib/examesPresenciais.ts (bioimpedância), para
// o resultado preencher o formulário direto.
const SYSTEM_PROMPT = `Você extrai dados de laudos de BIOIMPEDÂNCIA (composição corporal — aparelhos tipo InBody, Tanita, Omron e similares) a partir de fotos/prints ou do texto do laudo.
Retorne SOMENTE JSON válido, exatamente com estas chaves (número em ponto decimal, ex: 22.5; ou null se não aparecer — NUNCA invente):
{
  "peso_kg": number|null,
  "imc": number|null,
  "gordura_pct": number|null,
  "massa_gorda_kg": number|null,
  "massa_livre_gordura_kg": number|null,
  "massa_muscular_kg": number|null,
  "agua_corporal_l": number|null,
  "agua_intracelular_l": number|null,
  "agua_extracelular_l": number|null,
  "proteina_kg": number|null,
  "minerais_kg": number|null,
  "tmb_kcal": number|null,
  "idade_metabolica": number|null,
  "indice_apendicular": number|null,
  "gordura_visceral": number|null,
  "mm_braco_dir": number|null,
  "mm_braco_esq": number|null,
  "mm_tronco": number|null,
  "mm_perna_dir": number|null,
  "mm_perna_esq": number|null,
  "gd_braco_dir": number|null,
  "gd_braco_esq": number|null,
  "gd_tronco": number|null,
  "gd_perna_dir": number|null,
  "gd_perna_esq": number|null,
  "data_hint": "YYYY-MM-DD ou null (se o laudo mostrar a data do exame)",
  "confidence": "alta"|"media"|"baixa",
  "notas": "1 frase curta sobre o que foi identificado"
}
Mapeamento de rótulos comuns:
- "Massa Livre de Gordura" -> massa_livre_gordura_kg; "Massa Muscular Esquelética" -> massa_muscular_kg.
- "Percentual de Gordura" -> gordura_pct; "Massa de Gordura" -> massa_gorda_kg.
- "Água Corporal" -> agua_corporal_l; "Água Intracelular" -> agua_intracelular_l; "Água Extracelular" -> agua_extracelular_l.
- "Taxa Metabólica Basal" -> tmb_kcal; "Idade Metabólica" -> idade_metabolica; "Índice Apendicular" -> indice_apendicular.
- "Nível de Gordura Visceral"/"Área ou Nível de Gordura Visceral" -> gordura_visceral (use o NÍVEL, ex.: 5).
- Segmentar: "Massa magra braço direito/esquerdo/tronco/perna direita/esquerda" -> mm_*; "Gordura braço/tronco/perna ..." -> gd_*.
- Vírgula decimal (48,3) equivale a ponto (48.3).
Se as imagens não forem de bioimpedância, retorne todos os campos null e confidence "baixa".`;

const CAMPOS_NUM = [
  "peso_kg", "imc", "gordura_pct", "massa_gorda_kg", "massa_livre_gordura_kg", "massa_muscular_kg",
  "agua_corporal_l", "agua_intracelular_l", "agua_extracelular_l", "proteina_kg", "minerais_kg",
  "tmb_kcal", "idade_metabolica", "indice_apendicular", "gordura_visceral",
  "mm_braco_dir", "mm_braco_esq", "mm_tronco", "mm_perna_dir", "mm_perna_esq",
  "gd_braco_dir", "gd_braco_esq", "gd_tronco", "gd_perna_dir", "gd_perna_esq",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let userId: string;
    try { ({ userId } = await requireUser(req)); } catch (r) { return r as Response; }

    const body = await req.json();
    const paciente_id: string = body?.paciente_id;
    const imagens: { file_base64: string; mime: string }[] = Array.isArray(body?.imagens) ? body.imagens : [];
    const url: string | undefined = typeof body?.url === "string" ? body.url : undefined;

    if (!paciente_id || (imagens.length === 0 && !url)) {
      return new Response(JSON.stringify({ error: "paciente_id e ao menos uma imagem ou url são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Confirma acesso ao paciente (dono ou próprio paciente).
    const { data: paciente } = await supa
      .from("pacientes").select("id, terapeuta_id, user_id").eq("id", paciente_id).maybeSingle();
    if (!paciente) {
      return new Response(JSON.stringify({ error: "Paciente não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (paciente.terapeuta_id !== userId && paciente.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Conteúdo para a IA: instrução + imagens + (se houver) texto do link.
    // deno-lint-ignore no-explicit-any
    const content: any[] = [{ type: "text", text: "Extraia os dados de bioimpedância. Responda SOMENTE com o JSON." }];
    for (const img of imagens.slice(0, 6)) {
      if (img?.file_base64 && img?.mime) {
        content.push({ type: "image_url", image_url: { url: `data:${img.mime};base64,${img.file_base64}` } });
      }
    }
    if (url) {
      try {
        const pageRes = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (pageRes.ok) {
          const html = await pageRes.text();
          const texto = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ").slice(0, 8000);
          content.push({ type: "text", text: `Texto do laudo (link): ${texto}` });
        }
      } catch { /* link inacessível: segue só com as imagens */ }
    }

    const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de requisições de IA atingido. Tente de novo em instantes." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      throw new Error(`AI Gateway: ${aiRes.status} ${txt.slice(0, 300)}`);
    }

    const aiJson = await aiRes.json();
    const raw = aiJson.choices?.[0]?.message?.content || "{}";
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(raw); } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }

    // Mantém só os campos numéricos válidos (o resto vira string para o form).
    const dados: Record<string, string> = {};
    for (const k of CAMPOS_NUM) {
      const v = parsed[k];
      if (typeof v === "number" && isFinite(v)) dados[k] = String(v);
    }
    const data_hint = typeof parsed.data_hint === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.data_hint)
      ? parsed.data_hint : null;

    return new Response(JSON.stringify({
      ok: true,
      dados,
      data_hint,
      confidence: parsed.confidence ?? null,
      notas: parsed.notas ?? null,
      encontrados: Object.keys(dados).length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[importar-bioimpedancia] erro:", e);
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
