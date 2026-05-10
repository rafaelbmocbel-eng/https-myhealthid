/**
 * Builds a unified, deduplicated list of auto-suggested gamification missions
 * combining the daily-action set (used by the patient dashboard) and the
 * clinical-insights phase missions (shown on MyID results).
 *
 * Each mission gets a stable `source_key` so professional overrides survive
 * regeneration after presential evaluations.
 */
import {
  Moon, Droplets, Dumbbell, Apple, Brain, Monitor, Zap, AlertTriangle, Heart,
} from 'lucide-react';
import { calcularPerdaDimensao } from '@/utils/myid/lossTable';
import { gerarInsightsClinicosMyID } from '@/utils/myid/clinicalInsights';
import { toSourceKey } from '@/hooks/useMissoesPaciente';
import type { EditableMissao } from '@/components/myid/MyIDMissoesEditor';

interface Scores {
  D: number; EFI: number; P: number; I: number; R: number; C: number;
  AF: number; HID: number; NUT: number; ERG: number; N: number; MED?: number;
}

/** Mirror of PacienteMetasDesafios.gerarMissoesSaude with stable keys. */
function dailyMissoes(scores: Scores): EditableMissao[] {
  const out: EditableMissao[] = [];
  const push = (
    key: string,
    titulo: string,
    descricao: string,
    acao_imediata: string,
    categoria: EditableMissao['categoria'],
    xp: number,
  ) => out.push({
    source_key: toSourceKey('myid-daily', key),
    origem: 'myid',
    titulo, descricao, acao_imediata, categoria, xp_recompensa: xp,
  });

  const perdaR = calcularPerdaDimensao('R', 10 - scores.R);
  const perdaHID = calcularPerdaDimensao('HID', 10 - scores.HID);
  const perdaNUT = calcularPerdaDimensao('NUT', 10 - scores.NUT);
  const perdaAF = calcularPerdaDimensao('AF', 10 - scores.AF);
  const perdaERG = calcularPerdaDimensao('ERG', 10 - scores.ERG);
  const perdaP = calcularPerdaDimensao('P', scores.P);
  const perdaI = calcularPerdaDimensao('I', scores.I);
  const perdaD = calcularPerdaDimensao('D', scores.D);
  const perdaC = calcularPerdaDimensao('C', 10 - scores.C);

  if (perdaR.perda_pontos >= 3) push('sono', 'Melhorar o Sono',
    `Seu sono subtrai ${perdaR.perda_pontos}pts do MyID-100`,
    'Dormir 30min mais cedo hoje e desligar telas 1h antes.',
    perdaR.gatilho_critico ? 'urgente' : 'importante', 20);

  if (perdaHID.perda_pontos >= 2) push('agua', 'Beber mais Água',
    `Hidratação subtrai ${perdaHID.perda_pontos}pts do MyID-100`,
    'Beber ao menos 2 litros de água ao longo do dia.', 'importante', 10);

  if (perdaAF.perda_pontos >= 3) push('movimento', 'Mais Movimento',
    `Atividade física subtrai ${perdaAF.perda_pontos}pts do MyID-100`,
    'Fazer uma caminhada leve de 15 min hoje.',
    perdaAF.gatilho_critico ? 'urgente' : 'oportunidade', 15);

  if (perdaNUT.perda_pontos >= 2) push('nutricao', 'Ajustar Nutrição',
    `Nutrição subtrai ${perdaNUT.perda_pontos}pts do MyID-100`,
    'Evitar ultraprocessados nas próximas 3 refeições.', 'oportunidade', 10);

  if (perdaP.perda_pontos >= 3) push('respiracao', 'Reduzir Ansiedade',
    `Fator psicológico subtrai ${perdaP.perda_pontos}pts do MyID-100`,
    'Praticar 5 min de respiração diafragmática antes de dormir.', 'urgente', 15);

  if (perdaERG.perda_pontos >= 2) push('ergonomia', 'Ajustar Ergonomia',
    `Ergonomia subtrai ${perdaERG.perda_pontos}pts do MyID-100`,
    'Micro-pausas a cada 50 min: levante e alongue por 2 min.',
    perdaERG.gatilho_critico ? 'urgente' : 'oportunidade', 10);

  if (perdaI.perda_pontos >= 2) push('inercia', 'Vencer a Inércia',
    `Inércia subtrai ${perdaI.perda_pontos}pts do MyID-100`,
    'Resolver uma tarefa pendente que te gera estresse.', 'oportunidade', 15);

  if (perdaD.perda_pontos >= 8) push('dor', 'Manejo da Dor',
    `Dor subtrai ${perdaD.perda_pontos}pts do MyID-100`,
    'Aplicar técnica de relaxamento ou crioterapia por 15 min.', 'urgente', 20);

  if (perdaC.perda_pontos >= 4) push('contexto', 'Melhorar Contexto',
    `Contexto social subtrai ${perdaC.perda_pontos}pts do MyID-100`,
    'Dedique 10 min a uma atividade que lhe traz prazer.', 'importante', 10);

  return out;
}

