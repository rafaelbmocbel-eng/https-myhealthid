import { useState } from 'react';
import { Dumbbell, ShieldCheck, ImageOff, Salad } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// Documento do treino (estilo PDF, mas com GIFs ANIMANDO). Puro presentational —
// usado na página logada (/paciente/treino-completo) e na pública (/treino/:token).
// Deixa CLARO que o treino é individual, montado a partir dos questionários
// específicos do cliente (o perfil vem em conteudo.baseadoEm).

export interface BaseadoEm {
  objetivo?: string;
  focoOportunidade?: string | null;
  focoAtencao?: string | null;
  questionarios?: { sigla: string; nome?: string; classificacao?: string }[];
}

interface Props {
  nome: string;
  titulo?: string | null;
  conteudo: any; // { resumo, baseadoEm?, fases: [...], observacoes_gerais }
  nutricao?: any; // { titulo, resumo, calorias_totais, macros, refeicoes: [...], orientacoes, lista_compras }
}

export default function TreinoDocumento({ nome, titulo, conteudo, nutricao }: Props) {
  const fases: any[] = Array.isArray(conteudo?.fases) ? conteudo.fases : [];
  const refeicoes: any[] = Array.isArray(nutricao?.refeicoes) ? nutricao.refeicoes
    : Array.isArray(nutricao?.meals) ? nutricao.meals : [];
  const temNutricao = refeicoes.length > 0;
  const base: BaseadoEm | undefined = conteudo?.baseadoEm;
  const [quebrados, setQuebrados] = useState<Set<string>>(new Set());
  const marcarQuebrado = (url: string) => setQuebrados((s) => new Set(s).add(url));

  const renderExercicio = (ex: any, ei: number) => {
    const quebrado = ex.gif_url && quebrados.has(ex.gif_url);
    return (
      <div key={ei} className="flex gap-3 rounded-lg border border-[#e1e4eb] p-3 break-inside-avoid">
        {ex.gif_url && !quebrado ? (
          // GIF ANIMANDO, maior — o que o PDF não consegue fazer
          <img src={ex.gif_url} alt={ex.nome}
            onError={() => marcarQuebrado(ex.gif_url)}
            className="h-32 w-32 sm:h-40 sm:w-40 rounded-lg object-cover border border-[#e1e4eb] shrink-0 bg-white" loading="lazy" />
        ) : ex.gif_url && quebrado ? (
          <div className="h-32 w-32 sm:h-40 sm:w-40 rounded-lg bg-red-50 border border-red-200 flex flex-col items-center justify-center shrink-0 text-center px-1">
            <ImageOff className="h-6 w-6 text-red-400 mb-1" />
            <span className="text-[10px] text-red-500 leading-tight">imagem indisponível</span>
          </div>
        ) : (
          <div className="h-32 w-32 sm:h-40 sm:w-40 rounded-lg bg-[#eef1f8] flex items-center justify-center shrink-0 text-lg font-bold text-[#2563eb]">{ei + 1}</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#212529]">{ex.nome || 'Exercício'}</p>
          <p className="text-[13px] font-bold text-[#2563eb] mt-0.5">
            {[ex.series && ex.reps ? `${ex.series}×${ex.reps}` : ex.series, ex.carga, ex.descanso_s && `${ex.descanso_s}s descanso`].filter(Boolean).join('  ·  ')}
          </p>
          {(ex.orientacoes || ex.obs) && (
            <p className="text-xs text-[#6e7482] mt-1 leading-relaxed">
              {ex.orientacoes && <><strong className="text-[#212529]">Execução:</strong> {ex.orientacoes} </>}
              {ex.obs}
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderSessao = (s: any, si: number) => (
    <div key={si} className="space-y-2">
      <h3 className="text-sm font-bold text-[#1e2952] pt-1">
        {s.nome || `Treino ${si + 1}`}{s.duracao_min ? ` · ~${s.duracao_min} min` : ''}
      </h3>
      {s.aquecimento && <p className="text-xs text-[#6e7482]"><strong>Aquecimento:</strong> {s.aquecimento}</p>}
      <div className="space-y-2">
        {(Array.isArray(s.exercicios) ? s.exercicios : []).map(renderExercicio)}
      </div>
      {s.desaquecimento && <p className="text-xs text-[#6e7482]"><strong>Desaquecimento:</strong> {s.desaquecimento}</p>}
    </div>
  );

  // Conteúdo do TREINO (fases em abas + observações) — reutilizado dentro ou
  // fora das abas de topo Treino/Nutrição.
  const treinoView = (
    <div className="space-y-5">
      {fases.length === 0 ? (
        <div className="text-center py-8 text-[#6e7482]">
          <Dumbbell className="h-9 w-9 text-[#c7d2fe] mx-auto mb-2" />
          <p className="text-sm">Treino ainda não disponível.</p>
        </div>
      ) : (
        <Tabs defaultValue="0" className="w-full">
          <TabsList className="w-full flex overflow-x-auto justify-start h-auto p-1 bg-[#eef1f8]">
            {fases.map((f, fi) => (
              <TabsTrigger key={fi} value={String(fi)} className="text-xs data-[state=active]:bg-[#2563eb] data-[state=active]:text-white shrink-0">
                {f.nome ? String(f.nome).split(' - ')[0] : `Fase ${fi + 1}`}
              </TabsTrigger>
            ))}
          </TabsList>
          {fases.map((f, fi) => (
            <TabsContent key={fi} value={String(fi)} className="space-y-3 mt-3">
              <div className="rounded-lg bg-[#2563eb] text-white px-3 py-2 flex items-center justify-between">
                <span className="text-sm font-bold">{f.nome || `Fase ${fi + 1}`}</span>
                {f.semanas && <span className="text-xs text-blue-100">{f.semanas} semanas</span>}
              </div>
              {f.objetivo && <p className="text-xs text-[#6e7482]">{f.objetivo}</p>}
              {(Array.isArray(f.sessoes) ? f.sessoes : []).map(renderSessao)}
            </TabsContent>
          ))}
        </Tabs>
      )}
      {conteudo?.observacoes_gerais && (
        <div className="border-t border-[#e1e4eb] pt-3">
          <h3 className="text-sm font-bold text-[#1e2952] mb-1">Observações</h3>
          <p className="text-xs text-[#6e7482]">{conteudo.observacoes_gerais}</p>
        </div>
      )}
    </div>
  );

  // Conteúdo da NUTRIÇÃO — calorias/macros do dia, refeições e lista de compras.
  const nutricaoView = temNutricao ? (
    <div className="space-y-4">
      {(nutricao.titulo || nutricao.resumo) && (
        <div>
          {nutricao.titulo && <h3 className="text-base font-bold text-[#1e2952]">{nutricao.titulo}</h3>}
          {nutricao.resumo && <p className="text-xs text-[#6e7482] mt-0.5">{nutricao.resumo}</p>}
        </div>
      )}
      {/* Metas do dia */}
      {(nutricao.calorias_totais || nutricao.macros) && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { l: 'kcal/dia', v: nutricao.calorias_totais },
            { l: 'Proteína', v: nutricao.macros?.proteina_g && `${nutricao.macros.proteina_g}g` },
            { l: 'Carbo', v: nutricao.macros?.carbo_g && `${nutricao.macros.carbo_g}g` },
            { l: 'Gordura', v: nutricao.macros?.gordura_g && `${nutricao.macros.gordura_g}g` },
          ].filter((x) => x.v).map((x, i) => (
            <div key={i} className="rounded-lg border border-[#e1e4eb] bg-[#f7f9fc] p-2 text-center">
              <p className="text-sm font-black text-[#1e2952] tabular-nums">{x.v}</p>
              <p className="text-[10px] text-[#6e7482]">{x.l}</p>
            </div>
          ))}
        </div>
      )}
      {refeicoes.map((r: any, ri: number) => {
        const itens: any[] = Array.isArray(r.itens) ? r.itens : Array.isArray(r.alimentos) ? r.alimentos : [];
        return (
          <div key={ri} className="rounded-lg border border-[#e1e4eb] overflow-hidden">
            <div className="px-3 py-2 bg-[#f0fdf4] flex items-center justify-between">
              <span className="text-sm font-bold text-[#166534]">{r.nome || r.refeicao || `Refeição ${ri + 1}`}</span>
              <span className="text-[11px] text-[#6e7482]">{[r.horario || r.hora, r.calorias && `${r.calorias} kcal`].filter(Boolean).join(' · ')}</span>
            </div>
            <div className="p-2.5 space-y-1">
              {itens.map((it: any, ii: number) => (
                <div key={ii} className="flex items-center justify-between gap-2 text-[12.5px]">
                  <span className="text-[#212529]">{it.alimento || it.nome || String(it)}</span>
                  <span className="text-[#6e7482] whitespace-nowrap shrink-0">
                    {[it.porcao || it.porção, it.kcal && `${it.kcal} kcal`].filter(Boolean).join(' · ')}
                  </span>
                </div>
              ))}
              {r.substituicoes && <p className="text-[11px] text-[#6e7482] pt-1 border-t border-[#e1e4eb] mt-1"><strong>Trocas:</strong> {r.substituicoes}</p>}
            </div>
          </div>
        );
      })}
      {Array.isArray(nutricao.orientacoes) && nutricao.orientacoes.length > 0 && (
        <div className="rounded-lg border border-[#e1e4eb] p-3">
          <h4 className="text-sm font-bold text-[#1e2952] mb-1">Orientações</h4>
          <ul className="list-disc list-inside text-xs text-[#6e7482] space-y-0.5">
            {nutricao.orientacoes.map((o: string, i: number) => <li key={i}>{o}</li>)}
          </ul>
        </div>
      )}
      {Array.isArray(nutricao.lista_compras) && nutricao.lista_compras.length > 0 && (
        <div className="rounded-lg border border-[#e1e4eb] p-3">
          <h4 className="text-sm font-bold text-[#1e2952] mb-1">Lista de compras</h4>
          <div className="flex flex-wrap gap-1.5">
            {nutricao.lista_compras.map((c: string, i: number) => (
              <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-[#f0fdf4] text-[#166534] border border-emerald-200">{c}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className="bg-white text-[#212529] rounded-xl overflow-hidden shadow-sm print:shadow-none print:rounded-none">
      {/* Cabeçalho */}
      <div className="bg-[#1e2952] text-white px-6 py-5">
        <h1 className="text-xl font-black">Meu Plano de Treino</h1>
        <p className="text-[13px] text-blue-100/90 mt-0.5">{nome} · {new Date().toLocaleDateString('pt-BR')}</p>
      </div>

      <div className="px-5 sm:px-6 py-5 space-y-5">
        {titulo && <h2 className="text-lg font-bold text-[#1e2952]">{titulo}</h2>}
        {conteudo?.resumo && <p className="text-sm text-[#6e7482] -mt-3">{conteudo.resumo}</p>}

        {/* Painel: treino INDIVIDUAL, baseado nos questionários do cliente */}
        <div className="rounded-xl border border-[#c7d2fe] bg-[#eef2ff] px-4 py-3">
          <div className="flex items-center gap-2 mb-1.5">
            <ShieldCheck className="h-4 w-4 text-[#2563eb]" />
            <p className="text-sm font-bold text-[#1e2952]">Feito para {nome ? nome.split(' ')[0] : 'você'} — individual</p>
          </div>
          <p className="text-[12.5px] text-[#3730a3] leading-relaxed">
            Este treino foi montado <strong>especificamente a partir dos seus questionários</strong> — a
            avaliação MyID{base?.questionarios?.length ? ', ' + base.questionarios.map(q => q.sigla).join(', ') : ' e os questionários clínicos'} e
            a sua anamnese. Não é um treino genérico: ele respeita a sua condição atual.
          </p>
          {(base?.objetivo || base?.focoOportunidade || base?.focoAtencao || base?.questionarios?.length) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {base?.objetivo && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white text-[#1e2952] border border-[#c7d2fe]">🎯 {base.objetivo}</span>
              )}
              {base?.focoOportunidade && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Oportunidade: {base.focoOportunidade}</span>
              )}
              {base?.focoAtencao && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Atenção: {base.focoAtencao}</span>
              )}
              {(base?.questionarios || []).map((q, i) => (
                <span key={i} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white text-[#3730a3] border border-[#c7d2fe]">
                  {q.sigla}{q.classificacao ? `: ${q.classificacao}` : ''}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Abas de topo Treino | Nutrição (só quando há plano nutricional) */}
        {temNutricao ? (
          <Tabs defaultValue="treino" className="w-full">
            <TabsList className="w-full grid grid-cols-2 h-auto p-1 bg-[#eef1f8]">
              <TabsTrigger value="treino" className="text-sm gap-1.5 data-[state=active]:bg-[#2563eb] data-[state=active]:text-white">
                <Dumbbell className="h-4 w-4" /> Treino
              </TabsTrigger>
              <TabsTrigger value="nutricao" className="text-sm gap-1.5 data-[state=active]:bg-[#16a34a] data-[state=active]:text-white">
                <Salad className="h-4 w-4" /> Nutrição
              </TabsTrigger>
            </TabsList>
            <TabsContent value="treino" className="mt-3">{treinoView}</TabsContent>
            <TabsContent value="nutricao" className="mt-3">{nutricaoView}</TabsContent>
          </Tabs>
        ) : treinoView}

        <p className="text-[11px] text-[#9ca3af] border-t border-[#e1e4eb] pt-3">
          My Health ID · Plano gerado por IA a partir da avaliação individual do cliente — apoio, não substitui avaliação profissional.
        </p>
      </div>
    </div>
  );
}
