import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { criarBancoFalso, type BancoFalso, type Linha } from './helpers/bancoFalso';

const h = vi.hoisted(() => ({
  falso: null as unknown as BancoFalso,
  auth: { user: { id: 'prof-1' }, profile: { nome: 'Ana', sobrenome: 'Souza', crefito: '12345-F' } },
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (t: string) => h.falso.from(t), rpc: vi.fn(), functions: { invoke: vi.fn() } },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => h.auth }));
vi.mock('sonner', () => ({ toast: h.toast }));

import {
  MSG_CONFIRMADO, MSG_PACIENTE_MUDOU_AO_CONFIRMAR, MSG_PACIENTE_MUDOU_AO_DESFAZER, useConfirmarMarcoClinico,
} from '@/hooks/useConfirmarMarcoClinico';
import { idDaConfirmacao } from '@/lib/resumoClinico/confirmacao';
import type { CirurgiaDoCliente, DadosDaConfirmacao, Marco } from '@/lib/resumoClinico/tipos';

// A rota /pacientes/:id reaproveita a mesma página quando só o :id muda (botão Voltar do navegador, Voltar do Android, link de
// notificação). Tudo o que o hook guarda de um paciente precisa sair junto, senão o Confirmar grava a cirurgia de um cliente no
// prontuário de outro. Duas camadas: o estado é zerado na troca, e quem grava recusa um alvo que não é do paciente atual.

const CIRURGIA_DO_A: CirurgiaDoCliente = { chave: 'historico_clinico:cirurgia:id:k1', tipo: 'Joelho do paciente A', ano: '2022', complicacoes: 'dor' };
const CIRURGIA_DO_B: CirurgiaDoCliente = { chave: 'historico_clinico:cirurgia:id:k2', tipo: 'Ombro do paciente B', ano: '2019', complicacoes: '' };
const SO_ANO: DadosDaConfirmacao = { tipo: 'cirurgia', precisao: 'ano', texto: '2022' };
const ID_DA_LINHA_DO_A = idDaConfirmacao('prof-1', 'pac-A', CIRURGIA_DO_A.chave);

const linhaDeConfirmacaoDoA = (): Linha => ({
  id: ID_DA_LINHA_DO_A, paciente_id: 'pac-A', terapeuta_id: 'prof-1', data_evento: '2022-01-01', tipo: 'cirurgia', titulo: CIRURGIA_DO_A.tipo, descricao: null,
  created_at: '2026-10-01T15:00:00+00:00',
  metadata: { versao: 1, origem: 'confirmacao_de_marco', fonte: 'historico_clinico', chave_cliente: CIRURGIA_DO_A.chave, precisao: 'ano' },
});

const marcoConfirmadoDoA = (): Marco => ({
  id: `historia_vida:${ID_DA_LINHA_DO_A}`, titulo: 'Joelho do paciente A',
  confirmacao: { idDaLinha: ID_DA_LINHA_DO_A, chave: CIRURGIA_DO_A.chave, relatoOriginal: { tipo: 'Joelho do paciente A', ano: '2022', complicacoes: '' }, situacao: 'igual', confirmadoEm: null, por: null },
}) as unknown as Marco;

type Vista = { id: string | undefined; alvoDaConfirmacao: CirurgiaDoCliente | null; alvoDoDesfazer: unknown; exibidoDaConfirmacao: CirurgiaDoCliente | null };

// Guarda o que CADA renderização devolveu: o diálogo de um paciente nunca pode aparecer nem por um quadro na tela do outro.
function montar(pacienteInicial = 'pac-A') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  const vistas: Vista[] = [];
  const r = renderHook(({ id }: { id: string }) => {
    const c = useConfirmarMarcoClinico(id);
    vistas.push({ id, alvoDaConfirmacao: c.confirmacao.alvo, alvoDoDesfazer: c.desfazer.alvo, exibidoDaConfirmacao: c.confirmacao.exibido });
    return c;
  }, { wrapper, initialProps: { id: pacienteInicial } });
  return { ...r, vistas };
}

