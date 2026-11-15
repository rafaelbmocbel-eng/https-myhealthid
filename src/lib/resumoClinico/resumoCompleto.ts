import { lerHistoriaAtual, lerHistoricoClinico, lerRespostasDoMyid, listaDeTextos, myidConcluido, objeto, textoLimpo } from './leitura';
import { SELO_CLIENTE } from './tipos';
import type { FontesClinicas, SecaoDoResumo } from './tipos';

// Resumo "Completo": a avaliação do profissional mais o que o cliente relatou, em seções com rótulos fixos.
// Os textos passam como estão (sem reescrever, sem frase nova). Hipóteses diagnósticas e red flags ficam de fora
// de propósito: já aparecem na aba Quadro/Dx, e aqui um texto copiado poderia ser lido como diagnóstico.

export const AVISO_DO_RESUMO_COMPLETO = 'Montado pelo app a partir das respostas; não vai para o prontuário.';
// Só na tela: o texto copiado sai do app e os selos do cabeçalho do cartão não saem junto.
export const AVISO_DOS_SELOS_DO_CABECALHO = 'Os selos Prontuário e Sincronizado do cabeçalho valem só para o Resumo.';
export const NOTA_EDITADO_PELO_PROFISSIONAL = 'Editado pelo profissional';

// Seção do Completo -> chave de _secoes.editadas que a tela da avaliação grava ao editar (SECOES em
// AvaliacaoSecoesEditaveis.tsx). Só as seções do Completo que a tela deixa editar; "Queixa e história" e "Exame e
// avaliação" vêm de campos que a tela não edita.
const CHAVE_EDITADA_DA_SECAO: Record<string, string> = { dor: 'dor', funcionalidade: 'funcionalidade', psicossociais: 'psicossocial' };

const tem = (o: Record<string, unknown>, chave: string) => Object.prototype.hasOwnProperty.call(o, chave);

// Texto de vários parágrafos vira uma linha por parágrafo; o rótulo fica na primeira.
function comRotulo(rotulo: string, texto: string): string[] {
  const partes = texto.split('\n').map((p) => p.trim()).filter(Boolean);
  if (partes.length === 0) return [];
  return [`${rotulo}: ${partes[0]}`, ...partes.slice(1)];
}

function valorEmTexto(v: unknown): string {
  const lista = listaDeTextos(v);
  return Array.isArray(v) ? lista.join(', ') : textoLimpo(v);
}

const humanizarChave = (k: string) => k.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

// Campos conhecidos na ordem fixa, com rótulo fixo; o que mais vier solto no objeto entra com o nome do campo.
function linhasDoObjeto(bruto: unknown, rotulos: Record<string, string>): string[] {
  const texto = textoLimpo(bruto);
  if (texto) return [texto];
  const o = objeto(bruto);
  if (!o) return [];
  const linhas: string[] = [];
  for (const [chave, rotulo] of Object.entries(rotulos)) {
    const v = valorEmTexto(o[chave]);
    if (v) linhas.push(`${rotulo}: ${v}`);
  }
  for (const chave of Object.keys(o)) {
    if (tem(rotulos, chave)) continue;
    const v = valorEmTexto(o[chave]);
    if (v) linhas.push(`${humanizarChave(chave)}: ${v}`);
  }
  return linhas;
}

const ROTULOS_DA_FUNCIONALIDADE = {
  limitacoes_avds: 'Limitações nas atividades do dia a dia',
  limitacoes_trabalho: 'Limitações no trabalho',
  limitacoes_esporte: 'Limitações no esporte',
  nivel_impacto: 'Nível de impacto',
};

const ROTULOS_PSICOSSOCIAIS = {
  catastrofizacao: 'Catastrofização',
  medo_evitacao: 'Medo e evitação',
  qualidade_sono: 'Qualidade do sono',
  estresse: 'Estresse',
  observacoes: 'Observações',
};

