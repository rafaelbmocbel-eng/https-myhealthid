import { useState } from 'react';
import { ArrowLeft, AlignCenter, Link2, Copy, MessageCircle, Plus, Loader2, FileText, Trash2, TrendingUp, Calendar, BarChart3, Dumbbell, PersonStanding, Fingerprint, ExternalLink, Presentation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getAvaliacaoUrl } from '@/utils/linkUrls';
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
        blocos_inclusos: [1, 2, 3, 4, 5],
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
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shrink-0 text-white font-bold">
            {paciente.nome[0]}{paciente.sobrenome?.[0] || ''}
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">{paciente.nome} {paciente.sobrenome}</h2>
            <p className="text-sm text-muted-foreground">{paciente.email || paciente.telefone || 'Sem contato'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 border-border hover:bg-muted" onClick={() => {/* TODO: perfil */ }}>
            <ExternalLink className="h-4 w-4" />
            Perfil
          </Button>
          <Button onClick={() => setIniciandoAvaliacao(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
            <AlignCenter className="h-4 w-4" /> Nova Avaliação
          </Button>
        </div>
      </div>

      {/* Tabs Principais */}
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
            <TabsTrigger value="evolucao" className="text-xs gap-1 data-[state=active]:bg-gradient-cobzero data-[state=active]:text-white">
              <TrendingUp className="h-3.5 w-3.5" /> Evolução
            </TabsTrigger>
          )}
          <TabsTrigger value="protocolos" className="text-xs gap-1 data-[state=active]:bg-gradient-cobzero data-[state=active]:text-white">
            <Dumbbell className="h-3.5 w-3.5" /> Protocolos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="integrada" className="mt-4">
          <PatientIntegratedDashboard pacienteId={paciente.id} serviceType="cob_zero" />
        </TabsContent>

        {/* Aba: Avaliação Remota */}
        <TabsContent value="remota" className="mt-4 space-y-4">
          {/* Link Compacto */}
          <div className="clinical-card !p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Link2 className="h-4 w-4 text-blue-600 shrink-0" />
              <span className="text-xs font-semibold shrink-0">Link Avaliação (MyID)</span>
              {linkAtivo ? (
                <>
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="text-[10px] text-emerald-600 shrink-0">{differenceInDays(new Date(linkAtivo.data_expiracao!), new Date())}d</span>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => copiarLink(linkAtivo.token)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                  {paciente.telefone && (
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-[#25D366]" onClick={() => whatsApp(linkAtivo.token)}>
                      <MessageCircle className="h-3 w-3" />
                    </Button>
                  )}
                </>
              ) : (
                <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 text-blue-600" disabled={gerando} onClick={gerarLink}>
                  {gerando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  Gerar (30d)
                </Button>
              )}
            </div>
          </div>

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
            <div className="space-y-6">
              {/* Índices de Risco — combina scores de identidade + COB */}
              {(ultimaIdentidade || avaliacoes.length > 0) && (
                <IndicesRiscoComprometimento
                  scores={{
                    ...(ultimaIdentidade || {}),
                    score_e: avaliacoes[0]?.score_e ?? ultimaIdentidade?.score_e,
                  } as any}
                  parcial={!ultimaIdentidade}
                  dadosAvaliacao={(ultimaIdentidade as any)?.dados_avaliacao}
                />
              )}

              {/* Perfil de Terreno Integrado */}
              {questionnaireData?.blocos[1] && questionnaireData?.blocos[4] && questionnaireData?.blocos[5] && (() => {
                const terrenos = calcularTerrenos(questionnaireData.blocos[1], questionnaireData.blocos[4], questionnaireData.blocos[5], questionnaireData.scores.scoreD || 0);
                return (
                  <div className="clinical-card border-2 border-primary/10 bg-gradient-to-br from-card to-primary/5">
                    <div className="flex flex-col md:flex-row items-center gap-6">
                      <div className="flex-1 space-y-3">
                        <h3 className="font-bold text-sm flex items-center gap-2">
                          <PersonStanding className="h-4 w-4 text-primary" />
                          Terreno Biopsicossocial (Baseado no Questionário)
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="flex justify-between text-[10px] mb-1">
                              <span className="font-bold text-green-600">Modificáveis ({terrenos.porcentagemMod}%)</span>
                            </div>
                            <div className="h-2 rounded-full bg-secondary overflow-hidden">
                              <div className="h-full bg-green-500" style={{ width: `${terrenos.porcentagemMod}%` }} />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-[10px] mb-1">
                              <span className="font-bold text-red-500">Fixos ({terrenos.porcentagemNaoMod}%)</span>
                            </div>
                            <div className="h-2 rounded-full bg-secondary overflow-hidden">
                              <div className="h-full bg-red-400" style={{ width: `${terrenos.porcentagemNaoMod}%` }} />
                            </div>
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Fator Amplificador de Sintomas: <strong>{terrenos.amplificadorDor.toFixed(2)}x</strong>
                        </p>
                      </div>
                      <div className="relative w-20 h-20 shrink-0 flex items-center justify-center bg-card rounded-full border-2 border-muted overflow-hidden">
                        <PersonStanding className="h-10 w-10 text-primary opacity-50" />
                        <svg className="absolute inset-0 w-full h-full -rotate-90">
                          <circle cx="40" cy="40" r="37" className="stroke-green-500 fill-none" strokeWidth="3" strokeDasharray="233" strokeDashoffset={233 - (233 * terrenos.porcentagemMod) / 100} />
                          <circle cx="40" cy="40" r="33" className="stroke-red-400 fill-none" strokeWidth="2" strokeDasharray="207" strokeDashoffset={207 - (207 * terrenos.porcentagemNaoMod) / 100} />
                        </svg>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Studio Personal Integration Card */}
              {ultimaMedidaStudio && (
                <div className="clinical-card border-l-4 border-l-emerald-500 bg-emerald-50/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Dumbbell className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-900">Última Composição Corporal (Studio)</span>
                    <Badge variant="outline" className="ml-auto text-[10px] h-4 bg-white">{format(parseISO(ultimaMedidaStudio.data_medida), 'dd/MM/yy', { locale: ptBR })}</Badge>
                  </div>
                  <div className="flex gap-4">
                    <div className="text-center bg-white/50 rounded-lg p-2 flex-1 border border-emerald-100">
                      <div className="font-bold text-sm text-emerald-700">{ultimaMedidaStudio.peso}kg</div>
                      <div className="text-[9px] text-muted-foreground uppercase">Peso</div>
                    </div>
                    <div className="text-center bg-white/50 rounded-lg p-2 flex-1 border border-emerald-100">
                      <div className="font-bold text-sm text-emerald-700">{ultimaMedidaStudio.percentual_gordura}%</div>
                      <div className="text-[9px] text-muted-foreground uppercase">% Gord.</div>
                    </div>
                    <div className="text-center bg-white/50 rounded-lg p-2 flex-1 border border-emerald-100">
                      <div className="font-bold text-sm text-emerald-700">{ultimaMedidaStudio.imc || '—'}</div>
                      <div className="text-[9px] text-muted-foreground uppercase">IMC</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="h-px bg-border my-6" />

              {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : avaliacoes.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border rounded-xl border-dashed">
                  <AlignCenter className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Nenhuma avaliação salva</p>
                  <p className="text-sm mt-1">Realize e salve uma avaliação COB° ZERO para ver o histórico.</p>
                  <Button className="mt-4 bg-blue-600 hover:bg-blue-700 text-white" onClick={onIniciarAvaliacao}>Iniciar Avaliação</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Gráfico de barras: Cobb por avaliação */}
                  {barData.length > 0 && (
                    <div className="clinical-card">
                      <div className="flex items-center gap-2 mb-4">
                        <BarChart3 className="h-4 w-4 text-blue-600" />
                        <h4 className="font-semibold text-sm">Ângulo de Cobb por Avaliação</h4>
                      </div>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={barData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} unit="°" />
                            <Tooltip formatter={(v) => [`${v}°`, 'Cobb']} labelFormatter={(l, p) => `${l} — ${p?.[0]?.payload?.data || ''}`} />
                            <Bar dataKey="Ângulo Cobb" fill="#2563eb" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Lista de avaliações */}
                  <div className="space-y-2">
                    {avaliacoes.map((av: any) => (
                      <div key={av.id} className="border rounded-xl p-3 flex items-center gap-3 hover:bg-accent/10 transition-all">
                        <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold">{av.data_avaliacao}</span>
                            <Badge variant="outline" className="text-[10px] h-4">Lenke {av.lenke_type}</Badge>
                            {av.risco_level && (
                              <Badge variant="outline" className={`text-[10px] h-4 ${RISCO_COLOR[av.risco_level] || ''}`}>{av.risco_level}</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Cobb: {av.cobb_angle}° · Risco: {av.risco_percentage}% · Score E: {av.score_e?.toFixed(1)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                            onClick={() => onVerRelatorio(av.dados_avaliacao as AvaliacaoCobZero)}>
                            <FileText className="h-3 w-3" /> Ver
                          </Button>
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
            </div>
          )}
        </TabsContent>

        {/* Aba: Evolução */}
        {evolucaoData.length >= 2 && (
          <TabsContent value="evolucao" className="mt-4">
            <div className="clinical-card">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <h4 className="font-semibold text-sm">Evolução Clínica — COB° ZERO</h4>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={evolucaoData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="av" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip labelFormatter={(l, p) => `${l} — ${p?.[0]?.payload?.data || ''}`} />
                    <Legend />
                    <Line type="monotone" dataKey="Cobb" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4 }} name="Cobb (°)" />
                    <Line type="monotone" dataKey="Risco" stroke="#ef4444" strokeWidth={1.5} dot={{ r: 3 }} name="Risco (%)" />
                    <Line type="monotone" dataKey="ScoreE" stroke="#10b981" strokeWidth={1.5} dot={{ r: 3 }} name="Score E" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4">
                {[
                  { label: 'Cobb', key: 'Cobb', unit: '°', icon: '📐' },
                  { label: 'Risco', key: 'Risco', unit: '%', icon: '⚠️' },
                  { label: 'Score E', key: 'ScoreE', unit: '', icon: '💪' },
                ].map(({ label, key, unit, icon }) => {
                  const first = evolucaoData[0][key as keyof typeof evolucaoData[0]] as number;
                  const last = evolucaoData[evolucaoData.length - 1][key as keyof typeof evolucaoData[0]] as number;
                  const delta = Number((last - first).toFixed(1));
                  // Para Cobb e Risco, queda é positiva
                  const isPositive = key === 'ScoreE' ? delta > 0 : delta < 0;
                  return (
                    <div key={key} className="bg-muted/50 rounded-lg p-3 text-center">
                      <div className="text-base mb-1">{icon}</div>
                      <div className="text-xs text-muted-foreground">{label}</div>
                      <div className="font-bold text-sm">{last}{unit}</div>
                      <div className={`text-xs font-medium ${isPositive ? 'text-emerald-600' : delta === 0 ? 'text-muted-foreground' : 'text-red-500'}`}>
                        {delta > 0 ? '↑' : delta < 0 ? '↓' : '='} {Math.abs(delta)}{unit}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>
        )}

        {/* Aba: Protocolos */}
        <TabsContent value="protocolos" className="mt-4">
          <PacienteProtocolosTab
            pacienteId={paciente.id}
            pacienteNome={`${paciente.nome} ${paciente.sobrenome}`}
            tipo="cob_zero"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
