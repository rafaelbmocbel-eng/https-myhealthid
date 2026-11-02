import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ESCALA_URINA,
  FAIXA_PSR,
  ITENS_CHECKIN,
  ROTULOS_ITEM,
  rotuloPsr,
  type ItemCheckin,
  type NivelItem,
  type ValoresCheckin,
} from '@/lib/checkinSemanal';

interface Props {
  /** Respostas já enviadas nesta semana (ao corrigir). */
  inicial?: ValoresCheckin | null;
  enviando?: boolean;
  erro?: string | null;
  onEnviar: (valores: ValoresCheckin) => void;
  onCancelar?: () => void;
}

// Do melhor (5) ao pior (1): o topo da lista é sempre o melhor.
const NIVEIS: NivelItem[] = [5, 4, 3, 2, 1];
const NIVEIS_PSR = Array.from({ length: FAIXA_PSR.max - FAIXA_PSR.min + 1 }, (_, i) => FAIXA_PSR.min + i);

type Respostas = Record<ItemCheckin, number | null>;

function respostasIniciais(inicial?: ValoresCheckin | null): Respostas {
  return {
    fadiga: inicial?.fadiga ?? null,
    sono: inicial?.sono ?? null,
    dor_muscular: inicial?.dor_muscular ?? null,
    estresse: inicial?.estresse ?? null,
    humor: inicial?.humor ?? null,
  };
}

interface OpcaoProps {
  nome: string;
  valor: string;
  marcado: boolean;
  onEscolher: () => void;
  nomeAcessivel?: string;
  className?: string;
  children: ReactNode;
}

// Radio nativo (teclado e leitor de tela de graça), com a opção inteira como alvo de toque.
// O marcador de selecionado é um ícone, para a cor não ser o único sinal.
function Opcao({ nome, valor, marcado, onEscolher, nomeAcessivel, className, children }: OpcaoProps) {
  return (
    <label className="relative block cursor-pointer">
      <input
        type="radio"
        name={nome}
        value={valor}
        checked={marcado}
        onChange={onEscolher}
        aria-label={nomeAcessivel}
        className="peer sr-only"
      />
      <span
        className={cn(
          'flex min-h-[48px] items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background',
          marcado ? 'border-primary bg-primary/10 font-semibold text-foreground' : 'border-border bg-card text-foreground hover:bg-muted/50',
          className,
        )}
      >
        {marcado
          ? <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          : <Circle className="h-5 w-5 shrink-0 text-muted-foreground/60" aria-hidden="true" />}
        {children}
      </span>
    </label>
  );
}

function Pergunta({ titulo, dica, children }: { titulo: string; dica?: string; children: ReactNode }) {
  return (
    <fieldset role="radiogroup" className="space-y-2 rounded-2xl border border-border/60 bg-card p-4">
      <legend className="px-1 text-sm font-bold text-foreground">{titulo}</legend>
      {dica && <p className="text-[11px] text-muted-foreground">{dica}</p>}
      {children}
    </fieldset>
  );
}

