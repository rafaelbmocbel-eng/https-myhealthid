import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Decisão do dono: só o profissional vê, nada sai do app e nada vai para o portal do cliente. Este teste lê o texto dos
// arquivos NOVOS da linha do tempo e do Resumo Completo e falha se aparecer algo que gravaria, mandaria ou publicaria
// o dado de saúde fora da tela. A lista de arquivos é lida da pasta: arquivo novo entra na conferência sozinho.
// O hook lê o banco e por isso pode importar o client do Supabase; a camada pura e as telas não podem. Mesmo no hook, só
// vale consulta de leitura (select/eq/in/or/not/order/limit/maybeSingle): nenhum método de escrita nem função do banco.

const RAIZ = join(__dirname, '..');
const PASTAS = ['lib/resumoClinico', 'components/resumoClinico'];
const ARQUIVOS_SOLTOS = ['hooks/useFontesClinicas.ts'];

interface Proibido {
  nome: string;
  padrao: RegExp;
  // Vale para a camada pura e as telas, não para o hook (que lê o banco).
  soForaDoHook?: boolean;
}

const PROIBIDOS: Proibido[] = [
  { nome: 'console.*', padrao: /\bconsole\s*\./ },
  { nome: 'localStorage', padrao: /\blocalStorage\b/ },
  { nome: 'sessionStorage', padrao: /\bsessionStorage\b/ },
  { nome: 'fetch(', padrao: /\bfetch\s*\(/ },
  { nome: 'XMLHttpRequest', padrao: /\bXMLHttpRequest\b/ },
  { nome: 'sendBeacon', padrao: /\bsendBeacon\b/ },
  { nome: '.insert(', padrao: /\.\s*insert\s*\(/ },
  { nome: '.update(', padrao: /\.\s*update\s*\(/ },
  { nome: '.upsert(', padrao: /\.\s*upsert\s*\(/ },
  { nome: '.delete(', padrao: /\.\s*delete\s*\(/ },
  { nome: '.rpc(', padrao: /\.\s*rpc\s*\(/ },
  { nome: 'functions.invoke', padrao: /\bfunctions\s*\.\s*invoke\b/ },
  { nome: 'window.open', padrao: /\bwindow\s*\.\s*open\b/ },
  { nome: 'document.cookie', padrao: /\bdocument\s*\.\s*cookie\b/ },
  { nome: 'indexedDB', padrao: /\bindexedDB\b/ },
  { nome: 'new Image(', padrao: /\bnew\s+Image\s*\(/ },
  { nome: 'WebSocket', padrao: /\bWebSocket\b/ },
  { nome: 'import do client do Supabase', padrao: /['"`][^'"`\n]*integrations\/supabase\/client['"`]/, soForaDoHook: true },
  { nome: 'import de src/pages/paciente', padrao: /['"`][^'"`\n]*\/pages\/paciente(?:\/[^'"`\n]*)?['"`]/ },
  { nome: 'rota /paciente do portal', padrao: /['"`]\/paciente(?![a-zA-Z])/ },
  { nome: 'rota /portaldocliente do portal', padrao: /['"`]\/portaldocliente/ },
];

const achadosProibidos = (texto: string, doHook = false): string[] =>
  PROIBIDOS.filter((p) => !(doHook && p.soForaDoHook) && p.padrao.test(texto)).map((p) => p.nome);

function arquivosDaPasta(pasta: string): string[] {
  return readdirSync(join(RAIZ, pasta), { withFileTypes: true })
    .filter((e) => e.isFile() && /\.(ts|tsx)$/.test(e.name))
    .map((e) => `${pasta}/${e.name}`);
}

const ARQUIVOS = [...PASTAS.flatMap(arquivosDaPasta), ...ARQUIVOS_SOLTOS].sort();

describe('privacidade: os arquivos novos não gravam, não mandam nada para fora e não tocam no portal do cliente', () => {
  it('a conferência cobre os arquivos esperados (não passa vazia)', () => {
    expect(ARQUIVOS).toEqual(expect.arrayContaining([
      'components/resumoClinico/LinhaDoTempoClinica.tsx',
      'components/resumoClinico/ResumoClinicoVisoes.tsx',
      'components/resumoClinico/ResumoCompleto.tsx',
      'hooks/useFontesClinicas.ts',
      'lib/resumoClinico/leitura.ts',
      'lib/resumoClinico/marcos.ts',
      'lib/resumoClinico/resumoCompleto.ts',
    ]));
    expect(ARQUIVOS.length).toBeGreaterThanOrEqual(11);
  });

  it.each(ARQUIVOS)('%s não tem console, storage ou cookie do navegador, envio de rede, escrita no banco, função do banco nem ligação com o portal', (arquivo) => {
    const texto = readFileSync(join(RAIZ, arquivo), 'utf8');
    expect(texto.length, arquivo).toBeGreaterThan(0);
    expect(achadosProibidos(texto, ARQUIVOS_SOLTOS.includes(arquivo)), arquivo).toEqual([]);
  });

  it('só o hook pode importar o client do Supabase: a camada pura e as telas não', () => {
    const importam = ARQUIVOS.filter((a) => /integrations\/supabase\/client/.test(readFileSync(join(RAIZ, a), 'utf8')));
    expect(importam).toEqual(['hooks/useFontesClinicas.ts']);
  });
});

describe('privacidade: o detector reconhece cada padrão proibido (e não acusa código normal)', () => {
  it.each([
    ['console.log(dados)', 'console.*'],
    ['console . error(e)', 'console.*'],
    ['localStorage.setItem("a", "b")', 'localStorage'],
    ['window.localStorage', 'localStorage'],
    ['sessionStorage.getItem("a")', 'sessionStorage'],
    ['await fetch("https://x.com", { body })', 'fetch('],
    ['fetch (url)', 'fetch('],
    ['new XMLHttpRequest()', 'XMLHttpRequest'],
    ['navigator.sendBeacon("/x", dados)', 'sendBeacon'],
    ["import X from '@/pages/paciente/PacienteDashboard';", 'import de src/pages/paciente'],
    ["import X from '../../pages/paciente/PacienteSaude';", 'import de src/pages/paciente'],
    ["const X = lazy(() => import('@/pages/paciente/PacienteChat'))", 'import de src/pages/paciente'],
    ["navigate('/paciente/dashboard')", 'rota /paciente do portal'],
    ['<Link to="/paciente/saude">', 'rota /paciente do portal'],
    ["window.location.href = '/paciente'", 'rota /paciente do portal'],
    ["navigate('/portaldocliente/abc')", 'rota /portaldocliente do portal'],
    ["await supabase.from('notas_prontuario').insert({ texto })", '.insert('],
    ["supabase\n  .from('x')\n  .insert([a])", '.insert('],
    ["banco.from('x').update({ ativo: false }).eq('id', 1)", '.update('],
    ["banco.from('x').upsert(linha)", '.upsert('],
    ["banco.from('x').delete().eq('id', 1)", '.delete('],
    ["lixeira.delete(id)", '.delete('],
    ["await supabase.rpc('cassi_juntar_financeiro_clientes', args)", '.rpc('],
    ["supabase.rpc ('x')", '.rpc('],
    ["await supabase.functions.invoke('resumo-30s', { body })", 'functions.invoke'],
    ["supabase.functions\n  .invoke('x')", 'functions.invoke'],
    ["window.open('https://x.com')", 'window.open'],
    ["const abrir = window.open;", 'window.open'],
    ['document.cookie = "a=b"', 'document.cookie'],
    ['const lido = document . cookie', 'document.cookie'],
    ["indexedDB.open('db')", 'indexedDB'],
    ["new Image().src = 'https://x.com/p?d=' + dados", 'new Image('],
    ["new Image (1, 1)", 'new Image('],
    ["new WebSocket('wss://x.com')", 'WebSocket'],
    ["import { supabase } from '@/integrations/supabase/client';", 'import do client do Supabase'],
    ['import { supabase } from "../../integrations/supabase/client";', 'import do client do Supabase'],
    ["const { supabase } = await import('@/integrations/supabase/client');", 'import do client do Supabase'],
  ])('%s', (codigo, esperado) => {
    expect(achadosProibidos(codigo)).toContain(esperado);
  });

  it('no hook, o import do client do Supabase é permitido, mas a escrita continua proibida', () => {
    expect(achadosProibidos("import { supabase } from '@/integrations/supabase/client';", true)).toEqual([]);
    expect(achadosProibidos("banco.from('x').insert(a)", true)).toEqual(['.insert(']);
    expect(achadosProibidos("banco.from('x').rpc('f')", true)).toEqual(['.rpc(']);
    expect(achadosProibidos("supabase.functions.invoke('f')", true)).toEqual(['functions.invoke']);
  });

  it.each([
    'const fetchado = 1;',
    'const buscarFontes = async () => lerFontesClinicas(id, prof);',
    "navigate('/pacientes/123')",
    "import { cn } from '@/lib/utils';",
    "import AvisoDeFalhas from './AvisoDeFalhas';",
    'const consoleDeAvisos = 3;',
    "const rotulo = 'Sem data';",
    'estado local: useState(false)',
    // A consulta de leitura do hook é permitida.
    "banco.from(tabela).select(colunas).eq('paciente_id', id).in('tipo', tipos).or(filtro).not('a', 'is', null).order('b', { ascending: false }).limit(50).maybeSingle()",
    "const atualizado = linha.updated_at;",
    'const doUpdate = onUpdate(x); const reinserir = inserir(x);',
    'const apagar = removerDaLista(itens, id); const deletado = true;',
    'const rpcNome = "x"; const idRpc = 1;',
    'const janela = windowed(items); const abrirJanela = openWindow();',
    'const cookieJar = 1; const documentCookies = [];',
    'const imagem = new ImageData(1, 1);',
    "import { supabase } from '@/integrations/supabase/types';",
  ])('não acusa: %s', (codigo) => {
    expect(achadosProibidos(codigo)).toEqual([]);
  });
});
