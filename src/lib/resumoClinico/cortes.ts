import type { ChaveDeLista, CorteDeFonte } from './tipos';

// Nome curto de cada lista que a leitura corta, como aparece no aviso. A frase não depende do gênero do nome
// ("Diagnósticos: mostrando os 200 mais recentes.").
const NOME_DA_FONTE_NO_AVISO: Record<ChaveDeLista, string> = {
  myid: 'MyIDs',
  vinculosMyid: 'Datas de conclusão do MyID',
  avaliacoesVoz: 'Avaliações presenciais',
  historiaVida: 'História de vida',
  diagnosticos: 'Diagnósticos',
  examesPresenciais: 'Exames presenciais',
  examesImportados: 'Exames importados',
  testesFuncionais: 'Testes funcionais',
  escalas: 'Escalas',
};

export function montarCorte(fonte: ChaveDeLista, limite: number): CorteDeFonte {
  const nome = NOME_DA_FONTE_NO_AVISO[fonte];
  return { fonte, nome, limite, texto: `${nome}: mostrando os ${limite} mais recentes.` };
}

// A contagem dos achados lê um número fixo de linhas, sem ordem por data (nenhuma data de achado é lida): por isso o texto
// não diz "mais recentes", e sim que a contagem pode estar menor que a real.
export interface CorteDaContagemDosAchados {
  limite: number;
  texto: string;
}

export function montarCorteDosAchados(limite: number): CorteDaContagemDosAchados {
  return { limite, texto: `Achados do histórico: contei só os ${limite} primeiros; pode haver mais aguardando a sua revisão.` };
}
