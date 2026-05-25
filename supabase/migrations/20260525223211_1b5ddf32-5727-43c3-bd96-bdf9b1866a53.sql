
REVOKE EXECUTE ON FUNCTION public.seed_notificacao_regras_default(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_notificacao_regras_default(UUID) TO authenticated, service_role;
