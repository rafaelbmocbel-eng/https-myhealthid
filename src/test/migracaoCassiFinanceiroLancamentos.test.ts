import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { MAXIMO_GUIAS_NO_MES } from '@/lib/cassiFaturamento';

const pasta = join(__dirname, '..', '..', 'supabase', 'migrations');
const arquivo = '20261025230000_cassi_financeiro_lancamentos.sql';
const sql = readFileSync(join(pasta, arquivo), 'utf8');

describe('migração dos lançamentos do Faturamento CASSI', () => {
  it('vem depois da migração da lista e não repete a versão de nenhuma outra', () => {
    const todas = readdirSync(pasta).filter((f) => f.endsWith('.sql')).sort();
    expect(todas).toContain(arquivo);
    expect(arquivo > '20261025190000_cassi_financeiro_clientes.sql').toBe(true);
    expect(todas.filter((f) => f !== arquivo && f.slice(0, 14) === arquivo.slice(0, 14))).toEqual([]);
  });

  it('a coluna é obrigatória, nasce como lista vazia e a migração pode rodar de novo', () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS lancamentos jsonb NOT NULL DEFAULT '\[\]'::jsonb/);
    expect(sql).toMatch(/DROP CONSTRAINT IF EXISTS cassi_financeiro_clientes_lancamentos_validos/);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.cassi_lancamentos_validos/);
    expect(sql).toMatch(/DROP POLICY IF EXISTS "Profissional lança no cliente da lista do financeiro CASSI"/);
    expect(sql).not.toMatch(/CREATE TABLE/);
  });

  it('o banco valida o formato: lista de até 12 guias, cada uma um objeto { código: inteiro de 0 a 999 }, chave de 1 a 12 caracteres', () => {
    expect(sql).toMatch(/jsonb_array_length\(p\) > 12/);
    expect(sql).toMatch(/kv\.valor::text !~ '\^\[0-9\]\{1,3\}\$'/);
    expect(sql).toMatch(/length\(kv\.chave\) NOT BETWEEN 1 AND 12/);
    expect(sql).toMatch(/jsonb_typeof\(kv\.valor\) <> 'number'/);
    // NULL precisa dar false (um CHECK trata NULL como aprovado).
    expect(sql).toMatch(/WHEN p IS NULL OR jsonb_typeof\(p\) <> 'array'[^\n]*THEN false/);
    expect(sql).toMatch(/CHECK \(public\.cassi_lancamentos_validos\(lancamentos\)\)/);
  });

  it('a tela nunca lança mais guias do que o banco aceita', () => {
    expect(MAXIMO_GUIAS_NO_MES).toBeLessThanOrEqual(12);
  });

  it('só a coluna lancamentos pode ser atualizada: mês, cliente e profissional da linha não mudam', () => {
    expect(sql).toMatch(/GRANT UPDATE \(lancamentos\) ON public\.cassi_financeiro_clientes TO authenticated/);
    expect(sql).not.toMatch(/GRANT\s+(UPDATE|ALL)\s+ON\s+(TABLE\s+)?public\.cassi_financeiro_clientes/);
    expect(sql).not.toMatch(/GRANT[^;]*\b(TRUNCATE|REFERENCES|TRIGGER)\b/);
    expect(sql).not.toMatch(/\banon\b/);
  });

  it('a política de UPDATE é só do dono, na ida e na volta (USING e WITH CHECK)', () => {
    const politica = sql.slice(sql.indexOf('CREATE POLICY'), sql.indexOf('NOTIFY'));
    expect(politica).toMatch(/FOR UPDATE TO authenticated/);
    expect(politica).toMatch(/USING \(auth\.uid\(\) = terapeuta_id\)/);
    expect(politica).toMatch(/WITH CHECK \(auth\.uid\(\) = terapeuta_id\)/);
    expect(sql).toMatch(/NOTIFY pgrst, 'reload schema'/);
  });
});
