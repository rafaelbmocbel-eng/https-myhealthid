import { useState } from 'react';
import { ArrowLeft, AlignCenter, Link2, Copy, MessageCircle, Plus, Loader2, FileText, Trash2, TrendingUp, Calendar, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getAvaliacaoUrl } from '@/utils/linkUrls';
import { useAvaliacoesCobZero } from '@/hooks/useAvaliacoesSalvas';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { differenceInDays, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AvaliacaoCobZero } from '@/types/cobzero';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';

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
  const { avaliacoes, isLoading, deletar } = useAvaliacoesCobZero(paciente.id);
  const [gerando, setGerando] = useState(false);

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
    const phone = paciente.telefone.replace(/\D/g, '');
    const fullPhone = phone.startsWith('55') ? phone : `55${phone}`;
    const msg = `Olá ${paciente.nome}! 👋\n\n📋 Seu terapeuta enviou um questionário de avaliação. Leva cerca de 30-40 min.\n\n🔗 ${getLinkUrl(token)}`;
    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, '_blank');
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
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-8 w-8 p-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shrink-0 text-white font-bold">
          {paciente.nome[0]}{paciente.sobrenome?.[0] || ''}
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-foreground">{paciente.nome} {paciente.sobrenome}</h2>
          <p className="text-sm text-muted-foreground">{paciente.email || paciente.telefone || 'Sem contato'}</p>
        </div>
        <Button onClick={onIniciarAvaliacao} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
          <AlignCenter className="h-4 w-4" /> Nova Avaliação
        </Button>
      </div>

      {/* Card de Links */}
      <div className="clinical-card">
        <div className="flex items-center gap-2 mb-3">
          <Link2 className="h-4 w-4 text-blue-600" />
          <h3 className="font-semibold text-sm">Link de Avaliação Remota</h3>
        </div>
        {linkAtivo ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-emerald-600 mb-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Link ativo — expira em {differenceInDays(new Date(linkAtivo.data_expiracao!), new Date())} dias</span>
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
                  onClick={() => whatsApp(linkAtivo.token)}>
                  <MessageCircle className="h-3 w-3" /> WhatsApp
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground flex-1">Nenhum link ativo para este paciente.</p>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1" disabled={gerando} onClick={gerarLink}>
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
            <BarChart3 className="h-4 w-4" /> Avaliações {avaliacoes.length > 0 && `(${avaliacoes.length})`}
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
      </Tabs>
    </div>
  );
}
