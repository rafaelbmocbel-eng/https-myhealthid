import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { criarBancoFalso, type BancoFalso, type Linha } from './helpers/bancoFalso';
import { envolverBanco, type BancoEnvolvido } from './helpers/bancoFalsoLeitura';

const h = vi.hoisted(() => ({ falso: null as unknown as BancoFalso, banco: null as unknown as BancoEnvolvido }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (t: string) => h.banco.from(t), rpc: (n: string, a?: Record<string, unknown>) => h.banco.rpc(n, a) },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'prof-1' } }) }));
vi.mock('@/hooks/useLenteAtiva', () => ({ useLenteAtiva: () => ({ data: { id: 'fisioterapeuta' } }), temBloco: () => false }));
vi.mock('@/hooks/useEventosAnatomicos', () => ({ useSaveEventoAnatomico: () => ({ mutateAsync: vi.fn() }) }));
vi.mock('@/components/presencial/Body3DAvatar', () => ({ REGIONS: [], STRUCTURES: {} }));
vi.mock('@/components/presencial/MyIDResumoInline', () => ({ default: () => null }));
vi.mock('@/components/presencial/SafetyBanner', () => ({ default: () => null }));
vi.mock('@/components/presencial/ProtocoloAtivoResumo', () => ({ default: () => null }));
vi.mock('@/components/presencial/FechamentoSessaoForm', () => ({ default: () => null }));
vi.mock('@/components/voice/VoiceAssessment', () => ({ default: () => <div data-testid="registro-de-avaliacao">Avaliação por Voz</div> }));

import ResumoConsultaPresencial from '@/components/presencial/ResumoConsultaPresencial';

// "Nova Avaliação" do topo da aba Avaliação do perfil: era só um aviso (um bloco com "+" sem toque nenhum), e o botão de
// verdade ficava lá embaixo, depois de vários cartões. Agora o do topo é um botão: abre o registro de uma avaliação nova
// (o mesmo que "Nova avaliação" de baixo) e rola até ele.

const avaliacao: Linha = { id: 'av-1', paciente_id: 'pac-1', resultado: { _meta: {} }, created_at: '2026-10-06T14:26:00+00:00', origem_do_relato: null };

function preparar(tabelas: Record<string, Linha[]>) {
  h.falso = criarBancoFalso(tabelas);
  h.banco = envolverBanco(h.falso);
}

function montar(pedida = 0) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = (n: number) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ResumoConsultaPresencial pacienteId="pac-1" patientName="Ana Souza" novaAvaliacaoPedida={n} />
      </MemoryRouter>
    </QueryClientProvider>
  );
  const r = render(ui(pedida));
  return { ...r, pedir: (n: number) => r.rerender(ui(n)) };
}

const rolar = vi.fn();
beforeAll(() => {
  Element.prototype.scrollIntoView = rolar;
});
beforeEach(() => {
  rolar.mockReset();
});

describe('Nova Avaliação do topo abre o registro e leva até ele', () => {
  it('com avaliação anterior: o registro começa fechado (só o botão de baixo) e o pedido do topo o abre e rola até ele', async () => {
    preparar({ avaliacoes_voz: [avaliacao] });
    const { pedir } = montar(0);
    await screen.findByRole('button', { name: /Nova avaliação/ });
    expect(screen.queryByTestId('registro-de-avaliacao')).toBeNull();

    pedir(1);
    expect(await screen.findByTestId('registro-de-avaliacao')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    await waitFor(() => expect(rolar).toHaveBeenCalledTimes(1));
    expect(rolar).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });

  it('sem avaliação anterior o registro já está à vista; o pedido do topo só rola até ele', async () => {
    preparar({ avaliacoes_voz: [] });
    const { pedir } = montar(0);
    expect(await screen.findByTestId('registro-de-avaliacao')).toBeInTheDocument();
    pedir(1);
    await waitFor(() => expect(rolar).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('registro-de-avaliacao')).toBeInTheDocument();
  });

  it('abrir a tela com um número de pedidos que já existia não abre nada sozinho (só um toque novo abre)', async () => {
    preparar({ avaliacoes_voz: [avaliacao] });
    const { pedir } = montar(3);
    await screen.findByRole('button', { name: /Nova avaliação/ });
    expect(screen.queryByTestId('registro-de-avaliacao')).toBeNull();
    await act(async () => { await new Promise((r) => setTimeout(r, 120)); });
    expect(rolar).not.toHaveBeenCalled();
    pedir(4);
    expect(await screen.findByTestId('registro-de-avaliacao')).toBeInTheDocument();
  });

  it('o botão de baixo continua funcionando do mesmo jeito', async () => {
    preparar({ avaliacoes_voz: [avaliacao] });
    montar(0);
    fireEvent.click(await screen.findByRole('button', { name: /Nova avaliação/ }));
    expect(await screen.findByTestId('registro-de-avaliacao')).toBeInTheDocument();
    expect(rolar).not.toHaveBeenCalled();
  });

  it('Cancelar fecha o registro e um novo toque do topo o abre de novo', async () => {
    preparar({ avaliacoes_voz: [avaliacao] });
    const { pedir } = montar(0);
    await screen.findByRole('button', { name: /Nova avaliação/ });
    pedir(1);
    await waitFor(() => expect(rolar).toHaveBeenCalledTimes(1));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByTestId('registro-de-avaliacao')).toBeNull());
    pedir(2);
    expect(await screen.findByTestId('registro-de-avaliacao')).toBeInTheDocument();
    await waitFor(() => expect(rolar).toHaveBeenCalledTimes(2));
  });

  it('a seção tem o id nova-avaliacao e uma margem de rolagem, para a barra do topo não cobrir o registro', async () => {
    preparar({ avaliacoes_voz: [avaliacao] });
    const { container } = montar(0);
    await screen.findByRole('button', { name: /Nova avaliação/ });
    const secao = container.querySelector('#nova-avaliacao') as HTMLElement;
    expect(secao).not.toBeNull();
    expect(secao.className).toContain('scroll-mt-20');
  });
});

describe('PacientePerfil: o "Nova Avaliação" do topo da aba é um botão de verdade', () => {
  const fonte = readFileSync(join(process.cwd(), 'src/pages/PacientePerfil.tsx'), 'utf8');
  const i = fonte.indexOf('Nova Avaliação</span>');
  const botao = fonte.slice(fonte.lastIndexOf('<button', i), fonte.indexOf('</button>', i));

  it('é um <button type="button"> que soma um pedido, com alvo de 44 px e foco visível', () => {
    expect(i).toBeGreaterThan(0);
    expect(botao).toContain('type="button"');
    expect(botao).toContain('setNovaAvaliacaoPedida((n) => n + 1)');
    expect(botao).toContain('min-h-11');
    expect(botao).toContain('focus-visible:ring-2');
  });

  it('não tem <div> dentro do botão (HTML válido) e o ícone fica escondido do leitor de tela', () => {
    expect(botao).not.toContain('<div');
    expect(botao).toContain('aria-hidden="true"');
  });

  it('o pedido chega ao registro: ResumoConsultaPresencial recebe novaAvaliacaoPedida', () => {
    expect(fonte).toContain('const [novaAvaliacaoPedida, setNovaAvaliacaoPedida] = useState(0);');
    expect(fonte).toMatch(/<ResumoConsultaPresencial[\s\S]{0,400}novaAvaliacaoPedida=\{novaAvaliacaoPedida\}/);
  });
});
