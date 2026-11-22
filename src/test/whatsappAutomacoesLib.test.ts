// Funções puras que a tela de Automações do WhatsApp e o ExportarDados usam depois do motor de mensagens.
import { describe, expect, it } from 'vitest';
import { resumirDisparos } from '../lib/disparosResumo';
import { DIAS_MYID_VENCIDO, idsComMyidVencido } from '../lib/broadcastSegmentos';
import { linhasParaExportar } from '../lib/exportarLinhas';
import {
  NOME_DE_CONFIRMACAO, NOMES_EXEMPLO, avisosDaMensagem, contarCaracteresDaMensagem, fraseDeConfirmacao, previasDaMensagem,
} from '../lib/broadcastMensagem';
import { renderizarModelo } from '../lib/mensagemModelos';

const d = (gatilho: string | null, status: string | null) => ({ gatilho, status });

describe('resumirDisparos (gatilho mais usado e enviadas)', () => {
  it('conta o gatilho mais frequente e as linhas enviadas', () => {
    expect(resumirDisparos([d('aniversario', 'enviado'), d('aniversario', 'erro'), d('myid_vencido', 'enviado')]))
      .toEqual({ enviados7d: 2, gatilhoTop: 'aniversario (2)' });
  });

  it('ignora o gatilho "simulado:..." e o status "simulado", cada um sozinho', () => {
    const r = resumirDisparos([
      d('simulado:aniversario', 'enviado'),
      d('simulado:aniversario', 'enviado'),
      d('simulado:aniversario', 'enviado'),
      d('diario_pendente', 'simulado'),
      d('diario_pendente', 'simulado'),
      d('diario_pendente', 'simulado'),
      d('reengajamento', 'enviado'),
    ]);
    expect(r).toEqual({ enviados7d: 1, gatilhoTop: 'reengajamento (1)' });
  });

  it('sem linhas, ou só com simuladas, mostra "—"', () => {
    expect(resumirDisparos([])).toEqual({ enviados7d: 0, gatilhoTop: '—' });
    expect(resumirDisparos([d('simulado:x', 'simulado')])).toEqual({ enviados7d: 0, gatilhoTop: '—' });
  });

  it('gatilho que só parece "simulado" no meio do nome continua valendo', () => {
    expect(resumirDisparos([d('nao_simulado:x', 'enviado')]).gatilhoTop).toBe('nao_simulado:x (1)');
  });

  it('as linhas "enviando" e "erro" contam no gatilho mais usado, mas não nas enviadas', () => {
    expect(resumirDisparos([d('broadcast', 'enviando'), d('broadcast', 'erro')])).toEqual({ enviados7d: 0, gatilhoTop: 'broadcast (2)' });
  });

  it('empate fica com o primeiro que apareceu', () => {
    expect(resumirDisparos([d('b', 'enviado'), d('a', 'enviado')]).gatilhoTop).toBe('b (1)');
  });
});

describe('idsComMyidVencido (segmento "MyID vencido")', () => {
  const AGORA = Date.parse('2026-11-09T15:00:00Z');
  const DIA = 86_400_000;
  const av = (paciente: string | null, diasAtras: number) => ({ paciente_id: paciente, updated_at: new Date(AGORA - diasAtras * DIA).toISOString() });

  it('usa 30 dias, como o gatilho automático', () => {
    expect(DIAS_MYID_VENCIDO).toBe(30);
  });

  it('vale a ÚLTIMA avaliação: quem refez fica fora, em qualquer ordem das linhas', () => {
    expect(idsComMyidVencido([av('A', 90), av('A', 3)], ['A'], AGORA)).toEqual([]);
    expect(idsComMyidVencido([av('A', 3), av('A', 90)], ['A'], AGORA)).toEqual([]);
    expect(idsComMyidVencido([av('A', 90), av('A', 40)], ['A'], AGORA)).toEqual(['A']);
  });

  it('o limite é 30 dias cravados: 30 entra, 29 dias e 23 h não', () => {
    expect(idsComMyidVencido([av('A', 30)], ['A'], AGORA)).toEqual(['A']);
    expect(idsComMyidVencido([{ paciente_id: 'A', updated_at: new Date(AGORA - 30 * DIA + 3_600_000).toISOString() }], ['A'], AGORA)).toEqual([]);
  });

  it('quem nunca fez o MyID não entra, e só entram ids da base (ativos com telefone)', () => {
    expect(idsComMyidVencido([av('A', 50), av('B', 50)], ['A', 'C'], AGORA)).toEqual(['A']);
  });

  it('mantém a ordem da base e ignora linha sem cliente ou com data inválida', () => {
    const lista = [av(null, 100), { paciente_id: 'C', updated_at: 'lixo' }, av('B', 60), av('A', 60)];
    expect(idsComMyidVencido(lista, ['A', 'B', 'C'], AGORA)).toEqual(['A', 'B']);
  });

  it('uma data inválida não esconde a avaliação boa do mesmo cliente', () => {
    expect(idsComMyidVencido([{ paciente_id: 'A', updated_at: 'lixo' }, av('A', 60)], ['A'], AGORA)).toEqual(['A']);
  });
});

describe('linhasParaExportar', () => {
  const linhas = [{ id: 1, status: 'enviado' }, { id: 2, status: 'simulado' }, { id: 3, status: null }, { id: 4 }];

  it('em agente_disparos tira só o status "simulado" (status nulo e ausente ficam)', () => {
    expect(linhasParaExportar('agente_disparos', linhas).map((l) => l.id)).toEqual([1, 3, 4]);
  });

  it('em qualquer outra tabela devolve tudo', () => {
    expect(linhasParaExportar('agente_broadcasts', linhas)).toBe(linhas);
  });
});

