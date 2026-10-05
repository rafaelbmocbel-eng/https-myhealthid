import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PropostaDocumento, { ordenarTecnicasProposta } from '../components/protocolo/PropostaDocumento';
import { tecnicasParaPdf, type DiretrizSnapshot } from '../lib/protocoloSnapshot';

const base = {
  pacienteNome: 'Maria Exemplo', fases: [], manut: { rotinaMinima: [], habitosChave: [], sinaisParaRetornar: [] },
  numeroSessoes: 12, duracao: '6 semanas', frequencia: '2x por semana', valorSessao: 150, desconto: 0, formaPagamento: 'PIX', total: 1800, mensagem: 'Olá', validadeDias: 7,
};

describe('técnicas da diretriz na proposta', () => {
  it('as condutas do profissional vêm primeiro', () => {
    const r = ordenarTecnicasProposta([{ tecnica: 'A' }, { tecnica: 'B', conduta_profissional: true }, { tecnica: '' }, { tecnica: 'C' }]);
    expect(r.map((t) => t.tecnica)).toEqual(['B', 'A', 'C']);
  });

  it('a pré-visualização (e, por ela, o PDF) mostra as técnicas de cada fase', () => {
    render(<PropostaDocumento {...base} fases={[{
      numero: 1, titulo: 'Alívio', focos: ['Reduzir a dor'],
      tecnicas: [{ tecnica: 'Educação em Neurociência da Dor' }, { tecnica: 'Manobra Visceral Pélvica', conduta_profissional: true }],
    }]} />);
    expect(screen.getByText('Técnicas')).toBeTruthy();
    expect(screen.getByText(/★ Manobra Visceral Pélvica/)).toBeTruthy();
    expect(screen.getByText('Educação em Neurociência da Dor')).toBeTruthy();
  });

  it('fase sem técnicas não mostra o título Técnicas', () => {
    render(<PropostaDocumento {...base} fases={[{ numero: 1, titulo: 'Alívio', focos: ['x'] }]} />);
    expect(screen.queryByText('Técnicas')).toBeNull();
  });
});

describe('PDF da diretriz com as técnicas da própria diretriz', () => {
  const snap = {
    versao: 1, createdAt: '2026-01-01', origem: 'ia_voz', criteriosAlta: [], referenciasChave: [], manutencao: {},
    fases: [
      { numero: 1, titulo: 'Alívio', semanas: '1-4', semanas_inicio: 1, semanas_fim: 4, objetivo: 'x', demandasAlvo: [], criteriosProgressao: [], frequenciaSemanal: 2, duracaoSessao: '', exercicios: [],
        tecnicas: [
          { nome: 'Educação em Neurociência da Dor (PNE)', descricao: '', duracao: '', frequencia: '', motivo: '', categoria: 'referência' },
          { nome: 'Liberação Miofascial', descricao: 'coxas', duracao: '', frequencia: '', motivo: '', categoria: 'referência', conduta_profissional: true },
        ] },
    ],
  } as unknown as DiretrizSnapshot;

  it('inclui as técnicas da diretriz, com a conduta do profissional primeiro, sem repetir as do cardápio', () => {
    const r = tecnicasParaPdf([{ nome: 'Educação em Neurociência da Dor (PNE)', categoria: 'Educação em Dor', fase_numero: 1 }], snap);
    expect(r.map((t) => t.nome)).toEqual(['Liberação Miofascial', 'Educação em Neurociência da Dor (PNE)']);
    expect(r[0]).toMatchObject({ categoria: 'Conduta do profissional', fase_numero: 1, observacoes: 'coxas' });
  });

  it('sem diretriz mantém só as do cardápio', () => {
    const so = [{ nome: 'Mobilização', categoria: 'Terapia Manual', fase_numero: 2 }];
    expect(tecnicasParaPdf(so, null)).toEqual(so);
  });
});
