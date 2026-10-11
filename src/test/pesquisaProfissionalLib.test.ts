import { describe, expect, it } from 'vitest';
import {
  AVISO_INDICIO, INFO_NIVEL, NIVEIS_INDICIO, avisoConselhoDiferente, conselhoEsperado, conselhoNoRegistro, descreverConsulta, descreverErro,
  falhaDeConsulta, formatarDataHoraBR, indexarResumos, lerAchado, lerAchados, lerConsultaUsada, lerPesquisaProfissional,
  lerRespostaPesquisa, lerResumosPesquisas, linkBuscaConferencia, mensagemErroPesquisa, nomeParaBusca, textoDaFalha,
  tituloErroPesquisa, urlHttpsSegura,
} from '@/lib/pesquisaProfissional';

const achadoOk = {
  categoria: 'registro_conselho',
  texto: 'Registro ativo no conselho',
  trecho: 'ANA SOUZA - CRN3 12345 - Ativo',
  fonte_url: 'https://www.cfn.org.br/consulta',
  fonte_titulo: 'Conselho Federal de Nutricionistas',
};

function pesquisa(extra: Record<string, unknown> = {}) {
  return {
    id: 'p-1', pesquisado_em: '2026-10-11T17:32:00Z', nivel_indicio: 'compativel', resumo: 'Registro encontrado.',
    achados: [achadoOk], consulta_usada: { nome: 'Ana Souza', registro: 'CRN 12345', profissao: 'nutricionista', conselho_esperado: 'CRN' },
    modelo: 'gemini-2.5-flash', erro: null,
    ...extra,
  };
}

describe('textos fixos do contrato', () => {
  it('o aviso de indício é o texto combinado', () => {
    expect(AVISO_INDICIO).toBe('Isto é um indício encontrado na internet. Pode estar incompleto ou errado. A verificação é decisão sua.');
  });

  it('os cinco níveis têm rótulo, descrição e variante', () => {
    expect(NIVEIS_INDICIO).toHaveLength(5);
    expect(NIVEIS_INDICIO.map((n) => INFO_NIVEL[n].rotulo)).toEqual([
      'Compatível', 'Inconclusivo', 'Divergente', 'Não encontrado', 'Não consegui consultar',
    ]);
    for (const n of NIVEIS_INDICIO) expect(INFO_NIVEL[n].descricao.length).toBeGreaterThan(10);
  });
});

describe('urlHttpsSegura', () => {
  it('aceita https e normaliza', () => {
    expect(urlHttpsSegura(' https://www.crn3.org.br/consulta?x=1 ')).toBe('https://www.crn3.org.br/consulta?x=1');
  });

  it.each([
    ['http://crn3.org.br'],
    ['javascript:alert(1)'],
    ['data:text/html,<script>1</script>'],
    ['//crn3.org.br'],
    ['https://user:senha@crn3.org.br'],
    ['https://'],
    ['crn3.org.br'],
    [''],
    [null],
    [42],
  ])('recusa %s', (v) => {
    expect(urlHttpsSegura(v)).toBeNull();
  });

  it('recusa URL gigante', () => {
    expect(urlHttpsSegura(`https://exemplo.com/${'a'.repeat(3000)}`)).toBeNull();
  });
});

