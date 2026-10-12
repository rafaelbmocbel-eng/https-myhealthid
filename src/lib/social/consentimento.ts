/** Texto da caixa que o profissional precisa marcar antes de baixar ou compartilhar a arte. */
export const TEXTO_CONSENTIMENTO = 'O paciente autorizou por escrito o uso da imagem para divulgação';

export const AVISO_CONSELHO = 'A publicidade em saúde deve seguir as normas do seu conselho profissional.';

export const DICA_TITULO_SEM_PACIENTE = 'Não use o nome do paciente no título nem na legenda.';

/** Texto da caixa que o profissional marca quando o app não achou o rosto sozinho e a área foi posicionada à mão. */
export const TEXTO_ROSTO_CONFERIDO = 'Conferi na prévia que o rosto está coberto';

/**
 * Baixar e compartilhar só liberam com o consentimento marcado e sem outra geração em andamento. Com
 * `rostoPendente` (rosto não localizado e a cobertura ainda não conferida), seguem travados: a área padrão pode
 * não estar sobre o rosto.
 */
export function podeExportar(autorizado: boolean, ocupado = false, rostoPendente = false): boolean {
  return autorizado === true && !ocupado && !rostoPendente;
}
