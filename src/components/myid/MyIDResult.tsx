import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronDown, ChevronUp, AlertCircle, CheckCircle2, TrendingUp, Loader2,
  Stethoscope, Brain, Dumbbell, Droplets, Leaf, Laptop, Star,
  Users, ChevronRight, Activity, ShieldAlert, Zap,
} from 'lucide-react';
import MyIDFormulaDisplay from './MyIDFormulaDisplay';
import MyIDDicasPessoais from './MyIDDicasPessoais';
import MyIDTreatmentPlan from './MyIDTreatmentPlan';
import { shareMyIDResults } from '@/utils/whatsapp';
import { DIMENSION_LABELS, PerdaCalculada } from '@/utils/myid/lossTable';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { ConfettiBurst } from '@/components/ui/confetti-burst';

// ── Linguagem simples por dimensão ────────────────────────────────────────────
const PROBLEMA_SIMPLES: Record<string, (score: number) => string> = {
  D:   (s) => s >= 7 ? 'Sua dor está intensa e atrapalhando o dia a dia.' : 'Você sente dor com frequência.',
  EFI: (s) => s >= 7 ? 'Você está com muita dificuldade nas atividades do dia a dia.' : 'Algumas atividades estão mais difíceis do que deveriam.',
  P:   (s) => s >= 5 ? 'Medo de se mexer ou pensamentos negativos sobre a dor estão te travando.' : 'Há alguma insegurança em relação ao movimento.',
  I:   (s) => s >= 2 ? 'A dor já está há tempo demais sem tratamento adequado.' : 'A dor é recente — bom momento para agir.',
  R:   (s) => s >= 7 ? 'Seu corpo não está recuperando: sono ruim, cansaço e estresse altos.' : 'Sono, energia ou estresse estão desregulados.',
  C:   (s) => s >= 6 ? 'Pressões do trabalho, família ou dinheiro estão pesando muito.' : 'O contexto de vida está sobrecarregando você.',
  AF:  (s) => s >= 6 ? 'Você está muito parado(a) — isso piora a dor.' : 'Falta movimento no seu dia.',
  HID: ()  => 'Você está bebendo pouca água.',
  NUT: ()  => 'Sua alimentação pode estar inflamando o corpo.',
  ERG: (s) => s >= 6 ? 'Sua postura/posto de trabalho está agredindo o corpo todo dia.' : 'Pequenos ajustes de postura ajudariam muito.',
  N:   ()  => 'Cicatrizes, cirurgias ou questões viscerais estão somando ruído ao sistema.',
};

const ACAO_SIMPLES: Record<string, string> = {
  D:   'Procure um fisioterapeuta para tratar a dor de forma ativa, sem só remédio.',
  EFI: 'Comece a se mover dentro do que dá — atividades simples já contam.',
  P:   'Converse sobre seus medos com o profissional. Movimento seguro e gradual cura.',
  I:   'Não espere mais: quanto antes começar, mais rápido melhora.',
  R:   'Priorize o sono (7-8h), reduza telas à noite e busque relaxamento ativo.',
  C:   'Identifique 1 fonte de estresse para reduzir esta semana — peça apoio se precisar.',
  AF:  'Caminhe 20-30 min por dia, 4-5x na semana. É o remédio mais barato.',
  HID: 'Beba 2-3 litros de água por dia. Coloque uma garrafa visível.',
  NUT: 'Reduza ultraprocessados, açúcar e álcool. Aumente frutas, vegetais e proteína.',
  ERG: 'Ajuste cadeira/tela do trabalho e faça pausa de 2 min a cada 45 min sentado(a).',
  N:   'Comente cirurgias e questões viscerais com seu terapeuta — pode mudar a abordagem.',
};

// ── Missão da semana (1 por dimensão mais crítica) ───────────────────────────
const MISSAO_SEMANA: Record<string, { titulo: string; descricao: string; emoji: string }> = {
  D:   { emoji: '📋', titulo: 'Diário de dor', descricao: 'Anote a dor de 0-10 pela manhã, tarde e noite durante 7 dias. Leve para o profissional.' },
  R:   { emoji: '🌙', titulo: 'Ritual do sono', descricao: 'Desligue telas 1h antes de deitar e acorde no mesmo horário por 7 dias seguidos.' },
  P:   { emoji: '🧘', titulo: 'Respiração 4-7-8', descricao: '5 minutos de respiração consciente antes de dormir. Inspire 4s, segure 7s, expire 8s.' },
  AF:  { emoji: '🚶', titulo: 'Caminhada diária', descricao: '20 minutos de caminhada leve todo dia. Mesmo que haja algum desconforto — movimento é remédio.' },
  HID: { emoji: '💧', titulo: 'Garrafa de 2L', descricao: 'Deixe uma garrafa de 2L visível na mesa. Beba tudo antes das 20h.' },
  NUT: { emoji: '🥗', titulo: 'Prato colorido', descricao: 'Metade do prato com vegetais em cada refeição. Elimine 1 ultraprocessado por dia.' },
  ERG: { emoji: '⏰', titulo: 'Pausa ativa', descricao: 'A cada 45 min sentado(a), levante e caminhe 2 minutos. Coloque alarme agora.' },
  C:   { emoji: '🌿', titulo: '15 minutos só seus', descricao: '15 minutos do dia sem celular, compromissos ou pessoas. Caminhe, respire, descanse.' },
  EFI: { emoji: '⭐', titulo: 'Retome uma atividade', descricao: 'Escolha UMA atividade que deixou de fazer por causa da dor. Faça por 10 minutos hoje.' },
  N:   { emoji: '🩺', titulo: 'Conte sua história', descricao: 'Relate ao profissional seu histórico de cirurgias, questões intestinais e hormonais. Isso muda a abordagem.' },
  I:   { emoji: '📅', titulo: 'Agende agora', descricao: 'Marque sua consulta com um profissional de saúde hoje. Cada semana sem tratamento adequado conta.' },
};

