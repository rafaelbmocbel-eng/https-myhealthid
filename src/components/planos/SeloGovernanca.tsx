import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChevronDown, FileEdit, History, ShieldCheck, Sparkles } from 'lucide-react';
import {
  estadoSelo, lerGovernanca, resumoParametros, rotuloSelo, semAprovacao, semParametrosConfirmados,
  type EstadoSelo,
} from '@/lib/governanca';

// Selo de governança de um plano: quem liberou, quando, em que versão e de onde
// veio (IA + revisão profissional). Serve ao profissional e ao paciente.
//
// `origem` decide de onde o plano veio e, por isso, o que o selo pode afirmar:
//  - 'profissional' → planos_treino / planos_alimentares (protegidas por RLS e
//    carimbadas por trigger no banco): pode mostrar "Liberado por ...".
//  - 'cliente' → planos_ia_cliente. O próprio paciente escreve nessa tabela, então
//    NADA nela prova revisão ou aprovação: o selo nunca diz "Liberado/aprovado por
//    profissional" e ignora qualquer `aprovacao` que esteja no conteúdo.

interface Props {
  conteudo: unknown;
  /** Coluna `aprovado` do plano. Ignorada quando origem = 'cliente'. */
  aprovado?: boolean;
  origem: 'profissional' | 'cliente';
  /** 'profissional' mostra detalhes de revisão/justificativa; 'paciente' só o essencial. */
  visao?: 'profissional' | 'paciente';
  compacto?: boolean;
  className?: string;
}

const ESTILO: Record<EstadoSelo | 'ia', { badge: 'success' | 'neutral' | 'warning' | 'info'; caixa: string }> = {
  liberado: { badge: 'success', caixa: 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30' },
  legado: { badge: 'warning', caixa: 'border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30' },
  rascunho: { badge: 'neutral', caixa: 'border-border bg-muted/40' },
  ia: { badge: 'info', caixa: 'border-blue-200 bg-blue-50/70 dark:border-blue-900 dark:bg-blue-950/30' },
};

function Icone({ tipo }: { tipo: EstadoSelo | 'ia' }) {
  const cls = 'h-4 w-4 shrink-0 mt-0.5';
  if (tipo === 'liberado') return <ShieldCheck className={cn(cls, 'text-emerald-600')} aria-hidden />;
  if (tipo === 'legado') return <History className={cn(cls, 'text-amber-600')} aria-hidden />;
  if (tipo === 'ia') return <Sparkles className={cn(cls, 'text-blue-600')} aria-hidden />;
  return <FileEdit className={cn(cls, 'text-muted-foreground')} aria-hidden />;
}

export default function SeloGovernanca({ conteudo, aprovado, origem, visao = 'profissional', compacto = false, className }: Props) {
  const [verJustificativa, setVerJustificativa] = useState(false);

  const doCliente = origem === 'cliente';
  const bruta = lerGovernanca(conteudo);
  const gov = doCliente ? semAprovacao(bruta) : bruta;

  let tipo: EstadoSelo | 'ia';
  let rotulo: string;
  if (doCliente) {
    // Texto fixo: nada que venha do conteúdo (gravável pelo paciente) entra no rótulo.
    tipo = 'ia';
    rotulo = 'Gerado por IA · sem revisão de profissional';
  } else {
    tipo = estadoSelo(gov, aprovado);
    rotulo = rotuloSelo(gov, aprovado);
  }

  const estilo = ESTILO[tipo];

  if (compacto) {
    return (
      <Badge variant={estilo.badge} size="md" className={cn('max-w-full', className)} title={rotulo}>
        <Icone tipo={tipo} />
        <span>{rotulo}</span>
      </Badge>
    );
  }

  const apr = doCliente ? null : gov?.aprovacao ?? null;
  const detalhes = visao === 'profissional' && !doCliente;
  const parametros = resumoParametros(gov);
  const justificativas: { titulo: string; texto: string }[] = [];
  if (detalhes && apr?.justificativa) justificativas.push({ titulo: 'Justificativa da liberação', texto: apr.justificativa });
  if (detalhes && gov?.triagem?.override?.justificativa) {
    justificativas.push({ titulo: 'Justificativa para prosseguir apesar da triagem', texto: gov.triagem.override.justificativa });
  }

  return (
    <div className={cn('rounded-lg border p-2.5 text-xs space-y-1.5', estilo.caixa, className)}>
      <div className="flex items-start gap-2">
        <Icone tipo={tipo} />
        <p className="font-semibold leading-snug">{rotulo}</p>
      </div>

      {doCliente && (
        <p className="text-[11px] text-muted-foreground pl-6">
          Este plano é uma sugestão da inteligência artificial e não substitui o acompanhamento de um profissional.
        </p>
      )}

      {!doCliente && visao === 'paciente' && tipo === 'liberado' && (
        <p className="text-[11px] text-muted-foreground pl-6">
          Este plano não substitui o acompanhamento de um profissional de saúde.
        </p>
      )}

      {detalhes && (
        <div className="pl-6 space-y-1">
          {tipo === 'legado' && (
            <p className="text-[11px] text-muted-foreground">
              Plano liberado antes de o sistema registrar quem aprovou, a versão e a revisão de segurança. Considere reavaliá-lo.
            </p>
          )}
          {tipo === 'liberado' && apr?.sem_revisao && (
            <p className="text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-1">
              <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" aria-hidden />
              Liberado sem revisão de segurança registrada para esta versão do plano.
            </p>
          )}
          {tipo === 'liberado' && apr?.risco_geral === 'alto' && (
            <p className="text-[11px] text-red-700 dark:text-red-300 flex items-start gap-1">
              <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" aria-hidden />
              A revisão de segurança apontou risco alto; o plano foi liberado com justificativa.
            </p>
          )}
          {gov?.triagem?.override && (
            <p className="text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-1">
              <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" aria-hidden />
              A triagem de segurança pediu {gov.triagem.nivel === 'bloqueia' ? 'bloqueio' : 'confirmação'}; o profissional prosseguiu.
            </p>
          )}
          {semParametrosConfirmados(gov) && (
            <p className="text-[11px] text-muted-foreground">
              Os parâmetros padrão do sistema usados na geração ({parametros.aConfirmar}) ainda estão a confirmar: sem fonte validada.
            </p>
          )}
          {justificativas.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setVerJustificativa((v) => !v)}
                className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                aria-expanded={verJustificativa}
              >
                {verJustificativa ? 'Ocultar justificativa' : 'Ver justificativa'}
                <ChevronDown className={cn('h-3 w-3 transition-transform', verJustificativa && 'rotate-180')} aria-hidden />
              </button>
              {verJustificativa && (
                <div className="mt-1 space-y-1.5">
                  {justificativas.map((j) => (
                    <div key={j.titulo} className="rounded-md border border-border/60 bg-background/70 p-2">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">{j.titulo}</p>
                      <p className="text-xs whitespace-pre-wrap">{j.texto}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
