import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Activity, Plus, Trash2, Pencil, Stethoscope, RefreshCcw, Check, User, ShieldCheck, Info, Heart, Zap, Brain, Shield, ClipboardList, Wind, Droplets, Dna, Waves, Eye } from 'lucide-react';
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

const ORGAN_RESTING_COLORS: Record<string, string> = {
  // Nervous — blue-lavender
  cerebro:               'rgba(130,145,210,0.70)',
  cerebelo:              'rgba(120,138,205,0.62)',
  cerebro_p:             'rgba(130,145,210,0.68)',
  cerebelo_p:            'rgba(120,138,205,0.60)',
  tronco_encefalico:     'rgba(130,145,210,0.55)',
  // Circulatory — red
  coracao:               'rgba(210,45,45,0.74)',
  // Respiratory — pink-rose
  traqueia:              'rgba(180,130,180,0.50)',
  pulmao_d:              'rgba(195,128,150,0.68)',
  pulmao_e:              'rgba(195,128,150,0.68)',
  pulmao_d_p:            'rgba(195,128,150,0.62)',
  pulmao_e_p:            'rgba(195,128,150,0.62)',
  // Digestive — warm ochre/brown tones
  esofago:               'rgba(180,130,180,0.38)',
  figado:                'rgba(148,72,32,0.68)',
  estomago:              'rgba(210,138,118,0.62)',
  vesicula_biliar:       'rgba(195,185,55,0.65)',
  pancreas_corpo:        'rgba(215,168,95,0.55)',
  duodeno:               'rgba(208,158,118,0.55)',
  baco_frente:           'rgba(155,95,115,0.60)',
  intestino_delgado:     'rgba(208,158,118,0.50)',
  colon_ascendente:      'rgba(185,135,95,0.56)',
  colon_transverso:      'rgba(185,135,95,0.56)',
  colon_descendente:     'rgba(185,135,95,0.56)',
  colon_sigmoide:        'rgba(185,135,95,0.56)',
  apendice:              'rgba(185,135,95,0.60)',
  reto:                  'rgba(185,135,95,0.52)',
  // Endocrine — golden yellow
  hipofise:              'rgba(208,178,58,0.65)',
  tireoide:              'rgba(208,178,58,0.65)',
  adrenal_d:             'rgba(208,178,58,0.58)',
  adrenal_e:             'rgba(208,178,58,0.58)',
  adrenal_d_p:           'rgba(208,178,58,0.55)',
  adrenal_e_p:           'rgba(208,178,58,0.55)',
  ilhotas_langerhans:    'rgba(215,168,95,0.52)',
  // Urinary — indigo-blue
  bexiga:                'rgba(95,138,218,0.62)',
  ureteres:              'rgba(95,138,218,0.38)',
  // Lymphatic — lime-green
  timo:                  'rgba(115,195,95,0.54)',
  linfonodos_cervicais:  'rgba(115,195,95,0.60)',
  linfonodos_axilares_d: 'rgba(115,195,95,0.54)',
  linfonodos_axilares_e: 'rgba(115,195,95,0.54)',
  linfonodos_inguinais:  'rgba(115,195,95,0.54)',
  cisterna_chyli:        'rgba(115,195,95,0.50)',
  // Reproductive — pink
  utero:                 'rgba(238,98,158,0.56)',
  ovarios:               'rgba(238,98,158,0.52)',
  testiculos:            'rgba(198,98,118,0.52)',
  prostata:              'rgba(198,98,118,0.50)',
  // Back view
  rim_d:                 'rgba(175,88,48,0.65)',
  rim_e:                 'rgba(175,88,48,0.65)',
  gluteos_musculares:    'rgba(168,85,247,0.42)',
  gluteos_p:             'rgba(168,85,247,0.42)',
};

