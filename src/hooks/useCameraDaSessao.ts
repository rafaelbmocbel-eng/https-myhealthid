import { useState, type MutableRefObject } from 'react';
import type { PedidoDeConfirmacao } from '@/components/angular/ConfirmarAcao';
import { ROTULO_VISTA_SESSAO, type VistaSessao } from '@/lib/angular/tiposSessao';
import { proximaPosicao, temMarcacao, type AcoesDaSessao, type EstadoSessao } from '@/hooks/useSessaoPostural';

export interface EstadoDaCamera {
  posicao: VistaSessao;
  /** Posições já fotografadas ou puladas nesta abertura da câmera (a foto ainda pode estar sendo preparada). */
  feitas: VistaSessao[];
  /** As que de fato foram fotografadas (sem as puladas), na ordem em que saíram. */
  fotografadas: VistaSessao[];
  ultima: string;
  /** Segue para a próxima posição depois de cada foto; sem isso é uma foto avulsa (trocar a foto de uma posição). */
  sequencia: boolean;
}

/**
 * Câmera do app em sequência: depois de cada foto a mesma câmera segue para a próxima posição sem foto (e a aba acompanha),
 * sem reabrir; ao acabar, volta para a primeira posição fotografada (se todas foram puladas, a tela fica onde está). Como foto avulsa, fecha depois da foto.
 */
export function useCameraDaSessao(o: {
  estadoRef: MutableRefObject<EstadoSessao>;
  acoes: AcoesDaSessao;
  confirmar: (p: PedidoDeConfirmacao) => void;
  /** Guarda a foto na posição (o preparo é assíncrono). */
  guardarFoto: (alvo: VistaSessao, arquivo: Blob, inclinacao: number | null) => void;
}) {
  const { estadoRef, acoes, confirmar, guardarFoto } = o;
  const [camera, setCamera] = useState<EstadoDaCamera | null>(null);

  // Trocar a foto de uma posição com pontos pede confirmação antes de abrir a câmera: os pontos dela seriam apagados.
  const abrir = (alvo: VistaSessao, sequencia: boolean) => {
    const iniciar = () => setCamera({ posicao: alvo, feitas: [], fotografadas: [], ultima: '', sequencia });
    if (temMarcacao(estadoRef.current.itens[alvo])) {
      confirmar({
        titulo: 'Trocar a foto desta posição?',
        texto: `Os pontos marcados em ${ROTULO_VISTA_SESSAO[alvo].toLowerCase()} serão apagados quando a nova foto for tirada. As outras posições não mudam.`,
        confirmar: 'Tirar outra foto',
        aoConfirmar: iniciar,
      });
      return;
    }
    iniciar();
  };

  const seguir = (c: EstadoDaCamera, feitas: VistaSessao[], fotografadas: VistaSessao[], ultima: string) => {
    const proxima = proximaPosicao(estadoRef.current, c.posicao, feitas);
    if (!c.sequencia || !proxima) {
      setCamera(null);
      if (c.sequencia && fotografadas.length) acoes.ir(fotografadas[0]);
      return;
    }
    acoes.ir(proxima);
    setCamera({ posicao: proxima, feitas, fotografadas, ultima, sequencia: true });
  };

  const aoCapturar = (arquivo: File, inclinacao: number | null) => {
    if (!camera) return;
    guardarFoto(camera.posicao, arquivo, inclinacao);
    seguir(camera, [...camera.feitas, camera.posicao], [...camera.fotografadas, camera.posicao], `${ROTULO_VISTA_SESSAO[camera.posicao]} guardada.`);
  };
  const aoPular = () => {
    if (!camera) return;
    acoes.pular(camera.posicao);
    seguir(camera, [...camera.feitas, camera.posicao], camera.fotografadas, `${ROTULO_VISTA_SESSAO[camera.posicao]} pulada.`);
  };

  return { camera, abrir, fechar: () => setCamera(null), aoCapturar, aoPular };
}
