// Cron: dispara broadcasts agendados cujo agendado_para já passou
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: pendentes, error } = await admin.from("agente_broadcasts")
      .select("id")
      .eq("status", "agendado")
      .not("agendado_para", "is", null)
      .lte("agendado_para", new Date().toISOString())
      .limit(20);
    if (error) throw error;

    const disparados: string[] = [];
    for (const bc of pendentes || []) {
      try {
        await admin.functions.invoke("agente-broadcast", { body: { broadcast_id: bc.id } });
        disparados.push(bc.id);
      } catch (_e) { /* segue */ }
    }

    return new Response(JSON.stringify({ ok: true, disparados: disparados.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
