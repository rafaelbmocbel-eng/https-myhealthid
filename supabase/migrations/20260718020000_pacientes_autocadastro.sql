-- CONSERTO NA RAIZ do autocadastro (wellness): contas criadas pelo próprio
-- cliente viviam SÓ em portal_pacientes — sem linha em pacientes (a coluna
-- terapeuta_id era NOT NULL). Resultado: MyID, dicas, XP, diário, histórico e
-- questionários ficavam mortos para essas contas (pacienteId nulo em tudo).
--
-- 1) terapeuta_id passa a ser opcional (autocadastro não tem profissional).
ALTER TABLE public.pacientes ALTER COLUMN terapeuta_id DROP NOT NULL;

-- 2) Políticas de self-acesso VERSIONADAS (existiam só criadas via Studio):
--    o paciente logado lê e atualiza o próprio cadastro.
DROP POLICY IF EXISTS "Paciente ve o proprio cadastro" ON public.pacientes;
CREATE POLICY "Paciente ve o proprio cadastro" ON public.pacientes
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Paciente atualiza o proprio cadastro" ON public.pacientes;
CREATE POLICY "Paciente atualiza o proprio cadastro" ON public.pacientes
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 3) Backfill: cria a linha de paciente para todo autocadastro existente.
INSERT INTO public.pacientes (user_id, terapeuta_id, nome, sobrenome, email, ativo, cadastro_status, tipo_conta)
SELECT
  pp.user_id,
  NULL,
  COALESCE(NULLIF(pp.nome, ''), 'Cliente'),
  '',
  pp.email,
  true,
  'completo',
  'wellness_free'
FROM public.portal_pacientes pp
WHERE NOT EXISTS (
  SELECT 1 FROM public.pacientes p WHERE p.user_id = pp.user_id
);

-- 4) Futuros autocadastros ganham a linha automaticamente.
CREATE OR REPLACE FUNCTION public.criar_paciente_do_portal()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.pacientes (user_id, terapeuta_id, nome, sobrenome, email, ativo, cadastro_status, tipo_conta)
  SELECT NEW.user_id, NULL, COALESCE(NULLIF(NEW.nome, ''), 'Cliente'), '', NEW.email, true, 'completo', 'wellness_free'
  WHERE NOT EXISTS (SELECT 1 FROM public.pacientes p WHERE p.user_id = NEW.user_id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_portal_paciente_cria_paciente ON public.portal_pacientes;
CREATE TRIGGER trg_portal_paciente_cria_paciente
  AFTER INSERT ON public.portal_pacientes
  FOR EACH ROW EXECUTE FUNCTION public.criar_paciente_do_portal();