function linhasDaDor(bruto: unknown): string[] {
  const d = objeto(bruto);
  if (!d) return [];
  const eva = textoLimpo(d.intensidade_eva);
  const linhas = [
    ['Localização', valorEmTexto(d.localizacao)],
    ['Intensidade (EVA)', eva ? `${eva}/10` : ''],
    ['Tipo', valorEmTexto(d.tipo)],
    ['Início', valorEmTexto(d.inicio)],
    ['Duração', valorEmTexto(d.duracao)],
    ['Padrão ao longo do tempo', valorEmTexto(d.padrao_temporal)],
    ['Agrava', valorEmTexto(d.fatores_agravantes)],
    ['Alivia', valorEmTexto(d.fatores_aliviantes) || valorEmTexto(d.fatores_atenuantes)],
  ];
  return linhas.filter(([, v]) => v).map(([rotulo, v]) => `${rotulo}: ${v}`);
}

function secao(id: string, titulo: string, linhas: string[], origem: SecaoDoResumo['origem']): SecaoDoResumo[] {
  return linhas.length > 0 ? [{ id, titulo, linhas, origem }] : [];
}

// A tela usa o texto editado no lugar do montado pelos campos (`editadas[chave] ?? builder`): vale também vazio, e então
// a seção some porque o profissional a apagou. Aqui é igual: não volta ao dado antigo dos campos nem o copia como se
// fosse o que o profissional confirmou. Só texto vale; null/número/objeto contam como "não editado", como `??`.
function secaoDoProfissional(id: string, titulo: string, linhasDosCampos: string[], editadas: Record<string, unknown>): SecaoDoResumo[] {
  const texto = editadas[CHAVE_EDITADA_DA_SECAO[id]];
  if (typeof texto !== 'string') return secao(id, titulo, linhasDosCampos, 'profissional');
  const linhas = texto.split('\n').map((l) => l.trim()).filter(Boolean);
  return linhas.length > 0 ? [{ id, titulo, linhas, origem: 'profissional', editada: true }] : [];
}

function secoesDoProfissional(resultado: unknown, editadas: Record<string, unknown>): SecaoDoResumo[] {
  const r = objeto(resultado) ?? {};
  const soap = objeto(r.soap) ?? {};
  return [
    ...secao('queixa_e_historia', 'Queixa e história', [
      ...comRotulo('Queixa principal', textoLimpo(r.queixa_principal)),
      ...comRotulo('Tempo de evolução', textoLimpo(r.tempo_evolucao)),
      ...comRotulo('Mecanismo da lesão', textoLimpo(r.mecanismo_lesao)),
      ...comRotulo('Relato (subjetivo)', textoLimpo(soap.subjetivo)),
    ], 'profissional'),
    ...secaoDoProfissional('dor', 'Dor', linhasDaDor(r.dor), editadas),
    ...secaoDoProfissional('funcionalidade', 'Funcionalidade', linhasDoObjeto(r.funcionalidade, ROTULOS_DA_FUNCIONALIDADE), editadas),
    ...secaoDoProfissional('psicossociais', 'Aspectos psicossociais', linhasDoObjeto(r.fatores_psicossociais ?? r.psicossocial, ROTULOS_PSICOSSOCIAIS), editadas),
    ...secao('exame_e_avaliacao', 'Exame e avaliação do profissional', [
      ...comRotulo('Exame (objetivo)', textoLimpo(soap.objetivo)),
      ...comRotulo('Avaliação', textoLimpo(soap.avaliacao)),
    ], 'profissional'),
  ];
}

