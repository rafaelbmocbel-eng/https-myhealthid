import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLinksAvaliacao } from '@/hooks/useLinksAvaliacao';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Link2, MessageCircle, Loader2, Copy, FileText, Calendar, Activity,
  Moon, Zap, Brain, Shield, Sparkles, Target, CheckCircle2, AlertTriangle, Heart, ChevronRight, BarChart3, Presentation, Fingerprint, Dumbbell, Plus
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import QuestionariosComparacao from '../paciente/QuestionariosComparacao';
import IndicesRiscoComprometimento from '../paciente/IndicesRiscoComprometimento';
import { useAvaliacoesIdentidade } from '@/hooks/useAvaliacoesSalvas';
import RelatorioIdentidade from '../identidade/RelatorioIdentidade';
import { AvaliacaoMyID } from '@/types/myid';
import { getSeverityColorHex } from '@/utils/calculations';
import { shareAvaliacaoLink, shareAgendaLink } from '@/utils/whatsapp';
import { getAgendaUrl } from '@/utils/linkUrls';
import PatientIntegratedDashboard from '../paciente/PatientIntegratedDashboard';
import StudioMedidasForm from './StudioMedidasForm';
import { useStudioMedidas } from '@/hooks/useStudioData';

interface Props {
  pacienteId: string;
  pacienteNome: string;
  pacienteTelefone?: string;
}

