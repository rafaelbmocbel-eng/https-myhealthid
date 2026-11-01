// Ajustes do microfone para gravar a voz. O "filtro de ruído e eco" do celular (cancelamento de eco + supressão de
// ruído) foi feito para chamadas: no Android costuma colocar o microfone no modo de telefone, que favorece quem está
// perto do aparelho e abafa o resto da sala. Numa consulta com o celular na mesa isso pode atrapalhar a transcrição,
// então a pessoa pode desligar. O ganho automático de volume fica sempre ligado: ajuda a captar quem fala mais longe.
const CHAVE = 'mhid:voz:filtro-ruido';

export function restricoesDeAudio(filtroRuido: boolean): MediaTrackConstraints {
  return { echoCancellation: filtroRuido, noiseSuppression: filtroRuido, autoGainControl: true, channelCount: 1 };
}

/** Padrão: ligado (o comportamento de sempre). Só vira desligado se a pessoa escolheu isso. */
export function lerFiltroRuido(): boolean {
  try {
    return window.localStorage.getItem(CHAVE) !== 'desligado';
  } catch {
    return true; // armazenamento bloqueado (janela anônima, dados do site recusados): segue com o padrão
  }
}

export function salvarFiltroRuido(ligado: boolean): void {
  try {
    if (ligado) window.localStorage.removeItem(CHAVE);
    else window.localStorage.setItem(CHAVE, 'desligado');
  } catch {
    // sem armazenamento: vale só nesta tela
  }
}