describe('lerAchado / lerAchados', () => {
  it('lê um achado válido', () => {
    expect(lerAchado(achadoOk)).toEqual({
      categoria: 'registro_conselho',
      texto: 'Registro ativo no conselho',
      trecho: 'ANA SOUZA - CRN3 12345 - Ativo',
      fonteUrl: 'https://www.cfn.org.br/consulta',
      fonteTitulo: 'Conselho Federal de Nutricionistas',
    });
  });

  it('sem título usa o domínio da fonte, sem www', () => {
    expect(lerAchado({ ...achadoOk, fonte_titulo: '' })?.fonteTitulo).toBe('cfn.org.br');
  });

  it('descarta achado sem trecho, sem fonte https ou com categoria fora da lista', () => {
    expect(lerAchado({ ...achadoOk, trecho: '   ' })).toBeNull();
    expect(lerAchado({ ...achadoOk, trecho: undefined })).toBeNull();
    expect(lerAchado({ ...achadoOk, fonte_url: 'http://cfn.org.br' })).toBeNull();
    expect(lerAchado({ ...achadoOk, fonte_url: 'javascript:alert(1)' })).toBeNull();
    expect(lerAchado({ ...achadoOk, fonte_url: null })).toBeNull();
    expect(lerAchado({ ...achadoOk, categoria: 'vida_pessoal' })).toBeNull();
    expect(lerAchado({ ...achadoOk, categoria: 'saude' })).toBeNull();
    expect(lerAchado('texto solto')).toBeNull();
    expect(lerAchado(null)).toBeNull();
  });

  it('aceita as cinco categorias permitidas', () => {
    for (const categoria of ['registro_conselho', 'situacao_registro', 'formacao', 'atuacao_profissional', 'perfil_publico']) {
      expect(lerAchado({ ...achadoOk, categoria })?.categoria).toBe(categoria);
    }
  });

  it('lerAchados ignora o que não é lista e descarta só os inválidos', () => {
    expect(lerAchados(null)).toEqual([]);
    expect(lerAchados('x')).toEqual([]);
    expect(lerAchados({})).toEqual([]);
    const lidos = lerAchados([achadoOk, { ...achadoOk, trecho: '' }, { ...achadoOk, categoria: 'formacao' }]);
    expect(lidos.map((a) => a.categoria)).toEqual(['registro_conselho', 'formacao']);
  });

  it('trecho muito longo é cortado para não estourar a tela', () => {
    const a = lerAchado({ ...achadoOk, trecho: 'x'.repeat(2000) });
    expect(a?.trecho.length).toBeLessThanOrEqual(600);
    expect(a?.trecho.endsWith('…')).toBe(true);
  });
});

describe('lerConsultaUsada', () => {
  it('lê só nome, registro, profissão e conselho', () => {
    const c = lerConsultaUsada({
      nome: 'Ana Souza', registro: 'CRN 12345', profissao: 'nutricionista', conselho_esperado: 'CRN',
      email: 'ana@exemplo.com', telefone: '11999990000',
    });
    expect(c).toEqual({ nome: 'Ana Souza', registro: 'CRN 12345', profissao: 'nutricionista', conselho: 'CRN', local: null });
    expect(JSON.stringify(c)).not.toMatch(/ana@exemplo|11999990000/);
  });

  it('aceita apelidos das chaves e devolve null quando não há nada', () => {
    expect(lerConsultaUsada({ nome_completo: 'Ana', registro_profissional: 'CRN 1', perfil_profissional: 'nutricionista', conselho: 'CRN' }))
      .toEqual({ nome: 'Ana', registro: 'CRN 1', profissao: 'nutricionista', conselho: 'CRN', local: null });
    expect(lerConsultaUsada({ email: 'ana@exemplo.com' })).toBeNull();
    expect(lerConsultaUsada(null)).toBeNull();
  });

  it('cidade e UF da clínica só valem juntas', () => {
    expect(lerConsultaUsada({ nome: 'Ana', cidade: 'Campinas', uf: 'SP' })?.local).toBe('Campinas/SP');
    expect(lerConsultaUsada({ nome: 'Ana', cidade: 'Campinas' })?.local).toBeNull();
    expect(lerConsultaUsada({ nome: 'Ana', uf: 'SP' })?.local).toBeNull();
  });

  it('descreverConsulta junta o que existe', () => {
    expect(descreverConsulta({ nome: 'Ana Souza', registro: 'CRN 12345', profissao: 'nutricionista', conselho: 'CRN', local: 'Campinas/SP' }))
      .toBe('Ana Souza · nutricionista · CRN 12345 · Campinas/SP');
    expect(descreverConsulta(null)).toBe('');
  });
});

