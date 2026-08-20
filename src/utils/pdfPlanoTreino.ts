/**
 * Gera um PDF do plano de treino do cliente — com as explicações e o 1º frame
 * de cada GIF do nosso banco. Importar dinamicamente (jsPDF é pesado):
 *   const { gerarPDFPlanoTreino } = await import('@/utils/pdfPlanoTreino');
 *
 * GIFs são animados; num PDF cabe só um quadro estático. Desenhamos o 1º frame
 * do GIF num canvas e embutimos como PNG. Se o GIF não puder ser lido (CORS ou
 * rede), o exercício entra sem imagem — o PDF nunca falha por causa de um GIF.
 */
import jsPDF from 'jspdf';
import { drawClinicLogo, drawLogoWatermark } from './pdfFingerprintWatermark';

export interface PlanoTreinoPDFData {
  pacienteNome: string;
  titulo?: string | null;
  clinicaNome?: string;
  clinicaLogoUrl?: string;
  conteudo: any; // { resumo, fases: [{ nome, semanas, objetivo, sessoes: [...] }], observacoes_gerais }
  nutricao?: any; // { titulo, resumo, calorias_totais, macros, refeicoes: [...], orientacoes, lista_compras }
}

const NAVY: [number, number, number] = [30, 41, 82];
const INK: [number, number, number] = [33, 37, 41];
const MUTED: [number, number, number] = [110, 116, 130];
const LINE: [number, number, number] = [225, 228, 235];
const PRIMARY: [number, number, number] = [37, 99, 235];

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 15;
const CONTENT_W = PAGE_W - MARGIN * 2;

// Carrega uma imagem e devolve o 1º frame como PNG (data URL). null se falhar.
function carregarFrame(url: string, timeoutMs = 7000): Promise<{ dataUrl: string; w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    let done = false;
    const finish = (v: { dataUrl: string; w: number; h: number } | null) => { if (!done) { done = true; resolve(v); } };
    const timer = setTimeout(() => finish(null), timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 200;
        canvas.height = img.naturalHeight || 200;
        const ctx = canvas.getContext('2d');
        if (!ctx) return finish(null);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        finish({ dataUrl: canvas.toDataURL('image/png'), w: canvas.width, h: canvas.height });
      } catch {
        finish(null); // canvas "tainted" por CORS — segue sem imagem
      }
    };
    img.onerror = () => { clearTimeout(timer); finish(null); };
    img.src = url;
  });
}

