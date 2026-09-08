-- Corrige a criação de perfil profissional FALSO para contas de cliente.
--
-- Causa: o trigger on_auth_user_created (handle_new_user) criava uma linha em
-- public.profiles para todo usuário novo, exceto quando is_patient=true já
-- estava no metadata no momento do INSERT. No login por GOOGLE, o cliente ainda
-- não tem is_patient setado nesse instante (o app só marca depois do 1º login),
-- então ganhava um perfil profissional "fantasma" (sem CREFITO, não confirmado).
--
-- Correção: só cria perfil profissional quando o cadastro DECLARA a intenção via
-- account_type='professional' (a tela profissional /auth envia isso). O
-- profissional que entra por Google (sem account_type) recebe o perfil sob
-- demanda no primeiro login (ensureProfessionalProfile no AuthContext).

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(NEW.raw_user_meta_data->>'account_type','') = 'professional' THEN
    INSERT INTO public.profiles (user_id, email, nome)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nome', ''))
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

-- Limpeza dos perfis profissionais falsos já existentes (contas que são cliente).
-- Seguro/idempotente: só remove stubs NÃO confirmados, sem CREFITO, de usuários
-- marcados is_patient=true que têm ficha de paciente (pacientes ou portal_pacientes).
-- Verificado: nenhum desses user_ids é terapeuta em pacientes.terapeuta_id nem em
-- myid_avaliacoes.terapeuta_id, então não há dependências a quebrar.
DELETE FROM public.profiles p
WHERE p.perfil_profissional_confirmado = false
  AND p.crefito IS NULL
  AND EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = p.user_id AND (u.raw_user_meta_data->>'is_patient')::boolean IS TRUE
  )
  AND (
    EXISTS (SELECT 1 FROM public.pacientes pa WHERE pa.user_id = p.user_id)
    OR EXISTS (SELECT 1 FROM public.portal_pacientes pp WHERE pp.user_id = p.user_id)
  );
