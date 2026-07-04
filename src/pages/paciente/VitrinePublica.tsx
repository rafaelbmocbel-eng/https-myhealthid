import { useState, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Search, MapPin, DollarSign, User, Loader2, ArrowLeft,
  Monitor, Building2, Globe, ChevronRight, Star,
} from 'lucide-react';
import logoFull from '@/assets/logo-myhealthid-full.webp';

type Terapeuta = {
  terapeuta_id: string;
  nome_exibicao: string | null;
  bio: string | null;
  especialidades: string[] | null;
  convenios: string[] | null;
  cidade: string | null;
  uf: string | null;
  valor_sessao: number | null;
  foto_url: string | null;
  modalidade: string | null;
};

// ─── categorias com emoji ───────────────────────────────────────────────────
const CATEGORIAS = [
  { label: 'Todos',                emoji: '⭐' },
  { label: 'Psicologia',           emoji: '🧠' },
  { label: 'Fisioterapia',         emoji: '🦴' },
  { label: 'Nutrição',             emoji: '🥗' },
  { label: 'Educação Física',      emoji: '💪' },
  { label: 'Fonoaudiologia',       emoji: '🗣️' },
  { label: 'Terapia Ocupacional',  emoji: '🖐️' },
  { label: 'Psiquiatria',          emoji: '💊' },
  { label: 'Neuropsicologia',      emoji: '🔬' },
  { label: 'Acupuntura',           emoji: '🪡' },
  { label: 'Pilates',              emoji: '🤸' },
  { label: 'Osteopatia',           emoji: '🩺' },
];

// ─── gradiente de avatar por nome ──────────────────────────────────────────
const GRADIENTS = [
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-violet-500 to-purple-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-cyan-500 to-sky-600',
];
function gradientFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i)) % GRADIENTS.length;
  return GRADIENTS[hash];
}

