import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { montarLinhaDaConfirmacao } from '@/lib/resumoClinico/confirmacao';
import type { EntradaDaConfirmacao } from '@/lib/resumoClinico/confirmacao';

// Teste ESTÁTICO: lê o texto dos arquivos (e a migração que cria a tabela) e confere o contrato da escrita. O banco falso aceita
// qualquer coluna e qualquer valor, então só aqui se pega uma coluna que não existe, um tipo fora do CHECK ou uma segunda porta
// de escrita. Nada aqui altera arquivo nenhum.

const RAIZ = join(__dirname, '..');
const ler = (relativo: string) => readFileSync(join(RAIZ, relativo), 'utf8');
const HOOK = 'hooks/useConfirmarMarcoClinico.ts';
const hook = ler(HOOK);
const migracao = readFileSync(join(RAIZ, '..', 'supabase', 'migrations', '20260614230000_historia_vida_paciente.sql'), 'utf8');

// Caminhos relativos a src, sem "./" na frente; pasta vazia é o src inteiro.
function arquivosDe(pasta: string): string[] {
  const prefixo = pasta ? `${pasta}/` : '';
  return readdirSync(join(RAIZ, pasta), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? arquivosDe(`${prefixo}${e.name}`) : /\.(ts|tsx)$/.test(e.name) ? [`${prefixo}${e.name}`] : []));
}

