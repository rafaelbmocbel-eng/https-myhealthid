import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { criarBancoFalso, type BancoFalso, type Linha } from './helpers/bancoFalso';
import { envolverBanco, type BancoEnvolvido } from './helpers/bancoFalsoLeitura';
import { COLUNA_ORIGEM, FILTRO_SO_PROFISSIONAL } from '@/utils/voiceAssessment/origemAvaliacao';
import { CAMPO_ORIGEM_DO_RELATO, ROTULO_DA_FONTE, STATUS_DE_EXAME_IMPORTADO_CONCLUIDO, TIPOS_DE_DIAGNOSTICO_QUE_ENTRAM, type ChaveDaFonte } from '@/lib/resumoClinico/tipos';

const h = vi.hoisted(() => ({
  falso: null as unknown as BancoFalso,
  banco: null as unknown as BancoEnvolvido,
  invocar: vi.fn(),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (t: string) => h.banco.from(t),
    rpc: (nome: string, args?: Record<string, unknown>) => h.banco.rpc(nome, args),
    functions: { invoke: (...a: unknown[]) => h.invocar(...a) },
  },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'prof-1' } }) }));

import { lerFontesClinicas, useFontesClinicas } from '@/hooks/useFontesClinicas';

// Linhas sem data ficam por último na ordem: com limite pequeno o corte tira justamente a faixa "Sem data".
const TABELAS_COM_LIMITE_DE_200 = ['diagnosticos_paciente', 'exames_importados'];

const TABELA_DA_FONTE: Record<string, ChaveDaFonte> = {
  pacientes: 'paciente',
  myid_avaliacoes: 'myid',
  avaliacoes_identidade: 'vinculosMyid',
  avaliacoes_voz: 'avaliacoesVoz',
  historia_vida_paciente: 'historiaVida',
  diagnosticos_paciente: 'diagnosticos',
  exames_presenciais: 'examesPresenciais',
  exames_importados: 'examesImportados',
  testes_funcionais_paciente: 'testesFuncionais',
  escalas_psicologia: 'escalas',
};

