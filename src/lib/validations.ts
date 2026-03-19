import { z } from 'zod';

// ── Patient Data ─────────────────────────────────────────────
export const PacienteSchema = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
  sobrenome: z.string().trim().min(1, 'Sobrenome é obrigatório').max(100, 'Sobrenome muito longo'),
  email: z.union([z.string().email('E-mail inválido'), z.literal('')]).optional().transform(v => v || null),
  telefone: z.union([
    z.string().regex(/^[\d\s()+-]{8,20}$/, 'Telefone inválido'),
    z.literal(''),
  ]).optional().transform(v => v || null),
  cpf: z.union([
    z.string().regex(/^\d{11}$/, 'CPF deve ter 11 dígitos numéricos'),
    z.literal(''),
  ]).optional().transform(v => v || null),
  data_nascimento: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal('')]).optional().transform(v => v || null),
  genero: z.string().max(50).optional().transform(v => v || null),
  endereco: z.string().max(500).optional().transform(v => v || null),
  observacoes: z.string().max(2000).optional().transform(v => v || null),
});

export type PacienteFormData = z.infer<typeof PacienteSchema>;

// ── Auth ─────────────────────────────────────────────────────
export const SignInSchema = z.object({
  email: z.string().trim().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

export const SignUpSchema = z.object({
  nome: z.string().trim().min(2, 'Nome deve ter ao menos 2 caracteres').max(100),
  email: z.string().trim().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').max(128),
});
