import { useState } from 'react';
import { Dumbbell, ShieldCheck, ImageOff, Salad, Plus, Trash2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// Documento do treino (estilo PDF, mas com GIFs ANIMANDO). Usado na página logada
// (/paciente/treino-completo), na pública (/treino/:token) e no portal do
// profissional. Deixa CLARO que o treino é individual, montado a partir dos
// questionários específicos do cliente (o perfil vem em conteudo.baseadoEm).
//
// Modo EDIÇÃO: quando `editando` é true, os campos dos planos (treino e nutrição)
// viram inputs no lugar — dá pra alterar todas as características AQUI na página.
// O componente bolha o objeto inteiro atualizado via onConteudoChange/onNutricaoChange;
// quem salva é a página (tem o supabase e os ids). Sem as props de edição, segue
// 100% somente-leitura (público e portal não mudam).

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
  editando?: boolean;
  onTituloChange?: (v: string) => void;
  onConteudoChange?: (novo: any) => void;
  onNutricaoChange?: (novo: any) => void;
}

const clone = (o: any) => JSON.parse(JSON.stringify(o ?? {}));

// Input inline que "imita" o texto do documento — fundo âmbar suave no modo edição.
// Definido FORA do componente pai: se ficasse dentro do render, cada tecla criaria
// um tipo novo e o input perderia o foco a cada caractere.
function EI({ value, onChange, className, placeholder }: { value: any; onChange: (v: string) => void; className?: string; placeholder?: string }) {
  return (
    <input
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`bg-[#fffbeb] border border-[#fde68a] rounded px-1.5 py-0.5 outline-none focus:border-[#2563eb] text-[#212529] ${className || ''}`}
    />
  );
}

