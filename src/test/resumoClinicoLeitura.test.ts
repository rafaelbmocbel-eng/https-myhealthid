import { describe, it, expect } from 'vitest';
import { lerHistoricoClinico, listaDeTextos, textoLimpo } from '@/lib/resumoClinico/leitura';
import { montarResumoCompleto } from '@/lib/resumoClinico/resumoCompleto';
import { FONTES_VAZIAS } from '@/lib/resumoClinico/tipos';
import type { FontesClinicas, SecaoDoResumo } from '@/lib/resumoClinico/tipos';

const doHistorico = (historico_clinico: unknown): FontesClinicas => ({ ...FONTES_VAZIAS, paciente: { historico_clinico, historia_atual: null } });
const linhasDoHistorico = (historico_clinico: unknown) =>
  montarResumoCompleto(null, doHistorico(historico_clinico)).find((s: SecaoDoResumo) => s.id === 'cliente_historico')?.linhas ?? [];

describe('listaDeTextos: condições guardadas como lista ou como texto', () => {
  it('texto solto vira uma lista de um item, sem os espaços das pontas', () => {
    expect(listaDeTextos('Hipertensão arterial')).toEqual(['Hipertensão arterial']);
    expect(listaDeTextos('  Diabetes  ')).toEqual(['Diabetes']);
  });

  it('texto vazio ou só de espaços vira lista vazia', () => {
    expect(listaDeTextos('')).toEqual([]);
    expect(listaDeTextos('   \n ')).toEqual([]);
  });

  it('texto com várias condições não é separado nem reescrito: passa como o cliente escreveu', () => {
    expect(listaDeTextos('Hipertensão, diabetes e asma')).toEqual(['Hipertensão, diabetes e asma']);
  });

  it('lista: tira o que não é texto ou está vazio e mantém a ordem', () => {
    expect(listaDeTextos([' A ', '', null, 3, { x: 1 }, '   ', 'B'])).toEqual(['A', '3', 'B']);
  });

  it('o que não é texto nem lista vira lista vazia', () => {
    for (const v of [null, undefined, 0, 7, true, false, {}, { condicoes: ['A'] }]) expect(listaDeTextos(v), JSON.stringify(v)).toEqual([]);
  });

  it('textoLimpo aceita número finito e recusa o resto', () => {
    expect(textoLimpo(3)).toBe('3');
    expect(textoLimpo(0)).toBe('0');
    for (const v of [NaN, Infinity, null, undefined, true, {}, []]) expect(textoLimpo(v)).toBe('');
  });
});

describe('histórico clínico com as condições guardadas como TEXTO (não como lista)', () => {
  it('doenças crônicas, saúde mental e histórico familiar em texto são lidos', () => {
    const h = lerHistoricoClinico({
      doencas_cronicas: { condicoes: 'Hipertensão arterial' },
      saude_mental: { condicoes: ' Ansiedade ', diagnostico_formal: true },
      historico_familiar: { condicoes: 'Diabetes na família' },
    });
    expect(h.doencas.condicoes).toEqual(['Hipertensão arterial']);
    expect(h.saudeMental.condicoes).toEqual(['Ansiedade']);
    expect(h.familiar.condicoes).toEqual(['Diabetes na família']);
  });

  it('o Completo mostra essas condições em texto, como o cliente escreveu', () => {
    expect(linhasDoHistorico({
      doencas_cronicas: { condicoes: 'Hipertensão arterial' },
      saude_mental: { condicoes: 'Ansiedade', diagnostico_formal: true },
      historico_familiar: { condicoes: 'Diabetes na família' },
    })).toEqual([
      'Doenças crônicas: Hipertensão arterial',
      'Saúde mental: Ansiedade',
      'O cliente marcou que tem diagnóstico formal de saúde mental',
      'Histórico familiar: Diabetes na família',
    ]);
  });

  it('condição em texto vazio não gera linha, e o diagnóstico formal sozinho também não', () => {
    expect(linhasDoHistorico({
      doencas_cronicas: { condicoes: '' }, saude_mental: { condicoes: '   ', diagnostico_formal: true }, historico_familiar: { condicoes: '' },
    })).toEqual([]);
  });

  it('o mesmo histórico com lista e com texto dá o mesmo resultado para uma condição só', () => {
    const comLista = linhasDoHistorico({ doencas_cronicas: { condicoes: ['Asma'] } });
    const comTexto = linhasDoHistorico({ doencas_cronicas: { condicoes: 'Asma' } });
    expect(comTexto).toEqual(comLista);
    expect(comTexto).toEqual(['Doenças crônicas: Asma']);
  });
});
