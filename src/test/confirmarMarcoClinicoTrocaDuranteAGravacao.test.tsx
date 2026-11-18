// Quando a gravação do paciente anterior termina DEPOIS de o profissional trocar de paciente, a marca "levar o foco ao título" não pode ficar
// ligada: ela pertence ao diálogo que já fechou e faria o Cancelar do paciente novo mandar o foco para o título em vez do botão.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { criarBancoFalso, type BancoFalso } from './helpers/bancoFalso';

const h = vi.hoisted(() => ({
  falso: null as unknown as BancoFalso,
  auth: { user: { id: 'prof-1' }, profile: { nome: 'Ana', sobrenome: 'Souza', crefito: '12345-F' } },
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (t: string) => h.falso.from(t), rpc: vi.fn(), functions: { invoke: vi.fn() } } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => h.auth }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
import { useConfirmarMarcoClinico } from '@/hooks/useConfirmarMarcoClinico';

const A = { chave: 'historico_clinico:cirurgia:id:k1', tipo: 'Joelho do A', ano: '2022', complicacoes: '' };
const B = { chave: 'historico_clinico:cirurgia:id:k2', tipo: 'Ombro do B', ano: '2019', complicacoes: '' };
const SO_ANO = { tipo: 'cirurgia' as const, precisao: 'ano' as const, texto: '2022' };

beforeEach(() => { h.falso = criarBancoFalso({ historia_vida_paciente: [] }); document.body.innerHTML = ''; });

function montar(id = 'pac-A') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return renderHook(({ id }: { id: string }) => useConfirmarMarcoClinico(id), { wrapper, initialProps: { id } });
}

describe('troca de paciente DURANTE a gravação', () => {
  it('a gravação do paciente anterior que termina depois da troca não deixa a marca de foco velha: cancelar no paciente novo devolve o foco ao botão que abriu o diálogo', async () => {
    let liberar: () => void = () => {};
    h.falso.antesDeEscrever(() => new Promise<void>((r) => { liberar = r; }));
    const m = montar();
    const botaoA = document.createElement('button'); document.body.appendChild(botaoA); botaoA.focus();
    act(() => { m.result.current.pedirConfirmacao(A); });
    let pendente!: Promise<boolean>;
    act(() => { pendente = m.result.current.confirmacao.confirmar(SO_ANO); });
    await waitFor(() => expect(m.result.current.confirmacao.salvando).toBe(true));
    m.rerender({ id: 'pac-B' });
    // o diálogo do A já saiu da tela por causa da troca: o Radix devolve o foco nessa hora
    act(() => { m.result.current.devolverOFoco(new Event('x', { cancelable: true })); });
    await act(async () => { liberar(); await pendente; });
    // no B: o profissional abre o item do B e cancela
    botaoA.remove();
    const botaoB = document.createElement('button'); document.body.appendChild(botaoB); botaoB.focus();
    act(() => { m.result.current.pedirConfirmacao(B); });
    botaoB.blur();
    act(() => { m.result.current.confirmacao.cancelar(); });
    act(() => { m.result.current.devolverOFoco(new Event('x', { cancelable: true })); });
    expect(document.activeElement).toBe(botaoB);
  });
});