// ── Encaminhamentos por dimensão (visão cliente) ─────────────────────────────
const ENCAMINHAMENTOS_CLIENTE: Record<string, { especialista: string; motivo: string; cor: string; icon: React.ElementType }> = {
  D:   { especialista: 'Fisioterapeuta', motivo: 'Tratamento ativo da dor e reabilitação', cor: '#ef4444', icon: Activity },
  EFI: { especialista: 'Fisioterapeuta', motivo: 'Recuperação funcional progressiva', cor: '#f97316', icon: Activity },
  R:   { especialista: 'Médico', motivo: 'Avaliação do sono e regulação do estresse', cor: '#8b5cf6', icon: Stethoscope },
  P:   { especialista: 'Psicólogo', motivo: 'Suporte emocional e terapia cognitivo-comportamental', cor: '#a855f7', icon: Brain },
  C:   { especialista: 'Psicólogo', motivo: 'Gestão do contexto de vida e estressores', cor: '#6366f1', icon: Brain },
  AF:  { especialista: 'Educador Físico', motivo: 'Programa de atividade física seguro e progressivo', cor: '#22c55e', icon: Dumbbell },
  NUT: { especialista: 'Nutricionista', motivo: 'Plano alimentar anti-inflamatório personalizado', cor: '#84cc16', icon: Leaf },
  HID: { especialista: 'Nutricionista', motivo: 'Avaliação e plano de hidratação', cor: '#06b6d4', icon: Droplets },
  ERG: { especialista: 'Fisioterapeuta', motivo: 'Análise ergonômica e ajuste postural', cor: '#f59e0b', icon: Laptop },
  N:   { especialista: 'Médico', motivo: 'Avaliação de condições sistêmicas (visceral, hormonal)', cor: '#64748b', icon: Stethoscope },
  I:   { especialista: 'Fisioterapeuta', motivo: 'Avaliação e início imediato do tratamento', cor: '#dc2626', icon: Activity },
};

