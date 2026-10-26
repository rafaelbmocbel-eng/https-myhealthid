// Cálculo financeiro do mês do Controle CASSI (aba Faturamento).
// O valor do mês sai do que o profissional lançou em cada cliente (códigos e quantidades — ver cassiFaturamento.ts);
// a agenda só serve de referência (quantas sessões o cliente teve) e para sugerir quem adicionar à lista.
import { brutoDosLancamentos, sessoesDosLancamentos, resumoDosLancamentos, type GuiaLancada } from '@/lib/cassiFaturamento';

export interface AgendamentoFinanceiro {
  paciente_id: string | null;
  data_inicio: string;
  status: string;
  tipo_atendimento?: string;
}

// Conta as sessões REALIZADAS no mês local, por cliente: ignora avaliação (dia extra),
// cancelado/faltou/bloqueado/pendente e o que ainda não aconteceu. `ids` limita a quem entra na conta.
export function contarSessoesDoMes(
  agendamentos: AgendamentoFinanceiro[],
  ano: number,
  mes: number, // 1 a 12
  ids: ReadonlySet<string>,
  agora: number,
): Map<string, number> {
  const sessoesPorPac = new Map<string, number>();
  for (const a of agendamentos) {
    if (!a.paciente_id || !ids.has(a.paciente_id)) continue;
    if (a.tipo_atendimento === 'avaliacao') continue; // dia extra, não é dia de tratamento
    if (a.status === 'cancelado' || a.status === 'faltou' || a.status === 'bloqueado' || a.status === 'pendente') continue;
    const d = new Date(a.data_inicio);
    if (d.getFullYear() !== ano || d.getMonth() !== mes - 1) continue; // mês local
    if (d.getTime() > agora) continue; // ainda não aconteceu
    sessoesPorPac.set(a.paciente_id, (sessoesPorPac.get(a.paciente_id) || 0) + 1);
  }
  return sessoesPorPac;
}

export interface ConfigFinanceira {
  codigos: Array<{ codigo: string; valor: number }>;
  responsaveis: Array<{ nome: string; percentual: number }>;
  imposto_por_guia: number;
  imposto_percentual: number;
  minha_parte_percentual: number;
}

export interface LinhaFechamento {
  pid: string;
  nome: string;
  responsavel: string;
  sessoes: number;
  bruto: number;
  imposto: number;
  liquido: number;
  resumo?: string; // "012 × 10 · 301 × 2"
}

// Totais do mês a partir de uma linha por cliente: imposto, líquido, sua parte × clínica e repasse por responsável.
export function agregarFechamento(linhas: LinhaFechamento[], cfg: ConfigFinanceira | undefined) {
  const impostoPct = cfg?.imposto_percentual || 0;

  // Soma em centavos: o total é a soma das linhas que aparecem na tela, sem ruído de ponto flutuante.
  const somaEmCentavos = (f: (l: LinhaFechamento) => number) => linhas.reduce((s, l) => s + Math.round(f(l) * 100), 0) / 100;
  const totBruto = somaEmCentavos((l) => l.bruto);
  const totImposto = somaEmCentavos((l) => l.imposto);
  const totLiquido = somaEmCentavos((l) => l.liquido);
  const totSessoes = linhas.reduce((s, l) => s + l.sessoes, 0);

  // Repasse por responsável (casa nome com a config, sem acento/caixa).
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const pctDe = (nome: string) => {
    const r = (cfg?.responsaveis || []).find((x) => norm(x.nome) === norm(nome));
    return r ? r.percentual : null;
  };
  const porResp = new Map<string, { nome: string; liquido: number; sessoes: number; pct: number | null }>();
  for (const l of linhas) {
    const key = l.responsavel || '—';
    const cur = porResp.get(key) || { nome: l.responsavel || 'Sem responsável', liquido: 0, sessoes: 0, pct: pctDe(l.responsavel) };
    cur.liquido += l.liquido;
    cur.sessoes += l.sessoes;
    porResp.set(key, cur);
  }
  const repasses = [...porResp.values()].map((r) => ({
    ...r,
    repasse: r.pct != null ? r.liquido * (r.pct / 100) : 0,
  })).sort((a, b) => b.liquido - a.liquido);
  const totRepasse = repasses.reduce((s, r) => s + r.repasse, 0);

  // Divisão principal: sua parte (% do líquido) e o que fica com a clínica.
  const minhaPct = cfg?.minha_parte_percentual || 0;
  const suaParte = totLiquido * (minhaPct / 100);
  const parteClinica = totLiquido - suaParte;

  return {
    linhas, totBruto, totImposto, totLiquido, totSessoes, impostoPct,
    minhaPct, suaParte, parteClinica,
    repasses, totRepasse, ficaComVoce: totLiquido - totRepasse,
  };
}

export interface ClienteParaFechar {
  id: string;
  nome: string;
  responsavel: string; // responsável técnico da guia mais recente do cliente
  guias: GuiaLancada[];
}

// Fechamento do mês: para cada cliente da lista com algo lançado, bruto = Σ quantidade × valor do código,
// imposto sobre o bruto (percentual; o valor fixo antigo vale por guia lançada) e líquido. Cliente sem lançamento
// fica de fora da tabela e dos totais.
export function fecharMesPorLancamentos(entrada: { clientes: ClienteParaFechar[]; cfg: ConfigFinanceira | undefined }) {
  const { clientes, cfg } = entrada;
  const valorDe = (c: string) => cfg?.codigos.find((x) => x.codigo === c)?.valor || 0;
  const impostoPct = cfg?.imposto_percentual || 0;
  const impostoFixo = cfg?.imposto_por_guia || 0;

  const linhas: LinhaFechamento[] = clientes
    .map((c) => {
      const bruto = brutoDosLancamentos(c.guias, valorDe);
      const sessoes = sessoesDosLancamentos(c.guias);
      // Imposto: percentual do bruto (novo) ou o valor fixo antigo, por guia lançada. Arredondado a centavos em cada
      // cliente, para a soma das linhas bater com o total.
      const brutoCentavos = Math.round(bruto * 100);
      const impostoCentavos = impostoPct > 0 ? Math.round(brutoCentavos * (impostoPct / 100)) : Math.round(impostoFixo * c.guias.length * 100);
      const imposto = impostoCentavos / 100;
      const liquido = Math.max(0, brutoCentavos - impostoCentavos) / 100;
      return { pid: c.id, nome: c.nome, responsavel: c.responsavel.trim(), sessoes, bruto, imposto, liquido, resumo: resumoDosLancamentos(c.guias), lancou: c.guias.length > 0 };
    })
    .filter((l) => l.lancou)
    .map(({ lancou: _lancou, ...l }) => l)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return agregarFechamento(linhas, cfg);
}

// 'AAAA-MM' do mês `delta` meses depois (ou antes, se negativo) de `mes`.
export function somarMeses(mes: string, delta: number): string {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Meses de `fim` para trás: [fim-(n-1), …, fim], em 'AAAA-MM'.
export function ultimosMeses(fim: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => somarMeses(fim, -(n - 1 - i)));
}
