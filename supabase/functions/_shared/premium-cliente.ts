// Premium de cortesia para CONTA DE CLIENTE (portal wellness), concedido pelo super-admin.
// Regras puras, sem acesso a banco, mais a execução (que recebe o cliente admin do Supabase).
// Premium do cliente = pacientes.tipo_conta = 'wellness_premium' (+ uma wellness_assinaturas 'ativa').
// Paciente clínico (tipo_conta 'clinico', cadastrado por um profissional) NÃO é tocado.
// A conta é achada pelo e-mail do LOGIN (auth.users), nunca por pacientes.email: esse campo o próprio cliente edita.

export interface PacienteDaConta {
  id: string;
  user_id: string | null;
  tipo_conta: string | null;
}

export interface AssinaturaDaConta {
  id: string;
  status: string;
  provider: string | null;
  created_at?: string | null;
}

export type Recusa = { ok: false; status: number; erro: string };

export interface ConcessaoPremium {
  ok: true;
  /** Já era Premium com assinatura ativa: não muda nada. */
  jaPremium: boolean;
  /** Assinatura de cortesia a gravar: id preenchido = atualizar essa linha; null = inserir. */
  assinatura: null | {
    id: string | null;
    status: 'ativa';
    provider: 'manual';
    valor_mensal: 0;
    data_inicio: string;
    data_fim: string | null;
    /** Sem prazo = null: o robô de vencimento ignora, e um pagamento futuro parte de hoje (não de uma data distante). */
    proxima_cobranca: string | null;
  };
  /** Troca de tipo da conta (null quando já é Premium). */
  tipoNovo: 'wellness_premium' | null;
}

export interface RevogacaoPremium {
  ok: true;
  /** Cortesias ativas a cancelar (vazio quando só falta rebaixar a conta). */
  assinaturaIds: string[];
  /** Conta a voltar para 'wellness_free' (false quando já está). */
  rebaixar: boolean;
}

export const DIAS_MAXIMOS_CORTESIA = 3650;
export const USUARIOS_POR_PAGINA = 1000;
export const MAX_PAGINAS_USUARIOS = 50;

export function normalizarEmail(bruto: unknown): string {
  return typeof bruto === 'string' ? bruto.trim().toLowerCase() : '';
}

