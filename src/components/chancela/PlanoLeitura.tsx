import { Dumbbell, Salad } from 'lucide-react';
import type { TipoChancela } from '@/lib/chancela';

// Leitura do plano na fila de chancela: mostra o que o cliente VERIA, sem os
// campos de edição. Defensivo: o conteúdo vem de IA e pode ter campos faltando.

type Obj = Record<string, unknown>;

function lista(v: unknown): Obj[] {
  return Array.isArray(v) ? v.filter((x): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x)) : [];
}

function str(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return '';
}

function textos(v: unknown): string[] {
  return Array.isArray(v) ? v.map(str).filter(Boolean) : [];
}

function juntar(partes: (string | false | null | undefined)[], sep = ' · '): string {
  return partes.filter(Boolean).join(sep);
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/50 bg-card p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">{titulo}</p>
      {children}
    </div>
  );
}

function TreinoLeitura({ conteudo }: { conteudo: Obj }) {
  const fases = lista(conteudo.fases);
  const observacoes = str(conteudo.observacoes_gerais);
  return (
    <div className="space-y-3">
      {str(conteudo.resumo) && <p className="text-sm text-foreground/85">{str(conteudo.resumo)}</p>}
      {fases.length === 0 && <p className="text-sm text-muted-foreground">O plano não traz fases de treino.</p>}
      {fases.map((fase, fi) => (
        <div key={fi} className="rounded-lg border border-border/50 overflow-hidden">
          <div className="bg-muted/50 px-3 py-2 flex items-center justify-between gap-2">
            <span className="text-sm font-bold">{str(fase.nome) || `Fase ${fi + 1}`}</span>
            {str(fase.semanas) && <span className="text-[11px] text-muted-foreground shrink-0">{str(fase.semanas)} sem</span>}
          </div>
          <div className="p-3 space-y-3">
            {str(fase.objetivo) && <p className="text-xs text-muted-foreground">{str(fase.objetivo)}</p>}
            {lista(fase.sessoes).map((sessao, si) => (
              <div key={si} className="space-y-1.5">
                <p className="text-xs font-bold">{juntar([str(sessao.nome) || `Treino ${si + 1}`, str(sessao.duracao_min) && `~${str(sessao.duracao_min)} min`])}</p>
                {str(sessao.aquecimento) && <p className="text-[11px] text-muted-foreground"><strong>Aquecimento:</strong> {str(sessao.aquecimento)}</p>}
                <ul className="space-y-1">
                  {lista(sessao.exercicios).map((ex, ei) => (
                    <li key={ei} className="rounded-md bg-muted/30 px-2.5 py-1.5 text-xs">
                      <span className="font-semibold">{str(ex.nome) || 'Exercício'}</span>
                      <span className="text-muted-foreground">
                        {' — '}
                        {juntar([
                          str(ex.series) && str(ex.reps) ? `${str(ex.series)}×${str(ex.reps)}` : str(ex.series) || str(ex.reps),
                          str(ex.carga),
                          str(ex.descanso_s) && `${str(ex.descanso_s)}s de descanso`,
                        ]) || 'sem prescrição'}
                      </span>
                      {(str(ex.orientacoes) || str(ex.obs)) && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{juntar([str(ex.orientacoes), str(ex.obs)], ' ')}</p>
                      )}
                    </li>
                  ))}
                </ul>
                {str(sessao.desaquecimento) && <p className="text-[11px] text-muted-foreground"><strong>Desaquecimento:</strong> {str(sessao.desaquecimento)}</p>}
              </div>
            ))}
          </div>
        </div>
      ))}
      {observacoes && <Secao titulo="Observações gerais"><p className="text-xs">{observacoes}</p></Secao>}
    </div>
  );
}

function DietaLeitura({ conteudo }: { conteudo: Obj }) {
  const refeicoes = lista(conteudo.refeicoes);
  const macros = (conteudo.macros && typeof conteudo.macros === 'object' ? conteudo.macros : {}) as Obj;
  const metas = [
    { r: 'kcal/dia', v: str(conteudo.calorias_totais) },
    { r: 'Proteína', v: str(macros.proteina_g) && `${str(macros.proteina_g)} g` },
    { r: 'Carboidrato', v: str(macros.carbo_g) && `${str(macros.carbo_g)} g` },
    { r: 'Gordura', v: str(macros.gordura_g) && `${str(macros.gordura_g)} g` },
  ].filter((m) => m.v);
  const orientacoes = textos(conteudo.orientacoes);
  const compras = textos(conteudo.lista_compras);
  return (
    <div className="space-y-3">
      {str(conteudo.resumo) && <p className="text-sm text-foreground/85">{str(conteudo.resumo)}</p>}
      {metas.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {metas.map((m) => (
            <div key={m.r} className="rounded-lg border border-border/50 bg-card p-2 text-center">
              <p className="text-sm font-black tabular-nums">{m.v}</p>
              <p className="text-[10px] text-muted-foreground">{m.r}</p>
            </div>
          ))}
        </div>
      )}
      {refeicoes.length === 0 && <p className="text-sm text-muted-foreground">O plano não traz refeições.</p>}
      {refeicoes.map((refeicao, ri) => (
        <div key={ri} className="rounded-lg border border-border/50 overflow-hidden">
          <div className="bg-muted/50 px-3 py-2 flex items-center justify-between gap-2">
            <span className="text-sm font-bold">{str(refeicao.nome) || `Refeição ${ri + 1}`}</span>
            <span className="text-[11px] text-muted-foreground shrink-0">
              {juntar([str(refeicao.horario), str(refeicao.calorias) && `${str(refeicao.calorias)} kcal`])}
            </span>
          </div>
          <ul className="p-3 space-y-1">
            {lista(refeicao.itens).map((item, ii) => (
              <li key={ii} className="flex items-center justify-between gap-2 text-xs">
                <span>{str(item.alimento) || 'Alimento'}</span>
                <span className="text-muted-foreground text-right">{juntar([str(item.porcao), str(item.kcal) && `${str(item.kcal)} kcal`])}</span>
              </li>
            ))}
            {str(refeicao.substituicoes) && (
              <li className="text-[11px] text-muted-foreground border-t border-border/40 pt-1 mt-1"><strong>Trocas:</strong> {str(refeicao.substituicoes)}</li>
            )}
          </ul>
        </div>
      ))}
      {orientacoes.length > 0 && (
        <Secao titulo="Orientações">
          <ul className="list-disc list-inside text-xs space-y-0.5">{orientacoes.map((o, i) => <li key={i}>{o}</li>)}</ul>
        </Secao>
      )}
      {compras.length > 0 && (
        <Secao titulo="Lista de compras">
          <div className="flex flex-wrap gap-1.5">
            {compras.map((c, i) => <span key={i} className="text-[11px] px-2 py-0.5 rounded-full border border-border/60 bg-muted/40">{c}</span>)}
          </div>
        </Secao>
      )}
    </div>
  );
}

export default function PlanoLeitura({ tipo, conteudo }: { tipo: TipoChancela; conteudo: Obj }) {
  const Icone = tipo === 'treino' ? Dumbbell : Salad;
  return (
    <section aria-label={tipo === 'treino' ? 'Plano de treino' : 'Plano alimentar'} className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Icone className="h-3.5 w-3.5" aria-hidden />
        {tipo === 'treino' ? 'Plano de treino, como o cliente vai ver' : 'Plano alimentar, como o cliente vai ver'}
      </div>
      {tipo === 'treino' ? <TreinoLeitura conteudo={conteudo} /> : <DietaLeitura conteudo={conteudo} />}
    </section>
  );
}
