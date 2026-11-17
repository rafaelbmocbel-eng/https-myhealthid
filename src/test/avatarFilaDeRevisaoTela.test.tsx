import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { criarBancoFalso, type BancoFalso, type Linha } from './helpers/bancoFalso';

// Prova de que a fila de revisão do Avatar Clínico se comporta igual depois de a regra ir para filaDeRevisao.ts: este
// teste monta o cartão de verdade e foi rodado ANTES e DEPOIS da extração, com o mesmo resultado.

vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
Element.prototype.scrollIntoView = vi.fn();

const h = vi.hoisted(() => ({
  falso: null as unknown as BancoFalso,
  eventos: [] as Array<Record<string, unknown>>,
  usuario: { id: 'prof-1' } as { id: string } | null,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (t: string) => h.falso.from(t), rpc: () => Promise.resolve({ data: null, error: null }) },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: h.usuario }) }));
vi.mock('@/hooks/useEventosAnatomicos', async () => {
  const real = await vi.importActual<typeof import('@/hooks/useEventosAnatomicos')>('@/hooks/useEventosAnatomicos');
  return {
    ...real,
    useEventosAnatomicos: () => ({ data: h.eventos, isLoading: false }),
    useSaveEventoAnatomico: () => ({ mutate: vi.fn() }),
    useDeleteEventoAnatomico: () => ({ mutate: vi.fn() }),
  };
});

import AvatarClinicoCard from '@/components/avatar/AvatarClinicoCard';

let contador = 0;
function evento(tipo: string, texto: string, extra: Linha = {}): Linha {
  contador += 1;
  return {
    id: `ev-${contador}`, paciente_id: 'pac-1', terapeuta_id: 'prof-1', regiao_id: 'joelho_d', sistema: 'musculoesqueletico',
    origem: 'autocadastro_paciente', tipo_achado: texto, tipo_diagnostico: tipo, estrutura: null, diagnostico_cid: null, severidade: 1,
    status: 'ativo', data_inicio: '2026-10-01', data_resolucao: null, notas_clinicas: null, visivel_paciente: false, evento_origem_id: null,
    metadata: {}, created_at: '2026-10-01T12:00:00+00:00', updated_at: '2026-10-01T12:00:00+00:00', ...extra,
  };
}

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={qc}><AvatarClinicoCard pacienteId="pac-1" isProfessional /></QueryClientProvider>);
}

// A seção "Revisão de Histórico" é a única com esse título.
const secao = () => (screen.getByText('Revisão de Histórico').parentElement as HTMLElement);

beforeEach(() => {
  contador = 0;
  h.usuario = { id: 'prof-1' };
  h.falso = criarBancoFalso({});
  h.eventos = [];
});

