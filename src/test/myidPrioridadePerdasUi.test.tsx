import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MyIDFechamentoDaConta, MyIDOndeEstaoAsPerdas } from '@/components/myid/MyIDPrioridadePerdas';
import { analisarPerdas } from '@/utils/myid/prioridadePerdas';

const perdas = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { perda_pontos: v }]));
const ROTULOS = {
  D: 'Dor', P: 'Cabeça e emoções', R: 'Sono e energia', C: 'Vida pessoal', ERG: 'Postura no dia', EFI: 'Limitação nas atividades',
  AF: 'Movimento', I: 'Mudanças recentes', HID: 'Hidratação', NUT: 'Alimentação', N: 'Sinais do corpo',
};

const espalhado = () => analisarPerdas({
  perdas_calculadas: perdas({ D: 17.81, P: 15, R: 10.8, C: 7.9, ERG: 6.9, EFI: 6, AF: 5.7, I: 4, HID: 4, NUT: 2.5, N: 1.7 }),
  myid_100: { total_perdas: 90.31 },
  red_flags_details: { progressive: true, neuropathy: true },
})!;

describe('MyIDOndeEstaoAsPerdas', () => {
  it('mostra quem concentra as perdas, que elas estão espalhadas e o teto aritmético, em pt-BR', () => {
    render(<MyIDOndeEstaoAsPerdas analise={espalhado()} rotulos={ROTULOS} scoreExibido={9.69} />);
    const bloco = screen.getByRole('region', { name: 'Onde estão as perdas' });
    const texto = bloco.textContent ?? '';
    expect(texto).toContain('As 3 maiores perdas — Dor, Cabeça e emoções e Sono e energia — somam 43,6 dos 90,3 pts perdidos (48%)');
    expect(texto).toContain('As perdas estão espalhadas: a maior dimensão responde por 20% do total');
    expect(texto).toContain('Teto aritmético');
    expect(texto).toContain('de 9,7 para até 53,3');
    expect(texto).toContain('não uma meta clínica');
    // 5 barras, da maior para a menor, e as outras 6 resumidas
    expect(within(bloco).getAllByRole('listitem')).toHaveLength(5);
    expect(texto).toContain('−17,8');
    expect(texto).toContain('99% do máximo da dimensão');
    expect(texto).toContain('As outras 6 dimensões somam 23,9 pts'); // 82,31 das dimensões − 58,41 das cinco primeiras
  });

  it('com uma dimensão dominante não diz que as perdas estão espalhadas', () => {
    const a = analisarPerdas({ perdas_calculadas: perdas({ D: 18, P: 3, R: 2 }), myid_100: { total_perdas: 23 }, red_flags_details: {} })!;
    render(<MyIDOndeEstaoAsPerdas analise={a} rotulos={ROTULOS} scoreExibido={77} />);
    expect(screen.queryByText(/espalhadas/)).toBeNull();
  });

  it('sem perdas não desenha nada', () => {
    const a = analisarPerdas({ perdas_calculadas: perdas({ D: 0 }), myid_100: { total_perdas: 0 }, red_flags_details: {} })!;
    const { container } = render(<MyIDOndeEstaoAsPerdas analise={a} rotulos={ROTULOS} scoreExibido={100} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('MyIDFechamentoDaConta', () => {
  it('fecha a conta: dimensões, sinais de alerta, medicação, total e nota', () => {
    render(<MyIDFechamentoDaConta analise={espalhado()} />);
    const caixa = screen.getByLabelText('Fechamento da conta do MyID');
    const texto = caixa.textContent ?? '';
    expect(texto).toContain('Dimensões (11)−82,3 pts');
    expect(texto).toContain('Sinais de alerta (2 × 3 pts)−6,0 pts');
    expect(texto).toContain('Medicação e ajustes−2,0 pts');
    expect(texto).toContain('Total perdido90,3 pts');
    expect(texto).toContain('100 − 90,3 = 9,7/100');
    expect(texto).not.toContain('Pequena diferença');
  });

  it('perdas acima de 100: nota 0 e excedente explícito', () => {
    const a = analisarPerdas({
      perdas_calculadas: perdas({ D: 18, P: 16, R: 14, C: 11, AF: 10, EFI: 8, ERG: 8, NUT: 7, HID: 6, I: 5, N: 2 }),
      myid_100: { total_perdas: 106.4 },
      red_flags_details: { fever: true, night_pain: true },
    })!;
    render(<MyIDFechamentoDaConta analise={a} />);
    const texto = screen.getByLabelText('Fechamento da conta do MyID').textContent ?? '';
    expect(texto).toContain('100 − 106,4 = 0/100');
    expect(texto).toContain('excedente de 6,4 pts');
  });

  it('bônus de medicação aparece como ganho, e o teto de 15 dos sinais é avisado', () => {
    const a = analisarPerdas({
      perdas_calculadas: perdas({ D: 20 }),
      myid_100: { total_perdas: 33 },
      red_flags_details: { weight_loss: true, fever: true, night_pain: true, incontinence: true, progressive: true, neuropathy: true },
    })!;
    render(<MyIDFechamentoDaConta analise={a} />);
    const texto = screen.getByLabelText('Fechamento da conta do MyID').textContent ?? '';
    expect(texto).toContain('Sinais de alerta (6 × 3 pts, teto de 15)−15,0 pts');
    expect(texto).toContain('Medicação e ajustes (bônus)+2,0 pts');
  });

  it('sem o detalhe dos sinais de alerta mostra o que sobra junto, sem inventar a divisão', () => {
    const a = analisarPerdas({ perdas_calculadas: perdas({ D: 10, P: 5 }), myid_100: { total_perdas: 20 } })!;
    render(<MyIDFechamentoDaConta analise={a} />);
    const texto = screen.getByLabelText('Fechamento da conta do MyID').textContent ?? '';
    expect(texto).toContain('Sinais de alerta e medicação−5,0 pts');
    expect(texto).not.toContain('Medicação e ajustes');
  });
});
