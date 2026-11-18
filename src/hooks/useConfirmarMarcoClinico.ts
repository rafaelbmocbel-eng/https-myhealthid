import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { tabela } from '@/lib/dosagem/db';
import { hojeLocalISO } from '@/lib/dataLocal';
import { ERRO_SEM_IDENTIFICACAO, montarLinhaDaConfirmacao } from '@/lib/resumoClinico/confirmacao';
import { textoLimpo } from '@/lib/resumoClinico/leitura';
import { ID_DO_TITULO_DA_LINHA_DO_TEMPO, ORIGEM_CONFIRMACAO } from '@/lib/resumoClinico/tipos';
import type { CirurgiaDoCliente, DadosDaConfirmacao, Marco } from '@/lib/resumoClinico/tipos';
import { CHAVE_FONTES_CLINICAS, invalidarFontesClinicas } from './useFontesClinicas';
import type { FontesLidas } from './useFontesClinicas';

// ÚNICO escritor da confirmação do marco: nenhuma outra tela ou camada grava em historia_vida_paciente por este caminho. A
// tabela não está em types.ts (faltam metadata e visivel_paciente), por isso o acesso é pelo tabela() do projeto.
const TABELA = 'historia_vida_paciente';
const CHAVE_DO_AVATAR = 'historia-vida-avatar';

export const MSG_JA_EXISTE_SEM_CARREGAR = 'Já existe uma confirmação para este item, mas a tela não conseguiu carregá-la.';
export const MSG_BANCO_NAO_PREPARADO = 'O banco ainda não está preparado para esta confirmação. Avise o suporte.';
export const MSG_SEM_PERMISSAO = 'Você não tem permissão para confirmar este item neste cliente.';
export const MSG_FALHA_AO_CONFIRMAR = 'Não deu para salvar a confirmação. Confira a conexão e tente de novo.';
export const MSG_FALHA_AO_DESFAZER = 'Não deu para desfazer a confirmação. Confira a conexão e tente de novo.';
export const MSG_JA_NAO_EXISTE = 'A confirmação já não existe.';
export const MSG_PACIENTE_MUDOU_AO_CONFIRMAR = 'Você abriu outro cliente depois de pedir esta confirmação. Nada foi salvo. Peça a confirmação de novo no cliente certo.';
export const MSG_PACIENTE_MUDOU_AO_DESFAZER = 'Você abriu outro cliente depois de pedir este desfazer. Nada foi apagado. Peça de novo no cliente certo.';
export const MSG_CONFIRMADO = 'Data confirmada na linha do tempo.';
export const MSG_JA_ESTAVA_CONFIRMADO = 'Este item já estava confirmado. A linha do tempo foi atualizada.';
export const MSG_DESFEITO = 'Confirmação desfeita. O relato do cliente voltou à linha do tempo.';

// Erro que já vem com a frase para a tela.
class ErroParaATela extends Error {}

interface ErroDoBanco {
  message?: string;
  code?: string;
}

// Coluna que o banco não conhece: o app subiu antes da tabela estar pronta. Repetir não resolve, então a frase não manda tentar.
const CODIGOS_DE_COLUNA_INEXISTENTE = ['PGRST204', '42703'];

function fraseDoErroDeGravacao(erro: ErroDoBanco): string {
  if (erro.code && CODIGOS_DE_COLUNA_INEXISTENTE.includes(erro.code)) return MSG_BANCO_NAO_PREPARADO;
  if (erro.code === '42501') return MSG_SEM_PERMISSAO;
  return MSG_FALHA_AO_CONFIRMAR;
}

function invalidarOQueMostraAConfirmacao(qc: QueryClient, pacienteId: string): Promise<void> {
  void qc.invalidateQueries({ queryKey: [CHAVE_DO_AVATAR, pacienteId] });
  return invalidarFontesClinicas(qc, pacienteId);
}

export interface AlvoDoDesfazer {
  // O uuid cru da linha da confirmação (o que o desfazer apaga).
  idDaLinha: string;
  titulo: string;
}

interface Contexto {
  qc: QueryClient;
  terapeutaId: string;
  pacienteId: string;
}

// O pedido guarda de qual paciente veio: a rota /pacientes/:id reaproveita a mesma página quando só o :id muda, então o que ficou
// no estado não pode ser gravado no paciente que está na tela agora. `aberto` falso é o diálogo fechando: o item continua
// guardado só para o diálogo se desenhar inteiro durante a animação de saída.
interface PedidoDeConfirmacao {
  pacienteId: string;
  cirurgia: CirurgiaDoCliente;
  aberto: boolean;
}

