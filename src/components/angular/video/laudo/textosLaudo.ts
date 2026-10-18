import type { IdProtocolo } from '@/lib/angular/movimento/tipos';

export const AVISO_BETA_LAUDO = 'Protótipo (beta) · apoio à avaliação do profissional · não é diagnóstico';

/** AAAA-MM-DD no fuso de São Paulo: o dia da análise não pode virar o dia seguinte por causa do UTC. */
export function hojeIso(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}

export const nomeArquivoLaudo = (protocolo: IdProtocolo, data: string): string => `laudo-${protocolo.replace(/_/g, '-')}-${data}.pdf`;
