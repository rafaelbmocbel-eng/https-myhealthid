import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Heart, Droplets, Apple, Brain, Moon, Dumbbell,
  Monitor, AlertTriangle, Sparkles, ChevronDown, ChevronUp,
  Lightbulb, Shield, Zap
} from 'lucide-react';
import { useState } from 'react';
import { calcularPerdaDimensao, DIMENSION_LABELS } from '@/utils/myid/lossTable';

interface Scores {
  D: number;
  EFI: number;
  P: number;
  I: number;
  R: number;
  C: number;
  AF: number;
  HID: number;
  NUT: number;
  ERG: number;
  N: number;
  MED?: number;
}

interface DicaPersonalizada {
  id: string;
  icon: any;
  titulo: string;
  categoria: 'urgente' | 'importante' | 'oportunidade' | 'positivo';
  descricao: string;
  acaoImediata: string;
  score: number;
  maxScore: number;
  lossPoints: number;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}

function gerarDicas(scores: Scores): DicaPersonalizada[] {
  const dicas: DicaPersonalizada[] = [];

  // Calculate actual losses using MyID-100 loss table
  const perdaD = calcularPerdaDimensao('D', scores.D);
  const perdaP = calcularPerdaDimensao('P', scores.P);
  const perdaR = calcularPerdaDimensao('R', 10 - scores.R);
  const perdaHID = calcularPerdaDimensao('HID', 10 - scores.HID);
  const perdaNUT = calcularPerdaDimensao('NUT', 10 - scores.NUT);
  const perdaAF = calcularPerdaDimensao('AF', 10 - scores.AF);
  const perdaERG = calcularPerdaDimensao('ERG', 10 - scores.ERG);
  const perdaI = calcularPerdaDimensao('I', scores.I);
  const perdaN = calcularPerdaDimensao('N', scores.N);
  const perdaC = calcularPerdaDimensao('C', 10 - scores.C);

  // === URGENTES (high loss dimensions) ===
  if (perdaD.perda_pontos >= 14) {
    dicas.push({
      id: 'dor-alta', icon: AlertTriangle, titulo: 'Dor Elevada', categoria: 'urgente',
      descricao: `Sua dor (${scores.D.toFixed(1)}/10) está retirando ${perdaD.perda_pontos} pontos do seu MyID-100. É o fator que mais compromete sua pontuação — cada ponto de melhora na dor pode recuperar até 6 pontos no seu score final.`,
      acaoImediata: 'Converse com seu profissional sobre estratégias de manejo da dor antes de aumentar a carga de exercícios.',
      score: scores.D, maxScore: 10, lossPoints: perdaD.perda_pontos,
      colorClass: 'text-red-700 dark:text-red-400', bgClass: 'bg-red-50 dark:bg-red-950/30', borderClass: 'border-red-200 dark:border-red-800/50',
    });
  } else if (perdaD.perda_pontos >= 8) {
    dicas.push({
      id: 'dor-moderada', icon: AlertTriangle, titulo: 'Dor Moderada', categoria: 'importante',
      descricao: `Sua dor (${scores.D.toFixed(1)}/10) subtrai ${perdaD.perda_pontos} pontos do seu MyID-100. Monitorar e evitar atividades que a intensifiquem é essencial.`,
      acaoImediata: 'Registre no diário quando sua dor piora e melhora — isso ajuda seu profissional a ajustar o tratamento.',
      score: scores.D, maxScore: 10, lossPoints: perdaD.perda_pontos,
      colorClass: 'text-amber-700 dark:text-amber-400', bgClass: 'bg-amber-50 dark:bg-amber-950/30', borderClass: 'border-amber-200 dark:border-amber-800/50',
    });
  }

  if (perdaP.perda_pontos >= 4) {
    dicas.push({
      id: 'psicologico', icon: Brain, titulo: 'Carga Emocional Alta', categoria: 'urgente',
      descricao: `Seu fator psicológico (${scores.P.toFixed(1)}/10) subtrai ${perdaP.perda_pontos} pontos do MyID-100. Medo do movimento e catastrofização mantêm o sistema nervoso em estado de alerta, amplificando a percepção de dor.`,
      acaoImediata: 'Pratique 5 minutos de respiração diafragmática antes de dormir. Isso ajuda a reduzir o estado de alerta do sistema nervoso.',
      score: scores.P, maxScore: 10, lossPoints: perdaP.perda_pontos,
      colorClass: 'text-purple-700 dark:text-purple-400', bgClass: 'bg-purple-50 dark:bg-purple-950/30', borderClass: 'border-purple-200 dark:border-purple-800/50',
    });
  }

  // === IMPORTANTES (capacity deficits with significant loss) ===
  if (perdaR.perda_pontos >= 5) {
    dicas.push({
      id: 'sono', icon: Moon, titulo: 'Sono Insuficiente', categoria: perdaR.gatilho_critico ? 'urgente' : 'importante',
      descricao: `Sua regulação/sono (${scores.R.toFixed(1)}/10) subtrai ${perdaR.perda_pontos} pontos do MyID-100${perdaR.gatilho_critico ? ' — GATILHO CRÍTICO ativado!' : ''}. O sono é o principal momento de reparo dos tecidos e processamento da dor.`,
      acaoImediata: 'Tente dormir 30 minutos mais cedo esta noite. Desligue telas 1h antes de deitar.',
      score: scores.R, maxScore: 10, lossPoints: perdaR.perda_pontos,
      colorClass: 'text-indigo-700 dark:text-indigo-400', bgClass: 'bg-indigo-50 dark:bg-indigo-950/30', borderClass: 'border-indigo-200 dark:border-indigo-800/50',
    });
  }

  if (perdaHID.perda_pontos >= 2) {
    dicas.push({
      id: 'hidratacao', icon: Droplets, titulo: 'Hidratação Baixa', categoria: 'importante',
      descricao: `Sua hidratação (${scores.HID.toFixed(1)}/10) subtrai ${perdaHID.perda_pontos} pontos do MyID-100. A água é essencial para a saúde dos discos, articulações e fluxo sanguíneo.`,
      acaoImediata: 'Beba ao menos 2 litros de água hoje. Deixe uma garrafa visível como lembrete.',
      score: scores.HID, maxScore: 10, lossPoints: perdaHID.perda_pontos,
      colorClass: 'text-sky-700 dark:text-sky-400', bgClass: 'bg-sky-50 dark:bg-sky-950/30', borderClass: 'border-sky-200 dark:border-sky-800/50',
    });
  }

  if (perdaNUT.perda_pontos >= 2) {
    dicas.push({
      id: 'nutricao', icon: Apple, titulo: 'Nutrição em Alerta', categoria: 'importante',
      descricao: `Seu score nutricional (${scores.NUT.toFixed(1)}/10) subtrai ${perdaNUT.perda_pontos} pontos do MyID-100. Alimentos inflamatórios podem aumentar a sensibilidade à dor.`,
      acaoImediata: 'Evite ultraprocessados nas próximas 3 refeições. Aumente frutas, verduras e proteínas magras.',
      score: scores.NUT, maxScore: 10, lossPoints: perdaNUT.perda_pontos,
      colorClass: 'text-green-700 dark:text-green-400', bgClass: 'bg-green-50 dark:bg-green-950/30', borderClass: 'border-green-200 dark:border-green-800/50',
    });
  }

  if (perdaAF.perda_pontos >= 3) {
    dicas.push({
      id: 'atividade', icon: Dumbbell, titulo: 'Atividade Física Baixa', categoria: perdaAF.gatilho_critico ? 'urgente' : 'oportunidade',
      descricao: `Seu nível de atividade (${scores.AF.toFixed(1)}/10) subtrai ${perdaAF.perda_pontos} pontos do MyID-100${perdaAF.gatilho_critico ? ' — GATILHO CRÍTICO ativado!' : ''}. O movimento é o melhor "remédio" natural para dor crônica.`,
      acaoImediata: 'Comece com uma caminhada leve de 15 minutos hoje. Movimento é terapia.',
      score: scores.AF, maxScore: 10, lossPoints: perdaAF.perda_pontos,
      colorClass: 'text-emerald-700 dark:text-emerald-400', bgClass: 'bg-emerald-50 dark:bg-emerald-950/30', borderClass: 'border-emerald-200 dark:border-emerald-800/50',
    });
  }

  if (perdaERG.perda_pontos >= 2) {
    dicas.push({
      id: 'ergonomia', icon: Monitor, titulo: 'Ergonomia Inadequada', categoria: perdaERG.gatilho_critico ? 'urgente' : 'oportunidade',
      descricao: `Sua ergonomia (${scores.ERG.toFixed(1)}/10) subtrai ${perdaERG.perda_pontos} pontos do MyID-100${perdaERG.gatilho_critico ? ' — GATILHO CRÍTICO ativado!' : ''}. Postura prolongada sem intervalos gera tensão acumulada.`,
      acaoImediata: 'Faça micro-pausas a cada 50 minutos: levante, alongue ombros e pescoço por 2 minutos.',
      score: scores.ERG, maxScore: 10, lossPoints: perdaERG.perda_pontos,
      colorClass: 'text-violet-700 dark:text-violet-400', bgClass: 'bg-violet-50 dark:bg-violet-950/30', borderClass: 'border-violet-200 dark:border-violet-800/50',
    });
  }

  if (perdaI.perda_pontos >= 2) {
    dicas.push({
      id: 'inercia', icon: Zap, titulo: 'Inércia Comportamental', categoria: 'oportunidade',
      descricao: `Mudanças recentes na sua rotina subtraem ${perdaI.perda_pontos} pontos do MyID-100. Isso indica instabilidade que pode dificultar a evolução.`,
      acaoImediata: 'Escolha UMA tarefa pequena pendente que te gera estresse e resolva hoje. Movimento gera motivação.',
      score: scores.I, maxScore: 10, lossPoints: perdaI.perda_pontos,
      colorClass: 'text-orange-700 dark:text-orange-400', bgClass: 'bg-orange-50 dark:bg-orange-950/30', borderClass: 'border-orange-200 dark:border-orange-800/50',
    });
  }

  if (perdaN.perda_pontos >= 2) {
    dicas.push({
      id: 'ruido', icon: Shield, titulo: 'Ruído Sistêmico Elevado', categoria: 'importante',
      descricao: `O ruído sistêmico subtrai ${perdaN.perda_pontos} pontos do MyID-100. Fatores "ocultos" como hormônios, ciclo menstrual, condições viscerais ou trauma passado amplificam a dor.`,
      acaoImediata: 'Converse com seu profissional sobre esses fatores. Eles podem explicar por que a dor persiste mesmo com tratamento correto.',
      score: scores.N, maxScore: 10, lossPoints: perdaN.perda_pontos,
      colorClass: 'text-slate-700 dark:text-slate-400', bgClass: 'bg-slate-100 dark:bg-slate-900/30', borderClass: 'border-slate-200 dark:border-slate-700/50',
    });
  }

  if (perdaC.perda_pontos >= 4) {
    dicas.push({
      id: 'contexto', icon: Brain, titulo: 'Contexto Social Adverso', categoria: 'importante',
      descricao: `O contexto social/emocional subtrai ${perdaC.perda_pontos} pontos do MyID-100. Estresse laboral, conflitos e preocupações financeiras drenam sua capacidade de recuperação.`,
      acaoImediata: 'Identifique UMA fonte de estresse controlável e defina uma ação concreta para reduzi-la esta semana.',
      score: scores.C, maxScore: 10, lossPoints: perdaC.perda_pontos,
      colorClass: 'text-indigo-700 dark:text-indigo-400', bgClass: 'bg-indigo-50 dark:bg-indigo-950/30', borderClass: 'border-indigo-200 dark:border-indigo-800/50',
    });
  }

  // === POSITIVOS (low loss = strong areas) ===
  if (perdaR.perda_pontos === 0) {
    dicas.push({
      id: 'sono-bom', icon: Moon, titulo: 'Sono Excelente', categoria: 'positivo',
      descricao: `Seu sono/regulação (${scores.R.toFixed(1)}/10) não subtrai pontos do seu MyID-100! Isso é um dos seus maiores aliados na recuperação.`,
      acaoImediata: 'Continue mantendo sua rotina de sono. Ela acelera naturalmente a cicatrização.',
      score: scores.R, maxScore: 10, lossPoints: 0,
      colorClass: 'text-emerald-700 dark:text-emerald-400', bgClass: 'bg-emerald-50 dark:bg-emerald-950/30', borderClass: 'border-emerald-200 dark:border-emerald-800/50',
    });
  }

  if (perdaAF.perda_pontos === 0) {
    dicas.push({
      id: 'atividade-boa', icon: Dumbbell, titulo: 'Atividade Física Forte', categoria: 'positivo',
      descricao: `Seu nível de atividade (${scores.AF.toFixed(1)}/10) não subtrai pontos! O movimento é a melhor proteção contra dor crônica.`,
      acaoImediata: 'Mantenha a consistência. Você pode progredir com segurança sob orientação do seu profissional.',
      score: scores.AF, maxScore: 10, lossPoints: 0,
      colorClass: 'text-emerald-700 dark:text-emerald-400', bgClass: 'bg-emerald-50 dark:bg-emerald-950/30', borderClass: 'border-emerald-200 dark:border-emerald-800/50',
    });
  }

  if (perdaC.perda_pontos === 0) {
    dicas.push({
      id: 'contexto-bom', icon: Heart, titulo: 'Suporte Social Forte', categoria: 'positivo',
      descricao: `Seu contexto/suporte social (${scores.C.toFixed(1)}/10) não subtrai pontos! Pessoas com boa rede de apoio se recuperam mais rápido.`,
      acaoImediata: 'Valorize e mantenha seus vínculos. Eles fazem parte do seu tratamento.',
      score: scores.C, maxScore: 10, lossPoints: 0,
      colorClass: 'text-emerald-700 dark:text-emerald-400', bgClass: 'bg-emerald-50 dark:bg-emerald-950/30', borderClass: 'border-emerald-200 dark:border-emerald-800/50',
    });
  }

  if (perdaD.perda_pontos === 0) {
    dicas.push({
      id: 'dor-baixa', icon: Heart, titulo: 'Dor Controlada', categoria: 'positivo',
      descricao: `Sua dor (${scores.D.toFixed(1)}/10) não compromete seu MyID-100. Excelente controle!`,
      acaoImediata: 'Mantenha suas estratégias de manejo. Foque na prevenção de recidivas.',
      score: scores.D, maxScore: 10, lossPoints: 0,
      colorClass: 'text-emerald-700 dark:text-emerald-400', bgClass: 'bg-emerald-50 dark:bg-emerald-950/30', borderClass: 'border-emerald-200 dark:border-emerald-800/50',
    });
  }

  // Sort: urgente > importante > oportunidade > positivo, then by loss points
  const order = { urgente: 0, importante: 1, oportunidade: 2, positivo: 3 };
  dicas.sort((a, b) => order[a.categoria] - order[b.categoria] || b.lossPoints - a.lossPoints);

  return dicas;
}

