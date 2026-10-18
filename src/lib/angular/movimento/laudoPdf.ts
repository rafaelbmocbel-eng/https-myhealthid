import type { LaudoMovimento } from './tipos';

/*
 * DONO: agente L (laudo). Assinatura do contrato; o corpo é provisório e só L o substitui.
 *
 * Desenha o `LaudoMovimento` já montado (nenhuma regra de conteúdo aqui) com jsPDF, no padrão de ../relatorioVideo.ts e com o rodapé
 * fixo "Estimativa por vídeo · não é diagnóstico" em todas as páginas. A tela deve importar este módulo sob demanda
 * (`await import(...)`) para o jsPDF não entrar no pacote principal.
 */
export async function gerarPdfLaudo(laudo: LaudoMovimento): Promise<Blob> {
  void laudo;
  throw new Error('não implementado');
}
