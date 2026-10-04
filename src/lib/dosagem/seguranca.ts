import type { Modalidade } from './tipos';

// Contraindicações e precauções por modalidade.
// `fonte`:
//   'literatura' → o texto vem de um artigo lido na pesquisa (ids em `refs`).
//   'classica'   → lista de uso corrente na prática da eletrotermofototerapia
//                  que a pesquisa NÃO conseguiu ancorar em artigo. Fica marcada
//                  e deve ser conferida com o manual do aparelho.
// `padroes`: palavras que, achadas no prontuário do paciente, acendem o alerta.

export interface ItemSeguranca {
  id: string;
  modalidades: Modalidade[];
  titulo: string;
  detalhe: string;
  gravidade: 'contraindicacao' | 'precaucao';
  fonte: 'literatura' | 'classica';
  refs?: string[];
  padroes?: RegExp[];
}

const P = {
  gestacao: [/gest(a|ante|acao)/, /gravid/, /\bgravida\b/],
  marcapasso: [/marca[- ]?passo/, /\bcdi\b/, /desfibrilador/, /dispositivo cardiaco/],
  neoplasia: [/cancer/, /neoplas/, /tumor/, /oncolog/, /quimioter/, /radioter/, /carcinoma/, /linfoma/, /melanoma/, /metastase/],
  trombose: [/trombose/, /\btvp\b/, /tromboflebite/, /embolia/],
  anticoag: [/anticoag/, /varfarina/, /marevan/, /rivaroxabana/, /xarelto/, /apixabana/, /eliquis/, /dabigatrana/, /clopidogrel/, /hemofilia/, /coagulopatia/, /plaquetopenia/],
  infeccao: [/infecc/, /infecciosa/, /abscesso/, /celulite infecciosa/, /osteomielite/],
  hipoestesia: [/hipoestesia/, /anestesia/, /neuropatia/, /perda de sensibilidade/, /diabetes/],
  isquemia: [/isquemi/, /insuficiencia arterial/, /doenca arterial/],
  epifise: [/crianca/, /pediatric/, /epifis/, /adolescente/],
  tatuagem: [/tatuagem/, /tatuag/],
  fotossens: [/fotossensib/, /fotodermatose/, /lupus/, /porfiria/],
  implante: [/protese/, /implante/, /parafuso/, /placa metalica/, /artroplastia/, /haste/],
  osteoporose: [/osteoporose/, /osteopenia/, /fratura por fragilidade/],
  corticoide: [/corticoide/, /infiltrac/, /cortisona/],
  tireoide: [/tireoide/, /tireoidite/, /hipertireoidismo/, /bocio/],
  hemorragia: [/hemorrag/, /hematoma extenso/],
};

