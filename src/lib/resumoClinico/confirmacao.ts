import { anoDoHistorico, dataDeTabela, erroDaDataDigitada, formatarData, lerPrecisao } from './datas';
import { objetoOuJson, textoLimpo } from './leitura';
import type { CirurgiaLida } from './leitura';
import {
  CAMPO_CONFIRMACAO_CHAVE, CAMPO_CONFIRMACAO_ORIGEM, CAMPO_CONFIRMACAO_POR, CAMPO_CONFIRMACAO_PRECISAO, CAMPO_CONFIRMACAO_RELATO,
  CAMPO_CONFIRMACAO_VERSAO, FONTE_DA_CONFIRMACAO, FRASE_SO_O_ANO, LIMITE_DA_CHAVE_DE_CONFIRMACAO, LIMITE_DO_ANO_RELATADO,
  LIMITE_DO_RELATO_CONFIRMADO, ORIGEM_CONFIRMACAO, TIPOS_CONFIRMAVEIS, VERSAO_DA_CONFIRMACAO,
} from './tipos';
import type { LinhaBruta, PrecisaoDaData, RelatoDaCirurgia, TipoConfirmavel } from './tipos';

// Camada PURA da confirmação: monta a linha que o profissional grava e lê de volta a que já foi gravada. Quem grava é o hook
// próprio (src/hooks), fora desta pasta. Aqui não há relógio escondido: "hoje" entra sempre como parâmetro.

// ── SHA-256 ────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Escrito à mão porque a API de criptografia do navegador só existe em contexto seguro e muda entre WebViews; o resultado
// precisa ser idêntico em qualquer aparelho para o mesmo item cair sempre no mesmo id.
const CONSTANTES_DO_SHA256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const girar = (x: number, n: number) => (x >>> n) | (x << (32 - n));

