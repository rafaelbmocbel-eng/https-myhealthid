import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { criarBancoFalso, type BancoFalso, type Linha } from './helpers/bancoFalso';
import { envolverBanco, type BancoEnvolvido } from './helpers/bancoFalsoLeitura';

vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
Element.prototype.scrollIntoView = vi.fn();

const h = vi.hoisted(() => ({ falso: null as unknown as BancoFalso, banco: null as unknown as BancoEnvolvido }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (t: string) => h.banco.from(t),
    rpc: (nome: string, args?: Record<string, unknown>) => h.banco.rpc(nome, args),
    functions: { invoke: vi.fn() },
  },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'prof-1' } }) }));
vi.mock('@/components/voice/VoiceAssessment', () => ({ default: () => <div>VoiceAssessment simulado</div> }));

import LinhaDoTempoClinica from '@/components/resumoClinico/LinhaDoTempoClinica';
import AvaliacaoSecoesEditaveis from '@/components/voice/AvaliacaoSecoesEditaveis';
import AvaliacaoVozAtual from '@/components/voice/AvaliacaoVozAtual';
import type { DestinoDoRegistro } from '@/lib/resumoClinico/tipos';

// Botão "Abrir" nos marcos que têm onde abrir (avaliação presencial e diagnóstico). Sem a função da página, ou sem destino,
// ou quando a página diz que não há onde abrir, o botão não existe.

const TITULO_DA_LINHA = 'Linha do tempo clínica';
const NOME_DO_BOTAO = /^Abrir (a avaliação|o diagnóstico)/;

const avaliacao = (extra: Linha = {}): Linha => ({
  id: 'av-nova', paciente_id: 'pac-1', terapeuta_id: 'prof-1', created_at: '2026-10-06T15:00:00+00:00', queixa_principal: 'Dor lombar', servico: 'identidade',
  classificacao_severidade: 'Moderada', transcricao: '',
  resultado: { resumo_clinico: 'Paciente com dor lombar crônica.', classificacao_severidade: 'Moderada', queixa_principal: 'Dor lombar crônica', dor: { localizacao: 'Lombar', intensidade_eva: 7 }, _meta: { mode: 'voice', savedAt: 's1' }, _secoes: { confirmadas: ['resumo_clinico', 'dor'], editadas: {} } },
  ...extra,
});
const antiga = (): Linha => avaliacao({ id: 'av-antiga', created_at: '2026-08-02T15:00:00+00:00', queixa_principal: 'Dor no ombro' });
const diagnostico = (extra: Linha = {}): Linha => ({
  id: 'd1', paciente_id: 'pac-1', data_diagnostico: '2024-05-06', cid_codigo: 'M54.5', cid_descricao: 'Dor lombar baixa', created_at: '2026-01-01T12:00:00+00:00', ativo: true, tipo: 'principal', ...extra,
});

// Seis marcos com data (cabem todos antes do "Ver todos"): duas avaliações, um diagnóstico, uma fratura, uma cirurgia e o MyID.
function cenario(extra: Record<string, Linha[]> = {}): Record<string, Linha[]> {
  return {
    pacientes: [{
      id: 'pac-1',
      historico_clinico: { cirurgias: { items: [{ id: 'c1', tipo: 'Joelho', ano: '2022' }, { id: 'c2', tipo: 'Apêndice', ano: 'há 2 anos' }] } },
      historia_atual: { queixa: 'Dor lombar do lado direito', inicio: 'Há 3 semanas, depois da mudança' },
    }],
    myid_avaliacoes: [{ id: 'm1', paciente_id: 'pac-1', status: 'concluido', created_at: '2026-09-01T12:00:00+00:00', updated_at: '2026-09-02T12:00:00+00:00', respostas_brutas: { bloco_1_queixa: 'Dor ao sentar' } }],
    avaliacoes_identidade: [{ id: 'ai1', paciente_id: 'pac-1', terapeuta_id: 'prof-1', myid_avaliacao_id: 'm1', created_at: '2026-09-02T12:00:00+00:00' }],
    avaliacoes_voz: [antiga(), avaliacao()],
    historia_vida_paciente: [{ id: 'h1', paciente_id: 'pac-1', data_evento: '2019-03-04', tipo: 'fratura', titulo: 'Fratura de punho', descricao: '' }],
    diagnosticos_paciente: [diagnostico(), diagnostico({ id: 'd-sem', cid_codigo: 'M51.1', cid_descricao: 'Hérnia de disco', data_diagnostico: null })],
    exames_presenciais: [],
    exames_importados: [],
    testes_funcionais_paciente: [],
    escalas_psicologia: [],
    notas_prontuario: [],
    eventos_clinicos_anatomicos: [],
    ...extra,
  };
}