/** Convert clinical insights missions into EditableMissao with stable keys. */
function clinicalMissoes(scores: Scores, myidScore: number): EditableMissao[] {
  const insights = gerarInsightsClinicosMyID(scores, myidScore);
  return insights.missoes.map((m) => ({
    source_key: toSourceKey('myid-clinical', `${m.dimensao}-${m.titulo}`),
    origem: 'myid' as const,
    titulo: m.titulo,
    descricao: m.descricao,
    categoria: (m.categoria === 'consolidacao' ? 'positivo' : m.categoria) as EditableMissao['categoria'],
    xp_recompensa: m.xp,
  }));
}

/**
 * Optionally add presential missions based on structural evaluation findings.
 * Called when COB ZERO / Unidades ID / Studio data is present. Keeps a stable
 * key so the same finding doesn't duplicate across re-runs.
 */
function presentialMissoes(presencial?: {
  cobb_angle?: number | null;
  risco_level?: string | null;
  estruturais?: Array<{ unidade: string; severidade: number }>;
}): EditableMissao[] {
  if (!presencial) return [];
  const out: EditableMissao[] = [];

  if (presencial.cobb_angle && presencial.cobb_angle >= 10) {
    out.push({
      source_key: toSourceKey('presencial', `cobb-${Math.round(presencial.cobb_angle)}`),
      origem: 'presencial',
      titulo: 'Postura para Coluna',
      descricao: `Avaliação presencial detectou Cobb ~${presencial.cobb_angle.toFixed(0)}°. Trabalhar consciência postural diariamente.`,
      acao_imediata: 'Fazer 3× ao dia o exercício de alinhamento orientado em sessão.',
      categoria: presencial.cobb_angle >= 25 ? 'urgente' : 'importante',
      xp_recompensa: 20,
    });
  }
  if (presencial.risco_level === 'alto' || presencial.risco_level === 'critico') {
    out.push({
      source_key: toSourceKey('presencial', `risco-${presencial.risco_level}`),
      origem: 'presencial',
      titulo: 'Acompanhamento Reforçado',
      descricao: 'Avaliação presencial classificou risco elevado. Manter monitoramento próximo da equipe.',
      acao_imediata: 'Registrar dor diária no portal e manter sessões na frequência indicada.',
      categoria: 'urgente',
      xp_recompensa: 25,
    });
  }
  for (const item of presencial.estruturais || []) {
    if (item.severidade >= 3) {
      out.push({
        source_key: toSourceKey('presencial', `unid-${item.unidade}`),
        origem: 'presencial',
        titulo: `Cuidar da unidade ${item.unidade}`,
        descricao: `Achado presencial sinaliza prioridade na unidade ${item.unidade}.`,
        acao_imediata: 'Aplicar protocolo orientado em sessão para esta região.',
        categoria: item.severidade >= 4 ? 'urgente' : 'importante',
        xp_recompensa: 15,
      });
    }
  }
  return out;
}

export function buildAutoMissoes(
  scores: Scores | undefined | null,
  myidScore: number,
  presencial?: Parameters<typeof presentialMissoes>[0],
): EditableMissao[] {
  if (!scores) return [];
  const all = [
    ...dailyMissoes(scores),
    ...clinicalMissoes(scores, myidScore),
    ...presentialMissoes(presencial),
  ];
  // dedupe by source_key (prefer first occurrence)
  const seen = new Set<string>();
  const out: EditableMissao[] = [];
  for (const m of all) {
    if (seen.has(m.source_key)) continue;
    seen.add(m.source_key);
    out.push(m);
  }
  // sort by category priority
  const order: Record<string, number> = { urgente: 0, importante: 1, oportunidade: 2, positivo: 3 };
  out.sort((a, b) => (order[a.categoria] ?? 9) - (order[b.categoria] ?? 9));
  return out;
}

/** Convert a manual mission row into the daily-mission shape used by the portal. */
export function manualToDailyShape(row: {
  id: string; titulo: string; descricao: string | null;
  acao_imediata: string | null; categoria: string; xp_recompensa: number;
}) {
  return {
    id: `manual-${row.id}`,
    icon: row.categoria === 'urgente' ? AlertTriangle : Heart,
    titulo: row.titulo,
    descricao: row.descricao || '',
    acaoImediata: row.acao_imediata || '',
    categoria: (row.categoria as 'urgente' | 'importante' | 'oportunidade' | 'positivo') || 'importante',
    lossPoints: 0,
    xpRecompensa: row.xp_recompensa,
    completavel: row.categoria !== 'positivo',
    colorClass: 'text-violet-700 dark:text-violet-400',
    bgClass: 'bg-violet-50 dark:bg-violet-950/30',
    borderClass: 'border-violet-200 dark:border-violet-800/50',
    source_key: toSourceKey('manual', row.id),
    isManual: true as const,
  };
}
