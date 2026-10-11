import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CATEGORIAS,
  consultaUsada,
  montarConsulta,
  NIVEIS,
} from '../../supabase/functions/_shared/pesquisa-profissional';

// Guarda o CONTRATO da migration 20261011000000 (pesquisa automática de profissionais). O comportamento foi
// validado num Postgres descartável (permissões, limites, sanitização, idempotência); aqui ficam as regras que
// não podem regredir por descuido: nada de apagar dados, RLS sem policy, super-admin dentro das RPCs de leitura,
// RPCs de escrita só do service_role e as listas do banco iguais às do módulo TS.
const SQL = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261011000000_pesquisa_profissional.sql'), 'utf8');

const CODIGO = SQL.replace(/^\s*--.*$/gm, '');

const FUNCOES = new Map<string, string>();
for (const parte of SQL.split('CREATE OR REPLACE FUNCTION public.').slice(1)) {
  FUNCOES.set(parte.slice(0, parte.indexOf('(')), parte.slice(0, parte.indexOf('$$;') + 3));
}
const funcao = (nome: string) => {
  const corpo = FUNCOES.get(nome);
  if (!corpo) throw new Error(`função ${nome} não está na migration`);
  return corpo;
};

const LEITURA_DO_ADMIN = ['pesquisa_profissional_ultima', 'pesquisas_profissionais_resumo'];
const SO_SERVIDOR = ['pesquisa_profissional_pode_pesquisar', 'registrar_pesquisa_profissional'];

describe('migration da pesquisa de profissionais: dados e tabela', () => {
  it('é idempotente e não apaga nada', () => {
    expect(CODIGO).not.toMatch(/\bDROP\s+(TABLE|COLUMN|FUNCTION|POLICY|CONSTRAINT|INDEX)\b/i);
    expect(CODIGO).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(CODIGO).not.toMatch(/\bTRUNCATE\b/i);
    expect(CODIGO).not.toMatch(/\bCREATE\s+TABLE\s+(?!IF NOT EXISTS)/i);
    expect(CODIGO).not.toMatch(/\bCREATE\s+(UNIQUE\s+)?INDEX\s+(?!IF NOT EXISTS)/i);
    expect(CODIGO).not.toMatch(/\bCREATE\s+FUNCTION\b/i);
    expect(CODIGO).not.toMatch(/\bUPDATE\s+public\.(?!profissional_pesquisas\b)/i);
  });

  it('cria profissional_pesquisas com RLS ligado e NENHUMA policy', () => {
    expect(SQL).toMatch(/CREATE TABLE IF NOT EXISTS public\.profissional_pesquisas/);
    expect(SQL).toMatch(/ALTER TABLE public\.profissional_pesquisas ENABLE ROW LEVEL SECURITY/);
    expect(CODIGO).not.toMatch(/CREATE POLICY/i);
  });

  it('só o service_role tem acesso à tabela', () => {
    expect(SQL).toMatch(/REVOKE ALL ON public\.profissional_pesquisas FROM PUBLIC, anon, authenticated/);
    expect(SQL).toMatch(/GRANT ALL ON public\.profissional_pesquisas TO service_role/);
    expect(CODIGO).not.toMatch(/GRANT\s+[A-Z, ]+\s+ON\s+(TABLE\s+)?public\.profissional_pesquisas\s+TO\s+[^;]*(authenticated|anon|public)/i);
  });

  it('tem as colunas do contrato e nenhuma de e-mail ou telefone', () => {
    const tabela = SQL.slice(SQL.indexOf('CREATE TABLE IF NOT EXISTS'), SQL.indexOf(');', SQL.indexOf('CREATE TABLE IF NOT EXISTS')));
    for (const coluna of ['id uuid PRIMARY KEY', 'user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE', 'pesquisado_por uuid NOT NULL', 'pesquisado_em timestamptz NOT NULL DEFAULT now()', 'nivel_indicio text NOT NULL', 'resumo text', "achados jsonb NOT NULL DEFAULT '[]'::jsonb", 'consulta_usada jsonb', 'modelo text', 'erro text']) {
      expect(tabela).toContain(coluna);
    }
    expect(tabela).not.toMatch(/mail|telefone|fone|cpf/i);
  });

  it('os níveis aceitos pela tabela e pela RPC são os do módulo TS', () => {
    const lista = (trecho: string) => [...trecho.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    const daTabela = SQL.match(/CHECK \(nivel_indicio IN \(([^)]*)\)\)/)?.[1] ?? '';
    const daRpc = funcao('registrar_pesquisa_profissional').match(/p_nivel_indicio NOT IN \(([^)]*)\)/)?.[1] ?? '';
    expect(lista(daTabela)).toEqual([...NIVEIS].sort());
    expect(lista(daRpc)).toEqual([...NIVEIS].sort());
  });

  it('as categorias aceitas pela RPC são as do módulo TS', () => {
    const trecho = funcao('registrar_pesquisa_profissional').match(/'categoria'\) IN \(([^)]*)\)/)?.[1] ?? '';
    expect([...trecho.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort()).toEqual([...CATEGORIAS].sort());
  });

  it('as chaves permitidas em consulta_usada são exatamente as que o módulo grava', () => {
    const trecho = funcao('registrar_pesquisa_profissional').match(/k\.key IN \(([^)]*)\)/)?.[1] ?? '';
    const permitidas = [...trecho.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    const completa = montarConsulta({
      nome: 'Maria', sobrenome: 'Souza Lima', perfil_profissional: 'fisioterapeuta',
      registro_profissional: 'CREFITO 3/12345-F', cidade: 'Belo Horizonte', uf: 'MG',
    });
    expect(completa).not.toBeNull();
    expect(Object.keys(consultaUsada(completa!)).sort()).toEqual(permitidas);
    expect(permitidas).not.toContain('email');
    expect(permitidas).not.toContain('telefone');
    expect(funcao('registrar_pesquisa_profissional')).toMatch(/position\('@' IN k\.value\) = 0/);
  });
});