const SYSTEM_RESTING: Record<string, string> = {
  nervoso:       'rgba(130,145,210,0.58)',
  circulatorio:  'rgba(210,45,45,0.62)',
  respiratorio:  'rgba(195,128,150,0.60)',
  digestorio:    'rgba(200,120,78,0.54)',
  urinario:      'rgba(95,138,218,0.56)',
  endocrino:     'rgba(208,178,58,0.56)',
  linfatico:     'rgba(115,195,95,0.50)',
  reprodutor:    'rgba(238,98,158,0.48)',
  musculoesqueletico: 'rgba(168,85,247,0.40)',
};

const SYSTEM_HOVER: Record<string, string> = {
  nervoso:       'rgba(14,165,233,0.78)',
  circulatorio:  'rgba(239,68,68,0.82)',
  respiratorio:  'rgba(6,182,212,0.78)',
  digestorio:    'rgba(249,115,22,0.78)',
  urinario:      'rgba(99,102,241,0.78)',
  endocrino:     'rgba(234,179,8,0.78)',
  linfatico:     'rgba(132,204,22,0.78)',
  reprodutor:    'rgba(236,72,153,0.78)',
  musculoesqueletico: 'rgba(168,85,247,0.78)',
};

const VESSEL_COLOR: Record<string, string> = {
  circulatorio:  'rgba(200,40,40,0.72)',
  respiratorio:  'rgba(100,180,212,0.68)',
  nervoso:       'rgba(14,165,233,0.60)',
  urinario:      'rgba(95,138,218,0.60)',
  linfatico:     'rgba(115,195,95,0.58)',
};

