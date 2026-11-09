import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, X } from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/components/AppLayout';
import { PacienteSelect } from '@/components/paciente/PacienteSelect';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import CartaoConexao from '@/components/emg/CartaoConexao';
import DadosRecebidos from '@/components/emg/DadosRecebidos';
import IdentificacaoCanal from '@/components/emg/IdentificacaoCanal';
import ProtocoloGuiado from '@/components/emg/ProtocoloGuiado';
import ResultadoSessao from '@/components/emg/ResultadoSessao';
import SalvarExame from '@/components/emg/SalvarExame';
import SinalAoVivo from '@/components/emg/SinalAoVivo';
import { ControladorEmg } from '@/components/emg/controlador';
import type { Demonstracao } from '@/components/emg/demonstracao';
import { dataLocalISO, nomeParaArquivo } from '@/components/emg/desenho';
import { AJUSTES_PADRAO, fabricaPadrao, type AjustesDoModulo, type FabricaDoModulo } from '@/components/emg/fabrica';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { baixarBlob } from '@/lib/pdf/entrega';
import type { ModuloEmg, StatusModulo } from '@/lib/emg/moduloEmg';
import {
  csvDoSinal,
  laudoTexto,
  paraGravar,
  resumirSessao,
  resumoCurto,
  rotuloDoCanal,
  type CanalEmg,
  type LadoCanal,
  type ResultadoEtapa,
  type ResumoSessao,
  type TipoEtapa,
} from '@/lib/emg/sessao';

/** Suba quando mudar o texto do laudo ou o formato de `dados` do exame. */
const VERSAO_LAUDO = 1;

const CANAL_BASE: CanalEmg = { id: '1', musculo: '', lado: '-' };
const INTERVALO_LEITURA_MS = 500;

const AVISO_CONEXAO_CAIU =
  'A conexão com o módulo caiu durante a etapa. A etapa foi descartada: refaça quando a conexão voltar.';

interface PacienteDaLista {
  id: string;
  nome: string;
  sobrenome: string | null;
}

interface RespostaBanco<T> {
  data: T | null;
  error: { message: string } | null;
}

// O cliente do Supabase não conhece estas tabelas nos tipos gerados: este é o recorte que a tela usa.
interface BancoDaTela {
  from(tabela: 'pacientes'): {
    select(colunas: string): {
      eq(coluna: string, valor: unknown): {
        eq(coluna: string, valor: unknown): { order(coluna: string): { limit(n: number): PromiseLike<RespostaBanco<PacienteDaLista[]>> } };
      };
    };
  };
  from(tabela: 'exames_presenciais'): {
    insert(linha: Record<string, unknown>): { select(colunas: string): { single(): PromiseLike<RespostaBanco<{ id?: string }>> } };
  };
}

const banco = supabase as unknown as BancoDaTela;

interface LeituraDoModulo {
  taxaHz: number | null;
  taxaAssumida: boolean;
  bateriaPct: number | null;
  /** Já chegou pelo menos um lote de amostras: só então dá para gravar etapas. */
  temSinal: boolean;
}

const LEITURA_VAZIA: LeituraDoModulo = { taxaHz: null, taxaAssumida: false, bateriaPct: null, temSinal: false };

/** As etapas gravadas como a tela as vê: troca só quando o controlador avisa, então não há recálculo à toa. */
interface FotoDasEtapas {
  etapas: readonly ResultadoEtapa[];
  fsHz: number | null;
  /** O sinal veio da demonstração (simulado): serve para ver a tela, não vai para o prontuário. */
  demonstracao: boolean;
}

const FOTO_VAZIA: FotoDasEtapas = { etapas: [], fsHz: null, demonstracao: false };
const STATUS_DESCONECTADO: StatusModulo = { estado: 'desconectado' };

/** Tudo o que o exame leva, como foi (ou será) enviado: "Salvo" só vale enquanto a tela ainda mostra exatamente isto. */
interface InsumosDoExame {
  pacienteId: string;
  /** O rótulo do canal (músculo e lado) vai dentro do resumo. */
  resumo: ResumoSessao;
  observacoes: string;
  visivelAoCliente: boolean;
  etapas: readonly ResultadoEtapa[];
  fsHz: number;
}

// As etapas são comparadas por identidade: o controlador só troca os objetos quando o conteúdo muda.
function mesmosInsumos(a: InsumosDoExame, b: InsumosDoExame): boolean {
  return (
    a.pacienteId === b.pacienteId &&
    a.resumo.canal.musculo === b.resumo.canal.musculo &&
    a.resumo.canal.lado === b.resumo.canal.lado &&
    a.observacoes === b.observacoes &&
    a.visivelAoCliente === b.visivelAoCliente &&
    a.fsHz === b.fsHz &&
    a.etapas.length === b.etapas.length &&
    a.etapas.every((e, i) => e === b.etapas[i])
  );
}

