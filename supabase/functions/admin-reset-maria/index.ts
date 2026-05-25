// Função TEMPORÁRIA — definir senha 'demo1234' para mariamocbel@gmail.com
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const userId = "2f1915e7-4ff9-4908-a194-fddfdb5e24ab";
  const { data, error } = await supabase.auth.admin.updateUserById(userId, {
    password: "demo1234",
    email_confirm: true,
  });

  return new Response(
    JSON.stringify({ ok: !error, error: error?.message, userId: data?.user?.id }),
    { headers: { "content-type": "application/json" } },
  );
});
