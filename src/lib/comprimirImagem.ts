// Comprime/redimensiona uma imagem NO NAVEGADOR antes de subir para o Storage.
// Sem isto, fotos em resolução cheia enchem o bucket rápido (foi o que estourou
// o limite de 1 GB). Redimensiona para no máximo `maxLado` px e recodifica em
// JPEG. GIF e SVG passam intactos (compressão perderia animação/vetor).
export async function comprimirImagem(
  file: File,
  maxLado = 1024,
  qualidade = 0.8,
): Promise<Blob> {
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  if (!file.type.startsWith('image/')) return file;

  try {
    const dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = () => rej(new Error('leitura falhou'));
      r.readAsDataURL(file);
    });
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('decode falhou'));
      i.src = dataUrl;
    });

    let { width, height } = img;
    if (width > maxLado || height > maxLado) {
      const escala = maxLado / Math.max(width, height);
      width = Math.round(width * escala);
      height = Math.round(height * escala);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, 'image/jpeg', qualidade),
    );
    // Se a compressão não ajudou (imagem já pequena), mantém o menor.
    if (blob && blob.size < file.size) return blob;
    return file;
  } catch {
    // Qualquer falha de canvas/decode: sobe o original (melhor que travar o upload).
    return file;
  }
}
