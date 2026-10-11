import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useWellnessAccess } from '@/hooks/useWellnessAccess';
import { usePlanoClienteConfig } from '@/hooks/usePlanoClienteConfig';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import PortalErrorState from '@/components/paciente/PortalErrorState';
import {
  Loader2, Dumbbell, Salad, Sparkles, ChevronRight, Info, ClipboardList, Wand2, Clock, CircleAlert, Stethoscope,
} from 'lucide-react';
import { toast } from 'sonner';
import PlanoTreinoInterativo from '@/components/paciente/PlanoTreinoInterativo';
import TriagemBloqueioDialog from '@/components/planos/TriagemBloqueioDialog';
import TriagemSegurancaCard from '@/components/planos/TriagemSegurancaCard';
import SeloGovernanca from '@/components/planos/SeloGovernanca';
import ResumoAcompanhamento from '@/components/planos/ResumoAcompanhamento';
import {
  botaoGerar, ehNutricaoEmBreve, gerarPlanoDoCliente, mensagemEnviadoParaRevisao, mensagemErroGeracao,
  MENSAGEM_NUTRICAO_EM_BREVE, montarPedidoNutricaoCliente, montarPedidoTreinoCliente, ROTULO_NUTRICAO_EM_BREVE,
  SITUACAO_VAZIA, TEXTO_APOS_RECUSA, TEXTO_EM_REVISAO, textoAtrasado, textoPrevisao, textoRecusado,
  type SituacaoPlanoCliente,
} from '@/lib/geracaoPlano';
import {
  buscarSituacaoPlanoCliente, cancelarPedidoPlanoCliente, mensagemErroCancelarPedido, MENSAGEM_PEDIDO_CANCELADO,
} from '@/lib/planoClienteApi';
import { rotuloDiasUteis } from '@/lib/chancela';
import {
  formatarDataBR, lerGovernanca, lerTriagemSalva, origemDoPlanoLiberado, triagemCompleta,
  type BloqueioTriagem, type OrigemPlano, type TipoPlanoGov,
} from '@/lib/governanca';

/** Rotas do portal usadas pelos convites desta tela. */
const ROTA_PROFISSIONAIS = '/paciente/profissionais';
const ROTA_ASSINATURA = '/paciente/plano';
const ROTA_CHAT = '/paciente/chat';

type SituacaoPorTipo = Record<TipoPlanoGov, SituacaoPlanoCliente>;
const SITUACAO_INICIAL: SituacaoPorTipo = { treino: SITUACAO_VAZIA, nutricao: SITUACAO_VAZIA };