const categoriaConfig = {
  urgente: { label: 'Atenção Urgente', badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  importante: { label: 'Importante', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  oportunidade: { label: 'Oportunidade', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  positivo: { label: 'Ponto Forte', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
};

interface MyIDDicasPessoaisProps {
  scores: Scores;
  compact?: boolean;
  className?: string;
}

export default function MyIDDicasPessoais({ scores, compact = false, className }: MyIDDicasPessoaisProps) {
  const [expandido, setExpandido] = useState(!compact);
  const dicas = gerarDicas(scores);

  if (dicas.length === 0) return null;

  const urgentes = dicas.filter(d => d.categoria === 'urgente' || d.categoria === 'importante');
  const oportunidades = dicas.filter(d => d.categoria === 'oportunidade');
  const positivos = dicas.filter(d => d.categoria === 'positivo');

  return (
    <Card className={cn("overflow-hidden border-0 shadow-lg", className)}>
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpandido(!expandido)}
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 flex items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 shadow-md shrink-0">
            <Lightbulb className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-black text-base text-foreground leading-tight">Dicas Personalizadas</h3>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-0.5">
              {urgentes.length > 0 ? `${urgentes.length} alerta${urgentes.length > 1 ? 's' : ''} · ` : ''}
              {dicas.length} dica{dicas.length > 1 ? 's' : ''} baseada{dicas.length > 1 ? 's' : ''} no seu MyID
            </p>
          </div>
        </div>
        {expandido ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </div>

      {expandido && (
        <CardContent className="px-4 pb-5 pt-0 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          {/* Alertas urgentes/importantes */}
          {urgentes.length > 0 && (
            <div className="space-y-2">
              {urgentes.map(dica => (
                <DicaCard key={dica.id} dica={dica} />
              ))}
            </div>
          )}

          {/* Oportunidades */}
          {oportunidades.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 pt-2">
                <Sparkles className="h-3 w-3 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Oportunidades de Melhoria</span>
              </div>
              {oportunidades.map(dica => (
                <DicaCard key={dica.id} dica={dica} />
              ))}
            </div>
          )}

          {/* Pontos positivos */}
          {positivos.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 pt-2">
                <Heart className="h-3 w-3 text-emerald-600" />
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Seus Pontos Fortes</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {positivos.map(dica => (
                  <DicaCard key={dica.id} dica={dica} mini />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function DicaCard({ dica, mini = false }: { dica: DicaPersonalizada; mini?: boolean }) {
  const Icon = dica.icon;
  const catConfig = categoriaConfig[dica.categoria];

  if (mini) {
    return (
      <div className={cn("p-3 rounded-xl border", dica.bgClass, dica.borderClass)}>
        <div className="flex items-center gap-2 mb-1">
          <Icon className={cn("h-3.5 w-3.5", dica.colorClass)} />
          <span className={cn("text-xs font-bold", dica.colorClass)}>{dica.titulo}</span>
          <span className={cn("text-[10px] font-black ml-auto", dica.colorClass)}>{dica.lossPoints > 0 ? `-${dica.lossPoints}pts` : '✓ 0pts'}</span>
        </div>
        <p className="text-[11px] text-foreground/70 leading-snug">{dica.acaoImediata}</p>
      </div>
    );
  }

  return (
    <div className={cn("p-4 rounded-xl border", dica.bgClass, dica.borderClass)}>
      <div className="flex items-start gap-3">
        <div className={cn("h-8 w-8 flex items-center justify-center rounded-lg shrink-0", dica.bgClass)}>
          <Icon className={cn("h-4 w-4", dica.colorClass)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={cn("text-sm font-bold", dica.colorClass)}>{dica.titulo}</span>
            <Badge className={cn("text-[9px] h-4 px-1.5 font-bold border-0", catConfig.badge)}>
              {catConfig.label}
            </Badge>
            <span className={cn("text-xs font-black ml-auto", dica.colorClass)}>{dica.score.toFixed(1)}/10</span>
          </div>
          <p className="text-xs text-foreground/80 leading-relaxed mb-2">{dica.descricao}</p>
          <div className="flex items-start gap-1.5 bg-white/60 dark:bg-black/20 p-2 rounded-lg border border-current/10">
            <Zap className={cn("h-3 w-3 mt-0.5 shrink-0", dica.colorClass)} />
            <p className={cn("text-[11px] font-semibold leading-snug", dica.colorClass)}>{dica.acaoImediata}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
