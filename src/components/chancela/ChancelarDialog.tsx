import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { JUSTIFICATIVA_MIN_CARACTERES, justificativaValida, type RevisaoNormalizada } from '@/lib/governanca';
import {
  NOTA_PUBLICA_MAX_CARACTERES, ROTULO_TIPO, descricaoPaciente, exigeJustificativa, mensagemErroChancela,
  tituloItem, validarChancela, type ItemFilaChancela, type SituacaoRevisao,
} from '@/lib/chancela';
import { chancelarPlanoCliente, revisarSegurancaPlanoCliente } from '@/lib/chancelaApi';
import { avisarClienteDoPlano } from './avisarCliente';

// Chancelar: a equipe científica atesta o plano. Ao abrir, a janela roda a revisão de
// segurança (IA) da versão atual e o botão só libera com revisão VÁLIDA (gravada no plano).
// Se a IA falhar, só dá para chancelar com o motivo escrito (15+ caracteres), que o banco
// registra como `motivo_sem_revisao`. O banco carimba quem chancelou, o perfil, a data, a
// versão e o hash, e confere tudo de novo: o front só guia.

type Fase = 'revisando' | 'valida' | 'falhou';

const MAX_FLAGS_VISIVEIS = 5;
const ROTULO_SEVERIDADE = { alta: 'Alta', media: 'Média', baixa: 'Baixa' } as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ItemFilaChancela;
  pode: boolean;
  onChancelado: () => void;
  /** A revisão desta versão foi gravada no plano: a fila pode recarregar. */
  onRevisado?: () => void;
}

function mensagemNaoRegistrada(motivo: string | null): string {
  if (motivo === 'plano_alterado') return 'O plano mudou durante a revisão, então ela não foi registrada.';
  return 'A revisão rodou, mas não foi possível registrá-la no plano.';
}

