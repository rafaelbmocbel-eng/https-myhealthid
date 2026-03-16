
-- Add comprovante storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprovantes', 'comprovantes', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: patients upload their own receipts
CREATE POLICY "Pacientes upload comprovantes"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'comprovantes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Storage policy: patients read their own receipts
CREATE POLICY "Pacientes leem comprovantes"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'comprovantes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Storage policy: therapists read receipts of their patients
CREATE POLICY "Terapeutas leem comprovantes"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'comprovantes'
  AND EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.user_id::text = (storage.foldername(name))[1]
      AND p.terapeuta_id = auth.uid()
  )
);

-- RLS: Pacientes can read their own payments
CREATE POLICY "Pacientes leem próprios pagamentos"
ON public.pagamentos_paciente
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.id = pagamentos_paciente.paciente_id
      AND p.user_id = auth.uid()
  )
);

-- RLS: Pacientes can insert their own payments
CREATE POLICY "Pacientes inserem pagamentos"
ON public.pagamentos_paciente
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.id = pagamentos_paciente.paciente_id
      AND p.user_id = auth.uid()
      AND p.terapeuta_id = pagamentos_paciente.terapeuta_id
  )
);

-- RLS: Pacientes can update comprovante on their own payments
CREATE POLICY "Pacientes atualizam comprovante"
ON public.pagamentos_paciente
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.id = pagamentos_paciente.paciente_id
      AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.id = pagamentos_paciente.paciente_id
      AND p.user_id = auth.uid()
  )
);

-- Enable realtime for pagamentos_paciente
ALTER PUBLICATION supabase_realtime ADD TABLE public.pagamentos_paciente;
