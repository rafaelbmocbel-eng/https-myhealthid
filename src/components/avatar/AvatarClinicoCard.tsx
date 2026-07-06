import { useMemo, useState, useEffect } from 'react';
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
import { useLenteAtiva, type PerfilProfissional } from '@/hooks/useLenteAtiva';





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

// Posições dos pontos anatômicos no stick-figure (viewBox 240×520).
// Frente/costas compartilham o mesmo mapa — o ponto indica a região, não a superfície.
const PONTO_ANATOMICO: Record<string, { cx: number; cy: number }> = {
  // ─ CABEÇA / PESCOÇO ────────────────────────────────────────
  cabeca:               { cx: 120, cy: 32  },
  occipital:            { cx: 120, cy: 32  },
  // ─ PESCOÇO ─────────────────────────────────────────────────
  pescoco:              { cx: 120, cy: 61  },
  cervical:             { cx: 120, cy: 61  },
  // ─ OMBROS ──────────────────────────────────────────────────
  ombro_d:              { cx:  72, cy: 90  },
  ombro_e:              { cx: 168, cy: 90  },
  trapezio_d:           { cx:  82, cy: 99  },
  trapezio_e:           { cx: 158, cy: 99  },
  // ─ BRAÇO D (paciente direito = esquerda na tela) ────────────
  braco_d:              { cx:  60, cy: 112 },
  cotovelo_d:           { cx:  51, cy: 138 },
  antebraco_d:          { cx:  50, cy: 152 },
  punho_d:              { cx:  50, cy: 161 },
  mao_d:                { cx:  50, cy: 164 },
  // ─ BRAÇO E (paciente esquerdo = direita na tela) ────────────
  braco_e:              { cx: 180, cy: 112 },
  cotovelo_e:           { cx: 189, cy: 138 },
  antebraco_e:          { cx: 190, cy: 152 },
  punho_e:              { cx: 190, cy: 161 },
  mao_e:                { cx: 190, cy: 164 },
  // ─ TRONCO ──────────────────────────────────────────────────
  peitoral:             { cx: 120, cy: 108 },
  toracica:             { cx: 120, cy: 115 },
  dorso:                { cx: 120, cy: 122 },
  abdomen:              { cx: 120, cy: 145 },
  lombar:               { cx: 120, cy: 148 },
  pelve:                { cx: 120, cy: 168 },
  sacral:               { cx: 120, cy: 166 },
  // ─ QUADRIL ─────────────────────────────────────────────────
  coxofemural_d:        { cx: 102, cy: 182 },
  coxofemural_e:        { cx: 138, cy: 182 },
  gluteo_d:             { cx: 100, cy: 182 },
  gluteo_e:             { cx: 140, cy: 182 },
  // ─ COXA ────────────────────────────────────────────────────
  coxa_d:               { cx:  99, cy: 248 },
  coxa_e:               { cx: 141, cy: 248 },
  // ─ JOELHO ──────────────────────────────────────────────────
  joelho_d:             { cx:  99, cy: 315 },
  joelho_e:             { cx: 141, cy: 315 },
  // ─ PERNA ───────────────────────────────────────────────────
  canela_d:             { cx:  98, cy: 376 },
  canela_e:             { cx: 142, cy: 376 },
  // ─ TORNOZELO ───────────────────────────────────────────────
  tornozelo_d:          { cx:  99, cy: 455 },
  tornozelo_e:          { cx: 141, cy: 455 },
  // ─ PÉ ──────────────────────────────────────────────────────
  pe_d:                 { cx: 100, cy: 498 },
  pe_e:                 { cx: 140, cy: 498 },
  // ─ NERVOSO ─────────────────────────────────────────────────
  cerebro:              { cx: 120, cy: 26  },
  cerebelo:             { cx: 120, cy: 40  },
  cerebro_p:            { cx: 120, cy: 26  },
  cerebelo_p:           { cx: 120, cy: 40  },
  tronco_encefalico:    { cx: 120, cy: 55  },
  medula_espinhal_v:    { cx: 120, cy: 122 },
  medula_p:             { cx: 120, cy: 122 },
  // ─ CIRCULATÓRIO ────────────────────────────────────────────
  coracao:              { cx: 112, cy: 108 },
  aorta:                { cx: 120, cy: 115 },
  vena_cava:            { cx: 122, cy: 118 },
  // ─ RESPIRATÓRIO ────────────────────────────────────────────
  traqueia:             { cx: 120, cy: 78  },
  pulmao_d:             { cx: 104, cy: 112 },
  pulmao_e:             { cx: 136, cy: 112 },
  pulmao_d_p:           { cx: 104, cy: 112 },
  pulmao_e_p:           { cx: 136, cy: 112 },
  // ─ DIGESTÓRIO ──────────────────────────────────────────────
  esofago:              { cx: 120, cy: 90  },
  figado:               { cx: 109, cy: 130 },
  estomago:             { cx: 114, cy: 138 },
  vesicula_biliar:      { cx: 117, cy: 137 },
  pancreas_corpo:       { cx: 120, cy: 142 },
  duodeno:              { cx: 126, cy: 140 },
  baco_frente:          { cx: 131, cy: 135 },
  intestino_delgado:    { cx: 120, cy: 150 },
  colon_ascendente:     { cx: 108, cy: 147 },
  colon_transverso:     { cx: 120, cy: 143 },
  colon_descendente:    { cx: 132, cy: 147 },
  colon_sigmoide:       { cx: 128, cy: 158 },
  apendice:             { cx: 110, cy: 153 },
  reto:                 { cx: 120, cy: 163 },
  // ─ ENDÓCRINO ───────────────────────────────────────────────
  hipofise:             { cx: 120, cy: 28  },
  tireoide:             { cx: 120, cy: 68  },
  adrenal_d:            { cx: 108, cy: 133 },
  adrenal_e:            { cx: 132, cy: 133 },
  adrenal_d_p:          { cx: 108, cy: 133 },
  adrenal_e_p:          { cx: 132, cy: 133 },
  ilhotas_langerhans:   { cx: 120, cy: 142 },
  // ─ URINÁRIO ────────────────────────────────────────────────
  rim_d_frente:         { cx: 107, cy: 138 },
  rim_e_frente:         { cx: 133, cy: 138 },
  rim_d:                { cx: 107, cy: 138 },
  rim_e:                { cx: 133, cy: 138 },
  bexiga:               { cx: 120, cy: 163 },
  ureteres:             { cx: 120, cy: 150 },
  // ─ LINFÁTICO ───────────────────────────────────────────────
  timo:                 { cx: 120, cy: 95  },
  linfonodos_cervicais: { cx: 120, cy: 67  },
  linfonodos_axilares_d:{ cx:  65, cy: 95  },
  linfonodos_axilares_e:{ cx: 175, cy: 95  },
  linfonodos_inguinais: { cx: 120, cy: 173 },
  cisterna_chyli:       { cx: 120, cy: 133 },
  // ─ REPRODUTOR ──────────────────────────────────────────────
  utero:                { cx: 120, cy: 163 },
  ovarios:              { cx: 120, cy: 162 },
  testiculos:           { cx: 120, cy: 170 },
  prostata:             { cx: 120, cy: 166 },
};

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

