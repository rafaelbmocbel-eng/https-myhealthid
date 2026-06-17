import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Activity, Plus, Trash2, Pencil, Stethoscope, RefreshCcw, Check, User, ShieldCheck, Info, Heart, Zap, Brain, Shield, ClipboardList, Wind, Droplets, Dna, Waves, Eye, TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { REGIONS, STRUCTURES } from '@/components/presencial/Body3DAvatar';
import { VISCERAL_REGIONS, VISCERAL_STRUCTURES } from '@/utils/anatomia/regioesViscerais';
import { cn } from '@/lib/utils';
import {
  useEventosAnatomicos, useSaveEventoAnatomico, useDeleteEventoAnatomico,
  corEvento, type EventoAnatomico, type SistemaCorporal, type StatusEvento, type OrigemAchado,
} from '@/hooks/useEventosAnatomicos';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { encontrarSintomasEmTexto, extrairTextoDeObjeto, type SistemaCorporal as SistemaMapeamento } from '@/utils/anatomia/mapeamentoSintomas';


const FRONT_OUTLINE =
  'M120 18 C 138 18 152 34 152 54 C 152 70 144 84 132 90 L 134 104 C 156 110 178 118 184 132 L 192 168 L 200 230 L 204 280 L 196 308 L 188 308 L 184 282 L 176 232 L 168 178 L 160 168 L 158 220 L 156 280 L 162 360 L 158 430 L 152 500 L 138 506 L 134 500 L 132 430 L 128 360 L 124 280 L 116 280 L 112 360 L 108 430 L 106 500 L 102 506 L 88 500 L 82 430 L 78 360 L 84 280 L 82 220 L 80 168 L 72 178 L 64 232 L 56 282 L 52 308 L 44 308 L 36 280 L 40 230 L 48 168 L 56 132 C 62 118 84 110 106 104 L 108 90 C 96 84 88 70 88 54 C 88 34 102 18 120 18 Z';

const SISTEMAS_ORDEM: SistemaCorporal[] = [
  'musculoesqueletico', 'nervoso', 'digestorio', 'circulatorio',
  'respiratorio', 'endocrino', 'urinario',
  'reprodutor', 'tegumentar', 'linfatico', 'sensorial'
];
const SISTEMAS_INICIAIS: SistemaCorporal[] = [...SISTEMAS_ORDEM];
const SISTEMA_CONFIG: Record<SistemaCorporal, { label: string; icon: any; color: string }> = {
  musculoesqueletico: { label: 'Musculoesquelético', icon: Zap, color: 'purple' },
  nervoso: { label: 'Nervoso', icon: Brain, color: 'blue' },
  digestorio: { label: 'Digestório', icon: Stethoscope, color: 'orange' },
  circulatorio: { label: 'Circulatório', icon: Heart, color: 'red' },
  respiratorio: { label: 'Respiratório', icon: Wind, color: 'cyan' },
  endocrino: { label: 'Endócrino', icon: Dna, color: 'yellow' },
  urinario: { label: 'Urinário', icon: Droplets, color: 'indigo' },
  reprodutor: { label: 'Reprodutor', icon: Heart, color: 'pink' },
  tegumentar: { label: 'Tegumentar', icon: Shield, color: 'stone' },
  linfatico: { label: 'Linfático', icon: Waves, color: 'lime' },
  sensorial: { label: 'Sensorial', icon: Eye, color: 'emerald' },
};

const SISTEMA_CHART_COLOR: Record<SistemaCorporal, string> = {
  musculoesqueletico: '#a855f7',
  nervoso: '#3b82f6',
  digestorio: '#f97316',
  circulatorio: '#ef4444',
  respiratorio: '#06b6d4',
  endocrino: '#eab308',
  urinario: '#6366f1',
  reprodutor: '#ec4899',
  tegumentar: '#78716c',
  linfatico: '#84cc16',
  sensorial: '#10b981',
};

const SISTEMA_LABEL: Record<SistemaCorporal, string> = Object.fromEntries(
  Object.entries(SISTEMA_CONFIG).map(([k, v]) => [k, v.label])
) as any;
const STATUS_LABEL: Record<StatusEvento, string> = {
  ativo: 'Ativo', em_tratamento: 'Em tratamento', resolvido: 'Resolvido', cronico: 'Crônico',
};
const ORIGEM_LABEL: Record<OrigemAchado, string> = {
  subjetivo_myid: 'MyID (paciente)',
  exame_clinico: 'Exame clínico',
  exame_imagem: 'Exame de imagem',
  voz_ia: 'Voz / IA',
  autocadastro_paciente: 'Autocadastro',
  outro: 'Outro',
};

// ── Pesos clínicos do Índice de Homeostase ──
// A severidade pondera de forma não-linear (achado severo pesa ~5x um leve,
// no mesmo espírito das bandas não-lineares do MyID-100), o peso é modulado
// pelo status clínico (ativo > crônico > em tratamento) e por confirmação:
// um relato do paciente ainda não validado pelo profissional pesa a metade
// até ser confirmado como achado clínico (ver fluxo de confirmação no painel).
const PESO_SEVERIDADE: Record<number, number> = { 1: 1, 2: 2.5, 3: 5 };
const PESO_STATUS: Record<StatusEvento, number> = { ativo: 1, cronico: 0.8, em_tratamento: 0.6, resolvido: 0 };
const PESO_SINAL_MYID = 0.5; // relato subjetivo ainda não correlacionado a achado clínico
const CARGA_MAXIMA_POR_SISTEMA = 20; // evita que um único sistema domine o índice global

function pesoConfirmacao(e: EventoAnatomico): number {
  return e.tipo_diagnostico === 'relato_paciente' ? 0.5 : 1;
}

function cargaEvento(e: EventoAnatomico): number {
  return (PESO_SEVERIDADE[e.severidade] ?? 1) * (PESO_STATUS[e.status] ?? 0) * pesoConfirmacao(e);
}

interface Props {
  pacienteId: string;
  isProfessional?: boolean;
}

