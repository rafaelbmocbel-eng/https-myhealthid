
export type SistemaCorporal =
  | 'musculoesqueletico'
  | 'nervoso'
  | 'digestorio'
  | 'circulatorio'
  | 'respiratorio'
  | 'endocrino'
  | 'urinario'
  | 'reprodutor'
  | 'tegumentar'
  | 'linfatico'
  | 'sensorial';

export interface MapeamentoSintoma {
  keywords: string[];
  regioes: string[];
  sistema: SistemaCorporal;
  // When set, overrides the caller's default tipo_diagnostico (e.g. surgical history → 'historico_relatado')
  tipo_diagnostico?: 'achado_clinico' | 'historico_relatado' | 'relato_paciente';
}

export const MAPEAMENTO_SINTOMAS: MapeamentoSintoma[] = [

  // ══════════════════════════════════════════════════════════════════
  // NERVOSO
  // ══════════════════════════════════════════════════════════════════
  {
    keywords: ['cerebro', 'encefalite', 'avc', 'acidente vascular', 'derrame', 'epilepsia', 'convulsao', 'convulsão', 'meningite'],
    regioes: ['cerebro', 'cerebro_p'],
    sistema: 'nervoso'
  },
  {
    keywords: ['cerebelo', 'ataxia', 'descoordenacao', 'descoordenação', 'equilíbrio ruim', 'equilibrio ruim'],
    regioes: ['cerebelo', 'cerebelo_p'],
    sistema: 'nervoso'
  },
  {
    keywords: ['cefaleia', 'enxaqueca', 'dor de cabeça', 'dor de cabeca', 'migrânea', 'migranea', 'cabeça', 'cabeca', 'cranio', 'crânio', 'tcm', 'concussao', 'concussão', 'trauma de cranio', 'trauma crânio', 'traumatismo cranioencefalico', 'traumatismo cranioencefálico', 'tce'],
    regioes: ['cerebro', 'cerebro_p'],
    sistema: 'nervoso'
  },
  {
    keywords: ['insônia', 'insonia', 'distúrbio do sono', 'disturbio do sono', 'sono fragmentado', 'apneia', 'ronco'],
    regioes: ['cerebro'],
    sistema: 'nervoso'
  },
  {
    keywords: ['ansiedade', 'estresse', 'estress', 'depressao', 'depressão', 'transtorno mental', 'psicossocial', 'burn out', 'burnout', 'panico', 'pânico', 'consumo de substancias', 'consumo de substâncias', 'alcool', 'álcool', 'tabagismo', 'fumante', 'dependencia quimica', 'dependência química'],
    regioes: ['cerebro'],
    sistema: 'nervoso'
  },
  {
    keywords: ['formigamento', 'dormência', 'dormencia', 'parestesia', 'choque eletrico', 'queimacao nos bracos', 'queimacao nas pernas'],
    regioes: ['medula_espinhal_v', 'medula_p'],
    sistema: 'nervoso'
  },
  {
    keywords: ['radiculopatia', 'hernia de disco', 'hérnia de disco', 'compressao nervosa', 'compressão nervosa', 'neuropatia', 'neuralgia', 'spurling', 'teste de spurling', 'sinal de spurling', 'compressao foraminal', 'compressão foraminal', 'stenose', 'estenose do canal'],
    regioes: ['medula_espinhal_v', 'medula_p'],
    sistema: 'nervoso'
  },
  {
    keywords: ['ciatica', 'ciática', 'ciatalgia', 'dor ciatica', 'dor ciática', 'nervo ciatico', 'nervo ciático', 'irradiacao para perna', 'lombociatalgia', 'irradiacao para pe', 'irradiação para pé', 'irradiacao para pe esquerdo', 'irradiação para pé esquerdo', 'radiculopatia lombar', 'l4', 'l5', 's1'],
    regioes: ['nervo_ciatico_d', 'nervo_ciatico_e'],
    sistema: 'nervoso'
  },
  {
    keywords: ['irradiacao para pe esquerdo', 'irradiação para pé esquerdo', 'dor no pe esquerdo', 'dor no pé esquerdo', 'lombociatalgia esquerda', 'ciatalgia esquerda'],
    regioes: ['nervo_ciatico_e', 'pe_e', 'pe_e_p'],
    sistema: 'nervoso'
  },
  {
    keywords: ['plexo braquial', 'braquialgia', 'cervicobraquialgia', 'dor no braco com irradiacao', 'irradiacao para maos', 'irradiação para mãos', 'irradiacao para membros superiores', 'irradiação para membros superiores', 'radiculopatia cervical', 'c5', 'c6', 'c7', 'c8'],
    regioes: ['plexo_braquial_d', 'plexo_braquial_e'],
    sistema: 'nervoso'
  },
  {
    keywords: ['irradiacao para maos', 'irradiação para mãos', 'dor nas maos', 'dor nas mãos', 'formigamento nas maos', 'formigamento nas mãos', 'dormencia nas maos', 'dormência nas mãos', 'cervicobraquialgia'],
    regioes: ['mao_d', 'mao_e'],
    sistema: 'musculoesqueletico'
  },
  {
    keywords: ['tontura', 'vertigem', 'labirintite', 'zumbido', 'tinnitus'],
    regioes: ['cerebro', 'tronco_encefalico'],
    sistema: 'nervoso'
  },
  {
    keywords: ['bruxismo', 'ranger dentes', 'dor na mandibula', 'dor na mandíbula', 'atm', 'dtm', 'temporomandibular', 'temporo mandibular', 'disfuncao temporomandibular', 'disfunção temporomandibular', 'disfuncao temporo mandibular', 'disfunção temporo mandibular', 'dor na face'],
    regioes: ['cabeca', 'pescoco'],
    sistema: 'musculoesqueletico'
  },
  {
    keywords: ['neuropatia diabetica', 'neuropatia diabética', 'pe diabetico', 'pé diabético'],
    regioes: ['nervo_ciatico_d', 'nervo_ciatico_e', 'medula_espinhal_v'],
    sistema: 'nervoso'
  },
  {
    keywords: ['fibromialgia', 'dor cronica generalizada', 'dor crônica generalizada', 'sensibilizacao central'],
    regioes: ['cerebro', 'medula_espinhal_v'],
    sistema: 'nervoso'
  },

  // ══════════════════════════════════════════════════════════════════
  // CIRCULATÓRIO
  // ══════════════════════════════════════════════════════════════════
  {
    keywords: ['coracao', 'coração', 'cardio', 'cardiopatia', 'infarto', 'angina', 'arritmia', 'bradicardia', 'flutter', 'fibrilacao', 'fibrilação'],
    regioes: ['coracao'],
    sistema: 'circulatorio'
  },
  {
    keywords: ['palpitacao', 'palpitação', 'taquicardia', 'palpitacoes', 'coração acelerado'],
    regioes: ['coracao'],
    sistema: 'circulatorio'
  },
  {
    keywords: ['pressao alta', 'pressão alta', 'hipertensao', 'hipertensão', 'hipertenso', 'hipertensa', 'has', 'hipertensao arterial', 'hipertensão arterial'],
    regioes: ['coracao', 'aorta_arco'],
    sistema: 'circulatorio',
    tipo_diagnostico: 'historico_relatado',
  },
  {
    keywords: ['pressao baixa', 'pressão baixa', 'hipotensao', 'hipotensão', 'hipotensivo'],
    regioes: ['coracao'],
    sistema: 'circulatorio'
  },
  {
    keywords: ['arteria', 'artéria', 'aorta', 'aneurisma', 'aterosclerose', 'arteriosclerose'],
    regioes: ['aorta_arco', 'coracao'],
    sistema: 'circulatorio'
  },
  {
    keywords: ['insuficiencia cardiaca', 'insuficiência cardíaca', 'edema nos pes', 'edema nos pés', 'ic'],
    regioes: ['coracao'],
    sistema: 'circulatorio'
  },
  {
    keywords: ['trombose', 'tvp', 'coagulo', 'coágulo', 'embolia', 'tromboembolismo', 'varizes', 'insuficiencia venosa'],
    regioes: ['coracao'],
    sistema: 'circulatorio'
  },
  {
    keywords: ['colesterol alto', 'dislipidemia', 'triglicerideos altos', 'hdl baixo', 'ldl alto'],
    regioes: ['coracao', 'figado'],
    sistema: 'circulatorio'
  },

  // ══════════════════════════════════════════════════════════════════
  // RESPIRATÓRIO
  // ══════════════════════════════════════════════════════════════════
  {
    keywords: ['pulmao', 'pulmão', 'pulmoes', 'pulmões', 'pneumonia', 'pleurite', 'pleura', 'pneumotorax'],
    regioes: ['pulmao_d', 'pulmao_e', 'pulmao_d_p', 'pulmao_e_p'],
    sistema: 'respiratorio'
  },
  {
    keywords: ['asma', 'bronquite', 'bronquite', 'dpoc', 'epoc', 'broncoespasmo', 'sibilos', 'chiado no peito'],
    regioes: ['pulmao_d', 'pulmao_e', 'bronquios'],
    sistema: 'respiratorio'
  },
  {
    keywords: ['falta de ar', 'dispneia', 'dispnéia', 'dyspneia', 'cansaco ao esforco', 'cansaço ao esforço', 'intolerancia ao exercicio'],
    regioes: ['pulmao_d', 'pulmao_e'],
    sistema: 'respiratorio'
  },
  {
    keywords: ['tosse cronica', 'tosse crônica', 'tosse seca', 'tosse produtiva', 'hemoptise', 'expectoracao'],
    regioes: ['pulmao_d', 'pulmao_e', 'traqueia'],
    sistema: 'respiratorio'
  },
  {
    keywords: ['traqueia', 'laringite', 'traqueite', 'vias aereas', 'vias aéreas', 'sinusite', 'rinite', 'adenoides'],
    regioes: ['traqueia'],
    sistema: 'respiratorio'
  },
  {
    keywords: ['covid', 'covid-19', 'sequela covid', 'pos covid', 'pós covid', 'long covid'],
    regioes: ['pulmao_d', 'pulmao_e', 'coracao'],
    sistema: 'respiratorio'
  },
  {
    keywords: ['tuberculose', 'tb', 'bacilo', 'bk'],
    regioes: ['pulmao_d', 'pulmao_e'],
    sistema: 'respiratorio'
  },
  {
    keywords: ['enfisema', 'fibrose pulmonar', 'sarcoidose'],
    regioes: ['pulmao_d', 'pulmao_e'],
    sistema: 'respiratorio'
  },

  // ══════════════════════════════════════════════════════════════════
  // DIGESTÓRIO
  // ══════════════════════════════════════════════════════════════════
  {
    keywords: ['estomago', 'estômago', 'gastrite', 'gastrica', 'gástrica', 'ulcera', 'úlcera', 'h pylori', 'helicobacter'],
    regioes: ['estomago'],
    sistema: 'digestorio'
  },
  {
    keywords: ['refluxo', 'azia', 'pirose', 'queimacao', 'queimação', 'gerd', 'drge', 'esofagite'],
    regioes: ['estomago', 'esofago'],
    sistema: 'digestorio'
  },
  {
    keywords: ['esofago', 'esôfago', 'disfagia', 'dificuldade engolir', 'dificuldade para engolir', 'acalasia'],
    regioes: ['esofago'],
    sistema: 'digestorio'
  },
  {
    keywords: ['figado', 'fígado', 'hepatite', 'cirrose', 'esteatose', 'gordura no figado', 'gordura no fígado', 'nash', 'nafld'],
    regioes: ['figado'],
    sistema: 'digestorio'
  },
  {
    keywords: ['vesicula', 'vesícula', 'vesicula biliar', 'colecistite', 'calculo biliar', 'cálculo biliar', 'pedra na vesicula', 'colelitíase', 'colangite'],
    regioes: ['vesicula_biliar'],
    sistema: 'digestorio'
  },
  {
    keywords: ['pancreas', 'pâncreas', 'pancreatite', 'pancreatite cronica', 'pancreatite aguda'],
    regioes: ['pancreas_corpo', 'ilhotas_langerhans'],
    sistema: 'digestorio'
  },
  {
    keywords: ['duodeno', 'duodenite', 'ulcera duodenal', 'úlcera duodenal'],
    regioes: ['duodeno'],
    sistema: 'digestorio'
  },
  {
    keywords: ['intestino', 'intestino delgado', 'intestino grosso', 'ibs', 'sii', 'colon irritavel', 'cólon irritável'],
    regioes: ['intestino_delgado', 'colon_ascendente', 'colon_transverso', 'colon_descendente'],
    sistema: 'digestorio'
  },
  {
    keywords: ['colite', 'colite ulcerativa', 'doenca de crohn', 'doença de crohn', 'dii', 'intestino inflamado'],
    regioes: ['colon_ascendente', 'colon_transverso', 'colon_descendente', 'colon_sigmoide'],
    sistema: 'digestorio'
  },
  {
    keywords: ['constipacao', 'constipação', 'prisao de ventre', 'prisão de ventre', 'intestino preso', 'obstipacao'],
    regioes: ['colon_descendente', 'colon_sigmoide', 'reto'],
    sistema: 'digestorio'
  },
  {
    keywords: ['diarreia', 'diarréia', 'diarreia cronica', 'evacuacoes frequentes', 'fezes liquidas'],
    regioes: ['colon_ascendente', 'colon_transverso', 'intestino_delgado'],
    sistema: 'digestorio'
  },
  {
    keywords: ['gases', 'flatulencia', 'flatulência', 'estufamento', 'bloating', 'distensao abdominal', 'distensão abdominal', 'empachamento'],
    regioes: ['intestino_delgado', 'colon_transverso', 'estomago'],
    sistema: 'digestorio'
  },
  {
    keywords: ['apendice', 'apêndice', 'apendicite'],
    regioes: ['apendice'],
    sistema: 'digestorio'
  },
  {
    keywords: ['reto', 'hemorroidas', 'hemorróidas', 'proctite', 'sangramento retal', 'retorragia'],
    regioes: ['reto'],
    sistema: 'digestorio'
  },
  {
    keywords: ['baco', 'baço', 'esplenomegalia'],
    regioes: ['baco_frente'],
    sistema: 'digestorio'
  },
  {
    keywords: ['nausea', 'náusea', 'enjoo', 'vomito', 'vômito', 'mal estar digestivo'],
    regioes: ['estomago', 'duodeno'],
    sistema: 'digestorio'
  },
  {
    keywords: ['intolerancia a lactose', 'intolerância à lactose', 'intolerancia ao gluten', 'intolerância ao glúten', 'celiaca', 'celíaca', 'doenca celiaca'],
    regioes: ['intestino_delgado'],
    sistema: 'digestorio'
  },
  {
    keywords: ['bariátrica', 'bariatrica', 'cirurgia bariatrica', 'sleeve', 'bypass gastrico', 'bypass gástrico', 'gastroplastia'],
    regioes: ['estomago'],
    sistema: 'digestorio',
    tipo_diagnostico: 'historico_relatado',
  },
  {
    keywords: ['obesidade', 'sobrepeso', 'imc alto', 'excesso de peso', 'sedentario', 'sedentária', 'sedentarismo', 'falta de atividade fisica', 'inatividade fisica', 'inatividade física'],
    regioes: ['estomago', 'figado'],
    sistema: 'digestorio'
  },

  // ══════════════════════════════════════════════════════════════════
  // ENDÓCRINO
  // ══════════════════════════════════════════════════════════════════
  {
    keywords: ['tireoide', 'tireóide', 'hipotireoidismo', 'hipertireoidismo', 'hashimoto', 'graves', 'nodulo na tireoide', 'bócio', 'bocio'],
    regioes: ['tireoide'],
    sistema: 'endocrino'
  },
  {
    keywords: ['diabetes', 'diabetes mellitus', 'dm1', 'dm2', 'tipo 1', 'tipo 2', 'hiperglicemia', 'glicose alta', 'insulinoresistencia', 'insulinorresistência'],
    regioes: ['ilhotas_langerhans', 'pancreas_corpo'],
    sistema: 'endocrino'
  },
  {
    keywords: ['pre diabetes', 'pré diabetes', 'pre-diabetes', 'glicemia de jejum alterada'],
    regioes: ['ilhotas_langerhans'],
    sistema: 'endocrino'
  },
  {
    keywords: ['adrenal', 'cortisol', 'addison', 'cushing', 'insuficiencia adrenal', 'hiperplasia adrenal'],
    regioes: ['adrenal_d', 'adrenal_e', 'adrenal_d_p', 'adrenal_e_p'],
    sistema: 'endocrino'
  },
  {
    keywords: ['hipofise', 'hipófise', 'hormônio do crescimento', 'hormonio do crescimento', 'prolactina', 'acromegalia', 'pan-hipopituitarismo'],
    regioes: ['hipofise'],
    sistema: 'endocrino'
  },
  {
    keywords: ['menopausa', 'menopausa precoce', 'climatério', 'climaterio', 'calor', 'ondas de calor', 'fogacho'],
    regioes: ['ovarios', 'hipofise'],
    sistema: 'endocrino'
  },
  {
    keywords: ['sindrome metabolica', 'síndrome metabólica', 'resistencia insulina', 'resistência à insulina'],
    regioes: ['ilhotas_langerhans', 'adrenal_d', 'adrenal_e'],
    sistema: 'endocrino'
  },

  // ══════════════════════════════════════════════════════════════════
  // URINÁRIO
  // ══════════════════════════════════════════════════════════════════
  {
    keywords: ['rim', 'renal', 'pedra no rim', 'calculo renal', 'cálculo renal', 'nefrolitiase', 'nefrolitíase', 'doenca renal', 'insuficiencia renal'],
    regioes: ['rim_d', 'rim_e'],
    sistema: 'urinario'
  },
  {
    keywords: ['rim direito', 'dor no rim direito', 'calculo renal direito'],
    regioes: ['rim_d'],
    sistema: 'urinario'
  },
  {
    keywords: ['rim esquerdo', 'dor no rim esquerdo', 'calculo renal esquerdo'],
    regioes: ['rim_e'],
    sistema: 'urinario'
  },
  {
    keywords: ['bexiga', 'cistite', 'infeccao urinaria', 'infecção urinária', 'itu', 'uretra', 'uretrite', 'incontinencia urinaria', 'incontinência urinária'],
    regioes: ['bexiga'],
    sistema: 'urinario'
  },
  {
    keywords: ['urgencia urinaria', 'urgência urinária', 'bexiga hiperativa', 'polaciuria', 'poliuria', 'poliúria', 'nocturia', 'noctúria'],
    regioes: ['bexiga'],
    sistema: 'urinario'
  },
  {
    keywords: ['ureter', 'ureteres', 'hidronefrosis', 'hidronefrose', 'obstrucao urinaria', 'obstrução urinária'],
    regioes: ['ureteres', 'rim_d', 'rim_e'],
    sistema: 'urinario'
  },
  {
    keywords: ['proteina na urina', 'proteinuria', 'proteinúria', 'hematuria', 'hematúria', 'sangue na urina', 'nefrite'],
    regioes: ['rim_d', 'rim_e'],
    sistema: 'urinario'
  },

  // ══════════════════════════════════════════════════════════════════
  // REPRODUTOR
  // ══════════════════════════════════════════════════════════════════
  {
    keywords: ['utero', 'útero', 'endometriose', 'mioma', 'fibroide', 'adenomiose', 'dor pelvica', 'dor pélvica'],
    regioes: ['utero'],
    sistema: 'reprodutor'
  },
  {
    keywords: ['histerectomia', 'histerectomia total', 'histerectomia parcial', 'retirada do utero', 'retirada do útero', 'histerectomia abdominal', 'histerectomia vaginal'],
    regioes: ['utero'],
    sistema: 'reprodutor',
    tipo_diagnostico: 'historico_relatado',
  },
  {
    keywords: ['ovario', 'ovário', 'cisto ovariano', 'sindrome dos ovarios policisticos', 'sop', 'anovulacao'],
    regioes: ['ovarios'],
    sistema: 'reprodutor'
  },
  {
    keywords: ['menstruacao', 'menstruação', 'cólica menstrual', 'colica menstrual', 'dismenorreia', 'amenorreia', 'ciclo irregular'],
    regioes: ['utero', 'ovarios'],
    sistema: 'reprodutor'
  },
  {
    keywords: ['prostata', 'próstata', 'hiperplasia prostatica', 'hiperplasia prostática', 'cancer de prostata', 'câncer de próstata', 'prostatite'],
    regioes: ['prostata'],
    sistema: 'reprodutor'
  },
  {
    keywords: ['testiculo', 'testículo', 'dor testicular', 'varicocele', 'hidrocele', 'orquite'],
    regioes: ['testiculos'],
    sistema: 'reprodutor'
  },
  {
    keywords: ['infertilidade', 'infertilidade masculina', 'infertilidade feminina', 'fiv', 'fertilizacao', 'reprodução assistida'],
    regioes: ['utero', 'ovarios', 'testiculos'],
    sistema: 'reprodutor'
  },
  {
    keywords: ['gravidez', 'gestação', 'gestante', 'prenatal', 'pre natal', 'pré-natal', 'obstetricia'],
    regioes: ['utero', 'ovarios'],
    sistema: 'reprodutor'
  },
  {
    keywords: ['incontinencia fecal', 'incontinência fecal', 'prolapso', 'assoalho pelvico', 'assoalho pélvico'],
    regioes: ['utero'],
    sistema: 'reprodutor'
  },

  // ══════════════════════════════════════════════════════════════════
  // LINFÁTICO E IMUNE
  // ══════════════════════════════════════════════════════════════════
  {
    keywords: ['linfonodo', 'linfonodos', 'glandula inchada', 'glândula inchada', 'ganglio', 'linfonodomegalia', 'linfoma'],
    regioes: ['linfonodos_cervicais', 'linfonodos_axilares_d', 'linfonodos_axilares_e', 'linfonodos_inguinais'],
    sistema: 'linfatico'
  },
  {
    keywords: ['linfonodo cervical', 'ganglio no pescoco', 'gânglio no pescoço', 'glandula no pescoco'],
    regioes: ['linfonodos_cervicais'],
    sistema: 'linfatico'
  },
  {
    keywords: ['linfonodo axilar', 'ganglio axilar', 'glandula na axila'],
    regioes: ['linfonodos_axilares_d', 'linfonodos_axilares_e'],
    sistema: 'linfatico'
  },
  {
    keywords: ['linfonodo inguinal', 'ganglio inguinal', 'glandula na virilha', 'glandula na virilha'],
    regioes: ['linfonodos_inguinais'],
    sistema: 'linfatico'
  },
  {
    keywords: ['timo', 'timoma', 'miastenia gravis', 'imunodeficiencia', 'imunodeficiência'],
    regioes: ['timo'],
    sistema: 'linfatico'
  },
  {
    keywords: ['lupus', 'lúpus', 'artrite reumatoide', 'artrite reumatóide', 'doenca autoimune', 'doença autoimune', 'esclerose multipla', 'sjogren'],
    regioes: ['linfonodos_cervicais', 'timo'],
    sistema: 'linfatico'
  },
  {
    keywords: ['anemia', 'leucemia', 'linfoma de hodgkin', 'linfoma nao hodgkin', 'mieloma', 'doenca hematologica'],
    regioes: ['linfonodos_cervicais', 'baco_frente', 'timo'],
    sistema: 'linfatico'
  },

  // ══════════════════════════════════════════════════════════════════
  // MUSCULOESQUELÉTICO — AXIAL
  // ══════════════════════════════════════════════════════════════════
  {
    keywords: ['cervical', 'pescoço', 'pescoco', 'cervicalgia', 'rigidez cervical', 'cervicobraquialgia', 'nucalgia'],
    regioes: ['cervical', 'pescoco'],
    sistema: 'musculoesqueletico'
  },
  {
    keywords: ['lombar', 'lumbago', 'lombalgia', 'dor nas costas', 'dor lombar', 'lombo', 'sacro', 'sacroiliaca', 'sacroilíaca', 'lasegue'],
    regioes: ['lombar', 'gluteos'],
    sistema: 'musculoesqueletico'
  },
  {
    keywords: ['dorsal', 'torácica', 'toracica', 'dorso', 'interescapular', 'coluna dorsal', 'dor interescapular'],
    regioes: ['dorsal', 'trapezio_d', 'trapezio_e'],
    sistema: 'musculoesqueletico'
  },
  {
    keywords: ['trapezio', 'trapézio', 'ombro tenso', 'tensão cervical', 'tensao cervical'],
    regioes: ['trapezio_d', 'trapezio_e', 'cervical'],
    sistema: 'musculoesqueletico'
  },
  {
    keywords: ['escoliose', 'cifose', 'lordose excessiva', 'postura', 'desvio de coluna'],
    regioes: ['dorsal', 'lombar', 'cervical'],
    sistema: 'musculoesqueletico'
  },

  // ══════════════════════════════════════════════════════════════════
  // MUSCULOESQUELÉTICO — MEMBROS SUPERIORES
  // ══════════════════════════════════════════════════════════════════
  {
    keywords: ['ombro direito', 'manguito rotador direito', 'tendinopatia ombro direito'],
    regioes: ['ombro_d', 'trapezio_d'],
    sistema: 'musculoesqueletico'
  },
  {
    keywords: ['ombro esquerdo', 'manguito rotador esquerdo', 'tendinopatia ombro esquerdo'],
    regioes: ['ombro_e', 'trapezio_e'],
    sistema: 'musculoesqueletico'
  },
  {
    keywords: ['ombro', 'manguito rotador', 'impacto subacromial', 'capsulite', 'periartrite'],
    regioes: ['ombro_d', 'ombro_e'],
    sistema: 'musculoesqueletico'
  },
  {
    keywords: ['supraespinhal', 'supraespinhoso', 'supraspinhoso', 'supraespinhais', 'cirurgia de ombro', 'reparo do manguito', 'reconstrucao do manguito', 'reconstrução do manguito', 'artroscopia de ombro', 'acromioplastia'],
    regioes: ['ombro_d', 'ombro_e', 'trapezio_d', 'trapezio_e'],
    sistema: 'musculoesqueletico',
    tipo_diagnostico: 'historico_relatado',
  },
  {
    keywords: ['cotovelo', 'epicondilite', 'tenista', 'golfista', 'olecrano'],
    regioes: ['cotovelo_d', 'cotovelo_e'],
    sistema: 'musculoesqueletico'
  },
  {
    keywords: ['punho', 'mao', 'mão', 'dedos', 'tunel do carpo', 'túnel do carpo', 'phalen', 'tinel', 'tenossinovite'],
    regioes: ['mao_d', 'mao_e', 'antebraco_d', 'antebraco_e'],
    sistema: 'musculoesqueletico'
  },

  // ══════════════════════════════════════════════════════════════════
  // MUSCULOESQUELÉTICO — MEMBROS INFERIORES
  // ══════════════════════════════════════════════════════════════════
  {
    keywords: ['quadril', 'coxofemoral', 'trocanterite', 'piriforme', 'dor no quadril'],
    regioes: ['coxa_d', 'coxa_e', 'gluteos'],
    sistema: 'musculoesqueletico'
  },
  {
    keywords: ['joelho direito', 'menisco direito', 'lca direito'],
    regioes: ['joelho_d'],
    sistema: 'musculoesqueletico'
  },
  {
    keywords: ['joelho esquerdo', 'menisco esquerdo', 'lca esquerdo'],
    regioes: ['joelho_e'],
    sistema: 'musculoesqueletico'
  },
  {
    keywords: ['joelho', 'patela', 'condromalacia', 'menisco', 'ligamento cruzado', 'lca', 'lcp'],
    regioes: ['joelho_d', 'joelho_e'],
    sistema: 'musculoesqueletico'
  },
  {
    keywords: ['tornozelo', 'entorse', 'pe', 'pé', 'fascite plantar', 'tendinite aquiles', 'aquiles', 'halux'],
    regioes: ['pe_d', 'pe_e', 'canela_d', 'canela_e'],
    sistema: 'musculoesqueletico'
  },
  {
    keywords: ['gluteo', 'glúteo', 'gluteos', 'glúteos', 'dor glutea', 'bursite trocanterica'],
    regioes: ['gluteos', 'gluteos_musculares', 'gluteos_p'],
    sistema: 'musculoesqueletico'
  },
  {
    keywords: ['osteoporose', 'osteopenia', 'fratura', 'densitometria', 'calcio osseo', 'baixa densidade ossea', 'baixa densidade óssea', 'desgaste osseo', 'desgaste ósseo', 'degeneracao ossea', 'degeneração óssea', 'artrose', 'artrite', 'degenerativo', 'degeneração', 'degeneracao', 'protrusao discal', 'protrusão discal', 'espondilose'],
    regioes: ['lombar', 'coxa_d', 'coxa_e'],
    sistema: 'musculoesqueletico'
  },

  // ══════════════════════════════════════════════════════════════════
  // TEGUMENTAR
  // ══════════════════════════════════════════════════════════════════
  {
    keywords: ['pele', 'dermatite', 'eczema', 'psoriase', 'psoríase', 'acne', 'urticaria', 'urticária', 'vitiligo'],
    regioes: ['peitoral', 'dorsal'],
    sistema: 'tegumentar'
  },
  {
    keywords: ['alergias de pele', 'coceira', 'prurido', 'alergia cutanea', 'alergia cutânea'],
    regioes: ['peitoral'],
    sistema: 'tegumentar'
  },

  // ══════════════════════════════════════════════════════════════════
  // SENSORIAL
  // ══════════════════════════════════════════════════════════════════
  {
    keywords: ['visao', 'visão', 'olhos', 'miopia', 'astigmatismo', 'catarata', 'glaucoma', 'retina'],
    regioes: ['cerebro'],
    sistema: 'sensorial'
  },
  {
    keywords: ['audicao', 'audição', 'surdez', 'perda auditiva', 'otite', 'zumbido no ouvido'],
    regioes: ['cerebro', 'tronco_encefalico'],
    sistema: 'sensorial'
  },
];

