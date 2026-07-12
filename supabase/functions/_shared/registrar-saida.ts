// Registra uma mensagem de SAÍDA (enviada pela clínica: lembrete automático,
// broadcast, etc.) na inbox do WhatsApp — criando a conversa se ainda não
// existir. Assim toda mensagem enviada aparece no chat e o paciente entra na
// lista do Zap, mesmo que ele nunca tenha respondido antes.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

type AdminClient = ReturnType<typeof createClient>;

export async function registrarMensagemSaida(
  admin: AdminClient,
  opts: {
    terapeuta_id: string;
    paciente_id: string | null;
    telefone: string;
    conteudo: string;
    origem: string;
  },
): Promise<void> {
  const digits = (opts.telefone || "").replace(/\D/g, "");
  if (!digits) return;
  const sufixo = digits.slice(-10); // ignora código do país ao casar a conversa

  let { data: conv } = await admin
    .from("whatsapp_conversas")
    .select("id, paciente_id")
    .eq("terapeuta_id", opts.terapeuta_id)
    .ilike("telefone", `%${sufixo}`)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  // Conversa já existe mas sem vínculo de paciente → religa agora, senão ela
  // fica presa como "não cadastrado" e some do filtro padrão do Zap.
  if (conv && !(conv as { paciente_id: string | null }).paciente_id && opts.paciente_id) {
    await admin
      .from("whatsapp_conversas")
      .update({ paciente_id: opts.paciente_id })
      .eq("id", (conv as { id: string }).id);
  }

  if (!conv) {
    let nome_contato: string | null = null;
    if (opts.paciente_id) {
      const { data: p } = await admin
        .from("pacientes")
        .select("nome, sobrenome")
        .eq("id", opts.paciente_id)
        .maybeSingle();
      if (p) {
        const pp = p as { nome?: string | null; sobrenome?: string | null };
        nome_contato = `${pp.nome ?? ""} ${pp.sobrenome ?? ""}`.trim() || null;
      }
    }
    const { data: novo } = await admin
      .from("whatsapp_conversas")
      .insert({
        terapeuta_id: opts.terapeuta_id,
        telefone: digits,
        paciente_id: opts.paciente_id,
        nome_contato,
      })
      .select("id")
      .single();
    conv = novo;
  }

  if (!conv) return;

  await admin.from("whatsapp_mensagens_inbox").insert({
    conversa_id: (conv as { id: string }).id,
    terapeuta_id: opts.terapeuta_id,
    direcao: "saida",
    tipo: "texto",
    conteudo: opts.conteudo,
    status: "enviada",
    metadata: { origem: opts.origem },
  });
}
