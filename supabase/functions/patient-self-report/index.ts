// Permite que o PRÓPRIO PACIENTE registre, no portal dele, um relato de dor por voz/texto
// que alimenta o Avatar Clínico — sempre como `tipo_diagnostico: 'relato_paciente'`
// (mesmo mecanismo já usado pelo botão "Confirmar como Achado" em AvatarClinicoCard.tsx),
// nunca como achado confirmado. O profissional decide se promove o relato a achado clínico.
//
// Usa service role porque o paciente não tem (e não deve ter) permissão de RLS para
// escrever em `eventos_clinicos_anatomicos`/`avaliacoes_voz` — essas tabelas são geridas
// pelo terapeuta. Este endpoint resolve o terapeuta responsável a partir do vínculo
// paciente → terapeuta e aplica as mesmas regras que o profissional usaria.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireUser, corsHeaders } from "../_shared/auth.ts";

interface Finding {
  region_id: string;
  intensity: number;
  structures?: string[];
}

interface AvatarEvent {
  regiao_id: string;
  sistema: string;
  tipo_diagnostico: "achado_clinico" | "historico_relatado";
  tipo_achado: string;
  severidade: number;
  estrutura?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let userId: string;
    try {
      ({ userId } = await requireUser(req));
    } catch (r) {
      return r as Response;
    }

    const body = await req.json();
    const transcript: string = typeof body?.transcript === "string" ? body.transcript.trim() : "";
    const queixaPrincipal: string | null = typeof body?.queixa_principal === "string" ? body.queixa_principal.trim() : null;
    const classificacaoSeveridade: string | null = typeof body?.classificacao_severidade === "string" ? body.classificacao_severidade : null;
    const resultado = body?.resultado && typeof body.resultado === "object" ? body.resultado : {};
    const findings: Finding[] = Array.isArray(body?.findings)
      ? (body.findings as unknown[]).filter((f): f is Finding =>
          !!f && typeof f === "object" &&
          typeof (f as Finding).region_id === "string" && (f as Finding).region_id.trim().length > 0 &&
          typeof (f as Finding).intensity === "number"
        )
      : [];
    const avatarEvents: AvatarEvent[] = Array.isArray(body?.avatar_events)
      ? (body.avatar_events as unknown[]).filter((e): e is AvatarEvent =>
          !!e && typeof e === "object" &&
          typeof (e as AvatarEvent).regiao_id === "string" && (e as AvatarEvent).regiao_id.trim().length > 0 &&
          typeof (e as AvatarEvent).sistema === "string" &&
          typeof (e as AvatarEvent).tipo_achado === "string" &&
          typeof (e as AvatarEvent).severidade === "number"
        )
      : [];

    if (transcript.length < 10) {
      return new Response(JSON.stringify({ error: "Relato muito curto. Descreva com mais detalhes." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: paciente, error: pacienteError } = await supabase
      .from("pacientes")
      .select("id, terapeuta_id, nome, sobrenome")
      .eq("user_id", userId)
      .maybeSingle();

    if (pacienteError || !paciente) {
      return new Response(JSON.stringify({ error: "Paciente não encontrado para este usuário." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mapaDor: Record<string, number> = {};
    findings.forEach((f) => { mapaDor[f.region_id] = f.intensity; });

    const { data: avaliacaoInserida, error: avalError } = await supabase
      .from("avaliacoes_voz")
      .insert({
        terapeuta_id: paciente.terapeuta_id,
        paciente_id: paciente.id,
        paciente_nome: `${paciente.nome} ${paciente.sobrenome || ""}`.trim(),
        servico: "identidade",
        transcricao: transcript,
        resultado: {
          ...resultado,
          _meta: {
            origem: "autocadastro_paciente",
            mode: "voice",
            savedAt: new Date().toISOString(),
            mapa_dor: Object.keys(mapaDor).length > 0 ? mapaDor : null,
          },
        },
        classificacao_severidade: classificacaoSeveridade,
        queixa_principal: queixaPrincipal,
      })
      .select("id")
      .single();

    if (avalError) {
      return new Response(JSON.stringify({ error: `Falha ao salvar relato: ${avalError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let eventosCriados = 0;
    let eventosDuplicados = 0;

    const temEventos = findings.length > 0 || avatarEvents.length > 0;
    if (temEventos) {
      const { data: existentes } = await supabase
        .from("eventos_clinicos_anatomicos")
        .select("regiao_id")
        .eq("paciente_id", paciente.id)
        .neq("status", "resolvido");

      const regioesAtivas = new Set((existentes || []).map((e: { regiao_id: string }) => e.regiao_id));
      const hoje = new Date().toISOString().slice(0, 10);
      const notasBase = "Relato registrado pelo próprio paciente no portal, sem profissional presente. Aguarda confirmação clínica.";

      // Primary: AI-classified events (surgical history, chronic conditions, neurological, systemic)
      const eventosDeAI = avatarEvents
        .filter((ev) => !regioesAtivas.has(ev.regiao_id))
        .map((ev) => ({
          paciente_id: paciente.id,
          terapeuta_id: paciente.terapeuta_id,
          regiao_id: ev.regiao_id,
          sistema: ev.sistema,
          tipo_achado: ev.tipo_achado,
          tipo_diagnostico: "relato_paciente", // always pending confirmation, regardless of AI classification
          origem: "autocadastro_paciente",
          estrutura: ev.estrutura || null,
          severidade: ev.severidade,
          status: "ativo",
          visivel_paciente: true,
          data_inicio: hoje,
          notas_clinicas: notasBase,
          metadata: { fontes: ["autocadastro_paciente"], confianca: "baixa", auto_processado: true, avaliacao_voz_id: avaliacaoInserida.id, ai_tipo_diagnostico: ev.tipo_diagnostico },
        }));

      // Fallback: pain findings from extract-pain-from-voice for MSK regions not already in AI events
      const aiRegioes = new Set(eventosDeAI.map((ev) => ev.regiao_id));
      const eventosDePain = findings
        .filter((f) => !regioesAtivas.has(f.region_id) && !aiRegioes.has(f.region_id))
        .map((f) => ({
          paciente_id: paciente.id,
          terapeuta_id: paciente.terapeuta_id,
          regiao_id: f.region_id,
          sistema: "musculoesqueletico",
          tipo_achado: queixaPrincipal || "Relato do paciente via portal — aguarda confirmação clínica",
          tipo_diagnostico: "relato_paciente",
          origem: "autocadastro_paciente",
          estrutura: f.structures?.length ? f.structures.join(", ") : null,
          severidade: 1,
          status: "ativo",
          visivel_paciente: true,
          data_inicio: hoje,
          notas_clinicas: notasBase,
          metadata: { fontes: ["autocadastro_paciente"], confianca: "baixa", auto_processado: true, avaliacao_voz_id: avaliacaoInserida.id },
        }));

      const novosEventos = [...eventosDeAI, ...eventosDePain];
      eventosDuplicados = (findings.length + avatarEvents.length) - novosEventos.length;

      if (novosEventos.length > 0) {
        const { error: eventosError } = await supabase
          .from("eventos_clinicos_anatomicos")
          .insert(novosEventos);
        if (eventosError) {
          return new Response(JSON.stringify({
            error: `Relato salvo, mas falha ao atualizar o Avatar Clínico: ${eventosError.message}`,
            avaliacaoId: avaliacaoInserida.id,
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        eventosCriados = novosEventos.length;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      avaliacaoId: avaliacaoInserida.id,
      eventosCriados,
      eventosDuplicados,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