export default function StudioAvaliacaoTab({ pacienteId, pacienteNome, pacienteTelefone }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [gerandoAgenda, setGerandoAgenda] = useState(false);
  const { links, gerarLink, copiarLink, getLinkUrl, gerando } = useLinksAvaliacao();
  const { avaliacoes, isLoading: loadingAvaliacoes } = useAvaliacoesIdentidade(pacienteId);
  const [selectedAvaliacao, setSelectedAvaliacao] = useState<AvaliacaoMyID | null>(null);
  const [iniciandoMedidas, setIniciandoMedidas] = useState(false);
  const { salvarMedida } = useStudioMedidas(pacienteId);
  const salvandoMedida = salvarMedida.isPending;

  const { data: linksAgenda = [] } = useQuery({
    queryKey: ['links_agenda_paciente', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('links_agenda_paciente')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const linkAgendaAtivo = linksAgenda.find((l: any) => l.paciente_id === pacienteId && l.status === 'ativo' && new Date(l.data_expiracao) > new Date());

  const gerarLinkAgenda = async () => {
    if (!user) return;
    setGerandoAgenda(true);
    try {
      await supabase
        .from('links_agenda_paciente')
        .update({ status: 'cancelado' } as any)
        .eq('paciente_id', pacienteId)
        .eq('terapeuta_id', user.id)
        .eq('status', 'ativo');

      const { data, error } = await supabase
        .from('links_agenda_paciente')
        .insert({ paciente_id: pacienteId, terapeuta_id: user.id } as any)
        .select()
        .single();

      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['links_agenda_paciente'] });
      toast({ title: 'Link de agenda gerado! ✅', description: 'Válido por 90 dias.' });
      return data;
    } catch (e: any) {
      toast({ title: 'Erro ao gerar link', description: e.message, variant: 'destructive' });
    } finally {
      setGerandoAgenda(false);
    }
  };

  const copiarLinkAgenda = (token: string) => {
    navigator.clipboard.writeText(getAgendaUrl(token));
    toast({ title: 'Link de agenda copiado! 📋' });
  };

  const linkAtivo = links.find(l => l.paciente_id === pacienteId && l.status === 'ativo' && new Date(l.data_expiracao) > new Date());
  const ultimaAvaliacao = avaliacoes?.[0];

  // Fetch questionnaire responses for the remote tab
  const { data: linksAvPaciente = [] } = useQuery({
    queryKey: ['links-av-paciente-studio', user?.id, pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('links_avaliacao')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: respostas = [] } = useQuery({
    queryKey: ['respostas-paciente-studio', pacienteId],
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

  return (
    <div className="space-y-4 pb-10">
      <Tabs defaultValue="integrada">
        <TabsList className="bg-studio/10 p-1 rounded-xl flex-wrap h-auto min-h-11">
          <TabsTrigger value="integrada" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-studio">
            <Fingerprint className="h-4 w-4" /> Visão Integrada
          </TabsTrigger>
          <TabsTrigger value="remota" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-studio">
            <FileText className="h-4 w-4" /> Avaliação Remota & Agenda
          </TabsTrigger>
          <TabsTrigger value="presencial" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-studio">
            <Presentation className="h-4 w-4" /> Avaliação Presencial
          </TabsTrigger>
          <TabsTrigger value="protocolos" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-studio">
            <Dumbbell className="h-4 w-4" /> Diretrizes e Serviços
          </TabsTrigger>
        </TabsList>

        {/* Tab: Visão Integrada */}
        <TabsContent value="integrada" className="space-y-4 mt-4">
          <PatientIntegratedDashboard pacienteId={pacienteId} serviceType="studio" />
        </TabsContent>

        {/* Tab: Avaliação Remota & Agenda */}
        <TabsContent value="remota" className="space-y-4 mt-4">
          <Card className="border-studio/20 shadow-sm">
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-2 mb-2">
                <Link2 className="h-3.5 w-3.5 text-studio" />
                <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Gestão de Acessos</h4>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-medium text-muted-foreground w-20 shrink-0 uppercase tracking-tighter">Questionário</span>
                  <Button size="sm" variant="outline" className="h-6 gap-1 text-[10px] px-2" disabled={gerando}
                    onClick={async () => {
                      if (linkAtivo) copiarLink(linkAtivo.token);
                      else { const novo = await gerarLink(pacienteId); if (novo) copiarLink(novo.token); }
                    }}>
                    {gerando ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Copy className="h-2.5 w-2.5" />}
                    {linkAtivo ? 'Copiar' : 'Gerar Novo'}
                  </Button>
                  {linkAtivo && (
                    <>
                      <Button size="sm" variant="outline" className="h-6 gap-1 text-[10px] px-2"
                        onClick={() => shareAvaliacaoLink(getLinkUrl(linkAtivo.token), pacienteNome, pacienteTelefone)}>
                        <MessageCircle className="h-2.5 w-2.5 text-emerald-500" /> WhatsApp
                      </Button>
                      <Badge variant="outline" className="text-[9px] h-5 px-1.5 font-bold">{differenceInDays(new Date(linkAtivo.data_expiracao), new Date())}d restantes</Badge>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-medium text-muted-foreground w-20 shrink-0 uppercase tracking-tighter">Agendamento</span>
                  <Button size="sm" variant="outline" className="h-6 gap-1 text-[10px] px-2" disabled={gerandoAgenda}
                    onClick={async () => {
                      if (linkAgendaAtivo) copiarLinkAgenda(linkAgendaAtivo.token);
                      else { const novo = await gerarLinkAgenda(); if (novo) copiarLinkAgenda(novo.token); }
                    }}>
                    {gerandoAgenda ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Copy className="h-2.5 w-2.5" />}
                    {linkAgendaAtivo ? 'Copiar' : 'Gerar Novo'}
                  </Button>
                  {linkAgendaAtivo && (
                    <>
                      <Button size="sm" variant="outline" className="h-6 gap-1 text-[10px] px-2"
                        onClick={() => shareAgendaLink(pacienteNome, pacienteTelefone || '', getAgendaUrl(linkAgendaAtivo.token))}>
                        <MessageCircle className="h-2.5 w-2.5 text-emerald-500" /> WhatsApp
                      </Button>
                      <Badge variant="outline" className="text-[9px] h-5 px-1.5 font-bold">{differenceInDays(new Date(linkAgendaAtivo.data_expiracao), new Date())}d restantes</Badge>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Comparação dos questionários remotos do paciente */}
          <QuestionariosComparacao linksAvPaciente={linksAvPaciente} respostas={respostas} />
        </TabsContent>

        {/* Tab: Avaliação Presencial */}
        <TabsContent value="presencial" className="space-y-4 mt-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="font-black text-sm text-foreground tracking-tight uppercase">Avaliação em Consultório</h3>
            {!iniciandoMedidas && (
              <Button
                size="sm"
                className="h-8 bg-gradient-studio text-white gap-2 font-bold px-4"
                onClick={() => setIniciandoMedidas(true)}
              >
                <Plus className="h-4 w-4" /> Nova Medição
              </Button>
            )}
          </div>

          {iniciandoMedidas && (
            <StudioMedidasForm
              pacienteId={pacienteId}
              isPending={salvandoMedida}
              onCancel={() => setIniciandoMedidas(false)}
              onSave={async (data) => {
                await salvarMedida.mutateAsync(data);
                setIniciandoMedidas(false);
                qc.invalidateQueries({ queryKey: ['studio-medidas', pacienteId] });
              }}
            />
          )}

          {/* Seção Clinica Premium: Bio-Individualidade Elite */}
          {ultimaAvaliacao && (
            <div className="space-y-4">
              <Card className="border-studio/20 bg-gradient-to-br from-studio/5 via-background to-studio/5 overflow-hidden shadow-xl relative backdrop-blur-sm">
                <div className="h-1.5 bg-gradient-studio w-full" />
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                  <Sparkles className="h-24 w-24 text-studio" />
                </div>

                <CardContent className="pt-6 relative">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-studio/10 flex items-center justify-center border border-studio/20 shadow-inner">
                        <Sparkles className="h-5 w-5 text-studio" />
                      </div>
                      <div>
                        <h4 className="font-black text-lg text-studio-dark tracking-tighter uppercase italic leading-none">Bio-Individualidade Elite</h4>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Algoritmo de Performance Humana</p>
                      </div>
                    </div>
                    <Badge className="bg-gradient-studio text-white text-[10px] border-none shadow-lg px-3 py-1 animate-pulse font-black tracking-widest">CONDUCTA PREMIUM</Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="p-4 rounded-2xl bg-white/40 dark:bg-black/20 border border-white/60 dark:border-white/10 shadow-sm backdrop-blur-md transition-all hover:shadow-md">
                        <div className="text-[10px] uppercase font-black text-muted-foreground mb-2 tracking-widest flex items-center gap-2">
                          <Shield className="h-3 w-3 text-studio" /> Terreno Biológico
                        </div>
                        <div className="text-lg font-black text-foreground tracking-tight">
                          {(ultimaAvaliacao.score_r || 0) > 7 ? 'Perfil de Exaustão (Simpaticotônico)' :
                            (ultimaAvaliacao.score_r || 0) > 4 ? 'Perfil Reativo (Alerta Laranja)' : 'Perfil Resiliente (Equilibrado)'}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed font-semibold">
                          Análise de regulação neurovegetativa (R: {ultimaAvaliacao.score_r?.toFixed(1)}) e carga biográfica (F: {ultimaAvaliacao.score_f?.toFixed(1)}).
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl bg-studio/5 border border-studio/10 shadow-sm transition-all hover:bg-studio/10">
                        <div className="text-[10px] uppercase font-black text-studio mb-2 tracking-widest flex items-center gap-2">
                          <Activity className="h-3 w-3" /> Capacidade de Carga (Performance)
                        </div>
                        <div className="flex items-end gap-3">
                          <div className="text-3xl font-black text-studio tracking-tighter leading-none">
                            {Math.max(10 - (ultimaAvaliacao.score_r || 0), 2).toFixed(1)}
                            <span className="text-sm font-normal text-muted-foreground/60 ml-1">/ 10</span>
                          </div>
                          <Badge className="text-[10px] mb-1 font-black h-5 px-2 bg-studio/20 text-studio-dark border-none">
                            {(ultimaAvaliacao.score_r || 0) > 7 ? 'BAIXA PRONTIDÃO' : (ultimaAvaliacao.score_r || 0) > 4 ? 'MODERADA' : 'ALTA PERFORMANCE'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="relative group">
                      <div className="absolute -inset-0.5 bg-gradient-studio rounded-2xl blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
                      <Card className="relative border-none shadow-none bg-white/60 dark:bg-black/40 backdrop-blur-lg overflow-hidden h-full">
                        <CardContent className="p-5 space-y-4">
                          <h5 className="text-[11px] font-black flex items-center gap-2 uppercase text-studio tracking-[0.2em]">
                            <Target className="h-4 w-4" /> Plano de Conduta Estratégica
                          </h5>
                          <ul className="space-y-3">
                            {[
                              (ultimaAvaliacao.score_r || 0) > 6 ? 'Priorizar Sessão Regenerativa: Mobilidade Fluida & Vagal' : 'Foco em Sessão High Intensity: Força & Potência Máxima',
                              (ultimaAvaliacao.score_f || 0) > 5 ? 'Ajustar densidade do treino: Carga psicobiológica alta' : 'Permitida progressão de volume agressiva (Overload)',
                              (ultimaAvaliacao.score_r || 0) > 4 ? 'Monitorar prontidão neural: Evitar falha concêntrica' : 'Estímulos de refinamento técnico e recordes pessoais',
                            ].map((item, i) => (
                              <li key={i} className="text-[11px] flex items-start gap-2.5 leading-tight font-bold text-foreground/90 group/item">
                                <div className="h-4 w-4 rounded-full bg-studio/10 flex items-center justify-center shrink-0 mt-0.5 group-hover/item:bg-studio/20 transition-colors">
                                  <CheckCircle2 className="h-2.5 w-2.5 text-studio" />
                                </div>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Seção Estratégia Biopsicossocial */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-studio/10 shadow-lg bg-gradient-to-br from-card to-studio/5 overflow-hidden">
                  <CardContent className="pt-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-8 w-8 rounded-lg bg-studio/10 flex items-center justify-center">
                        <Target className="h-4 w-4 text-studio" />
                      </div>
                      <h4 className="font-black text-sm tracking-tighter text-foreground uppercase">Estratégia Biopsicossocial</h4>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between items-end mb-1 px-1">
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Carga Contextual (Score C)</span>
                          <span className="text-xs font-black text-studio">{(ultimaAvaliacao.score_c || 0).toFixed(1)}/10</span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-studio rounded-full transition-all duration-1000"
                            style={{ width: `${(ultimaAvaliacao.score_c || 0) * 10}%` }}
                          />
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-muted/30 border border-border/50 space-y-2">
                        <div className="flex items-center gap-2">
                          <Shield className="h-3 w-3 text-studio" />
                          <span className="text-[10px] font-black uppercase tracking-wider">Diretriz Social & Estilo de Vida</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-relaxed font-medium">
                          {(ultimaAvaliacao.score_c || 0) > 6
                            ? "Alta demanda externa detectada. O treino deve servir como ferramenta de regulação emocional e descompressão, evitando metas de performance punitivas."
                            : "Carga contextual estável. Momento ideal para cobrança de disciplina e foco em objetivos de longo prazo."
                          }
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-studio/10 shadow-lg bg-gradient-to-br from-card to-cyan-50/20">
                  <CardContent className="pt-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-8 w-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
                        <Heart className="h-4 w-4 text-rose-500" />
                      </div>
                      <h4 className="font-black text-sm tracking-tighter text-foreground uppercase">Status Neuro-Fisiológico</h4>
                      <Badge variant="outline" className="ml-auto text-[9px] font-black text-cyan-800 bg-white/80 border-cyan-100 px-2 uppercase tracking-tighter shadow-sm">R Total: {ultimaAvaliacao.score_r?.toFixed(1)}</Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-4">
                      {[
                        { icon: Moon, val: (ultimaAvaliacao as any).dados_avaliacao?.bloco5?.scoreR1 || (ultimaAvaliacao as any).score_r1 || 5, label: 'Sono (R1)', color: 'blue' },
                        { icon: Zap, val: (ultimaAvaliacao as any).dados_avaliacao?.bloco5?.scoreR2 || (ultimaAvaliacao as any).score_r2 || 5, label: 'Energia (R2)', color: 'amber' },
                        { icon: Brain, val: (ultimaAvaliacao as any).dados_avaliacao?.bloco5?.scoreR3 || (ultimaAvaliacao as any).score_r3 || 5, label: 'Psico (R3)', color: 'purple' },
                      ].map((item, idx) => {
                        const getRColor = (val: number) => val > 7 ? 'text-red-500' : val > 4 ? 'text-amber-500' : 'text-emerald-500';
                        const Icon = item.icon;
                        return (
                          <div key={idx} className="text-center p-2.5 rounded-2xl bg-white dark:bg-black/20 border border-border shadow-sm transition-all hover:scale-[1.03]">
                            <Icon className={`h-4 w-4 mx-auto mb-1.5 text-${item.color}-500`} />
                            <div className={cn("text-lg font-black tracking-tighter", getRColor(item.val))}>{item.val.toFixed(1)}</div>
                            <div className="text-[8px] text-muted-foreground uppercase font-black tracking-tighter">{item.label}</div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-cyan-900/5 border border-cyan-900/10 transition-all hover:bg-cyan-900/10">
                      <div className="h-5 w-5 rounded-full bg-cyan-500/20 flex items-center justify-center shrink-0 mt-0.5">
                        <AlertTriangle className="h-3 w-3 text-cyan-700" />
                      </div>
                      <p className="text-[10px] text-cyan-900 leading-tight font-bold">
                        <span className="opacity-60 uppercase tracking-widest block mb-0.5">Diagnóstico Direcionado:</span>
                        A regulação {ultimaAvaliacao.score_r && ultimaAvaliacao.score_r > 5 ? 'comprometida' : 'altamente estável'}
                        indica {ultimaAvaliacao.score_r && ultimaAvaliacao.score_r > 5 ? 'foco em modulação do SN (Down-Training)' : 'estímulos de carga tensional (Up-Training)'} nesta janela biológica.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}


          {/* Histórico de Avaliações */}
          <div className="space-y-3 mt-6">
            <div className="flex items-center gap-2 px-1">
              <Activity className="h-4 w-4 text-studio" />
              <h4 className="font-black text-sm text-foreground tracking-tight uppercase">Histórico de Performance</h4>
            </div>

            {loadingAvaliacoes ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-studio opacity-50" /></div>
            ) : !avaliacoes || avaliacoes.length === 0 ? (
              <div className="text-center py-10 border-2 rounded-2xl border-dashed bg-muted/20 border-muted-foreground/10">
                <Sparkles className="h-8 w-8 text-muted-foreground opacity-20 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Aguardando Primeira Avaliação</p>
              </div>
            ) : (
              <div className="space-y-2">
                {avaliacoes.map((av: any) => (
                  <div key={av.id} className="group border rounded-2xl p-4 bg-white/60 dark:bg-black/20 hover:bg-studio/5 hover:border-studio/30 transition-all duration-500 shadow-sm hover:shadow-md cursor-default relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-studio opacity-0 group-hover:opacity-100 transition-all duration-500" />
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-studio/5 flex items-center justify-center shrink-0 group-hover:bg-gradient-studio transition-all duration-700 shadow-inner">
                        <Calendar className="h-6 w-6 text-studio group-hover:text-white transition-colors duration-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-black text-foreground">{format(parseISO(av.created_at), "dd 'de' MMMM", { locale: ptBR })}</span>
                          {av.classificacao && (
                            <Badge variant="outline" className="text-[10px] h-4 py-0 font-bold border-none bg-muted/60" style={{ color: getSeverityColorHex(av.id_final) }}>
                              {av.classificacao}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">
                          <span className="flex items-center gap-1"><Target className="h-3 w-3" /> ID: <span className="text-foreground">{av.id_final?.toFixed(1)}</span></span>
                          <span className="flex items-center gap-1"><Activity className="h-3 w-3" /> F: {av.score_f?.toFixed(1)}</span>
                          <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> R: {av.score_r?.toFixed(1)}</span>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="h-9 text-[10px] font-black gap-2 px-4 rounded-xl border-border bg-white group-hover:border-studio group-hover:text-studio group-hover:shadow-lg transition-all duration-300 uppercase tracking-widest"
                        onClick={() => setSelectedAvaliacao(av.dados_avaliacao as unknown as AvaliacaoMyID)}>
                        <FileText className="h-3.5 w-3.5" /> Ver Relatório
                        <ChevronRight className="h-3 w-3 opacity-50 group-hover:translate-x-0.5 transition-transform" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground text-center py-6 italic font-medium opacity-60">
            * As métricas premium são baseadas em algoritmos de saúde integrativa e regulação autonômica.
          </p>
        </TabsContent>

        {/* Modal Relatório Premium */}
        {
          selectedAvaliacao && (
            <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md overflow-y-auto animate-in fade-in duration-300">
              <div className="container max-w-5xl py-10 relative">
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-4 right-4 z-[110] rounded-xl shadow-xl hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all"
                  onClick={() => setSelectedAvaliacao(null)}
                >
                  FECHAR RELATÓRIO
                </Button>
                <RelatorioIdentidade
                  avaliacao={selectedAvaliacao}
                  pacienteId={pacienteId}
                  onBack={() => setSelectedAvaliacao(null)}
                />
              </div>
            </div>
          )
        }
      </Tabs>
    </div>
  );
}
