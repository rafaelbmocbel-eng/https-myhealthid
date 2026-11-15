// Guarda da CLASSE de defeito "consulta a coluna que não existe" no contexto clínico do agente de WhatsApp.
// montarContextoClinico consultava paciente_missoes.status e pagamentos_paciente.vencimento, que não existem:
// o banco respondia 400 a cada paciente que o agente-proativo percorria (cerca de 400 por dia, na faixa das 9h)
// e o código seguia com 0 / null por acaso. Em supabase/functions o cliente do Supabase não é tipado e o tsc do
// app não olha lá; por isso este teste roda a função contra um cliente falso que anota a cadeia de cada consulta
// e confere cada coluna usada contra o Row da tabela em src/integrations/supabase/types.ts.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TIPOS = readFileSync(resolve(__dirname, '../integrations/supabase/types.ts'), 'utf8');

// Import dinâmico de propósito: o arquivo importa o cliente do Supabase por URL (esm.sh), que o tsc do app não
// resolve; um import estático dele aqui acrescentaria um erro TS2307 ao tsc. O esbuild descarta esse import
// (só é usado como tipo), então o vitest carrega o arquivo sem rede.
const CAMINHO_DO_CONTEXTO = '../../supabase/functions/_shared/agente-contexto.ts';

type Linha = Record<string, unknown>;
type Filtro = { metodo: string; coluna: string };
type Consulta = { tabela: string; selects: string[]; filtros: Filtro[]; ordens: string[] };
type ContextoLido = {
  paciente: { id: string | null; nome: string; primeiro_nome: string };
  myid: { score: number | null; red_flags: boolean; dimensoes_criticas: { nome: string; perda: number }[] } | null;
  proxima_sessao: { id: string; status: string } | null;
  ultima_sessao: { data: string; dias_desde: number } | null;
  exercicios_pendentes: number;
  pagamento_pendente: { valor: number; vencimento: string | null } | null;
  pacote_ativo: { restantes: number; total: number } | null;
  tom_voz: string;
  prompt_extra: string | null;
  profissional_nome: string;
};
type ModuloDoContexto = {
  montarContextoClinico: (
    admin: unknown, terapeutaId: string, pacienteId: string | null, telefone: string, nomeContato: string | null,
  ) => Promise<ContextoLido>;
};

// --- Leitura do types.ts ------------------------------------------------------------------------------

function colunasDaTabela(tipos: string, tabela: string): Set<string> | null {
  if (!/^\w+$/.test(tabela)) return null;
  const bloco = new RegExp(`\\n {6}${tabela}: \\{\\n {8}Row: \\{\\n([\\s\\S]*?)\\n {8}\\}\\n`).exec(tipos);
  if (!bloco) return null;
  const colunas = new Set<string>();
  for (const linha of bloco[1].split('\n')) {
    const achada = /^ {10}(\w+)\??:/.exec(linha);
    if (achada) colunas.add(achada[1]);
  }
  return colunas.size > 0 ? colunas : null;
}

function partirNaVirgula(texto: string): string[] {
  const partes: string[] = [];
  let nivel = 0;
  let atual = '';
  for (const c of texto) {
    if (c === '(') nivel++;
    if (c === ')') nivel--;
    if (c === ',' && nivel === 0) {
      partes.push(atual);
      atual = '';
    } else {
      atual += c;
    }
  }
  partes.push(atual);
  return partes.map((p) => p.trim()).filter(Boolean);
}

// .or("a.eq.1,and(b.gt.2,c.is.null)") -> a, b, c
function colunasDoOr(expressao: string): string[] {
  return partirNaVirgula(expressao).flatMap((parte) => {
    const aninhado = /^(?:not\.)?(?:and|or)\(([\s\S]*)\)$/.exec(parte);
    if (aninhado) return colunasDoOr(aninhado[1]);
    return [parte.split('.')[0]];
  });
}

function conferirColuna(tipos: string, tabela: string, coluna: string, onde: string, problemas: string[]) {
  const colunas = colunasDaTabela(tipos, tabela);
  if (!colunas) {
    problemas.push(`${onde}: a tabela "${tabela}" não está em types.ts`);
    return;
  }
  const nome = coluna.split(/->>?/)[0];
  if (!colunas.has(nome)) {
    problemas.push(`${onde}: a coluna "${coluna}" não existe em Row de "${tabela}" em types.ts`);
  }
}

