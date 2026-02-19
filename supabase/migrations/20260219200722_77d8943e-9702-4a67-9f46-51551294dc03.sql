
-- Fix: Change RESTRICTIVE policies to PERMISSIVE on avaliacoes_identidade
DROP POLICY IF EXISTS "Terapeutas veem suas avaliações identidade" ON public.avaliacoes_identidade;
DROP POLICY IF EXISTS "Terapeutas inserem avaliações identidade" ON public.avaliacoes_identidade;
DROP POLICY IF EXISTS "Terapeutas editam suas avaliações identidade" ON public.avaliacoes_identidade;
DROP POLICY IF EXISTS "Terapeutas deletam suas avaliações identidade" ON public.avaliacoes_identidade;

CREATE POLICY "Terapeutas veem suas avaliações identidade" ON public.avaliacoes_identidade FOR SELECT USING (auth.uid() = terapeuta_id);
CREATE POLICY "Terapeutas inserem avaliações identidade" ON public.avaliacoes_identidade FOR INSERT WITH CHECK (auth.uid() = terapeuta_id);
CREATE POLICY "Terapeutas editam suas avaliações identidade" ON public.avaliacoes_identidade FOR UPDATE USING (auth.uid() = terapeuta_id);
CREATE POLICY "Terapeutas deletam suas avaliações identidade" ON public.avaliacoes_identidade FOR DELETE USING (auth.uid() = terapeuta_id);

-- Fix same issue on avaliacoes_cob_zero
DROP POLICY IF EXISTS "Terapeutas veem suas avaliações cob zero" ON public.avaliacoes_cob_zero;
DROP POLICY IF EXISTS "Terapeutas inserem avaliações cob zero" ON public.avaliacoes_cob_zero;
DROP POLICY IF EXISTS "Terapeutas editam suas avaliações cob zero" ON public.avaliacoes_cob_zero;
DROP POLICY IF EXISTS "Terapeutas deletam suas avaliações cob zero" ON public.avaliacoes_cob_zero;

CREATE POLICY "Terapeutas veem suas avaliações cob zero" ON public.avaliacoes_cob_zero FOR SELECT USING (auth.uid() = terapeuta_id);
CREATE POLICY "Terapeutas inserem avaliações cob zero" ON public.avaliacoes_cob_zero FOR INSERT WITH CHECK (auth.uid() = terapeuta_id);
CREATE POLICY "Terapeutas editam suas avaliações cob zero" ON public.avaliacoes_cob_zero FOR UPDATE USING (auth.uid() = terapeuta_id);
CREATE POLICY "Terapeutas deletam suas avaliações cob zero" ON public.avaliacoes_cob_zero FOR DELETE USING (auth.uid() = terapeuta_id);

-- Fix same issue on other core tables
DROP POLICY IF EXISTS "Terapeutas veem seus pacientes" ON public.pacientes;
DROP POLICY IF EXISTS "Terapeutas inserem pacientes" ON public.pacientes;
DROP POLICY IF EXISTS "Terapeutas editam seus pacientes" ON public.pacientes;
DROP POLICY IF EXISTS "Terapeutas deletam seus pacientes" ON public.pacientes;

CREATE POLICY "Terapeutas veem seus pacientes" ON public.pacientes FOR SELECT USING (auth.uid() = terapeuta_id);
CREATE POLICY "Terapeutas inserem pacientes" ON public.pacientes FOR INSERT WITH CHECK (auth.uid() = terapeuta_id);
CREATE POLICY "Terapeutas editam seus pacientes" ON public.pacientes FOR UPDATE USING (auth.uid() = terapeuta_id);
CREATE POLICY "Terapeutas deletam seus pacientes" ON public.pacientes FOR DELETE USING (auth.uid() = terapeuta_id);

-- Fix profiles
DROP POLICY IF EXISTS "Usuários veem próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuários editam próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuários inserem próprio perfil" ON public.profiles;

CREATE POLICY "Usuários veem próprio perfil" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Usuários editam próprio perfil" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Usuários inserem próprio perfil" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
