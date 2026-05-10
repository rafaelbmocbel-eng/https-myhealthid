import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { protocolo_id, terapeuta_id, paciente_id, titulo, origem } = body || {};

    if (!protocolo_id || !terapeuta_id) {
      return new Response(JSON.stringify({ error: 'protocolo_id e terapeuta_id obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Buscar email do terapeuta e nome do paciente
    const [{ data: profile }, { data: paciente }] = await Promise.all([
      supabase.from('profiles').select('email, nome').eq('user_id', terapeuta_id).maybeSingle(),
      paciente_id
        ? supabase.from('pacientes').select('nome, sobrenome').eq('id', paciente_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    if (!profile?.email) {
      return new Response(JSON.stringify({ skipped: 'terapeuta sem e-mail cadastrado' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      console.log('RESEND_API_KEY não configurada — apenas notificação in-app foi gerada.');
      return new Response(JSON.stringify({ skipped: 'RESEND_API_KEY ausente' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pacienteNome = paciente
      ? `${paciente.nome || ''} ${paciente.sobrenome || ''}`.trim()
      : 'paciente';
    const origemLabel = origem === 'ia_voz' ? 'Voz'
      : origem === 'ia_escrita' ? 'Escrita'
      : origem === 'ia_myid' ? 'MyID' : 'IA';
    const link = `https://myhealthid.lovable.app/pacientes/${paciente_id}?tab=diretrizes&protocolo=${protocolo_id}`;

    const html = `<!DOCTYPE html><html lang="pt-BR"><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,Helvetica,Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;background:#f4f4f5;"><tr><td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);">
          <tr><td style="padding:24px 28px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;">
            <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;opacity:0.9;">MY HEALTH ID</div>
            <div style="font-size:18px;font-weight:600;margin-top:4px;">✨ Diretriz IA aguardando aprovação</div>
          </td></tr>
          <tr><td style="padding:28px;">
            <p style="margin:0 0 12px;color:#111827;font-size:14px;">Olá ${esc(profile.nome || '')},</p>
            <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.5;">
              A IA gerou uma diretriz de tratamento (<strong>origem: ${origemLabel}</strong>) para <strong>${esc(pacienteNome)}</strong> e está aguardando sua revisão.
            </p>
            <div style="background:#fef3c7;border-left:4px solid #d97706;padding:12px 14px;border-radius:6px;margin:16px 0;">
              <div style="font-size:12px;color:#92400e;font-weight:600;">${esc(titulo || 'Diretriz IA')}</div>
              <div style="font-size:11px;color:#92400e;margin-top:2px;opacity:0.85;">Status: rascunho · pendente de aprovação</div>
            </div>
            <p style="margin:0 0 20px;color:#6b7280;font-size:13px;line-height:1.5;">
              Revise as 3 fases e técnicas sugeridas, edite se necessário e ative para enviá-la oficialmente ao prontuário.
            </p>
            <a href="${link}" style="display:inline-block;background:#d97706;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px;">Revisar diretriz</a>
            <p style="margin:24px 0 0;color:#9ca3af;font-size:11px;">Este e-mail foi enviado pelo MY HEALTH ID. Você está recebendo porque há rascunhos pendentes na sua conta.</p>
          </td></tr>
        </table>
      </td></tr></table></body></html>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'MY HEALTH ID <noreply@metodoidentidade.app>',
        to: [profile.email],
        subject: '✨ Diretriz IA aguardando sua aprovação',
        html,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('Resend error:', data);
      return new Response(JSON.stringify({ error: 'Falha ao enviar', detail: data }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, id: data?.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
