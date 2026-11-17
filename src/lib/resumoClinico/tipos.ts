// Tipos da visão "Completa" do Resumo Clínico e da Linha do tempo clínica.
// Tudo aqui é CALCULADO NA HORA a partir do que já está no banco: nada disto é gravado.

export type OrigemDoDado = 'cliente' | 'profissional';

// "ano": o registro só trouxe o ano (cirurgia de 2022). "dia": trouxe a data completa.
export type PrecisaoDaData = 'ano' | 'dia';

export interface DataDoMarco {
  iso: string; // "AAAA" ou "AAAA-MM-DD"
  precisao: PrecisaoDaData;
}

// "fato": o acontecimento clínico com a data que o registro traz (cirurgia de 2022).
// "registro": quando algo foi feito ou registrado no app (MyID concluído, exame feito).
export type NaturezaDoMarco = 'fato' | 'registro';

export type FonteDoMarco =
  | 'myid'
  | 'historico_clinico'
  | 'historia_atual'
  | 'historia_vida'
  | 'diagnostico'
  | 'avaliacao_voz'
  | 'exame_presencial'
  | 'exame_importado'
  | 'teste_funcional'
  | 'escala';

// Lista de verdade dos tipos: o filtro por tipo confere cada um e um tipo novo precisa ganhar categoria (ou ficar só em "Tudo").
export const TIPOS_DE_MARCO = [
  'cirurgia',
  'evento_de_vida',
  'diagnostico',
  'myid',
  'historico',
  'avaliacao',
  'exame',
  'teste',
  'escala',
] as const;

export type TipoDoMarco = (typeof TIPOS_DE_MARCO)[number];

export interface Marco {
  // Estável entre leituras: fonte + id da origem (+ posição, nos itens de uma lista do cliente).
  id: string;
  data: DataDoMarco;
  titulo: string;
  detalhe?: string;
  tipo: TipoDoMarco;
  // Texto curto do tipo ("Cirurgia", "Fratura", "Exame"), como o registro o chama.
  rotuloTipo: string;
  fonte: FonteDoMarco;
  origem: OrigemDoDado;
  // O que veio do cliente nunca foi revisado por um profissional.
  revisado: boolean;
  natureza: NaturezaDoMarco;
}

// Item sem data de verdade: o cliente escreveu quando foi mas não deu uma data que dê para confiar ("há 2 anos",
// "2O22"), ou o profissional registrou sem a data do fato (diagnóstico, exame importado). Cada item guarda o selo da
// sua própria origem.
export interface ItemSemData {
  id: string;
  titulo: string;
  detalhe: string;
  fonte: FonteDoMarco;
  origem: OrigemDoDado;
  revisado: boolean;
  // Só nas cirurgias que o cliente relatou: é o que deixa a tela escrever "Cirurgia ou internação: <texto>" sem adivinhar
  // pela fonte (tituloParaExibir).
  tipo?: TipoDoMarco;
}

// Uma resposta do cliente sobre o começo do quadro, com o rótulo exato da pergunta e o texto como ele escreveu. Nunca vira
// data, nunca é somada nem comparada com outra: se o cliente diz "mais de 3 anos" num lugar e "mais de 1 ano" noutro, as
// duas ficam à vista, lado a lado.
export interface RelatoDoCliente {
  // Estável entre leituras: fonte + id do MyID (ou o campo da história atual) + o campo de onde veio.
  id: string;
  rotulo: string;
  texto: string;
  fonte: FonteDoMarco;
  origem: 'cliente';
  revisado: false;
}

// Cartão "Como começou": o que o cliente contou sobre a queixa e sobre o começo, sem data inventada.
export interface ComoComecou {
  queixas: RelatoDoCliente[];
  inicio: RelatoDoCliente[];
  // Dia em que a conclusão do MyID de onde vieram as respostas (fonte "myid") foi registrada no histórico, pela mesma regra
  // do marco "MyID concluído". Sem o vínculo não há data confiável e fica nulo: nunca o updated_at do MyID. As respostas da
  // história atual não têm data.
  diaDoMyid: DataDoMarco | null;
}

// Registro que ficou fora da linha do tempo por falta de uma data que dê para confiar.
export interface RegistroIgnorado {
  id: string;
  fonte: FonteDoMarco;
  // Como o profissional reconhece o registro (título, nome do exame...).
  rotulo: string;
  motivo: string;
}

