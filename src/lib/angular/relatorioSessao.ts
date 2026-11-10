import jsPDF from 'jspdf';
import '@/lib/pdf/patchJsPdf';
import { molduraEmTodasPaginas } from '@/lib/pdf/moldura';
import { nomeDocumento } from '@/lib/pdf/entrega';
import { POSICOES_DA_NOTA, ROTULO_POSICAO_DA_NOTA, grau, parearMedidas, sentidoDe, variacaoTexto, type LinhaPareada, type MedidaSalva, type PosicaoDaNota, type UnidadeMedida } from './comparar';
import { nomeDoResultado } from './medidas';
import { paresDireitoEsquerdo, type ParDireitoEsquerdo } from './tiposSessao';
import { AZUL, BORDA, CAB, cabecalhoDoRelatorio, seguro, tituloDeSecao } from './relatorio';

/** As quatro posições da sessão mais o perfil de nota antiga, que nunca teve o lado gravado. */
export type PosicaoDoRelatorio = PosicaoDaNota;

export type MetodoDoRelatorio = 'automatica_conferida' | 'marcacao_manual';

export interface VistaDoRelatorioSessao {
  posicao: PosicaoDoRelatorio;
  /** Nome para mostrar, ex.: "Perfil direito". */
  vistaNome: string;
  medidas: MedidaSalva[];
  /** A mesma posição na avaliação anterior; com ela o bloco ganha as colunas "Antes" e "Variação". */
  anterior?: { data: string; medidas: MedidaSalva[] } | null;
  /** Foto já com as marcações (data URL JPEG ou PNG). A foto não vai para o prontuário: só entra aqui se estiver na memória. */
  imagem?: string | null;
  metodo: MetodoDoRelatorio;
  /** Quantas medidas o profissional ajustou à mão depois da detecção automática; omitir quando a tela não sabe. */
  pontosAjustados?: number;
  /** Frase sobre a correção de nível desta foto; sem ela o relatório diz que não houve correção. */
  notaNivel?: string;
}

export interface DadosRelatorioSessao {
  paciente: string;
  profissional?: string;
  logoUrl?: string;
  /** dd/mm/aaaa */
  data: string;
  vistas: VistaDoRelatorioSessao[];
}

/** Largura (px) a que as fotos devem chegar ao PDF: quatro fotos maiores deixam o arquivo pesado para mandar no WhatsApp. A tela deve montar a foto já nesta largura (`imagemParaPdf(analise, estilo, LARGURA_MAX_FOTO_PDF)`); aqui ela só é reduzida de novo se vier maior. */
export const LARGURA_MAX_FOTO_PDF = 800;

export const FRASE_RODAPE_SESSAO = 'Estimativa por foto, não é diagnóstico nem substitui a avaliação do profissional. Para acompanhar a evolução, repita nas mesmas condições: mesma distância, altura da câmera e roupa. O relatório mostra só a medida, o lado e a variação numérica, sem valor de referência.';

export const NOTA_MEMBROS_SUPERIORES = 'Ângulos projetados no plano da foto; estimativa a confirmar (a foto é em duas dimensões e o modelo marca o centro da articulação, não o ponto ósseo). A diferença é direito menos esquerdo, só aritmética: não classifica nenhum dos lados.';

const ROTULO_POSICAO = ROTULO_POSICAO_DA_NOTA;
const ORDEM_POSICOES = POSICOES_DA_NOTA;

// ---------------------------------------------------------------------------
// Textos e agrupamentos puros (testáveis sem PDF)
// ---------------------------------------------------------------------------

/** Frase do método de uma posição. Não afirma que o profissional conferiu os pontos: o aplicativo não verifica isso. */
export function fraseDoMetodo(metodo: MetodoDoRelatorio, pontosAjustados?: number): string {
  if (metodo !== 'automatica_conferida') return 'Pontos marcados manualmente pelo profissional.';
  const base = 'Pontos sugeridos por detecção automática de pose (o modelo marca o centro da articulação, não o ponto ósseo)';
  const n = typeof pontosAjustados === 'number' && Number.isFinite(pontosAjustados) ? Math.max(0, Math.round(pontosAjustados)) : null;
  let ajuste = '';
  if (n === 0) ajuste = '; nenhuma medida ajustada à mão';
  else if (n !== null) ajuste = `; ${n} ${n === 1 ? 'medida ajustada' : 'medidas ajustadas'} à mão`;
  return `${base}${ajuste}. Confirmar os pontos na foto.`;
}

