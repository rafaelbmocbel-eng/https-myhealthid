import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { contarEventosDeHoje } from '@/lib/eventosHoje';

type Chamada = { metodo: string; args: unknown[] };
type Resposta = { count: number | null; error: { message: string } | null };

function criarClienteFalso(resposta: Resposta) {
  const chamadas: Chamada[] = [];
  const construtor: Record<string, unknown> = {};
  for (const metodo of ['select', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'ilike', 'order', 'limit']) {
    construtor[metodo] = (...args: unknown[]) => {
      chamadas.push({ metodo, args });
      return construtor;
    };
  }
  construtor.then = (ok: (r: Resposta) => unknown, falha?: (e: unknown) => unknown) => Promise.resolve(resposta).then(ok, falha);
  const cliente = {
    from: (tabela: string) => {
      chamadas.push({ metodo: 'from', args: [tabela] });
      return construtor;
    },
  };
  return { cliente: cliente as unknown as SupabaseClient<Database>, chamadas };
}

function colunasDeEventos(): string[] {
  const texto = readFileSync(join(process.cwd(), 'src/integrations/supabase/types.ts'), 'utf8');
  const inicioTabela = texto.indexOf('\n      eventos: {');
  const inicioRow = texto.indexOf('Row: {', inicioTabela);
  const fimRow = texto.indexOf('\n        }', inicioRow);
  const bloco = texto.slice(inicioRow + 'Row: {'.length, fimRow);
  return [...bloco.matchAll(/^\s+(\w+)\??:/gm)].map((m) => m[1]);
}

const colunasEq = (chamadas: Chamada[]) => chamadas.filter((c) => c.metodo !== 'from' && c.metodo !== 'select');

describe('Hoje: contagem de eventos de hoje', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-15T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('leitura das colunas de eventos em types.ts funciona (base do teste de colunas)', () => {
    const colunas = colunasDeEventos();
    expect(colunas.length).toBeGreaterThan(5);
    expect(colunas).toContain('id');
    expect(colunas).toContain('terapeuta_id');
  });

  it('consulta a tabela eventos só por colunas que existem na tabela', async () => {
    const { cliente, chamadas } = criarClienteFalso({ count: 2, error: null });
    await contarEventosDeHoje(cliente, 'terapeuta-1');

    expect(chamadas[0]).toEqual({ metodo: 'from', args: ['eventos'] });
    const colunas = colunasDeEventos();
    const usadas: string[] = [];
    for (const c of chamadas) {
      if (c.metodo === 'select') usadas.push(...String(c.args[0]).split(',').map((s) => s.trim()).filter((s) => s !== '*'));
      else if (c.metodo !== 'from') usadas.push(String(c.args[0]));
    }
    expect(usadas.length).toBeGreaterThan(0);
    for (const coluna of usadas) expect(colunas, `coluna inexistente em eventos: ${coluna}`).toContain(coluna);
  });

  it('filtra pelo profissional, só eventos ativos e o dia de hoje em data_evento', async () => {
    const { cliente, chamadas } = criarClienteFalso({ count: 1, error: null });
    await contarEventosDeHoje(cliente, 'terapeuta-1');

    expect(colunasEq(chamadas)).toEqual([
      { metodo: 'eq', args: ['terapeuta_id', 'terapeuta-1'] },
      { metodo: 'eq', args: ['ativo', true] },
      { metodo: 'eq', args: ['data_evento', '2026-11-15'] },
    ]);
  });

  it('perto da meia-noite usa o dia do Brasil: 02:30 UTC de 15/11 ainda é dia 14', async () => {
    vi.setSystemTime(new Date('2026-11-15T02:30:00Z'));
    const antes = criarClienteFalso({ count: 0, error: null });
    await contarEventosDeHoje(antes.cliente, 'terapeuta-1');
    expect(colunasEq(antes.chamadas)).toContainEqual({ metodo: 'eq', args: ['data_evento', '2026-11-14'] });

    vi.setSystemTime(new Date('2026-11-15T12:00:00Z'));
    const depois = criarClienteFalso({ count: 0, error: null });
    await contarEventosDeHoje(depois.cliente, 'terapeuta-1');
    expect(colunasEq(depois.chamadas)).toContainEqual({ metodo: 'eq', args: ['data_evento', '2026-11-15'] });
  });

  it('devolve a contagem que o banco informou, sem inventar número', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { cliente } = criarClienteFalso({ count: 3, error: null });
    expect(await contarEventosDeHoje(cliente, 'terapeuta-1')).toBe(3);
    const semContagem = criarClienteFalso({ count: null, error: null });
    expect(await contarEventosDeHoje(semContagem.cliente, 'terapeuta-1')).toBe(0);
    expect(aviso).not.toHaveBeenCalled();
  });

  it('erro do banco mostra 0 mas fica registrado no console.warn, sem lançar', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const erro = { message: 'column eventos.data_inicio does not exist' };
    const { cliente } = criarClienteFalso({ count: 7, error: erro });

    await expect(contarEventosDeHoje(cliente, 'terapeuta-1')).resolves.toBe(0);
    expect(aviso).toHaveBeenCalledTimes(1);
    expect(aviso.mock.calls[0]).toContain(erro);
  });

  it('o aviso do erro não leva o id do profissional para o console', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { cliente } = criarClienteFalso({ count: null, error: { message: 'falhou' } });

    await contarEventosDeHoje(cliente, 'terapeuta-secreto-123');
    expect(JSON.stringify(aviso.mock.calls)).not.toContain('terapeuta-secreto-123');
  });
});