// Mais quatro marcos (envio do histórico, exame, teste e escala): passa de 6, então aparecem "Ver todos" e os chips de filtro.
function cenarioCompleto(extra: Record<string, Linha[]> = {}): Record<string, Linha[]> {
  const base = cenario();
  return cenario({
    pacientes: [{ ...base.pacientes[0], historico_clinico: { ...(base.pacientes[0].historico_clinico as object), ultimo_envio: '2026-10-02T12:00:00+00:00' } }],
    exames_presenciais: [{ id: 'e1', paciente_id: 'pac-1', tipo: 'bioimpedancia', data_exame: '2026-08-01', resumo: 'Peso 70 kg' }],
    testes_funcionais_paciente: [{ id: 't1', paciente_id: 'pac-1', tipo_teste: 'sentar_levantar_30s', resultado: 14, unidade: 'reps', data_teste: '2026-06-01' }],
    escalas_psicologia: [{ id: 's1', paciente_id: 'pac-1', tipo_escala: 'phq9', pontuacao_total: 7, data_aplicacao: '2026-05-01' }],
    ...extra,
  });
}

function preparar(tabelas: Record<string, Linha[]> = cenario()) {
  h.falso = criarBancoFalso(tabelas);
  h.banco = envolverBanco(h.falso);
}

const cliente = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });

interface PropsDaLinha {
  onAbrirRegistro?: (d: DestinoDoRegistro) => void;
  registroAbrivel?: (d: DestinoDoRegistro) => boolean;
}
function montar(props: PropsDaLinha = {}) {
  return render(<QueryClientProvider client={cliente()}><LinhaDoTempoClinica pacienteId="pac-1" {...props} /></QueryClientProvider>);
}

const regiao = () => screen.findByRole('region', { name: TITULO_DA_LINHA });
async function esperarOsMarcos(r: HTMLElement) {
  await waitFor(() => expect(within(r).getByText('Fratura de punho')).toBeInTheDocument());
}
const botoesDeAbrir = (raiz: HTMLElement) => within(raiz).queryAllByRole('button', { name: NOME_DO_BOTAO });
const itemDoMarco = (r: HTMLElement, titulo: string) => within(r).getByText(titulo).closest('li') as HTMLElement;

beforeEach(() => { vi.mocked(Element.prototype.scrollIntoView).mockClear(); preparar(); });

