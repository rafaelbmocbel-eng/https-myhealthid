import { useEffect, useState } from 'react';
import { Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  NOTA_INTERNA_MAX_CARACTERES, NOTA_PUBLICA_MAX_CARACTERES, NOTA_PUBLICA_MIN_CARACTERES, ROTULO_TIPO,
  descricaoPaciente, mensagemErroChancela, tituloItem, validarRecusa, type ItemFilaChancela,
} from '@/lib/chancela';
import { recusarPlanoCliente } from '@/lib/chancelaApi';
import { avisarClienteDoPlano } from './avisarCliente';

// Recusar: o plano não chega ao cliente. A mensagem pública (curta) é mostrada
// ao cliente no portal; a nota interna fica só para a equipe.

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ItemFilaChancela;
  onRecusado: () => void;
}

export default function RecusarDialog({ open, onOpenChange, item, onRecusado }: Props) {
  const [notaPublica, setNotaPublica] = useState('');
  const [notaInterna, setNotaInterna] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNotaPublica('');
    setNotaInterna('');
    setErro(null);
  }, [open, item.id]);

  const validacao = validarRecusa(notaPublica, notaInterna);

  const confirmar = async () => {
    if (!validacao.ok || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      await recusarPlanoCliente({ id: item.id, notaPublica, notaInterna });
      toast.success('Plano recusado. O cliente vê a sua mensagem e pode gerar de novo ou procurar um profissional.');
      avisarClienteDoPlano(item.id);
      onRecusado();
      onOpenChange(false);
    } catch (e) {
      setErro(mensagemErroChancela(e).mensagem);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!enviando) onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-600 shrink-0" /> Recusar {ROTULO_TIPO[item.tipo].toLowerCase()}
          </DialogTitle>
          <DialogDescription>
            {tituloItem(item)} · {descricaoPaciente(item)}. O cliente não verá o plano; verá apenas a sua mensagem.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          <Label htmlFor="recusa-nota-publica" className="text-xs">Mensagem ao cliente (obrigatória)</Label>
          <Textarea
            id="recusa-nota-publica"
            rows={3}
            value={notaPublica}
            maxLength={NOTA_PUBLICA_MAX_CARACTERES}
            onChange={(e) => setNotaPublica(e.target.value)}
            placeholder="Ex.: O plano pede ajuste que só uma avaliação presencial permite. Procure um profissional."
            className="text-sm"
            disabled={enviando}
          />
          <p className="text-[10px] text-muted-foreground">
            O cliente lê esta mensagem. Escreva com acolhimento, sem termos técnicos nem dados clínicos sensíveis
            ({notaPublica.trim().length}/{NOTA_PUBLICA_MAX_CARACTERES}; mínimo {NOTA_PUBLICA_MIN_CARACTERES}).
          </p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="recusa-nota-interna" className="text-xs">Nota interna (opcional, só a equipe vê)</Label>
          <Textarea
            id="recusa-nota-interna"
            rows={2}
            value={notaInterna}
            maxLength={NOTA_INTERNA_MAX_CARACTERES}
            onChange={(e) => setNotaInterna(e.target.value)}
            placeholder="Motivo técnico, para a equipe."
            className="text-sm"
            disabled={enviando}
          />
        </div>

        {erro && <p role="alert" className="text-xs text-red-700 dark:text-red-300">{erro}</p>}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enviando}>Cancelar</Button>
          <Button variant="destructive" onClick={() => void confirmar()} disabled={!validacao.ok || enviando} className="gap-1.5">
            {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
            Recusar plano
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
