-- Atualiza os códigos e valores do Controle CASSI do Rafael conforme a lista que ele passou em 25/10/2026
-- (012, 020, 301, 131 e 185). Só mexe nesses códigos da configuração dele (cassi_config.codigos): o valor, a descrição
-- e o código oficial passam a ser os da lista; os que não existiam entram no fim; os demais (144, 160, os que ele
-- criou) ficam como estão. Antes de mexer, guarda uma cópia da configuração numa tabela de backup.
-- Quem não tem configuração salva continua usando os padrões do app (mesmos valores), então nada muda para essas contas.

CREATE TABLE IF NOT EXISTS public.bkp_cassi_config_codigos_20261025 (
  terapeuta_id uuid PRIMARY KEY,
  codigos jsonb NOT NULL,
  copiado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bkp_cassi_config_codigos_20261025 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bkp_cassi_config_codigos_20261025 FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.bkp_cassi_config_codigos_20261025 TO service_role;
COMMENT ON TABLE public.bkp_cassi_config_codigos_20261025 IS
  'Cópia de cassi_config.codigos antes da atualização de 25/10/2026 (tabela de códigos da CASSI). Pode ser apagada depois de conferida.';

DO $$
DECLARE
  v_ter uuid;
  v_atual jsonb;
  v_novo jsonb;
  v_padrao jsonb := '[
    {"codigo":"012","descricao":"Sessão de psicomotricidade individual","valor":57.7,"codigo_oficial":"50000012"},
    {"codigo":"020","descricao":"Sessão de psicomotricidade em grupo","valor":57.7,"codigo_oficial":"50000020"},
    {"codigo":"301","descricao":"Infiltração de ponto gatilho (por músculo) ou agulhamento seco (por músculo)","valor":35.55,"codigo_oficial":"20103301"},
    {"codigo":"131","descricao":"Biofeedback com EMG","valor":67.79,"codigo_oficial":"20103131"},
    {"codigo":"185","descricao":"Estimulação elétrica transcutânea","valor":108.44,"codigo_oficial":"31602185"}
  ]'::jsonb;
BEGIN
  -- Os RAISE NOTICE contam, no log do db push, qual caminho a migração tomou (ela nunca falha por não achar a conta).
  SELECT id INTO v_ter FROM auth.users WHERE lower(email) = 'rafaelbmocbel@gmail.com' ORDER BY created_at ASC NULLS LAST LIMIT 1;
  IF v_ter IS NOT NULL THEN
    RAISE NOTICE 'cassi_config_codigos: conta achada pelo e-mail';
  ELSIF (SELECT count(*) FROM public.cassi_config) = 1 THEN
    -- E-mail não achado e uma única configuração na base: é a dele (o Controle CASSI é só dele).
    SELECT terapeuta_id INTO v_ter FROM public.cassi_config;
    RAISE NOTICE 'cassi_config_codigos: e-mail não achado; usando a única configuração existente';
  END IF;
  IF v_ter IS NULL THEN
    RAISE NOTICE 'cassi_config_codigos: nenhuma conta identificada; nada foi alterado';
    RETURN;
  END IF;

  SELECT codigos INTO v_atual FROM public.cassi_config WHERE terapeuta_id = v_ter;
  IF v_atual IS NULL OR jsonb_typeof(v_atual) <> 'array' OR jsonb_array_length(v_atual) = 0 THEN -- sem lista salva: valem os padrões do app
    RAISE NOTICE 'cassi_config_codigos: a conta não tem lista de códigos salva; nada foi alterado';
    RETURN;
  END IF;

  INSERT INTO public.bkp_cassi_config_codigos_20261025 (terapeuta_id, codigos) VALUES (v_ter, v_atual)
  ON CONFLICT (terapeuta_id) DO NOTHING;

  -- Cada item atual cujo código está na lista recebe os dados da lista por cima (campos extras dele ficam); os outros ficam como estão.
  v_novo := coalesce((
    SELECT jsonb_agg(
      CASE WHEN p.item IS NOT NULL AND jsonb_typeof(c.item) = 'object' THEN c.item || p.item ELSE c.item END
      ORDER BY c.ord)
    FROM jsonb_array_elements(v_atual) WITH ORDINALITY AS c(item, ord)
    LEFT JOIN jsonb_array_elements(v_padrao) AS p(item)
      ON jsonb_typeof(c.item) = 'object' AND p.item ->> 'codigo' = c.item ->> 'codigo'
  ), '[]'::jsonb);

  -- Os da lista que ainda não existiam entram no fim.
  v_novo := v_novo || coalesce((
    SELECT jsonb_agg(p.item)
    FROM jsonb_array_elements(v_padrao) AS p(item)
    WHERE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_atual) AS c(item)
      WHERE jsonb_typeof(c.item) = 'object' AND c.item ->> 'codigo' = p.item ->> 'codigo'
    )
  ), '[]'::jsonb);

  UPDATE public.cassi_config SET codigos = v_novo, updated_at = now() WHERE terapeuta_id = v_ter;
  RAISE NOTICE 'cassi_config_codigos: atualizado (% itens antes, % depois; 144 fica como estava: %)',
    jsonb_array_length(v_atual), jsonb_array_length(v_novo),
    coalesce((SELECT c.item ->> 'valor' FROM jsonb_array_elements(v_novo) AS c(item) WHERE jsonb_typeof(c.item) = 'object' AND c.item ->> 'codigo' = '144' LIMIT 1), 'sem 144');
END $$;

NOTIFY pgrst, 'reload schema';
