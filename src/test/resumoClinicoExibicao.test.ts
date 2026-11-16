import { describe, it, expect } from 'vitest';
import { detalheParaExibir, nomeDaFonteParaExibir, rotuloDoTipoParaExibir } from '@/lib/resumoClinico/exibicao';
import { montarLinhaDoTempo } from '@/lib/resumoClinico/marcos';
import { DETALHE_MYID_CONCLUIDO, FONTES_VAZIAS, NOME_DA_FONTE_DO_MARCO, ROTULO_CIRURGIA_DO_CLIENTE } from '@/lib/resumoClinico/tipos';
import type { FonteDoMarco, ItemSemData, Marco } from '@/lib/resumoClinico/tipos';

const marco = (titulo: string, rotuloTipo: string, extra: Partial<Marco> = {}): Marco => ({
  id: 'x', data: { iso: '2022', precisao: 'ano' }, titulo, tipo: 'cirurgia', rotuloTipo, fonte: 'historico_clinico', origem: 'cliente', revisado: false,
  natureza: 'fato', ...extra,
});

describe('exibição: o rótulo do tipo não repete o que o título já diz', () => {
  it('a cirurgia do cliente ("Coluna") mostra "Cirurgia ou internação: Coluna" e a linha da data não repete o rótulo', () => {
    expect(rotuloDoTipoParaExibir(marco('Coluna', ROTULO_CIRURGIA_DO_CLIENTE))).toBeNull();
  });

  it('título que não abre com o rótulo continua mostrando o rótulo', () => {
    expect(rotuloDoTipoParaExibir(marco('Bioimpedância', 'Exame presencial', { fonte: 'exame_presencial', origem: 'profissional', tipo: 'exame' }))).toBe('Exame presencial');
    expect(rotuloDoTipoParaExibir(marco('Último envio do histórico clínico (pelo cliente)', 'Histórico clínico', { tipo: 'historico' }))).toBe('Histórico clínico');
  });

  it.each([
    ['Fratura de punho', 'Fratura'],
    ['fratura de punho', 'Fratura'],
    ['FRATURA', 'Fratura'],
    ['Avaliação presencial registrada', 'Avaliação presencial'],
    ['Avaliacao presencial registrada', 'Avaliação presencial'],
    ['MyID concluído', 'MyID'],
    ['MyID (último registro)', 'MyID'],
    ['Cirurgia de menisco', 'Cirurgia'],
    ['Internação: apendicite', 'Internação'],
  ])('o título "%s" já abre com o rótulo "%s": não repete', (titulo, rotulo) => {
    expect(rotuloDoTipoParaExibir(marco(titulo, rotulo, { origem: 'profissional', fonte: 'historia_vida', tipo: 'evento_de_vida' }))).toBeNull();
  });

  it.each([
    ['Cirurgião ortopedista', 'Cirurgia'],
    ['Fraturado', 'Fratura'],
    ['MyIDs antigos', 'MyID'],
    ['Exame de sangue', 'Exame presencial'],
    ['Não é Fratura', 'Fratura'],
    // O rótulo aparece no meio do título e é seguido de espaço: só vale se o título ABRE com ele.
    ['Pós-op: Fratura', 'Fratura'],
    ['', 'Fratura'],
  ])('o título "%s" NÃO abre com o rótulo "%s": mantém o rótulo', (titulo, rotulo) => {
    expect(rotuloDoTipoParaExibir(marco(titulo, rotulo, { origem: 'profissional', fonte: 'historia_vida', tipo: 'evento_de_vida' }))).toBe(rotulo);
  });

  it('a cirurgia do cliente que já começa com "Cirurgia" mas não com "Cirurgia ou internação" mantém o rótulo na linha da data', () => {
    expect(rotuloDoTipoParaExibir(marco('Cirurgia no joelho', ROTULO_CIRURGIA_DO_CLIENTE))).toBe(ROTULO_CIRURGIA_DO_CLIENTE);
  });

  it('rótulo vazio nunca esconde nada', () => {
    expect(rotuloDoTipoParaExibir(marco('Qualquer', ''))).toBe('');
  });
});

