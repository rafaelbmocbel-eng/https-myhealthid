import { useState, useMemo } from 'react';
import { ArrowLeft, Activity, Link2, Copy, MessageCircle, Mail, Plus, Loader2, FileText, Trash2, TrendingUp, Calendar, BarChart3, Edit, CalendarDays, Dumbbell, AlertCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAvaliacoesIdentidade } from '@/hooks/useAvaliacoesSalvas';
import { useLinksAvaliacao } from '@/hooks/useLinksAvaliacao';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { differenceInDays } from 'date-fns';
import { AvaliacaoIdentidade } from '@/types/identidade';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
} from 'recharts';
import { shareAvaliacaoLink, shareAgendaLink } from '@/utils/whatsapp';
import { getAgendaUrl } from '@/utils/linkUrls';
import QuestionariosComparacao from './QuestionariosComparacao';
import EvolucaoDashboard from './EvolucaoDashboard';
import { useEvolucaoPaciente } from '@/hooks/useEvolucaoPaciente';
import PacienteProtocolosTab from './PacienteProtocolosTab';
import IdFinalGauge from '@/components/identidade/IdFinalGauge';
import DashboardParcial from './DashboardParcial';

interface Paciente {
  id: string;
  nome: string;
  sobrenome: string;
  email?: string | null;
  telefone?: string | null;
}

interface Props {
  paciente: Paciente;
  onBack: () => void;
  onIniciarAvaliacao: () => void;
  onVerRelatorio: (avaliacao: AvaliacaoIdentidade) => void;
  onEditarAvaliacao?: (avaliacao: AvaliacaoIdentidade) => void;
}

const SCORE_LABELS: Record<string, string> = {
  score_e: 'Estrutural (E)',
  score_p: 'Kinesiophobia (P)',
  score_c: 'Contexto (C)',
  score_f: 'Funcional (F)',
  score_d: 'Dor (D)',
  score_r: 'Regulação (R)',
  score_efi: 'EFI',
};

const SCORE_COLORS: Record<string, string> = {
  score_e: 'hsl(var(--score-e))',
  score_p: 'hsl(var(--score-p))',
  score_c: 'hsl(var(--score-c))',
  score_f: 'hsl(var(--score-f))',
  score_d: 'hsl(var(--score-d))',
  score_r: 'hsl(var(--score-r))',
  score_efi: 'hsl(var(--score-p))',
};

const SCORE_KEYS = ['score_e', 'score_p', 'score_c', 'score_f', 'score_d', 'score_r', 'score_efi'];

