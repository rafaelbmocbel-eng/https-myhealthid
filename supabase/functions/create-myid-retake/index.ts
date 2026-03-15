import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { paciente_id, terapeuta_id } = await req.json();

    if (!paciente_id || !terapeuta_id) {
      return new Response(JSON.stringify({ error: "paciente_id and terapeuta_id are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Check if there's already a pending/in-progress evaluation
    const { data: pending } = await supabase
      .from("myid_avaliacoes")
      .select("id")
      .eq("paciente_id", paciente_id)
      .in("status", ["pendente", "em_andamento"])
      .limit(1)
      .maybeSingle();

    if (pending) {
      return new Response(JSON.stringify({ 
        error: "Já existe um questionário pendente. Complete-o antes de solicitar outro." 
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create new evaluation
    const { data: newEval, error: insertErr } = await supabase
      .from("myid_avaliacoes")
      .insert({
        paciente_id,
        terapeuta_id,
        status: "pendente",
      })
      .select("id")
      .single();

    if (insertErr) {
      throw insertErr;
    }

    return new Response(JSON.stringify({ ok: true, id: newEval.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("create-myid-retake error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
