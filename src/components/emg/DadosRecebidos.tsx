import { useEffect, useState } from 'react';
import { ChevronDown, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { rodandoNoAppNativo } from '@/lib/dinamometria/bleNativo';
import type { ModuloEmg } from '@/lib/emg/moduloEmg';
import { PARAMETROS_ANALISE } from '@/lib/emg/sessao';
import { cn } from '@/lib/utils';
import type { ControladorEmg } from './controlador';
import { montarTextoDiagnostico, type DadosDoDiagnostico } from './diagnostico';
import AjustesDoTeste from './AjustesDoTeste';
import { ROTULO_ESTADO } from './constantes';
import { numeroPt } from './desenho';
import type { AjustesDoModulo } from './fabrica';

const INTERVALO_MS = 1000;

interface Props {
  modulo: ModuloEmg | null;
  controlador: ControladorEmg;
  modo: 'real' | 'demo' | null;
  /** Texto de erro mostrado na tela, se houver (vai junto no diagnóstico). */
  erro: string | null;
  /** Ajustes escolhidos agora (valem na próxima conexão) e os que a conexão atual usou (null na demonstração e sem conexão). */
  ajustes: AjustesDoModulo;
  ajustesEmUso: AjustesDoModulo | null;
  onAjustes: (ajustes: AjustesDoModulo) => void;
  ajustesTravados: boolean;
}

function ambienteDoAparelho(): string {
  const agente = typeof navigator === 'undefined' ? 'sem navigator' : navigator.userAgent;
  return `${agente}${rodandoNoAppNativo() ? ' [app nativo]' : ''}`;
}

function Contador({ rotulo, valor, testid }: { rotulo: string; valor: number; testid: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2">
      <p className="text-[11px] leading-tight text-muted-foreground">{rotulo}</p>
      <p className="font-mono text-lg font-semibold tabular-nums" data-testid={testid}>
        {valor}
      </p>
    </div>
  );
}

/**
 * "Ver dados recebidos": o que o módulo mandou, em números e em hexadecimal. É o que se copia e se manda
 * ao desenvolvedor quando algo não bate com o aparelho real. Recolhido por padrão; só lê o módulo
 * enquanto está aberto.
 */
export default function DadosRecebidos({ modulo, controlador, modo, erro, ajustes, ajustesEmUso, onAjustes, ajustesTravados }: Props) {
  const [aberto, setAberto] = useState(false);
  const [, setRelogio] = useState(0);
  const [textoManual, setTextoManual] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    const id = setInterval(() => setRelogio((n) => n + 1), INTERVALO_MS);
    return () => clearInterval(id);
  }, [aberto]);

  const coletar = (): DadosDoDiagnostico => {
    const sinal = controlador.sinalRecente(2);
    const status = modulo?.status ?? { estado: 'desconectado' as const };
    return {
      geradoEm: new Date(),
      modo: modo === null ? null : modo === 'demo' ? 'demonstracao' : 'real',
      ambiente: ambienteDoAparelho(),
      estado: ROTULO_ESTADO[status.estado],
      nomeDoModulo: status.nome ?? null,
      erro: erro ?? status.erro ?? null,
      taxaHz: modulo?.taxaHz ?? null,
      taxaAssumida: modulo?.taxaAssumida ?? false,
      taxaMedidaHz: controlador.taxaMedidaHz(),
      ajustes: ajustesEmUso,
      bateriaPct: modulo?.bateriaPct ?? null,
      hardware: modulo?.hardware ?? null,
      versaoHw: modulo?.versaoHw ?? null,
      versaoSw: modulo?.versaoSw ?? null,
      quadrosRecebidos: modulo?.quadrosRecebidos ?? 0,
      quadrosInvalidos: modulo?.quadrosInvalidos ?? 0,
      bytesDescartados: modulo?.bytesDescartados ?? 0,
      lacunasSuspeitas: modulo?.lacunasSuspeitas ?? 0,
      lotes: controlador.lotesRecebidos,
      amostras: controlador.amostrasRecebidas,
      filtrado: sinal.filtrado,
      bruto: sinal.bruto,
      quadrosHex: modulo?.ultimosQuadrosHex ?? [],
      linhasDoServico: modulo?.diagnostico ?? [],
      parametrosDaAnalise: PARAMETROS_ANALISE,
    };
  };

  const copiar = async (): Promise<void> => {
    const texto = montarTextoDiagnostico(coletar());
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) throw new Error('Sem área de transferência');
      await navigator.clipboard.writeText(texto);
      setTextoManual(null);
      toast.success('Diagnóstico copiado. Cole na conversa com o desenvolvedor.');
    } catch {
      // Sem permissão ou sem a API de cópia (página sem https, navegador antigo): mostra o texto para copiar à mão.
      setTextoManual(texto);
      toast.error('Não consegui copiar sozinho. O texto está logo abaixo, para você selecionar e copiar.');
    }
  };

  const d = aberto ? coletar() : null;

  return (
    <Card className="p-3 sm:p-4">
      <Collapsible open={aberto} onOpenChange={setAberto}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex min-h-[2.75rem] w-full items-center justify-between gap-2 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span>Ver dados recebidos</span>
            <ChevronDown className={cn('icon-sm transition-transform motion-reduce:transition-none', aberto && 'rotate-180')} aria-hidden />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          <p className="text-xs text-muted-foreground">
            Para conferir o que o módulo está mandando. Se algo não bater com o aparelho, toque em Copiar e envie o texto ao desenvolvedor.
          </p>
          {d && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Contador rotulo="Quadros recebidos" valor={d.quadrosRecebidos} testid="contador-quadros" />
                <Contador rotulo="Quadros inválidos" valor={d.quadrosInvalidos} testid="contador-invalidos" />
                <Contador rotulo="Bytes descartados" valor={d.bytesDescartados} testid="contador-descartados" />
                <Contador rotulo="Lacunas suspeitas" valor={d.lacunasSuspeitas} testid="contador-lacunas" />
              </div>
              <p className="text-xs text-muted-foreground" data-testid="resumo-taxa">
                Taxa: {d.taxaHz === null ? 'desconhecida' : `${d.taxaHz} Hz${d.taxaAssumida ? ' (assumida)' : ''}`} · medida:{' '}
                {d.taxaMedidaHz === null ? 'aguardando dados' : `${numeroPt(d.taxaMedidaHz, 0)} amostras/s`} · lotes: {d.lotes}
              </p>
              <div>
                <p className="mb-1 text-xs font-semibold">Últimos {d.quadrosHex.length} quadros (hexadecimal)</p>
                <pre
                  className="max-h-56 overflow-auto rounded-lg bg-muted/50 p-2 font-mono text-[11px] leading-snug"
                  data-testid="quadros-hex"
                  tabIndex={0}
                  aria-label="Últimos quadros recebidos, em hexadecimal"
                >
                  {d.quadrosHex.length === 0 ? 'Nenhum quadro recebido ainda.' : d.quadrosHex.map((h) => `${h}\n`).join('')}
                </pre>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold">Diagnóstico do serviço</p>
                <ul className="max-h-48 space-y-0.5 overflow-auto rounded-lg bg-muted/50 p-2 font-mono text-[11px] leading-snug" data-testid="linhas-servico" tabIndex={0}>
                  {d.linhasDoServico.length === 0 && <li>Sem linhas.</li>}
                  {d.linhasDoServico.map((linha, i) => (
                    <li key={i} className="break-words">
                      {linha}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
          <AjustesDoTeste ajustes={ajustes} onChange={onAjustes} travados={ajustesTravados} />
          <Button type="button" variant="outline" className="h-11 w-full gap-1.5 sm:w-auto" onClick={() => void copiar()}>
            <Copy className="icon-sm" /> Copiar
          </Button>
          {textoManual !== null && (
            <textarea
              readOnly
              value={textoManual}
              rows={8}
              aria-label="Texto do diagnóstico para copiar"
              data-testid="diagnostico-manual"
              onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded-lg border border-border bg-background p-2 font-mono text-[11px]"
            />
          )}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