export function emailPareceValido(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Dias de cortesia: ausente = sem prazo; presente precisa ser inteiro de 1 a DIAS_MAXIMOS_CORTESIA. */
export function lerDias(bruto: unknown): { ok: true; dias: number | null } | Recusa {
  if (bruto === undefined || bruto === null || bruto === '') return { ok: true, dias: null };
  const n = typeof bruto === 'number' ? bruto : Number(bruto);
  if (!Number.isInteger(n) || n < 1 || n > DIAS_MAXIMOS_CORTESIA) {
    return { ok: false, status: 400, erro: `Dias deve ser um número inteiro de 1 a ${DIAS_MAXIMOS_CORTESIA}, ou ficar em branco para acesso sem prazo.` };
  }
  return { ok: true, dias: n };
}

const SEM_LOGIN: Recusa = {
  ok: false,
  status: 404,
  erro: 'Nenhuma conta com esse e-mail de login. A pessoa precisa ter entrado no portal do cliente com ele antes.',
};

/** O login do e-mail precisa ter um cadastro de cliente; mais de um é ambíguo e nada é alterado. */
export function escolherConta(linhas: readonly PacienteDaConta[]): PacienteDaConta | Recusa {
  if (linhas.length === 0) {
    return { ok: false, status: 404, erro: 'Esse e-mail tem login, mas não tem cadastro de cliente no portal. Não mudei nada.' };
  }
  if (linhas.length > 1) {
    return {
      ok: false,
      status: 409,
      erro: `Esse login tem ${linhas.length} cadastros de cliente. Não mudei nada: confira qual é o certo antes de liberar.`,
    };
  }
  return linhas[0];
}

const CLINICO: Recusa = {
  ok: false,
  status: 409,
  erro: 'Essa conta é de paciente de um profissional (cadastro clínico), não de cliente do portal. Não mudei nada.',
};

export function decidirConcessaoPremium(entrada: {
  conta: PacienteDaConta;
  assinaturas: readonly AssinaturaDaConta[];
  dias: number | null;
  agora: Date;
}): ConcessaoPremium | Recusa {
  const { conta } = entrada;

  if (conta.tipo_conta !== 'wellness_free' && conta.tipo_conta !== 'wellness_premium') return CLINICO;

  const ativa = entrada.assinaturas.find((a) => a.status === 'ativa') ?? null;

  if (conta.tipo_conta === 'wellness_premium' && ativa) {
    return { ok: true, jaPremium: true, assinatura: null, tipoNovo: null };
  }
  if (ativa && ativa.provider !== 'manual') {
    return {
      ok: false,
      status: 409,
      erro: 'Essa conta tem uma assinatura paga ativa. Não mudei nada, para não mexer na cobrança.',
    };
  }

  const inicio = entrada.agora;
  const fim = entrada.dias === null ? null : new Date(inicio.getTime() + entrada.dias * 86_400_000);
  const existente = entrada.assinaturas.find((a) => a.provider === 'manual' && a.status === 'ativa')
    ?? entrada.assinaturas.find((a) => a.provider === 'manual')
    ?? null;

  return {
    ok: true,
    jaPremium: false,
    assinatura: {
      id: existente?.id ?? null,
      status: 'ativa',
      provider: 'manual',
      valor_mensal: 0,
      data_inicio: inicio.toISOString(),
      data_fim: fim ? fim.toISOString() : null,
      proxima_cobranca: fim ? fim.toISOString() : null,
    },
    tipoNovo: conta.tipo_conta === 'wellness_premium' ? null : 'wellness_premium',
  };
}

/**
 * Só desfaz cortesia (provider 'manual'): assinatura paga nunca é cancelada por aqui. Tolerante a uma
 * execução anterior que parou no meio (conta já rebaixada, cortesia ainda ativa): conclui o que falta.
 */
export function decidirRevogacaoPremium(entrada: {
  conta: PacienteDaConta;
  assinaturas: readonly AssinaturaDaConta[];
}): RevogacaoPremium | Recusa {
  const { conta } = entrada;

  if (conta.tipo_conta !== 'wellness_free' && conta.tipo_conta !== 'wellness_premium') return CLINICO;

  const ativas = entrada.assinaturas.filter((a) => a.status === 'ativa');
  if (ativas.some((a) => a.provider !== 'manual')) {
    return {
      ok: false,
      status: 409,
      erro: 'O Premium dessa conta é uma assinatura paga, não cortesia. Não mudei nada.',
    };
  }
  const rebaixar = conta.tipo_conta === 'wellness_premium';

  if (ativas.length === 0 && rebaixar) {
    return {
      ok: false,
      status: 409,
      erro: 'Essa conta está como Premium, mas não achei uma cortesia ativa para desfazer. Não mudei nada.',
    };
  }
  if (ativas.length === 0 && !rebaixar) {
    return { ok: false, status: 409, erro: 'Essa conta não está como Premium. Não mudei nada.' };
  }
  return { ok: true, assinaturaIds: ativas.map((a) => a.id), rebaixar };
}

// ---------------------------------------------------------------------------
// Execução: acha o login, lê as linhas, aplica a decisão e confere que cada escrita pegou linha.
// ---------------------------------------------------------------------------

export interface UsuarioAuth {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
}

// Só o encadeamento do cliente do Supabase que usamos; tipado solto de propósito (o código roda no Deno).
export type BancoAdmin = {
  // deno-lint-ignore no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (tabela: string) => any;
  auth: {
    admin: {
      listUsers: (p: { page: number; perPage: number }) => Promise<{ data: { users: UsuarioAuth[] } | null; error: unknown }>;
    };
  };
};

export interface RespostaPremium {
  status: number;
  payload: Record<string, unknown>;
}

const resposta = (status: number, payload: Record<string, unknown>): RespostaPremium => ({ status, payload });

/** A API de administração não filtra por e-mail: varre as páginas (com teto) até achar o login. */
async function acharLoginPorEmail(admin: BancoAdmin, email: string): Promise<UsuarioAuth | null | 'limite'> {
  for (let pagina = 1; pagina <= MAX_PAGINAS_USUARIOS; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: USUARIOS_POR_PAGINA });
    if (error) throw error;
    const usuarios = data?.users ?? [];
    const achado = usuarios.find((u) => normalizarEmail(u.email) === email);
    if (achado) return achado;
    if (usuarios.length < USUARIOS_POR_PAGINA) return null;
  }
  return 'limite';
}

type LinhaComData = { id: string; created_at?: string | null };

/**
 * Ordem das escritas (cada uma confere que atingiu uma linha, senão para e avisa, sem declarar sucesso):
 * conceder = assinatura de cortesia → tipo da conta; revogar = tipo da conta → assinaturas.
 * Se a troca de tipo falhar depois de INSERIR uma cortesia nova, ela é apagada; nos demais casos,
 * repetir a mesma ação conclui o que faltou.
 */
