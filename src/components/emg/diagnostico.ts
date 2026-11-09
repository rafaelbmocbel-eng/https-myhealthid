// Texto do botão "Copiar" de "Ver dados recebidos": o que o Rafael manda ao desenvolvedor se algo não
// bater com o aparelho real. Função pura (recebe tudo pronto), para ser testada sem tela nem Bluetooth.

import type { EstatisticaDoSinal } from './controlador';

export interface DadosDoDiagnostico {
  geradoEm: Date;
  modo: 'real' | 'demonstracao' | null;
  ambiente: string;
  estado: string;
  nomeDoModulo: string | null;
  erro: string | null;
  taxaHz: number | null;
  taxaAssumida: boolean;
  taxaMedidaHz: number | null;
  /** Ajustes de teste em uso (rede elétrica e amostra-base); null na demonstração e sem conexão. */
  ajustes: { redeHz: number; incluirPrimeiraAmostra: boolean } | null;
  bateriaPct: number | null;
  hardware: string | null;
  versaoHw: string | null;
  versaoSw: string | null;
  quadrosRecebidos: number;
  quadrosInvalidos: number;
  bytesDescartados: number;
  lacunasSuspeitas: number;
  lotes: number;
  amostras: number;
  filtrado: EstatisticaDoSinal | null;
  bruto: EstatisticaDoSinal | null;
  quadrosHex: readonly string[];
  linhasDoServico: readonly string[];
  parametrosDaAnalise: unknown;
}

function dataHora(d: Date): string {
  const dois = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())} ${dois(d.getHours())}:${dois(d.getMinutes())}:${dois(d.getSeconds())}`;
}

function numero(v: number, casas = 2): string {
  return Number.isFinite(v) ? v.toFixed(casas) : String(v);
}

function linhaDoSinal(rotulo: string, e: EstatisticaDoSinal | null): string {
  if (!e) return `${rotulo}: sem amostras`;
  return `${rotulo}: ${e.amostras} amostras, média ${numero(e.media)}, RMS ${numero(e.rms)}, mínimo ${numero(e.min)}, máximo ${numero(e.max)}`;
}

const NOMES_DO_MODO = { real: 'módulo real', demonstracao: 'demonstração (sinal simulado)' } as const;

export function montarTextoDiagnostico(d: DadosDoDiagnostico): string {
  const linhas: string[] = [];
  linhas.push('My Health ID: diagnóstico do módulo EMG');
  linhas.push(`Gerado em: ${dataHora(d.geradoEm)} (horário local do aparelho)`);
  linhas.push(`Modo: ${d.modo === null ? 'nenhum' : NOMES_DO_MODO[d.modo]}`);
  linhas.push(`Aparelho: ${d.ambiente}`);
  linhas.push('');
  linhas.push(`Estado: ${d.estado}`);
  linhas.push(`Módulo: ${d.nomeDoModulo ?? 'não conectado'}`);
  if (d.erro) linhas.push(`Erro mostrado: ${d.erro}`);
  const origem = d.taxaHz === null ? '' : d.taxaAssumida ? ' (ASSUMIDA: o módulo não respondeu à leitura)' : ' (lida do módulo)';
  linhas.push(`Taxa de amostragem: ${d.taxaHz === null ? 'desconhecida' : `${d.taxaHz} Hz`}${origem}`);
  linhas.push(
    `Taxa medida (amostras por segundo de relógio): ${d.taxaMedidaHz === null ? 'ainda sem dados suficientes' : numero(d.taxaMedidaHz, 1)}`,
  );
  linhas.push(`Bateria: ${d.bateriaPct === null ? 'não informada' : `${d.bateriaPct} %`}`);
  if (d.ajustes) {
    linhas.push(
      `Ajustes de teste: rede elétrica de ${d.ajustes.redeHz} Hz · amostra-base do quadro bruto ${d.ajustes.incluirPrimeiraAmostra ? 'incluída (padrão)' : 'NÃO incluída'}`,
    );
  }
  linhas.push(`Tipo do módulo (0x1D): ${d.hardware ?? 'não informado'}`);
  linhas.push(`Versão de hardware: ${d.versaoHw ?? 'não informada'}`);
  linhas.push(`Versão de software: ${d.versaoSw ?? 'não informada'}`);
  linhas.push('');
  linhas.push(
    `Quadros recebidos: ${d.quadrosRecebidos} · inválidos: ${d.quadrosInvalidos} · bytes descartados: ${d.bytesDescartados} · lacunas suspeitas: ${d.lacunasSuspeitas}`,
  );
  linhas.push(`Lotes de amostras: ${d.lotes} · amostras: ${d.amostras}`);
  linhas.push(linhaDoSinal('Sinal filtrado (últimos 2 s)', d.filtrado));
  linhas.push(linhaDoSinal('Sinal bruto (últimos 2 s)', d.bruto));
  linhas.push('');
  linhas.push(`Parâmetros da análise: ${JSON.stringify(d.parametrosDaAnalise)}`);
  linhas.push('');
  linhas.push(`Últimos ${d.quadrosHex.length} quadros (hexadecimal, do mais antigo ao mais novo):`);
  if (d.quadrosHex.length === 0) linhas.push('(nenhum quadro recebido)');
  d.quadrosHex.forEach((hex, i) => linhas.push(`${String(i + 1).padStart(2, ' ')}. ${hex}`));
  linhas.push('');
  linhas.push('Diagnóstico do serviço:');
  if (d.linhasDoServico.length === 0) linhas.push('(sem linhas)');
  for (const linha of d.linhasDoServico) linhas.push(`- ${linha}`);
  return linhas.join('\n');
}