export default function TreinoDocumento({
  nome, titulo, conteudo, nutricao, editando,
  onTituloChange, onConteudoChange, onNutricaoChange,
}: Props) {
  const fases: any[] = Array.isArray(conteudo?.fases) ? conteudo.fases : [];
  const refeicoes: any[] = Array.isArray(nutricao?.refeicoes) ? nutricao.refeicoes
    : Array.isArray(nutricao?.meals) ? nutricao.meals : [];
  const temNutricao = refeicoes.length > 0;
  const base: BaseadoEm | undefined = conteudo?.baseadoEm;
  const [quebrados, setQuebrados] = useState<Set<string>>(new Set());
  const marcarQuebrado = (url: string) => setQuebrados((s) => new Set(s).add(url));

  // Aplica uma mutação no clone do plano e bolha o objeto inteiro pra página.
  const updC = (mut: (d: any) => void) => { const d = clone(conteudo); mut(d); onConteudoChange?.(d); };
  const updN = (mut: (d: any) => void) => { const d = clone(nutricao); mut(d); onNutricaoChange?.(d); };

  const renderExercicio = (ex: any, ei: number, si: number, fi: number) => {
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
          {editando ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <EI value={ex.nome} placeholder="Exercício" className="text-sm font-semibold flex-1 w-full"
                  onChange={(v) => updC((d) => { d.fases[fi].sessoes[si].exercicios[ei].nome = v; })} />
                <button title="Remover exercício" className="shrink-0 p-1 rounded hover:bg-red-50"
                  onClick={() => updC((d) => { d.fases[fi].sessoes[si].exercicios.splice(ei, 1); })}>
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 items-center text-[13px]">
                <EI value={ex.series} placeholder="séries" className="w-14 text-center"
                  onChange={(v) => updC((d) => { d.fases[fi].sessoes[si].exercicios[ei].series = v; })} />
                <span className="text-[#6e7482]">×</span>
                <EI value={ex.reps} placeholder="reps" className="w-16 text-center"
                  onChange={(v) => updC((d) => { d.fases[fi].sessoes[si].exercicios[ei].reps = v; })} />
                <EI value={ex.carga} placeholder="carga" className="w-20 text-center"
                  onChange={(v) => updC((d) => { d.fases[fi].sessoes[si].exercicios[ei].carga = v; })} />
                <EI value={ex.descanso_s} placeholder="descanso s" className="w-20 text-center"
                  onChange={(v) => updC((d) => { d.fases[fi].sessoes[si].exercicios[ei].descanso_s = v; })} />
              </div>
              <EI value={ex.orientacoes} placeholder="Execução / orientações" className="text-xs w-full"
                onChange={(v) => updC((d) => { d.fases[fi].sessoes[si].exercicios[ei].orientacoes = v; })} />
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    );
  };

  const renderSessao = (s: any, si: number, fi: number) => (
    <div key={si} className="space-y-2">
      {editando ? (
        <EI value={s.nome} placeholder={`Treino ${si + 1}`} className="text-sm font-bold w-full"
          onChange={(v) => updC((d) => { d.fases[fi].sessoes[si].nome = v; })} />
      ) : (
        <h3 className="text-sm font-bold text-[#1e2952] pt-1">
          {s.nome || `Treino ${si + 1}`}{s.duracao_min ? ` · ~${s.duracao_min} min` : ''}
        </h3>
      )}
      {s.aquecimento && !editando && <p className="text-xs text-[#6e7482]"><strong>Aquecimento:</strong> {s.aquecimento}</p>}
      <div className="space-y-2">
        {(Array.isArray(s.exercicios) ? s.exercicios : []).map((ex: any, ei: number) => renderExercicio(ex, ei, si, fi))}
      </div>
      {editando && (
        <button className="w-full flex items-center justify-center gap-1 text-xs text-[#2563eb] border border-dashed border-[#c7d2fe] rounded-lg py-1.5 hover:bg-[#eef2ff]"
          onClick={() => updC((d) => { (d.fases[fi].sessoes[si].exercicios ||= []).push({ nome: '', series: '', reps: '', carga: '', descanso_s: '', orientacoes: '' }); })}>
          <Plus className="h-3.5 w-3.5" /> Adicionar exercício
        </button>
      )}
      {s.desaquecimento && !editando && <p className="text-xs text-[#6e7482]"><strong>Desaquecimento:</strong> {s.desaquecimento}</p>}
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
                {editando ? (
                  <EI value={f.nome} placeholder={`Fase ${fi + 1}`} className="text-sm font-bold flex-1 w-full !bg-white/90"
                    onChange={(v) => updC((d) => { d.fases[fi].nome = v; })} />
                ) : (
                  <span className="text-sm font-bold">{f.nome || `Fase ${fi + 1}`}</span>
                )}
                {f.semanas && !editando && <span className="text-xs text-blue-100">{f.semanas} semanas</span>}
              </div>
              {editando ? (
                <EI value={f.objetivo} placeholder="Objetivo da fase" className="text-xs w-full"
                  onChange={(v) => updC((d) => { d.fases[fi].objetivo = v; })} />
              ) : (
                f.objetivo && <p className="text-xs text-[#6e7482]">{f.objetivo}</p>
              )}
              {(Array.isArray(f.sessoes) ? f.sessoes : []).map((s: any, si: number) => renderSessao(s, si, fi))}
            </TabsContent>
          ))}
        </Tabs>
      )}
      {editando ? (
        <div className="border-t border-[#e1e4eb] pt-3">
          <h3 className="text-sm font-bold text-[#1e2952] mb-1">Observações</h3>
          <EI value={conteudo?.observacoes_gerais} placeholder="Observações gerais do treino" className="text-xs w-full"
            onChange={(v) => updC((d) => { d.observacoes_gerais = v; })} />
        </div>
      ) : (
        conteudo?.observacoes_gerais && (
          <div className="border-t border-[#e1e4eb] pt-3">
            <h3 className="text-sm font-bold text-[#1e2952] mb-1">Observações</h3>
            <p className="text-xs text-[#6e7482]">{conteudo.observacoes_gerais}</p>
          </div>
        )
      )}
    </div>
  );

  // Conteúdo da NUTRIÇÃO — calorias/macros do dia, refeições e lista de compras.
  const nutricaoView = (temNutricao || editando) ? (
    <div className="space-y-4">
      {editando ? (
        <div className="space-y-1.5">
          <EI value={nutricao?.titulo} placeholder="Título do plano alimentar" className="text-base font-bold w-full"
            onChange={(v) => updN((d) => { d.titulo = v; })} />
          <EI value={nutricao?.resumo} placeholder="Resumo (opcional)" className="text-xs w-full"
            onChange={(v) => updN((d) => { d.resumo = v; })} />
        </div>
      ) : (
        (nutricao.titulo || nutricao.resumo) && (
          <div>
            {nutricao.titulo && <h3 className="text-base font-bold text-[#1e2952]">{nutricao.titulo}</h3>}
            {nutricao.resumo && <p className="text-xs text-[#6e7482] mt-0.5">{nutricao.resumo}</p>}
          </div>
        )
      )}
      {/* Metas do dia (somente-leitura — vêm do cálculo da IA) */}
      {!editando && (nutricao.calorias_totais || nutricao.macros) && (
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
            <div className="px-3 py-2 bg-[#f0fdf4] flex items-center justify-between gap-2">
              {editando ? (
                <>
                  <EI value={r.nome || r.refeicao} placeholder={`Refeição ${ri + 1}`} className="text-sm font-bold flex-1 w-full"
                    onChange={(v) => updN((d) => { d.refeicoes[ri].nome = v; })} />
                  <EI value={r.horario || r.hora} placeholder="horário" className="text-[11px] w-16"
                    onChange={(v) => updN((d) => { d.refeicoes[ri].horario = v; })} />
                  <button title="Remover refeição" className="shrink-0 p-1 rounded hover:bg-red-50"
                    onClick={() => updN((d) => { d.refeicoes.splice(ri, 1); })}>
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </button>
                </>
              ) : (
                <>
                  <span className="text-sm font-bold text-[#166534]">{r.nome || r.refeicao || `Refeição ${ri + 1}`}</span>
                  <span className="text-[11px] text-[#6e7482]">{[r.horario || r.hora, r.calorias && `${r.calorias} kcal`].filter(Boolean).join(' · ')}</span>
                </>
              )}
            </div>
            <div className="p-2.5 space-y-1">
              {itens.map((it: any, ii: number) => (
                editando ? (
                  <div key={ii} className="flex items-center gap-1.5">
                    <EI value={it.alimento || it.nome} placeholder="Alimento" className="text-[12.5px] flex-1 w-full"
                      onChange={(v) => updN((d) => { d.refeicoes[ri].itens[ii].alimento = v; })} />
                    <EI value={it.porcao || it['porção']} placeholder="porção" className="text-[11px] w-20"
                      onChange={(v) => updN((d) => { d.refeicoes[ri].itens[ii].porcao = v; })} />
                    <EI value={it.kcal} placeholder="kcal" className="text-[11px] w-14"
                      onChange={(v) => updN((d) => { d.refeicoes[ri].itens[ii].kcal = v; })} />
                    <button title="Remover alimento" className="shrink-0 p-1 rounded hover:bg-red-50"
                      onClick={() => updN((d) => { d.refeicoes[ri].itens.splice(ii, 1); })}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </button>
                  </div>
                ) : (
                  <div key={ii} className="flex items-center justify-between gap-2 text-[12.5px]">
                    <span className="text-[#212529]">{it.alimento || it.nome || String(it)}</span>
                    <span className="text-[#6e7482] whitespace-nowrap shrink-0">
                      {[it.porcao || it['porção'], it.kcal && `${it.kcal} kcal`].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                )
              ))}
              {editando && (
                <button className="w-full flex items-center justify-center gap-1 text-[11px] text-[#166534] border border-dashed border-emerald-300 rounded py-1 hover:bg-[#f0fdf4]"
                  onClick={() => updN((d) => { (d.refeicoes[ri].itens ||= []).push({ alimento: '', porcao: '', kcal: '' }); })}>
                  <Plus className="h-3 w-3" /> Adicionar alimento
                </button>
              )}
              {r.substituicoes && !editando && <p className="text-[11px] text-[#6e7482] pt-1 border-t border-[#e1e4eb] mt-1"><strong>Trocas:</strong> {r.substituicoes}</p>}
            </div>
          </div>
        );
      })}
      {editando && (
        <button className="w-full flex items-center justify-center gap-1 text-sm text-[#166534] border border-dashed border-emerald-300 rounded-lg py-2 hover:bg-[#f0fdf4]"
          onClick={() => updN((d) => { (d.refeicoes ||= []).push({ nome: 'Nova refeição', horario: '', itens: [] }); })}>
          <Plus className="h-4 w-4" /> Adicionar refeição
        </button>
      )}
      {!editando && Array.isArray(nutricao.orientacoes) && nutricao.orientacoes.length > 0 && (
        <div className="rounded-lg border border-[#e1e4eb] p-3">
          <h4 className="text-sm font-bold text-[#1e2952] mb-1">Orientações</h4>
          <ul className="list-disc list-inside text-xs text-[#6e7482] space-y-0.5">
            {nutricao.orientacoes.map((o: string, i: number) => <li key={i}>{o}</li>)}
          </ul>
        </div>
      )}
      {!editando && Array.isArray(nutricao.lista_compras) && nutricao.lista_compras.length > 0 && (
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

  const mostrarTabs = temNutricao || editando;

  return (
    <div className="bg-white text-[#212529] rounded-xl overflow-hidden shadow-sm print:shadow-none print:rounded-none">
      {/* Cabeçalho */}
      <div className="bg-[#1e2952] text-white px-6 py-5">
        <h1 className="text-xl font-black">Meu Plano de Treino</h1>
        <p className="text-[13px] text-blue-100/90 mt-0.5">{nome} · {new Date().toLocaleDateString('pt-BR')}</p>
      </div>

      <div className="px-5 sm:px-6 py-5 space-y-5">
        {editando ? (
          <input value={titulo ?? ''} onChange={(e) => onTituloChange?.(e.target.value)}
            placeholder="Título do plano"
            className="text-lg font-bold text-[#1e2952] w-full bg-[#fffbeb] border border-[#fde68a] rounded px-2 py-1 outline-none focus:border-[#2563eb]" />
        ) : (
          titulo && <h2 className="text-lg font-bold text-[#1e2952]">{titulo}</h2>
        )}
        {conteudo?.resumo && !editando && <p className="text-sm text-[#6e7482] -mt-3">{conteudo.resumo}</p>}

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

        {/* Abas de topo Treino | Nutrição (aparecem quando há nutrição ou no modo edição) */}
        {mostrarTabs ? (
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
