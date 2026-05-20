
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS perfil_profissional_confirmado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS perfil_profissional_confirmado_em timestamptz;

CREATE OR REPLACE FUNCTION public.bloqueia_troca_perfil_profissional()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se já estava confirmado e o perfil mudou, bloqueia
  IF COALESCE(OLD.perfil_profissional_confirmado, false) = true
     AND NEW.perfil_profissional IS DISTINCT FROM OLD.perfil_profissional THEN
    RAISE EXCEPTION 'Profissão já confirmada. Para alterar, entre em contato com o suporte.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Marca timestamp quando confirma pela primeira vez
  IF NEW.perfil_profissional_confirmado = true
     AND COALESCE(OLD.perfil_profissional_confirmado, false) = false THEN
    NEW.perfil_profissional_confirmado_em := now();
  END IF;

  -- Não permite "desconfirmar"
  IF COALESCE(OLD.perfil_profissional_confirmado, false) = true
     AND NEW.perfil_profissional_confirmado = false THEN
    NEW.perfil_profissional_confirmado := true;
    NEW.perfil_profissional_confirmado_em := OLD.perfil_profissional_confirmado_em;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloqueia_troca_perfil_profissional ON public.profiles;
CREATE TRIGGER trg_bloqueia_troca_perfil_profissional
BEFORE UPDATE OF perfil_profissional, perfil_profissional_confirmado ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.bloqueia_troca_perfil_profissional();
