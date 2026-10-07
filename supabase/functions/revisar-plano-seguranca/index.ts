// Revisor de Segurança de Planos — agente clínico que, ANTES de o profissional
// liberar um plano (treino, nutrição ou diretriz), revisa o plano à luz do
// contexto do paciente (MyID + avaliação presencial + questionários +
// restrições/condições) e sinaliza contraindicações, incoerências e sinais de
// alerta. A revisão é ADVISÓRIA — não bloqueia por si; quem exige justificativa
// para liberar plano de risco alto é o trigger do banco (migration governanca_planos).
//
// Com plano_id (treino/nutrição) revisa o plano SALVO no banco — não o que veio no
// body — e grava o resultado em _governanca.revisao_seguranca, preso ao hash do
// conteúdo revisado. Sem plano_id (ex.: diretriz) só responde, sem gravar.
import { requireUser } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logUsoIA } from "../_shared/log-ia.ts";
import { carregarMotoresClinicos, textoFichaClinica, textoMyID, textoPresencial, textoQuestionarios, type FocoPlano } from "../_shared/motores-plano.ts";
import {
  extrairJson, idadeEmAnos, interpretarRevisao, montarRevisaoPersistida, planoParaPrompt,
  removerGovernanca, resumirHistoricoClinico, tabelaDoTipo,
} from "../_shared/revisao-seguranca.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// deno-lint-ignore no-explicit-any
type SB = any;

// O revisor precisa saber o que a triagem sinalizou e se o profissional sobrepôs
// (só os rótulos: a justificativa livre fica fora do prompt).
function resumoTriagemDoPlano(plano: unknown): string {
  const tri = (plano as SB)?._governanca?.triagem;
  if (!tri || typeof tri !== "object") return "";
  const rotulos = Array.isArray(tri.motivos)
    ? tri.motivos.map((m: SB) => (typeof m?.rotulo === "string" ? m.rotulo : "")).filter(Boolean)
    : [];
  if (!rotulos.length) return "";
  const override = tri.override ? " O profissional sobrepôs a triagem para gerar o plano." : "";
  return `Triagem de segurança do plano: ${rotulos.join("; ")}.${override} Sinalize severidade ALTA se o plano contrariar algum destes fatores.`;
}

const resposta = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SYSTEM = `Você é um REVISOR CLÍNICO DE SEGURANÇA de planos de saúde (fisioterapia/reabilitação, treino, nutrição e diretrizes). Sua função é revisar um plano já elaborado e apontar, à luz do contexto clínico do paciente, apenas o que merece atenção do profissional ANTES de liberar ao paciente.

Procure especificamente:
- CONTRAINDICAÇÕES: o plano propõe algo desaconselhado para uma condição/lesão/restrição/medicação relatada (ex.: carga alta sobre região com achado ativo; alimento que conflita com comorbidade; exercício vigoroso quando a triagem pediu cautela).
- CONTEXTO DE SAÚDE: idade, doenças crônicas, medicamentos, cirurgias e alergias do histórico clínico que conflitam com o plano.
- INCOERÊNCIAS: o plano não conversa com a queixa/diagnóstico, com o MyID ou com a avaliação presencial (ex.: foco em região errada; ignora o driver principal do MyID).
- SINAIS DE ALERTA / "red flags": algo que sugira necessidade de encaminhamento ou avaliação adicional antes de prosseguir.
- LACUNAS: falta progressão, falta orientação de segurança em exercício de risco, ausência de reavaliação.

Regras:
- Seja específico e acionável; cite a parte do plano e a razão clínica.
- NÃO invente dados que não estão no contexto. Se o contexto é insuficiente para julgar, diga isso como severidade "baixa".
- Se o plano estiver seguro e coerente, retorne flags: [] e um resumo curto positivo.
- Não reescreva o plano; só aponte e sugira o ajuste.

Responda ESTRITAMENTE em JSON:
{
  "resumo": "1-2 frases",
  "risco_geral": "baixo" | "medio" | "alto",
  "flags": [
    { "severidade": "alta" | "media" | "baixa", "titulo": "curto", "descricao": "o problema e a razão clínica", "sugestao": "o ajuste recomendado", "onde": "a parte do plano (ex.: Fase 2 / refeição do almoço)" }
  ]
}`;

