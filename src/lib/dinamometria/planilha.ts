// Leitor de planilhas exportadas pelos dinamômetros (.xlsx, .csv, .txt) sem
// dependências: o .xlsx é um ZIP de XMLs, descompactado com o
// DecompressionStream nativo do navegador. O .xls antigo (binário) não é lido.

export type Celula = string | number | null;
export interface Aba { nome: string; linhas: Celula[][] }

const dec = new TextDecoder('utf-8');

async function inflarRaw(dados: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([dados.slice()]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function lerZip(buf: ArrayBuffer): Promise<Map<string, () => Promise<string>>> {
  const v = new DataView(buf);
  const u8 = new Uint8Array(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Arquivo .xlsx corrompido ou não é uma planilha.');
  const total = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const arquivos = new Map<string, () => Promise<string>>();
  for (let n = 0; n < total; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const metodo = v.getUint16(p + 10, true);
    const tamComp = v.getUint32(p + 20, true);
    const lenNome = v.getUint16(p + 28, true);
    const lenExtra = v.getUint16(p + 30, true);
    const lenCom = v.getUint16(p + 32, true);
    const offLocal = v.getUint32(p + 42, true);
    const nome = dec.decode(u8.subarray(p + 46, p + 46 + lenNome));
    p += 46 + lenNome + lenExtra + lenCom;
    arquivos.set(nome, async () => {
      const ln = v.getUint16(offLocal + 26, true);
      const le = v.getUint16(offLocal + 28, true);
      const ini = offLocal + 30 + ln + le;
      const bruto = u8.subarray(ini, ini + tamComp);
      if (metodo === 0) return dec.decode(bruto);
      if (metodo === 8) return dec.decode(await inflarRaw(bruto));
      throw new Error('Compressão do arquivo não suportada.');
    });
  }
  return arquivos;
}

const porNome = (doc: Document | Element, tag: string) => Array.from(doc.getElementsByTagNameNS('*', tag));

function colunaIndice(ref: string): number {
  const letras = ref.replace(/[0-9]/g, '');
  let n = 0;
  for (const ch of letras) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

async function lerXlsx(buf: ArrayBuffer): Promise<Aba[]> {
  const zip = await lerZip(buf);
  const ler = async (caminho: string) => {
    const f = zip.get(caminho);
    return f ? new DOMParser().parseFromString(await f(), 'application/xml') : null;
  };
  const wb = await ler('xl/workbook.xml');
  if (!wb) throw new Error('Não encontrei as abas da planilha.');
  const rels = await ler('xl/_rels/workbook.xml.rels');
  const alvo = new Map<string, string>();
  if (rels) for (const r of porNome(rels, 'Relationship')) alvo.set(r.getAttribute('Id') || '', r.getAttribute('Target') || '');

  const compartilhadas: string[] = [];
  const ss = await ler('xl/sharedStrings.xml');
  if (ss) for (const si of porNome(ss, 'si')) compartilhadas.push(porNome(si, 't').map(t => t.textContent || '').join(''));

  const abas: Aba[] = [];
  for (const s of porNome(wb, 'sheet')) {
    const rid = s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || s.getAttribute('r:id') || '';
    let caminho = alvo.get(rid) || '';
    if (!caminho) continue;
    caminho = caminho.startsWith('/') ? caminho.slice(1) : `xl/${caminho.replace(/^\.\//, '')}`;
    const doc = await ler(caminho);
    if (!doc) continue;
    const linhas: Celula[][] = [];
    for (const row of porNome(doc, 'row')) {
      const ri = Number(row.getAttribute('r') || linhas.length + 1) - 1;
      const linha: Celula[] = [];
      let ci = 0;
      for (const c of Array.from(row.children).filter(e => e.localName === 'c')) {
        const ref = c.getAttribute('r');
        if (ref) ci = colunaIndice(ref);
        const t = c.getAttribute('t');
        const vEl = Array.from(c.children).find(e => e.localName === 'v');
        let val: Celula = null;
        if (t === 's' && vEl) val = compartilhadas[Number(vEl.textContent)] ?? null;
        else if (t === 'inlineStr') val = porNome(c, 't').map(x => x.textContent || '').join('');
        else if (t === 'str' || t === 'e') val = vEl?.textContent ?? null;
        else if (vEl) { const n = Number(vEl.textContent); val = Number.isFinite(n) ? n : vEl.textContent; }
        linha[ci] = val;
        ci++;
      }
      linhas[ri] = linha;
    }
    abas.push({ nome: s.getAttribute('name') || `Aba ${abas.length + 1}`, linhas: Array.from(linhas, l => l || []) });
  }
  return abas;
}

function lerTexto(texto: string): Aba[] {
  const linhasTxt = texto.replace(/\r/g, '').split('\n').filter(l => l.trim() !== '');
  const amostra = linhasTxt.slice(0, 30).join('\n');
  const conta = (d: string) => amostra.split(d).length;
  const delim = ['\t', ';', ','].sort((a, b) => conta(b) - conta(a))[0];
  const linhas = linhasTxt.map(l => {
    const out: Celula[] = [];
    let atual = '', aspas = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (ch === '"') { aspas = !aspas; continue; }
      if (ch === delim && !aspas) { out.push(atual.trim()); atual = ''; continue; }
      atual += ch;
    }
    out.push(atual.trim());
    return out;
  });
  return [{ nome: 'Dados', linhas }];
}

export async function lerPlanilha(file: File): Promise<Aba[]> {
  const nome = file.name.toLowerCase();
  if (nome.endsWith('.xls')) throw new Error('Arquivos .xls antigos não são lidos. Salve como .xlsx ou .csv no Excel.');
  const buf = await file.arrayBuffer();
  const u8 = new Uint8Array(buf, 0, Math.min(4, buf.byteLength));
  const ehZip = u8[0] === 0x50 && u8[1] === 0x4b;
  if (ehZip) return lerXlsx(buf);
  return lerTexto(dec.decode(buf));
}
