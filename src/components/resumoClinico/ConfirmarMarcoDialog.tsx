import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, Ref } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hojeLocalISO } from '@/lib/dataLocal';
import { ERRO_SEM_TIPO_ESCOLHIDO, validarDataConfirmada } from '@/lib/resumoClinico/confirmacao';
import { anoDoHistorico } from '@/lib/resumoClinico/datas';
import { AVISO_DA_TRIAGEM_DOS_PLANOS, TIPOS_CONFIRMAVEIS } from '@/lib/resumoClinico/tipos';
import type { CirurgiaDoCliente, DadosDaConfirmacao, PrecisaoDaData } from '@/lib/resumoClinico/tipos';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SeloDeOrigem from './SeloDeOrigem';

const ROTULO_DO_TIPO: Record<(typeof TIPOS_CONFIRMAVEIS)[number], string> = { cirurgia: 'Cirurgia', internacao: 'Internação' };
const ROTULO_DA_PRECISAO: Record<PrecisaoDaData, string> = { dia: 'Sei o dia', ano: 'Só sei o ano' };
const PRECISOES: PrecisaoDaData[] = ['dia', 'ano'];

interface Props {
  aberto: boolean;
  // O item que o cliente relatou; sem ele o diálogo não tem o que mostrar.
  cirurgia: CirurgiaDoCliente | null;
  salvando: boolean;
  // Erro que veio de quem grava (banco, rede): aparece junto dos botões, com o diálogo aberto e o que foi digitado.
  erro: string | null;
  // Nascimento do paciente: a data não pode ser antes dele.
  nascimento?: string | null;
  // "Hoje" (AAAA-MM-DD). Sem ele vale o dia do Brasil agora; quem grava confere de novo na hora de salvar.
  hoje?: string;
  onConfirmar: (dados: DadosDaConfirmacao) => unknown;
  onCancelar: () => void;
  // Quem sabe para onde o foco vai depois de fechar com sucesso (o botão que abriu o diálogo deixa de existir).
  onCloseAutoFocus?: (evento: Event) => void;
}

interface PropsDoChip {
  ativo: boolean;
  onEscolher: () => void;
  disabled: boolean;
  children: string;
  referencia?: Ref<HTMLButtonElement>;
}

// 44 px de altura e largura mínima: alvo de toque confortável no celular.
function Chip({ ativo, onEscolher, disabled, children, referencia }: PropsDoChip) {
  return (
    <button
      ref={referencia}
      type="button"
      aria-pressed={ativo}
      disabled={disabled}
      onClick={onEscolher}
      className={cn(
        'inline-flex min-h-11 min-w-11 flex-1 items-center justify-center rounded-md border px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
        ativo ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground hover:bg-muted/60',
      )}
    >
      {children}
    </button>
  );
}