describe('Linha do tempo: botão "Abrir" nos marcos que têm onde abrir', () => {
  it('com a função da página, a avaliação e o diagnóstico ganham o botão, com o texto acessível de cada um', async () => {
    montar({ onAbrirRegistro: vi.fn() });
    const r = await regiao();
    await esperarOsMarcos(r);
    expect(within(r).getByRole('button', { name: 'Abrir o diagnóstico M54.5' })).toBeInTheDocument();
    expect(within(r).getByRole('button', { name: 'Abrir a avaliação de 06/10/2026' })).toBeInTheDocument();
    expect(within(r).getByRole('button', { name: 'Abrir a avaliação de 02/08/2026' })).toBeInTheDocument();
    expect(botoesDeAbrir(r)).toHaveLength(3);
  });

  it('o botão mostra só "Abrir" na tela e o resto do nome fica para o leitor de tela', async () => {
    montar({ onAbrirRegistro: vi.fn() });
    const r = await regiao();
    await esperarOsMarcos(r);
    const botao = within(r).getByRole('button', { name: 'Abrir o diagnóstico M54.5' });
    expect(botao.textContent?.trim()).toBe('Abrir');
    expect(botao.getAttribute('aria-label')).toBe('Abrir o diagnóstico M54.5');
    expect(botao.getAttribute('type')).toBe('button');
  });

  it('o botão fica dentro do próprio marco: o do diagnóstico no marco do diagnóstico, o da avaliação no da avaliação', async () => {
    montar({ onAbrirRegistro: vi.fn() });
    const r = await regiao();
    await esperarOsMarcos(r);
    expect(within(itemDoMarco(r, '[M54.5] Dor lombar baixa')).getAllByRole('button')).toHaveLength(1);
    expect(within(itemDoMarco(r, '[M54.5] Dor lombar baixa')).getByRole('button', { name: 'Abrir o diagnóstico M54.5' })).toBeInTheDocument();
    const avaliacoes = within(r).getAllByText('Avaliação presencial registrada').map((el) => el.closest('li') as HTMLElement);
    expect(avaliacoes).toHaveLength(2);
    expect(within(avaliacoes[0]).getByRole('button', { name: 'Abrir a avaliação de 06/10/2026' })).toBeInTheDocument();
    expect(within(avaliacoes[1]).getByRole('button', { name: 'Abrir a avaliação de 02/08/2026' })).toBeInTheDocument();
  });

  it('o clique chama a função uma vez, com o destino certo (fonte e id do registro) e mais nada', async () => {
    const abrir = vi.fn();
    montar({ onAbrirRegistro: abrir });
    const r = await regiao();
    await esperarOsMarcos(r);

    fireEvent.click(within(r).getByRole('button', { name: 'Abrir o diagnóstico M54.5' }));
    expect(abrir).toHaveBeenCalledTimes(1);
    expect(abrir).toHaveBeenLastCalledWith({ fonte: 'diagnostico', id: 'd1' });

    fireEvent.click(within(r).getByRole('button', { name: 'Abrir a avaliação de 06/10/2026' }));
    expect(abrir).toHaveBeenCalledTimes(2);
    expect(abrir).toHaveBeenLastCalledWith({ fonte: 'avaliacao_voz', id: 'av-nova' });

    fireEvent.click(within(r).getByRole('button', { name: 'Abrir a avaliação de 02/08/2026' }));
    expect(abrir).toHaveBeenCalledTimes(3);
    expect(abrir).toHaveBeenLastCalledWith({ fonte: 'avaliacao_voz', id: 'av-antiga' });
    expect(h.falso.escritas()).toEqual([]);
  });

  it('sem a função da página nenhum marco ganha o botão (nunca um botão que não leva a lugar nenhum)', async () => {
    montar();
    const r = await regiao();
    await esperarOsMarcos(r);
    expect(botoesDeAbrir(r)).toHaveLength(0);
    expect(within(r).queryByRole('button', { name: /^Abrir/ })).toBeNull();
  });

  it('a página também pode dizer que um destino não tem onde abrir: só aquele marco fica sem o botão', async () => {
    const abrivel = vi.fn((d: DestinoDoRegistro) => d.fonte !== 'diagnostico');
    montar({ onAbrirRegistro: vi.fn(), registroAbrivel: abrivel });
    const r = await regiao();
    await esperarOsMarcos(r);
    expect(within(r).queryByRole('button', { name: 'Abrir o diagnóstico M54.5' })).toBeNull();
    expect(botoesDeAbrir(r)).toHaveLength(2);
    expect(abrivel).toHaveBeenCalledWith({ fonte: 'diagnostico', id: 'd1' });
    expect(abrivel).toHaveBeenCalledWith({ fonte: 'avaliacao_voz', id: 'av-nova' });
  });

  it('se a página diz que nenhum destino é abrível, nenhum botão aparece, mesmo com a função', async () => {
    montar({ onAbrirRegistro: vi.fn(), registroAbrivel: () => false });
    const r = await regiao();
    await esperarOsMarcos(r);
    expect(botoesDeAbrir(r)).toHaveLength(0);
  });

  it('a pergunta "é abrível?" sem a função de abrir não faz aparecer botão nenhum', async () => {
    montar({ registroAbrivel: () => true });
    const r = await regiao();
    await esperarOsMarcos(r);
    expect(botoesDeAbrir(r)).toHaveLength(0);
  });

  it('marco cuja linha veio sem id não ganha botão, mas os outros marcos da avaliação sim', async () => {
    preparar(cenario({ avaliacoes_voz: [{ ...antiga(), id: undefined }, avaliacao()] }));
    montar({ onAbrirRegistro: vi.fn() });
    const r = await regiao();
    await esperarOsMarcos(r);
    expect(within(r).queryByRole('button', { name: 'Abrir a avaliação de 02/08/2026' })).toBeNull();
    expect(within(r).getByRole('button', { name: 'Abrir a avaliação de 06/10/2026' })).toBeInTheDocument();
    expect(botoesDeAbrir(r)).toHaveLength(2);
  });

  it('os outros marcos (história de vida, cirurgia, MyID, envio, exame, teste, escala) ficam como estão: sem botão', async () => {
    preparar(cenarioCompleto());
    montar({ onAbrirRegistro: vi.fn() });
    const r = await regiao();
    await within(r).findByRole('button', { name: /^Ver todos/ });
    fireEvent.click(within(r).getByRole('button', { name: /^Ver todos/ }));
    const itens = Array.from(r.querySelectorAll('#linha-do-tempo-marcos li')) as HTMLElement[];
    expect(itens).toHaveLength(10);
    const comBotao = itens.filter((li) => li.querySelector('button'));
    expect(comBotao).toHaveLength(3);
    for (const titulo of ['Fratura de punho', 'Joelho', 'MyID concluído', 'Último envio do histórico clínico (pelo cliente)', 'Bioimpedância', 'Sentar levantar 30s', 'PHQ-9 (Depressão)']) {
      const li = within(r).getAllByText(new RegExp(titulo.replace(/[()]/g, '\\$&')))[0].closest('li') as HTMLElement;
      expect(li.querySelector('button'), titulo).toBeNull();
    }
  });

  it('o item de "Sem data" (diagnóstico sem a data do fato) não ganha botão', async () => {
    montar({ onAbrirRegistro: vi.fn() });
    const r = await regiao();
    await esperarOsMarcos(r);
    fireEvent.click(within(r).getByRole('button', { name: /^Sem data/ }));
    const semData = r.querySelector('#linha-do-tempo-sem-data') as HTMLElement;
    expect(semData).toBeVisible();
    expect(semData.textContent).toContain('Hérnia de disco');
    expect(within(semData).queryAllByRole('button')).toHaveLength(0);
  });

  it('o cartão "Como começou" não ganha botão', async () => {
    montar({ onAbrirRegistro: vi.fn() });
    const r = await regiao();
    await esperarOsMarcos(r);
    const cartao = r.querySelector('[data-bloco="como-comecou"]') as HTMLElement;
    expect(cartao).not.toBeNull();
    expect(within(cartao).queryAllByRole('button')).toHaveLength(0);
  });

  it('com o filtro por tipo o botão acompanha o marco', async () => {
    preparar(cenarioCompleto());
    montar({ onAbrirRegistro: vi.fn() });
    const r = await regiao();
    fireEvent.click(await within(r).findByRole('button', { name: /^Avaliações/ }));
    expect(botoesDeAbrir(r)).toHaveLength(2);
    expect(within(r).queryByRole('button', { name: 'Abrir o diagnóstico M54.5' })).toBeNull();
    fireEvent.click(within(r).getByRole('button', { name: /^Cirurgias e diagnósticos/ }));
    expect(botoesDeAbrir(r).map((b) => b.getAttribute('aria-label'))).toEqual(['Abrir o diagnóstico M54.5']);
  });

  it('marco do diagnóstico que fica além dos 6 primeiros só ganha o botão quando o "Ver todos" o mostra', async () => {
    preparar(cenarioCompleto({ diagnosticos_paciente: [diagnostico({ data_diagnostico: '2001-05-06' })] }));
    montar({ onAbrirRegistro: vi.fn() });
    const r = await regiao();
    await within(r).findByRole('button', { name: /^Ver todos/ });
    expect(within(r).queryByRole('button', { name: 'Abrir o diagnóstico M54.5' })).toBeNull();
    fireEvent.click(within(r).getByRole('button', { name: /^Ver todos/ }));
    expect(within(r).getByRole('button', { name: 'Abrir o diagnóstico M54.5' })).toBeInTheDocument();
  });

  it('diagnóstico removido ou suspeita não gera marco nem botão', async () => {
    preparar(cenario({ diagnosticos_paciente: [diagnostico({ ativo: false }), diagnostico({ id: 'd-susp', tipo: 'suspeita', cid_codigo: 'M99.9' })] }));
    montar({ onAbrirRegistro: vi.fn() });
    const r = await regiao();
    await esperarOsMarcos(r);
    expect(within(r).queryByRole('button', { name: /diagnóstico/ })).toBeNull();
  });
});

