import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Calendar, DollarSign, FileText, StickyNote, Activity } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Evento = {
  id: string;
  tipo: "mensagem" | "agendamento" | "pagamento" | "myid" | "nota" | "evolucao";
  data: string;
  titulo: string;
  descricao?: string;
  meta?: any;
};

const ICONES: Record<Evento["tipo"], any> = {
  mensagem: MessageCircle,
  agendamento: Calendar,
  pagamento: DollarSign,
  myid: FileText,
  nota: StickyNote,
  evolucao: Activity,
};

const CORES: Record<Evento["tipo"], string> = {
  mensagem: "text-blue-600 bg-blue-50 dark:bg-blue-950/30",
  agendamento: "text-purple-600 bg-purple-50 dark:bg-purple-950/30",
  pagamento: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30",
  myid: "text-pink-600 bg-pink-50 dark:bg-pink-950/30",
  nota: "text-amber-600 bg-amber-50 dark:bg-amber-950/30",
  evolucao: "text-cyan-600 bg-cyan-50 dark:bg-cyan-950/30",
};

export function TimelineUnificada({ pacienteId }: { pacienteId: string }) {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [filtro, setFiltro] = useState<Evento["tipo"] | "todos">("todos");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const ev: Evento[] = [];

      // Paciente -> telefone para buscar conversa
      const { data: pac } = await supabase.from("pacientes")
        .select("telefone, terapeuta_id, nome").eq("id", pacienteId).maybeSingle();

      // Mensagens WhatsApp
      if (pac?.telefone) {
        const tel = pac.telefone.replace(/\D/g, "");
        const { data: convs } = await supabase.from("whatsapp_conversas")
          .select("id").eq("terapeuta_id", pac.terapeuta_id).ilike("telefone", `%${tel}%`);
        if (convs?.length) {
          const { data: msgs } = await (supabase as any).from("whatsapp_mensagens_inbox")
            .select("id, conteudo, transcricao, direcao, created_at, tipo")
            .in("conversa_id", convs.map(c => c.id))
            .order("created_at", { ascending: false }).limit(50);
          (msgs || []).forEach((m: any) => ev.push({
            id: `msg-${m.id}`, tipo: "mensagem", data: m.created_at,
            titulo: m.direcao === "entrada" ? "Paciente enviou" : "Você respondeu",
            descricao: (m.conteudo || m.transcricao || `[${m.tipo}]`).slice(0, 200),
          }));
        }
      }

      // Agendamentos
      const { data: ags } = await supabase.from("agendamentos")
        .select("id, data_inicio, status, titulo, observacoes")
        .eq("paciente_id", pacienteId)
        .order("data_inicio", { ascending: false }).limit(30);
      (ags || []).forEach(a => ev.push({
        id: `ag-${a.id}`, tipo: "agendamento", data: a.data_inicio,
        titulo: a.titulo || "Sessão",
        descricao: `Status: ${a.status}${a.observacoes ? ` · ${a.observacoes.slice(0, 100)}` : ""}`,
      }));

      // Pagamentos
      const { data: pgs } = await supabase.from("pagamentos_paciente")
        .select("id, valor, status, forma_pagamento, created_at, descricao")
        .eq("paciente_id", pacienteId)
        .order("created_at", { ascending: false }).limit(30);
      (pgs || []).forEach((p: any) => ev.push({
        id: `pg-${p.id}`, tipo: "pagamento", data: p.created_at,
        titulo: `R$ ${Number(p.valor).toFixed(2)} · ${p.status}`,
        descricao: `${p.forma_pagamento || ""} ${p.descricao ? "· " + p.descricao : ""}`.trim(),
      }));

      // MyID
      const { data: myids } = await supabase.from("myid_avaliacoes")
        .select("id, status, myid_score_parcial, updated_at, red_flags_detectadas")
        .eq("paciente_id", pacienteId)
        .order("updated_at", { ascending: false }).limit(10);
      (myids || []).forEach(m => ev.push({
        id: `myid-${m.id}`, tipo: "myid", data: m.updated_at,
        titulo: `MyID ${m.status}${m.myid_score_parcial ? ` · Score ${Math.round(m.myid_score_parcial)}` : ""}`,
        descricao: m.red_flags_detectadas ? "⚠️ Red flags detectados" : undefined,
      }));

      // Evolução
      const { data: evos } = await supabase.from("evolucao_paciente")
        .select("id, classificacao, observacoes, myid_score, data_registro, numero_avaliacao")
        .eq("paciente_id", pacienteId)
        .order("data_registro", { ascending: false }).limit(20);
      (evos || []).forEach((e: any) => ev.push({
        id: `ev-${e.id}`, tipo: "evolucao", data: e.data_registro,
        titulo: `Avaliação #${e.numero_avaliacao || "?"}${e.myid_score ? ` · MyID ${Math.round(e.myid_score)}` : ""}`,
        descricao: e.classificacao || e.observacoes?.slice(0, 200),
      }));

      ev.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
      setEventos(ev);
      setLoading(false);
    })();
  }, [pacienteId]);

  const filtrados = filtro === "todos" ? eventos : eventos.filter(e => e.tipo === filtro);

  const tipos: Array<{ v: Evento["tipo"] | "todos"; l: string }> = [
    { v: "todos", l: "Tudo" },
    { v: "mensagem", l: "Mensagens" },
    { v: "agendamento", l: "Sessões" },
    { v: "pagamento", l: "Pagamentos" },
    { v: "myid", l: "MyID" },
    { v: "evolucao", l: "Evolução" },
  ];

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="h-section">Linha do tempo</h3>
        <div className="flex gap-1 flex-wrap">
          {tipos.map(t => (
            <Badge
              key={t.v}
              variant={filtro === t.v ? "default" : "secondary"}
              className="cursor-pointer"
              onClick={() => setFiltro(t.v)}
            >
              {t.l} {t.v !== "todos" && `(${eventos.filter(e => e.tipo === t.v).length})`}
            </Badge>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando…</div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-caption">
          Nenhum evento neste filtro.
        </div>
      ) : (
        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
          {filtrados.map(e => {
            const Icon = ICONES[e.tipo];
            return (
              <div key={e.id} className="flex gap-3">
                <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${CORES[e.tipo]}`}>
                  <Icon className="icon-sm" />
                </div>
                <div className="flex-1 min-w-0 pb-3 border-b border-border/40 last:border-0">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium text-sm truncate">{e.titulo}</span>
                    <span className="text-micro text-muted-foreground shrink-0">
                      {format(new Date(e.data), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  {e.descricao && (
                    <p className="text-caption text-muted-foreground mt-0.5 line-clamp-2">{e.descricao}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