// Só apresentação: quem grava é o hook da página. O estado do formulário vive aqui e é zerado quando o diálogo fecha.
export default function ConfirmarMarcoDialog({
  aberto, cirurgia, salvando, erro, nascimento, hoje: hojeDaTela, onConfirmar, onCancelar, onCloseAutoFocus,
}: Props) {
  const [tipo, setTipo] = useState('');
  const [precisao, setPrecisao] = useState<PrecisaoDaData>('dia');
  const [texto, setTexto] = useState('');
  const [saiuDoCampo, setSaiuDoCampo] = useState(false);
  const [tentouConfirmar, setTentouConfirmar] = useState(false);
  const [perguntandoDescartar, setPerguntandoDescartar] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const focoAntesDaPergunta = useRef<HTMLElement | null>(null);
  const primeiroChipDoTipo = useRef<HTMLButtonElement>(null);
  const blocoDoErro = useRef<HTMLParagraphElement>(null);
  const idDoCampo = useId();
  const idDoErroDoCampo = `${idDoCampo}-erro`;
  const idDaDica = `${idDoCampo}-dica`;

  useEffect(() => {
    if (aberto) return;
    setTipo('');
    setPrecisao('dia');
    setTexto('');
    setSaiuDoCampo(false);
    setTentouConfirmar(false);
    setPerguntandoDescartar(false);
  }, [aberto]);

  const hoje = hojeDaTela ?? hojeLocalISO();
  const validacao = validarDataConfirmada({ precisao, texto, nascimento }, hoje);
  const preenchido = texto.trim() !== '';
  const erroDoCampo = preenchido && !validacao.ok ? validacao.erro : null;
  // Enquanto digita o ano ("20", "202") ainda não é erro: só depois dos 4 números, de sair do campo ou de tentar confirmar.
  const erroVisivel = erroDoCampo && (saiuDoCampo || tentouConfirmar || texto.trim().length >= 4) ? erroDoCampo : null;
  const faltaOTipo = tipo === '';
  const erroDoTipo = tentouConfirmar && faltaOTipo ? ERRO_SEM_TIPO_ESCOLHIDO : null;
  const podeConfirmar = !salvando && !faltaOTipo && validacao.ok;
  const sujo = tipo !== '' || texto !== '' || precisao !== 'dia';

  // O erro aparece embaixo do campo: com o teclado aberto ele podia ficar escondido, então o campo vai para o meio da tela.
  useEffect(() => {
    if (erroVisivel) campo.current?.scrollIntoView?.({ block: 'center' });
  }, [erroVisivel]);

  // O erro de quem grava também precisa ficar à vista dentro da área rolável.
  useEffect(() => {
    if (erro) blocoDoErro.current?.scrollIntoView?.({ block: 'nearest' });
  }, [erro]);

  const anoDoCliente = cirurgia ? anoDoHistorico(cirurgia.ano, hoje) : null;
  const anoDigitado = validacao.ok ? validacao.ano : null;
  const avisoDeAnoDiferente = anoDoCliente && anoDigitado && anoDigitado !== anoDoCliente.iso
    ? `O cliente escreveu ${anoDoCliente.iso} e você informou ${anoDigitado}. Confira antes de confirmar.`
    : null;

  const pedirParaFechar = () => {
    if (salvando) return;
    if (sujo) {
      const ativo = document.activeElement;
      focoAntesDaPergunta.current = ativo instanceof HTMLElement && ativo !== document.body ? ativo : null;
      setPerguntandoDescartar(true);
      return;
    }
    onCancelar();
  };

  // A pergunta é um diálogo aninhado sem gatilho: o Radix não sabe para onde devolver o foco e o deixaria no body, com o teclado
  // do celular fechado. "Continuar editando" volta ao campo em que o profissional estava; se ele não existe mais, ao primeiro.
  // Em "Descartar" o formulário some junto e quem decide o foco é o diálogo principal. O Radix já cancela o foco padrão de um
  // diálogo modal depois de chamar este tratador, então aqui basta mover o foco.
  const devolverOFocoAoFormulario = () => {
    const anterior = focoAntesDaPergunta.current;
    focoAntesDaPergunta.current = null;
    (anterior?.isConnected ? anterior : primeiroChipDoTipo.current)?.focus();
  };

  const escolherPrecisao = (nova: PrecisaoDaData) => {
    if (nova === precisao) return;
    // Do dia para o ano aproveita o ano da data completa; do ano para o dia não há o que aproveitar.
    setTexto(nova === 'ano' && /^\d{4}-\d{2}-\d{2}$/.test(texto) ? texto.slice(0, 4) : '');
    setSaiuDoCampo(false);
    setTentouConfirmar(false);
    setPrecisao(nova);
  };

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    if (salvando) return;
    setTentouConfirmar(true);
    if (faltaOTipo) {
      primeiroChipDoTipo.current?.focus();
      primeiroChipDoTipo.current?.scrollIntoView?.({ block: 'center' });
      return;
    }
    if (!validacao.ok) {
      campo.current?.focus();
      campo.current?.scrollIntoView?.({ block: 'center' });
      return;
    }
    onConfirmar({ tipo, precisao, texto: texto.trim() });
  };

  const descartar = () => {
    setPerguntandoDescartar(false);
    onCancelar();
  };

  const campoDoAno = precisao === 'ano';
  const descricoesDoCampo = [erroVisivel ? idDoErroDoCampo : null, idDaDica].filter(Boolean).join(' ');

  return (
    <Dialog open={aberto && !!cirurgia} onOpenChange={(abrir) => { if (!abrir) pedirParaFechar(); }}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus} className="min-w-0">
        {cirurgia && (
          <form onSubmit={enviar} noValidate className="min-w-0 space-y-4">
            <DialogHeader>
              <DialogTitle>Confirmar com a data real</DialogTitle>
              <DialogDescription>
                Você confirma a data de um item que o cliente relatou. O texto do cliente fica guardado e pode ser consultado depois.
              </DialogDescription>
            </DialogHeader>

            <div data-bloco="relato-do-cliente" className="min-w-0 space-y-1 rounded-lg border border-border/60 bg-muted/40 p-3">
              <SeloDeOrigem origem="cliente" />
              <p className="whitespace-pre-wrap break-words text-sm font-medium leading-snug text-foreground">{cirurgia.tipo}</p>
              <p className="whitespace-pre-wrap break-words text-sm leading-snug text-foreground/80">
                {cirurgia.ano ? `Ano que o cliente escreveu: "${cirurgia.ano}"` : 'Ano não informado'}
              </p>
              {cirurgia.complicacoes && (
                <p className="whitespace-pre-wrap break-words text-sm leading-snug text-foreground/80">Complicações: {cirurgia.complicacoes}</p>
              )}
            </div>

            <fieldset className="min-w-0 space-y-1.5">
              <legend className="text-sm font-medium text-foreground">O que foi?</legend>
              <div className="flex gap-2">
                {TIPOS_CONFIRMAVEIS.map((valor, i) => (
                  <Chip
                    key={valor}
                    referencia={i === 0 ? primeiroChipDoTipo : undefined}
                    ativo={tipo === valor}
                    disabled={salvando}
                    onEscolher={() => setTipo(valor)}
                  >
                    {ROTULO_DO_TIPO[valor]}
                  </Chip>
                ))}
              </div>
              {erroDoTipo && <p role="alert" className="text-sm leading-snug text-destructive">{erroDoTipo}</p>}
            </fieldset>

            <fieldset className="min-w-0 space-y-1.5">
              <legend className="text-sm font-medium text-foreground">Qual é a data?</legend>
              <div className="flex gap-2">
                {PRECISOES.map((valor) => (
                  <Chip key={valor} ativo={precisao === valor} disabled={salvando} onEscolher={() => escolherPrecisao(valor)}>
                    {ROTULO_DA_PRECISAO[valor]}
                  </Chip>
                ))}
              </div>
            </fieldset>

            <div className="min-w-0 space-y-1.5">
              <Label htmlFor={idDoCampo} className="text-sm font-medium">{campoDoAno ? 'Ano em que aconteceu' : 'Dia em que aconteceu'}</Label>
              <Input
                key={precisao}
                ref={campo}
                id={idDoCampo}
                type={campoDoAno ? 'text' : 'date'}
                inputMode={campoDoAno ? 'numeric' : undefined}
                maxLength={campoDoAno ? 4 : undefined}
                min={campoDoAno ? undefined : '1900-01-01'}
                max={campoDoAno ? undefined : hoje}
                placeholder={campoDoAno ? 'AAAA' : undefined}
                autoComplete="off"
                value={texto}
                disabled={salvando}
                aria-invalid={erroVisivel ? true : undefined}
                aria-describedby={descricoesDoCampo}
                onChange={(e) => setTexto(e.target.value)}
                onBlur={() => setSaiuDoCampo(true)}
                className="h-11 min-w-0 max-w-full"
              />
              <p id={idDaDica} className="text-xs leading-snug text-muted-foreground">
                {campoDoAno ? 'Use 4 números, por exemplo 2022.' : 'Use a data que está no documento ou que o cliente confirmou.'}
              </p>
              {erroVisivel && <p id={idDoErroDoCampo} role="alert" className="text-sm leading-snug text-destructive">{erroVisivel}</p>}
              {avisoDeAnoDiferente && <p role="status" className="text-sm leading-snug text-amber-800 dark:text-amber-300">{avisoDeAnoDiferente}</p>}
            </div>

            <p
              role="note"
              data-aviso="triagem-dos-planos"
              className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm leading-snug text-amber-900 dark:text-amber-200"
            >
              {AVISO_DA_TRIAGEM_DOS_PLANOS}
            </p>

            {erro && <p ref={blocoDoErro} role="alert" data-erro="gravacao" className="break-words text-sm leading-snug text-destructive">{erro}</p>}

            {!podeConfirmar && !salvando && !erro && (
              <p className="text-xs leading-snug text-muted-foreground">Escolha cirurgia ou internação e informe uma data válida para confirmar.</p>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" className="h-11 w-full sm:w-auto" disabled={salvando} onClick={pedirParaFechar}>
                Cancelar
              </Button>
              <Button type="submit" className="h-11 w-full sm:w-auto" disabled={!podeConfirmar}>
                {salvando ? (<><Loader2 className="icon-xs animate-spin" aria-hidden="true" />Salvando…</>) : 'Confirmar'}
              </Button>
            </DialogFooter>
          </form>
        )}

        <AlertDialog open={perguntandoDescartar} onOpenChange={setPerguntandoDescartar}>
          <AlertDialogContent onCloseAutoFocus={devolverOFocoAoFormulario} className="w-[calc(100%-2rem)] rounded-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Descartar o que digitei?</AlertDialogTitle>
              <AlertDialogDescription>O que você escolheu e digitou aqui será perdido.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 sm:gap-0">
              <AlertDialogCancel className="mt-0 h-11 w-full sm:w-auto">Continuar editando</AlertDialogCancel>
              <AlertDialogAction className="h-11 w-full sm:w-auto" onClick={descartar}>Descartar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