/** SHA-256 do texto em UTF-8, em 64 letras hexadecimais minúsculas. */
export function sha256Hex(texto: string): string {
  const entrada = new TextEncoder().encode(texto);
  const tamanho = entrada.length;
  const total = Math.ceil((tamanho + 9) / 64) * 64;
  const bytes = new Uint8Array(total);
  bytes.set(entrada);
  bytes[tamanho] = 0x80;
  const visao = new DataView(bytes.buffer);
  visao.setUint32(total - 8, Math.floor(tamanho / 0x20000000));
  visao.setUint32(total - 4, (tamanho * 8) >>> 0);

  const h = Uint32Array.from([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  for (let inicio = 0; inicio < total; inicio += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = visao.getUint32(inicio + i * 4);
    for (let i = 16; i < 64; i += 1) {
      const s0 = girar(w[i - 15], 7) ^ girar(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = girar(w[i - 2], 17) ^ girar(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = w[i - 16] + s0 + w[i - 7] + s1;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i += 1) {
      const t1 = (hh + (girar(e, 6) ^ girar(e, 11) ^ girar(e, 25)) + ((e & f) ^ (~e & g)) + CONSTANTES_DO_SHA256[i] + w[i]) >>> 0;
      const t2 = ((girar(a, 2) ^ girar(a, 13) ^ girar(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] += a;
    h[1] += b;
    h[2] += c;
    h[3] += d;
    h[4] += e;
    h[5] += f;
    h[6] += g;
    h[7] += hh;
  }
  return Array.from(h, (palavra) => palavra.toString(16).padStart(8, '0')).join('');
}

/**
 * Id da linha da confirmação, sempre o mesmo para o mesmo profissional, paciente e item: a chave primária do banco passa a
 * ser a trava contra gravar duas vezes (duplo toque, duas abas). 128 bits do SHA-256 no formato 8-4-4-4-12, com a versão 4
 * e a variante 8 a b para a coluna uuid aceitar. O profissional entra na conta para uma confirmação de um não travar a de outro.
 */
export function idDaConfirmacao(terapeutaId: string, pacienteId: string, chave: string): string {
  const letras = sha256Hex(JSON.stringify([ORIGEM_CONFIRMACAO, terapeutaId, pacienteId, chave])).slice(0, 32).split('');
  letras[12] = '4';
  letras[16] = ((parseInt(letras[16], 16) & 0x3) | 0x8).toString(16);
  const h = letras.join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ── Impressão digital do relato e chave da confirmação ─────────────────────────────────────────────────────────────────
/**
 * Impressão digital do que o cliente escreveu: o relato só é trocado pelo confirmado se a de hoje for igual à guardada. O
 * cliente edita o próprio histórico a qualquer hora, e a chave sozinha não prova que o texto é o mesmo.
 */
export const impressaoDoRelato = (tipo: unknown, ano: unknown, complicacoes: unknown): string =>
  JSON.stringify([textoLimpo(tipo), textoLimpo(ano), textoLimpo(complicacoes)]);

export const impressaoDe = (relato: RelatoDaCirurgia): string => impressaoDoRelato(relato.tipo, relato.ano, relato.complicacoes);

// A chave do marco do cliente com id (marcos.ts) começa assim; as de reserva por posição são só números, nunca colidem.
const PREFIXO_DO_ID_ESTAVEL = 'historico_clinico:cirurgia:id:';

/**
 * Chave da confirmação de um item do cliente. Item com id (e o id aparecendo pela primeira vez) usa a mesma chave do marco.
 * Item sem id, ou com id repetido, usa a posição E um resumo do texto: se o cliente apagar um item acima, a posição muda e a
 * chave deixa de bater com a confirmação de outro item, em vez de esconder o relato errado.
 */
export function chaveDaConfirmacao(cirurgia: Pick<CirurgiaLida, 'indice' | 'tipo' | 'anoOriginal' | 'complicacoes'>, idDoMarco: string): string {
  if (idDoMarco.startsWith(PREFIXO_DO_ID_ESTAVEL)) return idDoMarco;
  const resumo = sha256Hex(impressaoDoRelato(cirurgia.tipo, cirurgia.anoOriginal, cirurgia.complicacoes)).slice(0, 16);
  return `historico_clinico:cirurgia:pos:${cirurgia.indice}:${resumo}`;
}

/** A chave vai para o metadata e para o id: até 200 caracteres e sem caractere de controle, senão o item não é confirmável. */
export function chaveConfirmavel(chave: unknown): chave is string {
  return typeof chave === 'string' && chave.length > 0 && chave.length <= LIMITE_DA_CHAVE_DE_CONFIRMACAO && !/\p{Cc}/u.test(chave);
}

// ── Leitura tolerante da confirmação já gravada ────────────────────────────────────────────────────────────────────────
export interface ConfirmacaoLida {
  // O uuid da linha: sem ele não há como desfazer, então a linha sem id não é tratada como confirmação.
  idDaLinha: string;
  chave: string;
  precisao: PrecisaoDaData;
  relato: RelatoDaCirurgia;
  por: string | null;
}

// Quem confirmou foi gravado como texto pelo app; número ou outro tipo ali é lixo, não um nome.
const soTexto = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * Lê a marca de confirmação de uma linha de historia_vida_paciente (pelos apelidos de useFontesClinicas). Qualquer coisa fora
 * do formato esperado (outra origem, outra versão, chave ruim, relato que não é texto) devolve null e a linha segue como um
 * registro comum do profissional: o relato do cliente nunca some por causa de uma marca que não deu para entender.
 */
export function lerConfirmacao(linha: LinhaBruta): ConfirmacaoLida | null {
  if (linha[CAMPO_CONFIRMACAO_ORIGEM] !== ORIGEM_CONFIRMACAO) return null;
  const versao = linha[CAMPO_CONFIRMACAO_VERSAO];
  if (versao !== VERSAO_DA_CONFIRMACAO && versao !== String(VERSAO_DA_CONFIRMACAO)) return null;
  const idDaLinha = textoLimpo(linha.id);
  const chave = linha[CAMPO_CONFIRMACAO_CHAVE];
  if (!idDaLinha || !chaveConfirmavel(chave)) return null;
  const relato = objetoOuJson(linha[CAMPO_CONFIRMACAO_RELATO]);
  if (!relato) return null;
  const { tipo, ano, complicacoes } = relato;
  if (typeof tipo !== 'string' || !tipo.trim() || typeof ano !== 'string' || typeof complicacoes !== 'string') return null;
  const por = objetoOuJson(linha[CAMPO_CONFIRMACAO_POR]);
  return {
    idDaLinha,
    chave,
    precisao: lerPrecisao(linha[CAMPO_CONFIRMACAO_PRECISAO]),
    relato: { tipo, ano, complicacoes },
    por: [soTexto(por?.nome), soTexto(por?.registro)].filter(Boolean).join(' · ') || null,
  };
}

// ── Validação da data que o profissional digitou ───────────────────────────────────────────────────────────────────────
export const ERRO_DO_ANO_CONFIRMADO = 'Ano inválido: use 4 números, de 1900 até o ano atual.';

export interface DataConfirmadaDigitada {
  precisao: PrecisaoDaData;
  // O ano ("2022") ou a data completa ("2022-06-10"), como saiu do campo.
  texto: string;
  // Data de nascimento do paciente, se conhecida: a cirurgia não pode ser antes dela.
  nascimento?: string | null;
}

// O projeto compila sem "strict": ali `!resultado.ok` não escolhe um lado da união. Por isso o campo do outro lado existe nos
// dois (como indefinido) e quem chama lê `erro` ou `linha` direto, sem truque.
export type ResultadoDaData =
  | { ok: true; dataEvento: string; precisao: PrecisaoDaData; ano: string; erro?: undefined }
  | { ok: false; erro: string; dataEvento?: undefined; precisao?: undefined; ano?: undefined };

/**
 * Confere a data digitada com a mesma régua da linha do tempo (para o que se grava nunca cair em "registros de fora"). Só o
 * ano: 4 números, de 1900 até o ano de hoje. Data completa: dia que existe, de 1900 em diante, sem ser depois de hoje.
 * Nos dois casos, nunca antes do nascimento do paciente. Devolve a frase do erro, ou a data que vai para o banco: sempre o
 * texto "AAAA-MM-DD" (nunca Date), com "AAAA-01-01" quando só o ano é conhecido.
 */
export function validarDataConfirmada(entrada: DataConfirmadaDigitada, hoje: string): ResultadoDaData {
  const texto = entrada.texto.trim();
  const nascimento = dataDeTabela(entrada.nascimento, hoje);
  if (entrada.precisao === 'ano') {
    const ano = anoDoHistorico(texto, hoje);
    if (!ano) return { ok: false, erro: ERRO_DO_ANO_CONFIRMADO };
    if (nascimento && Number(ano.iso) < Number(nascimento.iso.slice(0, 4))) {
      return { ok: false, erro: `O ano não pode ser antes do nascimento do cliente (${nascimento.iso.slice(0, 4)}).` };
    }
    return { ok: true, dataEvento: `${ano.iso}-01-01`, precisao: 'ano', ano: ano.iso };
  }
  const erro = erroDaDataDigitada(texto, hoje);
  if (erro) return { ok: false, erro };
  if (nascimento && texto < nascimento.iso) {
    return { ok: false, erro: `A data não pode ser antes do nascimento do cliente (${formatarData(nascimento)}).` };
  }
  return { ok: true, dataEvento: texto, precisao: 'dia', ano: texto.slice(0, 4) };
}

// ── A linha que o profissional grava ───────────────────────────────────────────────────────────────────────────────────
export interface ProfissionalQueConfirma {
  nome?: string | null;
  sobrenome?: string | null;
  crefito?: string | null;
}

export interface EntradaDaConfirmacao {
  terapeutaId: string;
  pacienteId: string;
  chave: string;
  relato: RelatoDaCirurgia;
  // Escolhido pelo profissional, sem opção marcada de início: texto vazio é erro.
  tipo: string;
  precisao: PrecisaoDaData;
  texto: string;
  nascimento?: string | null;
  profissional?: ProfissionalQueConfirma | null;
}

export interface MetadataDaConfirmacao {
  versao: typeof VERSAO_DA_CONFIRMACAO;
  origem: typeof ORIGEM_CONFIRMACAO;
  fonte: typeof FONTE_DA_CONFIRMACAO;
  chave_cliente: string;
  relato_cliente: RelatoDaCirurgia;
  precisao: PrecisaoDaData;
  confirmado_por: { nome: string | null; registro: string | null };
}

// Todas as colunas, uma a uma, com o que cada leitor da tabela precisa: nada de created_at nem updated_at (o servidor
// preenche e created_at é o "quando").
export interface LinhaDaConfirmacao {
  id: string;
  terapeuta_id: string;
  paciente_id: string;
  data_evento: string;
  tipo: TipoConfirmavel;
  titulo: string;
  descricao: string | null;
  // Fica nulo: com sistema_corporal a linha entraria no Avatar.
  sistema_corporal: null;
  severidade: 0;
  // Explícito porque o padrão da coluna é falso e a triagem de segurança lê as linhas não resolvidas: é um fato passado.
  resolvido: true;
  // Explícito porque o padrão da coluna é verdadeiro: é registro do profissional, o cliente não vê.
  visivel_paciente: false;
  profissional_registro: string | null;
  metadata: MetadataDaConfirmacao;
}

export type ResultadoDaLinha =
  | { ok: true; linha: LinhaDaConfirmacao; erro?: undefined }
  | { ok: false; erro: string; linha?: undefined };

export const ERRO_SEM_IDENTIFICACAO = 'Não deu para saber quem é o profissional ou o cliente. Saia e entre de novo no app.';
export const ERRO_SEM_TIPO_ESCOLHIDO = 'Escolha se foi cirurgia ou internação.';
export const ERRO_ITEM_NAO_CONFIRMAVEL = 'Este item não pode ser confirmado.';

/** Frase de por que o relato é grande demais para ser copiado para a confirmação, ou null se cabe. */
export function erroDoTamanhoDoRelato(relato: RelatoDaCirurgia): string | null {
  if (textoLimpo(relato.tipo).length + textoLimpo(relato.complicacoes).length > LIMITE_DO_RELATO_CONFIRMADO) {
    return `O relato do cliente passa de ${LIMITE_DO_RELATO_CONFIRMADO} letras (tipo e complicações juntos). Não dá para confirmar um texto tão longo: peça ao cliente para resumir.`;
  }
  if (textoLimpo(relato.ano).length > LIMITE_DO_ANO_RELATADO) {
    return `O que o cliente escreveu no ano passa de ${LIMITE_DO_ANO_RELATADO} letras. Não dá para confirmar este item: peça ao cliente para corrigir.`;
  }
  return null;
}

const tipoConfirmavel = (tipo: string): tipo is TipoConfirmavel => (TIPOS_CONFIRMAVEIS as readonly string[]).includes(tipo);

function quemConfirmou(profissional: ProfissionalQueConfirma | null | undefined) {
  const nome = [textoLimpo(profissional?.nome), textoLimpo(profissional?.sobrenome)].filter(Boolean).join(' ');
  const crefito = textoLimpo(profissional?.crefito);
  const registroCompleto = crefito && !/^crefito\b/i.test(crefito) ? `CREFITO ${crefito}` : crefito;
  return {
    nome: nome || null,
    registro: crefito || null,
    // Montado pelo app a partir do perfil, nunca digitado; sem registro profissional fica nulo.
    linha: registroCompleto ? [nome, registroCompleto].filter(Boolean).join(' · ') : null,
  };
}

/**
 * Monta a linha inteira que o hook grava, ou a frase do erro. O relato do cliente vai SÓ para o metadata (e o título): as
 * complicações não entram na descrição, para não misturar o que o cliente escreveu com o que o profissional registrou.
 */
export function montarLinhaDaConfirmacao(entrada: EntradaDaConfirmacao, hoje: string): ResultadoDaLinha {
  const terapeutaId = textoLimpo(entrada.terapeutaId);
  const pacienteId = textoLimpo(entrada.pacienteId);
  if (!terapeutaId || !pacienteId) return { ok: false, erro: ERRO_SEM_IDENTIFICACAO };
  const tipoDoRelato = textoLimpo(entrada.relato.tipo);
  if (!tipoDoRelato || !chaveConfirmavel(entrada.chave)) return { ok: false, erro: ERRO_ITEM_NAO_CONFIRMAVEL };
  const erroDoTamanho = erroDoTamanhoDoRelato(entrada.relato);
  if (erroDoTamanho) return { ok: false, erro: erroDoTamanho };
  if (!tipoConfirmavel(entrada.tipo)) return { ok: false, erro: ERRO_SEM_TIPO_ESCOLHIDO };
  const data = validarDataConfirmada({ precisao: entrada.precisao, texto: entrada.texto, nascimento: entrada.nascimento }, hoje);
  if (!data.ok) return { ok: false, erro: data.erro };
  const quem = quemConfirmou(entrada.profissional);
  return {
    ok: true,
    linha: {
      id: idDaConfirmacao(terapeutaId, pacienteId, entrada.chave),
      terapeuta_id: terapeutaId,
      paciente_id: pacienteId,
      data_evento: data.dataEvento,
      tipo: entrada.tipo,
      titulo: tipoDoRelato,
      descricao: data.precisao === 'ano' ? FRASE_SO_O_ANO(data.ano) : null,
      sistema_corporal: null,
      severidade: 0,
      resolvido: true,
      visivel_paciente: false,
      profissional_registro: quem.linha,
      metadata: {
        versao: VERSAO_DA_CONFIRMACAO,
        origem: ORIGEM_CONFIRMACAO,
        fonte: FONTE_DA_CONFIRMACAO,
        chave_cliente: entrada.chave,
        relato_cliente: { tipo: tipoDoRelato, ano: textoLimpo(entrada.relato.ano), complicacoes: textoLimpo(entrada.relato.complicacoes) },
        precisao: data.precisao,
        confirmado_por: { nome: quem.nome, registro: quem.registro },
      },
    },
  };
}
