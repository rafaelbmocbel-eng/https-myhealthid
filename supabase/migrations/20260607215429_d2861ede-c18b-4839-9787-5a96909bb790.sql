
-- Prescrições médicas
CREATE TABLE public.prescricoes_paciente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL,
  terapeuta_id uuid NOT NULL,
  itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  orientacoes text,
  tipo text NOT NULL DEFAULT 'simples',
  data_emissao date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescricoes_paciente TO authenticated;
GRANT ALL ON public.prescricoes_paciente TO service_role;
ALTER TABLE public.prescricoes_paciente ENABLE ROW LEVEL SECURITY;
CREATE POLICY presc_owner_all ON public.prescricoes_paciente FOR ALL TO authenticated
  USING (auth.uid() = terapeuta_id) WITH CHECK (auth.uid() = terapeuta_id);
CREATE INDEX presc_pac_idx ON public.prescricoes_paciente(paciente_id, data_emissao DESC);
CREATE TRIGGER trg_presc_updated BEFORE UPDATE ON public.prescricoes_paciente
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atestados médicos
CREATE TABLE public.atestados_medicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL,
  terapeuta_id uuid NOT NULL,
  dias_afastamento int NOT NULL DEFAULT 1,
  data_inicio date NOT NULL DEFAULT CURRENT_DATE,
  cid_codigo text,
  cid_descricao text,
  motivo text,
  tipo text NOT NULL DEFAULT 'atestado',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atestados_medicos TO authenticated;
GRANT ALL ON public.atestados_medicos TO service_role;
ALTER TABLE public.atestados_medicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY atest_owner_all ON public.atestados_medicos FOR ALL TO authenticated
  USING (auth.uid() = terapeuta_id) WITH CHECK (auth.uid() = terapeuta_id);