// ─── badge de modalidade ────────────────────────────────────────────────────
function ModalidadeBadge({ modalidade }: { modalidade: string | null }) {
  if (!modalidade || modalidade === 'presencial') {
    return (
      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
        <Building2 className="h-2.5 w-2.5" /> Presencial
      </span>
    );
  }
  if (modalidade === 'online') {
    return (
      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400">
        <Monitor className="h-2.5 w-2.5" /> Online
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400">
      <Globe className="h-2.5 w-2.5" /> Presencial + Online
    </span>
  );
}

// ─── card iFood-style ──────────────────────────────────────────────────────
function ProfissionalCard({ t, onClick }: { t: Terapeuta; onClick: () => void }) {
  const initials = (t.nome_exibicao || 'P').slice(0, 2).toUpperCase();
  const grad = gradientFor(t.terapeuta_id);
  const mainEsp = t.especialidades?.[0] || 'Profissional de saúde';

  return (
    <button
      onClick={onClick}
      className="group w-full text-left rounded-2xl overflow-hidden border border-border/40 bg-card hover:shadow-lg hover:border-primary/20 transition-all duration-200 active:scale-[0.98]"
    >
      {/* ─── capa ─── */}
      <div className="relative h-32 overflow-hidden">
        {t.foto_url ? (
          <img
            src={t.foto_url}
            alt={t.nome_exibicao || ''}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${grad} flex items-center justify-center`}>
            <span className="text-4xl font-black text-white/90 select-none">{initials}</span>
          </div>
        )}
        {/* modalidade badge sobre a capa */}
        <div className="absolute top-2 right-2">
          <ModalidadeBadge modalidade={t.modalidade} />
        </div>
        {/* gradiente inferior para legibilidade */}
        <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/50 to-transparent" />
        {/* especialidade principal sobre a capa */}
        <p className="absolute bottom-2 left-3 text-[10px] font-bold text-white/90 drop-shadow">{mainEsp}</p>
      </div>

      {/* ─── conteúdo ─── */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <p className="font-bold text-sm text-foreground leading-tight line-clamp-1 group-hover:text-primary transition-colors">
            {t.nome_exibicao || 'Profissional'}
          </p>
          {/* placeholder de estrela — futuro: avaliações reais */}
          <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-500">
            <Star className="h-3 w-3 fill-amber-400 stroke-amber-400" />
            Novo
          </span>
        </div>

        {t.cidade && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-0.5 mb-2">
            <MapPin className="h-3 w-3 shrink-0" />
            {t.cidade}{t.uf ? `, ${t.uf}` : ''}
          </p>
        )}

        {/* especialidades extras */}
        {(t.especialidades?.length || 0) > 1 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {t.especialidades!.slice(1, 3).map((e) => (
              <Badge key={e} variant="outline" className="text-[9px] h-4 px-1.5 border-primary/25 text-primary/70">
                {e}
              </Badge>
            ))}
            {(t.especialidades?.length || 0) > 3 && (
              <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-muted-foreground">
                +{(t.especialidades?.length || 0) - 3}
              </Badge>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-border/30">
          {t.valor_sessao ? (
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
              <DollarSign className="h-3.5 w-3.5" />
              R$ {Number(t.valor_sessao).toFixed(0)}<span className="font-normal text-muted-foreground">/sessão</span>
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">Consulte o valor</p>
          )}
          <span className="text-xs font-semibold text-primary flex items-center gap-0.5 group-hover:gap-1 transition-all">
            Ver perfil <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </button>
  );
}

// ─── componente principal ───────────────────────────────────────────────────
export default function VitrinePublica() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [busca, setBusca] = useState('');
  const [modalidadeFiltro, setModalidadeFiltro] = useState<'todos' | 'presencial' | 'online'>('todos');
  const catScrollRef = useRef<HTMLDivElement>(null);

  const categoriaAtiva = searchParams.get('categoria') || 'Todos';

  const { data: terapeutas = [], isLoading } = useQuery({
    queryKey: ['vitrine-terapeutas'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vitrine_terapeutas')
        .select('*');
      if (error) throw error;
      return (data || []) as Terapeuta[];
    },
  });

  const filtrados = useMemo(() => {
    const termo = busca.toLowerCase().trim();
    return terapeutas.filter((t) => {
      if (termo && !(
        (t.nome_exibicao || '').toLowerCase().includes(termo) ||
        (t.cidade || '').toLowerCase().includes(termo) ||
        (t.especialidades || []).some((e) => e.toLowerCase().includes(termo)) ||
        (t.bio || '').toLowerCase().includes(termo)
      )) return false;

      if (categoriaAtiva !== 'Todos') {
        const match = (t.especialidades || []).some((e) =>
          e.toLowerCase().includes(categoriaAtiva.toLowerCase())
        );
        if (!match) return false;
      }

      if (modalidadeFiltro !== 'todos') {
        const m = t.modalidade || 'presencial';
        if (modalidadeFiltro === 'online' && m === 'presencial') return false;
        if (modalidadeFiltro === 'presencial' && m === 'online') return false;
      }

      return true;
    });
  }, [terapeutas, busca, categoriaAtiva, modalidadeFiltro]);

  const setCategoria = (label: string) => {
    const p = new URLSearchParams(searchParams);
    if (label === 'Todos') p.delete('categoria');
    else p.set('categoria', label);
    setSearchParams(p);
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* ─── HERO + HEADER ─── */}
      <div
        className="relative pt-safe"
        style={{ background: 'linear-gradient(160deg, hsl(213 55% 14%) 0%, hsl(213 55% 5%) 100%)' }}
      >
        {/* decoração */}
        <div className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, hsl(190 85% 50%), transparent 70%)' }} />

        {/* barra de navegação */}
        <div className="relative flex items-center gap-2 px-4 pt-3 pb-1">
          <button
            onClick={() => navigate('/portaldocliente')}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-4 w-4 text-white" />
          </button>
          <img src={logoFull} alt="My Health ID" className="h-7 w-auto object-contain" />
          <div className="ml-auto">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs border-white/25 text-white hover:bg-white/15 bg-transparent"
              onClick={() => navigate('/paciente/login')}
            >
              Entrar
            </Button>
          </div>
        </div>

        {/* título + busca */}
        <div className="relative px-4 pt-4 pb-5">
          <p className="text-white/60 text-xs mb-1">
            {terapeutas.length > 0 ? `${terapeutas.length} profissional${terapeutas.length !== 1 ? 'is' : ''} disponíve${terapeutas.length !== 1 ? 'is' : 'l'}` : 'Encontre seu profissional'}
          </p>
          <h1 className="text-xl font-black text-white mb-3 leading-tight">
            Clínicas e profissionais<br />de saúde
          </h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nome, especialidade ou cidade..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-10 h-12 rounded-2xl text-[16px] sm:text-sm bg-background border-0 shadow-lg"
            />
          </div>
        </div>

        {/* categorias com emoji — scroll horizontal */}
        <div
          ref={catScrollRef}
          className="flex gap-2 overflow-x-auto px-4 pb-4 scrollbar-none"
        >
          {CATEGORIAS.map((c) => {
            const ativa = categoriaAtiva === c.label;
            return (
              <button
                key={c.label}
                onClick={() => setCategoria(c.label)}
                className={`shrink-0 flex flex-col items-center gap-1 w-16 transition-all`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl transition-all ${
                  ativa
                    ? 'bg-white shadow-lg scale-110'
                    : 'bg-white/15 hover:bg-white/25'
                }`}>
                  {c.emoji}
                </div>
                <span className={`text-[9px] font-semibold leading-tight text-center line-clamp-2 ${
                  ativa ? 'text-white' : 'text-white/60'
                }`}>
                  {c.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── FILTRO MODALIDADE ─── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/40 px-4 py-2.5 flex items-center gap-2 overflow-x-auto scrollbar-none">
        {(['todos', 'presencial', 'online'] as const).map((m) => {
          const labels = { todos: 'Todos', presencial: 'Presencial', online: 'Online' };
          return (
            <button
              key={m}
              onClick={() => setModalidadeFiltro(m)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                modalidadeFiltro === m
                  ? 'bg-foreground text-background border-foreground'
                  : 'border-border/50 text-muted-foreground hover:border-foreground/30'
              }`}
            >
              {labels[m]}
            </button>
          );
        })}
        {filtrados.length > 0 && (
          <p className="ml-auto shrink-0 text-[11px] text-muted-foreground whitespace-nowrap">
            {filtrados.length} resultado{filtrados.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* ─── LISTA ─── */}
      <div className="flex-1 px-4 py-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Carregando profissionais...</p>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <div className="text-5xl">🔍</div>
            <p className="font-semibold text-foreground">Nenhum resultado encontrado</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              {busca || categoriaAtiva !== 'Todos' || modalidadeFiltro !== 'todos'
                ? 'Tente outros termos ou remova os filtros.'
                : 'Ainda não há profissionais cadastrados na vitrine.'}
            </p>
            {(busca || categoriaAtiva !== 'Todos' || modalidadeFiltro !== 'todos') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBusca('');
                  setModalidadeFiltro('todos');
                  setCategoria('Todos');
                }}
              >
                Remover filtros
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* seção label */}
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
              {categoriaAtiva === 'Todos' ? 'Todos os profissionais' : categoriaAtiva}
            </p>

            {/* grid responsivo 1→2→3 colunas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtrados.map((t) => (
                <ProfissionalCard
                  key={t.terapeuta_id}
                  t={t}
                  onClick={() => navigate(`/portaldocliente/terapeuta/${t.terapeuta_id}`)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
