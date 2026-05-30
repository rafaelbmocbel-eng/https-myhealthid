import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Bot, Clock, Sparkles, Megaphone, Zap, AlertTriangle, BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const DIAS = [
  { k: "seg", l: "Seg" }, { k: "ter", l: "Ter" }, { k: "qua", l: "Qua" },
  { k: "qui", l: "Qui" }, { k: "sex", l: "Sex" }, { k: "sab", l: "Sáb" }, { k: "dom", l: "Dom" },
];

const GATILHOS: { k: string; label: string; desc: string }[] = [
  { k: "confirmacao_24h", label: "Confirmação 24h antes", desc: "Pede SIM/REAGENDAR no dia anterior" },
  { k: "lembrete_2h", label: "Lembrete 2h antes", desc: "Lembrete rápido no dia da sessão" },
  { k: "no_show_automatico", label: "No-show automático", desc: "Se não confirmar nem cancelar até a hora, marca FALTA e contabiliza a sessão" },
  { k: "pos_sessao", label: "Pós-sessão (check-in)", desc: "Pergunta como está se sentindo 2h depois" },
  { k: "exercicio_pendente", label: "Exercícios pendentes", desc: "Quando há missões/exercícios não feitos" },
  { k: "myid_vencido", label: "MyID vencido (30 dias)", desc: "Convida a refazer a avaliação mensal" },
  { k: "reengajamento", label: "Reengajamento (14/30/60d)", desc: "Mensagem quando paciente some" },
  { k: "aniversario", label: "Aniversário", desc: "Parabeniza no dia do paciente" },
  { k: "pagamento_pendente", label: "Pagamento pendente", desc: "Lembrete gentil sobre pendência financeira" },
];

const TOM_VOZ = [
  { v: "amigavel", l: "Amigável e próximo" },
  { v: "formal", l: "Formal e respeitoso" },
  { v: "tecnico", l: "Técnico-clínico" },
];

