import { supabase } from "@/integrations/supabase/client";

// Configuração padrão das automações do WhatsApp. É a MESMA usada como estado
// inicial da tela de Automações e para semear a configuração no primeiro acesso
// — assim toda clínica nova já nasce com confirmação, lembrete e pós-sessão
// ligados, sem depender de clicar em "Salvar" (o passo escondido que travava).
export function defaultAutomacoes(userId: string) {
  return {
    terapeuta_id: userId,
    bot_ativo: false,
    bot_apenas_cadastrados: true,
    delay_resposta_segundos: 30,
    horario_inicio: "08:00",
    horario_fim: "20:00",
    dias_semana: ["seg", "ter", "qua", "qui", "sex"],
    mensagem_saudacao: "Oi! 👋 Aqui é a assistente virtual da clínica 💙 Já já um profissional te responde. Enquanto isso, posso te ajudar a agendar, remarcar ou confirmar uma sessão — é só me contar o que você precisa.",
    mensagem_fora_horario: "Oi! 💙 No momento estamos fora do horário de atendimento, mas sua mensagem já está salva aqui. Assim que abrirmos, a gente te responde. Se for uma emergência de saúde, procure o pronto-socorro mais próximo ou ligue 192.",
    auto_confirmacao_24h: true,
    mensagem_confirmacao: "Oi {nome}! 💙 Passando pra confirmar sua sessão amanhã às {horario}. Podemos contar com você? Responda *SIM* para confirmar ou *REAGENDAR* se precisar de outro horário. Seu cuidado é a nossa prioridade!",
    mensagem_lembrete_2h: "Oi {nome}! ⏰ Sua sessão é hoje às {horario} — daqui a pouco te esperamos por aqui. Se precisar remarcar, me avise agora, tá? Após o horário a sessão é contabilizada. Até já! 💪",
    mensagem_no_show: "Oi {nome}, sentimos sua falta hoje na sessão das {horario} 💙 Aconteceu alguma coisa? Ficamos à disposição pra reagendar e continuar seu tratamento — é só me chamar.",
    mensagem_pos_sessao: "Oi {nome}! 💙 Como você está se sentindo depois da sessão de hoje? Qualquer dor, dúvida ou desconforto, pode me contar por aqui. E não esquece dos seus exercícios — cada dia conta na sua evolução! 💪",
    detectar_intencao: true,
    pausar_bot_apos_humano: true,
    tom_voz: "amigavel",
    prompt_extra: "Você é a assistente virtual de uma clínica de fisioterapia e saúde que usa o método MyID (avaliação biopsicossocial da dor). Seja acolhedora, empática e objetiva. Ajude a agendar, remarcar e confirmar sessões, lembrar dos exercícios e tirar dúvidas simples sobre o tratamento. NUNCA dê diagnóstico, prescrição ou conselho médico específico — nesses casos, diga que o profissional vai avaliar. Não fale sobre valores de convênios/planos de saúde. Em caso de dor intensa, piora súbita ou emergência, oriente procurar atendimento presencial (ou 192) e avise que vai chamar o profissional. Use o primeiro nome do paciente e mantenha as respostas curtas (2 a 4 linhas). [EDITE: endereço, horários e telefone da sua clínica aqui.]",
    max_turnos_bot: 5,
    usar_contexto_clinico: true,
    gatilhos_ativos: {
      confirmacao_24h: true, lembrete_2h: true, no_show_automatico: false, pos_sessao: true,
      exercicio_pendente: true, myid_vencido: true, reengajamento: true,
      aniversario: true, pagamento_pendente: false,
    },
    palavras_escalonamento: ["urgente", "emergência", "dor forte", "não aguento", "sangrando"],
  };
}

// Cria a configuração padrão de automações se ainda não existir para este
// terapeuta. Idempotente: se já existir, não faz nada. Usado no primeiro acesso
// (abrir Automações) e ao conectar o WhatsApp, para o app "funcionar de cara".
export async function ensureAutomacoesPadrao(userId: string): Promise<boolean> {
  if (!userId) return false;
  const { data } = await supabase
    .from("whatsapp_automacoes")
    .select("terapeuta_id")
    .eq("terapeuta_id", userId)
    .maybeSingle();
  if (data) return false;
  // onConflict evita corrida se dois pontos tentarem semear ao mesmo tempo.
  const { error } = await supabase
    .from("whatsapp_automacoes")
    .upsert(defaultAutomacoes(userId), { onConflict: "terapeuta_id", ignoreDuplicates: true });
  return !error;
}
