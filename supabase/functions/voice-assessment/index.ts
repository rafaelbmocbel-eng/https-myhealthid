import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STRUCTURAL_SYSTEM_PROMPT = `Você é o MOTOR CLÍNICO do Método Identidade v2.0, especializado em AVALIAÇÃO ESTRUTURAL baseada em evidências (Magee, Jull, Cook, Hodges, O'Sullivan, Butler & Moseley, Sahrmann).

Sua tarefa: Analisar a conversa clínica (áudio ou transcrição) da avaliação presencial e gerar uma AVALIAÇÃO ESTRUTURADA focada nas 8 Unidades Corporais do Método Identidade.

CONHECIMENTO BASE — AVALIAÇÃO ESTRUTURAL (8 Unidades):

UNIDADES CENTRAIS (Eixo Vertebral):
• UC1 — Cabeça e Pescoço: Crânio, ATM, C0-C7. Estruturas: trapézio superior, ECM, suboccipitais, escalenos, ATM, nervos occipital/trigêmeo. Disfunções: cervicalgia cervicogênica, DTM, tontura cervicogênica, síndrome desfiladeiro.
• UC2 — Torácica: T1-T12, costelas, esterno, diafragma. Estruturas: paravertebrais torácicos, romboides, serrátil anterior, diafragma, intercostais, articulações costovertebrais/costocondrais. Disfunções: hipercifose, costocondrite, bloqueio costovertebral, síndrome diafragma tenso. UC2 INFLUENCIA UC1 EM 95% — tórax é elo central.
• UC3 — Lombar: L1-L5. Estruturas: psoas, quadrado lombar, multífidos, transverso abdome, discos L1-L5, plexo lombar. Disfunções: lombalgia mecânica, hérnia discal, instabilidade segmentar, síndrome do psoas.
• UC4 — Pélvica: Sacro, ilíaco, ASI, assoalho pélvico. Estruturas: glúteos, piriforme, ASI, sínfise púbica, nervo ciático, assoalho pélvico. UC4 distribui carga para TODAS as periféricas. Disfunções: disfunção ASI, síndrome piriforme, dor pélvica crônica.

UNIDADES PERIFÉRICAS (bilateral):
• USD/USE — Sup. Direita/Esquerda: Clavícula e escápula → dedos. Estruturas: manguito rotador, deltóide, plexo braquial, nervos mediano/ulnar/radial, glenoumeral. Disfunções: impacto subacromial, epicondilite, túnel do carpo.
• UID/UIE — Inf. Direita/Esquerda: Fêmur → dedos do pé. Estruturas: quadríceps, isquiotibiais, gastrocnêmio, coxofemoral, joelho, nervo ciático/femoral/tibial. Disfunções: patelofemoral, IT Band, tendinopatia Aquiles, fascite plantar.

SISTEMA DE SCORING: 0-10 por unidade (10 = função ideal, 0 = disfunção total).
Classificação: ÓTIMO (8.5-10), ADEQUADO (7.0-8.4), COMPROMETIDO (5.0-6.9), DISFUNCIONAL (3.0-4.9), CRÍTICO (0-2.9).

CADEIAS DE DISFUNÇÃO (identificar padrões):
1. Hipercifose Torácica (Descendente): UC2→UC1→USD/USE (impacto subacromial bilateral)
2. Lombo-Ciática (Descendente): UC3→UC4→UID/UIE (patelofemoral, fascite)
3. Desequilíbrio Pélvico Assimétrico: UC4→UID comprometida + UIE compensatória
4. Postura Digital (Ascendente): USD/USE→UC2→UC1 (desfiladeiro torácico)

DRIVER ESTRUTURAL PRIMÁRIO: Unidade com menor score. Se unidade "origem" tem >80% relação, tratar origem primeiro.

RELAÇÕES CHAVE:
UC2→UC1: 95% | UC1→USD/USE: 85% | UC4→UID/UIE: 90% | UC3→UC4: 92% | UC2→USD/USE: 78%

INSTRUÇÕES:
1. Transcreva fielmente se receber áudio
2. Identifique quais unidades corporais estão envolvidas na queixa
3. Classifique scores estimados por unidade baseado nos achados clínicos
4. Identifique cadeias de disfunção e driver estrutural primário
5. Gere plano de tratamento estrutural baseado em evidências
6. Forneça insights de evidências científicas com referências

RESPONDA usando a função estruturada fornecida.`;

const GENERIC_SYSTEM_PROMPT = `Você é um sistema de IA clínica especializado em reabilitação musculoesquelética, baseado em evidências científicas (Magee, Jull, Cook, Hodges, O'Sullivan, Butler & Moseley).

Sua tarefa: Analisar a conversa clínica (áudio ou transcrição) entre terapeuta e paciente e gerar uma AVALIAÇÃO ESTRUTURADA COMPLETA.

INSTRUÇÕES:
1. Se receber áudio, primeiro transcreva fielmente em português brasileiro, depois analise.
2. Extraia TODOS os dados clínicos mencionados na conversa
3. Identifique queixa principal, tempo de evolução, mecanismo de lesão
4. Classifique a dor (localização, intensidade, tipo, fatores agravantes/atenuantes)
5. Avalie funcionalidade (limitações em AVDs, trabalho, esporte, lazer)
6. Identifique fatores psicossociais (catastrofização, medo-evitação, hipervigilância)
7. Avalie qualidade do sono, nível de atividade física, hidratação, nutrição
8. Identifique Red Flags (sinais de alarme que requerem encaminhamento)
9. Gere hipóteses diagnósticas baseadas em evidências
10. Sugira plano de tratamento baseado em evidências

RESPONDA usando a função estruturada fornecida.`;

