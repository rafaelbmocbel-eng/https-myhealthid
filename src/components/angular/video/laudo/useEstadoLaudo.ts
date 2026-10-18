import { useCallback, useMemo, useState } from 'react';
import type { IdGesto } from '@/lib/angular/video/modelos';
import { protocolosDoGesto } from '@/lib/angular/movimento/protocolos';
import type { CriterioProfissional, IdProtocolo, PlanoCamera, Protocolo } from '@/lib/angular/movimento/tipos';

/*
 * Estado da aba Laudo que precisa viver fora dela: o protocolo escolhido e os critérios do profissional entram no arquivo .json
 * salvo e no rascunho. O cálculo pesado fica em useAnaliseMovimento, só montado quando a aba está aberta.
 */

type Atualizacao<T> = T | ((anterior: T) => T);

export interface EstadoLaudo {
  /** Protocolos do gesto atual (vazio quando o gesto ainda não tem protocolo). */
  protocolos: Protocolo[];
  /** Protocolo em uso: o escolhido, ou o padrão do gesto (o da vista declarada); null se o gesto não tem protocolo. */
  protocoloId: IdProtocolo | null;
  /** Escolha explícita do profissional (null = padrão): é o que vai para o arquivo salvo. */
  protocoloEscolhido: IdProtocolo | null;
  escolherProtocolo: (id: IdProtocolo) => void;
  criterios: CriterioProfissional[];
  mudarCriterios: (novos: Atualizacao<CriterioProfissional[]>) => void;
  /** Volta ao que o arquivo salvo guardava (ou ao vazio, para uma análise nova). */
  restaurar: (criterios?: CriterioProfissional[], protocolo?: IdProtocolo) => void;
}

/** O padrão é o protocolo da vista que o profissional declarou ao escolher o gesto; sem ele, o primeiro do gesto. */
export function protocoloPadrao(protocolos: readonly Protocolo[], vistaDeclarada: PlanoCamera): Protocolo | null {
  return protocolos.find((p) => p.planoFilmado === vistaDeclarada) ?? protocolos[0] ?? null;
}

export function useEstadoLaudo(gesto: IdGesto, vistaDeclarada: PlanoCamera): EstadoLaudo {
  const [escolhido, setEscolhido] = useState<IdProtocolo | null>(null);
  const [criterios, setCriterios] = useState<CriterioProfissional[]>([]);

  const protocolos = useMemo(() => protocolosDoGesto(gesto), [gesto]);
  // Uma escolha feita para outro gesto (o profissional trocou o gesto depois) deixa de valer e volta ao padrão.
  const protocoloEscolhido = escolhido && protocolos.some((p) => p.id === escolhido) ? escolhido : null;
  const protocoloId = protocoloEscolhido ?? protocoloPadrao(protocolos, vistaDeclarada)?.id ?? null;

  const restaurar = useCallback((c?: CriterioProfissional[], p?: IdProtocolo) => {
    setCriterios(c ?? []);
    setEscolhido(p ?? null);
  }, []);

  return { protocolos, protocoloId, protocoloEscolhido, escolherProtocolo: setEscolhido, criterios, mudarCriterios: setCriterios, restaurar };
}
