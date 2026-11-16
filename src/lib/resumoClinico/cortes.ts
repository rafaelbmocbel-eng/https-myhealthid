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
