-- Adiciona o perfil DENTISTA (odontologia) ao enum de profissões.
-- Precisa estar numa migração SEPARADA da que USA o valor (Postgres não deixa
-- usar um valor de enum recém-criado na mesma transação).
ALTER TYPE public.perfil_profissional ADD VALUE IF NOT EXISTS 'dentista';
