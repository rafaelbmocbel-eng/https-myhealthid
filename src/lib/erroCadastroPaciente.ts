export type CausaErroCadastro =
  | 'email_duplicado'
  | 'cpf_duplicado'
  | 'cpf_invalido'
  | 'sessao'
  | 'rede'
  | 'campo_longo'
  | 'vinculo'
  | 'outro';

export interface ErroCadastroTraduzido {
  causa: CausaErroCadastro;
  titulo: string;
  descricao: string;
}

interface ErroSupabaseLike {
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
}

const texto = (v: unknown) => (typeof v === 'string' ? v : '');

/**
 * O erro do Supabase nem sempre é uma instância de Error (e `instanceof Error` esconde a causa), então lemos os campos
 * direto. Cada causa conhecida vira uma frase que diz o que o profissional faz a seguir; o resto mostra a mensagem real
 * e o código, para o relato do problema chegar com a pista que o suporte precisa.
 */
export function traduzirErroCadastroPaciente(erro: unknown): ErroCadastroTraduzido {
  const e: ErroSupabaseLike = erro && typeof erro === 'object' ? (erro as ErroSupabaseLike) : {};
  const mensagem = texto(e.message) || (typeof erro === 'string' ? erro : '');
  const codigo = texto(e.code);
  const tudo = `${mensagem} ${texto(e.details)} ${texto(e.hint)}`.toLowerCase();

  if (tudo.includes('uniq_pacientes_terapeuta_email')) {
    return {
      causa: 'email_duplicado',
      titulo: 'E-mail já cadastrado',
      descricao: 'Já existe um cliente ativo com este e-mail. Deixe o e-mail em branco ou use outro.',
    };
  }
  if (tudo.includes('uniq_pacientes_terapeuta_cpf')) {
    return {
      causa: 'cpf_duplicado',
      titulo: 'CPF já cadastrado',
      descricao: 'Já existe um cliente ativo com este CPF. Confira o número ou abra o cadastro existente.',
    };
  }
  if (tudo.includes('cpf inválido') || tudo.includes('cpf invalido')) {
    return { causa: 'cpf_invalido', titulo: 'CPF inválido', descricao: 'Verifique os dígitos do CPF.' };
  }
  if (codigo === 'PGRST301' || codigo === 'PGRST303' || tudo.includes('row-level security') || tudo.includes('jwt')) {
    return {
      causa: 'sessao',
      titulo: 'Sessão expirada',
      descricao: 'Sua sessão expirou ou o acesso foi negado. Saia, entre de novo e tente outra vez.',
    };
  }
  if (codigo === '22001' || tudo.includes('value too long')) {
    return {
      causa: 'campo_longo',
      titulo: 'Campo muito longo',
      descricao: 'Algum campo ficou longo demais. Encurte o texto e tente de novo.',
    };
  }
  if (codigo === '23503') {
    return {
      causa: 'vinculo',
      titulo: 'Convênio ou responsável não encontrado',
      descricao: 'O convênio ou o responsável escolhido não existe mais. Reabra o formulário e escolha de novo.',
    };
  }
  if (
    tudo.includes('failed to fetch') || tudo.includes('networkerror') || tudo.includes('network request failed') ||
    tudo.includes('load failed') || tudo.includes('timed out')
  ) {
    return {
      causa: 'rede',
      titulo: 'Sem conexão',
      descricao: 'Não foi possível falar com o servidor. Confira a internet e tente de novo.',
    };
  }

  const detalhe = mensagem || 'erro desconhecido';
  return {
    causa: 'outro',
    titulo: 'Não foi possível cadastrar',
    descricao: codigo ? `${detalhe} (código ${codigo})` : detalhe,
  };
}

interface ClienteMinimo {
  nome?: string | null;
  sobrenome?: string | null;
}

interface ConsultaClientes {
  from: (tabela: string) => {
    select: (colunas: string) => {
      eq: (coluna: string, valor: unknown) => {
        eq: (coluna: string, valor: unknown) => {
          eq: (coluna: string, valor: unknown) => {
            limit: (n: number) => PromiseLike<{ data: ClienteMinimo[] | null }>;
          };
        };
      };
    };
  };
}

/**
 * Nome do cliente ativo que já usa o e-mail ou o CPF; serve só para a mensagem. Falhar ou demorar aqui nunca pode atrapalhar
 * o cadastro: a consulta roda dentro do tratamento de erro, então uma rede pendurada seguraria o aviso e o botão de salvar.
 * Por isso a espera tem limite e, estourado o tempo, a mensagem sai sem o nome.
 */
export async function nomeDoClienteComMesmoContato(
  cliente: unknown,
  terapeutaId: string,
  campo: 'email' | 'cpf',
  valor: string,
  limiteMs = 2000,
): Promise<string | null> {
  const normalizado = campo === 'cpf' ? valor.replace(/\D/g, '') : valor.trim().toLowerCase();
  if (!normalizado) return null;

  const consulta = (async (): Promise<string | null> => {
    try {
      const { data } = await (cliente as ConsultaClientes)
        .from('pacientes')
        .select('nome, sobrenome')
        .eq('terapeuta_id', terapeutaId)
        .eq('ativo', true)
        .eq(campo, normalizado)
        .limit(1);
      const achado = data?.[0];
      if (!achado) return null;
      const nome = `${achado.nome ?? ''} ${achado.sobrenome ?? ''}`.trim();
      return nome || null;
    } catch {
      return null;
    }
  })();

  let relogio: ReturnType<typeof setTimeout> | undefined;
  const esgotado = new Promise<null>((resolve) => {
    relogio = setTimeout(() => resolve(null), limiteMs);
  });
  try {
    return await Promise.race([consulta, esgotado]);
  } finally {
    clearTimeout(relogio);
  }
}

/** Acrescenta à mensagem de duplicidade quem já tem o contato, quando foi possível descobrir. */
export function comNomeDoDuplicado(erro: ErroCadastroTraduzido, nome: string | null): ErroCadastroTraduzido {
  if (!nome) return erro;
  if (erro.causa === 'email_duplicado') {
    return { ...erro, descricao: `Este e-mail já é do cliente ${nome}. Deixe o e-mail em branco ou use outro.` };
  }
  if (erro.causa === 'cpf_duplicado') {
    return { ...erro, descricao: `Este CPF já é do cliente ${nome}. Confira o número ou abra o cadastro existente.` };
  }
  return erro;
}