export interface SecaoDoResumo {
  id: string;
  titulo: string;
  linhas: string[];
  origem: OrigemDoDado;
  // O texto é o que o profissional escreveu à mão na tela da avaliação (_secoes.editadas), não o montado pelos campos.
  editada?: boolean;
}

export interface GrupoPorAno {
  ano: string;
  marcos: Marco[];
}

export interface LinhaDoTempo {
  // Mais recente primeiro (a ordem do restante do app).
  marcos: Marco[];
  porAno: GrupoPorAno[];
  semData: ItemSemData[];
  // Registros do profissional que ficaram de fora porque a data não é válida (ex.: "0001-01-01", no futuro).
  // Diagnóstico e exame importado sem data NÃO entram aqui: vão para "Sem data".
  ignorados: number;
  // Quais foram, na ordem em que foram lidos; tem sempre `ignorados` itens.
  registrosIgnorados: RegistroIgnorado[];
  // O que o cliente contou sobre o começo do quadro (queixas e respostas de início). Nulo quando não há nada.
  comoComecou: ComoComecou | null;
}

// Linha lida do banco: pode vir com qualquer coisa nos campos (a tela não confia no formato).
export type LinhaBruta = Record<string, unknown>;

export interface FontesClinicas {
  // pacientes.historico_clinico e pacientes.historia_atual (escritos pelo cliente).
  paciente: LinhaBruta | null;
  // MyID concluídos, só as colunas leves.
  myidConcluidos: LinhaBruta[];
  // O MyID concluído mais recente, com as respostas.
  myidUltimo: LinhaBruta | null;
  // avaliacoes_identidade que nasceram de um MyID (myid_avaliacao_id). O created_at delas é gravado pelo complete-myid no
  // mesmo pedido que conclui o MyID e nenhum update o muda: é a data de conclusão que o updated_at do MyID não garante.
  vinculosMyid: LinhaBruta[];
  avaliacoesVoz: LinhaBruta[];
  historiaVida: LinhaBruta[];
  diagnosticos: LinhaBruta[];
  examesPresenciais: LinhaBruta[];
  examesImportados: LinhaBruta[];
  testesFuncionais: LinhaBruta[];
  escalas: LinhaBruta[];
}

export const FONTES_VAZIAS: FontesClinicas = {
  paciente: null,
  myidConcluidos: [],
  myidUltimo: null,
  vinculosMyid: [],
  avaliacoesVoz: [],
  historiaVida: [],
  diagnosticos: [],
  examesPresenciais: [],
  examesImportados: [],
  testesFuncionais: [],
  escalas: [],
};

export type ChaveDaFonte =
  | 'paciente'
  | 'myid'
  | 'vinculosMyid'
  | 'avaliacoesVoz'
  | 'historiaVida'
  | 'diagnosticos'
  | 'examesPresenciais'
  | 'examesImportados'
  | 'testesFuncionais'
  | 'escalas';

// Fonte que traz uma lista com limite (todas menos o histórico do paciente).
export type ChaveDeLista = Exclude<ChaveDaFonte, 'paciente'>;

// A leitura pediu limite + 1 linhas e veio mais que o limite: a lista está cortada nas mais recentes.
export interface CorteDeFonte {
  fonte: ChaveDeLista;
  nome: string;
  limite: number;
  // Frase pronta para a tela, por exemplo "Diagnósticos: mostrando os 200 mais recentes."
  texto: string;
}

// Texto do aviso "Não consegui ler ...".
export const ROTULO_DA_FONTE: Record<ChaveDaFonte, string> = {
  paciente: 'o histórico clínico e a história atual do cliente',
  myid: 'o MyID',
  vinculosMyid: 'as datas de conclusão do MyID',
  avaliacoesVoz: 'as avaliações presenciais',
  historiaVida: 'a história de vida',
  diagnosticos: 'os diagnósticos',
  examesPresenciais: 'os exames presenciais',
  examesImportados: 'os exames importados',
  testesFuncionais: 'os testes funcionais',
  escalas: 'as escalas',
};

// Nome da leitura só de CONTAGEM dos achados do Avatar, no aviso "Não consegui ler ...". Fica fora de ROTULO_DA_FONTE de
// propósito: não é uma fonte da linha do tempo e nada dela vira marco.
export const ROTULO_DOS_ACHADOS_DO_HISTORICO = 'os achados do histórico';

