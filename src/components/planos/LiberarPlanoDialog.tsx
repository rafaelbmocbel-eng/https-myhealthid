import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, CheckCircle2, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { erroDaFuncao } from '@/lib/fnError';
import { registrarNotaPlanoLiberado } from '@/utils/notaPlanoLiberado';
import {
  JUSTIFICATIVA_MIN_CARACTERES, justificativaValida, lerGovernanca, mensagemErroLiberacao, normalizarRevisao,
  type RevisaoNormalizada, type SeveridadeFlag, type TipoPlanoGov,
} from '@/lib/governanca';

// Liberar um plano ao paciente. Ao abrir, roda a revisão de segurança (IA) sobre o
// plano SALVO; com risco alto a liberação exige justificativa do profissional. Se a
// revisão falhar, libera mesmo assim, avisando que fica sem revisão registrada.
// A liberação em si é o RPC liberar_plano: o banco carimba quem liberou, quando e
// a versão — o front não grava aprovação.

interface Props {
  tipo: TipoPlanoGov;
  planoId: string;
  pacienteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLiberado: () => void;
  /** Resultado de usePodeChancelar(...).pode. Padrão: true (o banco ainda confere). */
  podeLiberar?: boolean;
  /** Motivo exibido quando podeLiberar = false. */
  motivoBloqueio?: string;
  /** Dono do plano (registro no prontuário). Padrão: o usuário logado. */
  terapeutaId?: string | null;
  /** Título do plano, usado na nota do prontuário. */
  tituloPlano?: string | null;
}

type Fase = 'revisando' | 'pronto' | 'falhou';

const TABELA: Record<TipoPlanoGov, 'planos_treino' | 'planos_alimentares'> = {
  treino: 'planos_treino',
  nutricao: 'planos_alimentares',
};
const ROTULO: Record<TipoPlanoGov, string> = { treino: 'plano de treino', nutricao: 'plano alimentar' };
const PRAZO_REVISAO_MS = 90_000;

