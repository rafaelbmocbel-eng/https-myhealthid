// Gera plano alimentar personalizado via Google Gemini API — baseado em
// evidências e no perfil clínico do paciente (MyID + história).
import { requireUser } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logUsoIA } from "../_shared/log-ia.ts";
import {
  carregarMotoresClinicos, insumosDosMotores, montarEntradaTriagem, resolverContextoGeracao,
  textoAnamneseNutricional, textoFichaClinica, textoMyID, textoPresencial, textoQuestionarios,
} from "../_shared/motores-plano.ts";
import { avaliarTriagem, decidirLiberacao, textoTriagemParaPrompt } from "../_shared/triagem-bloqueio.ts";
import {
  aplicarGovernanca, instrucaoAcompanhamentoPrompt, montarGovernanca, prepararAcompanhamento, REGRA_FONTES_PROMPT,
} from "../_shared/governanca-plano.ts";
import { PARAMETROS_NUTRICAO, textoCalculoNutricional } from "../_shared/parametros-nutricao.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Você é um GRUPO de nutricionistas clínicos (CFN) com 15 anos de experiência de consultório, trabalhando em conjunto para um plano de excelência.
Padrão de qualidade: individualização REAL — o plano deve refletir a bioimpedância/composição corporal, as respostas da anamnese, o perfil MyID e a rotina do paciente; nada genérico.

