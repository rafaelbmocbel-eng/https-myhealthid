import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  COLUNA_ORIGEM, FILTRO_SO_PROFISSIONAL, ORIGENS_PACIENTE, VALOR_SO_PACIENTE,
  ehRelatoDoPaciente, origemDaAvaliacao, soDoProfissional,
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

  it('o filtro do PostgREST é o testado (PostgREST 12.2.3): linhas sem origem entram, as do paciente saem', () => {
    // Testado contra um PostgREST real com a coluna resultado em json: devolve a avaliação do profissional como a
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
  'src/components/protocolo/ProtocoloViewer.tsx': 'lê a avaliação pelo id gravado no protocolo',
  'src/components/dashboard/ClinicalInsights.tsx': 'lê o campo de um registro já escolhido',
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

describe('leituras de avaliacoes_voz decidem o que fazer com o relato do paciente', () => {
  const candidatos = [...arquivos(join(RAIZ, 'src')), ...arquivos(join(RAIZ, 'supabase/functions'))]
    .map(p => ({ rel: relative(RAIZ, p).split('\\').join('/'), texto: readFileSync(p, 'utf8') }))
    // O nome da tabela entre aspas cobre from('avaliacoes_voz') e também listas de tabelas (ExportarDados).
    .filter(a => /['"]avaliacoes_voz['"]/.test(a.texto) && /\.select\(/.test(a.texto))
    .filter(a => a.rel !== 'src/utils/voiceAssessment/origemAvaliacao.ts');

  it('encontra as leituras conhecidas (a varredura não está vazia)', () => {
    expect(candidatos.length).toBeGreaterThan(15);
  });

  it('cada arquivo filtra o relato do paciente ou tem motivo registrado', () => {
    const sem = candidatos
      .filter(a => !/FILTRO_SO_PROFISSIONAL|soDoProfissional|ehRelatoDoPaciente/.test(a.texto))
      .filter(a => !(a.rel in SEM_FILTRO_DE_PROPOSITO))
      .map(a => a.rel);
    expect(sem, `leitura de avaliacoes_voz sem filtro nem motivo: ${sem.join(', ')}`).toEqual([]);
  });

  it('a lista de exceções não guarda arquivo que não lê mais a tabela', () => {
    const lidos = new Set(candidatos.map(a => a.rel));
    const obsoletos = Object.keys(SEM_FILTRO_DE_PROPOSITO).filter(a => !lidos.has(a));
    expect(obsoletos, `exceções sem leitura correspondente: ${obsoletos.join(', ')}`).toEqual([]);
  });
});