const SISTEMAS_ORDEM: SistemaCorporal[] = [
  'musculoesqueletico', 'nervoso', 'digestorio', 'circulatorio',
  'respiratorio', 'endocrino', 'urinario',
  'reprodutor', 'tegumentar', 'linfatico', 'sensorial'
];
const SISTEMAS_INICIAIS: SistemaCorporal[] = [...SISTEMAS_ORDEM];
const SISTEMA_CONFIG: Record<SistemaCorporal, { label: string; icon: any; color: string; resumo: string }> = {
  musculoesqueletico: { 
    label: 'Musculoesquelético', 
    icon: Zap, 
    color: 'purple',
    resumo: 'Sistema de suporte e alavanca mecânica, integrando ossos, articulações, músculos e fáscias sob controle neural para postura e movimento.'
  },
  nervoso: { 
    label: 'Nervoso', 
    icon: Brain, 
    color: 'blue',
    resumo: 'Rede eletroquímica central e periférica que processa estímulos, coordena respostas reflexas e voluntárias e mantém a homeostase sistêmica.'
  },
  digestorio: { 
    label: 'Digestório', 
    icon: Stethoscope, 
    color: 'orange',
    resumo: 'Trato gastrointestinal e glândulas anexas responsáveis pela quebra mecânico-química, absorção de nutrientes e barreira imunológica entérica.'
  },
  circulatorio: { 
    label: 'Circulatório', 
    icon: Heart, 
    color: 'red',
    resumo: 'Sistema hemodinâmico de transporte de gases, nutrientes e sinalizadores hormonais através de uma rede contínua de vasos e bomba cardíaca.'
  },
  respiratorio: { 
    label: 'Respiratório', 
    icon: Wind, 
    color: 'cyan',
    resumo: 'Interface de hematose entre o ambiente e o sangue, abrangendo vias condutoras e unidades alveolares para troca de oxigênio e CO2.'
  },
  endocrino: { 
    label: 'Endócrino', 
    icon: Dna, 
    color: 'yellow',
    resumo: 'Eixo de controle humoral composto por glândulas que secretam mensageiros químicos (hormônios) para regulação metabólica de longo prazo.'
  },
  urinario: { 
    label: 'Urinário', 
    icon: Droplets, 
    color: 'indigo',
    resumo: 'Complexo de filtração renal e vias excretoras essencial para o equilíbrio hidroeletrolítico, controle pressórico e depuração de catabólitos.'
  },
  reprodutor: { 
    label: 'Reprodutor', 
    icon: Heart, 
    color: 'pink',
    resumo: 'Órgãos e gônadas responsáveis pela perpetuação da espécie e produção de esteroides sexuais que influenciam múltiplos sistemas.'
  },
  tegumentar: { 
    label: 'Tegumentar', 
    icon: Shield, 
    color: 'stone',
    resumo: 'Interface de proteção externa, termorregulação e vasta rede de exterocepção sensorial através da pele e seus anexos epidérmicos.'
  },
  linfatico: { 
    label: 'Linfático', 
    icon: Waves, 
    color: 'lime',
    resumo: 'Sistema de drenagem intersticial e vigilância imunológica, integrando linfonodos e vasos para transporte de lipídios e defesa celular.'
  },
  sensorial: { 
    label: 'Sensorial', 
    icon: Eye, 
    color: 'emerald',
    resumo: 'Complexo de transdutores biológicos (visão, audição, olfato, paladar, tato) que convertem estímulos ambientais em impulsos neurais.'
  },
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

      const textoCompleto = extrairTextoDeObjeto(dados) + " " + extrairTextoDeObjeto(analysis);
      const sintomasDetectados = encontrarSintomasEmTexto(textoCompleto);

      const sinalRegions: { regiao_id: string; sinal: string; sistema: string; fonte: string }[] = [];
      sintomasDetectados.forEach(s => {
        if (!sinalRegions.some(sr => sr.regiao_id === s.regiao_id && sr.sistema === s.sistema)) {
          sinalRegions.push({
            regiao_id: s.regiao_id,
            sinal: `Detectado: ${s.termo}`,
            sistema: s.sistema,
            fonte: 'myid',
          });
        }
      });

      return {
        painRegions,
        sinalRegions,
        scores: componentScores,
        raw: data,
        respostas,
      };
    },
    enabled: !!pacienteId,
  });

  // Histórico do paciente: queixa principal, condições, medicamentos, alergias
  const { data: pacienteHistorico } = useQuery({
    queryKey: ['paciente-historico-avatar', pacienteId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('pacientes')
        .select('queixa_principal, condicoes_preexistentes, medicamentos_uso, alergias, observacoes')
        .eq('id', pacienteId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return [];
      const textoHistorico = [
        data.queixa_principal,
        data.condicoes_preexistentes,
        data.medicamentos_uso,
        data.alergias,
        data.observacoes,
      ].filter(Boolean).join(' ');
      const sintomasDetectados = encontrarSintomasEmTexto(textoHistorico);
      const regioes: { regiao_id: string; sinal: string; sistema: string; fonte: string }[] = [];
      sintomasDetectados.forEach(s => {
        if (!regioes.some(r => r.regiao_id === s.regiao_id && r.sistema === s.sistema)) {
          regioes.push({
            regiao_id: s.regiao_id,
            sinal: `Histórico: ${s.termo}`,
            sistema: s.sistema,
            fonte: 'historico_paciente',
          });
        }
      });
      return regioes;
    },
    enabled: !!pacienteId,
  });

  // Notas do prontuário clínico (avaliações presenciais)
  const { data: notasSinais } = useQuery({
    queryKey: ['notas-prontuario-avatar', pacienteId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('notas_prontuario')
        .select('titulo, descricao, dados_extras')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      if (!data?.length) return [];
      const textoNotas = (data as any[]).map((n: any) =>
        [n.titulo, n.descricao, extrairTextoDeObjeto(n.dados_extras)].filter(Boolean).join(' ')
      ).join(' ');
      const sintomasDetectados = encontrarSintomasEmTexto(textoNotas);
      const regioes: { regiao_id: string; sinal: string; sistema: string; fonte: string }[] = [];
      sintomasDetectados.forEach(s => {
        if (!regioes.some(r => r.regiao_id === s.regiao_id && r.sistema === s.sistema)) {
          regioes.push({
            regiao_id: s.regiao_id,
            sinal: `Prontuário: ${s.termo}`,
            sistema: s.sistema,
            fonte: 'notas_clinicas',
          });
        }
      });
      return regioes;
    },
    enabled: !!pacienteId,
  });

  const painRegions = lastMyIDData?.painRegions || [];
  // Mescla sinalRegions de todas as fontes, sem duplicar por (regiao_id + sistema)
  const sinalRegions = useMemo(() => {
    const fontes = [
      ...(lastMyIDData?.sinalRegions || []),
      ...(pacienteHistorico || []),
      ...(notasSinais || []),
    ];
    const seen = new Set<string>();
    return fontes.filter(s => {
      const key = `${s.regiao_id}|${s.sistema}|${s.fonte}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [lastMyIDData?.sinalRegions, pacienteHistorico, notasSinais]);
  const myidScores = lastMyIDData?.scores || {};

  const eventosFiltrados = useMemo(
    () => eventos.filter(e => sistemasAtivos.includes(e.sistema)),
    [eventos, sistemasAtivos],
  );

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

    // Sinais de TODAS as fontes: MyID, histórico do paciente e notas clínicas
    // A opacidade varia por fonte: notas_clinicas > historico_paciente > myid
    const FONTE_ALPHA: Record<string, number> = {
      notas_clinicas: 0.52,
      historico_paciente: 0.44,
      myid: 0.38,
    };
    const SISTEMA_COR: Record<string, string> = {
      nervoso:            '14, 165, 233',
      digestorio:         '249, 115, 22',
      musculoesqueletico: '168, 85, 247',
      circulatorio:       '239, 68, 68',
      respiratorio:       '6, 182, 212',
      endocrino:          '234, 179, 8',
      urinario:           '99, 102, 241',
      reprodutor:         '236, 72, 153',
      linfatico:          '132, 204, 22',
      tegumentar:         '120, 113, 108',
      sensorial:          '16, 185, 129',
    };
    sinalRegions.forEach(item => {
      const isSystemActive = sistemasAtivos.includes(item.sistema as any);
      if (!isSystemActive) return;
      const fonte = (item as any).fonte || 'myid';
      const alpha = FONTE_ALPHA[fonte] ?? 0.38;
      const cor = SISTEMA_COR[item.sistema] || '14, 165, 233';
      // Só sobrescreve se não houver achado clínico (que tem prioridade)
      if (!map[item.regiao_id]) {
        map[item.regiao_id] = `rgba(${cor}, ${alpha})`;
        map[item.regiao_id + '__is_sinal'] = fonte;
      } else if (map[item.regiao_id + '__is_sinal'] && fonte === 'notas_clinicas') {
        // notas clínicas sobrescrevem sinais de fontes menos confiáveis
        map[item.regiao_id] = `rgba(${cor}, ${alpha})`;
        map[item.regiao_id + '__is_sinal'] = fonte;
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
        {/* Toggles de sistema - Ecossistema Dinâmico com Ranking de Acometimento */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ranking de Sistemas</span>
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
                let score = evsDoSistema.reduce((acc, curr) => acc + (curr.severidade || 1), 0);
                
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
                  score += painRegions.length * 0.8;
                  const queixasTexto = sinalRegions.filter(sr => sr.regiao_id === 'peitoral' || sr.regiao_id === 'dorsal');
                  score += queixasTexto.length * 2.0;
                }
                
                score += myidSinaisDoSistema.length * 1.5;

                return { sistema: s, score, count: evsDoSistema.length + myidSinaisDoSistema.length };
              }).sort((a, b) => b.score - a.score);

              // Cálculo de Homeostase (Inverso do score total normalizado)
              const totalScore = systemScores.reduce((acc, curr) => acc + curr.score, 0);
              const homeostase = Math.max(0, Math.min(100, 100 - (totalScore * 5)));

              return (
                <div className="w-full space-y-4">
                  <div className="bg-muted/30 p-3 rounded-lg border border-border/50 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Índice de Homeostase</p>
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
                            
                            const achadosClinicos = eventos.filter(e => e.sistema === sysToShow && e.status !== 'resolvido');
                            const sinaisMyID = sinalRegions.filter(sr => sr.sistema === sysToShow && (sr as any).fonte === 'myid');
                            const sinaisHistorico = sinalRegions.filter(sr => sr.sistema === sysToShow && (sr as any).fonte === 'historico_paciente');
                            const sinaisProntuario = sinalRegions.filter(sr => sr.sistema === sysToShow && (sr as any).fonte === 'notas_clinicas');

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

                            const doresMyID = sysToShow === 'musculoesqueletico'
                              ? painRegions.map(p => ({ sinal: `Dor em ${REGIONS.find(r => r.id === p.regiao_id)?.label || p.regiao_id} (${p.intensidade}/10)` }))
                              : [];

                            const todosMyID = [...sinaisMyID.map(a => a.sinal), ...doresMyID.map(d => d.sinal), ...flagsSistema];

                            return (
                              <div className="space-y-3">
                                <div className="flex gap-3 items-center border-b border-primary/10 pb-2">
                                  <div className={cn("p-1.5 rounded-lg bg-background border border-primary/10", `text-${config.color}-500`)}>
                                    <Icon className="w-4 h-4" />
                                  </div>
                                  <p className="text-xs font-black uppercase tracking-wider">{config.label}</p>
                                </div>

                                <div className="space-y-3">
                                  {/* Histórico do paciente (queixa, condições, medicamentos) */}
                                  {sinaisHistorico.length > 0 && (
                                    <div className="space-y-1">
                                      <p className="text-[10px] font-bold text-emerald-600 uppercase flex items-center gap-1">
                                        <ClipboardList className="w-3 h-3" /> Histórico / Ficha do Paciente:
                                      </p>
                                      <div className="space-y-1 pl-4">
                                        {sinaisHistorico.map((s, idx) => (
                                          <div key={`hist-${idx}`} className="flex items-start gap-2">
                                            <div className="w-1 h-1 rounded-full mt-1.5 shrink-0 bg-emerald-400" />
                                            <p className="text-[11px] leading-tight text-emerald-800">{s.sinal}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Notas do prontuário clínico */}
                                  {sinaisProntuario.length > 0 && (
                                    <div className="space-y-1">
                                      <p className="text-[10px] font-bold text-violet-600 uppercase flex items-center gap-1">
                                        <ShieldCheck className="w-3 h-3" /> Notas do Prontuário:
                                      </p>
                                      <div className="space-y-1 pl-4">
                                        {sinaisProntuario.map((s, idx) => (
                                          <div key={`nota-${idx}`} className="flex items-start gap-2">
                                            <div className="w-1 h-1 rounded-full mt-1.5 shrink-0 bg-violet-400" />
                                            <p className="text-[11px] leading-tight text-violet-800">{s.sinal}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Relatos do MyID (avaliação subjetiva) */}
                                  <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-sky-600 uppercase flex items-center gap-1">
                                      <User className="w-3 h-3" /> Relatos do Paciente (MyID):
                                    </p>
                                    {todosMyID.length === 0 ? (
                                      <p className="text-[11px] text-muted-foreground italic pl-4">Nenhum relato subjetivo registrado.</p>
                                    ) : (
                                      <div className="space-y-1 pl-4">
                                        {todosMyID.map((s, idx) => (
                                          <div key={`myid-${idx}`} className="flex items-start gap-2">
                                            <div className="w-1 h-1 rounded-full mt-1.5 shrink-0 bg-sky-400" />
                                            <p className="text-[11px] leading-tight text-sky-800">{s}</p>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Achados da Avaliação Presencial */}
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
              {/* Warm anatomical skin gradient */}
              <radialGradient id="avc-skin" cx="44%" cy="22%" r="72%">
                <stop offset="0%"   stopColor="#f5d5b8" stopOpacity="0.96" />
                <stop offset="55%"  stopColor="#eccaa8" stopOpacity="0.92" />
                <stop offset="100%" stopColor="#d4a880" stopOpacity="0.88" />
              </radialGradient>
              {/* Organ volume highlight */}
              <radialGradient id="organ-vol" cx="28%" cy="22%" r="72%">
                <stop offset="0%" stopColor="white" stopOpacity="0.55" />
                <stop offset="100%" stopColor="black" stopOpacity="0.12" />
              </radialGradient>
              <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              <filter id="glow-urgent" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="4.5" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            <style>
              {`
                @keyframes pulse-organ {
                  0%,100% { opacity: 0.80; }
                  50% { opacity: 1.0; }
                }
                .pulse-organ { animation: pulse-organ 2.2s infinite ease-in-out; }
              `}
            </style>

            {/* Drop shadow */}
            <ellipse cx={120} cy={516} rx={50} ry={4.5} fill="black" opacity={0.09} />

            <g clipPath="url(#avc-clip)">
              {/* Warm skin fill */}
              <path d={FRONT_OUTLINE} fill="url(#avc-skin)" />

              {/* Anatomical structure lines */}
              {view === 'front' && (
                <g fill="none" stroke="hsl(var(--foreground))" strokeWidth={0.55} opacity={0.30}>
                  {/* Clavicles */}
                  <path d="M120 108 Q108 112 96 120" strokeWidth={0.85} />
                  <path d="M120 108 Q132 112 144 120" strokeWidth={0.85} />
                  {/* Sternum */}
                  <path d="M120 110 L120 196" strokeWidth={0.95} />
                  {/* Ribs – right */}
                  <path d="M120 126 Q105 124 94 133" />
                  <path d="M120 140 Q102 138 90 149" />
                  <path d="M120 154 Q101 152 88 163" />
                  <path d="M120 168 Q101 166 88 178" />
                  {/* Ribs – left */}
                  <path d="M120 126 Q135 124 146 133" />
                  <path d="M120 140 Q138 138 150 149" />
                  <path d="M120 154 Q139 152 152 163" />
                  <path d="M120 168 Q139 166 152 178" />
                  {/* Costal arch */}
                  <path d="M88 178 Q104 194 120 196 Q136 194 152 178" strokeWidth={1.0} />
                  {/* Abdominal lines */}
                  <path d="M110 200 L110 244 M130 200 L130 244" strokeWidth={0.45} />
                  <path d="M108 216 L132 216 M108 228 L132 228 M108 240 L132 240" strokeWidth={0.40} />
                  {/* Navel */}
                  <circle cx={120} cy={250} r={3.5} strokeWidth={0.7} />
                  {/* Iliac crests */}
                  <path d="M88 282 Q102 276 120 278 Q138 276 152 282" strokeDasharray="3,2" strokeWidth={0.7} />
                  {/* Kneecaps */}
                  <ellipse cx={144} cy={382} rx={11} ry={7} />
                  <ellipse cx={96}  cy={382} rx={11} ry={7} />
                </g>
              )}
              {view === 'back' && (
                <g fill="none" stroke="hsl(var(--foreground))" strokeWidth={0.55} opacity={0.30}>
                  {/* Spine */}
                  <path d="M120 110 L120 285" strokeDasharray="2.5,2" strokeWidth={1.0} />
                  {/* Vertebrae */}
                  {[126,140,154,168,182,196,210,224,240,256,272].map(y => (
                    <line key={y} x1={115} y1={y} x2={125} y2={y} strokeWidth={0.9} />
                  ))}
                  {/* Scapulae */}
                  <path d="M96 148 Q104 162 110 184" strokeWidth={0.85} />
                  <path d="M144 148 Q136 162 130 184" strokeWidth={0.85} />
                  <path d="M96 148 Q118 154 110 184" />
                  <path d="M144 148 Q122 154 130 184" />
                  {/* PSIS dimples */}
                  <circle cx={111} cy={279} r={2.5} />
                  <circle cx={129} cy={279} r={2.5} />
                  {/* Gluteal crease */}
                  <path d="M90 308 Q120 320 150 308" strokeWidth={0.8} />
                </g>
              )}

              {/* Musculoskeletal regions — only render when data exists or hovered */}
              {sistemasAtivos.includes('musculoesqueletico') && regioesBase.map(r => {
                const fill = corPorRegiao[r.id];
                const isHoveredSystem = hoveredSistema === 'musculoesqueletico';
                if (!fill && !isHoveredSystem) return null;
                const severityScore = Number(corPorRegiao[r.id + '__peso'] || 0);
                return (
                  <path
                    key={r.id}
                    d={r.d}
                    fill={fill || 'rgba(168,85,247,0.28)'}
                    fillOpacity={fill ? 0.68 : 0.32}
                    stroke={fill ? 'rgba(168,85,247,0.65)' : 'rgba(168,85,247,0.40)'}
                    strokeWidth={fill ? 1.1 : 0.6}
                    filter={severityScore >= 8 ? 'url(#glow)' : undefined}
                    className="cursor-pointer hover:opacity-80 transition-all"
                    onClick={() => abrirSheet(r.id)}
                  />
                );
              })}

              {/* Organ / visceral regions — sorted by layer, rendered by type */}
              {[...regioesViscerais]
                .sort((a, b) => (a.layer ?? 5) - (b.layer ?? 5))
                .map(r => {
                const fill = corPorRegiao[r.id];
                const belongsToActiveSystem = r.sistemas.some(s => sistemasAtivos.includes(s as any));
                const isHoveredSystem = r.sistemas.some(s => hoveredSistema === s);
                if (!belongsToActiveSystem && !isHoveredSystem) return null;

                const severityScore = Number(corPorRegiao[r.id + '__peso'] || 0);
                const isUrgent = severityScore >= 13;
                const sys0 = r.sistemas[0];

                // STRUCTURAL (diaphragm, pericardium) — non-clickable dividers
                if (r.type === 'structural') {
                  if (!belongsToActiveSystem) return null;
                  const isDialfragma = r.id.startsWith('diafragma');
                  return (
                    <path
                      key={r.id}
                      d={r.d}
                      fill="none"
                      stroke={isDialfragma ? 'rgba(80,80,80,0.50)' : 'rgba(120,120,120,0.25)'}
                      strokeWidth={isDialfragma ? 1.4 : 0.8}
                      strokeLinecap="round"
                      pointerEvents="none"
                    />
                  );
                }

                // VESSEL (arteries, veins, bronchi) — stroke only, colored
                if (r.type === 'vessel') {
                  const baseColor = fill || (isHoveredSystem
                    ? SYSTEM_HOVER[sys0] || 'rgba(200,40,40,0.80)'
                    : VESSEL_COLOR[sys0] || 'rgba(200,100,100,0.62)');
                  return (
                    <path
                      key={r.id}
                      d={r.d}
                      fill="none"
                      stroke={baseColor}
                      strokeWidth={fill ? 2.2 : isHoveredSystem ? 2.0 : 1.3}
                      strokeLinecap="round"
                      filter={fill ? 'url(#glow)' : undefined}
                      className="cursor-pointer"
                      onClick={() => abrirSheet(r.id)}
                    >
                      <title>{r.label}</title>
                    </path>
                  );
                }

                // NERVE — thin dashed stroke
                if (r.type === 'nerve') {
                  const isSpine = r.id === 'medula_espinhal_v' || r.id === 'medula_p';
                  const nerveColor = fill || (isHoveredSystem
                    ? 'rgba(14,165,233,0.88)'
                    : 'rgba(14,165,233,0.50)');
                  return (
                    <path
                      key={r.id}
                      d={r.d}
                      fill="none"
                      stroke={nerveColor}
                      strokeWidth={fill ? 2.0 : isHoveredSystem ? 1.8 : (isSpine ? 1.4 : 0.9)}
                      strokeDasharray={isSpine ? undefined : '3,2.5'}
                      strokeLinecap="round"
                      filter={fill ? 'url(#glow)' : undefined}
                      className="cursor-pointer"
                      onClick={() => abrirSheet(r.id)}
                    >
                      <title>{r.label}</title>
                    </path>
                  );
                }

                // GLAND + ORGAN — filled shapes
                const restingColor = ORGAN_RESTING_COLORS[r.id] || SYSTEM_RESTING[sys0] || 'rgba(155,163,175,0.45)';
                const effectiveFill    = fill || (isHoveredSystem ? (SYSTEM_HOVER[sys0] || 'rgba(14,165,233,0.78)') : restingColor);
                const effectiveOpacity = fill ? 0.94 : isHoveredSystem ? 0.90 : 0.86;
                const effectiveStroke  = fill ? 'rgba(255,255,255,0.78)' : isHoveredSystem ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.38)';
                const effectiveSW      = r.type === 'gland'
                  ? (fill ? 0.8 : 0.3)
                  : (fill ? 1.3 : isHoveredSystem ? 1.6 : 0.5);

                return (
                  <g key={r.id} className={cn(isUrgent && 'pulse-organ')}>
                    <path
                      d={r.d}
                      fill={effectiveFill}
                      fillOpacity={effectiveOpacity}
                      stroke={effectiveStroke}
                      strokeWidth={effectiveSW}
                      filter={isUrgent ? 'url(#glow-urgent)' : fill ? 'url(#glow)' : undefined}
                      className="cursor-pointer hover:brightness-110 transition-all"
                      onClick={() => abrirSheet(r.id)}
                    >
                      <title>{r.label}</title>
                    </path>
                    {r.type !== 'gland' && (
                      <path d={r.d} fill="url(#organ-vol)" pointerEvents="none" opacity={0.48} />
                    )}
                  </g>
                );
              })}
            </g>

            {/* Organ micro-labels for active systems */}
            {view === 'front' && (
              <g fontSize="6" fontFamily="system-ui,sans-serif" textAnchor="middle" pointerEvents="none" fontWeight="600">
                {sistemasAtivos.includes('nervoso') && (
                  <text x={120} y={50} fill="rgba(100,115,200,0.88)">Encéfalo</text>
                )}
                {sistemasAtivos.includes('circulatorio') && (
                  <text x={119} y={166} fill="rgba(210,40,40,0.90)" fontSize="8">♥</text>
                )}
                {sistemasAtivos.includes('respiratorio') && (
                  <>
                    <text x={98}  y={186} fill="rgba(6,182,212,0.85)">P.Dir</text>
                    <text x={142} y={186} fill="rgba(6,182,212,0.85)">P.Esq</text>
                  </>
                )}
                {sistemasAtivos.includes('digestorio') && (
                  <text x={100} y={206} fill="rgba(150,70,30,0.85)">Fígado</text>
                )}
                {sistemasAtivos.includes('urinario') && (
                  <text x={120} y={288} fill="rgba(80,110,210,0.85)">Bexiga</text>
                )}
              </g>
            )}

            {/* Body outline on top */}
            <path
              d={FRONT_OUTLINE}
              fill="none"
              stroke="hsl(var(--foreground))"
              strokeWidth={1.9}
              strokeLinejoin="round"
              opacity={0.62}
              pointerEvents="none"
            />
          </svg>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] justify-center mt-1">
          <span className="flex items-center gap-1 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-[#dc2626]" /> Ativo grave</span>
          <span className="flex items-center gap-1 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-[#fb923c]" /> Ativo leve</span>
          <span className="flex items-center gap-1 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-[#f97316]" /> Em tratamento</span>
          <span className="flex items-center gap-1 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-[#eab308]" /> Crônico</span>
          <span className="flex items-center gap-1 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-[#9ca3af]" /> Resolvido</span>
          <span className="flex items-center gap-1 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-purple-500/60" /> Queixa Dor</span>
          <span className="flex items-center gap-1 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-sky-500/60" /> Sinais MyID</span>
        </div>
      </div>

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
