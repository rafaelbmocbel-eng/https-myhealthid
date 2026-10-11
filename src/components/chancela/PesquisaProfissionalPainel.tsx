import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, Ban, CheckCircle2, ChevronDown, ChevronUp, CircleHelp, ExternalLink, Globe, Info, Loader2, Search, SearchX,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import type { ProfissionalAdmin } from '@/lib/chancela';
import {
  AVISO_INDICIO, ESCOPO_PESQUISA, INFO_NIVEL, MENSAGEM_NAO_CONSULTOU, ROTULO_CATEGORIA, avisoConselhoDiferente, conselhoEsperado,
  descreverConsulta, descreverErro, falhaDeConsulta, formatarDataHoraBR, hostDaUrl, linkBuscaConferencia, mensagemErroPesquisa, nomeParaBusca,
  textoDaFalha, tituloErroPesquisa, type NivelIndicio, type PesquisaProfissional, type ResumoPesquisaProfissional,
} from '@/lib/pesquisaProfissional';
import {
  CHAVE_PESQUISAS_RESUMO, ErroPesquisaProfissional, buscarUltimaPesquisaProfissional, chavePesquisaUltima, pesquisarProfissional,
} from '@/lib/pesquisaProfissionalApi';
import { cn } from '@/lib/utils';

// Pesquisa automática de UM profissional, dentro do cartão da administração. É só INDÍCIO: nada aqui
// verifica ninguém (o botão Verificar do cartão segue sendo uma decisão do administrador). O servidor
// valida as fontes e calcula o nível; esta tela mostra o que ele devolveu, com o trecho e o link da
// fonte, e sempre oferece o atalho para conferir no conselho por conta própria.

const ICONE_NIVEL: Record<NivelIndicio, LucideIcon> = {
  compativel: CheckCircle2,
  inconclusivo: CircleHelp,
  divergente: AlertTriangle,
  nao_encontrado: SearchX,
  nao_consultavel: Ban,
};

const QUEBRA_LONGA = '[overflow-wrap:anywhere]';

function SeloNivel({ nivel }: { nivel: NivelIndicio }) {
  const info = INFO_NIVEL[nivel];
  const Icone = ICONE_NIVEL[nivel];
  return (
    <Badge variant={info.variante} size="md">
      <Icone className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{info.rotulo}</span>
    </Badge>
  );
}

interface AtalhosProps {
  nome: string;
  perfil: string | null;
  registro: string | null;
  destaque: boolean;
}

function AtalhosConferencia({ nome, perfil, registro, destaque }: AtalhosProps) {
  const conselho = conselhoEsperado(perfil);
  const link = linkBuscaConferencia({ nome, perfil, registro });
  const aviso = avisoConselhoDiferente(perfil, registro);

  return (
    <div
      role="group"
      aria-label="Conferir no conselho"
      className={cn(
        'rounded-lg border p-2.5 space-y-2',
        destaque ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border/60 bg-background',
      )}
    >
      <p className="text-xs font-semibold">Conferir no conselho</p>
      {conselho && (
        <p className={cn('text-xs', QUEBRA_LONGA)}>
          Conselho esperado: <strong>{conselho.sigla}</strong> ({conselho.nome}).
        </p>
      )}
      {!conselho && (
        <p className="text-xs text-muted-foreground">O perfil profissional desta pessoa não define o conselho esperado.</p>
      )}
      {aviso && (
        <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
          <span>{aviso}</span>
        </p>
      )}
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({ variant: destaque ? 'default' : 'outline' }),
            'h-auto min-h-11 w-full whitespace-normal py-2 text-center sm:w-auto',
          )}
        >
          <Search aria-hidden />
          <span>Buscar no Google com o nome e o registro</span>
          <ExternalLink aria-hidden />
          <span className="sr-only">(abre em nova aba)</span>
        </a>
      )}
      <p className="text-[11px] text-muted-foreground">
        Abre a busca em outra aba. Procure a consulta pública do conselho e confira nome, número e situação do registro.
      </p>
    </div>
  );
}

