import { useCallback, useState, type MutableRefObject } from 'react';
import { toast } from 'sonner';
import type { PedidoDeConfirmacao } from '@/components/angular/ConfirmarAcao';
import { detectarPose } from '@/lib/angular/detector';
import { nomeDoResultado, type Ponto } from '@/lib/angular/medidas';
import { pontosDoPrumo, sugerirPontos, trocarDireitaEsquerda } from '@/lib/angular/pose';
import { vistaBaseDaSessao, type VistaSessao } from '@/lib/angular/tiposSessao';
import {
  idsAplicaveis, temPontos, type AcoesDaSessao, type EstadoSessao, type FotoDaPosicao, type ModoDeAplicar, type SugestaoGuardada,
} from '@/hooks/useSessaoPostural';

const MSG_SEM_CORPO = 'Não achei o corpo na foto. Marque os pontos à mão.';
const MSG_CORTADO = 'O corpo apareceu cortado ou pouco nítido. Marque os pontos à mão.';
const MSG_SEM_MODELO = 'Não consegui carregar a marcação automática agora (talvez sem internet). Marque os pontos à mão ou toque em Automático para tentar de novo.';

const nomes = (ids: string[]) => ids.map((id) => nomeDoResultado(id) ?? id).join(', ');
const so = (pontos: Record<string, Ponto[]>, ids: string[]) => Object.fromEntries(ids.map((id) => [id, pontos[id]]));

interface OpcoesRodar {
  /** Foto recém-carregada (o estado ainda não a mostra); sem ela vale a foto atual da posição. */
  foto?: FotoDaPosicao;
  /** Chamada ao carregar a foto: sem avisos na tela além do painel da marcação, e nunca pergunta. */
  silencioso?: boolean;
  modo?: ModoDeAplicar;
  inverterDE?: boolean;
  perguntarSeHouverPontos?: boolean;
}

/**
 * Marcação automática por posição: sugere os pontos do modelo com a vista e o lado da posição, guarda o que achou
 * (avisos e medidas sem ponto) para a tela mostrar, e nunca sobrescreve pontos já marcados sem perguntar.
 */