export default function ChancelarDialog({ open, onOpenChange, item, pode, onChancelado, onRevisado }: Props) {
  const [fase, setFase] = useState<Fase>('revisando');
  const [revisao, setRevisao] = useState<RevisaoNormalizada | null>(null);
  const [erroRevisao, setErroRevisao] = useState<string | null>(null);
  const [justificativa, setJustificativa] = useState('');
  const [notaPublica, setNotaPublica] = useState('');
  const [exigidaPeloBanco, setExigidaPeloBanco] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const requisicao = useRef(0);
  const onRevisadoRef = useRef(onRevisado);
  onRevisadoRef.current = onRevisado;

  const revisar = useCallback(async () => {
    const minha = ++requisicao.current;
    setFase('revisando');
    setRevisao(null);
    setErroRevisao(null);
    try {
      const r = await revisarSegurancaPlanoCliente({ id: item.id, tipo: item.tipo });
      if (minha !== requisicao.current) return;
      if (!r.persistida) {
        setErroRevisao(mensagemNaoRegistrada(r.motivoNaoPersistida));
        setFase('falhou');
        return;
      }
      setRevisao(r);
      setFase('valida');
      onRevisadoRef.current?.();
    } catch (e) {
      if (minha !== requisicao.current) return;
      setErroRevisao(e instanceof Error ? e.message : 'Não foi possível revisar agora.');
      setFase('falhou');
    }
  }, [item.id, item.tipo]);

  useEffect(() => {
    if (!open) return undefined;
    setJustificativa('');
    setNotaPublica('');
    setExigidaPeloBanco(false);
    setErro(null);
    if (pode) {
      void revisar();
    } else {
      setRevisao(null);
      setErroRevisao(null);
      setFase('falhou');
    }
    // Contador (não é nó do DOM): fechar ou trocar de plano invalida a revisão em andamento.
    const contador = requisicao;
    return () => {
      contador.current++;
    };
  }, [open, pode, revisar]);

  const situacao: SituacaoRevisao = fase === 'valida' && revisao
    ? {
      estado: 'valida', risco: revisao.risco_geral, nFlagsAltas: revisao.flags.filter((f) => f.severidade === 'alta').length,
      ...(revisao.planoTruncado ? { parcial: true } : {}),
    }
    : { estado: 'ausente', risco: null, nFlagsAltas: 0 };
  const revisando = fase === 'revisando';
  const validacao = validarChancela({ pode, revisao: situacao, revisando, justificativa, exigidaPeloBanco, notaPublica });
  const precisaJustificar = exigeJustificativa(situacao, exigidaPeloBanco);
  const justificativaOk = justificativaValida(justificativa);
  const faltam = Math.max(0, JUSTIFICATIVA_MIN_CARACTERES - justificativa.trim().length);
  const riscoAlto = situacao.risco === 'alto';
  const semRevisao = fase === 'falhou';
  const revisaoParcial = situacao.parcial === true;

  const rotuloJustificativa = (() => {
    if (semRevisao) return 'Motivo para chancelar sem a revisão de segurança (obrigatório)';
    if (riscoAlto) return 'Justificativa para chancelar com risco alto (obrigatória)';
    if (revisaoParcial) return 'Justificativa para chancelar com a revisão parcial (obrigatória)';
    if (precisaJustificar) return 'Justificativa (obrigatória)';
    return 'Justificativa (opcional)';
  })();

  const confirmar = async () => {
    if (!validacao.ok || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      await chancelarPlanoCliente({ id: item.id, justificativa, notaPublica });
      toast.success('Plano chancelado. O cliente já pode vê-lo no portal.');
      avisarClienteDoPlano(item.id);
      onChancelado();
      onOpenChange(false);
    } catch (e) {
      const lido = mensagemErroChancela(e);
      if (lido.exigeJustificativa) setExigidaPeloBanco(true);
      if (lido.exigeRevisao) {
        setErroRevisao('O banco não achou uma revisão de segurança válida para esta versão do plano.');
        setFase('falhou');
      }
      setErro(lido.mensagem);
    } finally {
      setEnviando(false);
    }
  };

  const flags = revisao?.flags ?? [];

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

        {revisando && (
          <div role="status" className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs">
            <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0 mt-0.5" aria-hidden />
            <p className="font-semibold">Rodando a revisão de segurança desta versão do plano (IA)… Pode levar alguns segundos.</p>
          </div>
        )}

        {fase === 'valida' && revisao && (
          <div
            className={riscoAlto
              ? 'space-y-1.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs dark:border-red-900 dark:bg-red-950/30'
              : 'space-y-1.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs dark:border-emerald-900 dark:bg-emerald-950/30'}
          >
            <p className="flex items-start gap-2 font-semibold">
              {riscoAlto
                ? <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" aria-hidden />
                : <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden />}
              <span>
                Revisão de segurança desta versão: risco {situacao.risco ?? 'não informado'}
                {situacao.nFlagsAltas > 0 ? ` · ${situacao.nFlagsAltas} alerta${situacao.nFlagsAltas > 1 ? 's' : ''} de severidade alta` : ''}
              </span>
            </p>
            {revisaoParcial && (
              <p role="alert" className="flex items-start gap-1.5 font-semibold text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
                Revisão parcial: o plano é longo e a IA avaliou só o início. Confira o restante e registre a justificativa.
              </p>
            )}
            {revisao.resumo && <p className="text-muted-foreground">{revisao.resumo}</p>}
            {flags.length > 0 && (
              <ul className="list-disc pl-5 space-y-0.5">
                {flags.slice(0, MAX_FLAGS_VISIVEIS).map((f, i) => (
                  <li key={`${f.titulo}-${i}`}>
                    <span className="font-semibold">{ROTULO_SEVERIDADE[f.severidade] ?? 'Baixa'}:</span> {f.titulo}
                  </li>
                ))}
                {flags.length > MAX_FLAGS_VISIVEIS && <li>e mais {flags.length - MAX_FLAGS_VISIVEIS} ponto(s) na tela do plano.</li>}
              </ul>
            )}
          </div>
        )}

        {semRevisao && (
          <div role="alert" className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-900 dark:bg-amber-950/30">
            <p className="flex items-start gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" aria-hidden />
              {pode ? 'Não foi possível fazer a revisão de segurança desta versão.' : 'Você não pode chancelar este plano.'}
            </p>
            {pode && (
              <>
                {erroRevisao && <p className="text-muted-foreground">{erroRevisao}</p>}
                <p className="text-muted-foreground">
                  Tente de novo. Se a IA continuar fora do ar, só dá para chancelar com o motivo escrito abaixo
                  (mínimo de {JUSTIFICATIVA_MIN_CARACTERES} caracteres); o plano fica registrado como chancelado sem revisão de segurança.
                </p>
                <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => void revisar()} disabled={enviando}>
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Tentar a revisão de novo
                </Button>
              </>
            )}
          </div>
        )}

        {!revisando && pode && (
          <div className="space-y-1">
            <Label htmlFor="chancela-justificativa" className="text-xs">{rotuloJustificativa}</Label>
            <Textarea
              id="chancela-justificativa"
              rows={3}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder={semRevisao
                ? 'Explique por que a revisão não foi feita e por que o plano pode ser chancelado assim mesmo.'
                : 'Explique por que o plano pode ser chancelado ou o que você ajustou.'}
              className="text-sm"
              disabled={enviando}
            />
            {precisaJustificar && (
              <p className={justificativaOk ? 'text-[10px] text-muted-foreground' : 'text-[10px] text-amber-700 dark:text-amber-300'}>
                {justificativaOk ? 'O texto fica registrado junto da chancela.' : `Escreva pelo menos mais ${faltam} caracteres.`}
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
        {!validacao.ok && validacao.motivo !== 'nota_publica' && validacao.motivo !== 'revisando' && !erro && (
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
