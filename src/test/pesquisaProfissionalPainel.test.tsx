import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

type Linha = Record<string, unknown>;

const h = vi.hoisted(() => ({
  profissionais: [] as Record<string, unknown>[],
  resumos: [] as Record<string, unknown>[],
  ultimas: {} as Record<string, unknown>,
  erros: {} as Record<string, string>,
  rpc: vi.fn(),
  invoke: vi.fn(),
  toastErro: vi.fn(),
  toastOk: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'adm-1', email: 'rafaelbmocbel@gmail.com' } }) }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: (...a: unknown[]) => h.toastErro(...a), success: (...a: unknown[]) => h.toastOk(...a) }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...a: unknown[]) => h.rpc(...a),
    functions: { invoke: (...a: unknown[]) => h.invoke(...a) },
  },
}));

import AdministracaoChancela from '@/components/chancela/AdministracaoChancela';
import { useProfissionaisPendentesVerificacao } from '@/hooks/useProfissionaisPendentesVerificacao';

const AVISO = 'Isto é um indício encontrado na internet. Pode estar incompleto ou errado. A verificação é decisão sua.';

function pessoa(extra: Linha = {}): Linha {
  return {
    user_id: 'u-ana', nome: 'Ana', sobrenome: 'Souza', email: 'ana@exemplo.com', perfil_profissional: 'nutricionista',
    registro_profissional: 'CRN 12345', verificado: false, verificado_em: null, equipe_cientifica: false, equipe_areas: [],
    created_at: '2026-09-01T00:00:00Z',
    ...extra,
  };
}

function pesquisaServidor(extra: Linha = {}): Linha {
  return {
    id: 'p-1', pesquisado_em: '2026-10-11T17:32:00Z', nivel_indicio: 'compativel', resumo: 'Registro encontrado em fonte pública.',
    achados: [{
      categoria: 'registro_conselho', texto: 'Registro ativo no conselho', trecho: 'ANA SOUZA CRN3 12345 ATIVO',
      fonte_url: 'https://www.cfn.org.br/consulta/ana', fonte_titulo: 'Conselho Federal de Nutricionistas',
    }],
    consulta_usada: { nome: 'Ana Souza', registro: 'CRN 12345', profissao: 'nutricionista', conselho_esperado: 'CRN' },
    modelo: 'gemini-2.5-flash', erro: null,
    ...extra,
  };
}

function renderizar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AdministracaoChancela />
    </QueryClientProvider>,
  );
}

const chamadas = (nome: string) => h.rpc.mock.calls.filter(([n]) => n === nome);

async function cartaoDaAna() {
  const nome = await screen.findByText('Ana Souza');
  return nome.closest('li') as HTMLElement;
}

beforeEach(() => {
  h.profissionais = [pessoa()];
  h.resumos = [];
  h.ultimas = {};
  h.erros = {};
  h.toastErro.mockReset();
  h.toastOk.mockReset();
  h.rpc.mockReset();
  h.invoke.mockReset();
  h.rpc.mockImplementation(async (nome: string, args: Linha = {}) => {
    if (h.erros[nome]) return { data: null, error: { message: h.erros[nome] } };
    if (nome === 'plano_cliente_config') return { data: { nutricao_premium_ativa: false, prazo_chancela_dias_uteis: 2 }, error: null };
    if (nome === 'profissionais_admin') return { data: h.profissionais, error: null };
    if (nome === 'pesquisas_profissionais_resumo') return { data: h.resumos, error: null };
    if (nome === 'pesquisa_profissional_ultima') return { data: h.ultimas[args.p_user_id as string] ?? null, error: null };
    return { data: null, error: null };
  });
  h.invoke.mockResolvedValue({ data: { ok: true, pesquisa: pesquisaServidor() }, error: null });
});
afterEach(() => cleanup());

