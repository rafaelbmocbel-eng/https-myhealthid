import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Fingerprint, Info } from 'lucide-react';
import PacienteLayout from '@/components/paciente/PacienteLayout';
import ProtectedPatientRoute from '@/components/paciente/ProtectedPatientRoute';
import PortalSkeleton from '@/components/paciente/PortalSkeleton';
import PortalErrorState from '@/components/paciente/PortalErrorState';
import PortalSemVinculoCard from '@/components/paciente/PortalSemVinculoCard';
import CheckinSemanalForm from '@/components/paciente/CheckinSemanalForm';
import CheckinEvolucaoCliente from '@/components/paciente/CheckinEvolucaoCliente';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { CAMINHO_MYID, mensagemErroCheckin, useCheckinSemanal } from '@/hooks/useCheckinSemanal';
import {
  ESCALA_URINA,
  ITENS_CHECKIN,
  ROTULOS_ITEM,
  dataCurta,
  rotuloPsr,
  type NivelItem,
  type ValoresCheckin,
} from '@/lib/checkinSemanal';

function fimDaSemana(segunda: string): string {
  const domingo = new Date(Date.parse(`${segunda}T00:00:00Z`) + 6 * 86400000);
  return dataCurta(domingo.toISOString().slice(0, 10));
}

function ResumoRespostas({ valores }: { valores: ValoresCheckin }) {
  const cor = valores.urina != null ? ESCALA_URINA.find((u) => u.nivel === valores.urina) : undefined;
  return (
    <dl className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
      {ITENS_CHECKIN.map((item) => (
        <div key={item} className="flex items-baseline justify-between gap-2 rounded-lg bg-muted/40 px-3 py-1.5">
          <dt className="text-muted-foreground">{ROTULOS_ITEM[item].curto}</dt>
          <dd className="text-right font-medium text-foreground">
            {valores[item]} · {ROTULOS_ITEM[item].niveis[valores[item] as NivelItem]}
          </dd>
        </div>
      ))}
      {cor && (
        <div className="flex items-baseline justify-between gap-2 rounded-lg bg-muted/40 px-3 py-1.5">
          <dt className="text-muted-foreground">Cor da urina</dt>
          <dd className="text-right font-medium text-foreground">{cor.nivel} · {cor.descricao}</dd>
        </div>
      )}
      {valores.psr != null && (
        <div className="flex items-baseline justify-between gap-2 rounded-lg bg-muted/40 px-3 py-1.5">
          <dt className="text-muted-foreground">Recuperação do treino</dt>
          <dd className="text-right font-medium text-foreground">{valores.psr} · {rotuloPsr(valores.psr)}</dd>
        </div>
      )}
    </dl>
  );
}

function CartaoMyID({ onComecar }: { onComecar: () => void }) {
  return (
    <section
      aria-labelledby="checkin-myid-primeiro-passo"
      className="rounded-2xl border border-primary/30 bg-primary/5 p-4"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Fingerprint className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <h2 id="checkin-myid-primeiro-passo" className="text-sm font-bold text-foreground">
              Seu primeiro passo é o MyID
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Você pode responder o check-in agora, mas o MyID é o que mostra o seu perfil de saúde. Comece por ele quando puder.
            </p>
          </div>
          <Button size="sm" className="min-h-[44px] gap-1.5" onClick={onComecar}>
            Começar meu MyID
          </Button>
        </div>
      </div>
    </section>
  );
}

