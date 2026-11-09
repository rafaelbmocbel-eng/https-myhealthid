import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { AjustesDoModulo } from './fabrica';

const REDES: { valor: 50 | 60; rotulo: string }[] = [
  { valor: 60, rotulo: '60 Hz (Brasil)' },
  { valor: 50, rotulo: '50 Hz' },
];

interface Props {
  ajustes: AjustesDoModulo;
  onChange: (ajustes: AjustesDoModulo) => void;
  /** Com o módulo conectado os ajustes não mudam (valem na próxima conexão). */
  travados: boolean;
}

/**
 * As duas escolhas que dependem do aparelho real e que a especificação não confirma (seção 6): a rede
 * elétrica do filtro de ruído e se o quadro bruto traz a amostra-base. Trocar aqui evita publicar uma
 * versão nova a cada hipótese que o teste com o módulo real queira conferir.
 */
export default function AjustesDoTeste({ ajustes, onChange, travados }: Props) {
  return (
    <div className="space-y-3 rounded-xl border border-border/60 p-3" role="group" aria-labelledby="emg-ajustes-titulo">
      <div>
        <p id="emg-ajustes-titulo" className="text-sm font-semibold">
          Ajustes para o teste com o aparelho
        </p>
        <p className="text-xs text-muted-foreground" data-testid="ajustes-ajuda">
          {travados ? 'Desconecte o módulo para mudar. ' : ''}Valem a partir da próxima vez que você tocar em “Conectar módulo”.
        </p>
      </div>

      <div className="space-y-1.5">
        <p id="emg-rede-rotulo" className="text-xs font-semibold">
          Rede elétrica (filtro de ruído)
        </p>
        <div role="radiogroup" aria-labelledby="emg-rede-rotulo" className="grid grid-cols-2 gap-1.5 rounded-xl bg-muted/60 p-1">
          {REDES.map(({ valor, rotulo }) => {
            const marcado = ajustes.redeHz === valor;
            return (
              <button
                key={valor}
                type="button"
                role="radio"
                aria-checked={marcado}
                disabled={travados}
                onClick={() => onChange({ ...ajustes, redeHz: valor })}
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

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Label htmlFor="emg-amostra-base" className="text-xs font-semibold">
            Quadro bruto traz a amostra-base
          </Label>
          <p className="text-xs text-muted-foreground">
            Ligado (padrão): a 1ª amostra de cada quadro entra no sinal. Se o sinal mostrar um pequeno salto ou repetição a cada quadro, desligue e conecte de novo.
          </p>
        </div>
        <Switch
          id="emg-amostra-base"
          checked={ajustes.incluirPrimeiraAmostra}
          disabled={travados}
          onCheckedChange={(valor) => onChange({ ...ajustes, incluirPrimeiraAmostra: valor })}
        />
      </div>
    </div>
  );
}
