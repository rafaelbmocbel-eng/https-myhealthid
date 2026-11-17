import { INSTANTE_DA_DATA_EXPLICITA_DO_DIAGNOSTICO } from './tipos';
import type { DataDoMarco } from './tipos';

// Regra de data da linha do tempo: só vira data o que o registro traz como data de verdade.
// "hoje" entra sempre como parâmetro ("AAAA-MM-DD", dia do Brasil) para a regra ser testável e sem relógio escondido.

const ANO_MINIMO = 1900;
const SO_ANO = /^\d{4}$/;
const SO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
// created_at e updated_at chegam do PostgREST como "2026-10-07T23:59:18.123456+00:00".
const DATA_E_HORA = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/;

const diaNoBrasil = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const anoDe = (hoje: string) => Number(hoje.slice(0, 4));

function diaExiste(ano: number, mes: number, dia: number): boolean {
  if (mes < 1 || mes > 12 || dia < 1) return false;
  return dia <= new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/**
 * Ano digitado pelo cliente (cirurgia): só vale exatamente 4 dígitos, de 1900 até o ano de hoje.
 * Aceita número ou texto com espaços nas pontas. "2O22", "há 2 anos", "20", "2099", "2022-13" ficam de fora.
 */
export function anoDoHistorico(valor: unknown, hoje: string): DataDoMarco | null {
  let texto: string;
  if (typeof valor === 'number') texto = String(valor);
  else if (typeof valor === 'string') texto = valor.trim();
  else return null;
  if (!SO_ANO.test(texto)) return null;
  const ano = Number(texto);
  if (ano < ANO_MINIMO || ano > anoDe(hoje)) return null;
  return { iso: texto, precisao: 'ano' };
}

/**
 * Data de uma coluna de tabela (data_evento, data_diagnostico, created_at...). Rejeita "0000-00-00", dia que não existe,
 * ano antes de 1900 e data depois de hoje. Instante com fuso (created_at) vira o dia no Brasil, não o dia em UTC.
 */
export function dataDeTabela(valor: unknown, hoje: string): DataDoMarco | null {
  if (typeof valor !== 'string') return null;
  const texto = valor.trim();
  let iso: string;
  const soData = SO_DATA.exec(texto);
  if (soData) {
    iso = texto;
  } else {
    const m = DATA_E_HORA.exec(texto);
    if (!m) return null;
    const [, , , , hora, minuto, segundo, fuso] = m;
    if (Number(hora) > 23 || Number(minuto) > 59 || Number(segundo ?? 0) > 59) return null;
    if (fuso) {
      const instante = new Date(texto.replace(' ', 'T'));
      if (Number.isNaN(instante.getTime())) return null;
      iso = diaNoBrasil.format(instante);
    } else {
      iso = texto.slice(0, 10);
    }
  }
  const [ano, mes, dia] = iso.split('-').map(Number);
  if (ano < ANO_MINIMO || !diaExiste(ano, mes, dia)) return null;
  if (iso > hoje) return null;
  return { iso, precisao: 'dia' };
}

/**
 * Dias em que um instante cai, em UTC e no Brasil (vazio se não for uma data e hora válida). O DEFAULT CURRENT_DATE do
 * banco usa o fuso do banco (UTC), então a data que ele preenche sozinho pode ser o dia de UTC ou o do Brasil.
 */
function diasDoInstante(valor: unknown, hoje: string): string[] {
  const noBrasil = dataDeTabela(valor, hoje);
  if (!noBrasil) return [];
  const texto = String(valor).trim();
  // O PostgREST sempre manda o fuso; sem ele não há como saber o dia em UTC, e vale o dia escrito.
  const emUtc = DATA_E_HORA.exec(texto)?.[7] ? new Date(texto.replace(' ', 'T')).toISOString().slice(0, 10) : noBrasil.iso;
  return [...new Set([noBrasil.iso, emUtc])];
}

/**
 * Coluna `date DEFAULT CURRENT_DATE` que o app não enviava antes do corte (diagnosticos_paciente.data_diagnostico): quando
 * o valor é o dia do cadastro (created_at), em UTC ou no Brasil, não dá para provar que alguém o informou. Se created_at
 * não for uma data e hora válida, não há com o que comparar e a data não é descartada. Esta função só compara os dias; quem
 * decide se a linha é anterior ao corte é `dataDoDiagnosticoPodeSerDoSistema`.
 */
export function coincideComODiaDoCadastro(data: unknown, criadoEm: unknown, hoje: string): boolean {
  if (typeof data !== 'string') return false;
  const dia = data.trim();
  return SO_DATA.test(dia) && diasDoInstante(criadoEm, hoje).includes(dia);
}

const CORTE_DA_DATA_EXPLICITA = Date.parse(INSTANTE_DA_DATA_EXPLICITA_DO_DIAGNOSTICO);

/**
 * A linha foi criada a partir do instante em que o app passou a enviar data_diagnostico (data ou null): o banco não
 * preencheu nada sozinho. Só vale com created_at válido e COM fuso (é o fuso que dá o instante exato); sem isso a linha é
 * tratada como antiga, que é o lado cauteloso (a data coincidente fica em "Sem data").
 */
export function criadaComADataExplicita(criadoEm: unknown, hoje: string): boolean {
  if (!dataDeTabela(criadoEm, hoje)) return false;
  const texto = String(criadoEm).trim();
  if (!DATA_E_HORA.exec(texto)?.[7]) return false;
  return new Date(texto.replace(' ', 'T')).getTime() >= CORTE_DA_DATA_EXPLICITA;
}

/**
 * A data do diagnóstico pode ter sido preenchida pelo banco, e não por quem cadastrou: é a do dia do cadastro e a linha é
 * anterior ao corte. Depois do corte o valor é do profissional, mesmo igual ao dia do cadastro.
 */
export function dataDoDiagnosticoPodeSerDoSistema(data: unknown, criadoEm: unknown, hoje: string): boolean {
  return !criadaComADataExplicita(criadoEm, hoje) && coincideComODiaDoCadastro(data, criadoEm, hoje);
}

/**
 * Data digitada num campo de data ("AAAA-MM-DD"): precisa existir, ser de 1900 em diante e não ser depois de hoje, a mesma
 * régua da linha do tempo, para o que se grava nunca cair em "data inválida" ali. Devolve a frase do erro, ou null se vale.
 */
export function erroDaDataDigitada(valor: string, hoje: string): string | null {
  if (SO_DATA.test(valor) && dataDeTabela(valor, hoje)) return null;
  return 'Data inválida: não pode ser no futuro nem antes de 1900.';
}

export const anoDaData = (data: DataDoMarco): string => data.iso.slice(0, 4);

/** "2022" quando só o ano é conhecido; "07/10/2026" quando é o dia. */
export function formatarData(data: DataDoMarco): string {
  if (data.precisao === 'ano') return data.iso;
  const [ano, mes, dia] = data.iso.split('-');
  return `${dia}/${mes}/${ano}`;
}
