/*
 * Etapa 3: apoio à avaliação biomecânica do movimento pelo profissional (módulos puros, sem React). Fluxo:
 *
 *   const trilha = ...                                                      // TrilhaPose do motor de vídeo (../video)
 *   const analise = analisarMovimento('agachamento_lateral', trilha, { criterios });   // medidas por repetição e por lado, achados
 *   const laudo = montarLaudo(analise, contexto, BIBLIOTECA);               // texto determinístico + hipóteses curadas
 *   const pdf = await gerarPdfLaudo(laudo);                                 // importar sob demanda (jsPDF)
 *
 * Especificação do produto: docs/avaliacao-movimento-v3.md. Não é treino, não dá nota e não diagnostica.
 */
export * from './tipos';
export * from './vocabulario';
export * from './protocolos';
export * from './criterios';
export * from './analisarMovimento';
export * from './laudo';
export * from './laudoPdf';
export * from './biblioteca';