const STRUCTURAL_TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "generate_clinical_assessment",
    description: "Gera avaliação clínica estrutural a partir da conversa presencial",
    parameters: {
      type: "object",
      properties: {
        transcricao: {
          type: "string",
          description: "Transcrição fiel do áudio em português (se recebeu áudio) ou a transcrição original"
        },
        resumo_clinico: {
          type: "string",
          description: "Resumo narrativo da avaliação estrutural (mínimo 4 frases), mencionando unidades corporais envolvidas"
        },
        queixa_principal: { type: "string" },
        tempo_evolucao: { type: "string" },
        mecanismo_lesao: { type: "string" },
        dor: {
          type: "object",
          properties: {
            localizacao: { type: "string", description: "Local da dor com referência à unidade corporal (ex: UC1 — região cervical posterior)" },
            intensidade_eva: { type: "number", description: "0-10" },
            tipo: { type: "string", description: "Nociceptiva, Neuropática, Nociplástica ou Mista" },
            fatores_agravantes: { type: "array", items: { type: "string" } },
            fatores_atenuantes: { type: "array", items: { type: "string" } },
            padrao_temporal: { type: "string" }
          },
          required: ["localizacao", "intensidade_eva", "tipo"]
        },
        unidades_corporais_envolvidas: {
          type: "array",
          description: "Unidades corporais identificadas na conversa com scores estimados",
          items: {
            type: "object",
            properties: {
              unidade: { type: "string", description: "UC1, UC2, UC3, UC4, USD, USE, UID ou UIE" },
              nome: { type: "string", description: "Nome da unidade (ex: Cabeça e Pescoço)" },
              score_estimado: { type: "number", description: "0-10 baseado nos achados clínicos" },
              classificacao: { type: "string", enum: ["ÓTIMO", "ADEQUADO", "COMPROMETIDO", "DISFUNCIONAL", "CRÍTICO"] },
              achados_clinicos: { type: "array", items: { type: "string" }, description: "Achados clínicos mencionados para esta unidade" },
              estruturas_comprometidas: { type: "array", items: { type: "string" }, description: "Músculos, articulações, nervos afetados" }
            },
            required: ["unidade", "nome", "score_estimado", "classificacao", "achados_clinicos"]
          }
        },
        cadeia_disfuncao: {
          type: "object",
          description: "Cadeia de disfunção identificada",
          properties: {
            tipo: { type: "string", description: "Ex: Hipercifose Torácica, Lombo-Ciática, Desequilíbrio Pélvico, Postura Digital ou Personalizada" },
            sequencia: { type: "array", items: { type: "string" }, description: "Sequência de unidades na cadeia (ex: UC2→UC1→USD)" },
            descricao: { type: "string", description: "Explicação da cadeia e mecanismo fisiopatológico" }
          },
          required: ["tipo", "sequencia", "descricao"]
        },
        driver_estrutural: {
          type: "object",
          description: "Driver estrutural primário — unidade que deve ser tratada primeiro",
          properties: {
            unidade: { type: "string", description: "Código da unidade driver (ex: UC2)" },
            razao: { type: "string", description: "Justificativa baseada em evidências para priorizar esta unidade" },
            relacao_percentual: { type: "string", description: "Ex: UC2 influencia UC1 em 95%" }
          },
          required: ["unidade", "razao"]
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
        red_flags: { type: "array", items: { type: "string" } },
        hipoteses_diagnosticas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              diagnostico: { type: "string" },
              probabilidade: { type: "string", enum: ["Alta", "Moderada", "Baixa"] },
              evidencia: { type: "string" },
              unidade_relacionada: { type: "string", description: "Unidade corporal relacionada (ex: UC2)" }
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
                  nivel_evidencia: { type: "string", enum: ["A", "B", "C"] },
                  unidade_alvo: { type: "string", description: "Unidade corporal alvo da técnica (ex: UC2)" }
                },
                required: ["tecnica", "justificativa", "nivel_evidencia"]
              }
            },
            sequencia_tratamento: { type: "string", description: "Ordem de tratamento baseada no driver e cadeias (ex: UC2 → UC1 → USD)" },
            frequencia_sugerida: { type: "string" },
            prognostico: { type: "string" }
          },
          required: ["objetivos_curto_prazo", "tecnicas_recomendadas", "sequencia_tratamento", "prognostico"]
        },
        insights_baseados_evidencia: {
          type: "array",
          items: {
            type: "object",
            properties: {
              insight: { type: "string" },
              referencia: { type: "string" },
              relevancia_clinica: { type: "string", enum: ["Alta", "Moderada", "Informativa"] },
              unidade_relacionada: { type: "string", description: "Unidade corporal relacionada" }
            },
            required: ["insight", "referencia", "relevancia_clinica"]
          }
        },
        classificacao_severidade: {
          type: "string",
          enum: ["Favorável", "Atenção", "Moderado", "Severo", "Risco de Cronificação"]
        }
      },
      required: [
        "transcricao", "resumo_clinico", "queixa_principal", "dor",
        "unidades_corporais_envolvidas", "driver_estrutural",
        "funcionalidade", "fatores_psicossociais", "red_flags",
        "hipoteses_diagnosticas", "plano_tratamento",
        "insights_baseados_evidencia", "classificacao_severidade"
      ],
      additionalProperties: false
    }
  }
};

