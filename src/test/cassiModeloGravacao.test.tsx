import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { criarBancoFalso, type BancoFalso } from './helpers/bancoFalso';

const h = vi.hoisted(() => ({ banco: null as unknown as BancoFalso }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (t: string) => h.banco.from(t) } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'prof-1' } }) }));

import { gravarModeloDaGuia, useGravarModeloDaGuia } from '@/hooks/useModeloDaGuiaCassi';
import { ConfiguracaoNaoSalva, modeloDaConfiguracao } from '@/lib/cassiModeloConfig';
import { mesclarCodigosComPadrao, type CodigoFaturavel } from '@/lib/cassiFaturamento';

const catalogo = mesclarCodigosComPadrao([]);
const codigosDoBanco = () => [
  { codigo: '144', descricao: 'Consulta', valor: 65.62, codigo_oficial: '50000144' },
  { codigo: '012', descricao: 'Sessão', valor: 57.7, codigo_oficial: '50000012' },
  { codigo: '185', descricao: 'Eletro', valor: 108.44, codigo_oficial: '31602185' },
];
const config = (extra: Record<string, unknown> = {}) => ({
  terapeuta_id: 'prof-1', codigos: codigosDoBanco(), imposto_percentual: 14, minha_parte_percentual: 40, responsaveis: [{ nome: 'Dra. Íris', percentual: 50 }],
  nome_clinica: 'Clínica', updated_at: '2026-01-01T00:00:00.000Z', ...extra,
});
const gravarCodigos = () => h.banco.escritas().filter((o) => o.tabela === 'cassi_config');