export default function CheckinSemanalForm({ inicial, enviando = false, erro, onEnviar, onCancelar }: Props) {
  const uid = useId();
  const [respostas, setRespostas] = useState<Respostas>(() => respostasIniciais(inicial));
  const [urina, setUrina] = useState<number | null>(inicial?.urina ?? null);
  const [treinou, setTreinou] = useState<boolean>(inicial?.psr != null);
  const [psr, setPsr] = useState<number | null>(inicial?.psr ?? null);

  const respondidas = ITENS_CHECKIN.filter((item) => respostas[item] !== null).length;
  const completo = respondidas === ITENS_CHECKIN.length;

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (!completo || enviando) return;
    onEnviar({
      fadiga: respostas.fadiga as number,
      sono: respostas.sono as number,
      dor_muscular: respostas.dor_muscular as number,
      estresse: respostas.estresse as number,
      humor: respostas.humor as number,
      urina,
      psr: treinou ? psr : null,
    });
  };

  return (
    <form onSubmit={enviar} aria-label="Check-in da semana" className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Pensando na sua semana, escolha em cada pergunta a opção que mais combina com você.
        <strong className="text-foreground"> Em todas, 5 é o melhor e 1 é o pior.</strong>
      </p>

      {ITENS_CHECKIN.map((item) => (
        <Pergunta key={item} titulo={ROTULOS_ITEM[item].titulo} dica="5 = melhor · 1 = pior">
          {NIVEIS.map((nivel) => (
            <Opcao
              key={nivel}
              nome={`${uid}-${item}`}
              valor={String(nivel)}
              marcado={respostas[item] === nivel}
              onEscolher={() => setRespostas((r) => ({ ...r, [item]: nivel }))}
            >
              <span className="w-4 shrink-0 text-center font-bold tabular-nums">{nivel}</span>{' '}
              <span className="flex-1">{ROTULOS_ITEM[item].niveis[nivel]}</span>
            </Opcao>
          ))}
        </Pergunta>
      ))}

      <Pergunta titulo="Cor da urina (opcional)" dica="Escolha a cor mais parecida com a da sua urina nesta semana. Se preferir, pule.">
        <Opcao nome={`${uid}-urina`} valor="" marcado={urina === null} onEscolher={() => setUrina(null)}>
          <span className="flex-1">Pular esta pergunta</span>
        </Opcao>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ESCALA_URINA.map((cor) => (
            <Opcao
              key={cor.nivel}
              nome={`${uid}-urina`}
              valor={String(cor.nivel)}
              marcado={urina === cor.nivel}
              onEscolher={() => setUrina(cor.nivel)}
            >
              <span
                className="h-6 w-6 shrink-0 rounded-full border border-foreground/30"
                style={{ backgroundColor: cor.cor }}
                aria-hidden="true"
              />
              <span className="w-4 shrink-0 text-center font-bold tabular-nums">{cor.nivel}</span>{' '}
              <span className="flex-1">{cor.descricao}</span>
            </Opcao>
          ))}
        </div>
      </Pergunta>

      <Pergunta titulo="Treinou esta semana?" dica="Se sim, você pode contar como está a sua recuperação.">
        <div className="grid grid-cols-2 gap-2">
          <Opcao nome={`${uid}-treinou`} valor="sim" marcado={treinou} onEscolher={() => setTreinou(true)}>
            <span>Sim</span>
          </Opcao>
          <Opcao nome={`${uid}-treinou`} valor="nao" marcado={!treinou} onEscolher={() => setTreinou(false)}>
            <span>Não</span>
          </Opcao>
        </div>
      </Pergunta>

      {treinou && (
        <Pergunta titulo="Recuperação do treino (opcional)" dica="0 = nada recuperado(a) · 10 = totalmente recuperado(a). Se preferir, pule.">
          <div className="grid grid-cols-6 gap-2">
            {NIVEIS_PSR.map((n) => (
              <Opcao
                key={n}
                nome={`${uid}-psr`}
                valor={String(n)}
                marcado={psr === n}
                onEscolher={() => setPsr(n)}
                nomeAcessivel={`${n}: ${rotuloPsr(n)}`}
                className="justify-center px-1"
              >
                <span className="font-bold tabular-nums">{n}</span>
              </Opcao>
            ))}
          </div>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {psr !== null ? `${psr}: ${rotuloPsr(psr)}` : 'Nenhuma opção escolhida.'}
          </p>
        </Pergunta>
      )}

      {erro && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {erro}
        </p>
      )}

      <div className="space-y-2">
        {!completo && (
          <p id={`${uid}-faltam`} className="text-xs text-muted-foreground">
            Responda as 5 primeiras perguntas para enviar ({respondidas} de {ITENS_CHECKIN.length}).
          </p>
        )}
        <div className="flex gap-2">
          {onCancelar && (
            <Button type="button" variant="outline" className="min-h-[48px] flex-1" onClick={onCancelar} disabled={enviando}>
              Cancelar
            </Button>
          )}
          <Button
            type="submit"
            className="min-h-[48px] flex-1 gap-2 font-bold"
            disabled={!completo || enviando}
            aria-describedby={completo ? undefined : `${uid}-faltam`}
          >
            {enviando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {enviando ? 'Enviando…' : 'Enviar'}
          </Button>
        </div>
      </div>
    </form>
  );
}
