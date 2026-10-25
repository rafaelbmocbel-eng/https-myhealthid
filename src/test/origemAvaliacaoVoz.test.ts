import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  COLUNA_ORIGEM, FILTRO_SO_PROFISSIONAL, ORIGENS_PACIENTE, VALOR_SO_PACIENTE,
  ehRelatoDoPaciente, origemDaAvaliacao, origemEModoDaAvaliacao, redFlagsDoResultado, soDoProfissional,
} from '@/utils/voiceAssessment/origemAvaliacao';
import * as servidor from '../../supabase/functions/_shared/origem-avaliacao';

const RAIZ = join(__dirname, '..', '..');

describe('origem das avaliações por voz (relato do paciente x avaliação do profissional)', () => {
  it('reconhece a origem pelo _meta.origem e trata o resto como do profissional', () => {
    expect(origemDaAvaliacao({ _meta: { origem: 'portal_paciente_historia' } })).toBe('portal_paciente_historia');
    expect(origemDaAvaliacao({ _meta: { mode: 'voice' } })).toBeUndefined();
    expect(origemDaAvaliacao({ queixa_principal: 'x' })).toBeUndefined();
    expect(origemDaAvaliacao(null)).toBeUndefined();
    expect(origemDaAvaliacao('texto solto')).toBeUndefined();
    expect(origemDaAvaliacao({ _meta: 'quebrado' })).toBeUndefined();
    expect(origemDaAvaliacao({ _meta: { origem: 42 } })).toBeUndefined();
  });

  it('só as duas origens do portal são relato do paciente; mode "voice" não decide', () => {
    expect(ehRelatoDoPaciente({ resultado: { _meta: { origem: 'portal_paciente_historia' } } })).toBe(true);
    expect(ehRelatoDoPaciente({ resultado: { _meta: { origem: 'autocadastro_paciente', mode: 'voice' } } })).toBe(true);
    expect(ehRelatoDoPaciente({ resultado: { _meta: { origem: 'voice_assessment', mode: 'voice' } } })).toBe(false);
    expect(ehRelatoDoPaciente({ resultado: { _meta: { origem: 'escrita' } } })).toBe(false);
    expect(ehRelatoDoPaciente({ resultado: { _meta: { mode: 'voice' } } })).toBe(false);
    expect(ehRelatoDoPaciente({ resultado: null })).toBe(false);
    expect(ehRelatoDoPaciente({})).toBe(false);
    expect(ehRelatoDoPaciente(null)).toBe(false);
    expect(ehRelatoDoPaciente(undefined)).toBe(false);
  });

  it('soDoProfissional mantém as avaliações antigas sem _meta e descarta o relato do paciente', () => {
    const antiga = { id: 'antiga', resultado: { queixa_principal: 'joelho' } };
    const semMeta = { id: 'sem-meta', resultado: null };
    const voz = { id: 'voz', resultado: { _meta: { origem: 'voice_assessment', mode: 'voice' } } };
    const escrita = { id: 'escrita', resultado: { _meta: { origem: 'escrita' } } };
    const historia = { id: 'historia', resultado: { _meta: { origem: 'portal_paciente_historia' } } };
    const auto = { id: 'auto', resultado: { _meta: { origem: 'autocadastro_paciente', mode: 'voice' } } };
    const lista = [auto, historia, voz, escrita, antiga, semMeta];
    expect(soDoProfissional(lista).map(a => a.id)).toEqual(['voz', 'escrita', 'antiga', 'sem-meta']);
    expect(lista).toHaveLength(6);
  });

  it('redFlagsDoResultado devolve os alertas reais e descarta só a frase de ausência de alerta', () => {
    expect(redFlagsDoResultado({ red_flags: ['Nenhum red flag identificado'] })).toEqual([]);
    expect(redFlagsDoResultado({ red_flags: ['Sem red flags', 'Dados insuficientes para avaliar'] })).toEqual([]);
    expect(redFlagsDoResultado({ red_flags: ['Não foram identificados sinais de alerta'] })).toEqual([]);
    expect(redFlagsDoResultado({ red_flags: ['dor torácica ao esforço', 'Nenhum red flag identificado'] })).toEqual(['dor torácica ao esforço']);
    // uma palavra da lista no MEIO de um alerta real não o descarta
    expect(redFlagsDoResultado({ red_flags: ['Dor noturna insuficientemente aliviada pelo repouso'] })).toEqual(['Dor noturna insuficientemente aliviada pelo repouso']);
    expect(redFlagsDoResultado({ red_flags: ['Perda de peso sem causa aparente'] })).toEqual(['Perda de peso sem causa aparente']);
    // objetos {titulo|descricao}, red_flags_reforcadas, repetidos e itens curtos
    expect(redFlagsDoResultado({ red_flags: [{ titulo: 'Febre persistente' }, { descricao: 'Fraqueza progressiva' }], red_flags_reforcadas: ['Febre persistente', 'ok'] }))
      .toEqual(['Febre persistente', 'Fraqueza progressiva']);
    expect(redFlagsDoResultado(null)).toEqual([]);
    expect(redFlagsDoResultado({ red_flags: 'texto solto' })).toEqual([]);
    expect(redFlagsDoResultado({})).toEqual([]);
  });

  it('reprocessar um relato do paciente não o transforma em avaliação do profissional', () => {
    const registro = { origem: 'portal_paciente_historia', tipo: 'inicial' };
    // reprocessar devolve resultado sem _meta: vale a origem do registro aberto
    expect(origemEModoDaAvaliacao(undefined, registro, 'voice_assessment', 'voice')).toEqual({ origem: 'portal_paciente_historia', mode: 'voice' });
    expect(origemEModoDaAvaliacao({}, { origem: 'autocadastro_paciente', mode: 'voice' }, 'escrita', 'written')).toEqual({ origem: 'autocadastro_paciente', mode: 'voice' });
    // o _meta do próprio resultado manda, depois o do registro, depois a sessão atual
    expect(origemEModoDaAvaliacao({ origem: 'escrita', mode: 'written' }, registro, 'voice_assessment', 'voice')).toEqual({ origem: 'escrita', mode: 'written' });
    expect(origemEModoDaAvaliacao(null, null, 'voice_assessment', 'voice')).toEqual({ origem: 'voice_assessment', mode: 'voice' });
    expect(origemEModoDaAvaliacao(undefined, { mode: 'written' }, 'escrita', 'voice')).toEqual({ origem: 'escrita', mode: 'written' });
  });

  it('o filtro do PostgREST é o testado (PostgREST 12.2.3 e 14.1): linhas sem origem entram, as do paciente saem', () => {
    // Testado contra um PostgREST real (12.2.3 e 14.1) com a coluna resultado em json: devolve a avaliação do profissional como a
    // mais recente, mantém linhas antigas sem _meta.origem e funciona com contagem (HEAD). Um not.in sozinho
    // perderia as antigas, porque NOT (NULL IN (...)) é NULL.
    expect(FILTRO_SO_PROFISSIONAL).toBe(
      'resultado->_meta->>origem.is.null,resultado->_meta->>origem.not.in.(portal_paciente_historia,autocadastro_paciente)',
    );
    expect(FILTRO_SO_PROFISSIONAL).toContain('origem.is.null');
  });

  it('o espelho do servidor (Deno) não se separa do front', () => {
    expect([...servidor.ORIGENS_PACIENTE]).toEqual([...ORIGENS_PACIENTE]);
    expect(servidor.FILTRO_SO_PROFISSIONAL).toBe(FILTRO_SO_PROFISSIONAL);
    expect(servidor.COLUNA_ORIGEM).toBe('resultado->_meta->>origem');
    expect(servidor.VALOR_SO_PACIENTE).toBe('(portal_paciente_historia,autocadastro_paciente)');
    expect(COLUNA_ORIGEM).toBe(servidor.COLUNA_ORIGEM);
    expect(VALOR_SO_PACIENTE).toBe(servidor.VALOR_SO_PACIENTE);
  });

  it('as origens que o servidor grava para o paciente estão todas na lista', () => {
    const gravadas = new Set<string>();
    for (const arq of ['historia-paciente', 'patient-self-report']) {
      const texto = readFileSync(join(RAIZ, 'supabase/functions', arq, 'index.ts'), 'utf8');
      for (const m of texto.matchAll(/origem:\s*"([a-z_]+)"/g)) gravadas.add(m[1]);
    }
    expect([...gravadas].sort()).toEqual([...ORIGENS_PACIENTE].sort());
  });
});

