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
    const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
    if (!SENDGRID_API_KEY) {
      return new Response(JSON.stringify({ error: 'SENDGRID_API_KEY não configurada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,${tpl.color},#7a2d47);padding:36px 40px;text-align:center;">
            <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:50%;width:56px;height:56px;line-height:56px;font-size:28px;margin-bottom:12px;">💠</div>
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Método Identidade</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">A Biomecânica da Transformação Personalizada</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="margin:0 0 8px;font-size:16px;color:#374151;">Olá, <strong>${patientName}</strong>! 👋</p>
            <h2 style="margin:0 0 16px;font-size:20px;color:${tpl.color};font-weight:700;">${tpl.title}</h2>
            <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.6;">${tpl.subtitle}</p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${linkUrl}" style="display:inline-block;background:${tpl.color};color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:16px;font-weight:600;letter-spacing:0.2px;">${tpl.cta} →</a>
            </div>
            <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">${tpl.detail}</p>
          </td>
        </tr>
        <!-- Link fallback -->
        <tr>
          <td style="padding:0 40px 32px;">
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;">
              <p style="margin:0 0 6px;font-size:12px;color:#6b7280;">Se o botão não funcionar, copie e cole este link:</p>
              <p style="margin:0;font-size:12px;color:${tpl.color};word-break:break-all;">${linkUrl}</p>
            </div>
          </td>
        </tr>
        <!-- Footer -->
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

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: patientEmail, name: patientName }] }],
        from: { email: 'noreply@metodoidentidade.app', name: 'Método Identidade' },
        subject: tpl.subject,
        content: [{ type: 'text/html', value: html }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('SendGrid error:', err);
      return new Response(JSON.stringify({ error: 'Falha ao enviar email', detail: err }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
