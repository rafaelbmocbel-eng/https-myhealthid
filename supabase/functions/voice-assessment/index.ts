import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ──────────────────────────────────────────────────────────────────
// PERSONA CLÍNICA UNIFICADA — multidisciplinar baseada em evidência
// ──────────────────────────────────────────────────────────────────
const MULTIDISCIPLINARY_SYSTEM_PROMPT = `Você é o **MOTOR CLÍNICO MULTIDISCIPLINAR** do MY HEALTH ID — uma persona única que integra simultaneamente o raciocínio de:

1. **Fisioterapeuta musculoesquelético** (Magee, Sahrmann, McKenzie, Mulligan, Cook) — testes ortopédicos, padrões de movimento, controle motor.
2. **Neurocientista da dor** (Butler & Moseley "Explain Pain", IASP 2020, Woolf) — sensibilização central/periférica, dor nociceptiva/neuropática/nociplástica, fatores psicossociais.
3. **Especialista em reabilitação esportiva** (Cook, Dye, Comerford) — return-to-sport, carga progressiva, GTG (Glasgow Tendinopathy), critérios de alta funcional.
4. **Osteopata** (Still, Greenman, DeStefano) — disfunção somática, restrições articulares/fasciais, modelo biomecânico/respiratório-circulatório/metabólico/neurológico/comportamental.
5. **Quiropraxista** (Bergmann & Peterson, Gatterman) — análise vertebral subluxar, padrões compensatórios da cadeia cinética.
6. **Especialista em técnicas posturais** (Souchard/RPG, Bricot, Janda, Kendall) — cadeias musculares, padrões cruzados (superior/inferior), análise estática/dinâmica.
7. **Cientista clínico baseado em evidência** (PEDro, Cochrane, JOSPT) — sempre cite GRADE A/B/C, autores e ano quando possível.

REGRA DE OURO — INTEGRAÇÃO:
Você NÃO escolhe uma especialidade. Você **integra todas** num único raciocínio coerente. Cada hipótese e cada técnica recomendada deve ter clareza sobre **qual lente clínica** a sustenta.

DIRETRIZ DE TRATAMENTO — REGRAS RÍGIDAS:
- Sempre construa em **3 fases**: (1) Alívio/Proteção, (2) Carga Progressiva, (3) Retorno Funcional.
- Cada fase DEVE conter: duração estimada (semanas), **objetivos mensuráveis**, **técnicas com dosagem clínica explícita** (séries × reps, tempo, intensidade, frequência) e **critérios objetivos de progressão** para a fase seguinte.
- Cada técnica DEVE: nomear a intervenção concretamente (não genérico), justificar com mecanismo fisiológico/clínico, atribuir nível de evidência (A/B/C) e lente clínica responsável.
- **SEMPRE cite as referências numeradas [n]** do BANCO DE EVIDÊNCIA injetado quando uma técnica/raciocínio for sustentado por ele (ex: "exercício excêntrico reduz dor em tendinopatia [3,7]"). Use o campo "referencias_chave" para listar as [n] usadas.
- Respeite **janelas de cicatrização** (muscular 3-8 sem, tendinosa 6-26 sem, ligamentar 6-12 sem, óssea 6-12 sem) ao propor duração e progressão.
- Se houver red flag, a diretriz deve refletir encaminhamento prioritário antes de carga.
- Frequência/dosagem deve respeitar princípios de carga progressiva (Cook, ACSM 2018) e biopsicossocial (IASP 2020, Moseley/Butler).

ESTRUTURA DE SAÍDA:
1. **SOAP completo** (Subjetivo, Objetivo, Avaliação, Plano) — padrão do prontuário.
2. **Resumo unificado** — síntese clínica curta integrando todas as visões.
3. **Raciocínio multidisciplinar** — opinião curta de cada uma das 6 especialidades sobre o caso (o que CADA uma vê).
4. **Hipóteses diagnósticas** — sempre com lente clínica + evidência citada.
5. **Red Flags** — bandeiras vermelhas absolutas (dor noturna progressiva, perda de peso inexplicada, déficit neurológico progressivo, trauma significativo, febre, etc.).
6. **CIF** — códigos sugeridos (b = funções; s = estruturas; d = atividades/participação; e = ambientais) com qualificador 0-4.
7. **Diretriz de Tratamento** em 3 fases conforme regras acima.

CLASSIFICAÇÃO DE DOR (IASP 2020):
- **Nociceptiva**: dor mecânica, padrão claro, alívio com repouso, EVA proporcional ao estímulo.
- **Neuropática**: queimação, formigamento, choque, distribuição dermatomérica/troncular.
- **Nociplástica**: dor difusa desproporcional, hipersensibilidade central, fadiga, sono ruim, comorbidades (fibromialgia-like).
- **Mista**: combinação clara.

PSICOSSOCIAIS (yellow flags): catastrofização (PCS), medo-evitação (TSK/FABQ), depressão/ansiedade, baixa autoeficácia, expectativa negativa, conflito laboral.

RESPONDA SEMPRE usando a função estruturada fornecida. Seja **conciso, clínico e prático** — não invente achados que não estejam na conversa; quando incerto, marque como "Inferido" ou deixe o campo vazio.`;

