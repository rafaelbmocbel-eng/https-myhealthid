import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { selectTudoPaginado } from "@/lib/supabasePaginado";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Bot, Clock, Sparkles, Megaphone, Zap, AlertTriangle, BarChart3, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarClock, BellRing, HeartHandshake, UserX, MessageSquare, Moon } from "lucide-react";
import { WaBubblePreview } from "@/components/whatsapp/WaBubblePreview";
import { CampoMensagemBroadcast, PreviasDaMensagem } from "@/components/whatsapp/BroadcastMensagemCampos";
import { defaultAutomacoes, ensureAutomacoesPadrao } from "@/lib/whatsappAutomacoesDefaults";
import { avisosDaMensagem, fraseDeConfirmacao, NOME_DE_CONFIRMACAO } from "@/lib/broadcastMensagem";
import { idsComMyidVencido } from "@/lib/broadcastSegmentos";
import { resumirDisparos } from "@/lib/disparosResumo";
import { ROTULO_TOM } from "@/lib/mensagemModelos";

const VARIAVEIS_MSG: { k: string; l: string }[] = [
  { k: "nome", l: "Nome do paciente" },
  { k: "horario", l: "Horário da sessão" },
  { k: "data", l: "Data da sessão" },
];

// Editor de mensagem: ícone + rótulo + prazo, textarea, chips de variáveis e
// preview ao vivo do WhatsApp. Padroniza o visual de todas as mensagens.
function MensagemEditor({
  icon: Icon, titulo, prazo, valor, onChange, placeholder, incoming = false, dica,
}: {
  icon: any; titulo: string; prazo?: string; valor: string;
  onChange: (v: string) => void; placeholder?: string; incoming?: boolean; dica?: string;
}) {
  const inserir = (chave: string) => onChange((valor || "") + `{${chave}}`);
  return (
    <div className="rounded-xl border border-border/50 overflow-hidden bg-card">
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-border/40 bg-muted/30">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">{titulo}</p>
          {prazo && <p className="text-micro text-muted-foreground">{prazo}</p>}
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-3 p-3.5">
        <div className="space-y-2">
          <Textarea rows={4} value={valor} placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)} className="resize-none text-sm" />
          <div className="flex flex-wrap gap-1">
            {VARIAVEIS_MSG.map((v) => (
              <button key={v.k} type="button" title={v.l} onClick={() => inserir(v.k)}
                className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                {"{" + v.k + "}"}
              </button>
            ))}
          </div>
          {dica && <p className="text-micro text-muted-foreground">{dica}</p>}
        </div>
        <div className="space-y-1.5">
          <p className="text-micro text-muted-foreground font-medium">Prévia no WhatsApp</p>
          <WaBubblePreview text={valor} incoming={incoming} />
        </div>
      </div>
    </div>
  );
}

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
  { k: "diario_pendente", label: "Diário parado", desc: "Convida a registrar o diário quando o paciente some por 3+ dias" },
  { k: "myid_vencido", label: "MyID vencido (30 dias)", desc: "Convida a refazer a avaliação mensal" },
  { k: "reengajamento", label: "Reengajamento (14/30/60d)", desc: "Mensagem quando paciente some" },
  { k: "aniversario", label: "Aniversário", desc: "Parabeniza no dia do paciente" },
  { k: "pagamento_pendente", label: "Pagamento pendente", desc: "Lembrete gentil sobre pendência financeira" },
  { k: "progresso_semanal", label: "Progresso semanal 🏆", desc: "Domingo à noite: resumo da semana com XP, nível e incentivo (só para quem teve atividade)" },
  { k: "checkin_semanal", label: "Check-in semanal 🌿", desc: "Domingo à noite: pede 6 números (fadiga, sono, dor muscular, estresse, humor e urina) e mostra a evolução no perfil do cliente." },
  { k: "nps_pos_sessao", label: "NPS (nota 0–10) ⭐", desc: "No dia seguinte à sessão pergunta a nota de 0 a 10; a resposta é guardada sozinha. Máximo 1 pergunta por cliente a cada 30 dias." },
];

const TOM_VOZ = [
  { v: "amigavel", l: "Amigável e próximo" },
  { v: "formal", l: "Formal e respeitoso" },
  { v: "tecnico", l: ROTULO_TOM.tecnico },
];

type BroadcastForm = {
  titulo: string; intencao: string; segmento: string;
  agendar: boolean; agendado_para: string; personalizarIA: boolean;
  abAtivo: boolean; variantes: { key: string; texto: string; peso: number }[];
};

