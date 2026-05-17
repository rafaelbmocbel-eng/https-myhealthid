// Shared auth helpers for edge functions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

/**
 * Validates the incoming Authorization header and returns the user id.
 * Throws Response(401) on failure.
 */
export async function requireUser(req: Request): Promise<{ userId: string; token: string }> {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const token = authHeader.replace("Bearer ", "").trim();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return { userId: data.user.id, token };
}

/**
 * Returns true when the request was issued by a trusted internal caller
 * (pg_cron job or another edge function using the service role key).
 * Accepts either Authorization: Bearer <SERVICE_ROLE_KEY> or x-cron-secret header.
 */
export function isInternalCall(req: Request): boolean {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return false;
  const auth = (req.headers.get("Authorization") || req.headers.get("authorization") || "")
    .replace("Bearer ", "")
    .trim();
  const cronHeader = (req.headers.get("x-cron-secret") || "").trim();
  return auth === serviceKey || cronHeader === serviceKey;
}

/** Reject the request unless it comes from an internal caller. */
export function requireInternal(req: Request): void {
  if (!isInternalCall(req)) {
    throw new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