describe('Avatar Clínico: fila de revisão (comportamento que a extração não pode mudar)', () => {
  it('sem nada para revisar mostra "Nenhum histórico pendente de revisão."', () => {
    h.eventos = [evento('achado_clinico', 'Achado já confirmado'), evento('historico_confirmado', 'Histórico já confirmado')];
    montar();
    expect(within(secao()).getByText('Nenhum histórico pendente de revisão.')).toBeInTheDocument();
    expect(within(secao()).queryByText(/aguardando sua revisão/)).toBeNull();
    expect(within(secao()).queryByText('Histórico clínico relatado pelo paciente')).toBeNull();
  });

  it('relato do paciente: entra o que não está resolvido; o resolvido fica de fora', () => {
    h.eventos = [
      evento('relato_paciente', 'Relato ativo', { status: 'ativo' }),
      evento('relato_paciente', 'Relato cronico', { status: 'cronico' }),
      evento('relato_paciente', 'Relato resolvido', { status: 'resolvido' }),
    ];
    montar();
    const s = secao();
    expect(within(s).getByText(/2 Achados — aguardando sua revisão/)).toBeInTheDocument();
    expect(within(s).getByText('Relato ativo')).toBeInTheDocument();
    expect(within(s).getByText('Relato cronico')).toBeInTheDocument();
    expect(within(s).queryByText('Relato resolvido')).toBeNull();
    expect(within(s).queryByText('Nenhum histórico pendente de revisão.')).toBeNull();
  });

  it('um relato só usa o singular "1 Achado"', () => {
    h.eventos = [evento('relato_paciente', 'Relato unico')];
    montar();
    expect(within(secao()).getByText(/^1 Achado — aguardando sua revisão/)).toBeInTheDocument();
  });

  it('histórico relatado: cada condição da regra tira o item da fila ou o mantém', () => {
    h.eventos = [
      evento('historico_relatado', 'Hist novo', { metadata: {} }),
      evento('historico_relatado', 'Hist sem metadata', { metadata: null }),
      evento('historico_relatado', 'Hist revisado por mim', { metadata: { revisado_por_ids: ['prof-1'] } }),
      evento('historico_relatado', 'Hist revisado por outro', { metadata: { revisado_por_ids: ['prof-2'] } }),
      evento('historico_relatado', 'Hist descartado', { metadata: { descartado: true } }),
      evento('historico_relatado', 'Hist duas rejeicoes', { metadata: { rejeicoes: [{ terapeuta_id: 'a' }, { terapeuta_id: 'b' }] } }),
      evento('historico_relatado', 'Hist tres rejeicoes', { metadata: { rejeicoes: [{}, {}, {}] } }),
      evento('historico_confirmado', 'Hist de outro tipo'),
    ];
    montar();
    const s = secao();
    expect(within(s).getByText('Histórico clínico relatado pelo paciente').parentElement).toHaveTextContent('4');
    for (const texto of ['Hist novo', 'Hist sem metadata', 'Hist revisado por outro', 'Hist duas rejeicoes']) expect(within(s).getByText(texto), texto).toBeInTheDocument();
    for (const texto of ['Hist revisado por mim', 'Hist descartado', 'Hist tres rejeicoes', 'Hist de outro tipo']) expect(within(s).queryByText(texto), texto).toBeNull();
    // A tela de hoje escreve "profissionalis" (plural com erro); o teste não fixa esse erro de grafia.
    expect(within(s).getByText(/^Rejeitado por 2 profission/)).toBeInTheDocument();
  });

  it('os descartados (marcados ou com 3 rejeições) vão para o histórico de descartados, não para a fila', () => {
    h.eventos = [
      evento('historico_relatado', 'Hist descartado', { metadata: { descartado: true } }),
      evento('historico_relatado', 'Hist tres rejeicoes', { metadata: { rejeicoes: [{}, {}, {}] } }),
      evento('historico_relatado', 'Hist quatro rejeicoes', { metadata: { rejeicoes: [{}, {}, {}, {}] } }),
      evento('historico_relatado', 'Hist pendente'),
    ];
    montar();
    const s = secao();
    fireEvent.click(within(s).getByRole('button', { name: /Histórico de possíveis achados descartados \(3\)/ }));
    for (const texto of ['Hist descartado', 'Hist tres rejeicoes', 'Hist quatro rejeicoes']) expect(within(s).getByText(texto), texto).toBeInTheDocument();
    expect(within(s).getByText('Hist pendente').closest('.line-through')).toBeNull();
    expect(within(s).getByText('Histórico clínico relatado pelo paciente').parentElement).toHaveTextContent('1');
  });

  it('só descartados: não aparece "Nenhum histórico pendente" (há o histórico de descartados) nem fila', () => {
    h.eventos = [evento('historico_relatado', 'Hist descartado', { metadata: { descartado: true } })];
    montar();
    const s = secao();
    expect(within(s).queryByText('Nenhum histórico pendente de revisão.')).toBeNull();
    expect(within(s).queryByText('Histórico clínico relatado pelo paciente')).toBeNull();
    expect(within(s).getByRole('button', { name: /descartados \(1\)/ })).toBeInTheDocument();
  });

  it('o item revisado por OUTRO profissional continua na fila de quem ainda não revisou', () => {
    h.eventos = [evento('historico_relatado', 'Hist de dois', { metadata: { revisado_por_ids: ['prof-2', 'prof-3'] } })];
    montar();
    expect(within(secao()).getByText('Hist de dois')).toBeInTheDocument();
  });

  it('a revisão é por profissional logado: com outro usuário o item revisado por prof-1 volta para a fila', () => {
    h.usuario = { id: 'prof-9' };
    h.eventos = [evento('historico_relatado', 'Hist revisado por prof-1', { metadata: { revisado_por_ids: ['prof-1'] } })];
    montar();
    expect(within(secao()).getByText('Hist revisado por prof-1')).toBeInTheDocument();
  });
});
