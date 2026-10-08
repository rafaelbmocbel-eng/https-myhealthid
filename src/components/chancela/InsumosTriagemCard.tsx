import { AlertTriangle, CheckCircle2, ClipboardList, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  formatarDataBR, lerGovernanca, resumoParametros, rotuloNivelTriagem, rotuloOrigemTriagem, semParametrosConfirmados,
} from '@/lib/governanca';
import { insumosDoPlano } from '@/lib/chancela';

// O que o revisor precisa saber antes de chancelar: com quais dados a IA montou
// o plano (insumos), o que a triagem de segurança apontou e quais parâmetros
// padrão ainda estão sem fonte confirmada. Lido do `_governanca` do conteúdo.

export default function InsumosTriagemCard({ conteudo }: { conteudo: unknown }) {
  const gov = lerGovernanca(conteudo);

  if (!gov) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs dark:border-amber-900 dark:bg-amber-950/30" role="note">
        <p className="flex items-start gap-2 font-semibold">
          <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" aria-hidden />
          Este plano não traz o registro de governança (insumos e triagem). Revise com mais cuidado.
        </p>
      </div>
    );
  }

  const insumos = insumosDoPlano(gov);
  const triagem = gov.triagem;
  const motivos = triagem?.motivos ?? [];
  const parametros = resumoParametros(gov);
  const geradoEm = formatarDataBR(gov.fonte?.gerado_em ?? null);

  return (
    <section aria-label="Insumos e triagem" className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-3 text-xs">
      <div className="flex items-center gap-1.5 font-semibold">
        <ClipboardList className="h-4 w-4 text-primary" aria-hidden /> Insumos e triagem do plano
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Dados usados pela IA</p>
        {insumos.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {insumos.map((i) => <Badge key={i} variant="neutral" size="md">{i}</Badge>)}
          </div>
        ) : (
          <p className="text-muted-foreground">O registro não lista os insumos.</p>
        )}
        {gov.fonte && (
          <p className="text-[11px] text-muted-foreground mt-1">
            {[gov.fonte.modelo && `Modelo: ${gov.fonte.modelo}`, gov.fonte.prompt_versao && `prompt ${gov.fonte.prompt_versao}`, geradoEm && `gerado em ${geradoEm}`]
              .filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Triagem de segurança</p>
        {!triagem && <p className="text-muted-foreground">Sem registro de triagem neste plano.</p>}
        {triagem && motivos.length === 0 && (
          <p className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> {rotuloNivelTriagem(triagem.nivel)}: nenhum fator de atenção apontado.
          </p>
        )}
        {triagem && motivos.length > 0 && (
          <ul className="space-y-1.5">
            {motivos.map((m) => (
              <li key={m.codigo} className="rounded-md border border-amber-200 bg-amber-50/70 p-2 dark:border-amber-900 dark:bg-amber-950/30">
                <p className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" aria-hidden />
                  {m.rotulo}
                  <span className="text-[10px] uppercase text-muted-foreground">{m.nivel === 'bloqueia' ? 'bloqueio' : 'confirmar'}</span>
                </p>
                {m.detalhe && <p className="text-muted-foreground mt-0.5">{m.detalhe}</p>}
                {m.origem && <p className="text-[10px] text-muted-foreground">Origem: {rotuloOrigemTriagem(m.origem)}</p>}
              </li>
            ))}
          </ul>
        )}
        {triagem?.override && (
          <p className="mt-1 text-amber-700 dark:text-amber-300 flex items-start gap-1">
            <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" aria-hidden />
            A triagem foi sobreposta na geração deste plano. Um plano de cliente não deveria ter sobreposição: revise com atenção.
          </p>
        )}
      </div>

      {semParametrosConfirmados(gov) && (
        <p className="text-[11px] text-muted-foreground">
          Os parâmetros padrão usados na geração ({parametros.aConfirmar}) ainda estão a confirmar: sem fonte validada. Confira os valores do plano.
        </p>
      )}
    </section>
  );
}