export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function encontrarSintomasEmTexto(
  texto: string,
): { regiao_id: string; sistema: SistemaCorporal; termo: string; tipo_diagnostico?: string }[] {
  const textoNormalizado = normalizarTexto(texto);
  const resultados: { regiao_id: string; sistema: SistemaCorporal; termo: string; tipo_diagnostico?: string }[] = [];

  MAPEAMENTO_SINTOMAS.forEach(mapeamento => {
    mapeamento.keywords.forEach(keyword => {
      const kn = normalizarTexto(keyword.trim());
      // Use word-boundary matching for short abbreviations (≤4 chars) to avoid false positives
      const matched = kn.length <= 4
        ? new RegExp(`(?<![a-z])${kn}(?![a-z])`).test(textoNormalizado)
        : textoNormalizado.includes(kn);
      if (matched) {
        mapeamento.regioes.forEach(regId => {
          if (!resultados.find(r => r.regiao_id === regId)) {
            resultados.push({
              regiao_id: regId,
              sistema: mapeamento.sistema,
              termo: keyword.trim(),
              tipo_diagnostico: mapeamento.tipo_diagnostico,
            });
          }
        });
      }
    });
  });

  return resultados;
}

export function extrairTextoDeObjeto(obj: unknown): string {
  let texto = '';
  if (typeof obj === 'string') return obj;
  if (typeof obj !== 'object' || obj === null) return '';

  Object.entries(obj as Record<string, unknown>).forEach(([key, val]) => {
    if (key.startsWith('score_') && typeof val === 'number') {
      texto += ` ${key.replace('score_', '')}: ${val}/10.`;
    }
    if (typeof val === 'string') {
      texto += ' ' + val;
    } else if (typeof val === 'object') {
      texto += ' ' + extrairTextoDeObjeto(val);
    }
  });

  return texto;
}
