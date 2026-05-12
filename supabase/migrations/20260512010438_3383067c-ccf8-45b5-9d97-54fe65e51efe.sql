
-- =========================================================
-- SPRINT 0: Base multi-profissional (dark-launch)
-- =========================================================

-- 1) ENUM de papel
DO $$ BEGIN
  CREATE TYPE public.clinica_papel AS ENUM ('dono', 'profissional', 'recepcao');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.clinica_membro_status AS ENUM ('convidado', 'ativo', 'removido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Tabela clinicas
CREATE TABLE IF NOT EXISTS public.clinicas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dono_user_id uuid NOT NULL,
  nome text NOT NULL,
  ativa boolean NOT NULL DEFAULT false,
  limite_profissionais integer NOT NULL DEFAULT 20,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.clinicas ENABLE ROW LEVEL SECURITY;

-- 3) Tabela clinica_membros
CREATE TABLE IF NOT EXISTS public.clinica_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  papel public.clinica_papel NOT NULL DEFAULT 'profissional',
  status public.clinica_membro_status NOT NULL DEFAULT 'convidado',
  comissao_percentual numeric(5,2),
  convidado_em timestamptz NOT NULL DEFAULT now(),
  aceito_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinica_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_clinica_membros_user ON public.clinica_membros(user_id);
ALTER TABLE public.clinica_membros ENABLE ROW LEVEL SECURITY;

-- 4) Tabela clinica_convites
CREATE TABLE IF NOT EXISTS public.clinica_convites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  email text NOT NULL,
  papel public.clinica_papel NOT NULL DEFAULT 'profissional',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  expira_em timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.clinica_convites ENABLE ROW LEVEL SECURITY;

-- 5) Tabela clinica_pacientes_lixeira
CREATE TABLE IF NOT EXISTS public.clinica_pacientes_lixeira (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL,
  clinica_id uuid REFERENCES public.clinicas(id) ON DELETE CASCADE,
  apagado_por uuid NOT NULL,
  apagado_em timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  motivo text
);
ALTER TABLE public.clinica_pacientes_lixeira ENABLE ROW LEVEL SECURITY;

-- 6) Colunas opcionais (NULL = solo, comportamento atual)
ALTER TABLE public.pacientes        ADD COLUMN IF NOT EXISTS clinica_id uuid;
ALTER TABLE public.agendamentos     ADD COLUMN IF NOT EXISTS clinica_id uuid;
ALTER TABLE public.controle_sessoes ADD COLUMN IF NOT EXISTS profissional_user_id uuid;

-- 7) Função SECURITY DEFINER (sem recursão de RLS)
CREATE OR REPLACE FUNCTION public.has_clinica_role(
  _user_id uuid,
  _clinica_id uuid,
  _papel public.clinica_papel DEFAULT NULL
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clinica_membros
    WHERE clinica_id = _clinica_id
      AND user_id = _user_id
      AND status = 'ativo'
      AND (_papel IS NULL OR papel = _papel)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_clinica_dono(_user_id uuid, _clinica_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clinicas
    WHERE id = _clinica_id AND dono_user_id = _user_id
  );
$$;

-- 8) Triggers updated_at
DROP TRIGGER IF EXISTS trg_clinicas_updated ON public.clinicas;
CREATE TRIGGER trg_clinicas_updated BEFORE UPDATE ON public.clinicas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_clinica_membros_updated ON public.clinica_membros;
CREATE TRIGGER trg_clinica_membros_updated BEFORE UPDATE ON public.clinica_membros
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_clinica_convites_updated ON public.clinica_convites;
CREATE TRIGGER trg_clinica_convites_updated BEFORE UPDATE ON public.clinica_convites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9) RLS — clinicas
CREATE POLICY "Dono gerencia sua clinica" ON public.clinicas
  FOR ALL TO authenticated
  USING (auth.uid() = dono_user_id)
  WITH CHECK (auth.uid() = dono_user_id);

CREATE POLICY "Membros leem sua clinica" ON public.clinicas
  FOR SELECT TO authenticated
  USING (public.has_clinica_role(auth.uid(), id, NULL));

-- 10) RLS — clinica_membros
CREATE POLICY "Dono gerencia membros" ON public.clinica_membros
  FOR ALL TO authenticated
  USING (public.is_clinica_dono(auth.uid(), clinica_id))
  WITH CHECK (public.is_clinica_dono(auth.uid(), clinica_id));

CREATE POLICY "Membros leem equipe" ON public.clinica_membros
  FOR SELECT TO authenticated
  USING (public.has_clinica_role(auth.uid(), clinica_id, NULL));

CREATE POLICY "Usuario le proprio vinculo" ON public.clinica_membros
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 11) RLS — clinica_convites
CREATE POLICY "Dono gerencia convites" ON public.clinica_convites
  FOR ALL TO authenticated
  USING (public.is_clinica_dono(auth.uid(), clinica_id))
  WITH CHECK (public.is_clinica_dono(auth.uid(), clinica_id));

-- 12) RLS — clinica_pacientes_lixeira
CREATE POLICY "Dono gerencia lixeira" ON public.clinica_pacientes_lixeira
  FOR ALL TO authenticated
  USING (public.is_clinica_dono(auth.uid(), clinica_id) OR auth.uid() = apagado_por)
  WITH CHECK (public.is_clinica_dono(auth.uid(), clinica_id) OR auth.uid() = apagado_por);
