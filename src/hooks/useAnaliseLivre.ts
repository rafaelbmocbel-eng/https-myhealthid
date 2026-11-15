import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { PedidoDeConfirmacao } from '@/components/angular/ConfirmarAcao';
import { useGravarPosicao, useRelatoriosDaSessao } from '@/hooks/useSessaoDoPaciente';
import { algoPreenchido, pacienteDaSessao, temMarcacao, useSessaoPostural, type FotoDaPosicao } from '@/hooks/useSessaoPostural';
import type { EstiloMarcacao } from '@/lib/angular/estilo';
import { prepararFoto } from '@/lib/angular/fotoSessao';

interface PacienteDaAnalise { id: string; nome: string; sobrenome?: string | null }

/**
 * Análise livre: uma foto avulsa, sem posição do corpo, com as ferramentas livres e as referências da foto. Usa o mesmo estado, a mesma
 * gravação no prontuário e o mesmo PDF de uma posição da postura, mas numa sessão própria de uma posição só ("livre"): fica na
 * página (e não na tela) para trocar de aba não perder a foto nem os pontos, e é independente da sessão da postura.
 */
export function useAnaliseLivre(o: {
  paciente: PacienteDaAnalise | null | undefined;
  userId: string | undefined;
  profile: { nome: string; sobrenome?: string | null; crefito?: string | null } | null | undefined;
  estilo: EstiloMarcacao;
  confirmar: (p: PedidoDeConfirmacao) => void;
}) {
  const { paciente, userId, profile, estilo, confirmar } = o;
  const sessao = useSessaoPostural('livre');
  const { estadoRef, acoes, atual: item, resumo } = sessao;
  const { salvando, salvar } = useGravarPosicao({ estadoRef, acoes, paciente, userId });
  const [comFoto, setComFoto] = useState(true);
  const { gerando, gerarPdf } = useRelatoriosDaSessao({
    estadoRef, posicao: 'livre', resumo, temFoto: !!item.foto, paciente, profile, estilo, comFoto, anteriorDaPosicao: null, anteriorDoResumo: null,
  });

  const montada = useRef(true);
  useEffect(() => {
    montada.current = true;
    return () => { montada.current = false; };
  }, []);

  const aplicarFoto = async (arquivo: Blob, inclinacao: number | null) => {
    // O preparo da foto demora: se a análise recomeçou ou a página saiu nesse meio-tempo, a foto não vale mais.
    const analiseId = estadoRef.current.id;
    const aindaVale = () => montada.current && estadoRef.current.id === analiseId;
    let nova: FotoDaPosicao;
    try {
      nova = await prepararFoto(arquivo);
    } catch {
      if (aindaVale()) toast.error('Não consegui abrir essa imagem.');
      return;
    }
    if (!aindaVale()) {
      URL.revokeObjectURL(nova.url);
      return;
    }
    acoes.definirFoto('livre', nova, inclinacao);
  };

  // Trocar a foto de uma análise que já tem pontos pede confirmação: os pontos dela são apagados.
  const escolherFoto = (arquivo: File | undefined) => {
    if (!arquivo) return;
    if (!arquivo.type.startsWith('image/')) { toast.error('Escolha um arquivo de imagem.'); return; }
    if (temMarcacao(estadoRef.current.itens.livre)) {
      confirmar({
        titulo: 'Trocar a foto desta análise?',
        texto: 'Os pontos marcados serão apagados.',
        confirmar: 'Trocar a foto',
        aoConfirmar: () => void aplicarFoto(arquivo, null),
      });
      return;
    }
    void aplicarFoto(arquivo, null);
  };

  /** Abre a câmera do app (`abrir`); com pontos marcados, antes pergunta, porque a foto nova apaga os pontos. */
  const pedirCamera = (abrir: () => void) => {
    if (!temMarcacao(estadoRef.current.itens.livre)) { abrir(); return; }
    confirmar({
      titulo: 'Trocar a foto desta análise?',
      texto: 'Os pontos marcados serão apagados quando a nova foto for tirada.',
      confirmar: 'Tirar outra foto',
      aoConfirmar: abrir,
    });
  };

  /** Outra análise livre: só pergunta quando há marcação ainda não salva. `depois` leva o foco para onde o botão clicado deixou de existir, quando a análise é de fato recomeçada. */
  const novaAnalise = (depois?: () => void) => {
    const recomecar = () => { acoes.reiniciar(); depois?.(); };
    const e = estadoRef.current;
    const naoSalva = !!e.itens.livre.foto && temMarcacao(e.itens.livre) && !e.itens.livre.salva;
    if (!naoSalva) { recomecar(); return; }
    confirmar({
      titulo: 'Começar uma nova análise livre?',
      texto: 'A foto e os pontos desta análise ainda não foram salvos e serão descartados.',
      confirmar: 'Começar nova análise',
      aoConfirmar: () => acoes.reiniciar(),
      focoDepoisDeConfirmar: depois,
    });
  };

  const estado = sessao.estado;
  const donoDaNota = pacienteDaSessao(estado);
  return {
    ...sessao,
    nome: estado.nomeLivre ?? '',
    salvando: salvando === 'livre',
    salvar: () => salvar('livre'),
    comFoto, setComFoto, gerando, gerarPdf,
    aplicarFoto, escolherFoto, pedirCamera, novaAnalise,
    /** Há foto: trocar o paciente ou recomeçar descartaria trabalho. */
    preenchida: algoPreenchido(estado),
    donoDaNota,
    /** A nota já gravada pertence a outro paciente que não o escolhido agora. */
    outroPaciente: !!paciente && !!donoDaNota && donoDaNota !== paciente.id,
  };
}

export type EstadoDaAnaliseLivre = ReturnType<typeof useAnaliseLivre>;
