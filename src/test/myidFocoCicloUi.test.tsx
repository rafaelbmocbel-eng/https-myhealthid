import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BotaoFocoDoCiclo, MyIDFocoCiclo } from '@/components/myid/MyIDFocoCiclo';
import { compararFoco } from '@/utils/myid/focoCiclo';

const ROTULOS = { D: 'Dor', P: 'Cabeça e emoções', R: 'Sono e energia', AF: 'Movimento' };
const res = (perdas: Record<string, number>, score: number, extra: Record<string, unknown> = {}) => ({
  MyID_score: score,
  timestamp: '2026-10-10T12:00:00Z',
  perdas_calculadas: Object.fromEntries(Object.entries(perdas).map(([k, v]) => [k, { perda_pontos: v, score_bruto: Math.round(v) / 2 }])),
  ...extra,
});

function montar(props: Partial<Parameters<typeof MyIDFocoCiclo>[0]> = {}) {
  const onEncerrar = vi.fn();
  const onReiniciar = vi.fn();
  render(
    <MyIDFocoCiclo
      dimensoes={['D', 'P']} comparacao={null} rotulos={ROTULOS} inicio="12/10/2026"
      baseAusente={false} retesteDisponivel={false} onEncerrar={onEncerrar} onReiniciar={onReiniciar} {...props}
    />,
  );
  return { onEncerrar, onReiniciar, secao: screen.getByRole('region', { name: 'Foco do ciclo' }) };
}

