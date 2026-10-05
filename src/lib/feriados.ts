// Feriados nacionais BR (fixos + móveis) para gerar a agenda de sessões CASSI só
// em dias úteis. Cobre 2024–2027 (móveis dependem da Páscoa, então ficam listados).

// Feriados FIXOS (mesmo dia todo ano). Consciência Negra (20/11) é nacional desde 2024.
const FIXOS: Record<string, string> = {
  '01-01': 'Confraternização Universal', '04-21': 'Tiradentes', '05-01': 'Dia do Trabalho', '09-07': 'Independência',
  '10-12': 'Nossa Senhora Aparecida', '11-02': 'Finados', '11-15': 'Proclamação da República', '11-20': 'Consciência Negra', '12-25': 'Natal',
};

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano).
function pascoa(ano: number): Date {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

const FERIADOS = new Map<string, string>();
// Móveis: Carnaval (terça), Sexta-feira Santa e Corpus Christi, calculados pela Páscoa.
for (let ano = 2024; ano <= 2040; ano++) {
  const p = pascoa(ano);
  const desloca = (dias: number) => iso(new Date(p.getFullYear(), p.getMonth(), p.getDate() + dias));
  FERIADOS.set(desloca(-47), 'Carnaval');
  FERIADOS.set(desloca(-2), 'Sexta-feira Santa');
  FERIADOS.set(desloca(60), 'Corpus Christi');
  for (const [mmdd, nome] of Object.entries(FIXOS)) FERIADOS.set(`${ano}-${mmdd}`, nome);
}

/** Datas extras (feriado municipal, recesso) em 'YYYY-MM-DD', que também não contam como dia útil. */
export type DatasExtras = ReadonlySet<string>;

export function nomeFeriado(d: Date): string | null {
  return FERIADOS.get(iso(d)) ?? null;
}

export function ehFeriado(d: Date, extras?: DatasExtras): boolean {
  return FERIADOS.has(iso(d)) || !!extras?.has(iso(d));
}

// Dia útil = seg–sex e não feriado.
export function ehDiaUtil(d: Date, extras?: DatasExtras): boolean {
  const dow = d.getDay(); // 0=dom, 6=sáb
  return dow !== 0 && dow !== 6 && !ehFeriado(d, extras);
}

// Gera `quantidade` datas de sessão a partir de `inicio`, apenas em dias úteis e
// nos dias da semana escolhidos (default seg–sex = [1,2,3,4,5]). Retorna Date[]
// com hora zerada — quem chama define o horário do atendimento.
export function gerarDatasSessoes(
  inicio: Date,
  quantidade: number,
  diasSemana: number[] = [1, 2, 3, 4, 5],
  extras?: DatasExtras,
): Date[] {
  const datas: Date[] = [];
  const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  let guarda = 0; // trava de segurança contra loop infinito
  while (datas.length < quantidade && guarda < 2000) {
    guarda++;
    if (diasSemana.includes(cursor.getDay()) && ehDiaUtil(cursor, extras)) {
      datas.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return datas;
}

// N-ésimo dia útil ESTRITAMENTE após `inicioISO` (YYYY-MM-DD). Usado no CASSI:
// a próxima guia (2/mês) é pedida no 10º dia útil após o PEDIDO da guia atual.
// Retorna 'YYYY-MM-DD' ou null se a data de entrada for inválida.
export function diaUtilApos(inicioISO: string, n: number): string | null {
  if (!inicioISO || n <= 0) return null;
  const base = new Date(`${inicioISO.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(base.getTime())) return null;
  const dia1 = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1);
  const datas = gerarDatasSessoes(dia1, n, [1, 2, 3, 4, 5]);
  const ult = datas[datas.length - 1];
  return ult ? iso(ult) : null;
}

export interface DiaCalculado { iso: string; semana: string; rotulo: 'avaliacao' | 'sessao'; numero: number }
export interface DiaPulado { iso: string; semana: string; motivo: string }
export interface ResultadoDiasUteis { dias: DiaCalculado[]; pulados: DiaPulado[]; inicioISO: string | null; fimISO: string | null }

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/**
 * Datas de uma guia CASSI em dias úteis (seg–sex, sem feriado).
 * `sentido: 'adiante'` (padrão) conta a partir da data (o dia em que a guia foi autorizada); `'atras'` conta
 * para trás, terminando na data (útil para lançar guia antiga). As datas saem sempre em ordem crescente.
 * `contarDiaAutorizacao`: a própria data entra como 1º dia, se for útil; senão a contagem começa no dia vizinho.
 * `comAvaliacao`: soma um dia extra (o mais antigo) para a avaliação (144); as `quantidade` sessões vêm depois.
 */
export function calcularDiasUteisGuia(opts: {
  autorizacaoISO: string;
  quantidade: number;
  contarDiaAutorizacao?: boolean;
  comAvaliacao?: boolean;
  sentido?: 'adiante' | 'atras';
  extras?: DatasExtras;
}): ResultadoDiasUteis | null {
  const { autorizacaoISO, quantidade, contarDiaAutorizacao = true, comAvaliacao = false, sentido = 'adiante', extras } = opts;
  const base = new Date(`${autorizacaoISO.slice(0, 10)}T00:00:00`);
  if (!autorizacaoISO || Number.isNaN(base.getTime()) || quantidade <= 0 || quantidade > 400) return null;
  const passo = sentido === 'atras' ? -1 : 1;
  const cursor = new Date(base.getFullYear(), base.getMonth(), base.getDate() + (contarDiaAutorizacao ? 0 : passo));
  const total = quantidade + (comAvaliacao ? 1 : 0);
  const achados: string[] = [];
  const pulados: DiaPulado[] = [];
  let guarda = 0;
  while (achados.length < total && guarda < 2000) {
    guarda++;
    const dow = cursor.getDay();
    if (dow === 0 || dow === 6) {
      pulados.push({ iso: iso(cursor), semana: SEMANA[dow], motivo: dow === 0 ? 'domingo' : 'sábado' });
    } else if (ehFeriado(cursor, extras)) {
      pulados.push({ iso: iso(cursor), semana: SEMANA[dow], motivo: nomeFeriado(cursor) ?? 'feriado local' });
    } else {
      achados.push(iso(cursor));
    }
    cursor.setDate(cursor.getDate() + passo);
  }
  if (sentido === 'atras') { achados.reverse(); pulados.reverse(); }
  const dias: DiaCalculado[] = achados.map((d, i) => {
    const aval = comAvaliacao && i === 0;
    return { iso: d, semana: SEMANA[new Date(`${d}T00:00:00`).getDay()], rotulo: aval ? 'avaliacao' : 'sessao', numero: aval ? 0 : i + (comAvaliacao ? 0 : 1) };
  });
  return { dias, pulados, inicioISO: dias.length ? dias[0].iso : null, fimISO: dias.length ? dias[dias.length - 1].iso : null };
}
