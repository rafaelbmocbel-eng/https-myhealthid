-- Limpeza dos nomes de exercícios da biblioteca (GIF bank): remove artefatos da
-- importação/tradução automática — parênteses vazios "()" e o token "converted"
-- — e normaliza espaços. Conservador: só toca nas linhas que têm o artefato.
-- Não resolve fragmentos em inglês soltos (isso pede re-tradução por IA), mas
-- tira o pior do lixo visível.
UPDATE public.biblioteca_exercicios
SET nome = btrim(
      regexp_replace(
        regexp_replace(
          regexp_replace(nome, '\(\s*\)', '', 'g'),   -- parênteses vazios
        '\yconverted\y', '', 'gi'),                    -- token "converted"
      '\s{2,}', ' ', 'g')                              -- espaços duplicados
    )
WHERE nome ~* '\(\s*\)|\yconverted\y';

-- Mesmo tratamento no catálogo de dicas/exercícios (exercicios_biblioteca),
-- caso tenha herdado os mesmos artefatos.
UPDATE public.exercicios_biblioteca
SET nome = btrim(
      regexp_replace(
        regexp_replace(
          regexp_replace(nome, '\(\s*\)', '', 'g'),
        '\yconverted\y', '', 'gi'),
      '\s{2,}', ' ', 'g')
    )
WHERE nome ~* '\(\s*\)|\yconverted\y';
