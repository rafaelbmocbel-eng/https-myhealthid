import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { JUSTIFICATIVA_MIN_CARACTERES, justificativaValida } from '@/lib/governanca';
import {
  NOTA_PUBLICA_MAX_CARACTERES, ROTULO_TIPO, descricaoPaciente, exigeJustificativa, mensagemErroChancela,
  tituloItem, validarChancela, type ItemFilaChancela, type SituacaoRevisao,
} from '@/lib/chancela';
import { chancelarPlanoCliente } from '@/lib/chancelaApi';

// Chancelar: a equipe científica atesta o plano. O banco carimba quem chancelou,
// o perfil, a data, a versão e o hash; risco alto exige justificativa, mesmo quando
// a revisão é de uma versão anterior (editar o plano não apaga o alerta). Sem revisão
// válida desta versão, o revisor precisa confirmar que chancela assim mesmo (fica
// registrado como "sem revisão").

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ItemFilaChancela;
  pode: boolean;
  revisao: SituacaoRevisao;
  onChancelado: () => void;
}

export default function ChancelarDialog({ open, onOpenChange, item, pode, revisao, onChancelado }: Props) {
  const [justificativa, setJustificativa] = useState('');
  const [notaPublica, setNotaPublica] = useState('');
  const [cienteSemRevisao, setCienteSemRevisao] = useState(false);
  const [exigidaPeloBanco, setExigidaPeloBanco] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setJustificativa('');
    setNotaPublica('');
    setCienteSemRevisao(false);
    setExigidaPeloBanco(false);
    setErro(null);
  }, [open, item.id, revisao.estado]);

  const validacao = validarChancela({ pode, revisao, justificativa, exigidaPeloBanco, cienteSemRevisao, notaPublica });
  const precisaJustificar = exigeJustificativa(revisao, exigidaPeloBanco);
  const justificativaOk = justificativaValida(justificativa);
  const faltam = Math.max(0, JUSTIFICATIVA_MIN_CARACTERES - justificativa.trim().length);
  const riscoAlto = revisao.risco === 'alto';

  const confirmar = async () => {
    if (!validacao.ok || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      await chancelarPlanoCliente({ id: item.id, justificativa, notaPublica });
      toast.success('Plano chancelado. O cliente já pode vê-lo no portal.');
      onChancelado();
      onOpenChange(false);
    } catch (e) {
      const { mensagem, exigeJustificativa: exige } = mensagemErroChancela(e);
      if (exige) setExigidaPeloBanco(true);
      setErro(mensagem);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!enviando) onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0" /> Chancelar {ROTULO_TIPO[item.tipo].toLowerCase()}
          </DialogTitle>
          <DialogDescription>
            {tituloItem(item)} · {descricaoPaciente(item)}. Ao chancelar, o plano passa a aparecer para o cliente com o selo da equipe científica MyHealthID e o seu nome.
          </DialogDescription>
        </DialogHeader>

        {revisao.estado === 'valida' && (
          <div
            className={riscoAlto
              ? 'flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs dark:border-red-900 dark:bg-red-950/30'
              : 'flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs dark:border-emerald-900 dark:bg-emerald-950/30'}
          >
            {riscoAlto
              ? <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" aria-hidden />
              : <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden />}
            <p className="font-semibold">
              Revisão de segurança desta versão: risco {revisao.risco ?? 'não informado'}
              {revisao.nFlagsAltas > 0 ? ` · ${revisao.nFlagsAltas} alerta${revisao.nFlagsAltas > 1 ? 's' : ''} de severidade alta` : ''}
            </p>
          </div>
        )}

        {revisao.estado !== 'valida' && (
          <div role="alert" className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-900 dark:bg-amber-950/30">
            <p className="flex items-start gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" aria-hidden />
              {revisao.estado === 'desatualizada'
                ? 'A revisão de segurança é de uma versão anterior deste plano.'
                : 'Este plano ainda não passou pela revisão de segurança.'}
            </p>
            <p className="text-muted-foreground">Feche esta janela e rode "Revisar segurança (IA)" para a versão atual, ou confirme abaixo.</p>
            <div className="flex items-start gap-2">
              <Checkbox
                id="chancela-ciente"
                checked={cienteSemRevisao}
                onCheckedChange={(v) => setCienteSemRevisao(v === true)}
                disabled={enviando}
              />
              <Label htmlFor="chancela-ciente" className="text-xs leading-snug font-normal">
                Estou ciente: chancelo sem revisão de segurança desta versão, e isso fica registrado no plano.
              </Label>
            </div>
          </div>
        )}

        {(precisaJustificar || revisao.estado === 'valida') && (
          <div className="space-y-1">
            <Label htmlFor="chancela-justificativa" className="text-xs">
              {precisaJustificar ? 'Justificativa para chancelar com risco alto (obrigatória)' : 'Justificativa (opcional)'}
            </Label>
            <Textarea
              id="chancela-justificativa"
              rows={3}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Explique por que o plano pode ser chancelado ou o que você ajustou."
              className="text-sm"
              disabled={enviando}
            />
            {precisaJustificar && (
              <p className={justificativaOk ? 'text-[10px] text-muted-foreground' : 'text-[10px] text-amber-700 dark:text-amber-300'}>
                {justificativaOk ? 'A justificativa fica registrada junto da chancela.' : `Escreva pelo menos mais ${faltam} caracteres.`}
              </p>
            )}
          </div>
        )}

        <div className="space-y-1">
          <Label htmlFor="chancela-nota-publica" className="text-xs">Recado ao cliente (opcional)</Label>
          <Textarea
            id="chancela-nota-publica"
            rows={2}
            value={notaPublica}
            maxLength={NOTA_PUBLICA_MAX_CARACTERES}
            onChange={(e) => setNotaPublica(e.target.value)}
            placeholder="Ex.: Plano revisado pela equipe. Procure um profissional para ajustes mais finos."
            className="text-sm"
            disabled={enviando}
          />
          <p className="text-[10px] text-muted-foreground">O cliente vê este recado. Não inclua dados clínicos sensíveis.</p>
        </div>

        {erro && <p role="alert" className="text-xs text-red-700 dark:text-red-300">{erro}</p>}
        {!validacao.ok && validacao.motivo !== 'nota_publica' && !erro && (
          <p className="text-[11px] text-muted-foreground">{validacao.erro}</p>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enviando}>Cancelar</Button>
          <Button onClick={() => void confirmar()} disabled={!validacao.ok || enviando} className="gap-1.5">
            {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
            Chancelar plano
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
