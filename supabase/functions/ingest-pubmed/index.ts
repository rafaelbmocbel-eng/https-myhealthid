// Ingest systematic reviews / meta-analyses from PubMed + Europe PMC
// Generates embeddings via Lovable AI and stores in evidence_library.
// Can be called manually or via pg_cron weekly.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Curated queries per professional lens. Each query targets systematic reviews & meta-analyses.
// Add/edit freely — tuned for breadth across the 6 lenses without flooding.
const QUERIES: { area: string; query: string }[] = [
  // Fisioterapia / reabilitação
  { area: "fisioterapia", query: "(physical therapy OR physiotherapy OR rehabilitation) AND (systematic review[pt] OR meta-analysis[pt])" },
  { area: "fisioterapia", query: "(low back pain OR neck pain OR shoulder pain OR knee pain) AND (exercise OR manual therapy) AND (systematic review[pt] OR meta-analysis[pt])" },
  { area: "fisioterapia", query: "(tendinopathy OR osteoarthritis OR chronic pain) AND rehabilitation AND (systematic review[pt] OR meta-analysis[pt])" },
  // Medicina
  { area: "medicina", query: "(musculoskeletal disorders OR sports medicine) AND clinical guideline AND (systematic review[pt] OR meta-analysis[pt])" },
  { area: "medicina", query: "(red flags OR cauda equina OR radiculopathy) AND (systematic review[pt] OR meta-analysis[pt])" },
  { area: "medicina", query: "(internal medicine OR primary care OR family medicine) AND (systematic review[pt] OR meta-analysis[pt])" },
  // Psicologia
  { area: "psicologia", query: "(cognitive behavioral therapy OR mindfulness) AND (depression OR anxiety OR chronic pain) AND (systematic review[pt] OR meta-analysis[pt])" },
  { area: "psicologia", query: "(PHQ-9 OR GAD-7 OR fear-avoidance) AND (systematic review[pt] OR meta-analysis[pt])" },
  { area: "psicologia", query: "(psychotherapy OR ACT therapy OR trauma-focused) AND (systematic review[pt] OR meta-analysis[pt])" },
  // Neurociência
  { area: "neurociencia", query: "(neuroplasticity OR motor learning OR neural rehabilitation) AND (systematic review[pt] OR meta-analysis[pt])" },
  { area: "neurociencia", query: "(stroke OR Parkinson disease OR traumatic brain injury) AND rehabilitation AND (systematic review[pt] OR meta-analysis[pt])" },
  { area: "neurociencia", query: "(central sensitization OR pain neuroscience education) AND (systematic review[pt] OR meta-analysis[pt])" },
  // Nutrição
  { area: "nutricao", query: "(nutrition OR dietary intervention) AND (chronic disease OR obesity OR inflammation) AND (systematic review[pt] OR meta-analysis[pt])" },
  { area: "nutricao", query: "(protein intake OR mediterranean diet OR intermittent fasting) AND (systematic review[pt] OR meta-analysis[pt])" },
  // Educação física
  { area: "educacao_fisica", query: "(resistance training OR aerobic exercise OR periodization) AND (systematic review[pt] OR meta-analysis[pt])" },
  { area: "educacao_fisica", query: "(strength training OR HIIT OR exercise prescription) AND (systematic review[pt] OR meta-analysis[pt])" },
  // TO
  { area: "terapia_ocupacional", query: "(occupational therapy OR activities of daily living) AND (systematic review[pt] OR meta-analysis[pt])" },
  { area: "terapia_ocupacional", query: "(hand therapy OR sensory integration OR cognitive rehabilitation) AND (systematic review[pt] OR meta-analysis[pt])" },
];

interface PubMedArticle {
  pmid: string;
  doi?: string;
  title: string;
  abstract?: string;
  authors: string[];
  journal?: string;
  year?: number;
  pubTypes: string[];
  meshTerms: string[];
  language: string;
}

