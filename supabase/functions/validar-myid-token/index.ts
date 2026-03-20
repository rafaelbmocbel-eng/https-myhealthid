import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token || typeof token !== 'string' || token.length < 16 || token.length > 128) {
      return new Response(JSON.stringify({ error: 'Token inválido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data, error } = await supabase
      .from('myid_avaliacoes')
      .select('id, paciente_id, terapeuta_id, status, respostas_brutas, resultado_processado, token_acesso')
      .eq('token_acesso', token)
      .maybeSingle();

    if (error || !data) {
      return new Response(JSON.stringify({ error: 'Avaliação não encontrada.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update status to em_andamento if pendente
    if (data.status === 'pendente') {
      await supabase
        .from('myid_avaliacoes')
        .update({ status: 'em_andamento' })
        .eq('id', data.id);
    }

    // Return data without exposing the token
    const { token_acesso, ...safeData } = data;

    return new Response(JSON.stringify(safeData), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Erro interno.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
