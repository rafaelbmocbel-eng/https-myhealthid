export interface ContatoPaciente {
  email?: string | null;
  telefone?: string | null;
}

/**
 * E-mail e telefone em branco vão como null. O índice único de e-mail por profissional só ignora null: uma string vazia
 * colide com o próximo cliente sem e-mail. O gatilho do banco também normaliza, mas a tela não deve depender dele.
 */
export function normalizarContatoPaciente({ email, telefone }: ContatoPaciente): { email: string | null; telefone: string | null } {
  return {
    email: email?.trim().toLowerCase() || null,
    telefone: telefone?.trim() || null,
  };
}
