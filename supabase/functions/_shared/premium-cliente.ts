// Premium de cortesia para CONTA DE CLIENTE (portal wellness), concedido pelo super-admin.
// Regras puras, sem acesso a banco: a edge function admin-metrics lê as linhas e executa o que daqui sai.
// Premium do cliente = pacientes.tipo_conta = 'wellness_premium' (+ uma wellness_assinaturas 'ativa').
// Paciente clínico (tipo_conta 'clinico', cadastrado por um profissional) NÃO é tocado.

export interface PacienteDaConta {
  id: string;
  user_id: string | null;
  tipo_conta: string | null;
  email?: string | null;
}

export interface AssinaturaDaConta {
  id: string;
  status: string;
  provider: string | null;
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
    proxima_cobranca: string;
  };
  /** Troca de tipo da conta (null quando já é Premium). */
  tipoNovo: 'wellness_premium' | null;
}

export interface RevogacaoPremium {
  ok: true;
  /** Cortesia ativa a cancelar (null quando só falta rebaixar a conta). */
  assinaturaId: string | null;
  /** Conta a voltar para 'wellness_free' (false quando já está). */
  rebaixar: boolean;
}

export const DIAS_MAXIMOS_CORTESIA = 3650;
/** Sem prazo = a próxima cobrança fica tão longe que o robô de renovação nunca rebaixa a conta. */
const ANOS_SEM_PRAZO = 100;

export function normalizarEmail(bruto: unknown): string {
  return typeof bruto === 'string' ? bruto.trim().toLowerCase() : '';
}

