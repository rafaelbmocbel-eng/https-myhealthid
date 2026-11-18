// Ao fechar, o diálogo zera o que o profissional mexeu: reabrir (ou trocar de paciente) nunca mostra o passo, o alerta ou a pergunta de
// "Descartar o que digitei?" da vez anterior.
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import ConfirmarMarcoDialog from '@/components/resumoClinico/ConfirmarMarcoDialog';
import type { CirurgiaDoCliente } from '@/lib/resumoClinico/tipos';

Element.prototype.scrollIntoView = vi.fn();
const CIRURGIA: CirurgiaDoCliente = { chave: 'historico_clinico:cirurgia:id:c1', tipo: 'Ligamento do joelho (LCA)', ano: '2022', complicacoes: '' };

function Tela({ aberto }: { aberto: boolean }) {
  return <ConfirmarMarcoDialog aberto={aberto} cirurgia={CIRURGIA} salvando={false} erro={null} hoje="2026-11-15" onConfirmar={vi.fn()} onCancelar={vi.fn()} />;
}
const dialogo = () => screen.getByRole('dialog', { name: 'Confirmar com a data real' });
const chip = (n: string) => within(dialogo()).getByRole('button', { name: n });

describe('ConfirmarMarcoDialog: o que ele guarda ao fechar (reabrir limpo)', () => {
  it('a precisão volta ao padrão "Sei o dia" ao reabrir', () => {
    const r = render(<Tela aberto />);
    fireEvent.click(chip('Só sei o ano'));
    expect(chip('Só sei o ano')).toHaveAttribute('aria-pressed', 'true');
    r.rerender(<Tela aberto={false} />);
    r.rerender(<Tela aberto />);
    expect(chip('Sei o dia')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('Só sei o ano')).toHaveAttribute('aria-pressed', 'false');
  });

  it('o erro de "falta o tipo" de uma tentativa de envio não reaparece ao reabrir', () => {
    const r = render(<Tela aberto />);
    fireEvent.submit(dialogo().querySelector('form') as HTMLFormElement);
    expect(within(dialogo()).queryAllByRole('alert').length).toBeGreaterThan(0);
    r.rerender(<Tela aberto={false} />);
    r.rerender(<Tela aberto />);
    expect(within(dialogo()).queryAllByRole('alert')).toHaveLength(0);
  });

  it('a pergunta "Descartar o que digitei?" não reaparece se o diálogo fechou por fora com ela aberta (troca de paciente)', () => {
    const r = render(<Tela aberto />);
    fireEvent.click(chip('Cirurgia'));
    fireEvent.keyDown(dialogo(), { key: 'Escape', code: 'Escape' });
    expect(screen.getByRole('alertdialog', { name: 'Descartar o que digitei?' })).toBeInTheDocument();
    r.rerender(<Tela aberto={false} />);
    r.rerender(<Tela aberto />);
    expect(screen.queryByRole('alertdialog', { name: 'Descartar o que digitei?' })).toBeNull();
  });
});
