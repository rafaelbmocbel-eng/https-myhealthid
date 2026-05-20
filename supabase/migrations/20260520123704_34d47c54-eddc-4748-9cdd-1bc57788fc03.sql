-- Enable pgvector for semantic search
create extension if not exists vector;

-- Main evidence library table
create table public.evidence_library (
  id uuid primary key default gen_random_uuid(),
  external_id text not null, -- e.g. "pubmed:12345678" or "doi:10.1234/xyz"
  source text not null default 'pubmed', -- pubmed | europepmc | cochrane | pedro | manual
  title text not null,
  abstract text,
  authors text[],
  journal text,
  year smallint,
  doi text,
  pmid text,
  url text,
  study_type text, -- systematic_review | meta_analysis | rct | guideline | review
  evidence_level text, -- A | B | C | D (Oxford CEBM / GRADE)
  health_areas text[] not null default '{}', -- fisioterapia | medicina | psicologia | nutricao | educacao_fisica | terapia_ocupacional
  mesh_terms text[],
  language text default 'en',
  embedding vector(1536), -- Matryoshka truncation from gemini-embedding-001
  embedding_model text default 'google/gemini-embedding-001',
  citation_count integer default 0, -- how many times used in evaluations
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index evidence_library_external_id_uidx on public.evidence_library(external_id);
create index evidence_library_year_idx on public.evidence_library(year desc);
create index evidence_library_health_areas_idx on public.evidence_library using gin(health_areas);
create index evidence_library_mesh_idx on public.evidence_library using gin(mesh_terms);
create index evidence_library_embedding_idx on public.evidence_library
  using hnsw (embedding vector_cosine_ops);

alter table public.evidence_library enable row level security;

create policy "Authenticated users can read evidence"
  on public.evidence_library for select
  to authenticated
  using (true);

-- Only service role writes (edge functions)

-- Ingestion log
create table public.evidence_ingestion_log (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  query text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  articles_fetched integer default 0,
  articles_inserted integer default 0,
  articles_skipped integer default 0,
  errors_count integer default 0,
  error_details jsonb,
  status text not null default 'running' -- running | completed | failed
);

alter table public.evidence_ingestion_log enable row level security;

create policy "Authenticated users can read ingestion log"
  on public.evidence_ingestion_log for select
  to authenticated
  using (true);

-- Updated_at trigger
create trigger evidence_library_updated_at
  before update on public.evidence_library
  for each row execute function public.update_updated_at_column();

-- Semantic search RPC
create or replace function public.match_evidence(
  query_embedding vector(1536),
  match_count integer default 5,
  filter_areas text[] default null,
  min_year integer default null
)
returns table (
  id uuid,
  external_id text,
  title text,
  abstract text,
  authors text[],
  journal text,
  year smallint,
  doi text,
  url text,
  study_type text,
  evidence_level text,
  health_areas text[],
  similarity float
)
language sql stable security definer
set search_path = public
as $$
  select
    e.id, e.external_id, e.title, e.abstract, e.authors, e.journal,
    e.year, e.doi, e.url, e.study_type, e.evidence_level, e.health_areas,
    1 - (e.embedding <=> query_embedding) as similarity
  from public.evidence_library e
  where e.embedding is not null
    and (filter_areas is null or e.health_areas && filter_areas)
    and (min_year is null or e.year >= min_year)
  order by e.embedding <=> query_embedding
  limit match_count;
$$;

-- Increment citation counter (called when evidence is used in an evaluation)
create or replace function public.increment_evidence_citation(p_ids uuid[])
returns void
language sql security definer
set search_path = public
as $$
  update public.evidence_library
  set citation_count = citation_count + 1
  where id = any(p_ids);
$$;