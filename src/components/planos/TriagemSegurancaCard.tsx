import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Check, ChevronRight, HeartHandshake, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  CHAVES_TRIAGEM, OPCOES_TRIAGEM, contarRespondidas, formatarDataBR, lerTriagemSalva, mesclarTriagem,
  montarTriagem, triagemCompleta, triagemPedeAtencao,
  type ChaveTriagem, type RespostasTriagem, type TriagemAutodeclarada, type ValorResposta,
} from '@/lib/governanca';

// Triagem de segurança autodeclarada: poucas perguntas que ajudam o sistema (e o
// profissional) a saber quando um plano precisa de cuidado extra. As respostas
// ficam em nutricao_anamnese.respostas.triagem — o card MESCLA com o que já existe
// na anamnese e nunca sobrescreve as outras respostas.
// O texto é acolhedor de propósito: nenhuma resposta é "errada" e nenhuma impede
// a pessoa de receber cuidado.

interface Props {
  pacienteId: string;
  /** Terapeuta do paciente; só é gravado se a anamnese ainda não existir. */
  terapeutaId?: string | null;
  defaultAberto?: boolean;
  onSalvo?: (triagem: TriagemAutodeclarada) => void;
  className?: string;
}

interface Pergunta {
  chave: ChaveTriagem;
  titulo: string;
  ajuda?: string;
}

const PERGUNTAS: Pergunta[] = [
  {
    chave: 'gestante_lactante',
    titulo: 'Você está grávida ou amamentando?',
    ajuda: 'Se isso não se aplica a você, é só marcar "Não".',
  },
  {
    chave: 'transtorno_alimentar',
    titulo: 'Você já teve, ou tem, algum transtorno alimentar (como anorexia, bulimia ou compulsão alimentar)?',
    ajuda: 'É um assunto delicado e você não precisa explicar. Saber disso só serve para o plano ser montado com mais cuidado.',
  },
  {
    chave: 'doenca_renal',
    titulo: 'Você tem alguma doença nos rins?',
  },
  {
    chave: 'diabetes_insulina',
    titulo: 'Você tem diabetes, ou usa insulina ou remédio para controlar o açúcar no sangue?',
  },
  {
    chave: 'cardio_pressao',
    titulo: 'Você tem algum problema no coração ou pressão alta?',
  },
  {
    chave: 'cirurgia_lesao_recente',
    titulo: 'Você fez alguma cirurgia ou teve alguma lesão importante recentemente?',
    ajuda: 'Pense nos últimos meses.',
  },
];

const ROTULO_OPCAO: Record<ValorResposta, string> = {
  sim: 'Sim',
  nao: 'Não',
  nao_sei: 'Não sei',
  prefiro_nao_dizer: 'Prefiro não dizer',
};

// Relê a anamnese e grava só a chave `triagem`, com checagem de concorrência: se a
// linha mudou entre a leitura e a gravação (ex.: a anamnese nutricional foi salva
// ao mesmo tempo), relê e mescla de novo em vez de sobrescrever.
async function salvarTriagemMesclando(
  pacienteId: string, triagem: TriagemAutodeclarada, terapeutaId?: string | null,
): Promise<void> {
  const sb = supabase as any;
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const { data: atual, error: erroLer } = await sb.from('nutricao_anamnese')
      .select('respostas, updated_at').eq('paciente_id', pacienteId).maybeSingle();
    if (erroLer) throw erroLer;

    const respostas = mesclarTriagem(atual?.respostas, triagem);
    const agora = new Date().toISOString();

    if (atual) {
      const { data: linhas, error } = await sb.from('nutricao_anamnese')
        .update({ respostas, updated_at: agora })
        .eq('paciente_id', pacienteId)
        .eq('updated_at', atual.updated_at)
        .select('paciente_id');
      if (error) throw error;
      if (Array.isArray(linhas) && linhas.length > 0) return;
      continue;
    }

    const { error } = await sb.from('nutricao_anamnese')
      .insert({ paciente_id: pacienteId, ...(terapeutaId ? { terapeuta_id: terapeutaId } : {}), respostas, updated_at: agora });
    if (!error) return;
    // 23505 = outra tela criou a linha no meio do caminho: relê e atualiza.
    if (error.code !== '23505') throw error;
  }
  throw new Error('As respostas foram alteradas ao mesmo tempo em outro lugar. Tente salvar de novo.');
}

