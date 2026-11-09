import { AlertTriangle, Battery, Bluetooth, BluetoothOff, FlaskConical, Loader2, Unplug } from 'lucide-react';
import type { StatusModulo } from '@/lib/emg/moduloEmg';
import type { BufferCircular } from '@/lib/emg/bufferCircular';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ROTULO_ESTADO } from './constantes';
import SeloQualidade from './SeloQualidade';

interface Props {
  status: StatusModulo;
  modo: 'real' | 'demo' | null;
  /** Há uma tentativa de conexão em andamento (inclui a preparação da demonstração). */
  conectando: boolean;
  temBluetooth: boolean;
  mensagemSemBluetooth: string;
  taxaHz: number | null;
  taxaAssumida: boolean;
  bateriaPct: number | null;
  erro: string | null;
  buffer: BufferCircular;
  onConectar: () => void;
  onDemonstracao: () => void;
  onDesconectar: () => void;
}

export default function CartaoConexao(p: Props) {
  const ligado = p.status.estado !== 'desconectado';
  const lendo = p.status.estado === 'adquirindo';
  const ocupado = p.conectando || ligado;

  return (
    <Card className="space-y-3 p-3 sm:p-4" aria-label="Conexão com o módulo">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {p.temBluetooth || p.modo === 'demo' ? <Bluetooth className="h-5 w-5" /> : <BluetoothOff className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">Módulo de eletromiografia</p>
          <p className="truncate text-xs text-muted-foreground" data-testid="estado-modulo">
            {p.conectando && !ligado ? 'Conectando…' : ROTULO_ESTADO[p.status.estado]}
            {p.status.nome ? ` · ${p.status.nome}` : ''}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" className="h-11 flex-1 gap-1.5" onClick={p.onConectar} disabled={ocupado || !p.temBluetooth}>
          {p.conectando && p.modo === 'real' ? <Loader2 className="icon-sm animate-spin" /> : <Bluetooth className="icon-sm" />}
          Conectar módulo
        </Button>
        <Button type="button" variant="outline" className="h-11 flex-1 gap-1.5" onClick={p.onDemonstracao} disabled={ocupado}>
          {p.conectando && p.modo === 'demo' ? <Loader2 className="icon-sm animate-spin" /> : <FlaskConical className="icon-sm" />}
          Modo demonstração (sem aparelho)
        </Button>
        {(ligado || p.conectando) && (
          <Button type="button" variant="ghost" className="h-11 gap-1.5" onClick={p.onDesconectar}>
            <Unplug className="icon-sm" />
            {ligado ? 'Desconectar' : 'Cancelar'}
          </Button>
        )}
      </div>

      {!p.temBluetooth && !ligado && (
        <p className="flex items-start gap-1.5 rounded-lg bg-muted/60 p-2.5 text-xs text-muted-foreground" data-testid="sem-bluetooth">
          <BluetoothOff className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{p.mensagemSemBluetooth}</span>
        </p>
      )}

      {p.modo === 'demo' && ligado && (
        <p className="flex items-start gap-1.5 rounded-lg bg-sky-50 p-2.5 text-xs text-sky-900 dark:bg-sky-950/40 dark:text-sky-200" data-testid="aviso-demonstracao">
          <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>Demonstração: o sinal é simulado e reage ao protocolo. Não é uma medida de ninguém.</span>
        </p>
      )}

      {p.erro && (
        <p role="alert" className="flex items-start gap-1.5 rounded-lg bg-red-50 p-2.5 text-xs text-red-800 dark:bg-red-950/40 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{p.erro}</span>
        </p>
      )}

      {ligado && (
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2 border-t border-border/50 pt-3 text-xs">
          <p data-testid="taxa-modulo">
            <span className="text-muted-foreground">Taxa: </span>
            <span className="font-semibold tabular-nums">{p.taxaHz === null ? '—' : `${p.taxaHz} Hz`}</span>
          </p>
          <p className="flex items-center gap-1" data-testid="bateria-modulo">
            <Battery className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <span className="text-muted-foreground">Bateria: </span>
            <span className="font-semibold tabular-nums">{p.bateriaPct === null ? '—' : `${p.bateriaPct} %`}</span>
          </p>
          <SeloQualidade buffer={p.buffer} fsHz={p.taxaHz} ativo={lendo} />
        </div>
      )}

      {ligado && p.taxaAssumida && (
        <p role="status" className="flex items-start gap-1.5 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200" data-testid="aviso-taxa-assumida">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Taxa assumida: o módulo não respondeu à leitura da taxa e estamos supondo {p.taxaHz ?? 500} Hz. Se o tempo do gráfico parecer errado, confira em
            “Ver dados recebidos”.
          </span>
        </p>
      )}
    </Card>
  );
}
