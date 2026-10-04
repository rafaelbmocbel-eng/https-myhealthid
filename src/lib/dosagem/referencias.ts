// Fontes citadas pela dosagem de eletrotermofototerapia. Cada número clínico do
// app aponta para um destes ids. Só entram valores lidos no resumo/texto do
// artigo (PubMed); o que não foi encontrado fica marcado como "sem dose
// confirmada" nas telas, nunca completado de memória.

export interface ReferenciaDosagem {
  id: string;
  autores: string;
  ano: number;
  revista: string;
  pmid: string;
  doi?: string;
  /** Para que a fonte é usada no app. */
  uso: string;
}

export const REFERENCIAS_DOSAGEM: ReferenciaDosagem[] = [
  // ── Laser / fotobiomodulação ───────────────────────────────────────────
  { id: 'jenkins2011', autores: 'Jenkins PA, Carroll JD', ano: 2011, revista: 'Photomed Laser Surg 29(12):785-7', pmid: '22107486', doi: '10.1089/pho.2011.9895',
    uso: 'Parâmetros que precisam ser registrados (comprimento de onda, potência, tempo, área do feixe na pele, pulso, local, nº e intervalo das sessões) e as três medidas de dose: tempo, energia e densidade de energia. A potência cai com o aquecimento e a idade do aparelho.' },
  { id: 'naterstad2022', autores: 'Naterstad e cols.', ano: 2022, revista: 'BMJ Open', pmid: '36171024', doi: '10.1136/bmjopen-2021-059479',
    uso: 'Mínimos WALT por ponto em tendinopatia (Aquiles, patelar) e fascite plantar: 904 nm ≥ 2 J; 780–860 nm ≥ 4 J; 2–3 pontos no tendão. Doses recomendadas: dor −14,98 mm EVA vs placebo.' },
  { id: 'stausholm2019', autores: 'Stausholm e cols.', ano: 2019, revista: 'BMJ Open', pmid: '31662383', doi: '10.1136/bmjopen-2019-031142',
    uso: 'Osteoartrite de joelho: ≥ 4 J (780–860 nm) e ≥ 1 J (904 nm) por ponto na linha articular; faixas estudadas 4–8 J e 1–3 J; contínuo exige 4× a dose do superpulsado.' },
  { id: 'leal2015', autores: 'Leal-Junior e cols.', ano: 2015, revista: 'Lasers Med Sci 30(2):925-39', pmid: '24249354', doi: '10.1007/s10103-013-1465-4',
    uso: 'Desempenho/recuperação muscular: aplicar antes do exercício, 50–200 mW, 5 a 6 J por ponto.' },
  { id: 'walt2022', autores: 'WALT (artigo de posicionamento)', ano: 2022, revista: 'Front Oncol', pmid: '36110957', doi: '10.3389/fonc.2022.927685',
    uso: 'Energia ou densidade de energia isoladas não bastam para repetir um tratamento; processo não térmico (< 45 °C); cautela em pacientes oncológicos; diferença entre o declarado pelo fabricante e o desempenho real.' },
  { id: 'tumilty2010', autores: 'Tumilty e cols.', ano: 2010, revista: 'Photomed Laser Surg 28(1):3-16', pmid: '19708800', doi: '10.1089/pho.2008.2470',
    uso: 'Tendinopatias: “janela de dose eficaz” semelhante às diretrizes (Aquiles −13,6 mm EVA; epicondilite +9,59 kg de preensão).' },
  { id: 'chow2009', autores: 'Chow e cols.', ano: 2009, revista: 'Lancet 374:1897-908', pmid: '19913903', doi: '10.1016/S0140-6736(09)61522-1',
    uso: 'Dor cervical: redução de 19,86 mm na EVA. O resumo não traz dose por ponto.' },
  { id: 'haslerud2015', autores: 'Haslerud e cols.', ano: 2015, revista: 'Physiother Res Int', pmid: '25450903', doi: '10.1002/pri.1606',
    uso: 'Ombro: ensaios com dose inadequada foram ineficazes em todos os desfechos.' },

  // ── Ultrassom terapêutico ──────────────────────────────────────────────
  { id: 'draper1995', autores: 'Draper, Castel e Castel', ano: 1995, revista: 'J Orthop Sports Phys Ther 22(4):142', pmid: '8535471', doi: '10.2519/jospt.1995.22.4.142',
    uso: 'Taxa de aquecimento do tríceps sural (adultos saudáveis, 10 min): 1 MHz 0,04 / 0,16 / 0,33 / 0,38 °C/min e 3 MHz 0,3 / 0,58 / 0,89 / 1,4 °C/min a 0,5 / 1,0 / 1,5 / 2,0 W/cm².' },
  { id: 'draper1995b', autores: 'Draper e Ricard', ano: 1995, revista: 'J Athl Train', pmid: '16558352',
    uso: 'Janela de alongamento: em média 3,3 min depois do ultrassom de 3 MHz a 1,5 W/cm² até ≥ 5 °C.' },
  { id: 'draper2010', autores: 'Draper e cols.', ano: 2010, revista: 'J Athl Train 45(4):333', pmid: '20617906', doi: '10.4085/1062-6050-45.4.333',
    uso: 'Tendão de Aquiles, 3 MHz a 1 W/cm² por 10 min: gel aqueceu +13,3 °C; almofada de 1 cm +9,3 °C; de 2 cm +6,5 °C.' },
  { id: 'rigby2015', autores: 'Rigby e cols.', ano: 2015, revista: 'J Athl Train 50(11)', pmid: '26509683', doi: '10.4085/1062-6050-50.11.03',
    uso: 'Ultrassom de 3 MHz a 0,132 W/cm² por até 3 h: +1 °C em 10 ± 5 min e +4 °C em 80 ± 10 min.' },
  { id: 'johns2007', autores: 'Johns e cols.', ano: 2007, revista: 'Arch Phys Med Rehabil', pmid: '17207688', doi: '10.1016/j.apmr.2006.09.016',
    uso: 'Sete transdutores do mesmo modelo: ERA, potência e BNR variaram; juntos geraram 50% de variação na intensidade (SAI).' },
  { id: 'hekkenberg1994', autores: 'Hekkenberg e cols.', ano: 1994, revista: 'Ultrasound Med Biol', pmid: '8197630', doi: '10.1016/0301-5629(94)90020-5',
    uso: 'O BNR (razão de não uniformidade do feixe) de um transdutor não deve passar de 8.' },
  { id: 'ferrari2010', autores: 'Ferrari e cols.', ano: 2010, revista: 'Ultrasonics', pmid: '20207388', doi: '10.1016/j.ultras.2010.02.006',
    uso: 'No Brasil, de 31 aparelhos, só 32,3% estavam de acordo com a norma IEC 61689 em potência e ERA.' },
  { id: 'robertson2001', autores: 'Robertson e Baker', ano: 2001, revista: 'Phys Ther', pmid: '11444997',
    uso: 'Revisão de ensaios (1975–1999): pouca evidência de que o ultrassom ativo supere o placebo; as doses variavam sem motivo claro.' },
  { id: 'cota2023', autores: 'Cota e cols.', ano: 2023, revista: 'Eur J Phys Rehabil Med', pmid: '36723056', doi: '10.23736/S1973-9087.22.07715-2',
    uso: 'Tendinite calcária do ombro: 1 MHz, 1,5 W/cm², 10 min (4500 J), 4 semanas + exercícios; calcificação −10,92% vs −5,04% (n = 46).' },
  { id: 'subhikshaa2026', autores: 'Subhikshaa e cols.', ano: 2026, revista: 'Front Oral Health', pmid: '42723852', doi: '10.3389/froh.2026.1923134',
    uso: 'Dor muscular da ATM: 1 MHz, 1,0 W/cm² contínuo, 10 min/dia por 7 dias, melhor que medicação a curto prazo (n = 36).' },
  { id: 'luo2024', autores: 'Luo e cols.', ano: 2024, revista: 'Heliyon', pmid: '38803857', doi: '10.1016/j.heliyon.2024.e30874',
    uso: 'Osteoartrite de joelho (21 ensaios): pulsado ≤ 2,5 W/cm², 24 sessões com melhor alívio; o resumo é ambíguo quanto à duração.' },
  { id: 'page2013', autores: 'Page e cols. (Cochrane)', ano: 2013, revista: 'Cochrane Database Syst Rev', pmid: '23543580', doi: '10.1002/14651858.CD009601.pub2',
    uso: 'Síndrome do túnel do carpo: só evidência de baixa qualidade a favor do ultrassom; sem regime preferível.' },
  { id: 'qing2021', autores: 'Qing e cols.', ano: 2021, revista: 'Arch Phys Med Rehabil', pmid: '33722564', doi: '10.1016/j.apmr.2021.02.009',
    uso: 'Cervicalgia: o ultrassom pode reduzir a dor mais que placebo ou nada; benefício adicional incerto.' },

  // ── Ondas de choque ────────────────────────────────────────────────────
  { id: 'schmitz2015', autores: 'Schmitz e cols.', ano: 2015, revista: 'Br Med Bull', pmid: '26585999', doi: '10.1093/bmb/ldv047',
    uso: 'Protocolo geral: 3 sessões com 1 semana de intervalo, 2000 impulsos, maior EFD tolerado sem anestesia local. EFD média dos ensaios 0,19 mJ/mm² (0,03–0,78). Limite baixa/alta de 0,2 mJ/mm² é arbitrário.' },
  { id: 'gerdesmeyer2008', autores: 'Gerdesmeyer e cols.', ano: 2008, revista: 'Am J Sports Med', pmid: '18832341', doi: '10.1177/0363546508324176',
    uso: 'Fascite plantar, radial: 0,16 mJ/mm², 2000 impulsos, 3 aplicações.' },
  { id: 'gollwitzer2015', autores: 'Gollwitzer e cols.', ano: 2015, revista: 'J Bone Joint Surg Am', pmid: '25948515', doi: '10.2106/JBJS.M.01331',
    uso: 'Fascite plantar, focal: 0,25 mJ/mm², 3 sessões de 2000 impulsos, semanais. Só dor e edema passageiros.' },
  { id: 'rompe1998', autores: 'Rompe e cols.', ano: 1998, revista: 'Schmerz', pmid: '12799977', doi: '10.1007/s004829800048',
    uso: 'Epicondilite lateral: 0,08 mJ/mm², 3 × 1000 impulsos.' },
  { id: 'rompe2004', autores: 'Rompe e cols.', ano: 2004, revista: 'Am J Sports Med', pmid: '15090392', doi: '10.1177/0363546503261697',
    uso: 'Epicondilite lateral: baixa energia, uma vez por semana por 3 semanas.' },
  { id: 'gerdesmeyer2003', autores: 'Gerdesmeyer e cols.', ano: 2003, revista: 'JAMA 290(19):2573', pmid: '14625334', doi: '10.1001/jama.290.19.2573',
    uso: 'Ombro calcificante: alta energia superior à baixa; 2 sessões com cerca de 2 semanas de intervalo.' },
  { id: 'surace2020', autores: 'Surace e cols. (Cochrane)', ano: 2020, revista: 'Cochrane Database Syst Rev', pmid: '32128761', doi: '10.1002/14651858.CD008962.pub2',
    uso: 'Ombro: “alta dose” = 0,2 a 0,4 mJ/mm² ou mais; poucos benefícios clínicos importantes; mais eventos adversos que placebo (RR 3,61).' },
  { id: 'notarnicola2023', autores: 'Notarnicola e cols.', ano: 2023, revista: 'J Pers Med', pmid: '37373965', doi: '10.3390/jpm13060976',
    uso: 'Dor trocantérica: 3 sessões semanais, 2000 impulsos a 4 Hz, EFD de 0,03 a 0,17 mJ/mm².' },
  { id: 'suputtitada2022', autores: 'Suputtitada e cols.', ano: 2022, revista: 'Medicina', pmid: '35454318', doi: '10.3390/medicina58040479',
    uso: 'Pontos-gatilho do trapézio, radial: EFD+ 0,10 mJ/mm², 2000 impulsos, 3 sessões semanais (piloto, n = 60).' },
  { id: 'liu2025', autores: 'Liu e Zhang', ano: 2025, revista: 'Am J Phys Med Rehabil', pmid: '39750027', doi: '10.1097/PHM.0000000000002694',
    uso: 'Espasticidade pós-AVC: efeito maior com frequência < 8 Hz e pressão < 2 bar; radial melhor que focal.' },
  { id: 'cacchio2009', autores: 'Cacchio e cols.', ano: 2009, revista: 'J Bone Joint Surg Am', pmid: '19884432', doi: '10.2106/JBJS.H.00841',
    uso: 'Pseudoartrose de ossos longos, focal: 0,40 ou 0,70 mJ/mm², 4000 impulsos, 4 tratamentos.' },
  { id: 'reilly2018', autores: 'Reilly, Bluman e Tenforde', ano: 2018, revista: 'PM&R', pmid: '29775801', doi: '10.1016/j.pmrj.2018.05.007',
    uso: 'Complicações raras: 2 casos de lesão óssea e ruptura do Aquiles em idosos com onda focal.' },
  { id: 'moen2011', autores: 'Moen e cols.', ano: 2011, revista: 'Br J Sports Med', pmid: '21393260', doi: '10.1136/bjsm.2010.081992',
    uso: 'Estresse tibial medial: onda focal, 5 sessões em 9 semanas (estudo observacional).' },
  { id: 'katolicky2025', autores: 'Katolický e cols.', ano: 2025, revista: 'Int J Surg', pmid: '40146243', doi: '10.1097/JS9.0000000000002351',
    uso: 'Tendinopatia patelar: 4 sessões semanais. Evidência conflitante entre revisões.' },
  // ── TENS ───────────────────────────────────────────────────────────────
  { id: 'johnson2022', autores: 'Johnson e cols.', ano: 2022, revista: 'BMJ Open (meta-TENS)', pmid: '35144946', doi: '10.1136/bmjopen-2021-051073',
    uso: 'TENS forte e não doloroso, no local ou perto da dor, reduziu a dor durante ou logo após o uso (SMD −0,96, certeza moderada). Frequência não modifica o resultado quando a sensação é forte; os estudos tinham ≤ 250 pps, ≤ 500 µs e ≤ 60 mA pico a pico. Eventos adversos leves.' },
  { id: 'aarskog2007', autores: 'Aarskog, Johnson e cols.', ano: 2007, revista: 'Physiother Res Int', pmid: '17957730', doi: '10.1002/pri.384',
    uso: 'Voluntários saudáveis, 100 Hz, 150 µs, 20 min: o limiar de dor à pressão subiu com intensidade forte e confortável, não com a de limiar sensorial.' },
  { id: 'bjordal2003', autores: 'Bjordal, Johnson e Ljunggreen', ano: 2003, revista: 'Eur J Pain', pmid: '12600800', doi: '10.1016/S1090-3801(02)00098-8',
    uso: 'Dor pós-operatória: TENS forte e subnocivo na área da ferida reduziu o consumo de analgésicos em 35,5% contra 4,1% com estimulação inadequada. Convencional 25–150 Hz; tipo acupuntura 1–8 Hz.' },
  { id: 'amer2026', autores: 'Amer-Cuenca, Lisón e cols.', ano: 2026, revista: 'Eur J Pain', pmid: '41615263', doi: '10.1002/ejp.70222',
    uso: 'Dor lombar crônica: efeito global não significativo (certeza baixa), mas intensidade adequada d = 0,97 contra 0,30 com a inadequada. Intensidade fixa ou que provoque contração não é recomendada.' },
  { id: 'bueno2026', autores: 'Bueno-López e cols.', ano: 2026, revista: 'Osteoarthr Cartil Open', pmid: '41852773', doi: '10.1016/j.ocarto.2026.100765',
    uso: 'Osteoartrite de joelho: maior alívio com estimulação ≥ 40 min; frequência, intensidade e nº de sessões não moderaram.' },
  { id: 'han2024', autores: 'Han e cols. (Cochrane)', ano: 2024, revista: 'Cochrane Database Syst Rev', pmid: '39037764', doi: '10.1002/14651858.CD013331.pub2',
    uso: 'Dismenorreia primária: TENS de alta e de baixa frequência podem reduzir a dor (certeza baixa).' },
  { id: 'babazadeh2022', autores: 'Babazadeh-Zavieh e cols.', ano: 2022, revista: 'Complement Med Res', pmid: '36412569', doi: '10.1159/000528133',
    uso: 'Dor pélvica: ao menos 20 min, 50–400 µs, 2–120 Hz; alta frequência com intensidade máxima tolerada foi mais eficaz.' },
  { id: 'johnson2017', autores: 'Johnson, Claydon e cols. (Cochrane)', ano: 2017, revista: 'Cochrane Database Syst Rev', pmid: '28990665', doi: '10.1002/14651858.CD012172.pub2',
    uso: 'Fibromialgia: evidência de qualidade insuficiente para apoiar ou refutar o TENS.' },
  { id: 'sahebari2026', autores: 'Sahebari e cols.', ano: 2026, revista: 'Pain Med', pmid: '41071642', doi: '10.1093/pm/pnaf133',
    uso: 'Fibromialgia (revisão de revisões): alívio de curto prazo, sobretudo com intensidades mais altas e 10 ou mais sessões; certeza baixa a moderada.' },
  { id: 'gibson2017', autores: 'Gibson, Wand e O’Connell (Cochrane)', ano: 2017, revista: 'Cochrane Database Syst Rev', pmid: '28905362', doi: '10.1002/14651858.CD011976.pub2',
    uso: 'Dor neuropática: não se pode afirmar se o TENS funciona (qualidade muito baixa); intensidade de formigamento confortável; só irritação de pele como evento adverso.' },
  { id: 'walsh2009', autores: 'Walsh, Howe, Johnson e Sluka (Cochrane)', ano: 2009, revista: 'Cochrane Database Syst Rev', pmid: '19370629', doi: '10.1002/14651858.CD006142.pub2',
    uso: 'Dor aguda no adulto: sem conclusão definitiva sobre o TENS isolado.' },
  { id: 'digby2009', autores: 'Digby e cols.', ano: 2009, revista: 'Europace', pmid: '19411677', doi: '10.1093/europace/eup102',
    uso: 'Dispositivos de ritmo cardíaco: TENS, diatermia e corrente interferencial são “melhor evitar”, sem consenso; talvez possíveis com monitorização do dispositivo e do paciente.' },

  // ── FES / NMES ─────────────────────────────────────────────────────────
  { id: 'peng2021', autores: 'Peng e cols.', ano: 2021, revista: 'Front Med', pmid: '34926522', doi: '10.3389/fmed.2021.779019',
    uso: 'Pós-artroplastia de joelho: protocolos dos ensaios (30–100 Hz, 300 µs a 5 ms, de 15 min a 2 h) e meta-análise: força SMD 0,81 em 1 mês, mas vários desfechos sem atingir a diferença clinicamente importante.' },
  { id: 'yue2018', autores: 'Yue e cols.', ano: 2018, revista: 'J Arthroplasty', pmid: '29530519', doi: '10.1016/j.arth.2018.01.070',
    uso: 'Pós-artroplastia: benefício máximo com 1 ou 2 aplicações por dia por 4–6 semanas, 100–120 mA e 30–100 Hz.' },
  { id: 'maffiuletti2013', autores: 'Maffiuletti, Roig, Karatzanos e Nanas', ano: 2013, revista: 'BMC Med', pmid: '23701811', doi: '10.1186/1741-7015-11-137',
    uso: 'UTI: 8–100 Hz, 250–400 µs, on:off de 12:6, 8:24, 4:6 e 2:4 s, 25–60 min por dia; o torque evocado é o principal determinante e não foi relatado. Não usar com lesões de pele, fraturas traumáticas, lesão completa de neurônio motor inferior e marca-passo.' },
  { id: 'doucet2012', autores: 'Doucet e cols.', ano: 2012, revista: 'Yale J Biol Med', pmid: '22737049',
    uso: 'Revisão de parâmetros: a maioria dos regimes usa 20–50 Hz; abaixo de 16 Hz não bastou para levar o joelho a 40°; ciclo de 1:3 é comum; rampas de 1–3 s; marcha com FES: 3–5 sessões de 1 h por semana, ≥ 4 semanas; FES-cycling: pulsos de 300–600 µs.' },
  { id: 'neyroud2014', autores: 'Neyroud e cols.', ano: 2014, revista: 'J Appl Physiol', pmid: '24674861', doi: '10.1152/japplphysiol.01015.2013',
    uso: 'Tríceps sural de 14 saudáveis: pulso largo e alta frequência (100 Hz, 1000 µs) causaram mais fadiga que o convencional (25 Hz, 50 µs).' },
  { id: 'martin2016', autores: 'Martin e cols.', ano: 2016, revista: 'Med Sci Sports Exerc', pmid: '27031743', doi: '10.1249/MSS.0000000000000930',
    uso: 'Tríceps sural de 11 saudáveis: perda de força (−26%) e mudanças metabólicas semelhantes entre pulso largo com alta frequência e o convencional.' },
  { id: 'labanca2022', autores: 'Labanca e cols.', ano: 2022, revista: 'Int J Rehabil Res', pmid: '35256573', doi: '10.1097/MRR.0000000000000525',
    uso: 'Pós-artroplastia: NMES de curta duração e baixa intensidade tem efeito limitado na força do quadríceps.' },
  { id: 'bistolfi2018', autores: 'Bistolfi e cols.', ano: 2018, revista: 'Am J Phys Med Rehabil', pmid: '29016401', doi: '10.1097/PHM.0000000000000847',
    uso: 'Pós-artroplastia: sem diferença a médio e longo prazo.' },
  { id: 'volpato2015', autores: 'Volpato e cols.', ano: 2015, revista: 'Einstein (São Paulo)', pmid: '26537511', doi: '10.1590/S1679-45082015RW3140',
    uso: 'Pós-artroplastia: menos eficaz que a reabilitação tradicional em função, força e amplitude, mas útil para ativar o quadríceps nos primeiros dias.' },
  { id: 'kim2010', autores: 'Kim e cols.', ano: 2010, revista: 'J Orthop Sports Phys Ther', pmid: '20592480', doi: '10.2519/jospt.2010.3184',
    uso: 'Pós-LCA: NMES com exercício pode fortalecer mais o quadríceps que só exercício; efeito funcional inconclusivo; parâmetros inconsistentes.' },
  { id: 'bax2005', autores: 'Bax e cols.', ano: 2005, revista: 'Sports Med', pmid: '15730336', doi: '10.2165/00007256-200535030-00002',
    uso: 'Quadríceps: NMES faz sentido comparada a não fazer exercício, mas o exercício voluntário parece mais eficaz na maioria das situações.' },
  { id: 'kottink2004', autores: 'Kottink e cols.', ano: 2004, revista: 'Artif Organs', pmid: '15153151', doi: '10.1111/j.1525-1594.2004.07310.x',
    uso: 'Pé caído pós-AVC com FES: melhora conjunta da velocidade de marcha de 0,13 m/s (38%).' },
  { id: 'dunning2015', autores: 'Dunning e cols.', ano: 2015, revista: 'Am J Phys Med Rehabil', pmid: '26035725', doi: '10.1097/PHM.0000000000000308',
    uso: 'Pé caído pós-AVC: estimulação e órtese tornozelo-pé parecem eficazes e “equivalentes” para a velocidade de marcha.' },
  { id: 'miller2017', autores: 'Miller e cols.', ano: 2017, revista: 'Arch Phys Med Rehabil', pmid: '28088382', doi: '10.1016/j.apmr.2016.12.007',
    uso: 'Esclerose múltipla: efeito ortótico na velocidade de marcha em testes curtos (+0,05 e +0,08 m/s), sem efeito terapêutico.' },

  // ── Corrente russa ─────────────────────────────────────────────────────
  { id: 'ward2002', autores: 'Ward e Shkuratova', ano: 2002, revista: 'Phys Ther', pmid: '12350217',
    uso: 'Regime de Kots “10/50/10” (10 s de estímulo, 50 s de repouso, por 10 min) e 2,5 kHz; as comparações entre pulsada monofásica e russa são inconclusivas.' },
  { id: 'ward2009', autores: 'Ward', ano: 2009, revista: 'Phys Ther', pmid: '19095805', doi: '10.2522/ptj.20080060',
    uso: 'Parâmetros usuais (russa e interferencial) são subótimos; sugere bursts retangulares curtos de 2–4 ms.' },
  { id: 'akinoglu2020', autores: 'Akınoğlu e Kocahan', ano: 2020, revista: 'J Exerc Rehabil', pmid: '32724785', doi: '10.12965/jer.2040260.130',
    uso: 'Atletas (n = 10): 2500 Hz, 50 pulsos/s, 200 µs, on/off 10/10 s, 20 min, 12 sessões em 6 semanas, 70% do limiar máximo de dor tolerado; sem vantagem da russa sobre HVPC.' },
  { id: 'hasan2024', autores: 'Hasan e cols.', ano: 2024, revista: 'PLoS One', pmid: '38271360', doi: '10.1371/journal.pone.0297136',
    uso: 'Saudáveis (n = 48), sessão única de 15 min: 2500 Hz, burst de 50 Hz, 2 s on / 2 s off, tolerância 7/10; efeito agudo no torque, não ganho de força.' },
  { id: 'dasilva2015', autores: 'da Silva e cols.', ano: 2015, revista: 'Physiother Theory Pract', pmid: '26467544', doi: '10.3109/09593985.2015.1064191',
    uso: 'Meta-análise (7 estudos, 127 saudáveis): a pulsada não foi melhor que a kHz em torque evocado, e o desconforto foi igual.' },
  { id: 'vaz2017', autores: 'Vaz e Frasson', ano: 2017, revista: 'Arch Phys Med Rehabil', pmid: '29247626', doi: '10.1016/j.apmr.2017.12.001',
    uso: 'Revisão de escopo (15 artigos): a evidência não sustenta que a corrente alternada de kHz seja melhor que a pulsada de baixa frequência para fortalecer.' },
  { id: 'dantas2015', autores: 'Dantas e cols.', ano: 2015, revista: 'Muscle Nerve', pmid: '24809656', doi: '10.1002/mus.24280',
    uso: 'Quadríceps de 21 mulheres: com desconforto comparável, o torque evocado da russa foi menor (50,8%) que o das outras correntes (70,1–76,9%).' },

  // ── Corrente interferencial ────────────────────────────────────────────
  { id: 'rampazo2022', autores: 'Rampazo e cols.', ano: 2022, revista: 'Medicina (Kaunas)', pmid: '35056448', doi: '10.3390/medicina58010141',
    uso: 'Revisão narrativa: duas correntes de média frequência (> 1 a < 10 kHz); batimento (AMF) = diferença entre elas (0–250 Hz); ensaios: 4 kHz, AMF de 30–180 Hz, 20–40 min, forte e confortável; a maioria dos parâmetros parece não influenciar a analgesia; efeitos atribuídos a faixas de AMF vêm mais da experiência que de evidência.' },
  { id: 'facci2011', autores: 'Facci e cols.', ano: 2011, revista: 'Sao Paulo Med J', pmid: '21971895', doi: '10.1590/s1516-31802011000400003',
    uso: 'Lombalgia crônica (n = 150): 4000 Hz, tetrapolar, 30 min, 10 sessões em 2 semanas, eletrodos de 5 × 5 cm; interferencial e TENS equivalentes, ambos melhores que sem tratamento.' },
  { id: 'ata2024', autores: 'Ata e cols.', ano: 2024, revista: 'Turk J Phys Med Rehabil', pmid: '40028403', doi: '10.5606/tftrd.2024.12390',
    uso: 'Osteoartrite de joelho (n = 61): 2, 4 ou 8 kHz, 100 Hz, 20 min por dia, 5 por semana, 3 semanas, eletrodos de 5 × 5 cm; todos melhoraram, sem portadora superior.' },
  { id: 'varapirom2024', autores: 'Varapirom e cols.', ano: 2024, revista: 'Clin Rehabil', pmid: '39257067', doi: '10.1177/02692155241278949',
    uso: 'Osteoartrite de joelho (n = 144): 4000 Hz, 100 Hz, 20 min, 3 semanas; diferença abaixo da mínima clinicamente importante e sem efeito na semana 6.' },
  { id: 'dias2021', autores: 'Dias e cols.', ano: 2021, revista: 'J Bodyw Mov Ther', pmid: '34391232', doi: '10.1016/j.jbmt.2021.03.005',
    uso: 'Lombalgia crônica (n = 280), aplicação única de 30 min: todas as correntes aliviaram mais que placebo, com destaque para 4 kHz a 100 Hz.' },
  { id: 'hurley2001', autores: 'Hurley e cols.', ano: 2001, revista: 'Arch Phys Med Rehabil', pmid: '11295009', doi: '10.1053/apmr.2001.21934',
    uso: 'Lombalgia aguda (n = 60): 3,85 kHz, 140 Hz, pulso de 130 µs, 30 min; melhor incapacidade com a posição “nervo espinal”.' },
  { id: 'fuentes2010', autores: 'Fuentes e cols.', ano: 2010, revista: 'Phys Ther', pmid: '20651012', doi: '10.2522/ptj.20090335',
    uso: 'Primeira revisão sistemática: interferencial isolada não foi melhor que placebo ou outra terapia; heterogeneidade impede conclusão.' },
  { id: 'hussein2021', autores: 'Hussein e cols.', ano: 2021, revista: 'Am J Phys Med Rehabil', pmid: '34469914', doi: '10.1097/PHM.0000000000001870',
    uso: 'Dor musculoesquelética: interferencial, sozinha ou associada, não foi mais eficaz que os tratamentos comparados.' },
  { id: 'chen2022', autores: 'Chen e cols.', ano: 2022, revista: 'Sci Rep', pmid: '35690604', doi: '10.1038/s41598-022-13478-6',
    uso: 'Osteoartrite de joelho (10 ensaios, 493 pacientes): dor de curto prazo SMD −0,64 e de longo prazo −0,36.' },
  { id: 'wang2025', autores: 'Wang e cols.', ano: 2025, revista: 'Ann Phys Rehabil Med', pmid: '41275581', doi: '10.1016/j.rehab.2025.102056',
    uso: 'Lombalgia crônica (rede de 15 ensaios): interferencial SMD −0,96; certeza baixa.' },
  { id: 'schulz2025', autores: 'Schulz e cols.', ano: 2025, revista: 'J Rehabil Med', pmid: '40833250', doi: '10.2340/jrm.v57.43941',
    uso: 'Esternotomia (n = 200): 4 kHz, 10–20 mA, 18 min, 6 sessões em 21 dias, formigamento no limiar sensitivo. Exclusões: implantes metálicos, dispositivos eletrônicos, infecção de ferida, DAOP III/IV, febre e câncer com risco de metástase; só 2 casos graves de queimadura na literatura, ligados a hipoestesia e eletrodo mal posicionado.' },
  { id: 'kadi2019', autores: 'Kadí e cols.', ano: 2019, revista: 'Clin Rehabil', pmid: '30764635', doi: '10.1177/0269215519829856',
    uso: 'Artroplastia total de joelho: sem diferença em dor, amplitude e edema contra placebo.' },
  { id: 'yu2015', autores: 'Yu e cols.', ano: 2015, revista: 'Phys Ther', pmid: '25394425', doi: '10.2522/ptj.20140361',
    uso: 'Dor de ombro: fita, ultrassom e interferencial não foram eficazes.' },

  // ── Segurança em eletroterapia ─────────────────────────────────────────
  { id: 'daia2026', autores: 'Daia e cols.', ano: 2026, revista: 'J Clin Med', pmid: '42513462', doi: '10.3390/jcm15145548',
    uso: 'Revisão narrativa: a eletroterapia pode ser contraindicada com doença aguda, descompensação grave, doença cardiovascular não controlada, dispositivos eletrônicos implantados e trombose ativa. Ultrassom: a contraindicação principal é lesão maligna ativa no campo, e não o câncer em si.' },
];

const POR_ID = new Map(REFERENCIAS_DOSAGEM.map((r) => [r.id, r]));
export const referencia = (id: string) => POR_ID.get(id);
export const rotuloReferencia = (id: string) => {
  const r = POR_ID.get(id);
  if (!r) return id;
  const primeiro = r.autores.split(/[ ,]/)[0];
  return `${primeiro} ${r.ano}`;
};
export const urlPubmed = (pmid: string) => `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
