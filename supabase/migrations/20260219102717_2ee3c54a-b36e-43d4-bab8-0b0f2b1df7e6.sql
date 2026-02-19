-- Remove a política pública que expõe tokens completos
DROP POLICY IF EXISTS "Links ativos são acessíveis publicamente (leitura por token)" ON public.links_avaliacao;

-- Cria política mais restritiva: apenas terapeutas autenticados podem SELECT
-- A leitura pública agora é feita exclusivamente via edge function com service role
-- Isso resolve a vulnerabilidade de exposição de tokens

-- Mantém política de terapeutas (ALL já existe, cobre SELECT para terapeutas autenticados)
-- Nenhuma outra alteração necessária: inserção em respostas_avaliacao_paciente
-- continua válida porque a política INSERT dela checa links_avaliacao com service role via edge function

-- Para manter compatibilidade com AvaliacaoPublica.tsx (que agora usará edge function),
-- precisamos permitir INSERT em respostas via check na tabela (política já existente é suficiente)

-- Também garantir que a política de INSERT em respostas_avaliacao_paciente
-- funciona sem SELECT direto na links_avaliacao por anônimos.
-- A política atual usa EXISTS na links_avaliacao - isso funciona com SECURITY DEFINER ou anon select.
-- Vamos criar uma função security definer para o check do INSERT:

CREATE OR REPLACE FUNCTION public.link_avaliacao_valido(p_link_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.links_avaliacao
    WHERE id = p_link_id
      AND status = 'ativo'
      AND data_expiracao > now()
  );
$$;

-- Atualiza a política de INSERT em respostas para usar a função security definer
DROP POLICY IF EXISTS "Inserção pública via link válido" ON public.respostas_avaliacao_paciente;

CREATE POLICY "Inserção pública via link válido"
  ON public.respostas_avaliacao_paciente
  FOR INSERT
  WITH CHECK (public.link_avaliacao_valido(link_id));
