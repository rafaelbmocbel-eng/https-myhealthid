import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, ArrowRight, Save, Sparkles } from 'lucide-react';

interface FaseInfo {
  numero: 1 | 2 | 3 | 4;
  titulo: string;
  descricao: string;
  blocos: string[];
  tempoEstimado: string;
  dimensoesNovas: string[];
}

export const FASES_INFO: Record<number, FaseInfo> = {
  1: {
    numero: 1,
    titulo: 'Essencial',
    descricao: 'Vamos entender sua dor e identificar sinais importantes.',
    blocos: ['Identificação', 'Mapeamento da dor + Red Flags'],
    tempoEstimado: '~3 min',
    dimensoesNovas: ['D', 'I'],
  },
  2: {
    numero: 2,
    titulo: 'Funcional',
    descricao: 'Como sua dor afeta o que você faz no dia a dia.',
    blocos: ['Funcionalidade', 'Comportamento e crenças'],
    tempoEstimado: '~3 min',
    dimensoesNovas: ['EFI', 'P'],
  },
  3: {
    numero: 3,
    titulo: 'Regulação',
    descricao: 'Sono, energia e equilíbrio emocional.',
    blocos: ['Sono, energia, psicológico, contexto'],
    tempoEstimado: '~4 min',
    dimensoesNovas: ['R', 'C'],
  },
  4: {
    numero: 4,
    titulo: 'Sistêmico',
    descricao: 'Histórico e sinais corporais para fechar o quadro.',
    blocos: ['Trauma, cicatrizes, autonômico, ginecológico'],
    tempoEstimado: '~2 min',
    dimensoesNovas: ['N'],
  },
};

interface Props {
  modo: 'inicio' | 'concluida' | 'final';
  faseConcluida?: 1 | 2 | 3 | 4;
  proximaFase?: 1 | 2 | 3 | 4;
  scoreParcial?: number;
  dimensoesPreenchidas?: string[];
  onContinuar: () => void;
  onSalvarESair?: () => void;
}

export function MyIDFaseTransicao({
  modo,
  faseConcluida,
  proximaFase,
  scoreParcial,
  dimensoesPreenchidas = [],
  onContinuar,
  onSalvarESair,
}: Props) {
  if (modo === 'inicio') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6 text-center animate-in fade-in zoom-in-95 duration-500">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Vamos fazer juntos</h1>
          <p className="text-base text-muted-foreground max-w-lg mx-auto">
            Seu MyID é dividido em <strong>4 fases curtas</strong>. Você pode parar
            quando quiser e voltar depois — tudo fica salvo automaticamente.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
          {Object.values(FASES_INFO).map((f) => (
            <div
              key={f.numero}
              className="rounded-xl border border-border/40 p-4 bg-card shadow-xs"
            >
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-xs">Fase {f.numero}</Badge>
                <span className="text-sm font-semibold">{f.titulo}</span>
              </div>
              <p className="text-xs text-muted-foreground">{f.descricao}</p>
              <p className="text-xs text-muted-foreground mt-1">⏱ {f.tempoEstimado}</p>
            </div>
          ))}
        </div>

        <Button size="lg" onClick={onContinuar} className="w-full sm:w-auto px-12 h-12 rounded-full text-base">
          Começar Fase 1
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>

        <p className="text-xs text-muted-foreground">
          🔒 Suas respostas são confidenciais.
        </p>
      </div>
    );
  }

  if (modo === 'final') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-6 text-center animate-in fade-in zoom-in-95 duration-500">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
          <CheckCircle2 className="h-10 w-10 text-emerald-600" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">MyID completo!</h1>
          <p className="text-base text-muted-foreground">
            Suas 4 fases foram enviadas ao profissional. Aguarde a análise final.
          </p>
        </div>
        {typeof scoreParcial === 'number' && (
          <div className="inline-block rounded-2xl border border-border/40 bg-card px-8 py-6 shadow-xs">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Seu MyID</p>
            <p className="text-5xl font-black text-primary mt-1">{Math.round(scoreParcial)}</p>
            <p className="text-xs text-muted-foreground mt-1">de 100</p>
          </div>
        )}
      </div>
    );
  }

  // modo === 'concluida'
  const faseInfo = faseConcluida ? FASES_INFO[faseConcluida] : null;
  const proxInfo = proximaFase ? FASES_INFO[proximaFase] : null;
  const totalDims = 7;
  const preenchidas = dimensoesPreenchidas.length;

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6 text-center animate-in fade-in zoom-in-95 duration-500">
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
      </div>

      <div className="space-y-2">
        <Badge variant="outline" className="text-xs">Fase {faseConcluida} de 4</Badge>
        <h2 className="text-2xl font-bold tracking-tight">
          Fase {faseConcluida} concluída ✓
        </h2>
        {faseInfo && (
          <p className="text-sm text-muted-foreground">
            Você completou: <strong>{faseInfo.titulo}</strong>
          </p>
        )}
      </div>

      {typeof scoreParcial === 'number' && (
        <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-xs space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Score parcial
          </p>
          <p className="text-4xl font-black text-primary">{Math.round(scoreParcial)}</p>
          <p className="text-xs text-muted-foreground">
            {preenchidas} de {totalDims} dimensões preenchidas
          </p>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${(preenchidas / totalDims) * 100}%` }}
            />
          </div>
        </div>
      )}

      {proxInfo && (
        <div className="rounded-xl border border-border/40 p-4 bg-muted/30 text-left space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">A seguir</p>
          <p className="text-sm font-semibold">
            Fase {proxInfo.numero} — {proxInfo.titulo}
          </p>
          <p className="text-xs text-muted-foreground">
            {proxInfo.descricao} ⏱ {proxInfo.tempoEstimado}
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        <Button size="lg" onClick={onContinuar} className="rounded-full px-8">
          Continuar agora
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        {onSalvarESair && (
          <Button variant="outline" size="lg" onClick={onSalvarESair} className="rounded-full">
            <Save className="mr-2 h-4 w-4" />
            Salvar e voltar depois
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Seu progresso fica salvo. Quando reabrir o link, continua daqui.
      </p>
    </div>
  );
}
