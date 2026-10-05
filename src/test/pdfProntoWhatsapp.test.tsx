import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

const sb = vi.hoisted(() => ({
  upload: vi.fn(async () => ({ error: null })),
  invoke: vi.fn(async () => ({ data: { success: true }, error: null })),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    storage: { from: () => ({ upload: sb.upload, getPublicUrl: (p: string) => ({ data: { publicUrl: `https://x.test/${p}` } }) }) },
    functions: { invoke: sb.invoke },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));

import PdfProntoDialog from '../components/PdfProntoDialog';
import { entregarPdf } from '../lib/pdf/entrega';

describe('PDF pronto: WhatsApp do cliente', () => {
  const aba = { location: { href: '' }, close: vi.fn() };
  beforeEach(() => {
    vi.clearAllMocks();
    aba.location.href = '';
    vi.spyOn(window, 'open').mockReturnValue(aba as unknown as Window);
  });
  afterEach(() => { vi.restoreAllMocks(); });

  const abrir = async () => {
    render(<PdfProntoDialog />);
    act(() => { entregarPdf({ blob: new Blob(['%PDF'], { type: 'application/pdf' }), nome: 'Laudo_Maria.pdf', telefone: '(11) 91234-5678', mensagem: 'Segue o seu laudo.' }); });
    await screen.findByText('PDF pronto');
  };

  it('abre a aba do WhatsApp no clique, antes de subir o arquivo, e depois a leva para a conversa do cliente', async () => {
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: /Abrir no WhatsApp do cliente/ }));
    expect(window.open).toHaveBeenCalledTimes(1);
    expect(window.open).toHaveBeenCalledWith('', '_blank');
    await waitFor(() => expect(aba.location.href).toContain('https://wa.me/5511912345678?text='));
    const texto = decodeURIComponent(aba.location.href.split('text=')[1]);
    expect(texto).toContain('Segue o seu laudo.');
    expect(texto).toContain('https://x.test/u1/pdfs/');
    expect(sb.upload).toHaveBeenCalledTimes(1);
    expect(sb.invoke).not.toHaveBeenCalled();
  });

  it('sem telefone válido não abre nada', async () => {
    render(<PdfProntoDialog />);
    act(() => { entregarPdf({ blob: new Blob(['x']), nome: 'a.pdf' }); });
    await screen.findByText('PDF pronto');
    fireEvent.click(screen.getByRole('button', { name: /Abrir no WhatsApp do cliente/ }));
    expect(window.open).not.toHaveBeenCalled();
  });

  it('oferece baixar o PDF', async () => {
    await abrir();
    expect(screen.getByRole('button', { name: /Baixar o PDF/ })).toBeTruthy();
  });

  it('se o upload falhar, fecha a aba e não deixa o usuário sem resposta', async () => {
    sb.upload.mockResolvedValueOnce({ error: { message: 'sem espaço' } } as never);
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: /Abrir no WhatsApp do cliente/ }));
    await waitFor(() => expect(aba.close).toHaveBeenCalled());
    expect(aba.location.href).toBe('');
  });
});