// ── Encaminhamentos clínicos com evidência (visão terapeuta) ─────────────────
const ENCAMINHAMENTOS_CLINICO: Record<string, { especialista: string; indicacao: string; evidencia: string; urgencia: 'imediata' | 'breve' | 'eletiva' }[]> = {
  D: [
    { especialista: 'Fisioterapeuta', indicacao: 'PNE (Pain Neuroscience Education) + terapia manual + graded activity', evidencia: 'Moseley & Butler, 2015; Nijs et al., 2021', urgencia: 'imediata' },
    { especialista: 'Médico', indicacao: 'Descarte red flags, avaliação diagnóstica complementar e manejo farmacológico', evidencia: 'Quando dor ≥7/10 ou presença de red flags', urgencia: 'imediata' },
  ],
  R: [
    { especialista: 'Médico', indicacao: 'Investigação de distúrbios do sono (PSG se indicado), manejo do estresse', evidencia: 'Tang et al., 2015 — insônia e sensibilização central', urgencia: 'breve' },
    { especialista: 'Psicólogo', indicacao: 'TCC-I (Terapia Cognitivo-Comportamental para Insônia)', evidencia: 'Morin et al., 2023 — evidência nível A', urgencia: 'breve' },
  ],
  P: [
    { especialista: 'Psicólogo', indicacao: 'TCC para dor crônica, ACT, redução de catastrofização e kinesiofobia', evidencia: 'Vlaeyen et al., 2021; Sullivan et al., 2012', urgencia: 'breve' },
    { especialista: 'Fisioterapeuta', indicacao: 'Graded Exposure Therapy para kinesiofobia (Fear-Avoidance Model)', evidencia: 'Leeuw et al., 2007; Vlaeyen & Linton, 2000', urgencia: 'breve' },
  ],
  EFI: [
    { especialista: 'Fisioterapeuta', indicacao: 'Graded Activity, retorno funcional progressivo às AVDs e trabalho', evidencia: 'Airaksinen et al., 2006 — European guidelines for LBP', urgencia: 'breve' },
  ],
  AF: [
    { especialista: 'Educador Físico', indicacao: 'Prescrição de exercício aeróbico + resistência (150 min/sem)', evidencia: 'Geneen et al., 2017 — Cochrane Review exercício e dor', urgencia: 'eletiva' },
    { especialista: 'Fisioterapeuta', indicacao: 'Graded Exercise Therapy se dor limita retorno ao exercício', evidencia: 'Evidência B — adaptado das diretrizes NICE, 2021', urgencia: 'breve' },
  ],
  NUT: [
    { especialista: 'Nutricionista', indicacao: 'Dieta anti-inflamatória, redução de marcadores inflamatórios', evidencia: 'Rondanelli et al., 2018 — Nutrients; Totsch & Sorge, 2017', urgencia: 'eletiva' },
  ],
  HID: [
    { especialista: 'Nutricionista / Médico', indicacao: 'Avaliação do estado de hidratação, protocolo 30 ml/kg/dia', evidencia: 'Baseado em consenso clínico — ACSM guidelines', urgencia: 'eletiva' },
  ],
  ERG: [
    { especialista: 'Fisioterapeuta', indicacao: 'Análise ergonômica do posto de trabalho, reeducação postural global', evidencia: 'van Niekerk et al., 2012; Hakala et al., 2006', urgencia: 'eletiva' },
  ],
  C: [
    { especialista: 'Psicólogo', indicacao: 'ACT (Terapia de Aceitação e Compromisso) para estressores biopsicossociais', evidencia: 'Craner et al., 2016; Vowles & McCracken, 2008', urgencia: 'breve' },
  ],
  N: [
    { especialista: 'Médico', indicacao: 'Avaliação de disfunção visceral, hormonal ou fascial', evidencia: 'Bienfait, 1994; Bordoni & Zanier, 2013', urgencia: 'breve' },
    { especialista: 'Fisioterapeuta', indicacao: 'Terapia de cicatrizes, osteopatia visceral se indicado', evidencia: 'Blanco-Díaz et al., 2022 — scar tissue and pain', urgencia: 'eletiva' },
  ],
  I: [
    { especialista: 'Fisioterapeuta', indicacao: 'Avaliação de gatilhos biomecânicos, início imediato de intervenção', evidencia: 'Inércia terapêutica prolonga prognóstico — NICE, 2021', urgencia: 'imediata' },
  ],
};

