import { z } from 'zod';

// ── CPF validator (com dígitos verificadores) ────────────────
function isValidCPF(raw: string): boolean {
  const cpf = raw.replace(/\D/g, '');
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === parseInt(cpf[10]);
}

const cpfField = z
  .union([z.string(), z.literal('')])
  .optional()
  .transform(v => (v ? v.replace(/\D/g, '') : null))
  .refine(v => v === null || (v.length === 11 && isValidCPF(v)), {
    message: 'CPF inválido',
  });

// ── Patient Data ─────────────────────────────────────────────
export const PacienteSchema = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
  sobrenome: z.string().trim().min(1, 'Sobrenome é obrigatório').max(100, 'Sobrenome muito longo'),
  email: z.union([z.string().email('E-mail inválido'), z.literal('')]).optional().transform(v => v || null),
  telefone: z.union([
    z.string().regex(/^[\d\s()+-]{8,20}$/, 'Telefone inválido'),
    z.literal(''),
  ]).optional().transform(v => v || null),
  cpf: cpfField,
  data_nascimento: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal('')]).optional().transform(v => v || null),
  genero: z.string().max(50).optional().transform(v => v || null),
  cep: z.union([z.string().regex(/^\d{5}-?\d{3}$/, 'CEP inválido'), z.literal('')]).optional().transform(v => v ? v.replace(/\D/g, '') : null),
  endereco: z.string().max(500).optional().transform(v => v || null),
  endereco_numero: z.string().max(20).optional().transform(v => v || null),
  endereco_complemento: z.string().max(100).optional().transform(v => v || null),
  bairro: z.string().max(100).optional().transform(v => v || null),
  cidade: z.string().max(100).optional().transform(v => v || null),
  uf: z.union([z.string().regex(/^[A-Za-z]{2}$/, 'UF inválida'), z.literal('')]).optional().transform(v => v ? v.toUpperCase() : null),
  observacoes: z.string().max(2000).optional().transform(v => v || null),
});

export type PacienteFormData = z.infer<typeof PacienteSchema>;

export { isValidCPF };

// ── Auth ─────────────────────────────────────────────────────
export const SignInSchema = z.object({
  email: z.string().trim().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

export const SignUpSchema = z.object({
  nome: z.string().trim().min(2, 'Nome deve ter ao menos 2 caracteres').max(100),
  email: z.string().trim().email('E-mail inválido'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres').max(128),
});