// Seção reutilizável do plano personalizado (treino IA + personal + nutrição).
// Mora dentro de "Plano de tratamento" (/paciente/exercicios). Sem wrapper de layout
// (o pai fornece).
//
// Regras (decisão do Rafael, 08/10/2026 — docs/fluxo-cliente-e-tiers.md):
//  - só o cliente PREMIUM gera treino/nutrição; o teste grátis não dá esse direito;
//  - o plano gerado vai para a fila da equipe científica MyHealthID e o cliente NÃO vê o
//    conteúdo até ser chancelado: vê só o status (meu_status_plano_cliente);
//  - o plano liberado pelo profissional do paciente tem precedência (meu_plano_liberado);
//  - o app sempre indica procurar um profissional que use o MyHealthID.
export function PlanoPersonalizadoSection() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isFree, isPremium, isLoading: acLoading } = useWellnessAccess();
  const { config, loading: configLoading } = usePlanoClienteConfig();
  const [loading, setLoading] = useState(true);
  const [erroCarregar, setErroCarregar] = useState(false);
  const [treino, setTreino] = useState<any>(null);
  const [dieta, setDieta] = useState<any>(null);
  const [situacao, setSituacao] = useState<SituacaoPorTipo>(SITUACAO_INICIAL);
  const [diretrizes, setDiretrizes] = useState<any[]>([]);
  const [pacienteId, setPacienteId] = useState<string | null>(null);
  const [temTerapeuta, setTemTerapeuta] = useState(false);
  const [gerando, setGerando] = useState<'' | 'treino' | 'nutricao' | 'tudo'>('');
  const [cancelando, setCancelando] = useState<'' | TipoPlanoGov>('');
  const [confirmarCancelar, setConfirmarCancelar] = useState<TipoPlanoGov | null>(null);
  // O servidor é quem manda: se ele disser "em breve" com a configuração ainda velha na tela, a nutrição some até recarregar.
  const [nutricaoBarrada, setNutricaoBarrada] = useState(false);
  // Triagem de segurança: a edge pode recusar a geração (nunca é o cliente quem decide
  // prosseguir) e o cliente completa a triagem autodeclarada para o plano ser montado.
  const [bloqueioCliente, setBloqueioCliente] = useState<BloqueioTriagem | null>(null);
  const [triagemCompletaOk, setTriagemCompletaOk] = useState<boolean | null>(null);
  const [triagemForcarAberta, setTriagemForcarAberta] = useState(false);
  const [triagemChave, setTriagemChave] = useState(0);

  // GERAR o próprio plano: só Premium (o teste grátis de 7 dias não vale). O servidor confere.
  const podeGerar = isPremium;
  // Nutrição Premium vem desligada de fábrica: enquanto o Rafael não ligar, só o treino é oferecido.
  const nutricaoLigada = config.nutricao_premium_ativa && !nutricaoBarrada;

  // Sem o status o cliente continua vendo os planos; só não aparece o aviso de revisão. Quando a leitura
  // falha devolve null e quem chama mantém o que já sabia (um "aguardando" não some por falha de rede).
  const lerSituacao = async (tipo: TipoPlanoGov): Promise<SituacaoPlanoCliente | null> => {
    try {
      return await buscarSituacaoPlanoCliente(tipo);
    } catch (e) {
      console.error('[PlanoIA] status do plano indisponível:', e);
      return null;
    }
  };

  // Planos por RPC: o que o profissional liberou ou, na falta dele, o que a equipe científica
  // chancelou. Ambas já tiram da resposta a revisão de segurança e a justificativa.
  const carregar = async (pid: string) => {
    const [t, d, sitTreino, sitNutricao, dir, anam] = await Promise.all([
      (supabase as any).rpc('meu_plano_liberado', { p_tipo: 'treino' }),
      (supabase as any).rpc('meu_plano_liberado', { p_tipo: 'nutricao' }),
      lerSituacao('treino'),
      lerSituacao('nutricao'),
      // RLS só entrega o que o profissional enviou ao portal — todas as áreas
      (supabase as any).from('diretrizes_profissionais').select('titulo, area, conteudo, updated_at')
        .eq('paciente_id', pid).eq('enviada_portal', true)
        .order('updated_at', { ascending: false }),
      (supabase as any).from('nutricao_anamnese').select('respostas').eq('paciente_id', pid).maybeSingle(),
    ]);
    const falha = [t, d, dir].find(r => r.error);
    if (falha) throw falha.error;
    setSituacao((atual) => ({ treino: sitTreino ?? atual.treino, nutricao: sitNutricao ?? atual.nutricao }));
    // Falha ao ler a anamnese não derruba a tela: a triagem fica "desconhecida" e o card aparece aberto.
    setTriagemCompletaOk(anam.error ? null : triagemCompleta(lerTriagemSalva(anam.data?.respostas).respostas));
    setTreino(t.data || null);
    setDieta(d.data || null);
    setDiretrizes(dir.data || []);
  };

  const carregarTudo = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    setErroCarregar(false);
    try {
      const { data: pac, error: pacErr } = await supabase.from('pacientes').select('id, terapeuta_id').eq('user_id', user.id).maybeSingle();
      if (pacErr) throw pacErr;
      if (!pac) { setLoading(false); return; }
      setPacienteId(pac.id);
      setTemTerapeuta(!!pac.terapeuta_id);
      await carregar(pac.id);
    } catch (e) {
      console.error('[PlanoIA] carregar error:', e);
      setErroCarregar(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarTudo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Pede o plano do cliente (treino e/ou nutrição) a partir do MyID + formulários + histórico
  // clínico. A edge grava na fila de chancela e responde só o recibo, sem o conteúdo.
  const gerarPlano = async (alvo: 'treino' | 'nutricao' | 'tudo', incomodo?: string) => {
    if (!pacienteId) return;
    // Trava do cliente: gerar o próprio plano é Premium. Sem isso, leva ao Premium.
    if (!podeGerar) { navigate(ROTA_ASSINATURA); return; }
    // Com a nutrição desligada "os dois" é só o treino; o servidor também recusa a nutrição nesse caso.
    const pedeTreino = alvo === 'treino' || alvo === 'tudo';
    const pedeNutricao = alvo === 'nutricao' || (alvo === 'tudo' && nutricaoLigada);
    setGerando(alvo);
    // Quando a triagem recusa um dos planos, o outro (se houver) continua; o aviso vem no fim.
    const enviados: TipoPlanoGov[] = [];
    let bloqueado: BloqueioTriagem | null = null;
    let falhou = false;
    try {
      const [{ data: anamRow }, { data: pacRow }] = await Promise.all([
        (supabase as any).from('nutricao_anamnese').select('respostas').eq('paciente_id', pacienteId).maybeSingle(),
        (supabase as any).from('pacientes').select('data_nascimento, sexo, genero').eq('id', pacienteId).maybeSingle(),
      ]);
      const dados = {
        pacienteId,
        anamnese: (anamRow?.respostas ?? null) as Record<string, unknown> | null,
        nascimento: pacRow?.data_nascimento as string | null | undefined,
        sexo: (pacRow?.sexo || pacRow?.genero) as string | null | undefined,
      };

      if (pedeTreino) {
        const r = await gerarPlanoDoCliente('gerar-plano-treino', montarPedidoTreinoCliente(dados, incomodo));
        if (r.tipo === 'bloqueio') bloqueado = r.bloqueio;
        else enviados.push('treino');
      }

      if (pedeNutricao) {
        const r = await gerarPlanoDoCliente('gerar-plano-alimentar', montarPedidoNutricaoCliente(dados));
        if (r.tipo === 'bloqueio') bloqueado = bloqueado ?? r.bloqueio;
        else enviados.push('nutricao');
      }

      if (bloqueado) {
        setBloqueioCliente(bloqueado);
        if (enviados.length > 0) toast.success('Um dos planos foi enviado para a revisão da equipe científica MyHealthID.');
      } else {
        toast.success(mensagemEnviadoParaRevisao(enviados, !!incomodo));
      }
    } catch (e: unknown) {
      falhou = true;
      if (enviados.length > 0) toast.success(mensagemEnviadoParaRevisao(enviados, !!incomodo));
      if (ehNutricaoEmBreve(e)) {
        setNutricaoBarrada(true);
        toast.info(MENSAGEM_NUTRICAO_EM_BREVE);
      } else {
        toast.error(mensagemErroGeracao(e));
      }
    } finally {
      // O que já foi enviado precisa aparecer como "em revisão" mesmo que o outro pedido tenha falhado;
      // e uma falha pode ser o servidor dizendo que já há um plano em revisão (outra aba, estado velho).
      if (enviados.length > 0 || falhou) {
        try {
          await carregar(pacienteId);
        } catch (e) {
          console.error('[PlanoIA] atualizar status error:', e);
        }
      }
      setGerando('');
    }
  };

  // O pedido que ainda aguarda a equipe sai da fila; um já decidido pela equipe não é cancelado (o
  // servidor recusa) e a tela passa a mostrar a decisão.
  const cancelarPedido = async (tipo: TipoPlanoGov) => {
    setCancelando(tipo);
    try {
      const nova = await cancelarPedidoPlanoCliente(tipo);
      setSituacao((atual) => ({ ...atual, [tipo]: nova }));
      toast.success(MENSAGEM_PEDIDO_CANCELADO);
    } catch (e: unknown) {
      console.error('[PlanoIA] cancelar pedido error:', e);
      toast.error(mensagemErroCancelarPedido(e));
      const atual = await lerSituacao(tipo);
      if (atual) setSituacao((antes) => ({ ...antes, [tipo]: atual }));
    } finally {
      setCancelando('');
    }
  };

  if (acLoading || loading || configLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (erroCarregar) {
    return <PortalErrorState onRetry={() => carregarTudo()} mensagem="Não consegui carregar seu plano. Verifique sua internet e tente de novo." />;
  }

  const origemTreino = treino ? origemDoPlanoLiberado(treino) : null;
  const origemDieta = dieta ? origemDoPlanoLiberado(dieta) : null;
  const gerandoTreino = gerando === 'treino' || gerando === 'tudo';
  const gerandoDieta = gerando === 'nutricao' || gerando === 'tudo';
  const botaoTreino = botaoGerar('treino', situacao.treino.status, origemTreino === 'equipe_myhealthid', situacao.treino.podeRegenerar);
  const botaoDieta = botaoGerar('nutricao', situacao.nutricao.status, origemDieta === 'equipe_myhealthid', situacao.nutricao.podeRegenerar);
  const jaPediu = (s: SituacaoPlanoCliente) => s.status !== null && s.status !== 'cancelado';
  const nadaAindaGerado = !treino && !dieta && !jaPediu(situacao.treino) && !jaPediu(situacao.nutricao);
  const emAndamento = (s: SituacaoPlanoCliente) => s.status === 'aguardando' || s.status === 'recusado';
  const prazoTexto = rotuloDiasUteis(config.prazo_chancela_dias_uteis);

  return (
    <div className="space-y-4">
            {/* Disclaimer de segurança */}
            <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/50 border border-border/40">
              <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground">
                Estes planos são uma <strong>sugestão de apoio personalizada</strong> a partir do seu MyID, dos formulários e do seu histórico clínico — <strong>não substituem</strong> a orientação do seu profissional de saúde. Converse com ele antes de mudanças importantes.
              </p>
            </div>

            {/* A triagem de segurança do cliente ajuda a equipe e o profissional a montar o plano. */}
            {pacienteId && (
              <TriagemSegurancaCard
                key={triagemChave}
                pacienteId={pacienteId}
                defaultAberto={triagemForcarAberta || triagemCompletaOk !== true}
                onSalvo={() => { setTriagemCompletaOk(true); setBloqueioCliente(null); }}
              />
            )}

            {/* Gerador do cliente — só Premium. O plano passa pela chancela da equipe científica
                antes de chegar ao cliente. */}
            {podeGerar ? (
              <Card className="border-primary/25">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Wand2 className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold">{nutricaoLigada ? 'Gerar meu treino e plano nutricional' : 'Gerar meu treino'}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {nutricaoLigada ? 'Montados' : 'Montado'} a partir do seu MyID, dos formulários que nascem das suas respostas e do seu histórico clínico. Antes de chegar até você, a equipe científica MyHealthID revisa e chancela.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button variant="outline" className="gap-1.5" disabled={!!gerando || botaoTreino.desabilitado}
                      onClick={() => gerarPlano('treino')}>
                      {gerandoTreino ? <Loader2 className="h-4 w-4 animate-spin" /> : <Dumbbell className="h-4 w-4" />}
                      {botaoTreino.rotulo}
                    </Button>
                    {nutricaoLigada ? (
                      <Button variant="outline" className="gap-1.5" disabled={!!gerando || botaoDieta.desabilitado}
                        onClick={() => gerarPlano('nutricao')}>
                        {gerandoDieta ? <Loader2 className="h-4 w-4 animate-spin" /> : <Salad className="h-4 w-4" />}
                        {botaoDieta.rotulo}
                      </Button>
                    ) : (
                      <div className="flex items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                        <Salad className="h-4 w-4 shrink-0" aria-hidden />
                        {ROTULO_NUTRICAO_EM_BREVE}
                      </div>
                    )}
                  </div>
                  {nutricaoLigada && nadaAindaGerado && (
                    <Button className="w-full gap-1.5" disabled={!!gerando} onClick={() => gerarPlano('tudo')}>
                      {gerando === 'tudo' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                      {gerando === 'tudo' ? 'Enviando seu pedido…' : 'Gerar os dois'}
                    </Button>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    Responda a triagem de segurança e o histórico clínico antes para o plano ficar mais preciso. O plano só aparece aqui depois de chancelado pela equipe, que tem até {prazoTexto} para revisar.
                  </p>
                </CardContent>
              </Card>
            ) : isFree ? (
              // Só o free vê o convite: o cliente clínico não assina o Premium
              // (a página de assinatura não oferece para ele) — o profissional monta.
              <Card className="border-0 shadow-md overflow-hidden">
                <div className="p-5 text-center text-white" style={{ background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)' }}>
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-2">
                    <Wand2 className="h-6 w-6" />
                  </div>
                  <h2 className="text-base font-black">{nutricaoLigada ? 'Monte seu treino e nutrição sob medida' : 'Monte seu treino sob medida'}</h2>
                  <p className="text-xs text-white/85 mt-1 max-w-sm mx-auto">
                    {nutricaoLigada
                      ? <>Gerar o seu treino e o seu plano nutricional faz parte do <strong>Premium</strong>. Eles são montados a partir do seu MyID, dos formulários e do seu histórico clínico e chancelados pela equipe científica MyHealthID antes de chegar até você.</>
                      : <>Gerar o seu treino faz parte do <strong>Premium</strong>. Ele é montado a partir do seu MyID, dos formulários e do seu histórico clínico e chancelado pela equipe científica MyHealthID antes de chegar até você. O plano nutricional Premium estará disponível em breve.</>}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center mt-3">
                    <Button variant="secondary" className="gap-1.5 bg-white text-primary hover:bg-white/90 border-0"
                      onClick={() => navigate(ROTA_ASSINATURA)}>
                      Assinar o Premium <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ) : null}

            {/* Planos agrupados por ÁREA, cada um com seu cabeçalho. Cada seção
                só aparece se tiver conteúdo liberado/chancelado ou um pedido em andamento. */}
            {(() => {
              const usadas = new Set<string>();
              const dirDe = (areas: string[]) => {
                const list = diretrizes.filter((d: any) => areas.includes(d.area));
                list.forEach((d: any) => usadas.add(d.area));
                return list;
              };
              const reab = dirDe(['fisioterapia', 'reabilitacao', 'fisio']);
              const personalDir = dirDe(['educacao_fisica']);
              const nutriDir = dirDe(['nutricao']);
              const psiDir = dirDe(['psicologia']);
              const medDir = dirDe(['medicina']);
              const odontoDir = dirDe(['odontologia']);
              const outrasDir = diretrizes.filter((d: any) => !usadas.has(d.area));

              const temPersonal = personalDir.length > 0 || !!treino || emAndamento(situacao.treino);
              const temNutri = nutriDir.length > 0 || !!dieta || emAndamento(situacao.nutricao);
              const vazio = !reab.length && !temPersonal && !temNutri && !psiDir.length && !medDir.length && !odontoDir.length && !outrasDir.length;

              const mapDir = (list: any[]) => list.map((d, i) => <DiretrizProfissionalView key={i} diretriz={d} />);

              return (
                <>
                  {reab.length > 0 && <SecaoPlano titulo="🦴 Reabilitação">{mapDir(reab)}</SecaoPlano>}

                  {temPersonal && (
                    <SecaoPlano titulo="🏋️ Personal (treino)">
                      {mapDir(personalDir)}
                      <AvisoSituacaoPlano
                        situacao={situacao.treino}
                        planoVisivel={origemTreino}
                        nomePedido="treino"
                        cancelando={cancelando === 'treino'}
                        ocupado={!!gerando || !!cancelando}
                        onCancelar={() => setConfirmarCancelar('treino')}
                      />
                      {treino && pacienteId && origemTreino && (
                        <>
                          <SeloGovernanca conteudo={treino.conteudo} origem={origemTreino} visao="paciente" aprovado />
                          <PlanoTreinoInterativo
                            pacienteId={pacienteId}
                            titulo={treino.titulo}
                            conteudo={treino.conteudo}
                            // "Senti incômodo" gera um plano novo que volta para a fila; o chancelado
                            // atual segue visível até o novo ser chancelado.
                            onRegenerarComIncomodo={podeGerar && origemTreino === 'equipe_myhealthid' && situacao.treino.podeRegenerar ? (nota) => gerarPlano('treino', nota) : undefined}
                            regenerando={gerandoTreino}
                          />
                          <ResumoAcompanhamento conteudo={treino.conteudo} aprovacaoEm={lerGovernanca(treino.conteudo)?.aprovacao?.em} />
                        </>
                      )}
                    </SecaoPlano>
                  )}

                  {temNutri && (
                    <SecaoPlano titulo="🥗 Nutricional">
                      {mapDir(nutriDir)}
                      <AvisoSituacaoPlano
                        situacao={situacao.nutricao}
                        planoVisivel={origemDieta}
                        nomePedido="plano alimentar"
                        cancelando={cancelando === 'nutricao'}
                        ocupado={!!gerando || !!cancelando}
                        onCancelar={() => setConfirmarCancelar('nutricao')}
                      />
                      {dieta && origemDieta && (
                        <>
                          <SeloGovernanca conteudo={dieta.conteudo} origem={origemDieta} visao="paciente" aprovado />
                          <PlanoDietaView dieta={{ titulo: dieta.titulo, plano: dieta.conteudo, calorias_alvo: dieta.calorias_alvo }} />
                          <ResumoAcompanhamento conteudo={dieta.conteudo} aprovacaoEm={lerGovernanca(dieta.conteudo)?.aprovacao?.em} />
                        </>
                      )}
                    </SecaoPlano>
                  )}

                  {psiDir.length > 0 && <SecaoPlano titulo="🧠 Psicológico">{mapDir(psiDir)}</SecaoPlano>}
                  {medDir.length > 0 && <SecaoPlano titulo="🩺 Médico">{mapDir(medDir)}</SecaoPlano>}
                  {odontoDir.length > 0 && <SecaoPlano titulo="🦷 Odontológico">{mapDir(odontoDir)}</SecaoPlano>}
                  {outrasDir.length > 0 && <SecaoPlano titulo="📋 Outros planos">{mapDir(outrasDir)}</SecaoPlano>}

                  {vazio && (
                    <Card><CardContent className="p-8 text-center">
                      <Sparkles className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm font-medium text-muted-foreground">Nenhum plano ainda</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        {podeGerar
                          ? `Toque em "${nutricaoLigada ? 'Gerar os dois' : 'Gerar treino'}" acima para pedir o seu — a equipe científica MyHealthID revisa antes de ele chegar até você. Seu profissional também pode montar um.`
                          : isFree
                            ? 'Seu profissional pode montar um plano sob medida para você. Assine o Premium para gerar o seu — a equipe científica MyHealthID revisa antes de ele chegar até você.'
                            : 'Seu profissional monta seu plano sob medida — ele aparece aqui assim que for liberado.'}
                      </p>
                    </CardContent></Card>
                  )}
                </>
              );
            })()}

            <ConviteProfissional
              temTerapeuta={temTerapeuta}
              onEncontrar={() => navigate(ROTA_PROFISSIONAIS)}
              onFalar={() => navigate(ROTA_CHAT)}
            />

            <AlertDialog open={confirmarCancelar !== null} onOpenChange={(aberto) => { if (!aberto) setConfirmarCancelar(null); }}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {confirmarCancelar === 'nutricao' ? 'Cancelar o pedido do plano alimentar?' : 'Cancelar o pedido do treino?'}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    O pedido sai da fila da equipe científica MyHealthID. Quando quiser, é só pedir de novo.
                    {confirmarCancelar === 'treino' && origemTreino === 'equipe_myhealthid' && ' O treino chancelado que você já tem continua valendo.'}
                    {confirmarCancelar === 'nutricao' && origemDieta === 'equipe_myhealthid' && ' O plano alimentar chancelado que você já tem continua valendo.'}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Manter o pedido</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      const tipo = confirmarCancelar;
                      setConfirmarCancelar(null);
                      if (tipo) void cancelarPedido(tipo);
                    }}
                  >
                    Cancelar pedido
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <TriagemBloqueioDialog
              bloqueio={bloqueioCliente}
              chamador="cliente"
              onCancelar={() => setBloqueioCliente(null)}
              onProsseguir={() => setBloqueioCliente(null)}
              onAbrirTriagem={() => {
                setBloqueioCliente(null);
                setTriagemForcarAberta(true);
                setTriagemChave((k) => k + 1);
              }}
            />
    </div>
  );
}

// Convite fixo: o plano do app não substitui um profissional, e o melhor treino/plano
// nutricional vem do acompanhamento de quem usa o MyHealthID.
function ConviteProfissional({ temTerapeuta, onEncontrar, onFalar }: { temTerapeuta: boolean; onEncontrar: () => void; onFalar: () => void }) {
  return (
    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold">
              {temTerapeuta
                ? 'Seu profissional no MyHealthID pode refinar e acompanhar este plano'
                : 'Para um treino e plano nutricional ainda melhores, procure um profissional que use o MyHealthID'}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Os planos do app são um apoio e não substituem o acompanhamento de um profissional; os mais elaborados pedem acompanhamento presencial.
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {temTerapeuta ? (
            <>
              <Button className="gap-1.5" onClick={onFalar}>Falar com meu profissional</Button>
              <Button variant="outline" className="gap-1.5" onClick={onEncontrar}>Ver profissionais</Button>
            </>
          ) : (
            <Button className="gap-1.5" onClick={onEncontrar}>
              Encontrar um profissional <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Situação do plano que o cliente pediu: o conteúdo só aparece quando chancelado, então
// enquanto isso ele vê só o status (a previsão da equipe e, se passou do prazo, um recado
// acolhedor) e, se foi recusado, o recado público da equipe. Pedido aguardando pode ser cancelado.
function AvisoSituacaoPlano({
  situacao, planoVisivel, nomePedido, cancelando, ocupado, onCancelar,
}: {
  situacao: SituacaoPlanoCliente;
  planoVisivel: OrigemPlano | null;
  nomePedido: string;
  cancelando: boolean;
  ocupado: boolean;
  onCancelar: () => void;
}) {
  const enviadoEm = formatarDataBR(situacao.geradoEm);
  const continuaValendo = planoVisivel === 'equipe_myhealthid';

  if (situacao.status === 'aguardando') {
    const previsao = situacao.atrasado ? '' : textoPrevisao(situacao.prazoPrevisto);
    return (
      <div role="status" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900 dark:bg-amber-950/30">
        <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" aria-hidden />
        <div className="space-y-1 min-w-0 flex-1">
          <p className="text-xs font-semibold">{TEXTO_EM_REVISAO}</p>
          {enviadoEm && <p className="text-[11px] text-muted-foreground">Pedido enviado em {enviadoEm}.</p>}
          {previsao && <p className="text-[11px] text-muted-foreground">{previsao}.</p>}
          {situacao.atrasado && <p className="text-[11px] text-foreground/80">{textoAtrasado(situacao.prazoPrevisto)}</p>}
          {continuaValendo && <p className="text-[11px] text-muted-foreground">O plano abaixo continua valendo até o novo ser chancelado.</p>}
          <Button
            type="button" variant="outline" size="sm" className="mt-1 h-7 text-xs"
            disabled={ocupado} aria-label={`Cancelar pedido do ${nomePedido}`}
            onClick={onCancelar}
          >
            {cancelando ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
            Cancelar pedido
          </Button>
        </div>
      </div>
    );
  }

  if (situacao.status === 'recusado') {
    return (
      <div role="status" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50/70 p-3 dark:border-red-900 dark:bg-red-950/30">
        <CircleAlert className="h-4 w-4 text-red-600 shrink-0 mt-0.5" aria-hidden />
        <div className="space-y-0.5">
          <p className="text-xs font-semibold">{textoRecusado(situacao.notaPublica)}</p>
          <p className="text-[11px] text-muted-foreground">{TEXTO_APOS_RECUSA}</p>
          {continuaValendo && <p className="text-[11px] text-muted-foreground">O último plano chancelado continua valendo.</p>}
        </div>
      </div>
    );
  }

  if (situacao.status === 'chancelado' && planoVisivel === 'profissional') {
    return (
      <p role="status" className="text-[11px] text-muted-foreground px-1">
        Seu profissional liberou um plano, e é ele que aparece aqui no lugar do plano gerado pelo app.
      </p>
    );
  }

  return null;
}

// Cabeçalho de seção por área na aba "Plano de tratamento".
function SecaoPlano({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-black text-foreground/80 pt-1">{titulo}</h2>
      {children}
    </div>
  );
}

// Rota antiga /paciente/plano-ia → o plano agora vive na aba unificada
// "Plano de tratamento" (/paciente/exercicios). Redireciona para lá.
export default function PacientePlanoIA() {
  return <Navigate to="/paciente/exercicios" replace />;
}

// Diretriz criada e revisada pelo PROFISSIONAL (por fases, com metas e
// marcadores) — só aparece depois que ele envia ao portal. Uma view para
// todas as áreas; o ícone acompanha a área.
function DiretrizProfissionalView({ diretriz }: { diretriz: any }) {
  if (!diretriz) return null;
  const c = diretriz.conteudo || {};
  const fases: any[] = Array.isArray(c.fases) ? c.fases : [];
  const ehTreino = diretriz.area === 'educacao_fisica';
  const Icone = ehTreino ? Dumbbell : ClipboardList;
  return (
    <Card className={ehTreino ? 'border-primary/30' : 'border-emerald-500/30'}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${ehTreino ? 'bg-primary/10' : 'bg-emerald-500/10'}`}>
            <Icone className={`h-5 w-5 ${ehTreino ? 'text-primary' : 'text-emerald-600'}`} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold truncate">{c.titulo || diretriz.titulo || (ehTreino ? 'Diretriz de Treino' : 'Diretriz Nutricional')}</p>
            <p className="text-[11px] text-muted-foreground">Montada e revisada pelo seu profissional</p>
          </div>
        </div>
        {c.objetivo && <p className="text-xs text-foreground">{c.objetivo}</p>}
        {fases.map((f, fi) => (
          <div key={fi} className="rounded-xl border border-border/40 overflow-hidden">
            <div className="px-3 py-2 bg-muted/40 flex items-center justify-between">
              <span className="text-xs font-bold">Fase {f.numero || fi + 1} — {f.titulo}</span>
              {f.duracao_semanas && <span className="text-[10px] text-muted-foreground">{f.duracao_semanas} semanas</span>}
            </div>
            <div className="p-2.5 space-y-2">
              {(Array.isArray(f.metas) ? f.metas : []).map((m: any, mi: number) => (
                <div key={mi} className="flex items-start gap-2 text-[11px]">
                  <span className="shrink-0">🎯</span>
                  <div>
                    <p className="font-medium text-foreground">{m.descricao}</p>
                    {m.como_medir && <p className="text-[10px] text-muted-foreground">Como medir: {m.como_medir}</p>}
                  </div>
                </div>
              ))}
              {(Array.isArray(f.orientacoes) ? f.orientacoes : []).length > 0 && (
                <ul className="list-disc list-inside text-[11px] text-muted-foreground space-y-0.5">
                  {f.orientacoes.map((o: string, oi: number) => <li key={oi}>{o}</li>)}
                </ul>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PlanoDietaView({ dieta }: { dieta: any }) {
  if (!dieta) return null;
  const plano = dieta.plano || {};
  const refeicoes: any[] = Array.isArray(plano.refeicoes) ? plano.refeicoes
    : Array.isArray(plano.meals) ? plano.meals
    : Array.isArray(plano) ? plano : [];
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0"><Salad className="h-5 w-5 text-emerald-600" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold truncate flex items-center gap-1.5">
              {dieta.titulo || 'Plano Alimentar'}
            </p>
            {dieta.calorias_alvo && <p className="text-[11px] text-muted-foreground">Meta: ~{dieta.calorias_alvo} kcal/dia</p>}
          </div>
        </div>
        {refeicoes.map((r: any, ri: number) => {
          const itens: any[] = Array.isArray(r.itens) ? r.itens : Array.isArray(r.alimentos) ? r.alimentos : [];
          return (
            <div key={ri} className="rounded-xl border border-border/40 overflow-hidden">
              <div className="px-3 py-2 bg-muted/40 flex items-center justify-between">
                <span className="text-xs font-bold">{r.nome || r.refeicao || `Refeição ${ri + 1}`}</span>
                {(r.horario || r.hora) && <span className="text-[10px] text-muted-foreground">{r.horario || r.hora}</span>}
              </div>
              <div className="p-2.5 space-y-1">
                {itens.map((it: any, ii: number) => (
                  <div key={ii} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-foreground truncate">{it.alimento || it.nome || String(it)}</span>
                    <span className="text-muted-foreground whitespace-nowrap shrink-0">
                      {[it.porcao || it.porção, it.kcal && `${it.kcal} kcal`].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

