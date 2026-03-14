-- Portal do paciente: liberar acesso apenas aos próprios dados

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pacientes' AND policyname = 'Pacientes leem próprio cadastro'
  ) THEN
    CREATE POLICY "Pacientes leem próprio cadastro"
    ON public.pacientes
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pacientes' AND policyname = 'Pacientes atualizam próprio cadastro'
  ) THEN
    CREATE POLICY "Pacientes atualizam próprio cadastro"
    ON public.pacientes
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'agendamentos' AND policyname = 'Pacientes leem próprios agendamentos'
  ) THEN
    CREATE POLICY "Pacientes leem próprios agendamentos"
    ON public.agendamentos
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.pacientes p
        WHERE p.id = agendamentos.paciente_id
          AND p.user_id = auth.uid()
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'agendamentos' AND policyname = 'Pacientes criam próprios agendamentos'
  ) THEN
    CREATE POLICY "Pacientes criam próprios agendamentos"
    ON public.agendamentos
    FOR INSERT
    TO authenticated
    WITH CHECK (
      status = 'pendente'
      AND EXISTS (
        SELECT 1
        FROM public.pacientes p
        WHERE p.id = agendamentos.paciente_id
          AND p.user_id = auth.uid()
          AND p.terapeuta_id = agendamentos.terapeuta_id
          AND p.ativo = true
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'agendamentos' AND policyname = 'Pacientes atualizam próprios agendamentos'
  ) THEN
    CREATE POLICY "Pacientes atualizam próprios agendamentos"
    ON public.agendamentos
    FOR UPDATE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.pacientes p
        WHERE p.id = agendamentos.paciente_id
          AND p.user_id = auth.uid()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.pacientes p
        WHERE p.id = agendamentos.paciente_id
          AND p.user_id = auth.uid()
      )
      AND status IN ('pendente', 'cancelado', 'confirmado')
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'config_agenda' AND policyname = 'Pacientes leem agenda do terapeuta vinculado'
  ) THEN
    CREATE POLICY "Pacientes leem agenda do terapeuta vinculado"
    ON public.config_agenda
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.pacientes p
        WHERE p.user_id = auth.uid()
          AND p.terapeuta_id = config_agenda.terapeuta_id
          AND p.ativo = true
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'myid_avaliacoes' AND policyname = 'Pacientes leem próprias avaliacoes MyID'
  ) THEN
    CREATE POLICY "Pacientes leem próprias avaliacoes MyID"
    ON public.myid_avaliacoes
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.pacientes p
        WHERE p.id = myid_avaliacoes.paciente_id
          AND p.user_id = auth.uid()
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'avaliacoes_identidade' AND policyname = 'Pacientes leem próprias avaliacoes identidade'
  ) THEN
    CREATE POLICY "Pacientes leem próprias avaliacoes identidade"
    ON public.avaliacoes_identidade
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.pacientes p
        WHERE p.id = avaliacoes_identidade.paciente_id
          AND p.user_id = auth.uid()
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'avaliacoes_cob_zero' AND policyname = 'Pacientes leem próprias avaliacoes cob zero'
  ) THEN
    CREATE POLICY "Pacientes leem próprias avaliacoes cob zero"
    ON public.avaliacoes_cob_zero
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.pacientes p
        WHERE p.id = avaliacoes_cob_zero.paciente_id
          AND p.user_id = auth.uid()
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'controle_sessoes' AND policyname = 'Pacientes leem próprias sessoes'
  ) THEN
    CREATE POLICY "Pacientes leem próprias sessoes"
    ON public.controle_sessoes
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.pacientes p
        WHERE p.id = controle_sessoes.paciente_id
          AND p.user_id = auth.uid()
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Usuários leem próprio profile'
  ) THEN
    CREATE POLICY "Usuários leem próprio profile"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Usuários atualizam próprio profile'
  ) THEN
    CREATE POLICY "Usuários atualizam próprio profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
  END IF;
END $$;