async function hashDoPlano(admin: SB, tabela: string, id: string): Promise<string | null> {
  try {
    const { data, error } = await admin.rpc("plano_conteudo_hash", { p_tabela: tabela, p_id: id });
    return !error && typeof data === "string" && data ? data : null;
  } catch {
    // RPC ausente (migration ainda não aplicada): a revisão segue sem ser gravada
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let userId = "";
  let token = "";
  try { ({ userId, token } = await requireUser(req)); } catch (r) { return r as Response; }

  try {
    const body = await req.json().catch(() => ({}));
    const { tipo, plano_id } = body || {};
    let pacienteId: string | null = typeof body?.paciente_id === "string" && body.paciente_id ? body.paciente_id : null;
    const foco: FocoPlano = tipo === "nutricao" ? "nutricao" : tipo === "treino" ? "treino" : "clinica";
    const alvo = tabelaDoTipo(tipo);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const admin: SB = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // Cliente com o JWT do usuário: o RLS decide o que ele pode ver (dono do plano / do paciente).
    const doUsuario: SB = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    let plano: unknown = body?.plano;
    let hashRevisado: string | null = null;

    if (plano_id) {
      if (!alvo || typeof plano_id !== "string") {
        return resposta(400, { error: "plano_id só vale para planos de treino ou de nutrição." });
      }
      // O hash vem ANTES da leitura: se o plano mudar durante a revisão, a gravação recusa.
      hashRevisado = await hashDoPlano(admin, alvo.tabela, plano_id);
      const { data: linha } = await doUsuario.from(alvo.tabela)
        .select(`id, paciente_id, terapeuta_id, ${alvo.coluna}`).eq("id", plano_id).maybeSingle();
      if (!linha) return resposta(404, { error: "Plano não encontrado." });
      // Quem só LÊ o plano (ex.: o paciente) não grava revisão com service role.
      if (linha.terapeuta_id !== userId) return resposta(403, { error: "Só o profissional responsável pelo plano pode pedir a revisão." });
      if (pacienteId && pacienteId !== linha.paciente_id) {
        return resposta(400, { error: "O plano informado não pertence a este paciente." });
      }
      pacienteId = linha.paciente_id;
      plano = linha[alvo.coluna];
    } else {
      if (!plano) return resposta(400, { error: "Plano ausente para revisar." });
      if (pacienteId) {
        const { data: acesso } = await doUsuario.from("pacientes").select("id").eq("id", pacienteId).maybeSingle();
        if (!acesso) return resposta(403, { error: "Paciente não encontrado ou sem acesso." });
      }
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) return resposta(503, { error: "IA indisponível (sem chave configurada)." });

    // Contexto clínico do paciente (mesmos motores das gerações) + restrições.
    let myidStr = "", presencialTxt = "", questTxt = "", restricoesTxt = "";
    if (pacienteId) {
      const motores = await carregarMotoresClinicos(admin, pacienteId);
      myidStr = textoMyID(motores, foco);
      presencialTxt = textoPresencial(motores, foco);
      questTxt = textoQuestionarios(motores, foco);

      const colunasBase = "condicoes_preexistentes, alergias, medicamentos_uso, queixa_principal";
      const lerPaciente = (colunas: string) => admin.from("pacientes").select(colunas).eq("id", pacienteId).maybeSingle();
      const completo = await lerPaciente(`${colunasBase}, data_nascimento, genero, sexo, historico_clinico`);
      // Coluna nova ausente no banco: cai para o contexto de antes em vez de perdê-lo.
      const pac = completo.error ? (await lerPaciente(colunasBase)).data : completo.data;
      if (pac) {
        const partes: string[] = [];
        const idade = idadeEmAnos(pac.data_nascimento);
        if (idade !== null) partes.push(`Idade: ${idade} anos`);
        const genero = pac.genero || pac.sexo;
        if (genero) partes.push(`Gênero/sexo: ${genero}`);
        if (pac.queixa_principal) partes.push(`Queixa principal: ${pac.queixa_principal}`);
        if (pac.condicoes_preexistentes) partes.push(`Condições preexistentes: ${pac.condicoes_preexistentes}`);
        if (pac.alergias) partes.push(`Alergias: ${pac.alergias}`);
        if (pac.medicamentos_uso) partes.push(`Medicamentos em uso: ${pac.medicamentos_uso}`);
        const historico = resumirHistoricoClinico(pac.historico_clinico);
        if (historico) partes.push(`Histórico clínico declarado:\n${historico}`);
        const ficha = textoFichaClinica(motores);
        if (ficha) partes.push(ficha.trim());
        const triagemTxt = resumoTriagemDoPlano(plano);
        if (triagemTxt) partes.push(triagemTxt);
        if (partes.length) restricoesTxt = "\n\n[Ficha do paciente]\n" + partes.join("\n");
      }
    }

    const rotuloTipo = foco === "nutricao" ? "PLANO NUTRICIONAL" : foco === "treino" ? "PLANO DE TREINO/REABILITAÇÃO" : "DIRETRIZ/PLANO DE TRATAMENTO";
    const { json: planoJson, truncado } = planoParaPrompt(removerGovernanca(plano));
    const avisoCorte = truncado
      ? "\n(ATENÇÃO: o plano é longo e foi cortado; revise só o trecho recebido e diga no resumo que a revisão foi parcial.)"
      : "";
    const userPrompt = `
Revise o seguinte ${rotuloTipo} para segurança e coerência clínica.

[Contexto clínico do paciente]${myidStr}${presencialTxt}${questTxt}${restricoesTxt || "\n(sem restrições/condições registradas na ficha)"}

[Plano a revisar — JSON]
${planoJson}${avisoCorte}

Aponte contraindicações, incoerências, sinais de alerta e lacunas. Responda no JSON especificado.`.trim();

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60_000);
    let aiJson: SB;
    try {
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
        if (aiRes.status === 429) return resposta(429, { error: "Limite de uso atingido. Tente novamente em instantes." });
        if (aiRes.status === 402) return resposta(402, { error: "Créditos de IA esgotados." });
        throw new Error(`Gemini API: ${aiRes.status} ${txt.slice(0, 200)}`);
      }
      aiJson = await aiRes.json();
    } finally {
      clearTimeout(timer);
    }

    await logUsoIA("revisar-plano-seguranca", "gemini-2.5-flash", aiJson?.usage);
    const revisao = interpretarRevisao(extrairJson(aiJson.choices?.[0]?.message?.content || "{}"));
    if (!revisao) {
      // Resposta vazia/ilegível não pode virar "nenhum ponto crítico" nem ser gravada.
      return resposta(502, { error: "A revisão automática não retornou um resultado válido. Tente novamente." });
    }

    let persistida = false;
    let motivo = plano_id ? "hash_indisponivel" : "sem_plano_id";
    if (alvo && plano_id && hashRevisado) {
      try {
        const registro = montarRevisaoPersistida({
          revisao, revisadoPor: userId, hash: hashRevisado, agora: new Date(), planoTruncado: truncado,
        });
        const { data: gravou, error: erroGravar } = await admin.rpc("registrar_revisao_plano", {
          p_tabela: alvo.tabela, p_id: plano_id, p_revisao: registro, p_hash_esperado: hashRevisado,
        });
        if (erroGravar) {
          console.error("revisar-plano-seguranca: falha ao gravar a revisão:", erroGravar.message);
          motivo = "falha_gravacao";
        } else if (gravou === true) {
          persistida = true;
        } else {
          motivo = "plano_alterado";
        }
      } catch (e) {
        console.error("revisar-plano-seguranca: falha ao gravar a revisão:", (e as Error).message);
        motivo = "falha_gravacao";
      }
    }

    return resposta(200, {
      ...revisao,
      persistida,
      ...(persistida ? { hash: hashRevisado } : { motivo_nao_persistida: motivo }),
      ...(truncado ? { plano_truncado: true } : {}),
    });

  } catch (e) {
    return resposta(500, { error: (e as Error).message || "Falha ao revisar o plano." });
  }
});
