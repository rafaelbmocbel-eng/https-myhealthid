import { ehChaveAchado, IDS_PROTOCOLO } from '@/lib/angular/movimento/protocolos';
import type { CriterioProfissional, FonteBiblio, IdProtocolo, OperadorCriterio } from '@/lib/angular/movimento/tipos';

/*
 * Leitura defensiva dos campos opcionais da Etapa 3 no arquivo .json da análise (critérios do profissional e protocolo do laudo).
 * Arquivos salvos antes da Etapa 3 não têm esses campos e abrem normalmente; o que vier malformado é descartado em silêncio, porque
 * um critério lido errado poderia gerar veredito com um limite que o profissional nunca definiu.
 */

const OPERADORES: readonly OperadorCriterio[] = ['<', '<=', '>', '>='];
const MAXIMO_DE_CRITERIOS = 50;

const ehObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const texto = (v: unknown): string => (typeof v === 'string' ? v : '');

function fonteValida(v: unknown): FonteBiblio | undefined {
  if (!ehObjeto(v)) return undefined;
  const { pmid, citacao, periodico, trecho, ano } = v;
  if (typeof pmid !== 'string' || typeof citacao !== 'string' || typeof periodico !== 'string' || typeof trecho !== 'string') return undefined;
  if (typeof ano !== 'number' || !Number.isFinite(ano)) return undefined;
  return {
    pmid, citacao, periodico, trecho, ano,
    ...(typeof v.doi === 'string' ? { doi: v.doi } : {}),
    ...(typeof v.populacao === 'string' ? { populacao: v.populacao } : {}),
    ...(typeof v.verificadoEm === 'string' ? { verificadoEm: v.verificadoEm } : {}),
  };
}

/**
 * Critério sem valor numérico (JSON guarda NaN como null) volta com NaN e desligado: sem limite definido não há veredito, e o
 * app nunca presume um valor.
 */
function criterioValido(v: unknown): CriterioProfissional | null {
  if (!ehObjeto(v)) return null;
  if (typeof v.id !== 'string' || !v.id) return null;
  if (typeof v.chave !== 'string' || !ehChaveAchado(v.chave)) return null;
  if (typeof v.metrica !== 'string' || !v.metrica) return null;
  if (typeof v.operador !== 'string' || !OPERADORES.includes(v.operador as OperadorCriterio)) return null;
  const valor = typeof v.valor === 'number' && Number.isFinite(v.valor) ? v.valor : Number.NaN;
  const fonte = fonteValida(v.fonte);
  return {
    id: v.id, chave: v.chave, metrica: v.metrica,
    ...(v.lado === 'D' || v.lado === 'E' ? { lado: v.lado } : {}),
    operador: v.operador as OperadorCriterio, valor, unidade: texto(v.unidade), rotulo: texto(v.rotulo), definidoPor: texto(v.definidoPor),
    ...(fonte ? { fonte } : {}),
    ativo: v.ativo === true && Number.isFinite(valor),
  };
}

/** Critérios válidos do arquivo, sem ids repetidos; `undefined` quando o campo não existe ou nada se aproveita. */
export function lerCriteriosSalvos(bruto: unknown): CriterioProfissional[] | undefined {
  if (!Array.isArray(bruto)) return undefined;
  const vistos = new Set<string>();
  const lidos: CriterioProfissional[] = [];
  for (const item of bruto.slice(0, MAXIMO_DE_CRITERIOS)) {
    const c = criterioValido(item);
    if (!c || vistos.has(c.id)) continue;
    vistos.add(c.id);
    lidos.push(c);
  }
  return lidos.length ? lidos : undefined;
}

export function lerProtocoloSalvo(bruto: unknown): IdProtocolo | undefined {
  return typeof bruto === 'string' && (IDS_PROTOCOLO as readonly string[]).includes(bruto) ? (bruto as IdProtocolo) : undefined;
}
