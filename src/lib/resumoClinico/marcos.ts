import { tipoExame } from '@/lib/examesPresenciais';
import { ehRelatoDoPaciente, ORIGENS_PACIENTE } from '@/utils/voiceAssessment/origemAvaliacao';
import { anoDaData, anoDoHistorico, dataDeTabela, dataDoDiagnosticoPodeSerDoSistema, formatarData } from './datas';
import {
  humanizarCodigo, lerHistoriaAtual, lerHistoricoClinico, lerRespostasDoMyid, myidConcluido, textoLimpo,
} from './leitura';
import type { CirurgiaLida } from './leitura';
import {
  CAMPO_ORIGEM_DO_RELATO, DETALHE_DATA_LIDA_DO_DOCUMENTO, DETALHE_MYID_CONCLUIDO, DETALHE_MYID_ULTIMO_REGISTRO,
  MOTIVO_DATA_NAO_VALIDA, ROTULO_CIRURGIA_DO_CLIENTE, ROTULO_FAIXA_MYID, ROTULO_INICIO_HISTORIA_ATUAL, ROTULO_O_QUE_FAZIA_MYID,
  ROTULO_QUANDO_MYID, ROTULO_QUEIXA_HISTORIA_ATUAL, ROTULO_QUEIXA_MYID, STATUS_DE_EXAME_IMPORTADO_CONCLUIDO,
  TIPOS_DE_DIAGNOSTICO_QUE_ENTRAM, TITULO_MYID_CONCLUIDO, TITULO_MYID_ULTIMO_REGISTRO,
} from './tipos';
import type {
  ComoComecou, FonteDoMarco, FontesClinicas, GrupoPorAno, ItemSemData, LinhaBruta, LinhaDoTempo, Marco,
  OrigemDoDado, RegistroIgnorado, RelatoDoCliente, TipoDoMarco,
} from './tipos';

// Nada é inventado: cada marco tem a data que o próprio registro traz. Texto livre do cliente ("há 2 anos") nunca vira
// data, vai para "Sem data". Registro do profissional sem a data do fato (diagnóstico, exame importado) também vai para
// "Sem data": a data em que foi gravado no app não é a data do fato e não vira marco. eventos_clinicos_anatomicos não
// entra: os achados do histórico relatado gravam a data do ENVIO como data de início, e não dá para separar com certeza
// o que o profissional datou de verdade.

const NOTA_SEM_DATA_DO_DIAGNOSTICO = 'A data do diagnóstico não foi informada';
const NOTA_DATA_INVALIDA_DO_DIAGNOSTICO = 'A data do diagnóstico registrada não é válida';
const NOTA_DATA_DO_CADASTRO_DO_DIAGNOSTICO = 'A data do diagnóstico é a do dia do cadastro no app e pode ter sido preenchida pelo sistema';
const NOTA_SEM_DATA_DO_EXAME = 'A data do exame não foi informada';
const NOTA_DATA_INVALIDA_DO_EXAME = 'A data do exame registrada não é válida';

const tiposDeDiagnosticoQueEntram: readonly string[] = TIPOS_DE_DIAGNOSTICO_QUE_ENTRAM;
const origensDoPaciente: readonly string[] = ORIGENS_PACIENTE;

const ROTULO_DO_TIPO_DE_VIDA: Record<string, string> = {
  nascimento: 'Nascimento', cirurgia: 'Cirurgia', trauma: 'Trauma', diagnostico: 'Diagnóstico', internacao: 'Internação',
  medicamento: 'Medicamento', alergia: 'Alergia', vacina: 'Vacina', gestacao: 'Gestação', parto: 'Parto',
  acidente: 'Acidente', fratura: 'Fratura', procedimento: 'Procedimento', alta: 'Alta médica', remissao: 'Remissão',
  inicio_tratamento: 'Início do tratamento', marco_tratamento: 'Marco do tratamento', outro: 'Outro',
};

const NOME_DA_ESCALA: Record<string, string> = {
  phq9: 'PHQ-9 (Depressão)', gad7: 'GAD-7 (Ansiedade)', pss10: 'PSS-10 (Estresse)',
};

