// Lógica pura da busca de ficha técnica de aparelhos (sem Deno nem rede), para
// poder ser testada. A regra central: NENHUM valor entra sem o trecho literal da
// fonte que o contém, e só quando a fonte trata do modelo exato.

export type TipoAparelho = "laser" | "ultrassom" | "ondas_choque";
export const TIPOS: TipoAparelho[] = ["laser", "ultrassom", "ondas_choque"];

export interface ResultadoFicha {
  /** Chaves iguais aos campos do formulário de cadastro; valores já em texto pt-BR. */
  campos: Record<string, string>;
  /** Trecho literal da fonte que sustenta cada campo. */
  evidencias: Record<string, string>;
  /** Campos que a busca trouxe mas foram descartados (e por quê). */
  descartados: string[];
  modeloConfere: boolean;
}

const CAMPOS_POR_TIPO: Record<TipoAparelho, string> = {
  laser: `"comprimento_onda": {"valor": número, "unidade": "nm", "trecho": "..."},
  "potencia_media": {"valor": número, "unidade": "mW" ou "W", "trecho": "..."},
  "potencia_pico": {"valor": número, "unidade": "mW" ou "W", "trecho": "..."},
  "area_feixe": {"valor": número, "unidade": "cm2" ou "mm2", "trecho": "..."},
  "modo": {"valor": "continuo" ou "pulsado", "trecho": "..."}`,
  ultrassom: `"frequencia": {"valor": número, "unidade": "MHz", "trecho": "..."},
  "era": {"valor": número, "unidade": "cm2", "trecho": "..."},
  "bnr": {"valor": número, "unidade": "", "trecho": "..."},
  "potencia_maxima": {"valor": número, "unidade": "W", "trecho": "..."}`,
  ondas_choque: `"tipo": {"valor": "focal" ou "radial", "trecho": "..."},
  "area_focal": {"valor": número, "unidade": "mm2" ou "cm2", "trecho": "..."},
  "frequencia_maxima": {"valor": número, "unidade": "Hz", "trecho": "..."},
  "pressao_maxima": {"valor": número, "unidade": "bar", "trecho": "..."},
  "efd_maxima": {"valor": número, "unidade": "mJ/mm2", "trecho": "..."}`,
};

const NOME_TIPO: Record<TipoAparelho, string> = {
  laser: "laser terapêutico (fotobiomodulação)",
  ultrassom: "ultrassom terapêutico",
  ondas_choque: "ondas de choque extracorpóreas",
};

export function montarPrompt(a: { fabricante: string; modelo: string; tipo: TipoAparelho }): string {
  return `Procure na internet a FICHA TÉCNICA OFICIAL (site do fabricante, manual ou catálogo) do aparelho de ${NOME_TIPO[a.tipo]}: fabricante "${a.fabricante}", modelo "${a.modelo}".

Responda SOMENTE com um JSON, sem texto antes ou depois, neste formato:
{
  "confere_modelo": {"valor": true ou false, "trecho": "frase da fonte que cita exatamente este modelo"},
  ${CAMPOS_POR_TIPO[a.tipo]}
}

Regras obrigatórias:
- "trecho" é uma frase LITERAL copiada da fonte, que contém o número informado. Sem trecho, não informe o campo.
- Informe o valor e a unidade COMO ESTÃO escritos na fonte; não converta, não arredonde, não estime.
- Use apenas a fonte que fala EXATAMENTE deste modelo. Não use valores de outros modelos, de outras versões nem de aparelhos parecidos.
- Se não achar a ficha deste modelo, responda {"confere_modelo": {"valor": false, "trecho": ""}}.
- Omita os campos que não encontrar.`;
}

