import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import ConfirmarMarcoDialog from '@/components/resumoClinico/ConfirmarMarcoDialog';
import DesfazerMarcoDialog from '@/components/resumoClinico/DesfazerMarcoDialog';
import { ERRO_DO_ANO_CONFIRMADO } from '@/lib/resumoClinico/confirmacao';
import { AVISO_DA_TRIAGEM_DOS_PLANOS } from '@/lib/resumoClinico/tipos';
import type { CirurgiaDoCliente } from '@/lib/resumoClinico/tipos';

// Os dois diálogos são só apresentação: recebem o item e as funções e devolvem o que o profissional digitou. Aqui conferem-se
// os campos, as validações, o foco, o descarte do que foi digitado e as marcas de celular (44 px, sem truncar, modo escuro).

const rolar = vi.fn();
Element.prototype.scrollIntoView = rolar;

const HOJE = '2026-11-15';
const CIRURGIA: CirurgiaDoCliente = { chave: 'historico_clinico:cirurgia:id:c1', tipo: 'Ligamento do joelho (LCA)', ano: '2022', complicacoes: 'dor ao agachar' };
const ERRO_DE_DATA = 'Data inválida: não pode ser no futuro nem antes de 1900.';

interface Props {
  aberto?: boolean;
  cirurgia?: CirurgiaDoCliente | null;
  salvando?: boolean;
  erro?: string | null;
  nascimento?: string | null;
}

function montar(props: Props = {}) {
  const onConfirmar = vi.fn();
  const onCancelar = vi.fn();
  const completo = (p: Props) => (
    <ConfirmarMarcoDialog
      aberto={p.aberto ?? true}
      cirurgia={p.cirurgia === undefined ? CIRURGIA : p.cirurgia}
      salvando={p.salvando ?? false}
      erro={p.erro ?? null}
      nascimento={p.nascimento}
      hoje={HOJE}
      onConfirmar={onConfirmar}
      onCancelar={onCancelar}
    />
  );
  const r = render(completo(props));
  return { ...r, onConfirmar, onCancelar, atualizar: (p: Props) => r.rerender(completo(p)) };
}

const dialogo = () => screen.getByRole('dialog', { name: 'Confirmar com a data real' });
const chip = (nome: string) => within(dialogo()).getByRole('button', { name: nome });
const campo = () => within(dialogo()).getByLabelText(/em que aconteceu/) as HTMLInputElement;
const confirmar = () => within(dialogo()).getByRole('button', { name: /^(Confirmar|Salvando)/ }) as HTMLButtonElement;
const escolherTipo = (nome = 'Cirurgia') => fireEvent.click(chip(nome));
const digitar = (valor: string) => fireEvent.change(campo(), { target: { value: valor } });
const irParaAno = () => fireEvent.click(chip('Só sei o ano'));
const formulario = () => dialogo().querySelector('form') as HTMLFormElement;
// Com a pergunta "Descartar o que digitei?" aberta, o formulário fica escondido do leitor de tela (aria-hidden) mas continua na página.
const campoNaPagina = () => document.querySelector('form input') as HTMLInputElement;
const tipoMarcado = (nome: string) => Array.from(document.querySelectorAll('form button[aria-pressed]')).find((b) => b.textContent === nome)?.getAttribute('aria-pressed');
// O Radix só passa a ouvir o toque fora no ciclo seguinte à abertura.
const proximoCiclo = () => new Promise((resolver) => setTimeout(resolver, 5));

beforeEach(() => rolar.mockClear());

