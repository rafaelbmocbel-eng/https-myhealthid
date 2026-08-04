// Feriados nacionais BR (fixos + móveis) para gerar a agenda de sessões CASSI só
// em dias úteis. Cobre 2024–2027 (móveis dependem da Páscoa, então ficam listados).

// Feriados MÓVEIS (Carnaval terça, Sexta-feira Santa, Corpus Christi) por ano.
const FERIADOS_MOVEIS: string[] = [
  // 2024
  '2024-02-13', '2024-03-29', '2024-05-30',
  // 2025
  '2025-03-04', '2025-04-18', '2025-06-19',
  // 2026
  '2026-02-17', '2026-04-03', '2026-06-04',
  // 2027
  '2027-02-09', '2027-03-26', '2027-05-27',
];

// Feriados FIXOS (mesmo dia todo ano). Consciência Negra (20/11) é nacional desde 2024.
const FIXOS_MMDD = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const FERIADOS = new Set<string>(FERIADOS_MOVEIS);
for (let ano = 2024; ano <= 2027; ano++) {
  for (const mmdd of FIXOS_MMDD) FERIADOS.add(`${ano}-${mmdd}`);
}

export function ehFeriado(d: Date): boolean {
  return FERIADOS.has(iso(d));
}

// Dia útil = seg–sex e não feriado.
export function ehDiaUtil(d: Date): boolean {
  const dow = d.getDay(); // 0=dom, 6=sáb
  return dow !== 0 && dow !== 6 && !ehFeriado(d);
}

// Gera `quantidade` datas de sessão a partir de `inicio`, apenas em dias úteis e
// nos dias da semana escolhidos (default seg/qua/sex = [1,3,5]). Retorna Date[]
// com hora zerada — quem chama define o horário do atendimento.
export function gerarDatasSessoes(
  inicio: Date,
  quantidade: number,
  diasSemana: number[] = [1, 3, 5],
): Date[] {
  const datas: Date[] = [];
  const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  let guarda = 0; // trava de segurança contra loop infinito
  while (datas.length < quantidade && guarda < 2000) {
    guarda++;
    if (diasSemana.includes(cursor.getDay()) && ehDiaUtil(cursor)) {
      datas.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return datas;
}
