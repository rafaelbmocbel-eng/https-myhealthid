// REFERÊNCIA: o cálculo do mês e a tendência EXATAMENTE como estavam em ControleCassi.tsx antes da lista de
// clientes do mês (commit 36255aef). Serve só para provar que a conta nova, com todos os clientes na lista,
// dá o mesmo resultado. Não importar em código de produção.
import type { GuiaCassi } from '@/lib/cassiGuias';

type Paciente = { id: string; nome: string; sobrenome: string | null; codigos_cassi: string[] };
type Cfg = {
  codigos: Array<{ codigo: string; valor: number }>;
  responsaveis: Array<{ nome: string; percentual: number }>;
  imposto_por_guia: number; imposto_percentual: number; minha_parte_percentual: number;
} | undefined;
type Ag = { paciente_id: string | null; data_inicio: string; status: string; tipo_atendimento?: string };

function brutoGuia(codigos: Array<{ codigo: string; sessoes?: number }>, sessoes: number, valorDe: (c: string) => number): number {
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

export function calcOriginal({ mes, pacientes, guias, agendamentos, cfg, agora }: {
  mes: string; pacientes: Paciente[]; guias: GuiaCassi[]; agendamentos: Ag[]; cfg: Cfg; agora: number;
}) {
    const [ano, m] = mes.split('-').map(Number);
    // (agora vem por parâmetro)
    const cassiIds = new Set(pacientes.map((p) => p.id));
    const nomePac = new Map(pacientes.map((p) => [p.id, `${p.nome} ${p.sobrenome || ''}`.trim()]));
    const codigosPac = new Map(pacientes.map((p) => [p.id, p.codigos_cassi || []]));

    // Guia mais recente por paciente (para códigos/responsável).
    const guiaPorPac = new Map<string, GuiaCassi>();
    for (const g of guias) if (!guiaPorPac.has(g.paciente_id)) guiaPorPac.set(g.paciente_id, g);

    // Conta sessões realizadas no mês local, por paciente CASSI.
    const sessoesPorPac = new Map<string, number>();
    for (const a of agendamentos) {
      if (!a.paciente_id || !cassiIds.has(a.paciente_id)) continue;
      if (a.tipo_atendimento === 'avaliacao') continue; // dia extra, não é dia de tratamento
      if (a.status === 'cancelado' || a.status === 'faltou' || a.status === 'bloqueado' || a.status === 'pendente') continue;
      const d = new Date(a.data_inicio);
      if (d.getFullYear() !== ano || d.getMonth() !== m - 1) continue; // mês local
      if (d.getTime() > agora) continue; // ainda não aconteceu
      sessoesPorPac.set(a.paciente_id, (sessoesPorPac.get(a.paciente_id) || 0) + 1);
    }

    const valorDe = (c: string) => cfg?.codigos.find((x) => x.codigo === c)?.valor || 0;
    const impostoPct = cfg?.imposto_percentual || 0;
    const impostoFixo = cfg?.imposto_por_guia || 0;

    const linhas = [...sessoesPorPac.entries()]
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

export function tendenciaOriginal({ mes, pacientes, guias, agsTrend, cfg, agora }: {
  mes: string; pacientes: Paciente[]; guias: GuiaCassi[]; agsTrend: Ag[]; cfg: Cfg; agora: number;
}) {
  const MESES_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const [ya, ma] = mes.split('-').map(Number);
    // (agora vem por parâmetro)
    const cassiIds = new Set(pacientes.map((p) => p.id));
    const codigosPac = new Map(pacientes.map((p) => [p.id, p.codigos_cassi || []]));
    const guiaPorPac = new Map<string, GuiaCassi>();
    for (const g of guias) if (!guiaPorPac.has(g.paciente_id)) guiaPorPac.set(g.paciente_id, g);
    const valorDe = (c: string) => cfg?.codigos.find((x) => x.codigo === c)?.valor || 0;
    const impostoPct = cfg?.imposto_percentual || 0;
    const impostoFixo = cfg?.imposto_por_guia || 0;
    const minhaPct = cfg?.minha_parte_percentual || 0;

    const meses = [] as Array<{ y: number; m: number; label: string; sess: Map<string, number> }>;
    for (let i = 5; i >= 0; i--) {
      const d = new Date(ya, ma - 1 - i, 1);
      meses.push({ y: d.getFullYear(), m: d.getMonth(), label: MESES_PT[d.getMonth()].slice(0, 3), sess: new Map() });
    }
    const idxDe = (y: number, mo: number) => meses.findIndex((x) => x.y === y && x.m === mo);
    for (const a of agsTrend) {
      if (!a.paciente_id || !cassiIds.has(a.paciente_id)) continue;
      if (a.tipo_atendimento === 'avaliacao') continue;
      if (a.status === 'cancelado' || a.status === 'faltou' || a.status === 'bloqueado' || a.status === 'pendente') continue;
      const d = new Date(a.data_inicio);
      if (d.getTime() > agora) continue;
      const k = idxDe(d.getFullYear(), d.getMonth());
      if (k < 0) continue;
      meses[k].sess.set(a.paciente_id, (meses[k].sess.get(a.paciente_id) || 0) + 1);
    }
    return meses.map((mm) => {
      let liquido = 0;
      for (const [pid, sessoes] of mm.sess) {
        if (sessoes <= 0) continue;
        const guia = guiaPorPac.get(pid) || null;
        const codigos = guia?.codigos?.length
          ? guia.codigos
          : (codigosPac.get(pid)?.length ? codigosPac.get(pid)!.map((c) => ({ codigo: c })) : [{ codigo: '012' }]);
        const bruto = brutoGuia(codigos, sessoes, valorDe);
        const imposto = impostoPct > 0 ? bruto * (impostoPct / 100) : impostoFixo;
        liquido += Math.max(0, bruto - imposto);
      }
      return { label: mm.label, suaParte: liquido * (minhaPct / 100) };
    });
}