function cenario(): Record<string, Linha[]> {
  return {
    pacientes: [
      { id: 'pac-1', historico_clinico: { cirurgias: { items: [{ tipo: 'Joelho', ano: '2022' }] } }, historia_atual: { queixa: 'dor' }, nome: 'Ana', cpf: '123' },
      { id: 'pac-2', historico_clinico: { cirurgias: { items: [{ tipo: 'DE OUTRO PACIENTE', ano: '2001' }] } }, historia_atual: null },
    ],
    myid_avaliacoes: [
      { id: 'm1', paciente_id: 'pac-1', status: 'concluido', created_at: '2026-01-01T12:00:00+00:00', updated_at: '2026-01-02T12:00:00+00:00', respostas_brutas: { bloco_1_queixa: 'antigo' } },
      { id: 'm2', paciente_id: 'pac-1', status: 'concluido', created_at: '2026-05-01T12:00:00+00:00', updated_at: '2026-05-02T12:00:00+00:00', respostas_brutas: { bloco_1_queixa: 'mais recente' } },
      { id: 'm3', paciente_id: 'pac-1', status: 'em_andamento', created_at: '2026-09-01T12:00:00+00:00', updated_at: '2026-09-02T12:00:00+00:00', respostas_brutas: { bloco_1_queixa: 'nao concluido' } },
      { id: 'm4', paciente_id: 'pac-2', status: 'concluido', created_at: '2026-06-01T12:00:00+00:00', updated_at: '2026-06-02T12:00:00+00:00', respostas_brutas: {} },
    ],
    avaliacoes_identidade: [
      { id: 'ai1', paciente_id: 'pac-1', terapeuta_id: 'prof-1', myid_avaliacao_id: 'm2', created_at: '2026-05-02T12:00:00+00:00', dados_avaliacao: { respostas: { sigilo: true } }, myid_analysis: { pesado: true } },
      { id: 'ai2', paciente_id: 'pac-1', terapeuta_id: 'prof-1', myid_avaliacao_id: null, created_at: '2026-04-01T12:00:00+00:00' },
      { id: 'ai3', paciente_id: 'pac-1', terapeuta_id: 'prof-2', myid_avaliacao_id: 'm1', created_at: '2026-01-02T12:00:00+00:00' },
      { id: 'ai4', paciente_id: 'pac-2', terapeuta_id: 'prof-1', myid_avaliacao_id: 'm4', created_at: '2026-06-02T12:00:00+00:00' },
    ],
    avaliacoes_voz: [
      { id: 'a1', paciente_id: 'pac-1', terapeuta_id: 'prof-1', created_at: '2026-10-01T12:00:00+00:00', queixa_principal: 'Dor lombar', resultado: { dado: 'pesado' }, transcricao: 'x' },
      { id: 'a2', paciente_id: 'pac-1', terapeuta_id: 'prof-2', created_at: '2026-10-02T12:00:00+00:00', queixa_principal: 'De outro profissional', resultado: {} },
      { id: 'a3', paciente_id: 'pac-2', terapeuta_id: 'prof-1', created_at: '2026-10-03T12:00:00+00:00', queixa_principal: 'De outro paciente', resultado: {} },
    ],
    historia_vida_paciente: [{ id: 'h1', paciente_id: 'pac-1', data_evento: '2019-03-04', tipo: 'fratura', titulo: 'Fratura', descricao: '', terapeuta_id: 'prof-1' }, { id: 'h2', paciente_id: 'pac-2', data_evento: '2010-01-01', tipo: 'outro', titulo: 'Outro paciente' }],
    diagnosticos_paciente: [
      { id: 'd1', paciente_id: 'pac-1', data_diagnostico: null, cid_codigo: 'M54.5', cid_descricao: 'Dor lombar', created_at: '2026-02-03T12:00:00+00:00', observacao: 'sigilo', ativo: true, tipo: 'principal' },
      { id: 'd2', paciente_id: 'pac-1', data_diagnostico: '2024-01-01', cid_codigo: 'M25.5', cid_descricao: 'Removido no app', created_at: '2026-02-03T12:00:00+00:00', ativo: false, tipo: 'principal' },
      { id: 'd3', paciente_id: 'pac-1', data_diagnostico: '2024-01-01', cid_codigo: 'M75', cid_descricao: 'Só suspeita', created_at: '2026-02-03T12:00:00+00:00', ativo: true, tipo: 'suspeita' },
      { id: 'd4', paciente_id: 'pac-1', data_diagnostico: '2023-01-01', cid_codigo: 'M51', cid_descricao: 'Secundário ativo', created_at: '2026-02-03T12:00:00+00:00', ativo: true, tipo: 'secundario' },
      { id: 'd5', paciente_id: 'pac-2', data_diagnostico: '2023-01-01', cid_codigo: 'X', cid_descricao: 'De outro paciente', created_at: '2026-02-03T12:00:00+00:00', ativo: true, tipo: 'principal' },
    ],
    exames_presenciais: [{ id: 'e1', paciente_id: 'pac-1', tipo: 'bioimpedancia', data_exame: '2026-08-01', resumo: 'Peso 70 kg', dados: { grande: true } }],
    exames_importados: [
      { id: 'i1', paciente_id: 'pac-1', tipo: 'laboratorial', data_exame: null, created_at: '2026-07-02T12:00:00+00:00', dados_extraidos: { texto: 'enorme' }, arquivo_url: 'http://x', status: 'processado' },
      { id: 'i2', paciente_id: 'pac-1', tipo: 'hemograma', data_exame: '2026-06-01', created_at: '2026-07-02T12:00:00+00:00', status: 'pendente' },
      { id: 'i3', paciente_id: 'pac-1', tipo: 'urina', data_exame: '2026-06-02', created_at: '2026-07-02T12:00:00+00:00', status: 'erro' },
    ],
    testes_funcionais_paciente: [{ id: 't1', paciente_id: 'pac-1', tipo_teste: 'tug', resultado: 9, unidade: 'segundos', data_teste: '2026-06-01', classificacao: 'x' }],
    escalas_psicologia: [{ id: 's1', paciente_id: 'pac-1', tipo_escala: 'phq9', pontuacao_total: 7, data_aplicacao: '2026-05-01', respostas: [1, 2, 3] }],
    // O que NÃO pode ser lido: achados do avatar (data de início = dia do envio) e as notas do prontuário.
    eventos_clinicos_anatomicos: [{ id: 'ev1', paciente_id: 'pac-1', tipo_diagnostico: 'historico_relatado', origem: 'relato_paciente', data_inicio: '2026-11-15', tipo_achado: 'Dor no joelho' }],
    notas_prontuario: [{ id: 'n1', paciente_id: 'pac-1', titulo: 'Nota' }],
  };
}