describe('MyIDFocoCiclo', () => {
  it('sem foco: explica como escolher e não mostra botões de ação', () => {
    const { secao } = montar({ dimensoes: null });
    expect(secao.textContent).toContain('Escolha de 1 a 3 dimensões');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('ciclo recém-iniciado: mostra o foco e a data e só oferece encerrar', () => {
    const { secao } = montar();
    expect(secao.textContent).toContain('Foco: Dor e Cabeça e emoções');
    expect(secao.textContent).toContain('ciclo iniciado em 12/10/2026');
    expect(secao.textContent).toContain('No próximo MyID, a variação em pontos de cada uma aparece aqui');
    expect(screen.getByRole('button', { name: 'Encerrar ciclo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reiniciar/ })).toBeNull();
  });

  it('no reteste: variação em pontos de cada dimensão, nota do MyID e aviso do que piorou fora do foco', () => {
    const comparacao = compararFoco(
      res({ D: 17.8, P: 15, R: 10.8, AF: 5.7 }, 9.7),
      res({ D: 15.2, P: 15.4, R: 13.6, AF: 5.7 }, 12.1),
      ['D', 'P'],
    );
    const { secao } = montar({ comparacao, retesteDisponivel: true });
    const t = secao.textContent ?? '';
    expect(t).toContain('Dor17,8 → 15,2 pts perdidos · melhorou 2,6 ptsgravidade 9,0 → 7,5 (0 a 10)');
    expect(t).toContain('15,0 → 15,4 pts perdidos · piorou 0,4 pts');
    expect(t).toContain('MyID: 9,7 → 12,1');
    expect(t).toContain('Fora do foco, perdeu mais pontos: Sono e energia (+2,8 pts).');
    expect(screen.getByRole('button', { name: 'Reiniciar a partir deste MyID' })).toBeInTheDocument();
  });

  it('dimensão igual aparece como "igual" e sem aviso quando nada piorou fora do foco', () => {
    const comparacao = compararFoco(res({ D: 10 }, 50), res({ D: 10 }, 50), ['D']);
    const { secao } = montar({ dimensoes: ['D'], comparacao, retesteDisponivel: true });
    expect(secao.textContent).toContain('10,0 → 10,0 pts perdidos · igual');
    expect(secao.textContent).not.toContain('Fora do foco');
  });

  it('base ausente: pede para reiniciar a partir do MyID atual', () => {
    const { secao } = montar({ baseAusente: true, retesteDisponivel: true });
    expect(secao.textContent).toContain('não está mais disponível');
    expect(screen.getByRole('button', { name: 'Reiniciar a partir deste MyID' })).toBeInTheDocument();
  });

  it('reteste sem perdas por dimensão: diz que não dá para comparar', () => {
    const { secao } = montar({ retesteDisponivel: true, comparacao: null });
    expect(secao.textContent).toContain('Não foi possível comparar');
  });

  it('mostra a gravidade bruta (0 a 10) ao lado da perda e explica o ajuste da Dor', () => {
    const comparacao = compararFoco(res({ D: 17.8, P: 15 }, 9.7), res({ D: 15.2, P: 15 }, 12), ['D', 'P']);
    const { secao } = montar({ comparacao, retesteDisponivel: true });
    expect(secao.textContent).toContain('gravidade 9,0 → 7,5 (0 a 10)');
    expect(secao.textContent).toContain('a perda inclui um ajuste pelo tempo de dor');
    // sem a Dor no foco, a nota não aparece
  });

  it('sem a Dor no foco não há nota sobre o tempo de dor', () => {
    const comparacao = compararFoco(res({ D: 17.8, P: 15 }, 9.7), res({ D: 15.2, P: 14 }, 12), ['P']);
    const { secao } = montar({ dimensoes: ['P'], comparacao, retesteDisponivel: true });
    expect(secao.textContent).not.toContain('tempo de dor');
  });

  it('R e C de regras diferentes ficam de fora e o motivo aparece', () => {
    const antigo = res({ D: 10, R: 12 }, 30, { timestamp: '2026-09-20T12:00:00Z' });
    const comparacao = compararFoco(antigo, res({ D: 8, R: 9 }, 40), ['D', 'R']);
    const { secao } = montar({ dimensoes: ['D', 'R'], comparacao, retesteDisponivel: true });
    expect(secao.textContent).toContain('Sem dado para comparar: Sono e energia');
    expect(secao.textContent).toContain('regra anterior a 06/10/2026');
  });

  it('enquanto carrega ou quando a leitura falha, não diz que não há foco e não oferece ações', () => {
    const a = montar({ dimensoes: null, carregando: true });
    expect(a.secao.textContent).toContain('Carregando o foco do ciclo');
    expect(a.secao.textContent).not.toContain('Escolha de 1 a 3');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('erro ao carregar: avisa e não afirma que não há foco', () => {
    const { secao } = montar({ dimensoes: null, erroAoCarregar: true });
    expect(secao.textContent).toContain('Não foi possível carregar o foco do ciclo');
    expect(secao.textContent).not.toContain('Escolha de 1 a 3');
  });

  it('os botões chamam as ações e ficam desabilitados enquanto salva', () => {
    const comparacao = compararFoco(res({ D: 10 }, 50), res({ D: 8 }, 55), ['D']);
    const { onEncerrar, onReiniciar } = montar({ dimensoes: ['D'], comparacao, retesteDisponivel: true });
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar ciclo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reiniciar a partir deste MyID' }));
    expect(onEncerrar).toHaveBeenCalledTimes(1);
    expect(onReiniciar).toHaveBeenCalledTimes(1);
  });

  it('ocupado desabilita os dois botões', () => {
    montar({ ocupado: true, baseAusente: true });
    expect(screen.getByRole('button', { name: 'Encerrar ciclo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reiniciar a partir deste MyID' })).toBeDisabled();
  });
});

describe('BotaoFocoDoCiclo', () => {
  it('marca e desmarca, com rótulo acessível e estado pressionado', () => {
    const onAlternar = vi.fn();
    const { rerender } = render(<BotaoFocoDoCiclo rotulo="Dor" ativo={false} onAlternar={onAlternar} />);
    const botao = screen.getByRole('button', { name: 'Marcar Dor como foco do ciclo' });
    expect(botao).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(botao);
    expect(onAlternar).toHaveBeenCalledTimes(1);
    rerender(<BotaoFocoDoCiclo rotulo="Dor" ativo onAlternar={onAlternar} />);
    expect(screen.getByRole('button', { name: 'Tirar Dor do foco do ciclo' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('desabilitado não dispara', () => {
    const onAlternar = vi.fn();
    render(<BotaoFocoDoCiclo rotulo="Dor" ativo={false} desabilitado onAlternar={onAlternar} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onAlternar).not.toHaveBeenCalled();
  });
});