function conferirSelect(tipos: string, tabela: string, select: string, onde: string, problemas: string[]) {
  if (!colunasDaTabela(tipos, tabela)) {
    problemas.push(`${onde}: a tabela "${tabela}" não está em types.ts`);
    return;
  }
  for (const item of partirNaVirgula(select)) {
    const juncao = /^(?:\w+:)?(\w+)(?:![\w.]+)*\(([\s\S]*)\)$/.exec(item);
    if (juncao) {
      conferirSelect(tipos, juncao[1], juncao[2], `${onde} > ${juncao[1]}`, problemas);
      continue;
    }
    const coluna = item.replace(/^\w+:(?!:)/, '').replace(/::\w+$/, '');
    if (coluna === '*') continue;
    if (!/^\w+(->>?\w+)*$/.test(coluna)) {
      problemas.push(`${onde}: item de select que o teste não sabe ler: "${item}"`);
      continue;
    }
    conferirColuna(tipos, tabela, coluna, `${onde} select`, problemas);
  }
}

function problemasDaConsulta(tipos: string, consulta: Consulta): string[] {
  const problemas: string[] = [];
  const { tabela } = consulta;
  if (!colunasDaTabela(tipos, tabela)) {
    return [`${tabela}: a tabela "${tabela}" não está em types.ts`];
  }
  for (const select of consulta.selects) conferirSelect(tipos, tabela, select, tabela, problemas);
  for (const f of consulta.filtros) conferirColuna(tipos, tabela, f.coluna, `${tabela} .${f.metodo}()`, problemas);
  for (const coluna of consulta.ordens) conferirColuna(tipos, tabela, coluna, `${tabela} .order()`, problemas);
  return problemas;
}

// --- Cliente admin falso ------------------------------------------------------------------------------

const METODOS_DE_FILTRO = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in', 'contains', 'not', 'filter'];

function bancoFalso(linhasPorTabela: Record<string, Linha[]>) {
  const consultas: Consulta[] = [];
  const from = (tabela: string) => {
    const consulta: Consulta = { tabela, selects: [], filtros: [], ordens: [] };
    consultas.push(consulta);
    let contar = false;
    let soContagem = false;
    let unico: 'maybeSingle' | 'single' | null = null;
    const q: Record<string, unknown> = {};

    for (const metodo of METODOS_DE_FILTRO) {
      q[metodo] = (coluna: string) => {
        consulta.filtros.push({ metodo, coluna });
        return q;
      };
    }
    q.match = (alvo: Record<string, unknown>) => {
      for (const coluna of Object.keys(alvo)) consulta.filtros.push({ metodo: 'match', coluna });
      return q;
    };
    q.or = (expressao: string) => {
      for (const coluna of colunasDoOr(expressao)) consulta.filtros.push({ metodo: 'or', coluna });
      return q;
    };
    q.select = (colunas?: string, opcoes?: { count?: string; head?: boolean }) => {
      consulta.selects.push(colunas ?? '*');
      if (opcoes?.count) contar = true;
      if (opcoes?.head) soContagem = true;
      return q;
    };
    q.order = (coluna: string) => {
      consulta.ordens.push(coluna);
      return q;
    };
    q.limit = () => q;
    q.range = () => q;
    q.maybeSingle = () => {
      unico = 'maybeSingle';
      return q;
    };
    q.single = () => {
      unico = 'single';
      return q;
    };
    q.then = (ok: (v: unknown) => unknown, falha: (e: unknown) => unknown) => {
      const linhas = linhasPorTabela[tabela] ?? [];
      let resposta: { data: unknown; count: number | null; error: Error | null };
      if (unico === 'single' && linhas.length === 0) {
        resposta = { data: null, count: null, error: new Error('nenhuma linha') };
      } else {
        let data: unknown = linhas;
        if (soContagem) data = null;
        else if (unico) data = linhas[0] ?? null;
        resposta = { data, count: contar ? linhas.length : null, error: null };
      }
      return Promise.resolve(resposta).then(ok, falha);
    };

    return new Proxy(q, {
      get(alvo, prop) {
        if (typeof prop === 'string' && !(prop in alvo)) {
          throw new Error(`O cliente falso do teste não conhece .${prop}(): acrescente em bancoFalso para o teste continuar conferindo as colunas.`);
        }
        return alvo[prop as string];
      },
    });
  };
  return { admin: { from }, consultas };
}

