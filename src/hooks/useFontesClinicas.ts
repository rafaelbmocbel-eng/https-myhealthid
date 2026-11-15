import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { COLUNA_ORIGEM, FILTRO_SO_PROFISSIONAL } from '@/utils/voiceAssessment/origemAvaliacao';
import {
  CAMPO_ORIGEM_DO_RELATO, FONTES_VAZIAS, ROTULO_DA_FONTE, STATUS_DE_EXAME_IMPORTADO_CONCLUIDO, TIPOS_DE_DIAGNOSTICO_QUE_ENTRAM,
} from '@/lib/resumoClinico/tipos';
import type { ChaveDaFonte, FontesClinicas, LinhaBruta } from '@/lib/resumoClinico/tipos';

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
}

const LIMITE_POR_TABELA = 50;
// Diagnóstico e exame importado vêm ordenados por data com os sem data por último: o corte, se houver, tira primeiro os
// sem data e os mais antigos. Acima disto a lista fica incompleta e a tela não avisa (ver docs/resumo-completo-e-marcos.md).
const LIMITE_DE_DIAGNOSTICOS_E_EXAMES_IMPORTADOS = 200;
const LIMITE_DE_MYID = 20;
const LIMITE_DE_AVALIACOES = 20;

async function lista(consulta: Consulta): Promise<LinhaBruta[]> {
  const { data, error } = await consulta;
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? (data as LinhaBruta[]) : [];
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

  const leituras: Record<ChaveDaFonte, () => Promise<Partial<FontesClinicas>>> = {
    paciente: async () => ({
      paciente: await uma(banco.from('pacientes').select('historico_clinico, historia_atual').eq('id', pacienteId).maybeSingle()),
    }),
    myid: async () => {
      const [myidConcluidos, myidUltimo] = await Promise.all([
        lista(deste('myid_avaliacoes', 'id, status, created_at, updated_at').eq('status', 'concluido').order('updated_at', { ascending: false }).limit(LIMITE_DE_MYID)),
        uma(deste('myid_avaliacoes', 'id, status, respostas_brutas').eq('status', 'concluido').order('updated_at', { ascending: false }).limit(1)),
      ]);
      return { myidConcluidos, myidUltimo };
    },
    // Só as colunas leves de quem nasceu de um MyID. A RLS (terapeuta_id) decide o que o profissional lê: sem a linha, o
    // marco do MyID não diz "concluído".
    vinculosMyid: async () => ({
      vinculosMyid: await lista(
        deste('avaliacoes_identidade', 'id, myid_avaliacao_id, created_at')
          .eq('terapeuta_id', terapeutaId).not('myid_avaliacao_id', 'is', null)
          .order('created_at', { ascending: false }).limit(LIMITE_POR_TABELA),
      ),
    }),
    avaliacoesVoz: async () => ({
      // Mesmo filtro da tela da avaliação atual: fora o relato que o próprio paciente fez no portal.
      // A origem do relato vem por caminho JSON, com apelido, para a tela conferir de novo o que o filtro já pede.
      avaliacoesVoz: await lista(
        deste('avaliacoes_voz', `id, created_at, queixa_principal, ${CAMPO_ORIGEM_DO_RELATO}:${COLUNA_ORIGEM}`)
          .eq('terapeuta_id', terapeutaId).or(FILTRO_SO_PROFISSIONAL)
          .order('created_at', { ascending: false }).limit(LIMITE_DE_AVALIACOES),
      ),
    }),
    historiaVida: async () => ({
      historiaVida: await lista(deste('historia_vida_paciente', 'id, data_evento, tipo, titulo, descricao').order('data_evento', { ascending: false }).limit(LIMITE_POR_TABELA)),
    }),
    diagnosticos: async () => ({
      // Mesma regra da lista de diagnósticos do app (.eq('ativo', true)), só principal e secundário; filtrar aqui também
      // evita que removidos e suspeitas gastem as vagas. A camada de marcos confere de novo.
      diagnosticos: await lista(
        deste('diagnosticos_paciente', 'id, data_diagnostico, cid_codigo, cid_descricao, created_at, ativo, tipo')
          .eq('ativo', true).in('tipo', TIPOS_DE_DIAGNOSTICO_QUE_ENTRAM)
          .order('data_diagnostico', { ascending: false, nullsFirst: false }).limit(LIMITE_DE_DIAGNOSTICOS_E_EXAMES_IMPORTADOS),
      ),
    }),
    examesPresenciais: async () => ({
      examesPresenciais: await lista(deste('exames_presenciais', 'id, tipo, data_exame, resumo').order('data_exame', { ascending: false }).limit(LIMITE_POR_TABELA)),
    }),
    examesImportados: async () => ({
      // Só a importação que terminou com sucesso: pendente e com erro ainda não são exame do paciente.
      examesImportados: await lista(
        deste('exames_importados', 'id, tipo, data_exame, created_at, status')
          .eq('status', STATUS_DE_EXAME_IMPORTADO_CONCLUIDO)
          .order('data_exame', { ascending: false, nullsFirst: false }).limit(LIMITE_DE_DIAGNOSTICOS_E_EXAMES_IMPORTADOS),
      ),
    }),
    testesFuncionais: async () => ({
      testesFuncionais: await lista(deste('testes_funcionais_paciente', 'id, tipo_teste, resultado, unidade, data_teste').order('data_teste', { ascending: false }).limit(LIMITE_POR_TABELA)),
    }),
    escalas: async () => ({
      escalas: await lista(deste('escalas_psicologia', 'id, tipo_escala, pontuacao_total, data_aplicacao').order('data_aplicacao', { ascending: false }).limit(LIMITE_POR_TABELA)),
    }),
  };

  const chaves = Object.keys(leituras) as ChaveDaFonte[];
  const resultados = await Promise.allSettled(chaves.map((chave) => leituras[chave]()));

  let fontes: FontesClinicas = { ...FONTES_VAZIAS };
  const falhas: string[] = [];
  resultados.forEach((resultado, i) => {
    if (resultado.status === 'fulfilled') fontes = { ...fontes, ...resultado.value };
    else falhas.push(ROTULO_DA_FONTE[chaves[i]]);
  });
  return { fontes, falhas };
}

export function useFontesClinicas(pacienteId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['fontes-clinicas', pacienteId, user?.id],
    queryFn: () => lerFontesClinicas(pacienteId!, user!.id),
    enabled: !!user && !!pacienteId,
    staleTime: 30_000,
  });
}
