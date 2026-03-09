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
        const { link_id, paciente_id, bloco_numero, dados_respostas, finalizar, resultado_final } = await req.json();

        // Validação básica de entrada
        if (!link_id || !bloco_numero || !dados_respostas) {
            return new Response(JSON.stringify({ error: 'Dados incompletos.' }), {
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
            .select('id, status, data_expiracao, terapeuta_id')
            .eq('id', link_id)
            .single();

        if (linkError || !link) {
            return new Response(JSON.stringify({ error: 'Link não encontrado.' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (link.status !== 'ativo' && !finalizar) {
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

        // --- FINALIZAÇÃO ---
        if (finalizar && resultado_final) {
            // 0. Buscar nome do paciente para manter consistência
            const { data: paciente } = await supabase
                .from('pacientes')
                .select('nome, sobrenome')
                .eq('id', paciente_id)
                .single();

            const paciente_nome = paciente ? `${paciente.nome} ${paciente.sobrenome || ''}`.trim() : 'Paciente';

            // 1. Inserir em avaliacoes_identidade para o prontuário legado/unificado
            const payloadIdentidade = {
                terapeuta_id: link.terapeuta_id,
                paciente_id: paciente_id,
                paciente_nome: paciente_nome,
                data_avaliacao: new Date().toLocaleDateString('pt-BR'),
                dados_avaliacao: resultado_final.dados_completos || resultado_final,
                classificacao: resultado_final.status || 'N/A',
                myid_score: resultado_final.MyID_score || 0,
                score_i: resultado_final.component_scores?.I_inertia || 0,
                score_d: resultado_final.component_scores?.D_pain || 0,
                score_efi: resultado_final.component_scores?.EFI_functionality || 0,
                score_p: resultado_final.component_scores?.P_psychological || 0,
                score_r: resultado_final.component_scores?.R_regulation || 0,
                score_c: resultado_final.component_scores?.C_context || 0,
                score_n: resultado_final.component_scores?.N_noise || 0,
                red_flags: resultado_final.red_flags || false,
                red_flags_details: resultado_final.red_flags_details || [],
                status: 'concluido'
            };

            const { data: novaAvaliacao, error: errorIdentidade } = await supabase
                .from('avaliacoes_identidade')
                .insert(payloadIdentidade)
                .select()
                .single();

            if (errorIdentidade) {
                console.error('Erro ao salvar avaliacoes_identidade:', errorIdentidade);
            } else if (novaAvaliacao) {
                // 1.1 Registrar Evolução (Deltas)
                try {
                    const { data: previousAvals } = await supabase
                        .from('avaliacoes_identidade')
                        .select('*')
                        .eq('paciente_id', paciente_id)
                        .eq('terapeuta_id', link.terapeuta_id)
                        .neq('id', novaAvaliacao.id)
                        .order('created_at', { ascending: false })
                        .limit(1);

                    const { count: evolCount } = await supabase
                        .from('evolucao_paciente')
                        .select('id', { count: 'exact', head: true })
                        .eq('paciente_id', paciente_id)
                        .eq('terapeuta_id', link.terapeuta_id);

                    const numeroAvaliacao = (evolCount || 0) + 1;
                    const prev = previousAvals?.[0] || null;

                    const deltas = prev ? {
                        delta_p: (novaAvaliacao.score_p ?? 0) - (prev.score_p ?? 0),
                        delta_c: (novaAvaliacao.score_c ?? 0) - (prev.score_c ?? 0),
                        delta_d: (novaAvaliacao.score_d ?? 0) - (prev.score_d ?? 0),
                        delta_r: (novaAvaliacao.score_r ?? 0) - (prev.score_r ?? 0),
                        delta_efi: (novaAvaliacao.score_efi ?? 0) - (prev.score_efi ?? 0),
                        delta_i: (novaAvaliacao.score_i ?? 0) - (prev.score_i ?? 0),
                        delta_n: (novaAvaliacao.score_n ?? 0) - (prev.score_n ?? 0),
                        delta_id_final: (novaAvaliacao.myid_score ?? 0) - (prev.myid_score ?? prev.id_final ?? 0),
                    } : { delta_p: 0, delta_c: 0, delta_d: 0, delta_r: 0, delta_efi: 0, delta_i: 0, delta_n: 0, delta_id_final: 0 };

                    const diasDesdeAnterior = prev
                        ? Math.round((new Date(novaAvaliacao.created_at).getTime() - new Date(prev.created_at).getTime()) / (1000 * 60 * 60 * 24))
                        : null;

                    await supabase
                        .from('evolucao_paciente')
                        .insert({
                            paciente_id: paciente_id,
                            terapeuta_id: link.terapeuta_id,
                            avaliacao_atual_id: novaAvaliacao.id,
                            avaliacao_anterior_id: prev?.id || null,
                            numero_avaliacao: numeroAvaliacao,
                            classificacao: novaAvaliacao.classificacao,
                            myid_score: novaAvaliacao.myid_score,
                            score_p: novaAvaliacao.score_p,
                            score_c: novaAvaliacao.score_c,
                            score_d: novaAvaliacao.score_d,
                            score_r: novaAvaliacao.score_r,
                            score_efi: novaAvaliacao.score_efi,
                            score_i: novaAvaliacao.score_i,
                            score_n: novaAvaliacao.score_n,
                            ...deltas,
                            dias_desde_anterior: diasDesdeAnterior,
                        });
                } catch (evolErr) {
                    console.error('Erro ao registrar evolução na Edge Function:', evolErr);
                }
            }

            // 2. Inserir em myid_avaliacoes para compatibilidade com o novo sistema
            const { error: errorMyID } = await supabase
                .from('myid_avaliacoes')
                .insert({
                    paciente_id: paciente_id,
                    terapeuta_id: link.terapeuta_id,
                    status: 'concluido',
                    respostas_brutas: resultado_final.dados_completos || resultado_final,
                    resultado_processado: resultado_final
                });

            if (errorMyID) console.error('Erro ao salvar myid_avaliacoes:', errorMyID);

            // 3. Atualizar o link para concluído
            await supabase
                .from('links_avaliacao')
                .update({ status: 'concluido' })
                .eq('id', link_id);
        }

        return new Response(JSON.stringify({ ok: true, tentativa }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (e) {
        console.error('Erro na function salvar-bloco-avaliacao:', e);
        return new Response(JSON.stringify({ error: 'Erro interno.' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
