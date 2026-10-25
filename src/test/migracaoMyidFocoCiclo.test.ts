import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIMENSOES_MYID, MAXIMO_DIMENSOES_FOCO } from '@/utils/myid/focoCiclo';

const sql = readFileSync(join(__dirname, '..', '..', 'supabase', 'migrations', '20261025130000_myid_foco_ciclo.sql'), 'utf8');

describe('migração do foco do ciclo do MyID', () => {
  it('a lista de dimensões do banco é a mesma do código', () => {
    const lista = sql.match(/<@ ARRAY\[([^\]]+)\]::text\[\]/)?.[1] ?? '';
    const noBanco = [...lista.matchAll(/'([A-Z]+)'/g)].map((m) => m[1]);
    expect(noBanco.sort()).toEqual([...DIMENSOES_MYID].sort());
  });

  it('o limite de dimensões do banco é o do código', () => {
    expect(sql).toMatch(new RegExp(`cardinality\\(p_dimensoes\\) BETWEEN 1 AND ${MAXIMO_DIMENSOES_FOCO}\\b`));
  });

  it('a validação devolve false (e não NULL) para entrada nula, porque CHECK trata NULL como aprovado', () => {
    expect(sql).toMatch(/SELECT coalesce\(/);
    expect(sql).toMatch(/,\s*false\s*\)/);
    expect(sql).toMatch(/NOT EXISTS \(SELECT 1 FROM unnest\(p_dimensoes\) d WHERE d IS NULL\)/);
  });

  it('segurança por linha ligada, anon e público sem acesso, só o dono do paciente grava', () => {
    expect(sql).toContain('ALTER TABLE public.myid_foco_ciclo ENABLE ROW LEVEL SECURITY');
    expect(sql).toMatch(/REVOKE ALL ON public\.myid_foco_ciclo FROM PUBLIC, anon/);
    expect(sql).not.toMatch(/GRANT[^;]*myid_foco_ciclo[^;]*TO[^;]*\banon\b/);
    expect(sql).not.toMatch(/GRANT[^;]*myid_foco_ciclo[^;]*TO[^;]*\bPUBLIC\b/);
    for (const op of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
      expect(sql).toMatch(new RegExp(`CREATE POLICY[^;]*FOR ${op} TO authenticated`, 's'));
    }
    // Quem cria só aponta para paciente seu e para MyID desse mesmo paciente.
    expect(sql).toMatch(/FOR INSERT TO authenticated[\s\S]*?p\.terapeuta_id = auth\.uid\(\)[\s\S]*?a\.paciente_id = myid_foco_ciclo\.paciente_id/);
    expect(sql).toMatch(/FOR UPDATE TO authenticated[\s\S]*?WITH CHECK[\s\S]*?a\.paciente_id = myid_foco_ciclo\.paciente_id/);
  });

  it('a lista de dimensões precisa ser unidimensional (array multidimensional é recusado)', () => {
    expect(sql).toMatch(/array_ndims\(p_dimensoes\) = 1/);
  });

  it('o UPDATE também exige que o paciente seja do profissional (não dá para reapontar o ciclo para paciente de outro)', () => {
    const update = sql.slice(sql.indexOf('FOR UPDATE TO authenticated'), sql.indexOf('DROP POLICY IF EXISTS "Profissional apaga'));
    expect(update).toMatch(/WITH CHECK[\s\S]*?p\.terapeuta_id = auth\.uid\(\)/);
  });

  it('um ciclo aberto por paciente e profissional; apagar o paciente apaga os ciclos; apagar o MyID base preserva o ciclo', () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS uniq_myid_foco_ciclo_aberto[\s\S]*?\(paciente_id, terapeuta_id\)[\s\S]*?WHERE encerrado_em IS NULL/);
    expect(sql).toMatch(/paciente_id uuid NOT NULL REFERENCES public\.pacientes\(id\) ON DELETE CASCADE/);
    expect(sql).toMatch(/avaliacao_base_id uuid REFERENCES public\.avaliacoes_identidade\(id\) ON DELETE SET NULL/);
  });

  it('é idempotente (nada de CREATE sem IF NOT EXISTS/OR REPLACE nem política sem DROP prévio)', () => {
    expect(sql).not.toMatch(/CREATE TABLE (?!IF NOT EXISTS)/);
    expect(sql).not.toMatch(/CREATE INDEX (?!IF NOT EXISTS)/);
    expect(sql).not.toMatch(/CREATE UNIQUE INDEX (?!IF NOT EXISTS)/);
    const politicas = [...sql.matchAll(/CREATE POLICY "([^"]+)"/g)].map((m) => m[1]);
    expect(politicas).toHaveLength(4);
    for (const p of politicas) expect(sql).toContain(`DROP POLICY IF EXISTS "${p}"`);
  });
});