CREATE INDEX atest_pac_idx ON public.atestados_medicos(paciente_id, data_inicio DESC);
CREATE TRIGGER trg_atest_updated BEFORE UPDATE ON public.atestados_medicos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed medicamentos catálogo (60 comuns)
INSERT INTO public.medicamentos_catalogo (nome, principio_ativo, apresentacao, posologia_sugerida, classe) VALUES
('Dipirona 500mg','Dipirona sódica','Comprimido 500mg','1 cp VO 6/6h se dor','Analgésico'),
('Paracetamol 750mg','Paracetamol','Comprimido 750mg','1 cp VO 6/6h se dor','Analgésico'),
('Ibuprofeno 600mg','Ibuprofeno','Comprimido 600mg','1 cp VO 8/8h após refeição','AINE'),
('Nimesulida 100mg','Nimesulida','Comprimido 100mg','1 cp VO 12/12h por 5 dias','AINE'),
('Diclofenaco sódico 50mg','Diclofenaco','Comprimido 50mg','1 cp VO 8/8h por 5 dias','AINE'),
('Cetoprofeno 100mg','Cetoprofeno','Comprimido 100mg','1 cp VO 12/12h por 5 dias','AINE'),
('Meloxicam 15mg','Meloxicam','Comprimido 15mg','1 cp VO 1x/dia por 7 dias','AINE'),
('Naproxeno 500mg','Naproxeno sódico','Comprimido 500mg','1 cp VO 12/12h','AINE'),
('Cetorolaco 10mg','Cetorolaco','Comprimido 10mg','1 cp VO/SL 8/8h por 3 dias','AINE'),
('Codeína 30mg + Paracetamol 500mg','Codeína/Paracetamol','Comprimido','1 cp VO 6/6h se dor','Analgésico opioide'),
('Tramadol 50mg','Tramadol','Cápsula 50mg','1 cáp VO 8/8h se dor','Analgésico opioide'),
('Ciclobenzaprina 10mg','Ciclobenzaprina','Comprimido 10mg','1 cp VO à noite por 7 dias','Relaxante muscular'),
('Tizanidina 2mg','Tizanidina','Comprimido 2mg','1 cp VO 8/8h','Relaxante muscular'),
('Orfenadrina 35mg + Dipirona + Cafeína','Associação','Comprimido','1 cp VO 8/8h','Relaxante muscular'),
('Prednisona 20mg','Prednisona','Comprimido 20mg','1 cp VO 1x/dia em jejum por 5 dias','Corticoide'),
('Prednisolona 20mg','Prednisolona','Comprimido 20mg','1 cp VO 1x/dia em jejum','Corticoide'),
('Dexametasona 4mg','Dexametasona','Comprimido 4mg','1 cp VO 1x/dia','Corticoide'),
('Betametasona 0,5mg','Betametasona','Comprimido','1 cp VO 1x/dia','Corticoide'),
('Pregabalina 75mg','Pregabalina','Cápsula 75mg','1 cáp VO 12/12h','Anticonvulsivante/Dor'),
('Gabapentina 300mg','Gabapentina','Cápsula 300mg','1 cáp VO 8/8h','Anticonvulsivante/Dor'),
('Amitriptilina 25mg','Amitriptilina','Comprimido 25mg','1 cp VO à noite','Antidepressivo tricíclico'),
('Duloxetina 30mg','Duloxetina','Cápsula 30mg','1 cáp VO 1x/dia','ISRSN'),
('Sertralina 50mg','Sertralina','Comprimido 50mg','1 cp VO 1x/dia pela manhã','ISRS'),
('Escitalopram 10mg','Escitalopram','Comprimido 10mg','1 cp VO 1x/dia','ISRS'),
('Fluoxetina 20mg','Fluoxetina','Cápsula 20mg','1 cáp VO 1x/dia pela manhã','ISRS'),
('Clonazepam 2mg','Clonazepam','Comprimido 2mg','1/2 cp VO à noite','Benzodiazepínico'),
('Alprazolam 0,5mg','Alprazolam','Comprimido 0,5mg','1 cp VO até 3x/dia','Benzodiazepínico'),
('Zolpidem 10mg','Zolpidem','Comprimido 10mg','1 cp VO ao deitar','Hipnótico'),
('Omeprazol 20mg','Omeprazol','Cápsula 20mg','1 cáp VO em jejum por 30 dias','IBP'),
('Pantoprazol 40mg','Pantoprazol','Comprimido 40mg','1 cp VO em jejum','IBP'),
('Esomeprazol 40mg','Esomeprazol','Comprimido 40mg','1 cp VO em jejum','IBP'),
('Ranitidina 150mg','Ranitidina','Comprimido 150mg','1 cp VO 12/12h','Antagonista H2'),
('Bromoprida 10mg','Bromoprida','Comprimido 10mg','1 cp VO 8/8h antes refeição','Procinético'),
('Ondansetrona 8mg','Ondansetrona','Comprimido 8mg','1 cp VO 8/8h','Antiemético'),
('Loratadina 10mg','Loratadina','Comprimido 10mg','1 cp VO 1x/dia','Anti-histamínico'),
('Desloratadina 5mg','Desloratadina','Comprimido 5mg','1 cp VO 1x/dia','Anti-histamínico'),
('Dexclorfeniramina 2mg','Dexclorfeniramina','Comprimido 2mg','1 cp VO 8/8h','Anti-histamínico'),
('Amoxicilina 500mg','Amoxicilina','Cápsula 500mg','1 cáp VO 8/8h por 7 dias','Antibiótico'),
('Amoxicilina + Clavulanato 875+125mg','Amoxicilina/Clavulanato','Comprimido','1 cp VO 12/12h por 7-10 dias','Antibiótico'),
('Azitromicina 500mg','Azitromicina','Comprimido 500mg','1 cp VO 1x/dia por 3-5 dias','Antibiótico'),
('Cefalexina 500mg','Cefalexina','Cápsula 500mg','1 cáp VO 6/6h por 7 dias','Antibiótico'),
('Ciprofloxacino 500mg','Ciprofloxacino','Comprimido 500mg','1 cp VO 12/12h por 7 dias','Antibiótico'),
('Sulfametoxazol+Trimetoprima 800/160mg','SMZ/TMP','Comprimido','1 cp VO 12/12h por 7-10 dias','Antibiótico'),
('Losartana 50mg','Losartana potássica','Comprimido 50mg','1 cp VO 1x/dia','Anti-hipertensivo BRA'),
('Enalapril 10mg','Enalapril','Comprimido 10mg','1 cp VO 12/12h','Anti-hipertensivo IECA'),
('Anlodipino 5mg','Anlodipino','Comprimido 5mg','1 cp VO 1x/dia','Anti-hipertensivo BCC'),
('Hidroclorotiazida 25mg','Hidroclorotiazida','Comprimido 25mg','1 cp VO 1x/dia pela manhã','Diurético'),
('Atenolol 50mg','Atenolol','Comprimido 50mg','1 cp VO 1x/dia','Betabloqueador'),
('Metformina 850mg','Metformina','Comprimido 850mg','1 cp VO 12/12h após refeição','Antidiabético'),
('Glibenclamida 5mg','Glibenclamida','Comprimido 5mg','1 cp VO antes café','Antidiabético'),
('Sinvastatina 20mg','Sinvastatina','Comprimido 20mg','1 cp VO à noite','Estatina'),
('Atorvastatina 20mg','Atorvastatina','Comprimido 20mg','1 cp VO 1x/dia','Estatina'),
('Levotiroxina 50mcg','Levotiroxina sódica','Comprimido 50mcg','1 cp VO em jejum 30min antes café','Hormônio tireoidiano'),
('Vitamina D 7000 UI','Colecalciferol','Cápsula 7000 UI','1 cáp VO 1x/semana','Suplemento'),
('Vitamina B12 5000mcg','Cianocobalamina','Comprimido SL','1 cp SL 1x/dia','Suplemento'),
('Sulfato ferroso 40mg','Sulfato ferroso','Comprimido 40mg','1 cp VO em jejum','Suplemento'),
('Cálcio + Vitamina D','Cálcio/Colecalciferol','Comprimido','1 cp VO 1x/dia','Suplemento'),
('Diclofenaco gel 1%','Diclofenaco dietilamônio','Gel 60g','Aplicar fina camada 3x/dia local','Anti-inflamatório tópico'),
('Cetoprofeno gel 2,5%','Cetoprofeno','Gel 50g','Aplicar 2-3x/dia local','Anti-inflamatório tópico'),
('Calêndula pomada','Calendula officinalis','Pomada','Aplicar 2x/dia','Cicatrizante tópico'),
('Lidocaína 2% gel','Lidocaína','Gel anestésico','Aplicação tópica conforme orientação','Anestésico tópico')
ON CONFLICT DO NOTHING;
