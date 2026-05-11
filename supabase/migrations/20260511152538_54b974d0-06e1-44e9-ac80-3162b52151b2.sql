UPDATE public.pacientes
SET tipo_conta = 'wellness_premium', updated_at = now()
WHERE email ILIKE 'rafaelbmocbel@gmail.com';