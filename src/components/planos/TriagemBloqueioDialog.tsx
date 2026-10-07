import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, ShieldAlert, ClipboardList } from 'lucide-react';
import {
  JUSTIFICATIVA_MIN_CARACTERES, rotuloOrigemTriagem, validarOverride,
  type BloqueioTriagem, type ChamadorPlano, type OverrideTriagem,
} from '@/lib/governanca';

// Mostra por que a geração do plano foi parada pela triagem de segurança.
//  - Profissional: vê os motivos e decide. 'bloqueia' pede justificativa;
//    'confirmar' pede a confirmação de ciência. Nada é gerado sem esse gesto.
//  - Cliente: só recebe a orientação de falar com o profissional (e, se houver,
//    o caminho para completar a triagem). Cliente nunca sobrepõe a triagem.
// As regras da triagem são provisórias, em validação por profissionais.

interface Props {
  /** Resposta `bloqueio` da edge. null/undefined = diálogo fechado. */
  bloqueio: BloqueioTriagem | null | undefined;
  chamador: ChamadorPlano;
  onCancelar: () => void;
  onProsseguir: (override: OverrideTriagem) => void;
  /** Cliente: abre o questionário de triagem de segurança. */
  onAbrirTriagem?: () => void;
  /** Desabilita os botões enquanto o pedido com override está em andamento. */
  enviando?: boolean;
}

const MENSAGEM_RECUSA: Record<NonNullable<BloqueioTriagem['override_recusado']>, string> = {
  justificativa_curta: `O servidor não aceitou a justificativa: ela precisa ter pelo menos ${JUSTIFICATIVA_MIN_CARACTERES} caracteres.`,
  ciente_ausente: 'O servidor não recebeu a confirmação de ciência. Marque a caixa e tente de novo.',
};

