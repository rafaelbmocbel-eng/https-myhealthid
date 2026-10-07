// Números fixos do prompt do plano alimentar, num só lugar.
//
// Estes valores já estavam escritos no prompt da edge function gerar-plano-alimentar.
// Nenhum deles tem fonte confirmada: ficam `status: "a_confirmar"` e `fonte: null`
// até um nutricionista validar e informar a referência. NÃO preencha `fonte` com
// uma referência de memória — só com a que o profissional confirmar.
//
// O prompt é montado a partir desta lista (textoCalculoNutricional), então o
// registro de governança e o que a IA recebe não podem divergir.
import { parametro, valorParametro, type ParametroPlano } from "./governanca-plano.ts";

export const PARAMETROS_NUTRICAO: readonly ParametroPlano[] = [
  parametro("formula_tmb", "Fórmula da taxa metabólica basal", "Mifflin-St Jeor, ou Cunningham/Katch se houver massa magra da bioimpedância"),
  parametro("gasto_energetico", "Gasto energético total", "TMB × fator de atividade (TDEE)"),
  parametro("deficit_emagrecimento", "Déficit calórico no emagrecimento", "15-20%"),
  parametro("piso_kcal_mulher", "Piso calórico — mulher", "~1200 kcal"),
  parametro("piso_kcal_homem", "Piso calórico — homem", "~1500 kcal"),
  parametro("superavit_ganho", "Superávit calórico em hipertrofia/ganho", "5-15%"),
  parametro("proteina_g_kg", "Proteína", "1,6-2,2 g/kg de peso"),
  parametro("gordura_g_kg", "Gordura", "0,6-1,0 g/kg"),
  parametro("gordura_minimo_pct", "Gordura — mínimo das calorias", "~20% das kcal"),
  parametro("hidratacao_ml_kg", "Hidratação", "30-35 ml/kg/dia"),
  parametro("refeicoes_por_dia", "Número de refeições por dia", "4-6"),
];

/** Trecho "CÁLCULO E EVIDÊNCIA" do prompt, montado a partir dos parâmetros. */
export function textoCalculoNutricional(lista: readonly ParametroPlano[] = PARAMETROS_NUTRICAO): string {
  const v = (c: string) => valorParametro(lista, c);
  return [
    `- Estime o gasto energético: TMB (${v("formula_tmb")}) × fator de atividade → TDEE. Aplique o ajuste do OBJETIVO: emagrecimento = déficit de ${v("deficit_emagrecimento")} (nunca abaixo de ${v("piso_kcal_mulher")} mulher / ${v("piso_kcal_homem")} homem); hipertrofia/ganho = superávit de ${v("superavit_ganho")}; manutenção/saúde = isocalórico. Deixe a calorias_totais coerente com esse cálculo.`,
    `- Proteína: ${v("proteina_g_kg")} (mais alto em emagrecimento com treino e em idosos, para preservar massa magra). Gordura: ${v("gordura_g_kg")} (mínimo ${v("gordura_minimo_pct")}). Carboidrato: completa o restante das calorias, priorizando os de baixo índice glicêmico e ao redor do treino.`,
    `- Respeite comorbidades e o perfil clínico: hipertensão = menos sódio; resistência à insulina/diabetes = controle glicêmico e fibras; dor/inflamação = padrão anti-inflamatório (ômega-3, coloridos). Nunca prescreva suplementação de risco nem conduta fora do escopo nutricional.`,
    `- Distribua em ${v("refeicoes_por_dia")} refeições coerentes com a rotina; se houver treino, oriente pré e pós-treino. Hidratação: ${v("hidratacao_ml_kg")}.`,
  ].join("\n");
}
