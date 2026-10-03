import { useEffect, useState } from 'react';
import { Download, ImageDown, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// Mostra o PDF como imagens (uma por página) dentro do app: no Android o
// navegador não exibe PDF embutido, e assim dá para ver, tirar print ou salvar
// cada página como imagem sem baixar o arquivo.
export default function PreviaPdfDialog({ arquivo, titulo, onClose }: {
  arquivo: { blob: Blob; nome: string } | null;
  titulo: string;
  onClose: () => void;
}) {
  const [paginas, setPaginas] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!arquivo) { setPaginas([]); setErro(null); return; }
    let cancelado = false;
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
        pdfjs.GlobalWorkerOptions.workerSrc = worker;
        const doc = await pdfjs.getDocument({ data: await arquivo.blob.arrayBuffer() }).promise;
        const out: string[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const pg = await doc.getPage(i);
          const vp = pg.getViewport({ scale: 2 });
          const cv = document.createElement('canvas');
          cv.width = vp.width; cv.height = vp.height;
          const ctx = cv.getContext('2d');
          if (!ctx) continue;
          await pg.render({ canvasContext: ctx, viewport: vp }).promise;
          out.push(cv.toDataURL('image/png'));
          if (cancelado) return;
          setPaginas([...out]);
        }
      } catch (e: any) {
        if (!cancelado) setErro(e?.message || 'Não consegui montar a prévia.');
      }
    })();
    return () => { cancelado = true; };
  }, [arquivo]);

  const baixarPdf = () => {
    if (!arquivo) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(arquivo.blob);
    a.download = arquivo.nome;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const salvarPagina = (src: string, i: number) => {
    const a = document.createElement('a');
    a.href = src;
    a.download = `${(arquivo?.nome || 'relatorio').replace(/\.pdf$/, '')}_pagina_${i + 1}.png`;
    a.click();
  };

  return (
    <Dialog open={!!arquivo} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl h-[92dvh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 pb-3 border-b border-border/50 shrink-0">
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>Exatamente como sai no PDF. Toque e segure numa página para salvar a imagem, ou use os botões.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto bg-muted/50 p-3 space-y-3">
          {erro ? (
            <p className="text-sm text-red-600 p-4">{erro}</p>
          ) : !paginas.length ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2 text-sm text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /> Montando a prévia…</div>
          ) : (
            paginas.map((src, i) => (
              <div key={i} className="space-y-1">
                <img src={src} alt={`Página ${i + 1}`} className="w-full rounded-md shadow-md bg-white" />
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span>Página {i + 1}</span>
                  <button className="flex items-center gap-1 underline" onClick={() => salvarPagina(src, i)}><ImageDown className="h-3.5 w-3.5" /> Salvar como imagem</button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="p-3 border-t border-border/50 shrink-0 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button className="gap-1.5" onClick={baixarPdf} disabled={!arquivo}><Download className="h-4 w-4" /> Baixar PDF</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
