import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CODIGOS_PADRAO_FATURAMENTO } from '@/lib/cassiFaturamento';

const pasta = join(__dirname, '..', '..', 'supabase', 'migrations');
const arquivo = '20261025233000_cassi_config_codigos_tabela_cassi.sql';
const sql = readFileSync(join(pasta, arquivo), 'utf8');

const listaDoSql = (): Array<{ codigo: string; descricao: string; valor: number; codigo_oficial: string }> => {
  const m = sql.match(/v_padrao jsonb := '(\[[\s\S]*?\])'::jsonb;/);
  expect(m).not.toBeNull();
  return JSON.parse(m![1]);
};

describe('migração que atualiza os códigos e valores salvos em cassi_config (25/10/2026)', () => {
  it('vem depois da migração dos lançamentos e não repete a versão de nenhuma outra', () => {
    const todas = readdirSync(pasta).filter((f) => f.endsWith('.sql')).sort();
    expect(todas).toContain(arquivo);
    expect(arquivo > '20261025230000_cassi_financeiro_lancamentos.sql').toBe(true);
    expect(todas.filter((f) => f !== arquivo && f.slice(0, 14) === arquivo.slice(0, 14))).toEqual([]);
  });

  it('a lista do SQL é a mesma tabela do app: código, descrição, valor e código oficial', () => {
    const doSql = listaDoSql();
    expect(doSql.map((c) => c.codigo)).toEqual(['012', '020', '301', '131', '185']);
    for (const item of doSql) {
      const noApp = CODIGOS_PADRAO_FATURAMENTO.find((c) => c.codigo === item.codigo);
      expect(noApp, `código ${item.codigo} existe no app`).toBeDefined();
      expect({ descricao: item.descricao, valor: item.valor, codigo_oficial: item.codigo_oficial })
        .toEqual({ descricao: noApp!.descricao, valor: noApp!.valor, codigo_oficial: noApp!.codigo_oficial });
    }
  });

  it('o 144, que não está na lista nova, não é tocado', () => {
    expect(listaDoSql().map((c) => c.codigo)).not.toContain('144');
  });

  it('guarda uma cópia antes de mexer, fechada para a API, e não sobrescreve a cópia ao rodar de novo', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.bkp_cassi_config_codigos_20261025/);
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/REVOKE ALL ON public\.bkp_cassi_config_codigos_20261025 FROM PUBLIC, anon, authenticated/);
    expect(sql).toMatch(/ON CONFLICT \(terapeuta_id\) DO NOTHING/);
    expect(sql.indexOf('INSERT INTO public.bkp_cassi_config_codigos_20261025')).toBeLessThan(sql.indexOf('UPDATE public.cassi_config'));
  });

  it('mexe só na configuração dele (por e-mail) e, sem achar o e-mail, só se houver uma única configuração', () => {
    expect(sql).toMatch(/lower\(email\) = 'rafaelbmocbel@gmail\.com'/);
    expect(sql).toMatch(/SELECT count\(\*\) FROM public\.cassi_config\) = 1/);
    expect(sql).toMatch(/UPDATE public\.cassi_config SET codigos = v_novo, updated_at = now\(\) WHERE terapeuta_id = v_ter/);
  });

  it('não cria configuração nem mexe em configuração que não é uma lista', () => {
    expect(sql).toMatch(/jsonb_typeof\(v_atual\) <> 'array' OR jsonb_array_length\(v_atual\) = 0 THEN[\s\S]*?RAISE NOTICE '[^']*';\s*RETURN;/);
    expect(sql).not.toMatch(/INSERT INTO public\.cassi_config/);
  });

  it('lista de códigos vazia ([]) é tratada como "sem lista salva": nada é alterado e o app segue com os padrões e o 160 antigo', () => {
    expect(sql).toMatch(/jsonb_typeof\(v_atual\) <> 'array' OR jsonb_array_length\(v_atual\) = 0 THEN/);
  });

  it('cada RAISE NOTICE tem tantos argumentos quanto % no texto (senão o db push quebra) e os de saída antecipada vêm antes do RETURN', () => {
    const achados = [...sql.matchAll(/RAISE NOTICE\s+'((?:[^']|'')*)'\s*([\s\S]*?);\s*(?:\n|$)/g)];
    expect(achados.length).toBeGreaterThanOrEqual(5);
    for (const [, texto, resto] of achados) {
      const marcas = (texto.match(/%/g) ?? []).length;
      let profundidade = 0; let virgulas = 0; let aspas = false;
      for (const ch of resto.replace(/^\s*,/, ',')) {
        if (ch === "'") aspas = !aspas;
        if (aspas) continue;
        if (ch === '(') profundidade++;
        if (ch === ')') profundidade--;
        if (ch === ',' && profundidade === 0) virgulas++;
      }
      expect(virgulas, texto).toBe(marcas);
    }
    expect(sql).toMatch(/RAISE NOTICE '[^']*nenhuma conta identificada[^']*';\s*RETURN;/);
    expect(sql).toMatch(/RAISE NOTICE '[^']*não tem lista de códigos salva[^']*';\s*RETURN;/);
  });

  it('conta no log do db push o caminho que tomou (conta achada, só uma configuração, nada identificado, sem lista, atualizado)', () => {
    const avisos: string[] = sql.match(/RAISE NOTICE '([^']*)'/g) ?? [];
    for (const trecho of ['conta achada pelo e-mail', 'usando a única configuração existente', 'nenhuma conta identificada', 'não tem lista de códigos salva', 'atualizado (']) {
      expect(avisos.some((a) => a.includes(trecho)), trecho).toBe(true);
    }
  });
});
