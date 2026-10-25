-- Foco do ciclo do MyID: o profissional escolhe de 1 a 3 dimensões para trabalhar com o paciente e, no reteste,
-- a tela mostra quanto cada uma variou em pontos perdidos em relação ao MyID em que o ciclo começou.
-- Só o profissional dono do paciente lê e grava; o paciente não vê esta tabela.

-- Dimensões válidas: as 11 do MyID, de 1 a 3, sem repetição e numa lista de uma dimensão só (array_ndims = 1). Fica no banco para a regra valer para qualquer cliente
-- (tela, importação, SQL). Devolve false (e não NULL) para entrada nula ou com elemento nulo, porque um CHECK
-- trata NULL como aprovado.
CREATE OR REPLACE FUNCTION public.myid_dimensoes_validas(p_dimensoes text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(
    p_dimensoes IS NOT NULL
    AND array_ndims(p_dimensoes) = 1
    AND cardinality(p_dimensoes) BETWEEN 1 AND 3
    AND NOT EXISTS (SELECT 1 FROM unnest(p_dimensoes) d WHERE d IS NULL)
    AND p_dimensoes <@ ARRAY['D', 'EFI', 'P', 'I', 'R', 'C', 'N', 'AF', 'HID', 'NUT', 'ERG']::text[]
    AND (SELECT count(DISTINCT d) FROM unnest(p_dimensoes) d) = cardinality(p_dimensoes),
    false
  );
$$;

CREATE TABLE IF NOT EXISTS public.myid_foco_ciclo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  terapeuta_id uuid NOT NULL,
  -- O MyID em que o ciclo começou: a variação é sempre medida contra ele. Se ele for apagado, o ciclo continua
  -- (sem comparação) e a tela pede para iniciar um novo a partir do MyID atual.
  avaliacao_base_id uuid REFERENCES public.avaliacoes_identidade(id) ON DELETE SET NULL,
  dimensoes text[] NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  encerrado_em timestamptz,
  CONSTRAINT myid_foco_ciclo_dimensoes_validas CHECK (public.myid_dimensoes_validas(dimensoes)),
  CONSTRAINT myid_foco_ciclo_encerrado_depois CHECK (encerrado_em IS NULL OR encerrado_em >= criado_em)
);

COMMENT ON TABLE public.myid_foco_ciclo IS
  'Foco do ciclo do MyID: 1 a 3 dimensões que o profissional trabalha com o paciente. A variação no reteste é medida contra avaliacao_base_id. Um ciclo aberto (encerrado_em nulo) por paciente e profissional.';

-- Um único ciclo aberto por paciente e profissional; os encerrados ficam como histórico.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_myid_foco_ciclo_aberto
  ON public.myid_foco_ciclo (paciente_id, terapeuta_id)
  WHERE encerrado_em IS NULL;
CREATE INDEX IF NOT EXISTS idx_myid_foco_ciclo_paciente
  ON public.myid_foco_ciclo (paciente_id, criado_em DESC);

ALTER TABLE public.myid_foco_ciclo ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.myid_foco_ciclo FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.myid_foco_ciclo TO authenticated;
GRANT ALL ON public.myid_foco_ciclo TO service_role;

DROP POLICY IF EXISTS "Profissional vê o foco do ciclo dos seus pacientes" ON public.myid_foco_ciclo;
CREATE POLICY "Profissional vê o foco do ciclo dos seus pacientes"
  ON public.myid_foco_ciclo FOR SELECT TO authenticated
  USING (auth.uid() = terapeuta_id);

-- Quem cria só pode apontar para paciente seu e para um MyID desse mesmo paciente.
DROP POLICY IF EXISTS "Profissional cria foco do ciclo para o seu paciente" ON public.myid_foco_ciclo;
CREATE POLICY "Profissional cria foco do ciclo para o seu paciente"
  ON public.myid_foco_ciclo FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = terapeuta_id
    AND EXISTS (SELECT 1 FROM public.pacientes p WHERE p.id = paciente_id AND p.terapeuta_id = auth.uid())
    AND (
      avaliacao_base_id IS NULL
      OR EXISTS (SELECT 1 FROM public.avaliacoes_identidade a WHERE a.id = avaliacao_base_id AND a.paciente_id = myid_foco_ciclo.paciente_id)
    )
  );

DROP POLICY IF EXISTS "Profissional edita o foco do ciclo" ON public.myid_foco_ciclo;
CREATE POLICY "Profissional edita o foco do ciclo"
  ON public.myid_foco_ciclo FOR UPDATE TO authenticated
  USING (auth.uid() = terapeuta_id)
  WITH CHECK (
    auth.uid() = terapeuta_id
    AND EXISTS (SELECT 1 FROM public.pacientes p WHERE p.id = paciente_id AND p.terapeuta_id = auth.uid())
    AND (
      avaliacao_base_id IS NULL
      OR EXISTS (SELECT 1 FROM public.avaliacoes_identidade a WHERE a.id = avaliacao_base_id AND a.paciente_id = myid_foco_ciclo.paciente_id)
    )
  );

DROP POLICY IF EXISTS "Profissional apaga o foco do ciclo" ON public.myid_foco_ciclo;
CREATE POLICY "Profissional apaga o foco do ciclo"
  ON public.myid_foco_ciclo FOR DELETE TO authenticated
  USING (auth.uid() = terapeuta_id);
