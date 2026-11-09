import { useState } from 'react';
import { Pause, Play } from 'lucide-react';
import type { BufferCircular } from '@/lib/emg/bufferCircular';
import type { EstadoModulo } from '@/lib/emg/moduloEmg';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import GraficoAoVivo from './GraficoAoVivo';
import RmsAoVivo from './RmsAoVivo';

interface Props {
  buffer: BufferCircular;
  fsHz: number | null;
  /** O módulo está lendo o sinal agora. */
  ativo: boolean;
  cvmUv: number | null;
  /** Estado do módulo: escolhe o aviso quando não há sinal. */
  estado?: EstadoModulo;
  /** Há uma tentativa de conexão em andamento (ainda antes de o módulo mudar de estado). */
  conectando?: boolean;
}

function avisoSemSinal(estado: EstadoModulo, conectando: boolean): string {
  if (estado === 'reconectando') return 'Religando o módulo…';
  if (estado === 'conectando' || estado === 'conectado' || conectando) return 'Aguardando o sinal…';
  return 'Sem sinal. Conecte o módulo ou use o modo demonstração.';
}

export default function SinalAoVivo({ buffer, fsHz, ativo, cvmUv, estado = 'desconectado', conectando = false }: Props) {
  const [congelado, setCongelado] = useState(false);
  const mostrarTracado = ativo || congelado;
  return (
    <Card className="space-y-3 p-3 sm:p-4" aria-label="Sinal ao vivo">
      <div className="flex items-start justify-between gap-3">
        <RmsAoVivo buffer={buffer} fsHz={fsHz} ativo={ativo} cvmUv={cvmUv} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 shrink-0 gap-1.5"
          aria-pressed={congelado}
          onClick={() => setCongelado((c) => !c)}
          disabled={!ativo && !congelado}
        >
          {congelado ? <Play className="icon-sm" /> : <Pause className="icon-sm" />}
          {congelado ? 'Descongelar' : 'Congelar'}
        </Button>
      </div>
      <div className="relative">
        {/* Sem taxa o gráfico só desenha a grade: o buffer guarda o último sinal até a próxima conexão e não deve aparecer por baixo do aviso. */}
        <GraficoAoVivo buffer={buffer} fsHz={mostrarTracado ? fsHz : null} congelado={congelado} />
        {!mostrarTracado && (
          <p
            className="pointer-events-none absolute inset-x-0 top-0 flex h-40 items-center justify-center px-6 text-center text-sm text-muted-foreground sm:h-52"
            data-testid="aviso-sem-sinal"
          >
            {avisoSemSinal(estado, conectando)}
          </p>
        )}
      </div>
    </Card>
  );
}
