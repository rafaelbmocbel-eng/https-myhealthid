import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Bot, Clock, MessageCircle, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

const DIAS = [
  { k: "seg", l: "Seg" }, { k: "ter", l: "Ter" }, { k: "qua", l: "Qua" },
  { k: "qui", l: "Qui" }, { k: "sex", l: "Sex" }, { k: "sab", l: "Sáb" }, { k: "dom", l: "Dom" },
];

export default function WhatsappAutomacoes({ embedded = false }: { embedded?: boolean } = {}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState<any>(null);

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
        dias_semana: ["seg","ter","qua","qui","sex"],
        mensagem_saudacao: "Olá! 👋 Sou o assistente virtual. Em instantes um profissional vai te responder.",
        mensagem_fora_horario: "Estamos fora do horário de atendimento. Retornaremos assim que possível 💙",
        auto_confirmacao_24h: true,
        mensagem_confirmacao: "Olá {nome}! Confirmando sua sessão amanhã às {horario}. Responda SIM para confirmar.",
        detectar_intencao: true,
        pausar_bot_apos_humano: true,
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

  if (loading || !cfg) return <div className="p-6">Carregando…</div>;

  const toggleDia = (k: string) => {
    const dias = cfg.dias_semana?.includes(k)
      ? cfg.dias_semana.filter((d: string) => d !== k)
      : [...(cfg.dias_semana || []), k];
    setCfg({ ...cfg, dias_semana: dias });
  };

  return (
    <div className={embedded ? 'p-3 sm:p-5 space-y-4' : 'container max-w-3xl py-6 space-y-4'}>
      {!embedded && <PageHeader title="Automações do WhatsApp" subtitle="Bot de primeira resposta, confirmação 24h e detecção de intenção." />}

      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Bot className="icon-md text-primary shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold">Bot de primeira resposta</h3>
            <p className="text-caption">Responde automaticamente quando ninguém respondeu ainda.</p>
          </div>
          <Switch checked={cfg.bot_ativo} onCheckedChange={(v) => setCfg({ ...cfg, bot_ativo: v })} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Delay antes de responder (s)</Label>
            <Input type="number" min={0} max={120}
              value={cfg.delay_resposta_segundos}
              onChange={(e) => setCfg({ ...cfg, delay_resposta_segundos: +e.target.value })} />
          </div>
        </div>
        <div>
          <Label>Mensagem de saudação (horário comercial)</Label>
          <Textarea rows={3} value={cfg.mensagem_saudacao} onChange={(e) => setCfg({ ...cfg, mensagem_saudacao: e.target.value })} />
          <p className="text-micro mt-1">Use {"{nome}"} para inserir o primeiro nome.</p>
        </div>
        <div>
          <Label>Mensagem fora do horário</Label>
          <Textarea rows={3} value={cfg.mensagem_fora_horario} onChange={(e) => setCfg({ ...cfg, mensagem_fora_horario: e.target.value })} />
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Switch checked={cfg.pausar_bot_apos_humano} onCheckedChange={(v) => setCfg({ ...cfg, pausar_bot_apos_humano: v })} />
          <Label>Pausar bot quando profissional já respondeu (30 min)</Label>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Clock className="icon-md text-primary shrink-0" />
          <h3 className="font-semibold">Horário de atendimento</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Início</Label>
            <Input type="time" value={cfg.horario_inicio} onChange={(e) => setCfg({ ...cfg, horario_inicio: e.target.value })} />
          </div>
          <div>
            <Label>Fim</Label>
            <Input type="time" value={cfg.horario_fim} onChange={(e) => setCfg({ ...cfg, horario_fim: e.target.value })} />
          </div>
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
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <MessageCircle className="icon-md text-primary shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold">Confirmação automática 24h</h3>
            <p className="text-caption">Envia lembrete 1 dia antes da sessão. Roda às 09h.</p>
          </div>
          <Switch checked={cfg.auto_confirmacao_24h} onCheckedChange={(v) => setCfg({ ...cfg, auto_confirmacao_24h: v })} />
        </div>
        <div>
          <Label>Mensagem de confirmação</Label>
          <Textarea rows={3} value={cfg.mensagem_confirmacao} onChange={(e) => setCfg({ ...cfg, mensagem_confirmacao: e.target.value })} />
          <p className="text-micro mt-1">Variáveis: {"{nome}"}, {"{horario}"}.</p>
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-3">
          <Sparkles className="icon-md text-primary shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold">Detecção de intenção (IA)</h3>
            <p className="text-caption">Classifica cada msg recebida (agendar, dúvida, preço, urgência…) e calcula lead score.</p>
          </div>
          <Switch checked={cfg.detectar_intencao} onCheckedChange={(v) => setCfg({ ...cfg, detectar_intencao: v })} />
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={salvar} disabled={saving}>{saving ? "Salvando…" : "Salvar automações"}</Button>
      </div>
    </div>
  );
}