// ── O que já está bem (forças) ────────────────────────────────────────────────
const FORCA_LABEL: Record<string, string> = {
  D:   'dor sob controle', R:   'sono e energia em equilíbrio',
  EFI: 'boa capacidade funcional', P:   'equilíbrio emocional',
  AF:  'nível de atividade física adequado', HID: 'boa hidratação',
  NUT: 'alimentação saudável', ERG: 'boa ergonomia e postura',
  C:   'contexto de vida equilibrado', N:   'sem ruído sistêmico significativo',
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface MyIDResultProps {
  result: any;
  rawData?: any;
  pacienteId?: string;
  terapeutaId?: string;
  avaliacaoId?: string;
}

interface PerdaItem {
  key: string;
  label: string;
  perda: number;
  score: number;
  interpretacao: string;
  gatilho: boolean;
  isDriver: boolean;
}

function buildPerdasBreakdown(perdas: Record<string, PerdaCalculada> | undefined, driverDim?: string): PerdaItem[] {
  if (!perdas) return [];
  return Object.entries(perdas)
    .filter(([key, p]) => key !== 'MED' && (p?.perda_pontos ?? 0) > 0)
    .map(([key, p]) => ({
      key, label: DIMENSION_LABELS[key] || key,
      perda: p.perda_pontos, score: p.score_bruto,
      interpretacao: p.interpretacao || '',
      gatilho: !!p.gatilho_critico,
      isDriver: key === driverDim,
    }))
    .sort((a, b) => b.perda - a.perda);
}

function corPerda(perda: number, maxPerda: number): string {
  const ratio = perda / maxPerda;
  if (ratio > 0.7) return 'bg-destructive';
  if (ratio > 0.4) return 'bg-orange-500';
  if (ratio > 0.2) return 'bg-amber-500';
  return 'bg-emerald-500';
}

const URGENCIA_COR = { imediata: 'bg-red-100 text-red-700 border-red-300', breve: 'bg-amber-100 text-amber-700 border-amber-300', eletiva: 'bg-emerald-100 text-emerald-700 border-emerald-300' };
const URGENCIA_LABEL = { imediata: 'Urgente', breve: 'Breve prazo', eletiva: 'Eletivo' };

// ═══════════════════════════════════════════════════════════════════════════════
// VISÃO DO CLIENTE — narrativa, humana, focada em 1 ação
// ═══════════════════════════════════════════════════════════════════════════════
function ClienteView({ result, rawData, pacienteId, terapeutaId, avaliacaoId, perdasItems, scores, celebrate }: any) {
  const myidScoreValue = result?.MyID_score ?? 0;
  const red_flags_detected = result?.red_flags_detected ?? false;
  const [showOutras, setShowOutras] = useState(false);

  const top3 = perdasItems.slice(0, 3);
  const driverItem = top3[0];
  const outrasItems = top3.slice(1);

  // Forças: dimensões com perda = 0 ou muito baixa
  const forcas = Object.entries(result?.perdas_calculadas || {})
    .filter(([key, p]: [string, any]) => key !== 'MED' && (p?.perda_pontos ?? 0) <= 1 && FORCA_LABEL[key])
    .map(([key]) => FORCA_LABEL[key])
    .slice(0, 3);

  // Missão: baseada no driver
  const missao = driverItem ? MISSAO_SEMANA[driverItem.key] : null;

  // Encaminhamentos únicos para as top 3
  const enc = top3.map((it: PerdaItem) => ENCAMINHAMENTOS_CLIENTE[it.key]).filter(Boolean);
  const encUnicos = enc.filter((e: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.especialista === e.especialista) === i).slice(0, 3);

  const statusInfo = (() => {
    const v = myidScoreValue;
    if (v >= 85) return { titulo: 'Você está bem!', frase: 'Seu corpo e estilo de vida estão em equilíbrio. Mantenha o que está fazendo.', cor: '#10b981' };
    if (v >= 70) return { titulo: 'Está bom, mas dá pra melhorar', frase: 'Você tem pontos de atenção. Pequenos ajustes farão grande diferença.', cor: '#f59e0b' };
    if (v >= 50) return { titulo: 'Seu sistema está sobrecarregado', frase: 'Vários fatores estão somando contra você. Hora de agir com apoio profissional.', cor: '#f97316' };
    return { titulo: 'Seu corpo está pedindo socorro', frase: 'Procure acompanhamento profissional o quanto antes. Você merece se sentir bem.', cor: '#ef4444' };
  })();

  return (
    <div className="space-y-5">
      <ConfettiBurst trigger={celebrate} />

      {/* Header emocional */}
      <div className="text-center pt-2 pb-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Como está seu corpo hoje</h1>
        <p className="text-sm text-muted-foreground mt-1">Em linguagem simples — o que está pesando e o que você pode fazer agora.</p>
      </div>

      {/* Red Flag */}
      {red_flags_detected && (
        <Card className="border-2 border-destructive bg-destructive/10">
          <CardContent className="p-5 flex items-start gap-3">
            <ShieldAlert className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-destructive text-sm">Sinal de alerta detectado</p>
              <p className="text-xs text-destructive/80 mt-0.5">
                Algumas respostas indicam a necessidade de avaliação médica. <strong>Procure um profissional de saúde ainda esta semana.</strong>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Score + contexto em frase */}
      <Card className="overflow-hidden" style={{ borderColor: `${statusInfo.cor}40`, background: `linear-gradient(135deg, hsl(var(--card)) 60%, ${statusInfo.cor}12 100%)` }}>
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            {/* Mini ring */}
            <div className="shrink-0">
              <svg viewBox="0 0 100 100" className="w-20 h-20">
                <circle cx="50" cy="50" r="38" fill="none" stroke="hsl(var(--muted))" strokeWidth="9" opacity="0.4" />
                <circle cx="50" cy="50" r="38" fill="none" stroke={statusInfo.cor} strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 38}`}
                  strokeDashoffset={`${2 * Math.PI * 38 * (1 - Math.min(myidScoreValue, 100) / 100)}`}
                  transform="rotate(-90 50 50)"
                  style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}
                />
                <text x="50" y="48" textAnchor="middle" fontSize="20" fontWeight="900" fill={statusInfo.cor}>{Math.round(myidScoreValue)}</text>
                <text x="50" y="62" textAnchor="middle" fontSize="9" fill="currentColor" className="fill-muted-foreground">/100</text>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base leading-snug" style={{ color: statusInfo.cor }}>{statusInfo.titulo}</p>
              <p className="text-sm text-foreground/75 mt-1 leading-relaxed">{statusInfo.frase}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seu principal desafio agora (driver) */}
      {driverItem && (
        <Card className="border-l-4" style={{ borderLeftColor: ENCAMINHAMENTOS_CLIENTE[driverItem.key]?.cor || '#ef4444' }}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-destructive" />
              <CardTitle className="text-base font-bold">Seu principal foco agora</CardTitle>
              {driverItem.gatilho && <Badge variant="destructive" className="text-[10px] h-4">URGENTE</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 rounded-lg bg-muted/40">
              <p className="font-semibold text-sm mb-1">{driverItem.label}</p>
              <p className="text-sm text-foreground/80">{PROBLEMA_SIMPLES[driverItem.key]?.(driverItem.score) || driverItem.interpretacao}</p>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p className="text-foreground/80">{ACAO_SIMPLES[driverItem.key] || 'Converse com seu profissional sobre como abordar este ponto.'}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Outras áreas de atenção (colapsável) */}
      {outrasItems.length > 0 && (
        <div>
          <button
            className="w-full flex items-center justify-between text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors px-1 py-2"
            onClick={() => setShowOutras(o => !o)}
          >
            <span>Outras {outrasItems.length} áreas de atenção</span>
            {showOutras ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showOutras && (
            <div className="space-y-2 mt-1 animate-in fade-in slide-in-from-top-2 duration-200">
              {outrasItems.map((item: PerdaItem) => (
                <Card key={item.key} className="border-l-4" style={{ borderLeftColor: ENCAMINHAMENTOS_CLIENTE[item.key]?.cor || '#94a3b8' }}>
                  <CardContent className="p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{item.label}</p>
                      {item.gatilho && <Badge variant="destructive" className="text-[9px] h-4">URGENTE</Badge>}
                    </div>
                    <p className="text-xs text-foreground/75">{PROBLEMA_SIMPLES[item.key]?.(item.score) || item.interpretacao}</p>
                    <p className="text-xs text-primary">{ACAO_SIMPLES[item.key]}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* O que você já está bem */}
      {forcas.length > 0 && (
        <Card className="border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Star className="h-4 w-4 text-emerald-600" />
              <p className="font-bold text-sm text-emerald-800 dark:text-emerald-300">O que você já está fazendo bem</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {forcas.map((f: string, i: number) => (
                <span key={i} className="inline-flex items-center gap-1 text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 px-2 py-1 rounded-full border border-emerald-200">
                  ✓ {f}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Checklist de ações */}
      {top3.length > 0 && (
        <ChecklistAcoes
          items={top3.map((it: PerdaItem) => ({
            action_key: it.key,
            action_label: it.label,
            action_text: ACAO_SIMPLES[it.key] || 'Converse com seu profissional sobre como abordar este ponto.',
          }))}
          pacienteId={pacienteId}
          terapeutaId={terapeutaId}
          avaliacaoId={avaliacaoId}
        />
      )}

      {/* Missão da semana */}
      {missao && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{missao.emoji}</span>
              <div>
                <p className="font-bold text-sm text-primary">Missão da semana</p>
                <p className="font-semibold text-sm">{missao.titulo}</p>
              </div>
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed">{missao.descricao}</p>
          </CardContent>
        </Card>
      )}

      {/* Quem pode te ajudar */}
      {encUnicos.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3 px-1">
            <Users className="h-4 w-4 text-muted-foreground" />
            <p className="font-bold text-sm">Profissionais que podem te ajudar</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {encUnicos.map((e: any, i: number) => {
              const Icon = e.icon;
              return (
                <Card key={i} className="overflow-hidden" style={{ borderColor: `${e.cor}30` }}>
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${e.cor}18` }}>
                      <Icon className="h-5 w-5" style={{ color: e.cor }} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm" style={{ color: e.cor }}>{e.especialista}</p>
                      <p className="text-xs text-foreground/70 mt-0.5 leading-snug">{e.motivo}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground text-center mt-2">
            Sempre consulte um profissional de saúde habilitado antes de iniciar qualquer tratamento.
          </p>
        </div>
      )}

      {/* Plano de tratamento (mindfulness, respiração) */}
      <MyIDTreatmentPlan
        drivers={top3}
        myidScore={myidScoreValue}
        redFlags={!!red_flags_detected}
      />

      {/* CTA footer */}
      <div className="bg-card p-5 rounded-xl border shadow-sm text-center space-y-3">
        <p className="text-sm text-muted-foreground">Compartilhe com seu profissional para um plano personalizado.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-medium rounded-md text-sm transition-colors">
            Baixar PDF
          </button>
          <button
            onClick={() => shareMyIDResults(result.paciente_nome || 'Paciente', '5511999999999', result)}
            className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary font-bold rounded-md text-sm transition-colors"
          >
            Compartilhar com profissional
          </button>
          <button className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-md text-sm transition-colors">
            Agendar consulta
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground/40 font-mono">
          {new Date().toLocaleDateString()} · MyID-100 v2.0
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VISÃO DO TERAPEUTA — clínica, com evidência e encaminhamentos
// ═══════════════════════════════════════════════════════════════════════════════
function TerapeutaView({ result, rawData, pacienteId, terapeutaId, perdasItems, scores }: any) {
  const myidScoreValue = result?.MyID_score ?? 0;
  const red_flags_detected = result?.red_flags_detected ?? false;
  const driverDim = result?.myid_100?.driver_primario?.dimensao;
  const gatilhosCriticos: string[] = result?.myid_100?.gatilhos_criticos_ativados || [];
  const top4 = perdasItems.slice(0, 4);
  const [openEnc, setOpenEnc] = useState<string | null>(null);

  const statusLabel = myidScoreValue >= 85 ? 'EXCELENTE' : myidScoreValue >= 70 ? 'BOM' : myidScoreValue >= 50 ? 'MODERADO' : myidScoreValue >= 30 ? 'CRÍTICO' : 'CRÍTICO SEVERO';
  const statusCor = myidScoreValue >= 85 ? '#10b981' : myidScoreValue >= 70 ? '#f59e0b' : myidScoreValue >= 50 ? '#f97316' : myidScoreValue >= 30 ? '#ef4444' : '#7f1d1d';

  const maxPerda = Math.max(...perdasItems.map((i: PerdaItem) => i.perda), 1);

  return (
    <div className="space-y-5">
      <div className="text-center pt-2">
        <h1 className="text-xl font-extrabold tracking-tight">Visão Clínica — MyID-100</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Dashboard profissional com encaminhamentos baseados em evidência.</p>
      </div>

      {/* Red flags */}
      {red_flags_detected && (
        <Card className="border-2 border-destructive bg-destructive/10">
          <CardContent className="p-4 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-destructive text-sm">Red flags detectados</p>
              <p className="text-xs text-destructive/80 mt-0.5">Encaminhamento médico imediato indicado para avaliação complementar.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Score clínico */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="col-span-1 text-center p-3">
          <p className="text-3xl font-black" style={{ color: statusCor }}>{Math.round(myidScoreValue)}</p>
          <p className="text-[10px] text-muted-foreground">/100</p>
          <Badge className="mt-1 text-[10px]" style={{ background: `${statusCor}20`, color: statusCor, borderColor: `${statusCor}40` }}>
            {statusLabel}
          </Badge>
        </Card>
        <Card className="col-span-2 p-3 space-y-1.5">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Dimensões críticas</p>
          {(gatilhosCriticos.length > 0 ? gatilhosCriticos : perdasItems.filter((i: PerdaItem) => i.gatilho).map((i: PerdaItem) => i.key)).map((dim: string) => (
            <div key={dim} className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
              <span className="text-xs font-semibold">{DIMENSION_LABELS[dim] || dim}</span>
              <Badge variant="destructive" className="text-[9px] h-3.5 ml-auto">CRÍTICO</Badge>
            </div>
          ))}
          {driverDim && (
            <div className="flex items-center gap-1.5 pt-1 border-t border-border/40">
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              <span className="text-xs font-semibold text-primary">Driver primário: {DIMENSION_LABELS[driverDim] || driverDim}</span>
              <span className="text-[10px] text-muted-foreground ml-auto">{result?.myid_100?.driver_primario?.percentual_impacto?.toFixed(1)}% impacto</span>
            </div>
          )}
        </Card>
      </div>

      {/* Análise de perdas — barras */}
      {perdasItems.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Perdas por dimensão
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                total −{perdasItems.reduce((s: number, i: PerdaItem) => s + i.perda, 0)} pts
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {perdasItems.map((item: PerdaItem) => (
              <div key={item.key} className={`p-2 rounded-lg border ${item.isDriver ? 'border-primary/40 bg-primary/5' : 'border-border/40'}`}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold">{item.label}</span>
                    {item.isDriver && <Badge className="text-[9px] h-4 bg-primary/15 text-primary border-primary/30">DRIVER</Badge>}
                    {item.gatilho && <Badge variant="destructive" className="text-[9px] h-4">CRÍTICO</Badge>}
                  </div>
                  <span className="text-xs font-black text-destructive shrink-0">−{item.perda} pts</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all duration-700", corPerda(item.perda, maxPerda))} style={{ width: `${(item.perda / maxPerda) * 100}%` }} />
                </div>
                {item.interpretacao && <p className="text-[10px] text-muted-foreground mt-0.5">{item.interpretacao}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Encaminhamentos clínicos por dimensão */}
      <div>
        <p className="text-sm font-bold px-1 mb-2 flex items-center gap-2">
          <Stethoscope className="h-4 w-4 text-muted-foreground" />
          Encaminhamentos baseados em evidência
        </p>
        <div className="space-y-2">
          {top4.map((item: PerdaItem) => {
            const refs = ENCAMINHAMENTOS_CLINICO[item.key] || [];
            const isOpen = openEnc === item.key;
            if (!refs.length) return null;
            return (
              <Card key={item.key} className={`overflow-hidden transition-all ${isOpen ? 'shadow-md' : ''}`}>
                <button
                  className="w-full flex items-center justify-between p-3 text-left"
                  onClick={() => setOpenEnc(isOpen ? null : item.key)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{item.label}</span>
                    {item.gatilho && <Badge variant="destructive" className="text-[9px] h-4">CRÍTICO</Badge>}
                    <span className="text-xs text-muted-foreground">−{item.perda} pts · {refs.length} encaminhamento{refs.length > 1 ? 's' : ''}</span>
                  </div>
                  {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                </button>
                {isOpen && (
                  <div className="border-t border-border/40 divide-y divide-border/30">
                    {refs.map((ref, j) => (
                      <div key={j} className="p-3 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm">{ref.especialista}</span>
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-semibold", URGENCIA_COR[ref.urgencia])}>
                            {URGENCIA_LABEL[ref.urgencia]}
                          </span>
                        </div>
                        <p className="text-xs text-foreground/80">{ref.indicacao}</p>
                        <p className="text-[11px] text-muted-foreground italic border-l-2 border-primary/30 pl-2">
                          📚 {ref.evidencia}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Fases do protocolo (se disponível) */}
      {result?.myid_100?.fases && (
        <div>
          <p className="text-sm font-bold px-1 mb-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Protocolo de 3 fases
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {result.myid_100.fases.map((fase: any, i: number) => (
              <Card key={i} className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-black flex items-center justify-center shrink-0">{i + 1}</span>
                  <p className="font-bold text-xs">{fase.nome || `Fase ${i + 1}`}</p>
                </div>
                {fase.duracao && <p className="text-[10px] text-muted-foreground mb-1">⏱ {fase.duracao}</p>}
                {fase.meta_score && <p className="text-[10px] text-primary mb-1">Meta: MyID {fase.meta_score}</p>}
                {fase.intervencoes && (
                  <ul className="space-y-0.5">
                    {fase.intervencoes.slice(0, 4).map((iv: string, j: number) => (
                      <li key={j} className="text-[10px] text-foreground/75 flex gap-1">
                        <span className="shrink-0">·</span>{iv}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Fórmula técnica completa */}
      <div>
        <p className="text-sm font-bold px-1 mb-2">Análise técnica completa</p>
        <MyIDFormulaDisplay
          scores={scores}
          myidScore={myidScoreValue}
          perdas={result?.perdas_calculadas}
          driverPrimario={result?.myid_100?.driver_primario}
          gatilhosCriticos={result?.myid_100?.gatilhos_criticos_ativados || []}
          hasRedFlags={red_flags_detected}
          hideGauge
        />
        <MyIDDicasPessoais scores={scores} myidScore={result?.myid_100 ?? myidScoreValue} pacienteId={pacienteId} terapeutaId={terapeutaId} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export function MyIDResult({ result, rawData = {}, pacienteId, terapeutaId, avaliacaoId }: MyIDResultProps) {
  const isTerapeuta = !!terapeutaId;
  const [visao, setVisao] = useState<'cliente' | 'terapeuta'>(isTerapeuta ? 'terapeuta' : 'cliente');
  const [celebrate, setCelebrate] = useState(false);

  const myidScoreEarly = result?.MyID_score ?? 0;
  useEffect(() => {
    if (myidScoreEarly >= 70) {
      const t = setTimeout(() => setCelebrate(true), 400);
      return () => clearTimeout(t);
    }
  }, [myidScoreEarly]);

  if (!result) return null;

  const { component_scores, perdas_calculadas, myid_100 } = result;
  const scores = component_scores || {};
  const D   = scores.D   ?? scores.D_pain          ?? 0;
  const EFI = scores.EFI ?? scores.EFI_functionality ?? 0;
  const P   = scores.P   ?? scores.P_psychological  ?? 0;
  const I   = scores.I   ?? scores.I_inertia        ?? 0;
  const R   = scores.R   ?? scores.R_regulation     ?? 0;
  const C   = scores.C   ?? scores.C_context        ?? 0;
  const AF  = scores.AF  ?? scores.AF_activity      ?? 0;
  const HID = scores.HID ?? scores.HID_hydration    ?? 0;
  const NUT = scores.NUT ?? scores.NUT_nutrition    ?? 0;
  const ERG = scores.ERG ?? scores.ERG_ergonomics   ?? 0;
  const N   = scores.N   ?? scores.N_noise          ?? 0;
  const MED = scores.MED ?? scores.MED_penalty      ?? 0;

  const scoresObj = { D, EFI, P, I, R, C, AF, HID, NUT, ERG, N, MED };
  const perdasItems = buildPerdasBreakdown(perdas_calculadas, myid_100?.driver_primario?.dimensao);

  return (
    <div className="max-w-2xl mx-auto pb-10 px-0">
      {/* Toggle visão */}
      {isTerapeuta && (
        <div className="flex items-center justify-center gap-1 mb-5 p-1 bg-muted rounded-lg w-fit mx-auto">
          <button
            onClick={() => setVisao('cliente')}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-semibold transition-all',
              visao === 'cliente' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Visão do cliente
          </button>
          <button
            onClick={() => setVisao('terapeuta')}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-semibold transition-all',
              visao === 'terapeuta' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Visão clínica
          </button>
        </div>
      )}

      {visao === 'cliente' ? (
        <ClienteView
          result={result} rawData={rawData}
          pacienteId={pacienteId} terapeutaId={terapeutaId} avaliacaoId={avaliacaoId}
          perdasItems={perdasItems} scores={scoresObj} celebrate={celebrate}
        />
      ) : (
        <TerapeutaView
          result={result} rawData={rawData}
          pacienteId={pacienteId} terapeutaId={terapeutaId}
          perdasItems={perdasItems} scores={scoresObj}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Checklist de Ações persistido (sem alterações)
// ═══════════════════════════════════════════════════════════════════════════════
interface ChecklistItemDef { action_key: string; action_label: string; action_text: string; }
interface ChecklistAcoesProps { items: ChecklistItemDef[]; pacienteId?: string; terapeutaId?: string; avaliacaoId?: string; }
interface ChecklistRow { id: string; action_key: string; completed: boolean; completed_at: string | null; }

function ChecklistAcoes({ items, pacienteId, terapeutaId, avaliacaoId }: ChecklistAcoesProps) {
  const { toast } = useToast();
  const persistEnabled = !!(pacienteId && terapeutaId && avaliacaoId);
  const [rows, setRows] = useState<Record<string, ChecklistRow>>({});
  const [loading, setLoading] = useState(persistEnabled);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!persistEnabled) { setLoading(false); return; }
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from('myid_acoes_checklist')
        .select('id, action_key, completed, completed_at')
        .eq('avaliacao_id', avaliacaoId!);
      if (cancel) return;
      const map: Record<string, ChecklistRow> = {};
      (data || []).forEach((r: any) => { map[r.action_key] = r; });
      const missing = items.filter(it => !map[it.action_key]);
      if (missing.length > 0) {
        const { data: inserted, error } = await supabase
          .from('myid_acoes_checklist')
          .insert(missing.map((it, idx) => ({ paciente_id: pacienteId!, terapeuta_id: terapeutaId!, avaliacao_id: avaliacaoId!, action_key: it.action_key, action_label: it.action_label, action_text: it.action_text, ordem: idx })))
          .select('id, action_key, completed, completed_at');
        if (!error && inserted) inserted.forEach((r: any) => { map[r.action_key] = r; });
      }
      setRows(map);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [persistEnabled, avaliacaoId, pacienteId, terapeutaId, items]);

  const toggle = async (action_key: string, next: boolean) => {
    const row = rows[action_key];
    if (!row) return;
    setSavingKey(action_key);
    const optimistic = { ...row, completed: next, completed_at: next ? new Date().toISOString() : null };
    setRows(r => ({ ...r, [action_key]: optimistic }));
    const { error } = await supabase.from('myid_acoes_checklist').update({ completed: next, completed_at: next ? new Date().toISOString() : null }).eq('id', row.id);
    if (error) { setRows(r => ({ ...r, [action_key]: row })); toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' }); }
    else if (next) toast({ title: '✅ Ação marcada', description: 'Continue assim!', duration: 2000 });
    setSavingKey(null);
  };

  const completedCount = items.filter(it => rows[it.action_key]?.completed).length;
  const pct = items.length > 0 ? (completedCount / items.length) * 100 : 0;

  return (
    <Card className="border-l-4 border-l-emerald-500 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-emerald-600" />
          O que fazer para melhorar
        </CardTitle>
        <CardDescription className="text-xs">
          {persistEnabled ? 'Marque conforme for praticando. Seu progresso fica salvo.' : 'Ações práticas, na ordem de maior impacto.'}
        </CardDescription>
        {persistEnabled && (
          <div className="pt-1">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">Progresso: {completedCount} de {items.length}</span>
              <span className="text-muted-foreground">{Math.round(pct)}%</span>
            </div>
            <Progress value={pct} className="h-1.5" />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-3"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
        ) : items.map((item, idx) => {
          const row = rows[item.action_key];
          const checked = !!row?.completed;
          return (
            <label key={item.action_key}
              className={cn('flex gap-3 items-start p-3 rounded-lg border transition-colors cursor-pointer',
                checked ? 'bg-emerald-100/60 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800' : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900 hover:bg-emerald-100/40',
                !persistEnabled && 'cursor-default'
              )}
            >
              {persistEnabled ? (
                <Checkbox checked={checked} disabled={savingKey === item.action_key} onCheckedChange={(v) => toggle(item.action_key, !!v)}
                  className="mt-0.5 h-5 w-5 border-emerald-500 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600" />
              ) : <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide mb-0.5">
                  Ação {idx + 1} · {item.action_label}
                  {checked && row?.completed_at && (
                    <Badge variant="outline" className="ml-1 text-[9px] h-4 border-emerald-400 text-emerald-700">
                      Feito {new Date(row.completed_at).toLocaleDateString('pt-BR')}
                    </Badge>
                  )}
                </p>
                <p className={cn('text-sm', checked && 'line-through text-muted-foreground')}>{item.action_text}</p>
              </div>
            </label>
          );
        })}
      </CardContent>
    </Card>
  );
}

// Re-export for backward compat
const TrendingUpIcon = TrendingUp;
export { TrendingUpIcon };