// Só entra na linha do tempo o que é fato clínico firmado e o que terminou de ser importado. Valores conferidos em
// 20260607211619 (diagnosticos_paciente.tipo: principal | secundario | suspeita; ativo NOT NULL DEFAULT true) e em
// 20260607203748 + supabase/functions/import-exame (exames_importados.status: DEFAULT 'pendente'; a função grava
// 'processado' ao terminar). "suspeita" é hipótese, não diagnóstico.
export const TIPOS_DE_DIAGNOSTICO_QUE_ENTRAM = ['principal', 'secundario'] as const;
export const STATUS_DE_EXAME_IMPORTADO_CONCLUIDO = 'processado';

// Até aqui o app não enviava data_diagnostico (a coluna é `date DEFAULT CURRENT_DATE`, 20260607211619) e o banco a preenchia
// com o dia do cadastro. O cartão de CID passou a enviar a coluna sempre (a data escolhida ou null), então a linha criada
// a partir deste instante tem o valor que o profissional deu, e uma data igual ao dia do cadastro é data real (diagnóstico
// feito e registrado no mesmo dia). É a meia-noite de 18/11/2026 no Brasil; o deploy desta mudança acontece antes dela.
// Limitação: o diagnóstico criado ANTES do corte cuja data real coincidiu por acaso com o dia do cadastro segue em "Sem data".
export const INSTANTE_DA_DATA_EXPLICITA_DO_DIAGNOSTICO = '2026-11-18T03:00:00Z';

// Apelido da coluna que traz, por caminho JSON do PostgREST, a origem do relato em avaliacoes_voz (sem baixar o
// `resultado` inteiro, que é pesado e tem dado clínico que esta tela não usa).
export const CAMPO_ORIGEM_DO_RELATO = 'origem_do_relato';

// Como o profissional reconhece de onde veio um registro, na lista dos que ficaram de fora.
export const NOME_DA_FONTE_DO_MARCO: Record<FonteDoMarco, string> = {
  myid: 'MyID',
  historico_clinico: 'Histórico clínico',
  historia_atual: 'História atual',
  historia_vida: 'História de vida',
  diagnostico: 'Diagnóstico',
  avaliacao_voz: 'Avaliação presencial',
  exame_presencial: 'Exame presencial',
  exame_importado: 'Exame importado',
  teste_funcional: 'Teste funcional',
  escala: 'Escala',
};

export const ROTULO_CIRURGIA_DO_CLIENTE = 'Cirurgia ou internação';
export const MOTIVO_DATA_NAO_VALIDA = 'data ausente, inválida ou no futuro';

// Rótulos exatos das perguntas do cliente (os mesmos que já apareciam nos títulos de "Sem data").
export const ROTULO_QUEIXA_HISTORIA_ATUAL = 'Queixa principal (história atual)';
export const ROTULO_QUEIXA_MYID = 'Queixa principal (MyID)';
export const ROTULO_INICIO_HISTORIA_ATUAL = 'Há quanto tempo começou (história atual)';
export const ROTULO_FAIXA_MYID = 'Quando começou (faixa escolhida no MyID)';
export const ROTULO_QUANDO_MYID = 'Quando começou (texto escrito no MyID)';
export const ROTULO_O_QUE_FAZIA_MYID = 'O que estava fazendo quando notou (MyID)';

export const SELO_CLIENTE = 'Relatado pelo cliente, não revisado';
export const SELO_PROFISSIONAL = 'Registrado pelo profissional';
export const ROTULO_REGISTRO_NO_APP = 'registro no app';

export const TITULO_MYID_CONCLUIDO = 'MyID concluído';
export const DETALHE_MYID_CONCLUIDO = 'Concluído e registrado no histórico do paciente.';
// updated_at do MyID é mudado por qualquer update (trigger), até por correção de cálculo meses depois: sem a data do
// histórico, não se afirma "concluído".
export const TITULO_MYID_ULTIMO_REGISTRO = 'MyID (último registro)';
export const DETALHE_MYID_ULTIMO_REGISTRO = 'Data do último registro; pode ser posterior à conclusão.';

export const DETALHE_DATA_LIDA_DO_DOCUMENTO = 'Data lida automaticamente do documento; confira no arquivo.';
