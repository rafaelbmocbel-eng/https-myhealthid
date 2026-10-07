import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  OBSERVACAO_MAX_CARACTERES, dorAcimaDoLimite, escala0a10, faixaDor, montarRegistroComoFoi, orientacaoDor,
  type RegistroComoFoi,
} from '@/lib/acompanhamento';

interface Inicial {
  rpe?: number | null;
  dor?: number | null;
  observacao?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nomeSessao?: string | null;
  inicial?: Inicial | null;
  salvando?: boolean;
  onSalvar: (registro: RegistroComoFoi) => void;
}

// Valor não tocado fica "não informado" (null) e nunca vira 0: o profissional não
// pode ler "sem dor" onde o cliente apenas pulou a pergunta.
function Formulario({ inicial, salvando, onFechar, onSalvar }: {
  inicial?: Inicial | null;
  salvando?: boolean;
  onFechar: () => void;
  onSalvar: (registro: RegistroComoFoi) => void;
}) {
  const [rpe, setRpe] = useState<number | null>(() => escala0a10(inicial?.rpe));
  const [dor, setDor] = useState<number | null>(() => escala0a10(inicial?.dor));
  const [observacao, setObservacao] = useState(() => inicial?.observacao ?? '');

  const registro = montarRegistroComoFoi({ rpe, dor, observacao });
  const orientacao = orientacaoDor(dor);
  const faixa = faixaDor(dor);
  const dorAlta = dorAcimaDoLimite(dor);

  return (
    <>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">
            Esforço percebido —{' '}
            <span className="text-foreground">{rpe === null ? 'não informado' : `${rpe}/10`}</span>
          </label>
          <p className="text-[10px] text-muted-foreground mb-2">0 = muito leve · 10 = esforço máximo</p>
          <Slider aria-label="Esforço percebido de 0 a 10" value={[rpe ?? 0]} onValueChange={([v]) => setRpe(v)} min={0} max={10} step={1} />
          <Button type="button" variant="ghost" size="sm" className="h-6 px-2 mt-1 text-[11px]" onClick={() => setRpe(0)}>
            Foi muito leve (0)
          </Button>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">
            Dor durante o treino —{' '}
            <span className={cn(
              dor === null && 'text-foreground',
              faixa === 'alta' && 'text-red-500',
              faixa === 'atencao' && 'text-amber-500',
              faixa === 'baixa' && 'text-emerald-600',
            )}>
              {dor === null ? 'não informado' : `${dor}/10`}
            </span>
          </label>
          <p className="text-[10px] text-muted-foreground mb-2">0 = nenhuma dor · 10 = pior dor possível</p>
          <Slider aria-label="Dor durante o treino de 0 a 10" value={[dor ?? 0]} onValueChange={([v]) => setDor(v)} min={0} max={10} step={1} />
          <Button type="button" variant="ghost" size="sm" className="h-6 px-2 mt-1 text-[11px]" onClick={() => setDor(0)}>
            Sem dor (0)
          </Button>
        </div>

        {orientacao && (
          <div
            role={dorAlta ? 'alert' : undefined}
            className={cn(
              'rounded-lg border px-3 py-2 text-[11px] flex items-start gap-1.5',
              dorAlta
                ? 'border-red-300 bg-red-50 text-red-800 dark:bg-red-950/20 dark:text-red-300'
                : 'border-border/40 bg-muted/30 text-muted-foreground',
            )}
          >
            {dorAlta && <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
            <span>{orientacao}</span>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          Se sentir dor ou aperto no peito, falta de ar, tontura forte ou desmaio, interrompa o treino e procure atendimento de urgência.
        </p>

        <Textarea
          rows={2}
          maxLength={OBSERVACAO_MAX_CARACTERES}
          placeholder="Quer contar mais alguma coisa? (opcional)"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          className="text-sm resize-none"
        />
      </div>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onFechar} disabled={salvando}>
          Agora não
        </Button>
        <Button className="flex-1 gap-1.5" disabled={!registro || salvando} onClick={() => registro && onSalvar(registro)}>
          {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar
        </Button>
      </div>
    </>
  );
}

export default function ComoFoiTreinoDialog({ open, onOpenChange, nomeSessao, inicial, salvando, onSalvar }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Como foi o treino?</DialogTitle>
          <DialogDescription className="text-xs">
            {nomeSessao ? <strong>{nomeSessao}. </strong> : null}
            Opcional e rápido. Ajuda o seu profissional a acompanhar o seu plano.
          </DialogDescription>
        </DialogHeader>
        <Formulario inicial={inicial} salvando={salvando} onFechar={() => onOpenChange(false)} onSalvar={onSalvar} />
      </DialogContent>
    </Dialog>
  );
}
