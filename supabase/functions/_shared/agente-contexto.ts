// Helper compartilhado: monta o contexto clínico do paciente para o agente IA
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type ContextoClinico = {
  paciente: {
    id: string | null;
    nome: string;
    primeiro_nome: string;
    telefone: string;
    aniversario_hoje: boolean;
  };
  myid: {
    score: number | null;
    dimensoes_criticas: { nome: string; perda: number }[];
    red_flags: boolean;
    ultima_em: string | null;
    dias_desde: number | null;
  } | null;
  proxima_sessao: {
    id: string;
    data: string;
    horas_ate: number;
    status: string;
  } | null;
  ultima_sessao: { data: string; dias_desde: number } | null;
  exercicios_pendentes: number;
  pagamento_pendente: { valor: number; vencimento: string | null } | null;
  pacote_ativo: { restantes: number; total: number } | null;
  tom_voz: string;
  prompt_extra: string | null;
  profissional_nome: string;
};

export async function montarContextoClinico(
  admin: ReturnType<typeof createClient>,
  terapeuta_id: string,
  paciente_id: string | null,
  telefone: string,
  nome_contato: string | null,
): Promise<ContextoClinico> {
  const [autoRes, profRes] = await Promise.all([
    admin.from("whatsapp_automacoes").select("tom_voz, prompt_extra")
      .eq("terapeuta_id", terapeuta_id).maybeSingle(),
    admin.from("profiles").select("nome, sobrenome, especialidade")
      .eq("user_id", terapeuta_id).maybeSingle(),
  ]);

  const tom_voz = (autoRes.data as any)?.tom_voz || "amigavel";
  const prompt_extra = (autoRes.data as any)?.prompt_extra || null;
  const profissional_nome = [(profRes.data as any)?.nome, (profRes.data as any)?.sobrenome]
    .filter(Boolean).join(" ") || "seu profissional";

  let pac: any = null;
  if (paciente_id) {
    const { data } = await admin.from("pacientes")
      .select("id, nome, sobrenome, telefone, data_nascimento")
      .eq("id", paciente_id).maybeSingle();
    pac = data;
  }

  const nome = pac
    ? `${pac.nome || ""} ${pac.sobrenome || ""}`.trim()
    : (nome_contato || "Paciente");
  const primeiro_nome = nome.split(" ")[0] || "você";

  // Aniversário
  let aniversario_hoje = false;
  if (pac?.data_nascimento) {
    const d = new Date(pac.data_nascimento);
    const now = new Date();
    aniversario_hoje = d.getDate() === now.getDate() && d.getMonth() === now.getMonth();
  }

  const ctx: ContextoClinico = {
    paciente: { id: pac?.id || null, nome, primeiro_nome, telefone, aniversario_hoje },
    myid: null,
    proxima_sessao: null,
    ultima_sessao: null,
    exercicios_pendentes: 0,
    pagamento_pendente: null,
    pacote_ativo: null,
    tom_voz,
    prompt_extra,
    profissional_nome,
  };

  if (!paciente_id) return ctx;

  // MyID mais recente
  const { data: myid } = await admin.from("myid_avaliacoes")
    .select("myid_score_parcial, dimensoes_preenchidas, red_flags_detectadas, updated_at, status")
    .eq("paciente_id", paciente_id)
    .order("updated_at", { ascending: false })
    .limit(1).maybeSingle();
  if (myid) {
    const dims = (myid.dimensoes_preenchidas as any) || {};
    const criticas = Object.entries(dims)
      .map(([k, v]: any) => ({ nome: k, perda: Number(v?.perda || v?.score || 0) }))
      .filter(x => x.perda > 30)
      .sort((a, b) => b.perda - a.perda)
      .slice(0, 3);
    const dias = Math.floor((Date.now() - new Date(myid.updated_at).getTime()) / 86400000);
    ctx.myid = {
      score: myid.myid_score_parcial,
      dimensoes_criticas: criticas,
      red_flags: !!myid.red_flags_detectadas,
      ultima_em: myid.updated_at,
      dias_desde: dias,
    };
  }

  // Próxima sessão
  const { data: prox } = await admin.from("agendamentos")
    .select("id, data_inicio, status")
    .eq("paciente_id", paciente_id)
    .gte("data_inicio", new Date().toISOString())
    .neq("status", "cancelado")
    .order("data_inicio", { ascending: true })
    .limit(1).maybeSingle();
  if (prox) {
    ctx.proxima_sessao = {
      id: prox.id,
      data: prox.data_inicio,
      horas_ate: Math.round((new Date(prox.data_inicio).getTime() - Date.now()) / 3600000),
      status: prox.status,
    };
  }

  // Última sessão concluída
  const { data: ult } = await admin.from("agendamentos")
    .select("data_inicio")
    .eq("paciente_id", paciente_id)
    .eq("status", "concluido")
    .order("data_inicio", { ascending: false })
    .limit(1).maybeSingle();
  if (ult) {
    ctx.ultima_sessao = {
      data: ult.data_inicio,
      dias_desde: Math.floor((Date.now() - new Date(ult.data_inicio).getTime()) / 86400000),
    };
  }

  // Exercícios pendentes (paciente_missoes status pendente)
  const { count } = await admin.from("paciente_missoes")
    .select("id", { count: "exact", head: true })
    .eq("paciente_id", paciente_id)
    .eq("status", "pendente");
  ctx.exercicios_pendentes = count || 0;

  // Pagamento pendente
  const { data: pag } = await admin.from("pagamentos_paciente")
    .select("valor, vencimento")
    .eq("paciente_id", paciente_id)
    .eq("status", "pendente")
    .order("vencimento", { ascending: true })
    .limit(1).maybeSingle();
  if (pag) ctx.pagamento_pendente = { valor: Number(pag.valor), vencimento: pag.vencimento };

  // Pacote ativo
  const { data: pac2 } = await admin.from("pacotes_sessoes")
    .select("total_sessoes, sessoes_utilizadas")
    .eq("paciente_id", paciente_id)
    .eq("status", "ativo")
    .order("created_at", { ascending: false })
    .limit(1).maybeSingle();
  if (pac2) {
    ctx.pacote_ativo = {
      total: pac2.total_sessoes,
      restantes: pac2.total_sessoes - pac2.sessoes_utilizadas,
    };
  }

  return ctx;
}

