import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const pasta = join(__dirname, '..', '..', 'supabase', 'migrations');
const arquivo = '20261025190000_cassi_financeiro_clientes.sql';
const sql = readFileSync(join(pasta, arquivo), 'utf8');

describe('migração da lista de clientes do financeiro CASSI', () => {
  it('vem depois da última migração que existia quando foi escrita (nada fica antes dela por engano)', () => {
    const todas = readdirSync(pasta).filter((f) => f.endsWith('.sql')).sort();
    expect(todas).toContain(arquivo);
    expect(arquivo > '20261025130000_myid_foco_ciclo.sql').toBe(true);
    // sem timestamp repetido: nenhuma outra migração com a mesma versão (os 14 primeiros dígitos)
    expect(todas.filter((f) => f !== arquivo && f.slice(0, 14) === arquivo.slice(0, 14))).toEqual([]);
  });

  it('uma linha por profissional, mês e cliente; mês só no formato AAAA-MM com 01 a 12', () => {
    expect(sql).toMatch(/CONSTRAINT cassi_financeiro_clientes_unico UNIQUE \(terapeuta_id, mes, paciente_id\)/);
    const regex = sql.match(/CHECK \(mes ~ '([^']+)'\)/)?.[1];
    expect(regex).toBeTruthy();
    const re = new RegExp(regex as string);
    for (const ok of ['2026-01', '2026-10', '2026-12', '1999-09']) expect(re.test(ok)).toBe(true);
    for (const ruim of ['2026-13', '2026-00', '2026-1', '26-10', '2026-10-01', '', 'outubro']) expect(re.test(ruim)).toBe(false);
  });

  it('apagar o cliente apaga a linha da lista; o profissional vem do login', () => {
    expect(sql).toMatch(/paciente_id uuid NOT NULL REFERENCES public\.pacientes\(id\) ON DELETE CASCADE/);
    expect(sql).toMatch(/terapeuta_id uuid NOT NULL DEFAULT auth\.uid\(\)/);
  });

  it('segurança por linha ligada; anon e público sem acesso; só o dono lê, adiciona e tira; sem UPDATE', () => {
    expect(sql).toContain('ALTER TABLE public.cassi_financeiro_clientes ENABLE ROW LEVEL SECURITY');
    expect(sql).toMatch(/REVOKE ALL ON public\.cassi_financeiro_clientes FROM PUBLIC, anon, authenticated;/);
    // o REVOKE vem antes do GRANT (o contrário apagaria o que foi concedido)
    expect(sql.indexOf('REVOKE ALL ON public.cassi_financeiro_clientes')).toBeLessThan(sql.indexOf('GRANT SELECT, INSERT, DELETE'));
    expect(sql).not.toMatch(/GRANT[^;]*cassi_financeiro_clientes[^;]*TO[^;]*\banon\b/);
    expect(sql).not.toMatch(/GRANT[^;]*cassi_financeiro_clientes[^;]*TO[^;]*\bPUBLIC\b/);
    expect(sql).toMatch(/GRANT SELECT, INSERT, DELETE ON public\.cassi_financeiro_clientes TO authenticated/);
    expect(sql).not.toMatch(/FOR UPDATE/);
    for (const op of ['SELECT', 'INSERT', 'DELETE']) {
      expect(sql).toMatch(new RegExp(`CREATE POLICY[^;]*FOR ${op} TO authenticated`, 's'));
    }
    expect(sql).toMatch(/FOR SELECT TO authenticated\s+USING \(auth\.uid\(\) = terapeuta_id\)/);
    expect(sql).toMatch(/FOR DELETE TO authenticated\s+USING \(auth\.uid\(\) = terapeuta_id\)/);
  });

  it('authenticated recebe EXATAMENTE SELECT, INSERT e DELETE: nenhum outro privilégio (TRUNCATE passa por cima da segurança por linha)', () => {
    const concessoes = [...sql.matchAll(/GRANT\s+([^;]+?)\s+ON\s+(?:TABLE\s+)?public\.cassi_financeiro_clientes\s+TO\s+([^;]+);/g)]
      .map((m) => ({ privilegios: m[1].replace(/\s+/g, ' ').toUpperCase(), para: m[2].split(',').map((x) => x.trim().toLowerCase()) }));
    const paraAuthenticated = concessoes.filter((c) => c.para.includes('authenticated'));
    expect(paraAuthenticated.map((c) => c.privilegios)).toEqual(['SELECT, INSERT, DELETE']);
    // Quem mais recebe algo: só o service_role (acesso do servidor).
    const outros = concessoes.filter((c) => !c.para.includes('authenticated')).flatMap((c) => c.para);
    expect(new Set(outros)).toEqual(new Set(['service_role']));
  });

  it('quem adiciona só pode apontar para cliente seu', () => {
    const insert = sql.slice(sql.indexOf('FOR INSERT TO authenticated'), sql.indexOf('DROP POLICY IF EXISTS "Profissional tira'));
    expect(insert).toMatch(/WITH CHECK[\s\S]*auth\.uid\(\) = terapeuta_id/);
    expect(insert).toMatch(/EXISTS \(SELECT 1 FROM public\.pacientes p WHERE p\.id = paciente_id AND p\.terapeuta_id = auth\.uid\(\)\)/);
  });

  it('é idempotente e avisa o PostgREST do novo esquema', () => {
    expect(sql).not.toMatch(/CREATE TABLE (?!IF NOT EXISTS)/);
    expect(sql).not.toMatch(/CREATE INDEX (?!IF NOT EXISTS)/);
    const politicas = [...sql.matchAll(/CREATE POLICY "([^"]+)"/g)].map((m) => m[1]);
    expect(politicas).toHaveLength(3);
    for (const p of politicas) expect(sql).toContain(`DROP POLICY IF EXISTS "${p}"`);
    expect(sql).toMatch(/NOTIFY pgrst, 'reload schema'/);
  });

  it('o nome da tabela e das colunas é o que o código usa', () => {
    const hook = readFileSync(join(__dirname, '..', 'hooks', 'useClientesFinanceiroCassi.ts'), 'utf8');
    expect(hook).toContain("const TABELA = 'cassi_financeiro_clientes'");
    for (const coluna of ['terapeuta_id', 'mes', 'paciente_id']) {
      expect(sql).toMatch(new RegExp(`\\b${coluna} (uuid|text)`));
      expect(hook).toContain(coluna);
    }
  });
});