export default function PacienteCheckin() {
  const navigate = useNavigate();
  const { paciente, carregandoPaciente, erroPaciente, refazerPaciente, serie, myid, preferencia, registrar } = useCheckinSemanal();
  const [editando, setEditando] = useState(false);
  const [base, setBase] = useState<ValoresCheckin | null>(null);
  const [enviado, setEnviado] = useState<ValoresCheckin | null>(null);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const tituloConfirmacao = useRef<HTMLHeadingElement>(null);
  const idSwitch = useId();

  useEffect(() => {
    if (enviado) tituloConfirmacao.current?.focus();
  }, [enviado]);

  const comecarMyID = () => navigate(CAMINHO_MYID);

  const enviar = async (valores: ValoresCheckin) => {
    setErroEnvio(null);
    try {
      await registrar.mutateAsync(valores);
      setEnviado(valores);
      setEditando(false);
    } catch (e) {
      console.error('[PacienteCheckin] registrar:', e);
      setErroEnvio(mensagemErroCheckin(e));
    }
  };

  const corrigir = () => {
    setBase(enviado ?? serie.linhaDaSemana);
    setEnviado(null);
    setErroEnvio(null);
    setEditando(true);
  };

  if (carregandoPaciente || serie.isLoading) {
    return (
      <ProtectedPatientRoute>
        <PacienteLayout>
          <PortalSkeleton />
        </PacienteLayout>
      </ProtectedPatientRoute>
    );
  }

  if (erroPaciente || serie.isError) {
    return (
      <ProtectedPatientRoute>
        <PacienteLayout>
          <PortalErrorState
            onRetry={() => { refazerPaciente(); serie.refetch(); }}
            mensagem="Não consegui carregar o seu check-in. Verifique sua internet e tente de novo."
          />
        </PacienteLayout>
      </ProtectedPatientRoute>
    );
  }

  if (!paciente) {
    return (
      <ProtectedPatientRoute>
        <PacienteLayout>
          <div className="mx-auto max-w-2xl p-4 md:p-6">
            <PortalSemVinculoCard recurso="o check-in" />
          </div>
        </PacienteLayout>
      </ProtectedPatientRoute>
    );
  }

  const jaRespondeu = serie.respondeuEstaSemana && !editando && !enviado;

  return (
    <ProtectedPatientRoute>
      <PacienteLayout>
        <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
          <div>
            <h1 className="h-page">Check-in da semana</h1>
            <p className="text-xs text-muted-foreground">
              30 segundos · semana de {dataCurta(serie.semanaAtual)} a {fimDaSemana(serie.semanaAtual)}
              {paciente.terapeuta_id ? ' · suas respostas ficam disponíveis para o seu profissional acompanhar' : ''}
            </p>
          </div>

          {myid.isLoading && <Skeleton className="h-28 w-full rounded-2xl" aria-hidden="true" />}
          {!myid.isLoading && !myid.concluido && <CartaoMyID onComecar={comecarMyID} />}

          {serie.indisponivel ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
                <Info className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-bold text-foreground">O check-in ainda não está disponível</p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  Estamos preparando esta área. Volte em breve para responder.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {enviado && (
                <Card role="status" className="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
                      <h2 ref={tituloConfirmacao} tabIndex={-1} className="text-sm font-bold text-foreground outline-none">
                        Check-in registrado
                      </h2>
                    </div>
                    <p className="text-xs text-muted-foreground">Obrigado! Você pode corrigir suas respostas até domingo.</p>
                    <ResumoRespostas valores={enviado} />
                    {!myid.isLoading && !myid.concluido && (
                      <div className="rounded-xl border border-primary/30 bg-background p-3">
                        <p className="text-sm text-foreground">Falta o seu MyID, que é o primeiro passo.</p>
                        <Button size="sm" className="mt-2 min-h-[44px]" onClick={comecarMyID}>
                          Começar meu MyID
                        </Button>
                      </div>
                    )}
                    <Button variant="outline" size="sm" className="min-h-[44px]" onClick={corrigir}>
                      Corrigir minhas respostas
                    </Button>
                  </CardContent>
                </Card>
              )}

              {jaRespondeu && serie.linhaDaSemana && (
                <Card>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
                      <h2 className="text-sm font-bold text-foreground">Você já respondeu esta semana</h2>
                    </div>
                    <ResumoRespostas valores={serie.linhaDaSemana} />
                    <Button variant="outline" size="sm" className="min-h-[44px]" onClick={corrigir}>
                      Corrigir minhas respostas
                    </Button>
                  </CardContent>
                </Card>
              )}

              {!enviado && !jaRespondeu && (
                <CheckinSemanalForm
                  inicial={editando ? base : null}
                  enviando={registrar.isPending}
                  erro={erroEnvio}
                  onEnviar={enviar}
                  onCancelar={editando ? () => { setEditando(false); setErroEnvio(null); } : undefined}
                />
              )}

              <CheckinEvolucaoCliente linhas={serie.linhas} />

              {preferencia.disponivel && (
                <Card>
                  <CardContent className="flex items-start gap-3 p-4">
                    <div className="min-w-0 flex-1 space-y-1">
                      <Label htmlFor={idSwitch} className="text-sm font-bold">Lembrete pelo WhatsApp</Label>
                      <p id={`${idSwitch}-ajuda`} className="text-xs text-muted-foreground">
                        Se o seu profissional usa o WhatsApp para isso, escolha aqui se quer receber o lembrete
                      </p>
                      {preferencia.erro && (
                        <p role="alert" className="text-xs text-destructive">
                          Não consegui salvar a sua escolha. Tente de novo.
                        </p>
                      )}
                    </div>
                    <Switch
                      id={idSwitch}
                      checked={preferencia.ativo}
                      onCheckedChange={preferencia.definir}
                      disabled={preferencia.salvando}
                      aria-describedby={`${idSwitch}-ajuda`}
                    />
                  </CardContent>
                </Card>
              )}
            </>
          )}

          <p className="px-1 text-center text-[11px] text-muted-foreground">
            Este check-in não é para urgências. Se algo estiver te preocupando agora, procure atendimento.
          </p>
        </div>
      </PacienteLayout>
    </ProtectedPatientRoute>
  );
}
