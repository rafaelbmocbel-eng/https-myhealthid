// Importado pelos geradores de PDF: troca o doc.save() do jsPDF pela entrega
// central (janela "PDF pronto"), para todo PDF ter a opção de WhatsApp.
import jsPDF from 'jspdf';
import { entregarPdf } from './entrega';

const api = (jsPDF as any).API;
if (api && !api.__mhEntrega) {
  const original = api.save;
  api.__mhEntrega = true;
  api.save = function (this: any, nome?: string, opcoes?: any) {
    if (opcoes?.returnPromise || (globalThis as any).__mhPdfDireto) return original.apply(this, [nome, opcoes]);
    entregarPdf({ blob: this.output('blob'), nome: nome || 'documento.pdf' });
    return this;
  };
}
