import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { SectionTitle } from "@/components/ui/section-title";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";
import { Loader2, BookOpen, RefreshCw, Download, ExternalLink, Search } from "lucide-react";

type Article = {
  id: string;
  title: string;
  authors: string[] | null;
  journal: string | null;
  year: number | null;
  doi: string | null;
  url: string | null;
  study_type: string | null;
  evidence_level: string | null;
  health_areas: string[];
  citation_count: number;
};

type IngestLog = {
  id: string;
  source: string;
  started_at: string;
  finished_at: string | null;
  articles_inserted: number;
  articles_fetched: number;
  errors_count: number;
  status: string;
};

const AREAS = [
  { key: "fisioterapia", label: "Fisioterapia" },
  { key: "medicina", label: "Medicina" },
  { key: "psicologia", label: "Psicologia" },
  { key: "neurociencia", label: "Neurociência" },
  { key: "nutricao", label: "Nutrição" },
  { key: "educacao_fisica", label: "Educação Física" },
  { key: "terapia_ocupacional", label: "Terapia Ocupacional" },
];

export default function BaseCientifica() {
  const [stats, setStats] = useState<{ total: number; byArea: Record<string, number> }>({ total: 0, byArea: {} });
  const [recent, setRecent] = useState<Article[]>([]);
  const [logs, setLogs] = useState<IngestLog[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Article[]>([]);
  const [searching, setSearching] = useState(false);
  const [ingesting, setIngesting] = useState<"initial" | "weekly" | null>(null);
  const [areaFilter, setAreaFilter] = useState<string | null>(null);

  const load = async () => {
    const { count } = await supabase.from("evidence_library").select("*", { count: "exact", head: true });
    const byArea: Record<string, number> = {};
    for (const a of AREAS) {
      const { count: c } = await supabase
        .from("evidence_library")
        .select("*", { count: "exact", head: true })
        .contains("health_areas", [a.key]);
      byArea[a.key] = c ?? 0;
    }
    setStats({ total: count ?? 0, byArea });

    let q = supabase
      .from("evidence_library")
      .select("id,title,authors,journal,year,doi,url,study_type,evidence_level,health_areas,citation_count")
      .order("year", { ascending: false, nullsFirst: false })
      .limit(30);
    if (areaFilter) q = q.contains("health_areas", [areaFilter]);
    const { data } = await q;
    setRecent((data as Article[]) ?? []);

    const { data: logsData } = await supabase
      .from("evidence_ingestion_log")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(10);
    setLogs((logsData as IngestLog[]) ?? []);
  };

  useEffect(() => { load(); }, [areaFilter]);

  const runIngest = async (mode: "initial" | "weekly") => {
    setIngesting(mode);
    const confirmMsg = mode === "initial"
      ? "Carga inicial pode levar 15-30 minutos e custar ~$30-50 em embeddings. Continuar?"
      : "Atualização incremental (últimos 10 dias). Continuar?";
    if (!confirm(confirmMsg)) { setIngesting(null); return; }
    try {
      const { data, error } = await supabase.functions.invoke("ingest-pubmed", {
        body: { mode, maxPerQuery: mode === "initial" ? 1500 : 50 },
      });
      if (error) throw error;
      toast.success(`Ingestão ok: ${data?.totalInserted ?? 0} novos artigos, ${data?.totalSkipped ?? 0} já existiam.`);
      load();
    } catch (e: any) {
      toast.error("Falha na ingestão: " + (e?.message ?? e));
    } finally {
      setIngesting(null);
    }
  };

  const runSearch = async () => {
    if (search.trim().length < 5) return;
    setSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("search-evidence", {
        body: { query: search.trim(), limit: 10, areas: areaFilter ? [areaFilter] : undefined },
      });
      if (error) throw error;
      setSearchResults(data?.matches ?? []);
    } catch (e: any) {
      toast.error("Busca falhou: " + (e?.message ?? e));
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      <PageHeader
        title="Base Científica"
        subtitle="Revisões sistemáticas e metanálises do PubMed que sustentam as avaliações geradas pela IA."
        icon={<BookOpen className="icon-md" />}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-caption text-muted-foreground">Total de artigos</div>
          <div className="h-card mt-1">{stats.total.toLocaleString("pt-BR")}</div>
        </Card>
        {AREAS.slice(0, 3).map((a) => (
          <Card key={a.key} className="p-4">
            <div className="text-caption text-muted-foreground">{a.label}</div>
            <div className="h-card mt-1">{(stats.byArea[a.key] ?? 0).toLocaleString("pt-BR")}</div>
          </Card>
        ))}
      </div>

      {/* Ingestion controls */}
      <Card className="p-5">
        <SectionTitle title="Atualização da base" description="A base se atualiza sozinha todo domingo às 00h (BRT). Você pode disparar manualmente abaixo." />
        <div className="flex flex-wrap gap-2 mt-3">
          <Button
            onClick={() => runIngest("initial")}
            disabled={!!ingesting}
            variant="default"
          >
            {ingesting === "initial" ? <Loader2 className="icon-sm animate-spin mr-2" /> : <Download className="icon-sm mr-2" />}
            Carga inicial (~15-25k artigos)
          </Button>
          <Button
            onClick={() => runIngest("weekly")}
            disabled={!!ingesting}
            variant="outline"
          >
            {ingesting === "weekly" ? <Loader2 className="icon-sm animate-spin mr-2" /> : <RefreshCw className="icon-sm mr-2" />}
            Atualizar agora (incremental)
          </Button>
        </div>

        {logs.length > 0 && (
          <div className="mt-4 space-y-1.5">
            <div className="text-micro text-muted-foreground uppercase tracking-wide">Últimas ingestões</div>
            {logs.map((l) => (
              <div key={l.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/40 last:border-0">
                <span className="text-muted-foreground">
                  {new Date(l.started_at).toLocaleString("pt-BR")} — {l.source}
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant={l.status === "completed" ? "secondary" : l.status === "failed" ? "destructive" : "outline"}>
                    {l.status}
                  </Badge>
                  <span className="text-caption">+{l.articles_inserted} novos</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Search */}
      <Card className="p-5">
        <SectionTitle title="Buscar na base" description="Busca semântica — encontra artigos pelo significado, não só por palavra-chave." />
        <div className="flex gap-2 mt-3">
          <Input
            placeholder="Ex: tratamento de tendinopatia patelar com exercícios excêntricos"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
          />
          <Button onClick={runSearch} disabled={searching || search.trim().length < 5}>
            {searching ? <Loader2 className="icon-sm animate-spin" /> : <Search className="icon-sm" />}
          </Button>
        </div>
        {searchResults.length > 0 && (
          <div className="mt-4 space-y-3">
            {searchResults.map((r: any) => (
              <ArticleCard key={r.id} article={r} similarity={r.similarity} />
            ))}
          </div>
        )}
      </Card>

      {/* Filter + recent */}
      <Card className="p-5">
        <SectionTitle title="Artigos recentes" />
        <div className="flex flex-wrap gap-2 mt-3 mb-4">
          <Badge
            variant={!areaFilter ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setAreaFilter(null)}
          >
            Todas
          </Badge>
          {AREAS.map((a) => (
            <Badge
              key={a.key}
              variant={areaFilter === a.key ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setAreaFilter(a.key)}
            >
              {a.label} ({stats.byArea[a.key] ?? 0})
            </Badge>
          ))}
        </div>
        {recent.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="icon-lg" />}
            title="Base vazia"
            description='Clique em "Carga inicial" acima para popular com revisões sistemáticas e metanálises do PubMed.'
          />
        ) : (
          <div className="space-y-3">
            {recent.map((a) => <ArticleCard key={a.id} article={a} />)}
          </div>
        )}
      </Card>
    </div>
  );
}

function ArticleCard({ article, similarity }: { article: Article & { similarity?: number }; similarity?: number }) {
  return (
    <div className="border border-border/40 rounded-xl p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm leading-snug">{article.title}</div>
          <div className="text-caption text-muted-foreground mt-1">
            {(article.authors ?? []).slice(0, 3).join(", ")}
            {(article.authors ?? []).length > 3 && " et al."}
            {article.journal && ` · ${article.journal}`}
            {article.year && ` (${article.year})`}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {article.study_type && <Badge variant="secondary" className="text-micro">{article.study_type}</Badge>}
            {article.evidence_level && <Badge variant="outline" className="text-micro">Evidência {article.evidence_level}</Badge>}
            {article.health_areas.map((a) => (
              <Badge key={a} variant="outline" className="text-micro">{a}</Badge>
            ))}
            {similarity !== undefined && (
              <Badge variant="secondary" className="text-micro">
                {(similarity * 100).toFixed(0)}% relevante
              </Badge>
            )}
            {article.citation_count > 0 && (
              <Badge variant="outline" className="text-micro">Citado {article.citation_count}x</Badge>
            )}
          </div>
        </div>
        {article.url && (
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Abrir artigo"
          >
            <ExternalLink className="icon-sm" />
          </a>
        )}
      </div>
    </div>
  );
}
