// Lógica PURA do revisor de segurança de planos (sem Deno, rede ou banco), para
// poder ser testada com vitest. A edge function revisar-plano-seguranca só orquestra.

export type Severidade = "alta" | "media" | "baixa";
export type RiscoGeral = "baixo" | "medio" | "alto";

export interface FlagRevisao {
  severidade: Severidade;
  titulo: string;
  descricao: string;
  sugestao: string;
  onde: string;
}

export interface RevisaoNormalizada {
  resumo: string;
  risco_geral: RiscoGeral;
  flags: FlagRevisao[];
}

export interface RevisaoPersistida {
  risco_geral: RiscoGeral;
  n_flags_altas: number;
  flags: FlagRevisao[];
  resumo: string;
  revisado_em: string;
  revisado_por: string;
  hash: string;
  plano_truncado?: true;
}

// O Gemini lê o plano inteiro até este limite; acima disso a revisão é parcial e
// o registro avisa (plano_truncado), para ninguém achar que o plano todo foi visto.
export const LIMITE_PLANO_CHARS = 40_000;
const MAX_FLAGS = 30;

type Obj = Record<string, unknown>;
const ehObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function texto(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  const t = v.trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

export function tabelaDoTipo(tipo: unknown): { tabela: "planos_treino" | "planos_alimentares"; coluna: "estrutura" | "plano" } | null {
  if (tipo === "treino") return { tabela: "planos_treino", coluna: "estrutura" };
  if (tipo === "nutricao") return { tabela: "planos_alimentares", coluna: "plano" };
  return null;
}

export interface AlvoRevisao {
  tabela: "planos_treino" | "planos_alimentares" | "plano_cliente_chancela";
  coluna: "estrutura" | "plano" | "conteudo";
}

/**
 * Onde está o plano a revisar. `tabela: 'plano_cliente_chancela'` é o plano que o cliente
 * Premium gerou e que a equipe científica revisa antes de chancelar; sem `tabela`, vale o
 * `tipo` (planos do profissional).
 */
export function alvoDaRevisao(tipo: unknown, tabela?: unknown): AlvoRevisao | null {
  if (tabela === "plano_cliente_chancela") return { tabela: "plano_cliente_chancela", coluna: "conteudo" };
  return tabelaDoTipo(tipo);
}

// _governanca é metadado do app (triagem, aprovação, revisão anterior): não vai
// para o LLM nem entra na revisão.
export function removerGovernanca(plano: unknown): unknown {
  if (!ehObj(plano)) return plano;
  const { _governanca: _ignorada, ...resto } = plano;
  return resto;
}

export function planoParaPrompt(plano: unknown, limite = LIMITE_PLANO_CHARS): { json: string; truncado: boolean } {
  const json = JSON.stringify(plano) ?? "null";
  if (json.length <= limite) return { json, truncado: false };
  return { json: json.slice(0, limite), truncado: true };
}

// O modelo às vezes embrulha o JSON em texto/markdown; tenta o conteúdo inteiro e,
// se falhar, o maior trecho entre chaves. null = nada aproveitável.
export function extrairJson(conteudo: unknown): unknown {
  if (typeof conteudo !== "string") return null;
  try {
    return JSON.parse(conteudo);
  } catch {
    // não era JSON puro: tenta o trecho entre chaves logo abaixo
  }
  const m = conteudo.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

function severidade(v: unknown): Severidade {
  const s = typeof v === "string" ? semAcento(v) : "";
  if (/^(alt|grav|crit|high|sever)/.test(s)) return "alta";
  if (/^(baix|low|leve|info)/.test(s)) return "baixa";
  // Severidade ausente ou irreconhecível: na dúvida, não rebaixa para "baixa".
  return "media";
}

function risco(v: unknown): RiscoGeral | null {
  const s = typeof v === "string" ? semAcento(v) : "";
  if (s.startsWith("alt")) return "alto";
  if (s.startsWith("med")) return "medio";
  if (s.startsWith("baix")) return "baixo";
  return null;
}

// Normaliza a resposta do LLM. Devolve null quando não há nada aproveitável (JSON
// vazio ou de outro formato): uma revisão vazia NÃO pode virar "nenhum ponto crítico".
export function interpretarRevisao(saida: unknown): RevisaoNormalizada | null {
  if (!ehObj(saida)) return null;
  const brutas = Array.isArray(saida.flags) ? saida.flags : null;
  const riscoLlm = risco(saida.risco_geral);
  if (!brutas && !riscoLlm) return null;

  const flags: FlagRevisao[] = (brutas ?? []).filter(ehObj).slice(0, MAX_FLAGS).map((f) => ({
    severidade: severidade(f.severidade),
    titulo: texto(f.titulo, 200) || "Ponto de atenção",
    descricao: texto(f.descricao, 1200),
    sugestao: texto(f.sugestao, 1200),
    onde: texto(f.onde, 200),
  }));

  const temAlta = flags.some((f) => f.severidade === "alta");
  const riscoFinal: RiscoGeral = temAlta ? "alto" : (riscoLlm ?? (flags.length ? "medio" : "baixo"));
  const resumo = texto(saida.resumo, 600) || (flags.length ? "Pontos de atenção encontrados." : "Nenhum ponto crítico encontrado.");
  return { resumo, risco_geral: riscoFinal, flags };
}

export function montarRevisaoPersistida(p: {
  revisao: RevisaoNormalizada;
  revisadoPor: string;
  hash: string;
  agora: Date;
  planoTruncado: boolean;
}): RevisaoPersistida {
  const out: RevisaoPersistida = {
    risco_geral: p.revisao.risco_geral,
    n_flags_altas: p.revisao.flags.filter((f) => f.severidade === "alta").length,
    flags: p.revisao.flags,
    resumo: p.revisao.resumo,
    revisado_em: p.agora.toISOString(),
    revisado_por: p.revisadoPor,
    hash: p.hash,
  };
  if (p.planoTruncado) out.plano_truncado = true;
  return out;
}

export function idadeEmAnos(dataNascimento: unknown, hoje: Date = new Date()): number | null {
  if (typeof dataNascimento !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dataNascimento);
  if (!m) return null;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let idade = hoje.getUTCFullYear() - ano;
  if (hoje.getUTCMonth() + 1 < mes || (hoje.getUTCMonth() + 1 === mes && hoje.getUTCDate() < dia)) idade--;
  return idade >= 0 && idade < 130 ? idade : null;
}

function lista(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim()) : [];
}

function itens(v: unknown, campos: string[]): string[] {
  const arr = ehObj(v) && Array.isArray(v.items) ? v.items : [];
  return arr.filter(ehObj)
    .map((it) => campos.map((c) => texto(it[c], 120)).filter(Boolean).join(" "))
    .filter(Boolean);
}

// Resume o histórico clínico autodeclarado (HistoricoClinicoCard) em linhas de texto
// para o prompt. Só campos conhecidos e preenchidos; limite de tamanho no total.
export function resumirHistoricoClinico(h: unknown): string {
  if (!ehObj(h)) return "";
  const linhas: string[] = [];
  const add = (rotulo: string, partes: string[]) => {
    const t = partes.filter(Boolean).join("; ");
    if (t) linhas.push(`${rotulo}: ${t}`);
  };
  const dc = ehObj(h.doencas_cronicas) ? h.doencas_cronicas : {};
  add("Doenças crônicas", [...lista(dc.condicoes), texto(dc.detalhes, 300)]);
  add("Cirurgias", itens(h.cirurgias, ["tipo", "ano", "complicacoes"]));
  add("Medicamentos", itens(h.medicamentos, ["nome", "dose", "frequencia"]));
  const al = ehObj(h.alergias) ? h.alergias : {};
  add("Alergias", [texto(al.medicamentos, 150), texto(al.alimentos, 150), texto(al.outros, 150)]);
  const sm = ehObj(h.saude_mental) ? h.saude_mental : {};
  add("Saúde mental", [...lista(sm.condicoes), texto(sm.detalhes, 300)]);
  const hf = ehObj(h.historico_familiar) ? h.historico_familiar : {};
  add("Histórico familiar", [...lista(hf.condicoes), texto(hf.detalhes, 300)]);
  return linhas.join("\n").slice(0, 3000);
}
