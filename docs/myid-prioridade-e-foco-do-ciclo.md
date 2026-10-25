# MyID: prioridade das perdas e foco do ciclo (tela do profissional)

Só o profissional vê. O cliente não muda.

## Fechamento da conta e concentração das perdas

Em **Entenda este resultado** (aba Diagnóstico da visão integrada):

- **Onde estão as perdas**: as 3 maiores perdas e quanto somam do total (%), barras das 5 maiores com "% do máximo
  da dimensão" e o **teto aritmético** (a nota se essas dimensões chegassem a perda zero). O teto não é meta clínica:
  é o máximo que a tabela de perdas permite.
- **Fechamento da conta**: dimensões + sinais de alerta (3 pts cada, no máximo 15) + medicação = total perdido, e
  `100 − total = nota` (a nota para em 0 quando as perdas passam de 100). Antes a tela mostrava "100 − 82,3 = 17,7" para
  um MyID de 9,7, porque ficavam de fora os sinais de alerta e a medicação.

Código: `src/utils/myid/prioridadePerdas.ts` (puro; teste contra o `MyIDCalculator` real),
`src/components/myid/MyIDPrioridadePerdas.tsx`. Resultados antigos sem `perdas_calculadas` mantêm a caixa anterior.

## Foco do ciclo

O profissional marca de **1 a 3 dimensões** (botão de alvo em cada item da lista) para trabalhar com o paciente. Quando
chega um MyID mais novo que o de início do ciclo, a tela mostra, por dimensão do foco, os pontos perdidos antes e agora
(negativo = melhorou), a nota do MyID antes e depois e o que **piorou fora do foco** (a partir de 1 ponto).

- Tabela `myid_foco_ciclo` (migração `20261025130000`): RLS só do profissional dono do paciente; 1 a 3 dimensões válidas
  e sem repetição garantidas no banco; **um ciclo aberto** por paciente e profissional (os encerrados ficam de
  histórico); o MyID-base precisa ser do mesmo paciente; apagar o MyID-base preserva o ciclo.
- Tirar a última dimensão encerra o ciclo. "Reiniciar a partir deste MyID" troca a base numa única atualização.
- Código: `src/utils/myid/focoCiclo.ts`, `src/hooks/useFocoCiclo.ts`, `src/components/myid/MyIDFocoCiclo.tsx`.
- A comparação usa o resultado gravado de cada MyID (`avaliacoes_identidade.myid_analysis`); se algum dos dois não traz as
  perdas por dimensão, a tela diz que não dá para comparar.

## O que ficou de fora de propósito

- Agrupar as dimensões por tipo de conduta (tratar na clínica / orientar hábitos / encaminhar): é decisão clínica do
  dono do produto.
- Mudar pesos e faixas da tabela de perdas: calibração por evidência, decisão clínica.
