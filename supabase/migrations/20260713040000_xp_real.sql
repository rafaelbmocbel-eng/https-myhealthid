-- Gamificação REAL: os pontos das missões/metas/desafios passam a creditar a
-- carteira (pacientes.xp_total) via um livro-razão idempotente. A chave única
-- (paciente, chave) garante que cada conquista só pontua UMA vez (ex.:
-- "missao:missao-sono:2026-07-13"), mesmo com toggles ou chamadas repetidas.

CREATE TABLE IF NOT EXISTS public.xp_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL,
  chave text NOT NULL,
  xp integer NOT NULL CHECK (xp >= 0 AND xp <= 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (paciente_id, chave)
);

ALTER TABLE public.xp_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Paciente ve seus eventos xp" ON public.xp_eventos;
CREATE POLICY "Paciente ve seus eventos xp" ON public.xp_eventos
  FOR SELECT USING (paciente_id IN (SELECT id FROM public.pacientes WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Terapeuta ve eventos xp dos pacientes" ON public.xp_eventos;
CREATE POLICY "Terapeuta ve eventos xp dos pacientes" ON public.xp_eventos
  FOR SELECT USING (paciente_id IN (SELECT id FROM public.pacientes WHERE terapeuta_id = auth.uid()));
-- Escrita SÓ pela função ganhar_xp (security definer) — sem policy de INSERT.

-- Credita XP uma única vez por chave. Retorna o estado (creditado? novo total).
CREATE OR REPLACE FUNCTION public.ganhar_xp(p_paciente_id uuid, p_chave text, p_xp integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_xp integer;
  v_total integer;
  v_autorizado boolean;
BEGIN
  -- Só o próprio paciente ou o terapeuta dono podem creditar.
  SELECT EXISTS (
    SELECT 1 FROM public.pacientes
    WHERE id = p_paciente_id AND (user_id = auth.uid() OR terapeuta_id = auth.uid())
  ) INTO v_autorizado;
  IF NOT v_autorizado THEN
    RETURN jsonb_build_object('creditado', false, 'erro', 'nao_autorizado');
  END IF;

  v_xp := LEAST(GREATEST(COALESCE(p_xp, 0), 0), 150);
  IF v_xp = 0 OR COALESCE(p_chave, '') = '' THEN
    RETURN jsonb_build_object('creditado', false, 'erro', 'parametros');
  END IF;

  INSERT INTO public.xp_eventos (paciente_id, chave, xp)
  VALUES (p_paciente_id, p_chave, v_xp)
  ON CONFLICT (paciente_id, chave) DO NOTHING;

  IF NOT FOUND THEN
    SELECT xp_total INTO v_total FROM public.pacientes WHERE id = p_paciente_id;
    RETURN jsonb_build_object('creditado', false, 'xp_total', COALESCE(v_total, 0));
  END IF;

  UPDATE public.pacientes
  SET xp_total = COALESCE(xp_total, 0) + v_xp
  WHERE id = p_paciente_id
  RETURNING xp_total INTO v_total;

  RETURN jsonb_build_object('creditado', true, 'xp', v_xp, 'xp_total', v_total);
END;
$$;