export default function TriagemBloqueioDialog({ bloqueio, chamador, onCancelar, onProsseguir, onAbrirTriagem, enviando = false }: Props) {
  const [justificativa, setJustificativa] = useState('');
  const [ciente, setCiente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setJustificativa('');
    setCiente(false);
    setErro(null);
  }, [bloqueio]);

  const aberto = !!bloqueio;
  const nivel = bloqueio?.nivel ?? 'confirmar';
  const motivos = bloqueio?.motivos ?? [];
  const ehProfissional = chamador === 'profissional' && bloqueio?.pode_prosseguir_profissional !== false;
  const exigeJustificativa = nivel === 'bloqueia';
  const justificativaOk = justificativa.trim().length >= JUSTIFICATIVA_MIN_CARACTERES;
  const podeEnviar = ehProfissional && ciente && (!exigeJustificativa || justificativaOk) && !enviando;
  const faltam = Math.max(0, JUSTIFICATIVA_MIN_CARACTERES - justificativa.trim().length);

  const prosseguir = () => {
    const r = validarOverride(nivel, { justificativa, ciente }, chamador);
    if ('override' in r) {
      setErro(null);
      onProsseguir(r.override);
      return;
    }
    setErro(r.erro);
  };

  const fechar = (open: boolean) => {
    if (!open && !enviando) onCancelar();
  };

  const listaMotivos = (
    <ul className="space-y-2" aria-label="Pontos identificados pela triagem">
      {motivos.map((m) => (
        <li
          key={m.codigo}
          className={
            m.nivel === 'bloqueia'
              ? 'rounded-md border border-red-200 bg-red-50 p-2.5 dark:border-red-900 dark:bg-red-950/30'
              : 'rounded-md border border-amber-200 bg-amber-50 p-2.5 dark:border-amber-900 dark:bg-amber-950/30'
          }
        >
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className="text-xs font-semibold">{m.rotulo}</span>
            {ehProfissional && (
              <Badge variant={m.nivel === 'bloqueia' ? 'danger' : 'warning'} size="xs">
                {m.nivel === 'bloqueia' ? 'Bloqueia' : 'Confirmar'}
              </Badge>
            )}
          </div>
          {m.detalhe && <p className="text-xs text-foreground/85">{m.detalhe}</p>}
          {ehProfissional && m.origem && (
            <p className="text-[10px] text-muted-foreground mt-0.5">Origem: {rotuloOrigemTriagem(m.origem)}</p>
          )}
        </li>
      ))}
    </ul>
  );

  if (!ehProfissional) {
    return (
      <Dialog open={aberto} onOpenChange={fechar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary shrink-0" /> Vamos cuidar disso com o seu profissional
            </DialogTitle>
            <DialogDescription>
              Para a sua segurança, este plano precisa da atenção de um profissional antes de ser gerado. Isso não é um
              problema com você: é só o cuidado que um plano de saúde merece.
            </DialogDescription>
          </DialogHeader>
          {motivos.length > 0 && listaMotivos}
          <p className="text-sm">Fale com o seu profissional. Ele pode avaliar o seu caso e montar o plano junto com você.</p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={onCancelar}>Entendi</Button>
            {onAbrirTriagem && (
              <Button onClick={onAbrirTriagem} className="gap-1.5">
                <ClipboardList className="h-4 w-4" /> Abrir a triagem de segurança
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={aberto} onOpenChange={fechar}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className={nivel === 'bloqueia' ? 'h-5 w-5 text-red-600 shrink-0' : 'h-5 w-5 text-amber-600 shrink-0'} />
            {nivel === 'bloqueia' ? 'Geração bloqueada pela triagem' : 'Confirme antes de gerar o plano'}
          </DialogTitle>
          <DialogDescription>
            {nivel === 'bloqueia'
              ? 'Pelas regras de segurança do sistema, este plano não deveria ser gerado automaticamente. Só prossiga se você, como profissional, assumir essa decisão e registrar o motivo.'
              : 'A triagem encontrou pontos que pedem a sua atenção. Revise e confirme se quer gerar o plano mesmo assim.'}
          </DialogDescription>
        </DialogHeader>

        {listaMotivos}

        {bloqueio?.override_recusado && (
          <p role="alert" className="text-xs text-red-700 dark:text-red-300">{MENSAGEM_RECUSA[bloqueio.override_recusado]}</p>
        )}

        {exigeJustificativa ? (
          <div className="space-y-1">
            <Label htmlFor="triagem-justificativa" className="text-xs">Justificativa (obrigatória)</Label>
            <Textarea
              id="triagem-justificativa"
              rows={3}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Explique por que é seguro ou necessário gerar o plano neste caso."
              className="text-sm"
              disabled={enviando}
            />
            <p className={justificativaOk ? 'text-[10px] text-muted-foreground' : 'text-[10px] text-amber-700 dark:text-amber-300'}>
              {justificativaOk ? 'Justificativa registrada junto do plano.' : `Escreva pelo menos mais ${faltam} caracteres.`}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <Label htmlFor="triagem-observacao" className="text-xs">Observação (opcional)</Label>
            <Textarea
              id="triagem-observacao"
              rows={2}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Ex.: condição acompanhada, liberada pelo médico…"
              className="text-sm"
              disabled={enviando}
            />
          </div>
        )}

        <div className="flex items-start gap-2">
          <Checkbox
            id="triagem-ciente"
            checked={ciente}
            onCheckedChange={(v) => setCiente(v === true)}
            disabled={enviando}
            className="mt-0.5"
          />
          <Label htmlFor="triagem-ciente" className="text-xs leading-snug cursor-pointer">
            Estou ciente dos pontos acima e assumo a decisão clínica de gerar este plano.
          </Label>
        </div>

        {erro && <p role="alert" className="text-xs text-red-700 dark:text-red-300">{erro}</p>}

        <p className="text-[10px] italic text-muted-foreground">
          Regras de triagem provisórias, em validação por profissionais. O plano gerado continua em rascunho até a sua liberação.
        </p>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancelar} disabled={enviando}>Cancelar</Button>
          <Button onClick={prosseguir} disabled={!podeEnviar} variant={nivel === 'bloqueia' ? 'destructive' : 'default'}>
            {nivel === 'bloqueia' ? 'Gerar mesmo assim' : 'Gerar plano'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