// Toda leitura nova de avaliacoes_voz precisa decidir o que fazer com o relato do paciente: filtrar (usar
// FILTRO_SO_PROFISSIONAL ou soDoProfissional) ou entrar nesta lista com o motivo. Foi a ausência dessa
// decisão que escondeu a avaliação presencial depois que o paciente contou o caso no portal.
const SEM_FILTRO_DE_PROPOSITO: Record<string, string> = {
  'src/components/voice/AvaliacaoSecoesEditaveis.tsx': 'só atualiza a linha pelo id que a tela já recebeu (já filtrada)',
  'src/components/voice/CondutasProfissionalCard.tsx': 'só atualiza a linha pelo id que a tela já recebeu (já filtrada)',
  'src/utils/voiceAssessment/reprocessarComplemento.ts': 'atualiza a linha pelo id recebido',
  'src/utils/voiceAssessment/atualizarPlanoComEdicoes.ts': 'lê e atualiza a linha pelo id recebido',
  'src/pages/ExportarDados.tsx': 'exportação completa: o relato do paciente é dado do paciente e deve sair junto',
  'src/components/paciente/PacienteRelatoVoz.tsx': 'portal: lê justamente o relato do próprio paciente',
  'src/pages/paciente/PacienteDashboard.tsx': 'portal: procura o relato do próprio paciente',
  'src/components/paciente/PacienteInsightsDaAvaliacao.tsx': 'portal: qual avaliação o cliente vê é decisão de produto do Rafael (pendente)',
  'src/components/paciente/PatientIntegratedDashboard.tsx': 'o Avatar com o relato do paciente é intencional (fluxo de entrada do cliente)',
  'supabase/functions/historia-paciente/index.ts': 'grava e consulta o relato do próprio paciente',
  'supabase/functions/patient-self-report/index.ts': 'grava o autorrelato do paciente',
};