export const ITENS_SEGURANCA: ItemSeguranca[] = [
  // ── Laser ──
  { id: 'laser_neoplasia', modalidades: ['laser'], gravidade: 'precaucao', fonte: 'literatura', refs: ['walt2022'],
    titulo: 'Neoplasia ativa ou histórico oncológico na área',
    detalhe: 'Trate com cautela: não se pode ignorar a possibilidade de a fotobiomodulação alterar o comportamento do tumor em alguns casos. Em oncologia, só com o time responsável.', padroes: P.neoplasia },
  { id: 'laser_termico', modalidades: ['laser'], gravidade: 'precaucao', fonte: 'literatura', refs: ['walt2022'],
    titulo: 'Manter o efeito não térmico',
    detalhe: 'O processo esperado é não térmico (abaixo de 45 °C). Se o paciente referir calor desconfortável, interrompa e reduza a potência ou aumente a distância.' },
  { id: 'laser_olhos', modalidades: ['laser'], gravidade: 'contraindicacao', fonte: 'classica',
    titulo: 'Olhos: proteção ocular para paciente e terapeuta',
    detalhe: 'Nunca direcionar o feixe aos olhos; use os óculos específicos para o comprimento de onda do aparelho.' },
  { id: 'laser_gestacao', modalidades: ['laser'], gravidade: 'contraindicacao', fonte: 'classica',
    titulo: 'Gestação: abdome e região pélvica', detalhe: 'Evitar aplicação sobre o abdome e a pelve da gestante.', padroes: P.gestacao },
  { id: 'laser_tireoide', modalidades: ['laser'], gravidade: 'precaucao', fonte: 'classica',
    titulo: 'Tireoide', detalhe: 'Evitar aplicação direta sobre a glândula.', padroes: P.tireoide },
  { id: 'laser_fotossens', modalidades: ['laser'], gravidade: 'precaucao', fonte: 'classica',
    titulo: 'Fotossensibilidade', detalhe: 'Doenças fotossensíveis ou medicamentos fotossensibilizantes: avalie antes de irradiar.', padroes: P.fotossens },
  { id: 'laser_tatuagem', modalidades: ['laser'], gravidade: 'precaucao', fonte: 'classica',
    titulo: 'Tatuagem ou pigmentação intensa na área', detalhe: 'O pigmento absorve mais luz e pode aquecer ou queimar a pele.', padroes: P.tatuagem },
  { id: 'laser_epifise', modalidades: ['laser'], gravidade: 'precaucao', fonte: 'classica',
    titulo: 'Crianças e adolescentes', detalhe: 'Cuidado sobre placas de crescimento abertas.', padroes: P.epifise },

  // ── Ultrassom ──
  { id: 'us_gestacao', modalidades: ['ultrassom'], gravidade: 'contraindicacao', fonte: 'classica',
    titulo: 'Gestação: útero e abdome', detalhe: 'Não aplicar sobre o útero gravídico nem no abdome da gestante.', padroes: P.gestacao },
  { id: 'us_neoplasia', modalidades: ['ultrassom'], gravidade: 'contraindicacao', fonte: 'classica',
    titulo: 'Neoplasia na região', detalhe: 'Não aplicar sobre tumor ou área de tratamento oncológico.', padroes: P.neoplasia },
  { id: 'us_trombose', modalidades: ['ultrassom'], gravidade: 'contraindicacao', fonte: 'classica',
    titulo: 'Trombose venosa ou tromboflebite', detalhe: 'Risco de mobilizar trombo: não aplicar sobre a região afetada.', padroes: P.trombose },
  { id: 'us_marcapasso', modalidades: ['ultrassom'], gravidade: 'precaucao', fonte: 'classica',
    titulo: 'Marca-passo ou dispositivo cardíaco implantado', detalhe: 'Evitar a região torácica e conferir o manual do dispositivo.', padroes: P.marcapasso },
  { id: 'us_epifise', modalidades: ['ultrassom'], gravidade: 'contraindicacao', fonte: 'classica',
    titulo: 'Epífises de crescimento abertas', detalhe: 'Não aplicar sobre as placas de crescimento de crianças e adolescentes.', padroes: P.epifise },
  { id: 'us_isquemia', modalidades: ['ultrassom'], gravidade: 'precaucao', fonte: 'classica',
    titulo: 'Isquemia ou sensibilidade diminuída', detalhe: 'O paciente pode não perceber o aquecimento excessivo; reduza a intensidade e mantenha o transdutor em movimento.', padroes: [...P.isquemia, ...P.hipoestesia] },
  { id: 'us_infeccao', modalidades: ['ultrassom'], gravidade: 'contraindicacao', fonte: 'classica',
    titulo: 'Infecção aguda na região', detalhe: 'Evitar aplicar sobre foco infeccioso.', padroes: P.infeccao },
  { id: 'us_hemorragia', modalidades: ['ultrassom'], gravidade: 'contraindicacao', fonte: 'classica',
    titulo: 'Hemorragia ou tendência a sangramento', detalhe: 'Não aplicar na região com sangramento ativo ou coagulopatia.', padroes: [...P.hemorragia, ...P.anticoag] },
  { id: 'us_implante', modalidades: ['ultrassom'], gravidade: 'precaucao', fonte: 'classica',
    titulo: 'Implantes e próteses', detalhe: 'Cuidado com próteses cimentadas ou de plástico na região; confira o material.', padroes: P.implante },
  { id: 'us_equipamento', modalidades: ['ultrassom'], gravidade: 'precaucao', fonte: 'literatura', refs: ['johns2007', 'ferrari2010', 'hekkenberg1994'],
    titulo: 'Calibração do transdutor',
    detalhe: 'ERA e potência variam entre transdutores e podem mudar a intensidade real em até 50%. No Brasil, só 32,3% dos aparelhos testados estavam de acordo com a norma. Use a ERA do laudo e confira que o BNR não passa de 8.' },

  // ── Ondas de choque ──
  { id: 'eswt_idosos_focal', modalidades: ['ondas_choque'], gravidade: 'precaucao', fonte: 'literatura', refs: ['reilly2018'],
    titulo: 'Idosos com onda focal',
    detalhe: 'Complicações são raras, mas há relatos de lesão óssea e de ruptura do tendão de Aquiles em idosos com onda focal.', padroes: P.osteoporose },
  { id: 'eswt_gestacao', modalidades: ['ondas_choque'], gravidade: 'contraindicacao', fonte: 'classica',
    titulo: 'Gestação', detalhe: 'Não aplicar em gestantes.', padroes: P.gestacao },
  { id: 'eswt_coagulo', modalidades: ['ondas_choque'], gravidade: 'contraindicacao', fonte: 'classica',
    titulo: 'Coagulopatia ou anticoagulantes', detalhe: 'Risco de hematoma. Avalie com o médico responsável antes de aplicar.', padroes: P.anticoag },
  { id: 'eswt_marcapasso', modalidades: ['ondas_choque'], gravidade: 'contraindicacao', fonte: 'classica',
    titulo: 'Marca-passo ou dispositivo implantado', detalhe: 'Evitar a região próxima ao dispositivo; confira o manual.', padroes: P.marcapasso },
  { id: 'eswt_tumor', modalidades: ['ondas_choque'], gravidade: 'contraindicacao', fonte: 'classica',
    titulo: 'Tumor na região', detalhe: 'Não aplicar sobre tumor.', padroes: P.neoplasia },
  { id: 'eswt_infeccao', modalidades: ['ondas_choque'], gravidade: 'contraindicacao', fonte: 'classica',
    titulo: 'Infecção local', detalhe: 'Evitar aplicar sobre foco infeccioso.', padroes: P.infeccao },
  { id: 'eswt_epifise', modalidades: ['ondas_choque'], gravidade: 'contraindicacao', fonte: 'classica',
    titulo: 'Epífises de crescimento abertas', detalhe: 'Não aplicar sobre placas de crescimento.', padroes: P.epifise },
  { id: 'eswt_trajeto', modalidades: ['ondas_choque'], gravidade: 'precaucao', fonte: 'classica',
    titulo: 'Pulmão, gás intestinal, nervos e vasos calibrosos', detalhe: 'Evite que o foco atravesse pulmão, alças intestinais, nervos ou vasos principais.' },
  { id: 'eswt_corticoide', modalidades: ['ondas_choque'], gravidade: 'precaucao', fonte: 'classica',
    titulo: 'Corticoide injetado no local', detalhe: 'Infiltração recente no tendão pede cautela; avalie o intervalo com o médico.', padroes: P.corticoide },
  { id: 'eswt_dor', modalidades: ['ondas_choque'], gravidade: 'precaucao', fonte: 'literatura', refs: ['schmitz2015'],
    titulo: 'Sem anestesia local',
    detalhe: 'Use a maior energia que o paciente tolerar, sem anestesia local: ela piorou o resultado nos ensaios.' },
];