export function buildSystemPrompt(ctx: ContextoClinico): string {
  const tom = ctx.tom_voz === "formal"
    ? "Tom formal, respeitoso, profissional. Use 'o(a) sr(a)' quando apropriado."
    : ctx.tom_voz === "tecnico"
    ? "Tom técnico-clínico, preciso, com termos da área de saúde quando relevante."
    : "Tom amigável, próximo, acolhedor. Use o primeiro nome do paciente.";

  const myidLinha = ctx.myid
    ? `MyID: score ${ctx.myid.score ?? "—"}, há ${ctx.myid.dias_desde} dias. Dimensões críticas: ${
        ctx.myid.dimensoes_criticas.map(d => `${d.nome} (perda ${Math.round(d.perda)})`).join(", ") || "nenhuma"
      }.${ctx.myid.red_flags ? " ⚠️ Red flags detectados." : ""}`
    : "MyID: não realizado.";

  const proxLinha = ctx.proxima_sessao
    ? `Próxima sessão: ${new Date(ctx.proxima_sessao.data).toLocaleString("pt-BR")} (em ${ctx.proxima_sessao.horas_ate}h, status ${ctx.proxima_sessao.status}).`
    : "Sem sessão agendada.";

  const ultLinha = ctx.ultima_sessao
    ? `Última sessão: há ${ctx.ultima_sessao.dias_desde} dias.`
    : "Sem sessões anteriores registradas.";

  const pacoteLinha = ctx.pacote_ativo
    ? `Pacote ativo: ${ctx.pacote_ativo.restantes}/${ctx.pacote_ativo.total} sessões restantes.`
    : "";

  const pagLinha = ctx.pagamento_pendente
    ? `⚠️ Pagamento pendente: R$ ${ctx.pagamento_pendente.valor.toFixed(2)}${
        ctx.pagamento_pendente.vencimento ? ` (vence ${new Date(ctx.pagamento_pendente.vencimento).toLocaleDateString("pt-BR")})` : ""
      }.`
    : "";

  return `Você é o assistente virtual de ${ctx.profissional_nome} em uma clínica de saúde. Seu papel é responder o paciente no WhatsApp, agendar/confirmar sessões e dar suporte ao tratamento. Você é o primeiro contato — humanize a conversa, seja útil e seguro.

REGRAS CRÍTICAS:
1. NUNCA dê diagnóstico médico, prescrição ou interpretação clínica detalhada. Se for clínico, agende com o profissional.
2. NUNCA invente valores, horários ou políticas que não estejam no contexto.
3. Se houver sinal de URGÊNCIA ou RED FLAG (dor aguda, queda, sangramento, dormência súbita, "não aguento", "piorou muito"), use a tool escalar_para_humano IMEDIATAMENTE e oriente o paciente a ligar/procurar pronto-socorro se grave.
4. Use as tools para AGIR (consultar horários, agendar, cancelar). Não invente horários.
5. Mensagens curtas (até 3 linhas idealmente). WhatsApp, não email.
6. Sempre se referir a algo REAL do contexto do paciente quando relevante (ex: "vi que faltam ${ctx.exercicios_pendentes} exercícios do seu plano").
7. ${tom}

CONTEXTO DO PACIENTE (${ctx.paciente.nome}):
- Telefone: ${ctx.paciente.telefone}
- ${myidLinha}
- ${proxLinha}
- ${ultLinha}
- Exercícios pendentes no portal: ${ctx.exercicios_pendentes}
${pacoteLinha ? "- " + pacoteLinha : ""}
${pagLinha ? "- " + pagLinha : ""}
${ctx.paciente.aniversario_hoje ? "- 🎂 HOJE é aniversário do paciente. Parabenize com carinho." : ""}

${ctx.prompt_extra ? `INSTRUÇÕES EXTRAS DA CLÍNICA:\n${ctx.prompt_extra}\n` : ""}
Responda como humano, não como bot. Sem assinatura no final.`;
}