function secoesDoCliente(fontes: FontesClinicas): SecaoDoResumo[] {
  const linhasDoMyid: string[] = [];
  if (fontes.myidUltimo && myidConcluido(fontes.myidUltimo)) {
    const m = lerRespostasDoMyid(fontes.myidUltimo.respostas_brutas);
    if (m.queixa) linhasDoMyid.push(`Queixa que o cliente escreveu: ${m.queixa}`);
    if (m.faixaDeDuracao) linhasDoMyid.push(`Quando começou (faixa escolhida): ${m.faixaDeDuracao}`);
    if (m.quandoTexto) linhasDoMyid.push(`Quando começou (texto escrito): ${m.quandoTexto}`);
    if (m.oQueFazia) linhasDoMyid.push(`O que estava fazendo quando notou: ${m.oQueFazia}`);
    if (m.mudancas.length > 0) linhasDoMyid.push(`Mudanças nas últimas 4 semanas: ${m.mudancas.join(', ')}`);
  }

  const h = lerHistoricoClinico(fontes.paciente?.historico_clinico);
  const linhasDoHistorico: string[] = [];
  if (h.doencas.condicoes.length > 0) linhasDoHistorico.push(`Doenças crônicas: ${h.doencas.condicoes.join(', ')}`);
  if (h.doencas.detalhes) linhasDoHistorico.push(`Detalhes sobre as doenças crônicas: ${h.doencas.detalhes}`);
  for (const c of h.cirurgias) {
    const ano = textoLimpo(c.anoOriginal);
    linhasDoHistorico.push(`Cirurgia ou internação: ${c.tipo}${ano ? ` (${ano})` : ''}${c.complicacoes ? ` — complicações: ${c.complicacoes}` : ''}`);
  }
  for (const m of h.medicamentos) {
    linhasDoHistorico.push(`Medicamento: ${[m.nome, m.dose, m.frequencia].filter(Boolean).join(', ')}`);
  }
  if (h.alergias.medicamentos) linhasDoHistorico.push(`Alergias a medicamentos: ${h.alergias.medicamentos}`);
  if (h.alergias.alimentos) linhasDoHistorico.push(`Alergias a alimentos: ${h.alergias.alimentos}`);
  if (h.alergias.outros) linhasDoHistorico.push(`Outras alergias: ${h.alergias.outros}`);
  if (h.saudeMental.condicoes.length > 0) {
    linhasDoHistorico.push(`Saúde mental: ${h.saudeMental.condicoes.join(', ')}`);
    if (h.saudeMental.diagnosticoFormal) linhasDoHistorico.push('O cliente marcou que tem diagnóstico formal de saúde mental');
  }
  if (h.saudeMental.detalhes) linhasDoHistorico.push(`Detalhes sobre a saúde mental: ${h.saudeMental.detalhes}`);
  if (h.familiar.condicoes.length > 0) linhasDoHistorico.push(`Histórico familiar: ${h.familiar.condicoes.join(', ')}`);
  if (h.familiar.detalhes) linhasDoHistorico.push(`Detalhes sobre o histórico familiar: ${h.familiar.detalhes}`);

  const a = lerHistoriaAtual(fontes.paciente?.historia_atual);
  const linhasDaHistoriaAtual = [
    ...comRotulo('Queixa principal', a.queixa),
    ...comRotulo('Há quanto tempo começou', a.inicio),
    ...comRotulo('O que melhora e o que piora', a.fatores),
    ...comRotulo('Como afeta a rotina', a.impacto),
  ];

  return [
    ...secao('cliente_myid', 'MyID', linhasDoMyid, 'cliente'),
    ...secao('cliente_historico', 'Histórico clínico', linhasDoHistorico, 'cliente'),
    ...secao('cliente_historia_atual', 'História atual', linhasDaHistoriaAtual, 'cliente'),
  ];
}

/**
 * Seções do resumo completo; só entram as que têm conteúdo. `resultado` é o da última avaliação do profissional.
 * `editadas` são as edições à mão da tela (_secoes.editadas); sem elas, valem as que estão em `resultado`.
 */
export function montarResumoCompleto(resultado: unknown, fontes: FontesClinicas, editadas?: unknown): SecaoDoResumo[] {
  const doProfissional = objeto(editadas) ?? objeto(objeto(objeto(resultado)?._secoes)?.editadas) ?? {};
  return [...secoesDoProfissional(resultado, doProfissional), ...secoesDoCliente(fontes)];
}

/** Texto para colar em outro lugar: cada trecho do cliente carrega o aviso de que não foi revisado, e o editado diz que foi. */
export function textoParaCopiar(secoes: SecaoDoResumo[]): string {
  const blocos = secoes.map((s) => {
    let titulo = s.titulo;
    if (s.origem === 'cliente') titulo = `${s.titulo} (${SELO_CLIENTE.toLowerCase()})`;
    else if (s.editada) titulo = `${s.titulo} (${NOTA_EDITADO_PELO_PROFISSIONAL.toLowerCase()})`;
    return [titulo, ...s.linhas].join('\n');
  });
  return [...blocos, AVISO_DO_RESUMO_COMPLETO].join('\n\n');
}
