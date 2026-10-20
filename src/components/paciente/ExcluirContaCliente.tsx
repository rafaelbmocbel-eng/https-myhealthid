import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  PALAVRA_CONFIRMACAO,
  MENSAGEM_ERRO_EXCLUSAO,
  apagarSessaoLocal,
  confirmacaoValida,
  contaTemSenha,
  excluirMinhaContaCliente,
  exigeNovoLogin,
  limparCachesDoUsuario,
  navegador,
  type CodigoErroExclusao,
} from '@/lib/contaCliente';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export interface AvisoExclusao {
  titulo: string;
  descricao?: string;
}

const AVISO_PADRAO: AvisoExclusao = {
  titulo: 'Conta excluída',
  descricao: 'Seu login e o acesso ao portal foram apagados.',
};

export interface ExcluirContaClienteProps {
  /** Rota para onde ir depois de excluir (padrão: página inicial). */
  destinoAposExcluir?: string;
  /** Chamado depois que a conta foi excluída e a sessão encerrada. */
  onExcluida?: () => void;
  /** Aviso mostrado após a exclusão. */
  avisoSucesso?: AvisoExclusao;
}

interface DialogProps extends ExcluirContaClienteProps {
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
}

export function ExcluirContaClienteDialog({
  aberto,
  onAbertoChange,
  destinoAposExcluir = '/',
  onExcluida,
  avisoSucesso = AVISO_PADRAO,
}: DialogProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [codigo, setCodigo] = useState<CodigoErroExclusao | null>(null);
  // A RPC pode exigir senha mesmo quando o metadado do usuário não indica login por senha.
  const [senhaExigidaPeloServidor, setSenhaExigidaPeloServidor] = useState(false);
  const confirmacaoRef = useRef<HTMLInputElement>(null);
  const senhaRef = useRef<HTMLInputElement>(null);

  const pedeSenha = senhaExigidaPeloServidor || contaTemSenha(user);
  const podeExcluir = confirmacaoValida(texto) && (!pedeSenha || senha.length > 0) && !excluindo;

  useEffect(() => {
    if (aberto) return;
    setTexto('');
    setSenha('');
    setMostrarSenha(false);
    setExcluindo(false);
    setCodigo(null);
    setSenhaExigidaPeloServidor(false);
  }, [aberto]);

  useEffect(() => {
    if (codigo === 'senha_incorreta' || codigo === 'senha_obrigatoria') senhaRef.current?.focus();
  }, [codigo, pedeSenha]);

  const encerrarSessao = async (escopo: 'local' | 'global'): Promise<boolean> => {
    try {
      const resposta = await supabase.auth.signOut({ scope: escopo });
      return !resposta?.error;
    } catch (err) {
      console.warn('[ExcluirContaCliente] signOut falhou:', err);
      return false;
    }
  };

  const excluir = async () => {
    if (!podeExcluir) return;
    setExcluindo(true);
    setCodigo(null);
    const resultado = await excluirMinhaContaCliente({
      confirmacao: texto,
      senha: pedeSenha ? senha : null,
    });
    if (resultado.ok === false) {
      setExcluindo(false);
      setCodigo(resultado.codigo);
      if (resultado.codigo === 'senha_obrigatoria') setSenhaExigidaPeloServidor(true);
      if (resultado.codigo === 'senha_incorreta') setSenha('');
      return;
    }
    const sessaoEncerrada = await encerrarSessao('local');
    limparCachesDoUsuario(queryClient);
    if (!sessaoEncerrada) {
      // A conta já foi apagada, mas o logout não chegou ao servidor e o supabase-js manteria o token:
      // sem recarregar, o app continuaria "logado". O aviso se perderia no recarregamento.
      apagarSessaoLocal();
      onExcluida?.();
      navegador.recarregar(destinoAposExcluir);
      return;
    }
    toast.success(avisoSucesso.titulo, { description: avisoSucesso.descricao, duration: 9000 });
    onExcluida?.();
    onAbertoChange(false);
    navigate(destinoAposExcluir, { replace: true });
  };

  const sairEEntrarDeNovo = async () => {
    await encerrarSessao('global');
    limparCachesDoUsuario(queryClient);
    onAbertoChange(false);
    navigate('/paciente/login', { replace: true });
  };

  return (
    <AlertDialog
      open={aberto}
      onOpenChange={(proximo) => {
        if (excluindo) return;
        onAbertoChange(proximo);
      }}
    >
      <AlertDialogContent
        className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto p-4 sm:p-6"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          confirmacaoRef.current?.focus();
        }}
      >
        <form
          className="grid gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void excluir();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5 shrink-0" aria-hidden="true" />
              Excluir minha conta
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é definitiva e não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3 text-sm text-foreground">
            <section aria-labelledby="excluir-apagado">
              <h3 id="excluir-apagado" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                O que será apagado
              </h3>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>O seu login (e-mail e senha ou acesso pelo Google).</li>
                <li>O seu acesso ao portal do cliente e o que é só seu aqui.</li>
              </ul>
            </section>

            <section
              aria-labelledby="excluir-permanece"
              className="rounded-lg border border-border bg-muted/50 p-3"
            >
              <h3 id="excluir-permanece" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                O que permanece
              </h3>
              <p className="mt-1">
                Os registros feitos pelos profissionais que te atendem ficam com eles, conforme as regras de guarda
                de prontuário. Você perde o acesso a esses registros.
              </p>
            </section>

            <p className="text-muted-foreground">
              Depois de excluir, você poderá criar outra conta com o mesmo e-mail, inclusive uma conta de profissional.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="excluir-confirmacao">
              Para confirmar, digite <strong>{PALAVRA_CONFIRMACAO}</strong>
            </Label>
            <Input
              id="excluir-confirmacao"
              ref={confirmacaoRef}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              disabled={excluindo}
              className="h-11"
            />
          </div>

          {pedeSenha && (
            <div className="space-y-1.5">
              <Label htmlFor="excluir-senha">Sua senha</Label>
              <div className="relative">
                <Input
                  id="excluir-senha"
                  ref={senhaRef}
                  type={mostrarSenha ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  disabled={excluindo}
                  aria-invalid={codigo === 'senha_incorreta' || undefined}
                  className="h-11 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha((v) => !v)}
                  aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Esqueceu a senha? Saia e toque em “Esqueci minha senha” na tela de entrada do portal.
              </p>
            </div>
          )}

          {!pedeSenha && (
            <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              Você entra pelo Google, por isso não pedimos senha. Se for preciso, vamos pedir que você entre de novo
              para confirmar.
            </p>
          )}

          {codigo && (
            <div
              role="alert"
              className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <p>{MENSAGEM_ERRO_EXCLUSAO[codigo]}</p>
              {exigeNovoLogin(codigo) && (
                <Button type="button" variant="outline" className="h-11 w-full" onClick={() => void sairEEntrarDeNovo()}>
                  Sair e entrar de novo
                </Button>
              )}
            </div>
          )}

          <AlertDialogFooter className="gap-2 sm:space-x-0">
            <AlertDialogCancel type="button" disabled={excluindo} className="mt-0 h-11">
              Cancelar
            </AlertDialogCancel>
            <Button type="submit" variant="destructive" className="h-11" disabled={!podeExcluir}>
              {excluindo ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Excluindo…
                </>
              ) : (
                'Excluir definitivamente'
              )}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function ExcluirContaCliente(props: ExcluirContaClienteProps) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <Card className="border-dashed">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
              <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold">Excluir minha conta</h2>
              <p className="text-xs text-muted-foreground">
                Apaga o seu login e o acesso ao portal. Os registros feitos pelos profissionais que te atendem ficam
                com eles.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setAberto(true)}
            className="h-11 w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive sm:ml-auto sm:w-auto"
          >
            Excluir minha conta
          </Button>
        </CardContent>
      </Card>
      <ExcluirContaClienteDialog aberto={aberto} onAbertoChange={setAberto} {...props} />
    </>
  );
}