function preparar(tabelas: Record<string, Linha[]> = cenario()) {
  h.falso = criarBancoFalso(tabelas);
  h.banco = envolverBanco(h.falso);
}

beforeEach(() => { h.invocar.mockReset(); preparar(); });

describe('lerFontesClinicas', () => {
  it('lê só o paciente certo e só o profissional certo; MyID concluído mais recente com as respostas', async () => {
    const { fontes, falhas } = await lerFontesClinicas('pac-1', 'prof-1');
    expect(falhas).toEqual([]);
    expect(fontes.paciente).toEqual({ historico_clinico: { cirurgias: { items: [{ tipo: 'Joelho', ano: '2022' }] } }, historia_atual: { queixa: 'dor' } });
    expect(fontes.myidConcluidos.map((l) => l.id).sort()).toEqual(['m1', 'm2']); // sem o em andamento e sem o do outro paciente
    expect(fontes.myidUltimo).toMatchObject({ id: 'm2', respostas_brutas: { bloco_1_queixa: 'mais recente' } });
    expect(fontes.vinculosMyid).toEqual([{ id: 'ai1', myid_avaliacao_id: 'm2', created_at: '2026-05-02T12:00:00+00:00' }]); // sem o não ligado, sem o de outro profissional e sem o de outro paciente
    expect(fontes.avaliacoesVoz.map((l) => l.id)).toEqual(['a1']);
    expect(fontes.historiaVida.map((l) => l.id)).toEqual(['h1']);
    expect(fontes.diagnosticos.map((l) => l.id).sort()).toEqual(['d1', 'd4']); // sem o removido, sem a suspeita e sem o de outro paciente
    expect(fontes.examesPresenciais.map((l) => l.id)).toEqual(['e1']);
    expect(fontes.examesImportados.map((l) => l.id)).toEqual(['i1']); // sem o pendente e sem o com erro
    expect(fontes.testesFuncionais.map((l) => l.id)).toEqual(['t1']);
    expect(fontes.escalas.map((l) => l.id)).toEqual(['s1']);
  });

  it('não lê o que a tela não usa: só as colunas necessárias (sem resultado, sem dados_extraidos, sem CPF)', async () => {
    const { fontes } = await lerFontesClinicas('pac-1', 'prof-1');
    expect(fontes.avaliacoesVoz[0]).toEqual({ id: 'a1', created_at: '2026-10-01T12:00:00+00:00', queixa_principal: 'Dor lombar', [CAMPO_ORIGEM_DO_RELATO]: null });
    expect(fontes.examesImportados[0]).not.toHaveProperty('dados_extraidos');
    expect(fontes.examesImportados[0]).not.toHaveProperty('arquivo_url');
    expect(fontes.paciente).not.toHaveProperty('cpf');
    expect(fontes.diagnosticos[0]).not.toHaveProperty('observacao');
    for (const c of h.banco.chamadas.filter((x) => x.metodo === 'select')) expect(String(c.args[0]), c.tabela).not.toContain('*');
  });

  it('só faz SELECT: nenhuma escrita no banco (insert, update, upsert, delete, rpc)', async () => {
    await lerFontesClinicas('pac-1', 'prof-1');
    expect(h.falso.escritas()).toEqual([]);
    expect(new Set(h.falso.operacoes.map((o) => o.tipo))).toEqual(new Set(['select']));
    expect(h.invocar).not.toHaveBeenCalled();
    expect(new Set(h.banco.chamadas.map((c) => c.metodo)).has('insert')).toBe(false);
  });

  it('lê exatamente as fontes combinadas: nem os achados do avatar (data = dia do envio) nem o prontuário', async () => {
    await lerFontesClinicas('pac-1', 'prof-1');
    expect([...new Set(h.falso.operacoes.map((o) => o.tabela))].sort()).toEqual(Object.keys(TABELA_DA_FONTE).sort());
  });

  it('pede o filtro que exclui o relato do paciente e só as avaliações deste profissional', async () => {
    await lerFontesClinicas('pac-1', 'prof-1');
    const voz = h.banco.chamadas.filter((c) => c.tabela === 'avaliacoes_voz');
    expect(voz).toContainEqual({ tabela: 'avaliacoes_voz', metodo: 'or', args: [FILTRO_SO_PROFISSIONAL] });
    expect(voz).toContainEqual({ tabela: 'avaliacoes_voz', metodo: 'eq', args: ['terapeuta_id', 'prof-1'] });
  });

  it('todas as leituras filtram pelo paciente, e o MyID só traz concluído', async () => {
    await lerFontesClinicas('pac-1', 'prof-1');
    for (const tabela of Object.keys(TABELA_DA_FONTE)) {
      const eqs = h.banco.chamadas.filter((c) => c.tabela === tabela && c.metodo === 'eq').map((c) => c.args.join('='));
      expect(eqs, tabela).toContain(tabela === 'pacientes' ? 'id=pac-1' : 'paciente_id=pac-1');
    }
    const eqsDoMyid = h.banco.chamadas.filter((c) => c.tabela === 'myid_avaliacoes' && c.metodo === 'eq').map((c) => c.args.join('='));
    expect(eqsDoMyid.filter((e) => e === 'status=concluido')).toHaveLength(2);
  });

  it('toda lista tem limite razoável e ordem (até 50; diagnósticos e exames importados até 200); o MyID com respostas traz só 1', async () => {
    await lerFontesClinicas('pac-1', 'prof-1');
    for (const tabela of Object.keys(TABELA_DA_FONTE).filter((t) => t !== 'pacientes')) {
      const limites = h.banco.chamadas.filter((c) => c.tabela === tabela && c.metodo === 'limit').map((c) => Number(c.args[0]));
      expect(limites.length, tabela).toBeGreaterThan(0);
      const teto = TABELAS_COM_LIMITE_DE_200.includes(tabela) ? 200 : 50;
      for (const l of limites) expect(l, tabela).toBeLessThanOrEqual(teto);
    }
    const limitesDoMyid = h.banco.chamadas.filter((c) => c.tabela === 'myid_avaliacoes' && c.metodo === 'limit').map((c) => Number(c.args[0]));
    expect(limitesDoMyid.sort((a, b) => a - b)[0]).toBe(1);
  });

  it('diagnósticos: lê ativo e tipo, pede só os ativos de tipo principal ou secundário e não deixa o removido nem a suspeita passar', async () => {
    const { fontes } = await lerFontesClinicas('pac-1', 'prof-1');
    const diag = h.banco.chamadas.filter((c) => c.tabela === 'diagnosticos_paciente');
    const colunas = String(diag.find((c) => c.metodo === 'select')?.args[0]).split(',').map((c) => c.trim());
    expect(colunas).toEqual(expect.arrayContaining(['ativo', 'tipo']));
    expect(diag).toContainEqual({ tabela: 'diagnosticos_paciente', metodo: 'eq', args: ['ativo', true] });
    expect(diag).toContainEqual({ tabela: 'diagnosticos_paciente', metodo: 'in', args: ['tipo', ['principal', 'secundario']] });
    expect([...TIPOS_DE_DIAGNOSTICO_QUE_ENTRAM]).toEqual(['principal', 'secundario']);
    expect(fontes.diagnosticos.every((l) => l.ativo === true && ['principal', 'secundario'].includes(String(l.tipo)))).toBe(true);
    expect(fontes.diagnosticos.map((l) => l.id)).not.toContain('d2');
    expect(fontes.diagnosticos.map((l) => l.id)).not.toContain('d3');
  });

  it('exames importados: lê status e pede só os que terminaram ("processado", o que a edge function import-exame grava)', async () => {
    const { fontes } = await lerFontesClinicas('pac-1', 'prof-1');
    const exames = h.banco.chamadas.filter((c) => c.tabela === 'exames_importados');
    expect(String(exames.find((c) => c.metodo === 'select')?.args[0]).split(',').map((c) => c.trim())).toContain('status');
    expect(exames).toContainEqual({ tabela: 'exames_importados', metodo: 'eq', args: ['status', 'processado'] });
    expect(STATUS_DE_EXAME_IMPORTADO_CONCLUIDO).toBe('processado');
    expect(fontes.examesImportados.map((l) => [l.id, l.status])).toEqual([['i1', 'processado']]);
  });

  it('limite de 200 em diagnósticos e exames importados (ordenados por data, sem data por último); as demais listas seguem em 50', async () => {
    await lerFontesClinicas('pac-1', 'prof-1');
    const limite = (tabela: string) => h.banco.chamadas.filter((c) => c.tabela === tabela && c.metodo === 'limit').map((c) => Number(c.args[0]));
    expect(limite('diagnosticos_paciente')).toEqual([200]);
    expect(limite('exames_importados')).toEqual([200]);
    for (const tabela of ['historia_vida_paciente', 'exames_presenciais', 'testes_funcionais_paciente', 'escalas_psicologia', 'avaliacoes_identidade']) expect(limite(tabela), tabela).toEqual([50]);
    const ordem = (tabela: string) => h.banco.chamadas.find((c) => c.tabela === tabela && c.metodo === 'order')?.args;
    expect(ordem('diagnosticos_paciente')).toEqual(['data_diagnostico', { ascending: false, nullsFirst: false }]);
    expect(ordem('exames_importados')).toEqual(['data_exame', { ascending: false, nullsFirst: false }]);
  });

  it('vínculos do MyID: só id, vínculo e created_at, só deste profissional e só os ligados a um MyID (nada de dados_avaliacao)', async () => {
    const { fontes } = await lerFontesClinicas('pac-1', 'prof-1');
    const lidas = h.banco.chamadas.filter((c) => c.tabela === 'avaliacoes_identidade');
    expect(lidas.find((c) => c.metodo === 'select')?.args).toEqual(['id, myid_avaliacao_id, created_at']);
    expect(lidas).toContainEqual({ tabela: 'avaliacoes_identidade', metodo: 'eq', args: ['paciente_id', 'pac-1'] });
    expect(lidas).toContainEqual({ tabela: 'avaliacoes_identidade', metodo: 'eq', args: ['terapeuta_id', 'prof-1'] });
    expect(lidas).toContainEqual({ tabela: 'avaliacoes_identidade', metodo: 'not', args: ['myid_avaliacao_id', 'is', null] });
    expect(fontes.vinculosMyid.map((l) => l.id)).toEqual(['ai1']);
    expect(fontes.vinculosMyid[0]).not.toHaveProperty('dados_avaliacao');
    expect(fontes.vinculosMyid[0]).not.toHaveProperty('myid_analysis');
  });

  it('avaliações: traz a origem do relato por caminho JSON com apelido, sem baixar o resultado inteiro', async () => {
    preparar({
      avaliacoes_voz: [
        { id: 'a1', paciente_id: 'pac-1', terapeuta_id: 'prof-1', created_at: '2026-10-01T12:00:00+00:00', queixa_principal: 'Do portal', resultado: { _meta: { origem: 'portal_paciente_historia' }, dado: 'pesado' } },
        { id: 'a2', paciente_id: 'pac-1', terapeuta_id: 'prof-1', created_at: '2026-10-02T12:00:00+00:00', queixa_principal: 'Do profissional', resultado: { _meta: {}, dado: 'pesado' } },
      ],
    });
    const { fontes } = await lerFontesClinicas('pac-1', 'prof-1');
    const colunas = String(h.banco.chamadas.find((c) => c.tabela === 'avaliacoes_voz' && c.metodo === 'select')?.args[0]);
    expect(colunas).toContain(`${CAMPO_ORIGEM_DO_RELATO}:${COLUNA_ORIGEM}`);
    expect(colunas).toBe(`id, created_at, queixa_principal, origem_do_relato:resultado->_meta->>origem`);
    // O banco falso não aplica o .or(): as duas linhas chegam, e a origem de cada uma vem junto, sem o `resultado`.
    expect(fontes.avaliacoesVoz.map((l) => [l.id, l[CAMPO_ORIGEM_DO_RELATO]]).sort()).toEqual([['a1', 'portal_paciente_historia'], ['a2', null]]);
    for (const l of fontes.avaliacoesVoz) expect(l).not.toHaveProperty('resultado');
  });

  it.each(Object.entries(TABELA_DA_FONTE))('se %s falhar, só essa fonte some e o aviso a nomeia (erro devolvido)', async (tabela, chave) => {
    h.banco.falharLeitura(tabela, 'erro');
    const { fontes, falhas } = await lerFontesClinicas('pac-1', 'prof-1');
    expect(falhas).toEqual([ROTULO_DA_FONTE[chave]]);
    const outras = Object.entries(TABELA_DA_FONTE).filter(([t]) => t !== tabela);
    expect(outras.length).toBe(9);
    if (chave !== 'paciente') expect(fontes.paciente).not.toBeNull();
    if (chave !== 'diagnosticos') expect(fontes.diagnosticos).toHaveLength(2);
    if (chave !== 'escalas') expect(fontes.escalas).toHaveLength(1);
    if (chave !== 'myid') expect(fontes.myidUltimo).not.toBeNull();
    if (chave !== 'vinculosMyid') expect(fontes.vinculosMyid).toHaveLength(1);
  });

  it('se a rede cair numa fonte (promessa rejeitada), as outras seguem e nada é inventado no lugar', async () => {
    h.banco.falharLeitura('diagnosticos_paciente', 'rejeitar');
    const { fontes, falhas } = await lerFontesClinicas('pac-1', 'prof-1');
    expect(falhas).toEqual(['os diagnósticos']);
    expect(fontes.diagnosticos).toEqual([]);
    expect(fontes.historiaVida).toHaveLength(1);
    expect(fontes.myidConcluidos).toHaveLength(2);
  });

  it('duas fontes com falha: as duas aparecem no aviso, na ordem das fontes', async () => {
    h.banco.falharLeitura('escalas_psicologia');
    h.banco.falharLeitura('myid_avaliacoes', 'rejeitar');
    const { falhas, fontes } = await lerFontesClinicas('pac-1', 'prof-1');
    expect(falhas).toEqual(['o MyID', 'as escalas']);
    expect(fontes.myidUltimo).toBeNull();
    expect(fontes.myidConcluidos).toEqual([]);
    expect(fontes.avaliacoesVoz).toHaveLength(1);
  });

  it('se todas falharem, não lança: devolve fontes vazias e uma falha por fonte', async () => {
    for (const tabela of Object.keys(TABELA_DA_FONTE)) h.banco.falharLeitura(tabela);
    const { falhas, fontes } = await lerFontesClinicas('pac-1', 'prof-1');
    expect(falhas).toHaveLength(10);
    expect(fontes.paciente).toBeNull();
    expect(fontes.historiaVida).toEqual([]);
  });

  it('tabelas vazias e paciente sem linha: sem falha, sem inventar nada', async () => {
    preparar({});
    const { falhas, fontes } = await lerFontesClinicas('pac-1', 'prof-1');
    expect(falhas).toEqual([]);
    expect(fontes.paciente).toBeNull();
    expect(fontes.myidUltimo).toBeNull();
    expect([fontes.myidConcluidos, fontes.vinculosMyid, fontes.avaliacoesVoz, fontes.historiaVida, fontes.diagnosticos, fontes.examesPresenciais, fontes.examesImportados, fontes.testesFuncionais, fontes.escalas]).toEqual([[], [], [], [], [], [], [], [], []]);
  });

  it('o código do hook não tem nenhuma chamada de escrita nem de função', () => {
    const fonte = readFileSync(join(__dirname, '..', 'hooks', 'useFontesClinicas.ts'), 'utf8');
    expect(fonte).not.toMatch(/\.(insert|update|upsert|delete|rpc)\s*\(/);
    expect(fonte).not.toMatch(/functions\s*\.\s*invoke/);
    expect(fonte).not.toMatch(/\bany\b/);
  });
});

describe('useFontesClinicas (hook)', () => {
  const envolver = () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };

  it('entrega as fontes e as falhas, sem escrever nada', async () => {
    h.banco.falharLeitura('escalas_psicologia');
    const { result } = renderHook(() => useFontesClinicas('pac-1'), { wrapper: envolver() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.falhas).toEqual(['as escalas']);
    expect(result.current.data?.fontes.historiaVida).toHaveLength(1);
    expect(h.falso.escritas()).toEqual([]);
  });

  it('sem paciente, não consulta nada', async () => {
    const { result } = renderHook(() => useFontesClinicas(undefined), { wrapper: envolver() });
    expect(result.current.fetchStatus).toBe('idle');
    expect(h.falso.operacoes).toEqual([]);
  });
});