describe('lerPesquisaProfissional', () => {
  it('lê a pesquisa completa', () => {
    const p = lerPesquisaProfissional(pesquisa());
    expect(p).toMatchObject({
      id: 'p-1', pesquisadoEm: '2026-10-11T17:32:00Z', nivel: 'compativel', rebaixado: false, resumo: 'Registro encontrado.',
      modelo: 'gemini-2.5-flash', erro: null,
    });
    expect(p?.achados).toHaveLength(1);
    expect(p?.consulta?.conselho).toBe('CRN');
  });

  it('nível desconhecido ou formato estranho invalida a pesquisa', () => {
    expect(lerPesquisaProfissional(pesquisa({ nivel_indicio: 'verificado' }))).toBeNull();
    expect(lerPesquisaProfissional(pesquisa({ nivel_indicio: undefined }))).toBeNull();
    expect(lerPesquisaProfissional(null)).toBeNull();
    expect(lerPesquisaProfissional([])).toBeNull();
    expect(lerPesquisaProfissional('compativel')).toBeNull();
  });

  it('"compatível" sem nenhum achado de registro exibível cai para inconclusivo e marca o rebaixamento', () => {
    const semAchados = lerPesquisaProfissional(pesquisa({ achados: [] }));
    expect(semAchados).toMatchObject({ nivel: 'inconclusivo', rebaixado: true });

    const soFormacao = lerPesquisaProfissional(pesquisa({ achados: [{ ...achadoOk, categoria: 'formacao' }] }));
    expect(soFormacao).toMatchObject({ nivel: 'inconclusivo', rebaixado: true });

    const registroSemFonteValida = lerPesquisaProfissional(pesquisa({ achados: [{ ...achadoOk, fonte_url: 'http://x.com' }] }));
    expect(registroSemFonteValida).toMatchObject({ nivel: 'inconclusivo', rebaixado: true });
  });

  it('os outros níveis passam como o servidor calculou', () => {
    for (const nivel of ['inconclusivo', 'divergente', 'nao_encontrado', 'nao_consultavel']) {
      expect(lerPesquisaProfissional(pesquisa({ nivel_indicio: nivel, achados: [] }))).toMatchObject({ nivel, rebaixado: false });
    }
  });

  it('achados fora do formato viram lista vazia, sem quebrar', () => {
    expect(lerPesquisaProfissional(pesquisa({ nivel_indicio: 'nao_encontrado', achados: 'lixo' }))?.achados).toEqual([]);
  });

  it('guarda o erro registrado da falha', () => {
    const p = lerPesquisaProfissional(pesquisa({ nivel_indicio: 'nao_consultavel', achados: [], erro: 'busca bloqueada' }));
    expect(p).toMatchObject({ nivel: 'nao_consultavel', erro: 'busca bloqueada' });
  });
});

describe('resumos da lista', () => {
  it('lê o array e descarta linhas inválidas', () => {
    const lista = lerResumosPesquisas([
      { user_id: 'u-1', pesquisado_em: '2026-10-11T10:00:00Z', nivel_indicio: 'divergente' },
      { user_id: '', nivel_indicio: 'compativel' },
      { user_id: 'u-3', nivel_indicio: 'verificado' },
      'lixo',
      null,
    ]);
    expect(lista).toEqual([{ userId: 'u-1', pesquisadoEm: '2026-10-11T10:00:00Z', nivel: 'divergente' }]);
    expect(lerResumosPesquisas(null)).toEqual([]);
    expect(lerResumosPesquisas({})).toEqual([]);
  });

  it('indexa por profissional e fica com o mais recente se o banco repetir', () => {
    const mapa = indexarResumos([
      { userId: 'u-1', pesquisadoEm: '2026-10-10T10:00:00Z', nivel: 'inconclusivo' },
      { userId: 'u-1', pesquisadoEm: '2026-10-11T10:00:00Z', nivel: 'compativel' },
      { userId: 'u-2', pesquisadoEm: null, nivel: 'nao_encontrado' },
    ]);
    expect(mapa.size).toBe(2);
    expect(mapa.get('u-1')?.nivel).toBe('compativel');
    expect(mapa.get('u-2')?.nivel).toBe('nao_encontrado');
  });
});

