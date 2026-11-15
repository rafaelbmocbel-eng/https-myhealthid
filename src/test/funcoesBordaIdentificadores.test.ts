// Guarda da CLASSE de defeito "nome usado e nunca declarado" nos monitores (guardiões) do Supabase.
// monitor-saude-geral devolvia 500 ao fim de cada execução porque o retorno usava `estadoAnterior`, que a
// função nunca declarou (ReferenceError em produção). O compilador do TypeScript acusa isso na hora; o
// tsc do app não olha supabase/functions, então este teste faz a checagem.
import { beforeAll, describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { acharNomesNaoDeclarados, descrever, type NomeNaoDeclarado } from './helpers/nomesNaoDeclarados';

const RAIZ = resolve(__dirname, '../..');
const PASTA_FUNCOES = resolve(RAIZ, 'supabase/functions');

const monitores = readdirSync(PASTA_FUNCOES, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name.startsWith('monitor-'))
  .map((d) => `supabase/functions/${d.name}/index.ts`)
  .sort();

const CANARIO_COM_DEFEITO = '/__virtual__/canario-com-defeito.ts';
const CANARIO_LIMPO = '/__virtual__/canario-limpo.ts';
const CANARIO_COM_IGNORE = '/__virtual__/canario-com-ignore.ts';
const CANARIO_COM_NOCHECK = '/__virtual__/canario-com-nocheck.ts';

const canarios = {
  // Mesmo formato do defeito original: o valor existe com outro nome (prev1) e o retorno usa um nome solto.
  [CANARIO_COM_DEFEITO]: `
    const prev1: boolean | null = null;
    export const a = { estado_anterior: estadoAnterior };
    export const b = prev1 === null ? 0 : nomeQueNaoExiste;
    const estadoCerto = 1;
    export const c = estadoCert;
  `,
  // Tudo o que as funções de borda usam de verdade tem de passar sem falso alarme.
  [CANARIO_LIMPO]: `
    import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
    import { serve } from "npm:fake-serve@1";
    const admin = createClient(Deno.env.get("URL")!, Deno.env.get("KEY")!);
    Deno.serve(async (req: Request) => {
      await new Promise((r) => setTimeout(r, 1));
      const r = await fetch("https://exemplo.com", { signal: AbortSignal.timeout(1) });
      return new Response(JSON.stringify({ ok: r.ok, b: btoa("x"), d: new Date().toISOString(), admin, serve }), { headers: new Headers() });
    });
    EdgeRuntime.waitUntil(Promise.resolve());
  `,
  // Diretivas de supressão não podem esconder o defeito.
  [CANARIO_COM_IGNORE]: `
    // @ts-expect-error -- motivo qualquer
    export const a = escondidoPorExpectError;
    // @ts-ignore
    export const b = escondidoPorIgnore;
  `,
  [CANARIO_COM_NOCHECK]: `// @ts-nocheck
    export const a = escondidoPorNocheck;
  `,
};

describe('funções de borda: nomes não declarados', () => {
  let achados: NomeNaoDeclarado[] = [];

  beforeAll(() => {
    achados = acharNomesNaoDeclarados(monitores, { raiz: RAIZ, virtuais: canarios });
  }, 120_000);

  const doArquivo = (arquivo: string) => achados.filter((a) => a.arquivo === arquivo).map(descrever);

  it('encontra os quatro monitores (o teste não pode passar olhando uma lista vazia)', () => {
    expect(monitores).toEqual([
      'supabase/functions/monitor-audio-saude/index.ts',
      'supabase/functions/monitor-ia-uso/index.ts',
      'supabase/functions/monitor-saude-geral/index.ts',
      'supabase/functions/monitor-seguranca/index.ts',
    ]);
  });

  it.each(monitores)('%s não usa nome sem declaração', (arquivo) => {
    expect(doArquivo(arquivo)).toEqual([]);
  });

  it('o verificador enxerga o defeito: nome solto no retorno (TS2304) e erro de digitação (TS2552)', () => {
    const doCanario = achados.filter((a) => a.arquivo === CANARIO_COM_DEFEITO);
    expect(doCanario.map((a) => [a.codigo, a.mensagem.match(/'([^']+)'/)?.[1]])).toEqual([
      [2304, 'estadoAnterior'],
      [2304, 'nomeQueNaoExiste'],
      [2552, 'estadoCert'],
    ]);
  });

  it('o verificador não se deixa enganar por @ts-expect-error, @ts-ignore nem @ts-nocheck', () => {
    expect(doArquivo(CANARIO_COM_IGNORE)).toEqual([
      `${CANARIO_COM_IGNORE}:3:22 TS2304 Cannot find name 'escondidoPorExpectError'.`,
      `${CANARIO_COM_IGNORE}:5:22 TS2304 Cannot find name 'escondidoPorIgnore'.`,
    ]);
    expect(doArquivo(CANARIO_COM_NOCHECK)).toEqual([
      `${CANARIO_COM_NOCHECK}:2:22 TS2304 Cannot find name 'escondidoPorNocheck'.`,
    ]);
  });

  it('o verificador não dá falso alarme com Deno, fetch, Response e imports remotos', () => {
    expect(doArquivo(CANARIO_LIMPO)).toEqual([]);
  });
});
