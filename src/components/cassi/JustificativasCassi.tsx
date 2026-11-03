import { useId, useState } from 'react';
import { ChevronDown, Copy, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  codigosParaJustificar, contarCaracteres, contarMusculos, INFO_CODIGO, LIMITE_CARACTERES, limparTextoJustificativa,
  MAX_ACHADOS, MAX_MUSCULOS, motivoSemGerar, type CodigoJustificavel, type JustificativaPronta,
} from '@/lib/cassiJustificativa';

/** Um texto gerado. `assinatura` guarda os dados com que ele nasceu; `editado` vira true quando o profissional mexe no texto. */
export interface TextoGerado { texto: string; ajustado: boolean; assinatura: string; editado: boolean }
export type TextosGerados = Partial<Record<CodigoJustificavel, TextoGerado>>;

const assinaturaDe = (d: { diagnostico: string; musculos: string; achados: string }) =>
  JSON.stringify([d.diagnostico.trim(), d.musculos.trim(), d.achados.trim()]);

// Justificativa clínica dos códigos 301 e 131 no pedido de guia. Rascunho gerado por IA a partir do diagnóstico, dos músculos
// e (opcional) dos achados do exame: o profissional confere, edita e copia para o portal da CASSI, que limita a 500 caracteres.
// Os textos moram no painel (props), para não se perderem ao trocar de aba, desmarcar ou reabrir o card.
export function JustificativasCassi({ nome, diagnostico, musculos, achados, codigos, textos, onTextos, onMusculos, onAchados, onSalvarBase }: {
  nome: string;
  diagnostico: string;
  musculos: string;
  achados: string;
  codigos: string[];
  textos: TextosGerados;
  onTextos: (textos: TextosGerados) => void;
  onMusculos: (valor: string) => void;
  onAchados: (valor: string) => void;
  /** Guarda diagnóstico, músculos e achados no cadastro antes de gerar (reaproveita no próximo pedido). Falhar não impede gerar. */
  onSalvarBase?: () => Promise<boolean> | boolean;
}) {
  const idMotivo = useId();
  const [aberto, setAberto] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [anuncio, setAnuncio] = useState('');
  const paraGerar = codigosParaJustificar(codigos);
  const motivo = motivoSemGerar({ diagnostico, musculos, codigos });
  const marcaOs301 = paraGerar.includes('301');
  const assinaturaAtual = assinaturaDe({ diagnostico, musculos, achados });
  const temTexto = paraGerar.some((c) => textos[c]);

  const gerar = async () => {
    if (motivo || gerando) return;
    const assinatura = assinaturaAtual;
    setGerando(true);
    setAnuncio('');
    try {
      try { await onSalvarBase?.(); } catch (e) {
        console.warn('[cassi] não consegui guardar os dados da justificativa no cadastro', e);
      }
      const { data, error } = await supabase.functions.invoke('gerar-justificativa-cassi', {
        body: { diagnostico, musculos, achados, codigos: paraGerar },
      });
      if (error) throw error;
      const resposta = data as { error?: string; justificativas?: Partial<Record<CodigoJustificavel, JustificativaPronta>> } | null;
      if (resposta?.error) throw new Error(resposta.error);
      const novos: TextosGerados = {};
      for (const c of paraGerar) {
        const j = resposta?.justificativas?.[c];
        if (j?.texto) novos[c] = { texto: limparTextoJustificativa(j.texto), ajustado: !!j.ajustado, assinatura, editado: false };
      }
      if (Object.keys(novos).length === 0) throw new Error('A IA não devolveu texto. Tente de novo.');
      onTextos(novos);
      setAnuncio('Justificativas geradas.');
    } catch (e: unknown) {
      console.error('[cassi] falha ao gerar justificativa', e);
      toast.error(e instanceof Error && e.message ? e.message : 'Não consegui gerar a justificativa agora. Tente de novo.');
    } finally {
      setGerando(false);
    }
  };

  const copiar = async (codigo: CodigoJustificavel) => {
    const limpo = limparTextoJustificativa(textos[codigo]?.texto ?? '');
    if (contarCaracteres(limpo) > LIMITE_CARACTERES) {
      toast.error(`O texto do ${codigo} passa de ${LIMITE_CARACTERES} caracteres. Encurte antes de copiar.`);
      return;
    }
    try {
      await navigator.clipboard.writeText(limpo);
      toast.success(`Justificativa do ${codigo} copiada`);
    } catch {
      toast.error('Não consegui copiar. Selecione o texto e copie manualmente.');
    }
  };

  return (
    <div className="rounded-md border border-border/50 bg-background/60">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-label={`Justificativa (301 e 131) de ${nome}`}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-[11px] font-semibold"
      >
        <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
        <span className="flex-1">Justificativa (301 e 131)</span>
        <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', aberto && 'rotate-180')} aria-hidden />
      </button>

      {aberto && (
        <div className="space-y-1.5 px-2 pb-2">
          <div className="space-y-0.5">
            <Input
              aria-label={`Músculos de ${nome}`}
              className="h-8 text-xs"
              maxLength={MAX_MUSCULOS}
              value={musculos}
              onChange={(e) => onMusculos(e.target.value)}
              placeholder="Músculos tratados (ex.: trapézio superior, romboides)"
            />
            {marcaOs301 && musculos.trim() !== '' && (
              <p className="text-[10px] text-muted-foreground">
                {contarMusculos(musculos)} músculo(s) citado(s). O 301 é cobrado por músculo: a quantidade deve bater com o pedido.
              </p>
            )}
          </div>
          <Textarea
            aria-label={`Achados do exame de ${nome}`}
            className="min-h-[52px] text-xs"
            rows={2}
            maxLength={MAX_ACHADOS}
            value={achados}
            onChange={(e) => onAchados(e.target.value)}
            placeholder="Achados do exame (opcional). Sem eles, o texto fala em indicação e não afirma achado."
          />

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              disabled={!!motivo || gerando}
              aria-describedby={motivo ? idMotivo : undefined}
              onClick={() => { void gerar(); }}
            >
              {gerando ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
              {temTexto ? 'Gerar de novo' : 'Gerar justificativas'}
              {paraGerar.length > 0 && ` (${paraGerar.join(', ')})`}
            </Button>
            {motivo && <p id={idMotivo} className="text-[10px] text-muted-foreground">{motivo}</p>}
          </div>
          <p role="status" className="sr-only">{anuncio}</p>

          {paraGerar.map((codigo) => {
            const atual = textos[codigo];
            if (!atual) return null;
            const total = contarCaracteres(atual.texto);
            const passou = total > LIMITE_CARACTERES;
            const desatualizado = !atual.editado && atual.assinatura !== assinaturaAtual;
            return (
              <div key={codigo} className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="flex-1 text-[11px] font-semibold">Código {INFO_CODIGO[codigo].oficial} ({INFO_CODIGO[codigo].nome})</span>
                  <span className={cn('text-[10px] tabular-nums', passou ? 'font-bold text-rose-600' : 'text-muted-foreground')}>
                    {total}/{LIMITE_CARACTERES}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1 px-3 text-[11px]"
                    aria-label={`Copiar justificativa do ${codigo}`}
                    disabled={desatualizado}
                    onClick={() => { void copiar(codigo); }}
                  >
                    <Copy className="h-3 w-3" aria-hidden /> Copiar
                  </Button>
                </div>
                <Textarea
                  aria-label={`Justificativa do código ${codigo} de ${nome}`}
                  className={cn('text-xs', passou && 'border-rose-400')}
                  rows={5}
                  value={atual.texto}
                  onChange={(e) => onTextos({ ...textos, [codigo]: { ...atual, texto: e.target.value, ajustado: false, editado: true } })}
                />
                {desatualizado && (
                  <p className="text-[10px] font-medium text-amber-700">
                    O diagnóstico, os músculos ou os achados mudaram depois que este texto foi gerado. Gere de novo (ou edite o texto) antes de copiar.
                  </p>
                )}
                {atual.ajustado && <p className="text-[10px] text-amber-700">Texto encurtado para caber em {LIMITE_CARACTERES} caracteres. Confira se ficou completo.</p>}
                {passou && <p className="text-[10px] text-rose-600">Passou de {LIMITE_CARACTERES} caracteres: a CASSI não aceita. Encurte antes de copiar.</p>}
              </div>
            );
          })}

          {temTexto && (
            <p className="text-[10px] text-muted-foreground">
              Rascunho gerado por IA. Confira se descreve o que você realmente avaliou antes de enviar à CASSI.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
