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
