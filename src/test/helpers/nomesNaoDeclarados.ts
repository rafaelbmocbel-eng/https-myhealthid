// Acha nomes não declarados (TS2304 "Cannot find name" e TS2552 "Did you mean") nas funções de borda do
// Supabase, que rodam no Deno e não são compiladas pelo tsc do app. Um `ReferenceError` só aparece em
// produção, no fim da execução (foi o caso do `estadoAnterior` em monitor-saude-geral): este verificador
// usa o próprio compilador do TypeScript, então pega qualquer nome solto, não só uma palavra conhecida.
import * as ts from 'typescript';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

export interface NomeNaoDeclarado {
  arquivo: string;
  linha: number;
  coluna: number;
  codigo: number;
  mensagem: string;
}

export const CODIGOS_NOME_NAO_DECLARADO: ReadonlySet<number> = new Set([2304, 2552]);

const ARQUIVO_GLOBAIS = '/__virtual__/globais-deno.d.ts';

// Diretiva de supressão esconde justamente o erro que se procura (`@ts-nocheck` zera o arquivo inteiro).
// Trocar `@ts-` por `@ts_` mantém o tamanho do texto, então linha e coluna continuam certas.
const DIRETIVA_DE_SUPRESSAO = /@ts-(expect-error|ignore|nocheck)/g;

// Só o que o runtime do Supabase injeta e o TypeScript não conhece. Módulos remotos (https:, npm:) viram
// `any` de propósito: não se baixa nada, e o que importa aqui são os nomes do próprio arquivo.
const GLOBAIS_DENO = `
declare const Deno: any;
declare const EdgeRuntime: any;
declare module "https://*";
declare module "http://*";
declare module "npm:*";
declare module "jsr:*";
declare module "node:*";
`;

// A biblioteca DOM faz o papel das APIs web do Deno (fetch, Response, URL, btoa, setTimeout...). Efeito
// colateral aceito: nomes que só existem em navegador (document, localStorage) não são acusados.
const OPCOES: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  allowImportingTsExtensions: true,
  noEmit: true,
  skipLibCheck: true,
  types: [],
};

export interface OpcoesVerificacao {
  raiz?: string;
  // Arquivos que existem só na memória (caminho absoluto -> conteúdo), também analisados.
  virtuais?: Record<string, string>;
}

export function acharNomesNaoDeclarados(arquivos: string[], opcoes: OpcoesVerificacao = {}): NomeNaoDeclarado[] {
  const raiz = resolve(opcoes.raiz ?? process.cwd());
  const virtuais: Record<string, string> = { [ARQUIVO_GLOBAIS]: GLOBAIS_DENO, ...opcoes.virtuais };
  const reais = arquivos.map((a) => (isAbsolute(a) ? a : join(raiz, a)));

  const host = ts.createCompilerHost(OPCOES, true);
  const fileExistsReal = host.fileExists.bind(host);
  const readFileReal = host.readFile.bind(host);
  host.fileExists = (f) => f in virtuais || fileExistsReal(f);
  host.readFile = (f) => {
    const texto = f in virtuais ? virtuais[f] : readFileReal(f);
    if (texto === undefined || f.endsWith('.d.ts')) return texto;
    return texto.replace(DIRETIVA_DE_SUPRESSAO, '@ts_$1');
  };

  const programa = ts.createProgram([ARQUIVO_GLOBAIS, ...Object.keys(opcoes.virtuais ?? {}), ...reais], OPCOES, host);

  const achados: NomeNaoDeclarado[] = [];
  for (const sf of programa.getSourceFiles()) {
    if (sf.fileName === ARQUIVO_GLOBAIS || programa.isSourceFileDefaultLibrary(sf)) continue;
    for (const d of programa.getSemanticDiagnostics(sf)) {
      if (!CODIGOS_NOME_NAO_DECLARADO.has(d.code) || d.start === undefined) continue;
      const { line, character } = sf.getLineAndCharacterOfPosition(d.start);
      achados.push({
        arquivo: sf.fileName.startsWith(raiz + sep) ? relative(raiz, sf.fileName).split(sep).join('/') : sf.fileName,
        linha: line + 1,
        coluna: character + 1,
        codigo: d.code,
        mensagem: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
      });
    }
  }
  return achados;
}

export function descrever(achado: NomeNaoDeclarado): string {
  return `${achado.arquivo}:${achado.linha}:${achado.coluna} TS${achado.codigo} ${achado.mensagem}`;
}