async function fetchPubMedIds(query: string, retmax = 200, mindate?: string): Promise<string[]> {
  const params = new URLSearchParams({
    db: "pubmed",
    term: query,
    retmax: String(retmax),
    retmode: "json",
    sort: "date",
  });
  if (mindate) {
    params.set("datetype", "pdat");
    params.set("mindate", mindate);
    params.set("maxdate", new Date().toISOString().slice(0, 10).replace(/-/g, "/"));
  }
  const r = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${params}`);
  if (!r.ok) throw new Error(`esearch failed: ${r.status}`);
  const j = await r.json();
  return j.esearchresult?.idlist ?? [];
}

async function fetchPubMedDetails(pmids: string[]): Promise<PubMedArticle[]> {
  if (pmids.length === 0) return [];
  // efetch returns XML — we parse minimally
  const params = new URLSearchParams({
    db: "pubmed",
    id: pmids.join(","),
    retmode: "xml",
  });
  const r = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?${params}`);
  if (!r.ok) throw new Error(`efetch failed: ${r.status}`);
  const xml = await r.text();

  const articles: PubMedArticle[] = [];
  // Split by PubmedArticle
  const blocks = xml.split(/<PubmedArticle[\s>]/).slice(1);
  for (const block of blocks) {
    const pmid = block.match(/<PMID[^>]*>(\d+)<\/PMID>/)?.[1];
    if (!pmid) continue;
    const title = decode(block.match(/<ArticleTitle[^>]*>([\s\S]*?)<\/ArticleTitle>/)?.[1] ?? "").trim();
    if (!title) continue;
    const abstractParts = [...block.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)]
      .map((m) => decode(m[1])).filter(Boolean);
    const abstract = abstractParts.join("\n\n").trim() || undefined;
    const journal = decode(block.match(/<Title>([\s\S]*?)<\/Title>/)?.[1] ?? "") || undefined;
    const year = parseInt(block.match(/<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/)?.[1] ?? "0") || undefined;
    const language = block.match(/<Language>(\w+)<\/Language>/)?.[1]?.toLowerCase() ?? "en";
    const doi = block.match(/<ArticleId IdType="doi">([\s\S]*?)<\/ArticleId>/)?.[1];
    const authors = [...block.matchAll(/<Author[^>]*>[\s\S]*?<LastName>([^<]+)<\/LastName>[\s\S]*?<Initials>([^<]+)<\/Initials>/g)]
      .map((m) => `${m[1]} ${m[2]}`).slice(0, 10);
    const pubTypes = [...block.matchAll(/<PublicationType[^>]*>([^<]+)<\/PublicationType>/g)].map((m) => m[1]);
    const meshTerms = [...block.matchAll(/<DescriptorName[^>]*>([^<]+)<\/DescriptorName>/g)].map((m) => m[1]).slice(0, 15);
    articles.push({ pmid, doi, title, abstract, authors, journal, year, pubTypes, meshTerms, language });
  }
  return articles;
}

function decode(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'");
}

function classifyStudyType(pubTypes: string[]): { type: string; level: string } {
  const t = pubTypes.map((x) => x.toLowerCase());
  if (t.some((x) => x.includes("meta-analysis"))) return { type: "meta_analysis", level: "A" };
  if (t.some((x) => x.includes("systematic review"))) return { type: "systematic_review", level: "A" };
  if (t.some((x) => x.includes("randomized controlled"))) return { type: "rct", level: "B" };
  if (t.some((x) => x.includes("practice guideline") || x.includes("guideline"))) return { type: "guideline", level: "A" };
  if (t.some((x) => x.includes("review"))) return { type: "review", level: "C" };
  return { type: "other", level: "D" };
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-embedding-001",
      input: texts,
      dimensions: 1536, // Matryoshka truncation — cheaper storage, ~same quality
    }),
  });
  if (!r.ok) throw new Error(`embeddings failed: ${r.status} ${await r.text()}`);
  const j = await r.json();
  return j.data.map((d: any) => d.embedding);
}