export default function AvatarClinicoCard({ pacienteId, isProfessional = true }: Props) {
  const { data: eventos = [], isLoading } = useEventosAnatomicos(pacienteId);
  const saveMut = useSaveEventoAnatomico();
  const deleteMut = useDeleteEventoAnatomico(pacienteId);

  const [modoSimplificado, setModoSimplificado] = useState(!isProfessional);
  const [sistemasAtivos, setSistemasAtivos] = useState<SistemaCorporal[]>(SISTEMAS_INICIAIS);
  const [hoveredSistema, setHoveredSistema] = useState<SistemaCorporal | null>(null);
  const [view, setView] = useState<'front' | 'back'>('front');
  const [sheetRegiao, setSheetRegiao] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<EventoAnatomico> | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncData, setSyncData] = useState<{ regiao_id: string; intensidade: number }[] | null>(null);

  const { data: lastMyIDData } = useQuery({
    queryKey: ['last-myid-data-full', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avaliacoes_identidade')
        .select('*')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      
      const dados = data.dados_avaliacao as any;
      const painMap = dados?.painMap || dados?.mapa_dor || dados?.resultado?.painMap || null;
      const painRegions = painMap ? Object.entries(painMap)
        .map(([id, val]) => ({ regiao_id: id, intensidade: Number(val) }))
        .filter(i => i.intensidade > 0) : [];

      const respostas = dados || {};
      const analysis = data.myid_analysis as any;
      const componentScores = analysis?.componentScores || analysis?.component_scores || {};
      
      // Nova abordagem: Extração exaustiva de texto de toda a avaliação + análise
      const textoCompleto = extrairTextoDeObjeto(dados) + " " + extrairTextoDeObjeto(analysis);
      const sintomasDetectados = encontrarSintomasEmTexto(textoCompleto);

      
      const sinalRegions: { regiao_id: string; sinal: string; sistema: string }[] = [];
      
      sintomasDetectados.forEach(s => {
        if (!sinalRegions.some(sr => sr.regiao_id === s.regiao_id && sr.sistema === s.sistema)) {
          sinalRegions.push({ 
            regiao_id: s.regiao_id, 
            sinal: `Detectado: ${s.termo}`,
            sistema: s.sistema
          });
        }
      });

      return { 
        painRegions, 
        sinalRegions, 
        scores: componentScores,
        raw: data,
        respostas,
        textoCompleto
      };

    },
    enabled: !!pacienteId,
  });

  const painRegions = lastMyIDData?.painRegions || [];
  const sinalRegions = lastMyIDData?.sinalRegions || [];
  const myidScores = lastMyIDData?.scores || {};

  const eventosFiltrados = useMemo(
    () => eventos.filter(e => sistemasAtivos.includes(e.sistema)),
    [eventos, sistemasAtivos],
  );

  // Reconstrói a carga clínica de cada sistema mês a mês a partir do ciclo de vida
  // dos achados (data_inicio/data_resolucao). Como o registro não guarda histórico de
  // mudanças de severidade/status, usa o valor ATUAL como aproximação para os meses em
  // que o achado esteve ativo — suficiente para mostrar tendência (subiu/desceu/estável),
  // não um valor retroativo exato.
  const evolucaoMensal = useMemo(() => {
    const eventosBase = eventosFiltrados.filter(e => modoSimplificado ? e.visivel_paciente : true);
    if (eventosBase.length === 0) return { data: [] as Record<string, any>[], sistemasComCarga: [] as SistemaCorporal[] };

    const MESES = 6;
    const hoje = new Date();
    const cortes = Array.from({ length: MESES }, (_, idx) => {
      const i = MESES - 1 - idx;
      return i === 0 ? hoje : new Date(hoje.getFullYear(), hoje.getMonth() - i + 1, 0);
    });

    const data = cortes.map(dataCorte => {
      const ponto: Record<string, any> = {
        mes: dataCorte.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      };
      SISTEMAS_ORDEM.forEach(s => {
        const carga = eventosBase
          .filter(e => e.sistema === s)
          .filter(e => {
            const inicio = new Date(e.data_inicio);
            if (inicio > dataCorte) return false;
            if (e.status === 'resolvido' && e.data_resolucao) {
              return new Date(e.data_resolucao) > dataCorte;
            }
            return true;
          })
          .reduce((acc, e) => acc + cargaEvento(e), 0);
        ponto[SISTEMA_CONFIG[s].label] = Math.round(carga * 10) / 10;
      });
      return ponto;
    });

    const ultimoPonto = data[data.length - 1];
    const sistemasComCarga = SISTEMAS_ORDEM
      .filter(s => data.some(p => p[SISTEMA_CONFIG[s].label] > 0))
      .sort((a, b) => (ultimoPonto[SISTEMA_CONFIG[b].label] || 0) - (ultimoPonto[SISTEMA_CONFIG[a].label] || 0))
      .slice(0, 4);

    return { data, sistemasComCarga };
  }, [eventosFiltrados, modoSimplificado]);

  // dominante por região = maior severidade (e não-resolvido prioritário)
  const corPorRegiao = useMemo(() => {
    const map: Record<string, string> = {};
    const peso = (e: EventoAnatomico) =>
      (e.status === 'resolvido' ? 0 : 10) + e.severidade;
    
    // Primeiro, aplica cores dos achados clínicos (objetivo)
    eventosFiltrados.forEach(ev => {
      const prev = map[ev.regiao_id + '__peso'];
      if (!prev || (peso(ev) > Number(prev))) {
        map[ev.regiao_id] = corEvento(ev);
        map[ev.regiao_id + '__peso'] = String(peso(ev));
      }
    });

    // Depois, sobrepõe indicação de dor do MyID se não houver achado clínico ainda
    // APENAS se o sistema musculoesquelético estiver ativo
    if (sistemasAtivos.includes('musculoesqueletico')) {
      painRegions.forEach(item => {
        const regId = item.regiao_id;
        if (!map[regId]) {
          const intensity = item.intensidade;
          const alpha = 0.2 + (intensity / 10) * 0.4;
          map[regId] = `rgba(168, 85, 247, ${alpha})`; 
          map[regId + '__is_myid'] = 'true';
        }
      });
    }

    // Sincroniza Sinais do Corpo (Nervoso/Visceral) do MyID
    // Filtra pelos sistemas ativos
    sinalRegions.forEach(item => {
      // Determina se o sinal pertence a um sistema que está ATIVO no momento
      const isSystemActive = sistemasAtivos.includes(item.sistema as any);
      
      if (isSystemActive && !map[item.regiao_id]) {
        // Define a cor baseada no sistema
        switch (item.sistema) {
          case 'nervoso':
            map[item.regiao_id] = 'rgba(14, 165, 233, 0.4)'; // Azul
            break;
          case 'digestorio':
            map[item.regiao_id] = 'rgba(249, 115, 22, 0.4)'; // Laranja
            break;
          case 'musculoesqueletico':
            map[item.regiao_id] = 'rgba(168, 85, 247, 0.4)'; // Roxo
            break;
          case 'circulatorio':
            map[item.regiao_id] = 'rgba(239, 68, 68, 0.4)'; // Vermelho
            break;
          case 'respiratorio':
            map[item.regiao_id] = 'rgba(6, 182, 212, 0.4)'; // Ciano
            break;
          default:
            map[item.regiao_id] = 'rgba(14, 165, 233, 0.4)';
        }
        map[item.regiao_id + '__is_sinal'] = 'true';
      }
    });


    // Sincroniza Cirurgias (Vermelho Escuro/Trauma) - APENAS no digestório ou reprodutor
    const cirurgias = lastMyIDData?.respostas?.bloco_6_abdominal_surgeries || [];
    if (cirurgias.length > 0 && !map['pelve'] && (sistemasAtivos.includes('digestorio') || sistemasAtivos.includes('reprodutor'))) {
       map['pelve'] = 'rgba(220, 38, 38, 0.2)'; 
    }

    return map;
  }, [eventosFiltrados, painRegions, sinalRegions, lastMyIDData]);

  const regioesBase = REGIONS.filter(r => r.view === view);
  const regioesViscerais = VISCERAL_REGIONS.filter(r => 
    r.view === view && (
      r.sistemas.some(s => sistemasAtivos.includes(s as any)) ||
      sinalRegions.some(sr => sr.regiao_id === r.id)
    )
  );

  const eventosDaRegiao = (rid: string) => eventosFiltrados.filter(e => e.regiao_id === rid);

  const abrirSheet = (rid: string) => {
    if (modoSimplificado) return;
    setSheetRegiao(rid);
    setEditing(null);
    // Identifica o sistema predominante da região para sugerir no formulário
    const regVisceral = VISCERAL_REGIONS.find(v => v.id === rid);
    if (regVisceral) {
      setIsSyncing(true); // Aba de sinais se for visceral
    } else {
      setIsSyncing(false); // Aba de dor se for musculoesquelético
    }
  };

  const novoAchado = () => {
    const regVisceral = VISCERAL_REGIONS.find(v => v.id === sheetRegiao);
    setEditing({
      paciente_id: pacienteId,
      regiao_id: sheetRegiao!,
      sistema: (regVisceral?.sistemas[0] as any) || 'musculoesqueletico',
      origem: 'exame_clinico',
      tipo_achado: '',
      severidade: 1,
      status: 'ativo',
      visivel_paciente: false,
      data_inicio: new Date().toISOString().slice(0, 10),
    });
  };

  const regiao = sheetRegiao ? [...REGIONS, ...VISCERAL_REGIONS].find(r => r.id === sheetRegiao) : null;
  const estruturasCat = regiao ? (STRUCTURES[regiao.id] || (VISCERAL_STRUCTURES as any)[regiao.id] || {}) : {};
  const todasEstruturas = Object.values(estruturasCat).flat() as string[];

  const handleSave = async () => {
    if (!editing?.tipo_achado?.trim()) return;
    await saveMut.mutateAsync(editing as any);
    setEditing(null);
  };

  const handleSyncImport = async (item: any) => {
    await saveMut.mutateAsync({
      paciente_id: pacienteId,
      regiao_id: item.regiao_id,
      sistema: (item.sistema as any) || 'musculoesqueletico',
      origem: 'subjetivo_myid',
      tipo_achado: item.sinal || `Relato MyID: Dor/Desconforto (${item.intensidade}/10)`,
      severidade: item.intensidade >= 7 ? 3 : item.intensidade >= 4 ? 2 : 1,
      status: 'ativo',
      visivel_paciente: true,
      data_inicio: new Date().toISOString().slice(0, 10),
      notas_clinicas: `Importado automaticamente da Impressão Digital MyID. ${item.sinal ? `Sinal: ${item.sinal}` : `Intensidade: ${item.intensidade}/10`}`,
    });
    setSyncData(prev => prev ? prev.filter(i => i.regiao_id !== item.regiao_id) : null);
  };


  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Stethoscope className="icon-sm shrink-0" />
          Avatar Clínico Anatômico
          <div className="ml-auto flex items-center gap-1.5">
            {(painRegions.length > 0 || sinalRegions.length > 0) && (
              <Button 
                variant="outline" 
                size="sm" 
                className="h-7 text-[10px] gap-1 px-2 border-primary/30 text-primary hover:bg-primary/5"
                onClick={() => setSyncData([...painRegions, ...sinalRegions.map(s => ({ regiao_id: s.regiao_id, intensidade: 5, sinal: s.sinal, sistema: s.sistema }))])}
              >
                <RefreshCcw className="h-3 w-3" />
                Sincronizar MyID
              </Button>
            )}

            <Badge variant="outline" className="text-[10px]">Sprint F1+ (Visceral)</Badge>
          </div>
        </CardTitle>
        <div className="flex justify-between items-center mt-1">
          <p className="text-xs text-muted-foreground">
            Mapa de achados clínicos georreferenciados.
          </p>
          <div className="flex items-center gap-2">
            <Label htmlFor="modo-view" className="text-[10px] cursor-pointer">
              {modoSimplificado ? "Visão Paciente" : "Visão Profissional"}
            </Label>
            <Switch 
              id="modo-view"
              checked={!modoSimplificado} 
              onCheckedChange={(v) => setModoSimplificado(!v)}
              className="h-4 w-8"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Tabs defaultValue="geral" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="geral" className="text-xs">Visão Geral</TabsTrigger>
            <TabsTrigger value="mapa" className="text-xs">Mapa Corporal</TabsTrigger>
            <TabsTrigger value="achados" className="text-xs">Achados</TabsTrigger>
            <TabsTrigger value="evolucao" className="text-xs">Evolução</TabsTrigger>
          </TabsList>

          <TabsContent value="geral" className="space-y-3 pt-3">
        {/* Toggles de sistema - Ecossistema Dinâmico com Ranking de Acometimento */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ranking de Sistemas</span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => setSistemasAtivos(SISTEMAS_ORDEM)}
              >
                Ver Todos
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => setSistemasAtivos([])}
              >
                Limpar
              </Button>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-1.5">
            {useMemo(() => {
              const systemScores = SISTEMAS_ORDEM.map(s => {
                const evsDoSistema = eventos.filter(e => e.sistema === s && e.status !== 'resolvido');
                let score = evsDoSistema.reduce((acc, curr) => acc + cargaEvento(curr), 0);

                // Mapeamento preciso de Sinais MyID para Scores de Sistema
                const myidSinaisDoSistema = sinalRegions.filter(sr => {
                  const isNervous = ['bruxismo', 'zumbido', 'sensibilidade_luz', 'cefaleia', 'tontura', 'Uso de Antidepressivo'].includes(sr.sinal);
                  const isDigestive = ['ma_digestao', 'bloating', 'empachamento', 'azia', 'queimacao_estomago', 'nausea', 'vomito', 'gases', 'refluxo', 'gastrite', 'ibs', 'constipation', 'diarrhea'].some(term => sr.sinal.toLowerCase().includes(term));
                  const isResp = ['falta_ar', 'shortness_breath', 'tosse'].some(term => sr.sinal.toLowerCase().includes(term));
                  const isCirc = ['palpitacao', 'palpitations', 'taquicardia'].some(term => sr.sinal.toLowerCase().includes(term));
                  const isUrin = ['dor_urinar', 'urinary_pain', 'frequencia_urinaria', 'urinary_frequency'].some(term => sr.sinal.toLowerCase().includes(term));
                  
                  if (s === 'nervoso') return isNervous;
                  if (s === 'digestorio') return isDigestive;
                  if (s === 'respiratorio') return isResp;
                  if (s === 'circulatorio') return isCirc;
                  if (s === 'urinario') return isUrin;
                  
                  // Fallback regional para MyID
                  const regVisceral = VISCERAL_REGIONS.find(v => v.id === sr.regiao_id);
                  return regVisceral?.sistemas.includes(s);
                });

                if (s === 'musculoesqueletico') {
                  // Pondera pela intensidade relatada (0-10) em vez de só contar regiões
                  score += painRegions.reduce((acc, p) => acc + (Number(p.intensidade || 0) / 10) * PESO_SINAL_MYID * 2, 0);
                  const queixasTexto = sinalRegions.filter(sr => sr.regiao_id === 'peitoral' || sr.regiao_id === 'dorsal');
                  score += queixasTexto.length * PESO_SINAL_MYID * 2;
                }

                score += myidSinaisDoSistema.length * PESO_SINAL_MYID;

                return { sistema: s, score, count: evsDoSistema.length + myidSinaisDoSistema.length };
              }).sort((a, b) => b.score - a.score);

              // Índice de Homeostase: soma a carga clínica de cada sistema (capada para
              // que um único sistema não domine o índice) e subtrai de 100. A carga de
              // cada sistema já reflete severidade, status e confirmação clínica — ver
              // cargaEvento() acima.
              const totalScore = systemScores.reduce((acc, curr) => acc + Math.min(curr.score, CARGA_MAXIMA_POR_SISTEMA), 0);
              const homeostase = Math.max(0, Math.min(100, 100 - totalScore));

              return (
                <div className="w-full space-y-4">
                  <div className="bg-muted/30 p-3 rounded-lg border border-border/50 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                        Índice de Homeostase
                        <Info
                          className="h-3 w-3 text-muted-foreground/70 cursor-help"
                          title="Calculado a partir da carga clínica de cada sistema (achados ativos ponderados por severidade, status e confirmação profissional), capada por sistema para evitar distorção. Não substitui o MyID-100."
                        />
                      </p>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-xl font-black",
                          homeostase > 80 ? "text-emerald-600" : homeostase > 50 ? "text-amber-600" : "text-red-600"
                        )}>
                          {homeostase.toFixed(0)}%
                        </span>
                        <div className="h-1.5 w-24 bg-border rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full transition-all duration-1000",
                              homeostase > 80 ? "bg-emerald-500" : homeostase > 50 ? "bg-amber-500" : "bg-red-500"
                            )}
                            style={{ width: `${homeostase}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Alertas Ativos</p>
                      <span className="text-lg font-bold">{systemScores.filter(s => s.score > 0).length} Sistemas</span>
                    </div>
                  </div>

                  {(() => {
                    const pendentes = eventos.filter(
                      (e) => e.tipo_diagnostico === 'relato_paciente' && e.status !== 'resolvido'
                    );
                    if (pendentes.length === 0) return null;
                    return (
                      <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase text-amber-800">
                          <Badge variant="warning" size="sm">{pendentes.length}</Badge>
                          Relatos do paciente aguardando confirmação
                        </div>
                        <div className="space-y-1.5">
                          {pendentes.map((ev) => (
                            <div key={ev.id} className="flex items-center justify-between gap-2 rounded-md bg-white/70 px-2 py-1.5 text-sm">
                              <span className="truncate">
                                {ev.tipo_achado} <span className="text-xs text-muted-foreground">({ev.regiao_id})</span>
                              </span>
                              <div className="flex shrink-0 gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => saveMut.mutate({
                                    id: ev.id, paciente_id: pacienteId, regiao_id: ev.regiao_id,
                                    tipo_achado: ev.tipo_achado, tipo_diagnostico: 'achado_clinico',
                                  })}
                                >
                                  <Check className="mr-1 h-3 w-3" /> Confirmar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => saveMut.mutate({
                                    id: ev.id, paciente_id: pacienteId, regiao_id: ev.regiao_id,
                                    tipo_achado: ev.tipo_achado, status: 'resolvido',
                                    notas_clinicas: `${ev.notas_clinicas || ''}\nDescartado pelo profissional em ${new Date().toLocaleDateString('pt-BR')}.`,
                                  })}
                                >
                                  Descartar
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex flex-wrap gap-2">
                    {systemScores.map(({ sistema: s, score, count }) => {
                      const active = sistemasAtivos.includes(s);
                      const config = SISTEMA_CONFIG[s];
                      const Icon = config.icon;
                      
                      let statusClasses = "";
                      let alertBadge = null;

                      if (score >= 5) {
                        statusClasses = `border-red-500 text-red-700 bg-red-50 ring-1 ring-red-200 animate-pulse-subtle`;
                        alertBadge = <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-600 rounded-full border border-white" />;
                      } else if (score >= 2) {
                        statusClasses = `border-amber-500 text-amber-700 bg-amber-50`;
                        alertBadge = <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border border-white" />;
                      } else if (score > 0) {
                        statusClasses = `border-emerald-500 text-emerald-700 bg-emerald-50`;
                      } else {
                        statusClasses = `border-border/50 text-muted-foreground bg-background opacity-60`;
                      }

                      return (
                        <button
                          key={s}
                          type="button"
                          onMouseEnter={() => setHoveredSistema(s)}
                          onMouseLeave={() => setHoveredSistema(null)}
                          onClick={() => {
                            setSistemasAtivos(prev =>
                              prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
                            );
                          }}
                          className={cn(
                            "relative text-[10px] px-3 py-2 rounded-lg border transition-all flex items-center gap-2 font-bold uppercase tracking-tight hover:scale-105 active:scale-95",
                            active ? "ring-2 ring-primary ring-offset-1 shadow-md z-10 opacity-100 scale-105" : "opacity-90",
                            hoveredSistema === s && "ring-2 ring-primary border-primary",
                            statusClasses
                          )}
                        >
                          {alertBadge}
                          <Icon className={cn("w-3.5 h-3.5", active ? `text-${config.color}-600` : "")} />
                          {config.label}
                          {count > 0 && (
                            <span className={cn(
                              "ml-1 px-1.5 min-w-[18px] h-4 rounded-full flex items-center justify-center text-[9px] font-black shadow-sm",
                              score >= 5 ? "bg-red-200 text-red-900 border border-red-300" : "bg-foreground/10"
                            )}>
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Resumo Dinâmico dos Sistemas Selecionados/Hovered */}
                  {(hoveredSistema || sistemasAtivos.length > 0) && (
                    <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="flex flex-col gap-2">
                        {(() => {
                          const sysToShow = hoveredSistema || (sistemasAtivos.length === 1 ? sistemasAtivos[0] : null);
                          
                          if (sysToShow) {
                            const config = SISTEMA_CONFIG[sysToShow];
                            const Icon = config.icon;
                            
                            // Busca achados específicos do sistema (Clínicos + MyID)
                            const achadosClinicos = eventos.filter(e => e.sistema === sysToShow && e.status !== 'resolvido');
                            
                            // Sinais do MyID para este sistema
                            const achadosMyID = sinalRegions.filter(sr => sr.sistema === sysToShow);


                            // Flags específicas do sistema
                            const flagsSistema: string[] = [];
                            if (sysToShow === 'musculoesqueletico') {
                              if (lastMyIDData?.respostas?.bloco_6_axial_trauma) flagsSistema.push('Histórico de Trauma Axial');
                              if (lastMyIDData?.respostas?.bloco_6_muscle_relaxant) flagsSistema.push('Uso de Relaxante Muscular');
                            }
                            if (sysToShow === 'digestorio') {
                              if (lastMyIDData?.respostas?.bloco_6_abdominal_surgeries?.length > 0) {
                                lastMyIDData.respostas.bloco_6_abdominal_surgeries.forEach((s: string) => flagsSistema.push(`Cirurgia Abdominal: ${s}`));
                              }
                            }
                            if (sysToShow === 'nervoso') {
                              if (lastMyIDData?.respostas?.bloco_6_antidepressant) flagsSistema.push('Uso de Antidepressivo');
                            }
                            
                            // Dores do MyID para o sistema musculoesquelético
                            const doresMyID = sysToShow === 'musculoesqueletico' 
                              ? painRegions.map(p => ({ ...p, sinal: `Dor em ${REGIONS.find(r => r.id === p.regiao_id)?.label || p.regiao_id} (Intensidade: ${p.intensidade}/10)` }))
                              : [];
                            
                            const todosRelatosMyID = [
                              ...achadosMyID.map(a => a.sinal),
                              ...doresMyID.map(d => d.sinal),
                              ...flagsSistema
                            ];
                            
                            return (
                              <div className="space-y-3">
                                <div className="flex gap-3 items-center border-b border-primary/10 pb-2">
                                  <div className={cn("p-1.5 rounded-lg bg-background border border-primary/10", `text-${config.color}-500`)}>
                                    <Icon className="w-4 h-4" />
                                  </div>
                                  <p className="text-xs font-black uppercase tracking-wider">{config.label}</p>
                                </div>

                                <div className="space-y-3">
                                  {/* MyID Findings - Relatos Subjetivos */}
                                  <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-sky-600 uppercase flex items-center gap-1">
                                      <User className="w-3 h-3" /> Relatos do Paciente (MyID):
                                    </p>
                                    {todosRelatosMyID.length === 0 ? (
                                      <p className="text-[11px] text-muted-foreground italic pl-4">Nenhum relato subjetivo registrado.</p>
                                    ) : (
                                      <div className="space-y-1 pl-4">
                                        {todosRelatosMyID.map((s, idx) => (
                                          <div key={`myid-${idx}`} className="flex items-start gap-2">
                                            <div className="w-1 h-1 rounded-full mt-1.5 shrink-0 bg-sky-400" />
                                            <p className="text-[11px] leading-tight text-sky-800">
                                              {s}
                                            </p>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Clinical Evaluation Findings - Avaliação Presencial */}
                                  <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-amber-600 uppercase flex items-center gap-1">
                                      <Stethoscope className="w-3 h-3" /> Achados da Avaliação Presencial:
                                    </p>
                                    {achadosClinicos.length === 0 ? (
                                      <p className="text-[11px] text-muted-foreground italic pl-4">Nenhum achado clínico registrado nesta avaliação.</p>
                                    ) : (
                                      <div className="space-y-1 pl-4">
                                        {achadosClinicos.map((e, idx) => (
                                          <div key={`clin-${idx}`} className="flex items-start gap-2">
                                            <div className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: corEvento(e) }} />
                                            <div className="text-[11px] leading-tight">
                                              <span className="font-bold">{[...REGIONS, ...VISCERAL_REGIONS].find(r => r.id === e.regiao_id)?.label}:</span> {e.tipo_achado}
                                              {e.notas_clinicas && <p className="text-[10px] text-muted-foreground mt-0.5 italic">"{e.notas_clinicas}"</p>}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div className="space-y-2">
                              <p className="text-[9px] font-bold text-muted-foreground uppercase">Resumo de Achados ({sistemasAtivos.length} sistemas)</p>
                              <div className="grid grid-cols-1 gap-2">
                                {sistemasAtivos.slice(0, 3).map(s => {
                                  const count = eventos.filter(e => e.sistema === s && e.status !== 'resolvido').length;
                                  return (
                                    <div key={s} className="flex items-center justify-between bg-background/50 p-1.5 rounded border border-border/30">
                                      <div className="flex items-center gap-2">
                                        <div className={cn("w-1.5 h-1.5 rounded-full", `bg-${SISTEMA_CONFIG[s].color}-500`)} />
                                        <span className="text-[10px] font-bold">{SISTEMA_CONFIG[s].label}</span>
                                      </div>
                                      <span className="text-[9px] text-muted-foreground">{count} achados clínicos</span>
                                    </div>
                                  );
                                })}
                                {sistemasAtivos.length > 3 && <span className="text-[9px] text-muted-foreground text-center">...e mais {sistemasAtivos.length - 3} sistemas ativos</span>}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              );
            }, [eventos, sistemasAtivos, painRegions, sinalRegions, hoveredSistema])}
          </div>
        </div>
          </TabsContent>

          <TabsContent value="mapa" className="pt-3">
        <div className="relative">
          {/* Toggle frente / costas */}
          <div className="flex gap-1 bg-muted/40 rounded-lg p-1 w-fit mx-auto mb-4">
          {(['front', 'back'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`text-[11px] px-3 py-1 rounded-md transition ${
                view === v ? 'bg-background shadow-sm font-semibold' : 'text-muted-foreground'
              }`}
            >
              {v === 'front' ? 'Anterior' : 'Posterior'}
            </button>
          ))}
        </div>

        {/* Silhueta */}
        <div className="mx-auto" style={{ maxWidth: 260 }}>
          <svg viewBox="0 0 240 520" className="w-full h-auto drop-shadow-2xl" style={{ maxHeight: 480 }}>
            <defs>
              <clipPath id="avc-clip">
                <path d={FRONT_OUTLINE} />
              </clipPath>
              <filter id="glow">
                <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              <radialGradient id="organ-gradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <stop offset="0%" stopColor="white" stopOpacity="0.3" />
                <stop offset="100%" stopColor="black" stopOpacity="0.1" />
              </radialGradient>
            </defs>
            <style>
              {`
                @keyframes pulse-organ {
                  0% { transform: scale(1); opacity: 0.8; }
                  50% { transform: scale(1.02); opacity: 1; }
                  100% { transform: scale(1); opacity: 0.8; }
                }
                .pulse-organ {
                  animation: pulse-organ 2s infinite ease-in-out;
                  transform-origin: center;
                }
              `}
            </style>
            <g clipPath="url(#avc-clip)">
              <path d={FRONT_OUTLINE} fill="hsl(var(--muted))" opacity={0.35} />
              
              {/* Camada Base (Musculoesquelético/Geral) */}
              {sistemasAtivos.includes('musculoesqueletico') && regioesBase.map(r => {
                const fill = corPorRegiao[r.id];
                const isHoveredSystem = hoveredSistema === 'musculoesqueletico';
                return (
                  <path
                    key={r.id}
                    d={r.d}
                    fill={fill || (isHoveredSystem ? 'rgba(168, 85, 247, 0.2)' : 'transparent')}
                    fillOpacity={fill ? 0.7 : isHoveredSystem ? 0.5 : 0}
                    stroke={isHoveredSystem ? 'purple' : "hsl(var(--border))"}
                    strokeWidth={isHoveredSystem ? 1.2 : 0.6}
                    className="cursor-pointer hover:opacity-80 transition-all"
                    onClick={() => abrirSheet(r.id)}
                  />
                );
              })}

              {/* Camada Visceral e Outros Sistemas Individualizados */}
              {regioesViscerais.map(r => {
                const fill = corPorRegiao[r.id];
                const belongsToActiveSystem = r.sistemas.some(s => sistemasAtivos.includes(s as any));
                const isHoveredSystem = r.sistemas.some(s => hoveredSistema === s);
                
                if (!belongsToActiveSystem && !isHoveredSystem) return null;

                const severityScore = Number(corPorRegiao[r.id + '__peso'] || 0);
                const isUrgent = severityScore >= 13; // status ativo (10) + severidade alta

                return (
                  <g key={r.id} className={cn(isUrgent && "pulse-organ")}>
                    <path
                      d={r.d}
                      fill={fill || (isHoveredSystem ? 'rgba(14, 165, 233, 0.3)' : 'hsl(var(--background))')}
                      fillOpacity={fill ? 0.9 : 0.4}
                      stroke={isHoveredSystem ? 'var(--primary)' : fill ? 'white' : 'hsl(var(--muted-foreground))'}
                      strokeWidth={isHoveredSystem ? 1.5 : 0.8}
                      filter={fill ? "url(#glow)" : undefined}
                      className="cursor-pointer hover:brightness-110 transition-all"
                      onClick={() => abrirSheet(r.id)}
                    >
                      <title>{r.label}</title>
                    </path>
                    {/* Efeito de Volume/Gradiente nos Órgãos */}
                    <path
                      d={r.d}
                      fill="url(#organ-gradient)"
                      pointerEvents="none"
                      opacity={0.5}
                    />
                  </g>
                );
              })}
            </g>
            <path d={FRONT_OUTLINE} fill="none" stroke="hsl(var(--foreground))" strokeWidth={1.2} opacity={0.6} />
          </svg>
        </div>

        {/* Legenda */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] justify-center text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#dc2626]" /> Ativo grave</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#fb923c]" /> Ativo leve</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#f97316]" /> Em tratamento</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#eab308]" /> Crônico</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#9ca3af]" /> Resolvido</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500/50" /> Queixa de Dor</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500/50" /> Sinais do Corpo</span>
        </div>
      </div>
          </TabsContent>

          <TabsContent value="achados" className="pt-3">
        {/* Lista resumida */}
        {isLoading ? (
          <p className="text-xs text-muted-foreground text-center py-2">Carregando…</p>
        ) : (eventosFiltrados.filter(e => modoSimplificado ? e.visivel_paciente : true).length === 0) ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            Nenhum achado {modoSimplificado ? 'visível' : 'registrado'} para este sistema.
          </p>
        ) : (
          <div className="space-y-1.5">
            {eventosFiltrados
              .filter(e => modoSimplificado ? e.visivel_paciente : true)
              .slice(0, 6)
              .map(ev => {
              const reg = [...REGIONS, ...VISCERAL_REGIONS].find(r => r.id === ev.regiao_id);
              return (
                <button
                  key={ev.id}
                  disabled={modoSimplificado}
                  onClick={() => abrirSheet(ev.regiao_id)}
                  className={`w-full flex items-center gap-2 text-left p-2 rounded-lg transition ${
                    modoSimplificado ? 'cursor-default' : 'hover:bg-muted/40'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: corEvento(ev) }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {ev.tipo_achado} <span className="text-muted-foreground">· {reg?.label || ev.regiao_id}</span>
                    </p>
                    {!modoSimplificado && (
                      <p className="text-[10px] text-muted-foreground">
                        {STATUS_LABEL[ev.status]} · {SISTEMA_LABEL[ev.sistema]} · {ORIGEM_LABEL[ev.origem]}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
          </TabsContent>

          <TabsContent value="evolucao" className="pt-3">
            {evolucaoMensal.sistemasComCarga.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                Ainda não há achados ativos suficientes para mostrar evolução por sistema.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 shrink-0" />
                  Carga clínica dos sistemas mais afetados, últimos 6 meses (estimada a partir do início/fim de cada achado).
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={evolucaoMensal.data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} width={28} />
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    {evolucaoMensal.sistemasComCarga.map(s => (
                      <Area
                        key={s}
                        type="monotone"
                        dataKey={SISTEMA_CONFIG[s].label}
                        stroke={SISTEMA_CHART_COLOR[s]}
                        fill={SISTEMA_CHART_COLOR[s]}
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Sheet de região */}
      <Sheet open={!!sheetRegiao} onOpenChange={(o) => { if (!o) { setSheetRegiao(null); setEditing(null); } }}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {regiao?.label || 'Região'}
              {VISCERAL_REGIONS.some(vr => vr.id === regiao?.id) && (
                <Badge variant="secondary" className="text-[9px] uppercase">Órgão Interno</Badge>
              )}
            </SheetTitle>
          </SheetHeader>

          {!editing && (
            <div className="mt-4 space-y-4">
              {/* Sinais Detectados pelo MyID */}
              {(() => {
                const sinaisDaRegiao = sinalRegions.filter(sr => sr.regiao_id === sheetRegiao);
                if (sinaisDaRegiao.length === 0) return null;
                return (
                  <div className="bg-sky-50 border border-sky-100 rounded-lg p-3 space-y-2">
                    <p className="text-[10px] font-bold text-sky-600 uppercase flex items-center gap-1">
                      <User className="w-3 h-3" /> Detectado via MyID:
                    </p>
                    <div className="space-y-1">
                      {sinaisDaRegiao.map((s, idx) => (
                        <div key={`sinal-reg-${idx}`} className="flex items-center justify-between">
                          <p className="text-xs text-sky-800">{s.sinal}</p>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-sky-600 hover:bg-sky-200"
                            onClick={() => {
                              const regVisceral = VISCERAL_REGIONS.find(v => v.id === s.regiao_id);
                              setEditing({
                                paciente_id: pacienteId,
                                regiao_id: s.regiao_id,
                                sistema: (s.sistema as any) || (regVisceral?.sistemas[0] as any) || 'musculoesqueletico',
                                origem: 'subjetivo_myid',
                                tipo_achado: s.sinal,
                                severidade: 2,
                                status: 'ativo',
                                visivel_paciente: true,
                                data_inicio: new Date().toISOString().slice(0, 10),
                                notas_clinicas: `Sinal detectado automaticamente via processamento MyID: ${s.sinal}`,
                              });
                            }}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {sheetRegiao && eventosDaRegiao(sheetRegiao).length === 0 && sinalRegions.filter(sr => sr.regiao_id === sheetRegiao).length === 0 && (
                <div className="text-center py-8 border-2 border-dashed rounded-xl border-muted">
                  <Activity className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">Sem achados nessa região.</p>
                </div>
              )}

              {sheetRegiao && eventosDaRegiao(sheetRegiao).map(ev => (
                <div key={ev.id} className="border border-border/50 rounded-lg p-3 space-y-2 hover:border-primary/30 transition-colors">
                  <div className="flex items-start gap-2">
                    <span className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ background: corEvento(ev) }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <p className="text-sm font-semibold">{ev.tipo_achado}</p>
                        <div className="flex gap-1">
                          {ev.visivel_paciente ? (
                            <User className="h-3 w-3 text-green-500" />
                          ) : (
                            <ShieldCheck className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground flex flex-wrap gap-x-2 gap-y-1 mt-1">
                        <span className="bg-muted px-1.5 py-0.5 rounded">{STATUS_LABEL[ev.status]}</span>
                        <span>Sev: {ev.severidade}/4</span>
                        <span>{SISTEMA_LABEL[ev.sistema]}</span>
                        {ev.estrutura && <span className="text-primary font-medium">· {ev.estrutura}</span>}
                        {ev.diagnostico_cid && <span className="bg-primary/10 text-primary px-1 rounded">{ev.diagnostico_cid}</span>}
                      </p>
                      {ev.notas_clinicas && (
                        <p className="text-[11px] text-muted-foreground mt-2 bg-muted/30 p-2 rounded italic">
                          "{ev.notas_clinicas}"
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(ev)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteMut.mutate(ev.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              <Button onClick={novoAchado} className="w-full mt-4" size="sm">
                <Plus className="icon-xs mr-1" /> Novo Achado Clínico
              </Button>
            </div>
          )}

          {/* Painel Informativo MyID (Contexto e Características do Formulário) */}
          {lastMyIDData && !editing && (
            <div className="mt-4 p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-4">
              <div className="flex items-center gap-2 border-b border-primary/10 pb-2">
                <ClipboardList className="h-4 w-4 text-primary" />
                <h4 className="text-xs font-bold uppercase text-primary">Perfil MyID</h4>
              </div>
              
              <div className="space-y-4">
                {/* Queixa Principal */}
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
                    <Info className="h-3 w-3" /> Queixa Principal
                  </Label>
                  <p className="text-xs italic bg-background/50 p-2 rounded border border-border/50 mt-1">
                    "{lastMyIDData.respostas.bloco_1_queixa || 'Não informada'}"
                  </p>
                </div>

                {/* Métricas de Capacidade */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-background/40 p-2 rounded border border-border/30">
                    <div className="flex items-center gap-1 mb-1">
                      <Heart className="h-3 w-3 text-emerald-500" />
                      <Label className="text-[9px] text-muted-foreground uppercase font-bold">Resiliência</Label>
                    </div>
                    <span className="text-xs font-bold">{Number(myidScores.R || 0).toFixed(1)}/10</span>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{lastMyIDData.respostas.bloco_5a_hours}h sono · qlty {lastMyIDData.respostas.bloco_5a_quality}/10</p>
                  </div>
                  <div className="bg-background/40 p-2 rounded border border-border/30">
                    <div className="flex items-center gap-1 mb-1">
                      <Brain className="h-3 w-3 text-violet-500" />
                      <Label className="text-[9px] text-muted-foreground uppercase font-bold">Psicológico</Label>
                    </div>
                    <span className="text-xs font-bold">{Number(myidScores.P || 0).toFixed(1)}/10</span>
                    <p className="text-[9px] text-muted-foreground mt-0.5">Stress {lastMyIDData.respostas.bloco_5c_stress}/10 · Anx {lastMyIDData.respostas.bloco_5c_anxiety}/10</p>
                  </div>
                </div>

                {/* Sinais Sistêmicos e Traumas */}
                <div className="space-y-2">
                  <Label className="text-[10px] text-muted-foreground uppercase font-bold">Sinais do Corpo e Histórico</Label>
                  <div className="flex flex-wrap gap-1">
                    {lastMyIDData.respostas.bloco_6_axial_trauma && (
                      <Badge variant="outline" className="text-[9px] border-amber-200 bg-amber-50 text-amber-700">Trauma Axial</Badge>
                    )}
                    {lastMyIDData.respostas.bloco_6_abdominal_surgeries?.map((s: string) => (
                      <Badge key={s} variant="outline" className="text-[9px] border-red-200 bg-red-50 text-red-700">Cirurgia: {s}</Badge>
                    ))}
                    {lastMyIDData.respostas.bloco_6_visceral_issues?.map((s: string) => (
                      <Badge key={s} variant="outline" className="text-[9px] border-blue-200 bg-blue-50 text-blue-700">{s}</Badge>
                    ))}
                    {lastMyIDData.respostas.bloco_6_antidepressant && (
                      <Badge variant="outline" className="text-[9px] border-purple-200 bg-purple-50 text-purple-700">Uso Antidepressivo</Badge>
                    )}
                  </div>
                </div>

                {/* Comportamento e Estilo de Vida */}
                <div className="bg-muted/30 p-2 rounded-lg">
                  <Label className="text-[9px] text-muted-foreground uppercase font-bold block mb-1">Comportamento (Inércia {Number(myidScores.I || 0).toFixed(1)})</Label>
                  <p className="text-[10px] text-foreground leading-tight">
                    Vida {lastMyIDData.respostas.bloco_5e_lifestyle} · {lastMyIDData.respostas.bloco_5e_sitting_hours}h sentado · Fumo: {lastMyIDData.respostas.bloco_6_smoking ? 'Sim' : 'Não'}
                  </p>
                </div>
              </div>
            </div>
          )}


          {editing && (
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de achado *</Label>
                <Input
                  placeholder="ex: Tendinopatia, Parestesia, Dor mecânica…"
                  value={editing.tipo_achado || ''}
                  onChange={e => setEditing({ ...editing, tipo_achado: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Sistema</Label>
                  <Select value={editing.sistema} onValueChange={(v: any) => setEditing({ ...editing, sistema: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SISTEMAS_ORDEM.map(s => (
                        <SelectItem key={s} value={s}>{SISTEMA_LABEL[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Origem</Label>
                  <Select value={editing.origem} onValueChange={(v: any) => setEditing({ ...editing, origem: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ORIGEM_LABEL) as OrigemAchado[]).map(o => (
                        <SelectItem key={o} value={o}>{ORIGEM_LABEL[o]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Estrutura (opcional)</Label>
                <Select
                  value={editing.estrutura || '__none__'}
                  onValueChange={(v) => setEditing({ ...editing, estrutura: v === '__none__' ? null : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— nenhuma —</SelectItem>
                    {todasEstruturas.map(e => (
                      <SelectItem key={e} value={e}>{e}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">CID-10 (opcional)</Label>
                  <Input
                    placeholder="ex: M54.5"
                    value={editing.diagnostico_cid || ''}
                    onChange={e => setEditing({ ...editing, diagnostico_cid: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Severidade (0–4)</Label>
                  <Input
                    type="number" min={0} max={4}
                    value={editing.severidade ?? 1}
                    onChange={e => setEditing({ ...editing, severidade: Math.min(4, Math.max(0, +e.target.value)) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Status</Label>
                  <Select value={editing.status} onValueChange={(v: any) => setEditing({ ...editing, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS_LABEL) as StatusEvento[]).map(s => (
                        <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Início</Label>
                  <Input
                    type="date"
                    value={editing.data_inicio || ''}
                    onChange={e => setEditing({ ...editing, data_inicio: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Notas clínicas</Label>
                <Textarea
                  rows={3}
                  placeholder="Mecanismo, exame, conduta…"
                  value={editing.notas_clinicas || ''}
                  onChange={e => setEditing({ ...editing, notas_clinicas: e.target.value })}
                />
              </div>

              <div className="flex items-center justify-between border-t pt-3">
                <div>
                  <p className="text-xs font-medium">Visível ao paciente</p>
                  <p className="text-[10px] text-muted-foreground">
                    Versão simplificada no portal
                  </p>
                </div>
                <Switch
                  checked={!!editing.visivel_paciente}
                  onCheckedChange={(v) => setEditing({ ...editing, visivel_paciente: v })}
                />
              </div>

              <SheetFooter className="gap-2">
                <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saveMut.isPending || !editing.tipo_achado?.trim()}>
                  {saveMut.isPending ? 'Salvando…' : 'Salvar Achado'}
                </Button>
              </SheetFooter>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Dialog de Sincronização MyID */}
      <Sheet open={!!syncData} onOpenChange={(o) => !o && setSyncData(null)}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <RefreshCcw className="h-5 w-5 text-primary" />
              Sincronização Assistida MyID
            </SheetTitle>
          </SheetHeader>
          <div className="py-4 space-y-4">
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                Detectamos queixas e sinais no MyID do paciente. 
                Selecione o que deseja importar para o Avatar Clínico.
              </p>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className={cn("h-8 text-xs", isSyncing ? "bg-primary/10" : "")}
                  onClick={() => setIsSyncing(false)}
                >
                  <Shield className="h-3 w-3 mr-1" /> Mapa de Dor ({painRegions.length})
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className={cn("h-8 text-xs", isSyncing ? "bg-primary/10" : "")}
                  onClick={() => setIsSyncing(true)}
                >
                  <Activity className="h-3 w-3 mr-1" /> Sinais do Corpo ({sinalRegions.length})
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-8">
              {!isSyncing ? painRegions.map((item) => {
                const reg = [...REGIONS, ...VISCERAL_REGIONS].find(r => r.id === item.regiao_id);
                const jaImportado = eventos.some(e => e.regiao_id === item.regiao_id && e.origem === 'subjetivo_myid' && e.status === 'ativo');
                
                return (
                  <div key={item.regiao_id} className="flex items-center justify-between p-3 border rounded-xl bg-muted/30">
                    <div>
                      <p className="text-sm font-semibold">{reg?.label || item.regiao_id}</p>
                      <p className="text-[11px] text-muted-foreground italic">Intensidade: {item.intensidade}/10</p>
                    </div>
                    {jaImportado ? (
                      <Badge variant="secondary" className="gap-1 text-[10px]">
                        <Check className="h-3 w-3" /> Importado
                      </Badge>
                    ) : (
                      <Button size="sm" className="h-8 text-xs" onClick={() => handleSyncImport(item)} disabled={saveMut.isPending}>
                        Importar
                      </Button>
                    )}
                  </div>
                );
              }) : sinalRegions.map((item, idx) => {
                const reg = [...REGIONS, ...VISCERAL_REGIONS].find(r => r.id === item.regiao_id);
                const jaImportado = eventos.some(e => e.regiao_id === item.regiao_id && e.tipo_achado.includes(item.sinal));
                
                return (
                  <div key={`${item.regiao_id}-${idx}`} className="flex items-center justify-between p-3 border rounded-xl bg-muted/30">
                    <div>
                      <p className="text-sm font-semibold">{item.sinal}</p>
                      <p className="text-[11px] text-muted-foreground">{reg?.label || item.regiao_id}</p>
                    </div>
                    {jaImportado ? (
                      <Badge variant="secondary" className="gap-1 text-[10px]">
                        <Check className="h-3 w-3" /> Importado
                      </Badge>
                    ) : (
                      <Button size="sm" className="h-8 text-xs" onClick={async () => {
                        await saveMut.mutateAsync({
                          paciente_id: pacienteId,
                          regiao_id: item.regiao_id,
                          sistema: (VISCERAL_REGIONS.find(v => v.id === item.regiao_id)?.sistemas[0] as any) || 'digestorio',
                          origem: 'subjetivo_myid',
                          tipo_achado: `Relato MyID: ${item.sinal}`,
                          severidade: 2,
                          status: 'ativo',
                          visivel_paciente: true,
                          data_inicio: new Date().toISOString().slice(0, 10),
                        });
                      }} disabled={saveMut.isPending}>
                        Importar
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            {(isSyncing ? sinalRegions.length : painRegions.length) === 0 && (
              <div className="text-center py-8">
                <Check className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-medium">Sem itens pendentes nesta categoria.</p>
                <Button variant="outline" className="mt-4" onClick={() => setSyncData(null)}>Fechar</Button>
              </div>
            )}
          </div>
          <SheetFooter className="pb-6">
            <Button variant="outline" onClick={() => setSyncData(null)} className="w-full">Concluir</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </Card>
  );
}