export default function PacienteDashboardIdentidade({ paciente, onBack, onIniciarAvaliacao, onVerRelatorio, onEditarAvaliacao }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { avaliacoes, isLoading, deletar } = useAvaliacoesIdentidade(paciente.id);
  const { links, gerarLink, copiarLink, getLinkUrl, gerando } = useLinksAvaliacao();
  const { evolucoes } = useEvolucaoPaciente(paciente.id);
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [gerandoAgenda, setGerandoAgenda] = useState(false);

  const linkAtivo = links.find(l => l.paciente_id === paciente.id && l.status === 'ativo' && new Date(l.data_expiracao) > new Date());

  // Links de agenda para este paciente
  const { data: linksAgenda = [] } = useQuery({
    queryKey: ['links-agenda-dashboard', user?.id, paciente.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('links_agenda_paciente')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .eq('paciente_id', paciente.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const linkAgendaAtivo = linksAgenda.find((l: any) => l.status === 'ativo' && new Date(l.data_expiracao) > new Date());

  const gerarLinkAgenda = async () => {
    if (!user) return;
    setGerandoAgenda(true);
    try {
      await supabase
        .from('links_agenda_paciente')
        .update({ status: 'cancelado' })
        .eq('paciente_id', paciente.id)
        .eq('terapeuta_id', user.id)
        .eq('status', 'ativo');

      const dataExpiracao = new Date();
      dataExpiracao.setDate(dataExpiracao.getDate() + 90);
      const { error } = await supabase.from('links_agenda_paciente').insert({
        paciente_id: paciente.id,
        terapeuta_id: user.id,
        data_expiracao: dataExpiracao.toISOString(),
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['links-agenda-dashboard'] });
      toast({ title: 'Link de agenda gerado! ✅', description: 'Válido por 90 dias.' });
    } catch (e: any) {
      toast({ title: 'Erro ao gerar link', description: e.message, variant: 'destructive' });
    } finally {
      setGerandoAgenda(false);
    }
  };

  const copiarAgendaLink = (token: string) => {
    navigator.clipboard.writeText(getAgendaUrl(token));
    toast({ title: 'Link de agenda copiado! 📋' });
  };

  // Respostas remotas para este paciente
  const { data: linksAvPaciente = [] } = useQuery({
    queryKey: ['links-av-paciente', user?.id, paciente.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('links_avaliacao')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .eq('paciente_id', paciente.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: respostas = [] } = useQuery({
    queryKey: ['respostas-paciente', paciente.id],
    queryFn: async () => {
      const linkIds = linksAvPaciente.map(l => l.id);
      if (linkIds.length === 0) return [];
      const { data, error } = await supabase
        .from('respostas_avaliacao_paciente')
        .select('*')
        .in('link_id', linkIds)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: linksAvPaciente.length > 0,
  });

  const enviarEmail = async () => {
    if (!paciente.email || !linkAtivo) return;
    setEnviandoEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke('enviar-link-email', {
        body: {
          patientName: `${paciente.nome} ${paciente.sobrenome}`,
          patientEmail: paciente.email,
          linkUrl: getLinkUrl(linkAtivo.token),
          linkType: 'avaliacao',
        },
      });
      if (error) throw error;
      if (data?.error) toast({ title: 'Email não enviado', description: data.error, variant: 'destructive' });
      else toast({ title: '✉️ Email enviado!', description: `Para ${paciente.email}` });
    } catch (e: any) {
      toast({ title: 'Erro ao enviar email', description: e.message, variant: 'destructive' });
    } finally {
      setEnviandoEmail(false);
    }
  };

  // Extrair scores parciais do último questionário respondido
  const scoresParciais = useMemo(() => {
    if (respostas.length === 0) return null;
    // Pegar respostas do link mais recente que tenha dados
    const linkMaisRecente = linksAvPaciente.find(l =>
      respostas.some(r => r.link_id === l.id)
    );
    if (!linkMaisRecente) return null;

    const respostasLink = respostas.filter(r => r.link_id === linkMaisRecente.id);
    const scores: Record<string, number> = {};
    const blocosRecebidos: number[] = [];

    respostasLink.forEach(r => {
      if (!blocosRecebidos.includes(r.bloco_numero)) blocosRecebidos.push(r.bloco_numero);
      const dados = r.dados_respostas as any;
      if (!dados) return;
      // Extract scores from response data
      Object.entries(dados).forEach(([k, v]) => {
        if (k.startsWith('score') && typeof v === 'number') {
          scores[k] = v;
        }
      });
    });

    if (Object.keys(scores).length === 0) return null;

    return {
      scores,
      blocosRecebidos: blocosRecebidos.sort(),
      totalBlocos: blocosRecebidos.length,
      completo: blocosRecebidos.length >= 4,
      linkId: linkMaisRecente.id,
      data: linkMaisRecente.data_ultimo_acesso || linkMaisRecente.created_at,
    };
  }, [respostas, linksAvPaciente]);

  // Dados para gráfico radar (última avaliação)
  const ultimaAvaliacao = avaliacoes[0];
  const radarData = ultimaAvaliacao ? SCORE_KEYS.slice(0, 6).map(key => ({
    score: SCORE_LABELS[key].replace(/\s*\(.*\)/, ''),
    valor: Number(((ultimaAvaliacao as any)[key] || 0).toFixed(1)),
  })) : [];

  const idFinal = (ultimaAvaliacao as any)?.id_final || 0;

  // Determinar se devemos mostrar o dashboard parcial
  const temAvaliacaoCompleta = avaliacoes.length > 0;
  const temQuestionario = scoresParciais !== null;
  const mostrarDashboardParcial = !temAvaliacaoCompleta && temQuestionario;

  return (
    <div className="space-y-6">
      {/* Header com cor bordô Identidade */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-8 w-8 p-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="h-10 w-10 rounded-full bg-identidade flex items-center justify-center shrink-0 text-identidade-foreground font-bold">
          {paciente.nome[0]}{paciente.sobrenome?.[0] || ''}
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-foreground">{paciente.nome} {paciente.sobrenome}</h2>
          <p className="text-sm text-muted-foreground">{paciente.email || paciente.telefone || 'Sem contato'}</p>
        </div>
        <Button onClick={onIniciarAvaliacao} className="bg-identidade hover:bg-identidade/90 text-identidade-foreground gap-2">
          <Activity className="h-4 w-4" /> Nova Avaliação
        </Button>
      </div>

      {/* Links Compactos */}
      <div className="clinical-card !p-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Link Avaliação */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Link2 className="h-4 w-4 text-identidade shrink-0" />
            <span className="text-xs font-semibold shrink-0">Questionário</span>
            {linkAtivo ? (
              <>
                <div className="h-2 w-2 rounded-full bg-success animate-pulse shrink-0" />
                <span className="text-[10px] text-success shrink-0">{differenceInDays(new Date(linkAtivo.data_expiracao), new Date())}d</span>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => copiarLink(linkAtivo.token)}>
                  <Copy className="h-3 w-3" />
                </Button>
                {paciente.telefone && (
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-success"
                    onClick={() => shareAvaliacaoLink(`${paciente.nome} ${paciente.sobrenome}`, paciente.telefone!, getLinkUrl(linkAtivo.token))}>
                    <MessageCircle className="h-3 w-3" />
                  </Button>
                )}
                {paciente.email && (
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-identidade" onClick={enviarEmail} disabled={enviandoEmail}>
                    {enviandoEmail ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                  </Button>
                )}
              </>
            ) : (
              <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 text-identidade" disabled={gerando}
                onClick={async () => { const novo = await gerarLink(paciente.id); if (novo) copiarLink(novo.token); }}>
                {gerando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                Gerar
              </Button>
            )}
          </div>

          <div className="h-6 w-px bg-border shrink-0" />

          {/* Link Agenda */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <CalendarDays className="h-4 w-4 text-accent shrink-0" />
            <span className="text-xs font-semibold shrink-0">Agenda</span>
            {linkAgendaAtivo ? (
              <>
                <div className="h-2 w-2 rounded-full bg-success animate-pulse shrink-0" />
                <span className="text-[10px] text-success shrink-0">{differenceInDays(new Date(linkAgendaAtivo.data_expiracao), new Date())}d</span>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => copiarAgendaLink(linkAgendaAtivo.token)}>
                  <Copy className="h-3 w-3" />
                </Button>
                {paciente.telefone && (
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-success"
                    onClick={() => shareAgendaLink(`${paciente.nome} ${paciente.sobrenome}`, paciente.telefone!, getAgendaUrl(linkAgendaAtivo.token))}>
                    <MessageCircle className="h-3 w-3" />
                  </Button>
                )}
              </>
            ) : (
              <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 text-accent" disabled={gerandoAgenda}
                onClick={gerarLinkAgenda}>
                {gerandoAgenda ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                Gerar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Dashboard Parcial — quando há questionário mas sem avaliação completa */}
      {mostrarDashboardParcial && scoresParciais && (
        <DashboardParcial
          scoresParciais={scoresParciais}
          onIniciarAvaliacao={onIniciarAvaliacao}
        />
      )}

      {/* Tabs */}
      <Tabs defaultValue="avaliacoes">
        <TabsList className="bg-secondary p-1 rounded-xl">
          <TabsTrigger value="avaliacoes" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <BarChart3 className="h-4 w-4" /> Avaliações {avaliacoes.length > 0 && `(${avaliacoes.length})`}
          </TabsTrigger>
          <TabsTrigger value="respostas" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <FileText className="h-4 w-4" /> Questionários {respostas.length > 0 && `(${respostas.length})`}
          </TabsTrigger>
          {avaliacoes.length >= 2 && (
            <TabsTrigger value="evolucao" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <TrendingUp className="h-4 w-4" /> Evolução
            </TabsTrigger>
          )}
          <TabsTrigger value="protocolos" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Dumbbell className="h-4 w-4" /> Protocolos
          </TabsTrigger>
        </TabsList>

        {/* Aba: Avaliações Salvas */}
        <TabsContent value="avaliacoes" className="mt-4">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-identidade" /></div>
          ) : avaliacoes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border rounded-xl border-dashed">
              <Activity className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhuma avaliação salva</p>
              <p className="text-sm mt-1">
                {temQuestionario
                  ? 'O paciente já respondeu o questionário. Complete a avaliação estrutural para gerar o ID Final.'
                  : 'Realize e salve uma avaliação para visualizar o histórico.'
                }
              </p>
              <Button className="mt-4 bg-identidade text-identidade-foreground" onClick={onIniciarAvaliacao}>
                {temQuestionario ? 'Completar Avaliação Estrutural' : 'Iniciar Avaliação'}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Gauge + Radar lado a lado */}
              {radarData.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Gauge do ID Final com explicação */}
                  <div className="clinical-card flex flex-col items-center">
                    <div className="flex items-center gap-2 mb-4 w-full">
                      <div className="h-6 w-6 rounded-md bg-identidade/10 flex items-center justify-center">
                        <Activity className="h-3.5 w-3.5 text-identidade" />
                      </div>
                      <h4 className="font-semibold text-sm">Equação da Dor — ID Final</h4>
                      <Badge variant="outline" className="ml-auto text-[10px] border-identidade/30 text-identidade">{ultimaAvaliacao?.data_avaliacao}</Badge>
                    </div>
                    <IdFinalGauge value={idFinal} />
                  </div>

                  {/* Radar + Score cards */}
                  <div className="clinical-card">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-6 w-6 rounded-md bg-identidade/10 flex items-center justify-center">
                        <BarChart3 className="h-3.5 w-3.5 text-identidade" />
                      </div>
                      <h4 className="font-semibold text-sm">Perfil Multidimensional</h4>
                      {(ultimaAvaliacao as any)?.classificacao && (
                        <Badge variant="outline" className="ml-auto text-xs">{(ultimaAvaliacao as any).classificacao}</Badge>
                      )}
                    </div>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={radarData}>
                          <PolarGrid className="stroke-border" />
                          <PolarAngleAxis dataKey="score" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                          <Radar name="Score" dataKey="valor" stroke="hsl(var(--identidade))" fill="hsl(var(--identidade))" fillOpacity={0.2} strokeWidth={2} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {/* Barras comparativas por dimensão */}
              {ultimaAvaliacao && (
                <div className="clinical-card">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-6 w-6 rounded-md bg-identidade/10 flex items-center justify-center">
                      <BarChart3 className="h-3.5 w-3.5 text-identidade" />
                    </div>
                    <h4 className="font-semibold text-sm">Scores por Dimensão</h4>
                  </div>
                  <div className="space-y-3">
                    {SCORE_KEYS.map(key => {
                      const val = Number(((ultimaAvaliacao as any)[key] || 0).toFixed(1));
                      const maxVal = 10;
                      const pct = Math.min((val / maxVal) * 100, 100);
                      return (
                        <div key={key} className="flex items-center gap-3">
                          <div className="w-28 text-xs font-medium text-muted-foreground shrink-0 flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: SCORE_COLORS[key] }} />
                            {SCORE_LABELS[key]}
                          </div>
                          <div className="flex-1 h-4 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, backgroundColor: SCORE_COLORS[key] }}
                            />
                          </div>
                          <span className="text-sm font-bold w-10 text-right text-foreground">{val}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Lista de avaliações */}
              <div className="space-y-2">
                {avaliacoes.map((av: any) => (
                  <div key={av.id} className="border rounded-xl p-3 flex items-center gap-3 hover:bg-identidade-light/50 transition-all">
                    <Calendar className="h-4 w-4 text-identidade-muted shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{av.data_avaliacao}</span>
                        {av.classificacao && <Badge variant="outline" className="text-[10px] h-4">{av.classificacao}</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        ID: {av.id_final?.toFixed(1)}/50 · E:{av.score_e?.toFixed(1)} P:{av.score_p?.toFixed(1)} D:{av.score_d?.toFixed(1)} F:{av.score_f?.toFixed(1)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                        onClick={() => onVerRelatorio(av.dados_avaliacao as AvaliacaoIdentidade)}>
                        <FileText className="h-3 w-3" /> Ver
                      </Button>
                      {onEditarAvaliacao && (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                          onClick={() => onEditarAvaliacao(av.dados_avaliacao as AvaliacaoIdentidade)}>
                          <Edit className="h-3 w-3" /> Editar
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => deletar(av.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Aba: Questionários Remotos */}
        <TabsContent value="respostas" className="mt-4">
          <QuestionariosComparacao linksAvPaciente={linksAvPaciente} respostas={respostas} />
        </TabsContent>

        {/* Aba: Evolução */}
        {evolucoes.length >= 2 && (
          <TabsContent value="evolucao" className="mt-4">
            <EvolucaoDashboard evolucoes={evolucoes} />
          </TabsContent>
        )}

        {/* Aba: Protocolos */}
        <TabsContent value="protocolos" className="mt-4">
          <PacienteProtocolosTab
            pacienteId={paciente.id}
            pacienteNome={`${paciente.nome} ${paciente.sobrenome}`}
            tipo="identidade"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