// O banco de mentira devolve linhas em TODAS as tabelas, inclusive nas duas que o contexto não deve ler
// (com as colunas inexistentes presentes): se alguém religar exercícios ou pagamento, o contexto muda e o teste acusa.
const LINHAS: Record<string, Linha[]> = {
  whatsapp_automacoes: [{ tom_voz: 'formal', prompt_extra: 'Instrução da clínica' }],
  profiles: [{ nome: 'Ana', sobrenome: 'Souza', especialidade: 'Fisioterapia' }],
  pacientes: [{ id: 'pac1', nome: 'Maria', sobrenome: 'Lima', telefone: '5511999990000', data_nascimento: '1990-05-05' }],
  myid_avaliacoes: [{
    myid_score_parcial: 62,
    dimensoes_preenchidas: { dor: { perda: 40 } },
    red_flags_detectadas: false,
    updated_at: '2026-11-01T12:00:00Z',
    status: 'concluido',
  }],
  agendamentos: [{ id: 'ag1', data_inicio: '2099-01-01T17:00:00Z', status: 'agendado' }],
  pacotes_sessoes: [{ total_sessoes: 10, sessoes_utilizadas: 4 }],
  paciente_missoes: [
    { id: 'm1', ativo: true, status: 'pendente' },
    { id: 'm2', ativo: true, status: 'pendente' },
    { id: 'm3', ativo: true, status: 'pendente' },
  ],
  pagamentos_paciente: [{ valor: 150, status: 'pendente', vencimento: '2026-11-20', created_at: '2026-11-01T12:00:00Z' }],
};

async function rodar(pacienteId: string | null) {
  const { montarContextoClinico } = (await import(/* @vite-ignore */ CAMINHO_DO_CONTEXTO)) as ModuloDoContexto;
  const { admin, consultas } = bancoFalso(LINHAS);
  const ctx = await montarContextoClinico(admin, 'ter1', pacienteId, '5511999990000', 'Contato');
  return { ctx, consultas };
}

// --- Testes -------------------------------------------------------------------------------------------

describe('montarContextoClinico: toda coluna consultada existe no banco', () => {
  it('select, filtros e ordem só usam colunas do Row da tabela em types.ts', async () => {
    const problemas: string[] = [];
    for (const pacienteId of ['pac1', null]) {
      const { consultas } = await rodar(pacienteId);
      for (const consulta of consultas) problemas.push(...problemasDaConsulta(TIPOS, consulta));
    }
    expect([...new Set(problemas)]).toEqual([]);
  });

  it('o teste não é vazio: as consultas de cada bloco do contexto passam pelo cliente falso', async () => {
    const { consultas } = await rodar('pac1');
    const tabelas = new Set(consultas.map((c) => c.tabela));
    for (const tabela of ['whatsapp_automacoes', 'profiles', 'pacientes', 'myid_avaliacoes', 'agendamentos', 'pacotes_sessoes']) {
      expect(tabelas.has(tabela), tabela).toBe(true);
    }
    const colunasLidas = consultas.flatMap((c) => [...c.selects, ...c.filtros.map((f) => f.coluna), ...c.ordens]);
    expect(colunasLidas.length).toBeGreaterThan(20);
  });
});

