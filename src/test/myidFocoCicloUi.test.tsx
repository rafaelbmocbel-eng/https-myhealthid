import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BotaoFocoDoCiclo, MyIDFocoCiclo } from '@/components/myid/MyIDFocoCiclo';
import { compararFoco } from '@/utils/myid/focoCiclo';

const ROTULOS = { D: 'Dor', P: 'Cabeça e emoções', R: 'Sono e energia', AF: 'Movimento' };
const res = (perdas: Record<string, number>, score: number) => ({
  MyID_score: score,
  perdas_calculadas: Object.fromEntries(Object.entries(perdas).map(([k, v]) => [k, { perda_pontos: v }])),
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
    expect(t).toContain('Dor17,8 → 15,2 pts perdidos · melhorou 2,6 pts');
    expect(t).toContain('Cabeça e emoções15,0 → 15,4 pts perdidos · piorou 0,4 pts');
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