function arquivos(dir: string, saida: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (nome === 'node_modules' || nome === 'test' || nome === 'integrations') continue;
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivos(caminho, saida);
    else if (/\.(ts|tsx)$/.test(nome) && !/\.test\.tsx?$/.test(nome)) saida.push(caminho);
  }
  return saida;
}

// Cada consulta é analisada sozinha: do nome da tabela até o ';' ou até a próxima tabela (.from), no máximo 800
// caracteres. Passa quem grava (insert/update/delete), quem lê por id, ou quem decide a origem (filtro do
// profissional, filtro inverso do paciente ou o helper de lista).
function cadeias(texto: string): string[] {
  const saida: string[] = [];
  for (const m of texto.matchAll(/from\(\s*['"`]avaliacoes_voz['"`]/g)) {
    const resto = texto.slice((m.index ?? 0) + m[0].length);
    const cortes = [resto.indexOf(';'), resto.search(/\.from\(/), 800].filter((n) => n >= 0);
    saida.push(resto.slice(0, Math.min(...cortes)));
  }
  return saida;
}
// Quem lista TUDO de propósito (e rotula o relato do paciente) diz isso num comentário `@origem-avaliacao` logo
// antes da consulta, e o motivo fica à vista de quem ler o código.
const MARCADOR = '@origem-avaliacao';
function cadeiasComMarcador(texto: string): Array<{ cadeia: string; marcada: boolean }> {
  const saida: Array<{ cadeia: string; marcada: boolean }> = [];
  const cs = cadeias(texto);
  let i = 0;
  for (const m of texto.matchAll(/from\(\s*['"`]avaliacoes_voz['"`]/g)) {
    const antes = texto.slice(Math.max(0, (m.index ?? 0) - 240), m.index ?? 0);
    saida.push({ cadeia: cs[i++], marcada: antes.includes(MARCADOR) });
  }
  return saida;
}
const consultaDecideAOrigem = (c: string) =>
  /\.(update|delete|insert|upsert)\(/.test(c)
  || /\.eq\(\s*['"]id['"]/.test(c)
  || /FILTRO_SO_PROFISSIONAL|COLUNA_ORIGEM|soDoProfissional|ehRelatoDoPaciente/.test(c);

describe('leituras de avaliacoes_voz decidem o que fazer com o relato do paciente', () => {
  const candidatos = [...arquivos(join(RAIZ, 'src')), ...arquivos(join(RAIZ, 'supabase/functions'))]
    .map(p => ({ rel: relative(RAIZ, p).split('\\').join('/'), texto: readFileSync(p, 'utf8') }))
    // O nome da tabela entre aspas cobre from('avaliacoes_voz'), crases e também listas de tabelas (ExportarDados).
    .filter(a => /['"`]avaliacoes_voz['"`]/.test(a.texto) && /\.select\(/.test(a.texto))
    .filter(a => a.rel !== 'src/utils/voiceAssessment/origemAvaliacao.ts');

  it('encontra as leituras conhecidas (a varredura não está vazia)', () => {
    expect(candidatos.length).toBeGreaterThan(15);
  });

  it('cada consulta filtra a origem, grava, lê por id ou o arquivo tem motivo registrado', () => {
    const soltas = candidatos
      .filter(a => !(a.rel in SEM_FILTRO_DE_PROPOSITO))
      .flatMap(a => cadeiasComMarcador(a.texto)
        .filter(({ cadeia, marcada }) => !marcada && !consultaDecideAOrigem(cadeia))
        .map(({ cadeia }) => `${a.rel}: ${cadeia.replace(/\s+/g, ' ').slice(0, 90)}`));
    expect(soltas, `consulta de avaliacoes_voz sem decidir a origem:\n${soltas.join('\n')}`).toEqual([]);
  });

  it('o detector de consultas enxerga uma consulta solta num arquivo que tem outra filtrada', () => {
    const arquivo = `supabase.from('avaliacoes_voz').select('id').eq('paciente_id', p).or(FILTRO_SO_PROFISSIONAL).limit(1);
      supabase.from("avaliacoes_voz").select('id').eq('paciente_id', p).order('created_at').limit(12);
      supabase.from(\`avaliacoes_voz\`).update({ a: 1 }).eq('id', x);`;
    const soltas = cadeiasComMarcador(arquivo).filter(({ cadeia, marcada }) => !marcada && !consultaDecideAOrigem(cadeia));
    expect(cadeias(arquivo)).toHaveLength(3);
    expect(soltas).toHaveLength(1);
    expect(soltas[0].cadeia).toContain('.limit(12)');
    // um comentário-marcador logo antes da consulta é uma decisão registrada
    const marcado = `// @origem-avaliacao: lista tudo e rotula\nsupabase.from('avaliacoes_voz').select('id').eq('paciente_id', p);`;
    expect(cadeiasComMarcador(marcado).filter(({ cadeia, marcada }) => !marcada && !consultaDecideAOrigem(cadeia))).toHaveLength(0);
    // uma menção ao nome da tabela que não é consulta não conta
    expect(cadeias(`falhas.push('avaliacoes_voz');`)).toHaveLength(0);
  });

  it('a lista de exceções não guarda arquivo que não lê mais a tabela', () => {
    const lidos = new Set(candidatos.map(a => a.rel));
    const obsoletos = Object.keys(SEM_FILTRO_DE_PROPOSITO).filter(a => !lidos.has(a));
    expect(obsoletos, `exceções sem leitura correspondente: ${obsoletos.join(', ')}`).toEqual([]);
  });
});