function ResultadoPesquisa({ pesquisa }: { pesquisa: PesquisaProfissional }) {
  const naoConsultou = pesquisa.nivel === 'nao_consultavel';

  return (
    <div className="space-y-3">
      {!naoConsultou && <p className={cn('text-sm', QUEBRA_LONGA)}>{pesquisa.resumo ?? INFO_NIVEL[pesquisa.nivel].descricao}</p>}
      {pesquisa.rebaixado && (
        <p className="text-[11px] text-amber-700 dark:text-amber-300">
          O servidor classificou como compatível, mas nenhum achado de registro passou na conferência desta tela. Por segurança, mostro como inconclusivo.
        </p>
      )}

      <p className="flex items-start gap-1.5 rounded-md bg-muted/60 p-2 text-xs font-medium">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" aria-hidden />
        <span>{AVISO_INDICIO}</span>
      </p>

      {naoConsultou && (
        <div className="space-y-1 rounded-lg border border-primary bg-primary/5 p-2.5">
          <p className="text-sm font-semibold">{MENSAGEM_NAO_CONSULTOU}</p>
          <p className={cn('text-xs', QUEBRA_LONGA)}>{textoDaFalha(pesquisa.resumo)}</p>
          {pesquisa.erro && <p className={cn('text-[11px] text-muted-foreground', QUEBRA_LONGA)}>Motivo registrado: {descreverErro(pesquisa.erro)}</p>}
        </div>
      )}

      {pesquisa.achados.length > 0 && (
        <ul aria-label="Achados da pesquisa" className="space-y-2">
          {pesquisa.achados.map((a, i) => (
            <li key={`${a.fonteUrl}-${i}`} className="space-y-1.5 rounded-lg border border-border/60 bg-background p-2.5">
              <Badge variant="outline" size="sm">{ROTULO_CATEGORIA[a.categoria]}</Badge>
              {a.texto && <p className={cn('text-xs', QUEBRA_LONGA)}>{a.texto}</p>}
              <blockquote className={cn('border-l-2 border-border pl-2 text-xs italic text-muted-foreground', QUEBRA_LONGA)}>
                “{a.trecho}”
              </blockquote>
              <a
                href={a.fonteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn('inline-flex min-h-11 max-w-full items-center gap-1 py-1 text-xs text-primary underline underline-offset-2', QUEBRA_LONGA)}
              >
                <span>{hostDaUrl(a.fonteUrl)}</span>
                <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                <span className="sr-only">(abre em nova aba)</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {pesquisa.achados.length === 0 && !naoConsultou && (
        <p className="text-xs text-muted-foreground">Nenhum achado com fonte pública foi validado.</p>
      )}
    </div>
  );
}

function lerErro(erro: unknown): { codigo: string | null; mensagem: string } {
  if (erro instanceof ErroPesquisaProfissional) return { codigo: erro.codigo, mensagem: erro.message };
  return { codigo: null, mensagem: mensagemErroPesquisa(null, null) };
}

interface PainelProps {
  profissional: Pick<ProfissionalAdmin, 'userId' | 'nome' | 'email' | 'perfil' | 'registro'>;
  /** Último indício vindo do resumo da lista (uma chamada para todos); o conteúdo completo só carrega ao abrir. */
  resumo: ResumoPesquisaProfissional | null;
}

export default function PesquisaProfissionalPainel({ profissional, resumo }: PainelProps) {
  const qc = useQueryClient();
  const { userId, nome, email, perfil, registro } = profissional;
  const [aberto, setAberto] = useState(false);
  const chave = chavePesquisaUltima(userId);
  const painelId = `pesquisa-profissional-${userId}`;

  const ultima = useQuery({
    queryKey: chave,
    enabled: aberto,
    staleTime: 60_000,
    retry: false,
    queryFn: () => buscarUltimaPesquisaProfissional(userId),
  });

  const pesquisar = useMutation<PesquisaProfissional, Error, void>({
    mutationFn: () => pesquisarProfissional(userId),
    onSuccess: (pesquisa) => {
      qc.setQueryData(chave, pesquisa);
      setAberto(true);
      void qc.invalidateQueries({ queryKey: CHAVE_PESQUISAS_RESUMO });
    },
    onError: () => {
      // A edge grava também as falhas; o resumo e a última pesquisa podem ter mudado.
      void qc.invalidateQueries({ queryKey: CHAVE_PESQUISAS_RESUMO });
      void qc.invalidateQueries({ queryKey: chave });
    },
  });

  const pesquisaAtual = ultima.data ?? null;
  const nivelAtual = pesquisaAtual?.nivel ?? resumo?.nivel ?? null;
  const quandoAtual = pesquisaAtual?.pesquisadoEm ?? resumo?.pesquisadoEm ?? null;
  const quandoTexto = formatarDataHoraBR(quandoAtual);
  const temPesquisa = nivelAtual !== null;
  const pesquisando = pesquisar.isPending;
  const erro = pesquisar.isError ? lerErro(pesquisar.error) : null;
  const nomeBusca = nomeParaBusca(nome, email);

  const mostrarAtalhos = (aberto && pesquisaAtual !== null) || erro !== null;
  const destacarAtalho = (erro !== null && falhaDeConsulta(erro.codigo)) || (aberto && pesquisaAtual?.nivel === 'nao_consultavel');

  const botaoPesquisar = (rotulo: string) => (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-auto min-h-11 gap-1.5 px-4"
      disabled={pesquisando}
      onClick={() => pesquisar.mutate()}
    >
      {pesquisando ? <Loader2 className="animate-spin" aria-hidden /> : <Search aria-hidden />}
      {pesquisando ? 'Pesquisando…' : rotulo}
    </Button>
  );

  return (
    <section aria-labelledby={`${painelId}-titulo`} className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-2.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h3 id={`${painelId}-titulo`} className="flex items-center gap-1.5 text-xs font-semibold">
          <Globe className="h-3.5 w-3.5 text-primary" aria-hidden /> Pesquisa na internet
        </h3>
        {nivelAtual && <SeloNivel nivel={nivelAtual} />}
        {quandoTexto && (
          <span className="text-[11px] text-muted-foreground">
            Pesquisado em <time dateTime={quandoAtual ?? undefined}>{quandoTexto}</time>
          </span>
        )}
      </div>

      {!temPesquisa && (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">{ESCOPO_PESQUISA}</p>
          {!registro && (
            <p className="text-[11px] text-muted-foreground">
              Sem registro informado, a pesquisa usa só o nome e a profissão e, no máximo, indica &quot;Inconclusivo&quot;.
            </p>
          )}
          {botaoPesquisar('Pesquisar na internet')}
        </div>
      )}

      {temPesquisa && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-auto min-h-11 gap-1.5 px-3"
          aria-expanded={aberto}
          aria-controls={aberto ? painelId : undefined}
          onClick={() => setAberto((v) => !v)}
        >
          {aberto ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
          {aberto ? 'Ocultar pesquisa' : 'Ver pesquisa'}
        </Button>
      )}

      {pesquisando && (
        <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Pesquisando na internet. Pode levar até um minuto.
        </p>
      )}
      {pesquisar.isSuccess && aberto && <p role="status" className="sr-only">Pesquisa concluída. O resultado está logo abaixo.</p>}

      {erro && (
        <div role="alert" className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-2.5 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="text-sm font-semibold">{tituloErroPesquisa(erro.codigo)}</p>
          <p className={cn('text-xs', QUEBRA_LONGA)}>{erro.mensagem}</p>
        </div>
      )}

      {aberto && (
        <div id={painelId} className="space-y-3">
          {ultima.isLoading && (
            <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Carregando a última pesquisa…
            </p>
          )}
          {ultima.isError && (
            <p role="alert" className="text-xs text-red-700 dark:text-red-300">
              Não consegui carregar a última pesquisa. Feche e abra de novo, ou pesquise outra vez.
            </p>
          )}
          {ultima.isSuccess && pesquisaAtual === null && (
            <p className="text-xs text-muted-foreground">Nenhuma pesquisa registrada para esta pessoa ainda.</p>
          )}
          {pesquisaAtual && <ResultadoPesquisa pesquisa={pesquisaAtual} />}
        </div>
      )}

      {mostrarAtalhos && <AtalhosConferencia nome={nomeBusca} perfil={perfil} registro={registro} destaque={destacarAtalho} />}

      {aberto && (
        <div className="space-y-2">
          {pesquisaAtual && descreverConsulta(pesquisaAtual.consulta) && (
            <p className={cn('text-[11px] text-muted-foreground', QUEBRA_LONGA)}>
              Consulta usada: {descreverConsulta(pesquisaAtual.consulta)}
            </p>
          )}
          {botaoPesquisar('Pesquisar de novo')}
        </div>
      )}
    </section>
  );
}