describe('montarContextoClinico: nenhum comportamento novo no contexto', () => {
  it('exercícios pendentes continuam 0 e pagamento pendente continua null, mesmo que as tabelas tenham linhas', async () => {
    const { ctx } = await rodar('pac1');
    expect(ctx.exercicios_pendentes).toBe(0);
    expect(ctx.pagamento_pendente).toBeNull();
  });

  it('sem paciente, o contexto sai com os mesmos valores iniciais e não consulta nada do paciente', async () => {
    const { ctx, consultas } = await rodar(null);
    expect(ctx.exercicios_pendentes).toBe(0);
    expect(ctx.pagamento_pendente).toBeNull();
    expect(ctx.myid).toBeNull();
    expect(ctx.proxima_sessao).toBeNull();
    expect(ctx.ultima_sessao).toBeNull();
    expect(ctx.pacote_ativo).toBeNull();
    expect(consultas.map((c) => c.tabela)).toEqual(['whatsapp_automacoes', 'profiles']);
  });

  it('o resto do contexto continua vindo das consultas válidas', async () => {
    const { ctx } = await rodar('pac1');
    expect(ctx.paciente).toMatchObject({ id: 'pac1', nome: 'Maria Lima', primeiro_nome: 'Maria' });
    expect(ctx.tom_voz).toBe('formal');
    expect(ctx.prompt_extra).toBe('Instrução da clínica');
    expect(ctx.profissional_nome).toBe('Ana Souza');
    expect(ctx.myid).toMatchObject({ score: 62, red_flags: false, dimensoes_criticas: [{ nome: 'dor', perda: 40 }] });
    expect(ctx.proxima_sessao).toMatchObject({ id: 'ag1', status: 'agendado' });
    expect(ctx.ultima_sessao).not.toBeNull();
    expect(ctx.pacote_ativo).toEqual({ total: 10, restantes: 6 });
  });
});

describe('verificador de colunas (o próprio teste não pode deixar passar defeito)', () => {
  const consulta = (tabela: string, over: Partial<Consulta> = {}): Consulta => ({ tabela, selects: [], filtros: [], ordens: [], ...over });

  it('aceita colunas reais, *, apelido, conversão e junção com colunas reais', () => {
    expect(problemasDaConsulta(TIPOS, consulta('pacientes', {
      selects: ['id, nome, sobrenome'],
      filtros: [{ metodo: 'eq', coluna: 'id' }],
      ordens: ['created_at'],
    }))).toEqual([]);
    expect(problemasDaConsulta(TIPOS, consulta('pacientes', { selects: ['*'] }))).toEqual([]);
    expect(problemasDaConsulta(TIPOS, consulta('pacientes', { selects: ['nome_completo:nome, id::text'] }))).toEqual([]);
    expect(problemasDaConsulta(TIPOS, consulta('agendamentos', { selects: ['id, pacientes!inner(id, nome)'] }))).toEqual([]);
  });

  it('pega coluna inexistente no select, no filtro e na ordem', () => {
    expect(problemasDaConsulta(TIPOS, consulta('paciente_missoes', { selects: ['id'], filtros: [{ metodo: 'eq', coluna: 'status' }] })))
      .toEqual(['paciente_missoes .eq(): a coluna "status" não existe em Row de "paciente_missoes" em types.ts']);
    expect(problemasDaConsulta(TIPOS, consulta('pagamentos_paciente', { selects: ['valor, vencimento'], ordens: ['vencimento'] })))
      .toEqual([
        'pagamentos_paciente select: a coluna "vencimento" não existe em Row de "pagamentos_paciente" em types.ts',
        'pagamentos_paciente .order(): a coluna "vencimento" não existe em Row de "pagamentos_paciente" em types.ts',
      ]);
  });

  it('pega coluna inexistente dentro de junção e de .or()', () => {
    expect(problemasDaConsulta(TIPOS, consulta('agendamentos', { selects: ['id, pacientes(id, coluna_fantasma)'] })))
      .toEqual(['agendamentos > pacientes select: a coluna "coluna_fantasma" não existe em Row de "pacientes" em types.ts']);
    expect(colunasDoOr('status.eq.a,and(vencimento.gt.1,valor.is.null)')).toEqual(['status', 'vencimento', 'valor']);
  });

  it('tabela fora do types.ts falha com mensagem clara', () => {
    expect(problemasDaConsulta(TIPOS, consulta('tabela_que_nao_existe', { selects: ['id'] })))
      .toEqual(['tabela_que_nao_existe: a tabela "tabela_que_nao_existe" não está em types.ts']);
  });

  it('método que o cliente falso não conhece falha em vez de passar em silêncio', () => {
    const { admin } = bancoFalso({});
    expect(() => (admin.from('pacientes') as unknown as { textSearch: () => void }).textSearch()).toThrow(/não conhece \.textSearch\(\)/);
  });
});
