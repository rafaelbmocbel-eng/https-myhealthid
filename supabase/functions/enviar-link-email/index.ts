import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { patientName, patientEmail, linkUrl, linkType } = await req.json();

    if (!patientEmail || !linkUrl || !linkType) {
      return new Response(JSON.stringify({ error: 'Dados incompletos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const templates: Record<string, { subject: string; title: string; subtitle: string; cta: string; detail: string; color: string }> = {
      avaliacao: {
        subject: '📋 Seu Questionário de Avaliação — Método Identidade',
        title: 'Questionário de Avaliação',
        subtitle: 'Seu terapeuta enviou um questionário para você preencher antes da próxima sessão.',
        cta: 'Responder Questionário',
        detail: 'Leva cerca de 30–40 minutos e pode ser feito de qualquer lugar.',
        color: '#923d59',
      },
      agenda: {
        subject: '📅 Seu Link de Agendamento — Método Identidade',
        title: 'Agendar Sessão',
        subtitle: 'Seu terapeuta compartilhou um link personalizado para você agendar suas sessões.',
        cta: 'Acessar Agenda',
        detail: 'Escolha o melhor horário para você.',
        color: '#d97706',
      },
    };

    const tpl = templates[linkType] ?? templates['avaliacao'];

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${tpl.subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,${tpl.color},#7a2d47);padding:36px 40px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Método Identidade</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">A Biomecânica da Transformação Personalizada</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="margin:0 0 8px;font-size:16px;color:#374151;">Olá, <strong>${patientName}</strong>! 👋</p>
            <h2 style="margin:0 0 16px;font-size:20px;color:${tpl.color};font-weight:700;">${tpl.title}</h2>
            <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.6;">${tpl.subtitle}</p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${linkUrl}" style="display:inline-block;background:${tpl.color};color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:16px;font-weight:600;">${tpl.cta} →</a>
            </div>
            <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">${tpl.detail}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px 32px;">
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;">
              <p style="margin:0 0 6px;font-size:12px;color:#6b7280;">Se o botão não funcionar, copie e cole este link:</p>
              <p style="margin:0;font-size:12px;color:${tpl.color};word-break:break-all;">${linkUrl}</p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">Este é um email automático do Método Identidade. Por favor, não responda.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    // Use Lovable AI Gateway to send email via Resend-compatible endpoint
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    // Use Resend directly via fetch if we have a key, otherwise use a simple fallback
    // Since we don't have SendGrid/Resend key, we'll use the Lovable AI gateway approach
    // Actually, let's use Resend npm package which is the standard approach
    const { Resend } = await import("npm:resend@4");
    
    // Try with LOVABLE_API_KEY as Resend key (won't work), so we need to handle gracefully
    // The correct fix: use the LOVABLE_API_KEY from secrets which is for AI, not email
    // We need to tell the user to add a Resend/SendGrid key
    // But for now, let's make it work by returning a proper error message
    
    const resendKey = Deno.env.get('RESEND_API_KEY') || Deno.env.get('SENDGRID_API_KEY');
    
    if (!resendKey) {
      // Return success but log that no email key is configured
      console.log('No email API key configured (RESEND_API_KEY or SENDGRID_API_KEY). Email not sent.');
      console.log(`Would have sent to: ${patientEmail}, subject: ${tpl.subject}`);
      console.log(`Link URL: ${linkUrl}`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Chave de API de email não configurada. Configure RESEND_API_KEY nas configurações.' 
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use Resend
    const resend = new Resend(resendKey);
    const { data, error } = await resend.emails.send({
      from: 'Método Identidade <noreply@metodoidentidade.app>',
      to: [patientEmail],
      subject: tpl.subject,
      html,
    });

    if (error) {
      console.error('Resend error:', error);
      return new Response(JSON.stringify({ error: 'Falha ao enviar email', detail: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, id: data?.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