describe('resposta da edge', () => {
  it('ok:true com pesquisa válida', () => {
    const r = lerRespostaPesquisa({ ok: true, pesquisa: pesquisa() });
    expect(r?.ok).toBe(true);
    expect(r && r.ok === true ? r.pesquisa.nivel : null).toBe('compativel');
  });

  it('ok:true com pesquisa ilegível não passa como sucesso', () => {
    expect(lerRespostaPesquisa({ ok: true, pesquisa: { nivel_indicio: 'xyz' } })).toBeNull();
    expect(lerRespostaPesquisa({ ok: true })).toBeNull();
  });

  it('ok:false traz código e mensagem; aceita motivo/error como apelidos', () => {
    expect(lerRespostaPesquisa({ ok: false, codigo: 'limite_diario', mensagem: 'Limite do dia atingido.' }))
      .toEqual({ ok: false, codigo: 'limite_diario', mensagem: 'Limite do dia atingido.', pesquisa: null });
    expect(lerRespostaPesquisa({ ok: false, motivo: 'falha_busca' })).toEqual({ ok: false, codigo: 'falha_busca', mensagem: null, pesquisa: null });
    expect(lerRespostaPesquisa({ error: 'Não autorizado' })).toEqual({ ok: false, codigo: null, mensagem: 'Não autorizado', pesquisa: null });
  });

  it('falha da busca traz a tentativa gravada em `pesquisa`', () => {
    const r = lerRespostaPesquisa({
      ok: false, codigo: 'falha_busca', mensagem: 'Não consegui consultar automaticamente.',
      pesquisa: pesquisa({ nivel_indicio: 'nao_consultavel', achados: [], erro: 'ia_http_500' }),
    });
    expect(r && r.ok === false ? r.pesquisa : undefined).toMatchObject({ nivel: 'nao_consultavel', erro: 'ia_http_500' });
  });

  it('formato irreconhecível devolve null', () => {
    expect(lerRespostaPesquisa(null)).toBeNull();
    expect(lerRespostaPesquisa('ok')).toBeNull();
    expect(lerRespostaPesquisa({})).toBeNull();
    expect(lerRespostaPesquisa([])).toBeNull();
  });
});

describe('mensagens de erro', () => {
  it('permissão tem texto fixo, mesmo que o servidor diga outra coisa', () => {
    expect(mensagemErroPesquisa('nao_autorizado', 'forbidden')).toBe('Apenas o administrador MyHealthID pode pesquisar profissionais.');
    expect(mensagemErroPesquisa('sem_permissao', 'forbidden')).toBe('Apenas o administrador MyHealthID pode pesquisar profissionais.');
  });

  it('descreverErro traduz o código de reserva sem fim e deixa os outros como vieram', () => {
    expect(descreverErro('em_andamento')).toMatch(/não terminou/);
    expect(descreverErro('ia_http_500')).toBe('ia_http_500');
  });

  it('o compatível avisa que qualquer pessoa pode publicar a página', () => {
    expect(INFO_NIVEL.compativel.descricao).toMatch(/Qualquer pessoa pode publicar/);
  });

  it('textoDaFalha tira a frase que já é o título e mantém o resto', () => {
    expect(textoDaFalha('Não consegui consultar automaticamente. A busca falhou ou foi bloqueada. Use o atalho.'))
      .toBe('A busca falhou ou foi bloqueada. Use o atalho.');
    expect(textoDaFalha('Não consegui consultar automaticamente.')).toMatch(/captcha/);
    expect(textoDaFalha(null)).toMatch(/captcha/);
    expect(textoDaFalha('A busca achou páginas, mas não foi possível lê-las.')).toBe('A busca achou páginas, mas não foi possível lê-las.');
  });

  it('usa a mensagem do servidor e, sem ela, o padrão do código', () => {
    expect(mensagemErroPesquisa('limite_diario', 'Limite do dia.')).toBe('Limite do dia.');
    expect(mensagemErroPesquisa('limite_profissional', null)).toMatch(/pesquisado há pouco/);
    expect(mensagemErroPesquisa('limite_diario', null)).toMatch(/limite diário/);
    expect(mensagemErroPesquisa('falha_busca', null)).toMatch(/Não consegui consultar automaticamente/);
    expect(mensagemErroPesquisa('indisponivel', null)).toMatch(/Tente de novo em instantes/);
    expect(mensagemErroPesquisa('qualquer', null)).toMatch(/Não consegui concluir a pesquisa/);
    expect(mensagemErroPesquisa(null, null)).toMatch(/Tente de novo/);
  });

  it('só falha de consulta pede destaque do atalho; título acompanha o código', () => {
    expect(falhaDeConsulta('falha_busca')).toBe(true);
    expect(falhaDeConsulta('tempo_esgotado')).toBe(true);
    expect(falhaDeConsulta('limite_diario')).toBe(false);
    expect(falhaDeConsulta(null)).toBe(false);
    expect(tituloErroPesquisa('falha_busca')).toBe('Não consegui consultar automaticamente');
    expect(tituloErroPesquisa('limite_profissional')).toBe('Pesquisa não feita agora');
    expect(tituloErroPesquisa(null)).toBe('Não consegui pesquisar');
  });
});

