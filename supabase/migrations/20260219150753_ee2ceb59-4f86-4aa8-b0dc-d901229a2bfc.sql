-- Permitir que usuários anônimos (portando um link_id válido) verifam suas tentativas anteriores
-- Necessário para que AvaliacaoPublica.tsx possa verificar numero_tentativa antes de inserir
CREATE POLICY "Leitura pública via link válido"
  ON public.respostas_avaliacao_paciente
  FOR SELECT
  USING (link_avaliacao_valido(link_id));