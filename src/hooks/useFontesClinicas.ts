import { useQuery } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { COLUNA_ORIGEM, FILTRO_SO_PROFISSIONAL } from '@/utils/voiceAssessment/origemAvaliacao';
import {
  CAMPO_ORIGEM_DO_RELATO, COLUNAS_DA_CONFIRMACAO, FONTES_VAZIAS, ORIGEM_CONFIRMACAO, ROTULO_DA_FONTE, STATUS_DE_EXAME_IMPORTADO_CONCLUIDO,
  TIPOS_DE_DIAGNOSTICO_QUE_ENTRAM,
} from '@/lib/resumoClinico/tipos';
import { textoLimpo } from '@/lib/resumoClinico/leitura';
import { montarCorte, montarCorteDosAchados } from '@/lib/resumoClinico/cortes';
import type { CorteDaContagemDosAchados } from '@/lib/resumoClinico/cortes';
import { filaDeRevisao, TIPOS_QUE_ENTRAM_NA_FILA, totalAguardandoRevisao } from '@/lib/avatar/filaDeRevisao';
import type { ChaveDaFonte, ChaveDeLista, CorteDeFonte, FontesClinicas, LinhaBruta } from '@/lib/resumoClinico/tipos';

// Só LEITURA. As colunas historico_clinico e historia_atual e a tabela exames_presenciais não estão em types.ts
// (defasado); este contrato tipa só o que esta tela lê e não permite escrever.
interface Consulta extends PromiseLike<{ data: unknown; error: { message: string } | null }> {
  select(colunas: string): Consulta;
  eq(coluna: string, valor: string | boolean): Consulta;
  in(coluna: string, valores: readonly string[]): Consulta;
  not(coluna: string, operador: string, valor: unknown): Consulta;
  or(filtro: string): Consulta;
  order(coluna: string, opcoes?: { ascending?: boolean; nullsFirst?: boolean }): Consulta;
  limit(quantas: number): Consulta;
  maybeSingle(): Consulta;
}
interface BancoSoLeitura {
  from(tabela: string): Consulta;
}

export interface FontesLidas {
  fontes: FontesClinicas;
  // Texto de cada fonte que não deu para ler ("o MyID"); as demais continuam valendo.
  falhas: string[];
  // Listas que passaram do limite e foram cortadas nas mais recentes. Só entra fonte lida com sucesso.
  cortes: CorteDeFonte[];
}

export const CHAVE_FONTES_CLINICAS = 'fontes-clinicas';

const LIMITE_POR_TABELA = 50;
// Diagnóstico e exame importado vêm ordenados por data com os sem data por último: o corte, se houver, tira primeiro os
// sem data e os mais antigos, e a tela avisa (`cortes`).
const LIMITE_DE_DIAGNOSTICOS_E_EXAMES_IMPORTADOS = 200;
const LIMITE_DE_MYID = 20;
const LIMITE_DE_AVALIACOES = 20;
// Uma confirmação por cirurgia confirmada: bem menos que isto na prática. Tem limite próprio para uma confirmação antiga
// nunca ficar de fora só porque a história de vida passou de 50 eventos.
const LIMITE_DE_CONFIRMACOES = 200;
// created_at e a marca da confirmação (por caminho JSON com apelido, sem baixar o metadata inteiro) vão nas duas leituras.
const COLUNAS_DA_HISTORIA_DE_VIDA = `id, data_evento, tipo, titulo, descricao, created_at, ${COLUNAS_DA_CONFIRMACAO}`;

async function lista(consulta: Consulta): Promise<LinhaBruta[]> {
  const { data, error } = await consulta;
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? (data as LinhaBruta[]) : [];
}

// Pede uma linha a mais que o limite: se ela vier, existe mais do que cabe e a lista foi cortada. A linha extra não entra.
async function listaLimitada(consulta: Consulta, limite: number): Promise<{ linhas: LinhaBruta[]; limiteCortado?: number }> {
  const linhas = await lista(consulta.limit(limite + 1));
  if (linhas.length <= limite) return { linhas };
  return { linhas: linhas.slice(0, limite), limiteCortado: limite };
}