describe('ConfirmarMarcoDialog: ao abrir', () => {
  it('o campo de data começa VAZIO, mesmo com o ano que o cliente escreveu', () => {
    montar();
    expect(campo().value).toBe('');
    expect(screen.queryByDisplayValue('2022')).toBeNull();
  });

  it('o profissional escolhe cirurgia ou internação: nenhum chip vem marcado e não há lista de seleção', () => {
    montar();
    expect(chip('Cirurgia')).toHaveAttribute('aria-pressed', 'false');
    expect(chip('Internação')).toHaveAttribute('aria-pressed', 'false');
    expect(document.querySelector('select, [role="option"], [role="combobox"]')).toBeNull();
  });

  it('escolher um chip o marca (e desmarca o outro)', () => {
    montar();
    escolherTipo('Internação');
    expect(chip('Internação')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('Cirurgia')).toHaveAttribute('aria-pressed', 'false');
    escolherTipo('Cirurgia');
    expect(chip('Cirurgia')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('Internação')).toHaveAttribute('aria-pressed', 'false');
  });

  it('"Sei o dia" vem marcado (campo de data) e "Só sei o ano" troca para o campo de ano', () => {
    montar();
    expect(chip('Sei o dia')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('Só sei o ano')).toHaveAttribute('aria-pressed', 'false');
    expect(campo().type).toBe('date');
    irParaAno();
    expect(chip('Só sei o ano')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('Sei o dia')).toHaveAttribute('aria-pressed', 'false');
    expect(campo().type).toBe('text');
  });

  it('campo de data: de 1900-01-01 até hoje (dia do Brasil)', () => {
    montar();
    expect(campo()).toHaveAttribute('min', '1900-01-01');
    expect(campo()).toHaveAttribute('max', HOJE);
  });

  it('campo de ano: teclado numérico, até 4 letras, "AAAA" de exemplo', () => {
    montar();
    irParaAno();
    expect(campo()).toHaveAttribute('inputmode', 'numeric');
    expect(campo()).toHaveAttribute('maxlength', '4');
    expect(campo()).toHaveAttribute('placeholder', 'AAAA');
    expect(campo()).not.toHaveAttribute('min');
    expect(campo()).not.toHaveAttribute('max');
  });

  it('o campo tem rótulo (leitor de tela) e cada precisão diz o que é pedido', () => {
    montar();
    expect(within(dialogo()).getByLabelText('Dia em que aconteceu')).toBe(campo());
    irParaAno();
    expect(within(dialogo()).getByLabelText('Ano em que aconteceu')).toBe(campo());
  });

  it('Confirmar começa desligado: falta escolher o tipo e a data', () => {
    montar();
    expect(confirmar()).toBeDisabled();
    expect(within(dialogo()).getByText(/Escolha cirurgia ou internação e informe uma data válida/)).toBeInTheDocument();
  });

  it('com a data certa mas sem escolher cirurgia ou internação, Confirmar continua desligado; escolher o tipo liga', () => {
    montar();
    digitar('2022-06-10');
    expect(within(dialogo()).queryByRole('alert')).toBeNull();
    expect(confirmar()).toBeDisabled();
    escolherTipo('Internação');
    expect(confirmar()).toBeEnabled();
  });

  it('com o tipo escolhido mas sem data, Confirmar continua desligado', () => {
    montar();
    escolherTipo();
    expect(confirmar()).toBeDisabled();
  });

  it('sem item, nada aparece', () => {
    montar({ cirurgia: null });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('fechado, nada aparece', () => {
    montar({ aberto: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('ConfirmarMarcoDialog: o relato do cliente no topo, sem cortar', () => {
  it('mostra o selo do cliente, o texto e o ano exatamente como o cliente escreveu', () => {
    montar({ cirurgia: { ...CIRURGIA, ano: '2O22' } });
    const bloco = dialogo().querySelector('[data-bloco="relato-do-cliente"]') as HTMLElement;
    expect(within(bloco).getByText('Relatado pelo cliente, não revisado')).toBeInTheDocument();
    expect(within(bloco).getByText('Ligamento do joelho (LCA)')).toBeInTheDocument();
    expect(within(bloco).getByText('Ano que o cliente escreveu: "2O22"')).toBeInTheDocument();
    expect(within(bloco).getByText('Complicações: dor ao agachar')).toBeInTheDocument();
    expect(dialogo().firstElementChild?.querySelector('[data-bloco="relato-do-cliente"]')).not.toBeNull();
  });

  it('sem ano e sem complicações: "Ano não informado" e nenhuma linha de complicações', () => {
    montar({ cirurgia: { ...CIRURGIA, ano: '', complicacoes: '' } });
    expect(within(dialogo()).getByText('Ano não informado')).toBeInTheDocument();
    expect(within(dialogo()).queryByText(/Complicações/)).toBeNull();
  });

  it('um relato de 2000 letras aparece inteiro, quebrando linha, sem truncate nem line-clamp', () => {
    const longo = 'dor forte '.repeat(200).trim();
    montar({ cirurgia: { ...CIRURGIA, complicacoes: longo } });
    const bloco = dialogo().querySelector('[data-bloco="relato-do-cliente"]') as HTMLElement;
    const linha = within(bloco).getByText(`Complicações: ${longo}`);
    expect(linha.textContent?.length).toBeGreaterThanOrEqual(2000);
    expect(linha.className).toContain('whitespace-pre-wrap');
    expect(linha.className).toContain('break-words');
    expect(bloco.innerHTML).not.toMatch(/truncate|line-clamp|text-ellipsis|whitespace-nowrap|overflow-hidden/);
    expect(bloco.className).toContain('min-w-0');
  });

  it.each([
    ['o tipo', { tipo: 'Reconstrucao_do_Ligamento_Cruzado_Anterior_do_joelho_direito_com_enxerto_de_tendao_patelar_longo_demais' }, /^Reconstrucao_/],
    ['o ano', { ano: 'EmAlgumMomentoDaDecadaDeNoventaQuandoEraCriancaSemDataExataParaInformarAgora' }, /^Ano que o cliente escreveu: "EmAlgum/],
    ['as complicações', { complicacoes: 'InchacoPersistenteSemEspacoNenhumParaTestarAQuebraDeLinhaNoCelularInchacoPersistente' }, /^Complicações: Inchaco/],
  ])('uma palavra enorme sem espaço em %s quebra a linha (break-words) e o bloco do cliente pode encolher (min-w-0)', (_nome, campoLongo, texto) => {
    montar({ cirurgia: { ...CIRURGIA, ...campoLongo } });
    const bloco = dialogo().querySelector('[data-bloco="relato-do-cliente"]') as HTMLElement;
    const linha = within(bloco).getByText(texto);
    expect(linha.className).toContain('break-words');
    expect(bloco.className).toContain('min-w-0');
  });

  it('a caixa do diálogo, o formulário e os campos podem encolher na grade (min-w-0), senão uma palavra enorme alarga tudo', () => {
    montar();
    expect(dialogo().className).toContain('min-w-0');
    expect(formulario().className).toContain('min-w-0');
    for (const grupo of Array.from(formulario().querySelectorAll('fieldset'))) expect(grupo.className).toContain('min-w-0');
  });

  it('mantém as quebras de linha do que o cliente escreveu', () => {
    montar({ cirurgia: { ...CIRURGIA, complicacoes: 'dor\nforte' } });
    expect(within(dialogo()).getByText(/Complicações:/).textContent).toBe('Complicações: dor\nforte');
  });
});

describe('ConfirmarMarcoDialog: o aviso FIXO da triagem de segurança dos planos', () => {
  it('é a frase decidida e fica visível ao abrir, sem nada digitado', () => {
    montar();
    expect(AVISO_DA_TRIAGEM_DOS_PLANOS).toBe('A triagem de segurança dos planos continua usando o ano que o cliente escreveu. Esta confirmação não a altera.');
    expect(within(dialogo()).getByText(AVISO_DA_TRIAGEM_DOS_PLANOS)).toBeVisible();
  });

  it('continua lá com a data certa, com erro de data, com erro do banco, salvando e no campo de ano', () => {
    const r = montar();
    escolherTipo();
    digitar('2022-06-10');
    expect(within(dialogo()).getByText(AVISO_DA_TRIAGEM_DOS_PLANOS)).toBeInTheDocument();
    digitar('2099-01-01');
    expect(within(dialogo()).getByText(AVISO_DA_TRIAGEM_DOS_PLANOS)).toBeInTheDocument();
    irParaAno();
    expect(within(dialogo()).getByText(AVISO_DA_TRIAGEM_DOS_PLANOS)).toBeInTheDocument();
    r.atualizar({ erro: 'falhou' });
    expect(within(dialogo()).getByText(AVISO_DA_TRIAGEM_DOS_PLANOS)).toBeInTheDocument();
    r.atualizar({ salvando: true });
    expect(within(dialogo()).getByText(AVISO_DA_TRIAGEM_DOS_PLANOS)).toBeInTheDocument();
  });

  it('não bloqueia: com o aviso à vista, Confirmar funciona assim que o formulário está certo', () => {
    const { onConfirmar } = montar();
    escolherTipo();
    digitar('2022-06-10');
    expect(confirmar()).toBeEnabled();
    fireEvent.click(confirmar());
    expect(onConfirmar).toHaveBeenCalledTimes(1);
  });

  it('é um aviso (note), não um alerta que interrompe o leitor de tela', () => {
    montar();
    const aviso = within(dialogo()).getByText(AVISO_DA_TRIAGEM_DOS_PLANOS);
    expect(aviso).toHaveAttribute('role', 'note');
    expect(aviso.className).toContain('dark:text-amber-200');
  });
});

describe('ConfirmarMarcoDialog: validações do dia', () => {
  it('data de hoje ou do passado: sem erro e Confirmar ligado', () => {
    montar();
    escolherTipo();
    digitar('2026-11-15');
    expect(within(dialogo()).queryByRole('alert')).toBeNull();
    expect(confirmar()).toBeEnabled();
    digitar('1900-01-01');
    expect(confirmar()).toBeEnabled();
  });

  it.each([['2026-11-16'], ['2099-01-01'], ['1899-12-31']])('data %s: erro por texto (role=alert), campo marcado e Confirmar desligado', (valor) => {
    montar();
    escolherTipo();
    digitar(valor);
    const erro = within(dialogo()).getByRole('alert');
    expect(erro.textContent).toBe(ERRO_DE_DATA);
    expect(campo()).toHaveAttribute('aria-invalid', 'true');
    expect(campo().getAttribute('aria-describedby')).toContain(erro.id);
    expect(confirmar()).toBeDisabled();
  });

  it('antes do nascimento do cliente: erro com a data de nascimento', () => {
    montar({ nascimento: '2023-05-10' });
    escolherTipo();
    digitar('2022-06-10');
    expect(within(dialogo()).getByRole('alert').textContent).toBe('A data não pode ser antes do nascimento do cliente (10/05/2023).');
    expect(confirmar()).toBeDisabled();
    digitar('2023-05-10');
    expect(within(dialogo()).queryByRole('alert')).toBeNull();
  });

  it('o erro some quando a data é corrigida e o campo deixa de ficar marcado', () => {
    montar();
    escolherTipo();
    digitar('2099-01-01');
    expect(campo()).toHaveAttribute('aria-invalid', 'true');
    digitar('2022-06-10');
    expect(within(dialogo()).queryByRole('alert')).toBeNull();
    expect(campo()).not.toHaveAttribute('aria-invalid');
  });
});

describe('ConfirmarMarcoDialog: validações do ano', () => {
  const noAno = () => { const r = montar(); irParaAno(); escolherTipo(); return r; };

  it.each([['2O22'], ['1899'], ['2027'], ['abcd']])('ano %s: "Ano inválido" por texto com role=alert e Confirmar desligado', (valor) => {
    noAno();
    digitar(valor);
    const erro = within(dialogo()).getByRole('alert');
    expect(erro.textContent).toBe(ERRO_DO_ANO_CONFIRMADO);
    expect(ERRO_DO_ANO_CONFIRMADO).toBe('Ano inválido: use 4 números, de 1900 até o ano atual.');
    expect(campo()).toHaveAttribute('aria-invalid', 'true');
    expect(confirmar()).toBeDisabled();
  });

  it.each([['1900'], ['2022'], ['2026']])('ano %s é válido', (valor) => {
    noAno();
    digitar(valor);
    expect(within(dialogo()).queryByRole('alert')).toBeNull();
    expect(confirmar()).toBeEnabled();
  });

  it('enquanto digita ("20", "202") ainda não é erro; sair do campo com o ano incompleto mostra o erro', () => {
    noAno();
    digitar('20');
    expect(within(dialogo()).queryByRole('alert')).toBeNull();
    digitar('202');
    expect(within(dialogo()).queryByRole('alert')).toBeNull();
    expect(confirmar()).toBeDisabled();
    fireEvent.blur(campo());
    expect(within(dialogo()).getByRole('alert').textContent).toBe(ERRO_DO_ANO_CONFIRMADO);
  });

  it('o ano não pode ser antes do nascimento do cliente', () => {
    const { atualizar } = montar({ nascimento: '2023-05-10' });
    irParaAno();
    escolherTipo();
    digitar('2022');
    expect(within(dialogo()).getByRole('alert').textContent).toBe('O ano não pode ser antes do nascimento do cliente (2023).');
    atualizar({ nascimento: '2023-05-10' });
    digitar('2023');
    expect(within(dialogo()).queryByRole('alert')).toBeNull();
  });

  it('trocar de "só o ano" para "sei o dia" com a data completa aproveita só o ano; do dia para o ano, também', () => {
    montar();
    digitar('2022-06-10');
    irParaAno();
    expect(campo().value).toBe('2022');
    fireEvent.click(chip('Sei o dia'));
    expect(campo().value).toBe('');
  });

  it('trocar de precisão com o campo pela metade apaga o que não serve', () => {
    montar();
    irParaAno();
    digitar('20');
    fireEvent.click(chip('Sei o dia'));
    expect(campo().value).toBe('');
    expect(campo().type).toBe('date');
  });
});

describe('ConfirmarMarcoDialog: foco e rolagem quando há erro', () => {
  it('tentar enviar com a data inválida leva o foco ao campo e o rola para o meio da tela', () => {
    montar();
    escolherTipo();
    digitar('2099-01-01');
    (document.activeElement as HTMLElement | null)?.blur();
    rolar.mockClear();
    fireEvent.submit(formulario());
    expect(document.activeElement).toBe(campo());
    expect(rolar).toHaveBeenCalledWith({ block: 'center' });
    expect(rolar.mock.contexts.at(-1)).toBe(campo());
  });

  it('tentar enviar com o campo vazio também mostra o erro e vai ao campo', () => {
    montar();
    escolherTipo();
    fireEvent.submit(formulario());
    expect(document.activeElement).toBe(campo());
    expect(rolar.mock.contexts.at(-1)).toBe(campo());
  });

  it('tentar enviar sem escolher cirurgia ou internação mostra o erro e leva o foco ao primeiro chip', () => {
    const { onConfirmar } = montar();
    digitar('2022-06-10');
    // O Radix começa com o foco no primeiro botão do diálogo: o foco precisa estar em outro lugar para o teste provar que ele VOLTA ao chip.
    campo().focus();
    expect(document.activeElement).toBe(campo());
    fireEvent.submit(formulario());
    expect(within(dialogo()).getByRole('alert').textContent).toBe('Escolha se foi cirurgia ou internação.');
    expect(document.activeElement).toBe(chip('Cirurgia'));
    expect(onConfirmar).not.toHaveBeenCalled();
  });

  it('o erro que aparece ao digitar rola o campo para o meio da tela (o teclado não o esconde)', () => {
    montar();
    irParaAno();
    escolherTipo();
    rolar.mockClear();
    digitar('2O22');
    expect(rolar).toHaveBeenCalledWith({ block: 'center' });
    expect(rolar.mock.contexts.at(-1)).toBe(campo());
  });

  it('enquanto o campo não tem erro, não rola nada', () => {
    montar();
    escolherTipo();
    digitar('2022-06-10');
    expect(rolar).not.toHaveBeenCalled();
  });
});

describe('ConfirmarMarcoDialog: confirmar', () => {
  it('entrega o que foi escolhido e digitado (tipo, precisão e texto), sem espaços nas pontas', () => {
    const { onConfirmar } = montar();
    escolherTipo('Internação');
    digitar('2022-06-10');
    fireEvent.click(confirmar());
    expect(onConfirmar).toHaveBeenCalledTimes(1);
    expect(onConfirmar).toHaveBeenCalledWith({ tipo: 'internacao', precisao: 'dia', texto: '2022-06-10' });
  });

  it('só o ano: entrega precisão "ano" com os 4 números', () => {
    const { onConfirmar } = montar();
    irParaAno();
    escolherTipo('Cirurgia');
    digitar(' 2022 ');
    fireEvent.click(confirmar());
    expect(onConfirmar).toHaveBeenCalledWith({ tipo: 'cirurgia', precisao: 'ano', texto: '2022' });
  });

  it('com a data inválida, enviar o formulário não chama a função', () => {
    const { onConfirmar } = montar();
    escolherTipo();
    digitar('2099-01-01');
    fireEvent.submit(formulario());
    expect(onConfirmar).not.toHaveBeenCalled();
  });

  it('salvando: Confirmar fica desligado com "Salvando…", os campos e os chips travam e o envio não chama a função', () => {
    const { onConfirmar, atualizar } = montar();
    escolherTipo();
    digitar('2022-06-10');
    atualizar({ salvando: true });
    expect(confirmar()).toBeDisabled();
    expect(confirmar().textContent).toContain('Salvando…');
    expect(campo()).toBeDisabled();
    expect(chip('Cirurgia')).toBeDisabled();
    expect(chip('Só sei o ano')).toBeDisabled();
    expect(within(dialogo()).getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    fireEvent.submit(formulario());
    expect(onConfirmar).not.toHaveBeenCalled();
  });
});

describe('ConfirmarMarcoDialog: fechar sem perder o que foi digitado', () => {
  const escape = () => fireEvent.keyDown(dialogo(), { key: 'Escape', code: 'Escape' });
  const fecharPeloX = () => fireEvent.click(within(dialogo()).getByRole('button', { name: 'Fechar' }));
  const tocarFora = async () => {
    await proximoCiclo();
    const sobreposicao = document.querySelector('[data-state="open"].fixed.inset-0') as HTMLElement;
    fireEvent.pointerDown(sobreposicao);
    fireEvent.mouseDown(sobreposicao);
    fireEvent.click(sobreposicao);
  };

  it.each([
    ['Esc', escape],
    ['o X', fecharPeloX],
    ['o botão Cancelar', () => fireEvent.click(within(dialogo()).getByRole('button', { name: 'Cancelar' }))],
    ['um toque fora', tocarFora],
  ])('com NADA digitado, %s fecha direto (sem perguntar)', async (_nome, fechar) => {
    const { onCancelar } = montar();
    await fechar();
    expect(onCancelar).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Descartar o que digitei?')).toBeNull();
  });

  it.each([
    ['Esc', escape],
    ['o X', fecharPeloX],
    ['o botão Cancelar', () => fireEvent.click(within(dialogo()).getByRole('button', { name: 'Cancelar' }))],
    ['um toque fora', tocarFora],
  ])('com algo digitado, %s pergunta "Descartar o que digitei?" e NÃO fecha nem perde o texto', async (_nome, fechar) => {
    const { onCancelar } = montar();
    escolherTipo();
    digitar('2022-06-10');
    await fechar();
    expect(screen.getByRole('alertdialog', { name: 'Descartar o que digitei?' })).toBeInTheDocument();
    expect(onCancelar).not.toHaveBeenCalled();
    expect(campoNaPagina().value).toBe('2022-06-10');
    expect(tipoMarcado('Cirurgia')).toBe('true');
  });

  it.each([
    ['Esc', escape],
    ['o X', fecharPeloX],
    ['o botão Cancelar', () => fireEvent.click(within(dialogo()).getByRole('button', { name: 'Cancelar' }))],
    ['um toque fora', tocarFora],
  ])('com SÓ a data digitada (sem escolher o tipo), %s pergunta "Descartar o que digitei?" em vez de perder a data', async (_nome, fechar) => {
    const { onCancelar } = montar();
    digitar('2022-06-10');
    await fechar();
    expect(screen.getByRole('alertdialog', { name: 'Descartar o que digitei?' })).toBeInTheDocument();
    expect(onCancelar).not.toHaveBeenCalled();
    expect(campoNaPagina().value).toBe('2022-06-10');
    expect(tipoMarcado('Cirurgia')).toBe('false');
  });

  it('só escolher o tipo já conta como digitado', () => {
    const { onCancelar } = montar();
    escolherTipo();
    escape();
    expect(screen.getByText('Descartar o que digitei?')).toBeInTheDocument();
    expect(onCancelar).not.toHaveBeenCalled();
  });

  it('só trocar a precisão também conta como digitado', () => {
    const { onCancelar } = montar();
    irParaAno();
    escape();
    expect(screen.getByText('Descartar o que digitei?')).toBeInTheDocument();
    expect(onCancelar).not.toHaveBeenCalled();
  });

  it('"Continuar editando" volta ao formulário com tudo no lugar', () => {
    const { onCancelar } = montar();
    escolherTipo('Internação');
    digitar('2022-06-10');
    escape();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar editando' }));
    expect(screen.queryByText('Descartar o que digitei?')).toBeNull();
    expect(onCancelar).not.toHaveBeenCalled();
    expect(campo().value).toBe('2022-06-10');
    expect(chip('Internação')).toHaveAttribute('aria-pressed', 'true');
  });

  it('"Descartar" fecha de verdade (chama a função de cancelar)', () => {
    const { onCancelar } = montar();
    escolherTipo();
    digitar('2022-06-10');
    escape();
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(onCancelar).toHaveBeenCalledTimes(1);
  });

  it('salvando, nada fecha o diálogo: nem Esc, nem X, nem toque fora, e nem pergunta nada', async () => {
    const { onCancelar, atualizar } = montar();
    escolherTipo();
    digitar('2022-06-10');
    atualizar({ salvando: true });
    escape();
    fecharPeloX();
    await tocarFora();
    expect(onCancelar).not.toHaveBeenCalled();
    expect(screen.queryByText('Descartar o que digitei?')).toBeNull();
    expect(dialogo()).toBeInTheDocument();
  });

  it('depois de fechar, o diálogo abre limpo da próxima vez', () => {
    const { atualizar } = montar();
    escolherTipo('Internação');
    digitar('2022-06-10');
    atualizar({ aberto: false, cirurgia: null });
    atualizar({ aberto: true });
    expect(campo().value).toBe('');
    expect(chip('Internação')).toHaveAttribute('aria-pressed', 'false');
    expect(chip('Cirurgia')).toHaveAttribute('aria-pressed', 'false');
    expect(chip('Sei o dia')).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('ConfirmarMarcoDialog: erro de quem grava', () => {
  it('aparece em texto (role=alert) com o diálogo aberto e o que foi digitado no lugar', () => {
    const { atualizar } = montar();
    escolherTipo('Internação');
    digitar('2022-06-10');
    atualizar({ erro: 'Não deu para salvar a confirmação. Confira a conexão e tente de novo.' });
    const erro = dialogo().querySelector('[data-erro="gravacao"]') as HTMLElement;
    expect(erro).toHaveAttribute('role', 'alert');
    expect(erro.textContent).toBe('Não deu para salvar a confirmação. Confira a conexão e tente de novo.');
    expect(campo().value).toBe('2022-06-10');
    expect(chip('Internação')).toHaveAttribute('aria-pressed', 'true');
    expect(confirmar()).toBeEnabled();
  });

  it('o erro rola para a área visível do diálogo', () => {
    const { atualizar } = montar();
    escolherTipo();
    digitar('2022-06-10');
    rolar.mockClear();
    atualizar({ erro: 'falhou' });
    expect(rolar).toHaveBeenCalledWith({ block: 'nearest' });
  });

  it('sem erro, o bloco não existe', () => {
    montar();
    expect(dialogo().querySelector('[data-erro="gravacao"]')).toBeNull();
  });
});

describe('ConfirmarMarcoDialog: o aviso de ano diferente (não bloqueia)', () => {
  it('o cliente escreveu 2022 e o profissional digita 2021: avisa e continua permitindo confirmar', () => {
    montar();
    escolherTipo();
    digitar('2021-03-04');
    expect(within(dialogo()).getByRole('status').textContent).toBe('O cliente escreveu 2022 e você informou 2021. Confira antes de confirmar.');
    expect(confirmar()).toBeEnabled();
  });

  it('mesmo ano: sem aviso', () => {
    montar();
    escolherTipo();
    digitar('2022-03-04');
    expect(within(dialogo()).queryByRole('status')).toBeNull();
  });

  it('o ano do cliente não é um ano válido ("2O22", "há 2 anos"): não há com o que comparar, sem aviso', () => {
    montar({ cirurgia: { ...CIRURGIA, ano: '2O22' } });
    escolherTipo();
    digitar('2021-03-04');
    expect(within(dialogo()).queryByRole('status')).toBeNull();
  });

  it('vale também para o campo de ano', () => {
    montar();
    irParaAno();
    escolherTipo();
    digitar('2019');
    expect(within(dialogo()).getByRole('status').textContent).toContain('você informou 2019');
  });
});

describe('ConfirmarMarcoDialog: celular (390 px) e modo escuro', () => {
  it('chips, campo e botões têm 44 px (min-h-11, min-w-11 ou h-11)', () => {
    montar();
    for (const nome of ['Cirurgia', 'Internação', 'Sei o dia', 'Só sei o ano']) {
      expect(chip(nome).className, nome).toContain('min-h-11');
      expect(chip(nome).className, nome).toContain('min-w-11');
    }
    expect(campo().className).toContain('h-11');
    expect(confirmar().className).toContain('h-11');
    expect(within(dialogo()).getByRole('button', { name: 'Cancelar' }).className).toContain('h-11');
  });

  it('o diálogo cabe na largura do celular: largura da tela menos as margens, nada que force rolagem para o lado', () => {
    montar();
    const caixa = dialogo();
    expect(caixa.className).toContain('w-[calc(100%-2rem)]');
    expect(caixa.className).toContain('max-w-lg');
    expect(caixa.className).toContain('min-w-0');
    expect(caixa.innerHTML).not.toMatch(/\bw-\[(?:[4-9]\d\d|\d{4,})px\]|min-w-\[/);
    expect(campo().className).toContain('max-w-full');
  });

  it('o rodapé com os botões fica DENTRO da área rolável do diálogo (não fixo), para o teclado não escondê-los', () => {
    montar();
    const caixa = dialogo();
    expect(caixa.className).toContain('overflow-y-auto');
    expect(caixa.className).toContain('max-h-[90dvh]');
    const rodape = confirmar().parentElement as HTMLElement;
    expect(caixa.contains(rodape)).toBe(true);
    expect(rodape.className).not.toMatch(/\bfixed\b|\bsticky\b|\babsolute\b/);
    expect(rodape.closest('form')).not.toBeNull();
  });

  it('as cores são do tema ou têm par claro/escuro: nada de cor fixa', () => {
    const r = montar({ erro: 'falhou' });
    escolherTipo();
    digitar('2099-01-01');
    expect(dialogo().innerHTML).not.toMatch(/\b(bg|text|border)-(white|black|gray|slate|zinc|neutral|stone)(-\d+)?\b|#[0-9a-fA-F]{3,6}\b/);
    expect(dialogo().innerHTML).toMatch(/dark:text-amber-200/);
    expect(dialogo().innerHTML).toMatch(/text-destructive/);
    r.unmount();
  });
});

describe('DesfazerMarcoDialog', () => {
  function montarDesfazer(props: Partial<{ aberto: boolean; salvando: boolean; erro: string | null; titulo: string }> = {}) {
    const onDesfazer = vi.fn();
    const onCancelar = vi.fn();
    const completo = (p: typeof props) => (
      <DesfazerMarcoDialog aberto={p.aberto ?? true} titulo={p.titulo ?? 'Ligamento do joelho (LCA)'} salvando={p.salvando ?? false} erro={p.erro ?? null} onDesfazer={onDesfazer} onCancelar={onCancelar} />
    );
    const r = render(completo(props));
    return { ...r, onDesfazer, onCancelar, atualizar: (p: typeof props) => r.rerender(completo(p)) };
  }
  const alerta = () => screen.getByRole('alertdialog', { name: 'Desfazer a confirmação?' });

  it('pergunta "Desfazer a confirmação?", diz que o marco é apagado de vez e que o relato do cliente volta', () => {
    montarDesfazer();
    expect(alerta()).toBeInTheDocument();
    expect(alerta().textContent).toContain('Ligamento do joelho (LCA)');
    expect(alerta().textContent).toContain('será apagado de vez e não dá para recuperá-lo');
    expect(alerta().textContent).toContain('O relato do cliente volta à linha do tempo como não revisado');
    expect(alerta().textContent).toContain('O que o cliente escreveu não é apagado');
  });

  it('o foco começa em "Voltar" (o lado seguro), não em "Desfazer confirmação"', () => {
    montarDesfazer();
    expect(document.activeElement).toBe(within(alerta()).getByRole('button', { name: 'Voltar' }));
  });

  it('"Voltar" cancela e "Desfazer confirmação" chama a função SEM fechar sozinho', () => {
    const { onCancelar, onDesfazer } = montarDesfazer();
    fireEvent.click(within(alerta()).getByRole('button', { name: 'Desfazer confirmação' }));
    expect(onDesfazer).toHaveBeenCalledTimes(1);
    expect(onCancelar).not.toHaveBeenCalled();
    expect(alerta()).toBeInTheDocument();
    fireEvent.click(within(alerta()).getByRole('button', { name: 'Voltar' }));
    expect(onCancelar).toHaveBeenCalledTimes(1);
  });

  it('Esc cancela', () => {
    const { onCancelar } = montarDesfazer();
    fireEvent.keyDown(alerta(), { key: 'Escape', code: 'Escape' });
    expect(onCancelar).toHaveBeenCalledTimes(1);
  });

  it('apagando: os dois botões travam, mostra "Desfazendo…" e Esc não fecha', () => {
    const { onCancelar, atualizar } = montarDesfazer();
    atualizar({ salvando: true });
    expect(within(alerta()).getByRole('button', { name: 'Voltar' })).toBeDisabled();
    const acao = within(alerta()).getByRole('button', { name: /Desfazendo/ });
    expect(acao).toBeDisabled();
    fireEvent.keyDown(alerta(), { key: 'Escape', code: 'Escape' });
    expect(onCancelar).not.toHaveBeenCalled();
  });

  it('o erro de quem apaga aparece em texto (role=alert) com o diálogo aberto', () => {
    montarDesfazer({ erro: 'Não deu para desfazer a confirmação. Confira a conexão e tente de novo.' });
    const erro = alerta().querySelector('[data-erro="desfazer"]') as HTMLElement;
    expect(erro).toHaveAttribute('role', 'alert');
    expect(erro.textContent).toBe('Não deu para desfazer a confirmação. Confira a conexão e tente de novo.');
  });

  it('botões de 44 px, na largura do celular e com as cores do tema', () => {
    montarDesfazer();
    expect(within(alerta()).getByRole('button', { name: 'Voltar' }).className).toContain('h-11');
    expect(within(alerta()).getByRole('button', { name: 'Desfazer confirmação' }).className).toContain('h-11');
    expect(alerta().className).toContain('w-[calc(100%-2rem)]');
    expect(alerta().innerHTML).not.toMatch(/\b(bg|text|border)-(white|black|gray|slate|zinc|neutral|stone)(-\d+)?\b|#[0-9a-fA-F]{3,6}\b/);
  });

  it('o botão que apaga é o destrutivo (vermelho do tema) e o "Voltar" não: o aviso visual da ação sem volta', () => {
    montarDesfazer();
    const apagar = within(alerta()).getByRole('button', { name: 'Desfazer confirmação' });
    expect(apagar.className).toContain('bg-destructive');
    expect(apagar.className).toContain('text-destructive-foreground');
    expect(apagar.className).not.toContain('bg-primary');
    expect(within(alerta()).getByRole('button', { name: 'Voltar' }).className).not.toContain('bg-destructive');
  });

  describe('título do marco com uma palavra enorme sem espaço (celular de 390 px)', () => {
    const PALAVRA = 'Reconstrucao_do_Ligamento_Cruzado_Anterior_joelho_direito_com_enxerto_de_tendao_patelar_e_reabilitacao_longa';

    it('a descrição quebra em qualquer ponto (overflow-wrap:anywhere), porque só break-words não reduz o tamanho mínimo da coluna', () => {
      montarDesfazer({ titulo: PALAVRA });
      const descricao = document.getElementById(alerta().getAttribute('aria-describedby') as string) as HTMLElement;
      expect(descricao.textContent).toContain(PALAVRA);
      expect(descricao.className).toContain('[overflow-wrap:anywhere]');
    });

    it('cada filho da caixa (que é uma grade) pode encolher: o cabeçalho, o erro e o rodapé têm min-w-0', () => {
      montarDesfazer({ titulo: PALAVRA, erro: 'Não deu para desfazer a confirmação. Confira a conexão e tente de novo.' });
      const descricao = document.getElementById(alerta().getAttribute('aria-describedby') as string) as HTMLElement;
      const cabecalho = descricao.parentElement as HTMLElement;
      const rodape = within(alerta()).getByRole('button', { name: 'Voltar' }).parentElement as HTMLElement;
      const erro = alerta().querySelector('[data-erro="desfazer"]') as HTMLElement;
      expect(cabecalho.className).toContain('min-w-0');
      expect(rodape.className).toContain('min-w-0');
      expect(erro.className).toContain('min-w-0');
      expect(erro.className).toContain('break-words');
    });
  });

  it('fechado, nada aparece', () => {
    montarDesfazer({ aberto: false });
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
