import { useState } from 'react';
import { Check, Loader2, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useInclinometro } from '@/hooks/useInclinometro';

const nf = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Nível do celular, como o do app Medidas do iPhone: encoste a borda do aparelho (ou uma régua apoiada nele)
// no segmento do corpo e leia a inclinação em graus; "Zerar" faz o ponto de referência em outra posição.
export default function NivelCelular({ onRegistrar }: { onRegistrar: (graus: number, texto: string) => void }) {
  const { estado, graus, ativar, parar } = useInclinometro();
  const [zero, setZero] = useState(0);
  const [pedindo, setPedindo] = useState(false);

  const valor = graus === null ? null : graus - zero;
  const nivelado = valor !== null && Math.abs(valor) < 0.5;

  const ligar = async () => { setPedindo(true); await ativar(); setPedindo(false); };

  const registrar = () => {
    if (valor === null) return;
    onRegistrar(Math.abs(valor), `Inclinação medida com o sensor do celular: ${nf(Math.abs(valor))}° em relação à vertical${zero ? ' (a partir do zero marcado)' : ''}, aparelho girado para a ${valor > 0 ? 'direita' : valor < 0 ? 'esquerda' : 'vertical'}.`);
    toast.success('Leitura do sensor adicionada ao resultado.');
  };

  return (
    <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-3">
      <p className="flex items-center gap-2 text-sm font-semibold"><Smartphone className="h-4 w-4" /> Nível do celular</p>
      {estado !== 'ativo' ? (
        <>
          <p className="text-xs text-muted-foreground">Usa o sensor do aparelho, como o Nível do app Medidas do iPhone: encoste a borda do celular (ou uma régua apoiada nele) no segmento e leia o ângulo.</p>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={ligar} disabled={pedindo}>
            {pedindo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Smartphone className="h-3.5 w-3.5" />} Ativar o sensor
          </Button>
          {estado === 'negado' && <p className="text-xs text-destructive">Permissão do sensor negada. No iPhone, libere em Ajustes › Safari › Movimento e orientação, e tente de novo.</p>}
          {estado === 'indisponivel' && <p className="text-xs text-muted-foreground">Este aparelho ou navegador não tem sensor de movimento (computador, por exemplo). Use no celular.</p>}
        </>
      ) : (
        <>
          <div className={cn('flex items-center justify-between rounded-xl border px-3 py-2 transition-colors', nivelado ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-border/60')} role="status" aria-live="off">
            <span className="text-3xl font-bold tabular-nums">{valor === null ? '—' : `${nf(valor)}°`}</span>
            <span className="text-[11px] text-muted-foreground">{valor === null ? 'Segure o celular em pé (ou de lado), não deitado.' : nivelado ? 'Nivelado' : valor > 0 ? 'girado para a direita' : 'girado para a esquerda'}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" onClick={() => setZero(graus ?? 0)} disabled={graus === null}>Zerar aqui</Button>
            {zero !== 0 && <Button size="sm" variant="ghost" onClick={() => setZero(0)}>Tirar o zero</Button>}
            <Button size="sm" className="gap-1.5" onClick={registrar} disabled={valor === null}><Check className="h-3.5 w-3.5" /> Usar no resultado</Button>
            <Button size="sm" variant="ghost" onClick={parar}>Desligar</Button>
          </div>
        </>
      )}
    </div>
  );
}