describe('gravarModeloDaGuia: grava só o campo codigos da configuração do próprio profissional', () => {
  beforeEach(() => { h.banco = criarBancoFalso({ cassi_config: [config(), { ...config(), terapeuta_id: 'outro-prof', codigos: [{ codigo: '012', descricao: 'x', valor: 1 }] }] }); });

  it('faz UMA atualização, só de codigos e updated_at, filtrada pelo profissional, pedindo a linha de volta para conferir', async () => {
    await gravarModeloDaGuia('prof-1', [{ codigo: '185', quantidade: 4 }, { codigo: '144', quantidade: 1 }], catalogo);
    const escritas = gravarCodigos();
    expect(escritas).toHaveLength(1);
    expect(escritas[0].tipo).toBe('update');
    expect(Object.keys(escritas[0].payload as object).sort()).toEqual(['codigos', 'updated_at']);
    expect(escritas[0].filtros).toEqual([['eq', 'terapeuta_id', 'prof-1']]);
    const salvo = h.banco.tabelas.cassi_config.find((l) => l.terapeuta_id === 'prof-1')!;
    expect(modeloDaConfiguracao(salvo.codigos).filter((m) => m.marcado)).toEqual([{ codigo: '185', quantidade: 4, marcado: true }, { codigo: '144', quantidade: 1, marcado: true }]);
  });

  it('o resto da configuração (imposto, responsáveis, clínica) e a configuração de outro profissional ficam intactos', async () => {
    const antes = JSON.stringify(h.banco.tabelas.cassi_config);
    await gravarModeloDaGuia('prof-1', [{ codigo: '012', quantidade: 3 }], catalogo);
    const prof = h.banco.tabelas.cassi_config.find((l) => l.terapeuta_id === 'prof-1')!;
    const depois = { ...prof }; delete depois.codigos; delete depois.updated_at;
    const original = config(); delete (original as Record<string, unknown>).codigos; delete (original as Record<string, unknown>).updated_at;
    expect(depois).toEqual(original);
    expect(prof.updated_at).not.toBe('2026-01-01T00:00:00.000Z');
    expect(JSON.stringify(h.banco.tabelas.cassi_config.find((l) => l.terapeuta_id === 'outro-prof'))).toBe(JSON.stringify(JSON.parse(antes)[1]));
  });

  it('valor, descrição e código oficial dos códigos não mudam', async () => {
    await gravarModeloDaGuia('prof-1', [{ codigo: '185', quantidade: 2 }], catalogo);
    const salvo = h.banco.tabelas.cassi_config.find((l) => l.terapeuta_id === 'prof-1')!.codigos as CodigoFaturavel[];
    for (const original of codigosDoBanco()) expect(salvo.find((c) => c.codigo === original.codigo)).toMatchObject(original);
  });

  it('RELÊ o que está no banco agora: uma edição feita em outro aparelho (valor novo do 012, código novo) não é sobrescrita', async () => {
    // A tela abriu com o catálogo antigo (012 = 57,70); enquanto isso, em outro aparelho, o valor mudou e um código foi criado.
    const noBanco = h.banco.tabelas.cassi_config.find((l) => l.terapeuta_id === 'prof-1')!;
    noBanco.codigos = [...codigosDoBanco().map((c) => (c.codigo === '012' ? { ...c, valor: 61.2 } : c)), { codigo: '888', descricao: 'Criado em outro aparelho', valor: 9 }];
    await gravarModeloDaGuia('prof-1', [{ codigo: '144', quantidade: 1 }], catalogo);
    const salvo = h.banco.tabelas.cassi_config.find((l) => l.terapeuta_id === 'prof-1')!.codigos as CodigoFaturavel[];
    expect(salvo.find((c) => c.codigo === '012')?.valor).toBe(61.2);
    expect(salvo.find((c) => c.codigo === '888')?.descricao).toBe('Criado em outro aparelho');
    // e a leitura veio ANTES da escrita
    const tipos = h.banco.operacoes.filter((o) => o.tabela === 'cassi_config').map((o) => o.tipo);
    expect(tipos).toEqual(['select', 'update']);
  });

  it('sem configuração salva: não grava nada, não cria a configuração escondido e avisa com ConfiguracaoNaoSalva', async () => {
    h.banco = criarBancoFalso({ cassi_config: [] });
    await expect(gravarModeloDaGuia('prof-1', [{ codigo: '144', quantidade: 1 }], catalogo)).rejects.toBeInstanceOf(ConfiguracaoNaoSalva);
    expect(h.banco.escritas()).toHaveLength(0);
    expect(h.banco.tabelas.cassi_config).toHaveLength(0);
  });

  it('a leitura falhando não grava e a mensagem diz que foi a leitura', async () => {
    const original = h.banco.from;
    h.banco.from = ((t: string) => {
      const q = original(t) as unknown as { maybeSingle: () => unknown; then: unknown };
      if (t === 'cassi_config') {
        const falso: Record<string, unknown> = {};
        for (const m of ['select', 'eq']) falso[m] = () => falso;
        falso.maybeSingle = () => falso;
        falso.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: null, error: { message: 'sem rede' } }).then(res);
        return falso;
      }
      return q;
    }) as typeof h.banco.from;
    await expect(gravarModeloDaGuia('prof-1', [{ codigo: '144', quantidade: 1 }], catalogo)).rejects.toThrow('a leitura das suas configurações falhou (sem rede)');
    expect(h.banco.escritas()).toHaveLength(0);
  });

  it('o banco recusando a escrita vira erro com a mensagem dele', async () => {
    h.banco.falharEscritaQuando((op) => op.tabela === 'cassi_config', 'sem permissão');
    await expect(gravarModeloDaGuia('prof-1', [{ codigo: '144', quantidade: 1 }], catalogo)).rejects.toThrow('sem permissão');
  });

  it('CONFERE a linha: se a escrita não atingiu nenhuma linha (o banco não reclama), é erro, nunca "salvo" falso', async () => {
    const original = h.banco.from;
    h.banco.from = ((t: string) => {
      const q = original(t) as unknown as { update: (p: unknown) => unknown };
      if (t !== 'cassi_config') return q;
      const atualizar = q.update.bind(q);
      // A leitura (maybeSingle) acha a linha; a escrita filtra por um profissional que não existe: 0 linhas atingidas.
      q.update = (p: unknown) => { const c = atualizar(p) as { eq: (a: string, b: unknown) => unknown }; const eq = c.eq.bind(c); c.eq = (col: string) => eq(col, 'ninguem'); return c; };
      return q;
    }) as typeof h.banco.from;
    await expect(gravarModeloDaGuia('prof-1', [{ codigo: '144', quantidade: 1 }], catalogo)).rejects.toThrow('sua configuração não foi encontrada.');
  });

  it('mais de uma linha atingida também é erro (nunca deveria acontecer, e não se finge que está certo)', async () => {
    h.banco.tabelas.cassi_config.push(config());
    await expect(gravarModeloDaGuia('prof-1', [{ codigo: '144', quantidade: 1 }], catalogo)).rejects.toThrow('sua configuração não foi encontrada.');
  });
});

describe('useGravarModeloDaGuia', () => {
  const montar = () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const invalidar = vi.spyOn(qc, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    return { ...renderHook(() => useGravarModeloDaGuia(), { wrapper }), invalidar };
  };
  beforeEach(() => { h.banco = criarBancoFalso({ cassi_config: [config()] }); });

  it('no sucesso grava e invalida a consulta "cassi-config" do usuário', async () => {
    const { result, invalidar } = montar();
    await act(async () => { await result.current.mutateAsync({ escolha: [{ codigo: '012', quantidade: 5 }], catalogo }); });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['cassi-config', 'prof-1'] });
    expect(modeloDaConfiguracao(h.banco.tabelas.cassi_config[0].codigos).find((m) => m.marcado)).toEqual({ codigo: '012', quantidade: 5, marcado: true });
  });

  it('na falha rejeita (a tela mostra o erro) e NÃO invalida nada', async () => {
    h.banco.falharEscritaQuando((op) => op.tabela === 'cassi_config', 'sem permissão');
    const { result, invalidar } = montar();
    await act(async () => { await expect(result.current.mutateAsync({ escolha: [], catalogo })).rejects.toThrow('sem permissão'); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidar).not.toHaveBeenCalled();
  });
});
