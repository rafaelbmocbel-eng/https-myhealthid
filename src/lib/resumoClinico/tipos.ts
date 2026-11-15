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

export type TipoDoMarco =
  | 'cirurgia'
  | 'evento_de_vida'
  | 'diagnostico'
  | 'myid'
  | 'historico'
  | 'avaliacao'
  | 'exame'
  | 'teste'
  | 'escala';

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

// Só entra na linha do tempo o que é fato clínico firmado e o que terminou de ser importado. Valores conferidos em
// 20260607211619 (diagnosticos_paciente.tipo: principal | secundario | suspeita; ativo NOT NULL DEFAULT true) e em
// 20260607203748 + supabase/functions/import-exame (exames_importados.status: DEFAULT 'pendente'; a função grava
// 'processado' ao terminar). "suspeita" é hipótese, não diagnóstico.
export const TIPOS_DE_DIAGNOSTICO_QUE_ENTRAM = ['principal', 'secundario'] as const;
export const STATUS_DE_EXAME_IMPORTADO_CONCLUIDO = 'processado';

// Apelido da coluna que traz, por caminho JSON do PostgREST, a origem do relato em avaliacoes_voz (sem baixar o
// `resultado` inteiro, que é pesado e tem dado clínico que esta tela não usa).
export const CAMPO_ORIGEM_DO_RELATO = 'origem_do_relato';

export const SELO_CLIENTE = 'Relatado pelo cliente, não revisado';
export const SELO_PROFISSIONAL = 'Registrado pelo profissional';
export const ROTULO_REGISTRO_NO_APP = 'registro no app';

export const TITULO_MYID_CONCLUIDO = 'MyID concluído';
export const DETALHE_MYID_CONCLUIDO = 'Data em que a conclusão foi registrada no histórico do paciente.';
// updated_at do MyID é mudado por qualquer update (trigger), até por correção de cálculo meses depois: sem a data do
// histórico, não se afirma "concluído".
export const TITULO_MYID_ULTIMO_REGISTRO = 'MyID (último registro)';
export const DETALHE_MYID_ULTIMO_REGISTRO = 'Data do último registro; pode ser posterior à conclusão.';

export const DETALHE_DATA_LIDA_DO_DOCUMENTO = 'Data lida automaticamente do documento; confira no arquivo.';
