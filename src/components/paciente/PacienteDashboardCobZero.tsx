import { useState } from 'react';
import { ArrowLeft, Target, AlignCenter, Link2, Copy, MessageCircle, Plus, Loader2, FileText, Trash2, TrendingUp, Calendar, BarChart3, Dumbbell, PersonStanding, Fingerprint, ExternalLink, Presentation, ClipboardList, StickyNote, Smartphone, Mic } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getAvaliacaoUrl, getBaseUrl } from '@/utils/linkUrls';
import { shareAvaliacaoLink } from '@/utils/whatsapp';
import { useAvaliacoesCobZero } from '@/hooks/useAvaliacoesSalvas';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { differenceInDays, format, parseISO } from 'date-fns';
import { calcularTerrenos } from '@/utils/calculations';
import { ptBR } from 'date-fns/locale';
import { AvaliacaoCobZero } from '@/types/cobzero';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';
import PacienteProtocolosTab from './PacienteProtocolosTab';
import IndicesRiscoComprometimento from './IndicesRiscoComprometimento';
import QuestionariosComparacao from './QuestionariosComparacao';
import PatientIntegratedDashboard from './PatientIntegratedDashboard';
import { CobZeroWizard } from '../cobzero/CobZeroWizard';
import StudioTreinosTab from '@/components/studio/StudioTreinosTab';
import StudioEvolucaoTab from '@/components/studio/StudioEvolucaoTab';
import StudioNotasTab from '@/components/studio/StudioNotasTab';

interface Paciente {
  id: string;
  nome: string;
  sobrenome: string;
  email?: string | null;
  telefone?: string | null;
  portal_token?: string | null;
}

interface Props {
  paciente: Paciente;
  onBack: () => void;
  onIniciarAvaliacao: () => void;
  onVerRelatorio: (avaliacao: AvaliacaoCobZero) => void;
}

const RISCO_COLOR: Record<string, string> = {
  BAIXO: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  MODERADO: 'bg-amber-100 text-amber-700 border-amber-200',
  ALTO: 'bg-orange-100 text-orange-700 border-orange-200',
  CRÍTICO: 'bg-red-100 text-red-700 border-red-200',
};