describe('conselho esperado por profissão', () => {
  it.each([
    ['fisioterapeuta', 'CREFITO'],
    ['terapeuta_ocupacional', 'CREFITO'],
    ['educador_fisico', 'CREF'],
    ['nutricionista', 'CRN'],
    ['medico', 'CRM'],
    ['psicologo', 'CRP'],
    ['dentista', 'CRO'],
  ])('%s → %s', (perfil, sigla) => {
    const c = conselhoEsperado(perfil);
    expect(c?.sigla).toBe(sigla);
    expect(c?.nome).toMatch(/^Conselho Regional de /);
  });

  it('perfil ausente ou desconhecido não inventa conselho', () => {
    expect(conselhoEsperado(null)).toBeNull();
    expect(conselhoEsperado(undefined)).toBeNull();
    expect(conselhoEsperado('super_admin')).toBeNull();
    expect(conselhoEsperado('astronauta')).toBeNull();
  });

  it('detecta a sigla escrita no registro', () => {
    expect(conselhoNoRegistro('CRN-3 12345')).toBe('CRN');
    expect(conselhoNoRegistro('CRN3 12345')).toBe('CRN');
    expect(conselhoNoRegistro('crefito-3/123456-F')).toBe('CREFITO');
    expect(conselhoNoRegistro('CREF 012345-G/SP')).toBe('CREF');
    expect(conselhoNoRegistro('CRM/SP 123456')).toBe('CRM');
    expect(conselhoNoRegistro('12345')).toBeNull();
    expect(conselhoNoRegistro('CRNX 12')).toBeNull();
    expect(conselhoNoRegistro(null)).toBeNull();
  });

  it('avisa só quando o registro cita outro conselho', () => {
    expect(avisoConselhoDiferente('nutricionista', 'CREF 123')).toMatch(/cita o CREF.*Nutricionista.*CRN/);
    expect(avisoConselhoDiferente('nutricionista', 'CRN 123')).toBeNull();
    expect(avisoConselhoDiferente('nutricionista', '12345')).toBeNull();
    expect(avisoConselhoDiferente(null, 'CRN 123')).toBeNull();
    expect(avisoConselhoDiferente('fisioterapeuta', 'CREFITO-3 55')).toBeNull();
  });
});