export function emailPareceValido(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Em ILIKE, "_" e "%" são curingas: um e-mail como "a_b@x.com" casaria com "aXb@x.com". Escapa os três. */
export function escaparCuringaIlike(texto: string): string {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
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

const SEM_CONTA: Recusa = {
  ok: false,
  status: 404,
  erro: 'Nenhuma conta de cliente com esse e-mail. A pessoa precisa ter entrado no portal do cliente com ele antes.',
};

/**
 * Escolhe a conta de cliente do e-mail. Só vale quem tem login (user_id) e e-mail EXATAMENTE igual
 * (sem diferença de maiúsculas): a busca no banco usa ILIKE e pode trazer parecidos.
 */
export function escolherConta(linhas: readonly PacienteDaConta[], emailAlvo: string): PacienteDaConta | Recusa {
  const alvo = normalizarEmail(emailAlvo);
  const contas = linhas.filter((l) => !!l.user_id && normalizarEmail(l.email) === alvo);
  if (contas.length === 0) return SEM_CONTA;
  if (contas.length > 1) {
    return {
      ok: false,
      status: 409,
      erro: `Esse e-mail aparece em ${contas.length} cadastros de cliente. Não mudei nada: confira qual é o certo antes de liberar.`,
    };
  }
  return contas[0];
}

export function decidirConcessaoPremium(entrada: {
  conta: PacienteDaConta;
  assinaturas: readonly AssinaturaDaConta[];
  dias: number | null;
  agora: Date;
}): ConcessaoPremium | Recusa {
  const { conta } = entrada;

  if (conta.tipo_conta !== 'wellness_free' && conta.tipo_conta !== 'wellness_premium') {
    return {
      ok: false,
      status: 409,
      erro: 'Essa conta é de paciente de um profissional (cadastro clínico), não de cliente do portal. Não mudei nada.',
    };
  }

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
  const proxima = fim ?? new Date(Date.UTC(inicio.getUTCFullYear() + ANOS_SEM_PRAZO, inicio.getUTCMonth(), inicio.getUTCDate(), inicio.getUTCHours(), inicio.getUTCMinutes()));
  const existente = entrada.assinaturas.find((a) => a.provider === 'manual') ?? null;

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
      proxima_cobranca: proxima.toISOString(),
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

  if (conta.tipo_conta !== 'wellness_free' && conta.tipo_conta !== 'wellness_premium') {
    return {
      ok: false,
      status: 409,
      erro: 'Essa conta é de paciente de um profissional (cadastro clínico), não de cliente do portal. Não mudei nada.',
    };
  }

  const ativas = entrada.assinaturas.filter((a) => a.status === 'ativa');
  if (ativas.some((a) => a.provider !== 'manual')) {
    return {
      ok: false,
      status: 409,
      erro: 'O Premium dessa conta é uma assinatura paga, não cortesia. Não mudei nada.',
    };
  }
  const cortesia = ativas[0] ?? null;
  const rebaixar = conta.tipo_conta === 'wellness_premium';

  if (!cortesia && rebaixar) {
    return {
      ok: false,
      status: 409,
      erro: 'Essa conta está como Premium, mas não achei uma cortesia ativa para desfazer. Não mudei nada.',
    };
  }
  if (!cortesia && !rebaixar) {
    return { ok: false, status: 409, erro: 'Essa conta não está como Premium. Não mudei nada.' };
  }
  return { ok: true, assinaturaId: cortesia ? cortesia.id : null, rebaixar };
}

// ---------------------------------------------------------------------------
// Execução: lê as linhas, aplica a decisão e confere que cada escrita pegou linha.
// ---------------------------------------------------------------------------

// Só o encadeamento do cliente do Supabase que usamos; tipado solto de propósito (o código roda no Deno).
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BancoAdmin = { from: (tabela: string) => any };

export interface RespostaPremium {
  status: number;
  payload: Record<string, unknown>;
}

const resposta = (status: number, payload: Record<string, unknown>): RespostaPremium => ({ status, payload });

/**
 * Ordem das escritas (cada uma confere que atingiu uma linha, senão para e avisa, sem declarar sucesso):
 * conceder = assinatura de cortesia → tipo da conta; revogar = tipo da conta → assinatura.
 * Se a execução parar no meio, repetir a mesma ação conclui o que faltou.
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

  const { data: linhas, error: erroBusca } = await admin.from('pacientes')
    .select('id, user_id, tipo_conta, email')
    .ilike('email', escaparCuringaIlike(emailAlvo));
  if (erroBusca) throw erroBusca;
  const conta = escolherConta(linhas || [], emailAlvo);
  if ('ok' in conta) return resposta(conta.status, { error: conta.erro });

  const { data: assinaturas, error: erroAss } = await admin.from('wellness_assinaturas')
    .select('id, status, provider').eq('paciente_id', conta.id);
  if (erroAss) throw erroAss;
  const agoraIso = agora.toISOString();

  if (action === 'conceder_premium_cliente') {
    const dec = decidirConcessaoPremium({ conta, assinaturas: assinaturas || [], dias: dias.dias, agora });
    if (dec.ok === false) return resposta(dec.status, { error: dec.erro });
    if (dec.jaPremium) return resposta(200, { ok: true, ja_premium: true });

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
    }
    if (dec.tipoNovo) {
      const { data: trocada, error } = await admin.from('pacientes')
        .update({ tipo_conta: dec.tipoNovo, updated_at: agoraIso })
        .eq('id', conta.id).eq('tipo_conta', 'wellness_free').select('id');
      if (error) throw error;
      if (!trocada || trocada.length === 0) {
        return resposta(409, { error: 'A conta mudou enquanto eu liberava. Confira e tente de novo.' });
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
  if (rev.assinaturaId) {
    const { data: cancelada, error } = await admin.from('wellness_assinaturas')
      .update({ status: 'cancelada', data_fim: agoraIso, updated_at: agoraIso })
      .eq('id', rev.assinaturaId).eq('provider', 'manual').eq('status', 'ativa').select('id');
    if (error) throw error;
    if (!cancelada || cancelada.length === 0) {
      return resposta(409, { error: 'A cortesia mudou enquanto eu desfazia. Confira e tente de novo.' });
    }
  }
  return resposta(200, { ok: true });
}