const comAConfirmacaoDoAJaGravada = () => { h.falso = criarBancoFalso({ historia_vida_paciente: [linhaDeConfirmacaoDoA()] }); };

const escritas = () => h.falso.escritas().filter((o) => o.tabela === 'historia_vida_paciente');

beforeEach(() => {
  h.falso = criarBancoFalso({ historia_vida_paciente: [] });
  h.toast.success.mockClear();
  h.toast.error.mockClear();
  h.toast.info.mockClear();
});
afterEach(() => { document.body.innerHTML = ''; });

describe('troca de paciente com o diálogo de CONFIRMAR aberto', () => {
  it('o alvo do paciente anterior some na troca: o diálogo fecha e nada é gravado', async () => {
    const m = montar();
    act(() => { m.result.current.pedirConfirmacao(CIRURGIA_DO_A); });
    expect(m.result.current.confirmacao.alvo).toEqual(CIRURGIA_DO_A);

    m.rerender({ id: 'pac-B' });

    expect(m.result.current.confirmacao.alvo).toBeNull();
    let ok = true;
    await act(async () => { ok = await m.result.current.confirmacao.confirmar(SO_ANO); });
    expect(ok).toBe(false);
    expect(h.falso.escritas()).toEqual([]);
  });

  it('nenhuma renderização do paciente B enxerga o alvo do A (nem por um quadro antes de o estado ser zerado)', () => {
    const m = montar();
    act(() => { m.result.current.pedirConfirmacao(CIRURGIA_DO_A); });
    m.rerender({ id: 'pac-B' });
    const dePacienteB = m.vistas.filter((v) => v.id === 'pac-B');
    expect(dePacienteB.length).toBeGreaterThan(0);
    for (const vista of dePacienteB) {
      expect(vista.alvoDaConfirmacao).toBeNull();
      expect(vista.exibidoDaConfirmacao).toBeNull();
    }
  });

  it('voltar para o paciente A depois de passar pelo B não traz o diálogo de volta', () => {
    const m = montar();
    act(() => { m.result.current.pedirConfirmacao(CIRURGIA_DO_A); });
    m.rerender({ id: 'pac-B' });
    m.rerender({ id: 'pac-A' });
    expect(m.result.current.confirmacao.alvo).toBeNull();
    expect(m.result.current.confirmacao.exibido).toBeNull();
  });

  it('o erro de uma gravação que falhou no A não aparece no B', async () => {
    h.falso.falharEscritaQuando((op) => op.tipo === 'insert', 'falha');
    const m = montar();
    act(() => { m.result.current.pedirConfirmacao(CIRURGIA_DO_A); });
    await act(async () => { await m.result.current.confirmacao.confirmar(SO_ANO); });
    expect(m.result.current.confirmacao.erro).not.toBeNull();

    m.rerender({ id: 'pac-B' });
    expect(m.result.current.confirmacao.erro).toBeNull();
    m.rerender({ id: 'pac-A' });
    expect(m.result.current.confirmacao.erro).toBeNull();
  });

  it('depois da troca, pedir a confirmação de um item do B vale o item novo e grava no B', async () => {
    const m = montar();
    act(() => { m.result.current.pedirConfirmacao(CIRURGIA_DO_A); });
    m.rerender({ id: 'pac-B' });
    act(() => { m.result.current.pedirConfirmacao(CIRURGIA_DO_B); });
    expect(m.result.current.confirmacao.alvo).toEqual(CIRURGIA_DO_B);
    await act(async () => { await m.result.current.confirmacao.confirmar(SO_ANO); });
    const [escrita] = escritas();
    expect(escrita.tipo).toBe('insert');
    expect(escrita.payload).toMatchObject({ paciente_id: 'pac-B', titulo: 'Ombro do paciente B' });
  });

  it('o mesmo paciente (a página só redesenha) mantém o diálogo aberto', () => {
    const m = montar();
    act(() => { m.result.current.pedirConfirmacao(CIRURGIA_DO_A); });
    m.rerender({ id: 'pac-A' });
    expect(m.result.current.confirmacao.alvo).toEqual(CIRURGIA_DO_A);
  });

  it('uma gravação que já estava em andamento no A termina no A: a troca não a desvia para o B', async () => {
    let liberar: () => void = () => {};
    h.falso.antesDeEscrever(() => new Promise<void>((resolver) => { liberar = resolver; }));
    const m = montar();
    act(() => { m.result.current.pedirConfirmacao(CIRURGIA_DO_A); });
    let emAndamento!: Promise<boolean>;
    act(() => { emAndamento = m.result.current.confirmacao.confirmar(SO_ANO); });
    await waitFor(() => expect(m.result.current.confirmacao.salvando).toBe(true));
    m.rerender({ id: 'pac-B' });
    await act(async () => { liberar(); await emAndamento; });
    expect(escritas()).toHaveLength(1);
    expect(escritas()[0].payload).toMatchObject({ paciente_id: 'pac-A', titulo: 'Joelho do paciente A' });
    expect(m.result.current.confirmacao.alvo).toBeNull();
  });
});