export const FRASE_NIVEL_AUSENTE = 'sem correção de nível aplicada; os ângulos usam a horizontal e a vertical da foto como referência.';

export interface LinhaMembroSuperior {
  nome: string;
  direito: MedidaSalva | null;
  esquerdo: MedidaSalva | null;
  /** direito − esquerdo, uma casa; null quando falta um lado, as unidades diferem ou o sentido é oposto. */
  diferenca: number | null;
  unidade?: UnidadeMedida;
  /** Por que não há diferença numérica; null quando é só a subtração. */
  motivoSemDiferenca: string | null;
}

export interface GrupoMembroSuperior { titulo: string; linhas: LinhaMembroSuperior[] }

// Ids (sem o sufixo -d/-e) das medidas dos membros superiores. "cotovelos" e "ombros" (desníveis entre os dois lados) não entram: já são uma comparação D x E.
const MEMBRO_SUPERIOR = /^(braco|antebraco|cotovelo|carregamento|punho|mao|ombro|escapula)(-|$)/;
// Medidas de perfil sem sufixo de lado no id: o lado é o da foto (perfil direito ou esquerdo).
const LADO_PELA_FOTO_NO_PERFIL = new Set(['cotovelo-perfil']);

const membrosSuperiores = (medidas: readonly MedidaSalva[] | undefined) => (medidas ?? []).filter((m) => MEMBRO_SUPERIOR.test(m.id));

function nomeDoPar(base: string): string {
  const nome = nomeDoResultado(`${base}-d`) ?? nomeDoResultado(`${base}-e`) ?? nomeDoResultado(base);
  return nome ? nome.replace(/\s+(direito|esquerdo)\b/i, '') : base;
}

function linhaDoPar(par: ParDireitoEsquerdo<MedidaSalva>): LinhaMembroSuperior {
  const { direito, esquerdo } = par;
  const base = { nome: nomeDoPar(par.base), direito, esquerdo };
  if (!direito || !esquerdo) return { ...base, diferenca: null, unidade: (direito ?? esquerdo)?.unidade, motivoSemDiferenca: 'falta um dos lados' };
  if (direito.unidade !== esquerdo.unidade) return { ...base, diferenca: null, motivoSemDiferenca: 'unidades diferentes' };
  // Mesma regra do comparador: valores sem sinal com sentidos opostos (ex.: valgo e varo) não se subtraem.
  const sd = sentidoDe(direito), se = sentidoDe(esquerdo);
  if (sd && se && sd.categoria === se.categoria && sd.lado !== se.lado) {
    return { ...base, diferenca: null, unidade: direito.unidade, motivoSemDiferenca: 'sentidos diferentes' };
  }
  return { ...base, diferenca: par.diferenca, unidade: direito.unidade, motivoSemDiferenca: null };
}

const grupoDe = (titulo: string, medidas: readonly MedidaSalva[]): GrupoMembroSuperior => ({ titulo, linhas: paresDireitoEsquerdo(medidas).map(linhaDoPar) });

/**
 * Pares direito x esquerdo dos membros superiores, por plano: frente, costas e perfil.
 * No perfil o direito vem da foto de perfil direito e o esquerdo da foto de perfil esquerdo, porque cada foto mostra um lado só.
 * O perfil sem lado informado só se pareia com ele mesmo. Só aritmética: nada é classificado.
 */