export function useMarcacaoAutomatica(
  sessao: { estadoRef: MutableRefObject<EstadoSessao>; acoes: AcoesDaSessao },
  confirmar: (p: PedidoDeConfirmacao) => void,
) {
  const [detectando, setDetectando] = useState<VistaSessao | null>(null);
  const { estadoRef, acoes } = sessao;

  const semMarcacao = useCallback((posicao: VistaSessao, foto: FotoDaPosicao, mensagem: string) => {
    const vazio: SugestaoGuardada = { avisos: [mensagem], descartados: [], origens: {}, marcadas: 0 };
    acoes.aplicarSugestao({ posicao, img: foto.img, pontos: {}, modo: 'vazias', sugestao: vazio });
  }, [acoes]);

  const rodar = useCallback(async (posicao: VistaSessao, o: OpcoesRodar = {}) => {
    const antes = estadoRef.current.itens[posicao];
    const foto = o.foto ?? antes.foto;
    if (!foto) return;
    const silencioso = !!o.silencioso;
    // O estado pode ainda ser o da foto anterior (a foto nova acabou de entrar): landmarks e inversão só valem para a mesma foto.
    const mesmaFoto = antes.foto?.img === foto.img;
    setDetectando(posicao);
    try {
      const lm = (mesmaFoto ? antes.landmarks : null) ?? await detectarPose(foto.img);
      if (!lm) {
        semMarcacao(posicao, foto, MSG_SEM_CORPO);
        if (!silencioso) toast.error(MSG_SEM_CORPO);
        return;
      }
      const inverterDE = o.inverterDE ?? (mesmaFoto ? antes.inverterDE : false);
      const { vista, lado } = vistaBaseDaSessao(posicao);
      const s = sugerirPontos(lm, vista, foto.w, foto.h, lado, { inverterDE });
      const ids = Object.keys(s.sugeridos);
      const modo = o.modo ?? 'vazias';
      const sugestao: SugestaoGuardada = { avisos: s.avisos, descartados: s.descartados, origens: s.origens, marcadas: 0 };
      acoes.aplicarSugestao({ posicao, img: foto.img, pontos: s.sugeridos, modo, landmarks: lm, sugestao, inverterDE, ativar: ids[0] });
      if (silencioso) return;

      if (!ids.length) { toast.warning(MSG_CORTADO); return; }
      const aplicadas = idsAplicaveis(antes, ids, modo);
      const mantidas = ids.filter((id) => !aplicadas.includes(id));
      if (modo === 'substituiveis') {
        toast.success(`Troquei direito e esquerdo e refiz ${aplicadas.length} medida(s) sugerida(s).${mantidas.length ? ` Mantive ${mantidas.length} que você já tinha ajustado.` : ''} Confira cada ponto.`);
        return;
      }
      if (aplicadas.length) toast.success(`Marquei ${aplicadas.length} medida(s) que estavam sem pontos. Confira cada ponto e arraste o que estiver fora do lugar.`);
      else toast.info('Todas as medidas sugeridas já tinham pontos.');
      const comPontos = ids.filter((id) => temPontos(antes, id));
      if (o.perguntarSeHouverPontos && comPontos.length) {
        confirmar({
          titulo: 'Trocar os pontos já marcados?',
          texto: `Já há pontos em: ${nomes(comPontos)}. O Automático só preencheu o que estava vazio. Quer trocar também esses pelos pontos sugeridos? O que você ajustou neles será perdido.`,
          confirmar: 'Trocar pelos sugeridos',
          cancelar: 'Manter os meus pontos',
          aoConfirmar: () => acoes.aplicarSugestao({ posicao, img: foto.img, pontos: so(s.sugeridos, comPontos), modo: 'todas', ativar: comPontos[0] }),
        });
      }
    } catch {
      // Sem internet para baixar o modelo, ou navegador sem suporte: segue a marcação manual, com o aviso na tela.
      semMarcacao(posicao, foto, MSG_SEM_MODELO);
      if (!silencioso) toast.error(MSG_SEM_MODELO);
    } finally {
      setDetectando((d) => (d === posicao ? null : d));
    }
  }, [acoes, confirmar, estadoRef, semMarcacao]);

  /** Ao carregar a foto: sugere só nas medidas sem pontos e não pergunta nada. */
  const aoCarregarFoto = useCallback((posicao: VistaSessao, foto: FotoDaPosicao) => rodar(posicao, { foto, silencioso: true, modo: 'vazias', inverterDE: false }), [rodar]);

  /** Botão "Automático": preenche as medidas sem pontos e pergunta antes de trocar as que já têm. */
  const automatico = useCallback((posicao: VistaSessao) => rodar(posicao, { modo: 'vazias', perguntarSeHouverPontos: true }), [rodar]);

  /** "Inverter D/E": o modelo rotulou os lados do paciente ao contrário. Refaz só o que ainda é pura sugestão. */
  const alternarDireitaEsquerda = useCallback((posicao: VistaSessao) => {
    const item = estadoRef.current.itens[posicao];
    return rodar(posicao, { modo: 'substituiveis', inverterDE: !item.inverterDE });
  }, [estadoRef, rodar]);

  const aplicarPrumo = useCallback(async (posicao: VistaSessao) => {
    const item = estadoRef.current.itens[posicao];
    const foto = item.foto;
    if (!foto) return;
    setDetectando(posicao);
    try {
      const lm = item.landmarks ?? await detectarPose(foto.img);
      if (!lm) { toast.error(MSG_SEM_CORPO); return; }
      const { vista, lado } = vistaBaseDaSessao(posicao);
      const s = pontosDoPrumo(item.inverterDE ? trocarDireitaEsquerda(lm) : lm, vista, foto.w, foto.h, lado);
      if (!s) { toast.warning(MSG_CORTADO); return; }
      const anterior = item.sugestao;
      const avisos = [...new Set([...(anterior?.avisos ?? []), ...s.avisos])];
      acoes.aplicarSugestao({
        posicao, img: foto.img, pontos: { [s.medidaId]: s.pontos }, modo: 'todas', landmarks: lm, olhaPara: s.olhaPara, ativar: s.medidaId,
        sugestao: { avisos, descartados: anterior?.descartados ?? [], origens: anterior?.origens ?? {}, marcadas: 0 },
      });
      toast.success('Sugeri o apoio e os pontos do fio. Confira cada ponto e arraste o que estiver fora do lugar.');
    } catch {
      // Sem internet para baixar o modelo, ou navegador sem suporte: segue a marcação manual.
      toast.error(MSG_SEM_MODELO);
    } finally {
      setDetectando((d) => (d === posicao ? null : d));
    }
  }, [acoes, estadoRef]);

  /** "Sugerir os pontos do fio": pergunta antes se o fio já tem pontos. */
  const sugerirPrumo = useCallback((posicao: VistaSessao) => {
    const item = estadoRef.current.itens[posicao];
    const medida = vistaBaseDaSessao(posicao).vista === 'perfil' ? 'prumo-perfil' : 'prumo-frente';
    if (temPontos(item, medida)) {
      confirmar({
        titulo: 'Trocar os pontos do fio?',
        texto: 'O fio de prumo já tem pontos nesta posição. Os pontos sugeridos vão substituí-los.',
        confirmar: 'Trocar pelos sugeridos',
        cancelar: 'Manter os meus pontos',
        aoConfirmar: () => void aplicarPrumo(posicao),
      });
      return Promise.resolve();
    }
    return aplicarPrumo(posicao);
  }, [aplicarPrumo, confirmar, estadoRef]);

  return { detectando, aoCarregarFoto, automatico, alternarDireitaEsquerda, sugerirPrumo };
}
