import { describe, it, expect } from 'vitest';
import {
  CATEGORIAS, CATEGORIA_DO_TIPO, ROTULO_DO_FILTRO, categoriaDoMarco, deveMostrarFiltros, filtrarMarcos, opcoesDeFiltro,
} from '@/lib/resumoClinico/filtros';
import type { IdDoFiltro } from '@/lib/resumoClinico/filtros';
import { TIPOS_DE_MARCO } from '@/lib/resumoClinico/tipos';
import type { Marco, TipoDoMarco } from '@/lib/resumoClinico/tipos';

let contador = 0;
const marco = (tipo: string, extra: Partial<Marco> = {}): Marco => {
  contador += 1;
  return {
    id: `m${contador}`, data: { iso: '2024-01-01', precisao: 'dia' }, titulo: `Marco ${contador}`, tipo: tipo as TipoDoMarco, rotuloTipo: 'X',
    fonte: 'exame_presencial', origem: 'profissional', revisado: true, natureza: 'registro', ...extra,
  };
};
const vezes = (n: number, tipo: string) => Array.from({ length: n }, () => marco(tipo));
const ids = (marcos: Marco[]) => marcos.map((m) => m.id);

describe('filtro por tipo: cada tipo de marco tem uma decisão', () => {
  it('todos os tipos de tipos.ts estão na tabela de categorias, e a tabela não tem tipo a mais', () => {
    expect(Object.keys(CATEGORIA_DO_TIPO).sort()).toEqual([...TIPOS_DE_MARCO].sort());
  });

  it('a lista de tipos tem os nove tipos que a linha do tempo produz', () => {
    expect([...TIPOS_DE_MARCO].sort()).toEqual(['avaliacao', 'cirurgia', 'diagnostico', 'escala', 'evento_de_vida', 'exame', 'historico', 'myid', 'teste']);
  });

  it.each([
    ['cirurgia', 'cirurgias_e_diagnosticos'],
    ['diagnostico', 'cirurgias_e_diagnosticos'],
    ['exame', 'exames_e_testes'],
    ['teste', 'exames_e_testes'],
    ['escala', 'exames_e_testes'],
    ['avaliacao', 'avaliacoes'],
    ['myid', 'myid'],
    ['evento_de_vida', 'eventos_de_vida'],
    ['historico', null],
  ])('o tipo %s fica em %s', (tipo, categoria) => {
    expect(categoriaDoMarco(marco(tipo))).toBe(categoria);
  });

  it('toda categoria tem rótulo, ao menos um tipo e nenhum tipo está em duas', () => {
    expect(Object.keys(ROTULO_DO_FILTRO).sort()).toEqual(['avaliacoes', 'cirurgias_e_diagnosticos', 'eventos_de_vida', 'exames_e_testes', 'myid', 'tudo']);
    for (const c of CATEGORIAS) {
      expect(TIPOS_DE_MARCO.filter((t) => CATEGORIA_DO_TIPO[t] === c).length, c).toBeGreaterThan(0);
    }
    expect(ROTULO_DO_FILTRO).toEqual({
      tudo: 'Tudo', cirurgias_e_diagnosticos: 'Cirurgias e diagnósticos', eventos_de_vida: 'Eventos de vida', exames_e_testes: 'Exames e testes', avaliacoes: 'Avaliações', myid: 'MyID',
    });
  });

  it('tipo fora da tabela (ou com nome de propriedade do objeto) não tem categoria, mas continua em Tudo', () => {
    const marcos = [marco('tipo_novo'), marco('constructor'), marco('toString'), marco('exame')];
    expect(marcos.map(categoriaDoMarco)).toEqual([null, null, null, 'exames_e_testes']);
    expect(ids(filtrarMarcos(marcos, 'tudo'))).toEqual(ids(marcos));
    for (const f of CATEGORIAS) {
      const dentro = filtrarMarcos(marcos, f);
      expect(dentro.every((m) => m.tipo === 'exame'), f).toBe(true);
    }
  });
});