export function paresMembrosSuperiores(vistas: readonly Pick<VistaDoRelatorioSessao, 'posicao' | 'medidas'>[]): GrupoMembroSuperior[] {
  const da = (p: PosicaoDoRelatorio) => vistas.find((v) => v.posicao === p);
  const doLadoNoPerfil = (v: Pick<VistaDoRelatorioSessao, 'medidas'> | undefined, s: 'd' | 'e') =>
    membrosSuperiores(v?.medidas).flatMap((m) => {
      if (m.id.endsWith(`-${s}`)) return [m];
      return LADO_PELA_FOTO_NO_PERFIL.has(m.id) ? [{ ...m, id: `${m.id}-${s}` }] : [];
    });
  const grupos = [
    grupoDe('Frente', membrosSuperiores(da('frente')?.medidas)),
    grupoDe('Costas', membrosSuperiores(da('costas')?.medidas)),
    grupoDe('Perfil direito (foto do lado direito) e perfil esquerdo (foto do lado esquerdo)', [...doLadoNoPerfil(da('perfil_d'), 'd'), ...doLadoNoPerfil(da('perfil_e'), 'e')]),
    grupoDe('Perfil (lado não informado)', membrosSuperiores(da('perfil_sem_lado')?.medidas)),
  ];
  return grupos.filter((g) => g.linhas.length > 0);
}

// ---------------------------------------------------------------------------
// Foto para o PDF
// ---------------------------------------------------------------------------

function carregarImagem(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, falha) => {
    const img = new Image();
    const limite = setTimeout(() => falha(new Error('tempo esgotado ao carregar a foto')), 8000);
    img.onload = () => { clearTimeout(limite); ok(img); };
    img.onerror = () => { clearTimeout(limite); falha(new Error('foto ilegível')); };
    img.src = url;
  });
}

/** Foto reduzida a `larguraMax` px de largura em JPEG; null quando não há como reduzir ou ela já é menor (vale a original). */
export async function reduzirFoto(url: string, larguraMax: number): Promise<string | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null;
  try {
    const img = await carregarImagem(url);
    const w0 = img.naturalWidth, h0 = img.naturalHeight;
    if (!w0 || !h0 || w0 <= larguraMax) return null;
    const esc = larguraMax / w0;
    const cv = document.createElement('canvas');
    cv.width = Math.round(w0 * esc); cv.height = Math.round(h0 * esc);
    const c = cv.getContext('2d');
    if (!c) return null;
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, cv.width, cv.height);
    c.drawImage(img, 0, 0, cv.width, cv.height);
    return cv.toDataURL('image/jpeg', 0.85);
  } catch {
    return null; // sem como reduzir: o PDF usa a foto como veio
  }
}

interface FotoPronta { url: string; formato: string; proporcao: number }

