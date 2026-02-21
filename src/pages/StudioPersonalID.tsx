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
  Dumbbell, Clock, FileText, Plus, Link2, Copy,
  Activity, AlignCenter, MessageCircle, ExternalLink,
  ArrowLeft, Brain, Bed, Shield, Gauge,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { differenceInDays, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { shareAvaliacaoLink, shareAgendaLink } from '@/utils/whatsapp';

export default function StudioPersonalID() {
  const { user, loading: authLoading } = useAuth();
  // Show ALL patients — Studio is cross-service
  const { allPacientes: pacientes, isLoading: loadingPacientes } = usePacientes();
  const { links, gerarLink, copiarLink, getLinkUrl, gerando } = useLinksAvaliacao();
  const [searchParams] = useSearchParams();
  const [selectedPacienteId, setSelectedPacienteId] = useState<string | null>(searchParams.get('paciente'));
  const [showDashboard, setShowDashboard] = useState(!!searchParams.get('paciente'));
  const [searchPac, setSearchPac] = useState('');

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

  // Dashboard do paciente selecionado
  if (selectedPacienteId && showDashboard && selectedPaciente) {
    return (
      <AppLayout>
        <StudioPacienteDashboard
          paciente={selectedPaciente}
          userId={user!.id}
          links={links}
          gerarLink={gerarLink}
          copiarLink={copiarLink}
          getLinkUrl={getLinkUrl}
          gerando={gerando}
          onBack={() => { setSelectedPacienteId(null); setShowDashboard(false); }}
        />
      </AppLayout>
    );
  }

  // Patient selection screen
  return (
    <AppLayout>
      <div className="container py-8 max-w-3xl">
        {/* Module Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="h-12 w-12 rounded-2xl bg-gradient-studio flex items-center justify-center shadow-lg">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground">Studio Personal ID</h1>
            <p className="text-muted-foreground text-sm">Treinamento Personalizado Integrado à Saúde</p>
          </div>
        </div>

        {/* Feature highlights */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { icon: Target, label: 'Objetivos', desc: 'Metas individuais' },
            { icon: Dumbbell, label: 'Exercícios', desc: 'Biblioteca completa' },
            { icon: FileText, label: 'Relatórios', desc: 'Evolução detalhada' },
          ].map(feat => {
            const Icon = feat.icon;
            return (
              <Card key={feat.label} className="border-studio/20 hover:border-studio/40 transition-all">
                <CardContent className="pt-4 pb-3 text-center">
                  <div className="h-10 w-10 rounded-xl bg-studio-light mx-auto mb-2 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-studio" />
                  </div>
                  <div className="font-semibold text-sm text-foreground">{feat.label}</div>
                  <div className="text-[10px] text-muted-foreground">{feat.desc}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Patient list */}
        <div className="clinical-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                Todos os Pacientes
              </h3>
            </div>
            <Badge variant="outline" className="text-xs">{pacientes.length} pacientes</Badge>
          </div>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar paciente..."
              className="pl-9"
              value={searchPac}
              onChange={e => setSearchPac(e.target.value)}
            />
          </div>

          {loadingPacientes ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-studio" />
            </div>
          ) : filteredPac.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Sparkles className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="font-medium">Nenhum paciente cadastrado</p>
              <p className="text-sm mt-1">
                Cadastre pacientes em <strong>Pacientes</strong> para começar.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPac.map(p => {
                const servicos = p.servicos || [];
                const linkAtivo = getLinkAtivo(p.id);
                const diasRestantes = linkAtivo ? differenceInDays(new Date(linkAtivo.data_expiracao), new Date()) : 0;
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 p-3 rounded-xl border hover:border-studio/40 hover:bg-studio-light/30 transition-all cursor-pointer"
                    onClick={() => handleSelectPaciente(p)}
                  >
                    <div className="h-10 w-10 rounded-full bg-gradient-studio flex items-center justify-center shrink-0 text-white font-bold text-sm shadow-md">
                      {p.nome[0]}{p.sobrenome?.[0] || ''}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">{p.nome} {p.sobrenome}</span>
                        {linkAtivo && (
                          <Badge variant="outline" className="text-[10px] h-4 bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                            <Link2 className="h-2.5 w-2.5" /> {diasRestantes}d
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-xs text-muted-foreground">{p.email || p.telefone || 'Sem contato'}</p>
                        {servicos.length > 0 && (
                          <div className="flex gap-1">
                            {servicos.includes('metodo_identidade') && (
                              <Badge variant="outline" className="text-[9px] h-3.5 px-1 bg-primary/5 text-primary border-primary/20">ID</Badge>
                            )}
                            {servicos.includes('cob_zero') && (
                              <Badge variant="outline" className="text-[9px] h-3.5 px-1 bg-blue-50 text-blue-600 border-blue-200">COB</Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={async () => {
                          if (linkAtivo) copiarLink(linkAtivo.token);
                          else { const novo = await gerarLink(p.id); if (novo) copiarLink(novo.token); }
                        }}
                        disabled={gerando}
                        title="Link Questionário"
                      >
                        {gerando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 text-xs bg-gradient-studio text-white gap-1 hover:opacity-90 shadow-md"
                        onClick={() => handleSelectPaciente(p)}
                      >
                        Abrir <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

// ─── Patient Dashboard with cross-service data ───────────────────────────
interface StudioDashboardProps {
  paciente: any;
  userId: string;
  links: any[];
  gerarLink: (pid: string) => Promise<any>;
  copiarLink: (token: string) => void;
  getLinkUrl: (token: string) => string;
  gerando: boolean;
  onBack: () => void;
}

function StudioPacienteDashboard({ paciente, userId, links, gerarLink, copiarLink, getLinkUrl, gerando, onBack }: StudioDashboardProps) {
  // Fetch Identidade assessments
  const { data: avaliacoesIdentidade = [] } = useQuery({
    queryKey: ['studio-av-identidade', paciente.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('avaliacoes_identidade')
        .select('id, paciente_nome, data_avaliacao, id_final, classificacao, score_e, score_p, score_c, score_f, score_d, score_r, score_efi, created_at')
        .eq('paciente_id', paciente.id)
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  // Fetch COB ZERO assessments
  const { data: avaliacoesCobZero = [] } = useQuery({
    queryKey: ['studio-av-cobzero', paciente.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('avaliacoes_cob_zero')
        .select('id, paciente_nome, data_avaliacao, cobb_angle, lenke_type, risco_level, risco_percentage, score_e, created_at')
        .eq('paciente_id', paciente.id)
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  // Fetch agenda links
  const { data: linksAgenda = [] } = useQuery({
    queryKey: ['studio-links-agenda', paciente.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('links_agenda_paciente')
        .select('*')
        .eq('paciente_id', paciente.id)
        .eq('status', 'ativo')
        .order('created_at', { ascending: false })
        .limit(1);
      return data || [];
    },
  });

  // Fetch upcoming appointments
  const { data: proximosAgendamentos = [] } = useQuery({
    queryKey: ['studio-agenda', paciente.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('agendamentos')
        .select('*')
        .eq('paciente_id', paciente.id)
        .gte('data_inicio', new Date().toISOString())
        .order('data_inicio')
        .limit(3);
      return data || [];
    },
  });

  const linkAtivo = links.find(l => l.paciente_id === paciente.id && l.status === 'ativo' && new Date(l.data_expiracao) > new Date());
  const linkAgendaAtivo = linksAgenda[0];
  const ultimaIdentidade = avaliacoesIdentidade[0];
  const ultimaCob = avaliacoesCobZero[0];

  const SCORE_COLORS: Record<string, string> = {
    E: 'bg-score-e/10 text-score-e border-score-e/20',
    P: 'bg-score-p/10 text-score-p border-score-p/20',
    C: 'bg-score-c/10 text-score-c border-score-c/20',
    F: 'bg-score-f/10 text-score-f border-score-f/20',
    D: 'bg-score-d/10 text-score-d border-score-d/20',
    R: 'bg-score-r/10 text-score-r border-score-r/20',
  };

  return (
    <div className="container py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="h-14 w-14 rounded-2xl bg-gradient-studio flex items-center justify-center shadow-lg shrink-0">
          <Sparkles className="h-7 w-7 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-black text-foreground truncate">
            {paciente.nome} {paciente.sobrenome}
          </h1>
          <p className="text-muted-foreground text-sm">Studio Personal ID — Visão Integrada</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/pacientes/${paciente.id}`}>
              <ExternalLink className="h-3.5 w-3.5 mr-1" /> Perfil
            </Link>
          </Button>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {/* Link Questionário */}
        <Card className="border-studio/20 hover:border-studio/40 transition-all cursor-pointer group"
          onClick={async () => {
            if (linkAtivo) copiarLink(linkAtivo.token);
            else { const novo = await gerarLink(paciente.id); if (novo) copiarLink(novo.token); }
          }}
        >
          <CardContent className="pt-4 pb-3 text-center">
            <Link2 className="h-5 w-5 mx-auto mb-1.5 text-studio" />
            <div className="text-xs font-semibold text-foreground">Questionário</div>
            <div className="text-[10px] text-muted-foreground">
              {linkAtivo ? 'Copiar link' : 'Gerar link'}
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp Questionário */}
        {linkAtivo && (
          <Card className="border-emerald-200 hover:border-emerald-400 transition-all cursor-pointer"
            onClick={() => shareAvaliacaoLink(getLinkUrl(linkAtivo.token), paciente.nome, paciente.telefone)}
          >
            <CardContent className="pt-4 pb-3 text-center">
              <MessageCircle className="h-5 w-5 mx-auto mb-1.5 text-emerald-600" />
              <div className="text-xs font-semibold text-foreground">WhatsApp</div>
              <div className="text-[10px] text-muted-foreground">Enviar questionário</div>
            </CardContent>
          </Card>
        )}

        {/* Avaliação Identidade */}
        <Card className="border-primary/20 hover:border-primary/40 transition-all cursor-pointer" onClick={() => window.location.href = `/metodo-identidade?paciente=${paciente.id}`}>
          <CardContent className="pt-4 pb-3 text-center">
            <Activity className="h-5 w-5 mx-auto mb-1.5 text-primary" />
            <div className="text-xs font-semibold text-foreground">Identidade</div>
            <div className="text-[10px] text-muted-foreground">Avaliar</div>
          </CardContent>
        </Card>

        {/* COB ZERO */}
        <Card className="border-blue-200 hover:border-blue-400 transition-all cursor-pointer" onClick={() => window.location.href = `/cob-zero?paciente=${paciente.id}`}>
          <CardContent className="pt-4 pb-3 text-center">
            <AlignCenter className="h-5 w-5 mx-auto mb-1.5 text-blue-600" />
            <div className="text-xs font-semibold text-foreground">COB° ZERO</div>
            <div className="text-[10px] text-muted-foreground">Protocolo</div>
          </CardContent>
        </Card>
      </div>

      {/* Cross-service assessments */}
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        {/* Última Avaliação Identidade */}
        <Card className={cn('border-2 transition-all', ultimaIdentidade ? 'border-primary/20' : 'border-border')}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-identidade flex items-center justify-center shrink-0">
                <Activity className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-foreground">Método Identidade</h3>
                <p className="text-[10px] text-muted-foreground">
                  {ultimaIdentidade
                    ? `Última: ${ultimaIdentidade.data_avaliacao}`
                    : 'Sem avaliação'}
                </p>
              </div>
              {ultimaIdentidade?.classificacao && (
                <Badge className={cn('ml-auto text-[10px]',
                  ultimaIdentidade.classificacao === 'LEVE' ? 'bg-emerald-100 text-emerald-700' :
                  ultimaIdentidade.classificacao === 'MODERADO' ? 'bg-amber-100 text-amber-700' :
                  ultimaIdentidade.classificacao === 'SEVERO' ? 'bg-orange-100 text-orange-700' :
                  ultimaIdentidade.classificacao === 'CRÍTICO' ? 'bg-red-100 text-red-700' :
                  'bg-purple-100 text-purple-700'
                )}>
                  {ultimaIdentidade.classificacao}
                </Badge>
              )}
            </div>

            {ultimaIdentidade ? (
              <>
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-sm text-muted-foreground">ID Final</span>
                  <span className="text-2xl font-black text-foreground">
                    {Number(ultimaIdentidade.id_final || 0).toFixed(1)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { k: 'E', v: ultimaIdentidade.score_e },
                    { k: 'P', v: ultimaIdentidade.score_p },
                    { k: 'C', v: ultimaIdentidade.score_c },
                    { k: 'F', v: ultimaIdentidade.score_f },
                    { k: 'D', v: ultimaIdentidade.score_d },
                    { k: 'R', v: ultimaIdentidade.score_r },
                  ].map(s => (
                    <Badge key={s.k} variant="outline" className={cn('text-[10px] font-bold', SCORE_COLORS[s.k])}>
                      {s.k}: {Number(s.v || 0).toFixed(1)}
                    </Badge>
                  ))}
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  {avaliacoesIdentidade.length} avaliação(ões) no total
                </div>
              </>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <p className="text-sm">Nenhuma avaliação Identidade registrada</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => window.location.href = `/metodo-identidade?paciente=${paciente.id}`}>
                  <Activity className="h-3.5 w-3.5 mr-1" /> Iniciar Avaliação
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Última Avaliação COB ZERO */}
        <Card className={cn('border-2 transition-all', ultimaCob ? 'border-blue-200' : 'border-border')}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shrink-0">
                <AlignCenter className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-foreground">COB° ZERO</h3>
                <p className="text-[10px] text-muted-foreground">
                  {ultimaCob
                    ? `Última: ${ultimaCob.data_avaliacao}`
                    : 'Sem avaliação'}
                </p>
              </div>
              {ultimaCob?.risco_level && (
                <Badge className={cn('ml-auto text-[10px]',
                  ultimaCob.risco_level === 'BAIXO' ? 'bg-emerald-100 text-emerald-700' :
                  ultimaCob.risco_level === 'MODERADO' ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                )}>
                  {ultimaCob.risco_level}
                </Badge>
              )}
            </div>

            {ultimaCob ? (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Ângulo Cobb</span>
                    <span className="font-bold text-foreground">{ultimaCob.cobb_angle}°</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Tipo Lenke</span>
                    <span className="font-bold text-foreground">{ultimaCob.lenke_type || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Risco Progressão</span>
                    <span className="font-bold text-foreground">{ultimaCob.risco_percentage ? `${Number(ultimaCob.risco_percentage).toFixed(0)}%` : '—'}</span>
                  </div>
                  {ultimaCob.score_e != null && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Score E</span>
                      <Badge variant="outline" className={cn('text-[10px] font-bold', SCORE_COLORS['E'])}>
                        {Number(ultimaCob.score_e).toFixed(1)}
                      </Badge>
                    </div>
                  )}
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  {avaliacoesCobZero.length} avaliação(ões) no total
                </div>
              </>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <p className="text-sm">Nenhuma avaliação COB° ZERO registrada</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => window.location.href = `/cob-zero?paciente=${paciente.id}`}>
                  <AlignCenter className="h-3.5 w-3.5 mr-1" /> Iniciar Protocolo
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Próximos Agendamentos */}
      {proximosAgendamentos.length > 0 && (
        <Card className="mb-8">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="h-4 w-4 text-studio" />
              <h3 className="font-bold text-sm text-foreground">Próximos Agendamentos</h3>
            </div>
            <div className="space-y-2">
              {proximosAgendamentos.map((ag: any) => (
                <div key={ag.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                  <div className="h-8 w-8 rounded-lg bg-gradient-studio flex items-center justify-center shrink-0">
                    <Clock className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      {format(parseISO(ag.data_inicio), "dd/MM · HH:mm", { locale: ptBR })}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{ag.tipo_atendimento || 'Sessão'}</div>
                  </div>
                  <Badge variant="outline" className={cn('ml-auto text-[10px]',
                    ag.status === 'confirmado' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    ag.status === 'pendente' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    'bg-muted text-muted-foreground'
                  )}>
                    {ag.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="border-2 border-studio/20 hover:border-studio/40 transition-all cursor-pointer group">
          <CardContent className="pt-6 pb-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-studio flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
              <Plus className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">Nova Sessão</h3>
              <p className="text-xs text-muted-foreground">Registrar treino personalizado</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto group-hover:text-studio transition-colors" />
          </CardContent>
        </Card>

        <Card className="border-2 border-studio/20 hover:border-studio/40 transition-all cursor-pointer group">
          <CardContent className="pt-6 pb-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-studio flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">Relatórios</h3>
              <p className="text-xs text-muted-foreground">Evolução e métricas integradas</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto group-hover:text-studio transition-colors" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
