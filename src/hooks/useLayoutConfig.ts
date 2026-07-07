import { useState, useCallback } from 'react';

export interface BotaoConfig {
  label: string;
  visivel: boolean;
  tamanho: 'sm' | 'md' | 'lg';
  variante?: 'primary' | 'outline' | 'ghost';
}

export interface TabConfig {
  id: string;
  defaultLabel: string;
  label: string;
  visivel: boolean;
  ordem: number;
}

export interface LayoutConfig {
  version: 1;

  // ── Botões de Ação ──────────────────────────────────────────────────────────
  botao_presencial: BotaoConfig;
  botao_resposta_completa: BotaoConfig;
  botoes_unidos: boolean;
  // Onde os botões aparecem: 'topo' = acima das sub-abas | 'rodape' = abaixo
  botoes_posicao: 'topo' | 'rodape';
  // Direção do grupo de botões
  botoes_direcao: 'row' | 'column';
  // Alinhamento horizontal dos botões
  botoes_alinhamento: 'start' | 'center' | 'end' | 'between';
  // Largura do botão principal
  botao_presencial_largura: 'auto' | 'half' | 'full';

  // ── Abas ────────────────────────────────────────────────────────────────────
  main_tabs: TabConfig[];
  sub_tabs: TabConfig[];
  tabs_compacto: boolean;
  tabs_icone: boolean;

  // ── Header ──────────────────────────────────────────────────────────────────
  header_portal: boolean;
  header_docs: boolean;
  header_identidade: boolean;

  // ── Seções da Página ────────────────────────────────────────────────────────
  mostrar_stats: boolean;
  mostrar_lgpd: boolean;
  mostrar_decisao: boolean;
}

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  version: 1,

  botao_presencial: { label: 'Iniciar Avaliação Presencial', visivel: true, tamanho: 'lg', variante: 'primary' },
  botao_resposta_completa: { label: 'Resposta Completa', visivel: true, tamanho: 'sm' },
  botoes_unidos: false,
  botoes_posicao: 'topo',
  botoes_direcao: 'row',
  botoes_alinhamento: 'between',
  botao_presencial_largura: 'auto',

  main_tabs: [
    { id: 'presencial', defaultLabel: 'Avaliação', label: 'Avaliação', visivel: true, ordem: 0 },
    { id: 'diretrizes', defaultLabel: 'Diretrizes', label: 'Diretrizes', visivel: true, ordem: 1 },
    { id: 'evolucao-prontuario', defaultLabel: 'Prontuário', label: 'Prontuário', visivel: true, ordem: 2 },
    { id: 'portal', defaultLabel: 'Portal', label: 'Portal', visivel: true, ordem: 3 },
    { id: 'historico', defaultLabel: 'Histórico', label: 'Histórico', visivel: true, ordem: 4 },
  ],
  sub_tabs: [
    { id: 'diagnostico', defaultLabel: 'MyID', label: 'MyID', visivel: true, ordem: 0 },
    { id: 'corpo', defaultLabel: 'Corpo', label: 'Corpo', visivel: true, ordem: 1 },
    { id: 'jornada', defaultLabel: 'Jornada', label: 'Jornada', visivel: true, ordem: 2 },
  ],
  tabs_compacto: false,
  tabs_icone: true,

  header_portal: true,
  header_docs: true,
  header_identidade: true,

  mostrar_stats: true,
  mostrar_lgpd: true,
  mostrar_decisao: true,
};

const LS_KEY = 'myhealthid_layout_v1';

function loadFromStorage(): LayoutConfig {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_LAYOUT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<LayoutConfig>;
    return {
      ...DEFAULT_LAYOUT_CONFIG,
      ...parsed,
      botao_presencial: { ...DEFAULT_LAYOUT_CONFIG.botao_presencial, ...parsed.botao_presencial },
      botao_resposta_completa: { ...DEFAULT_LAYOUT_CONFIG.botao_resposta_completa, ...parsed.botao_resposta_completa },
      main_tabs: parsed.main_tabs ?? DEFAULT_LAYOUT_CONFIG.main_tabs,
      sub_tabs: parsed.sub_tabs ?? DEFAULT_LAYOUT_CONFIG.sub_tabs,
    };
  } catch {
    return DEFAULT_LAYOUT_CONFIG;
  }
}

export function useLayoutConfig() {
  const [config, setConfig] = useState<LayoutConfig>(loadFromStorage);

  const save = useCallback((next: LayoutConfig) => {
    setConfig(next);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(LS_KEY);
    setConfig(DEFAULT_LAYOUT_CONFIG);
  }, []);

  return { config, save, reset };
}