export default function WhatsappAutomacoes({ embedded = false }: { embedded?: boolean } = {}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState<any>(null);
  const [stats, setStats] = useState({ enviados7d: 0, escalados7d: 0, gatilhoTop: "—" });
  const [broadcast, setBroadcast] = useState<{
    titulo: string; intencao: string; segmento: string;
    agendar: boolean; agendado_para: string;
    abAtivo: boolean; variantes: { key: string; texto: string; peso: number }[];
  }>({
    titulo: "", intencao: "", segmento: "todos",
    agendar: false, agendado_para: "",
    abAtivo: false, variantes: [{ key: "A", texto: "", peso: 50 }, { key: "B", texto: "", peso: 50 }],
  });
  const [palavraNova, setPalavraNova] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("whatsapp_automacoes")
        .select("*")
        .eq("terapeuta_id", user.id)
        .maybeSingle();
      setCfg(data || {
        terapeuta_id: user.id,
        bot_ativo: false,
        delay_resposta_segundos: 30,
        horario_inicio: "08:00",
        horario_fim: "20:00",
        dias_semana: ["seg", "ter", "qua", "qui", "sex"],
        mensagem_saudacao: "Olá! 👋 Sou o assistente virtual. Em instantes um profissional vai te responder.",
        mensagem_fora_horario: "Estamos fora do horário de atendimento. Retornaremos assim que possível 💙",
        auto_confirmacao_24h: true,
        mensagem_confirmacao: "Olá {nome}! Confirmando sua sessão amanhã às {horario}. Responda SIM para confirmar.",
        detectar_intencao: true,
        pausar_bot_apos_humano: true,
        tom_voz: "amigavel",
        prompt_extra: "",
        max_turnos_bot: 5,
        usar_contexto_clinico: true,
        gatilhos_ativos: {
          confirmacao_24h: true, lembrete_2h: true, no_show_automatico: true, pos_sessao: true,
          exercicio_pendente: true, myid_vencido: true, reengajamento: true,
          aniversario: true, pagamento_pendente: false,
        },
        palavras_escalonamento: ["urgente", "emergência", "dor forte", "não aguento", "sangrando"],
      });

      const desde = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data: disp } = await supabase
        .from("agente_disparos")
        .select("gatilho, status")
        .eq("terapeuta_id", user.id)
        .gte("created_at", desde);
      const { count: esc } = await supabase
        .from("whatsapp_conversas")
        .select("id", { count: "exact", head: true })
        .eq("terapeuta_id", user.id)
        .eq("requer_atencao", true)
        .gte("updated_at", desde);
      const contagem: Record<string, number> = {};
      (disp || []).forEach((d: any) => { contagem[d.gatilho] = (contagem[d.gatilho] || 0) + 1; });
      const top = Object.entries(contagem).sort((a, b) => b[1] - a[1])[0];
      setStats({
        enviados7d: (disp || []).filter((d: any) => d.status === "enviado").length,
        escalados7d: esc || 0,
        gatilhoTop: top ? `${top[0]} (${top[1]})` : "—",
      });
      setLoading(false);
    })();
  }, []);

  const salvar = async () => {
    setSaving(true);
    const { error } = await supabase.from("whatsapp_automacoes").upsert(cfg, { onConflict: "terapeuta_id" });
    setSaving(false);
    if (error) return toast.error("Erro ao salvar: " + error.message);
    toast.success("Automações salvas");
  };

  const resolverSegmento = async (userId: string, seg: string): Promise<string[]> => {
    const base = supabase.from("pacientes").select("id").eq("terapeuta_id", userId).eq("ativo", true).not("telefone", "is", null);
    if (seg === "todos") {
      const { data } = await base;
      return (data || []).map((p: any) => p.id);
    }
    if (seg === "sem_sessao_30d") {
      const limite = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data: ags } = await supabase.from("agendamentos")
        .select("paciente_id").eq("terapeuta_id", userId).gte("data_inicio", limite).not("paciente_id", "is", null);
      const ativos = new Set((ags || []).map((a: any) => a.paciente_id));
      const { data: todos } = await base;
      return (todos || []).map((p: any) => p.id).filter((id: string) => !ativos.has(id));
    }
    if (seg === "exercicio_pendente") {
      const { data: todos } = await base;
      const ids = (todos || []).map((p: any) => p.id);
      if (ids.length === 0) return [];
      const { data } = await (supabase as any).from("paciente_missoes")
        .select("paciente_id").eq("status", "pendente").in("paciente_id", ids);
      return [...new Set((data || []).map((d: any) => d.paciente_id))] as string[];
    }
    if (seg === "myid_vencido") {
      const limite = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data } = await supabase.from("myid_avaliacoes")
        .select("paciente_id").eq("terapeuta_id", userId).lt("updated_at", limite);
      return [...new Set((data || []).map((d: any) => d.paciente_id))].filter(Boolean) as string[];
    }
    if (seg === "myid_critico" || seg === "myid_moderado" || seg === "myid_saudavel") {
      const { data: todos } = await base;
      const ids = (todos || []).map((p: any) => p.id);
      if (!ids.length) return [];
      const { data } = await supabase.from("myid_avaliacoes")
        .select("paciente_id, myid_score_parcial, updated_at")
        .in("paciente_id", ids)
        .eq("status", "concluido")
        .order("updated_at", { ascending: false });
      const ultimoScore = new Map<string, number>();
      (data || []).forEach((r: any) => {
        if (!ultimoScore.has(r.paciente_id)) ultimoScore.set(r.paciente_id, Number(r.myid_score_parcial || 0));
      });
      const range = seg === "myid_critico" ? (s: number) => s < 50
        : seg === "myid_moderado" ? (s: number) => s >= 50 && s < 75
        : (s: number) => s >= 75;
      return [...ultimoScore.entries()].filter(([_, s]) => range(s)).map(([id]) => id);
    }
    if (seg === "aniversariantes_mes") {
      const { data } = await supabase.from("pacientes")
        .select("id, data_nascimento")
        .eq("terapeuta_id", userId).eq("ativo", true).not("telefone", "is", null)
        .not("data_nascimento", "is", null);
      const mes = new Date().getMonth() + 1;
      return (data || []).filter((p: any) => {
        const m = new Date(p.data_nascimento).getMonth() + 1;
        return m === mes;
      }).map((p: any) => p.id);
    }
    if (seg === "pacote_acabando") {
      const { data } = await supabase.from("pacotes_sessoes")
        .select("paciente_id, total_sessoes, sessoes_utilizadas")
        .eq("terapeuta_id", userId).eq("status", "ativo");
      return (data || [])
        .filter((p: any) => (p.total_sessoes - p.sessoes_utilizadas) <= 2)
        .map((p: any) => p.paciente_id);
    }
    return [];
  };

  const dispararBroadcast = async () => {
    if (!broadcast.titulo) return toast.error("Preencha o título");
    const usaAB = broadcast.abAtivo && broadcast.variantes.length >= 2;
    if (!usaAB && !broadcast.intencao) return toast.error("Preencha a mensagem base");
    if (usaAB && broadcast.variantes.some(v => !v.texto.trim())) {
      return toast.error("Preencha o texto de todas as variantes A/B");
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const ids = await resolverSegmento(user.id, broadcast.segmento);
    if (ids.length === 0) return toast.error("Nenhum paciente encontrado nesse segmento");

    const agendado = broadcast.agendar && broadcast.agendado_para;
    const agendadoDate = agendado ? new Date(broadcast.agendado_para) : null;
    if (agendado && (!agendadoDate || agendadoDate.getTime() <= Date.now())) {
      return toast.error("Data de agendamento deve ser no futuro");
    }

    const { data: b, error } = await supabase.from("agente_broadcasts").insert({
      terapeuta_id: user.id,
      titulo: broadcast.titulo,
      intencao: usaAB ? broadcast.variantes[0].texto : broadcast.intencao,
      filtro: { segmento: broadcast.segmento },
      paciente_ids: ids,
      status: "agendado",
      total: ids.length,
      agendado_para: agendado ? agendadoDate!.toISOString() : null,
      ab_variantes: usaAB ? broadcast.variantes : [],
    } as any).select().single();
    if (error || !b) return toast.error("Erro ao criar broadcast: " + (error?.message || ""));

    if (agendado) {
      toast.success(`Campanha agendada para ${agendadoDate!.toLocaleString("pt-BR")} — ${ids.length} paciente(s)`);
    } else {
      const { error: err2 } = await supabase.functions.invoke("agente-broadcast", { body: { broadcast_id: b.id } });
      if (err2) return toast.error("Erro ao disparar: " + err2.message);
      toast.success(`Broadcast enviando para ${ids.length} paciente(s) — 1 a cada 5s`);
    }
    setBroadcast({
      titulo: "", intencao: "", segmento: "todos",
      agendar: false, agendado_para: "",
      abAtivo: false, variantes: [{ key: "A", texto: "", peso: 50 }, { key: "B", texto: "", peso: 50 }],
    });
  };

  if (loading || !cfg) return <div className="p-6">Carregando…</div>;

  const toggleDia = (k: string) => {
    const dias = cfg.dias_semana?.includes(k)
      ? cfg.dias_semana.filter((d: string) => d !== k)
      : [...(cfg.dias_semana || []), k];
    setCfg({ ...cfg, dias_semana: dias });
  };
  const toggleGatilho = (k: string) => {
    const g = { ...(cfg.gatilhos_ativos || {}) };
    g[k] = !g[k];
    setCfg({ ...cfg, gatilhos_ativos: g });
  };
  const removerPalavra = (p: string) => {
    setCfg({ ...cfg, palavras_escalonamento: (cfg.palavras_escalonamento || []).filter((x: string) => x !== p) });
  };
  const adicionarPalavra = () => {
    const p = palavraNova.trim().toLowerCase();
    if (!p || (cfg.palavras_escalonamento || []).includes(p)) return;
    setCfg({ ...cfg, palavras_escalonamento: [...(cfg.palavras_escalonamento || []), p] });
    setPalavraNova("");
  };

  return (
    <div className={embedded ? 'p-3 sm:p-5 space-y-4' : 'container max-w-3xl py-6 space-y-4'}>
      {!embedded && <PageHeader back title="Automações & Bot IA" subtitle="Atendimento automático, mensagens proativas e broadcasts personalizados." />}

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="icon-sm text-primary shrink-0" />
          <h3 className="font-semibold text-sm">Últimos 7 dias</h3>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><p className="text-2xl font-semibold">{stats.enviados7d}</p><p className="text-micro">Mensagens enviadas</p></div>
          <div><p className="text-2xl font-semibold">{stats.escalados7d}</p><p className="text-micro">Escalados p/ humano</p></div>
          <div><p className="text-sm font-medium truncate">{stats.gatilhoTop}</p><p className="text-micro">Gatilho mais usado</p></div>
        </div>
      </Card>

      <Tabs defaultValue="bot">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="bot">Bot</TabsTrigger>
          <TabsTrigger value="gatilhos">Gatilhos</TabsTrigger>
          <TabsTrigger value="seguranca">Segurança</TabsTrigger>
          <TabsTrigger value="broadcast">Broadcast</TabsTrigger>
        </TabsList>

        <TabsContent value="bot" className="space-y-4 mt-4">
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Bot className="icon-md text-primary shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold">Bot IA conversacional</h3>
                <p className="text-caption">Responde, agenda, cancela e usa dados clínicos do paciente.</p>
              </div>
              <Switch checked={cfg.bot_ativo} onCheckedChange={(v) => setCfg({ ...cfg, bot_ativo: v })} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Tom de voz</Label>
                <Select value={cfg.tom_voz || "amigavel"} onValueChange={(v) => setCfg({ ...cfg, tom_voz: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TOM_VOZ.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Delay antes de responder (s)</Label>
                <Input type="number" inputMode="numeric" min={0} max={120}
                  value={cfg.delay_resposta_segundos ?? ''}
                  onChange={(e) => setCfg({ ...cfg, delay_resposta_segundos: e.target.value === '' ? 0 : Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label>Instruções extras da clínica (opcional)</Label>
              <Textarea rows={3} placeholder="Ex.: Não falamos sobre planos de saúde. Endereço: Rua X, 123. Em emergência fora de horário, ligar 192."
                value={cfg.prompt_extra || ""} onChange={(e) => setCfg({ ...cfg, prompt_extra: e.target.value })} />
              <p className="text-micro mt-1">Vai junto no prompt da IA em toda conversa.</p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Switch checked={cfg.usar_contexto_clinico !== false} onCheckedChange={(v) => setCfg({ ...cfg, usar_contexto_clinico: v })} />
              <Label className="flex-1">Usar dados clínicos (MyID, exercícios, próxima sessão) no contexto</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={cfg.pausar_bot_apos_humano} onCheckedChange={(v) => setCfg({ ...cfg, pausar_bot_apos_humano: v })} />
              <Label className="flex-1">Pausar bot quando profissional já respondeu (30 min)</Label>
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Clock className="icon-md text-primary shrink-0" />
              <h3 className="font-semibold">Horário de atendimento</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Início</Label><Input type="time" value={cfg.horario_inicio} onChange={(e) => setCfg({ ...cfg, horario_inicio: e.target.value })} /></div>
              <div><Label>Fim</Label><Input type="time" value={cfg.horario_fim} onChange={(e) => setCfg({ ...cfg, horario_fim: e.target.value })} /></div>
            </div>
            <div>
              <Label>Dias da semana</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {DIAS.map((d) => (
                  <button key={d.k} type="button" onClick={() => toggleDia(d.k)}
                    className={`px-3 py-1.5 rounded-full text-sm border ${cfg.dias_semana?.includes(d.k) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}>
                    {d.l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Mensagem fora do horário</Label>
              <Textarea rows={2} value={cfg.mensagem_fora_horario} onChange={(e) => setCfg({ ...cfg, mensagem_fora_horario: e.target.value })} />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="gatilhos" className="space-y-4 mt-4">
          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-3">
              <Zap className="icon-md text-primary shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold">Mensagens proativas</h3>
                <p className="text-caption">A IA dispara sozinha nestes momentos. Verifica a cada 15 min.</p>
              </div>
            </div>
            <div className="space-y-2 pt-2">
              {GATILHOS.map(g => (
                <div key={g.k} className="flex items-start gap-3 p-3 rounded-lg border border-border/40">
                  <Switch checked={(cfg.gatilhos_ativos || {})[g.k] !== false} onCheckedChange={() => toggleGatilho(g.k)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{g.label}</p>
                    <p className="text-micro text-muted-foreground">{g.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-3 pt-2 border-t border-border/40">
              <p className="text-caption font-medium">Mensagens enviadas automaticamente</p>
              <p className="text-micro text-muted-foreground">Variáveis: {`{nome}`}, {`{horario}`}, {`{data}`}. O bot interpreta SIM/REAGENDAR/CANCELAR nas respostas e atualiza a agenda.</p>
              <div>
                <Label className="text-xs">24h antes (confirmação)</Label>
                <Textarea rows={2} value={cfg.mensagem_confirmacao || ""}
                  onChange={(e) => setCfg({ ...cfg, mensagem_confirmacao: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">2h antes (lembrete + aviso final)</Label>
                <Textarea rows={2} value={cfg.mensagem_lembrete_2h || ""}
                  onChange={(e) => setCfg({ ...cfg, mensagem_lembrete_2h: e.target.value })} />
                <p className="text-micro text-muted-foreground mt-1">Dica: informe que após esse horário a sessão será contabilizada.</p>
              </div>
              <div>
                <Label className="text-xs">No-show (após a hora sem confirmar/cancelar)</Label>
                <Textarea rows={2} value={cfg.mensagem_no_show || ""}
                  onChange={(e) => setCfg({ ...cfg, mensagem_no_show: e.target.value })} />
                <p className="text-micro text-muted-foreground mt-1">Enviada quando a falta é registrada automaticamente e a sessão é contabilizada no pacote.</p>
                <div className="mt-3 space-y-2 p-3 rounded-lg bg-muted/30 border border-border/40">
                  <p className="text-xs font-medium">Exceções de contabilização</p>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <Switch checked={cfg.no_show_perdoar_primeira !== false}
                      onCheckedChange={(v) => setCfg({ ...cfg, no_show_perdoar_primeira: v })} />
                    <div className="flex-1">
                      <p className="text-sm">Perdoar a primeira falta</p>
                      <p className="text-micro text-muted-foreground">A 1ª ausência do paciente é marcada como falta mas não desconta do pacote.</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <Switch checked={cfg.no_show_so_com_pacote !== false}
                      onCheckedChange={(v) => setCfg({ ...cfg, no_show_so_com_pacote: v })} />
                    <div className="flex-1">
                      <p className="text-sm">Só registrar se houver pacote ativo</p>
                      <p className="text-micro text-muted-foreground">Pacientes avulsos não recebem falta automática.</p>
                    </div>
                  </label>
                </div>
              </div>
              <div>
                <Label className="text-xs">Pós-sessão (check-in)</Label>
                <Textarea rows={2} value={cfg.mensagem_pos_sessao || ""}
                  onChange={(e) => setCfg({ ...cfg, mensagem_pos_sessao: e.target.value })} />
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="seguranca" className="space-y-4 mt-4">
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="icon-md text-amber-600 shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold">Escalonamento para humano</h3>
                <p className="text-caption">Se o paciente usar uma destas palavras, o bot para e te alerta.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(cfg.palavras_escalonamento || []).map((p: string) => (
                <Badge key={p} variant="secondary" className="gap-1 cursor-pointer" onClick={() => removerPalavra(p)}>
                  {p} ×
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input placeholder="Adicionar palavra…" value={palavraNova}
                onChange={(e) => setPalavraNova(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), adicionarPalavra())} />
              <Button type="button" variant="outline" onClick={adicionarPalavra}>Adicionar</Button>
            </div>
            <div>
              <Label>Máximo de turnos do bot antes de escalar</Label>
              <Input type="number" min={1} max={20} value={cfg.max_turnos_bot || 5}
                onChange={(e) => setCfg({ ...cfg, max_turnos_bot: +e.target.value })} />
              <p className="text-micro mt-1">Se a conversa passar disso sem resolver, alerta um humano.</p>
            </div>
            <div className="rounded-lg border border-border/40 p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="text-sm">SLA de resposta humana</Label>
                  <p className="text-micro">Conversas sem resposta nesse prazo ficam destacadas em vermelho na aba "SLA ⏰".</p>
                </div>
                <Switch checked={cfg.sla_ativo !== false}
                  onCheckedChange={(v) => setCfg({ ...cfg, sla_ativo: v })} />
              </div>
              {cfg.sla_ativo !== false && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Responder em até</Label>
                  <Input type="number" min={1} max={1440} className="w-24 h-9"
                    value={cfg.sla_minutos ?? 30}
                    onChange={(e) => setCfg({ ...cfg, sla_minutos: +e.target.value })} />
                  <span className="text-xs text-muted-foreground">minutos</span>
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="broadcast" className="space-y-4 mt-4">
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Megaphone className="icon-md text-primary shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold">Disparo em massa com IA</h3>
                <p className="text-caption">A IA personaliza a mensagem por paciente usando MyID, sessões e exercícios. 1 envio a cada 5s.</p>
              </div>
            </div>
            <div>
              <Label>Título interno</Label>
              <Input placeholder="Ex.: Campanha verão" value={broadcast.titulo}
                onChange={(e) => setBroadcast({ ...broadcast, titulo: e.target.value })} />
            </div>

            <div>
              <Label>Segmento</Label>
              <Select value={broadcast.segmento} onValueChange={(v) => setBroadcast({ ...broadcast, segmento: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os pacientes ativos</SelectItem>
                  <SelectItem value="sem_sessao_30d">Sem sessão há 30+ dias</SelectItem>
                  <SelectItem value="exercicio_pendente">Com exercícios pendentes</SelectItem>
                  <SelectItem value="myid_vencido">MyID vencido (30+ dias)</SelectItem>
                  <SelectItem value="myid_critico">MyID crítico (score &lt; 50)</SelectItem>
                  <SelectItem value="myid_moderado">MyID moderado (50–74)</SelectItem>
                  <SelectItem value="myid_saudavel">MyID saudável (≥ 75)</SelectItem>
                  <SelectItem value="aniversariantes_mes">Aniversariantes do mês</SelectItem>
                  <SelectItem value="pacote_acabando">Pacote acabando (≤ 2 sessões)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-xl border border-border/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Teste A/B</Label>
                  <p className="text-micro">Compara 2 abordagens — IA personaliza cada variante.</p>
                </div>
                <Switch checked={broadcast.abAtivo}
                  onCheckedChange={(v) => setBroadcast({ ...broadcast, abAtivo: v })} />
              </div>
              {!broadcast.abAtivo ? (
                <div>
                  <Label>Intenção / mensagem base</Label>
                  <Textarea rows={4} placeholder="Ex.: Quero te lembrar que vale a pena retomar os exercícios."
                    value={broadcast.intencao}
                    onChange={(e) => setBroadcast({ ...broadcast, intencao: e.target.value })} />
                  <p className="text-micro mt-1">A IA reescreve isso personalizado para cada paciente.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {broadcast.variantes.map((v, i) => (
                    <div key={v.key} className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-sm">Variante {v.key}</Label>
                        <div className="flex items-center gap-2">
                          <Label className="text-micro">Peso %</Label>
                          <Input type="number" min={0} max={100} className="w-20 h-8"
                            value={v.peso}
                            onChange={(e) => {
                              const nv = [...broadcast.variantes];
                              nv[i] = { ...v, peso: +e.target.value };
                              setBroadcast({ ...broadcast, variantes: nv });
                            }} />
                        </div>
                      </div>
                      <Textarea rows={3} placeholder={`Texto base da variante ${v.key}`}
                        value={v.texto}
                        onChange={(e) => {
                          const nv = [...broadcast.variantes];
                          nv[i] = { ...v, texto: e.target.value };
                          setBroadcast({ ...broadcast, variantes: nv });
                        }} />
                    </div>
                  ))}
                  <p className="text-micro">Resultado por variante fica visível no histórico após o envio.</p>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Agendar envio</Label>
                  <p className="text-micro">Dispara automaticamente na data escolhida.</p>
                </div>
                <Switch checked={broadcast.agendar}
                  onCheckedChange={(v) => setBroadcast({ ...broadcast, agendar: v })} />
              </div>
              {broadcast.agendar && (
                <Input type="datetime-local" value={broadcast.agendado_para}
                  onChange={(e) => setBroadcast({ ...broadcast, agendado_para: e.target.value })} />
              )}
            </div>

            <Button onClick={dispararBroadcast}>
              {broadcast.agendar ? "Agendar campanha" : "Disparar agora"}
            </Button>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={salvar} disabled={saving}>{saving ? "Salvando…" : "Salvar automações"}</Button>
      </div>
    </div>
  );
}
