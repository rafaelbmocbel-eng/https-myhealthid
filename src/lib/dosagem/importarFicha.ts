import type { ModalidadeAparelho } from './tipos';

// Lê o texto de uma ficha técnica, manual ou laudo de calibração e devolve os
// campos que conseguiu reconhecer. NÃO chuta: o que não aparece no texto fica
// de fora, e o profissional confere cada campo antes de salvar.

export const FABRICANTES = [
  'Ibramed', 'KLD Biosistemas', 'Carci', 'Quark Medical', 'DMC', 'Chattanooga',
  'Enraf-Nonius', 'Storz Medical', 'BTL', 'Zimmer MedizinSysteme', 'EMS (Electro Medical Systems)',
];

export interface CamposFicha {
  nome?: string;
  fabricante?: string;
  modelo?: string;
  calibracao?: string;
  // laser
  nm?: string; modoLaser?: 'continuo' | 'pulsado'; potMedia?: string; potMedida?: string; potPico?: string; areaFeixe?: string;
  // ultrassom
  freq?: '1' | '3'; era?: string; bnr?: string; potMax?: string;
  // ondas de choque
  tipoOnda?: 'focal' | 'radial'; areaFocal?: string; hzMax?: string; barMax?: string; efdMax?: string;
}

export interface FichaLida {
  campos: CamposFicha;
  /** Frases curtas do que foi reconhecido, para mostrar ao profissional. */
  achados: string[];
  avisos: string[];
}

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;
const paraNumero = (s: string) => Number(s.replace(',', '.'));
const txt = (n: number) => String(Math.round(n * 1000) / 1000).replace('.', ',');

const normalizar = (t: string) =>
  t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/²/g, '2').replace(/µ/g, 'u').replace(/\s+/g, ' ');

const primeiro = (t: string, re: RegExp) => {
  const m = re.exec(t);
  return m ? m : null;
};

function emMw(valor: string, unidade: string) {
  const n = paraNumero(valor);
  return unidade === 'w' ? n * 1000 : n;
}