describe('troca de paciente com o diálogo de DESFAZER aberto', () => {
  it('o alvo do desfazer some na troca e nada é apagado', async () => {
    comAConfirmacaoDoAJaGravada();
    const m = montar();
    act(() => { m.result.current.pedirDesfazer(marcoConfirmadoDoA()); });
    expect(m.result.current.desfazer.alvo).toEqual({ idDaLinha: ID_DA_LINHA_DO_A, titulo: 'Joelho do paciente A' });

    m.rerender({ id: 'pac-B' });

    expect(m.result.current.desfazer.alvo).toBeNull();
    expect(m.result.current.desfazer.exibido).toBeNull();
    let ok = true;
    await act(async () => { ok = await m.result.current.desfazer.desfazer(); });
    expect(ok).toBe(false);
    expect(h.falso.escritas()).toEqual([]);
    expect(h.falso.tabelas.historia_vida_paciente).toHaveLength(1);
  });

  it('nenhuma renderização do paciente B enxerga o alvo do desfazer do A', () => {
    const m = montar();
    act(() => { m.result.current.pedirDesfazer(marcoConfirmadoDoA()); });
    m.rerender({ id: 'pac-B' });
    const dePacienteB = m.vistas.filter((v) => v.id === 'pac-B');
    expect(dePacienteB.length).toBeGreaterThan(0);
    for (const vista of dePacienteB) expect(vista.alvoDoDesfazer).toBeNull();
  });

  it('voltar para o paciente A não traz o aviso de desfazer de volta', () => {
    const m = montar();
    act(() => { m.result.current.pedirDesfazer(marcoConfirmadoDoA()); });
    m.rerender({ id: 'pac-B' });
    m.rerender({ id: 'pac-A' });
    expect(m.result.current.desfazer.alvo).toBeNull();
  });

  it('o erro de um desfazer que falhou no A não aparece no B', async () => {
    h.falso.falharEscritaQuando((op) => op.tipo === 'delete', 'falha');
    const m = montar();
    act(() => { m.result.current.pedirDesfazer(marcoConfirmadoDoA()); });
    await act(async () => { await m.result.current.desfazer.desfazer(); });
    expect(m.result.current.desfazer.erro).not.toBeNull();

    m.rerender({ id: 'pac-B' });
    expect(m.result.current.desfazer.erro).toBeNull();
    m.rerender({ id: 'pac-A' });
    expect(m.result.current.desfazer.erro).toBeNull();
  });
});