function mensagemDe(erro: unknown): string {
  if (erro instanceof Error) return erro.message;
  if (erro && typeof erro === 'object' && 'message' in erro && typeof erro.message === 'string') return erro.message;
  return String(erro);
}

interface Props {
  /** Só os testes passam: troca o Bluetooth (e a demonstração) por um módulo de mentira. */
  fabrica?: FabricaDoModulo;
}

/**
 * Eletromiografia de superfície com o módulo Bluetooth RunE W2 (profissional, plano pago, módulo
 * "aplicacoes"). Medida de apoio: a tela mostra e guarda o sinal; a interpretação é do profissional.
 */
export default function Eletromiografia({ fabrica = fabricaPadrao }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [sp, setSp] = useSearchParams();
  const pacienteIdDaUrl = sp.get('paciente') || '';

  const [controlador] = useState(() => new ControladorEmg());
  const [modulo, setModulo] = useState<ModuloEmg | null>(null);
  const [modo, setModo] = useState<'real' | 'demo' | null>(null);
  const [status, setStatus] = useState<StatusModulo>(STATUS_DESCONECTADO);
  const [conectando, setConectando] = useState(false);
  const [erroConexao, setErroConexao] = useState<string | null>(null);
  const [leitura, setLeitura] = useState<LeituraDoModulo>(LEITURA_VAZIA);
  const [foto, setFoto] = useState<FotoDasEtapas>(FOTO_VAZIA);
  const [avisoEtapa, setAvisoEtapa] = useState<string | null>(null);
  const [musculo, setMusculo] = useState('');
  const [lado, setLado] = useState<LadoCanal>('-');
  const [observacoes, setObservacoes] = useState('');
  const [visivelAoCliente, setVisivelAoCliente] = useState(false);
  const [salvoCom, setSalvoCom] = useState<InsumosDoExame | null>(null);
  const [ajustes, setAjustes] = useState<AjustesDoModulo>(AJUSTES_PADRAO);
  const [ajustesEmUso, setAjustesEmUso] = useState<AjustesDoModulo | null>(null);

  const moduloRef = useRef<ModuloEmg | null>(null);
  const demonstracaoRef = useRef<Demonstracao | null>(null);
  const inscricoesRef = useRef<Array<() => void>>([]);
  const ativoRef = useRef(true);
  const etapasSaoDemoRef = useRef(false);
  /** Sobe a cada nova tentativa e a cada desconexão: respostas atrasadas de tentativas antigas são ignoradas. */
  const tentativaRef = useRef(0);

  // ── Pacientes ────────────────────────────────────────────────────────────
  const terapeutaId = user?.id;
  const { data: pacientes = [], isLoading: carregandoPacientes } = useQuery({
    queryKey: ['emg-pacientes', terapeutaId],
    enabled: !!terapeutaId,
    queryFn: async () => {
      if (!terapeutaId) return [];
      const { data } = await banco.from('pacientes').select('id, nome, sobrenome').eq('terapeuta_id', terapeutaId).eq('ativo', true).order('nome').limit(1000);
      return data ?? [];
    },
  });
  // Só vale paciente que está na lista do profissional: o id da URL sozinho não basta.
  const paciente = pacientes.find((p) => p.id === pacienteIdDaUrl) ?? null;
  const pacienteId = paciente ? paciente.id : '';
  const nomeDoPaciente = paciente ? `${paciente.nome} ${paciente.sobrenome ?? ''}`.trim() : null;

  const escolherPaciente = (id: string): void => {
    const novo = new URLSearchParams(sp);
    if (id) novo.set('paciente', id);
    else novo.delete('paciente');
    setSp(novo, { replace: true });
  };

  // ── Ciclo de vida do módulo ──────────────────────────────────────────────
  /** Solta o módulo, a demonstração e as inscrições, sem mexer no estado da tela (serve também ao desmontar). */
  const liberarModulo = useCallback((): void => {
    tentativaRef.current++;
    for (const cancelar of inscricoesRef.current) cancelar();
    inscricoesRef.current = [];
    const m = moduloRef.current;
    const demo = demonstracaoRef.current;
    moduloRef.current = null;
    demonstracaoRef.current = null;
    try {
      m?.desconectar();
    } catch (erro) {
      console.error('[eletromiografia] falha ao desconectar o módulo', erro);
    }
    demo?.encerrar();
    controlador.cancelarEtapa();
  }, [controlador]);

  useEffect(() => {
    ativoRef.current = true;
    return () => {
      ativoRef.current = false;
      liberarModulo();
      controlador.destruir();
    };
  }, [controlador, liberarModulo]);

  // O controlador avisa quando uma etapa muda; a demonstração reage à fase (o paciente virtual contrai ou relaxa).
  useEffect(
    () =>
      controlador.ouvir((ev) => {
        if (ev.tipo === 'etapa-finalizada') {
          etapasSaoDemoRef.current = demonstracaoRef.current !== null;
        } else if (ev.tipo === 'etapas-mudaram') {
          if (controlador.etapas.length === 0) etapasSaoDemoRef.current = false;
          setFoto({ etapas: controlador.etapas, fsHz: controlador.fsSessao, demonstracao: etapasSaoDemoRef.current });
        } else if (ev.tipo === 'aviso') {
          setAvisoEtapa(ev.texto);
        } else if (ev.tipo === 'fase') {
          if (ev.fase !== 'parada') setAvisoEtapa(null);
          demonstracaoRef.current?.aoFase(ev.fase, ev.etapa, ev.numero);
        }
      }),
    [controlador],
  );

  // Taxa, bateria e a vigia de "o sinal parou de chegar": 2 vezes por segundo, só enquanto há módulo.
  useEffect(() => {
    if (!modulo) {
      setLeitura(LEITURA_VAZIA);
      return;
    }
    const ler = (): void => {
      const nova: LeituraDoModulo = {
        taxaHz: modulo.taxaHz,
        taxaAssumida: modulo.taxaAssumida,
        bateriaPct: modulo.bateriaPct,
        temSinal: controlador.lotesRecebidos > 0,
      };
      setLeitura((a) =>
        a.taxaHz === nova.taxaHz && a.taxaAssumida === nova.taxaAssumida && a.bateriaPct === nova.bateriaPct && a.temSinal === nova.temSinal ? a : nova,
      );
      controlador.verificarSemDados();
    };
    ler();
    const id = setInterval(ler, INTERVALO_LEITURA_MS);
    return () => clearInterval(id);
  }, [modulo, controlador]);

  const iniciarConexao = async (qual: 'real' | 'demo'): Promise<void> => {
    if (conectando || status.estado !== 'desconectado') return;
    liberarModulo();
    // Etapas da demonstração não se misturam com as do módulo real (nem o contrário).
    if (controlador.etapas.length > 0 && (qual === 'demo') !== etapasSaoDemoRef.current) {
      controlador.reiniciarSessao('As etapas gravadas antes foram descartadas: você trocou entre a demonstração e o módulo real.');
    }
    const minha = ++tentativaRef.current;
    const valida = (): boolean => ativoRef.current && minha === tentativaRef.current;
    let falhou = false;
    setConectando(true);
    setErroConexao(null);
    setModo(qual);
    try {
      let m: ModuloEmg;
      if (qual === 'demo') {
        const demo = await fabrica.criarDemonstracao();
        if (!valida()) {
          demo.encerrar();
          demo.modulo.desconectar();
          return;
        }
        demonstracaoRef.current = demo;
        m = demo.modulo;
      } else {
        m = fabrica.criarReal(ajustes);
      }
      controlador.novaConexao();
      setAjustesEmUso(qual === 'real' ? ajustes : null);
      moduloRef.current = m;
      inscricoesRef.current = [
        m.onStatus((s) => {
          setStatus(s);
          if (s.estado === 'reconectando') controlador.cancelarEtapa(AVISO_CONEXAO_CAIU);
        }),
        m.onAmostras(controlador.aoAmostras),
      ];
      setStatus(m.status);
      setModulo(m);
      await m.conectar();
      if (!valida()) return;
      await m.iniciar();
    } catch (erro) {
      if (!valida()) return;
      falhou = true;
      setErroConexao(mensagemDe(erro));
      liberarModulo();
      setModulo(null);
      setStatus(STATUS_DESCONECTADO);
      setModo(null);
    } finally {
      // Depois de uma falha liberarModulo() já subiu a tentativa; fora isso, só quem é a tentativa atual mexe no estado.
      if (ativoRef.current && (falhou || minha === tentativaRef.current)) setConectando(false);
    }
  };

  const desconectar = (): void => {
    liberarModulo();
    setModulo(null);
    setModo(null);
    setStatus(STATUS_DESCONECTADO);
    setConectando(false);
  };

  // ── Protocolo ────────────────────────────────────────────────────────────
  const iniciarEtapa = (tipo: TipoEtapa): void => {
    try {
      controlador.iniciarEtapa(tipo);
    } catch (erro) {
      toast.error(mensagemDe(erro));
    }
  };

  const refazerEtapa = (tipo: TipoEtapa): void => {
    try {
      controlador.descartarParaRefazer(tipo);
      controlador.iniciarEtapa(tipo);
    } catch (erro) {
      toast.error(mensagemDe(erro));
    }
  };

  // ── Resultado ────────────────────────────────────────────────────────────
  const { etapas, fsHz: fsDaSessao, demonstracao: sessaoDemo } = foto;
  const canal = useMemo<CanalEmg>(() => ({ id: '1', musculo: musculo.trim(), lado }), [musculo, lado]);
  // A análise não depende do nome do músculo: calcula uma vez por mudança de etapas e só troca o rótulo ao digitar.
  const resumoBase = useMemo(
    () => (etapas.length > 0 && fsDaSessao !== null ? resumirSessao(etapas, fsDaSessao, CANAL_BASE) : null),
    [etapas, fsDaSessao],
  );
  const resumo = useMemo(() => (resumoBase ? { ...resumoBase, canal } : null), [resumoBase, canal]);

  const insumos = useMemo<InsumosDoExame | null>(
    () =>
      resumo && fsDaSessao !== null
        ? { pacienteId, resumo, observacoes: observacoes.trim(), visivelAoCliente, etapas, fsHz: fsDaSessao }
        : null,
    [resumo, fsDaSessao, pacienteId, observacoes, visivelAoCliente, etapas],
  );
  const salvo = salvoCom !== null && insumos !== null && mesmosInsumos(salvoCom, insumos);

  const salvar = useMutation({
    mutationFn: async (enviar: InsumosDoExame): Promise<string | undefined> => {
      if (!user) throw new Error('Sem sessão. Entre de novo para salvar.');
      if (!pacientes.some((p) => p.id === enviar.pacienteId)) throw new Error('Escolha o paciente para salvar no prontuário.');
      if (sessaoDemo) throw new Error('Os dados da demonstração são simulados e não podem ser salvos no prontuário.');
      const { resumo: r, etapas: etapasEnviadas, fsHz, observacoes: texto } = enviar;
      const analise = paraGravar(r, etapasEnviadas, fsHz, r.canal, texto);
      const { data, error } = await banco
        .from('exames_presenciais')
        .insert({
          paciente_id: enviar.pacienteId,
          terapeuta_id: user.id,
          tipo: 'eletromiografia',
          data_exame: dataLocalISO(),
          dados: {
            resultado: laudoTexto(r, r.canal),
            observacoes: texto || undefined,
            analise,
            versao_laudo: VERSAO_LAUDO,
          },
          resumo: resumoCurto(r, r.canal),
          visivel_paciente: enviar.visivelAoCliente,
        })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      return data?.id;
    },
    onSuccess: (_id, enviado) => {
      toast.success('Eletromiografia salva nos exames presenciais do paciente');
      setSalvoCom(enviado);
      void qc.invalidateQueries({ queryKey: ['exames-presenciais', enviado.pacienteId] });
    },
    onError: (erro: unknown) => toast.error(mensagemDe(erro) || 'Não consegui salvar o exame.'),
  });

  const aoSalvar = (): void => {
    if (!insumos) {
      toast.error('Grave pelo menos uma etapa antes de salvar.');
      return;
    }
    salvar.mutate(insumos);
  };

  const novaMedida = (): void => {
    controlador.reiniciarSessao();
    setObservacoes('');
    setSalvoCom(null);
    setAvisoEtapa(null);
  };

  const baixarCsv = (): void => {
    if (fsDaSessao === null) return;
    const csv = csvDoSinal(etapas, fsDaSessao);
    if (csv === '') {
      toast.error('Não há sinal gravado para baixar.');
      return;
    }
    const nome = nomeParaArquivo(rotuloDoCanal(canal)) || 'sinal';
    try {
      baixarBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `emg-${nome}-${dataLocalISO()}.csv`);
    } catch (erro) {
      toast.error(`Não consegui baixar o arquivo: ${mensagemDe(erro)}`);
    }
  };

  const lendo = status.estado === 'adquirindo';
  const pronto = lendo && leitura.taxaHz !== null && leitura.temSinal;
  const temBluetooth = fabrica.temBluetooth();

  return (
    <AppLayout>
      <div className="container max-w-5xl space-y-4 px-1 py-4 sm:space-y-5 sm:px-6 sm:py-6">
        <PageHeader
          back="/aplicacoes"
          title="Eletromiografia"
          subtitle="Atividade elétrica do músculo com o módulo Bluetooth: repouso, contração máxima e tarefa."
          icon={<Activity className="icon-md" />}
        />

        <Card className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-4">
          <p className="shrink-0 text-sm font-medium">
            Paciente <span className="text-xs font-normal text-muted-foreground">(para salvar no prontuário)</span>
          </p>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="min-w-0 flex-1">
              <PacienteSelect pacientes={pacientes.map((p) => ({ ...p, sobrenome: p.sobrenome ?? undefined }))} value={pacienteId} onValueChange={escolherPaciente} placeholder="Escolher o paciente…" />
              {pacienteIdDaUrl !== '' && !paciente && !carregandoPacientes && (
                <p className="mt-1.5 text-xs text-amber-800 dark:text-amber-300" data-testid="paciente-nao-encontrado">
                  O paciente do link não está na sua lista de pacientes ativos. Escolha o paciente acima.
                </p>
              )}
            </div>
            {pacienteId && (
              <Button type="button" variant="ghost" size="icon" aria-label="Tirar paciente" onClick={() => escolherPaciente('')}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </Card>

        <CartaoConexao
          status={status}
          modo={modo}
          conectando={conectando}
          temBluetooth={temBluetooth}
          mensagemSemBluetooth={fabrica.mensagemSemBluetooth()}
          taxaHz={leitura.taxaHz}
          taxaAssumida={leitura.taxaAssumida}
          bateriaPct={leitura.bateriaPct}
          erro={erroConexao ?? status.erro ?? null}
          buffer={controlador.bufferVivo}
          onConectar={() => void iniciarConexao('real')}
          onDemonstracao={() => void iniciarConexao('demo')}
          onDesconectar={desconectar}
        />

        <div className="grid gap-4 sm:gap-5 lg:grid-cols-2 lg:items-start">
          <div className="space-y-4 sm:space-y-5 lg:sticky lg:top-20">
            <IdentificacaoCanal
              musculo={musculo}
              lado={lado}
              onMusculo={setMusculo}
              onLado={setLado}
              travado={etapas.length > 0 || salvar.isPending}
              onNovaMedida={novaMedida}
              novaMedidaBloqueada={salvar.isPending}
            />
            <SinalAoVivo
              buffer={controlador.bufferVivo}
              fsHz={leitura.taxaHz}
              ativo={lendo}
              cvmUv={resumo?.cvmUv ?? null}
              estado={status.estado}
              conectando={conectando}
            />
          </div>
          <ProtocoloGuiado
            controlador={controlador}
            etapas={etapas}
            pronto={pronto}
            aviso={avisoEtapa}
            onIniciar={iniciarEtapa}
            onRefazer={refazerEtapa}
            onParar={() => controlador.finalizarTarefa()}
            onCancelar={() => controlador.cancelarEtapa()}
          />
        </div>

        {resumo && fsDaSessao !== null ? (
          <ResultadoSessao resumo={resumo} etapas={etapas} fsHz={fsDaSessao} />
        ) : (
          <Card className="p-3 text-sm text-muted-foreground sm:p-4">O resultado aparece aqui depois da primeira etapa gravada.</Card>
        )}

        <SalvarExame
          pacienteId={pacienteId}
          pacienteNome={nomeDoPaciente}
          carregandoPacientes={carregandoPacientes}
          temResultado={resumo !== null}
          demonstracao={sessaoDemo}
          observacoes={observacoes}
          onObservacoes={setObservacoes}
          visivelAoCliente={visivelAoCliente}
          onVisivelAoCliente={setVisivelAoCliente}
          salvando={salvar.isPending}
          salvo={salvo}
          onSalvar={aoSalvar}
          onBaixarCsv={baixarCsv}
        />

        <DadosRecebidos
          modulo={modulo}
          controlador={controlador}
          modo={modo}
          erro={erroConexao ?? status.erro ?? null}
          ajustes={ajustes}
          ajustesEmUso={ajustesEmUso}
          onAjustes={setAjustes}
          ajustesTravados={conectando || status.estado !== 'desconectado'}
        />

        <p className="text-xs leading-snug text-muted-foreground">
          Medida de apoio. Os valores em µV dependem de eletrodo, pele e posicionamento; compare, sempre que possível, em % da CVM do próprio paciente. A
          interpretação é do profissional.
        </p>
      </div>
    </AppLayout>
  );
}
