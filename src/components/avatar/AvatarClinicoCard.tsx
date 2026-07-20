import { useMemo, useState, useEffect, useCallback } from 'react';
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
import { Activity, Plus, Trash2, Pencil, Stethoscope, RefreshCcw, Check, User, ShieldCheck, Info, Heart, Zap, Brain, Shield, ClipboardList, Wind, Droplets, Dna, Waves, Eye, TrendingUp, Clock, History, AlertTriangle, CheckCircle2, ArrowRight, Loader2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { REGIONS, STRUCTURES } from '@/components/presencial/Body3DAvatar';
import { VISCERAL_REGIONS, VISCERAL_STRUCTURES } from '@/utils/anatomia/regioesViscerais';
import { cn } from '@/lib/utils';
import {
  useEventosAnatomicos, useSaveEventoAnatomico, useDeleteEventoAnatomico,
  corEvento, type EventoAnatomico, type SistemaCorporal, type StatusEvento, type OrigemAchado, type TipoDiagnostico,
} from '@/hooks/useEventosAnatomicos';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { encontrarSintomasEmTexto } from '@/utils/anatomia/mapeamentoSintomas';
import { sistemaDaCondicaoSistemica } from '@/utils/condicoesSistemicas';
import { useLenteAtiva, type PerfilProfissional } from '@/hooks/useLenteAtiva';
import {
  PONTO_ANATOMICO, LS_DOT_OFFSETS, LS_SCALES, LS_FIGURA,
  ZONAS_CORPORAIS, zonePivot,
  buildStickFigurePaths, deriveFigura, DEFAULT_FIGURA,
  type FiguraParams,
} from '@/utils/anatomia/pontoAnatomico';





const FRONT_OUTLINE =
  'M120 18 ' +
  'C 138 18 152 34 152 54 ' +
  'C 152 70 144 84 132 90 ' +
  'L 134 104 ' +
  'C 156 110 178 118 184 132 ' +
  'L 192 168 ' +
  'L 200 230 ' +
  'L 204 280 ' +
  'L 196 308 L 188 308 L 184 282 ' +
  'L 176 232 L 168 178 ' +
  'L 160 168 L 158 220 L 156 280 ' +
  'L 162 360 L 158 430 L 152 500 ' +
  'L 138 506 L 134 500 L 132 430 ' +
  'L 128 360 L 124 280 ' +
  'L 116 280 L 112 360 L 108 430 ' +
  'L 106 500 L 102 506 L 88 500 ' +
  'L 82 430 L 78 360 L 84 280 ' +
  'L 82 220 L 80 168 L 72 178 ' +
  'L 64 232 L 56 282 L 52 308 ' +
  'L 44 308 L 36 280 L 40 230 ' +
  'L 48 168 L 56 132 ' +
  'C 62 118 84 110 106 104 ' +
  'L 108 90 ' +
  'C 96 84 88 70 88 54 ' +
  'C 88 34 102 18 120 18 Z';


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
  rim_d_frente:          'rgba(175,88,48,0.58)',
  rim_e_frente:          'rgba(175,88,48,0.58)',
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
};

const SYSTEM_RESTING: Record<string, string> = {
  nervoso:       'rgba(130,145,210,0.58)',
  cardiovascular:  'rgba(210,45,45,0.62)',
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
  cardiovascular:  'rgba(239,68,68,0.82)',
  respiratorio:  'rgba(6,182,212,0.78)',
  digestorio:    'rgba(249,115,22,0.78)',
  urinario:      'rgba(99,102,241,0.78)',
  endocrino:     'rgba(234,179,8,0.78)',
  linfatico:     'rgba(132,204,22,0.78)',
  reprodutor:    'rgba(236,72,153,0.78)',
  musculoesqueletico: 'rgba(168,85,247,0.78)',
};

const VESSEL_COLOR: Record<string, string> = {
  cardiovascular:  'rgba(200,40,40,0.72)',
  respiratorio:  'rgba(100,180,212,0.68)',
  nervoso:       'rgba(14,165,233,0.60)',
  urinario:      'rgba(95,138,218,0.60)',
  linfatico:     'rgba(115,195,95,0.58)',
};

const SISTEMAS_ORDEM: SistemaCorporal[] = [
  'musculoesqueletico', 'nervoso', 'digestorio', 'cardiovascular',
  'respiratorio', 'endocrino', 'urinario',
  'reprodutor', 'tegumentar', 'linfatico', 'sensorial'
];

// Shift vertical (px, espaço SVG 240×520) aplicado a cada sistema no avatar.
// Positivo = desce, negativo = sobe. Referência: diafragma y=178–198 está correto.
// Para calibrar: ative o modo de calibração na interface e arraste os sliders.
const DEFAULT_SYS_Y_OFFSET: Partial<Record<string, number>> = {
  sensorial:          0,
  nervoso:            0,
  musculoesqueletico: 0,
  locomotor:          0,
  cardiovascular:       0,
  respiratorio:       0,
  digestorio:       -50,  // calibrado: Δ=36 base + margem extra para pâncreas
  endocrino:          0,
  urinario:           0,
  reprodutor:       -30,  // sobe órgãos pélvicos; mamas excluídas (sys0=endocrino)
  imune:              0,
  linfatico:          0,
  tegumentar:         0,
};
// Lente de especialidade: quais sistemas são prioritários pra cada profissão.
// Usado para destacar (não esconder) os sistemas mais relevantes daquele profissional.
const SISTEMAS_POR_ESPECIALIDADE: Record<PerfilProfissional, SistemaCorporal[]> = {
  fisioterapeuta: ['musculoesqueletico', 'nervoso'],
  medico: [...SISTEMAS_ORDEM],
  psicologo: ['nervoso'],
  nutricionista: ['digestorio', 'endocrino'],
  educador_fisico: ['musculoesqueletico'],
  terapeuta_ocupacional: ['musculoesqueletico', 'nervoso', 'sensorial'],
};

