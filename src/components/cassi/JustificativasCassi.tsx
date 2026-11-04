import { useId, useRef, useState } from 'react';
import { ChevronDown, Copy, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  assinaturaDe, codigosParaJustificar, contarCaracteres, contarMusculos, INFO_CODIGO, LIMITE_CARACTERES, limparTextoJustificativa,
  MAX_ACHADOS, MAX_MUSCULOS, motivoSemGerar, musculosForaDoTexto, textoDesatualizado, type CodigoJustificavel, type JustificativaPronta,
  type TextoGerado, type TextosGerados,
} from '@/lib/cassiJustificativa';

export type { TextoGerado, TextosGerados };

// A função responde erro com status 4xx/5xx e corpo { error }; o client do Supabase esconde o corpo em `context`.
async function mensagemDoErro(e: unknown): Promise<string> {
  const contexto = (e as { context?: unknown } | null)?.context;
  if (contexto instanceof Response) {
    try {
      const corpo = await contexto.clone().json() as { error?: unknown };
      if (typeof corpo?.error === 'string' && corpo.error.trim()) return corpo.error.trim();
    } catch {
      // corpo que não é JSON: cai na mensagem padrão abaixo
    }
  }
  return e instanceof Error && e.message ? e.message : 'Não consegui gerar a justificativa agora. Tente de novo.';
}

// Justificativa clínica dos códigos 301 e 131 no pedido de guia. Rascunho gerado por IA a partir do diagnóstico (basta ele),
// dos músculos e dos achados do exame (ambos opcionais): sem músculos, a IA sugere os do diagnóstico e preenche o campo. O
// profissional confere, edita e copia para o portal da CASSI, que limita a 500 caracteres.
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
  const motivo = motivoSemGerar({ diagnostico, codigos });
  const marcaOs301 = paraGerar.includes('301');
  const musculosAgora = useRef(musculos);
  musculosAgora.current = musculos;
  const musculosDaIA = textos['301']?.musculosIA ?? '';
  const sugestaoNoCampo = marcaOs301 && musculosDaIA !== '' && musculos.trim() === musculosDaIA;
  const temTexto = paraGerar.some((c) => textos[c]);

  const gerar = async () => {
    if (motivo || gerando) return;
    const musculosEnviados = musculos.trim();
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
      const resposta = data as {
        error?: string;
        justificativas?: Partial<Record<CodigoJustificavel, JustificativaPronta>>;
        musculos_sugeridos?: string;
      } | null;
      if (resposta?.error) throw new Error(resposta.error);
      // Sem músculos informados, o 301 foi escrito com os que a IA sugeriu: eles entram no campo (editável), a menos que o
      // profissional tenha digitado algo enquanto a IA trabalhava. Preenchido o campo, o texto nasce em dia com ele.
      const sugeridos = paraGerar.includes('301') && musculosEnviados === '' && typeof resposta?.musculos_sugeridos === 'string'
        ? limparTextoJustificativa(resposta.musculos_sugeridos)
        : '';
      const preencheu = sugeridos !== '' && musculosAgora.current.trim() === '';
      if (preencheu) onMusculos(sugeridos);
      const assinatura = assinaturaDe({ diagnostico, musculos: preencheu ? sugeridos : musculosEnviados, achados });
      const novos: TextosGerados = {};
      for (const c of paraGerar) {
        const j = resposta?.justificativas?.[c];
        if (j?.texto) {
          novos[c] = { texto: limparTextoJustificativa(j.texto), ajustado: !!j.ajustado, assinatura, editado: false };
          if (c === '301' && sugeridos !== '') novos[c]!.musculosIA = sugeridos;
          if (c === '301' && sugeridos === '' && musculosDaIA !== '' && musculosEnviados === musculosDaIA) novos[c]!.musculosIA = musculosDaIA;
        }
      }
      if (Object.keys(novos).length === 0) throw new Error('A IA não devolveu texto. Tente de novo.');
      onTextos(novos);
      if (paraGerar.includes('301') && musculosEnviados === '' && sugeridos === '') {
        toast.info('A IA não conseguiu sugerir músculos só pelo diagnóstico. Informe os músculos tratados e gere de novo.');
      }
      setAnuncio(preencheu ? 'Justificativas geradas. A IA sugeriu os músculos; confira o campo de músculos.' : 'Justificativas geradas.');
    } catch (e: unknown) {
      console.error('[cassi] falha ao gerar justificativa', e);
      toast.error(await mensagemDoErro(e));
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
              placeholder="Músculos (opcional: sem eles, a IA sugere)"
            />
            {marcaOs301 && musculos.trim() === '' && (
              <p className="text-[10px] text-muted-foreground">
                Sem músculos informados, a IA sugere os do diagnóstico para o 301 e preenche este campo. Confira antes de copiar.
              </p>
            )}
            {marcaOs301 && musculos.trim() !== '' && (
              <p className={cn('text-[10px]', sugestaoNoCampo ? 'font-medium text-amber-700' : 'text-muted-foreground')}>
                {sugestaoNoCampo && 'Músculos sugeridos pela IA a partir do diagnóstico: confira e ajuste. '}
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
            const desatualizado = textoDesatualizado(atual, { diagnostico, musculos, achados });
            const foraDoTexto = codigo === '301' ? musculosForaDoTexto(atual.texto, musculos) : [];
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
                {foraDoTexto.length > 0 && (
                  <p className="text-[10px] font-medium text-amber-700">
                    O texto do 301 não cita: {foraDoTexto.join(', ')}. O 301 é cobrado por músculo: ajuste o texto ou a lista de músculos antes de copiar.
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