export const itensDaModalidade = (m: Modalidade) => ITENS_SEGURANCA.filter((i) => i.modalidades.includes(m));

const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export interface TextoProntuario { origem: string; texto: string }
export interface Alerta { origem: string; trecho: string }

/** Procura no prontuário sinais de cada item. Não decide nada: só acende o alerta. */
export function detectarAlertas(textos: TextoProntuario[], itens: ItemSeguranca[]): Record<string, Alerta[]> {
  const out: Record<string, Alerta[]> = {};
  const normalizados = textos.filter((t) => t.texto?.trim()).map((t) => ({ ...t, n: norm(t.texto) }));
  for (const item of itens) {
    if (!item.padroes?.length) continue;
    for (const t of normalizados) {
      const re = item.padroes.find((p) => p.test(t.n));
      if (!re) continue;
      const m = re.exec(t.n);
      const i = m ? m.index : 0;
      // O trecho vem do texto original, na mesma posição (a normalização não muda o tamanho das letras base).
      const trecho = t.texto.slice(Math.max(0, i - 25), Math.min(t.texto.length, i + 60)).replace(/\s+/g, ' ').trim();
      (out[item.id] ||= []).push({ origem: t.origem, trecho });
      break;
    }
  }
  return out;
}

export function idadeEmAnos(nascimento?: string | null, hoje = new Date()): number | null {
  if (!nascimento) return null;
  const d = new Date(`${nascimento.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  let a = hoje.getFullYear() - d.getFullYear();
  if (hoje.getMonth() < d.getMonth() || (hoje.getMonth() === d.getMonth() && hoje.getDate() < d.getDate())) a--;
  return a;
}