/** Extrai o primeiro objeto JSON de um texto, mesmo dentro de cercas de código. */
export function extrairJson(texto: string): unknown | null {
  if (!texto) return null;
  const limpo = texto.replace(/```(?:json)?/gi, "");
  const ini = limpo.indexOf("{");
  const fim = limpo.lastIndexOf("}");
  if (ini < 0 || fim <= ini) return null;
  try { return JSON.parse(limpo.slice(ini, fim + 1)); } catch { return null; }
}

const num = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const n = Number(v.trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/²/g, "2").replace(/µ/g, "u");

/** O número informado precisa aparecer no trecho literal. */
function numeroNoTrecho(valor: number, trecho: string): boolean {
  const achados = [...trecho.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => Number(m[0].replace(",", ".")));
  return achados.some((n) => Math.abs(n - valor) < 1e-9);
}

const txt = (n: number) => String(Math.round(n * 1000) / 1000).replace(".", ",");

interface Regra {
  chave: string;
  campo: string;
  /** Converte (valor, unidade) para o valor canônico do formulário; null descarta. */
  converter: (v: number, unidade: string) => number | null;
}

const dentro = (n: number | null, min: number, max: number) => (n !== null && n >= min && n <= max ? n : null);

const REGRAS: Record<TipoAparelho, Regra[]> = {
  laser: [
    { chave: "comprimento_onda", campo: "nm", converter: (v) => dentro(v, 600, 1100) },
    { chave: "potencia_media", campo: "potMedia", converter: (v, u) => dentro(u === "w" ? v * 1000 : u === "mw" ? v : null, 0.1, 100000) },
    { chave: "potencia_pico", campo: "potPico", converter: (v, u) => dentro(u === "w" ? v * 1000 : u === "mw" ? v : null, 1, 1e7) },
    { chave: "area_feixe", campo: "areaFeixe", converter: (v, u) => dentro(u === "mm2" ? v / 100 : u === "cm2" ? v : null, 0.001, 100) },
  ],
  ultrassom: [
    { chave: "frequencia", campo: "freq", converter: (v, u) => (u === "mhz" && (v === 1 || v === 3) ? v : null) },
    { chave: "era", campo: "era", converter: (v, u) => (u === "cm2" ? dentro(v, 0.2, 30) : null) },
    { chave: "bnr", campo: "bnr", converter: (v) => dentro(v, 0.5, 20) },
    { chave: "potencia_maxima", campo: "potMax", converter: (v, u) => (u === "w" ? dentro(v, 0.5, 100) : null) },
  ],
  ondas_choque: [
    { chave: "area_focal", campo: "areaFocal", converter: (v, u) => dentro(u === "cm2" ? v * 100 : u === "mm2" ? v : null, 0.5, 2000) },
    { chave: "frequencia_maxima", campo: "hzMax", converter: (v, u) => (u === "hz" ? dentro(v, 0.5, 100) : null) },
    { chave: "pressao_maxima", campo: "barMax", converter: (v, u) => (u === "bar" ? dentro(v, 0.1, 10) : null) },
    { chave: "efd_maxima", campo: "efdMax", converter: (v, u) => (u.replace(/\s/g, "") === "mj/mm2" ? dentro(v, 0.01, 5) : null) },
  ],
};

export function validarFicha(bruto: unknown, tipo: TipoAparelho): ResultadoFicha {
  const out: ResultadoFicha = { campos: {}, evidencias: {}, descartados: [], modeloConfere: false };
  const o = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, Record<string, unknown> | undefined>;

  const conf = o["confere_modelo"];
  out.modeloConfere = conf?.valor === true && typeof conf.trecho === "string" && conf.trecho.trim().length >= 6;
  if (!out.modeloConfere) return out;

  for (const r of REGRAS[tipo]) {
    const c = o[r.chave];
    if (!c) continue;
    const trecho = typeof c.trecho === "string" ? c.trecho.trim() : "";
    const valor = num(c.valor);
    if (valor === null || trecho.length < 6) { out.descartados.push(`${r.chave}: sem valor ou sem trecho`); continue; }
    if (!numeroNoTrecho(valor, trecho)) { out.descartados.push(`${r.chave}: o número não aparece no trecho citado`); continue; }
    const unidade = norm(typeof c.unidade === "string" ? c.unidade : "").replace(/\s/g, "");
    const final = r.converter(valor, unidade);
    if (final === null) { out.descartados.push(`${r.chave}: unidade ou faixa implausível`); continue; }
    out.campos[r.campo] = r.campo === "freq" ? String(final) : txt(final);
    out.evidencias[r.campo] = trecho;
  }

  // Campos de texto
  if (tipo === "laser" && o["modo"]) {
    const v = typeof o["modo"].valor === "string" ? norm(o["modo"].valor) : "";
    const tr = typeof o["modo"].trecho === "string" ? o["modo"].trecho.trim() : "";
    if ((v === "continuo" || v === "pulsado") && tr.length >= 6) { out.campos["modoLaser"] = v; out.evidencias["modoLaser"] = tr; }
    else out.descartados.push("modo: valor ou trecho inválido");
  }
  if (tipo === "ondas_choque" && o["tipo"]) {
    const v = typeof o["tipo"].valor === "string" ? norm(o["tipo"].valor) : "";
    const tr = typeof o["tipo"].trecho === "string" ? o["tipo"].trecho.trim() : "";
    if ((v === "focal" || v === "radial") && tr.length >= 6) { out.campos["tipoOnda"] = v; out.evidencias["tipoOnda"] = tr; }
    else out.descartados.push("tipo: valor ou trecho inválido");
  }
  return out;
}