async function prepararFoto(doc: jsPDF, url: string | null | undefined): Promise<FotoPronta | null> {
  if (!url) return null;
  try {
    let dados = url;
    let p = doc.getImageProperties(dados);
    if (p.width > LARGURA_MAX_FOTO_PDF) {
      const menor = await reduzirFoto(dados, LARGURA_MAX_FOTO_PDF);
      if (menor) { dados = menor; p = doc.getImageProperties(dados); }
    }
    if (!(p.width > 0) || !(p.height > 0)) return null;
    return { url: dados, formato: p.fileType, proporcao: p.width / p.height };
  } catch {
    return null; // foto ilegível: a posição sai no relatório sem ela
  }
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

const W = 210, M = 14, LARG = W - 2 * M;
const TOPO = 18;
/** O conteúdo termina aqui; abaixo ficam o filete e o rodapé de todas as páginas. */
const LIMITE = 268;
/** Maior caixa que ainda cabe numa página inteira, já com o título da seção. */
const ALTURA_MAX_CAIXA = LIMITE - TOPO - 5;
const ALTURA_FOTO = 95;
/** A foto só encolhe para caber no que resta da página até este tamanho; abaixo disso o bloco vai para a página seguinte. */
const ALTURA_FOTO_MIN = 70;
const ALTURA_MINIATURA = 56;
/** Respiro acima de cada título de seção (fora do topo da página). */
const RESPIRO_TITULO = 4.5;
const ALT_CAB = 7;
const ALT_MIN = 6.4;
const LH = 3.9;
const LH_SUB = 3.1;
const CINZA = 110;

interface Coluna { titulo: string; x: number; w: number }
interface Celula { linhas: string[]; sub?: string[]; negrito?: boolean }
type LinhaTabela = { faixa: string } | { celulas: Celula[] };

const alturaDaLinha = (l: LinhaTabela) => {
  if ('faixa' in l) return 6;
  const miolo = Math.max(...l.celulas.map((c) => 4.4 + (c.linhas.length - 1) * LH + (c.sub?.length ? 3 + (c.sub.length - 1) * LH_SUB : 0)));
  return Math.max(ALT_MIN, miolo + 2);
};

/** Altura da caixa de texto: o texto começa 5 mm abaixo do topo, `lh` entre linhas, 1,6 mm entre parágrafos e 2,8 mm de folga embaixo. */
const alturaDaCaixa = (ps: string[][], lh: number) => 5 + (ps.reduce((s, p) => s + p.length, 0) - 1) * lh + (ps.length - 1) * 1.6 + 2.8;

const dataArquivo = (br: string) => br.split('/').reverse().join('-');
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export async function gerarRelatorioSessao(d: DadosRelatorioSessao): Promise<{ blob: Blob; nome: string }> {
  const paciente = nomeDocumento(d.paciente);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const vistas = d.vistas
    .map((v, i) => ({ v: { ...v, vistaNome: v.vistaNome?.trim() || ROTULO_POSICAO[v.posicao] }, i }))
    .sort((a, b) => ORDEM_POSICOES.indexOf(a.v.posicao) - ORDEM_POSICOES.indexOf(b.v.posicao) || a.i - b.i)
    .map(({ v }) => v);
  const fotos = await Promise.all(vistas.map((v) => prepararFoto(doc, v.imagem)));

  const t = (txt: string, x: number, yy: number, op?: Parameters<jsPDF['text']>[3]) => doc.text(seguro(txt), x, yy, op);
  const quebrar = (txt: string, largura: number, tamanho: number, negrito = false) => {
    doc.setFont('helvetica', negrito ? 'bold' : 'normal'); doc.setFontSize(tamanho);
    return doc.splitTextToSize(seguro(txt), largura) as string[];
  };

  const feitas = vistas.filter((v) => v.medidas.length > 0);
  const subtitulo = `${plural(feitas.length, 'posição feita', 'posições feitas')} · ${d.data}${d.profissional ? ` · ${d.profissional}` : ''}`;
  let y = await cabecalhoDoRelatorio(doc, { titulo: 'Análise angular da sessão', paciente, subtitulo, logoUrl: d.logoUrl });

  const novaPagina = () => { doc.addPage(); y = TOPO; };
  /** Abre página nova se `h` não couber no que resta; no topo de uma página não faz nada (nada caberia melhor). */
  const garantir = (h: number) => { if (y + h > LIMITE && y > TOPO + 0.5) novaPagina(); };
  /** Título de seção com `h` mm do conteúdo que o segue na mesma página e um respiro acima dele (a não ser no topo da página). */
  const secao = (txt: string, h: number, comRespiro = true) => {
    garantir((comRespiro ? RESPIRO_TITULO : 0) + 5 + h);
    if (comRespiro && y > TOPO + 0.5) y += RESPIRO_TITULO;
    tituloDeSecao(doc, txt, y);
    y += 5;
  };

  // Texto corrido (rodapés de tabela, avisos): quebra linha a linha, sem caixa.
  const nota = (txt: string, tamanho = 7.6) => {
    const linhas = quebrar(txt, LARG, tamanho);
    for (const ln of linhas) {
      garantir(3.4);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(tamanho); doc.setTextColor(CINZA);
      doc.text(ln, M, y + 2);
      y += 3.4;
    }
    doc.setTextColor(20);
    y += 2;
  };

  // Caixa com barra azul, no estilo da "Leitura" do relatório de uma vista. Quem a chama abre a seção com a altura da caixa inteira (`secao`), então ela só continua na página seguinte se for maior que uma página.
  const caixaDeTexto = (paragrafos: string[][], tamanho: number, lh: number) => {
    let i = 0;
    while (i < paragrafos.length) {
      garantir(alturaDaCaixa([paragrafos[i]], lh));
      let j = i + 1;
      while (j < paragrafos.length && y + alturaDaCaixa(paragrafos.slice(i, j + 1), lh) <= LIMITE) j++;
      const grupo = paragrafos.slice(i, j);
      const altBox = alturaDaCaixa(grupo, lh);
      doc.setFillColor(247, 249, 252); doc.setDrawColor(...BORDA); doc.setLineWidth(0.3);
      doc.roundedRect(M, y, LARG, altBox, 2.2, 2.2, 'FD');
      doc.setFillColor(...AZUL); doc.roundedRect(M, y, 1.4, altBox, 0.7, 0.7, 'F');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(tamanho); doc.setTextColor(20);
      let yy = y + 5;
      for (const p of grupo) {
        for (const ln of p) { doc.text(ln, M + 6, yy); yy += lh; }
        yy += 1.6;
      }
      y += altBox + 3;
      i = j;
      if (i < paragrafos.length) novaPagina();
    }
  };

  const tabela = (colunas: Coluna[], linhas: LinhaTabela[]) => {
    const alturas = linhas.map(alturaDaLinha);
    let i = 0;
    while (i < linhas.length) {
      garantir(ALT_CAB + alturas[i] + (i + 1 < linhas.length && 'faixa' in linhas[i] ? alturas[i + 1] : 0));
      let j = i, soma = 0;
      while (j < linhas.length && y + ALT_CAB + soma + alturas[j] <= LIMITE) { soma += alturas[j]; j++; }
      // Faixa de grupo nunca fica sozinha no fim da página.
      if (j - i > 1 && 'faixa' in linhas[j - 1]) { j--; soma -= alturas[j]; }
      if (j === i) { soma = alturas[i]; j = i + 1; }
      const alt = ALT_CAB + soma;
      doc.setFillColor(255, 255, 255); doc.setDrawColor(...BORDA); doc.setLineWidth(0.3);
      doc.roundedRect(M, y, LARG, alt, 2.2, 2.2, 'FD');
      doc.setFillColor(...CAB); doc.roundedRect(M, y, LARG, ALT_CAB, 2.2, 2.2, 'F'); doc.rect(M, y + ALT_CAB - 2.2, LARG, 2.2, 'F');
      doc.setDrawColor(...BORDA); doc.line(M, y + ALT_CAB, W - M, y + ALT_CAB);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...AZUL);
      for (const c of colunas) t(c.titulo, c.x, y + 4.7);
      let yy = y + ALT_CAB;
      for (let k = i; k < j; k++) {
        const l = linhas[k];
        if (k > i) { doc.setDrawColor(...BORDA); doc.setLineWidth(0.15); doc.line(M + 2, yy, W - M - 2, yy); }
        if ('faixa' in l) {
          doc.setFillColor(...CAB); doc.rect(M + 0.3, yy + 0.2, LARG - 0.6, alturas[k] - 0.4, 'F');
          doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...AZUL);
          t(l.faixa, M + 4, yy + 4.1);
        } else {
          l.celulas.forEach((c, n) => {
            const x = colunas[n].x;
            doc.setFont('helvetica', c.negrito ? 'bold' : 'normal'); doc.setFontSize(9); doc.setTextColor(20);
            c.linhas.forEach((ln, q) => doc.text(ln, x, yy + 4.4 + q * LH));
            if (c.sub?.length) {
              doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(CINZA);
              const base = yy + 4.4 + (c.linhas.length - 1) * LH + 3;
              c.sub.forEach((ln, q) => doc.text(ln, x, base + q * LH_SUB));
            }
          });
        }
        yy += alturas[k];
      }
      doc.setTextColor(20);
      y += alt;
      i = j;
      if (i < linhas.length) novaPagina();
    }
    y += 3;
  };

  const celula = (txt: string, largura: number, o: { sub?: string; negrito?: boolean } = {}): Celula => ({
    linhas: quebrar(txt, largura, 9, o.negrito),
    ...(o.sub ? { sub: quebrar(o.sub, largura, 7) } : {}),
    ...(o.negrito ? { negrito: true } : {}),
  });

  const rotuloDoSentido = (m: MedidaSalva | null) => (m ? sentidoDe(m)?.rotulo : undefined);

  // --- Posições feitas e não feitas ---------------------------------------
  const linhasResumo = ORDEM_POSICOES.flatMap((p) => {
    const i = vistas.findIndex((v) => v.posicao === p);
    if (i < 0) return p === 'perfil_sem_lado' ? [] : [{ p, v: null, i }];
    return [{ p, v: vistas[i], i }];
  });
  const altResumo = linhasResumo.length * 6 + 3;
  secao('Posições feitas e não feitas', vistas.length ? altResumo : 8, false);
  if (!vistas.length) {
    nota('Nenhuma posição registrada nesta sessão.');
  } else {
    doc.setFillColor(255, 255, 255); doc.setDrawColor(...BORDA); doc.setLineWidth(0.3);
    doc.roundedRect(M, y, LARG, altResumo, 2.2, 2.2, 'FD');
    linhasResumo.forEach(({ p, v, i }, k) => {
      const yy = y + 1.5 + k * 6;
      const feita = !!v && v.medidas.length > 0;
      doc.setDrawColor(...AZUL); doc.setLineWidth(0.4);
      if (feita) { doc.setFillColor(...AZUL); doc.circle(M + 5, yy + 3, 1.3, 'FD'); } else { doc.setFillColor(255, 255, 255); doc.circle(M + 5, yy + 3, 1.3, 'FD'); }
      doc.setFont('helvetica', feita ? 'bold' : 'normal'); doc.setFontSize(9); doc.setTextColor(feita ? 20 : CINZA);
      t(ROTULO_POSICAO[p], M + 10, yy + 4);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(feita ? 60 : CINZA);
      if (!v) {
        t('Não feita nesta sessão', M + 62, yy + 4);
      } else if (!feita) {
        t('Sem medidas registradas', M + 62, yy + 4);
      } else {
        const metodo = v.metodo === 'automatica_conferida' ? 'detecção automática' : 'marcação manual';
        t(`Feita · ${plural(v.medidas.length, 'medida', 'medidas')} · ${metodo}${fotos[i] ? '' : ' · sem foto neste relatório'}`, M + 62, yy + 4);
      }
    });
    doc.setTextColor(20);
    y += altResumo + 3;
  }

  // --- Faixa de miniaturas -------------------------------------------------
  const comFoto = vistas.flatMap((v, i) => (fotos[i] ? [{ v, foto: fotos[i] as FotoPronta, i }] : []));
  if (comFoto.length > 1) {
    const gap = 4, cw = (LARG - 3 * gap) / 4;
    const rotuloH = 3.4 + 1.5;
    const medidasMiniatura = (foto: FotoPronta) => {
      let w = Math.min(cw - 3, ALTURA_MINIATURA * foto.proporcao);
      let h = w / foto.proporcao;
      if (h > ALTURA_MINIATURA) { h = ALTURA_MINIATURA; w = h * foto.proporcao; }
      return { w, h };
    };
    const alturaDaFaixa = (itens: typeof comFoto) => Math.max(...itens.map((c) => medidasMiniatura(c.foto).h)) + 2.4 + 3.6 + rotuloH;
    secao('Fotos da sessão', alturaDaFaixa(comFoto.slice(0, 4)));
    for (let i = 0; i < comFoto.length; i += 4) {
      const linha = comFoto.slice(i, i + 4);
      const altLinha = alturaDaFaixa(linha);
      if (i > 0) garantir(altLinha);
      linha.forEach(({ v, foto, i: idx }, k) => {
        const x0 = M + k * (cw + gap);
        const { w, h } = medidasMiniatura(foto);
        const x = x0 + (cw - w) / 2;
        doc.setFillColor(255, 255, 255); doc.setDrawColor(...BORDA); doc.setLineWidth(0.3);
        doc.roundedRect(x - 1.2, y, w + 2.4, h + 2.4, 2, 2, 'FD');
        doc.addImage(foto.url, foto.formato, x, y + 1.2, w, h, `foto-${idx}`, 'FAST');
        quebrar(v.vistaNome, cw, 8, true).slice(0, 2).forEach((ln, q) => {
          doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(60);
          doc.text(ln, x0 + cw / 2, y + h + 2.4 + 3.6 + q * 3.4, { align: 'center' });
        });
      });
      doc.setTextColor(20);
      y += altLinha + 2;
    }
  }

  // --- Um bloco por posição ------------------------------------------------
  vistas.forEach((v, idx) => {
    const foto = fotos[idx];
    const pares = parearMedidas(v.anterior?.medidas ?? [], v.medidas);
    const linhas = pares.filter((l) => l.depois);
    const soAntes = pares.filter((l) => !l.depois && l.antes);
    const comAntes = !!v.anterior;
    const primeirasLinhas = linhas.length ? Math.min(linhas.length, 3) * ALT_MIN : 8;

    // Título, foto e as primeiras linhas da tabela ficam juntos. Se a foto inteira não cabe no que resta da página mas uma foto menor cabe, ela encolhe em vez de deixar a página vazia.
    let fotoH = foto ? Math.min(ALTURA_FOTO, LARG / foto.proporcao) : 0;
    if (foto) {
      const resto = LIMITE - y - RESPIRO_TITULO - 5 - ALT_CAB - primeirasLinhas - 7;
      if (y > TOPO + 0.5 && fotoH > resto && resto >= ALTURA_FOTO_MIN) fotoH = Math.floor(resto * 10) / 10;
    }
    secao(v.vistaNome, (foto ? fotoH + 7 : 6) + ALT_CAB + primeirasLinhas);

    if (foto) {
      const h = fotoH, w = h * foto.proporcao;
      const x = M + (LARG - w) / 2;
      doc.setFillColor(255, 255, 255); doc.setDrawColor(...BORDA); doc.setLineWidth(0.4);
      doc.roundedRect(x - 1.5, y, w + 3, h + 3, 2.5, 2.5, 'FD');
      doc.addImage(foto.url, foto.formato, x, y + 1.5, w, h, `foto-${idx}`, 'FAST');
      y += h + 7;
    } else {
      nota(v.imagem ? 'Não foi possível incluir a foto neste relatório.' : 'Foto não incluída neste relatório (a foto não fica guardada no prontuário).');
    }

    if (!linhas.length) {
      nota('Nenhuma medida registrada nesta posição.', 8.5);
    } else {
      const colunas: Coluna[] = comAntes
        ? [{ titulo: 'Medida', x: M + 4, w: 80 }, { titulo: 'Agora', x: M + 88, w: 29 }, { titulo: `Antes (${v.anterior!.data})`, x: M + 120, w: 32 }, { titulo: 'Variação', x: M + 154, w: 26 }]
        : [{ titulo: 'Medida', x: M + 4, w: 108 }, { titulo: 'Agora', x: M + 116, w: 60 }];
      tabela(colunas, linhas.map((l) => {
        const agora = l.depois!;
        const celulas = [celula(l.nome, colunas[0].w - 2), celula(grau(agora.graus, agora.unidade), colunas[1].w - 2, { sub: rotuloDoSentido(agora) })];
        if (comAntes) celulas.push(celula(l.antes ? grau(l.antes.graus, l.antes.unidade) : '—', colunas[2].w - 2, { sub: rotuloDoSentido(l.antes) }), variacaoDaLinha(l, colunas[3].w - 2, celula));
        return { celulas };
      }));
      if (comAntes) {
        nota('A variação é só a diferença numérica entre as duas avaliações (agora menos antes): não indica melhora nem piora. Se o lado mudou ou as unidades são diferentes, ela não é calculada.');
      }
      if (soAntes.length) {
        nota(`Marcadas só na avaliação anterior (não marcadas agora): ${soAntes.map((l) => l.nome).join('; ')}.`);
      }
    }

    // Leitura: o texto de cada medida traz o lado, que o número sozinho não mostra.
    const leitura = linhas.filter((l) => l.depois?.texto).map((l) => quebrar(l.depois!.texto!, LARG - 12, 8.6));
    if (leitura.length) {
      secao('Leitura', Math.min(alturaDaCaixa(leitura, 4), ALTURA_MAX_CAIXA));
      caixaDeTexto(leitura, 8.6, 4);
    }

    const comoFoiMedido = [
      quebrar(`Método: ${fraseDoMetodo(v.metodo, v.pontosAjustados)}`, LARG - 12, 8.2),
      quebrar(`Correção de nível: ${v.notaNivel?.trim() || FRASE_NIVEL_AUSENTE}`, LARG - 12, 8.2),
    ];
    secao('Como foi medido', alturaDaCaixa(comoFoiMedido, 3.7));
    caixaDeTexto(comoFoiMedido, 8.2, 3.7);
  });

  // --- Membros superiores --------------------------------------------------
  const grupos = paresMembrosSuperiores(vistas);
  if (grupos.length) {
    const colunas: Coluna[] = [
      { titulo: 'Medida', x: M + 4, w: 78 }, { titulo: 'Direito', x: M + 86, w: 31 }, { titulo: 'Esquerdo', x: M + 120, w: 31 }, { titulo: 'Diferença (D - E)', x: M + 154, w: 26 },
    ];
    const linhas = grupos.flatMap((g): LinhaTabela[] => [
      { faixa: g.titulo },
      ...g.linhas.map((l): LinhaTabela => ({
        celulas: [
          celula(l.nome, colunas[0].w - 2),
          celula(l.direito ? grau(l.direito.graus, l.direito.unidade) : '—', colunas[1].w - 2, { sub: rotuloDoSentido(l.direito) }),
          celula(l.esquerdo ? grau(l.esquerdo.graus, l.esquerdo.unidade) : '—', colunas[2].w - 2, { sub: rotuloDoSentido(l.esquerdo) }),
          celula(l.diferenca === null ? '—' : variacaoTexto(l.diferenca, l.unidade), colunas[3].w - 2, { negrito: l.diferenca !== null, sub: l.motivoSemDiferenca ?? undefined }),
        ],
      })),
    ]);
    // A tabela costuma caber numa página: fica junta, em vez de abrir no fim de uma e continuar na outra.
    secao('Membros superiores', Math.min(ALT_CAB + linhas.reduce((s, l) => s + alturaDaLinha(l), 0), ALTURA_MAX_CAIXA));
    tabela(colunas, linhas);
    nota(NOTA_MEMBROS_SUPERIORES);
  }

  // --- Rodapé e numeração em todas as páginas ------------------------------
  const rodape = quebrar(FRASE_RODAPE_SESSAO, LARG, 7.2);
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(...BORDA); doc.setLineWidth(0.25); doc.line(M, 271.5, W - M, 271.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2); doc.setTextColor(CINZA);
    rodape.forEach((ln, q) => doc.text(ln, M, 275.5 + q * 3.2));
    doc.text(`Página ${p} de ${total}`, W - M, 286, { align: 'right' });
    if (p > 1) t(`Análise angular da sessão · ${paciente} · ${d.data}`, M, 12.5);
  }
  doc.setTextColor(20);

  molduraEmTodasPaginas(doc);
  const nomeArquivo = paciente.replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '') || 'PACIENTE';
  return { blob: doc.output('blob'), nome: `Analise_angular_sessao_${nomeArquivo}_${dataArquivo(d.data)}.pdf` };
}

/** Células "Variação" de uma linha: a subtração, ou "—" com o motivo curto por baixo. */
function variacaoDaLinha(l: LinhaPareada, largura: number, celula: (txt: string, largura: number, o?: { sub?: string; negrito?: boolean }) => Celula): Celula {
  if (l.diferenca !== null) return celula(variacaoTexto(l.diferenca, l.unidade), largura, { negrito: true });
  const motivos: Record<NonNullable<LinhaPareada['motivo']>, string> = {
    'falta-antes': 'não marcada antes',
    'falta-depois': 'não marcada agora',
    'unidades-diferentes': 'unidades diferentes',
    'lado-trocado': 'lado mudou',
  };
  return celula('—', largura, { sub: l.motivo ? motivos[l.motivo] : undefined });
}
