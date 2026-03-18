import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { transcript, serviceType, patientName, patientAge, patientSex } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!transcript || transcript.trim().length < 20) {
      return new Response(JSON.stringify({ error: "Transcrição muito curta. Grave pelo menos algumas frases." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é um sistema de IA clínica especializado em reabilitação musculoesquelética, baseado em evidências científicas (Magee, Jull, Cook, Hodges, O'Sullivan, Butler & Moseley).

Sua tarefa: Analisar a transcrição de uma conversa clínica entre terapeuta e paciente e gerar uma AVALIAÇÃO ESTRUTURADA COMPLETA.

SERVIÇO: ${serviceType === 'identidade' ? 'Método Identidade (MyID) – Avaliação de dor crônica/complexa' : serviceType === 'cobzero' ? 'COB° ZERO – Avaliação de escoliose e coluna' : 'Studio Personal ID – Avaliação funcional/fitness'}

PACIENTE: ${patientName || 'Não informado'}, ${patientAge || '?'} anos, Sexo: ${patientSex || '?'}

INSTRUÇÕES:
1. Extraia TODOS os dados clínicos mencionados na conversa
2. Identifique queixa principal, tempo de evolução, mecanismo de lesão
3. Classifique a dor (localização, intensidade, tipo, fatores agravantes/atenuantes)
4. Avalie funcionalidade (limitações em AVDs, trabalho, esporte, lazer)
5. Identifique fatores psicossociais (catastrofização, medo-evitação, hipervigilância)
6. Avalie qualidade do sono, nível de atividade física, hidratação, nutrição
7. Identifique Red Flags (sinais de alarme que requerem encaminhamento)
8. Gere hipóteses diagnósticas baseadas em evidências
9. Sugira plano de tratamento baseado em evidências

RESPONDA usando a função estruturada fornecida.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `TRANSCRIÇÃO DA CONVERSA CLÍNICA:\n\n${transcript}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_clinical_assessment",
            description: "Gera avaliação clínica estruturada a partir da transcrição",
            parameters: {
              type: "object",
              properties: {
                resumo_clinico: {
                  type: "string",
                  description: "Resumo narrativo da avaliação (mínimo 4 frases)"
                },
                queixa_principal: {
                  type: "string",
                  description: "Queixa principal do paciente"
                },
                tempo_evolucao: {
                  type: "string",
                  description: "Tempo de evolução do quadro (ex: 3 meses, 2 anos)"
                },
                mecanismo_lesao: {
                  type: "string",
                  description: "Mecanismo de lesão ou início dos sintomas"
                },
                dor: {
                  type: "object",
                  properties: {
                    localizacao: { type: "string" },
                    intensidade_eva: { type: "number", description: "0-10" },
                    tipo: { type: "string", description: "Nociceptiva, Neuropática, Nociplástica ou Mista" },
                    fatores_agravantes: { type: "array", items: { type: "string" } },
                    fatores_atenuantes: { type: "array", items: { type: "string" } },
                    padrao_temporal: { type: "string", description: "Constante, Intermitente, Matinal, Noturna" }
                  },
                  required: ["localizacao", "intensidade_eva", "tipo"]
                },
                funcionalidade: {
                  type: "object",
                  properties: {
                    limitacoes_avds: { type: "array", items: { type: "string" } },
                    limitacoes_trabalho: { type: "string" },
                    limitacoes_esporte: { type: "string" },
                    nivel_impacto: { type: "string", enum: ["Leve", "Moderado", "Severo", "Incapacitante"] }
                  },
                  required: ["nivel_impacto"]
                },
                fatores_psicossociais: {
                  type: "object",
                  properties: {
                    catastrofizacao: { type: "string", enum: ["Ausente", "Leve", "Moderada", "Alta"] },
                    medo_evitacao: { type: "string", enum: ["Ausente", "Leve", "Moderado", "Alto"] },
                    qualidade_sono: { type: "string", enum: ["Boa", "Regular", "Ruim", "Muito Ruim"] },
                    estresse: { type: "string", enum: ["Baixo", "Moderado", "Alto", "Muito Alto"] },
                    observacoes: { type: "string" }
                  },
                  required: ["catastrofizacao", "medo_evitacao"]
                },
                red_flags: {
                  type: "array",
                  items: { type: "string" },
                  description: "Sinais de alarme identificados (lista vazia se nenhum)"
                },
                hipoteses_diagnosticas: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      diagnostico: { type: "string" },
                      probabilidade: { type: "string", enum: ["Alta", "Moderada", "Baixa"] },
                      evidencia: { type: "string", description: "Referência científica que suporta" }
                    },
                    required: ["diagnostico", "probabilidade", "evidencia"]
                  }
                },
                plano_tratamento: {
                  type: "object",
                  properties: {
                    objetivos_curto_prazo: { type: "array", items: { type: "string" } },
                    objetivos_longo_prazo: { type: "array", items: { type: "string" } },
                    tecnicas_recomendadas: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          tecnica: { type: "string" },
                          justificativa: { type: "string" },
                          nivel_evidencia: { type: "string", enum: ["A", "B", "C"] }
                        },
                        required: ["tecnica", "justificativa", "nivel_evidencia"]
                      }
                    },
                    frequencia_sugerida: { type: "string" },
                    prognostico: { type: "string" }
                  },
                  required: ["objetivos_curto_prazo", "tecnicas_recomendadas", "prognostico"]
                },
                insights_baseados_evidencia: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      insight: { type: "string" },
                      referencia: { type: "string" },
                      relevancia_clinica: { type: "string", enum: ["Alta", "Moderada", "Informativa"] }
                    },
                    required: ["insight", "referencia", "relevancia_clinica"]
                  },
                  description: "Mínimo 3 insights baseados em literatura científica da reabilitação"
                },
                classificacao_severidade: {
                  type: "string",
                  enum: ["Favorável", "Atenção", "Moderado", "Severo", "Risco de Cronificação"]
                }
              },
              required: [
                "resumo_clinico", "queixa_principal", "dor", "funcionalidade",
                "fatores_psicossociais", "red_flags", "hipoteses_diagnosticas",
                "plano_tratamento", "insights_baseados_evidencia", "classificacao_severidade"
              ],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "generate_clinical_assessment" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("Erro ao processar avaliação");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("Resposta da IA sem dados estruturados");

    const assessment = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ assessment, transcript_length: transcript.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("voice-assessment error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
