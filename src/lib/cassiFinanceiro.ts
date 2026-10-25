// Cálculo financeiro do mês do Controle CASSI (aba Faturamento).
// As regras daqui são as mesmas que já estavam dentro da tela: só saíram dela para a lista de
// clientes do mês poder escolher QUEM entra na conta sem mexer em COMO a conta é feita.
import type { GuiaCassi } from '@/lib/cassiGuias';

export interface CodigoComSessoes { codigo: string; sessoes?: number }

// Valor bruto de uma guia num mês. Soma código a código:
//  - 144 (avaliação) é um dia EXTRA separado → cobra 1x (se houve ≥1 sessão);
//  - códigos de tratamento cobram por dia de tratamento, limitado à quantidade
//    autorizada de CADA código (um código pode ter passado com menos, ou "não
//    passado" = 0). Se o código não tem quantidade própria, usa os dias do mês.
// `valorDe` resolve o valor de cada código pela config.
export function brutoGuia(codigos: CodigoComSessoes[], sessoes: number, valorDe: (c: string) => number): number {
  let total = 0;
  for (const c of (codigos || [])) {
    if (c.codigo === '144') {
      if ((c.sessoes ?? 1) >= 1 && sessoes >= 1) total += valorDe('144');
    } else {
      const cap = c.sessoes != null ? c.sessoes : sessoes;
      total += valorDe(c.codigo) * Math.max(0, Math.min(sessoes, cap));
    }
  }
  return total;
}

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

export interface ClienteFinanceiro {
  id: string;
  nome: string;
  sobrenome?: string | null;
  codigos_cassi?: string[] | null;
}
export type GuiaFinanceira = Pick<GuiaCassi, 'paciente_id' | 'codigos' | 'responsavel_tecnico'>;
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
}

// Fechamento do mês: para cada cliente com sessão, multiplica pelos valores dos códigos da guia mais
// recente, desconta o imposto por guia e agrupa por responsável técnico aplicando o % de repasse.
// `guias` vem da mais recente para a mais antiga (a primeira de cada cliente é a que vale).
export function fecharMes(entrada: {
  sessoesPorPac: ReadonlyMap<string, number>;
  pacientes: ClienteFinanceiro[];
  guias: GuiaFinanceira[];
  cfg: ConfigFinanceira | undefined;
}) {
  const { sessoesPorPac, pacientes, guias, cfg } = entrada;
  const nomePac = new Map(pacientes.map((p) => [p.id, `${p.nome} ${p.sobrenome || ''}`.trim()]));
  const codigosPac = new Map(pacientes.map((p) => [p.id, p.codigos_cassi || []]));

  // Guia mais recente por paciente (para códigos/responsável).
  const guiaPorPac = new Map<string, GuiaFinanceira>();
  for (const g of guias) if (!guiaPorPac.has(g.paciente_id)) guiaPorPac.set(g.paciente_id, g);

  const valorDe = (c: string) => cfg?.codigos.find((x) => x.codigo === c)?.valor || 0;
  const impostoPct = cfg?.imposto_percentual || 0;
  const impostoFixo = cfg?.imposto_por_guia || 0;

  const linhas: LinhaFechamento[] = [...sessoesPorPac.entries()]
    .filter(([, n]) => n > 0)
    .map(([pid, sessoes]) => {
      const guia = guiaPorPac.get(pid) || null;
      const codigos = guia?.codigos?.length
        ? guia.codigos
        : (codigosPac.get(pid)?.length ? codigosPac.get(pid)!.map((c) => ({ codigo: c })) : [{ codigo: '012' }]);
      const bruto = brutoGuia(codigos, sessoes, valorDe);
      // Imposto por guia: percentual do bruto (novo) ou o valor fixo antigo.
      const imposto = impostoPct > 0 ? bruto * (impostoPct / 100) : impostoFixo;
      const liquido = Math.max(0, bruto - imposto);
      return {
        pid,
        nome: nomePac.get(pid) || 'Cliente',
        responsavel: (guia?.responsavel_tecnico || '').trim(),
        sessoes, bruto, imposto, liquido,
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  const totBruto = linhas.reduce((s, l) => s + l.bruto, 0);
  const totImposto = linhas.reduce((s, l) => s + l.imposto, 0);
  const totLiquido = linhas.reduce((s, l) => s + l.liquido, 0);
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
