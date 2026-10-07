import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import TreinoDocumento from '../components/paciente/TreinoDocumento';

const conteudo = {
  fases: [{ nome: 'Fase 1', semanas: 4, sessoes: [{ nome: 'Treino A', exercicios: [{ nome: 'Agachamento', series: 3, reps: '10' }] }] }],
  _governanca: {
    fonte: { tipo: 'ia', modelo: 'gemini-2.5-flash' },
    acompanhamento: { reavaliar_em_semanas: 4, indicadores: [] },
    aprovacao: { por_nome: 'Ana Souza', em: '2026-10-01T15:00:00Z', versao: 2 },
  },
};

afterEach(() => cleanup());

describe('TreinoDocumento: rodapé de governança', () => {
  it('plano do profissional liberado mostra quem liberou, versão, fonte e reavaliação, além do aviso padrão', () => {
    render(<TreinoDocumento nome="João" titulo="Treino" conteudo={conteudo} origemGov="profissional" aprovado />);
    expect(screen.getByText('Liberado por Ana Souza em 01/10/2026 · v2 · Fonte: IA (gemini-2.5-flash) + revisão profissional')).toBeInTheDocument();
    expect(screen.getByText('Reavaliar em 4 semanas (até 29/10/2026)')).toBeInTheDocument();
    expect(screen.getByText(/não substitui avaliação profissional/)).toBeInTheDocument();
  });

  it('por padrão (plano do cliente) nunca afirma liberação, mas mantém o aviso padrão', () => {
    render(<TreinoDocumento nome="João" titulo="Treino" conteudo={conteudo} />);
    expect(screen.queryByText(/Liberado/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Reavaliar em/)).not.toBeInTheDocument();
    expect(screen.getByText(/não substitui avaliação profissional/)).toBeInTheDocument();
  });

  it('rascunho do profissional mostra "Rascunho" e não a aprovação gravada no conteúdo', () => {
    render(<TreinoDocumento nome="João" titulo="Treino" conteudo={conteudo} origemGov="profissional" aprovado={false} />);
    expect(screen.getByText('Rascunho')).toBeInTheDocument();
    expect(screen.queryByText(/Ana Souza/)).not.toBeInTheDocument();
  });
});
