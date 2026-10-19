-- Aplicações clínicas (dinamometria, dosagem, análise angular e laudo do movimento) passam a ser
-- módulo de plano pago. Decisão do Rafael (18/10/2026): só quem paga usa as aplicações e vê o laudo.
-- Vai antes do código que passa a exigir o módulo, para quem já paga não ficar sem acesso.
-- Idempotente: só acrescenta nos planos pagos ativos que ainda não têm o módulo.
update public.planos
   set modulos = modulos || '["aplicacoes"]'::jsonb
 where ativo
   and preco_mensal > 0
   and not (modulos ? 'aplicacoes');