// Shift vertical (px, espaço SVG 240×520) aplicado a cada sistema no avatar.
// Positivo = desce, negativo = sobe. Referência: diafragma y=178–198 está correto.
// Para calibrar: ative o modo de calibração na interface e arraste os sliders.
const DEFAULT_SYS_Y_OFFSET: Partial<Record<string, number>> = {
  sensorial:          0,
  nervoso:            0,
  musculoesqueletico: 0,
  locomotor:          0,
  circulatorio:       0,
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
  circulatorio: '#ef4444',
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

  const [modoSimplificadoState, setModoSimplificadoState] = useState(!isProfessional);
  // Paciente nunca tem acesso de edição: força modo simplificado independente de estado local.
  const modoSimplificado = !isProfessional || modoSimplificadoState;
  const [sistemasAtivos, setSistemasAtivos] = useState<SistemaCorporal[]>([]);
  const [hoveredSistema, setHoveredSistema] = useState<SistemaCorporal | null>(null);
  const [view, setView] = useState<'front' | 'back'>('front');
  const [calibrando, setCalibrandoState] = useState(false);
  const [calibRegiaoId, setCalibRegiaoId] = useState<string>('');
  const [offsetsCalib, setOffsetsCalib] = useState<Record<string, number>>(
    Object.fromEntries(SISTEMAS_ORDEM.map(s => [s, 0]))
  );

  // Per-organ offsets saved by the /calibrar tool — persisted in localStorage,
  // synced across tabs via the storage event.
  const [savedOrganOffsets, setSavedOrganOffsets] = useState<Record<string, { dx: number; dy: number }>>(() => {
    try {
      const raw = localStorage.getItem('organ-offsets-calibrado');
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'organ-offsets-calibrado') {
        try { setSavedOrganOffsets(e.newValue ? JSON.parse(e.newValue) : {}); } catch {}
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

  const [savedOrganLabels, setSavedOrganLabels] = useState<Record<string, string>>(() => {
    try { const r = localStorage.getItem('organ-labels-calibrado'); return r ? JSON.parse(r) : {}; } catch { return {}; }
  });
  const [savedOrganHidden, setSavedOrganHidden] = useState<Set<string>>(() => {
    try { const r = localStorage.getItem('organ-hidden-calibrado'); return new Set(r ? JSON.parse(r) : []); } catch { return new Set(); }
  });
  const [sheetRegiao, setSheetRegiao] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<EventoAnatomico> | null>(null);
  const [syncData, setSyncData] = useState<{ regiao_id: string; intensidade: number; sinal: string; sistema: string }[] | null>(null);
  const [notaSistema, setNotaSistema] = useState<{ texto: string; natureza: 'condicao' | 'sintoma'; condicaoAssociada: string }>({
    texto: '', natureza: 'condicao', condicaoAssociada: '',
  });

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

  // Reconstrói a carga clínica de cada sistema mês a mês a partir do ciclo de vida
  // dos achados (data_inicio/data_resolucao). Como o registro não guarda histórico de
  // mudanças de severidade/status, usa o valor ATUAL como aproximação para os meses em
  // que o achado esteve ativo — suficiente para mostrar tendência (subiu/desceu/estável),
  // não um valor retroativo exato.
  const evolucaoMensal = useMemo(() => {
    const eventosBase = eventos.filter(e => modoSimplificado ? e.visivel_paciente : true);
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
  }, [eventos, modoSimplificado]);

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

    eventosFiltrados.forEach(ev => {
      const td = (ev as any).tipo_diagnostico as string | undefined;
      const evTP = tipoPeso(td);
      const evP = peso(ev);

      // A descrição livre (tipo_achado) pode mencionar outras regiões/lados além
      // da região fixa selecionada no formulário (ex.: regiao_id = 'joelho_d' mas
      // o texto diz "fratura joelho direito e esquerdo") — detecta e marca também.
      // Não restringe pelo sistema do achado: a região fixa (ex.: "Abdômen") pode
      // ter sido salva sob um sistema diferente do que o texto livre menciona
      // (ex.: achado em "Abdômen"/digestório cuja descrição fala de "coxa
      // esquerda" — musculoesquelético). O texto é a fonte de verdade aqui.
      const regioesAfetadas = new Set([ev.regiao_id]);
      if (ev.tipo_achado) {
        encontrarSintomasEmTexto(ev.tipo_achado)
          .filter(s => sistemasAtivos.includes(s.sistema as any))
          .forEach(s => regioesAfetadas.add(s.regiao_id));
      }

      regioesAfetadas.forEach(regId => {
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
    });

    // Sinais não-confirmados (histórico do paciente, notas clínicas) — nunca competem
    // visualmente com achado documentado, opacidade baixa.
    const FONTE_ALPHA: Record<string, number> = {
      notas_clinicas: 0.52,
      historico_paciente: 0.44,
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
      const fonte = (item as any).fonte || 'historico_paciente';
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


    return map;
  }, [eventosFiltrados, sinalRegions, sistemasAtivos]);

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


  const eventosDaRegiao = (rid: string) => eventos.filter(e => e.regiao_id === rid);

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
        <div className="flex flex-wrap justify-between items-center gap-2 mt-1">
          <p className="text-xs text-muted-foreground">
            Mapa de achados clínicos georreferenciados.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {!modoSimplificado && lente && (
              <button
                type="button"
                className="text-[9px] border border-border rounded-full px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                title={`Destacar sistemas relevantes para ${lente.nome_exibicao}`}
                onClick={() => setSistemasAtivos(SISTEMAS_POR_ESPECIALIDADE[lente.id] || SISTEMAS_ORDEM)}
              >
                Lente: {lente.nome_exibicao}
              </button>
            )}
            {isProfessional && (
              <>
                <Label htmlFor="modo-view" className="text-[10px] cursor-pointer">
                  {modoSimplificado ? "Visão Paciente" : "Visão Profissional"}
                </Label>
                <Switch
                  id="modo-view"
                  checked={!modoSimplificado}
                  onCheckedChange={(v) => setModoSimplificadoState(!v)}
                  className="h-4 w-8"
                />
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Resumo sempre visível (não fica escondido em aba): homeostase + pendências de revisão */}
        <div className="space-y-3">
        {/* Resumo de Homeostase (sempre visível, compacto) */}
        <div className="bg-muted/30 p-3 rounded-lg border border-border/50 flex items-center justify-between">
          {(() => {
            const totalScore = systemScores.reduce((acc, curr) => acc + curr.score, 0);
            const homeostase = Math.max(0, Math.min(100, Math.round(100 - Math.log1p(totalScore) * 18)));
            return (
              <>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                    Índice de Homeostase
                    <span title="Calculado a partir da carga clínica de cada sistema (achados confirmados, histórico de vida e diagnósticos CID — autorrelato MyID não entra no cálculo), com decaimento logarítmico. Não substitui o MyID-100.">
                      <Info className="h-3 w-3 text-muted-foreground/70 cursor-help" />
                    </span>
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
              </>
            );
          })()}
        </div>
        </div>

        <Tabs defaultValue="mapa" className="w-full pt-2">
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

        {/* Painel de calibração de posicionamento anatômico */}
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setCalibrandoState(c => !c)}
            className="text-[10px] text-muted-foreground/60 underline underline-offset-2 w-full text-center"
          >
            {calibrando ? '✕ Fechar calibração' : '⚙ Calibrar posição dos órgãos'}
          </button>
          {calibrando && (
            <div className="mt-2 bg-muted/50 border border-border/40 rounded-xl p-3 space-y-2">
              <p className="text-[10px] text-muted-foreground text-center">
                Pontos em laranja = todas as regiões. Selecione uma para ajustar a posição.
              </p>
              <div className="flex gap-2 items-center">
                <span className="text-[10px] text-foreground/70 shrink-0">Região:</span>
                <select
                  value={calibRegiaoId}
                  onChange={e => setCalibRegiaoId(e.target.value)}
                  className="flex-1 text-[11px] bg-background border border-border rounded px-1.5 py-0.5"
                >
                  <option value="">— selecionar —</option>
                  {Object.entries(PONTO_ANATOMICO).map(([id]) => (
                    <option key={id} value={id}>{id.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              {calibRegiaoId && (() => {
                const base = PONTO_ANATOMICO[calibRegiaoId];
                const curr = savedOrganOffsets[calibRegiaoId] ?? { dx: 0, dy: 0 };
                const saveDot = (dx: number, dy: number) => {
                  const next = { ...savedOrganOffsets, [calibRegiaoId]: { dx, dy } };
                  setSavedOrganOffsets(next);
                  localStorage.setItem('organ-offsets-calibrado', JSON.stringify(next));
                };
                return (
                  <div className="space-y-1.5 pt-1 border-t border-border/30">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] w-16 shrink-0">Horizontal</span>
                      <input type="range" min={-50} max={50} step={1} value={curr.dx}
                        onChange={e => saveDot(Number(e.target.value), curr.dy)}
                        className="flex-1 h-1 accent-orange-500" />
                      <span className="text-[10px] w-8 text-right font-mono">{curr.dx > 0 ? '+' : ''}{curr.dx}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] w-16 shrink-0">Vertical</span>
                      <input type="range" min={-80} max={80} step={1} value={curr.dy}
                        onChange={e => saveDot(curr.dx, Number(e.target.value))}
                        className="flex-1 h-1 accent-orange-500" />
                      <span className="text-[10px] w-8 text-right font-mono">{curr.dy > 0 ? '+' : ''}{curr.dy}</span>
                    </div>
                    <p className="text-[9px] text-muted-foreground text-center">
                      Base ({base.cx},{base.cy}) → Final ({base.cx + curr.dx},{base.cy + curr.dy})
                    </p>
                    {(curr.dx !== 0 || curr.dy !== 0) && (
                      <button type="button" onClick={() => saveDot(0, 0)}
                        className="text-[10px] text-red-500/70 underline w-full text-center">
                        Resetar posição
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        <div className="flex items-start justify-center gap-1.5">
          {/* Ícones laterais de sistema — clique para ver o sistema na íntegra com sua marcação clínica */}
          <div className="flex flex-col gap-1 pt-6 shrink-0">
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

        {/* Silhueta */}
        <div className="mx-auto relative" style={{ maxWidth: 260 }}>
          {/* Glow de fundo do avatar */}
          <div className="absolute inset-0 rounded-full opacity-20 blur-3xl pointer-events-none"
            style={{ background: hoveredSistema ? (SYSTEM_HOVER[hoveredSistema] || 'hsl(var(--primary))') : 'hsl(var(--muted-foreground) / 0.3)', transform: 'scale(0.7) translateY(5%)' }}
          />
          <svg viewBox="0 0 240 520" className="w-full h-auto relative" shapeRendering="geometricPrecision" style={{ maxHeight: 480, filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.18)) drop-shadow(0 2px 6px rgba(0,0,0,0.12))' }}>
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
                  0%   { transform: scale(1);   opacity: 0.30; }
                  60%  { transform: scale(3.0);  opacity: 0;    }
                  100% { transform: scale(1);   opacity: 0;    }
                }
                .avc-dot-ping {
                  animation: avcDotPing 2.5s ease-out infinite;
                  transform-box: fill-box;
                  transform-origin: center;
                }
              `}
            </style>

            {/* Drop shadow */}
            <ellipse cx={120} cy={516} rx={50} ry={4.5} fill="black" opacity={0.09} />

            {/* Halo de sistema ativo/hovered */}
            {(hoveredSistema || sistemasAtivos.length === 1) && (() => {
              const sys = hoveredSistema || sistemasAtivos[0];
              const haloColor = SYSTEM_HOVER[sys] || 'rgba(99,102,241,0.30)';
              return (
                <ellipse
                  cx={120} cy={260} rx={80} ry={260}
                  fill={haloColor}
                  opacity={0.18}
                  filter="url(#glow)"
                  pointerEvents="none"
                />
              );
            })()}

            {/* Silhueta stick-figure — mesmas proporções da landing page, escalada para 240×520 */}
            <g pointerEvents="none">
              {/* Cabeça */}
              <circle cx={120} cy={32} r={24}
                stroke="currentColor" strokeWidth="1.8" opacity="0.22"
                fill="currentColor" fillOpacity="0.05" />
              {/* Pescoço */}
              <rect x={112} y={54} width={16} height={14} rx={4}
                fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeWidth="1.4" opacity="0.18" />
              {/* Tronco */}
              <path d="M79 80 Q70 120 74 168 Q96 176 120 176 Q144 176 166 168 Q170 120 161 80 Q142 74 120 74 Q98 74 79 80 Z"
                stroke="currentColor" strokeWidth="1.8" opacity="0.22" fill="currentColor" fillOpacity="0.05" />
              {/* Braço esquerdo */}
              <path d="M79 84 Q55 110 50 164"
                stroke="currentColor" strokeWidth="11" strokeLinecap="round" opacity="0.12" fill="none"/>
              {/* Braço direito */}
              <path d="M161 84 Q185 110 190 164"
                stroke="currentColor" strokeWidth="11" strokeLinecap="round" opacity="0.12" fill="none"/>
              {/* Perna esquerda */}
              <path d="M103 174 Q98 315 98 436 Q98 482 103 507"
                stroke="currentColor" strokeWidth="14" strokeLinecap="round" opacity="0.12" fill="none"/>
              {/* Perna direita */}
              <path d="M137 174 Q142 315 142 436 Q142 482 137 507"
                stroke="currentColor" strokeWidth="14" strokeLinecap="round" opacity="0.12" fill="none"/>


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
                // dos sliders (offsetsCalib); em produção usa DEFAULT_SYS_Y_OFFSET.
                // Órgãos com offset salvo pelo /calibrar já incorporam a correção
                // completa — não aplicar o offset de sistema para evitar dupla soma.
                const hasCalibrated = r.id in savedOrganOffsets;
                const sysDy = hasCalibrated
                  ? 0
                  : (calibrando ? (offsetsCalib[sys0] ?? 0) : (DEFAULT_SYS_Y_OFFSET[sys0] ?? 0));
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

            {/* ═══ Pontos anatômicos (fora da máscara, posições calibradas) ═══ */}
            {Object.entries(PONTO_ANATOMICO)
              .filter(([id]) => corPorRegiao[id])
              .map(([id, pos], i) => {
                const cor = corPorRegiao[id];
                const off = savedOrganOffsets[id] ?? { dx: 0, dy: 0 };
                const cx = pos.cx + off.dx;
                const cy = pos.cy + off.dy;
                return (
                  <g key={id} style={{ cursor: 'pointer' }} onClick={() => abrirSheet(id)}>
                    <circle cx={cx} cy={cy} r={9} fill={cor} opacity={0.25}
                      className="avc-dot-ping"
                      style={{ animationDelay: `${(i % 5) * 0.52}s` }} />
                    <circle cx={cx} cy={cy} r={5} fill={cor} />
                    <circle cx={cx} cy={cy} r={2} fill="white" opacity={0.75} />
                  </g>
                );
              })
            }

            {/* ─ Modo calibração: todos os pontos em laranja com nome ─ */}
            {calibrando && Object.entries(PONTO_ANATOMICO).map(([id, pos]) => {
              const off = savedOrganOffsets[id] ?? { dx: 0, dy: 0 };
              const cx = pos.cx + off.dx;
              const cy = pos.cy + off.dy;
              const isSelected = calibRegiaoId === id;
              return (
                <g key={`cal-${id}`} pointerEvents="none">
                  <circle cx={cx} cy={cy} r={isSelected ? 7 : 4} fill="none"
                    stroke={isSelected ? 'rgba(255,60,0,0.90)' : 'rgba(255,120,0,0.55)'}
                    strokeWidth={isSelected ? 1.8 : 1.0} strokeDasharray="2,2" />
                  <text x={cx + 7} y={cy + 3} fontSize="5" fontFamily="system-ui,sans-serif"
                    fill={isSelected ? 'rgba(255,60,0,0.95)' : 'rgba(255,100,0,0.75)'}>
                    {id.replace(/_/g, ' ')}
                  </text>
                </g>
              );
            })}

          </svg>
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
                        <span className="font-bold">{[...REGIONS, ...VISCERAL_REGIONS].find(r => r.id === e.regiao_id)?.label}:</span> {e.tipo_achado}
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
          const regiaoPadrao = sysToShow === 'musculoesqueletico'
            ? 'abdomen'
            : (VISCERAL_REGIONS.find(r => r.sistemas.includes(sysToShow))?.id || 'abdomen');
          const regiaoDetectada = notaSistema.texto.trim()
            ? encontrarSintomasEmTexto(notaSistema.texto).find(s => s.sistema === sysToShow)?.regiao_id
            : undefined;
          const regiaoAuto = regiaoDetectada || regiaoPadrao;

          return (
            <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 mt-3 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex gap-3 items-center border-b border-primary/10 pb-2">
                <div className={cn("p-1.5 rounded-lg bg-background border border-primary/10", `text-${config.color}-500`)}>
                  <Icon className="w-4 h-4" />
                </div>
                <p className="text-xs font-black uppercase tracking-wider">{config.label}</p>
              </div>

              {isProfessional && selecionadoExplicitamente && (
                <div className="space-y-2 rounded-lg border border-primary/20 bg-background p-2.5">
                  <Label className="text-[10px]">Adicionar nota sobre sintoma/problema neste sistema</Label>
                  <Textarea
                    className="text-xs min-h-[60px]"
                    placeholder="Ex.: Refluxo gastroesofágico recorrente"
                    value={notaSistema.texto}
                    onChange={(e) => setNotaSistema({ ...notaSistema, texto: e.target.value })}
                  />
                  {notaSistema.texto.trim() && (
                    <p className="text-[10px] text-muted-foreground">
                      Será marcado no avatar em: <span className="font-bold text-foreground">
                        {[...REGIONS, ...VISCERAL_REGIONS].find(r => r.id === regiaoAuto)?.label || regiaoAuto}
                      </span>
                      {!regiaoDetectada && ' (padrão — não identifiquei a região pelo texto)'}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <Select
                      value={notaSistema.natureza}
                      onValueChange={(v) => setNotaSistema({ ...notaSistema, natureza: v as 'condicao' | 'sintoma' })}
                    >
                      <SelectTrigger className="h-7 text-[11px] flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="condicao" className="text-xs">É a condição em si</SelectItem>
                        <SelectItem value="sintoma" className="text-xs">É sintoma de outra condição</SelectItem>
                      </SelectContent>
                    </Select>
                    {notaSistema.natureza === 'sintoma' && (
                      <Input
                        className="h-7 text-[11px] flex-1"
                        placeholder="Sintoma de qual condição?"
                        value={notaSistema.condicaoAssociada}
                        onChange={(e) => setNotaSistema({ ...notaSistema, condicaoAssociada: e.target.value })}
                      />
                    )}
                  </div>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      className="h-7 px-3 text-xs"
                      disabled={!notaSistema.texto.trim() || (notaSistema.natureza === 'sintoma' && !notaSistema.condicaoAssociada.trim())}
                      onClick={() => {
                        saveMut.mutate({
                          paciente_id: pacienteId,
                          regiao_id: regiaoAuto,
                          sistema: sysToShow,
                          tipo_achado: notaSistema.texto.trim(),
                          tipo_diagnostico: 'achado_clinico',
                          origem: 'exame_clinico',
                          status: 'cronico',
                          metadata: {
                            natureza: notaSistema.natureza,
                            condicao_associada: notaSistema.natureza === 'sintoma' ? notaSistema.condicaoAssociada.trim() : null,
                            origem_manual: true,
                            revisado_profissional: true,
                          },
                        } as any);
                        setNotaSistema({ texto: '', natureza: 'condicao', condicaoAssociada: '' });
                      }}
                    >
                      <Check className="mr-1 h-3 w-3" /> Salvar e marcar no avatar
                    </Button>
                  </div>
                </div>
              )}

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

        {/* Legend — hierarquia de confirmação clínica */}
        <div className="space-y-1 mt-2">
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider text-center">Hierarquia de Confirmação</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] justify-center">
            <span className="flex items-center gap-1 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-[#991b1b]" /> Diagnóstico grave</span>
            <span className="flex items-center gap-1 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-[#dc2626]" /> Diagnóstico confirmado</span>
            <span className="flex items-center gap-1 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-[#fb923c]" /> Achado clínico</span>
            <span className="flex items-center gap-1 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-[#ddd6fe]" /> Relato paciente</span>
            <span className="flex items-center gap-1 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-[#eab308]" /> Crônico</span>
            <span className="flex items-center gap-1 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-[#f97316]" /> Em tratamento</span>
            <span className="flex items-center gap-1 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-[#9ca3af]" /> Resolvido (histórico)</span>
          </div>
        </div>
      </div>
          </TabsContent>

          <TabsContent value="achados" className="pt-3">
        {/* Lista de achados ativos */}
        {isLoading ? (
          <p className="text-xs text-muted-foreground text-center py-2">Carregando…</p>
        ) : (eventos.filter(e => e.status !== 'resolvido' && (e as any).tipo_diagnostico !== 'relato_paciente' && (modoSimplificado ? e.visivel_paciente : true)).length === 0) ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            Nenhum achado ativo {modoSimplificado ? 'visível' : 'registrado'}.
          </p>
        ) : (() => {
          const achados = eventos.filter(e => e.status !== 'resolvido' && (e as any).tipo_diagnostico !== 'relato_paciente' && (modoSimplificado ? e.visivel_paciente : true));
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
                    disabled={modoSimplificado}
                    onClick={() => abrirSheet(ev.regiao_id)}
                    className={`w-full flex items-center gap-2 text-left p-2 rounded-lg transition border ${
                      isDiag
                        ? 'border-red-200/60 bg-red-50/40 dark:bg-red-950/20 dark:border-red-900/40'
                        : isRelato
                          ? 'border-purple-200/40 bg-purple-50/20 dark:bg-purple-950/10 dark:border-purple-900/30'
                          : 'border-border/30 hover:bg-muted/40'
                    } ${modoSimplificado ? 'cursor-default' : ''}`}
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
                        <span className="text-muted-foreground font-normal">· {reg?.label || ev.regiao_id}</span>
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
        {!modoSimplificado && (() => {
          const historico = eventos.filter(e => e.status === 'resolvido');
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