describe('texto da campanha na tela', () => {
  it('os nomes de exemplo vêm do cadastro e a confirmação usa o primeiro', () => {
    expect([...NOMES_EXEMPLO]).toEqual(['Marina Souza', 'JOÃO PEDRO LIMA', 'ana-clara lima']);
    expect(NOME_DE_CONFIRMACAO).toBe('Marina');
  });

  it('a prévia é o resultado da renderizarModelo do envio, nome a nome', () => {
    const texto = 'Oi {nome}! Passe aqui.';
    const previas = previasDaMensagem(texto, 3);
    expect(previas.map((p) => p.nome)).toEqual(['Marina', 'João', 'Ana-Clara']);
    expect(previas.map((p) => p.texto)).toEqual(NOMES_EXEMPLO.map((n) => renderizarModelo('broadcast', texto, { nome: n }).texto));
    expect(previas[2].texto).toBe('Oi Ana-Clara! Passe aqui.');
    expect(previasDaMensagem(texto, 2)).toHaveLength(2);
  });

  it('texto inválido não tem prévia (nulo), em vez de sair com a chave crua', () => {
    expect(previasDaMensagem('Oi {horario}', 3).map((p) => p.texto)).toEqual([null, null, null]);
  });

  it('frase de confirmação é a do primeiro nome, ou vazia se o texto não presta', () => {
    expect(fraseDeConfirmacao('Oi {nome}!')).toBe('Oi Marina!');
    expect(fraseDeConfirmacao('Oi {data}')).toBe('');
  });

  it('avisos: só {nome} vale, chave solta e texto longo; vazio não é aviso', () => {
    expect(avisosDaMensagem('Oi {nome}!')).toEqual([]);
    expect(avisosDaMensagem('')).toEqual([]);
    expect(avisosDaMensagem('Às {horario}')).toEqual([expect.stringContaining('Só a variável {nome} funciona')]);
    expect(avisosDaMensagem('Oi {nome')).toEqual([expect.stringContaining('sem par')]);
    expect(avisosDaMensagem('a'.repeat(1001))).toEqual([expect.stringContaining('1000 caracteres')]);
    expect(avisosDaMensagem('a'.repeat(1000))).toEqual([]);
  });

  it('o contador conta caracteres reais sem as pontas', () => {
    expect(contarCaracteresDaMensagem('  💙💙 ')).toBe(2);
    expect(contarCaracteresDaMensagem('')).toBe(0);
  });
});

const comTamanho = (total: number, modelo = 'Oi {nome}! ') => modelo + 'a'.repeat(total - modelo.length);

describe('avisosDaMensagem: limite exato com {nome}', () => {
  // Cada {nome} (6 caracteres) vira um primeiro nome de até 30 letras: +24 por ocorrência. O teto vale para o texto já trocado.
  const comNomes = (ocorrencias: number, total: number) => {
    const base = Array.from({ length: ocorrencias }, () => '{nome}').join(' ');
    return base + 'a'.repeat(total - base.length);
  };

  it.each([
    [1, 976, 977],
    [2, 952, 953],
    [3, 928, 929],
  ])('%i ocorrência(s) de {nome}: %i caracteres não têm aviso e %i têm', (ocorrencias, ultimoSemAviso, primeiroComAviso) => {
    expect(avisosDaMensagem(comNomes(ocorrencias, ultimoSemAviso))).toEqual([]);
    expect(avisosDaMensagem(comNomes(ocorrencias, primeiroComAviso))).toEqual([expect.stringContaining('nome comprido')]);
  });

  it('com 970 caracteres um {nome} não tem aviso, mas dois {nome} têm', () => {
    expect(avisosDaMensagem(comTamanho(970))).toEqual([]);
    expect(avisosDaMensagem(comNomes(2, 970))).toEqual([expect.stringContaining('nome comprido')]);
  });

  it('sem {nome} o limite continua em 1000 exatos, com o aviso antigo', () => {
    expect(avisosDaMensagem('a'.repeat(1000))).toEqual([]);
    expect(avisosDaMensagem('a'.repeat(1001))).toEqual([expect.stringContaining('passa de 1000 caracteres')]);
    expect(avisosDaMensagem('a'.repeat(1001))[0]).not.toContain('nome comprido');
  });

  it('{ Nome } e {NOME} também trocam pelo nome: 8 caracteres viram 30, então o limite sobe para 978', () => {
    const modelo = (total: number) => '{ Nome }' + 'a'.repeat(total - 8);
    expect(avisosDaMensagem(modelo(978))).toEqual([]);
    expect(avisosDaMensagem(modelo(979))).toEqual([expect.stringContaining('nome comprido')]);
  });

  it('os espaços das pontas não contam, como no envio', () => {
    expect(avisosDaMensagem(`  ${comTamanho(976)}   `)).toEqual([]);
    expect(avisosDaMensagem(`  ${comTamanho(977)}   `)).toEqual([expect.stringContaining('nome comprido')]);
  });

  it('o aviso do nome comprido não aparece junto com os de variável fora de {nome} nem de chave solta', () => {
    expect(avisosDaMensagem(comTamanho(1000, 'Oi {nome}! {horario} '))).toEqual([expect.stringContaining('Só a variável {nome} funciona')]);
    expect(avisosDaMensagem(comTamanho(1000, 'Oi {nome}! { '))).toEqual([expect.stringContaining('sem par')]);
  });
});