export default function TriagemSegurancaCard({ pacienteId, terapeutaId, defaultAberto = false, onSalvo, className }: Props) {
  const [aberto, setAberto] = useState(defaultAberto);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [respostas, setRespostas] = useState<RespostasTriagem>({});
  const [respondidaEm, setRespondidaEm] = useState<string | null>(null);
  const [mensagemFinal, setMensagemFinal] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await (supabase as any).from('nutricao_anamnese')
      .select('respostas').eq('paciente_id', pacienteId).maybeSingle();
    if (!error) {
      const salva = lerTriagemSalva(data?.respostas);
      setRespostas(salva.respostas);
      setRespondidaEm(salva.respondidaEm);
    }
    setCarregando(false);
  }, [pacienteId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const respondidas = contarRespondidas(respostas);
  const completa = triagemCompleta(respostas);
  const jaRespondida = respondidaEm !== null && completa;

  const escolher = (chave: ChaveTriagem, valor: string) => {
    setMensagemFinal(null);
    setRespostas((prev) => ({ ...prev, [chave]: valor as ValorResposta }));
  };

  const salvar = async () => {
    if (!triagemCompleta(respostas)) return;
    setSalvando(true);
    try {
      const triagem = montarTriagem(respostas);
      await salvarTriagemMesclando(pacienteId, triagem, terapeutaId);
      setRespondidaEm(triagem.respondida_em);
      setMensagemFinal(
        triagemPedeAtencao(respostas)
          ? 'Obrigado por contar. Com essas respostas o plano pode ser montado com mais cuidado, e em alguns casos vamos pedir que um profissional acompanhe de perto.'
          : 'Obrigado! Suas respostas ajudam a manter o seu plano seguro.',
      );
      toast.success('Triagem de segurança salva');
      setAberto(false);
      onSalvo?.(triagem);
    } catch (e) {
      const msg = e instanceof Error ? e.message : (e as { message?: string } | null)?.message;
      toast.error(`Não consegui salvar agora${msg ? `: ${msg}` : ''}`);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Card className={cn('overflow-hidden', className)}>
      <button type="button" onClick={() => setAberto((v) => !v)} className="w-full text-left p-4 flex items-center gap-3" aria-expanded={aberto}>
        <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center shrink-0">
          {jaRespondida ? <Check className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold">Triagem de segurança</p>
          <p className="text-[11px] text-muted-foreground">
            {jaRespondida
              ? `Respondida${formatarDataBR(respondidaEm) ? ` em ${formatarDataBR(respondidaEm)}` : ''} — toque para revisar.`
              : 'Seis perguntas rápidas para o seu plano ser seguro para você.'}
          </p>
          {mensagemFinal && !aberto && <p className="text-[11px] text-sky-700 dark:text-sky-300 mt-1">{mensagemFinal}</p>}
        </div>
        <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition-transform', aberto && 'rotate-90')} aria-hidden />
      </button>

      {aberto && (
        <CardContent className="pt-0 space-y-4">
          <div className="flex items-start gap-2 rounded-xl border border-sky-500/20 bg-sky-500/5 p-3">
            <HeartHandshake className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" aria-hidden />
            <p className="text-xs text-foreground/85">
              Antes de montar um plano, queremos ter certeza de que ele é seguro para você. Responda com tranquilidade:
              não existe resposta errada, e marcar &quot;sim&quot; ou &quot;não sei&quot; não impede você de receber cuidado. Só
              significa que o plano vai contar com a atenção de um profissional.
            </p>
          </div>

          {carregando ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2" role="status">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando suas respostas…
            </div>
          ) : (
            PERGUNTAS.map((p, idx) => (
              <fieldset key={p.chave} className="space-y-2">
                <legend className="text-sm font-medium leading-snug">
                  <span className="text-muted-foreground mr-1">{idx + 1}.</span>
                  {p.titulo}
                </legend>
                {p.ajuda && <p className="text-[11px] text-muted-foreground">{p.ajuda}</p>}
                <RadioGroup
                  value={respostas[p.chave] ?? ''}
                  onValueChange={(v) => escolher(p.chave, v)}
                  className="grid-cols-2 sm:grid-cols-3"
                  aria-label={p.titulo}
                >
                  {OPCOES_TRIAGEM[p.chave].map((valor) => {
                    const id = `triagem-${p.chave}-${valor}`;
                    const marcado = respostas[p.chave] === valor;
                    return (
                      <Label
                        key={valor}
                        htmlFor={id}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm cursor-pointer transition-colors',
                          marcado ? 'border-sky-500 bg-sky-500/10' : 'border-border hover:bg-muted/40',
                        )}
                      >
                        <RadioGroupItem id={id} value={valor} />
                        {ROTULO_OPCAO[valor]}
                      </Label>
                    );
                  })}
                </RadioGroup>
              </fieldset>
            ))
          )}

          <div className="space-y-1.5">
            <Button onClick={() => void salvar()} disabled={!completa || salvando || carregando} className="w-full gap-1.5">
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Salvar triagem
            </Button>
            {!completa && !carregando && (
              <p className="text-[11px] text-muted-foreground text-center">
                {respondidas} de {CHAVES_TRIAGEM.length} respondidas — responda todas para salvar.
              </p>
            )}
            <p className="text-[10px] text-muted-foreground text-center italic">
              Estas respostas não substituem uma avaliação com profissional de saúde.
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