describe('migration da pesquisa de profissionais: RPCs', () => {
  it.each(LEITURA_DO_ADMIN)('%s é SECURITY DEFINER, fixa o search_path e exige o super-admin lá dentro', (nome) => {
    const f = funcao(nome);
    expect(f).toMatch(/SECURITY DEFINER SET search_path = public/);
    expect(f).toMatch(/IF NOT public\.eh_super_admin\(\) THEN\s+RAISE EXCEPTION 'Apenas o administrador MyHealthID'/);
    expect(f.indexOf('eh_super_admin')).toBeLessThan(f.indexOf('profissional_pesquisas'));
  });

  it.each(LEITURA_DO_ADMIN)('%s: sem anon e sem public, com authenticated', (nome) => {
    expect(SQL).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${nome}\\([^)]*\\) FROM public, anon;`));
    expect(SQL).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${nome}\\([^)]*\\) TO authenticated;`));
  });

  it.each(SO_SERVIDOR)('%s é SECURITY DEFINER e só o service_role executa', (nome) => {
    expect(funcao(nome)).toMatch(/SECURITY DEFINER SET search_path = public/);
    expect(SQL).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${nome}\\([^)]*\\)\\s+FROM public, anon, authenticated;`));
    const concessao = SQL.match(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${nome}\\([^)]*\\)\\s+TO ([a-z_, ]+);`));
    expect(concessao?.[1]).toBe('service_role');
  });

  it('os limites são 1 por profissional a cada 10 minutos e 60 no total em 24 horas', () => {
    const f = funcao('pesquisa_profissional_pode_pesquisar');
    expect(f).toMatch(/c_intervalo CONSTANT interval := interval '10 minutes'/);
    expect(f).toMatch(/c_dia CONSTANT interval := interval '24 hours'/);
    expect(f).toMatch(/c_max_dia CONSTANT integer := 60/);
    expect(f).toContain("'limite_profissional'");
    expect(f).toContain("'limite_diario'");
    expect(f.indexOf("'limite_diario'")).toBeLessThan(f.indexOf("'limite_profissional'"));
  });

  it('o limite é conferido e reservado na mesma transação, com lock (vários cliques não passam juntos)', () => {
    const f = funcao('pesquisa_profissional_pode_pesquisar');
    expect(f).toMatch(/\bVOLATILE\b/);
    expect(f).not.toMatch(/\bSTABLE\b/);
    expect(f).toMatch(/pg_advisory_xact_lock\(/);
    expect(f.indexOf('pg_advisory_xact_lock')).toBeLessThan(f.indexOf('c_max_dia THEN'));
    expect(f).toMatch(/INSERT INTO public\.profissional_pesquisas/);
    expect(f.indexOf("'limite_profissional'")).toBeLessThan(f.indexOf('INSERT INTO'));
    expect(f).toContain("'em_andamento'");
    expect(f).toMatch(/jsonb_build_object\('ok', true, 'id', v_id\)/);
  });

  it('registrar conclui só a reserva em andamento do mesmo profissional e administrador', () => {
    const f = funcao('registrar_pesquisa_profissional');
    expect(f).toMatch(/p_id uuid DEFAULT NULL/);
    expect(f).toMatch(/UPDATE public\.profissional_pesquisas/);
    expect(f).toMatch(/WHERE id = p_id AND user_id = p_user_id AND pesquisado_por = p_pesquisado_por AND erro = 'em_andamento'/);
    expect(f).toMatch(/Reserva de pesquisa não encontrada ou já concluída/);
  });

  it('a URL da fonte é recusada quando passa de 2000 caracteres, nunca cortada', () => {
    const f = funcao('registrar_pesquisa_profissional');
    expect(f).not.toMatch(/left\([^)]*fonte_url[^)]*\)/);
    expect(f).toMatch(/length\(t\.a ->> 'fonte_url'\) <= 2000/);
  });

  it('a migration não mexe na verificação do profissional', () => {
    expect(CODIGO).not.toMatch(/verificar_profissional|profiles\.verificado|SET\s+verificado/i);
  });
});
