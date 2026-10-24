import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, UserRound } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import LogoIcon from '@/components/LogoIcon';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ExcluirContaClienteDialog } from '@/components/paciente/ExcluirContaCliente';

interface Props {
  email?: string | null;
  /** Chamado depois que a conta de cliente foi excluída (a tela de cadastro já está liberada). */
  onExcluida?: () => void;
}

// Mostrado em /auth?modo=cadastro quando quem já está logado é CLIENTE: evita mandar a pessoa
// em silêncio para o portal quando ela queria criar o perfil profissional com o mesmo e-mail.
export default function CartaoContaDeCliente({ email, onExcluida }: Props) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [excluirAberto, setExcluirAberto] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const excluirRef = useRef<HTMLButtonElement>(null);

  const sair = async () => {
    setSaindo(true);
    await signOut();
    setSaindo(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <LogoIcon size={44} />
          <span className="text-xl font-black text-foreground">My Health ID</span>
        </div>

        <Card>
          <CardContent className="space-y-4 p-4 sm:p-6">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <UserRound className="h-4 w-4 text-primary" aria-hidden="true" />
              </div>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">
                Conta de cliente
              </span>
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-black text-foreground">Esta conta é de cliente</h1>
              <p className="text-sm text-muted-foreground">
                {email ? (
                  <>
                    O e-mail <strong className="break-all text-foreground">{email}</strong> já está em uso como
                    cliente.
                  </>
                ) : (
                  'O e-mail com o qual você entrou já está em uso como cliente.'
                )}{' '}
                Para criar um perfil profissional com ele, é preciso excluir antes a conta de cliente. Se preferir
                manter a conta de cliente, saia e use outro e-mail no cadastro profissional.
              </p>
            </div>

            <div className="space-y-2.5">
              <Button type="button" className="h-11 w-full font-bold" onClick={() => navigate('/paciente/dashboard')}>
                Continuar como cliente
              </Button>
              <Button
                ref={excluirRef}
                type="button"
                variant="outline"
                onClick={() => setExcluirAberto(true)}
                className="h-auto min-h-11 w-full whitespace-normal border-destructive/40 py-2.5 text-center text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                Excluir minha conta de cliente e criar perfil profissional
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => void sair()}
                disabled={saindo}
                className="h-11 w-full"
              >
                {saindo && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Sair (usar outro e-mail)
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              A exclusão é definitiva. Os registros feitos pelos profissionais que te atendem permanecem com eles.
            </p>
          </CardContent>
        </Card>
      </div>

      <ExcluirContaClienteDialog
        aberto={excluirAberto}
        onAbertoChange={setExcluirAberto}
        destinoAposExcluir="/auth?modo=cadastro"
        retornoAposLogin="/auth?modo=cadastro"
        retornoFoco={excluirRef}
        avisoSucesso={{
          titulo: 'Conta de cliente excluída.',
          descricao: 'Agora você pode criar o perfil profissional com este e-mail.',
        }}
        onExcluida={onExcluida}
      />
    </div>
  );
}