const tem = (o: Record<string, unknown>, chave: string) => Object.prototype.hasOwnProperty.call(o, chave);

const idDaLinha = (fonte: string, linha: LinhaBruta, posicao: number) => `${fonte}:${textoLimpo(linha.id) || `i${posicao}`}`;

// Diagnóstico só é fato clínico se está ativo (remover no app é ativo=false) e é principal ou secundário. "suspeita" é
// hipótese. `ativo` vazio fica de fora como na lista do próprio app (.eq('ativo', true)): a coluna é NOT NULL, então
// vazio só aparece se a leitura não trouxe a coluna, e na dúvida não se afirma diagnóstico.
const diagnosticoFirmado = (linha: LinhaBruta) =>
  linha.ativo === true && tiposDeDiagnosticoQueEntram.includes(textoLimpo(linha.tipo));

const importacaoConcluida = (linha: LinhaBruta) => textoLimpo(linha.status) === STATUS_DE_EXAME_IMPORTADO_CONCLUIDO;

// A leitura traz a origem por caminho JSON (CAMPO_ORIGEM_DO_RELATO); o filtro do servidor já tira o relato do paciente,
// e isto é a segunda barreira caso o filtro não seja aplicado. `resultado` inteiro também vale, se alguém o entregar.
function ehRelatoDoPacienteNoPortal(linha: LinhaBruta): boolean {
  return ehRelatoDoPaciente(linha) || origensDoPaciente.includes(textoLimpo(linha[CAMPO_ORIGEM_DO_RELATO]));
}

// Ordem "natural" do texto: os números dentro dele valem pelo valor ("cirurgia:2" antes de "cirurgia:10"). Só devolve 0
// para textos idênticos: se os números empatam ("01" e "1"), o texto puro decide, para a ordem ser sempre a mesma.
function compararTextoNatural(a: string, b: string): number {
  const partes = (t: string) => t.match(/\d+|\D+/g) ?? [];
  const pa = partes(a);
  const pb = partes(b);
  const comuns = Math.min(pa.length, pb.length);
  for (let i = 0; i < comuns; i += 1) {
    const x = pa[i];
    const y = pb[i];
    if (x === y) continue;
    if (/^\d/.test(x) && /^\d/.test(y)) {
      // Sem os zeros à esquerda, o número maior tem mais dígitos; assim vale também para ids longos (uuid), sem perder precisão.
      const nx = x.replace(/^0+(?=\d)/, '');
      const ny = y.replace(/^0+(?=\d)/, '');
      if (nx.length !== ny.length) return nx.length < ny.length ? -1 : 1;
      if (nx !== ny) return nx < ny ? -1 : 1;
      continue;
    }
    return x < y ? -1 : 1;
  }
  if (pa.length !== pb.length) return pa.length < pb.length ? -1 : 1;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function compararMarcos(a: Marco, b: Marco): number {
  // Mais recente primeiro, comparando o texto ISO: "2022-05-03" vem antes de "2022" (o ano sozinho é prefixo do dia),
  // então dentro do ano o que tem dia fica acima do que só traz o ano.
  if (a.data.iso !== b.data.iso) return a.data.iso < b.data.iso ? 1 : -1;
  return compararTextoNatural(a.id, b.id);
}

export const semAcentoEmMinuscula = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
// "Cirurgia", "Cirurgias", "Internação", "Internações" (sem acento e sem caixa), mas não "Cirurgião".
const COMECA_COM_O_ROTULO = /^(cirurgias?|internac(?:ao|oes))(?![a-z])/;

/**
 * Título que a tela mostra. A cirurgia que o cliente relatou traz só o que ele escreveu ("Coluna"), que sozinho não diz do
 * que se trata: ganha o rótulo fixo "Cirurgia ou internação: ". Se o texto dele já começa assim, fica como está. O texto do
 * cliente nunca é reescrito e `titulo` do marco não muda. Qualquer outro marco ou item mostra o próprio título.
 */
export function tituloParaExibir(item: { titulo: string; tipo?: TipoDoMarco; fonte: FonteDoMarco; origem: OrigemDoDado }): string {
  const cirurgiaDoCliente = item.origem === 'cliente' && item.fonte === 'historico_clinico' && item.tipo === 'cirurgia';
  if (!cirurgiaDoCliente) return item.titulo;
  if (COMECA_COM_O_ROTULO.test(semAcentoEmMinuscula(item.titulo))) return item.titulo;
  return `${ROTULO_CIRURGIA_DO_CLIENTE}: ${item.titulo}`;
}

export function agruparPorAno(marcos: Marco[]): GrupoPorAno[] {
  const grupos: GrupoPorAno[] = [];
  for (const marco of marcos) {
    const ano = anoDaData(marco.data);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.ano === ano) ultimo.marcos.push(marco);
    else grupos.push({ ano, marcos: [marco] });
  }
  return grupos;
}