CÁLCULO E EVIDÊNCIA (siga com rigor):
${textoCalculoNutricional()}
Gere um plano alimentar personalizado em JSON, distribuído em refeições ao longo do dia, respeitando objetivo, preferências, aversões e restrições declaradas na anamnese.
Use alimentos comuns no Brasil, medidas caseiras E gramatura; inclua substituições práticas quando fizer sentido. Os macros de cada item e a soma por refeição devem ser realistas e fechar (aprox.) com calorias_totais e macros do dia.
O plano NÃO substitui o acompanhamento de um nutricionista ou médico. ${REGRA_FONTES_PROMPT}
A ficha clínica e a triagem servem SÓ para adaptar o plano: NUNCA cite diagnósticos, medicamentos, gestação, transtornos alimentares, saúde mental ou resultados de questionários no texto do plano (resumo, observações, orientações), porque o paciente pode compartilhar o plano.
${instrucaoAcompanhamentoPrompt("nutricao")}
Retorne SOMENTE JSON neste formato:
{
  "titulo": "string curta",
  "resumo": "1-2 frases sobre estratégia",
  "calorias_totais": "<número>",
  "macros": { "proteina_g": "<número>", "carbo_g": "<número>", "gordura_g": "<número>" },
  "refeicoes": [
    {
      "nome": "Café da manhã",
      "horario": "07:00",
      "calorias": "<número>",
      "itens": [
        { "alimento": "Ovos mexidos", "porcao": "2 unidades (100g)", "kcal": "<número>", "p": "<número>", "c": "<número>", "g": "<número>" }
      ],
      "substituicoes": "string opcional"
    }
  ],
  "orientacoes": ["string", "string"],
  "lista_compras": ["string"],
  "acompanhamento": {
    "reavaliar_em_semanas": "<número inteiro de semanas>",
    "indicadores": [ { "id": "adesao_refeicoes", "nome": "string", "como_medir": "string", "quando_agir": "string" } ]
  }
}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    let userId: string;
    try { ({ userId } = await requireUser(req)); } catch (r) { return r as Response; }
    const body = await req.json();
    const {
      objetivo, calorias_alvo, refeicoes_por_dia, restricoes, preferencias,
      antropometria, idade, sexo, nivel_atividade, recordatorio, paciente_id, override,
    } = body || {};
    if (!objetivo) {
      return new Response(JSON.stringify({ error: "objetivo obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const json = (corpo: unknown, status = 200) =>
      new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // QUEM está gerando vem do JWT e do banco, nunca do body (fail-closed): o
    // próprio cliente (usa o próprio cadastro se paciente_id faltar) ou um
    // profissional. Sem vínculo nenhum, recusa.
    const ctx = await resolverContextoGeracao(admin, userId, paciente_id);
    if (!ctx.ok || !ctx.chamador) return json({ error: ctx.error || "Sem permissão." }, ctx.status || 403);
    const chamador = ctx.chamador;
    const pacienteId = ctx.pacienteId ?? null;

    // O plano é sempre montado, editado e liberado pelo PROFISSIONAL; o cliente só
    // vê o que foi liberado. Quem chama como próprio cliente é recusado no servidor.
    if (chamador === "cliente") {
      return json({ error: "Seu plano é montado e liberado pelo seu profissional. Ele aparece aqui assim que for liberado." }, 403);
    }

    // TRÊS MOTORES (fonte única em _shared/motores-plano.ts): MyID +
    // questionários clínicos validados + avaliação presencial (achados do avatar
    // clínico E observações do profissional). Bioimpedância e anamnese
    // nutricional são específicas da nutrição e entram à parte.
    const motores = pacienteId ? await carregarMotoresClinicos(admin, pacienteId) : null;

    // TRIAGEM DE SEGURANÇA antes de gastar IA: usa os dados do banco (idade
    // exata, histórico, autodeclaração, MyID), nunca só o que veio no body.
    const triagem = avaliarTriagem(montarEntradaTriagem({
      foco: "nutricao", chamador, motores, idadeBody: idade, textosPedido: [restricoes, preferencias, objetivo],
    }));
    const decisao = decidirLiberacao(triagem, chamador, override);
    if (!decisao.liberado) {
      console.info(JSON.stringify({ fn: "gerar-plano-alimentar", chamador, nivel: triagem.nivel, motivos: triagem.motivos.map((m) => m.codigo) }));
      return json({ ok: false, bloqueio: decisao.bloqueio });
    }

    const insumos = insumosDosMotores(motores, "nutricao");
    let perfilClinico = "";
    if (motores && pacienteId) {
      const { data: bio } = await admin.from("body_composition").select("*")
        .eq("paciente_id", pacienteId)
        .order("date", { ascending: false }).limit(1).maybeSingle();
      // Restrições/alergias vêm primeiro: o corte antigo (800 caracteres do JSON)
      // as perdia quando as respostas anteriores eram longas.
      const anamTxt = textoAnamneseNutricional(motores.anamnese);
      const extras: string[] = [];
      if (bio) { extras.push(`Bioimpedância/composição corporal (mais recente): ${JSON.stringify(bio).slice(0, 600)}`); insumos.push("bioimpedancia"); }
      if (anamTxt) extras.push(`Anamnese nutricional (respostas do paciente — restrições e alergias primeiro): ${anamTxt}`);
      const extrasTxt = extras.length
        ? `\nDados nutricionais específicos (use para individualizar):\n${extras.join("\n")}`
        : "";
      perfilClinico = `${textoMyID(motores, "nutricao")}${textoPresencial(motores, "nutricao")}${textoQuestionarios(motores, "nutricao")}${textoFichaClinica(motores)}${extrasTxt}`;
    }
    perfilClinico += textoTriagemParaPrompt(triagem, "nutricao");
    if (antropometria) insumos.push("antropometria");
    if (recordatorio) insumos.push("recordatorio_24h");
    if (restricoes) insumos.push("restricoes_informadas");

    // Idade e sexo: o cadastro (banco) vale mais que o body.
    const idadeEfetiva = motores?.paciente.idade ?? (Number(idade) || null);
    const sexoEfetivo = sexo || motores?.paciente.sexo || motores?.paciente.genero || null;

    const userPrompt = `
Paciente: ${idadeEfetiva ? idadeEfetiva + ' anos' : 'idade ?'}, sexo ${sexoEfetivo || '?'}, nível de atividade ${nivel_atividade || 'NÃO INFORMADO (use fator conservador e sinalize no plano que foi estimado)'}.
Antropometria: ${antropometria ? JSON.stringify(antropometria) : 'não informada'}.
Recordatório 24h recente: ${recordatorio ? JSON.stringify(recordatorio).slice(0, 1500) : 'não informado'}.${perfilClinico}

Objetivo: ${objetivo}
Calorias-alvo: ${(chamador === 'profissional' && calorias_alvo) || 'calcular pela necessidade estimada'}
Refeições/dia: ${refeicoes_por_dia || 'não informado (defina pela rotina e sinalize)'}
Restrições/alergias: ${restricoes || 'nenhuma'}
Preferências: ${preferencias || 'sem preferências especiais'}

Gere o plano alimentar completo em JSON conforme o formato. Siga apenas os parâmetros do sistema acima (a confirmar) e não afirme respaldo em diretrizes específicas; NÃO faça recomendações fora de escopo (medicamentos, suplementação de risco).`.trim();

    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 120_000);
    const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      if (aiRes.status === 429) return json({ error: "Limite de uso atingido. Tente novamente em instantes." }, 429);
      if (aiRes.status === 402) return json({ error: "Créditos de IA esgotados." }, 402);
      throw new Error(`Gemini API: ${aiRes.status} ${txt.slice(0, 200)}`);
    }
    const aiJson = await aiRes.json();
    await logUsoIA("gerar-plano-alimentar", "gemini-2.5-flash", aiJson?.usage);
    const content = aiJson.choices?.[0]?.message?.content || "{}";
    let plano: any = {};
    try { plano = JSON.parse(content); } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) plano = JSON.parse(m[0]);
    }
    // Plano sem refeições não é um plano: não carimba governança em cima de vazio.
    if (!plano || typeof plano !== "object" || Array.isArray(plano) || !Array.isArray(plano.refeicoes) || plano.refeicoes.length === 0) {
      throw new Error("A IA não retornou um plano válido — tente de novo.");
    }

    // GOVERNANÇA: fonte, parâmetros (todos "a confirmar"), triagem e plano de
    // acompanhamento. Os indicadores obrigatórios têm texto fixo; o da IA é saneado.
    aplicarGovernanca(plano, montarGovernanca({
      funcao: "gerar-plano-alimentar",
      insumos,
      parametros: PARAMETROS_NUTRICAO,
      triagem,
      override: decisao.override,
      acompanhamento: prepararAcompanhamento(plano.acompanhamento, "nutricao"),
    }));

    return json({ ok: true, plano });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