async function uma(consulta: Consulta): Promise<LinhaBruta | null> {
  const { data, error } = await consulta;
  if (error) throw new Error(error.message);
  const linha = Array.isArray(data) ? data[0] : data;
  return linha && typeof linha === 'object' ? (linha as LinhaBruta) : null;
}

/**
 * Lê as fontes do resumo completo e da linha do tempo. Cada fonte é independente: se uma falha (rede, permissão), ela
 * entra em `falhas` e as outras seguem. Nada é gravado aqui.
 */
export async function lerFontesClinicas(pacienteId: string, terapeutaId: string): Promise<FontesLidas> {
  const banco = supabase as unknown as BancoSoLeitura;
  const deste = (tabela: string, colunas: string) => banco.from(tabela).select(colunas).eq('paciente_id', pacienteId);

  // Cada leitura devolve o que leu e, se a lista passou do limite, qual era o limite.
  const leituras: Record<ChaveDaFonte, () => Promise<{ lido: Partial<FontesClinicas>; limiteCortado?: number }>> = {
    paciente: async () => ({
      lido: { paciente: await uma(banco.from('pacientes').select('historico_clinico, historia_atual').eq('id', pacienteId).maybeSingle()) },
    }),
    myid: async () => {
      // O mais recente é o de created_at maior (desempate pelo maior id), nas duas leituras: o updated_at é regravado por
      // backfill e recálculo e faria um MyID antigo parecer o último. A linha do tempo e o Resumo Completo leem as duas.
      const maisRecentesPrimeiro = (consulta: Consulta) => consulta.order('created_at', { ascending: false }).order('id', { ascending: false });
      const [concluidos, myidUltimo] = await Promise.all([
        listaLimitada(maisRecentesPrimeiro(deste('myid_avaliacoes', 'id, status, created_at, updated_at').eq('status', 'concluido')), LIMITE_DE_MYID),
        uma(maisRecentesPrimeiro(deste('myid_avaliacoes', 'id, status, respostas_brutas').eq('status', 'concluido')).limit(1)),
      ]);
      return { lido: { myidConcluidos: concluidos.linhas, myidUltimo }, limiteCortado: concluidos.limiteCortado };
    },
    // Só as colunas leves de quem nasceu de um MyID. A RLS (terapeuta_id) decide o que o profissional lê: sem a linha, o
    // marco do MyID não diz "concluído".
    vinculosMyid: async () => {
      const { linhas, limiteCortado } = await listaLimitada(
        deste('avaliacoes_identidade', 'id, myid_avaliacao_id, created_at')
          .eq('terapeuta_id', terapeutaId).not('myid_avaliacao_id', 'is', null)
          .order('created_at', { ascending: false }),
        LIMITE_POR_TABELA,
      );
      return { lido: { vinculosMyid: linhas }, limiteCortado };
    },
    avaliacoesVoz: async () => {
      // Mesmo filtro da tela da avaliação atual: fora o relato que o próprio paciente fez no portal.
      // A origem do relato vem por caminho JSON, com apelido, para a tela conferir de novo o que o filtro já pede.
      const { linhas, limiteCortado } = await listaLimitada(
        deste('avaliacoes_voz', `id, created_at, queixa_principal, ${CAMPO_ORIGEM_DO_RELATO}:${COLUNA_ORIGEM}`)
          .eq('terapeuta_id', terapeutaId).or(FILTRO_SO_PROFISSIONAL)
          .order('created_at', { ascending: false }),
        LIMITE_DE_AVALIACOES,
      );
      return { lido: { avaliacoesVoz: linhas }, limiteCortado };
    },
    historiaVida: async () => {
      // Segunda leitura, só das confirmações do profissional (a marca está no metadata): elas se juntam à lista sem repetir
      // o id. Se uma das duas falhar, a fonte inteira falha e o aviso diz: sem a confirmação o relato do cliente voltaria à
      // lista como "não revisado" sem ninguém saber por quê.
      const [recentes, confirmacoes] = await Promise.all([
        listaLimitada(deste('historia_vida_paciente', COLUNAS_DA_HISTORIA_DE_VIDA).order('data_evento', { ascending: false }), LIMITE_POR_TABELA),
        listaLimitada(
          deste('historia_vida_paciente', COLUNAS_DA_HISTORIA_DE_VIDA)
            .eq('metadata->>origem', ORIGEM_CONFIRMACAO).order('created_at', { ascending: false }),
          LIMITE_DE_CONFIRMACOES,
        ),
      ]);
      const jaLidos = new Set(recentes.linhas.map((l) => textoLimpo(l.id)).filter(Boolean));
      const foraDoCorte = confirmacoes.linhas.filter((l) => {
        const id = textoLimpo(l.id);
        return id !== '' && !jaLidos.has(id);
      });
      // Se as confirmações passarem de 200, a tabela tem mais de 50 linhas e a primeira leitura também corta: o aviso é o dela.
      return { lido: { historiaVida: [...recentes.linhas, ...foraDoCorte] }, limiteCortado: recentes.limiteCortado };
    },
    diagnosticos: async () => {
      // Mesma regra da lista de diagnósticos do app (.eq('ativo', true)), só principal e secundário; filtrar aqui também
      // evita que removidos e suspeitas gastem as vagas. A camada de marcos confere de novo.
      const { linhas, limiteCortado } = await listaLimitada(
        deste('diagnosticos_paciente', 'id, data_diagnostico, cid_codigo, cid_descricao, created_at, ativo, tipo')
          .eq('ativo', true).in('tipo', TIPOS_DE_DIAGNOSTICO_QUE_ENTRAM)
          .order('data_diagnostico', { ascending: false, nullsFirst: false }),
        LIMITE_DE_DIAGNOSTICOS_E_EXAMES_IMPORTADOS,
      );
      return { lido: { diagnosticos: linhas }, limiteCortado };
    },
    examesPresenciais: async () => {
      const { linhas, limiteCortado } = await listaLimitada(
        deste('exames_presenciais', 'id, tipo, data_exame, resumo').order('data_exame', { ascending: false }),
        LIMITE_POR_TABELA,
      );
      return { lido: { examesPresenciais: linhas }, limiteCortado };
    },
    examesImportados: async () => {
      // Só a importação que terminou com sucesso: pendente e com erro ainda não são exame do paciente.
      const { linhas, limiteCortado } = await listaLimitada(
        deste('exames_importados', 'id, tipo, data_exame, created_at, status')
          .eq('status', STATUS_DE_EXAME_IMPORTADO_CONCLUIDO)
          .order('data_exame', { ascending: false, nullsFirst: false }),
        LIMITE_DE_DIAGNOSTICOS_E_EXAMES_IMPORTADOS,
      );
      return { lido: { examesImportados: linhas }, limiteCortado };
    },
    testesFuncionais: async () => {
      const { linhas, limiteCortado } = await listaLimitada(
        deste('testes_funcionais_paciente', 'id, tipo_teste, resultado, unidade, data_teste').order('data_teste', { ascending: false }),
        LIMITE_POR_TABELA,
      );
      return { lido: { testesFuncionais: linhas }, limiteCortado };
    },
    escalas: async () => {
      const { linhas, limiteCortado } = await listaLimitada(
        deste('escalas_psicologia', 'id, tipo_escala, pontuacao_total, data_aplicacao').order('data_aplicacao', { ascending: false }),
        LIMITE_POR_TABELA,
      );
      return { lido: { escalas: linhas }, limiteCortado };
    },
  };

  const chaves = Object.keys(leituras) as ChaveDaFonte[];
  const resultados = await Promise.allSettled(chaves.map((chave) => leituras[chave]()));

  let fontes: FontesClinicas = { ...FONTES_VAZIAS };
  const falhas: string[] = [];
  const cortes: CorteDeFonte[] = [];
  resultados.forEach((resultado, i) => {
    if (resultado.status !== 'fulfilled') {
      falhas.push(ROTULO_DA_FONTE[chaves[i]]);
      return;
    }
    fontes = { ...fontes, ...resultado.value.lido };
    if (resultado.value.limiteCortado !== undefined) cortes.push(montarCorte(chaves[i] as ChaveDeLista, resultado.value.limiteCortado));
  });
  return { fontes, falhas, cortes };
}