describe('segunda camada: quem grava e quem apaga recusam um alvo de outro paciente', () => {
  // Uma função guardada da renderização do A e chamada depois que a rota já é a do B (toque que cruzou com a navegação): o alvo
  // dela é do A e o paciente de agora é o B.
  it('confirmar chamado com o alvo do A depois da troca: nada é gravado, a frase diz o que houve e um aviso aparece', async () => {
    const m = montar();
    act(() => { m.result.current.pedirConfirmacao(CIRURGIA_DO_A); });
    const { confirmar } = m.result.current.confirmacao;
    m.rerender({ id: 'pac-B' });

    let ok = true;
    await act(async () => { ok = await confirmar(SO_ANO); });

    expect(ok).toBe(false);
    expect(h.falso.escritas()).toEqual([]);
    expect(h.toast.error).toHaveBeenCalledWith(MSG_PACIENTE_MUDOU_AO_CONFIRMAR);
    expect(h.toast.success).not.toHaveBeenCalled();
    expect(MSG_PACIENTE_MUDOU_AO_CONFIRMAR).toBe('Você abriu outro cliente depois de pedir esta confirmação. Nada foi salvo. Peça a confirmação de novo no cliente certo.');
  });

  it('desfazer chamado com o alvo do A depois da troca: nada é apagado e a frase diz o que houve', async () => {
    comAConfirmacaoDoAJaGravada();
    const m = montar();
    act(() => { m.result.current.pedirDesfazer(marcoConfirmadoDoA()); });
    const { desfazer } = m.result.current.desfazer;
    m.rerender({ id: 'pac-B' });

    let ok = true;
    await act(async () => { ok = await desfazer(); });

    expect(ok).toBe(false);
    expect(h.falso.escritas()).toEqual([]);
    expect(h.falso.tabelas.historia_vida_paciente).toHaveLength(1);
    expect(h.toast.error).toHaveBeenCalledWith(MSG_PACIENTE_MUDOU_AO_DESFAZER);
    expect(h.toast.info).not.toHaveBeenCalled();
    expect(MSG_PACIENTE_MUDOU_AO_DESFAZER).toBe('Você abriu outro cliente depois de pedir este desfazer. Nada foi apagado. Peça de novo no cliente certo.');
  });

  it('a recusa não fica de herança: o erro dela não aparece no pedido seguinte', async () => {
    const m = montar();
    act(() => { m.result.current.pedirConfirmacao(CIRURGIA_DO_A); });
    const { confirmar } = m.result.current.confirmacao;
    m.rerender({ id: 'pac-B' });
    await act(async () => { await confirmar(SO_ANO); });
    expect(m.result.current.confirmacao.erro).toBe(MSG_PACIENTE_MUDOU_AO_CONFIRMAR);

    act(() => { m.result.current.pedirConfirmacao(CIRURGIA_DO_B); });
    expect(m.result.current.confirmacao.alvo).toEqual(CIRURGIA_DO_B);
    expect(m.result.current.confirmacao.erro).toBeNull();
  });

  it('a mesma regra no desfazer: o erro da recusa não aparece no pedido seguinte', async () => {
    const m = montar();
    act(() => { m.result.current.pedirDesfazer(marcoConfirmadoDoA()); });
    const { desfazer } = m.result.current.desfazer;
    m.rerender({ id: 'pac-B' });
    await act(async () => { await desfazer(); });
    expect(m.result.current.desfazer.erro).toBe(MSG_PACIENTE_MUDOU_AO_DESFAZER);

    act(() => { m.result.current.pedirDesfazer(marcoConfirmadoDoA()); });
    expect(m.result.current.desfazer.alvo).not.toBeNull();
    expect(m.result.current.desfazer.erro).toBeNull();
  });

  it('o alvo do próprio paciente continua gravando normalmente (a recusa não pega o caso comum)', async () => {
    const m = montar();
    act(() => { m.result.current.pedirConfirmacao(CIRURGIA_DO_A); });
    await act(async () => { await m.result.current.confirmacao.confirmar(SO_ANO); });
    expect(escritas()).toHaveLength(1);
    expect(escritas()[0].payload).toMatchObject({ paciente_id: 'pac-A', titulo: 'Joelho do paciente A' });
    expect(h.toast.success).toHaveBeenCalledWith(MSG_CONFIRMADO);
  });
});
