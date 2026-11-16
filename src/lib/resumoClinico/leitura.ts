// Leitura TOLERANTE do que o cliente escreveu (jsonb): campo ausente, tipo errado, texto vazio e lista com lixo
// viram "nada" em vez de derrubar a tela. O texto do cliente passa como ele escreveu, só sem espaços nas pontas.

type Objeto = Record<string, unknown>;

export function objeto(v: unknown): Objeto | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Objeto) : null;
}

// Alguns jsonb chegam como texto JSON (gravados duas vezes).
function objetoOuJson(v: unknown): Objeto | null {
  if (typeof v === 'string') {
    try {
      return objeto(JSON.parse(v));
    } catch {
      return null; // texto que não é JSON: não há o que ler
    }
  }
  return objeto(v);
}

export function textoLimpo(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return '';
}

export function listaDeTextos(v: unknown): string[] {
  if (typeof v === 'string') return v.trim() ? [v.trim()] : [];
  if (!Array.isArray(v)) return [];
  return v.map(textoLimpo).filter(Boolean);
}

const tem = (o: Objeto, chave: string) => Object.prototype.hasOwnProperty.call(o, chave);

// Rótulos exatos de Bloco1.tsx (MyID). Um teste confere que seguem iguais aos da tela do cliente.
export const FAIXA_DE_DURACAO_DO_MYID: Record<string, string> = {
  lt6w: 'Menos de 6 semanas',
  '6_12w': 'Entre 6 e 12 semanas',
  '3_12m': 'Entre 3 meses e 1 ano',
  gt1y: 'Mais de 1 ano',
};

export const MUDANCAS_DO_MYID: Record<string, string> = {
  equipment: 'Novo equipamento',
  load: 'Aumento de carga física',
  posture: 'Mudança de postura / contexto',
  scare: 'Susto físico / quase-lesão',
  none: 'Nenhuma mudança que eu note',
};

export interface CirurgiaLida {
  // Id que o formulário do cliente grava em cada item (HistoricoClinicoCard). Vazio nos itens antigos, sem id.
  id: string;
  // Posição no array original: é a chave de reserva do marco quando o item não tem id, e se mantém igual mesmo com
  // itens-lixo no meio.
  indice: number;
  tipo: string;
  anoOriginal: unknown;
  complicacoes: string;
}

export interface MedicamentoLido {
  nome: string;
  dose: string;
  frequencia: string;
}

export interface HistoricoClinicoLido {
  doencas: { condicoes: string[]; detalhes: string };
  cirurgias: CirurgiaLida[];
  medicamentos: MedicamentoLido[];
  alergias: { medicamentos: string; alimentos: string; outros: string };
  saudeMental: { condicoes: string[]; diagnosticoFormal: boolean; detalhes: string };
  familiar: { condicoes: string[]; detalhes: string };
  ultimoEnvio: unknown;
}

export function lerHistoricoClinico(bruto: unknown): HistoricoClinicoLido {
  const h = objetoOuJson(bruto) ?? {};
  const doencas = objeto(h.doencas_cronicas) ?? {};
  const alergias = objeto(h.alergias) ?? {};
  const mental = objeto(h.saude_mental) ?? {};
  const familiar = objeto(h.historico_familiar) ?? {};
  const itens = (v: unknown): unknown[] => {
    const lista = objeto(v)?.items;
    return Array.isArray(lista) ? lista : [];
  };

  const cirurgias: CirurgiaLida[] = [];
  itens(h.cirurgias).forEach((item, indice) => {
    const o = objeto(item);
    const tipo = textoLimpo(o?.tipo);
    if (!o || !tipo) return;
    cirurgias.push({ id: textoLimpo(o.id), indice, tipo, anoOriginal: o.ano, complicacoes: textoLimpo(o.complicacoes) });
  });

  const medicamentos: MedicamentoLido[] = [];
  itens(h.medicamentos).forEach((item) => {
    const o = objeto(item);
    const nome = textoLimpo(o?.nome);
    if (!o || !nome) return;
    medicamentos.push({ nome, dose: textoLimpo(o.dose), frequencia: textoLimpo(o.frequencia) });
  });

  return {
    doencas: { condicoes: listaDeTextos(doencas.condicoes), detalhes: textoLimpo(doencas.detalhes) },
    cirurgias,
    medicamentos,
    alergias: { medicamentos: textoLimpo(alergias.medicamentos), alimentos: textoLimpo(alergias.alimentos), outros: textoLimpo(alergias.outros) },
    saudeMental: { condicoes: listaDeTextos(mental.condicoes), diagnosticoFormal: mental.diagnostico_formal === true, detalhes: textoLimpo(mental.detalhes) },
    familiar: { condicoes: listaDeTextos(familiar.condicoes), detalhes: textoLimpo(familiar.detalhes) },
    ultimoEnvio: h.ultimo_envio,
  };
}

export interface HistoriaAtualLida {
  queixa: string;
  inicio: string;
  fatores: string;
  impacto: string;
}

export function lerHistoriaAtual(bruto: unknown): HistoriaAtualLida {
  const h = objetoOuJson(bruto) ?? {};
  return {
    queixa: textoLimpo(h.queixa),
    inicio: textoLimpo(h.inicio),
    fatores: textoLimpo(h.fatores),
    impacto: textoLimpo(h.impacto),
  };
}

export interface MyidLido {
  queixa: string;
  // Rótulo humano da faixa; vazio quando o código não é um dos quatro do MyID.
  faixaDeDuracao: string;
  quandoTexto: string;
  oQueFazia: string;
  mudancas: string[];
}

export function lerRespostasDoMyid(bruto: unknown): MyidLido {
  const r = objetoOuJson(bruto) ?? {};
  const codigo = textoLimpo(r.bloco_1_duracao);
  const mudancas = listaDeTextos(r.bloco_1_changes)
    .filter((c) => tem(MUDANCAS_DO_MYID, c))
    .map((c) => MUDANCAS_DO_MYID[c]);
  return {
    queixa: textoLimpo(r.bloco_1_queixa),
    faixaDeDuracao: tem(FAIXA_DE_DURACAO_DO_MYID, codigo) ? FAIXA_DE_DURACAO_DO_MYID[codigo] : '',
    quandoTexto: textoLimpo(r.bloco_1_quando_data),
    oQueFazia: textoLimpo(r.bloco_1_quando_desc),
    mudancas,
  };
}

export const myidConcluido = (linha: unknown): boolean => textoLimpo(objeto(linha)?.status) === 'concluido';

// "sentar_levantar_30s" -> "Sentar levantar 30s": só formata o código que o app gravou, não cria rótulo novo.
export function humanizarCodigo(codigo: unknown): string {
  const t = textoLimpo(codigo).replace(/_/g, ' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}
