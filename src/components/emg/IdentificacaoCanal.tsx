import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { LadoCanal } from '@/lib/emg/sessao';
import { cn } from '@/lib/utils';
import { MUSCULOS_SUGERIDOS } from './constantes';

const LADOS: { valor: LadoCanal; rotulo: string }[] = [
  { valor: 'D', rotulo: 'Direito' },
  { valor: 'E', rotulo: 'Esquerdo' },
  { valor: '-', rotulo: 'Sem lado' },
];

interface NovaMedidaProps {
  onConfirmar: () => void;
  desabilitado: boolean;
}

// Componente à parte: ao sair da tela (quando o bloqueio acaba) o "tem certeza?" desmonta e volta ao início.
function NovaMedida({ onConfirmar, desabilitado }: NovaMedidaProps) {
  const [confirmando, setConfirmando] = useState(false);
  if (!confirmando) {
    return (
      <Button type="button" variant="outline" className="h-10 w-full sm:w-auto" disabled={desabilitado} onClick={() => setConfirmando(true)}>
        Nova medida
      </Button>
    );
  }
  return (
    <div className="space-y-2 rounded-xl border border-amber-300/60 bg-amber-50 p-3 dark:border-amber-800/60 dark:bg-amber-950/30" data-testid="confirmar-nova-medida">
      <p className="text-sm leading-snug text-amber-900 dark:text-amber-200">
        Descartar as etapas gravadas e as observações para começar uma medida nova? O que já foi salvo no prontuário não muda.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          className="h-10"
          disabled={desabilitado}
          onClick={() => {
            setConfirmando(false);
            onConfirmar();
          }}
        >
          Descartar e começar
        </Button>
        <Button type="button" variant="outline" className="h-10" onClick={() => setConfirmando(false)}>
          Não descartar
        </Button>
      </div>
    </div>
  );
}

interface Props {
  musculo: string;
  lado: LadoCanal;
  onMusculo: (texto: string) => void;
  onLado: (lado: LadoCanal) => void;
  /** Há etapas gravadas (ou um salvamento em andamento): músculo e lado não mudam sem descartá-las. */
  travado?: boolean;
  /** Descarta as etapas e começa uma medida nova. Sem isto, o botão "Nova medida" não aparece. */
  onNovaMedida?: () => void;
  /** Não deixa descartar agora (salvamento em andamento). */
  novaMedidaBloqueada?: boolean;
}

export default function IdentificacaoCanal({ musculo, lado, onMusculo, onLado, travado = false, onNovaMedida, novaMedidaBloqueada = false }: Props) {
  return (
    <Card className="space-y-3 p-3 sm:p-4" aria-label="Músculo medido">
      <div className="space-y-1.5">
        <Label htmlFor="emg-musculo" className="text-sm font-semibold">
          Músculo medido
        </Label>
        <Input
          id="emg-musculo"
          list="emg-musculos-sugeridos"
          value={musculo}
          onChange={(e) => onMusculo(e.target.value)}
          placeholder="Ex.: Reto femoral"
          autoComplete="off"
          maxLength={80}
          className="h-11"
          disabled={travado}
        />
        <datalist id="emg-musculos-sugeridos">
          {MUSCULOS_SUGERIDOS.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </div>

      <div className="space-y-1.5">
        <p id="emg-lado-rotulo" className="text-sm font-semibold">
          Lado
        </p>
        <div role="radiogroup" aria-labelledby="emg-lado-rotulo" className="grid grid-cols-3 gap-1.5 rounded-xl bg-muted/60 p-1">
          {LADOS.map(({ valor, rotulo }) => {
            const marcado = lado === valor;
            return (
              <button
                key={valor}
                type="button"
                role="radio"
                aria-checked={marcado}
                disabled={travado}
                onClick={() => onLado(valor)}
                className={cn(
                  'h-10 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
                  marcado ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {rotulo}
              </button>
            );
          })}
        </div>
      </div>

      {travado && (
        <p className="text-xs leading-snug text-muted-foreground" data-testid="canal-travado">
          Músculo e lado ficam travados enquanto houver etapas gravadas. Para medir o outro lado, comece uma nova medida.
        </p>
      )}
      {travado && onNovaMedida && <NovaMedida onConfirmar={onNovaMedida} desabilitado={novaMedidaBloqueada} />}

      <p className="text-xs leading-snug text-muted-foreground">
        Pele limpa e seca; posicione os eletrodos conforme a recomendação SENIAM para o músculo.
      </p>
    </Card>
  );
}
