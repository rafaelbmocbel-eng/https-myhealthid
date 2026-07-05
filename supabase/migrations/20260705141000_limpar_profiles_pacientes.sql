-- Remove registros de profiles criados incorretamente para usuários que são
-- pacientes (is_patient=true nos metadados). Só remove se não tiver nenhum
-- dado real de profissional associado (config_clinica, pacientes como terapeuta).
DELETE FROM public.profiles p
WHERE EXISTS (
  SELECT 1 FROM auth.users u
  WHERE u.id = p.user_id
    AND (u.raw_user_meta_data->>'is_patient')::boolean = true
)
AND NOT EXISTS (
  SELECT 1 FROM public.config_clinica c WHERE c.terapeuta_id = p.user_id
)
AND NOT EXISTS (
  SELECT 1 FROM public.pacientes pac WHERE pac.terapeuta_id = p.user_id
);