export async function executarPremiumCliente(
  admin: BancoAdmin,
  action: 'conceder_premium_cliente' | 'revogar_premium_cliente',
  body: Record<string, unknown>,
  agora: Date,
): Promise<RespostaPremium> {
  const emailAlvo = normalizarEmail(body.email);
  if (!emailPareceValido(emailAlvo)) return resposta(400, { error: 'Informe um e-mail válido.' });

  const dias = action === 'conceder_premium_cliente' ? lerDias(body.dias) : ({ ok: true, dias: null } as const);
  if (dias.ok === false) return resposta(dias.status, { error: dias.erro });

  const login = await acharLoginPorEmail(admin, emailAlvo);
  if (login === 'limite') {
    return resposta(500, { error: `Não consegui varrer todos os logins (limite de ${MAX_PAGINAS_USUARIOS * USUARIOS_POR_PAGINA}). Nada foi alterado.` });
  }
  if (!login) return resposta(SEM_LOGIN.status, { error: SEM_LOGIN.erro });
  if (!login.email_confirmed_at) {
    return resposta(409, { error: 'O cliente ainda não confirmou esse e-mail. Não mudei nada.' });
  }

  const { data: linhas, error: erroBusca } = await admin.from('pacientes')
    .select('id, user_id, tipo_conta')
    .eq('user_id', login.id);
  if (erroBusca) throw erroBusca;
  const conta = escolherConta(linhas || []);
  if ('ok' in conta) return resposta(conta.status, { error: conta.erro });

  const { data: assinaturas, error: erroAss } = await admin.from('wellness_assinaturas')
    .select('id, status, provider, created_at').eq('paciente_id', conta.id);
  if (erroAss) throw erroAss;
  const agoraIso = agora.toISOString();

  if (action === 'conceder_premium_cliente') {
    const dec = decidirConcessaoPremium({ conta, assinaturas: assinaturas || [], dias: dias.dias, agora });
    if (dec.ok === false) return resposta(dec.status, { error: dec.erro });
    if (dec.jaPremium) return resposta(200, { ok: true, ja_premium: true });

    let novaId: string | null = null;
    if (dec.assinatura) {
      const { id, ...campos } = dec.assinatura;
      const linha = { ...campos, paciente_id: conta.id, updated_at: agoraIso };
      const { data: gravada, error } = id
        ? await admin.from('wellness_assinaturas').update(linha).eq('id', id).select('id')
        : await admin.from('wellness_assinaturas').insert(linha).select('id');
      if (error) throw error;
      if (!gravada || gravada.length === 0) {
        return resposta(409, { error: 'A assinatura mudou enquanto eu liberava. Nada foi concluído: tente de novo.' });
      }
      if (!id) novaId = gravada[0].id;
    }

    const desfazerInsercao = async () => {
      if (!novaId) return;
      try {
        await admin.from('wellness_assinaturas').delete().eq('id', novaId).eq('provider', 'manual');
      } catch {
        // Sem conseguir apagar a cortesia recém-criada: repetir "Dar Premium" reaproveita essa linha, então nada fica preso.
      }
    };

    if (dec.tipoNovo) {
      try {
        const { data: trocada, error } = await admin.from('pacientes')
          .update({ tipo_conta: dec.tipoNovo, updated_at: agoraIso })
          .eq('id', conta.id).eq('tipo_conta', 'wellness_free').select('id');
        if (error) throw error;
        if (!trocada || trocada.length === 0) {
          await desfazerInsercao();
          return resposta(409, { error: 'A conta mudou enquanto eu liberava. Confira e tente de novo.' });
        }
      } catch (e) {
        await desfazerInsercao();
        throw e;
      }
    }

    // Duas chamadas ao mesmo tempo podem ter inserido duas cortesias: fica a mais antiga.
    if (novaId) {
      const { data: ativas, error } = await admin.from('wellness_assinaturas')
        .select('id, created_at').eq('paciente_id', conta.id).eq('provider', 'manual').eq('status', 'ativa');
      if (error) throw error;
      if (ativas && ativas.length > 1) {
        const ordenadas = [...(ativas as LinhaComData[])].sort((a, b) =>
          String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')) || a.id.localeCompare(b.id));
        const sobras = ordenadas.slice(1).map((a) => a.id);
        const { error: erroSobras } = await admin.from('wellness_assinaturas')
          .update({ status: 'cancelada', data_fim: agoraIso, updated_at: agoraIso })
          .in('id', sobras).eq('provider', 'manual').eq('status', 'ativa');
        if (erroSobras) throw erroSobras;
      }
    }
    return resposta(200, { ok: true, ja_premium: false, ate: dec.assinatura?.data_fim ?? null });
  }

  const rev = decidirRevogacaoPremium({ conta, assinaturas: assinaturas || [] });
  if (rev.ok === false) return resposta(rev.status, { error: rev.erro });
  if (rev.rebaixar) {
    const { data: rebaixada, error } = await admin.from('pacientes')
      .update({ tipo_conta: 'wellness_free', updated_at: agoraIso })
      .eq('id', conta.id).eq('tipo_conta', 'wellness_premium').select('id');
    if (error) throw error;
    if (!rebaixada || rebaixada.length === 0) {
      return resposta(409, { error: 'A conta mudou enquanto eu desfazia. Confira e tente de novo.' });
    }
  }
  if (rev.assinaturaIds.length > 0) {
    const { data: canceladas, error } = await admin.from('wellness_assinaturas')
      .update({ status: 'cancelada', data_fim: agoraIso, updated_at: agoraIso })
      .in('id', rev.assinaturaIds).eq('provider', 'manual').eq('status', 'ativa').select('id');
    if (error) throw error;
    if (!canceladas || canceladas.length === 0) {
      return resposta(409, { error: 'A cortesia mudou enquanto eu desfazia. Confira e tente de novo.' });
    }
  }
  return resposta(200, { ok: true });
}