interface PedidoDeDesfazer {
  pacienteId: string;
  alvo: AlvoDoDesfazer;
  aberto: boolean;
}

function doPaciente<T extends { pacienteId: string }>(pedido: T | null, pacienteId: string | undefined): T | null {
  return pedido && pedido.pacienteId === (pacienteId ?? '') ? pedido : null;
}

function fechado<T extends { aberto: boolean }>(pedido: T | null): T | null {
  return pedido && { ...pedido, aberto: false };
}

/**
 * A chave primária é o id fixo da confirmação: se ela já existe (duplo toque, duas abas), o banco recusa com 23505. Aí a
 * lista é relida: se a confirmação aparece, está tudo certo; se não aparece, a tela diz a verdade em vez de fingir sucesso.
 * A lista está sempre no cache aqui: o botão de confirmar só existe porque a página a leu, e ela segue observada.
 */
async function tratarConfirmacaoJaExistente(contexto: Contexto, idDaLinha: string): Promise<'ja_existia'> {
  await invalidarFontesClinicas(contexto.qc, contexto.pacienteId);
  const lido = contexto.qc.getQueryData<FontesLidas>([CHAVE_FONTES_CLINICAS, contexto.pacienteId, contexto.terapeutaId]);
  if (lido?.fontes.historiaVida.some((linha) => textoLimpo(linha.id) === idDaLinha)) return 'ja_existia';
  // A lista não trouxe a linha: um select por id diz se ela existe mesmo (e é visível para este profissional).
  const { data, error } = await tabela(TABELA).select('id').eq('id', idDaLinha).maybeSingle();
  if (!error && data) throw new ErroParaATela(MSG_JA_EXISTE_SEM_CARREGAR);
  throw new ErroParaATela(MSG_FALHA_AO_CONFIRMAR);
}

async function gravar(contexto: Contexto, pedido: PedidoDeConfirmacao, dados: DadosDaConfirmacao, entrada: {
  nascimento?: string | null;
  profissional?: { nome?: string | null; sobrenome?: string | null; crefito?: string | null } | null;
}): Promise<'gravada' | 'ja_existia'> {
  if (pedido.pacienteId !== contexto.pacienteId) throw new ErroParaATela(MSG_PACIENTE_MUDOU_AO_CONFIRMAR);
  const { cirurgia } = pedido;
  // "Hoje" é lido aqui, na hora de salvar: o diálogo pode ter ficado aberto de um dia para o outro.
  const resultado = montarLinhaDaConfirmacao({
    terapeutaId: contexto.terapeutaId, pacienteId: contexto.pacienteId, chave: cirurgia.chave,
    relato: { tipo: cirurgia.tipo, ano: cirurgia.ano, complicacoes: cirurgia.complicacoes },
    tipo: dados.tipo, precisao: dados.precisao, texto: dados.texto, nascimento: entrada.nascimento, profissional: entrada.profissional,
  }, hojeLocalISO());
  if (!resultado.ok) throw new ErroParaATela(resultado.erro);
  const { linha } = resultado;
  const { error: erro }: { error: ErroDoBanco | null } = await tabela(TABELA).insert(linha);
  if (!erro) {
    void invalidarOQueMostraAConfirmacao(contexto.qc, contexto.pacienteId);
    return 'gravada';
  }
  if (erro.code === '23505') return tratarConfirmacaoJaExistente(contexto, linha.id);
  throw new ErroParaATela(fraseDoErroDeGravacao(erro));
}

async function apagar(contexto: Contexto, pedido: PedidoDeDesfazer): Promise<'apagada' | 'ja_nao_existia'> {
  if (pedido.pacienteId !== contexto.pacienteId) throw new ErroParaATela(MSG_PACIENTE_MUDOU_AO_DESFAZER);
  const { idDaLinha } = pedido.alvo;
  // Todas as condições juntas: só esta linha, deste cliente, deste profissional e só se for uma confirmação (nunca um
  // registro de história de vida feito à mão). O select devolve as linhas que de fato saíram.
  const resposta: { data: unknown; error: ErroDoBanco | null } = await tabela(TABELA).delete()
    .eq('id', idDaLinha)
    .eq('paciente_id', contexto.pacienteId)
    .eq('terapeuta_id', contexto.terapeutaId)
    .eq('metadata->>origem', ORIGEM_CONFIRMACAO)
    .select('id');
  if (resposta.error) throw new ErroParaATela(MSG_FALHA_AO_DESFAZER);
  // Nenhuma linha apagada não é erro (já tinha sido desfeita, ou a regra do banco não deixou), mas a tela não pode dizer
  // "desfeito": relê para mostrar o que existe de verdade.
  void invalidarOQueMostraAConfirmacao(contexto.qc, contexto.pacienteId);
  return Array.isArray(resposta.data) && resposta.data.length > 0 ? 'apagada' : 'ja_nao_existia';
}

