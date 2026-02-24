import { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Navigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePacientes } from '@/hooks/usePacientes';
import { useLinksAvaliacao } from '@/hooks/useLinksAvaliacao';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import {
  Sparkles, Users, Search, ChevronRight, Loader2,
  CalendarDays, Target, TrendingUp, BarChart3,
  Dumbbell, Clock, FileText, Plus, Link2,
  Activity, MessageCircle, ExternalLink,
  ArrowLeft, AlertTriangle, Bell, Eye,
  ClipboardList, StickyNote, Ruler,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { differenceInDays, format, parseISO, isToday, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { shareAvaliacaoLink } from '@/utils/whatsapp';

// Sub-components
import StudioTreinosTab from '@/components/studio/StudioTreinosTab';
import StudioEvolucaoTab from '@/components/studio/StudioEvolucaoTab';
import StudioNotasTab from '@/components/studio/StudioNotasTab';
import StudioAvaliacaoTab from '@/components/studio/StudioAvaliacaoTab';

export default function StudioPersonalID() {
  const { user, loading: authLoading } = useAuth();
  const { allPacientes: pacientes, isLoading: loadingPacientes } = usePacientes();
  const { links, gerarLink, copiarLink, getLinkUrl, gerando } = useLinksAvaliacao();
  const [searchParams] = useSearchParams();
  const [selectedPacienteId, setSelectedPacienteId] = useState<string | null>(searchParams.get('paciente'));
  const [showDashboard, setShowDashboard] = useState(!!searchParams.get('paciente'));
  const [searchPac, setSearchPac] = useState('');

  // Stats queries (always called for hook order)
  const { data: agendamentosHoje = [] } = useQuery({
    queryKey: ['studio-agenda-hoje', user?.id],
    queryFn: async () => {
      const today = startOfDay(new Date());
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const { data } = await supabase
        .from('agendamentos')
        .select('*, pacientes(nome, sobrenome)')
        .eq('terapeuta_id', user!.id)
        .gte('data_inicio', today.toISOString())
        .lt('data_inicio', tomorrow.toISOString())
        .order('data_inicio');
      return data || [];
    },
    enabled: !!user,
  });


  const { data: studioTreinosCount = 0 } = useQuery({
    queryKey: ['studio-treinos-count', user?.id],
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from('studio_treinos')
        .select('id', { count: 'exact', head: true })
        .eq('terapeuta_id', user!.id)
        .eq('ativo', true);
      return count || 0;
    },
    enabled: !!user,
  });

  if (!authLoading && !user) return <Navigate to="/auth" replace />;

  const selectedPaciente = pacientes.find(p => p.id === selectedPacienteId);
  const filteredPac = pacientes.filter(p =>
    `${p.nome} ${p.sobrenome}`.toLowerCase().includes(searchPac.toLowerCase())
  );

  const getLinkAtivo = (pid: string) =>
    links.find(l => l.paciente_id === pid && l.status === 'ativo' && new Date(l.data_expiracao) > new Date());

  const handleSelectPaciente = (pac: typeof pacientes[0]) => {
    setSelectedPacienteId(pac.id);
    setShowDashboard(true);
  };

  // ─── Student Dashboard (Tab-based) ──────────────────────────────────────────
  if (selectedPacienteId && showDashboard && selectedPaciente) {
    return (
      <AppLayout>
        <div className="container py-6 max-w-4xl">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => { setSelectedPacienteId(null); setShowDashboard(false); }} className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="h-12 w-12 rounded-2xl bg-gradient-studio flex items-center justify-center shadow-lg shrink-0 text-white font-bold text-lg">
              {selectedPaciente.nome[0]}{selectedPaciente.sobrenome?.[0] || ''}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-black text-foreground truncate">
                {selectedPaciente.nome} {selectedPaciente.sobrenome}
              </h1>
              <p className="text-xs text-muted-foreground">Studio Personal ID</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/pacientes/${selectedPaciente.id}`}>
                <ExternalLink className="h-3.5 w-3.5 mr-1" /> Perfil
              </Link>
            </Button>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="avaliacao" className="w-full">
            <TabsList className="grid w-full grid-cols-4 h-10 bg-muted/60">
              <TabsTrigger value="avaliacao" className="text-xs gap-1 data-[state=active]:bg-gradient-studio data-[state=active]:text-white">
                <ClipboardList className="h-3.5 w-3.5" /> Avaliação
              </TabsTrigger>
              <TabsTrigger value="treinos" className="text-xs gap-1 data-[state=active]:bg-gradient-studio data-[state=active]:text-white">
                <Dumbbell className="h-3.5 w-3.5" /> Treinos
              </TabsTrigger>
              <TabsTrigger value="evolucao" className="text-xs gap-1 data-[state=active]:bg-gradient-studio data-[state=active]:text-white">
                <BarChart3 className="h-3.5 w-3.5" /> Evolução
              </TabsTrigger>
              <TabsTrigger value="notas" className="text-xs gap-1 data-[state=active]:bg-gradient-studio data-[state=active]:text-white">
                <StickyNote className="h-3.5 w-3.5" /> Notas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="avaliacao" className="mt-4">
              <StudioAvaliacaoTab pacienteId={selectedPaciente.id} pacienteNome={selectedPaciente.nome} pacienteTelefone={selectedPaciente.telefone} />
            </TabsContent>

            <TabsContent value="treinos" className="mt-4">
              <StudioTreinosTab pacienteId={selectedPaciente.id} pacienteNome={selectedPaciente.nome} />
            </TabsContent>

            <TabsContent value="evolucao" className="mt-4">
              <StudioEvolucaoTab pacienteId={selectedPaciente.id} />
            </TabsContent>

            <TabsContent value="notas" className="mt-4">
              <StudioNotasTab pacienteId={selectedPaciente.id} />
            </TabsContent>
          </Tabs>
        </div>
      </AppLayout>
    );
  }

  // ─── Main Dashboard ─────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="container py-6 max-w-4xl">
        {/* Module Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="h-12 w-12 rounded-2xl bg-gradient-studio flex items-center justify-center shadow-lg">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground">Studio Personal ID</h1>
            <p className="text-muted-foreground text-sm">Treinamento Personalizado Integrado à Saúde</p>
          </div>
        </div>

        {/* Visão Geral Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { icon: Users, label: 'Alunos Ativos', value: pacientes.length, color: 'text-studio' },
            { icon: CalendarDays, label: 'Sessões Hoje', value: agendamentosHoje.length, color: 'text-studio' },
            { icon: Dumbbell, label: 'Treinos Ativos', value: studioTreinosCount, color: 'text-studio' },
            { icon: Activity, label: 'Status', value: 'On', color: 'text-studio' },
          ].map(stat => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="border-studio/10 hover:border-studio/30 transition-all">
                <CardContent className="pt-4 pb-3 text-center">
                  <Icon className={cn('h-5 w-5 mx-auto mb-1', stat.color)} />
                  <div className="text-2xl font-black text-foreground">{stat.value}</div>
                  <div className="text-[10px] text-muted-foreground">{stat.label}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>


        {/* Agenda Hoje */}
        {agendamentosHoje.length > 0 && (
          <Card className="mb-6">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays className="h-4 w-4 text-studio" />
                <h3 className="font-bold text-sm text-foreground">
                  Agenda Hoje — {format(new Date(), "EEEE, dd/MM", { locale: ptBR })}
                </h3>
              </div>
              <div className="space-y-2">
                {agendamentosHoje.map((ag: any) => (
                  <div key={ag.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                    <div className="h-8 w-8 rounded-lg bg-gradient-studio flex items-center justify-center shrink-0">
                      <Clock className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-foreground">
                        {format(parseISO(ag.data_inicio), "HH:mm")} — {(ag.pacientes as any)?.nome || ag.titulo || 'Sessão'}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{ag.tipo_atendimento || 'Atendimento'}</div>
                    </div>
                    <Badge variant="outline" className={cn('text-[10px]',
                      ag.status === 'confirmado' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        ag.status === 'pendente' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-muted text-muted-foreground'
                    )}>{ag.status}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Patient List */}
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Alunos</h3>
              </div>
              <Badge variant="outline" className="text-xs">{pacientes.length}</Badge>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar aluno..." className="pl-9" value={searchPac} onChange={e => setSearchPac(e.target.value)} />
            </div>

            {loadingPacientes ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-studio" /></div>
            ) : filteredPac.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Sparkles className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="font-medium">Nenhum aluno cadastrado</p>
                <p className="text-sm mt-1">Cadastre em <strong>Pacientes</strong> para começar</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredPac.map(p => {
                  const linkAtivo = getLinkAtivo(p.id);
                  return (
                    <div key={p.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl border hover:border-studio/40 hover:bg-studio-light/20 transition-all cursor-pointer"
                      onClick={() => handleSelectPaciente(p)}
                    >
                      <div className="h-9 w-9 rounded-full bg-gradient-studio flex items-center justify-center shrink-0 text-white font-bold text-xs shadow-md">
                        {p.nome[0]}{p.sobrenome?.[0] || ''}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-sm text-foreground">{p.nome} {p.sobrenome}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="text-[10px] text-muted-foreground">{p.email || p.telefone || 'Sem contato'}</p>
                          {linkAtivo && (
                            <Badge variant="outline" className="text-[9px] h-3.5 bg-emerald-50 text-emerald-700 border-emerald-200 gap-0.5">
                              <Link2 className="h-2 w-2" /> {differenceInDays(new Date(linkAtivo.data_expiracao), new Date())}d
                            </Badge>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