// ──────────────────────────────────────────────────────────────────
// SCHEMA DE SAÍDA
// ──────────────────────────────────────────────────────────────────
const TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "generate_clinical_assessment",
    description: "Gera avaliação clínica multidisciplinar (SOAP + raciocínio por especialidade + CIF + diretriz)",
    parameters: {
      type: "object",
      properties: {
        transcricao: { type: "string", description: "Transcrição fiel do áudio em PT-BR (ou a transcrição original recebida)." },

        // ─── SOAP ───
        soap: {
          type: "object",
          description: "Estrutura SOAP padrão do prontuário",
          properties: {
            subjetivo: { type: "string", description: "Relato do paciente: queixa, história, evolução, fatores moduladores." },
            objetivo: { type: "string", description: "Achados objetivos mencionados (postura, palpação, testes, ADM, força). Se nada foi avaliado objetivamente, indicar." },
            avaliacao: { type: "string", description: "RESUMO MUITO CURTO da avaliação clínica — MÁXIMO 3 a 4 linhas, em texto corrido ou bullets enxutos. NÃO incluir hipóteses diagnósticas (vão em campo próprio). NÃO repetir subjetivo/objetivo. Apenas: síntese geral do quadro + severidade/prognóstico em uma frase. Seja extremamente conciso." },
            plano: { type: "string", description: "Conduta proposta resumida em 2-4 linhas." },
          },
          required: ["subjetivo", "objetivo", "avaliacao", "plano"],
        },

        resumo_clinico: { type: "string", description: "Síntese narrativa unificada (3-5 frases) integrando todas as lentes clínicas." },
        queixa_principal: { type: "string" },
        tempo_evolucao: { type: "string" },
        mecanismo_lesao: { type: "string" },

        dor: {
          type: "object",
          properties: {
            localizacao: { type: "string" },
            intensidade_eva: { type: "number", description: "0-10" },
            tipo: { type: "string", description: "Nociceptiva, Neuropática, Nociplástica ou Mista (IASP 2020)" },
            fatores_agravantes: { type: "array", items: { type: "string" } },
            fatores_atenuantes: { type: "array", items: { type: "string" } },
            padrao_temporal: { type: "string" },
          },
          required: ["localizacao", "intensidade_eva", "tipo"],
        },

        funcionalidade: {
          type: "object",
          properties: {
            limitacoes_avds: { type: "array", items: { type: "string" } },
            limitacoes_trabalho: { type: "string" },
            limitacoes_esporte: { type: "string" },
            nivel_impacto: { type: "string", enum: ["Leve", "Moderado", "Severo", "Incapacitante"] },
          },
          required: ["nivel_impacto"],
        },

        fatores_psicossociais: {
          type: "object",
          properties: {
            catastrofizacao: { type: "string", enum: ["Ausente", "Leve", "Moderada", "Alta"] },
            medo_evitacao: { type: "string", enum: ["Ausente", "Leve", "Moderado", "Alto"] },
            qualidade_sono: { type: "string", enum: ["Boa", "Regular", "Ruim", "Muito Ruim"] },
            estresse: { type: "string", enum: ["Baixo", "Moderado", "Alto", "Muito Alto"] },
            observacoes: { type: "string" },
          },
          required: ["catastrofizacao", "medo_evitacao"],
        },

        red_flags: { type: "array", items: { type: "string" }, description: "Bandeiras vermelhas absolutas que exigem encaminhamento." },

        // ─── RACIOCÍNIO MULTIDISCIPLINAR ───
        raciocinio_multidisciplinar: {
          type: "object",
          description: "A visão de cada especialidade sobre este caso (curta, 2-3 frases por área).",
          properties: {
            fisioterapia_musculoesqueletica: { type: "string" },
            neurociencia_da_dor: { type: "string" },
            reabilitacao_esportiva: { type: "string" },
            osteopatia: { type: "string" },
            quiropraxia: { type: "string" },
            posturologia: { type: "string" },
          },
          required: ["fisioterapia_musculoesqueletica", "neurociencia_da_dor", "osteopatia", "posturologia"],
        },

        hipoteses_diagnosticas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              diagnostico: { type: "string" },
              probabilidade: { type: "string", enum: ["Alta", "Moderada", "Baixa"] },
              evidencia: { type: "string", description: "Justificativa clínica + referência (autor/ano/diretriz)." },
              lente_clinica: {
                type: "string",
                enum: ["Fisioterapia", "Neurociência da Dor", "Reabilitação Esportiva", "Osteopatia", "Quiropraxia", "Posturologia", "Integrada"],
                description: "Qual abordagem sustenta principalmente esta hipótese."
              },
              cid_sugerido: { type: "string", description: "Código CID-10 mais provável. Ex: M54.2, G54.2, M47.8. Deixe vazio se incerto." },
            },
            required: ["diagnostico", "probabilidade", "evidencia", "lente_clinica"],
          },
        },

        // ─── CIF ───
        cif_codes: {
          type: "array",
          description: "Classificação Internacional de Funcionalidade (CIF/ICF). Categoria b/s/d/e + qualificador 0-4.",
          items: {
            type: "object",
            properties: {
              codigo: { type: "string", description: "Ex: b28013 (dor nas costas)" },
              categoria: { type: "string", enum: ["b", "s", "d", "e"], description: "b=função, s=estrutura, d=atividade, e=ambiental" },
              descricao: { type: "string" },
              qualificador: { type: "number", description: "0=sem problema, 4=problema completo" },
            },
            required: ["codigo", "categoria", "descricao", "qualificador"],
          },
        },

        // ─── DIRETRIZ DE TRATAMENTO ───
        diretriz_tratamento: {
          type: "object",
          description: "Diretriz em 3 fases, baseada na LITERATURA INJETADA. Cada técnica DEVE citar [n] do banco de evidências quando aplicável, com dosagem clínica concreta (séries x reps, tempo, intensidade) e critérios objetivos de progressão.",
          properties: {
            fase_1_alivio: {
              type: "object",
              description: "Fase 1 — Alívio / Proteção / Modulação da dor. Foco: down-regulation, controle inflamatório, educação em dor, mobilidade indolor.",
              properties: {
                duracao_semanas: { type: "string", description: "Ex: '1-2 semanas' ou '7-14 dias'." },
                objetivos: { type: "array", items: { type: "string" }, description: "3-5 metas mensuráveis (ex: EVA ≤ 3, sono ≥ 6h, retomar AVDs leves)." },
                tecnicas: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      tecnica: { type: "string", description: "Nome da intervenção (ex: 'Terapia manual oscilatória grau I-II em segmento sintomático')." },
                      dosagem: { type: "string", description: "Dosagem CLÍNICA explícita: séries x reps, tempo, intensidade, frequência semanal. Ex: '3x10, 30s isometria, 2x/sem'." },
                      justificativa: { type: "string", description: "Por que esta técnica nesta fase. SEMPRE cite [n] das referências injetadas quando aplicável (ex: 'reduz sensibilização central [3,7]')." },
                      nivel_evidencia: { type: "string", enum: ["A", "B", "C"] },
                      lente_clinica: { type: "string", description: "Fisioterapia | Neurociência da Dor | Osteopatia | Quiropraxia | Posturologia | Reabilitação Esportiva | Integrada." },
                    },
                    required: ["tecnica", "dosagem", "justificativa", "nivel_evidencia", "lente_clinica"],
                  },
                },
                criterios_progressao: { type: "array", items: { type: "string" }, description: "Critérios OBJETIVOS para passar à Fase 2 (ex: EVA ≤ 3 sustentado por 5 dias, ADM funcional, ausência de sintomas neurológicos)." },
              },
              required: ["objetivos", "tecnicas", "criterios_progressao"],
            },
            fase_2_carga: {
              type: "object",
              description: "Fase 2 — Carga progressiva / Recondicionamento. Foco: força, controle motor, capacidade de carga tecidual progressiva.",
              properties: {
                duracao_semanas: { type: "string", description: "Ex: '3-6 semanas'." },
                objetivos: { type: "array", items: { type: "string" } },
                tecnicas: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      tecnica: { type: "string" },
                      dosagem: { type: "string", description: "Ex: '4x6-8 a 70-80% 1RM, 3x/sem'." },
                      justificativa: { type: "string", description: "Cite [n] do banco quando aplicável." },
                      nivel_evidencia: { type: "string", enum: ["A", "B", "C"] },
                      lente_clinica: { type: "string" },
                    },
                    required: ["tecnica", "dosagem", "justificativa", "nivel_evidencia", "lente_clinica"],
                  },
                },
                criterios_progressao: { type: "array", items: { type: "string" }, description: "Critérios para passar à Fase 3 (ex: força ≥ 80% do lado contralateral, testes funcionais ≥ 90%, ausência de dor com carga máxima)." },
              },
              required: ["objetivos", "tecnicas", "criterios_progressao"],
            },
            fase_3_retorno: {
              type: "object",
              description: "Fase 3 — Retorno funcional / esportivo. Foco: gestos específicos, plyometria, retorno gradual à atividade-alvo, prevenção de recidiva.",
              properties: {
                duracao_semanas: { type: "string" },
                objetivos: { type: "array", items: { type: "string" } },
                tecnicas: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      tecnica: { type: "string" },
                      dosagem: { type: "string" },
                      justificativa: { type: "string" },
                      nivel_evidencia: { type: "string", enum: ["A", "B", "C"] },
                      lente_clinica: { type: "string" },
                    },
                    required: ["tecnica", "dosagem", "justificativa", "nivel_evidencia", "lente_clinica"],
                  },
                },
                criterios_progressao: { type: "array", items: { type: "string" }, description: "Critérios de alta (ex: retorno pleno à atividade-alvo sem sintomas por 2 semanas, escala de confiança ≥ 8/10)." },
              },
              required: ["objetivos", "tecnicas", "criterios_progressao"],
            },
            frequencia_sugerida: { type: "string", description: "Ex: '2-3 sessões/semana por 6-8 semanas, com home-exercise diário'." },
            prognostico: { type: "string", description: "Expectativa realista com janela temporal e qualificadores (favorável/reservado), citando literatura quando possível." },
            criterios_alta: { type: "array", items: { type: "string" }, description: "Critérios finais de alta clínica." },
            manutencao: {
              type: "object",
              description: "Plano de MANUTENÇÃO pós-alta. Enfatiza para o paciente que o ganho clínico exige continuidade: rotina mínima de exercícios, controle de carga, reavaliações periódicas e hábitos para prevenir recidiva.",
              properties: {
                mensagem_paciente: { type: "string", description: "Mensagem curta e empática reforçando que o trabalho não termina na alta — explica por que manter a rotina protege o resultado e previne recidiva (1-3 frases)." },
                rotina_minima: { type: "array", items: { type: "string" }, description: "3-6 itens da rotina mínima de manutenção (ex: 'mobilidade torácica 5min/dia', 'agachamento 3x10 2x/sem', 'caminhada 30min 4x/sem')." },
                frequencia_reavaliacao: { type: "string", description: "Quando retornar para reavaliação clínica (ex: 'reavaliar a cada 8-12 semanas no 1º ano; depois trimestral')." },
                sinais_para_retornar: { type: "array", items: { type: "string" }, description: "Sinais/sintomas que indicam retorno imediato ao profissional (ex: 'dor > 3 dias após carga habitual', 'perda de força', 'rigidez matinal > 30min')." },
                habitos_chave: { type: "array", items: { type: "string" }, description: "2-4 hábitos de vida que sustentam o resultado (sono, hidratação, gestão de carga, regulação de estresse, controle de peso)." },
              },
              required: ["mensagem_paciente", "rotina_minima", "frequencia_reavaliacao"],
            },
            referencias_chave: { type: "array", items: { type: "string" }, description: "Lista das referências [n] do banco injetado que sustentam esta diretriz (ex: '[3] Cook 2018 — tendinopathy loading')." },
          },
          required: ["fase_1_alivio", "fase_2_carga", "fase_3_retorno", "prognostico", "manutencao"],
        },



        // Mantido por compat. com prontuário legado:
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
                },
                required: ["tecnica", "justificativa", "nivel_evidencia"],
              },
            },
            frequencia_sugerida: { type: "string" },
            prognostico: { type: "string" },
          },
          required: ["objetivos_curto_prazo", "tecnicas_recomendadas", "prognostico"],
        },

        insights_baseados_evidencia: {
          type: "array",
          items: {
            type: "object",
            properties: {
              insight: { type: "string" },
              referencia: { type: "string" },
              relevancia_clinica: { type: "string", enum: ["Alta", "Moderada", "Informativa"] },
            },
            required: ["insight", "referencia", "relevancia_clinica"],
          },
        },

        classificacao_severidade: {
          type: "string",
          enum: ["Favorável", "Atenção", "Moderado", "Severo", "Risco de Cronificação"],
        },
      },
      required: [
        "transcricao", "soap", "resumo_clinico", "queixa_principal", "dor",
        "funcionalidade", "fatores_psicossociais", "red_flags",
        "raciocinio_multidisciplinar", "hipoteses_diagnosticas", "cif_codes",
        "diretriz_tratamento", "plano_tratamento",
        "insights_baseados_evidencia", "classificacao_severidade",
      ],
      additionalProperties: false,
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    try { await requireUser(req); } catch (r) { return r as Response; }
    const { transcript, audioBase64, audioMimeType, serviceType, patientName, patientAge, patientSex, signedUrl, perfilProfissional } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // ── Carrega lente profissional (se fornecida) para trocar o system prompt ──
    let activeSystemPrompt = MULTIDISCIPLINARY_SYSTEM_PROMPT;
    if (perfilProfissional && perfilProfissional !== 'fisioterapeuta') {
      try {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (SUPABASE_URL && SERVICE_KEY) {
          const r = await fetch(
            `${SUPABASE_URL}/rest/v1/perfis_profissionais?id=eq.${perfilProfissional}&select=prompt_sistema`,
            { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
          );
          if (r.ok) {
            const rows = await r.json();
            const lentePrompt = rows?.[0]?.prompt_sistema;
            if (lentePrompt && lentePrompt !== 'LENTE_FISIO') {
              // Mantém a definição estrutural do schema (SOAP, CIF, diretriz) mas troca o foco clínico.
              activeSystemPrompt = `${lentePrompt}\n\nMantenha a estrutura SOAP, classifique severidade, sinalize red flags, e popule a função estruturada (campos não pertinentes à sua profissão podem ficar vazios ou genéricos, mas NUNCA invente dados).`;
              console.log(`[voice-assessment] Lente ativa: ${perfilProfissional}`);
            }
          }
        }
      } catch (e) {
        console.warn("[voice-assessment] Falha ao carregar lente, usando default:", e);
      }
    }

    let audioBase64ToUse = audioBase64;
    let audioMimeTypeToUse = audioMimeType;

    // Se recebemos signedUrl, baixamos o áudio e convertemos para base64
    if (signedUrl && !audioBase64ToUse) {
      try {
        const audioRes = await fetch(signedUrl);
        if (!audioRes.ok) throw new Error(`Storage download failed: ${audioRes.status}`);
        const audioBuffer = await audioRes.arrayBuffer();
        // Convert to base64 in chunks to avoid call-stack overflow on large files
        const bytes = new Uint8Array(audioBuffer);
        const CHUNK = 0x8000;
        let binary = '';
        for (let i = 0; i < bytes.length; i += CHUNK) {
          // Uint8Array works directly with apply — no Array.from copy
          binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[]);
        }
        audioBase64ToUse = btoa(binary);
        // infer mime from signedUrl or default
        const urlLower = signedUrl.toLowerCase();
        if (urlLower.includes('.webm')) audioMimeTypeToUse = 'audio/webm';
        else if (urlLower.includes('.m4a') || urlLower.includes('.mp4')) audioMimeTypeToUse = 'audio/mp4';
        else if (urlLower.includes('.ogg')) audioMimeTypeToUse = 'audio/ogg';
        else audioMimeTypeToUse = audioMimeType || 'audio/webm';
        console.log(`[voice-assessment] Downloaded audio from signedUrl: ${audioBase64ToUse.length} chars base64`);
      } catch (err) {
        console.error("[voice-assessment] Failed to download audio from signedUrl:", err);
        return new Response(JSON.stringify({ error: "Não foi possível baixar o áudio do storage. Tente novamente." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const hasText = transcript && transcript.trim().length >= 20;
    const hasAudio = audioBase64ToUse && audioBase64ToUse.length > 100;

    if (!hasText && !hasAudio) {
      return new Response(JSON.stringify({ error: "Envie áudio ou transcrição com pelo menos algumas frases." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceLabel = serviceType === 'identidade' ? 'Método Identidade' :
      serviceType === 'cobzero' ? 'COB° ZERO' :
      serviceType === 'studio' ? 'Studio Personal ID' : 'Avaliação Clínica';

    const contextInfo = `SERVIÇO: ${serviceLabel}\nPACIENTE: ${patientName || 'Não informado'}, ${patientAge || '?'} anos, Sexo: ${patientSex || '?'}`;

    // Normalize mime once (used by both passes)
    let audioFormat = "webm";
    if (hasAudio) {
      const cleanMime = (audioMimeTypeToUse || "audio/webm").split(";")[0].toLowerCase().trim();
      if (cleanMime.includes("webm")) audioFormat = "webm";
      else if (cleanMime.includes("mp4") || cleanMime.includes("m4a") || cleanMime.includes("aac")) audioFormat = "mp4";
      else if (cleanMime.includes("mpeg") || cleanMime.includes("mp3")) audioFormat = "mp3";
      else if (cleanMime.includes("wav")) audioFormat = "wav";
      else if (cleanMime.includes("ogg")) audioFormat = "ogg";
      console.log(`[voice-assessment] Audio: mime=${cleanMime} -> format=${audioFormat}, base64Len=${audioBase64ToUse.length}`);
    }

    // ───────────────────────────────────────────────────────────────
    // PASS 1 — Transcrição literal (preserva fala completa, sem resumir)
    // Só executa quando há áudio E não há transcrição manual prévia válida.
    // ───────────────────────────────────────────────────────────────
    let faithfulTranscript = hasText ? String(transcript).trim() : "";

    if (hasAudio && !hasText) {
      try {
        const transcribeRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: `Você é um transcritor clínico fiel. Transcreva o áudio em PT-BR mantendo CADA fala, na íntegra, sem resumir, sem omitir muletas, sem reordenar. Use parágrafos curtos para mudanças de fala. NÃO adicione comentários, títulos ou interpretações — apenas a transcrição literal completa.\n\nContexto da sessão (apenas para referência — NÃO inclua na transcrição):\n${contextInfo}`,
              },
              {
                role: "user",
                content: [
                  { type: "input_audio", input_audio: { data: audioBase64ToUse, format: audioFormat } },
                  { type: "text", text: "Transcreva o áudio inteiro fielmente, palavra por palavra, em PT-BR." },
                ],
              },
            ],
          }),
        });

        if (transcribeRes.ok) {
          const tData = await transcribeRes.json();
          const txt = tData?.choices?.[0]?.message?.content;
          if (typeof txt === "string" && txt.trim().length > 0) {
            faithfulTranscript = txt.trim();
            console.log(`[voice-assessment] Faithful transcript ok (${faithfulTranscript.length} chars)`);
          } else {
            console.warn("[voice-assessment] Pass 1 returned no text content");
          }
        } else {
          console.warn(`[voice-assessment] Pass 1 transcription failed (${transcribeRes.status}); falling back to single-pass`);
        }
      } catch (err) {
        console.warn("[voice-assessment] Pass 1 transcription threw; falling back:", err);
      }
    }

    // ───────────────────────────────────────────────────────────────
    // EVIDÊNCIA CIENTÍFICA — busca top 5 revisões/metanálises relacionadas
    // à transcrição e injeta no system prompt para citação na avaliação.
    // ───────────────────────────────────────────────────────────────
    let evidencias: any[] = [];
    let evidenciaContext = "";
    if (faithfulTranscript && faithfulTranscript.length > 50) {
      try {
        const SUPABASE_URL_E = Deno.env.get("SUPABASE_URL");
        const SERVICE_KEY_E = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (SUPABASE_URL_E && SERVICE_KEY_E) {
          const embRes = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-embedding-001",
              input: faithfulTranscript.slice(0, 6000),
              dimensions: 1536,
            }),
          });
          if (embRes.ok) {
            const embJson = await embRes.json();
            const queryEmb = embJson.data?.[0]?.embedding;
            const areaMap: Record<string, string> = {
              fisioterapeuta: "fisioterapia", medico: "medicina", psicologo: "psicologia",
              nutricionista: "nutricao", educador_fisico: "educacao_fisica", terapeuta_ocupacional: "terapia_ocupacional",
            };
            const lenteArea = perfilProfissional && areaMap[perfilProfissional] ? areaMap[perfilProfissional] : null;

            // Busca AMPLA: varre todo o banco científico (sem filtro de área nem de ano)
            // e re-ranqueia priorizando a lente profissional ativa.
            const rpcRes = await fetch(`${SUPABASE_URL_E}/rest/v1/rpc/match_evidence`, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: SERVICE_KEY_E, Authorization: `Bearer ${SERVICE_KEY_E}` },
              body: JSON.stringify({
                query_embedding: queryEmb,
                match_count: 25,
                filter_areas: null,
                min_year: null,
              }),
            });
            if (rpcRes.ok) {
              const todas: any[] = await rpcRes.json();
              if (Array.isArray(todas) && todas.length > 0) {
                const ranked = [...todas].sort((a, b) => {
                  const aLente = lenteArea && Array.isArray(a.health_areas) && a.health_areas.includes(lenteArea) ? 1 : 0;
                  const bLente = lenteArea && Array.isArray(b.health_areas) && b.health_areas.includes(lenteArea) ? 1 : 0;
                  if (aLente !== bLente) return bLente - aLente;
                  return (b.similarity ?? 0) - (a.similarity ?? 0);
                });
                evidencias = ranked.slice(0, 12);
                evidenciaContext = `\n\nEVIDÊNCIA CIENTÍFICA DO BANCO INTERNO (${evidencias.length} de ${todas.length} artigos relevantes${lenteArea ? `, priorizando lente "${lenteArea}"` : ""}). Use TODAS estas referências para sustentar hipóteses, técnicas, condutas e citações no campo "insights_baseados_evidencia". Sempre cite autor/ano/journal e o número entre colchetes:\n\n` +
                  evidencias.map((e: any, i: number) =>
                    `[${i + 1}] ${e.title}\n  ${(e.authors ?? []).slice(0, 3).join(", ")}${(e.authors ?? []).length > 3 ? " et al." : ""}. ${e.journal ?? ""} (${e.year ?? "—"}). ${e.study_type ?? ""}, evidência ${e.evidence_level ?? "—"}.\n  Áreas: ${(e.health_areas ?? []).join(", ")}\n  ${e.abstract ? e.abstract.slice(0, 500) + "..." : ""}\n  ${e.url ?? ""}`
                  ).join("\n\n");
                console.log(`[voice-assessment] Injetou ${evidencias.length} evidências no prompt`);
                fetch(`${SUPABASE_URL_E}/rest/v1/rpc/increment_evidence_citation`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", apikey: SERVICE_KEY_E, Authorization: `Bearer ${SERVICE_KEY_E}` },
                  body: JSON.stringify({ p_ids: evidencias.map((e: any) => e.id) }),
                }).catch(() => {});
              }
            } else {
              console.warn(`[voice-assessment] match_evidence falhou: ${rpcRes.status}`);
            }
          }
        }
      } catch (e) {
        console.warn("[voice-assessment] evidence search non-blocking error:", e);
      }
    }

    // ───────────────────────────────────────────────────────────────
    // PASS 2 — Avaliação clínica estruturada
    // ───────────────────────────────────────────────────────────────
    const userContent: any[] = [];
    const attachAudioToPass2 = hasAudio && !faithfulTranscript;

    if (attachAudioToPass2) {
      userContent.push({
        type: "input_audio",
        input_audio: { data: audioBase64ToUse, format: audioFormat },
      });
    }

    if (faithfulTranscript) {
      userContent.push({
        type: "text",
        text: `${contextInfo}\n\nTRANSCRIÇÃO LITERAL DA CONSULTA (preservar integralmente no campo "transcricao", SEM resumir, SEM reescrever):\n\n${faithfulTranscript}${evidenciaContext}\n\nGere a avaliação multidisciplinar estruturada (SOAP + raciocínio por especialidade + CIF + diretriz em 3 fases). IMPORTANTE: o campo "transcricao" da resposta deve conter EXATAMENTE o texto acima, palavra por palavra — não condense, não parafraseie.`,
      });
    } else {
      userContent.push({
        type: "text",
        text: `${contextInfo}\n\nAnalise o áudio da consulta clínica. Transcreva fielmente em PT-BR no campo "transcricao" (íntegra, sem resumir) e gere a avaliação multidisciplinar estruturada (SOAP + raciocínio por especialidade + CIF + diretriz em 3 fases).`,
      });
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
          { role: "system", content: activeSystemPrompt },
          { role: "user", content: userContent },
        ],
        tools: [TOOL_SCHEMA],
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

      // Surface a useful error to the client — common causes:
      // - 413: payload too large (audio muito longo)
      // - 400: formato de áudio não suportado
      let userMsg = `Erro do servidor de IA (${response.status}).`;
      if (response.status === 413) userMsg = "Áudio muito longo. Grave trechos de até ~10 minutos ou divida em partes.";
      else if (response.status === 400) userMsg = "Formato de áudio não aceito pelo modelo. Tente novamente ou use a transcrição em texto.";
      else if (response.status >= 500) userMsg = "Servidor de IA temporariamente indisponível. Tente novamente em instantes.";

      return new Response(JSON.stringify({ error: userMsg, details: t.slice(0, 500) }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("Resposta da IA sem dados estruturados");

    const assessment = JSON.parse(toolCall.function.arguments);

    // Prefer the faithful transcript (Pass 1 / user-provided) so that the
    // shown text doesn't shrink after structuring. Fallback to whatever the
    // model returned if Pass 1 wasn't available.
    const transcricao =
      faithfulTranscript ||
      assessment.transcricao ||
      String(transcript || "");
    delete assessment.transcricao;

    // ── Contabiliza uso de IA mensal (não-bloqueante) ──
    try {
      const authHeader = req.headers.get("Authorization");
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
      const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (authHeader && SUPABASE_URL && SERVICE_KEY) {
        const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: { Authorization: authHeader, apikey: SERVICE_KEY },
        });
        if (userRes.ok) {
          const u = await userRes.json();
          if (u?.id) {
            await fetch(`${SUPABASE_URL}/rest/v1/rpc/incrementar_uso_ia`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: SERVICE_KEY,
                Authorization: `Bearer ${SERVICE_KEY}`,
              },
              body: JSON.stringify({ p_user_id: u.id, p_tipo: "voice_assessment" }),
            }).catch((e) => console.warn("[voice-assessment] incrementar_uso_ia falhou:", e));
          }
        }
      }
    } catch (e) {
      console.warn("[voice-assessment] uso_ia tracking error (non-blocking):", e);
    }

    return new Response(JSON.stringify({ assessment, transcricao, transcript_length: transcricao.length, evidencias }), {
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
