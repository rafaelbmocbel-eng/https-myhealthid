import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Heart, Droplets, Apple, Brain, Moon, Dumbbell,
  Monitor, AlertTriangle, Sparkles, ChevronDown, ChevronUp,
  Lightbulb, Shield, Zap
} from 'lucide-react';
import { useState } from 'react';

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
  colorClass: string;
  bgClass: string;
  borderClass: string;
}

function gerarDicas(scores: Scores): DicaPersonalizada[] {
  const dicas: DicaPersonalizada[] = [];

  // === URGENTES (scores problemáticos altos) ===
  if (scores.D >= 7) {
    dicas.push({
      id: 'dor-alta',
      icon: AlertTriangle,
      titulo: 'Dor Elevada',
      categoria: 'urgente',
      descricao: `Seu nível de dor (${scores.D.toFixed(1)}/10) está significativamente alto. Isso amplifica todos os outros fatores do seu sistema, dificultando a recuperação.`,
      acaoImediata: 'Converse com seu profissional sobre estratégias de manejo da dor antes de aumentar a carga de exercícios.',
      score: scores.D,
      maxScore: 10,
      colorClass: 'text-red-700 dark:text-red-400',
      bgClass: 'bg-red-50 dark:bg-red-950/30',
      borderClass: 'border-red-200 dark:border-red-800/50',
    });
  } else if (scores.D >= 5) {
    dicas.push({
      id: 'dor-moderada',
      icon: AlertTriangle,
      titulo: 'Dor Moderada',
      categoria: 'importante',
      descricao: `Sua dor (${scores.D.toFixed(1)}/10) está em nível moderado. É importante monitorar e evitar atividades que a intensifiquem.`,
      acaoImediata: 'Registre no diário quando sua dor piora e melhora — isso ajuda seu profissional a ajustar o tratamento.',
      score: scores.D,
      maxScore: 10,
      colorClass: 'text-amber-700 dark:text-amber-400',
      bgClass: 'bg-amber-50 dark:bg-amber-950/30',
      borderClass: 'border-amber-200 dark:border-amber-800/50',
    });
  }

  if (scores.P >= 6) {
    dicas.push({
      id: 'psicologico',
      icon: Brain,
      titulo: 'Carga Emocional Alta',
      categoria: 'urgente',
      descricao: `Seu fator psicológico (${scores.P.toFixed(1)}/10) funciona como um "amplificador" da dor — ele multiplica por ×${(1 + scores.P / 10).toFixed(1)} toda a sobrecarga do sistema.`,
      acaoImediata: 'Pratique 5 minutos de respiração diafragmática antes de dormir. Isso ajuda a "desligar" o amplificador.',
      score: scores.P,
      maxScore: 10,
      colorClass: 'text-purple-700 dark:text-purple-400',
      bgClass: 'bg-purple-50 dark:bg-purple-950/30',
      borderClass: 'border-purple-200 dark:border-purple-800/50',
    });
  }

  // === IMPORTANTES (déficits de capacidade) ===
  if (scores.R < 5) {
    dicas.push({
      id: 'sono',
      icon: Moon,
      titulo: 'Sono Insuficiente',
      categoria: 'importante',
      descricao: `Seu score de regulação/sono (${scores.R.toFixed(1)}/10) está baixo. O sono é o principal momento de reparo dos tecidos e processamento da dor.`,
      acaoImediata: 'Tente dormir 30 minutos mais cedo esta noite. Desligue telas 1h antes de deitar.',
      score: scores.R,
      maxScore: 10,
      colorClass: 'text-indigo-700 dark:text-indigo-400',
      bgClass: 'bg-indigo-50 dark:bg-indigo-950/30',
      borderClass: 'border-indigo-200 dark:border-indigo-800/50',
    });
  }

  if (scores.HID < 5) {
    dicas.push({
      id: 'hidratacao',
      icon: Droplets,
      titulo: 'Hidratação Baixa',
      categoria: 'importante',
      descricao: `Sua hidratação (${scores.HID.toFixed(1)}/10) está abaixo do ideal. A água é essencial para a saúde dos discos, articulações e fluxo sanguíneo.`,
      acaoImediata: 'Beba ao menos 2 litros de água hoje. Deixe uma garrafa visível como lembrete.',
      score: scores.HID,
      maxScore: 10,
      colorClass: 'text-sky-700 dark:text-sky-400',
      bgClass: 'bg-sky-50 dark:bg-sky-950/30',
      borderClass: 'border-sky-200 dark:border-sky-800/50',
    });
  }

  if (scores.NUT < 5) {
    dicas.push({
      id: 'nutricao',
      icon: Apple,
      titulo: 'Nutrição em Alerta',
      categoria: 'importante',
      descricao: `Seu score nutricional (${scores.NUT.toFixed(1)}/10) indica espaço para melhoria. Alimentos inflamatórios podem aumentar a sensibilidade à dor.`,
      acaoImediata: 'Evite ultraprocessados nas próximas 3 refeições. Aumente frutas, verduras e proteínas magras.',
      score: scores.NUT,
      maxScore: 10,
      colorClass: 'text-green-700 dark:text-green-400',
      bgClass: 'bg-green-50 dark:bg-green-950/30',
      borderClass: 'border-green-200 dark:border-green-800/50',
    });
  }

  if (scores.AF < 4) {
    dicas.push({
      id: 'atividade',
      icon: Dumbbell,
      titulo: 'Atividade Física Baixa',
      categoria: 'oportunidade',
      descricao: `Seu nível de atividade (${scores.AF.toFixed(1)}/10) indica sedentarismo. O movimento é o melhor "remédio" natural para dor crônica.`,
      acaoImediata: 'Comece com uma caminhada leve de 15 minutos hoje. Movimento é terapia.',
      score: scores.AF,
      maxScore: 10,
      colorClass: 'text-emerald-700 dark:text-emerald-400',
      bgClass: 'bg-emerald-50 dark:bg-emerald-950/30',
      borderClass: 'border-emerald-200 dark:border-emerald-800/50',
    });
  }

  if (scores.ERG < 5) {
    dicas.push({
      id: 'ergonomia',
      icon: Monitor,
      titulo: 'Ergonomia Inadequada',
      categoria: 'oportunidade',
      descricao: `Seu score de ergonomia (${scores.ERG.toFixed(1)}/10) indica que seu ambiente contribui para a sobrecarga. A postura prolongada sem intervalos gera tensão acumulada.`,
      acaoImediata: 'Faça micro-pausas a cada 50 minutos: levante, alongue ombros e pescoço por 2 minutos.',
      score: scores.ERG,
      maxScore: 10,
      colorClass: 'text-violet-700 dark:text-violet-400',
      bgClass: 'bg-violet-50 dark:bg-violet-950/30',
      borderClass: 'border-violet-200 dark:border-violet-800/50',
    });
  }

  if (scores.I >= 5) {
    dicas.push({
      id: 'inercia',
      icon: Zap,
      titulo: 'Inércia Comportamental',
      categoria: 'oportunidade',
      descricao: `Seu nível de inércia (${scores.I.toFixed(1)}/10) indica dificuldade para manter hábitos saudáveis ou iniciar mudanças. Isso pode travar sua evolução.`,
      acaoImediata: 'Escolha UMA tarefa pequena pendente que te gera estresse e resolva hoje. Movimento gera motivação.',
      score: scores.I,
      maxScore: 10,
      colorClass: 'text-orange-700 dark:text-orange-400',
      bgClass: 'bg-orange-50 dark:bg-orange-950/30',
      borderClass: 'border-orange-200 dark:border-orange-800/50',
    });
  }

  if (scores.N >= 5) {
    dicas.push({
      id: 'ruido',
      icon: Shield,
      titulo: 'Ruído Sistêmico Elevado',
      categoria: 'importante',
      descricao: `Seu ruído sistêmico (${scores.N.toFixed(1)}/10) indica fatores "ocultos" que amplificam a dor: hormônios, ciclo menstrual, condições viscerais ou trauma passado.`,
      acaoImediata: 'Converse com seu profissional sobre esses fatores. Eles podem explicar por que a dor persiste mesmo com tratamento correto.',
      score: scores.N,
      maxScore: 10,
      colorClass: 'text-slate-700 dark:text-slate-400',
      bgClass: 'bg-slate-100 dark:bg-slate-900/30',
      borderClass: 'border-slate-200 dark:border-slate-700/50',
    });
  }

  // === POSITIVOS (pontos fortes) ===
  if (scores.R >= 7) {
    dicas.push({
      id: 'sono-bom',
      icon: Moon,
      titulo: 'Sono Excelente',
      categoria: 'positivo',
      descricao: `Seu sono/regulação (${scores.R.toFixed(1)}/10) está ótimo! Isso é um dos seus maiores aliados na recuperação.`,
      acaoImediata: 'Continue mantendo sua rotina de sono. Ela acelera naturalmente a cicatrização.',
      score: scores.R,
      maxScore: 10,
      colorClass: 'text-emerald-700 dark:text-emerald-400',
      bgClass: 'bg-emerald-50 dark:bg-emerald-950/30',
      borderClass: 'border-emerald-200 dark:border-emerald-800/50',
    });
  }

  if (scores.AF >= 7) {
    dicas.push({
      id: 'atividade-boa',
      icon: Dumbbell,
      titulo: 'Atividade Física Forte',
      categoria: 'positivo',
      descricao: `Seu nível de atividade (${scores.AF.toFixed(1)}/10) é excelente! O movimento é a melhor proteção contra dor crônica.`,
      acaoImediata: 'Mantenha a consistência. Você pode progredir com segurança sob orientação do seu profissional.',
      score: scores.AF,
      maxScore: 10,
      colorClass: 'text-emerald-700 dark:text-emerald-400',
      bgClass: 'bg-emerald-50 dark:bg-emerald-950/30',
      borderClass: 'border-emerald-200 dark:border-emerald-800/50',
    });
  }

  if (scores.C >= 7) {
    dicas.push({
      id: 'contexto-bom',
      icon: Heart,
      titulo: 'Suporte Social Forte',
      categoria: 'positivo',
      descricao: `Seu contexto/suporte social (${scores.C.toFixed(1)}/10) é um grande fator protetor. Pessoas com boa rede de apoio se recuperam mais rápido.`,
      acaoImediata: 'Valorize e mantenha seus vínculos. Eles fazem parte do seu tratamento.',
      score: scores.C,
      maxScore: 10,
      colorClass: 'text-emerald-700 dark:text-emerald-400',
      bgClass: 'bg-emerald-50 dark:bg-emerald-950/30',
      borderClass: 'border-emerald-200 dark:border-emerald-800/50',
    });
  }

  // Sort: urgente > importante > oportunidade > positivo
  const order = { urgente: 0, importante: 1, oportunidade: 2, positivo: 3 };
  dicas.sort((a, b) => order[a.categoria] - order[b.categoria]);

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
          <span className={cn("text-[10px] font-black ml-auto", dica.colorClass)}>{dica.score.toFixed(1)}/10</span>
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
