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
        const body = await req.json();
        const { link_id, paciente_id, bloco_numero, dados_respostas } = body;

        // Validate input types and formats
        if (!link_id || typeof link_id !== 'string' || !/^[0-9a-f-]{36}$/.test(link_id)) {
            return new Response(JSON.stringify({ error: 'link_id inválido.' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        if (paciente_id && (typeof paciente_id !== 'string' || !/^[0-9a-f-]{36}$/.test(paciente_id))) {
            return new Response(JSON.stringify({ error: 'paciente_id inválido.' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        if (!bloco_numero || typeof bloco_numero !== 'number' || bloco_numero < 1 || bloco_numero > 10) {
            return new Response(JSON.stringify({ error: 'bloco_numero inválido.' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        if (!dados_respostas || typeof dados_respostas !== 'object') {
            return new Response(JSON.stringify({ error: 'dados_respostas inválido.' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Usa service role key — nunca exposta ao cliente
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        );

        // Verificar se o link existe e está ativo
        const { data: link, error: linkError } = await supabase
            .from('links_avaliacao')
            .select('id, status, data_expiracao')
            .eq('id', link_id)
            .single();

        if (linkError || !link) {
            return new Response(JSON.stringify({ error: 'Link não encontrado.' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (link.status !== 'ativo') {
            return new Response(JSON.stringify({ error: 'Link não está ativo.' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (new Date(link.data_expiracao) < new Date()) {
            return new Response(JSON.stringify({ error: 'Link expirado.' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Calcular numero_tentativa via service role (seguro)
        const { data: existente } = await supabase
            .from('respostas_avaliacao_paciente')
            .select('numero_tentativa')
            .eq('link_id', link_id)
            .eq('bloco_numero', bloco_numero)
            .order('numero_tentativa', { ascending: false })
            .limit(1)
            .maybeSingle();

        const tentativa = existente ? (existente.numero_tentativa || 1) + 1 : 1;

        // Salvar resposta
        const { error: insertError } = await supabase
            .from('respostas_avaliacao_paciente')
            .insert({
                link_id,
                paciente_id,
                bloco_numero,
                dados_respostas,
                numero_tentativa: tentativa,
            });

        if (insertError) {
            return new Response(JSON.stringify({ error: 'Erro ao salvar resposta.' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({ ok: true, tentativa }), {
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
