import { tipoExame } from '@/lib/examesPresenciais';
import { ehRelatoDoPaciente, ORIGENS_PACIENTE } from '@/utils/voiceAssessment/origemAvaliacao';
import { anoDaData, anoDoHistorico, coincideComODiaDoCadastro, dataDeTabela, formatarData } from './datas';
import {
  humanizarCodigo, lerHistoriaAtual, lerHistoricoClinico, lerRespostasDoMyid, myidConcluido, textoLimpo,
} from './leitura';
import {
  CAMPO_ORIGEM_DO_RELATO, DETALHE_DATA_LIDA_DO_DOCUMENTO, DETALHE_MYID_CONCLUIDO, DETALHE_MYID_ULTIMO_REGISTRO,
  STATUS_DE_EXAME_IMPORTADO_CONCLUIDO, TIPOS_DE_DIAGNOSTICO_QUE_ENTRAM, TITULO_MYID_CONCLUIDO, TITULO_MYID_ULTIMO_REGISTRO,
} from './tipos';
import type { FontesClinicas, GrupoPorAno, ItemSemData, LinhaBruta, LinhaDoTempo, Marco } from './tipos';

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

function comparar(a: Marco, b: Marco): number {
  // Mais recente primeiro, comparando o texto ISO: "2022-05-03" vem antes de "2022" (o ano sozinho é prefixo do dia),
  // então dentro do ano o que tem dia fica acima do que só traz o ano.
  if (a.data.iso !== b.data.iso) return a.data.iso < b.data.iso ? 1 : -1;
  return a.id < b.id ? -1 : 1;
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
  let ignorados = 0;

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

  // ── Cliente: histórico clínico (cirurgias) ─────────────────────────────────
  const historico = lerHistoricoClinico(fontes.paciente?.historico_clinico);
  for (const c of historico.cirurgias) {
    const id = `historico_clinico:cirurgia:${c.indice}`;
    const data = anoDoHistorico(c.anoOriginal, hoje);
    if (data) {
      doCliente({
        id, data, titulo: c.tipo, detalhe: c.complicacoes ? `Complicações: ${c.complicacoes}` : undefined,
        tipo: 'cirurgia', rotuloTipo: 'Cirurgia ou internação', fonte: 'historico_clinico', natureza: 'fato',
      });
    } else {
      const ano = textoLimpo(c.anoOriginal);
      const partes = ['Cirurgia ou internação', ano ? `Ano que o cliente escreveu: "${ano}"` : 'Ano não informado'];
      if (c.complicacoes) partes.push(`Complicações: ${c.complicacoes}`);
      semDataDoCliente({ id, titulo: c.tipo, detalhe: partes.join(' · '), fonte: 'historico_clinico' });
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

  // ── Cliente: história atual ────────────────────────────────────────────────
  // historia_atual.atualizado_em NÃO vira marco: o autosave do cliente o regrava a cada pausa na digitação.
  const atual = lerHistoriaAtual(fontes.paciente?.historia_atual);
  if (atual.inicio) {
    semDataDoCliente({ id: 'historia_atual:inicio', titulo: 'Há quanto tempo começou (história atual)', detalhe: atual.inicio, fonte: 'historia_atual' });
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
      ignorados += 1;
      return;
    }
    doCliente({
      id, data: ultimo, titulo: TITULO_MYID_ULTIMO_REGISTRO, detalhe: DETALHE_MYID_ULTIMO_REGISTRO,
      tipo: 'myid', rotuloTipo: 'MyID', fonte: 'myid', natureza: 'registro',
    });
  });
  if (fontes.myidUltimo && myidConcluido(fontes.myidUltimo)) {
    const base = idDaLinha('myid', fontes.myidUltimo, 0);
    const r = lerRespostasDoMyid(fontes.myidUltimo.respostas_brutas);
    if (r.faixaDeDuracao) {
      semDataDoCliente({ id: `${base}:duracao`, titulo: 'Quando começou (faixa escolhida no MyID)', detalhe: r.faixaDeDuracao, fonte: 'myid' });
    }
    if (r.quandoTexto) {
      semDataDoCliente({ id: `${base}:quando`, titulo: 'Quando começou (texto escrito no MyID)', detalhe: r.quandoTexto, fonte: 'myid' });
    }
    if (r.oQueFazia) {
      semDataDoCliente({ id: `${base}:o_que_fazia`, titulo: 'O que estava fazendo quando notou (MyID)', detalhe: r.oQueFazia, fonte: 'myid' });
    }
  }

  // ── Profissional ───────────────────────────────────────────────────────────
  // Só as avaliações do profissional: o relato que o paciente fez no portal não é avaliação presencial.
  fontes.avaliacoesVoz.forEach((linha, posicao) => {
    if (ehRelatoDoPacienteNoPortal(linha)) return;
    const data = dataDeTabela(linha.created_at, hoje);
    if (!data) {
      ignorados += 1;
      return;
    }
    const queixa = textoLimpo(linha.queixa_principal);
    doProfissional({
      id: idDaLinha('avaliacao_voz', linha, posicao), data, titulo: 'Avaliação presencial registrada',
      detalhe: queixa ? `Queixa principal: ${queixa}` : undefined,
      tipo: 'avaliacao', rotuloTipo: 'Avaliação presencial', fonte: 'avaliacao_voz', natureza: 'registro',
    });
  });

  fontes.historiaVida.forEach((linha, posicao) => {
    const data = dataDeTabela(linha.data_evento, hoje);
    if (!data) {
      ignorados += 1;
      return;
    }
    const tipo = textoLimpo(linha.tipo);
    const rotuloTipo = tem(ROTULO_DO_TIPO_DE_VIDA, tipo) ? ROTULO_DO_TIPO_DE_VIDA[tipo] : (humanizarCodigo(tipo) || 'História de vida');
    const descricao = textoLimpo(linha.descricao);
    doProfissional({
      id: idDaLinha('historia_vida', linha, posicao), data, titulo: textoLimpo(linha.titulo) || rotuloTipo,
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
    // data_diagnostico é DEFAULT CURRENT_DATE e o app não a envia: igual ao dia do cadastro, não conta como data do fato.
    const doCadastro = coincideComODiaDoCadastro(linha.data_diagnostico, linha.created_at, hoje);
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
    const data = dataDeTabela(linha.data_exame, hoje);
    if (!data) {
      ignorados += 1;
      return;
    }
    const tipo = textoLimpo(linha.tipo);
    const resumo = textoLimpo(linha.resumo);
    doProfissional({
      id: idDaLinha('exame_presencial', linha, posicao), data, titulo: tipoExame(tipo)?.nome ?? (humanizarCodigo(tipo) || 'Exame presencial'),
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
    const data = dataDeTabela(linha.data_teste, hoje);
    if (!data) {
      ignorados += 1;
      return;
    }
    const resultado = textoLimpo(linha.resultado);
    const unidade = textoLimpo(linha.unidade);
    doProfissional({
      id: idDaLinha('teste_funcional', linha, posicao), data, titulo: humanizarCodigo(linha.tipo_teste) || 'Teste funcional',
      detalhe: resultado ? `Resultado: ${resultado}${unidade ? ` ${unidade}` : ''}` : undefined,
      tipo: 'teste', rotuloTipo: 'Teste funcional', fonte: 'teste_funcional', natureza: 'registro',
    });
  });

  fontes.escalas.forEach((linha, posicao) => {
    const data = dataDeTabela(linha.data_aplicacao, hoje);
    if (!data) {
      ignorados += 1;
      return;
    }
    const codigo = textoLimpo(linha.tipo_escala);
    const pontos = textoLimpo(linha.pontuacao_total);
    doProfissional({
      id: idDaLinha('escala', linha, posicao), data, titulo: tem(NOME_DA_ESCALA, codigo) ? NOME_DA_ESCALA[codigo] : (humanizarCodigo(codigo) || 'Escala'),
      detalhe: pontos ? `Pontuação: ${pontos}` : undefined, tipo: 'escala', rotuloTipo: 'Escala', fonte: 'escala', natureza: 'registro',
    });
  });

  const ordenados = [...marcos].sort(comparar);
  return { marcos: ordenados, porAno: agruparPorAno(ordenados), semData, ignorados };
}
