-- A carteirinha CASSI é o mesmo número da "Matrícula" das guias. Completa o
-- cadastro (pacientes.carteirinha) a partir da matrícula da guia MAIS RECENTE de
-- cada cliente, apenas onde a carteirinha ainda está vazia (não sobrescreve).
update public.pacientes p
set carteirinha = sub.matricula
from (
  select distinct on (g.paciente_id) g.paciente_id, btrim(g.matricula) as matricula
  from public.guias_cassi g
  where g.matricula is not null and btrim(g.matricula) <> ''
  order by g.paciente_id, g.data_pedido desc, g.created_at desc
) sub
where p.id = sub.paciente_id
  and (p.carteirinha is null or btrim(p.carteirinha) = '');