describe('filtro por tipo: contagem e filtragem', () => {
  const marcos = [marco('cirurgia'), marco('diagnostico'), marco('exame'), marco('exame'), marco('teste'), marco('escala'), marco('myid'), marco('evento_de_vida'), marco('historico')];

  it('Tudo conta todos (inclusive os sem categoria) e cada categoria conta só os dela, na ordem dos chips', () => {
    expect(opcoesDeFiltro(marcos)).toEqual([
      { id: 'tudo', rotulo: 'Tudo', total: 9 },
      { id: 'cirurgias_e_diagnosticos', rotulo: 'Cirurgias e diagnósticos', total: 2 },
      { id: 'eventos_de_vida', rotulo: 'Eventos de vida', total: 1 },
      { id: 'exames_e_testes', rotulo: 'Exames e testes', total: 4 },
      { id: 'myid', rotulo: 'MyID', total: 1 },
    ]);
  });

  it('categoria sem marco não vira chip, e o chip Avaliações aparece quando há avaliação', () => {
    expect(opcoesDeFiltro([marco('exame')]).map((o) => o.id)).toEqual(['tudo', 'exames_e_testes']);
    expect(opcoesDeFiltro([marco('avaliacao'), marco('myid')]).map((o) => o.id)).toEqual(['tudo', 'avaliacoes', 'myid']);
    expect(opcoesDeFiltro([])).toEqual([{ id: 'tudo', rotulo: 'Tudo', total: 0 }]);
  });

  it('a soma das categorias mais os sem categoria dá o total de Tudo: nenhum marco some', () => {
    const porCategoria = CATEGORIAS.reduce((soma, c) => soma + filtrarMarcos(marcos, c).length, 0);
    const semCategoria = marcos.filter((m) => categoriaDoMarco(m) === null).length;
    expect(semCategoria).toBe(1);
    expect(porCategoria + semCategoria).toBe(marcos.length);
  });

  it('filtrar mantém a ordem original, e Tudo devolve uma cópia (não o mesmo vetor)', () => {
    const exames = filtrarMarcos(marcos, 'exames_e_testes');
    expect(exames.map((m) => m.tipo)).toEqual(['exame', 'exame', 'teste', 'escala']);
    expect(ids(exames)).toEqual(ids(marcos.filter((m) => ['exame', 'teste', 'escala'].includes(m.tipo))));
    const tudo = filtrarMarcos(marcos, 'tudo');
    expect(tudo).toEqual(marcos);
    expect(tudo).not.toBe(marcos);
  });

  it('um tipo sem categoria não entra em nenhum filtro que não seja Tudo', () => {
    const soEmTudo = marcos.filter((m) => categoriaDoMarco(m) === null);
    const outros: IdDoFiltro[] = ['cirurgias_e_diagnosticos', 'eventos_de_vida', 'exames_e_testes', 'avaliacoes', 'myid'];
    for (const f of outros) {
      for (const m of soEmTudo) expect(filtrarMarcos(marcos, f), f).not.toContain(m);
    }
    for (const m of soEmTudo) expect(filtrarMarcos(marcos, 'tudo')).toContain(m);
  });
});

describe('filtro por tipo: quando os chips aparecem', () => {
  const quando = (marcos: Marco[]) => deveMostrarFiltros(marcos.length, opcoesDeFiltro(marcos), 6);

  it('com 6 marcos (o corte inicial) em duas categorias, não aparecem; com 7, aparecem', () => {
    expect(quando([...vezes(3, 'exame'), ...vezes(3, 'cirurgia')])).toBe(false);
    expect(quando([...vezes(4, 'exame'), ...vezes(3, 'cirurgia')])).toBe(true);
  });

  it('com muitos marcos mas uma categoria só, não aparecem', () => {
    expect(quando(vezes(12, 'exame'))).toBe(false);
    expect(quando([...vezes(10, 'exame'), ...vezes(3, 'teste')])).toBe(false);
  });

  it('marco sem categoria não conta como categoria: 1 categoria + só-em-Tudo não mostra chips', () => {
    expect(quando([...vezes(8, 'exame'), ...vezes(3, 'historico')])).toBe(false);
    expect(quando([...vezes(8, 'exame'), marco('myid')])).toBe(true);
  });

  it('eventos de vida são uma categoria de verdade: junto com exames já há o que escolher', () => {
    expect(quando([...vezes(8, 'exame'), marco('evento_de_vida')])).toBe(true);
    expect(quando(vezes(9, 'evento_de_vida'))).toBe(false);
  });

  it('só marcos sem categoria: não aparecem', () => {
    expect(quando(vezes(11, 'historico'))).toBe(false);
  });

  it('o limite é lido do argumento, não fixo em 6', () => {
    const marcos = [...vezes(3, 'exame'), ...vezes(3, 'cirurgia')];
    expect(deveMostrarFiltros(marcos.length, opcoesDeFiltro(marcos), 5)).toBe(true);
    expect(deveMostrarFiltros(marcos.length, opcoesDeFiltro(marcos), 6)).toBe(false);
  });
});
