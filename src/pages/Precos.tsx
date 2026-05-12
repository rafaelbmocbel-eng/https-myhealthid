import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Check, Sparkles, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PlanoPublico {
  id: string;
  nome: string;
  descricao: string | null;
  modulos: string[];
  preco_mensal: number;
  limite_ia_mensal: number;
  destaque: boolean;
  ordem: number;
}

const FEATURES_LABEL: Record<string, string> = {
  agenda: "Agenda completa com drag and drop",
  pacientes: "Gestão ilimitada de pacientes",
  myid: "Avaliação MyID v2.0 com 11 dimensões",
  portal_paciente: "Portal do paciente gamificado (PWA)",
  eventos: "Módulo de eventos com inscrições",
  prontuario: "Prontuário eletrônico (SOAP)",
  crm: "CRM completo de vendas e retenção",
  funil_vendas: "Funil de vendas com chatbot público",
  pacotes_sessoes: "Gestão de pacotes de sessões",
  financeiro_avancado: "Financeiro avançado e conciliação",
  relatorios: "Relatórios e dashboards",
  multi_profissional: "Multi-profissional na mesma clínica",
  painel_dono: "Painel do dono com visão consolidada",
  comissoes: "Gestão de comissões por profissional",
};

export default function Precos() {
  useEffect(() => {
    document.title = "Planos e Preços | MY HEALTH ID";
    const meta = document.querySelector('meta[name="description"]') ?? (() => {
      const m = document.createElement("meta");
      m.setAttribute("name", "description");
      document.head.appendChild(m);
      return m;
    })();
    meta.setAttribute(
      "content",
      "Planos do MY HEALTH ID: Essencial, Profissional e Clínica. Avaliação MyID, agenda, CRM e IA clínica."
    );
  }, []);

  const { data: planos, isLoading } = useQuery({
    queryKey: ["planos-publicos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planos")
        .select("id,nome,descricao,modulos,preco_mensal,limite_ia_mensal,destaque,ordem")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as PlanoPublico[];
    },
  });

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Hero */}
      <header className="border-b border-border/40 bg-card/30">
        <div className="container mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="icon-sm text-primary" />
            <span className="text-caption uppercase tracking-wide">MY HEALTH ID</span>
          </div>
          <h1 className="h-page mb-3 text-3xl sm:text-4xl">
            Planos pensados para profissionais que cuidam de verdade.
          </h1>
          <p className="text-caption max-w-2xl text-base">
            Avaliação MyID, agenda, prontuário, portal do paciente e IA clínica.
            Comece pelo essencial e cresça com CRM, funil de vendas e gestão multi-profissional.
          </p>
        </div>
      </header>

      {/* Plans grid */}
      <main className="container mx-auto max-w-6xl px-4 py-10 sm:py-14">
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-96 rounded-2xl border border-border/40 bg-muted/20 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {planos?.map((p) => (
              <PlanoCard key={p.id} plano={p} />
            ))}
          </div>
        )}

        {/* Excedente IA */}
        <div className="mt-10 rounded-xl border border-border/40 bg-card/40 p-5 sm:p-6">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="h-card mb-1">Excedente de IA</h2>
              <p className="text-caption">
                Quando ultrapassar o limite mensal do seu plano, cada análise extra custa apenas{" "}
                <strong className="text-foreground">R$ 0,40</strong>. Cobrado só por uso real.
              </p>
            </div>
            <Badge variant="secondary" className="shrink-0">Cobrança por uso</Badge>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <p className="text-caption mb-4">Pronto para começar?</p>
          <Button asChild size="lg" className="gap-2">
            <Link to="/auth">
              Criar minha conta <ArrowRight className="icon-sm" />
            </Link>
          </Button>
        </div>

        {/* FAQ leve */}
        <section className="mt-16 grid gap-6 md:grid-cols-2">
          <FAQ
            q="Posso trocar de plano depois?"
            a="Sim. Você pode subir ou descer de plano quando quiser, sem multas."
          />
          <FAQ
            q="O que acontece se eu passar do limite de IA?"
            a="Nada bloqueia. As análises extras continuam funcionando e são cobradas a R$ 0,40 cada na próxima fatura."
          />
          <FAQ
            q="O plano Clínica cobra por profissional?"
            a="Sim. R$ 197 por profissional ativo, com mínimo de 2. O dono recebe painel consolidado e gestão de comissões."
          />
          <FAQ
            q="Meus pacientes pagam alguma coisa?"
            a="Não. O portal do paciente é gratuito e ilimitado em todos os planos."
          />
        </section>
      </main>
    </div>
  );
}

function PlanoCard({ plano }: { plano: PlanoPublico }) {
  const isClinica = plano.nome === "Clínica";
  return (
    <article
      className={`relative flex flex-col rounded-2xl border p-6 transition-all ${
        plano.destaque
          ? "border-primary/60 bg-card shadow-md ring-1 ring-primary/20"
          : "border-border/40 bg-card/60"
      }`}
    >
      {plano.destaque && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Mais escolhido</Badge>
      )}

      <header className="mb-4">
        <h3 className="h-card text-lg">{plano.nome}</h3>
        {plano.descricao && <p className="text-caption mt-1">{plano.descricao}</p>}
      </header>

      <div className="mb-5">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold">R$ {plano.preco_mensal.toFixed(0)}</span>
          <span className="text-caption">/mês{isClinica ? " por profissional" : ""}</span>
        </div>
        {isClinica && <p className="text-micro mt-1">Mínimo de 2 profissionais</p>}
      </div>

      <ul className="mb-6 space-y-2.5 flex-1">
        {plano.modulos.map((m) => (
          <li key={m} className="flex items-start gap-2 text-sm">
            <Check className="icon-sm text-primary mt-0.5 shrink-0" />
            <span>{FEATURES_LABEL[m] ?? m}</span>
          </li>
        ))}
        {plano.limite_ia_mensal > 0 && (
          <li className="flex items-start gap-2 text-sm">
            <Check className="icon-sm text-primary mt-0.5 shrink-0" />
            <span>
              <strong>{plano.limite_ia_mensal}</strong> análises de IA inclusas/mês
            </span>
          </li>
        )}
      </ul>

      <Button asChild className="w-full" variant={plano.destaque ? "default" : "outline"}>
        <Link to="/auth">Começar com {plano.nome}</Link>
      </Button>
    </article>
  );
}

function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/40 p-5">
      <h4 className="h-card mb-1 text-base">{q}</h4>
      <p className="text-caption">{a}</p>
    </div>
  );
}
