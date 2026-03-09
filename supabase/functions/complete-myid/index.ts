import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, result, rawData } = await req.json();

    if (!token || !result || !rawData) {
      return new Response(JSON.stringify({ error: 'Dados incompletos.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Buscar avaliação pelo token
    const { data: avaliacao, error: fetchError } = await supabase
      .from('myid_avaliacoes')
      .select('*')
      .eq('token_acesso', token)
      .maybeSingle();

    if (fetchError || !avaliacao) {
      return new Response(JSON.stringify({ error: 'Avaliação não encontrada.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (avaliacao.status === 'concluido') {
      return new Response(JSON.stringify({ error: 'Avaliação já foi concluída.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Atualizar myid_avaliacoes para concluído
    const { error: updateError } = await supabase
      .from('myid_avaliacoes')
      .update({
        status: 'concluido',
        respostas_brutas: rawData,
        resultado_processado: result,
        updated_at: new Date().toISOString(),
      })
      .eq('id', avaliacao.id);

    if (updateError) {
      console.error('Erro ao atualizar myid_avaliacoes:', updateError);
      return new Response(JSON.stringify({ error: 'Erro ao salvar respostas.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Se tem paciente_id, salvar em avaliacoes_identidade para aparecer no perfil
    if (avaliacao.paciente_id) {
      try {
        // Buscar nome do paciente
        const { data: paciente } = await supabase
          .from('pacientes')
          .select('nome, sobrenome')
          .eq('id', avaliacao.paciente_id)
          .single();

        const pacienteNome = paciente ? `${paciente.nome} ${paciente.sobrenome}`.trim() : 'Paciente';

        const payload = {
          terapeuta_id: avaliacao.terapeuta_id,
          paciente_id: avaliacao.paciente_id,
          paciente_nome: pacienteNome,
          data_avaliacao: new Date().toISOString().split('T')[0],
          dados_avaliacao: { ...rawData, resultado: result, _source: 'myid_public' },
          classificacao: result?.classificacao || 'N/A',
          myid_score: result?.myidScore || 0,
          score_i: result?.componentScores?.I || 0,
          score_n: result?.componentScores?.N || 0,
          score_p: result?.componentScores?.P || 0,
          score_c: result?.componentScores?.C || 0,
          score_d: result?.componentScores?.D || 0,
          score_r: result?.componentScores?.R || 0,
          score_efi: result?.componentScores?.EFI || 0,
          red_flags: result?.redFlagAlerts || [],
          score_e: null,
          score_f: null,
          id_final: null,
        };

        const { data: savedAval, error: insertError } = await supabase
          .from('avaliacoes_identidade')
          .insert(payload)
          .select()
          .single();

        if (insertError) {
          console.error('Erro ao inserir avaliacoes_identidade:', insertError);
        } else if (savedAval) {
          // 4. Registrar evolução
          try {
            const { data: previousAvals } = await supabase
              .from('avaliacoes_identidade')
              .select('id, created_at, score_p, score_c, score_d, score_r, score_efi, myid_score, score_i, score_n')
              .eq('paciente_id', avaliacao.paciente_id)
              .eq('terapeuta_id', avaliacao.terapeuta_id)
              .neq('id', savedAval.id)
              .order('created_at', { ascending: false })
              .limit(1);

            const { count } = await supabase
              .from('evolucao_paciente')
              .select('id', { count: 'exact', head: true })
              .eq('paciente_id', avaliacao.paciente_id)
              .eq('terapeuta_id', avaliacao.terapeuta_id);

            const prev = previousAvals?.[0] || null;
            const numeroAvaliacao = (count || 0) + 1;

            const scores = {
              score_p: savedAval.score_p,
              score_c: savedAval.score_c,
              score_d: savedAval.score_d,
              score_r: savedAval.score_r,
              score_efi: savedAval.score_efi,
              score_i: savedAval.score_i,
              score_n: savedAval.score_n,
              myid_score: savedAval.myid_score,
            };

            const deltas = prev ? {
              delta_p: (savedAval.score_p ?? 0) - (prev.score_p ?? 0),
              delta_c: (savedAval.score_c ?? 0) - (prev.score_c ?? 0),
              delta_d: (savedAval.score_d ?? 0) - (prev.score_d ?? 0),
              delta_r: (savedAval.score_r ?? 0) - (prev.score_r ?? 0),
              delta_efi: (savedAval.score_efi ?? 0) - (prev.score_efi ?? 0),
              delta_i: (savedAval.score_i ?? 0) - (prev.score_i ?? 0),
              delta_n: (savedAval.score_n ?? 0) - (prev.score_n ?? 0),
              delta_id_final: (savedAval.myid_score ?? 0) - (prev.myid_score ?? 0),
            } : {};

            const diasDesdeAnterior = prev
              ? Math.round((new Date(savedAval.created_at).getTime() - new Date(prev.created_at).getTime()) / (1000 * 60 * 60 * 24))
              : null;

            await supabase.from('evolucao_paciente').insert({
              paciente_id: avaliacao.paciente_id,
              terapeuta_id: avaliacao.terapeuta_id,
              avaliacao_atual_id: savedAval.id,
              avaliacao_anterior_id: prev?.id || null,
              numero_avaliacao: numeroAvaliacao,
              classificacao: savedAval.classificacao,
              ...scores,
              ...deltas,
              dias_desde_anterior: diasDesdeAnterior,
            });
          } catch (evolErr) {
            console.warn('Evolução não registrada:', evolErr);
          }
        }
      } catch (profileErr) {
        console.warn('Erro ao sincronizar perfil:', profileErr);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Erro interno:', e);
    return new Response(JSON.stringify({ error: 'Erro interno.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
