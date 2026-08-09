-- Preenche a carteirinha (= matrícula/nº do cartão CASSI) no CADASTRO dos clientes
-- a partir da lista conhecida (mesmas matrículas do import de guias), casando por
-- NOME normalizado (sem acento, sem pontuação, minúsculas). Pega inclusive
-- cadastros duplicados/sem guia. Só onde a carteirinha está vazia — não sobrescreve.
create extension if not exists unaccent with schema extensions;

with dados(nome_csv, matricula) as (values
  ('Francisco José Menezes',            '030003434326000061'),
  ('Gabriel Foro Siqueira',             '2302007037390082'),
  ('Leopoldina Tarcila C Pinage',       '0300061672200168'),
  ('Pedro Paulo Macedo Amorim',         '1001004630540010'),
  ('Narlicelma Sobral Santos Ramos',    '2302007010490065'),
  ('Sebastião Almeida da Conceição',    '0300089726300047'),
  ('Ismael Nazareno Monteiro do Amaral','3103001310680058'),
  ('Beatriz Silva Barros',              '1101704278280025'),
  ('Katia Maria de Alvarenga',          '0010060690850051'),
  ('Narayana Borges de Oliveira',       '0010059509950220'),
  ('Márcia Martins de Vasconcelos',     '1321320055180073'),
  ('Maria da Graça Cardoso Sales',      '0300068467790080'),
  ('André Luiz Barbosa Ferreira',       '0300007389760026'),
  ('Maria do Socorro de Souza Silva',   '0300064181100236'),
  ('Pedro Paulo dos Santos',            '0300082798020090'),
  ('José Pantoja de Moraes Filho',      '0300057600400025'),
  ('Judith Maria de Carvalho Francez',  '0300060000170073')
),
norm as (
  select btrim(regexp_replace(regexp_replace(lower(extensions.unaccent(nome_csv)), '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g')) as chave,
         matricula
  from dados
)
update public.pacientes p
set carteirinha = n.matricula
from norm n
where (p.carteirinha is null or btrim(p.carteirinha) = '')
  and p.plano_saude ilike '%cassi%'
  and btrim(regexp_replace(regexp_replace(lower(extensions.unaccent(trim(p.nome) || ' ' || coalesce(trim(p.sobrenome), ''))), '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g')) = n.chave;

notify pgrst, 'reload schema';