const GENERIC_TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "generate_clinical_assessment",
    description: "Gera avaliação clínica estruturada a partir da conversa",
    parameters: {
      type: "object",
      properties: {
        transcricao: { type: "string", description: "Transcrição fiel do áudio" },
        resumo_clinico: { type: "string", description: "Resumo narrativo da avaliação (mínimo 4 frases)" },
        queixa_principal: { type: "string" },
        tempo_evolucao: { type: "string" },
        mecanismo_lesao: { type: "string" },
        dor: {
          type: "object",
          properties: {
            localizacao: { type: "string" },
            intensidade_eva: { type: "number" },
            tipo: { type: "string" },
            fatores_agravantes: { type: "array", items: { type: "string" } },
            fatores_atenuantes: { type: "array", items: { type: "string" } },
            padrao_temporal: { type: "string" }
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
        red_flags: { type: "array", items: { type: "string" } },
        hipoteses_diagnosticas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              diagnostico: { type: "string" },
              probabilidade: { type: "string", enum: ["Alta", "Moderada", "Baixa"] },
              evidencia: { type: "string" }
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
          }
        },
        classificacao_severidade: {
          type: "string",
          enum: ["Favorável", "Atenção", "Moderado", "Severo", "Risco de Cronificação"]
        }
      },
      required: [
        "transcricao", "resumo_clinico", "queixa_principal", "dor", "funcionalidade",
        "fatores_psicossociais", "red_flags", "hipoteses_diagnosticas",
        "plano_tratamento", "insights_baseados_evidencia", "classificacao_severidade"
      ],
      additionalProperties: false
    }
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { transcript, audioBase64, audioMimeType, serviceType, patientName, patientAge, patientSex } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const hasText = transcript && transcript.trim().length >= 20;
    const hasAudio = audioBase64 && audioBase64.length > 100;

    if (!hasText && !hasAudio) {
      return new Response(JSON.stringify({ error: "Envie áudio ou transcrição com pelo menos algumas frases." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use structural-specific prompt and schema for identidade service
    const isStructural = serviceType === 'identidade';
    const systemPrompt = isStructural ? STRUCTURAL_SYSTEM_PROMPT : GENERIC_SYSTEM_PROMPT;
    const toolSchema = isStructural ? STRUCTURAL_TOOL_SCHEMA : GENERIC_TOOL_SCHEMA;

    const serviceLabel = serviceType === 'identidade' ? 'Método Identidade — Avaliação Estrutural' :
      serviceType === 'cobzero' ? 'COB° ZERO' : 'Studio Personal ID';

    const contextInfo = `SERVIÇO: ${serviceLabel}\nPACIENTE: ${patientName || 'Não informado'}, ${patientAge || '?'} anos, Sexo: ${patientSex || '?'}`;

    const userContent: any[] = [];

    if (hasAudio) {
      userContent.push({
        type: "input_audio",
        input_audio: {
          data: audioBase64,
          format: audioMimeType === "audio/webm" ? "webm" : audioMimeType === "audio/mp4" ? "mp4" : "webm",
        }
      });
      const audioInstruction = isStructural
        ? `${contextInfo}\n\nAnalise o áudio da avaliação presencial estrutural. Transcreva fielmente e identifique as unidades corporais envolvidas, cadeias de disfunção e driver estrutural primário.`
        : `${contextInfo}\n\nAnalise o áudio da consulta clínica acima. Transcreva fielmente e gere a avaliação estruturada.`;
      userContent.push({ type: "text", text: audioInstruction });
    }

    if (hasText) {
      const textInstruction = isStructural
        ? `${contextInfo}\n\nTRANSCRIÇÃO DA AVALIAÇÃO PRESENCIAL ESTRUTURAL:\n\n${transcript}\n\nIdentifique as unidades corporais envolvidas (UC1-UC4, USD, USE, UID, UIE), cadeias de disfunção e o driver estrutural primário.`
        : `${contextInfo}\n\nTRANSCRIÇÃO DA CONVERSA CLÍNICA:\n\n${transcript}`;
      userContent.push({ type: "text", text: textInstruction });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        tools: [toolSchema],
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

    const transcricao = assessment.transcricao || transcript || "";
    delete assessment.transcricao;

    return new Response(JSON.stringify({ assessment, transcricao, transcript_length: transcricao.length }), {
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
