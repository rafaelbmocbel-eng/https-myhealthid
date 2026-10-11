import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({
  linha: { registro_profissional: null, verificado: false, verificado_em: null } as Record<string, unknown> | null,
  erroLeitura: null as string | null,
  erroRpc: null as string | null,
  rpc: vi.fn(),
  consultas: [] as { tabela: string; colunas: string; filtros: [string, unknown][] }[],
  toastOk: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'prof-1', email: 'prof@exemplo.com' } }) }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: (...a: unknown[]) => h.toastOk(...a) }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...a: unknown[]) => h.rpc(...a),
    from: (tabela: string) => {
      const consulta = { tabela, colunas: '', filtros: [] as [string, unknown][] };
      h.consultas.push(consulta);
      const b: Record<string, unknown> = {};
      b.select = (colunas: string) => {
        consulta.colunas = colunas;
        return b;
      };
      b.eq = (c: string, v: unknown) => {
        consulta.filtros.push([c, v]);
        return b;
      };
      b.maybeSingle = async () => (h.erroLeitura
        ? { data: null, error: { message: h.erroLeitura } }
        : { data: h.linha, error: null });
      return b;
    },
  },
}));

import RegistroProfissionalSecao from '@/components/configuracoes/RegistroProfissionalSecao';

function renderizar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <RegistroProfissionalSecao />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  h.linha = { registro_profissional: null, verificado: false, verificado_em: null };
  h.erroLeitura = null;
  h.erroRpc = null;
  h.consultas.length = 0;
  h.toastOk.mockReset();
  h.rpc.mockReset();
  h.rpc.mockImplementation(async (nome: string, args: Record<string, unknown>) => {
    if (h.erroRpc) return { data: null, error: { message: h.erroRpc } };
    if (nome === 'solicitar_verificacao') h.linha = { registro_profissional: args.p_registro, verificado: false, verificado_em: null };
    return { data: null, error: null };
  });
});
afterEach(() => cleanup());

describe('Configurações: registro no conselho e verificação', () => {
  it('lê só as colunas de verificação do próprio perfil', async () => {
    renderizar();
    await screen.findByLabelText(/Registro no conselho \(CREFITO, CREF, CRN…\)/);
    expect(h.consultas[0]).toMatchObject({
      tabela: 'profiles',
      colunas: 'registro_profissional, verificado, verificado_em, crefito',
      filtros: [['user_id', 'prof-1']],
    });
  });

  it('sem registro enviado mas com CREFITO no perfil: vem preenchido como sugestão e só vai quando o profissional envia', async () => {
    h.linha = { registro_profissional: null, verificado: false, verificado_em: null, crefito: 'CREFITO-3 12345-F' };
    renderizar();
    const campo = await screen.findByLabelText(/Registro no conselho/);
    await waitFor(() => expect(campo).toHaveValue('CREFITO-3 12345-F'));
    expect(screen.getByText('Registro não informado')).toBeInTheDocument();
    expect(screen.getByText(/Sugestão: este é o registro que você já tem no perfil/)).toBeInTheDocument();
    expect(h.rpc).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Enviar para verificação' }));
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('solicitar_verificacao', { p_registro: 'CREFITO-3 12345-F' }));
  });

  it('com registro já enviado, o CREFITO do perfil não sobrescreve nada', async () => {
    h.linha = { registro_profissional: 'CRN 99', verificado: false, verificado_em: null, crefito: 'CREFITO-3 12345-F' };
    renderizar();
    const campo = await screen.findByLabelText(/Registro no conselho/);
    await waitFor(() => expect(campo).toHaveValue('CRN 99'));
    expect(screen.queryByText(/Sugestão: este é o registro/)).not.toBeInTheDocument();
  });

  it('sem registro: mostra "Registro não informado" e o envio só libera com 3+ caracteres', async () => {
    renderizar();
    const campo = await screen.findByLabelText(/Registro no conselho/);
    expect(screen.getByText('Registro não informado')).toBeInTheDocument();
    const enviar = screen.getByRole('button', { name: 'Enviar para verificação' });
    expect(enviar).toBeDisabled();

    fireEvent.change(campo, { target: { value: 'ab' } });
    expect(enviar).toBeDisabled();
    expect(screen.getByText(/pelo menos 3 caracteres/)).toBeInTheDocument();
    fireEvent.change(campo, { target: { value: '  CREFITO-3 123456-F  ' } });
    expect(enviar).toBeEnabled();
  });

  it('envia o registro aparado pela RPC e passa a mostrar "Aguardando verificação"', async () => {
    renderizar();
    fireEvent.change(await screen.findByLabelText(/Registro no conselho/), { target: { value: '  CREFITO-3 123456-F  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar para verificação' }));

    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('solicitar_verificacao', { p_registro: 'CREFITO-3 123456-F' }));
    await waitFor(() => expect(h.toastOk).toHaveBeenCalledWith(expect.stringMatching(/Registro enviado/)));
    expect(await screen.findByText('Aguardando verificação')).toBeInTheDocument();
    expect(screen.getByLabelText(/Registro no conselho/)).toHaveValue('CREFITO-3 123456-F');
    expect(screen.getByRole('button', { name: 'Enviar para verificação' })).toBeDisabled();
  });

  it('registro já enviado e ainda não verificado pode ser corrigido e reenviado', async () => {
    h.linha = { registro_profissional: 'CRN 111', verificado: false, verificado_em: null };
    renderizar();
    const campo = await screen.findByLabelText(/Registro no conselho/);
    await waitFor(() => expect(campo).toHaveValue('CRN 111'));
    expect(screen.getByText('Aguardando verificação')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar para verificação' })).toBeDisabled();
    fireEvent.change(campo, { target: { value: 'CRN 222' } });
    expect(screen.getByRole('button', { name: 'Enviar para verificação' })).toBeEnabled();
  });

  it('verificado: mostra o selo com a data, trava o campo e não oferece reenvio', async () => {
    h.linha = { registro_profissional: 'CRN 111', verificado: true, verificado_em: '2026-10-08T15:00:00Z' };
    renderizar();
    expect(await screen.findByText(/Verificado pela equipe MyHealthID · 08\/10\/2026/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Registro no conselho/)).toBeDisabled();
    expect(screen.getByLabelText(/Registro no conselho/)).toHaveValue('CRN 111');
    expect(screen.queryByRole('button', { name: 'Enviar para verificação' })).not.toBeInTheDocument();
    expect(screen.getByText(/Alterá-lo derrubaria a verificação; para trocar, fale com o suporte/)).toBeInTheDocument();
  });

  it('erro da RPC aparece e o envio pode ser tentado de novo', async () => {
    h.erroRpc = 'Apenas o administrador MyHealthID';
    renderizar();
    fireEvent.change(await screen.findByLabelText(/Registro no conselho/), { target: { value: 'CRN 12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar para verificação' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Apenas o administrador MyHealthID pode/);
    expect(screen.getByRole('button', { name: 'Enviar para verificação' })).toBeEnabled();
  });

  it('banco ainda sem as colunas novas: a seção some em vez de mostrar erro técnico', async () => {
    h.erroLeitura = 'column profiles.registro_profissional does not exist';
    const { container } = renderizar();
    await waitFor(() => expect(h.consultas.length).toBeGreaterThan(0));
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
