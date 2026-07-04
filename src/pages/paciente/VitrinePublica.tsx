import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, MapPin, DollarSign, ArrowLeft, User, Loader2, Heart } from 'lucide-react';
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
};

const ESPECIALIDADES_FILTRO = [
  'Todas', 'Psicologia', 'Fisioterapia', 'Nutrição', 'Educação Física',
  'Fonoaudiologia', 'Terapia Ocupacional', 'Psiquiatria', 'Neuropsicologia',
];

function TerapeutaCard({ t, onClick }: { t: Terapeuta; onClick: () => void }) {
  const especialidades = t.especialidades?.slice(0, 3) || [];

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border border-border/40 bg-card p-4 hover:shadow-md hover:border-primary/30 transition-all group"
    >
      <div className="flex items-start gap-3">
        {t.foto_url ? (
          <img
            src={t.foto_url}
            alt={t.nome_exibicao || 'Terapeuta'}
            className="w-14 h-14 rounded-xl object-cover shrink-0 bg-muted"
          />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <User className="h-6 w-6 text-primary/60" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">
            {t.nome_exibicao || 'Profissional'}
          </p>
          {t.cidade && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" />
              {t.cidade}{t.uf ? `, ${t.uf}` : ''}
            </p>
          )}
          {t.valor_sessao && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5 font-medium">
              <DollarSign className="h-3 w-3" />
              R$ {Number(t.valor_sessao).toFixed(0)}/sessão
            </p>
          )}
        </div>
      </div>

      {especialidades.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {especialidades.map((e) => (
            <Badge key={e} variant="outline" className="text-[10px] h-5 px-1.5 border-primary/30 text-primary/80">
              {e}
            </Badge>
          ))}
          {(t.especialidades?.length || 0) > 3 && (
            <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-muted-foreground">
              +{(t.especialidades?.length || 0) - 3}
            </Badge>
          )}
        </div>
      )}

      {t.bio && (
        <p className="text-[11px] text-muted-foreground mt-2.5 line-clamp-2 leading-relaxed">
          {t.bio}
        </p>
      )}

      <p className="text-xs font-semibold text-primary mt-3 flex items-center gap-1 group-hover:gap-2 transition-all">
        Ver perfil →
      </p>
    </button>
  );
}

export default function VitrinePublica() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [busca, setBusca] = useState('');
  const especialidadeFiltro = searchParams.get('especialidade') || 'Todas';

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
    return terapeutas.filter((t) => {
      const termoBusca = busca.toLowerCase();
      const matchBusca =
        !busca ||
        (t.nome_exibicao || '').toLowerCase().includes(termoBusca) ||
        (t.cidade || '').toLowerCase().includes(termoBusca) ||
        (t.especialidades || []).some((e) => e.toLowerCase().includes(termoBusca)) ||
        (t.bio || '').toLowerCase().includes(termoBusca);

      const matchEspecialidade =
        especialidadeFiltro === 'Todas' ||
        (t.especialidades || []).some((e) =>
          e.toLowerCase().includes(especialidadeFiltro.toLowerCase())
        );

      return matchBusca && matchEspecialidade;
    });
  }, [terapeutas, busca, especialidadeFiltro]);

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border/40">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/portaldocliente')}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <img src={logoFull} alt="My Health ID" className="h-7 w-auto object-contain" />
          </div>
          <Button size="sm" variant="outline" onClick={() => navigate('/paciente/login')}>
            Entrar / Cadastrar
          </Button>
        </div>
      </header>

      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        {/* Title + Search */}
        <div className="mb-6">
          <h1 className="text-xl font-black text-foreground mb-1">Encontre seu terapeuta</h1>
          <p className="text-sm text-muted-foreground mb-4">
            {terapeutas.length} profissional{terapeutas.length !== 1 ? 'is' : ''} disponíve{terapeutas.length !== 1 ? 'is' : 'l'} na plataforma
          </p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nome, especialidade ou cidade..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-10 h-11 rounded-xl"
            />
          </div>
        </div>

        {/* Especialidades filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none">
          {ESPECIALIDADES_FILTRO.map((e) => (
            <button
              key={e}
              onClick={() => {
                if (e === 'Todas') {
                  searchParams.delete('especialidade');
                } else {
                  searchParams.set('especialidade', e);
                }
                setSearchParams(searchParams);
              }}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                especialidadeFiltro === e || (e === 'Todas' && especialidadeFiltro === 'Todas')
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground'
              }`}
            >
              {e}
            </button>
          ))}
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-16">
            <Heart className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-semibold text-foreground">Nenhum profissional encontrado</p>
            <p className="text-xs text-muted-foreground mt-1">
              {busca || especialidadeFiltro !== 'Todas'
                ? 'Tente outros termos ou remova os filtros.'
                : 'Ainda não há terapeutas cadastrados na vitrine.'}
            </p>
            {(busca || especialidadeFiltro !== 'Todas') && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => { setBusca(''); searchParams.delete('especialidade'); setSearchParams(searchParams); }}
              >
                Remover filtros
              </Button>
            )}
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-3">
              {filtrados.length} resultado{filtrados.length !== 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtrados.map((t) => (
                <TerapeutaCard
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