const SEV: Record<SeveridadeFlag, { cor: string; bg: string; borda: string; rotulo: string }> = {
  alta: { cor: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-900/20', borda: 'border-red-200 dark:border-red-800', rotulo: 'Alta' },
  media: { cor: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-900/20', borda: 'border-amber-200 dark:border-amber-800', rotulo: 'Média' },
  baixa: { cor: 'text-slate-600 dark:text-slate-300', bg: 'bg-muted/40', borda: 'border-border', rotulo: 'Baixa' },
};

function comPrazo<T>(promessa: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('A revisão automática demorou demais para responder.')), ms);
    promessa.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

export default function LiberarPlanoDialog({
  tipo, planoId, pacienteId, open, onOpenChange, onLiberado,
  podeLiberar = true, motivoBloqueio, terapeutaId, tituloPlano,
}: Props) {
  const { user } = useAuth();
  const [fase, setFase] = useState<Fase>('revisando');
  const [revisao, setRevisao] = useState<RevisaoNormalizada | null>(null);
  const [erroRevisao, setErroRevisao] = useState<string | null>(null);
  const [justificativa, setJustificativa] = useState('');
  const [exigeJustificativaDoBanco, setExigeJustificativaDoBanco] = useState(false);
  const [liberando, setLiberando] = useState(false);
  const [erroLiberar, setErroLiberar] = useState<string | null>(null);
  const requisicao = useRef(0);

  const revisar = useCallback(async () => {
    const minha = ++requisicao.current;
    setFase('revisando');
    setRevisao(null);
    setErroRevisao(null);
    try {
      const { data, error } = await comPrazo(
        supabase.functions.invoke('revisar-plano-seguranca', { body: { paciente_id: pacienteId, tipo, plano_id: planoId } }),
        PRAZO_REVISAO_MS,
      );
      if (error) throw await erroDaFuncao(error);
      const corpo = data as { error?: string } | null;
      if (corpo?.error) throw new Error(corpo.error);
      const r = normalizarRevisao(data);
      if (!r) throw new Error('A revisão automática não retornou um resultado válido.');
      if (minha !== requisicao.current) return;
      setRevisao(r);
      setFase('pronto');
    } catch (e) {
      if (minha !== requisicao.current) return;
      setErroRevisao(e instanceof Error ? e.message : 'Não foi possível revisar agora.');
      setFase('falhou');
    }
  }, [pacienteId, tipo, planoId]);

  useEffect(() => {
    if (!open || !planoId) return undefined;
    setJustificativa('');
    setExigeJustificativaDoBanco(false);
    setErroLiberar(null);
    if (podeLiberar) {
      void revisar();
    } else {
      setFase('pronto');
      setRevisao(null);
    }
    // Contador (não é nó do DOM): fechar ou trocar de plano invalida a revisão em andamento.
    const contador = requisicao;
    return () => {
      contador.current++;
    };
  }, [open, planoId, podeLiberar, revisar]);

  const riscoAlto = revisao?.risco_geral === 'alto';
  const exigeJustificativa = riscoAlto || exigeJustificativaDoBanco;
  const justificativaOk = justificativaValida(justificativa);
  const faltam = Math.max(0, JUSTIFICATIVA_MIN_CARACTERES - justificativa.trim().length);
  const podeConfirmar = podeLiberar && fase !== 'revisando' && !liberando && (!exigeJustificativa || justificativaOk);

  const confirmar = async () => {
    if (!podeConfirmar) return;
    setLiberando(true);
    setErroLiberar(null);
    try {
      const texto = justificativa.trim();
      const { data, error } = await (supabase as any).rpc('liberar_plano', {
        p_tabela: TABELA[tipo],
        p_id: planoId,
        p_justificativa: texto || null,
      });
      if (error) {
        const { mensagem, exigeJustificativa: exige } = mensagemErroLiberacao(error);
        if (exige) setExigeJustificativaDoBanco(true);
        setErroLiberar(mensagem);
        return;
      }

      const aprovacao = lerGovernanca({ _governanca: data })?.aprovacao ?? null;
      const dono = terapeutaId || user?.id || '';
      const notaOk = await registrarNotaPlanoLiberado({
        pacienteId,
        terapeutaId: dono,
        area: tipo,
        titulo: tituloPlano,
        planoId,
        dadosExtras: {
          versao: aprovacao?.versao ?? null,
          risco_geral: aprovacao?.risco_geral ?? revisao?.risco_geral ?? null,
          sem_revisao: aprovacao?.sem_revisao ?? fase !== 'pronto',
          justificativa: texto || null,
        },
      });
      toast.success('Liberado para o paciente');
      if (!notaOk) toast.warning('O plano foi liberado, mas não consegui registrar a nota no prontuário.');
      onLiberado();
      onOpenChange(false);
    } catch (e) {
      setErroLiberar(mensagemErroLiberacao(e).mensagem);
    } finally {
      setLiberando(false);
    }
  };

  const flags = revisao?.flags ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!liberando) onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0" /> Liberar {ROTULO[tipo]} ao paciente
          </DialogTitle>
          <DialogDescription>
            Antes de liberar, o sistema faz uma revisão automática de segurança (IA). Ela apoia a sua decisão e não substitui o seu julgamento clínico.
          </DialogDescription>
        </DialogHeader>

        {!podeLiberar && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-900 dark:bg-amber-950/30">
            <Lock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p>{motivoBloqueio || 'Você não tem permissão para liberar este plano.'}</p>
          </div>
        )}

        {podeLiberar && fase === 'revisando' && (
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" /> Revisando a segurança do plano…
          </div>
        )}

        {podeLiberar && fase === 'falhou' && (
          <div role="alert" className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-900 dark:bg-amber-950/30">
            <p className="flex items-start gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              Revisão automática indisponível — liberando sem revisão registrada
            </p>
            {erroRevisao && <p className="text-muted-foreground">{erroRevisao}</p>}
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => void revisar()} disabled={liberando}>
              Tentar revisar de novo
            </Button>
          </div>
        )}

        {podeLiberar && fase === 'pronto' && revisao && (
          <div className="space-y-2">
            <div
              className={
                riscoAlto
                  ? 'flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30'
                  : flags.length > 0
                    ? 'flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30'
                    : 'flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30'
              }
            >
              {flags.length === 0
                ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                : <AlertTriangle className={riscoAlto ? 'h-4 w-4 text-red-600 shrink-0 mt-0.5' : 'h-4 w-4 text-amber-600 shrink-0 mt-0.5'} />}
              <div className="min-w-0 space-y-0.5">
                <p className="text-xs font-semibold">
                  {flags.length === 0
                    ? 'Revisão de segurança: sem pontos críticos'
                    : `Revisão de segurança: ${flags.length} ponto${flags.length > 1 ? 's' : ''} de atenção`}
                  <span className="ml-2 text-[10px] font-bold uppercase">risco {revisao.risco_geral}</span>
                </p>
                <p className="text-xs text-foreground/85">{revisao.resumo}</p>
              </div>
            </div>

            {flags.map((f, i) => {
              const s = SEV[f.severidade];
              return (
                <div key={`${f.titulo}-${i}`} className={`rounded-md border ${s.borda} ${s.bg} p-2.5`}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] font-bold uppercase ${s.cor}`}>{s.rotulo}</span>
                    <span className="text-xs font-semibold">{f.titulo}</span>
                    {f.onde && <span className="text-[10px] text-muted-foreground ml-auto">{f.onde}</span>}
                  </div>
                  {f.descricao && <p className="text-xs text-foreground/85">{f.descricao}</p>}
                  {f.sugestao && <p className="text-[11px] text-muted-foreground mt-1"><span className="font-semibold">Sugestão:</span> {f.sugestao}</p>}
                </div>
              );
            })}

            {revisao.planoTruncado && (
              <p className="text-[11px] text-amber-700 dark:text-amber-300">O plano é muito longo: a revisão foi parcial.</p>
            )}
            {!revisao.persistida && (
              <p className="text-[11px] text-muted-foreground">
                Esta revisão não ficou registrada no plano; a liberação será gravada sem revisão registrada.
              </p>
            )}
          </div>
        )}

        {podeLiberar && fase !== 'revisando' && exigeJustificativa && (
          <div className="space-y-1">
            <Label htmlFor="liberar-justificativa" className="text-xs">
              Justificativa para liberar com risco alto (obrigatória)
            </Label>
            <Textarea
              id="liberar-justificativa"
              rows={3}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Explique por que o plano pode ser liberado ou o que você ajustou."
              className="text-sm"
              disabled={liberando}
            />
            <p className={justificativaOk ? 'text-[10px] text-muted-foreground' : 'text-[10px] text-amber-700 dark:text-amber-300'}>
              {justificativaOk ? 'A justificativa fica registrada junto da liberação.' : `Escreva pelo menos mais ${faltam} caracteres.`}
            </p>
          </div>
        )}

        {erroLiberar && <p role="alert" className="text-xs text-red-700 dark:text-red-300">{erroLiberar}</p>}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={liberando}>Cancelar</Button>
          <Button onClick={() => void confirmar()} disabled={!podeConfirmar} className="gap-1.5">
            {liberando && <Loader2 className="h-4 w-4 animate-spin" />}
            Liberar para o paciente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
