/** Texto da caixa que o profissional precisa marcar antes de baixar ou compartilhar a arte. */
export const TEXTO_CONSENTIMENTO = 'O paciente autorizou por escrito o uso da imagem para divulgação';

export const AVISO_CONSELHO = 'A publicidade em saúde deve seguir as normas do seu conselho profissional.';

export const DICA_TITULO_SEM_PACIENTE = 'Não use o nome do paciente no título nem na legenda.';

/** Baixar e compartilhar só liberam com o consentimento marcado e sem outra geração em andamento. */
export function podeExportar(autorizado: boolean, ocupado = false): boolean {
  return autorizado === true && !ocupado;
}