// O diálogo do Radix sem o gatilho dele não devolve o foco a lugar nenhum (ele só sabe voltar ao DialogTrigger): quem abriu é o botão
// da lista, então o hook lembra qual era o elemento com foco no pedido.
function elementoComFoco(): HTMLElement | null {
  const ativo = document.activeElement;
  return ativo instanceof HTMLElement && ativo !== document.body ? ativo : null;
}

function levarOFocoAoTitulo() {
  const titulo = document.getElementById(ID_DO_TITULO_DA_LINHA_DO_TEMPO);
  if (!titulo) return;
  if (!titulo.hasAttribute('tabindex')) titulo.setAttribute('tabindex', '-1');
  titulo.focus({ preventScroll: true });
}

/**
 * Confirmar com a data real um marco que o CLIENTE relatou (e desfazer essa confirmação). Concentra a escrita: a linha do
 * tempo só recebe funções e os diálogos só mostram. Chamar antes de qualquer retorno condicional da página.
 * `nascimento` é a data de nascimento do paciente, se conhecida: a cirurgia não pode ser antes dela.
 */
export function useConfirmarMarcoClinico(pacienteId: string | undefined, nascimento?: string | null) {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [pedidoDeConfirmacao, setPedidoDeConfirmacao] = useState<PedidoDeConfirmacao | null>(null);
  const [pedidoDeDesfazer, setPedidoDeDesfazer] = useState<PedidoDeDesfazer | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [desfazendo, setDesfazendo] = useState(false);
  const [erroDaConfirmacao, setErroDaConfirmacao] = useState<string | null>(null);
  const [erroDoDesfazer, setErroDoDesfazer] = useState<string | null>(null);
  // O segundo toque no mesmo instante passa antes de a tela redesenhar o botão desligado: a trava precisa ser síncrona.
  const travado = useRef(false);
  const focoNoTitulo = useRef(false);
  const gatilho = useRef<HTMLElement | null>(null);
  // O paciente da rota agora, para quem grava conferir mesmo se tiver em mãos um pedido guardado de uma renderização antiga.
  const pacienteAtual = useRef(pacienteId);
  useLayoutEffect(() => { pacienteAtual.current = pacienteId; }, [pacienteId]);

  // Na troca de paciente nada do anterior pode aparecer (primeira camada: o que é de outro paciente nem é visto) nem voltar
  // se o profissional retornar a ele (por isso o estado também é zerado).
  const confirmacaoDaVez = doPaciente(pedidoDeConfirmacao, pacienteId);
  const desfazerDaVez = doPaciente(pedidoDeDesfazer, pacienteId);
  useEffect(() => {
    setPedidoDeConfirmacao(null);
    setPedidoDeDesfazer(null);
    setErroDaConfirmacao(null);
    setErroDoDesfazer(null);
  }, [pacienteId]);

  const terapeutaId = user?.id ?? '';
  const contexto = useCallback((): Contexto | null => {
    const atual = pacienteAtual.current;
    return terapeutaId && atual ? { qc, terapeutaId, pacienteId: atual } : null;
  }, [qc, terapeutaId]);

  const pedirConfirmacao = useCallback((cirurgia: CirurgiaDoCliente) => {
    if (travado.current) return;
    gatilho.current = elementoComFoco();
    setErroDaConfirmacao(null);
    setPedidoDeConfirmacao({ pacienteId: pacienteAtual.current ?? '', cirurgia, aberto: true });
  }, []);

  const pedirDesfazer = useCallback((marco: Marco) => {
    if (travado.current || !marco.confirmacao) return;
    gatilho.current = elementoComFoco();
    setErroDoDesfazer(null);
    setPedidoDeDesfazer({
      pacienteId: pacienteAtual.current ?? '', alvo: { idDaLinha: marco.confirmacao.idDaLinha, titulo: marco.titulo }, aberto: true,
    });
  }, []);

  const cancelarConfirmacao = useCallback(() => {
    if (travado.current) return;
    setPedidoDeConfirmacao(fechado);
    setErroDaConfirmacao(null);
  }, []);

  const cancelarDesfazer = useCallback(() => {
    if (travado.current) return;
    setPedidoDeDesfazer(fechado);
    setErroDoDesfazer(null);
  }, []);

  const confirmar = useCallback(async (dados: DadosDaConfirmacao): Promise<boolean> => {
    if (!confirmacaoDaVez?.aberto || travado.current) return false;
    travado.current = true;
    setConfirmando(true);
    setErroDaConfirmacao(null);
    try {
      const ctx = contexto();
      if (!ctx) throw new ErroParaATela(ERRO_SEM_IDENTIFICACAO);
      const resultado = await gravar(ctx, confirmacaoDaVez, dados, {
        nascimento,
        profissional: { nome: profile?.nome, sobrenome: profile?.sobrenome, crefito: profile?.crefito },
      });
      focoNoTitulo.current = pacienteAtual.current === confirmacaoDaVez.pacienteId;
      setPedidoDeConfirmacao(fechado);
      if (resultado === 'gravada') toast.success(MSG_CONFIRMADO);
      else toast.info(MSG_JA_ESTAVA_CONFIRMADO);
      return true;
    } catch (e) {
      // Qualquer erro que não seja uma frase pronta (inclusive o client que lança em vez de devolver o erro, sem rede) é a falha comum.
      const frase = e instanceof ErroParaATela ? e.message : MSG_FALHA_AO_CONFIRMAR;
      setErroDaConfirmacao(frase);
      toast.error(frase);
      return false;
    } finally {
      travado.current = false;
      setConfirmando(false);
    }
  }, [confirmacaoDaVez, contexto, nascimento, profile?.nome, profile?.sobrenome, profile?.crefito]);

  const desfazer = useCallback(async (): Promise<boolean> => {
    if (!desfazerDaVez?.aberto || travado.current) return false;
    travado.current = true;
    setDesfazendo(true);
    setErroDoDesfazer(null);
    try {
      const ctx = contexto();
      if (!ctx) throw new ErroParaATela(ERRO_SEM_IDENTIFICACAO);
      const resultado = await apagar(ctx, desfazerDaVez);
      focoNoTitulo.current = pacienteAtual.current === desfazerDaVez.pacienteId;
      setPedidoDeDesfazer(fechado);
      if (resultado === 'apagada') toast.success(MSG_DESFEITO);
      else toast.info(MSG_JA_NAO_EXISTE);
      return true;
    } catch (e) {
      const frase = e instanceof ErroParaATela ? e.message : MSG_FALHA_AO_DESFAZER;
      setErroDoDesfazer(frase);
      toast.error(frase);
      return false;
    } finally {
      travado.current = false;
      setDesfazendo(false);
    }
  }, [desfazerDaVez, contexto]);

  // Para o onCloseAutoFocus dos diálogos. Depois de salvar, o botão que abriu o diálogo já não existe (ou vai sumir quando a
  // lista reler) e o foco vai ao título da seção. Ao cancelar, o foco volta ao botão que abriu; se não der, também ao título.
  const devolverOFoco = useCallback((evento: Event) => {
    evento.preventDefault();
    const voltarPara = !focoNoTitulo.current && gatilho.current?.isConnected ? gatilho.current : null;
    focoNoTitulo.current = false;
    gatilho.current = null;
    if (voltarPara) voltarPara.focus();
    else levarOFocoAoTitulo();
  }, []);

  return {
    pedirConfirmacao,
    pedirDesfazer,
    devolverOFoco,
    confirmacao: {
      alvo: confirmacaoDaVez?.aberto ? confirmacaoDaVez.cirurgia : null,
      // O último item pedido, mesmo com o diálogo já fechando: o diálogo se desenha com ele durante a animação de saída.
      exibido: confirmacaoDaVez?.cirurgia ?? null,
      salvando: confirmando, erro: erroDaConfirmacao, nascimento: nascimento ?? null, confirmar, cancelar: cancelarConfirmacao,
    },
    desfazer: {
      alvo: desfazerDaVez?.aberto ? desfazerDaVez.alvo : null,
      exibido: desfazerDaVez?.alvo ?? null,
      salvando: desfazendo, erro: erroDoDesfazer, desfazer, cancelar: cancelarDesfazer,
    },
  };
}
