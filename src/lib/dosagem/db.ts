import { supabase } from '@/integrations/supabase/client';

// Acesso às tabelas desta aplicação que ainda não estão nos tipos gerados do Supabase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const tabela = (nome: string) => (supabase as any).from(nome);
