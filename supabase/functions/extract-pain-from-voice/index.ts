// Extrai mapa de dor (regiões + intensidade + estruturas) a partir da
// transcrição/áudio de uma avaliação clínica usando Lovable AI.
import { requireUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RegionDef { id: string; label: string }
interface CatalogEntry { categories: Record<string, string[]> }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    try { await requireUser(req); } catch (r) { return r as Response; }
    const {
      transcript,
      regions,
      catalog,
    }: {
      transcript: string;
      regions: RegionDef[];
      catalog?: Record<string, CatalogEntry>;
    } = await req.json();

    if (!transcript || transcript.trim().length < 10) {
      return new Response(JSON.stringify({ findings: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!regions?.length) {
      return new Response(JSON.stringify({ error: "regions required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const regionList = regions
      .map((r) => `- ${r.id} → ${r.label}`)
      .join("\n");

    const catalogText = catalog
      ? Object.entries(catalog)
          .map(([rid, c]) => {
            const cats = Object.entries(c.categories ?? {})
              .map(([cat, items]) => `    ${cat}: ${items.join(", ")}`)
              .join("\n");
            return `* ${rid}:\n${cats}`;
          })
          .join("\n")
      : "";

    const systemPrompt = `Você é um assistente clínico que extrai EXCLUSIVAMENTE achados de dor mencionados na fala do profissional ou paciente.

Para CADA região anatômica mencionada, retorne:
- region_id: use SOMENTE um dos IDs abaixo (não invente)
- intensity: 0–10 (se a fala disser "leve" use 3, "moderada" 5, "forte/intensa" 7, "insuportável" 9). Se não houver número, infira pela palavra. Se não houver menção de intensidade, use 5.
- structures: nomes de estruturas anatômicas mencionadas para essa região (músculos, ligamentos, tendões, articulações, nervos). Se a estrutura existir no catálogo, use exatamente o nome do catálogo; caso contrário, use o nome falado.

REGRAS:
- NÃO inclua regiões não mencionadas.
- Se a fala citar lado (direito/esquerdo), escolha o ID correspondente (_d / _e).
- Se for dor difusa lombar ou lombo-sacral, use "lombar" (e "gluteos" se o sacro/sacroilíaca for mencionado explicitamente); cervical → "cervical" ou "pescoco".
- Não invente estruturas que não foram ditas.
- Se nada de dor for mencionado, retorne lista vazia.

REGIÕES DISPONÍVEIS:
${regionList}

CATÁLOGO DE ESTRUTURAS POR REGIÃO (referência):
${catalogText}`;

    const tool = {
      type: "function",
      function: {
        name: "report_pain_findings",
        description: "Reporta achados de dor por região anatômica.",
        parameters: {
          type: "object",
          properties: {
            findings: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  region_id: { type: "string" },
                  intensity: { type: "integer", minimum: 0, maximum: 10 },
                  structures: { type: "array", items: { type: "string" } },
                },
                required: ["region_id", "intensity", "structures"],
                additionalProperties: false,
              },
            },
          },
          required: ["findings"],
          additionalProperties: false,
        },
      },
    };

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Transcrição:\n\n${transcript}` },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "report_pain_findings" } },
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiRes.text();
      console.error("[extract-pain] AI error", aiRes.status, t);
      return new Response(JSON.stringify({ error: "Falha na IA", details: t.slice(0, 300) }), {
        status: aiRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiRes.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall ? JSON.parse(toolCall.function.arguments) : { findings: [] };

    // Validar IDs
    const validIds = new Set(regions.map((r) => r.id));
    const findings = (args.findings ?? []).filter((f: any) => validIds.has(f.region_id));

    return new Response(JSON.stringify({ findings }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[extract-pain] error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