describe('contrato com a tabela historia_vida_paciente (lê a migração 20260614230000)', () => {
  const corpo = migracao.slice(migracao.indexOf('CREATE TABLE'), migracao.indexOf(');', migracao.indexOf('CREATE TABLE')));
  const colunas = [...corpo.matchAll(/^\s{2}(\w+)\s+(?:uuid|text|date|smallint|boolean|jsonb|timestamptz)\b/gm)].map((m) => m[1]);
  const tiposDoCheck = [...(corpo.match(/CHECK \(tipo IN \(([\s\S]*?)\)\)/)?.[1] ?? '').matchAll(/'(\w+)'/g)].map((m) => m[1]);
  const obrigatoriasSemPadrao = [...corpo.matchAll(/^\s{2}(\w+)\s+\w+[^\n]*NOT NULL(?![^\n]*DEFAULT)[^\n]*$/gm)].map((m) => m[1]).filter((c) => c !== 'id');

  const entrada = (extra: Partial<EntradaDaConfirmacao> = {}): EntradaDaConfirmacao => ({
    terapeutaId: '11111111-1111-4111-8111-111111111111', pacienteId: '22222222-2222-4222-8222-222222222222', chave: 'historico_clinico:cirurgia:id:k1',
    relato: { tipo: 'Joelho', ano: '2022', complicacoes: 'dor' }, tipo: 'cirurgia', precisao: 'dia', texto: '2022-06-10',
    profissional: { nome: 'Ana', sobrenome: 'Souza', crefito: '12345-F' }, ...extra,
  });
  const linhas = [
    ['cirurgia', 'dia'], ['cirurgia', 'ano'], ['internacao', 'dia'], ['internacao', 'ano'],
  ].map(([tipo, precisao]) => {
    const r = montarLinhaDaConfirmacao(entrada({ tipo, precisao: precisao as 'dia' | 'ano', texto: precisao === 'ano' ? '2022' : '2022-06-10' }), '2026-11-15');
    if (r.erro) throw new Error(r.erro);
    return { tipo, precisao, linha: r.linha as unknown as Record<string, unknown> };
  });

  it('a leitura da migração achou as colunas, o CHECK e as obrigatórias (o teste não passa vazio)', () => {
    expect(colunas).toEqual(expect.arrayContaining(['id', 'terapeuta_id', 'paciente_id', 'data_evento', 'tipo', 'titulo', 'descricao', 'sistema_corporal', 'severidade', 'resolvido', 'visivel_paciente', 'profissional_registro', 'metadata', 'created_at', 'updated_at']));
    expect(tiposDoCheck).toContain('cirurgia');
    expect(tiposDoCheck).toContain('internacao');
    expect(tiposDoCheck.length).toBeGreaterThanOrEqual(10);
    expect(obrigatoriasSemPadrao).toEqual(expect.arrayContaining(['terapeuta_id', 'paciente_id', 'data_evento', 'titulo']));
  });

  it.each(linhas)('$tipo/$precisao: toda chave do que é gravado existe como coluna da tabela', ({ linha }) => {
    for (const chave of Object.keys(linha)) expect(colunas, `coluna "${chave}"`).toContain(chave);
  });

  it.each(linhas)('$tipo/$precisao: o tipo está no CHECK da tabela', ({ linha }) => {
    expect(tiposDoCheck).toContain(linha.tipo);
  });

  it.each(linhas)('$tipo/$precisao: manda todas as colunas obrigatórias sem padrão, com valor', ({ linha }) => {
    for (const coluna of obrigatoriasSemPadrao) {
      expect(linha[coluna], coluna).toBeTruthy();
      expect(String(linha[coluna]).length, coluna).toBeGreaterThan(0);
    }
  });

  it.each(linhas)('$tipo/$precisao: data_evento é texto AAAA-MM-DD (coluna date), nunca Date', ({ linha }) => {
    expect(typeof linha.data_evento).toBe('string');
    expect(linha.data_evento).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it.each(linhas)('$tipo/$precisao: severidade cabe no CHECK (0 a 4) e o metadata é objeto (jsonb)', ({ linha }) => {
    expect(corpo).toMatch(/severidade smallint DEFAULT 0 CHECK \(severidade BETWEEN 0 AND 4\)/);
    expect(linha.severidade).toBe(0);
    expect(typeof linha.metadata).toBe('object');
    expect(Array.isArray(linha.metadata)).toBe(false);
  });

  it.each(linhas)('$tipo/$precisao: não manda created_at nem updated_at (têm padrão no servidor) e o id é um uuid', ({ linha }) => {
    expect(Object.keys(linha)).not.toContain('created_at');
    expect(Object.keys(linha)).not.toContain('updated_at');
    expect(linha.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('visivel_paciente e resolvido são EXPLÍCITOS (o padrão da coluna é o contrário do que a confirmação precisa)', () => {
    expect(corpo).toMatch(/resolvido boolean DEFAULT false/);
    expect(corpo).toMatch(/visivel_paciente boolean DEFAULT true/);
    for (const { linha } of linhas) {
      expect(linha.resolvido).toBe(true);
      expect(linha.visivel_paciente).toBe(false);
    }
    const montador = ler('lib/resumoClinico/confirmacao.ts');
    expect(montador).toContain('visivel_paciente: false');
    expect(montador).toContain('resolvido: true');
  });

  it('a política da tabela só deixa o próprio terapeuta ler e escrever (a confirmação nunca vai para o paciente)', () => {
    expect(migracao).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(migracao).toMatch(/FOR ALL\s+USING \(auth\.uid\(\) = terapeuta_id\)\s+WITH CHECK \(auth\.uid\(\) = terapeuta_id\)/);
  });
});

describe('o hook é o único escritor da confirmação', () => {
  it('só mexe na tabela historia_vida_paciente e em nenhuma outra tabela do prontuário', () => {
    expect(hook).toContain("const TABELA = 'historia_vida_paciente'");
    for (const proibida of ['notas_prontuario', "'pacientes'", 'avaliacoes_voz', 'avaliacoes_identidade', 'eventos_clinicos_anatomicos', 'diagnosticos_paciente']) {
      expect(hook, proibida).not.toContain(proibida);
    }
    const codigo = hook.replace(/\/\/.*$/gm, '');
    expect(codigo.match(/tabela\(/g)?.length).toBeGreaterThanOrEqual(3);
    expect(codigo.match(/tabela\(TABELA\)/g)?.length).toBe(codigo.match(/tabela\(/g)?.length);
  });

  it('tem UM insert e UM delete, e nenhum outro caminho de escrita nem de rede', () => {
    expect(hook.match(/\.\s*insert\s*\(/g)).toHaveLength(1);
    expect(hook.match(/\.\s*delete\s*\(/g)).toHaveLength(1);
    for (const padrao of [/\.\s*update\s*\(/, /\.\s*upsert\s*\(/, /\.\s*rpc\s*\(/, /\bfetch\s*\(/, /functions\s*\.\s*invoke/, /window\s*\.\s*open/, /\bconsole\s*\./, /localStorage|sessionStorage/, /XMLHttpRequest|sendBeacon/]) {
      expect(hook, String(padrao)).not.toMatch(padrao);
    }
  });

  it('o insert grava o que o montador devolve (nada de payload montado à mão) e o montador recebe o "hoje" lido na hora', () => {
    expect(hook).toContain('montarLinhaDaConfirmacao(');
    expect(hook).toContain('.insert(linha)');
    expect(hook).toContain('hojeLocalISO()');
    expect(hook).not.toMatch(/created_at|updated_at|confirmado_em|toISOString|new Date\(/);
  });

  it('o delete leva as QUATRO condições (id, paciente, profissional e marca de origem) e pede de volta as linhas apagadas', () => {
    const delete_ = hook.slice(hook.indexOf('.delete()'), hook.indexOf(".select('id');", hook.indexOf('.delete()')) + ".select('id');".length);
    expect(delete_).toContain(".eq('id', idDaLinha)");
    expect(delete_).toContain(".eq('paciente_id', contexto.pacienteId)");
    expect(delete_).toContain(".eq('terapeuta_id', contexto.terapeutaId)");
    expect(delete_).toContain(".eq('metadata->>origem', ORIGEM_CONFIRMACAO)");
    expect(delete_).toContain(".select('id')");
    expect(delete_.match(/\.eq\(/g)).toHaveLength(4);
  });

  it('só a página do perfil usa o hook (nada na camada pura nem nas telas da linha do tempo o importa)', () => {
    const quemImporta = arquivosDe('')
      .filter((a) => !a.startsWith('test/'))
      .filter((a) => /useConfirmarMarcoClinico/.test(ler(a)) && a !== HOOK);
    expect(quemImporta).toEqual(['pages/PacientePerfil.tsx']);
    for (const pasta of ['lib/resumoClinico', 'components/resumoClinico']) {
      for (const arquivo of arquivosDe(pasta)) expect(ler(arquivo), arquivo).not.toContain('useConfirmarMarcoClinico');
    }
  });

  it('os dois diálogos são só apresentação: nem o client do Supabase, nem tabela(), nem o hook, nem escrita', () => {
    for (const arquivo of ['components/resumoClinico/ConfirmarMarcoDialog.tsx', 'components/resumoClinico/DesfazerMarcoDialog.tsx', 'components/resumoClinico/LinhaDoTempoClinica.tsx']) {
      const texto = ler(arquivo);
      expect(texto, arquivo).not.toMatch(/integrations\/supabase|lib\/dosagem\/db|tabela\(|@\/hooks\/useConfirmar|@tanstack\/react-query/);
      expect(texto, arquivo).not.toMatch(/\.\s*(insert|update|upsert|delete|rpc)\s*\(/);
    }
  });
});

describe('a página do perfil', () => {
  const pagina = ler('pages/PacientePerfil.tsx');

  it('chama o hook ANTES de qualquer retorno condicional (regra dos hooks do React)', () => {
    const chamada = pagina.indexOf('useConfirmarMarcoClinico(');
    const clinica = pagina.indexOf('useClinicaContext()');
    const primeiroRetorno = pagina.indexOf('if (!authLoading && !user) return');
    expect(chamada).toBeGreaterThan(0);
    expect(clinica).toBeGreaterThan(0);
    expect(primeiroRetorno).toBeGreaterThan(0);
    expect(chamada).toBeLessThan(primeiroRetorno);
    expect(clinica).toBeLessThan(primeiroRetorno);
  });

  it('só passa as funções quando o papel não é "recepcao" e o papel já carregou', () => {
    expect(pagina).toContain("const podeConfirmarMarco = !carregandoOPapel && papelNaClinica !== 'recepcao';");
    expect(pagina).toContain('onConfirmarMarco={podeConfirmarMarco ? confirmarMarco.pedirConfirmacao : undefined}');
    expect(pagina).toContain('onDesfazerMarco={podeConfirmarMarco ? confirmarMarco.pedirDesfazer : undefined}');
  });

  it('os dois diálogos ficam no nível da página, fora das seções que remontam', () => {
    expect(pagina).toContain('<ConfirmarMarcoDialog');
    expect(pagina).toContain('<DesfazerMarcoDialog');
    for (const arquivo of ['components/voice/AvaliacaoVozAtual.tsx', 'components/voice/AvaliacaoSecoesEditaveis.tsx']) {
      expect(ler(arquivo), arquivo).not.toMatch(/ConfirmarMarcoDialog|DesfazerMarcoDialog|useConfirmarMarcoClinico/);
    }
  });

  it('as duas seções da aba repassam as duas funções exatamente como repassam onAbrirRegistro', () => {
    const vozAtual = ler('components/voice/AvaliacaoVozAtual.tsx');
    expect(vozAtual.match(/onConfirmarMarco=\{onConfirmarMarco\}/g)).toHaveLength(3);
    expect(vozAtual.match(/onDesfazerMarco=\{onDesfazerMarco\}/g)).toHaveLength(3);
    expect(vozAtual.match(/onAbrirRegistro=\{onAbrirRegistro\}/g)).toHaveLength(3);
    const secoes = ler('components/voice/AvaliacaoSecoesEditaveis.tsx');
    expect(secoes.match(/onConfirmarMarco=\{onConfirmarMarco\}/g)).toHaveLength(1);
    expect(secoes.match(/onDesfazerMarco=\{onDesfazerMarco\}/g)).toHaveLength(1);
  });
});

describe('o aviso da triagem e o selo próprio existem onde a decisão pede', () => {
  it('o formulário mostra o aviso fixo sem condição nenhuma em volta', () => {
    const dialogo = ler('components/resumoClinico/ConfirmarMarcoDialog.tsx');
    expect(dialogo).toMatch(/<p\s+role="note"[^>]*>\s*\{AVISO_DA_TRIAGEM_DOS_PLANOS\}\s*<\/p>/);
    const tipos = ler('lib/resumoClinico/tipos.ts');
    expect(tipos).toContain('A triagem de segurança dos planos continua usando o ano que o cliente escreveu. Esta confirmação não a altera.');
  });

  it('o selo do marco confirmado é um terceiro visual do SeloDeOrigem, sem mudar o tipo OrigemDoDado', () => {
    const tipos = ler('lib/resumoClinico/tipos.ts');
    expect(tipos).toContain("export const SELO_DATA_CONFIRMADA = 'Data confirmada pelo profissional · texto do cliente';");
    expect(tipos).toMatch(/export type OrigemDoDado = 'cliente' \| 'profissional';/);
    expect(ler('components/resumoClinico/SeloDeOrigem.tsx')).toContain('SELO_DATA_CONFIRMADA');
  });
});
