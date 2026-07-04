-- Fix: ai_response_cache tinha RLS "Authenticated can read" (USING true)
-- que expunha resumos clínicos de qualquer paciente a qualquer usuário autenticado.
-- O acesso ao cache já é exposto de forma segura via match_ai_cache (SECURITY DEFINER),
-- portanto o SELECT direto para "authenticated" é desnecessário e inseguro.

DROP POLICY IF EXISTS "Authenticated can read ai cache" ON public.ai_response_cache;
REVOKE SELECT ON public.ai_response_cache FROM authenticated;

-- Garante que apenas service_role acessa a tabela diretamente;
-- usuários acessam via match_ai_cache() que é SECURITY DEFINER.