describe('Pesquisa na internet: antes de pesquisar', () => {
  it('cada profissional tem o botão, o escopo da pesquisa e nenhum selo', async () => {
    renderizar();
    const cartao = await cartaoDaAna();
    expect(within(cartao).getByRole('button', { name: 'Pesquisar na internet' })).toBeEnabled();
    expect(within(cartao).getByText(/só informação profissional pública/)).toBeInTheDocument();
    expect(within(cartao).getByText(/verificar continua sendo um clique seu/)).toBeInTheDocument();
    expect(within(cartao).queryByText('Compatível')).not.toBeInTheDocument();
    expect(h.invoke).not.toHaveBeenCalled();
    expect(chamadas('pesquisa_profissional_ultima')).toHaveLength(0);
  });

  it('sem registro informado avisa que o máximo é "Inconclusivo"', async () => {
    h.profissionais = [pessoa({ registro_profissional: null })];
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: /^Todos/ }));
    const cartao = await cartaoDaAna();
    expect(within(cartao).getByText(/no máximo, indica "Inconclusivo"/)).toBeInTheDocument();
    expect(within(cartao).getByRole('button', { name: 'Pesquisar na internet' })).toBeEnabled();
  });

  it('a conta do administrador não tem pesquisa', async () => {
    h.profissionais = [pessoa({ user_id: 'u-rafael', nome: 'Rafael', sobrenome: 'Mocbel', email: 'rafaelbmocbel@gmail.com', verificado: true })];
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: /^Todos/ }));
    expect(await screen.findByText(/Conta do administrador/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pesquisar na internet' })).not.toBeInTheDocument();
  });
});

