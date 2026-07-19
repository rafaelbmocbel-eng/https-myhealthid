// Gera plano alimentar personalizado via Google Gemini API — baseado em
// evidências e no perfil clínico do paciente (MyID + história).
import { requireUser } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { carregarMotoresClinicos, textoMyID, textoPresencial, textoQuestionarios } from "../_shared/motores-plano.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Você é um GRUPO de nutricionistas clínicos (CFN) com 15 anos de experiência de consultório, trabalhando em conjunto para um plano de excelência.
Padrão de qualidade: individualização REAL — o plano deve refletir a bioimpedância/composição corporal, as respostas da anamnese, o perfil MyID e a rotina do paciente; nada genérico.

CÁLCULO E EVIDÊNCIA (siga com rigor):
- Estime o gasto energético: TMB (Mifflin-St Jeor, ou Cunningham/Katch se houver massa magra da bioimpedância) × fator de atividade → TDEE. Aplique o ajuste do OBJETIVO: emagrecimento = déficit de 15-20% (nunca abaixo de ~1200 kcal mulher / ~1500 kcal homem); hipertrofia/ganho = superávit de 5-15%; manutenção/saúde = isocalórico. Deixe a calorias_totais coerente com esse cálculo.
- Proteína: 1,6-2,2 g/kg de peso (mais alto em emagrecimento com treino e em idosos, para preservar massa magra). Gordura: 0,6-1,0 g/kg (mínimo ~20% das kcal). Carboidrato: completa o restante das calorias, priorizando os de baixo índice glicêmico e ao redor do treino.
- Respeite comorbidades e o perfil clínico: hipertensão = menos sódio; resistência à insulina/diabetes = controle glicêmico e fibras; dor/inflamação = padrão anti-inflamatório (ômega-3, coloridos). Nunca prescreva suplementação de risco nem conduta fora do escopo nutricional.
- Distribua em 4-6 refeições coerentes com a rotina; se houver treino, oriente pré e pós-treino. Hidratação: 30-35 ml/kg/dia.
Gere um plano alimentar personalizado em JSON, distribuído em refeições ao longo do dia, respeitando objetivo, preferências, aversões e restrições declaradas na anamnese.
Use alimentos comuns no Brasil, medidas caseiras E gramatura; inclua substituições práticas quando fizer sentido. Os macros de cada item e a soma por refeição devem ser realistas e fechar (aprox.) com calorias_totais e macros do dia.
Retorne SOMENTE JSON neste formato:
{
  "titulo": "string curta",
  "resumo": "1-2 frases sobre estratégia",
  "calorias_totais": 2000,
  "macros": { "proteina_g": 150, "carbo_g": 220, "gordura_g": 65 },
  "refeicoes": [
    {
      "nome": "Café da manhã",
      "horario": "07:00",
      "calorias": 450,
      "itens": [
        { "alimento": "Ovos mexidos", "porcao": "2 unidades (100g)", "kcal": 155, "p": 13, "c": 1, "g": 11 }
      ],
      "substituicoes": "string opcional"
    }
  ],
  "orientacoes": ["string", "string"],
  "lista_compras": ["string"]
}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    let userId: string;
    try { ({ userId } = await requireUser(req)); } catch (r) { return r as Response; }
    const body = await req.json();
    const {
      objetivo, calorias_alvo, refeicoes_por_dia, restricoes, preferencias,
      antropometria, idade, sexo, nivel_atividade, recordatorio, paciente_id,
    } = body || {};
    if (!objetivo) {
      return new Response(JSON.stringify({ error: "objetivo obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    // TRAVA DE ENTITLEMENT: se quem chama é o PRÓPRIO cliente (não o profissional),
    // gerar o plano alimentar com IA exige Premium ou período de teste. Cliente
    // clínico não gera sozinho — paga o Premium ou o profissional monta.
    if (paciente_id) {
      const adminAuth = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: pacRow } = await adminAuth.from("pacientes")
        .select("user_id, tipo_conta, created_at").eq("id", paciente_id).maybeSingle();
      if ((pacRow as any)?.user_id && (pacRow as any).user_id === userId) {
        const tipo = (pacRow as any).tipo_conta;
        const emTeste = tipo === "wellness_free" &&
          Date.now() < new Date((pacRow as any).created_at).getTime() + 7 * 86400000;
        if (tipo !== "wellness_premium" && !emTeste) {
          return new Response(JSON.stringify({ error: "Recurso Premium: assine o Premium ou peça ao seu profissional para montar o plano." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // TRÊS MOTORES (fonte única em _shared/motores-plano.ts): MyID +
    // questionários clínicos validados + avaliação presencial (achados do avatar
    // clínico E observações do profissional). Bioimpedância e anamnese
    // nutricional são específicas da nutrição e entram à parte.
    let perfilClinico = "";
    if (paciente_id) {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const [motores, bioRes, anamRes] = await Promise.all([
        carregarMotoresClinicos(admin, paciente_id),
        admin.from("body_composition").select("*")
          .eq("paciente_id", paciente_id)
          .order("date", { ascending: false }).limit(1).maybeSingle(),
        admin.from("nutricao_anamnese").select("respostas")
          .eq("paciente_id", paciente_id).maybeSingle(),
      ]);
      const bio = bioRes.data as any;
      const anam = (anamRes.data as any)?.respostas;
      const extras: string[] = [];
      if (bio) extras.push(`Bioimpedância/composição corporal (mais recente): ${JSON.stringify(bio).slice(0, 600)}`);
      if (anam && Object.keys(anam).length) extras.push(`Anamnese nutricional (respostas do paciente): ${JSON.stringify(anam).slice(0, 800)}`);
      const extrasTxt = extras.length
        ? `\nDados nutricionais específicos (use para individualizar):\n${extras.join("\n")}`
        : "";
      perfilClinico = `${textoMyID(motores, "nutricao")}${textoPresencial(motores, "nutricao")}${textoQuestionarios(motores, "nutricao")}${extrasTxt}`;
    }

    const userPrompt = `
Paciente: ${idade ? idade + ' anos' : 'idade ?'}, sexo ${sexo || '?'}, nível de atividade ${nivel_atividade || 'moderado'}.
Antropometria: ${antropometria ? JSON.stringify(antropometria) : 'não informada'}.
Recordatório 24h recente: ${recordatorio ? JSON.stringify(recordatorio).slice(0, 1500) : 'não informado'}.${perfilClinico}

Objetivo: ${objetivo}
Calorias-alvo: ${calorias_alvo || 'calcular pela necessidade estimada'}
Refeições/dia: ${refeicoes_por_dia || 5}
Restrições/alergias: ${restricoes || 'nenhuma'}
Preferências: ${preferencias || 'sem preferências especiais'}

Gere o plano alimentar completo em JSON conforme o formato. Baseie-se em diretrizes e evidências científicas; NÃO faça recomendações fora de escopo (medicamentos, suplementação de risco).`.trim();

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
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Limite de uso atingido. Tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`Gemini API: ${aiRes.status} ${txt.slice(0, 200)}`);
    }
    const aiJson = await aiRes.json();
    const content = aiJson.choices?.[0]?.message?.content || "{}";
    let plano: any = {};
    try { plano = JSON.parse(content); } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) plano = JSON.parse(m[0]);
    }

    return new Response(JSON.stringify({ ok: true, plano }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