/**
 * Faz a linha do tempo e o Resumo Completo lerem de novo. Quem grava dado clínico do paciente chama isto depois de gravar.
 * A chave tem o id do profissional no fim; o prefixo só com o paciente pega todas e não encosta em outro paciente.
 */
export function invalidarFontesClinicas(queryClient: QueryClient, pacienteId: string | undefined): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: [CHAVE_FONTES_CLINICAS, pacienteId] });
}

export function useFontesClinicas(pacienteId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [CHAVE_FONTES_CLINICAS, pacienteId, user?.id],
    queryFn: () => lerFontesClinicas(pacienteId!, user!.id),
    enabled: !!user && !!pacienteId,
    staleTime: 30_000,
    // O padrão do app é não reler ao voltar para a aba; aqui vale reler (só passando do staleTime): o profissional edita o
    // histórico em outra aba ou tela e volta para ver a linha do tempo.
    refetchOnWindowFocus: true,
  });
}

// ── Contagem dos achados do histórico aguardando revisão (só número, nenhuma data) ────────────────────────────────────
// Os achados do histórico relatado gravam a data do ENVIO como data de início: essa data não é lida em lugar nenhum, e por
// isso nada daqui vira marco. Só as colunas que a regra da fila precisa (tipo, status e três marcas do metadata). As marcas
// vêm por caminho JSON com apelido, para não baixar o metadata inteiro (texto do paciente, estrutura da história...). A regra
// é a do Avatar (filaDeRevisao): a leitura devolve só números, nunca as linhas.
const LIMITE_DE_ACHADOS_PARA_REVISAO = 200;
const COLUNAS_DA_FILA_DE_REVISAO =
  'tipo_diagnostico, status, revisado_por_ids:metadata->revisado_por_ids, descartado:metadata->descartado, rejeicoes:metadata->rejeicoes';