describe('Pesquisa na internet: selo na lista', () => {
  it('um único resumo para a lista toda; cada linha mostra o selo e a data, sem carregar a pesquisa inteira', async () => {
    h.profissionais = [pessoa(), pessoa({ user_id: 'u-bruno', nome: 'Bruno', sobrenome: 'Lima', email: 'bruno@exemplo.com', registro_profissional: 'CREF 777', perfil_profissional: 'educador_fisico' })];
    h.resumos = [
      { user_id: 'u-ana', pesquisado_em: '2026-10-11T17:32:00Z', nivel_indicio: 'compativel' },
      { user_id: 'u-bruno', pesquisado_em: '2026-10-10T12:00:00Z', nivel_indicio: 'divergente' },
    ];
    renderizar();
    const ana = await cartaoDaAna();
    expect(await within(ana).findByText('Compatível')).toBeInTheDocument();
    expect(within(ana).getByText('11/10/2026 às 14:32')).toBeInTheDocument();
    const bruno = (await screen.findByText('Bruno Lima')).closest('li') as HTMLElement;
    expect(within(bruno).getByText('Divergente')).toBeInTheDocument();
    expect(within(bruno).getByText('10/10/2026 às 09:00')).toBeInTheDocument();

    expect(chamadas('pesquisas_profissionais_resumo')).toHaveLength(1);
    expect(chamadas('pesquisa_profissional_ultima')).toHaveLength(0);
    expect(h.invoke).not.toHaveBeenCalled();
  });

  it('se o resumo falhar (banco sem a atualização), a lista segue sem selos e sem erro na tela', async () => {
    h.erros.pesquisas_profissionais_resumo = 'Could not find the function public.pesquisas_profissionais_resumo in the schema cache';
    renderizar();
    const ana = await cartaoDaAna();
    expect(within(ana).getByRole('button', { name: 'Pesquisar na internet' })).toBeInTheDocument();
    expect(screen.queryByText('Não consegui carregar os profissionais.')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('"Ver pesquisa" carrega a última pesquisa só então e "Ocultar" recolhe', async () => {
    h.resumos = [{ user_id: 'u-ana', pesquisado_em: '2026-10-11T17:32:00Z', nivel_indicio: 'compativel' }];
    h.ultimas['u-ana'] = pesquisaServidor();
    renderizar();
    const cartao = await cartaoDaAna();
    const ver = await within(cartao).findByRole('button', { name: 'Ver pesquisa' });
    expect(ver).toHaveAttribute('aria-expanded', 'false');
    expect(chamadas('pesquisa_profissional_ultima')).toHaveLength(0);
    expect(within(cartao).queryByRole('button', { name: 'Pesquisar na internet' })).not.toBeInTheDocument();

    fireEvent.click(ver);
    expect(await within(cartao).findByText('Registro encontrado em fonte pública.')).toBeInTheDocument();
    expect(h.rpc).toHaveBeenCalledWith('pesquisa_profissional_ultima', { p_user_id: 'u-ana' });
    expect(within(cartao).getByRole('button', { name: 'Ocultar pesquisa' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(cartao).getByRole('button', { name: 'Pesquisar de novo' })).toBeEnabled();

    fireEvent.click(within(cartao).getByRole('button', { name: 'Ocultar pesquisa' }));
    expect(within(cartao).queryByText('Registro encontrado em fonte pública.')).not.toBeInTheDocument();
  });
});

describe('Pesquisa na internet: fazendo a pesquisa', () => {
  it('chama a edge só com o user_id; enquanto espera, o botão trava e avisa; depois mostra o resultado', async () => {
    let concluir: (v: unknown) => void = () => {};
    h.invoke.mockReturnValue(new Promise((r) => { concluir = r; }));
    renderizar();
    const cartao = await cartaoDaAna();

    fireEvent.click(within(cartao).getByRole('button', { name: 'Pesquisar na internet' }));
    expect(await within(cartao).findByText(/Pesquisando na internet\. Pode levar até um minuto\./)).toBeInTheDocument();
    expect(within(cartao).getByRole('button', { name: 'Pesquisando…' })).toBeDisabled();
    expect(h.invoke).toHaveBeenCalledTimes(1);
    expect(h.invoke).toHaveBeenCalledWith('pesquisar-profissional', { body: { user_id: 'u-ana' } });

    h.resumos = [{ user_id: 'u-ana', pesquisado_em: '2026-10-11T17:32:00Z', nivel_indicio: 'compativel' }];
    concluir({ data: { ok: true, pesquisa: pesquisaServidor() }, error: null });

    expect(await within(cartao).findByText('Registro encontrado em fonte pública.')).toBeInTheDocument();
    expect(within(cartao).queryByText(/Pesquisando na internet/)).not.toBeInTheDocument();
    expect(within(cartao).getByRole('button', { name: 'Pesquisar de novo' })).toBeEnabled();
    await waitFor(() => expect(chamadas('pesquisas_profissionais_resumo').length).toBeGreaterThanOrEqual(2));
  });

  it('mostra selo, resumo, categoria, trecho entre aspas, link seguro da fonte, data/hora e o aviso fixo', async () => {
    renderizar();
    const cartao = await cartaoDaAna();
    fireEvent.click(within(cartao).getByRole('button', { name: 'Pesquisar na internet' }));

    expect(await within(cartao).findByText('Compatível')).toBeInTheDocument();
    expect(within(cartao).getByText('Registro encontrado em fonte pública.')).toBeInTheDocument();
    expect(within(cartao).getByText('Registro no conselho')).toBeInTheDocument();
    expect(within(cartao).getByText('Registro ativo no conselho')).toBeInTheDocument();
    expect(within(cartao).getByText('“ANA SOUZA CRN3 12345 ATIVO”')).toBeInTheDocument();
    expect(within(cartao).getByText('11/10/2026 às 14:32')).toBeInTheDocument();
    expect(within(cartao).getByText(AVISO)).toBeInTheDocument();
    expect(within(cartao).getByText(/Consulta usada: Ana Souza · nutricionista · CRN 12345/)).toBeInTheDocument();

    const fonte = within(cartao).getByRole('link', { name: /cfn\.org\.br/ });
    expect(fonte).toHaveAttribute('href', 'https://www.cfn.org.br/consulta/ana');
    expect(fonte).toHaveAttribute('target', '_blank');
    expect(fonte.getAttribute('rel')).toContain('noopener');
    expect(fonte.getAttribute('rel')).toContain('noreferrer');
  });

  it('o link da fonte mostra o endereço real (host), nunca o título que a página ou a busca deu', async () => {
    h.invoke.mockResolvedValue({
      data: {
        ok: true,
        pesquisa: pesquisaServidor({
          achados: [{
            categoria: 'registro_conselho', texto: 'Cita o nome, o número 12345 e o CRN.', trecho: 'ANA SOUZA CRN3 12345 ATIVO',
            fonte_url: 'https://qualquer-site-gratis.example/ana', fonte_titulo: 'CRN-3 Consulta Oficial do Conselho',
          }],
        }),
      },
      error: null,
    });
    renderizar();
    const cartao = await cartaoDaAna();
    fireEvent.click(within(cartao).getByRole('button', { name: 'Pesquisar na internet' }));
    const fonte = await within(cartao).findByRole('link', { name: /qualquer-site-gratis\.example/ });
    expect(fonte).toHaveAttribute('href', 'https://qualquer-site-gratis.example/ana');
    expect(within(cartao).queryByText(/Consulta Oficial do Conselho/)).not.toBeInTheDocument();
  });

  it('uma reserva que não terminou aparece como "não consegui consultar" com o motivo em português', async () => {
    h.resumos = [{ user_id: 'u-ana', pesquisado_em: '2026-10-11T17:32:00Z', nivel_indicio: 'nao_consultavel' }];
    h.ultimas['u-ana'] = pesquisaServidor({
      nivel_indicio: 'nao_consultavel', achados: [], erro: 'em_andamento',
      resumo: 'Não consegui consultar automaticamente. A pesquisa não terminou (pode ainda estar em andamento ou a conexão caiu).',
    });
    renderizar();
    const cartao = await cartaoDaAna();
    fireEvent.click(await within(cartao).findByRole('button', { name: 'Ver pesquisa' }));
    expect(await within(cartao).findByText(/Motivo registrado: a pesquisa não terminou/)).toBeInTheDocument();
    expect(within(cartao).queryByText(/em_andamento/)).not.toBeInTheDocument();
  });

  it('pesquisar nunca verifica ninguém: nenhuma chamada a verificar_profissional e o botão Verificar segue igual', async () => {
    renderizar();
    const cartao = await cartaoDaAna();
    fireEvent.click(within(cartao).getByRole('button', { name: 'Pesquisar na internet' }));
    await within(cartao).findByText('Compatível');

    expect(chamadas('verificar_profissional')).toHaveLength(0);
    expect(h.toastOk).not.toHaveBeenCalled();
    const verificar = within(cartao).getByRole('button', { name: 'Verificar' });
    expect(verificar).toBeEnabled();
    expect(within(cartao).getByText('Aguardando verificação')).toBeInTheDocument();
  });

  it('"Pesquisar de novo" refaz a pesquisa pela edge', async () => {
    renderizar();
    const cartao = await cartaoDaAna();
    fireEvent.click(within(cartao).getByRole('button', { name: 'Pesquisar na internet' }));
    fireEvent.click(await within(cartao).findByRole('button', { name: 'Pesquisar de novo' }));

    await waitFor(() => expect(h.invoke).toHaveBeenCalledTimes(2));
    expect(h.invoke).toHaveBeenLastCalledWith('pesquisar-profissional', { body: { user_id: 'u-ana' } });
  });

  it('descarta na tela achado sem fonte https e cai para inconclusivo quando nada do registro sobra', async () => {
    h.invoke.mockResolvedValue({
      data: {
        ok: true,
        pesquisa: pesquisaServidor({
          achados: [{
            categoria: 'registro_conselho', texto: 'x', trecho: 'ANA SOUZA CRN3 12345', fonte_url: 'javascript:alert(1)', fonte_titulo: 'Clique aqui',
          }],
        }),
      },
      error: null,
    });
    renderizar();
    const cartao = await cartaoDaAna();
    fireEvent.click(within(cartao).getByRole('button', { name: 'Pesquisar na internet' }));

    expect(await within(cartao).findByText('Inconclusivo')).toBeInTheDocument();
    expect(within(cartao).queryByText('Compatível')).not.toBeInTheDocument();
    expect(within(cartao).queryByRole('link', { name: /Clique aqui/ })).not.toBeInTheDocument();
    expect(within(cartao).getByText(/Por segurança, mostro como inconclusivo/)).toBeInTheDocument();
    expect(within(cartao).getByText('Nenhum achado com fonte pública foi validado.')).toBeInTheDocument();
  });

  it.each([
    ['divergente', 'Divergente', /outro nome ou outra profissão/],
    ['nao_encontrado', 'Não encontrado', /Não encontrei fonte pública/],
    ['inconclusivo', 'Inconclusivo', /não o bastante/],
  ])('nível %s aparece como "%s" e, sem resumo do servidor, com a explicação do nível', async (nivel, rotulo, descricao) => {
    h.invoke.mockResolvedValue({ data: { ok: true, pesquisa: pesquisaServidor({ nivel_indicio: nivel, achados: [], resumo: null }) }, error: null });
    renderizar();
    const cartao = await cartaoDaAna();
    fireEvent.click(within(cartao).getByRole('button', { name: 'Pesquisar na internet' }));
    expect(await within(cartao).findByText(rotulo)).toBeInTheDocument();
    expect(within(cartao).getByText(descricao)).toBeInTheDocument();
    expect(within(cartao).getByText(AVISO)).toBeInTheDocument();
  });
});

describe('Pesquisa na internet: resumo do servidor', () => {
  it('mostra o resumo que o servidor gravou no lugar da explicação padrão do nível', async () => {
    h.invoke.mockResolvedValue({
      data: { ok: true, pesquisa: pesquisaServidor({ nivel_indicio: 'divergente', achados: [], resumo: 'Uma fonte pública associa o número CRN 12345 a outro nome.' }) },
      error: null,
    });
    renderizar();
    const cartao = await cartaoDaAna();
    fireEvent.click(within(cartao).getByRole('button', { name: 'Pesquisar na internet' }));
    expect(await within(cartao).findByText('Uma fonte pública associa o número CRN 12345 a outro nome.')).toBeInTheDocument();
    expect(within(cartao).queryByText(/outro nome ou outra profissão/)).not.toBeInTheDocument();
  });

  it('falha gravada pelo servidor (resumo com a frase inicial): a frase aparece uma vez só, no título', async () => {
    h.invoke.mockResolvedValue({
      data: {
        ok: false, codigo: 'falha_busca', mensagem: 'Não consegui consultar automaticamente. Use o atalho.',
        pesquisa: pesquisaServidor({
          nivel_indicio: 'nao_consultavel', achados: [], erro: 'ia_http_500',
          resumo: 'Não consegui consultar automaticamente. A busca falhou ou foi bloqueada. Use o atalho para a consulta oficial.',
        }),
      },
      error: null,
    });
    renderizar();
    const cartao = await cartaoDaAna();
    fireEvent.click(within(cartao).getByRole('button', { name: 'Pesquisar na internet' }));

    expect(await within(cartao).findByText('Não consegui consultar')).toBeInTheDocument();
    expect(within(cartao).getAllByText(/Não consegui consultar automaticamente/)).toHaveLength(1);
    expect(within(cartao).getByText('A busca falhou ou foi bloqueada. Use o atalho para a consulta oficial.')).toBeInTheDocument();
    expect(within(cartao).getByText(/Motivo registrado: ia_http_500/)).toBeInTheDocument();
    expect(within(cartao).queryByRole('alert')).not.toBeInTheDocument();
    expect(within(cartao).getByRole('group', { name: 'Conferir no conselho' }).className).toMatch(/border-primary/);
  });
});

describe('Pesquisa na internet: atalhos de conferência', () => {
  it('mostra o conselho esperado pela profissão e o link de busca montado e codificado', async () => {
    renderizar();
    const cartao = await cartaoDaAna();
    fireEvent.click(within(cartao).getByRole('button', { name: 'Pesquisar na internet' }));
    await within(cartao).findByText('Compatível');

    const grupo = within(cartao).getByRole('group', { name: 'Conferir no conselho' });
    expect(within(grupo).getByText('CRN')).toBeInTheDocument();
    expect(within(grupo).getByText(/Conselho Regional de Nutricionistas/)).toBeInTheDocument();
    const busca = within(grupo).getByRole('link', { name: /Buscar no Google/ });
    expect(busca).toHaveAttribute('href', 'https://www.google.com/search?q=Ana+Souza+nutricionista+CRN+12345+conselho');
    expect(busca).toHaveAttribute('target', '_blank');
    expect(busca.getAttribute('rel')).toContain('noopener');
    expect(busca.getAttribute('rel')).toContain('noreferrer');
  });

  it('quando não deu para consultar, diz "Não consegui consultar automaticamente" e destaca o atalho', async () => {
    h.invoke.mockResolvedValue({
      data: { ok: true, pesquisa: pesquisaServidor({ nivel_indicio: 'nao_consultavel', achados: [], resumo: null, erro: 'captcha na consulta do conselho' }) },
      error: null,
    });
    renderizar();
    const cartao = await cartaoDaAna();
    fireEvent.click(within(cartao).getByRole('button', { name: 'Pesquisar na internet' }));

    expect(await within(cartao).findByText('Não consegui consultar')).toBeInTheDocument();
    expect(within(cartao).getByText('Não consegui consultar automaticamente')).toBeInTheDocument();
    expect(within(cartao).getByText(/captcha ou estar fora do ar/)).toBeInTheDocument();
    expect(within(cartao).getByText(/Motivo registrado: captcha na consulta do conselho/)).toBeInTheDocument();
    const grupo = within(cartao).getByRole('group', { name: 'Conferir no conselho' });
    expect(grupo.className).toMatch(/border-primary/);
    expect(within(grupo).getByRole('link', { name: /Buscar no Google/ })).toHaveAttribute('href', expect.stringContaining('https://www.google.com/search?q='));
  });

  it('o atalho de uma pesquisa normal não é destacado', async () => {
    renderizar();
    const cartao = await cartaoDaAna();
    fireEvent.click(within(cartao).getByRole('button', { name: 'Pesquisar na internet' }));
    await within(cartao).findByText('Compatível');
    expect(within(cartao).getByRole('group', { name: 'Conferir no conselho' }).className).not.toMatch(/border-primary/);
    expect(within(cartao).queryByText('Não consegui consultar automaticamente')).not.toBeInTheDocument();
  });

  it('nunca põe o e-mail na busca quando o cadastro não tem nome', async () => {
    h.profissionais = [pessoa({ nome: null, sobrenome: null })];
    renderizar();
    const nome = await screen.findByText('ana@exemplo.com', { selector: 'p' });
    const cartao = nome.closest('li') as HTMLElement;
    fireEvent.click(within(cartao).getByRole('button', { name: 'Pesquisar na internet' }));
    const busca = await within(cartao).findByRole('link', { name: /Buscar no Google/ });
    const href = busca.getAttribute('href') as string;
    expect(href).not.toMatch(/ana%40|ana@|exemplo/i);
    expect(new URL(href).searchParams.get('q')).toBe('nutricionista CRN 12345 conselho');
  });

  it('avisa quando o registro cita um conselho diferente do da profissão', async () => {
    h.profissionais = [pessoa({ registro_profissional: 'CREF 123456-G/SP' })];
    renderizar();
    const cartao = await cartaoDaAna();
    fireEvent.click(within(cartao).getByRole('button', { name: 'Pesquisar na internet' }));
    expect(await within(cartao).findByText(/cita o CREF, mas para Nutricionista o conselho esperado é o CRN/)).toBeInTheDocument();
  });
});

describe('Pesquisa na internet: erros', () => {
  it('limite por profissional: mostra a mensagem do servidor, mantém o atalho e deixa tentar depois', async () => {
    h.invoke.mockResolvedValue({
      data: { ok: false, codigo: 'limite_profissional', mensagem: 'Aguarde 10 minutos para pesquisar este profissional de novo.' },
      error: null,
    });
    renderizar();
    const cartao = await cartaoDaAna();
    fireEvent.click(within(cartao).getByRole('button', { name: 'Pesquisar na internet' }));

    const alerta = await within(cartao).findByRole('alert');
    expect(alerta).toHaveTextContent('Pesquisa não feita agora');
    expect(alerta).toHaveTextContent('Aguarde 10 minutos para pesquisar este profissional de novo.');
    expect(within(cartao).getByRole('group', { name: 'Conferir no conselho' }).className).not.toMatch(/border-primary/);
    expect(within(cartao).getByRole('button', { name: 'Pesquisar na internet' })).toBeEnabled();
  });

  it('falha da busca (ok:false) mostra "Não consegui consultar automaticamente" e destaca o atalho', async () => {
    h.invoke.mockResolvedValue({ data: { ok: false, codigo: 'falha_busca', mensagem: 'A busca não respondeu.' }, error: null });
    renderizar();
    const cartao = await cartaoDaAna();
    fireEvent.click(within(cartao).getByRole('button', { name: 'Pesquisar na internet' }));

    const alerta = await within(cartao).findByRole('alert');
    expect(alerta).toHaveTextContent('Não consegui consultar automaticamente');
    expect(alerta).toHaveTextContent('A busca não respondeu.');
    expect(within(cartao).getByRole('group', { name: 'Conferir no conselho' }).className).toMatch(/border-primary/);
  });

  it('limite diário com status 429 e corpo no contexto', async () => {
    h.invoke.mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: { status: 429, json: async () => ({ ok: false, codigo: 'limite_diario', mensagem: 'O limite de 60 pesquisas por dia foi atingido.' }) },
      },
    });
    renderizar();
    const cartao = await cartaoDaAna();
    fireEvent.click(within(cartao).getByRole('button', { name: 'Pesquisar na internet' }));
    expect(await within(cartao).findByRole('alert')).toHaveTextContent('O limite de 60 pesquisas por dia foi atingido.');
  });

  it('403 (não é o administrador) mostra a mensagem fixa', async () => {
    h.invoke.mockResolvedValue({ data: null, error: { message: 'x', context: { status: 403, json: async () => ({ error: 'forbidden' }) } } });
    renderizar();
    const cartao = await cartaoDaAna();
    fireEvent.click(within(cartao).getByRole('button', { name: 'Pesquisar na internet' }));
    expect(await within(cartao).findByRole('alert')).toHaveTextContent('Apenas o administrador MyHealthID pode pesquisar profissionais.');
  });

  it('depois de um erro, uma pesquisa que dá certo limpa o alerta', async () => {
    h.invoke.mockResolvedValueOnce({ data: { ok: false, codigo: 'falha_busca' }, error: null });
    renderizar();
    const cartao = await cartaoDaAna();
    fireEvent.click(within(cartao).getByRole('button', { name: 'Pesquisar na internet' }));
    await within(cartao).findByRole('alert');

    fireEvent.click(within(cartao).getByRole('button', { name: 'Pesquisar na internet' }));
    expect(await within(cartao).findByText('Compatível')).toBeInTheDocument();
    expect(within(cartao).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('não consegue carregar a última pesquisa: avisa e continua permitindo pesquisar de novo', async () => {
    h.resumos = [{ user_id: 'u-ana', pesquisado_em: '2026-10-11T17:32:00Z', nivel_indicio: 'inconclusivo' }];
    h.erros.pesquisa_profissional_ultima = 'Apenas o administrador MyHealthID';
    renderizar();
    const cartao = await cartaoDaAna();
    fireEvent.click(await within(cartao).findByRole('button', { name: 'Ver pesquisa' }));
    expect(await within(cartao).findByText(/Não consegui carregar a última pesquisa/)).toBeInTheDocument();
    expect(within(cartao).getByRole('button', { name: 'Pesquisar de novo' })).toBeEnabled();
  });
});

describe('Aba Administração: contador de pendentes de verificação', () => {
  function Sonda({ habilitado }: { habilitado: boolean }) {
    const n = useProfissionaisPendentesVerificacao(habilitado);
    return <p data-testid="n">{n}</p>;
  }

  function renderizarSonda(habilitado: boolean) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={qc}>
        <Sonda habilitado={habilitado} />
      </QueryClientProvider>,
    );
  }

  it('conta quem tem registro e ainda não foi verificado', async () => {
    h.profissionais = [
      pessoa(),
      pessoa({ user_id: 'u-2', registro_profissional: 'CREF 1' }),
      pessoa({ user_id: 'u-3', registro_profissional: null }),
      pessoa({ user_id: 'u-4', verificado: true }),
    ];
    renderizarSonda(true);
    await waitFor(() => expect(screen.getByTestId('n')).toHaveTextContent('2'));
  });

  it('desabilitado não consulta o banco e devolve 0', async () => {
    renderizarSonda(false);
    expect(screen.getByTestId('n')).toHaveTextContent('0');
    await new Promise((r) => setTimeout(r, 20));
    expect(chamadas('profissionais_admin')).toHaveLength(0);
  });

  it('falha ao ler a lista vira 0, sem derrubar nada', async () => {
    h.erros.profissionais_admin = 'Apenas o administrador MyHealthID';
    renderizarSonda(true);
    await waitFor(() => expect(chamadas('profissionais_admin')).toHaveLength(1));
    expect(screen.getByTestId('n')).toHaveTextContent('0');
  });

  it('o hook também funciona fora de componente (renderHook)', async () => {
    h.profissionais = [pessoa()];
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useProfissionaisPendentesVerificacao(true), {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>,
    });
    await waitFor(() => expect(result.current).toBe(1));
  });
});
