-- Revogar acesso público de todas as funções SECURITY DEFINER no schema public para mitigar WARN 8-12 do linter
-- e garantir que apenas usuários autenticados ou service_role possam executá-las.

DO $$
DECLARE
    func_name text;
BEGIN
    FOR func_name IN 
        SELECT p.proname 
        FROM pg_proc p 
        JOIN pg_namespace n ON n.oid = p.pronamespace 
        WHERE n.nspname = 'public' AND p.prosecdef = true
    LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I FROM PUBLIC', func_name);
        EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I TO authenticated, service_role', func_name);
    END LOOP;
END $$;
