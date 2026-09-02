import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { selectTudoPaginado } from '@/lib/supabasePaginado';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Search, MapPin, DollarSign, Loader2, Building2, Monitor, Globe,
  ChevronRight, CheckCircle2, Clock, XCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import PacienteLayout from '@/components/paciente/PacienteLayout';
import ProtectedPatientRoute from '@/components/paciente/ProtectedPatientRoute';
import PortalErrorState from '@/components/paciente/PortalErrorState';
import { formatBRL0 } from '@/lib/formatBRL';

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

type Solicitacao = {
  id: string;
  terapeuta_id: string;
  status: string;
  mensagem: string | null;
  created_at: string;
};

const CATEGORIAS = [
  { label: 'Todos', emoji: '⭐' },
  { label: 'Psicologia', emoji: '🧠' },
  { label: 'Fisioterapia', emoji: '🦴' },
  { label: 'Nutrição', emoji: '🥗' },
  { label: 'Educação Física', emoji: '💪' },
  { label: 'Fonoaudiologia', emoji: '🗣️' },
  { label: 'Terapia Ocupacional', emoji: '🖐️' },
  { label: 'Psiquiatria', emoji: '💊' },
];

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

export default function PacienteProfissionais() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [busca, setBusca] = useState('');
  const [modalidadeFiltro, setModalidadeFiltro] = useState<'todos' | 'presencial' | 'online'>('todos');
  const [selectedTerapeuta, setSelectedTerapeuta] = useState<Terapeuta | null>(null);
  const [mensagem, setMensagem] = useState('');

  const categoriaAtiva = searchParams.get('categoria') || 'Todos';

  const { data: terapeutas = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['vitrine-terapeutas'],
    staleTime: 60_000,
    retry: 1,
    queryFn: async () => {
      // Paginado: a vitrine é uma lista GLOBAL de profissionais e é a que mais
      // tende a passar de 1000 linhas conforme a plataforma cresce.
      const data = await selectTudoPaginado((from, to) =>
        // cast na origem (supabase as any): a view vitrine_terapeutas não está nos
        // tipos gerados e a inferência profunda do PostgREST em .order()/.range()
        // estoura o TS ("excessively deep"). O resultado é tratado como Terapeuta[].
        (supabase as any).from('vitrine_terapeutas').select('*').order('terapeuta_id').range(from, to),
      );
      return (data || []) as Terapeuta[];
    },
  });

  const { data: minhasSolicitacoes = [] } = useQuery({
    queryKey: ['minhas-solicitacoes', user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solicitacoes_conexao')
        .select('id, terapeuta_id, status, mensagem, created_at')
        .eq('paciente_user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Solicitacao[];
    },
  });

  const solicitacaoMap = useMemo(() => {
    const m: Record<string, string> = {};
    minhasSolicitacoes.forEach(s => { m[s.terapeuta_id] = s.status; });
    return m;
  }, [minhasSolicitacoes]);

  const enviarSolicitacao = useMutation({
    mutationFn: async () => {
      if (!selectedTerapeuta || !user) throw new Error('Dados inválidos');
      const { error } = await supabase.from('solicitacoes_conexao').insert({
        paciente_user_id: user.id,
        terapeuta_id: selectedTerapeuta.terapeuta_id,
        mensagem: mensagem.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Solicitação enviada!', description: 'O profissional receberá sua solicitação em breve.' });
      queryClient.invalidateQueries({ queryKey: ['minhas-solicitacoes'] });
      setSelectedTerapeuta(null);
      setMensagem('');
    },
    onError: () => {
      toast({ title: 'Erro ao enviar', description: 'Tente novamente.', variant: 'destructive' });
    },
  });

  const filtrados = useMemo(() => {
    const termo = busca.toLowerCase().trim();
    return terapeutas.filter((t) => {
      if (termo && !(
        (t.nome_exibicao || '').toLowerCase().includes(termo) ||
        (t.cidade || '').toLowerCase().includes(termo) ||
        (t.especialidades || []).some(e => e.toLowerCase().includes(termo))
      )) return false;
      if (categoriaAtiva !== 'Todos') {
        if (!(t.especialidades || []).some(e => e.toLowerCase().includes(categoriaAtiva.toLowerCase()))) return false;
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
    <ProtectedPatientRoute>
    <PacienteLayout>
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-5">
        {/* Header */}
        <div>
          <h1 className="h-page">Encontrar profissional</h1>
          <p className="text-xs text-muted-foreground">Conecte-se com terapeutas, nutricionistas e mais</p>
        </div>

        {/* Minhas conexões */}
        {minhasSolicitacoes.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Minhas solicitações</p>
            {minhasSolicitacoes.map(s => {
              const t = terapeutas.find(t => t.terapeuta_id === s.terapeuta_id);
              const nome = t?.nome_exibicao || 'Profissional';
              return (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-card">
                  <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${gradientFor(s.terapeuta_id)} flex items-center justify-center shrink-0`}>
                    <span className="text-xs font-black text-white">{nome.slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.status === 'pendente' && 'Aguardando resposta'}
                      {s.status === 'aceita' && 'Solicitação aceita'}
                      {s.status === 'recusada' && 'Solicitação recusada'}
                    </p>
                  </div>
                  {s.status === 'pendente' && <Clock className="h-4 w-4 text-amber-500 shrink-0" />}
                  {s.status === 'aceita' && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
                  {s.status === 'recusada' && <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                </div>
              );
            })}
          </div>
        )}

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Nome, especialidade ou cidade..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="pl-10 h-11 rounded-xl text-[16px] sm:text-sm"
          />
        </div>

        {/* Categorias */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4">
          {CATEGORIAS.map(c => (
            <button
              key={c.label}
              onClick={() => setCategoria(c.label)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                categoriaAtiva === c.label
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border/60 text-muted-foreground hover:border-primary/40'
              }`}
            >
              <span>{c.emoji}</span> {c.label}
            </button>
          ))}
        </div>

        {/* Filtro modalidade */}
        <div className="flex gap-2">
          {(['todos', 'presencial', 'online'] as const).map(m => {
            const labels = { todos: 'Todos', presencial: 'Presencial', online: 'Online' };
            return (
              <button
                key={m}
                onClick={() => setModalidadeFiltro(m)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
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
            <p className="ml-auto text-[11px] text-muted-foreground self-center">
              {filtrados.length} resultado{filtrados.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Lista */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Carregando profissionais...</p>
          </div>
        ) : isError ? (
          <PortalErrorState onRetry={() => refetch()} mensagem="Não consegui carregar os profissionais. Verifique sua internet e tente de novo." />
        ) : filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="text-4xl">🔍</div>
            <p className="font-semibold text-foreground">Nenhum profissional encontrado</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              {busca || categoriaAtiva !== 'Todos' || modalidadeFiltro !== 'todos'
                ? 'Tente outros termos ou remova os filtros.'
                : 'Ainda não há profissionais na vitrine. Volte em breve!'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtrados.map(t => {
              const initials = (t.nome_exibicao || 'P').slice(0, 2).toUpperCase();
              const grad = gradientFor(t.terapeuta_id);
              const mainEsp = t.especialidades?.[0] || 'Profissional de saúde';
              const statusSolic = solicitacaoMap[t.terapeuta_id];

              return (
                <div
                  key={t.terapeuta_id}
                  className="rounded-2xl overflow-hidden border border-border/40 bg-card hover:shadow-md transition-all"
                >
                  {/* Capa */}
                  <div className="relative h-28 overflow-hidden">
                    {t.foto_url ? (
                      <img src={t.foto_url} alt={t.nome_exibicao || ''} className="w-full h-full object-cover" />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${grad} flex items-center justify-center`}>
                        <span className="text-3xl font-black text-white/90">{initials}</span>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/50 to-transparent" />
                    <p className="absolute bottom-2 left-3 text-[10px] font-bold text-white/90 drop-shadow">{mainEsp}</p>
                    <div className="absolute top-2 right-2">
                      {t.modalidade === 'online' ? (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-600"><Monitor className="h-2.5 w-2.5" /> Online</span>
                      ) : t.modalidade === 'ambos' ? (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700"><Globe className="h-2.5 w-2.5" /> Presencial + Online</span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600"><Building2 className="h-2.5 w-2.5" /> Presencial</span>
                      )}
                    </div>
                  </div>

                  {/* Conteúdo */}
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-bold text-sm text-foreground leading-tight line-clamp-1">{t.nome_exibicao || 'Profissional'}</p>
                    </div>
                    {t.cidade && (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-0.5 mb-2">
                        <MapPin className="h-3 w-3 shrink-0" /> {t.cidade}{t.uf ? `, ${t.uf}` : ''}
                      </p>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-border/30">
                      {t.valor_sessao ? (
                        <p className="text-xs font-bold text-emerald-600 flex items-center gap-0.5">
                          <DollarSign className="h-3.5 w-3.5" />
                          {formatBRL0(Number(t.valor_sessao))}<span className="font-normal text-muted-foreground">/sessão</span>
                        </p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">Consulte o valor</p>
                      )}
                      {statusSolic === 'pendente' ? (
                        <span className="text-xs text-amber-600 font-semibold flex items-center gap-1"><Clock className="h-3 w-3" /> Enviado</span>
                      ) : statusSolic === 'aceita' ? (
                        <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Conectado</span>
                      ) : (
                        <Button
                          size="sm"
                          className="h-9 text-xs px-3 rounded-lg"
                          onClick={() => setSelectedTerapeuta(t)}
                        >
                          Solicitar <ChevronRight className="h-3 w-3 ml-0.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialog de solicitação */}
      <Dialog open={!!selectedTerapeuta} onOpenChange={() => { setSelectedTerapeuta(null); setMensagem(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar atendimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Envie uma solicitação para <strong>{selectedTerapeuta?.nome_exibicao || 'este profissional'}</strong>.
              Eles receberão uma notificação e poderão aceitar ou recusar.
            </p>
            <Textarea
              placeholder="Mensagem opcional: conte um pouco sobre você ou sua necessidade..."
              value={mensagem}
              onChange={e => setMensagem(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelectedTerapeuta(null); setMensagem(''); }}>
              Cancelar
            </Button>
            <Button
              onClick={() => enviarSolicitacao.mutate()}
              disabled={enviarSolicitacao.isPending}
            >
              {enviarSolicitacao.isPending ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Enviando...</> : 'Enviar solicitação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PacienteLayout>
    </ProtectedPatientRoute>
  );
}