// A IA nasce desligada: o cliente recebe exatamente o texto escrito aqui.
const broadcastInicial = (): BroadcastForm => ({
  titulo: "", intencao: "", segmento: "todos",
  agendar: false, agendado_para: "", personalizarIA: false,
  abAtivo: false, variantes: [{ key: "A", texto: "", peso: 50 }, { key: "B", texto: "", peso: 50 }],
});

const EXEMPLO_MENSAGEM = "Ex.: Oi {nome}! 💙 Passando para avisar que a clínica abre mais cedo na próxima sexta, a partir das 7h.";

export default function WhatsappAutomacoes({ embedded = false }: { embedded?: boolean } = {}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState<any>(null);
  const [stats, setStats] = useState({ enviados7d: 0, escalados7d: 0, gatilhoTop: "—" });
  const [broadcast, setBroadcast] = useState<BroadcastForm>(broadcastInicial);
  const [palavraNova, setPalavraNova] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [confirmDisparo, setConfirmDisparo] = useState<{ ids: string[]; agendadoDate: Date | null; segmento: string } | null>(null);
  const [conferindo, setConferindo] = useState(false);
  const [nps, setNps] = useState<{ media: number; total: number } | null>(null);
  const painelConfirmacao = useRef<HTMLDivElement>(null);
  const botaoDisparo = useRef<HTMLButtonElement>(null);
  const devolverFocoAoBotao = useRef(false);

  // A confirmação guarda a lista de clientes, o segmento e a data de quando foi aberta: mudar o público ou a data com ela
  // aberta a deixaria falando de outra campanha, então ela fecha e o profissional confere de novo.
  useEffect(() => {
    setConfirmDisparo(null);
  }, [broadcast.segmento, broadcast.agendar, broadcast.agendado_para]);

  // O painel substitui o botão, então o foco ia para o nada e, no celular, ele abria abaixo da dobra. Ao cancelar, enviar ou
  // terminar a conferência com aviso de erro o foco volta ao botão (desabilitado durante a conferência, ele perde o foco);
  // quando a confirmação fecha sozinha (mudou o público) o foco fica onde a pessoa estava.
  useEffect(() => {
    if (confirmDisparo) {
      devolverFocoAoBotao.current = false;
      painelConfirmacao.current?.focus({ preventScroll: true });
      painelConfirmacao.current?.scrollIntoView?.({ block: "start" });
      return;
    }
    if (conferindo) return;
    if (devolverFocoAoBotao.current) {
      devolverFocoAoBotao.current = false;
      botaoDisparo.current?.focus();
    }
  }, [confirmDisparo, conferindo]);

  useEffect(() => {
    (async () => {
     try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("whatsapp_automacoes")
        .select("*")
        .eq("terapeuta_id", user.id)
        .maybeSingle();
      if (data) {
        setCfg(data);
      } else {
        // Primeiro acesso: já semeia a config padrão no banco (não só na tela),
        // para os lembretes automáticos funcionarem sem depender de "Salvar".
        setCfg(defaultAutomacoes(user.id));
        ensureAutomacoesPadrao(user.id);
      }

      const desde = new Date(Date.now() - 7 * 86400000).toISOString();
      let disp: { gatilho: string | null; status: string | null }[] = [];
      try {
        disp = await selectTudoPaginado<{ gatilho: string | null; status: string | null }>((de, ate) =>
          supabase
            .from("agente_disparos")
            .select("gatilho, status")
            .eq("terapeuta_id", user.id)
            .gte("created_at", desde)
            .order("created_at", { ascending: false })
            .order("id")
            .range(de, ate));
      } catch (e) {
        // Sem os disparos o resumo fica zerado, mas "Escalados" e a nota média do NPS abaixo ainda carregam.
        console.error("[WhatsappAutomacoes] erro ao ler os disparos dos últimos 7 dias:", e);
      }
      const { count: esc } = await supabase
        .from("whatsapp_conversas")
        .select("id", { count: "exact", head: true })
        .eq("terapeuta_id", user.id)
        .eq("requer_atencao", true)
        .gte("updated_at", desde);
      setStats({ ...resumirDisparos(disp), escalados7d: esc || 0 });

      const { data: notas } = await (supabase as any)
        .from("nps_respostas").select("nota").eq("terapeuta_id", user.id).limit(500);
      if (notas && notas.length > 0) {
        const soma = notas.reduce((s: number, n: any) => s + (n.nota || 0), 0);
        setNps({ media: Math.round((soma / notas.length) * 10) / 10, total: notas.length });
      }
     } catch (e) {
       // Sem isto, qualquer falha deixava a tela travada em "Carregando…".
       console.error('[WhatsappAutomacoes] erro ao carregar:', e);
     } finally {
       setLoading(false);
     }
    })();
  }, []);

  const salvar = async () => {
    setSaving(true);
    // Campos numéricos obrigatórios no banco: se ficaram vazios na tela, volta
    // ao padrão em vez de gravar null (que fazia o "Salvar" dar erro).
    const payload = {
      ...cfg,
      sla_minutos: cfg.sla_minutos ?? 30,
      max_turnos_bot: cfg.max_turnos_bot ?? 5,
    };
    const { error } = await supabase.from("whatsapp_automacoes").upsert(payload, { onConflict: "terapeuta_id" });
    setSaving(false);
    if (error) return toast.error("Erro ao salvar: " + error.message);
    toast.success("Automações salvas");
  };

  // Modo férias — salva NA HORA (não espera o botão "Salvar automações"), para
  // ser um interruptor de emergência de um clique só.
  const [pausando, setPausando] = useState(false);
  const alternarPausa = async (pausar: boolean) => {
    if (!cfg?.terapeuta_id) return;
    setPausando(true);
    const anterior = cfg.automacoes_pausadas;
    setCfg((c: any) => ({ ...c, automacoes_pausadas: pausar })); // otimista
    const { error } = await supabase
      .from("whatsapp_automacoes")
      .update({ automacoes_pausadas: pausar })
      .eq("terapeuta_id", cfg.terapeuta_id);
    setPausando(false);
    if (error) {
      setCfg((c: any) => ({ ...c, automacoes_pausadas: anterior })); // desfaz
      return toast.error("Não consegui alterar: " + error.message);
    }
    toast.success(pausar
      ? "Mensagens automáticas pausadas 🌴 Nada sai até você reativar."
      : "Mensagens automáticas reativadas ✅");
  };

  const resolverSegmento = async (userId: string, seg: string): Promise<string[]> => {
    // Paginado: lista de pacientes ativos com telefone, reusada em vários
    // segmentos. Sem isto, o teto de 1000 do PostgREST deixava parte da base de
    // fora do disparo em massa silenciosamente.
    const listarBase = () => selectTudoPaginado((from, to) =>
      supabase.from("pacientes").select("id").eq("terapeuta_id", userId).eq("ativo", true).not("telefone", "is", null).range(from, to),
    );
    if (seg === "todos") {
      const data = await listarBase();
      return (data || []).map((p: any) => p.id);
    }
    if (seg === "sem_sessao_30d") {
      const limite = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data: ags } = await supabase.from("agendamentos")
        .select("paciente_id").eq("terapeuta_id", userId).gte("data_inicio", limite).not("paciente_id", "is", null);
      const ativos = new Set((ags || []).map((a: any) => a.paciente_id));
      const todos = await listarBase();
      return (todos || []).map((p: any) => p.id).filter((id: string) => !ativos.has(id));
    }
    if (seg === "exercicio_pendente") {
      const todos = await listarBase();
      const ids = (todos || []).map((p: any) => p.id);
      if (ids.length === 0) return [];
      const { data } = await (supabase as any).from("paciente_missoes")
        .select("paciente_id").eq("status", "pendente").in("paciente_id", ids);
      return [...new Set((data || []).map((d: any) => d.paciente_id))] as string[];
    }
    if (seg === "myid_vencido") {
      const ids = ((await listarBase()) || []).map((p: any) => p.id);
      // Da mais nova para a mais velha: se o teto de linhas cortar a lista, só o que é antigo fica de fora.
      const avaliacoes = await selectTudoPaginado((from, to) =>
        supabase.from("myid_avaliacoes").select("paciente_id, updated_at")
          .eq("terapeuta_id", userId).order("updated_at", { ascending: false }).range(from, to),
      );
      return idsComMyidVencido(avaliacoes, ids, Date.now());
    }
    if (seg === "myid_critico" || seg === "myid_moderado" || seg === "myid_saudavel") {
      const todos = await listarBase();
      const ids = (todos || []).map((p: any) => p.id);
      if (!ids.length) return [];
      const { data } = await supabase.from("myid_avaliacoes")
        .select("paciente_id, myid_score_parcial, updated_at")
        .in("paciente_id", ids)
        .eq("status", "concluido")
        .order("updated_at", { ascending: false });
      const ultimoScore = new Map<string, number>();
      (data || []).forEach((r: any) => {
        // Só segmenta por gravidade quem tem score de fato calculado. Antes,
        // score nulo virava 0 → o paciente caía em "crítico" e recebia uma
        // mensagem alarmante sem motivo. Sem score, fica fora dos 3 segmentos.
        if (ultimoScore.has(r.paciente_id)) return;
        const s = Number(r.myid_score_parcial);
        if (r.myid_score_parcial != null && Number.isFinite(s)) {
          ultimoScore.set(r.paciente_id, s);
        }
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
        // data_nascimento é data-pura 'YYYY-MM-DD'; new Date(...) a interpreta em
        // UTC e quem nasce no dia 1º cairia no mês anterior no Brasil. Lê o mês
        // direto da string.
        const m = Number(String(p.data_nascimento).slice(5, 7));
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
    if (conferindo) return;
    if (!broadcast.titulo) return toast.error("Preencha o título");
    const usaAB = broadcast.abAtivo && broadcast.variantes.length >= 2;
    if (!usaAB && !broadcast.intencao.trim()) return toast.error("Preencha a mensagem");
    if (usaAB && broadcast.variantes.some(v => !v.texto.trim())) {
      return toast.error("Preencha o texto de todas as variantes A/B");
    }
    // Sem data o botão dizia "Agendar" e a confirmação mandava na hora: WhatsApp real fora do que foi pedido.
    if (broadcast.agendar && !broadcast.agendado_para) return toast.error("Escolha a data e a hora do agendamento");
    const segmento = broadcast.segmento;
    devolverFocoAoBotao.current = true;
    setConferindo(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const ids = await resolverSegmento(user.id, segmento);
      if (ids.length === 0) return toast.error("Nenhum paciente encontrado nesse segmento");

      const agendadoDate = broadcast.agendar ? new Date(broadcast.agendado_para) : null;
      if (agendadoDate && (Number.isNaN(agendadoDate.getTime()) || agendadoDate.getTime() <= Date.now())) {
        return toast.error("Data de agendamento deve ser no futuro");
      }
      // Não envia direto: abre a confirmação mostrando para QUANTOS vai. O segmento vai junto com a lista que o resolveu.
      setConfirmDisparo({ ids, agendadoDate, segmento });
    } catch (e) {
      console.error("[WhatsappAutomacoes] erro ao conferir os clientes:", e);
      toast.error("Não consegui conferir os clientes. Tente de novo.");
    } finally {
      setConferindo(false);
    }
  };

  // Executa o disparo/agendamento após a confirmação. Trava duplo clique.
  const confirmarDisparo = async () => {
    if (!confirmDisparo || enviando) return;
    setEnviando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const usaAB = broadcast.abAtivo && broadcast.variantes.length >= 2;
      const { ids, agendadoDate, segmento } = confirmDisparo;
      const agendado = !!agendadoDate;
      const { data: b, error } = await supabase.from("agente_broadcasts").insert({
        terapeuta_id: user.id,
        titulo: broadcast.titulo,
        intencao: usaAB ? broadcast.variantes[0].texto : broadcast.intencao,
        filtro: { segmento, personalizar_ia: broadcast.personalizarIA },
        paciente_ids: ids,
        status: "agendado",
        total: ids.length,
        agendado_para: agendado ? agendadoDate!.toISOString() : null,
        ab_variantes: usaAB ? broadcast.variantes : [],
      } as any).select().single();
      if (error || !b) { toast.error("Erro ao criar broadcast: " + (error?.message || "")); return; }

      if (agendado) {
        toast.success(`Campanha agendada para ${agendadoDate!.toLocaleString("pt-BR")} — ${ids.length} paciente(s)`);
      } else {
        const { error: err2 } = await supabase.functions.invoke("agente-broadcast", { body: { broadcast_id: b.id } });
        if (err2) { toast.error("Erro ao disparar: " + err2.message); return; }
        toast.success(`Broadcast enviando para ${ids.length} paciente(s) — 1 a cada 5s`);
      }
      devolverFocoAoBotao.current = true;
      setConfirmDisparo(null);
      setBroadcast(broadcastInicial());
    } catch (e) {
      console.error("[WhatsappAutomacoes] erro ao enviar a campanha:", e);
      toast.error("Algo deu errado no envio. Antes de tentar de novo, confira se as mensagens saíram, para não mandar duas vezes.");
    } finally {
      setEnviando(false);
    }
  };

  if (loading || !cfg) return <div className="p-6">Carregando…</div>;

  const toggleDia = (k: string) => {
    const dias = cfg.dias_semana?.includes(k)
      ? cfg.dias_semana.filter((d: string) => d !== k)
      : [...(cfg.dias_semana || []), k];
    setCfg({ ...cfg, dias_semana: dias });
  };
  // Opt-in: só disparam com true explícito no backend — o interruptor nasce desligado.
  const GATILHOS_OPT_IN = new Set(['nps_pos_sessao', 'progresso_semanal', 'pagamento_pendente', 'checkin_semanal']);
  const gatilhoLigado = (k: string) => {
    const v = (cfg.gatilhos_ativos || {})[k];
    return GATILHOS_OPT_IN.has(k) ? v === true : v !== false;
  };
  const toggleGatilho = (k: string) => {
    const g = { ...(cfg.gatilhos_ativos || {}) };
    g[k] = !gatilhoLigado(k);
    setCfg({ ...cfg, gatilhos_ativos: g });
  };
  // Texto(s) que vão ao cliente: a variante A/B só vale com 2 ou mais, como no envio.
  const usaAB = broadcast.abAtivo && broadcast.variantes.length >= 2;
  const textosDaCampanha = usaAB ? broadcast.variantes.map((v) => v.texto) : [broadcast.intencao];
  // Vazio não entra aqui (o botão já avisa "Preencha..."); variável fora de {nome} e texto longo travam o envio.
  const campanhaComAviso = textosDaCampanha.some((t) => avisosDaMensagem(t).length > 0);
  const campanhaIncompleta = textosDaCampanha.some((t) => t.trim() === "");
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

      {/* MODO FÉRIAS — interruptor geral, um clique, salva na hora */}
      <Card className={cfg?.automacoes_pausadas
        ? "p-4 border-amber-400/60 bg-amber-50 dark:bg-amber-950/20"
        : "p-4 border-border/60"}>
        <div className="flex items-center gap-3">
          <div className={cfg?.automacoes_pausadas
            ? "h-11 w-11 rounded-xl bg-amber-400/20 flex items-center justify-center shrink-0"
            : "h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"}>
            {cfg?.automacoes_pausadas
              ? <Moon className="h-5 w-5 text-amber-600" />
              : <Zap className="h-5 w-5 text-primary" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">
              {cfg?.automacoes_pausadas ? "Mensagens automáticas PAUSADAS 🌴" : "Mensagens automáticas ativas"}
            </p>
            <p className="text-micro text-muted-foreground">
              {cfg?.automacoes_pausadas
                ? "Nenhuma mensagem automática está saindo (nem o bot). As mensagens dos pacientes continuam chegando na caixa, e você responde quando quiser."
                : "Confirmações, lembretes, pós-sessão, NPS, progresso e o bot. Pause tudo quando estiver de férias."}
            </p>
          </div>
          <Switch
            checked={!!cfg?.automacoes_pausadas}
            disabled={pausando || !cfg}
            onCheckedChange={(v) => alternarPausa(v)}
            aria-label="Pausar mensagens automáticas"
          />
        </div>
        {cfg?.automacoes_pausadas && (
          <Button variant="outline" size="sm" className="mt-3 w-full" disabled={pausando}
            onClick={() => alternarPausa(false)}>
            Reativar mensagens automáticas
          </Button>
        )}
      </Card>

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
                <Input type="number" inputMode="numeric" min={0} max={8}
                  value={cfg.delay_resposta_segundos ?? ''}
                  onChange={(e) => setCfg({ ...cfg, delay_resposta_segundos: e.target.value === '' ? 0 : Math.min(8, Number(e.target.value)) })} />
                <p className="text-micro mt-1">Até 8 segundos.</p>
              </div>
            </div>
            <div>
              <Label>Instruções extras da clínica (opcional)</Label>
              <Textarea rows={3} placeholder="Ex.: Não falamos sobre planos de saúde. Endereço: Rua X, 123. Em emergência fora de horário, ligar 192."
                value={cfg.prompt_extra || ""} onChange={(e) => setCfg({ ...cfg, prompt_extra: e.target.value })} />
              <p className="text-micro mt-1">Vai junto no prompt da IA em toda conversa.</p>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
              <Switch checked={cfg.bot_apenas_cadastrados !== false} onCheckedChange={(v) => setCfg({ ...cfg, bot_apenas_cadastrados: v })} />
              <div className="flex-1">
                <Label>Responder apenas a contatos cadastrados</Label>
                <p className="text-micro text-muted-foreground">Só pacientes/clientes do app recebem resposta automática. Números de fora do seu ecossistema aparecem na inbox, mas o bot não responde — evita poluir o atendimento.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Switch checked={cfg.usar_contexto_clinico !== false} onCheckedChange={(v) => setCfg({ ...cfg, usar_contexto_clinico: v })} />
              <Label className="flex-1">Usar dados clínicos (MyID, exercícios, próxima sessão) no contexto</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={cfg.pausar_bot_apos_humano} onCheckedChange={(v) => setCfg({ ...cfg, pausar_bot_apos_humano: v })} />
              <Label className="flex-1">Pausar bot quando profissional já respondeu (30 min)</Label>
            </div>
            <div className="pt-1">
              <MensagemEditor
                icon={MessageSquare}
                titulo="Saudação"
                prazo="Primeira resposta automática quando o paciente escreve"
                valor={cfg.mensagem_saudacao || ""}
                onChange={(v) => setCfg({ ...cfg, mensagem_saudacao: v })}
                placeholder="Oi! Aqui é a assistente virtual da clínica. Já já um profissional te responde."
              />
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
            <MensagemEditor
              icon={Moon}
              titulo="Mensagem fora do horário"
              prazo="Enviada quando o paciente escreve fora dos dias/horários acima"
              valor={cfg.mensagem_fora_horario || ""}
              onChange={(v) => setCfg({ ...cfg, mensagem_fora_horario: v })}
              placeholder="Estamos fora do horário de atendimento. Retornaremos assim que possível."
            />
          </Card>
        </TabsContent>

        <TabsContent value="gatilhos" className="space-y-4 mt-4">
          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-3">
              <Zap className="icon-md text-primary shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold">Mensagens proativas</h3>
                <p className="text-caption">Estas mensagens saem sozinhas nestes momentos.</p>
                <p className="text-caption !text-foreground/70 mt-1 break-words">
                  Aniversário, diário parado, MyID vencido e reengajamento saem de manhã (faixa das 9h). Cada um tem um texto
                  pronto e fixo, escolhido pelo tom de voz da aba Bot (Amigável, Formal ou Objetivo). Esses textos só passam a valer
                  quando a equipe do My Health ID ligar o recurso para a sua conta; até lá, o aplicativo ainda escreve a mensagem com IA.
                </p>
              </div>
            </div>
            <div className="space-y-2 pt-2">
              {GATILHOS.map(g => (
                <div key={g.k} className="flex items-start gap-3 p-3 rounded-lg border border-border/40">
                  <Switch checked={gatilhoLigado(g.k)} aria-label={g.label} onCheckedChange={() => toggleGatilho(g.k)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{g.label}</p>
                    <p className="text-micro text-muted-foreground">{g.desc}</p>
                    {g.k === 'nps_pos_sessao' && nps && (
                      <p className="text-micro font-semibold text-emerald-600 mt-0.5">
                        ⭐ Nota média: {nps.media.toLocaleString('pt-BR')} · {nps.total} resposta{nps.total > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-3 pt-3 border-t border-border/40">
              <div>
                <p className="text-caption font-medium">Mensagens enviadas automaticamente</p>
                <p className="text-micro text-muted-foreground">Clique numa variável para inserir. O bot interpreta SIM / REAGENDAR / CANCELAR nas respostas e atualiza a agenda sozinho.</p>
              </div>
              <MensagemEditor
                icon={CalendarClock}
                titulo="Confirmação"
                prazo="Enviada 24h antes da sessão"
                valor={cfg.mensagem_confirmacao || ""}
                onChange={(v) => setCfg({ ...cfg, mensagem_confirmacao: v })}
                placeholder="Oi {nome}! Confirmando sua sessão amanhã às {horario}. Responda SIM para confirmar."
              />
              <MensagemEditor
                icon={BellRing}
                titulo="Lembrete + aviso final"
                prazo="Enviada 2h antes da sessão"
                valor={cfg.mensagem_lembrete_2h || ""}
                onChange={(v) => setCfg({ ...cfg, mensagem_lembrete_2h: v })}
                placeholder="Oi {nome}! Sua sessão é hoje às {horario}. Se precisar remarcar, avise agora."
                dica="Dica: informe que após esse horário a sessão será contabilizada."
              />
              <MensagemEditor
                icon={UserX}
                titulo="Faltou (no-show)"
                prazo="Enviada quando a falta é registrada automaticamente"
                valor={cfg.mensagem_no_show || ""}
                onChange={(v) => setCfg({ ...cfg, mensagem_no_show: v })}
                placeholder="Oi {nome}, sentimos sua falta hoje às {horario}. Vamos reagendar?"
                dica="Enviada quando a sessão é contabilizada no pacote por ausência."
              />
              <div>
                <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border/40">
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
              <MensagemEditor
                icon={HeartHandshake}
                titulo="Pós-atendimento (check-in)"
                prazo="Enviada algumas horas após a sessão"
                valor={cfg.mensagem_pos_sessao || ""}
                onChange={(v) => setCfg({ ...cfg, mensagem_pos_sessao: v })}
                placeholder="Oi {nome}! Como você está se sentindo depois da sessão de hoje?"
              />
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
              <Input type="number" inputMode="numeric" min={1} max={20} value={cfg.max_turnos_bot ?? ''}
                onChange={(e) => setCfg({ ...cfg, max_turnos_bot: e.target.value === '' ? null : Number(e.target.value) })} />
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
                  <Input type="number" inputMode="numeric" min={1} max={1440} className="w-24 h-9"
                    value={cfg.sla_minutos ?? ''}
                    onChange={(e) => setCfg({ ...cfg, sla_minutos: e.target.value === '' ? null : Number(e.target.value) })} />
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
                <h3 className="font-semibold">Disparo em massa</h3>
                <p className="text-caption">Envia a mesma mensagem a vários clientes, 1 envio a cada 5s. O primeiro nome de cada um entra no lugar de {"{nome}"}.</p>
              </div>
            </div>
            <div>
              <Label htmlFor="broadcast-titulo">Título interno</Label>
              <Input id="broadcast-titulo" className="min-h-11" placeholder="Ex.: Campanha verão" value={broadcast.titulo}
                onChange={(e) => setBroadcast({ ...broadcast, titulo: e.target.value })} />
            </div>

            <div>
              <Label htmlFor="broadcast-segmento">Segmento</Label>
              <Select value={broadcast.segmento} disabled={conferindo || enviando} onValueChange={(v) => setBroadcast({ ...broadcast, segmento: v })}>
                <SelectTrigger id="broadcast-segmento" className="min-h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os pacientes ativos</SelectItem>
                  <SelectItem value="sem_sessao_30d">Sem sessão há 30+ dias</SelectItem>
                  <SelectItem value="exercicio_pendente">Com exercícios pendentes</SelectItem>
                  <SelectItem value="myid_vencido">MyID vencido (último há 30+ dias)</SelectItem>
                  <SelectItem value="myid_critico">MyID crítico (score &lt; 50)</SelectItem>
                  <SelectItem value="myid_moderado">MyID moderado (50–74)</SelectItem>
                  <SelectItem value="myid_saudavel">MyID saudável (≥ 75)</SelectItem>
                  <SelectItem value="aniversariantes_mes">Aniversariantes do mês</SelectItem>
                  <SelectItem value="pacote_acabando">Pacote acabando (≤ 2 sessões)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <label className="flex items-start gap-3 min-h-11 cursor-pointer rounded-xl border border-border/40 p-4">
              <Switch className="mt-0.5" checked={broadcast.personalizarIA} aria-label="Personalizar com IA"
                onCheckedChange={(v) => setBroadcast({ ...broadcast, personalizarIA: v })} />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium">Personalizar com IA</span>
                <p className="text-caption !text-foreground/70 break-words">
                  Desligado: cada cliente recebe exatamente o texto que você escreveu, com o primeiro nome no lugar de {"{nome}"}.
                  Ligado: a IA reescreve a mensagem para cada cliente vendo só o primeiro nome e o tom da clínica, sem MyID nem dado
                  de saúde. O texto enviado pode ser diferente da prévia.
                </p>
              </div>
            </label>

            <div className="rounded-xl border border-border/40 p-4 space-y-3">
              <label className="flex items-center justify-between gap-3 min-h-11 cursor-pointer">
                <div className="min-w-0">
                  <span className="text-sm font-medium">Teste A/B</span>
                  <p className="text-caption !text-foreground/70">Compara 2 mensagens: cada cliente recebe uma, sorteada pelo peso.</p>
                </div>
                <Switch checked={broadcast.abAtivo} aria-label="Teste A/B"
                  onCheckedChange={(v) => setBroadcast({ ...broadcast, abAtivo: v })} />
              </label>
              {!broadcast.abAtivo ? (
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="min-w-0 space-y-1.5">
                    <Label htmlFor="broadcast-mensagem">Mensagem</Label>
                    <CampoMensagemBroadcast id="broadcast-mensagem" texto={broadcast.intencao}
                      placeholder={EXEMPLO_MENSAGEM}
                      onChange={(v) => setBroadcast({ ...broadcast, intencao: v })} />
                    <p className="text-caption !text-foreground/70 break-words">É o texto que o cliente recebe. Use {"{nome}"} para o primeiro nome dele; outras variáveis não funcionam.</p>
                  </div>
                  <PreviasDaMensagem texto={broadcast.intencao} quantos={3} dicaVazia="Escreva a mensagem para ver o exemplo." />
                </div>
              ) : (
                <div className="space-y-3">
                  {broadcast.variantes.map((v, i) => (
                    <div key={v.key} className="space-y-2 rounded-lg border border-border/40 p-3 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <Label htmlFor={`broadcast-variante-${v.key}`} className="text-sm">Variante {v.key}</Label>
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`broadcast-peso-${v.key}`} className="text-micro">Peso %</Label>
                          <Input id={`broadcast-peso-${v.key}`} type="number" inputMode="numeric" min={0} max={100} className="w-20 min-h-11"
                            value={v.peso ?? ''}
                            onChange={(e) => {
                              const nv = [...broadcast.variantes];
                              nv[i] = { ...v, peso: e.target.value === '' ? 0 : Number(e.target.value) };
                              setBroadcast({ ...broadcast, variantes: nv });
                            }} />
                        </div>
                      </div>
                      <div className="grid md:grid-cols-2 gap-3">
                        <CampoMensagemBroadcast id={`broadcast-variante-${v.key}`} rows={3} texto={v.texto}
                          placeholder={`Mensagem da variante ${v.key}`}
                          onChange={(texto) => {
                            const nv = [...broadcast.variantes];
                            nv[i] = { ...v, texto };
                            setBroadcast({ ...broadcast, variantes: nv });
                          }} />
                        <PreviasDaMensagem texto={v.texto} quantos={2} dicaVazia={`Escreva a variante ${v.key}.`} />
                      </div>
                    </div>
                  ))}
                  <p className="text-caption !text-foreground/70 break-words">Cada cliente recebe uma só variante, sorteada pelos pesos. Use {"{nome}"} para o primeiro nome; outras variáveis não funcionam.</p>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border/40 p-4 space-y-3">
              <label className="flex items-center justify-between gap-3 min-h-11 cursor-pointer">
                <div className="min-w-0">
                  <span className="text-sm font-medium">Agendar envio</span>
                  <p className="text-caption !text-foreground/70">Dispara automaticamente na data escolhida, com até 1 hora de atraso.</p>
                </div>
                <Switch checked={broadcast.agendar} disabled={conferindo || enviando} aria-label="Agendar envio"
                  onCheckedChange={(v) => setBroadcast({ ...broadcast, agendar: v })} />
              </label>
              {broadcast.agendar && (
                <Input type="datetime-local" className="min-h-11" aria-label="Data e hora do envio" disabled={conferindo || enviando} value={broadcast.agendado_para}
                  onChange={(e) => setBroadcast({ ...broadcast, agendado_para: e.target.value })} />
              )}
            </div>

            {confirmDisparo ? (
              <div ref={painelConfirmacao} tabIndex={-1} role="alertdialog" aria-labelledby="broadcast-confirmacao-pergunta"
                aria-describedby="broadcast-confirmacao-aviso"
                onKeyDown={(e) => {
                  if (e.key !== "Escape" || enviando) return;
                  devolverFocoAoBotao.current = true;
                  setConfirmDisparo(null);
                }}
                className="rounded-lg border border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-3 min-w-0 scroll-mt-4 outline-none">
                <p id="broadcast-confirmacao-pergunta" className="text-sm font-medium break-words">
                  {confirmDisparo.agendadoDate
                    ? `Agendar esta campanha para ${confirmDisparo.ids.length} paciente(s)?`
                    : `Enviar agora para ${confirmDisparo.ids.length} paciente(s)? (1 envio a cada 5s)`}
                </p>
                <div className="space-y-2">
                  <p className="text-xs text-foreground/75">Exemplo da mensagem para {NOME_DE_CONFIRMACAO}:</p>
                  {textosDaCampanha.map((texto, i) => (
                    <div key={broadcast.variantes[i]?.key ?? "unica"} data-testid="frase-confirmacao"
                      className="rounded-md border border-amber-300/70 dark:border-amber-800/60 bg-background/70 p-2 min-w-0">
                      {usaAB && <p className="text-xs font-medium">Variante {broadcast.variantes[i].key}</p>}
                      <p className="text-sm whitespace-pre-wrap break-words">{fraseDeConfirmacao(texto)}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-foreground/75 break-words">
                  {broadcast.personalizarIA
                    ? "Com IA: cada mensagem é reescrita para o cliente, então o texto enviado pode ser diferente deste exemplo."
                    : "Sem IA: cada cliente recebe exatamente este texto, com o primeiro nome dele."}
                </p>
                {confirmDisparo.agendadoDate && (
                  <p className="text-xs text-foreground/75 break-words">A campanha agendada pode sair até 1 hora depois do horário escolhido.</p>
                )}
                <p id="broadcast-confirmacao-aviso" className="text-xs text-foreground/75 break-words">Isso envia mensagem real no WhatsApp. Não dá para desfazer.</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button onClick={confirmarDisparo} disabled={enviando || campanhaComAviso || campanhaIncompleta} className="gap-1.5 min-h-11 w-full sm:w-auto">
                    {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {confirmDisparo.agendadoDate ? "Confirmar agendamento" : "Confirmar envio"}
                  </Button>
                  <Button variant="ghost" className="min-h-11 w-full sm:w-auto" onClick={() => { devolverFocoAoBotao.current = true; setConfirmDisparo(null); }} disabled={enviando}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <Button ref={botaoDisparo} className="min-h-11 w-full sm:w-auto gap-1.5" onClick={dispararBroadcast} disabled={campanhaComAviso || conferindo}>
                {conferindo ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {broadcast.agendar ? "Agendar campanha" : "Disparar agora"}
              </Button>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={salvar} disabled={saving}>{saving ? "Salvando…" : "Salvar automações"}</Button>
      </div>
    </div>
  );
}