describe('Linha do tempo: o botão no celular (390 px), no tema escuro e para quem usa teclado', () => {
  async function botao() {
    montar({ onAbrirRegistro: vi.fn() });
    const r = await regiao();
    await esperarOsMarcos(r);
    return within(r).getByRole('button', { name: 'Abrir o diagnóstico M54.5' });
  }

  it('alvo de toque de 44 px nos dois sentidos e foco visível', async () => {
    const b = await botao();
    expect(b.className).toContain('min-h-11');
    expect(b.className).toContain('min-w-11');
    expect(b.className).not.toMatch(/\b(min-)?h-(6|7|8|9|10)\b/);
    expect(b.className).toContain('focus-visible:ring-2');
    expect(b.className).toContain('focus-visible:outline-none');
  });

  it('é um botão de verdade, alcançável pelo teclado, e o ícone não é lido', async () => {
    const b = await botao();
    expect(b.tagName).toBe('BUTTON');
    expect(b.tabIndex).toBeGreaterThanOrEqual(0);
    b.focus();
    expect(document.activeElement).toBe(b);
    expect(b.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('sem truncate, sem line-clamp e sem texto que não quebra linha', async () => {
    const b = await botao();
    const marco = b.closest('li') as HTMLElement;
    expect(b.className).not.toMatch(/truncate|line-clamp|text-ellipsis|overflow-hidden|whitespace-nowrap/);
    expect(marco.innerHTML).not.toMatch(/line-clamp|truncate|text-ellipsis|whitespace-nowrap/);
  });

  it('só usa as cores do tema (primary, background, ring): serve no claro e no escuro', async () => {
    const b = await botao();
    expect(b.className).toContain('bg-background');
    expect(b.className).toContain('text-primary');
    expect(b.className).toContain('border-primary/40');
    expect(b.className).not.toMatch(/\b(bg|text|border)-(white|black|gray|slate|zinc|neutral|stone)(-\d+)?\b|#[0-9a-fA-F]{3,6}\b/);
  });

  it('não é escondido no celular nem só no computador (mobile first)', async () => {
    const b = await botao();
    expect(b.className).not.toMatch(/\bhidden\b|\bsm:inline|\bmd:inline|\blg:inline|\bsm:flex\b|\bmd:flex\b/);
    expect(b.className).toContain('inline-flex');
  });
});

describe('o botão chega da página até a linha do tempo nas três formas da aba Avaliação', () => {
  const montarAvaliacaoAtual = (props: PropsDaLinha) => render(
    <QueryClientProvider client={cliente()}>
      <MemoryRouter><AvaliacaoVozAtual pacienteId="pac-1" patientName="Ana Souza" {...props} /></MemoryRouter>
    </QueryClientProvider>,
  );

  it('com avaliação (abas editáveis): o diagnóstico e a ÚLTIMA avaliação ganham o botão; a avaliação antiga não (a aba não tem onde abri-la)', async () => {
    const abrir = vi.fn();
    montarAvaliacaoAtual({ onAbrirRegistro: abrir });
    const r = await regiao();
    await esperarOsMarcos(r);
    expect(within(r).getByRole('button', { name: 'Abrir a avaliação de 06/10/2026' })).toBeInTheDocument();
    expect(within(r).getByRole('button', { name: 'Abrir o diagnóstico M54.5' })).toBeInTheDocument();
    expect(within(r).queryByRole('button', { name: 'Abrir a avaliação de 02/08/2026' })).toBeNull();
    expect(botoesDeAbrir(r)).toHaveLength(2);
    // O marco da avaliação antiga continua na linha do tempo, só não tem botão.
    expect(within(r).getAllByText('Avaliação presencial registrada')).toHaveLength(2);

    fireEvent.click(within(r).getByRole('button', { name: 'Abrir a avaliação de 06/10/2026' }));
    expect(abrir).toHaveBeenCalledWith({ fonte: 'avaliacao_voz', id: 'av-nova' });
    fireEvent.click(within(r).getByRole('button', { name: 'Abrir o diagnóstico M54.5' }));
    expect(abrir).toHaveBeenLastCalledWith({ fonte: 'diagnostico', id: 'd1' });
  });

  it('avaliação ainda sem resultado (tela de gravação): a última avaliação também ganha o botão, a antiga não', async () => {
    preparar(cenario({ avaliacoes_voz: [antiga(), avaliacao({ resultado: null })] }));
    const abrir = vi.fn();
    montarAvaliacaoAtual({ onAbrirRegistro: abrir });
    const r = await regiao();
    await esperarOsMarcos(r);
    expect(await within(r).findByRole('button', { name: 'Abrir a avaliação de 06/10/2026' })).toBeInTheDocument();
    expect(within(r).queryByRole('button', { name: 'Abrir a avaliação de 02/08/2026' })).toBeNull();
    fireEvent.click(within(r).getByRole('button', { name: 'Abrir a avaliação de 06/10/2026' }));
    expect(abrir).toHaveBeenCalledWith({ fonte: 'avaliacao_voz', id: 'av-nova' });
  });

  it('sem avaliação por voz do profissional: só o diagnóstico ganha o botão (nenhuma avaliação para abrir)', async () => {
    preparar(cenario({ avaliacoes_voz: [] }));
    const abrir = vi.fn();
    montarAvaliacaoAtual({ onAbrirRegistro: abrir });
    const r = await regiao();
    await esperarOsMarcos(r);
    expect(screen.getAllByRole('region', { name: TITULO_DA_LINHA })).toHaveLength(1);
    fireEvent.click(within(r).getByRole('button', { name: 'Abrir o diagnóstico M54.5' }));
    expect(abrir).toHaveBeenCalledWith({ fonte: 'diagnostico', id: 'd1' });
    expect(botoesDeAbrir(r)).toHaveLength(1);
  });

  it('a pergunta da página ("o cartão de CID está na tela?") também vale: sem diagnóstico, sobra só a última avaliação', async () => {
    montarAvaliacaoAtual({ onAbrirRegistro: vi.fn(), registroAbrivel: (d) => d.fonte !== 'diagnostico' });
    const r = await regiao();
    await esperarOsMarcos(r);
    expect(botoesDeAbrir(r).map((b) => b.getAttribute('aria-label'))).toEqual(['Abrir a avaliação de 06/10/2026']);
  });

  it('a página dizer "não" para a avaliação também vale: nem a última ganha o botão', async () => {
    montarAvaliacaoAtual({ onAbrirRegistro: vi.fn(), registroAbrivel: (d) => d.fonte === 'diagnostico' });
    const r = await regiao();
    await esperarOsMarcos(r);
    expect(botoesDeAbrir(r).map((b) => b.getAttribute('aria-label'))).toEqual(['Abrir o diagnóstico M54.5']);
  });

  it('sem a função, nenhuma das formas mostra o botão', async () => {
    for (const linhas of [[], [antiga(), avaliacao()], [antiga(), avaliacao({ resultado: null })]]) {
      preparar(cenario({ avaliacoes_voz: linhas }));
      const { unmount } = montarAvaliacaoAtual({});
      const r = await regiao();
      await esperarOsMarcos(r);
      expect(botoesDeAbrir(r)).toHaveLength(0);
      unmount();
    }
  });

  it('o cartão da última avaliação leva o id da avaliação, para a página achar e destacar', async () => {
    const { container } = montarAvaliacaoAtual({ onAbrirRegistro: vi.fn() });
    await esperarOsMarcos(await regiao());
    const marcas = Array.from(container.querySelectorAll('[data-avaliacao-id]')) as HTMLElement[];
    expect(marcas.map((m) => m.getAttribute('data-avaliacao-id'))).toEqual(['av-nova']);
    expect(marcas[0].textContent).toContain('Última avaliação');
  });

  it('AvaliacaoSecoesEditaveis sozinha leva a função para a linha do tempo da aba Clínico (a avaliação que ela mostra é a que pode abrir)', async () => {
    const abrir = vi.fn();
    render(
      <QueryClientProvider client={cliente()}>
        <MemoryRouter>
          <AvaliacaoSecoesEditaveis pacienteId="pac-1" avaliacaoId="av-nova" resultado={avaliacao().resultado} transcricao="" onReprocessar={vi.fn()} onAbrirRegistro={abrir} registroAbrivel={(d) => d.fonte === 'diagnostico'} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const r = await regiao();
    fireEvent.click(await within(r).findByRole('button', { name: 'Abrir o diagnóstico M54.5' }));
    expect(abrir).toHaveBeenCalledWith({ fonte: 'diagnostico', id: 'd1' });
    expect(botoesDeAbrir(r)).toHaveLength(1);
  });
});

describe('a linha do tempo continua só de leitura e sem navegar sozinha', () => {
  const ler = (relativo: string) => readFileSync(join(__dirname, '..', relativo), 'utf8');

  it('a tela não abre janela nem muda de rota: só chama a função recebida', () => {
    const tela = ler('components/resumoClinico/LinhaDoTempoClinica.tsx');
    expect(tela).not.toMatch(/window\s*\.\s*open|useNavigate|navigate\(|<Link\b|href=|location\./);
    expect(tela).toContain('onClick={() => onAbrirRegistro(destino)}');
  });

  it('um marco sem a função não monta o botão: a condição olha a função, o destino, o nome e a resposta da página', () => {
    const tela = ler('components/resumoClinico/LinhaDoTempoClinica.tsx');
    expect(tela).toContain('{onAbrirRegistro && destino && nomeDoBotao && abrivel && (');
    expect(tela).toContain('const abrivel = !!destino && (registroAbrivel?.(destino) ?? true);');
  });

  it('ler a linha do tempo com o botão não grava nada', async () => {
    montar({ onAbrirRegistro: vi.fn() });
    const r = await regiao();
    await esperarOsMarcos(r);
    fireEvent.click(within(r).getByRole('button', { name: 'Abrir o diagnóstico M54.5' }));
    expect(h.falso.escritas()).toEqual([]);
  });
});
