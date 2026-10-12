/*
 * Motor da análise de vídeo (puro, sem UI). Fluxo típico:
 *
 *   const trilha = await rastrearVideo(video, { fps, detector?, onProgresso, sinal });      // pontos em pixels, um item por quadro
 *   let hist = criarHistorico(trilha);                                                       // desfazer/refazer
 *   hist = registrar(hist, corrigirPonto(hist.presente, indice, 'joelho_d', { x, y }));      // quadro-chave (arrastar o ponto)
 *   const analise = analisarGesto('marcha', hist.presente, { eventos?, escalaCmPorPx? });    // séries, eventos sugeridos, métricas
 *   const cartoes = montarCartoes(analise.metricas, 'marcha');                               // valor + referência (só com fonte) + dentro/fora
 *   const caixas = caixasDoRosto(hist.presente);                                             // cobertura do rosto por quadro
 *   const texto = serializarTrilha(hist.presente);                                           // salvar; lerTrilha(texto) para retomar
 *
 * Código só de teste (não entra no build de produção porque nada de produção o importa): detectorFalso.ts, figuraSintetica.ts,
 * videoFalso.ts e videoSintetico.ts. Valores de referência: referencias.ts (REFERENCIAS).
 */
export * from './tipos';
export * from './trilha';
export * from './historico';
export * from './correcao';
export * from './suavizar';
export * from './angulos';
export * from './eventos';
export * from './modelos';
export * from './metricas';
export * from './referencias';
export * from './rostoPorQuadro';
export * from './rastrear';
