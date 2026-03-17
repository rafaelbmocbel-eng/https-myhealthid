import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token || typeof token !== 'string' || token.length !== 64 || !/^[a-f0-9]{64}$/.test(token)) {
      return new Response(JSON.stringify({ error: 'Token inválido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Busca o link sem expor a tabela inteira ao cliente anônimo
    const { data, error } = await supabase
      .from('links_avaliacao')
      .select('id, paciente_id, terapeuta_id, blocos_inclusos, data_expiracao, status, acessos_totais, data_primeiro_acesso')
      .eq('token', token)
      .single();

    if (error || !data) {
      return new Response(JSON.stringify({ error: 'Link não encontrado.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (data.status !== 'ativo') {
      return new Response(JSON.stringify({ error: 'Este link foi cancelado.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (new Date(data.data_expiracao) < new Date()) {
      return new Response(JSON.stringify({ error: 'Este link expirou.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Incrementa contador de acesso
    await supabase
      .from('links_avaliacao')
      .update({
        acessos_totais: (data.acessos_totais || 0) + 1,
        data_ultimo_acesso: new Date().toISOString(),
        data_primeiro_acesso: data.data_primeiro_acesso || new Date().toISOString(),
      })
      .eq('id', data.id);

    // Retorna apenas o mínimo necessário — sem token ou IDs sensíveis além do necessário
    return new Response(
      JSON.stringify({
        id: data.id,
        paciente_id: data.paciente_id,
        terapeuta_id: data.terapeuta_id,
        blocos_inclusos: data.blocos_inclusos,
        data_expiracao: data.data_expiracao,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Erro interno.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