describe('nomeParaBusca', () => {
  it('usa o nome real', () => {
    expect(nomeParaBusca('Ana Souza', 'ana@exemplo.com')).toBe('Ana Souza');
  });

  it('nunca usa o e-mail quando o cadastro não tem nome', () => {
    expect(nomeParaBusca('ana@exemplo.com', 'ana@exemplo.com')).toBe('');
    expect(nomeParaBusca('Ana@Exemplo.com', 'ana@exemplo.com')).toBe('');
    expect(nomeParaBusca('Sem nome', null)).toBe('');
    expect(nomeParaBusca('', 'ana@exemplo.com')).toBe('');
    expect(nomeParaBusca(null, null)).toBe('');
    expect(nomeParaBusca('qualquer@coisa.com', null)).toBe('');
  });
});

describe('linkBuscaConferencia', () => {
  it('monta a busca com nome, profissão, registro e "conselho", codificada', () => {
    const url = linkBuscaConferencia({ nome: 'Ana Souza', perfil: 'nutricionista', registro: 'CRN 12345' });
    expect(url).toBe('https://www.google.com/search?q=Ana+Souza+nutricionista+CRN+12345+conselho');
  });

  it('codifica acentos, barras e símbolos', () => {
    const url = linkBuscaConferencia({ nome: 'José D\'Ávila & Filho', perfil: 'educador_fisico', registro: 'CREF 012345-G/SP' });
    expect(url).toBe('https://www.google.com/search?q=Jos%C3%A9+D\'%C3%81vila+%26+Filho+educador+f%C3%ADsico+CREF+012345-G%2FSP+conselho');
    const q = new URL(url as string).searchParams.get('q');
    expect(q).toBe('José D\'Ávila & Filho educador físico CREF 012345-G/SP conselho');
  });

  it('um "+" no registro não vira espaço', () => {
    const url = linkBuscaConferencia({ nome: 'Ana', perfil: null, registro: 'A+B' }) as string;
    expect(new URL(url).searchParams.get('q')).toBe('Ana A+B conselho');
  });

  it('perfil sem conselho conhecido segue sem a profissão', () => {
    const url = linkBuscaConferencia({ nome: 'Ana Souza', perfil: 'super_admin', registro: 'X 1' }) as string;
    expect(new URL(url).searchParams.get('q')).toBe('Ana Souza X 1 conselho');
  });

  it('sem nome e sem registro não há o que buscar', () => {
    expect(linkBuscaConferencia({ nome: '', perfil: 'medico', registro: null })).toBeNull();
    expect(linkBuscaConferencia({ nome: '  ', perfil: 'medico', registro: '  ' })).toBeNull();
  });

  it('só com o registro ainda monta a busca', () => {
    const url = linkBuscaConferencia({ nome: '', perfil: 'medico', registro: 'CRM/SP 123' }) as string;
    expect(new URL(url).searchParams.get('q')).toBe('médico CRM/SP 123 conselho');
  });

  it('é sempre https do Google, nunca uma URL de conselho', () => {
    const url = linkBuscaConferencia({ nome: 'Ana', perfil: 'fisioterapeuta', registro: 'CREFITO 1' }) as string;
    expect(new URL(url).origin).toBe('https://www.google.com');
    expect(new URL(url).pathname).toBe('/search');
  });
});

describe('formatarDataHoraBR', () => {
  it('formata no fuso de Brasília', () => {
    expect(formatarDataHoraBR('2026-10-11T17:32:00Z')).toBe('11/10/2026 às 14:32');
  });

  it('meia-noite de Brasília não vira 24:00 nem dia errado', () => {
    expect(formatarDataHoraBR('2026-10-11T03:05:00Z')).toBe('11/10/2026 às 00:05');
    expect(formatarDataHoraBR('2026-10-11T02:59:00Z')).toBe('10/10/2026 às 23:59');
  });

  it('ausente ou inválida vira texto vazio', () => {
    expect(formatarDataHoraBR(null)).toBe('');
    expect(formatarDataHoraBR(undefined)).toBe('');
    expect(formatarDataHoraBR('')).toBe('');
    expect(formatarDataHoraBR('ontem')).toBe('');
  });
});
