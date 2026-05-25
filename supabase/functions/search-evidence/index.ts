// Semantic search over evidence_library. Called by voice-assessment, complete-myid, etc.
// Input: { query: string, areas?: string[], limit?: number, minYear?: number }
// Output: { matches: [{ id, title, authors, journal, year, doi, url, evidence_level, similarity }] }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try { await requireUser(req); } catch (r) { return r as Response; }

  try {
    const body = await req.json();
    const query: string = (body.query ?? "").toString().trim();
    if (!query || query.length < 5) {
      return new Response(JSON.stringify({ error: "query must be at least 5 chars" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const areas: string[] | null = Array.isArray(body.areas) && body.areas.length ? body.areas : null;
    const limit: number = Math.min(Math.max(parseInt(body.limit ?? "5"), 1), 20);
    const minYear: number | null = body.minYear ? parseInt(body.minYear) : null;

    // 1) Embed the query
    const embRes = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-embedding-001",
        input: query.slice(0, 8000),
        dimensions: 1536,
      }),
    });
    if (!embRes.ok) {
      const txt = await embRes.text();
      return new Response(JSON.stringify({ error: "embedding failed", detail: txt }), {
        status: embRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const embJson = await embRes.json();
    const queryEmbedding = embJson.data[0].embedding;

    // 2) Semantic search via RPC
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: matches, error } = await supabase.rpc("match_evidence", {
      query_embedding: queryEmbedding,
      match_count: limit,
      filter_areas: areas,
      min_year: minYear,
    });
    if (error) throw error;

    // 3) Track usage (fire and forget)
    if (matches && matches.length) {
      supabase.rpc("increment_evidence_citation", { p_ids: matches.map((m: any) => m.id) }).then(() => {});
    }

    return new Response(JSON.stringify({ matches: matches ?? [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