export function montarLinhaDoTempo(fontes: FontesClinicas, hoje: string): LinhaDoTempo {
  const marcos: Marco[] = [];
  const semData: ItemSemData[] = [];
  const registrosIgnorados: RegistroIgnorado[] = [];

  const doProfissional = (base: Omit<Marco, 'origem' | 'revisado'>) => {
    marcos.push({ ...base, origem: 'profissional', revisado: true });
  };
  const doCliente = (base: Omit<Marco, 'origem' | 'revisado'>) => {
    marcos.push({ ...base, origem: 'cliente', revisado: false });
  };
  const semDataDoCliente = (item: Omit<ItemSemData, 'origem' | 'revisado'>) => {
    semData.push({ ...item, origem: 'cliente', revisado: false });
  };
  const semDataDoProfissional = (item: Omit<ItemSemData, 'origem' | 'revisado'>) => {
    semData.push({ ...item, origem: 'profissional', revisado: true });
  };
  // Dia do Brasil em que o registro foi gravado no app. Não é a data do fato e só aparece escrita, nunca como marco.
  const registradoNoApp = (linha: LinhaBruta): string | null => {
    const gravado = dataDeTabela(linha.created_at, hoje);
    return gravado ? `Registrado no app em ${formatarData(gravado)}` : null;
  };
  const detalheSemData = (rotulo: string, aviso: string, linha: LinhaBruta) =>
    [rotulo, aviso, registradoNoApp(linha)].filter(Boolean).join(' · ');
  const ignorar = (id: string, fonte: FonteDoMarco, rotulo: string) => {
    registrosIgnorados.push({ id, fonte, rotulo, motivo: MOTIVO_DATA_NAO_VALIDA });
  };

  // ── Cliente: histórico clínico (cirurgias) ─────────────────────────────────
  const historico = lerHistoricoClinico(fontes.paciente?.historico_clinico);
  // O formulário do cliente grava um id em cada cirurgia: com ele, a chave não muda se o cliente apagar uma cirurgia mais
  // acima na lista. Item antigo (sem id) e id repetido caem na posição. O prefixo "id:" impede que um id só de números
  // colida com a posição de outro item.
  const idsDeCirurgiaEmUso = new Set<string>();
  const idDaCirurgia = (c: CirurgiaLida) => {
    const estavel = c.id ? `historico_clinico:cirurgia:id:${c.id}` : '';
    if (estavel && !idsDeCirurgiaEmUso.has(estavel)) {
      idsDeCirurgiaEmUso.add(estavel);
      return estavel;
    }
    return `historico_clinico:cirurgia:${c.indice}`;
  };
  for (const c of historico.cirurgias) {
    const id = idDaCirurgia(c);
    const data = anoDoHistorico(c.anoOriginal, hoje);
    if (data) {
      doCliente({
        id, data, titulo: c.tipo, detalhe: c.complicacoes ? `Complicações: ${c.complicacoes}` : undefined,
        tipo: 'cirurgia', rotuloTipo: ROTULO_CIRURGIA_DO_CLIENTE, fonte: 'historico_clinico', natureza: 'fato',
      });
    } else {
      const ano = textoLimpo(c.anoOriginal);
      const partes = [ROTULO_CIRURGIA_DO_CLIENTE, ano ? `Ano que o cliente escreveu: "${ano}"` : 'Ano não informado'];
      if (c.complicacoes) partes.push(`Complicações: ${c.complicacoes}`);
      semDataDoCliente({ id, titulo: c.tipo, detalhe: partes.join(' · '), fonte: 'historico_clinico', tipo: 'cirurgia' });
    }
  }
  // ultimo_envio só muda no envio explícito (HistoricoClinicoCard); o autosave regrava o valor que já estava lá.
  const envio = dataDeTabela(historico.ultimoEnvio, hoje);
  if (envio) {
    doCliente({
      id: 'historico_clinico:envio', data: envio, titulo: 'Último envio do histórico clínico (pelo cliente)',
      tipo: 'historico', rotuloTipo: 'Histórico clínico', fonte: 'historico_clinico', natureza: 'registro',
    });
  }

  // ── Cliente: MyID ──────────────────────────────────────────────────────────
  // "Concluído" só com a data do histórico (avaliacoes_identidade ligada ao MyID). O updated_at do MyID é mudado por
  // qualquer update, então sem o vínculo o marco é "último registro", com o aviso, e nunca usa o created_at do MyID.
  const dataDeConclusaoDoMyid = (linha: LinhaBruta) => {
    const id = textoLimpo(linha.id);
    const vinculo = id ? fontes.vinculosMyid.find((v) => textoLimpo(v.myid_avaliacao_id) === id) : undefined;
    return vinculo ? dataDeTabela(vinculo.created_at, hoje) : null;
  };
  fontes.myidConcluidos.forEach((linha, posicao) => {
    if (!myidConcluido(linha)) return;
    const id = idDaLinha('myid', linha, posicao);
    const conclusao = dataDeConclusaoDoMyid(linha);
    if (conclusao) {
      doCliente({
        id, data: conclusao, titulo: TITULO_MYID_CONCLUIDO, detalhe: DETALHE_MYID_CONCLUIDO,
        tipo: 'myid', rotuloTipo: 'MyID', fonte: 'myid', natureza: 'registro',
      });
      return;
    }
    const ultimo = dataDeTabela(linha.updated_at, hoje);
    if (!ultimo) {
      ignorar(id, 'myid', 'MyID');
      return;
    }
    doCliente({
      id, data: ultimo, titulo: TITULO_MYID_ULTIMO_REGISTRO, detalhe: DETALHE_MYID_ULTIMO_REGISTRO,
      tipo: 'myid', rotuloTipo: 'MyID', fonte: 'myid', natureza: 'registro',
    });
  });

  // ── Cliente: como começou ──────────────────────────────────────────────────
  // As respostas do cliente sobre o começo do quadro não são datas e saem de "Sem data": ficam juntas num cartão, cada uma
  // com o rótulo da pergunta, lado a lado (3 anos num lugar, 1 ano noutro: a divergência fica à vista, nada é somado nem
  // comparado). historia_atual.atualizado_em NÃO vira marco: o autosave do cliente o regrava a cada pausa na digitação.
  const relato = (id: string, rotulo: string, texto: string, fonte: FonteDoMarco): RelatoDoCliente[] =>
    (texto ? [{ id, rotulo, texto, fonte, origem: 'cliente', revisado: false }] : []);
  const atual = lerHistoriaAtual(fontes.paciente?.historia_atual);
  const myidDasRespostas = fontes.myidUltimo && myidConcluido(fontes.myidUltimo) ? fontes.myidUltimo : null;
  const baseDoMyid = myidDasRespostas ? idDaLinha('myid', myidDasRespostas, 0) : '';
  const respostas = lerRespostasDoMyid(myidDasRespostas?.respostas_brutas);
  const queixasDoMyid = relato(`${baseDoMyid}:queixa`, ROTULO_QUEIXA_MYID, respostas.queixa, 'myid');
  const inicioDoMyid = [
    ...relato(`${baseDoMyid}:duracao`, ROTULO_FAIXA_MYID, respostas.faixaDeDuracao, 'myid'),
    ...relato(`${baseDoMyid}:quando`, ROTULO_QUANDO_MYID, respostas.quandoTexto, 'myid'),
    ...relato(`${baseDoMyid}:o_que_fazia`, ROTULO_O_QUE_FAZIA_MYID, respostas.oQueFazia, 'myid'),
  ];
  const queixas = [...relato('historia_atual:queixa', ROTULO_QUEIXA_HISTORIA_ATUAL, atual.queixa, 'historia_atual'), ...queixasDoMyid];
  const inicio = [...relato('historia_atual:inicio', ROTULO_INICIO_HISTORIA_ATUAL, atual.inicio, 'historia_atual'), ...inicioDoMyid];
  let comoComecou: ComoComecou | null = null;
  if (queixas.length > 0 || inicio.length > 0) {
    const veioDoMyid = queixasDoMyid.length > 0 || inicioDoMyid.length > 0;
    comoComecou = { queixas, inicio, diaDoMyid: myidDasRespostas && veioDoMyid ? dataDeConclusaoDoMyid(myidDasRespostas) : null };
  }

  // ── Profissional ───────────────────────────────────────────────────────────
  // Só as avaliações do profissional: o relato que o paciente fez no portal não é avaliação presencial.
  fontes.avaliacoesVoz.forEach((linha, posicao) => {
    if (ehRelatoDoPacienteNoPortal(linha)) return;
    const id = idDaLinha('avaliacao_voz', linha, posicao);
    const data = dataDeTabela(linha.created_at, hoje);
    if (!data) {
      ignorar(id, 'avaliacao_voz', 'Avaliação presencial');
      return;
    }
    const queixa = textoLimpo(linha.queixa_principal);
    doProfissional({
      id, data, titulo: 'Avaliação presencial registrada',
      detalhe: queixa ? `Queixa principal: ${queixa}` : undefined,
      tipo: 'avaliacao', rotuloTipo: 'Avaliação presencial', fonte: 'avaliacao_voz', natureza: 'registro',
    });
  });

  fontes.historiaVida.forEach((linha, posicao) => {
    const id = idDaLinha('historia_vida', linha, posicao);
    const tipo = textoLimpo(linha.tipo);
    const rotuloTipo = tem(ROTULO_DO_TIPO_DE_VIDA, tipo) ? ROTULO_DO_TIPO_DE_VIDA[tipo] : (humanizarCodigo(tipo) || 'História de vida');
    const titulo = textoLimpo(linha.titulo) || rotuloTipo;
    const data = dataDeTabela(linha.data_evento, hoje);
    if (!data) {
      ignorar(id, 'historia_vida', titulo);
      return;
    }
    const descricao = textoLimpo(linha.descricao);
    doProfissional({
      id, data, titulo,
      detalhe: descricao || undefined, tipo: tipo === 'cirurgia' ? 'cirurgia' : 'evento_de_vida', rotuloTipo,
      fonte: 'historia_vida', natureza: 'fato',
    });
  });

  fontes.diagnosticos.forEach((linha, posicao) => {
    if (!diagnosticoFirmado(linha)) return;
    const cid = textoLimpo(linha.cid_codigo);
    const titulo = `${cid ? `[${cid}] ` : ''}${textoLimpo(linha.cid_descricao) || 'Diagnóstico'}`;
    const id = idDaLinha('diagnostico', linha, posicao);
    const data = dataDeTabela(linha.data_diagnostico, hoje);
    // Linha anterior ao corte: data_diagnostico era DEFAULT CURRENT_DATE e o app não a enviava, então igual ao dia do
    // cadastro não conta como data do fato. Linha depois do corte: o valor (data ou null) é do profissional e vale.
    const doCadastro = dataDoDiagnosticoPodeSerDoSistema(linha.data_diagnostico, linha.created_at, hoje);
    if (data && !doCadastro) {
      doProfissional({ id, data, titulo, tipo: 'diagnostico', rotuloTipo: 'Diagnóstico', fonte: 'diagnostico', natureza: 'fato' });
      return;
    }
    let aviso = NOTA_SEM_DATA_DO_DIAGNOSTICO;
    if (doCadastro) aviso = NOTA_DATA_DO_CADASTRO_DO_DIAGNOSTICO;
    else if (textoLimpo(linha.data_diagnostico)) aviso = NOTA_DATA_INVALIDA_DO_DIAGNOSTICO;
    semDataDoProfissional({ id, titulo, detalhe: detalheSemData('Diagnóstico', aviso, linha), fonte: 'diagnostico' });
  });

  fontes.examesPresenciais.forEach((linha, posicao) => {
    const id = idDaLinha('exame_presencial', linha, posicao);
    const tipo = textoLimpo(linha.tipo);
    const titulo = tipoExame(tipo)?.nome ?? (humanizarCodigo(tipo) || 'Exame presencial');
    const data = dataDeTabela(linha.data_exame, hoje);
    if (!data) {
      ignorar(id, 'exame_presencial', titulo);
      return;
    }
    const resumo = textoLimpo(linha.resumo);
    doProfissional({
      id, data, titulo,
      detalhe: resumo || undefined, tipo: 'exame', rotuloTipo: 'Exame presencial', fonte: 'exame_presencial', natureza: 'registro',
    });
  });

  fontes.examesImportados.forEach((linha, posicao) => {
    if (!importacaoConcluida(linha)) return;
    const id = idDaLinha('exame_importado', linha, posicao);
    const titulo = humanizarCodigo(linha.tipo) || 'Exame importado';
    const data = dataDeTabela(linha.data_exame, hoje);
    if (data) {
      // data_exame vem da leitura do documento por IA (import-exame), não é digitada: o profissional precisa conferir.
      doProfissional({
        id, data, titulo, detalhe: DETALHE_DATA_LIDA_DO_DOCUMENTO,
        tipo: 'exame', rotuloTipo: 'Exame importado', fonte: 'exame_importado', natureza: 'registro',
      });
      return;
    }
    const aviso = textoLimpo(linha.data_exame) ? NOTA_DATA_INVALIDA_DO_EXAME : NOTA_SEM_DATA_DO_EXAME;
    semDataDoProfissional({ id, titulo, detalhe: detalheSemData('Exame importado', aviso, linha), fonte: 'exame_importado' });
  });

  fontes.testesFuncionais.forEach((linha, posicao) => {
    const id = idDaLinha('teste_funcional', linha, posicao);
    const titulo = humanizarCodigo(linha.tipo_teste) || 'Teste funcional';
    const data = dataDeTabela(linha.data_teste, hoje);
    if (!data) {
      ignorar(id, 'teste_funcional', titulo);
      return;
    }
    const resultado = textoLimpo(linha.resultado);
    const unidade = textoLimpo(linha.unidade);
    doProfissional({
      id, data, titulo,
      detalhe: resultado ? `Resultado: ${resultado}${unidade ? ` ${unidade}` : ''}` : undefined,
      tipo: 'teste', rotuloTipo: 'Teste funcional', fonte: 'teste_funcional', natureza: 'registro',
    });
  });

  fontes.escalas.forEach((linha, posicao) => {
    const id = idDaLinha('escala', linha, posicao);
    const codigo = textoLimpo(linha.tipo_escala);
    const titulo = tem(NOME_DA_ESCALA, codigo) ? NOME_DA_ESCALA[codigo] : (humanizarCodigo(codigo) || 'Escala');
    const data = dataDeTabela(linha.data_aplicacao, hoje);
    if (!data) {
      ignorar(id, 'escala', titulo);
      return;
    }
    const pontos = textoLimpo(linha.pontuacao_total);
    doProfissional({
      id, data, titulo,
      detalhe: pontos ? `Pontuação: ${pontos}` : undefined, tipo: 'escala', rotuloTipo: 'Escala', fonte: 'escala', natureza: 'registro',
    });
  });

  const ordenados = [...marcos].sort(compararMarcos);
  return {
    marcos: ordenados, porAno: agruparPorAno(ordenados), semData, ignorados: registrosIgnorados.length, registrosIgnorados, comoComecou,
  };
}
