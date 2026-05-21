
ALTER TABLE public.repasse_config DROP CONSTRAINT IF EXISTS repasse_config_terapeuta_id_profissional_user_id_convenio_id_key;
ALTER TABLE public.repasse_config RENAME COLUMN profissional_user_id TO membro_equipe_id;
ALTER TABLE public.repasse_config
  ADD CONSTRAINT repasse_config_membro_fk FOREIGN KEY (membro_equipe_id) REFERENCES public.equipe_membros(id) ON DELETE CASCADE,
  ADD CONSTRAINT repasse_config_unique UNIQUE (terapeuta_id, membro_equipe_id, convenio_id);
DROP POLICY IF EXISTS "Profissional vê seu próprio repasse" ON public.repasse_config;
DROP INDEX IF EXISTS idx_repasse_lookup;
CREATE INDEX idx_repasse_lookup ON public.repasse_config(terapeuta_id, membro_equipe_id) WHERE ativo;
