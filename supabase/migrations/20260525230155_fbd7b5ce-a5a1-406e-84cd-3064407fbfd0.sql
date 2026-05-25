
-- Sprint 3: Programa de Recompensas (XP → Prêmios)

-- Enum níveis
DO $$ BEGIN
  CREATE TYPE public.nivel_paciente AS ENUM ('bronze','prata','ouro','platina','diamante');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Enum status resgate
DO $$ BEGIN
  CREATE TYPE public.recompensa_status AS ENUM ('solicitado','aprovado','entregue','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Coluna nivel_atual em pacientes (idempotente)
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS nivel_atual public.nivel_paciente NOT NULL DEFAULT 'bronze';
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS xp_total integer NOT NULL DEFAULT 0;

-- Catálogo de recompensas
CREATE TABLE IF NOT EXISTS public.recompensas_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id uuid NOT NULL,
  titulo text NOT NULL,
  descricao text,
  xp_custo integer NOT NULL CHECK (xp_custo > 0),
  estoque integer,
  nivel_minimo public.nivel_paciente NOT NULL DEFAULT 'bronze',
  ativa boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recompensas_catalogo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Terapeuta CRUD seu catalogo" ON public.recompensas_catalogo;
CREATE POLICY "Terapeuta CRUD seu catalogo" ON public.recompensas_catalogo
  FOR ALL USING (auth.uid() = terapeuta_id) WITH CHECK (auth.uid() = terapeuta_id);

DROP POLICY IF EXISTS "Pacientes leem catalogo do seu terapeuta" ON public.recompensas_catalogo;
CREATE POLICY "Pacientes leem catalogo do seu terapeuta" ON public.recompensas_catalogo
  FOR SELECT USING (
    ativa = true AND EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.terapeuta_id = recompensas_catalogo.terapeuta_id
        AND p.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_recompensas_catalogo_terapeuta ON public.recompensas_catalogo(terapeuta_id, ativa);

-- Resgates
CREATE TABLE IF NOT EXISTS public.recompensas_resgates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  terapeuta_id uuid NOT NULL,
  recompensa_id uuid NOT NULL REFERENCES public.recompensas_catalogo(id) ON DELETE RESTRICT,
  xp_gasto integer NOT NULL,
  status public.recompensa_status NOT NULL DEFAULT 'solicitado',
  observacao text,
  resgatado_em timestamptz NOT NULL DEFAULT now(),
  entregue_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recompensas_resgates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Terapeuta gerencia resgates" ON public.recompensas_resgates;
CREATE POLICY "Terapeuta gerencia resgates" ON public.recompensas_resgates
  FOR ALL USING (auth.uid() = terapeuta_id) WITH CHECK (auth.uid() = terapeuta_id);

DROP POLICY IF EXISTS "Paciente ve seus resgates" ON public.recompensas_resgates;
CREATE POLICY "Paciente ve seus resgates" ON public.recompensas_resgates
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.pacientes p WHERE p.id = recompensas_resgates.paciente_id AND p.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Paciente solicita resgate" ON public.recompensas_resgates;
CREATE POLICY "Paciente solicita resgate" ON public.recompensas_resgates
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.pacientes p WHERE p.id = recompensas_resgates.paciente_id AND p.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_resgates_paciente ON public.recompensas_resgates(paciente_id, status);
CREATE INDEX IF NOT EXISTS idx_resgates_terapeuta ON public.recompensas_resgates(terapeuta_id, status);

-- Função: calcular nível a partir do XP
CREATE OR REPLACE FUNCTION public.calcular_nivel_paciente(p_xp integer)
RETURNS public.nivel_paciente
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_xp >= 2000 THEN 'diamante'::public.nivel_paciente
    WHEN p_xp >= 1000 THEN 'platina'::public.nivel_paciente
    WHEN p_xp >= 500  THEN 'ouro'::public.nivel_paciente
    WHEN p_xp >= 200  THEN 'prata'::public.nivel_paciente
    ELSE 'bronze'::public.nivel_paciente
  END;
$$;

-- Trigger: atualizar nivel quando xp_total mudar
CREATE OR REPLACE FUNCTION public.atualizar_nivel_paciente()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.nivel_atual := public.calcular_nivel_paciente(COALESCE(NEW.xp_total, 0));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atualizar_nivel_paciente ON public.pacientes;
CREATE TRIGGER trg_atualizar_nivel_paciente
  BEFORE INSERT OR UPDATE OF xp_total ON public.pacientes
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_nivel_paciente();

-- Trigger: debitar XP ao solicitar resgate + validar saldo
CREATE OR REPLACE FUNCTION public.processar_resgate_recompensa()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_xp integer;
  v_estoque integer;
  v_custo integer;
  v_ativa boolean;
  v_terapeuta uuid;
BEGIN
  SELECT xp_custo, estoque, ativa, terapeuta_id
    INTO v_custo, v_estoque, v_ativa, v_terapeuta
    FROM public.recompensas_catalogo WHERE id = NEW.recompensa_id;

  IF NOT FOUND OR NOT v_ativa THEN
    RAISE EXCEPTION 'Recompensa indisponível';
  END IF;

  IF v_estoque IS NOT NULL AND v_estoque <= 0 THEN
    RAISE EXCEPTION 'Recompensa sem estoque';
  END IF;

  SELECT xp_total INTO v_xp FROM public.pacientes WHERE id = NEW.paciente_id;
  IF COALESCE(v_xp, 0) < v_custo THEN
    RAISE EXCEPTION 'XP insuficiente';
  END IF;

  NEW.xp_gasto := v_custo;
  NEW.terapeuta_id := v_terapeuta;

  UPDATE public.pacientes SET xp_total = xp_total - v_custo WHERE id = NEW.paciente_id;
  IF v_estoque IS NOT NULL THEN
    UPDATE public.recompensas_catalogo SET estoque = estoque - 1 WHERE id = NEW.recompensa_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_processar_resgate ON public.recompensas_resgates;
CREATE TRIGGER trg_processar_resgate
  BEFORE INSERT ON public.recompensas_resgates
  FOR EACH ROW EXECUTE FUNCTION public.processar_resgate_recompensa();

-- updated_at triggers
DROP TRIGGER IF EXISTS trg_recompensas_catalogo_updated ON public.recompensas_catalogo;
CREATE TRIGGER trg_recompensas_catalogo_updated
  BEFORE UPDATE ON public.recompensas_catalogo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_recompensas_resgates_updated ON public.recompensas_resgates;
CREATE TRIGGER trg_recompensas_resgates_updated
  BEFORE UPDATE ON public.recompensas_resgates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