export interface AchadosParaRevisao {
  // Relato do paciente + histórico relatado que este profissional ainda precisa revisar.
  total: number;
  relatosDoPaciente: number;
  historicoRelatado: number;
  // Só quando a leitura passou do limite: a contagem pode estar menor que a real.
  corte?: CorteDaContagemDosAchados;
}

/**
 * Conta os achados do Avatar deste paciente que aguardam a revisão deste profissional. Só `select`, do paciente aberto e do
 * profissional logado, com limite + 1 como as outras fontes.
 */
export async function lerAchadosParaRevisao(pacienteId: string, terapeutaId: string): Promise<AchadosParaRevisao> {
  const banco = supabase as unknown as BancoSoLeitura;
  const { linhas, limiteCortado } = await listaLimitada(
    banco.from('eventos_clinicos_anatomicos').select(COLUNAS_DA_FILA_DE_REVISAO)
      .eq('paciente_id', pacienteId).eq('terapeuta_id', terapeutaId)
      .in('tipo_diagnostico', TIPOS_QUE_ENTRAM_NA_FILA)
      .order('id', { ascending: true }),
    LIMITE_DE_ACHADOS_PARA_REVISAO,
  );
  const eventos = linhas.map((linha) => ({
    tipo_diagnostico: linha.tipo_diagnostico,
    status: linha.status,
    metadata: { revisado_por_ids: linha.revisado_por_ids, descartado: linha.descartado, rejeicoes: linha.rejeicoes },
  }));
  const fila = filaDeRevisao(eventos, terapeutaId);
  return {
    total: totalAguardandoRevisao(fila),
    relatosDoPaciente: fila.relatosDoPaciente.length,
    historicoRelatado: fila.historicoRelatado.length,
    ...(limiteCortado !== undefined ? { corte: montarCorteDosAchados(limiteCortado) } : {}),
  };
}

// Leitura própria, fora de useFontesClinicas: a linha do tempo não espera por ela nem cai se ela falhar. A chave começa com
// ['eventos-anatomicos', paciente]: tudo que o Avatar já invalida depois de confirmar, descartar ou rejeitar um achado
// (useEventosAnatomicos, AvatarClinicoCard) invalida esta contagem junto, sem mexer nesses pontos. Sem guardar a resposta
// depois de sair da tela (gcTime 0): ao voltar do Avatar a contagem é lida de novo, nunca a de antes da revisão.
export function useAchadosParaRevisao(pacienteId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['eventos-anatomicos', pacienteId, 'fila-de-revisao', user?.id],
    queryFn: () => lerAchadosParaRevisao(pacienteId!, user!.id),
    enabled: !!user && !!pacienteId,
    staleTime: 30_000,
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
}