export async function gerarPDFPlanoTreino(data: PlanoTreinoPDFData): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const fases: any[] = Array.isArray(data.conteudo?.fases) ? data.conteudo.fases : [];

  // Pré-carrega todos os GIFs em paralelo (uma vez por URL).
  const urls = new Set<string>();
  fases.forEach(f => (f.sessoes || []).forEach((s: any) => (s.exercicios || []).forEach((ex: any) => { if (ex.gif_url) urls.add(ex.gif_url); })));
  const frames = new Map<string, { dataUrl: string; w: number; h: number } | null>();
  await Promise.all([...urls].map(async (u) => { frames.set(u, await carregarFrame(u)); }));

  let page = 1;
  let y = MARGIN;

  const footer = () => {
    doc.setDrawColor(...LINE); doc.setLineWidth(0.2);
    doc.line(MARGIN, PAGE_H - 12, PAGE_W - MARGIN, PAGE_H - 12);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
    doc.text('My Health ID · Plano de treino gerado por IA — apoio, não substitui avaliação profissional.', MARGIN, PAGE_H - 7);
    doc.text(`Pág. ${page}`, PAGE_W - MARGIN, PAGE_H - 7, { align: 'right' });
  };

  const novaPagina = () => { footer(); doc.addPage(); page += 1; y = MARGIN; };
  const garantir = (need: number) => { if (y + need > PAGE_H - 16) novaPagina(); };

  // Texto com quebra automática; devolve o novo y.
  const paragrafo = (txt: string, x: number, maxW: number, size: number, cor: [number, number, number], bold = false, lh = 1.35) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...cor);
    const linhas = doc.splitTextToSize(txt, maxW) as string[];
    const alturaLinha = size * 0.352778 * lh;
    for (const ln of linhas) { garantir(alturaLinha + 1); doc.text(ln, x, y); y += alturaLinha; }
    return y;
  };

  // ── Cabeçalho ──
  doc.setFillColor(...NAVY); doc.rect(0, 0, PAGE_W, 26, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(255, 255, 255);
  doc.text('Meu Plano de Treino', MARGIN, 13);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(210, 218, 235);
  doc.text(`${data.pacienteNome} · ${new Date().toLocaleDateString('pt-BR')}`, MARGIN, 20);
  // Logo da clínica no topo-direito da faixa
  if (data.clinicaLogoUrl) {
    await drawClinicLogo(doc, data.clinicaLogoUrl, PAGE_W - MARGIN - 30, 6, 30, 14);
  }
  y = 34;

  if (data.titulo) { paragrafo(data.titulo, MARGIN, CONTENT_W, 12, NAVY, true); y += 1; }
  if (data.conteudo?.resumo) { paragrafo(data.conteudo.resumo, MARGIN, CONTENT_W, 9.5, MUTED); y += 3; }

  // ── Fases → sessões → exercícios ──
  for (const f of fases) {
    garantir(14);
    // Faixa da fase
    doc.setFillColor(...PRIMARY); doc.roundedRect(MARGIN, y, CONTENT_W, 8, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(255, 255, 255);
    doc.text(String(f.nome || 'Fase'), MARGIN + 3, y + 5.4);
    if (f.semanas) { doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.text(`${f.semanas} semanas`, PAGE_W - MARGIN - 3, y + 5.4, { align: 'right' }); }
    y += 11;
    if (f.objetivo) { paragrafo(String(f.objetivo), MARGIN, CONTENT_W, 8.5, MUTED); y += 1.5; }

    for (const s of (f.sessoes || [])) {
      garantir(10);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...NAVY);
      const dur = s.duracao_min ? ` · ~${s.duracao_min} min` : '';
      paragrafo(`${s.nome || 'Treino'}${dur}`, MARGIN, CONTENT_W, 10, NAVY, true);
      if (s.aquecimento) { paragrafo(`Aquecimento: ${s.aquecimento}`, MARGIN, CONTENT_W, 8, MUTED); }
      y += 1;

      for (const ex of (s.exercicios || [])) {
        const frame = ex.gif_url ? frames.get(ex.gif_url) : null;
        const imgSize = 24; // mm
        const blocoAltura = Math.max(imgSize, 20);
        garantir(blocoAltura + 4);

        const yTop = y;
        const textoX = MARGIN + (frame ? imgSize + 4 : 0);
        const textoW = CONTENT_W - (frame ? imgSize + 4 : 0);

        if (frame) {
          try {
            const ratio = frame.h / frame.w;
            const h = Math.min(imgSize, imgSize * ratio);
            doc.setDrawColor(...LINE); doc.roundedRect(MARGIN, yTop, imgSize, imgSize, 1, 1, 'S');
            doc.addImage(frame.dataUrl, 'PNG', MARGIN + 0.5, yTop + (imgSize - h) / 2 + 0.5, imgSize - 1, h - 1);
          } catch { /* addImage falhou — segue sem imagem */ }
        }

        doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...INK);
        const nomeLinhas = doc.splitTextToSize(String(ex.nome || 'Exercício'), textoW) as string[];
        doc.text(nomeLinhas, textoX, yTop + 4);
        let yl = yTop + 4 + nomeLinhas.length * 4;

        const specs = [
          ex.series && ex.reps ? `${ex.series}×${ex.reps}` : ex.series,
          ex.carga, ex.descanso_s && `${ex.descanso_s}s descanso`,
        ].filter(Boolean).join('  ·  ');
        if (specs) { doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...PRIMARY); doc.text(specs, textoX, yl); yl += 4; }

        const explic = [ex.orientacoes, ex.obs].filter(Boolean).join(' — ');
        if (explic) {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED);
          const exLinhas = doc.splitTextToSize(explic, textoW) as string[];
          for (const ln of exLinhas.slice(0, 6)) { doc.text(ln, textoX, yl); yl += 3.4; }
        }

        y = Math.max(yTop + blocoAltura, yl) + 3;
        doc.setDrawColor(...LINE); doc.setLineWidth(0.15); doc.line(MARGIN, y - 1.5, PAGE_W - MARGIN, y - 1.5);
      }

      if (s.desaquecimento) { paragrafo(`Desaquecimento: ${s.desaquecimento}`, MARGIN, CONTENT_W, 8, MUTED); }
      y += 2;
    }
    y += 2;
  }

  if (data.conteudo?.observacoes_gerais) {
    garantir(12);
    paragrafo('Observações', MARGIN, CONTENT_W, 9.5, NAVY, true);
    paragrafo(String(data.conteudo.observacoes_gerais), MARGIN, CONTENT_W, 8.5, MUTED);
  }

  // ── Plano Alimentar (nova página) ──
  const nut = data.nutricao;
  const refeicoes: any[] = Array.isArray(nut?.refeicoes) ? nut.refeicoes
    : Array.isArray(nut?.meals) ? nut.meals : [];
  if (refeicoes.length > 0) {
    novaPagina();
    // Faixa verde de nutrição
    const GREEN: [number, number, number] = [22, 163, 74];
    doc.setFillColor(...GREEN); doc.roundedRect(MARGIN, y, CONTENT_W, 9, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(255, 255, 255);
    doc.text('Plano Alimentar', MARGIN + 3, y + 6);
    y += 13;
    if (nut.titulo) { paragrafo(String(nut.titulo), MARGIN, CONTENT_W, 11, NAVY, true); }
    if (nut.resumo) { paragrafo(String(nut.resumo), MARGIN, CONTENT_W, 9, MUTED); y += 1; }

    // Metas do dia (kcal + macros)
    const metas = [
      nut.calorias_totais && `${nut.calorias_totais} kcal/dia`,
      nut.macros?.proteina_g && `Proteína ${nut.macros.proteina_g}g`,
      nut.macros?.carbo_g && `Carbo ${nut.macros.carbo_g}g`,
      nut.macros?.gordura_g && `Gordura ${nut.macros.gordura_g}g`,
    ].filter(Boolean).join('   ·   ');
    if (metas) { paragrafo(metas, MARGIN, CONTENT_W, 9.5, PRIMARY, true); y += 1; }

    for (const r of refeicoes) {
      const itens: any[] = Array.isArray(r.itens) ? r.itens : Array.isArray(r.alimentos) ? r.alimentos : [];
      garantir(10 + itens.length * 4);
      const cab = `${r.nome || r.refeicao || 'Refeição'}${(r.horario || r.hora) ? ` · ${r.horario || r.hora}` : ''}${r.calorias ? ` · ${r.calorias} kcal` : ''}`;
      paragrafo(cab, MARGIN, CONTENT_W, 9.5, NAVY, true);
      for (const it of itens) {
        const nome = it.alimento || it.nome || String(it);
        const dir = [it.porcao || it['porção'], it.kcal && `${it.kcal} kcal`].filter(Boolean).join(' · ');
        garantir(4.5);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...INK);
        doc.text(String(nome), MARGIN + 2, y);
        if (dir) { doc.setTextColor(...MUTED); doc.text(dir, PAGE_W - MARGIN, y, { align: 'right' }); }
        y += 4.2;
      }
      if (r.substituicoes) { paragrafo(`Trocas: ${r.substituicoes}`, MARGIN + 2, CONTENT_W - 2, 8, MUTED); }
      y += 2;
    }

    if (Array.isArray(nut.orientacoes) && nut.orientacoes.length) {
      garantir(10);
      paragrafo('Orientações', MARGIN, CONTENT_W, 9.5, NAVY, true);
      for (const o of nut.orientacoes) paragrafo(`• ${o}`, MARGIN + 2, CONTENT_W - 2, 8.5, MUTED);
    }
    if (Array.isArray(nut.lista_compras) && nut.lista_compras.length) {
      garantir(10);
      paragrafo('Lista de compras', MARGIN, CONTENT_W, 9.5, NAVY, true);
      paragrafo(nut.lista_compras.join(' · '), MARGIN + 2, CONTENT_W - 2, 8.5, MUTED);
    }
  }

  footer();

  // Timbre: logo da clínica como marca-d'água clara em todas as páginas.
  if (data.clinicaLogoUrl) {
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      await drawLogoWatermark(doc, data.clinicaLogoUrl, PAGE_W / 2, 160, 90, 0.05);
    }
  }

  return doc.output('blob');
}