export default function PacienteDashboardCobZero({ paciente, onBack, onIniciarAvaliacao, onVerRelatorio }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { avaliacoes, isLoading, salvar: salvarCobZero, deletar } = useAvaliacoesCobZero(paciente.id);
  const [gerando, setGerando] = useState(false);
  const [iniciandoAvaliacao, setIniciandoAvaliacao] = useState(false);

  // Buscar última avaliação identidade para índices de risco completos
  const { data: ultimaIdentidade } = useQuery({
    queryKey: ['cobzero-ultima-identidade', paciente.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('avaliacoes_identidade')
        .select('score_e, score_p, score_c, score_f, score_d, score_r, score_efi, id_final, dados_avaliacao')
        .eq('paciente_id', paciente.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Buscar última resposta de questionário para terreno
  const { data: questionnaireData } = useQuery({
    queryKey: ['cobzero-questionnaire-data', paciente.id],
    queryFn: async () => {
      const { data: links } = await supabase
        .from('links_avaliacao')
        .select('id')
        .eq('paciente_id', paciente.id)
        .order('created_at', { ascending: false });

      if (!links || links.length === 0) return null;

      const { data: respostas } = await supabase
        .from('respostas_avaliacao_paciente')
        .select('*')
        .in('link_id', links.map(l => l.id))
        .order('created_at', { ascending: false });

      if (!respostas || respostas.length === 0) return null;

      const blocos: Record<number, any> = {};
      const scores: Record<string, number> = {};

      respostas.forEach(r => {
        const d = r.dados_respostas as any;
        if (!blocos[r.bloco_numero]) blocos[r.bloco_numero] = d;
        Object.entries(d || {}).forEach(([k, v]) => {
          if (k.startsWith('score') && typeof v === 'number') scores[k] = v;
        });
      });

      return { blocos, scores };
    },
    enabled: !!user,
  });

  const { data: ultimaMedidaStudio } = useQuery({
    queryKey: ['cobzero-ultima-medida-studio', paciente.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('studio_medidas')
        .select('*')
        .eq('paciente_id', paciente.id)
        .order('data_medida', { ascending: false })
        .limit(1);
      return data?.[0] || null;
    },
    enabled: !!user,
  });

  // Link de avaliação ativo
  const { data: linksAv = [] } = useQuery({
    queryKey: ['links-av-cobzero', user?.id, paciente.id],
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

  const linkAtivo = linksAv.find(l => l.status === 'ativo' && new Date(l.data_expiracao!) > new Date());

  const { data: respostas = [] } = useQuery({
    queryKey: ['respostas-paciente-cobzero', paciente.id],
    queryFn: async () => {
      const linkIds = linksAv.map((l: any) => l.id);
      if (linkIds.length === 0) return [];
      const { data, error } = await supabase
        .from('respostas_avaliacao_paciente')
        .select('*')
        .in('link_id', linkIds)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: linksAv.length > 0,
  });

  const getLinkUrl = (token: string) => getAvaliacaoUrl(token);

  const gerarLink = async () => {
    if (!user) return;
    setGerando(true);
    try {
      const dataExpiracao = new Date();
      dataExpiracao.setDate(dataExpiracao.getDate() + 30);
      const { error } = await supabase.from('links_avaliacao').insert({
        paciente_id: paciente.id,
        terapeuta_id: user.id,
        data_expiracao: dataExpiracao.toISOString(),
        blocos_inclusos: [1, 2, 3, 4, 5, 6],
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['links-av-cobzero'] });
      toast({ title: 'Link gerado! (30 dias)' });
    } catch (e: any) {
      toast({ title: 'Erro ao gerar link', description: e.message, variant: 'destructive' });
    } finally {
      setGerando(false);
    }
  };

  const copiarLink = (token: string) => {
    navigator.clipboard.writeText(getLinkUrl(token));
    toast({ title: 'Link copiado! 📋' });
  };

  const whatsApp = (token: string) => {
    if (!paciente.telefone) {
      toast({ title: 'Sem telefone cadastrado', variant: 'destructive' });
      return;
    }
    shareAvaliacaoLink(`${paciente.nome} ${paciente.sobrenome}`, paciente.telefone, getLinkUrl(token));
  };

  // Dados para gráfico de linha (evolução Cobb + Risco)
  const evolucaoData = [...avaliacoes].reverse().map((av: any, i) => ({
    av: `Av. ${i + 1}`,
    data: av.data_avaliacao,
    Cobb: Number((av.cobb_angle || 0).toFixed(1)),
    Risco: Number((av.risco_percentage || 0).toFixed(1)),
    ScoreE: Number((av.score_e || 0).toFixed(1)),
  }));

  // Dados para gráfico de barras (comparação Cobb por avaliação)
  const barData = [...avaliacoes].reverse().map((av: any, i) => ({
    name: `Av. ${i + 1}`,
    'Ângulo Cobb': Number((av.cobb_angle || 0).toFixed(1)),
    data: av.data_avaliacao,
    lenke: av.lenke_type,
  }));


  return (
    <div className="space-y-6">
      {/* Header Unificado */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="h-8 w-8 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold">
            {paciente.nome[0]}{paciente.sobrenome?.[0] || ''}
          </div>
          <div className="flex flex-wrap md:flex-nowrap items-center gap-4 md:gap-8">
            <div>
              <h2 className="text-lg md:text-xl font-bold text-foreground leading-tight">{paciente.nome} {paciente.sobrenome}</h2>
              <p className="text-xs md:text-sm text-muted-foreground">{paciente.telefone || paciente.email || 'Sem contato'}</p>
            </div>

            {/* Botões de Ação Dinâmicos (Ao lado do nome) */}
            <div className="flex items-center gap-4 md:gap-5 pt-1">
              {/* MYID */}
              <div className="flex flex-col flex-shrink-0 items-center justify-center gap-1">
                <span className="text-[9px] md:text-[10px] font-bold text-muted-foreground tracking-wider uppercase">MyID</span>
                <div className="flex gap-1">
                  {linkAtivo ? (
                    <>
                      <Button size="icon" variant="outline" className="h-[24px] w-[24px] md:h-[28px] md:w-[28px] rounded-lg border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800" onClick={() => copiarLink(linkAtivo.token)} title="Copiar Link MyID">
                        <Copy className="h-3 w-3 md:h-3.5 md:w-3.5" />
                      </Button>
                      {paciente.telefone && (
                        <Button size="icon" className="h-[24px] w-[24px] md:h-[28px] md:w-[28px] rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => whatsApp(linkAtivo.token)} title="Enviar no WhatsApp">
                          <Smartphone className="h-3 w-3 md:h-3.5 md:w-3.5" />
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button size="icon" variant="outline" className="h-[24px] w-[24px] md:h-[28px] md:w-[28px] rounded-lg border-dashed text-blue-600/80" disabled={gerando} onClick={gerarLink} title="Gerar Link MyID">
                      {gerando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3 md:h-3.5 md:w-3.5" />}
                    </Button>
                  )}
                </div>
              </div>

              {/* PORTAL */}
              {paciente.portal_token && (
                <div className="flex flex-col flex-shrink-0 items-center justify-center gap-1">
                  <span className="text-[9px] md:text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Portal</span>
                  <div className="flex gap-1">
                    <Button size="icon" variant="outline" className="h-[24px] w-[24px] md:h-[28px] md:w-[28px] rounded-lg border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 hover:text-violet-800" onClick={() => { navigator.clipboard.writeText(`${getBaseUrl()}/paciente/login?token=${paciente.portal_token}`); toast({ title: 'Link do Portal copiado! 🔗' }); }} title="Copiar Link do Portal">
                      <Copy className="h-3 w-3 md:h-3.5 md:w-3.5" />
                    </Button>
                    {paciente.telefone && (
                      <Button size="icon" className="h-[24px] w-[24px] md:h-[28px] md:w-[28px] rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => { const url = `${getBaseUrl()}/paciente/login?token=${paciente.portal_token}`; const msg = `Olá ${paciente.nome}! 🩺\n\nAcesse seu Portal do Paciente:\n${url}`; window.open(`https://wa.me/${paciente.telefone!.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank'); }} title="Enviar Portal via WhatsApp">
                        <Smartphone className="h-3 w-3 md:h-3.5 md:w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="hidden sm:flex gap-2 border-border hover:bg-muted" onClick={() => {/* TODO: perfil */ }}>
            <ExternalLink className="h-4 w-4" />
            Perfil
          </Button>
          <Button onClick={() => setIniciandoAvaliacao(true)} className="hidden sm:flex bg-blue-600 hover:bg-blue-700 text-white gap-2">
            <AlignCenter className="h-4 w-4" /> Nova Avaliação
          </Button>
        </div>
      </div>

      {/* Nível 1: Barra Principal de Ferramentas (Studio Mode) */}
      <Tabs defaultValue="avaliacao" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-10 bg-muted/60 mb-6">
          <TabsTrigger value="avaliacao" className="text-xs gap-1 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <ClipboardList className="h-3.5 w-3.5" /> Avaliação
          </TabsTrigger>
          <TabsTrigger value="treinos" className="text-xs gap-1 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Dumbbell className="h-3.5 w-3.5" /> Treinos
          </TabsTrigger>
          <TabsTrigger value="prontuario" className="text-xs gap-1 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <StickyNote className="h-3.5 w-3.5" /> Evoluções e Prontuário
          </TabsTrigger>

        </TabsList>

        {/* --- Aba 1: AVALIAÇÃO (Contém a interface antiga Inteira) --- */}
        <TabsContent value="avaliacao" className="mt-0">
          <Tabs defaultValue="integrada">
            <TabsList className="bg-secondary p-1 rounded-xl flex-wrap h-auto min-h-11">
              <TabsTrigger value="integrada" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-blue-600">
                <Fingerprint className="h-4 w-4" /> Visão Integrada
              </TabsTrigger>
              <TabsTrigger value="remota" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-blue-600">
                <FileText className="h-4 w-4" /> Avaliação Remota & Agenda
              </TabsTrigger>
              <TabsTrigger value="avaliacoes" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-blue-600">
                <Presentation className="h-4 w-4" /> Avaliação Presencial {avaliacoes.length > 0 && `(${avaliacoes.length})`}
              </TabsTrigger>
              {evolucaoData.length >= 2 && (
                <TabsTrigger value="evolucao_cob" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-blue-600">
                  <TrendingUp className="h-4 w-4" /> Cob Evolução
                </TabsTrigger>
              )}
              <TabsTrigger value="protocolos" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-blue-600">
                <Target className="h-4 w-4" /> Diretrizes e Serviços
              </TabsTrigger>
            </TabsList>

            <TabsContent value="integrada" className="mt-4">
              <PatientIntegratedDashboard pacienteId={paciente.id} serviceType="cob_zero" />
            </TabsContent>

            {/* Aba: Avaliação Remota */}
            <TabsContent value="remota" className="mt-4 space-y-4">


              <QuestionariosComparacao linksAvPaciente={linksAv} respostas={respostas} />
            </TabsContent>

            {/* Aba: Avaliação em Consultório */}
            <TabsContent value="avaliacoes" className="mt-4 space-y-6">
              {iniciandoAvaliacao ? (
                <div className="bg-white rounded-xl shadow-sm border p-6 relative animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-foreground">Nova Avaliação COB° ZERO</h3>
                    <Button variant="ghost" size="sm" onClick={() => setIniciandoAvaliacao(false)}>
                      Voltar ao Histórico
                    </Button>
                  </div>
                  <CobZeroWizard
                    pacienteNome={`${paciente.nome} ${paciente.sobrenome}`}
                    pacienteId={paciente.id}
                    onCancel={() => setIniciandoAvaliacao(false)}
                    onComplete={async (result) => {
                      try {
                        await salvarCobZero({ avaliacao: result, pacienteId: paciente.id });
                        setIniciandoAvaliacao(false);
                        qc.invalidateQueries({ queryKey: ['avaliacoes-cob-zero', paciente.id] });
                      } catch (err) {
                        console.error('Erro ao salvar:', err);
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  {avaliacoes.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Nenhuma avaliação presencial registrada.</p>
                      <Button variant="outline" className="mt-3" onClick={() => setIniciandoAvaliacao(true)}>Iniciar Avaliação</Button>
                    </div>
                  ) : (
                    avaliacoes.map((av: any, i: number) => (
                      <Card key={av.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-sm">Avaliação {avaliacoes.length - i}</p>
                            <p className="text-xs text-muted-foreground">{format(parseISO(av.data_avaliacao), 'dd/MM/yyyy', { locale: ptBR })}</p>
                            {av.cobb_angle && <Badge variant="outline" className="mt-1">Cobb: {av.cobb_angle}°</Badge>}
                            {av.lenke_type && <Badge variant="secondary" className="ml-1 mt-1">Lenke {av.lenke_type}</Badge>}
                            {av.risco_level && <Badge className={`ml-1 mt-1 ${RISCO_COLOR[av.risco_level] || ''}`}>{av.risco_level}</Badge>}
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => onVerRelatorio(av)}>
                              <FileText className="h-3.5 w-3.5 mr-1" /> Relatório
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deletar(av.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              )}
            </TabsContent>

            {evolucaoData.length >= 2 && (
              <TabsContent value="evolucao_cob" className="mt-4">
                <Card className="p-4">
                  <h3 className="font-bold text-sm mb-4 text-center uppercase tracking-wider text-muted-foreground">Evolução Clínica</h3>
                  <div className="h-[300px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={evolucaoData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="data" fontSize={10} tickFormatter={(val) => format(parseISO(val), 'dd/MM', { locale: ptBR })} axisLine={false} tickLine={false} />
                        <YAxis fontSize={10} axisLine={false} tickLine={false} />
                        <Tooltip
                          labelFormatter={(val) => format(parseISO(val as string), 'dd/MM/yyyy', { locale: ptBR })}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                        <Line type="monotone" dataKey="Cobb" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, fill: '#2563eb' }} activeDot={{ r: 6 }} name="Ângulo Cobb" />
                        <Line type="monotone" dataKey="Risco" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: '#f59e0b' }} activeDot={{ r: 6 }} name="% Risco" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </TabsContent>
            )}
            {/* Aba: Diretrizes e Serviços (Repositório) */}
            <TabsContent value="protocolos" className="mt-4">
              <PacienteProtocolosTab
                pacienteId={paciente.id}
                pacienteNome={`${paciente.nome} ${paciente.sobrenome}`}
                tipo="cob_zero"
              />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* --- Aba 2: TREINOS --- */}
        <TabsContent value="treinos" className="mt-4">
          <StudioTreinosTab pacienteId={paciente.id} pacienteNome={`${paciente.nome} ${paciente.sobrenome}`} />
        </TabsContent>


        {/* --- Aba 4: EVOLUÇÕES E PRONTUÁRIO --- */}
        <TabsContent value="prontuario" className="mt-4">
          <StudioNotasTab pacienteId={paciente.id} showSummary={true} />
        </TabsContent>

      </Tabs>
    </div>
  );
}