export function lerFicha(texto: string, tipo: ModalidadeAparelho): FichaLida {
  const t = normalizar(texto);
  const campos: CamposFicha = {};
  const achados: string[] = [];
  const avisos: string[] = [];
  if (!t.trim()) return { campos, achados, avisos: ['Cole o texto da ficha técnica ou do laudo.'] };

  // Fabricante conhecido citado no texto.
  const fab = FABRICANTES.find((f) => t.includes(normalizar(f).replace(/\s*\(.*\)/, '')));
  if (fab) { campos.fabricante = fab; achados.push(`fabricante ${fab}`); }

  const modelo = primeiro(texto, /modelo\s*[:-]?\s*([A-Za-z0-9][\w\- ]{1,28})/i);
  if (modelo) { campos.modelo = modelo[1].trim(); achados.push(`modelo ${campos.modelo}`); }

  const cal = primeiro(t, /calibra\w*[^0-9]{0,40}(\d{2})\/(\d{2})\/(\d{4})/) ?? null;
  if (cal) { campos.calibracao = `${cal[3]}-${cal[2]}-${cal[1]}`; achados.push(`calibração em ${cal[1]}/${cal[2]}/${cal[3]}`); }

  if (tipo === 'laser') {
    const nms = [...new Set([...t.matchAll(/(\d{3,4})\s*nm/g)].map((m) => Number(m[1])).filter((n) => n >= 600 && n <= 1100))];
    if (nms.length) { campos.nm = String(nms[0]); achados.push(`${nms[0]} nm`); }
    if (nms.length > 1) avisos.push(`Há ${nms.length} comprimentos de onda (${nms.join(', ')} nm): cadastre uma ponteira para cada um.`);

    const medida = primeiro(t, new RegExp(String.raw`medid[ao]s?[^0-9]{0,30}${NUM}\s*(mw|w)\b`));
    if (medida) { const v = emMw(medida[1], medida[2]); campos.potMedida = txt(v); achados.push(`potência medida ${txt(v)} mW`); }

    const pico = primeiro(t, new RegExp(String.raw`(?:pico|peak)[^0-9]{0,30}${NUM}\s*(mw|w)\b`));
    if (pico) { const v = emMw(pico[1], pico[2]); campos.potPico = txt(v); achados.push(`potência de pico ${txt(v)} mW`); }

    const media = primeiro(t, new RegExp(String.raw`pot[e]ncia(?: media| optica| de saida| nominal)?[^0-9]{0,25}${NUM}\s*(mw|w)\b`))
      ?? primeiro(t, new RegExp(String.raw`${NUM}\s*(mw)\b`));
    if (media && !(pico && media[0] === pico[0])) { const v = emMw(media[1], media[2]); campos.potMedia = txt(v); achados.push(`potência média ${txt(v)} mW`); }

    const area = primeiro(t, new RegExp(String.raw`area[^0-9]{0,35}${NUM}\s*cm2`));
    const diam = primeiro(t, new RegExp(String.raw`diametro[^0-9]{0,25}${NUM}\s*mm`));
    if (area) { campos.areaFeixe = txt(paraNumero(area[1])); achados.push(`área do feixe ${campos.areaFeixe} cm²`); }
    else if (diam) {
      const d = paraNumero(diam[1]);
      const a = Math.PI * (d / 20) ** 2; // d em mm → raio em cm = d/20
      campos.areaFeixe = txt(a);
      achados.push(`área do feixe ≈ ${campos.areaFeixe} cm² (diâmetro de ${txt(d)} mm)`);
      avisos.push('Área calculada a partir do diâmetro: confirme o tamanho do feixe NA PELE, que pode ser maior que o da janela.');
    }

    const cont = /\bcontinu|\bcw\b/.test(t);
    const puls = /\b(pulsad\w*|superpuls\w*|pulsed)\b/.test(t);
    if (puls) { campos.modoLaser = 'pulsado'; achados.push('modo pulsado'); }
    else if (cont) { campos.modoLaser = 'continuo'; achados.push('modo contínuo'); }
    if (puls && cont) avisos.push('A ficha cita modo contínuo e pulsado: confira qual você usa.');
  }

  if (tipo === 'ultrassom') {
    const fs = [...new Set([...t.matchAll(new RegExp(String.raw`${NUM}\s*mhz`, 'g'))].map((m) => paraNumero(m[1])).filter((n) => n === 1 || n === 3 || n === 3.3))];
    if (fs.length) {
      campos.freq = fs[0] === 1 ? '1' : '3';
      achados.push(`${fs[0] === 1 ? 1 : 3} MHz`);
    }
    if (fs.length > 1) avisos.push('O texto cita duas frequências: cadastre um transdutor para cada.');

    const era = primeiro(t, new RegExp(String.raw`(?:\bera\b|area de radiacao efetiva)[^0-9]{0,35}${NUM}\s*cm2`));
    if (era) { campos.era = txt(paraNumero(era[1])); achados.push(`ERA ${campos.era} cm²`); }
    else avisos.push('ERA não encontrada: use o valor do laudo de calibração do transdutor.');

    const bnr = primeiro(t, new RegExp(String.raw`(?:\bbnr\b|\brbn\b)[^0-9]{0,25}${NUM}`));
    if (bnr) { campos.bnr = txt(paraNumero(bnr[1])); achados.push(`BNR ${campos.bnr}`); }

    const pot = primeiro(t, new RegExp(String.raw`pot[e]ncia(?: maxima| de saida| nominal)?[^0-9]{0,25}${NUM}\s*w\b`));
    if (pot) { campos.potMax = txt(paraNumero(pot[1])); achados.push(`potência máxima ${campos.potMax} W`); }
  }

  if (tipo === 'ondas_choque') {
    if (/radial/.test(t) && !/focal/.test(t)) { campos.tipoOnda = 'radial'; achados.push('onda radial'); }
    else if (/focal/.test(t) && !/radial/.test(t)) { campos.tipoOnda = 'focal'; achados.push('onda focal'); }
    else if (/focal/.test(t) && /radial/.test(t)) avisos.push('O texto cita onda focal e radial: escolha o tipo do aplicador que vai usar.');

    const af = primeiro(t, new RegExp(String.raw`area focal[^0-9]{0,25}${NUM}\s*mm2`));
    if (af) { campos.areaFocal = txt(paraNumero(af[1])); achados.push(`área focal ${campos.areaFocal} mm²`); }

    const hz = [...t.matchAll(new RegExp(String.raw`${NUM}\s*hz`, 'g'))].map((m) => paraNumero(m[1]));
    if (hz.length) { campos.hzMax = txt(Math.max(...hz)); achados.push(`frequência máxima ${campos.hzMax} Hz`); }

    const bar = [...t.matchAll(new RegExp(String.raw`${NUM}\s*bar\b`, 'g'))].map((m) => paraNumero(m[1]));
    if (bar.length) { campos.barMax = txt(Math.max(...bar)); achados.push(`pressão máxima ${campos.barMax} bar`); }

    const efd = [...t.matchAll(new RegExp(String.raw`${NUM}\s*mj\s*/\s*mm`, 'g'))].map((m) => paraNumero(m[1]));
    if (efd.length) { campos.efdMax = txt(Math.max(...efd)); achados.push(`EFD máxima ${campos.efdMax} mJ/mm²`); }
  }

  if (!achados.length) avisos.push('Não reconheci nenhum valor neste texto. Confira se ele traz as unidades (nm, mW, cm², MHz…).');
  return { campos, achados, avisos };
}