describe('exibição: o detalhe de "Sem data" não repete o rótulo que o título já traz', () => {
  const item = (titulo: string, detalhe: string, extra: Partial<ItemSemData> = {}): ItemSemData => ({
    id: 'i', titulo, detalhe, fonte: 'historico_clinico', origem: 'cliente', revisado: false, tipo: 'cirurgia', ...extra,
  });

  it('cirurgia do cliente: o título ganha o rótulo e o detalhe começa pelo que o cliente escreveu', () => {
    const cirurgia = item('Coluna', `${ROTULO_CIRURGIA_DO_CLIENTE} · Ano que o cliente escreveu: "faz tempo" · Complicações: dor`);
    expect(detalheParaExibir(cirurgia)).toBe('Ano que o cliente escreveu: "faz tempo" · Complicações: dor');
  });

  it('o texto do cliente com " · " no meio não é mexido: só o primeiro trecho, que é o rótulo fixo, sai', () => {
    const cirurgia = item('Coluna · lombar', `${ROTULO_CIRURGIA_DO_CLIENTE} · Ano não informado · Complicações: a · b`);
    expect(detalheParaExibir(cirurgia)).toBe('Ano não informado · Complicações: a · b');
  });

  it('título que não abre com o rótulo deixa o detalhe inteiro', () => {
    const cirurgia = item('Cirurgia no joelho', `${ROTULO_CIRURGIA_DO_CLIENTE} · Ano não informado`);
    expect(detalheParaExibir(cirurgia)).toBe(`${ROTULO_CIRURGIA_DO_CLIENTE} · Ano não informado`);
  });

  it('diagnóstico e exame do profissional: o rótulo continua quando o título não o repete', () => {
    const diagnostico = item('[M17] Gonartrose', 'Diagnóstico · A data do diagnóstico não foi informada', { origem: 'profissional', fonte: 'diagnostico', tipo: undefined });
    expect(detalheParaExibir(diagnostico)).toBe('Diagnóstico · A data do diagnóstico não foi informada');
    const exame = item('Exame importado', 'Exame importado · A data do exame não foi informada', { origem: 'profissional', fonte: 'exame_importado', tipo: undefined });
    expect(detalheParaExibir(exame)).toBe('A data do exame não foi informada');
  });

  it('detalhe sem separador, vazio ou que só tem o rótulo não é mexido', () => {
    expect(detalheParaExibir(item('Coluna', ROTULO_CIRURGIA_DO_CLIENTE))).toBe(ROTULO_CIRURGIA_DO_CLIENTE);
    expect(detalheParaExibir(item('Coluna', ''))).toBe('');
    expect(detalheParaExibir(item('Coluna', ' · começa pelo separador'))).toBe(' · começa pelo separador');
  });

  it('com a linha do tempo de verdade: a cirurgia sem ano válido mostra título com rótulo e detalhe sem rótulo repetido', () => {
    const linha = montarLinhaDoTempo({
      ...FONTES_VAZIAS,
      paciente: { historico_clinico: { cirurgias: { items: [{ id: 'a', tipo: 'Coluna', ano: 'faz tempo', complicacoes: 'dor' }] } } },
    }, '2026-11-16');
    expect(linha.semData).toHaveLength(1);
    expect(detalheParaExibir(linha.semData[0])).toBe('Ano que o cliente escreveu: "faz tempo" · Complicações: dor');
  });
});

describe('exibição: nome da fonte dos registros que ficaram de fora', () => {
  it('não repete quando o rótulo do registro é o próprio nome da fonte (sem acento e sem caixa)', () => {
    expect(nomeDaFonteParaExibir('MyID', 'MyID')).toBeNull();
    expect(nomeDaFonteParaExibir('Avaliação presencial', 'Avaliação presencial')).toBeNull();
    expect(nomeDaFonteParaExibir('avaliacao presencial', 'Avaliação presencial')).toBeNull();
  });

  it('mostra o nome quando o rótulo é outra coisa', () => {
    expect(nomeDaFonteParaExibir('Data absurda', 'História de vida')).toBe('História de vida');
  });

  it('toda fonte de marco tem um nome legível', () => {
    const fontes: FonteDoMarco[] = ['myid', 'historico_clinico', 'historia_atual', 'historia_vida', 'diagnostico', 'avaliacao_voz', 'exame_presencial', 'exame_importado', 'teste_funcional', 'escala'];
    expect(Object.keys(NOME_DA_FONTE_DO_MARCO).sort()).toEqual([...fontes].sort());
    for (const f of fontes) expect(NOME_DA_FONTE_DO_MARCO[f].length, f).toBeGreaterThan(2);
  });
});

describe('texto fixo do marco "MyID concluído"', () => {
  it('é curto, útil e continua verdadeiro: concluído e registrado no histórico do paciente', () => {
    expect(DETALHE_MYID_CONCLUIDO).toBe('Concluído e registrado no histórico do paciente.');
  });

  it('o marco "MyID concluído" da linha do tempo traz esse texto, e o texto antigo não existe mais', () => {
    const linha = montarLinhaDoTempo({
      ...FONTES_VAZIAS,
      myidConcluidos: [{ id: 'm1', status: 'concluido', created_at: '2026-10-01T12:00:00+00:00', updated_at: '2026-10-02T12:00:00+00:00' }],
      vinculosMyid: [{ id: 'ai1', myid_avaliacao_id: 'm1', created_at: '2026-10-07T12:00:00+00:00' }],
    }, '2026-11-16');
    expect(linha.marcos[0].titulo).toBe('MyID concluído');
    expect(linha.marcos[0].detalhe).toBe('Concluído e registrado no histórico do paciente.');
    expect(linha.marcos[0].detalhe).not.toContain('Data em que a conclusão');
  });
});
