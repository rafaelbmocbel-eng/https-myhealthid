
-- Tabela de técnicas de tratamento
CREATE TABLE public.tecnicas_tratamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  indicacoes TEXT,
  contraindicacoes TEXT,
  parametros JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS: leitura pública (referência)
ALTER TABLE public.tecnicas_tratamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Todos leem técnicas" ON public.tecnicas_tratamento FOR SELECT USING (true);

-- Seed de técnicas
INSERT INTO public.tecnicas_tratamento (categoria, nome, descricao, indicacoes, contraindicacoes, parametros) VALUES
  ('terapia_manual', 'Liberação Miofascial', 'Técnica de liberação de pontos gatilhos e fáscias', 'Dor muscular, tensão, restrição de movimento', 'Inflamação aguda, fraturas', '{"pressao": "moderada", "duracao": "5-10 min"}'),
  ('terapia_manual', 'Liberação de Tecidos Moles', 'Massagem terapêutica profunda', 'Contraturas, aderências', 'Lesões agudas', '{"tecnica": "deslizamento profundo"}'),
  ('terapia_manual', 'Liberação de Tecidos Rígidos', 'Técnicas de mobilização de tecidos fibróticos', 'Cicatrizes, aderências crônicas', 'Feridas abertas', '{"intensidade": "progressiva"}'),
  ('terapia_manual', 'Mobilização Neural', 'Técnicas de neurodinâmica', 'Compressão nervosa, radiculopatia', 'Sinais neurológicos graves', '{"amplitude": "tolerável", "repeticoes": "10-15"}'),
  ('terapia_manual', 'Manipulação Articular', 'Thrust de alta velocidade e baixa amplitude', 'Restrição articular, dor mecânica', 'Osteoporose severa, instabilidade', '{"tipo": "HVLA"}'),
  ('terapia_manual', 'Mobilização Articular Grau I-IV', 'Técnicas de Maitland', 'Dor, rigidez articular', 'Hipermobilidade', '{"grau": "I-IV", "ritmo": "lento"}'),
  ('eletroterapia', 'Laser (LLLT)', 'Terapia com laser de baixa potência', 'Inflamação, cicatrização, dor', 'Câncer ativo, gravidez (abdômen)', '{"potencia": "3-5J/cm²", "comprimento_onda": "808-904nm"}'),
  ('eletroterapia', 'LED Terapia', 'Fototerapia com diodos emissores de luz', 'Cicatrização, regeneração tecidual', 'Fotossensibilidade', '{"cor": "vermelho/infravermelho", "tempo": "10-20 min"}'),
  ('eletroterapia', 'TENS', 'Estimulação elétrica nervosa transcutânea', 'Dor aguda e crônica', 'Marcapasso, epilepsia', '{"frequencia": "2-150Hz", "modo": "burst/convencional"}'),
  ('eletroterapia', 'EMS (Estimulação Muscular)', 'Eletroestimulação muscular', 'Fortalecimento, atrofia muscular', 'Trombose recente', '{"frequencia": "30-50Hz", "on_off": "5s/10s"}'),
  ('eletroterapia', 'tDCS', 'Estimulação transcraniana por corrente contínua', 'Dor crônica, neuroplasticidade', 'Implantes metálicos cranianos', '{"corrente": "1-2mA", "duracao": "20 min"}'),
  ('eletroterapia', 'Ultrassom Terapêutico', 'Ondas ultrassônicas para aquecimento profundo', 'Contraturas, aderências', 'Áreas com metal, gestação', '{"frequencia": "1-3MHz", "modo": "pulsado/continuo"}'),
  ('eletroterapia', 'Ondas Curtas / Microondas', 'Diatermia por ondas eletromagnéticas', 'Dor profunda, rigidez', 'Implantes metálicos, gestação', '{"potencia": "baixa/media"}'),
  ('tracao', 'Tração Cervical', 'Descompressão da coluna cervical', 'Hérnia discal, radiculopatia cervical', 'Instabilidade, fraturas', '{"carga": "5-15kg", "tempo": "10-15 min"}'),
  ('tracao', 'Tração Lombar', 'Descompressão da coluna lombar', 'Hérnia discal lombar, ciática', 'Espondilolistese, osteoporose severa', '{"carga": "25-50% peso corporal", "tempo": "15-20 min"}'),
  ('tracao', 'Tração Manual', 'Descompressão articular manual', 'Restrição articular, dor', 'Hipermobilidade', '{"duracao": "30-60s", "repeticoes": "3-5"}'),
  ('outros', 'Crioterapia', 'Aplicação de gelo terapêutico', 'Inflamação aguda, edema', 'Doença de Raynaud', '{"tempo": "15-20 min", "ciclos": "2-3"}'),
  ('outros', 'Termoterapia', 'Aplicação de calor superficial', 'Dor crônica, rigidez', 'Inflamação aguda', '{"temperatura": "40-45°C", "tempo": "15-20 min"}'),
  ('outros', 'Ventosaterapia', 'Sucção por copas de vidro/silicone', 'Tensão muscular, dor miofascial', 'Lesões cutâneas', '{"tipo": "seca/molhada", "tempo": "10-15 min"}'),
  ('outros', 'Bandagem Funcional', 'Kinesio taping', 'Suporte muscular, edema, propriocepção', 'Alergias a adesivos', '{"tecnica": "muscular/linfatica/articular"}');