async function runIngestion(opts: {
  mode: "initial" | "weekly";
  maxPerQuery: number;
  dryRun: boolean;
  activeQueries: typeof QUERIES;
  mindate?: string;
  logId?: string;
}) {
  const { mode, maxPerQuery, dryRun, activeQueries, mindate, logId } = opts;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  let totalFetched = 0, totalInserted = 0, totalSkipped = 0, errors = 0;
  const errorDetails: any[] = [];

  try {
    for (const { area, query } of activeQueries) {
      try {
        const pmids = await fetchPubMedIds(query, maxPerQuery, mindate);
        totalFetched += pmids.length;
        if (pmids.length === 0) continue;

        // Skip ones already in DB
        const { data: existing } = await supabase
          .from("evidence_library")
          .select("external_id")
          .in("external_id", pmids.map((p) => `pubmed:${p}`));
        const existingSet = new Set((existing ?? []).map((e: any) => e.external_id));
        const newPmids = pmids.filter((p) => !existingSet.has(`pubmed:${p}`));
        totalSkipped += pmids.length - newPmids.length;
        if (newPmids.length === 0) continue;

        // Fetch details in chunks of 100
        for (let i = 0; i < newPmids.length; i += 100) {
          const chunk = newPmids.slice(i, i + 100);
          const articles = await fetchPubMedDetails(chunk);
          // Only keep ones with abstract (needed for embedding quality)
          const usable = articles.filter((a) => a.abstract && a.abstract.length > 100);
          if (usable.length === 0) continue;

          // Embed title + abstract in batches of 50
          for (let j = 0; j < usable.length; j += 50) {
            const batch = usable.slice(j, j + 50);
            const texts = batch.map((a) => `${a.title}\n\n${a.abstract}`.slice(0, 8000));
            let embeddings: number[][];
            try {
              embeddings = dryRun ? batch.map(() => []) : await embedBatch(texts);
            } catch (e) {
              errors++;
              errorDetails.push({ stage: "embed", area, error: String(e) });
              continue;
            }

            const rows = batch.map((a, k) => {
              const { type, level } = classifyStudyType(a.pubTypes);
              return {
                external_id: `pubmed:${a.pmid}`,
                source: "pubmed",
                title: a.title,
                abstract: a.abstract,
                authors: a.authors,
                journal: a.journal,
                year: a.year,
                doi: a.doi,
                pmid: a.pmid,
                url: a.doi ? `https://doi.org/${a.doi}` : `https://pubmed.ncbi.nlm.nih.gov/${a.pmid}/`,
                study_type: type,
                evidence_level: level,
                health_areas: [area],
                mesh_terms: a.meshTerms,
                language: a.language,
                embedding: dryRun ? null : embeddings[k],
              };
            });

            if (!dryRun) {
              const { error: insErr, count } = await supabase
                .from("evidence_library")
                .upsert(rows, { onConflict: "external_id", count: "exact", ignoreDuplicates: true });
              if (insErr) {
                errors++;
                errorDetails.push({ stage: "insert", area, error: insErr.message });
              } else {
                totalInserted += count ?? rows.length;
              }
            }
          }

          // Be polite to NCBI: 3 req/s max
          await new Promise((r) => setTimeout(r, 350));
        }
      } catch (e) {
        errors++;
        errorDetails.push({ area, query, error: String(e) });
      }
    }

    if (logId) {
      await supabase.from("evidence_ingestion_log").update({
        finished_at: new Date().toISOString(),
        articles_fetched: totalFetched,
        articles_inserted: totalInserted,
        articles_skipped: totalSkipped,
        errors_count: errors,
        error_details: errorDetails.length ? errorDetails : null,
        status: errors > 0 && totalInserted === 0 ? "failed" : "completed",
      }).eq("id", logId);
    }

    return new Response(JSON.stringify({
      mode, totalFetched, totalInserted, totalSkipped, errors, dryRun,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    if (logId) {
      await supabase.from("evidence_ingestion_log").update({
        finished_at: new Date().toISOString(),
        status: "failed",
        errors_count: errors + 1,
        error_details: [...errorDetails, { fatal: String(e) }],
      }).eq("id", logId);
    }
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