const SISTEMA_CHART_COLOR: Record<SistemaCorporal, string> = {
  musculoesqueletico: '#a855f7',
  nervoso: '#3b82f6',
  digestorio: '#f97316',
  cardiovascular: '#ef4444',
  respiratorio: '#06b6d4',
  endocrino: '#eab308',
  urinario: '#6366f1',
  reprodutor: '#ec4899',
  tegumentar: '#78716c',
  linfatico: '#84cc16',
  sensorial: '#10b981',
};

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
  cardiovascular: { 
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
const CATEGORIA_LABEL: Record<string, string> = {
  fratura: 'Fratura óssea',
  cirurgia: 'Cirurgia / internação',
  pequena_cirurgia: 'Pequeno procedimento',
  trauma_chicote: 'Trauma tipo chicote',
  traumatismo: 'Traumatismo',
  acidente: 'Acidente',
  malformacao: 'Malformação/condição congênita',
  doenca_sistemica: 'Doença sistêmica',
  tratamento_doenca: 'Tratamento de doença',
  medicamento: 'Medicação de uso regular',
  alergia: 'Alergia',
  saude_mental: 'Saúde mental',
  historico_familiar: 'Histórico familiar',
};

// ── Pesos clínicos do Índice de Homeostase ──
// A severidade pondera de forma não-linear (achado severo pesa ~5x um leve,
// no mesmo espírito das bandas não-lineares do MyID-100), o peso é modulado
// pelo status clínico (ativo > crônico > em tratamento) e por confirmação:
// um relato do paciente ainda não validado pelo profissional pesa a metade
// até ser confirmado como achado clínico (ver fluxo de confirmação no painel).
const PESO_SEVERIDADE: Record<number, number> = { 0: 0, 1: 1, 2: 2.5, 3: 5, 4: 8 };
const PESO_STATUS: Record<StatusEvento, number> = { ativo: 1, cronico: 0.8, em_tratamento: 0.6, resolvido: 0 };

function pesoConfirmacao(e: EventoAnatomico): number {
  return e.tipo_diagnostico === 'relato_paciente' ? 0.5 : 1;
}

function cargaEvento(e: EventoAnatomico): number {
  return (PESO_SEVERIDADE[e.severidade] ?? 1) * (PESO_STATUS[e.status] ?? 0) * pesoConfirmacao(e);
}

const TIPO_DIAG_BADGE: Record<string, string> = {
  relato_paciente: 'Relato',
  historico_relatado: 'Histórico ⏳',
  historico_confirmado: 'Hist. ✓',
  achado_clinico: 'Achado',
  diagnostico_medico: 'Dx Med.',
  diagnostico_fisioterapia: 'Dx Fisio',
  diagnostico_psicologia: 'Dx Psico',
  diagnostico_nutricao: 'Dx Nutri',
  diagnostico_fonoaudiologia: 'Dx Fono',
  diagnostico_outro: 'Dx Esp.',
};

// Peso do tipo para determinar qual evento domina visualmente em regiões sobrepostas
const tipoPeso = (td: string | undefined): number => {
  if (!td) return 2;
  if (td.startsWith('diagnostico_')) return 4; // diagnóstico formal — maior peso
  if (td === 'historico_confirmado') return 3; // histórico confirmado pelo profissional
  if (td === 'achado_clinico') return 2; // achado presencial
  return 1; // relato ou histórico não confirmado
};

interface Props {
  pacienteId: string;
  isProfessional?: boolean;
}

export default function AvatarClinicoCard({ pacienteId, isProfessional = true }: Props) {
  const { data: eventos = [], isLoading } = useEventosAnatomicos(pacienteId);
  const saveMut = useSaveEventoAnatomico();
  const deleteMut = useDeleteEventoAnatomico(pacienteId);
  const { user } = useAuth();
  const qc = useQueryClient();

  const [editandoHistoricoId, setEditandoHistoricoId] = useState<string | null>(null);
  const [textoEditadoHistorico, setTextoEditadoHistorico] = useState('');
  const [rejeicaoLoading, setRejeicaoLoading] = useState<string | null>(null);
  const [descartadosOpen, setDescartadosOpen] = useState(false);

  const confirmarHistoricoItem = (ev: EventoAnatomico, textoFinal?: string) => {
    saveMut.mutate({
      id: ev.id,
      paciente_id: pacienteId,
      regiao_id: ev.regiao_id,
      tipo_achado: textoFinal ?? ev.tipo_achado,
      tipo_diagnostico: 'historico_confirmado' as any,
      status: ev.status === 'resolvido' ? 'resolvido' : 'cronico',
      visivel_paciente: true,
      severidade: ev.severidade || 1,
      metadata: {
        ...(ev as any).metadata,
        revisado_profissional: true,
        revisado_por_ids: [...((ev as any).metadata?.revisado_por_ids || []), user?.id],
      },
    } as any);
    setEditandoHistoricoId(null);
    setTextoEditadoHistorico('');
  };

  const rejeitarHistoricoItem = async (ev: EventoAnatomico) => {
    if (!user) return;
    setRejeicaoLoading(ev.id);
    try {
      const meta = (ev as any).metadata || {};
      const rejeicoes = [...(meta.rejeicoes || []), { terapeuta_id: user.id, data: new Date().toISOString() }];
      const revisado_por_ids = [...(meta.revisado_por_ids || []), user.id];
      await (supabase as any)
        .from('eventos_clinicos_anatomicos')
        .update({ metadata: { ...meta, rejeicoes, revisado_por_ids } })
        .eq('id', ev.id);
      qc.invalidateQueries({ queryKey: ['eventos-anatomicos', pacienteId] });
    } finally {
      setRejeicaoLoading(null);
    }
  };

  // O cliente tem o MESMO avatar do profissional (corpo, sistemas, painéis,
  // histórico) — só muda: (1) privacidade dos dados: vê apenas os achados que o
  // profissional liberou (visivel_paciente); (2) sem edição (gated por
  // isProfessional). A riqueza VISUAL não é mais reduzida para o cliente.
  const soLiberados = !isProfessional;
  const modoSimplificado = false;
  const [sistemasAtivos, setSistemasAtivos] = useState<SistemaCorporal[]>([]);
  const [hoveredSistema, setHoveredSistema] = useState<SistemaCorporal | null>(null);
  const [view, setView] = useState<'front' | 'back'>('front');

  // Per-organ offsets and scales saved by the /calibrar tool — persisted in localStorage,
  // synced across tabs via the storage event.
  const [savedOrganOffsets, setSavedOrganOffsets] = useState<Record<string, { dx: number; dy: number }>>(() => {
    try {
      const raw = localStorage.getItem(LS_DOT_OFFSETS);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });
  const [savedOrganScales, setSavedOrganScales] = useState<Record<string, { sx: number; sy: number }>>(() => {
    try {
      const raw = localStorage.getItem(LS_SCALES);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });
  const [figura, setFigura] = useState<FiguraParams>(() => {
    try {
      const raw = localStorage.getItem(LS_FIGURA);
      return raw ? JSON.parse(raw) : DEFAULT_FIGURA;
    } catch { return DEFAULT_FIGURA; }
  });
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_DOT_OFFSETS) {
        try { setSavedOrganOffsets(e.newValue ? JSON.parse(e.newValue) : {}); } catch {}
      }
      if (e.key === LS_SCALES) {
        try { setSavedOrganScales(e.newValue ? JSON.parse(e.newValue) : {}); } catch {}
      }
      if (e.key === 'organ-labels-calibrado') {
        try { setSavedOrganLabels(e.newValue ? JSON.parse(e.newValue) : {}); } catch {}
      }
      if (e.key === 'organ-hidden-calibrado') {
        try { setSavedOrganHidden(new Set(e.newValue ? JSON.parse(e.newValue) : [])); } catch {}
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Load calibration from Supabase table — runs on mount and when page regains focus.
  // O CLIENTE deve ver o avatar EXATAMENTE como o profissional calibrou (tamanho
  // da figura, posição e escala dos órgãos). Como a calibração é do profissional,
  // quando o viewer é o paciente carregamos a calibração do terapeuta DELE — não
  // a própria (que não existe → figura grande/default e órgãos fora do lugar).
  const applyCalibrationFromCloud = useCallback(async () => {
    if (!user) return;
    let ownerId = user.id;
    if (!isProfessional) {
      const { data: pac } = await supabase.from('pacientes')
        .select('terapeuta_id').eq('id', pacienteId).maybeSingle();
      if (!pac?.terapeuta_id) return; // sem profissional → mantém o default
      ownerId = pac.terapeuta_id;
    }
    // @ts-expect-error -- tabela criada por migração; tipos serão regenerados
    supabase.from('avatar_calibracao')
      .select('offsets, scales, figura')
      .eq('terapeuta_id', ownerId)
      .maybeSingle()
      .then(({ data }: { data: { offsets: Record<string,{dx:number;dy:number}>; scales: Record<string,{sx:number;sy:number}>; figura: FiguraParams } | null }) => {
        if (!data) return;
        if (data.offsets && Object.keys(data.offsets).length > 0) {
          setSavedOrganOffsets(data.offsets);
          localStorage.setItem(LS_DOT_OFFSETS, JSON.stringify(data.offsets));
        }
        if (data.scales && Object.keys(data.scales).length > 0) {
          setSavedOrganScales(data.scales);
          localStorage.setItem(LS_SCALES, JSON.stringify(data.scales));
        }
        if (data.figura && Object.keys(data.figura).length > 0) {
          setFigura(data.figura);
          localStorage.setItem(LS_FIGURA, JSON.stringify(data.figura));
        }
      });
  }, [user, isProfessional, pacienteId]);

  useEffect(() => {
    applyCalibrationFromCloud();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Re-sync calibration whenever the user returns to this page/tab (e.g. after calibrating in another tab)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') applyCalibrationFromCloud();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [applyCalibrationFromCloud]);

  const [savedOrganLabels, setSavedOrganLabels] = useState<Record<string, string>>(() => {
    try { const r = localStorage.getItem('organ-labels-calibrado'); return r ? JSON.parse(r) : {}; } catch { return {}; }
  });
  const [savedOrganHidden, setSavedOrganHidden] = useState<Set<string>>(() => {
    try { const r = localStorage.getItem('organ-hidden-calibrado'); return new Set(r ? JSON.parse(r) : []); } catch { return new Set(); }
  });
  const [sheetRegiao, setSheetRegiao] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<EventoAnatomico> | null>(null);
  const [syncData, setSyncData] = useState<{ regiao_id: string; intensidade: number; sinal: string; sistema: string }[] | null>(null);
  // Sugestões do portal que o terapeuta dispensou nesta sessão (não viram achado).
  const [sugestoesIgnoradas, setSugestoesIgnoradas] = useState<Set<string>>(new Set());
  const [notaSistema, setNotaSistema] = useState<{ texto: string; natureza: 'condicao' | 'sintoma'; condicaoAssociada: string; regiaoManual: string }>({
    texto: '', natureza: 'condicao', condicaoAssociada: '', regiaoManual: '',
  });

  // Regiões musculoesqueléticas selecionáveis quando o texto não resolve a
  // região sozinho — evita que um achado de perna/joelho caia em "abdômen".
  const MSK_REGIOES_OPCOES: { id: string; label: string }[] = [
    { id: 'cabeca', label: 'Cabeça / ATM' }, { id: 'cervical', label: 'Cervical / Pescoço' },
    { id: 'ombro_d', label: 'Ombro D' }, { id: 'ombro_e', label: 'Ombro E' },
    { id: 'cotovelo_d', label: 'Cotovelo D' }, { id: 'cotovelo_e', label: 'Cotovelo E' },
    { id: 'antebraco_d', label: 'Antebraço D' }, { id: 'antebraco_e', label: 'Antebraço E' },
    { id: 'mao_d', label: 'Punho / Mão D' }, { id: 'mao_e', label: 'Punho / Mão E' },
    { id: 'dorsal', label: 'Dorso / Torácica' }, { id: 'lombar', label: 'Lombar / Sacro / Cóccix' },
    { id: 'gluteos', label: 'Glúteos / Quadril' },
    { id: 'coxa_d', label: 'Coxa D' }, { id: 'coxa_e', label: 'Coxa E' },
    { id: 'joelho_d', label: 'Joelho D' }, { id: 'joelho_e', label: 'Joelho E' },
    { id: 'cavo_d', label: 'Poplítea D (trás do joelho)' }, { id: 'cavo_e', label: 'Poplítea E (trás do joelho)' },
    { id: 'canela_d', label: 'Perna D' }, { id: 'canela_e', label: 'Perna E' },
    { id: 'panturr_d', label: 'Panturrilha D' }, { id: 'panturr_e', label: 'Panturrilha E' },
    { id: 'tornozelo_d', label: 'Tornozelo D' }, { id: 'tornozelo_e', label: 'Tornozelo E' },
    { id: 'pe_d', label: 'Pé D' }, { id: 'pe_e', label: 'Pé E' },
  ];

  const { data: lente } = useLenteAtiva();

  // Histórico do paciente: queixa principal, condições, medicamentos, alergias
  const { data: pacienteInfo } = useQuery({
    queryKey: ['paciente-genero-avatar', pacienteId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('pacientes')
        .select('genero')
        .eq('id', pacienteId)
        .maybeSingle();
      return data as { genero?: string } | null;
    },
    enabled: !!pacienteId,
  });
  const pacienteGenero = pacienteInfo?.genero || '';

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

  // Histórico de vida: traumas, cirurgias, doenças, diagnósticos históricos
  const { data: historiaVida = [] } = useQuery({
    queryKey: ['historia-vida-avatar', pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from('historia_vida_paciente')
        .select('id, data_evento, tipo, titulo, descricao, sistema_corporal, severidade, resolvido')
        .eq('paciente_id', pacienteId)
        .order('data_evento', { ascending: false });
      return data || [];
    },
    enabled: !!pacienteId,
  });

  // Diagnósticos CID confirmados pelo profissional
  const { data: diagnosticosCID = [] } = useQuery({
    queryKey: ['diagnosticos-avatar', pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from('diagnosticos_paciente')
        .select('id, data_diagnostico, cid_codigo, cid_descricao, ativo')
        .eq('paciente_id', pacienteId)
        .order('data_diagnostico', { ascending: false, nullsFirst: false });
      return data || [];
    },
    enabled: !!pacienteId,
  });

  // Sinais não-confirmados, vindos do histórico/ficha do paciente (MyID nunca alimenta o avatar)
  const sinalRegions = useMemo(() => {
    const fontes = [...(pacienteHistorico || [])];
    const seen = new Set<string>();
    return fontes.filter(s => {
      // Deduplica por termo + sistema (evita duplicar frente/costas/esquerda/direita)
      const key = `${s.sistema}|${s.sinal.toLowerCase().slice(0, 40)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [pacienteHistorico]);

  // relato_paciente não entra no mapa SVG nem na lista de achados — fica só
  // no card de revisão até o profissional confirmar como achado_clinico.
  const eventosFiltrados = useMemo(
    () => eventos.filter(e => sistemasAtivos.includes(e.sistema) && (e as any).tipo_diagnostico !== 'relato_paciente'),
    [eventos, sistemasAtivos],
  );

  const systemScores = useMemo(() => SISTEMAS_ORDEM.map(s => {
    const evsDoSistema = eventos.filter(e => e.sistema === s && e.status !== 'resolvido');
    // Anti-nocebo: o score de homeostase reflete só evidência DOCUMENTADA por profissional
    // (achados confirmados, histórico de vida, CID). sinalRegions são sugestões NLP não
    // confirmadas — entram apenas no count informativo (nSintomas), nunca no score.
    let score = evsDoSistema.reduce((acc, curr) => acc + cargaEvento(curr), 0);

    const sinaisSistema = sinalRegions.filter(sr => sr.sistema === s);
    const historiaAtiva = historiaVida.filter(h => h.sistema_corporal === s && !h.resolvido);
    const diagSistema = diagnosticosCID.filter(d => (d as any).sistema_corporal === s && d.ativo);

    score += historiaAtiva.reduce((acc: number, h: any) => acc + ((h.severidade || 1) * 0.6), 0);
    score += diagSistema.length * 0.8;

    return {
      sistema: s,
      score,
      count: evsDoSistema.length + sinaisSistema.length + historiaAtiva.length + diagSistema.length,
      nSintomas: sinaisSistema.length,
      nAchados: evsDoSistema.length,
      nHistoria: historiaAtiva.length,
      nDiags: diagSistema.length,
    };
  }).sort((a, b) => b.score - a.score), [eventos, sinalRegions, historiaVida, diagnosticosCID]);

  // Auto-ativa (uma vez) os sistemas que têm achados quando o avatar carrega —
  // antes o profissional gerava achados, abria o Avatar e via vazio até
  // adivinhar que precisava clicar num ícone de sistema ("salvou mas sumiu").
  const [autoAtivado, setAutoAtivado] = useState(false);
  useEffect(() => {
    if (!isProfessional || autoAtivado || sistemasAtivos.length > 0) return;
    const comAchado = systemScores.filter(s => s.count > 0).map(s => s.sistema);
    if (comAchado.length > 0) { setSistemasAtivos(comAchado); setAutoAtivado(true); }
  }, [systemScores, autoAtivado, sistemasAtivos.length, isProfessional]);

  // Reconstrói a carga clínica de cada sistema mês a mês a partir do ciclo de vida
  // dos achados (data_inicio/data_resolucao). Como o registro não guarda histórico de
  // mudanças de severidade/status, usa o valor ATUAL como aproximação para os meses em
  // que o achado esteve ativo — suficiente para mostrar tendência (subiu/desceu/estável),
  // não um valor retroativo exato.
  const evolucaoMensal = useMemo(() => {
    const eventosBase = eventos.filter(e => soLiberados ? e.visivel_paciente : true);
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
  }, [eventos, soLiberados]);

  // Regiões com achado ATIVO no Avatar Clínico — usado para não reoferecer no
  // "Sincronizar MyID" um achado que já foi confirmado anteriormente.
  const regioesAtivasExistentes = useMemo(
    () => new Set(eventos.filter(e => e.status !== 'resolvido').map(e => e.regiao_id)),
    [eventos],
  );
  const sinalRegionsParaSincronizar = useMemo(
    () => sinalRegions.filter(s => !regioesAtivasExistentes.has(s.regiao_id)),
    [sinalRegions, regioesAtivasExistentes],
  );

  // dominante por região: tipo confirmado > achado > relato; dentro do mesmo tipo, maior severidade
  const corPorRegiao = useMemo(() => {
    const map: Record<string, string> = {};
    const peso = (e: EventoAnatomico) =>
      (e.status === 'resolvido' ? 0 : 10) + e.severidade;

    // Cada achado marca EXCLUSIVAMENTE a sua própria região. Não há inferência
    // automática a partir do texto livre (ex.: "hérnia de disco L5" NÃO passa a
    // marcar coxa/ciático sozinho) nem a partir do histórico do paciente: todo
    // achado clínico no avatar é adicionado explicitamente pelo terapeuta.
    // As sugestões vindas do portal do paciente ficam no painel de sugestões
    // (sinalRegionsParaSincronizar), para o terapeuta adicionar ou não.
    eventosFiltrados.forEach(ev => {
      const td = (ev as any).tipo_diagnostico as string | undefined;
      const evTP = tipoPeso(td);
      const evP = peso(ev);
      const regId = ev.regiao_id;

      const prevTP = Number(map[regId + '__tipopeso'] || 0);
      const prevP = Number(map[regId + '__peso'] || -1);
      const shouldReplace = !map[regId] ||
        evTP > prevTP ||
        (evTP === prevTP && evP > prevP);
      if (shouldReplace) {
        map[regId] = corEvento(ev);
        map[regId + '__peso'] = String(evP);
        map[regId + '__tipo'] = td || 'achado_clinico';
        map[regId + '__tipopeso'] = String(evTP);
      }
    });

    return map;
  }, [eventosFiltrados]);

  // Condições ativas por zona corporal — usada para dots e lista compacta
  const activeConditions = useMemo(() => {
    const result: Array<{
      zonaId: string; label: string; cor: string; status: string; tipo_achado: string;
    }> = [];
    const statusLabel: Record<string, string> = {
      ativo: 'Ativo', cronico: 'Crônico', observacao: 'Obs.', resolvido: 'Resolvido',
    };
    ZONAS_CORPORAIS.forEach(zona => {
      const zoneEvs = eventosFiltrados.filter(ev => zona.ids.includes(ev.regiao_id));
      if (zoneEvs.length === 0) return;
      const top = [...zoneEvs].sort((a, b) => {
        const da = tipoPeso((a as any).tipo_diagnostico);
        const db = tipoPeso((b as any).tipo_diagnostico);
        return da !== db ? db - da : (b.severidade ?? 0) - (a.severidade ?? 0);
      })[0];
      result.push({
        zonaId: zona.id, label: zona.label, cor: corEvento(top),
        status: statusLabel[top.status] ?? top.status,
        tipo_achado: top.tipo_achado || '',
      });
    });
    return result;
  }, [eventosFiltrados]);

  // Cards: conditions for the currently selected system (mirrors avatar dots)
  const findingsForCards = useMemo(() => {
    const statusLabel: Record<string, string> = {
      ativo: 'Ativo', cronico: 'Crônico', em_tratamento: 'Em tratamento', observacao: 'Obs.',
    };
    const evs = eventosFiltrados.filter(e => e.status !== 'resolvido');
    const result: Array<{
      zonaId: string; id: string; label: string; cor: string; status: string; tipo_achado: string; sistema: SistemaCorporal;
    }> = [];
    ZONAS_CORPORAIS.forEach(zona => {
      const zoneEvs = evs.filter(ev => zona.ids.includes(ev.regiao_id));
      if (zoneEvs.length === 0) return;
      const top = [...zoneEvs].sort((a, b) => {
        const da = tipoPeso((a as any).tipo_diagnostico);
        const db = tipoPeso((b as any).tipo_diagnostico);
        return da !== db ? db - da : (b.severidade ?? 0) - (a.severidade ?? 0);
      })[0];
      result.push({
        zonaId: zona.id,
        id: top.id,
        label: zona.label,
        cor: corEvento(top),
        status: statusLabel[top.status] ?? top.status,
        tipo_achado: top.tipo_achado || '',
        sistema: top.sistema,
      });
    });
    return result;
  }, [eventosFiltrados]);

  const regioesBase = REGIONS.filter(r => r.view === view);

  // Órgãos exclusivos de cada sexo — ocultados quando incompatíveis com o gênero do paciente.
  // Avatar atual é masculino por padrão; se o paciente é feminino, esconde anatomia masculina e vice-versa.
  const FEMININE_ONLY_IDS = new Set(['mama_d', 'mama_e', 'utero', 'ovarios', 'trompas_falopio', 'vagina']);
  const MASCULINE_ONLY_IDS = new Set(['testiculos', 'prostata', 'penis', 'epididimo_d', 'epididimo_e', 'vesiculas_seminais']);
  const generoNorm = (pacienteGenero || '').toLowerCase().trim();
  const isFeminino = generoNorm.startsWith('fem') || generoNorm === 'f' || generoNorm.includes('mulher') || generoNorm.includes('female');
  // Quando gênero não informado: não filtra nenhum lado (profissional vê tudo, evita omissão clínica)
  const isMasculino = generoNorm.startsWith('masc') || generoNorm === 'm' || generoNorm.includes('homem') || generoNorm.includes('male');

  const regioesViscerais = VISCERAL_REGIONS.filter(r =>
    r.view === view && (
      r.sistemas.some(s => sistemasAtivos.includes(s as any)) ||
      sinalRegions.some(sr => sr.regiao_id === r.id)
    ) && !(isFeminino && MASCULINE_ONLY_IDS.has(r.id))
      && !(isMasculino && FEMININE_ONLY_IDS.has(r.id))
  );


  // Achados da região. Se rid for uma ZONA corporal (ex.: 'peitoral'), inclui
  // também os achados registrados em estruturas dessa zona (ex.: medula) — assim
  // o sheet aberto pelo card sempre mostra o achado para excluir/editar.
  const eventosDaRegiao = (rid: string) => {
    const zona = ZONAS_CORPORAIS.find(z => z.id === rid);
    const ids = zona ? new Set(zona.ids) : null;
    return eventos.filter(e => e.regiao_id === rid || (ids ? ids.has(e.regiao_id) : false));
  };

  const abrirSheet = (rid: string) => {
    if (!isProfessional || modoSimplificado) return;
    setSheetRegiao(rid);
    setEditing(null);
  };

  const novoAchado = () => {
    const regVisceral = VISCERAL_REGIONS.find(v => v.id === sheetRegiao);
    setEditing({
      paciente_id: pacienteId,
      regiao_id: sheetRegiao!,
      sistema: (regVisceral?.sistemas[0] as any) || 'musculoesqueletico',
      origem: 'exame_clinico',
      tipo_achado: '',
      tipo_diagnostico: 'achado_clinico' as TipoDiagnostico,
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Stethoscope className="icon-sm shrink-0" />
          Avatar Clínico Anatômico
          <div className="ml-auto flex items-center gap-1.5">
            {sinalRegionsParaSincronizar.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[10px] gap-1 px-2 border-primary/30 text-primary hover:bg-primary/5"
                onClick={() => setSyncData(sinalRegionsParaSincronizar.map(s => ({ regiao_id: s.regiao_id, intensidade: 5, sinal: s.sinal, sistema: s.sistema })))}
              >
                <RefreshCcw className="h-3 w-3" />
                Sincronizar Histórico
              </Button>
            )}

          </div>
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Mapa de achados clínicos georreferenciados.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Tabs defaultValue="mapa" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="mapa" className="text-xs">Mapa Corporal</TabsTrigger>
            <TabsTrigger value="achados" className="text-xs">Achados</TabsTrigger>
            <TabsTrigger value="evolucao" className="text-xs">Evolução</TabsTrigger>
          </TabsList>


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



        <div className="flex flex-col gap-2">
          {/* Ícones de sistema — fileira horizontal */}
          <div className="flex flex-wrap gap-1 justify-center">
            {systemScores.map(({ sistema: s, score }) => {
              const active = sistemasAtivos.length === 1 && sistemasAtivos[0] === s;
              const config = SISTEMA_CONFIG[s];
              const Icon = config.icon;
              let dotClass = "bg-border";
              if (score >= 5) dotClass = "bg-red-500";
              else if (score >= 2) dotClass = "bg-amber-500";
              else if (score > 0) dotClass = "bg-emerald-500";
              return (
                <button
                  key={s}
                  type="button"
                  title={config.label}
                  onMouseEnter={() => setHoveredSistema(s)}
                  onMouseLeave={() => setHoveredSistema(null)}
                  onClick={() => setSistemasAtivos(active ? [] : [s])}
                  className={cn(
                    "relative w-7 h-7 rounded-md border flex items-center justify-center transition-all hover:scale-110",
                    active ? "border-primary bg-primary/10 ring-1 ring-primary shadow-sm" : "border-border/50 bg-background opacity-70 hover:opacity-100"
                  )}
                >
                  <Icon className={cn("w-3.5 h-3.5", active && `text-${config.color}-600`)} />
                  {score > 0 && <span className={cn("absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-background", dotClass)} />}
                </button>
              );
            })}
          </div>

          <div className="flex items-start gap-2">
          {/* Silhueta — principal */}
          <div className="flex-1 relative min-w-0 flex justify-center">
          <svg viewBox={`0 0 240 ${Math.round(deriveFigura(figura).footY + 13)}`} className="h-auto w-full max-h-[62vh] mx-auto relative" shapeRendering="geometricPrecision" preserveAspectRatio="xMidYMid meet" style={{ filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.14)) drop-shadow(0 2px 5px rgba(0,0,0,0.10))' }}>
            <defs>
              <clipPath id="avc-clip">
                <path d={FRONT_OUTLINE} />
              </clipPath>
              <mask id="avc-body-mask-front" maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="520">
                <path d={FRONT_OUTLINE} fill="white" />
              </mask>
              <mask id="avc-body-mask-back" maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="520">
                <path d={FRONT_OUTLINE} fill="white" />
              </mask>
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
              {/* Gradiente de profundidade lateral — sombras nos flancos */}
              <linearGradient id="body-depth-l" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor="#000" stopOpacity="0.18"/>
                <stop offset="35%"  stopColor="#000" stopOpacity="0.04"/>
                <stop offset="100%" stopColor="#000" stopOpacity="0"/>
              </linearGradient>
              <linearGradient id="body-depth-r" x1="100%" y1="0%" x2="0%" y2="0%">
                <stop offset="0%"   stopColor="#000" stopOpacity="0.18"/>
                <stop offset="35%"  stopColor="#000" stopOpacity="0.04"/>
                <stop offset="100%" stopColor="#000" stopOpacity="0"/>
              </linearGradient>
              {/* Highlight central (reflexo de luz frontal) */}
              <radialGradient id="body-highlight" cx="38%" cy="18%" r="52%">
                <stop offset="0%"   stopColor="#fff" stopOpacity="0.22"/>
                <stop offset="100%" stopColor="#fff" stopOpacity="0"/>
              </radialGradient>
            </defs>
            <style>
              {`
                @keyframes pulse-organ {
                  0%,100% { opacity: 0.80; }
                  50% { opacity: 1.0; }
                }
                .pulse-organ { animation: pulse-organ 2.2s infinite ease-in-out; }
                @keyframes avcDotPing {
                  0%   { transform: scale(1);   opacity: 0.70; }
                  65%  { transform: scale(3.4); opacity: 0;    }
                  100% { transform: scale(1);   opacity: 0;    }
                }
                .avc-dot-ping {
                  animation: avcDotPing 2.6s ease-out infinite;
                  transform-box: fill-box;
                  transform-origin: center;
                }
              `}
            </style>

            {/* Drop shadow — acompanha os pés da figura calibrada */}
            <ellipse cx={120} cy={Math.round(deriveFigura(figura).footY + 6)} rx={46} ry={3} fill="black" opacity={0.08} />


            {/* Silhueta stick-figure — proporções da figura calibrada */}
            {(() => {
              const fig = figura;
              const d   = deriveFigura(fig);
              const bp  = buildStickFigurePaths(fig);
              return (
              <g pointerEvents="none">
                {/* Cabeça */}
                <circle cx={d.cx} cy={d.headCy} r={fig.headR}
                  stroke="currentColor" strokeWidth="1.8" opacity="0.22"
                  fill="currentColor" fillOpacity="0.05" />
                {/* Pescoço */}
                <rect x={d.cx - 8} y={d.neckTop} width={16} height={d.neckH} rx={4}
                  fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeWidth="1.4" opacity="0.18" />
                {/* Tronco */}
                <path d={bp.torso}
                  stroke="currentColor" strokeWidth="1.8" opacity="0.22" fill="currentColor" fillOpacity="0.05" />
                {/* Braço esquerdo */}
                <path d={bp.leftArm}
                  stroke="currentColor" strokeWidth={fig.armSW} strokeLinecap="round" opacity="0.12" fill="none"/>
                {/* Braço direito */}
                <path d={bp.rightArm}
                  stroke="currentColor" strokeWidth={fig.armSW} strokeLinecap="round" opacity="0.12" fill="none"/>
                {/* Perna esquerda */}
                <path d={bp.leftLeg}
                  stroke="currentColor" strokeWidth={fig.legSW} strokeLinecap="round" opacity="0.12" fill="none"/>
                {/* Perna direita */}
                <path d={bp.rightLeg}
                  stroke="currentColor" strokeWidth={fig.legSW} strokeLinecap="round" opacity="0.12" fill="none"/>

              {view === 'back' && (
                /* Overlay anatômico das costas — coluna, escápulas, glúteos, Aquiles */
                <g fill="none" stroke="hsl(24, 35%, 22%)" opacity={0.40} strokeLinecap="round">
                  <path d="M120 100 L120 305" strokeWidth={0.9} strokeDasharray="2,2" />
                  {[112,126,140,154,168,182,196,210,224,238,252,266,280,294].map(y => (
                    <line key={y} x1={115} y1={y} x2={125} y2={y} strokeWidth={0.7} />
                  ))}
                  <path d="M92 130 Q104 154 114 182" strokeWidth={0.75} />
                  <path d="M148 130 Q136 154 126 182" strokeWidth={0.75} />
                  <circle cx={112} cy={284} r={1.9} fill="hsl(24, 35%, 20%)" stroke="none" opacity={0.55} />
                  <circle cx={128} cy={284} r={1.9} fill="hsl(24, 35%, 20%)" stroke="none" opacity={0.55} />
                  <path d="M120 305 L120 330" strokeWidth={0.8} />
                  <path d="M90 320 Q120 334 150 320" strokeWidth={0.7} />
                  <path d="M104 398 Q108 405 112 398" strokeWidth={0.55} />
                  <path d="M128 398 Q132 405 136 398" strokeWidth={0.55} />
                  <path d="M108 478 L108 500" strokeWidth={0.5} />
                  <path d="M132 478 L132 500" strokeWidth={0.5} />
                </g>
              )}
              </g>
              );
            })()}

            <g mask={view === 'back' ? 'url(#avc-body-mask-back)' : 'url(#avc-body-mask-front)'}>


              {/* Linhas anatômicas decorativas removidas — a ilustração base já mostra a anatomia.
                  Mantemos apenas o grupo posterior abaixo, pois a vista de trás ainda usa silhueta vetorial. */}

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

              {/* Pontos anatômicos renderizados fora da máscara — ver abaixo */}
              {false && regioesBase.map(r => {
                const fill = corPorRegiao[r.id];
                const isHoveredSystem = hoveredSistema === 'musculoesqueletico';
                if (!fill && !isHoveredSystem) return null;
                const tipo = corPorRegiao[r.id + '__tipo'] || 'achado_clinico';
                const isRelato = tipo === 'relato_paciente';
                const isHistorico = tipo === 'historico_relatado';
                const isDiag = tipo.startsWith('diagnostico_');
                const severityScore = Number(corPorRegiao[r.id + '__peso'] || 0);
                const fillOp = fill ? (isRelato || isHistorico ? 0.32 : isDiag ? 0.88 : 0.65) : 0.28;
                const sw = fill ? (isRelato || isHistorico ? 0.6 : isDiag ? 1.8 : 1.1) : 0.5;
                const dash = isRelato || isHistorico ? '4,3' : undefined;
                const needsGlow = isDiag && severityScore >= 12;
                // Apply calibrator offset (same mechanism as VISCERAL_REGIONS)
                const rOff = savedOrganOffsets[r.id] ?? { dx: 0, dy: 0 };
                const rTransform = (rOff.dx !== 0 || rOff.dy !== 0)
                  ? `translate(${rOff.dx},${rOff.dy})`
                  : undefined;
                return (
                  <path
                    key={r.id}
                    d={r.d}
                    transform={rTransform}
                    fill={fill || 'rgba(168,85,247,0.24)'}
                    fillOpacity={fillOp}
                    stroke={fill ? (isDiag ? 'rgba(255,255,255,0.85)' : 'rgba(168,85,247,0.65)') : 'rgba(168,85,247,0.35)'}
                    strokeWidth={sw}
                    strokeDasharray={dash}
                    filter={needsGlow ? 'url(#glow-urgent)' : severityScore >= 8 && isDiag ? 'url(#glow)' : undefined}
                    className="cursor-pointer hover:opacity-80 transition-all"
                    onClick={() => abrirSheet(r.id)}
                  />
                );
              })}

              {/* Órgãos viscerais: substituídos por pontos — ver abaixo */}
              {false && [...regioesViscerais]
                .sort((a, b) => (a.layer ?? 5) - (b.layer ?? 5))
                .map(r => {
                const fill = corPorRegiao[r.id];
                const belongsToActiveSystem = r.sistemas.some(s => sistemasAtivos.includes(s as any));
                const isHoveredSystem = r.sistemas.some(s => hoveredSistema === s);
                if (!belongsToActiveSystem && !isHoveredSystem) return null;
                if (savedOrganHidden.has(r.id)) return null;

                const severityScore = Number(corPorRegiao[r.id + '__peso'] || 0);
                const isUrgent = severityScore >= 13;
                const sys0 = r.sistemas[0];
                // Shift vertical por sistema. Em modo calibração usa os valores

                // Órgãos com offset salvo pelo /calibrar já incorporam a correção
                // completa — não aplicar o offset de sistema para evitar dupla soma.
                const hasCalibrated = r.id in savedOrganOffsets;
                const sysDy = hasCalibrated
                  ? 0
                  : (DEFAULT_SYS_Y_OFFSET[sys0] ?? 0);
                // Per-organ offset salvo pelo calibrador (/calibrar)
                const organOff = savedOrganOffsets[r.id] ?? { dx: 0, dy: 0 };
                const totalDx = organOff.dx;
                const totalDy = sysDy + organOff.dy;
                const groupTransform = (totalDx !== 0 || totalDy !== 0)
                  ? `translate(${totalDx},${totalDy})`
                  : undefined;

                // STRUCTURAL (diaphragm, pericardium) — non-clickable dividers
                if (r.type === 'structural') {
                  if (!belongsToActiveSystem) return null;
                  const isDialfragma = r.id.startsWith('diafragma');
                  return (
                    <path
                      key={r.id}
                      d={r.d}
                      transform={groupTransform}
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
                      transform={groupTransform}
                      fill="none"
                      stroke={baseColor}
                      strokeWidth={fill ? 2.2 : isHoveredSystem ? 2.0 : 1.3}
                      strokeLinecap="round"
                      filter={fill ? 'url(#glow)' : undefined}
                      className="cursor-pointer"
                      onClick={() => abrirSheet(r.id)}
                    >
                      <title>{savedOrganLabels[r.id] ?? r.label}</title>
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
                      transform={groupTransform}
                      fill="none"
                      stroke={nerveColor}
                      strokeWidth={fill ? 2.0 : isHoveredSystem ? 1.8 : (isSpine ? 1.4 : 0.9)}
                      strokeDasharray={isSpine ? undefined : '3,2.5'}
                      strokeLinecap="round"
                      filter={fill ? 'url(#glow)' : undefined}
                      className="cursor-pointer"
                      onClick={() => abrirSheet(r.id)}
                    >
                      <title>{savedOrganLabels[r.id] ?? r.label}</title>
                    </path>
                  );
                }

                // GLAND + ORGAN — filled shapes, com peso visual por tipo_diagnostico
                const orgTipo = corPorRegiao[r.id + '__tipo'] || 'achado_clinico';
                const orgIsRelato = orgTipo === 'relato_paciente';
                const orgIsHist = orgTipo === 'historico_relatado';
                const orgIsDiag = orgTipo.startsWith('diagnostico_');
                const restingColor = ORGAN_RESTING_COLORS[r.id] || SYSTEM_RESTING[sys0] || 'rgba(155,163,175,0.45)';
                const effectiveFill    = fill || (isHoveredSystem ? (SYSTEM_HOVER[sys0] || 'rgba(14,165,233,0.78)') : restingColor);
                const effectiveOpacity = fill
                  ? (orgIsRelato || orgIsHist ? 0.62 : orgIsDiag ? 0.98 : 0.88)
                  : (isHoveredSystem ? 0.90 : 0.86);
                const effectiveStroke  = fill
                  ? (orgIsDiag ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.70)')
                  : (isHoveredSystem ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.38)');
                const effectiveSW      = r.type === 'gland'
                  ? (fill ? (orgIsDiag ? 1.2 : 0.7) : 0.3)
                  : (fill ? (orgIsDiag ? 2.0 : orgIsRelato || orgIsHist ? 0.8 : 1.3) : isHoveredSystem ? 1.6 : 0.5);
                const orgDash = (orgIsRelato || orgIsHist) && fill ? '4,3' : undefined;

                return (
                  <g key={r.id} transform={groupTransform} className={cn(isUrgent && 'pulse-organ')}>
                    <path
                      d={r.d}
                      fill={effectiveFill}
                      fillOpacity={effectiveOpacity}
                      stroke={effectiveStroke}
                      strokeWidth={effectiveSW}
                      strokeDasharray={orgDash}
                      filter={isUrgent ? 'url(#glow-urgent)' : (fill && orgIsDiag) ? 'url(#glow)' : undefined}
                      className="cursor-pointer hover:brightness-110 transition-all"
                      onClick={() => abrirSheet(r.id)}
                    >
                      <title>{savedOrganLabels[r.id] ?? r.label}</title>
                    </path>
                    {r.type !== 'gland' && (
                      <path d={r.d} fill="url(#organ-vol)" pointerEvents="none" opacity={0.48} />
                    )}
                  </g>
                );
              })}
            </g>

            {/* ═══ Zonas transparentes ═══
                As zonas continuam existindo (posicionam os pontos e resolvem os
                achados por região), mas NÃO são desenhadas: o avatar aparece
                limpo e apenas as marcações pontuais indicam a região acometida.
                Ver ZONAS_CORPORAIS + o bloco de dots abaixo. */}

            {/* ═══ Dots clínicos — um ponto colorido por zona com achado ativo ═══ */}
            {ZONAS_CORPORAIS
              .filter(z => !z.views || z.views.includes(view as 'front' | 'back'))
              .map(zona => {
                const cor = zona.ids.reduce(
                  (acc: string | null, id) => acc ?? (corPorRegiao[id] ?? null),
                  null,
                );
                if (!cor) return null;

                const off = savedOrganOffsets[zona.id] ?? { dx: 0, dy: 0 };
                const piv = zonePivot(zona.shape);
                const rawX = piv.x + off.dx;
                // Na vista posterior a lateralidade espelha: o lado direito do
                // paciente aparece à DIREITA de quem olha (o oposto da frente).
                // As zonas bilaterais dos membros usam coordenadas orientadas
                // pela frente, então espelhamos em torno do eixo médio (x=120,
                // viewBox 240). Estruturas na linha média (coluna, crânio) ficam
                // em x=120 → 240-120=120, ou seja, não se movem.
                const cx  = view === 'back' ? 240 - rawX : rawX;
                const cy  = piv.y + off.dy;

                return (
                  <g key={zona.id} style={{ cursor: 'pointer' }}
                    onClick={() => abrirSheet(zona.id)}>
                    {/* Anel pulsante */}
                    <circle cx={cx} cy={cy} r={9} fill={cor} className="avc-dot-ping" />
                    {/* Ponto sólido */}
                    <circle cx={cx} cy={cy} r={7} fill={cor} />
                    {/* Destaque central */}
                    <circle cx={cx} cy={cy} r={2.8} fill="white" opacity={0.70} />
                  </g>
                );
              })
            }



          </svg>
          </div>

          {/* Achados — coluna lateral direita */}
          <div className="w-32 shrink-0 flex flex-col gap-1.5 max-h-[500px] overflow-y-auto pr-0.5">
            {sistemasAtivos.length === 0 ? (
              <p className="text-[10px] text-muted-foreground text-center py-4 italic leading-relaxed">
                Selecione um sistema acima.
              </p>
            ) : findingsForCards.length === 0 ? (
              <p className="text-[10px] text-muted-foreground text-center py-4 italic">
                Sem achados ativos.
              </p>
            ) : findingsForCards.map(c => {
              const sysColor = SISTEMA_CHART_COLOR[c.sistema] || '#94a3b8';
              const statusHex: Record<string, string> = {
                'Ativo': '#ec4899', 'Crônico': '#f59e0b', 'Em tratamento': '#f97316', 'Obs.': '#eab308',
              };
              const sh = statusHex[c.status] || '#94a3b8';
              return (
                <div key={c.zonaId}
                  className="w-full rounded-xl border px-2 py-1.5 shrink-0 relative group"
                  style={{ borderColor: `${sysColor}35`, background: `${sysColor}0a` }}>
                  <button type="button" onClick={() => abrirSheet(c.zonaId)} className="w-full text-left transition-opacity hover:opacity-80 active:opacity-60">
                    <div className="flex items-start justify-between gap-1 mb-0.5 pr-5">
                      <p className="text-[10px] font-bold leading-tight" style={{ color: sysColor }}>{c.label}</p>
                      <span className="text-[8px] font-semibold px-1 py-px rounded-full shrink-0"
                        style={{ color: sh, background: `${sh}1a` }}>{c.status}</span>
                    </div>
                    {c.tipo_achado && (
                      <p className="text-[9px] text-muted-foreground leading-snug line-clamp-2 pr-5">{c.tipo_achado}</p>
                    )}
                  </button>
                  {isProfessional && !modoSimplificado && (
                    <button
                      type="button"
                      title="Excluir achado"
                      className="absolute top-1 right-1 p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      disabled={deleteMut.isPending}
                      onClick={() => {
                        if (window.confirm(`Excluir o achado "${c.tipo_achado || c.label}"?`)) {
                          deleteMut.mutate(c.id);
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          </div>

        {/* Detalhe do sistema selecionado/hovered — aparece na íntegra com sua marcação clínica */}
        {(() => {
          const sysToShow = hoveredSistema || (sistemasAtivos.length === 1 ? sistemasAtivos[0] : null);
          if (!sysToShow) return null;
          const config = SISTEMA_CONFIG[sysToShow];
          const Icon = config.icon;

          const achadosClinicos = eventos.filter(e => e.sistema === sysToShow && e.status !== 'resolvido');
          const sinaisHistorico = sinalRegions.filter(sr => sr.sistema === sysToShow && (sr as any).fonte === 'historico_paciente');
          const historiaDoSistema = historiaVida.filter(h => h.sistema_corporal === sysToShow);
          const diagsDoSistema = diagnosticosCID.filter(d => (d as any).sistema_corporal === sysToShow);

          const relatosPaciente = achadosClinicos.filter(e => (e as any).tipo_diagnostico === 'relato_paciente');
          const diagsMedicos = achadosClinicos.filter(e => (e as any).tipo_diagnostico === 'diagnostico_medico');
          const diagsFisio = achadosClinicos.filter(e => (e as any).tipo_diagnostico === 'diagnostico_fisioterapia');
          const diagsPsico = achadosClinicos.filter(e => (e as any).tipo_diagnostico === 'diagnostico_psicologia');
          const diagsNutri = achadosClinicos.filter(e => (e as any).tipo_diagnostico === 'diagnostico_nutricao');
          const diagsFono = achadosClinicos.filter(e => (e as any).tipo_diagnostico === 'diagnostico_fonoaudiologia');
          const diagsOutro = achadosClinicos.filter(e => (e as any).tipo_diagnostico === 'diagnostico_outro');
          const achadosGenericos = achadosClinicos.filter(e => !(e as any).tipo_diagnostico || (e as any).tipo_diagnostico === 'achado_clinico');

          const renderGrupo = (
            items: typeof achadosClinicos,
            IconComp: React.ElementType,
            colorClass: string,
            titulo: string,
            key: string,
          ) => {
            if (items.length === 0) return null;
            return (
              <div key={key} className="space-y-1">
                <p className={`text-[10px] font-bold uppercase flex items-center gap-1 ${colorClass}`}>
                  <IconComp className="w-3 h-3" /> {titulo}:
                </p>
                <div className="space-y-1 pl-4">
                  {items.map((e, idx) => (
                    <div key={`${key}-${idx}`} className="flex items-start gap-2">
                      <div className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: corEvento(e) }} />
                      <div className="text-[11px] leading-tight">
                        <span className="font-bold">{[...REGIONS, ...VISCERAL_REGIONS].find(r => r.id === e.regiao_id)?.label || (e.regiao_id === 'sistemico' ? 'Sistêmico' : e.regiao_id)}:</span> {e.tipo_achado}
                        {(e as any).metadata?.natureza === 'sintoma' && (e as any).metadata?.condicao_associada && (
                          <p className="text-[10px] text-sky-700 mt-0.5">Sintoma de: {(e as any).metadata.condicao_associada}</p>
                        )}
                        {e.notas_clinicas && <p className="text-[10px] text-muted-foreground mt-0.5 italic">"{e.notas_clinicas}"</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          };

          const selecionadoExplicitamente = sistemasAtivos.length === 1 && sistemasAtivos[0] === sysToShow;
          // MSK NÃO tem fallback de região (antes caía em 'abdomen', marcando
          // achados de perna/joelho no abdômen). Sem detecção, o profissional
          // escolhe a região no seletor abaixo.
          const regiaoPadrao = sysToShow === 'musculoesqueletico'
            ? ''
            : (VISCERAL_REGIONS.find(r => r.sistemas.includes(sysToShow))?.id || 'abdomen');
          const regiaoDetectada = notaSistema.texto.trim()
            ? encontrarSintomasEmTexto(notaSistema.texto).find(s => s.sistema === sysToShow)?.regiao_id
            : undefined;
          const regiaoAuto = notaSistema.regiaoManual || regiaoDetectada || regiaoPadrao;

          return (
            <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 mt-3 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex gap-3 items-center border-b border-primary/10 pb-2">
                <div className={cn("p-1.5 rounded-lg bg-background border border-primary/10", `text-${config.color}-500`)}>
                  <Icon className="w-4 h-4" />
                </div>
                <p className="text-xs font-black uppercase tracking-wider">{config.label}</p>
              </div>

              {/* (Adicionar condição saiu daqui: use o painel "Condições
                  sistêmicas" acima, ou clique numa região no corpo. Este painel
                  agora só MOSTRA os achados do sistema.) */}

              <div className="space-y-3">
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

                {achadosClinicos.length === 0 && sinaisHistorico.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic pl-4">Nenhum achado clínico registrado nesta avaliação.</p>
                ) : (
                  <>
                    {renderGrupo(relatosPaciente, User, 'text-sky-600', 'RELATO DO PACIENTE (não confirmado)', 'relato')}
                    {renderGrupo(diagsMedicos, Shield, 'text-red-600', 'DIAGNÓSTICO MÉDICO (nosológico)', 'med')}
                    {renderGrupo(diagsFisio, Activity, 'text-green-600', 'DIAGNÓSTICO CINÉTICO-FUNCIONAL (Fisio)', 'fisio')}
                    {renderGrupo(diagsPsico, Brain, 'text-violet-600', 'DIAGNÓSTICO PSICOLÓGICO', 'psico')}
                    {renderGrupo(diagsNutri, Droplets, 'text-emerald-600', 'DIAGNÓSTICO NUTRICIONAL', 'nutri')}
                    {renderGrupo(diagsFono, Waves, 'text-indigo-600', 'DIAGNÓSTICO FONOAUDIOLÓGICO', 'fono')}
                    {renderGrupo(diagsOutro, Stethoscope, 'text-amber-600', 'DIAGNÓSTICO (especialista)', 'outro')}
                    {renderGrupo(achadosGenericos, Stethoscope, 'text-amber-600', 'ACHADOS DA AVALIAÇÃO PRESENCIAL', 'achado')}
                  </>
                )}

                {historiaDoSistema.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-rose-600 uppercase flex items-center gap-1">
                      <Heart className="w-3 h-3" /> Histórico de Vida:
                    </p>
                    <div className="space-y-1 pl-4">
                      {historiaDoSistema.map((h: any) => (
                        <div key={h.id} className="flex items-start gap-2">
                          <div className={cn(
                            "w-1 h-1 rounded-full mt-1.5 shrink-0",
                            h.resolvido ? 'bg-gray-400' : h.severidade >= 3 ? 'bg-red-500' : h.severidade >= 2 ? 'bg-orange-400' : 'bg-amber-400'
                          )} />
                          <div className="text-[11px] leading-tight">
                            <span className="font-bold capitalize">{h.tipo.replace(/_/g, ' ')}:</span>{' '}
                            <span className={h.resolvido ? 'line-through text-muted-foreground' : ''}>{h.titulo}</span>
                            {h.descricao && <p className="text-[10px] text-muted-foreground mt-0.5 italic">"{h.descricao}"</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {diagsDoSistema.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-red-600 uppercase flex items-center gap-1">
                      <Shield className="w-3 h-3" /> Diagnósticos Confirmados:
                    </p>
                    <div className="space-y-1 pl-4">
                      {diagsDoSistema.map((d: any) => (
                        <div key={d.id} className="flex items-start gap-2">
                          <div className={cn("w-1 h-1 rounded-full mt-1.5 shrink-0", !d.ativo ? 'bg-gray-400' : 'bg-red-500')} />
                          <div className="text-[11px] leading-tight">
                            {d.cid_codigo && <span className="font-black text-primary">[{d.cid_codigo}]</span>}{' '}
                            <span className={!d.ativo ? 'line-through text-muted-foreground' : 'font-medium'}>{d.cid_descricao}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Legend — sistema → cor */}
        {findingsForCards.length > 0 && (
          <div className="space-y-1 mt-2">
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] justify-center">
              {(Object.entries(SISTEMA_CHART_COLOR) as [SistemaCorporal, string][])
                .filter(([s]) => findingsForCards.some(c => c.sistema === s))
                .map(([s, color]) => (
                  <span key={s} className="flex items-center gap-1 text-muted-foreground">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                    {SISTEMA_CONFIG[s]?.label || s}
                  </span>
                ))}
            </div>
            <p className="text-[10px] text-muted-foreground text-center italic mt-1">
              O avatar é atualizado automaticamente a cada avaliação por voz ou presencial.
            </p>
          </div>
        )}

        {/* ═══ Sugestões da história clínica do portal ═══
            Nada é marcado no avatar automaticamente. Aqui aparece o que o
            paciente relatou no portal; o terapeuta decide adicionar ou não. */}
        {isProfessional && !modoSimplificado && (() => {
          const pendentes = sinalRegionsParaSincronizar.filter(
            s => !sugestoesIgnoradas.has(`${s.regiao_id}|${s.sinal}`),
          );
          if (pendentes.length === 0) return null;
          const limparHist = (t: string) => t.replace(/^Histórico:\s*/i, '');
          return (
            <div className="rounded-xl border border-sky-200/70 bg-sky-50/50 dark:border-sky-900/40 dark:bg-sky-950/20 p-3 mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-sky-600 shrink-0" />
                <p className="text-xs font-bold text-sky-800 dark:text-sky-300">Sugestões da história do paciente</p>
                <span className="ml-auto text-[10px] font-semibold text-sky-700/80 bg-sky-100 dark:bg-sky-900/40 rounded-full px-2 py-0.5">
                  {pendentes.length}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-snug">
                Detectado no que o paciente respondeu no portal. Nada é marcado no avatar até você adicionar como achado clínico.
              </p>
              <div className="space-y-1.5">
                {pendentes.map((s, idx) => {
                  const reg = [...REGIONS, ...VISCERAL_REGIONS].find(r => r.id === s.regiao_id);
                  const sysLabel = SISTEMA_CONFIG[s.sistema as SistemaCorporal]?.label || s.sistema;
                  const key = `${s.regiao_id}|${s.sinal}`;
                  return (
                    <div key={`${key}-${idx}`} className="flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-semibold truncate">{limparHist(s.sinal)}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{reg?.label || s.regiao_id} · {sysLabel}</p>
                      </div>
                      <Button
                        size="sm"
                        className="h-7 px-2 text-[11px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                        disabled={saveMut.isPending}
                        onClick={async () => {
                          // Condição sistêmica (diabetes, hipertensão, asma…) não
                          // vai para uma região — vira achado sistêmico do sistema.
                          const sisSistemica = sistemaDaCondicaoSistemica(s.sinal);
                          const visceral = VISCERAL_REGIONS.find(v => v.id === s.regiao_id);
                          const musculo = REGIONS.find(r => r.id === s.regiao_id);
                          const sistema = sisSistemica
                            ? sisSistemica
                            : visceral
                              ? (visceral.sistemas[0] as any)
                              : musculo ? 'musculoesqueletico' : (s.sistema || 'musculoesqueletico');
                          await saveMut.mutateAsync({
                            paciente_id: pacienteId,
                            regiao_id: sisSistemica ? 'sistemico' : s.regiao_id,
                            sistema,
                            origem: 'autocadastro_paciente',
                            tipo_achado: limparHist(s.sinal),
                            tipo_diagnostico: 'achado_clinico',
                            severidade: 2,
                            status: 'cronico',
                            visivel_paciente: true,
                            data_inicio: new Date().toISOString().slice(0, 10),
                            metadata: { origem_sugestao_portal: true, revisado_profissional: true },
                          } as any);
                        }}
                      >
                        <Plus className="h-3 w-3" /> Adicionar
                      </Button>
                      <button
                        type="button"
                        className="p-1 rounded hover:bg-accent shrink-0"
                        title="Ignorar sugestão"
                        onClick={() => setSugestoesIgnoradas(prev => new Set(prev).add(key))}
                      >
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>
      </div>
          </TabsContent>

          <TabsContent value="achados" className="pt-3">
        {/* Lista de achados ativos */}
        {isLoading ? (
          <p className="text-xs text-muted-foreground text-center py-2">Carregando…</p>
        ) : (eventos.filter(e => e.status !== 'resolvido' && (e as any).tipo_diagnostico !== 'relato_paciente' && (soLiberados ? e.visivel_paciente : true)).length === 0) ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            Nenhum achado ativo {soLiberados ? 'visível' : 'registrado'}.
          </p>
        ) : (() => {
          const achados = eventos.filter(e => e.status !== 'resolvido' && (e as any).tipo_diagnostico !== 'relato_paciente' && (soLiberados ? e.visivel_paciente : true));
          const visiveis = achados.slice(0, 6);
          const extras = achados.length - visiveis.length;
          return (
            <div className="space-y-1.5">
              {visiveis.map(ev => {
                const reg = [...REGIONS, ...VISCERAL_REGIONS].find(r => r.id === ev.regiao_id);
                const td = (ev as any).tipo_diagnostico as string | undefined;
                const isRelato = td === 'relato_paciente';
                const isDiag = td?.startsWith('diagnostico_');
                return (
                  <button
                    key={ev.id}
                    disabled={!isProfessional}
                    onClick={() => abrirSheet(ev.regiao_id)}
                    className={`w-full flex items-center gap-2 text-left p-2 rounded-lg transition border ${
                      isDiag
                        ? 'border-red-200/60 bg-red-50/40 dark:bg-red-950/20 dark:border-red-900/40'
                        : isRelato
                          ? 'border-purple-200/40 bg-purple-50/20 dark:bg-purple-950/10 dark:border-purple-900/30'
                          : 'border-border/30 hover:bg-muted/40'
                    } ${!isProfessional ? 'cursor-default' : ''}`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: corEvento(ev) }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate flex items-center gap-1 flex-wrap">
                        {isDiag && <CheckCircle2 className="h-3 w-3 text-red-600 shrink-0" />}
                        {isRelato && <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />}
                        {ev.tipo_achado}
                        <span className={cn(
                          "text-[9px] px-1 py-0.5 rounded font-normal shrink-0",
                          isDiag ? "bg-red-100 text-red-700" : isRelato ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"
                        )}>
                          {TIPO_DIAG_BADGE[td || 'achado_clinico'] || td}
                        </span>
                        <span className="text-muted-foreground font-normal">· {reg?.label || (ev.regiao_id === 'sistemico' ? 'Sistêmico' : ev.regiao_id)}</span>
                      </p>
                      {!modoSimplificado && (
                        <p className="text-[10px] text-muted-foreground">
                          {STATUS_LABEL[ev.status]} · {SISTEMA_LABEL[ev.sistema]}
                          {isRelato && <span className="text-amber-600 font-semibold"> · Aguarda confirmação</span>}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
              {extras > 0 && (
                <p className="text-[11px] text-muted-foreground text-center pt-1">
                  +{extras} achado{extras !== 1 ? 's' : ''} — clique em uma região do mapa para ver todos
                </p>
              )}
            </div>
          );
        })()}

        {/* Histórico Clínico — achados resolvidos */}
        {(() => {
          // Resolvidos — privacidade: o cliente só vê os liberados (o histórico
          // relatado no portal é resolvido + visivel_paciente=false até o
          // profissional confirmar, então não vaza aqui).
          const historico = eventos.filter(e => e.status === 'resolvido' && (!soLiberados || e.visivel_paciente));
          if (historico.length === 0) return null;
          return (
            <div className="mt-3 space-y-1.5 border-t border-border/30 pt-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                <History className="w-3 h-3" /> Histórico Clínico — Resolvidos ({historico.length})
              </p>
              <div className="space-y-0.5">
                {historico.slice(0, 5).map(ev => {
                  const reg = [...REGIONS, ...VISCERAL_REGIONS].find(r => r.id === ev.regiao_id);
                  const td = (ev as any).tipo_diagnostico as string | undefined;
                  return (
                    <button
                      key={ev.id}
                      onClick={() => abrirSheet(ev.regiao_id)}
                      className="w-full flex items-center gap-2 text-left py-1 px-2 rounded hover:bg-muted/30 transition"
                    >
                      <span className="w-2 h-2 rounded-full shrink-0 bg-gray-400" />
                      <p className="text-[11px] text-muted-foreground line-through truncate flex-1">{ev.tipo_achado}</p>
                      <span className="text-[9px] text-muted-foreground shrink-0">{reg?.label || ev.regiao_id}</span>
                      {td && td !== 'achado_clinico' && (
                        <span className="text-[9px] bg-muted px-1 rounded shrink-0">{TIPO_DIAG_BADGE[td] || td}</span>
                      )}
                    </button>
                  );
                })}
                {historico.length > 5 && (
                  <p className="text-[9px] text-muted-foreground text-center py-0.5">+{historico.length - 5} no histórico</p>
                )}
              </div>
            </div>
          );
        })()}
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

        {/* Espaço de revisão abaixo do avatar: histórico vindo do portal do paciente ou adicionado pelo profissional. Não afeta o Índice de Homeostase até confirmação.
            Exclusivo do profissional — o paciente não decide o que entra confirmado no próprio avatar clínico. */}
        {isProfessional && (() => {
          const pendentes = eventos.filter(
            (e) => e.tipo_diagnostico === 'relato_paciente' && e.status !== 'resolvido'
          );
          const pendentesHistorico = eventos.filter(
            (e) => e.tipo_diagnostico === 'historico_relatado' &&
              !((e as any).metadata?.revisado_por_ids || []).includes(user?.id) &&
              ((e as any).metadata?.rejeicoes?.length || 0) < 3
          );
          const descartadosConsenso = eventos.filter(
            (e) => e.tipo_diagnostico === 'historico_relatado' &&
              ((e as any).metadata?.rejeicoes?.length || 0) >= 3
          );
          return (
            <div className="space-y-3 border-t border-border/40 pt-3">
              <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Revisão de Histórico</p>

              {isProfessional && (
                <p className="text-[11px] text-muted-foreground italic">
                  Para registrar um novo sintoma ou condição, clique no ícone do sistema ao lado do corpo e use o campo de nota que aparece abaixo do avatar.
                </p>
              )}

              {pendentes.length === 0 && pendentesHistorico.length === 0 && descartadosConsenso.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Nenhum histórico pendente de revisão.</p>
              )}

              {pendentes.length > 0 && (
                <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-800/40 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-amber-800 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {pendentes.length} Relato{pendentes.length > 1 ? 's' : ''} do paciente — aguardando confirmação
                  </div>
                  <p className="text-[11px] text-amber-700 dark:text-amber-500">
                    Leia o relato, ajuste o campo se necessário e confirme para registrar no avatar.
                  </p>
                  <div className="space-y-3">
                    {pendentes.map((ev) => {
                      const hda = (ev as any).metadata?.historia_estruturada as {
                        queixa?: string; inicio?: string; fatores?: string; impacto?: string;
                      } | undefined;
                      const campos = hda
                        ? [
                            { label: 'Queixa principal', valor: hda.queixa },
                            { label: 'Início', valor: hda.inicio },
                            { label: 'Melhora / Piora', valor: hda.fatores },
                            { label: 'Impacto na rotina', valor: hda.impacto },
                          ].filter(c => c.valor)
                        : [];
                      return (
                        <div key={ev.id} className="rounded-md bg-white/80 dark:bg-background/60 border border-amber-100 dark:border-amber-900/40 p-3 space-y-2.5">
                          {campos.length > 0 ? (
                            <div className="space-y-1.5">
                              {campos.map(c => (
                                <div key={c.label}>
                                  <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase">{c.label}</p>
                                  <p className="text-xs text-foreground leading-relaxed whitespace-pre-line">{c.valor}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-foreground leading-relaxed whitespace-pre-line">{ev.tipo_achado}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-amber-100 dark:border-amber-900/30">
                            <Button
                              size="sm"
                              className="h-7 px-3 text-xs gap-1"
                              onClick={() => saveMut.mutate({
                                id: ev.id,
                                paciente_id: pacienteId,
                                regiao_id: ev.regiao_id,
                                tipo_achado: ev.tipo_achado,
                                tipo_diagnostico: 'achado_clinico' as any,
                                metadata: { ...(ev as any).metadata, revisado_profissional: true },
                              })}
                            >
                              <Check className="h-3 w-3" /> Confirmar achado
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-3 text-xs"
                              onClick={() => deleteMut.mutate(ev.id)}
                            >
                              Descartar
                            </Button>
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              {new Date(ev.data_inicio).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {pendentesHistorico.length > 0 && (
                <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-800/40 p-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase text-amber-800 dark:text-amber-400">
                    <ClipboardList className="h-3.5 w-3.5" />
                    <Badge variant="warning" size="sm">{pendentesHistorico.length}</Badge>
                    Histórico clínico relatado pelo paciente
                  </div>
                  <p className="text-[11px] text-amber-700 dark:text-amber-500">
                    Confirme o que entra no Avatar Clínico, ajuste o texto se necessário, ou rejeite.
                    Itens rejeitados por 3 profissionais distintos são arquivados automaticamente.
                  </p>
                  <div className="space-y-2">
                    {pendentesHistorico.map((ev) => {
                      const meta = (ev as any).metadata || {};
                      const categoria = CATEGORIA_LABEL[meta.categoria] || meta.categoria;
                      const numRejeicoes: number = meta.rejeicoes?.length || 0;
                      const regiaoInfo = [...REGIONS, ...(VISCERAL_REGIONS as any[])].find((r: any) => r.id === ev.regiao_id);
                      const isEditando = editandoHistoricoId === ev.id;
                      const isRejeicaoLoading = rejeicaoLoading === ev.id;
                      const linhasNota = (ev.notas_clinicas || '').split('\n').filter(Boolean);
                      const textoOriginal = linhasNota.find((l: string) => l.startsWith('Resposta:'))?.replace('Resposta:', '').trim();

                      return (
                        <div key={ev.id} className="rounded-lg bg-white/80 dark:bg-background/60 border border-amber-100 dark:border-amber-900/30 p-3 space-y-2">
                          {/* Header: categoria + região + data */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-wrap gap-1">
                              {categoria && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{categoria}</Badge>}
                              {regiaoInfo && <Badge variant="outline" className="text-[10px] h-4 px-1.5">{regiaoInfo.label}</Badge>}
                            </div>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {new Date(ev.data_inicio).toLocaleDateString('pt-BR')}
                            </span>
                          </div>

                          {/* Texto do achado (editável ou estático) */}
                          {isEditando ? (
                            <Input
                              value={textoEditadoHistorico}
                              onChange={(e) => setTextoEditadoHistorico(e.target.value)}
                              className="text-sm h-8"
                              autoFocus
                            />
                          ) : (
                            <p className="text-sm font-medium text-foreground leading-snug">{ev.tipo_achado}</p>
                          )}

                          {/* Relato original do paciente */}
                          {textoOriginal && !isEditando && (
                            <p className="text-[11px] text-muted-foreground border-l-2 border-amber-200 dark:border-amber-700 pl-2 italic leading-relaxed">
                              "{textoOriginal}"
                            </p>
                          )}

                          {/* Indicador de rejeições anteriores */}
                          {numRejeicoes > 0 && (
                            <p className="text-[10px] text-amber-700 dark:text-amber-400 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              Rejeitado por {numRejeicoes} profissional{numRejeicoes > 1 ? 'is' : ''} até agora
                            </p>
                          )}

                          {/* Ações */}
                          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-amber-100 dark:border-amber-900/30">
                            {isEditando ? (
                              <>
                                <Button
                                  size="sm"
                                  className="h-7 px-3 text-xs gap-1"
                                  onClick={() => confirmarHistoricoItem(ev, textoEditadoHistorico)}
                                  disabled={!textoEditadoHistorico.trim()}
                                >
                                  <Check className="h-3 w-3" /> Salvar e confirmar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-3 text-xs"
                                  onClick={() => { setEditandoHistoricoId(null); setTextoEditadoHistorico(''); }}
                                >
                                  <X className="h-3 w-3" /> Cancelar
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  className="h-7 px-3 text-xs gap-1"
                                  onClick={() => confirmarHistoricoItem(ev)}
                                >
                                  <Check className="h-3 w-3" /> Confirmar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-3 text-xs gap-1"
                                  onClick={() => { setEditandoHistoricoId(ev.id); setTextoEditadoHistorico(ev.tipo_achado); }}
                                >
                                  <Pencil className="h-3 w-3" /> Ajustar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-3 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                  disabled={isRejeicaoLoading}
                                  onClick={() => rejeitarHistoricoItem(ev)}
                                >
                                  {isRejeicaoLoading
                                    ? <Loader2 className="h-3 w-3 animate-spin" />
                                    : 'Rejeitar'}
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Descartados por consenso (3+ rejeições) */}
              {descartadosConsenso.length > 0 && (
                <div className="rounded-lg border border-border/50 bg-muted/30 overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
                    onClick={() => setDescartadosOpen(o => !o)}
                  >
                    <span className="flex items-center gap-2">
                      <History className="h-3.5 w-3.5" />
                      {descartadosConsenso.length} item{descartadosConsenso.length > 1 ? 'ns' : ''} arquivado{descartadosConsenso.length > 1 ? 's' : ''} por consenso
                    </span>
                    {descartadosOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                  {descartadosOpen && (
                    <div className="px-3 pb-3 space-y-1.5 border-t border-border/30 pt-2">
                      <p className="text-[11px] text-muted-foreground">
                        Rejeitados por 3 ou mais profissionais. Ficam arquivados para auditoria.
                        Se o paciente atualizar o histórico com informações equivalentes, novos itens serão criados com contagem zerada.
                      </p>
                      {descartadosConsenso.map(ev => {
                        const meta = (ev as any).metadata || {};
                        const categoria = CATEGORIA_LABEL[meta.categoria] || meta.categoria;
                        return (
                          <div key={ev.id} className="flex items-start gap-2 rounded-md bg-muted/50 px-2 py-1.5 text-xs">
                            <span className="font-medium flex-1 line-through text-muted-foreground">{ev.tipo_achado}</span>
                            {categoria && <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">{categoria}</Badge>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
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
              {/* Sinais detectados via histórico/ficha do paciente (autorelato, aguardando confirmação) */}
              {(() => {
                const sinaisDaRegiao = sinalRegions.filter(sr => sr.regiao_id === sheetRegiao);
                if (sinaisDaRegiao.length === 0) return null;
                return (
                  <div className="bg-sky-50 border border-sky-100 rounded-lg p-3 space-y-2">
                    <p className="text-[10px] font-bold text-sky-600 uppercase flex items-center gap-1">
                      <User className="w-3 h-3" /> Detectado via Histórico do Paciente:
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
                                origem: 'outro',
                                tipo_achado: s.sinal,
                                severidade: 2,
                                status: 'ativo',
                                visivel_paciente: true,
                                data_inicio: new Date().toISOString().slice(0, 10),
                                notas_clinicas: `Sinal detectado automaticamente via histórico/ficha do paciente: ${s.sinal}`,
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

              {sheetRegiao && eventosDaRegiao(sheetRegiao).map(ev => {
                const td = (ev as any).tipo_diagnostico as string | undefined;
                const isRelato = td === 'relato_paciente' || td === 'historico_relatado';
                const isDiag = td?.startsWith('diagnostico_');
                return (
                <div key={ev.id} className={cn(
                  "border rounded-lg p-3 space-y-2 transition-colors",
                  isDiag ? "border-red-200 bg-red-50/30 dark:bg-red-950/10" :
                  isRelato ? "border-amber-200/60 bg-amber-50/20 dark:bg-amber-950/10" :
                  "border-border/50 hover:border-primary/30"
                )}>
                  <div className="flex items-start gap-2">
                    <span className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ background: corEvento(ev) }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-1">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold leading-tight">{ev.tipo_achado}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            <span className={cn(
                              "px-1.5 py-0.5 rounded font-medium mr-1",
                              isDiag ? "bg-red-100 text-red-700" : isRelato ? "bg-amber-100 text-amber-700" : "bg-muted"
                            )}>
                              {TIPO_DIAG_BADGE[td || 'achado_clinico']}
                            </span>
                            {STATUS_LABEL[ev.status]} · Sev {ev.severidade}/4 · {SISTEMA_LABEL[ev.sistema]}
                            {ev.estrutura && <span className="text-primary font-medium"> · {ev.estrutura}</span>}
                            {ev.diagnostico_cid && <span className="bg-primary/10 text-primary px-1 rounded ml-1">{ev.diagnostico_cid}</span>}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {ev.visivel_paciente ? (
                            <User className="h-3 w-3 text-green-500 mt-0.5" />
                          ) : (
                            <ShieldCheck className="h-3 w-3 text-muted-foreground mt-0.5" />
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(ev)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteMut.mutate(ev.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      {ev.notas_clinicas && (
                        <p className="text-[11px] text-muted-foreground mt-1.5 bg-muted/30 p-2 rounded italic">
                          "{ev.notas_clinicas}"
                        </p>
                      )}
                      {/* Ações rápidas por tipo */}
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {isRelato && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px] gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            onClick={() => setEditing({
                              ...ev,
                              tipo_diagnostico: 'achado_clinico',
                              severidade: Math.max(ev.severidade, 2),
                            } as any)}
                          >
                            <CheckCircle2 className="h-3 w-3" /> Confirmar como Achado
                          </Button>
                        )}
                        {ev.status !== 'resolvido' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px] gap-1 border-gray-300 text-gray-600 hover:bg-gray-50"
                            onClick={() => saveMut.mutateAsync({
                              ...ev,
                              status: 'resolvido',
                              data_resolucao: new Date().toISOString().slice(0, 10),
                            } as any)}
                            disabled={saveMut.isPending}
                          >
                            <History className="h-3 w-3" /> Mover para Histórico
                          </Button>
                        )}
                        {ev.status === 'resolvido' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px] gap-1 border-amber-300 text-amber-700 hover:bg-amber-50"
                            onClick={() => saveMut.mutateAsync({
                              ...ev,
                              status: 'ativo',
                              data_resolucao: null,
                            } as any)}
                            disabled={saveMut.isPending}
                          >
                            <ArrowRight className="h-3 w-3" /> Reativar
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
              })}
              {/* Histórico de vida relacionado ao sistema da região */}
              {sheetRegiao && (() => {
                const regVis = VISCERAL_REGIONS.find(r => r.id === sheetRegiao);
                // Regiões normais (REGIONS) são todas musculoesqueléticas
                const sistemasRegiao: string[] = regVis?.sistemas || ['musculoesqueletico'];
                const historiaRegiao = historiaVida.filter(h => sistemasRegiao.includes(h.sistema_corporal as string));
                const diagsRegiao = diagnosticosCID.filter(d => sistemasRegiao.includes((d as any).sistema_corporal as string));
                if (historiaRegiao.length === 0 && diagsRegiao.length === 0) return null;
                return (
                  <div className="mt-4 space-y-3">
                    {historiaRegiao.length > 0 && (
                      <div className="border border-rose-200 bg-rose-50/50 rounded-lg p-3 space-y-2">
                        <p className="text-[10px] font-bold text-rose-700 uppercase flex items-center gap-1">
                          <Heart className="w-3 h-3" /> Histórico de Vida deste Sistema
                        </p>
                        <div className="space-y-1.5">
                          {historiaRegiao.map((h: any) => (
                            <div key={h.id} className="flex items-start gap-2">
                              <span className={cn(
                                "w-2 h-2 rounded-full mt-1 shrink-0",
                                h.resolvido ? 'bg-gray-400' : h.severidade >= 3 ? 'bg-red-500' : h.severidade >= 2 ? 'bg-orange-400' : 'bg-amber-400'
                              )} />
                              <div className="text-[11px] leading-tight">
                                <span className="font-semibold capitalize text-rose-800">{h.tipo.replace(/_/g, ' ')}</span>
                                {' — '}
                                <span className={h.resolvido ? 'line-through text-muted-foreground' : ''}>{h.titulo}</span>
                                {h.data_evento && <span className="text-[9px] text-muted-foreground ml-1">({h.data_evento})</span>}
                                {h.descricao && <p className="text-[10px] text-muted-foreground mt-0.5 italic">"{h.descricao}"</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {diagsRegiao.length > 0 && (
                      <div className="border border-red-200 bg-red-50/50 rounded-lg p-3 space-y-2">
                        <p className="text-[10px] font-bold text-red-700 uppercase flex items-center gap-1">
                          <Shield className="w-3 h-3" /> Diagnósticos Confirmados
                        </p>
                        <div className="space-y-1.5">
                          {diagsRegiao.map((d: any) => (
                            <div key={d.id} className="flex items-start gap-2">
                              <span className={cn("w-2 h-2 rounded-full mt-1 shrink-0", !d.ativo ? 'bg-gray-400' : 'bg-red-600')} />
                              <div className="text-[11px] leading-tight">
                                {d.cid_codigo && <span className="font-black text-red-700 mr-1">[{d.cid_codigo}]</span>}
                                <span className={!d.ativo ? 'line-through text-muted-foreground' : 'font-medium'}>{d.cid_descricao}</span>
                                {!d.ativo && <span className="text-[9px] text-muted-foreground ml-1">· resolvido</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              <Button onClick={novoAchado} className="w-full mt-4" size="sm">
                <Plus className="icon-xs mr-1" /> Novo Achado Clínico
              </Button>
            </div>
          )}

          {editing && (
            <div className="mt-4 space-y-3">
              {/* Classificação primeiro — define o peso clínico do registro */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Classificação Diagnóstica *</Label>
                <Select
                  value={(editing as any).tipo_diagnostico || 'achado_clinico'}
                  onValueChange={(value) => {
                    const updates: any = { tipo_diagnostico: value };
                    if (value === 'historico_relatado') {
                      updates.status = 'resolvido';
                      updates.severidade = 1;
                      updates.data_resolucao = updates.data_resolucao || new Date().toISOString().slice(0, 10);
                    } else if (value.startsWith('diagnostico_')) {
                      if (!editing.severidade || editing.severidade < 2) updates.severidade = 2;
                      if (editing.status === 'resolvido') updates.status = 'ativo';
                    } else if (value === 'relato_paciente') {
                      updates.severidade = 1;
                    }
                    setEditing(prev => ({ ...prev!, ...updates }));
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relato_paciente">🗣 Relato do Paciente — não confirmado</SelectItem>
                    <SelectItem value="historico_relatado">📋 Tratamento/Histórico Relatado — aguarda confirmação</SelectItem>
                    <SelectItem value="achado_clinico">🔍 Achado Clínico — avaliação presencial</SelectItem>
                    <SelectItem value="diagnostico_medico">🏥 Diagnóstico Médico — confirmado (nosológico)</SelectItem>
                    <SelectItem value="diagnostico_fisioterapia">⚡ Diagnóstico Fisioterapêutico — cinético-funcional</SelectItem>
                    <SelectItem value="diagnostico_psicologia">🧠 Diagnóstico Psicológico — confirmado</SelectItem>
                    <SelectItem value="diagnostico_nutricao">🥗 Diagnóstico Nutricional — confirmado</SelectItem>
                    <SelectItem value="diagnostico_fonoaudiologia">🎙 Diagnóstico Fonoaudiológico — confirmado</SelectItem>
                    <SelectItem value="diagnostico_outro">📌 Diagnóstico por Especialista — confirmado</SelectItem>
                  </SelectContent>
                </Select>
                {((editing as any).tipo_diagnostico?.startsWith('diagnostico_')) && (
                  <p className="text-[10px] text-red-600 font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Diagnóstico confirmado — aparece com marcação forte no avatar
                  </p>
                )}
                {(editing as any).tipo_diagnostico === 'historico_relatado' && (
                  <p className="text-[10px] text-amber-600 font-medium flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Status "Resolvido" definido automaticamente — vai para o histórico
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Descrição do achado *</Label>
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

      {/* Dialog de Sincronização do Histórico do Paciente */}
      <Sheet open={!!syncData} onOpenChange={(o) => !o && setSyncData(null)}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <RefreshCcw className="h-5 w-5 text-primary" />
              Sincronização Assistida — Histórico do Paciente
            </SheetTitle>
          </SheetHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Detectamos sinais na ficha/histórico do paciente.
              Selecione o que deseja importar para o Avatar Clínico.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-8">
              {(syncData || []).map((item, idx) => {
                const reg = [...REGIONS, ...VISCERAL_REGIONS].find(r => r.id === item.regiao_id);
                return (
                  <div key={`${item.regiao_id}-${idx}`} className="flex items-center justify-between p-3 border rounded-xl bg-muted/30">
                    <div>
                      <p className="text-sm font-semibold">{item.sinal}</p>
                      <p className="text-[11px] text-muted-foreground">{reg?.label || item.regiao_id}</p>
                    </div>
                    <Button size="sm" className="h-8 text-xs" onClick={async () => {
                      const visceral = VISCERAL_REGIONS.find(v => v.id === item.regiao_id);
                      const musculo = REGIONS.find(r => r.id === item.regiao_id);
                      const sistema = visceral
                        ? (visceral.sistemas[0] as any)
                        : musculo
                          ? 'musculoesqueletico'
                          : (item.sistema || 'musculoesqueletico');
                      await saveMut.mutateAsync({
                        paciente_id: pacienteId,
                        regiao_id: item.regiao_id,
                        sistema,
                        origem: 'outro',
                        tipo_achado: `Histórico: ${item.sinal}`,
                        severidade: 2,
                        status: 'cronico',
                        visivel_paciente: true,
                        data_inicio: new Date().toISOString().slice(0, 10),
                      });
                      setSyncData(prev => prev ? prev.filter((_, i) => i !== idx) : null);
                    }} disabled={saveMut.isPending}>
                      Importar
                    </Button>
                  </div>
                );
              })}
            </div>

            {(syncData?.length ?? 0) === 0 && (
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
