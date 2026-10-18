import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { protocoloPadrao, useEstadoLaudo } from '../components/angular/video/laudo/useEstadoLaudo';
import { protocolosDoGesto } from '../lib/angular/movimento/protocolos';
import type { CriterioProfissional } from '../lib/angular/movimento/tipos';
import type { IdGesto } from '../lib/angular/video/modelos';
import type { PlanoCamera } from '../lib/angular/movimento/tipos';

const criterio: CriterioProfissional = {
  id: 'c1', chave: 'assimetria_flexao_joelho', metrica: 'flexao_joelho_max', operador: '<=', valor: 5, unidade: '°', rotulo: 'r', definidoPor: 'Dra. Teste', ativo: true,
};

const montar = (gesto: IdGesto, vista: PlanoCamera) => renderHook((p: { gesto: IdGesto; vista: PlanoCamera }) => useEstadoLaudo(p.gesto, p.vista), { initialProps: { gesto, vista } });

describe('estado da aba Laudo (protocolo e critérios)', () => {
  it('o padrão é o protocolo da vista declarada pelo gesto', () => {
    const { result } = montar('agachamento', 'lateral');
    expect(result.current.protocoloId).toBe('agachamento_lateral');
    expect(result.current.protocoloEscolhido).toBeNull();
    expect(result.current.protocolos.map((p) => p.id)).toEqual(['agachamento_lateral', 'agachamento_frontal']);
    expect(result.current.criterios).toEqual([]);
  });

  it('com a vista frontal declarada, o padrão é o frontal; sem protocolo na vista, o primeiro do gesto', () => {
    expect(montar('agachamento', 'frontal').result.current.protocoloId).toBe('agachamento_frontal');
    expect(montar('marcha', 'frontal').result.current.protocoloId).toBe('marcha_lateral');
    const protocolos = protocolosDoGesto('agachamento');
    expect(protocoloPadrao(protocolos, 'frontal')?.id).toBe('agachamento_frontal');
    expect(protocoloPadrao([], 'lateral')).toBeNull();
  });

  it('gesto sem protocolo não tem protocolo em uso', () => {
    const { result } = montar('corrida', 'lateral');
    expect(result.current.protocolos).toEqual([]);
    expect(result.current.protocoloId).toBeNull();
  });

  it('a escolha explícita vira protocolo em uso e é a que vai para o arquivo salvo', () => {
    const { result } = montar('agachamento', 'lateral');
    act(() => result.current.escolherProtocolo('agachamento_frontal'));
    expect(result.current.protocoloId).toBe('agachamento_frontal');
    expect(result.current.protocoloEscolhido).toBe('agachamento_frontal');
  });

  it('uma escolha feita para outro gesto deixa de valer quando o gesto muda', () => {
    const { result, rerender } = montar('agachamento', 'lateral');
    act(() => result.current.escolherProtocolo('agachamento_frontal'));
    rerender({ gesto: 'marcha', vista: 'lateral' });
    expect(result.current.protocoloEscolhido).toBeNull();
    expect(result.current.protocoloId).toBe('marcha_lateral');
    rerender({ gesto: 'agachamento', vista: 'lateral' });
    expect(result.current.protocoloId).toBe('agachamento_frontal');
  });

  it('os critérios aceitam valor novo e função de atualização', () => {
    const { result } = montar('agachamento', 'lateral');
    act(() => result.current.mudarCriterios([criterio]));
    expect(result.current.criterios).toEqual([criterio]);
    act(() => result.current.mudarCriterios((l) => l.map((c) => ({ ...c, ativo: false }))));
    expect(result.current.criterios[0].ativo).toBe(false);
  });

  it('restaurar devolve o que o arquivo guardava, ou o vazio numa análise nova', () => {
    const { result } = montar('agachamento', 'lateral');
    act(() => result.current.restaurar([criterio], 'agachamento_frontal'));
    expect(result.current.criterios).toEqual([criterio]);
    expect(result.current.protocoloEscolhido).toBe('agachamento_frontal');
    act(() => result.current.restaurar());
    expect(result.current.criterios).toEqual([]);
    expect(result.current.protocoloEscolhido).toBeNull();
    expect(result.current.protocoloId).toBe('agachamento_lateral');
  });

  it('as funções devolvidas mantêm a identidade entre renderizações (não disparam efeitos à toa)', () => {
    const { result, rerender } = montar('agachamento', 'lateral');
    const antes = result.current.restaurar;
    rerender({ gesto: 'agachamento', vista: 'lateral' });
    expect(result.current.restaurar).toBe(antes);
  });
});
