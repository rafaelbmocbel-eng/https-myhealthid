import { useState } from 'react';
import { ArrowLeft, Activity, Link2, Copy, MessageCircle, Mail, Plus, Loader2, FileText, Trash2, TrendingUp, Calendar, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAvaliacoesIdentidade } from '@/hooks/useAvaliacoesSalvas';
import { useLinksAvaliacao } from '@/hooks/useLinksAvaliacao';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { differenceInDays, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AvaliacaoIdentidade } from '@/types/identidade';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { shareAvaliacaoLink } from '@/utils/whatsapp';

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

const SCORE_KEYS = ['score_e', 'score_p', 'score_c', 'score_f', 'score_d', 'score_r', 'score_efi'];

export default function PacienteDashboardIdentidade({ paciente, onBack, onIniciarAvaliacao, onVerRelatorio }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { avaliacoes, isLoading, deletar } = useAvaliacoesIdentidade(paciente.id);
  const { links, gerarLink, copiarLink, getLinkUrl, gerando } = useLinksAvaliacao();
  const [enviandoEmail, setEnviandoEmail] = useState(false);

  const linkAtivo = links.find(l => l.paciente_id === paciente.id && l.status === 'ativo' && new Date(l.data_expiracao) > new Date());

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

  // Dados para gráfico radar (última avaliação)
  const ultimaAvaliacao = avaliacoes[0];
  const radarData = ultimaAvaliacao ? SCORE_KEYS.slice(0, 6).map(key => ({
    score: SCORE_LABELS[key].replace(/\s*\(.*\)/, ''),
    valor: Number(((ultimaAvaliacao as any)[key] || 0).toFixed(1)),
  })) : [];

  // Dados para gráfico de linha (evolução)
  const evolucaoData = [...avaliacoes].reverse().map((av: any, i) => ({
    avaliacao: `Av. ${i + 1}`,
    data: av.data_avaliacao,
    E: Number((av.score_e || 0).toFixed(1)),
    P: Number((av.score_p || 0).toFixed(1)),
    C: Number((av.score_c || 0).toFixed(1)),
    F: Number((av.score_f || 0).toFixed(1)),
    D: Number((av.score_d || 0).toFixed(1)),
    R: Number((av.score_r || 0).toFixed(1)),
    ID: Number((av.id_final || 0).toFixed(1)),
  }));

  // Respostas agrupadas por link
  const respostasAgrupadas = linksAvPaciente.filter(l => respostas.some(r => r.link_id === l.id));
  const BLOCOS = ['Anamnese', 'Dor', 'Funcionalidade', 'Cinesiofobia', 'Regulação'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-8 w-8 p-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center shrink-0 text-white font-bold">
          {paciente.nome[0]}{paciente.sobrenome?.[0] || ''}
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-foreground">{paciente.nome} {paciente.sobrenome}</h2>
          <p className="text-sm text-muted-foreground">{paciente.email || paciente.telefone || 'Sem contato'}</p>
        </div>
        <Button onClick={onIniciarAvaliacao} className="bg-gradient-primary text-white gap-2">
          <Activity className="h-4 w-4" /> Nova Avaliação
        </Button>
      </div>

      {/* Card de Links */}
      <div className="clinical-card">
        <div className="flex items-center gap-2 mb-3">
          <Link2 className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Link de Avaliação Remota</h3>
        </div>
        {linkAtivo ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-emerald-600 mb-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Link ativo — expira em {differenceInDays(new Date(linkAtivo.data_expiracao), new Date())} dias</span>
            </div>
            <div className="bg-muted/50 rounded-lg p-2 text-xs font-mono text-muted-foreground truncate">
              {getLinkUrl(linkAtivo.token)}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => copiarLink(linkAtivo.token)}>
                <Copy className="h-3 w-3" /> Copiar
              </Button>
              {paciente.telefone && (
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1 border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10"
                  onClick={() => shareAvaliacaoLink(`${paciente.nome} ${paciente.sobrenome}`, paciente.telefone!, getLinkUrl(linkAtivo.token))}>
                  <MessageCircle className="h-3 w-3" /> WhatsApp
                </Button>
              )}
              {paciente.email && (
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1 border-blue-400 text-blue-600 hover:bg-blue-50"
                  onClick={enviarEmail} disabled={enviandoEmail}>
                  {enviandoEmail ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                  Email
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground flex-1">Nenhum link ativo para este paciente.</p>
            <Button size="sm" className="bg-gradient-primary text-white gap-1" disabled={gerando}
              onClick={async () => { const novo = await gerarLink(paciente.id); if (novo) copiarLink(novo.token); }}>
              {gerando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              Gerar Link (30 dias)
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="avaliacoes">
        <TabsList className="bg-secondary p-1 rounded-xl">
          <TabsTrigger value="avaliacoes" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <BarChart3 className="h-4 w-4" /> Avaliações Salvas {avaliacoes.length > 0 && `(${avaliacoes.length})`}
          </TabsTrigger>
          <TabsTrigger value="respostas" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <FileText className="h-4 w-4" /> Questionários Remotos {respostasAgrupadas.length > 0 && `(${respostasAgrupadas.length})`}
          </TabsTrigger>
          {evolucaoData.length >= 2 && (
            <TabsTrigger value="evolucao" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <TrendingUp className="h-4 w-4" /> Evolução
            </TabsTrigger>
          )}
        </TabsList>

        {/* Aba: Avaliações Salvas */}
        <TabsContent value="avaliacoes" className="mt-4">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : avaliacoes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border rounded-xl border-dashed">
              <Activity className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhuma avaliação salva</p>
              <p className="text-sm mt-1">Realize e salve uma avaliação para visualizar o histórico.</p>
              <Button className="mt-4 bg-gradient-primary text-white" onClick={onIniciarAvaliacao}>Iniciar Avaliação</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Radar da última avaliação */}
              {radarData.length > 0 && (
                <div className="clinical-card">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    <h4 className="font-semibold text-sm">Perfil da Última Avaliação — {ultimaAvaliacao?.data_avaliacao}</h4>
                    {(ultimaAvaliacao as any)?.classificacao && (
                      <Badge variant="outline" className="ml-auto text-xs">{(ultimaAvaliacao as any).classificacao}</Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={radarData}>
                          <PolarGrid />
                          <PolarAngleAxis dataKey="score" tick={{ fontSize: 11 }} />
                          <Radar name="Score" dataKey="valor" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {SCORE_KEYS.map(key => (
                        <div key={key} className="bg-muted/50 rounded-lg p-2 text-center">
                          <div className="text-xs text-muted-foreground">{SCORE_LABELS[key]}</div>
                          <div className="font-bold text-sm text-foreground">
                            {((ultimaAvaliacao as any)[key] || 0).toFixed(1)}
                          </div>
                        </div>
                      ))}
                      <div className="bg-primary/10 rounded-lg p-2 text-center col-span-2">
                        <div className="text-xs text-primary font-medium">ID Final</div>
                        <div className="font-bold text-base text-primary">
                          {((ultimaAvaliacao as any)?.id_final || 0).toFixed(1)}/50
                        </div>
                      </div>
                    </div>
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
          {respostasAgrupadas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border rounded-xl border-dashed">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum questionário recebido</p>
              <p className="text-sm mt-1">Gere e envie um link de avaliação para este paciente.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {respostasAgrupadas.map(link => {
                const respostasLink = respostas.filter(r => r.link_id === link.id);
                const blocosRecebidos = [...new Set(respostasLink.map(r => r.bloco_numero))].sort();
                const completo = blocosRecebidos.length === 5;
                const todosScores: Record<string, number> = {};
                blocosRecebidos.forEach(bn => {
                  const resp = respostasLink.filter(r => r.bloco_numero === bn).sort((a, b) => (b.numero_tentativa || 1) - (a.numero_tentativa || 1))[0];
                  if (resp?.dados_respostas) {
                    const d = resp.dados_respostas as Record<string, any>;
                    Object.entries(d).filter(([k]) => k.startsWith('score')).forEach(([k, v]) => { if (typeof v === 'number') todosScores[k] = v; });
                  }
                });
                return (
                  <div key={link.id} className="border rounded-xl overflow-hidden">
                    <div className="p-3 flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">
                            {link.data_ultimo_acesso ? format(parseISO(link.data_ultimo_acesso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : format(parseISO(link.created_at!), 'dd/MM/yyyy', { locale: ptBR })}
                          </span>
                          {completo && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">Completo</Badge>}
                        </div>
                        <div className="flex gap-1 mt-1.5">
                          {[1, 2, 3, 4, 5].map(n => (
                            <div key={n} className={`h-1.5 flex-1 rounded-sm ${blocosRecebidos.includes(n) ? 'bg-emerald-500' : 'bg-muted'}`} title={BLOCOS[n - 1]} />
                          ))}
                        </div>
                      </div>
                    </div>
                    {Object.keys(todosScores).length > 0 && (
                      <div className="border-t px-3 pb-3">
                        <div className="flex gap-2 flex-wrap mt-2">
                          {Object.entries(todosScores).map(([k, v]) => (
                            <span key={k} className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-bold">
                              {k.replace('score', '').toUpperCase()}: {v.toFixed(1)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Aba: Evolução */}
        {evolucaoData.length >= 2 && (
          <TabsContent value="evolucao" className="mt-4">
            <div className="clinical-card">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h4 className="font-semibold text-sm">Evolução dos Scores ao Longo do Tempo</h4>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={evolucaoData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="avaliacao" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value, name) => [value, name]}
                      labelFormatter={(label, payload) => {
                        const d = payload?.[0]?.payload?.data;
                        return d ? `${label} — ${d}` : label;
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="ID" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} name="ID Final" />
                    <Line type="monotone" dataKey="E" stroke="#3b82f6" strokeWidth={1.5} dot={{ r: 3 }} name="Estrutural" />
                    <Line type="monotone" dataKey="D" stroke="#ef4444" strokeWidth={1.5} dot={{ r: 3 }} name="Dor" />
                    <Line type="monotone" dataKey="P" stroke="#f59e0b" strokeWidth={1.5} dot={{ r: 3 }} name="Kinesiophobia" />
                    <Line type="monotone" dataKey="F" stroke="#10b981" strokeWidth={1.5} dot={{ r: 3 }} name="Funcional" />
                    <Line type="monotone" dataKey="R" stroke="#8b5cf6" strokeWidth={1.5} dot={{ r: 3 }} name="Regulação" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                {['E', 'D', 'P', 'F', 'R', 'C', 'EFI'].map(score => {
                  const first = evolucaoData[0]?.[score as keyof typeof evolucaoData[0]] as number;
                  const last = evolucaoData[evolucaoData.length - 1]?.[score as keyof typeof evolucaoData[0]] as number;
                  if (first === undefined || last === undefined) return null;
                  const delta = Number((last - first).toFixed(1));
                  return (
                    <div key={score} className="bg-muted/50 rounded-lg p-2 text-center">
                      <div className="text-xs text-muted-foreground font-medium">{score}</div>
                      <div className="font-bold text-sm">{last}</div>
                      <div className={`text-xs font-medium ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                        {delta > 0 ? '↑' : delta < 0 ? '↓' : '='} {Math.abs(delta)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
