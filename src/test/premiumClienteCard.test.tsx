import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  conceder: vi.fn(),
  revogar: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('@/hooks/useAdminMetrics', () => ({
  concederPremiumCliente: (...a: unknown[]) => h.conceder(...a),
  revogarPremiumCliente: (...a: unknown[]) => h.revogar(...a),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: h.toast }) }));

import PremiumClienteCard from '@/components/admin/PremiumClienteCard';

const email = () => screen.getByLabelText('E-mail do cliente') as HTMLInputElement;
const dias = () => screen.getByLabelText('Dias (opcional)') as HTMLInputElement;
const escrever = (el: HTMLInputElement, v: string) => fireEvent.change(el, { target: { value: v } });

beforeEach(() => {
  h.conceder.mockReset().mockResolvedValue({ ok: true, ja_premium: false, ate: null });
  h.revogar.mockReset().mockResolvedValue({ ok: true });
  h.toast.mockReset();
});
afterEach(cleanup);

describe('PremiumClienteCard', () => {
  it('Dar Premium manda o e-mail sem espaços e sem prazo quando "dias" está vazio, e limpa os campos', async () => {
    render(<PremiumClienteCard />);
    escrever(email(), '  cliente@exemplo.com ');
    fireEvent.click(screen.getByRole('button', { name: /Dar Premium/ }));
    await waitFor(() => expect(h.conceder).toHaveBeenCalledTimes(1));
    expect(h.conceder).toHaveBeenCalledWith({ email: 'cliente@exemplo.com', dias: undefined });
    await waitFor(() => expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Premium liberado 🎁' })));
    expect(h.toast.mock.calls[0][0].description).toContain('sem prazo');
    expect(email().value).toBe('');
  });

  it('com dias manda o número', async () => {
    render(<PremiumClienteCard />);
    escrever(email(), 'cliente@exemplo.com');
    escrever(dias(), '30');
    fireEvent.click(screen.getByRole('button', { name: /Dar Premium/ }));
    await waitFor(() => expect(h.conceder).toHaveBeenCalledWith({ email: 'cliente@exemplo.com', dias: 30 }));
    await waitFor(() => expect(h.toast.mock.calls[0][0].description).toContain('30 dias'));
  });

  it('sem e-mail ou com dias inválido, nem chama o servidor', () => {
    render(<PremiumClienteCard />);
    fireEvent.click(screen.getByRole('button', { name: /Dar Premium/ }));
    expect(h.conceder).not.toHaveBeenCalled();
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
    for (const ruim of ['0', '1.5', '-3', '4000']) {
      h.toast.mockReset();
      escrever(email(), 'cliente@exemplo.com');
      escrever(dias(), ruim);
      fireEvent.click(screen.getByRole('button', { name: /Dar Premium/ }));
      expect(h.conceder, ruim).not.toHaveBeenCalled();
      expect(h.toast, ruim).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
    }
  });

  it('conta que já era Premium: avisa que nada mudou', async () => {
    h.conceder.mockResolvedValue({ ok: true, ja_premium: true });
    render(<PremiumClienteCard />);
    escrever(email(), 'cliente@exemplo.com');
    fireEvent.click(screen.getByRole('button', { name: /Dar Premium/ }));
    await waitFor(() => expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Essa conta já era Premium' })));
  });

  it('erro do servidor: mostra a mensagem, mantém os campos e não diz que liberou', async () => {
    h.conceder.mockRejectedValue(new Error('Essa conta é de paciente de um profissional. Não mudei nada.'));
    render(<PremiumClienteCard />);
    escrever(email(), 'cliente@exemplo.com');
    fireEvent.click(screen.getByRole('button', { name: /Dar Premium/ }));
    await waitFor(() => expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Não consegui liberar', description: 'Essa conta é de paciente de um profissional. Não mudei nada.', variant: 'destructive',
    })));
    expect(email().value).toBe('cliente@exemplo.com');
  });

  it('desabilita os botões enquanto grava (sem clique duplo)', async () => {
    let terminar: (v: unknown) => void = () => {};
    h.conceder.mockReturnValue(new Promise((r) => { terminar = r; }));
    render(<PremiumClienteCard />);
    escrever(email(), 'cliente@exemplo.com');
    const dar = screen.getByRole('button', { name: /Dar Premium/ });
    fireEvent.click(dar);
    await waitFor(() => expect(dar).toBeDisabled());
    fireEvent.click(dar);
    expect(h.conceder).toHaveBeenCalledTimes(1);
    terminar({ ok: true, ja_premium: false });
    await waitFor(() => expect(dar).not.toBeDisabled());
  });

  it('tirar a cortesia pede confirmação e só então chama o servidor; mudar o e-mail desfaz a confirmação', async () => {
    render(<PremiumClienteCard />);
    expect(screen.getByRole('button', { name: 'Tirar a cortesia' })).toBeDisabled();
    escrever(email(), 'cliente@exemplo.com');
    fireEvent.click(screen.getByRole('button', { name: 'Tirar a cortesia' }));
    expect(h.revogar).not.toHaveBeenCalled();
    escrever(email(), 'outro@exemplo.com');
    expect(screen.queryByRole('button', { name: /Confirmar: tirar o Premium/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Tirar a cortesia' }));
    fireEvent.click(screen.getByRole('button', { name: /Confirmar: tirar o Premium/ }));
    await waitFor(() => expect(h.revogar).toHaveBeenCalledWith({ email: 'outro@exemplo.com' }));
    await waitFor(() => expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Cortesia retirada' })));
  });

  it('cancelar a retirada não chama o servidor', () => {
    render(<PremiumClienteCard />);
    escrever(email(), 'cliente@exemplo.com');
    fireEvent.click(screen.getByRole('button', { name: 'Tirar a cortesia' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(h.revogar).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Tirar a cortesia' })).toBeInTheDocument();
  });

  it('erro ao tirar a cortesia: mostra a mensagem e volta ao estado normal', async () => {
    h.revogar.mockRejectedValue(new Error('O Premium dessa conta é uma assinatura paga, não cortesia. Não mudei nada.'));
    render(<PremiumClienteCard />);
    escrever(email(), 'cliente@exemplo.com');
    fireEvent.click(screen.getByRole('button', { name: 'Tirar a cortesia' }));
    fireEvent.click(screen.getByRole('button', { name: /Confirmar: tirar o Premium/ }));
    await waitFor(() => expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Não consegui retirar', variant: 'destructive' })));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tirar a cortesia' })).toBeInTheDocument());
  });
});
