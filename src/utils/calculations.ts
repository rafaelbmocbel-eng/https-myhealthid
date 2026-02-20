import { Bloco1Data, Bloco2Data, Bloco3Data, Bloco4Data, Bloco5Data, Bloco6Data } from '../types/identidade';

// CÁLCULO SCORE F – Fator Contextual (Bloco 1)
export function calcularScoreF(bloco1: Bloco1Data): number {
  const mediaLikert = (
    bloco1.impactoQualidadeVida +
    bloco1.interferenciaTrbalho +
    bloco1.quantidadeComorbidades * 2 +
    bloco1.historicoFamiliarPeso
  ) / 4;

  const bonusComorbidades = Math.min(bloco1.historicoMedico.length, 3);
  const bonusCronicidade = ['6-12 meses', '>1 ano'].includes(bloco1.duracao) ? 2 : 0;

  return Math.min(10, mediaLikert + bonusComorbidades * 0.5 + bonusCronicidade * 0.5);
}

// CÁLCULO SCORE D – Dor Multidimensional (Bloco 2)
// Implementado conforme Apostila Método Identidade v8.0
export function calcularScoreD(bloco2: Bloco2Data): number {
  if (bloco2.regioes.length === 0) return 0;

  const PESO_TIPO: Record<string, number> = {
    'Ardor': 1.3,
    'Queimação': 1.3,
    'Dormência': 1.2,
    'Pontada': 1.1,
    'Rigidez': 0.9,
    'Peso/Pressão': 1.0,
    'Dor profunda': 1.0,
  };

  let somaRegiao = 0;

  bloco2.regioes.forEach(regiao => {
    // Base: intensidade normalizada (0-1)
    let dBase = regiao.intensidade / 10;

    // Peso do tipo de dor: pegar o maior peso entre os tipos selecionados
    let pesotTipo = 1.0;
    if (regiao.tipos.length > 0) {
      pesotTipo = Math.max(...regiao.tipos.map(t => PESO_TIPO[t] ?? 1.0));
    }
    let dRegiao = dBase * pesotTipo;

    // Modificadores dinâmicos
    if (regiao.irradiacao) dRegiao *= 1.2;
    if (regiao.frequencia === 'Contínua (24h)') dRegiao *= 1.15;
    else if (regiao.frequencia === 'Noturna (afeta sono)') dRegiao *= 1.1;
    else if (regiao.frequencia === 'Ao movimento específico') dRegiao *= 0.95;

    if (regiao.fatoresPiora && regiao.fatoresPiora.length >= 4) dRegiao *= 1.05;
    if (regiao.fatoresMelhora && regiao.fatoresMelhora.length >= 3) dRegiao /= 1.1;

    somaRegiao += dRegiao;
  });

  // Média por região + bônus por múltiplos locais de dor (cada extra +0.5, máx +3)
  const mediaRegiao = (somaRegiao / bloco2.regioes.length) * 10;
  const bonusMultiSite = Math.min(3, (bloco2.regioes.length - 1) * 0.5);
  const dFinal = mediaRegiao + bonusMultiSite;
  return Math.min(10, Math.max(0, Math.round(dFinal * 10) / 10));
}

// CÁLCULO SCORE EFI – Funcionalidade (Bloco 3)
export function calcularScoreEFI(bloco3: Bloco3Data): number {
  return (bloco3.trabalho + bloco3.domesticas + bloco3.exercicio + bloco3.independencia + bloco3.vidaSocial) / 5;
}

// CÁLCULO SCORE P – Cinesiofobia TSK-11 (Bloco 4)
// Todos os itens são diretos: "Concordo Fortemente" (4) = máxima cinesiofobia.
// Soma bruta varia de 11 (mínimo) a 44 (máximo), normalizada para 0-10.
export function calcularScoreP(bloco4: Bloco4Data): number {
  const soma = bloco4.respostas.reduce((acc, resp) => acc + (resp || 0), 0);
  // Normalizar 11-44 para 0-10
  const score = ((soma - 11) / 33) * 10;
  return Math.max(0, Math.min(10, Math.round(score * 10) / 10));
}

// CÁLCULO SCORES R e C (Bloco 5)
// R1, R2, R3 → 0-10 onde 10 = bom (sem inversão dupla)
// As perguntas já têm a lógica embutida: onde maior = melhor não precisam inversão
export function calcularScoresRC(bloco5: Bloco5Data): { r1: number; r2: number; r3: number; r: number; c: number } {
  // R1 – Sono (0=ótimo, 10=péssimo) — ALTO = RUIM
  const r1 = ((10 - bloco5.qualidadeSono) + (10 - bloco5.horasSono) + bloco5.acordaNaNoite + bloco5.dorAfetaSono + (10 - bloco5.descansadoAoAcordar)) / 5;

  // R2 – Energia (0=pleno, 10=esgotado) — ALTO = RUIM
  const r2 = ((10 - bloco5.energiaAoAcordar) + bloco5.fadigaDia + bloco5.precisaCochiblar + (10 - bloco5.motivacao) + (10 - bloco5.resistenciaFisica)) / 5;

  // R3 – Psicológico (0=ótimo, 10=comprometido) — ALTO = RUIM
  const r3 = (bloco5.nivelStress + (10 - bloco5.humorGeral) + (10 - bloco5.concentracao) + bloco5.preocupacaoSaude + (10 - bloco5.sensacaoControle)) / 5;

  const r = (r1 + r2 + r3) / 3;
  const c = (bloco5.cargaLaboral + bloco5.relacionamentos + bloco5.situacaoFinanceira + bloco5.eventosEstressantes) / 4;

  return { r1, r2, r3, r, c };
}

// CÁLCULO SCORE E – Estrutural (Bloco 6)
export function calcularScoreE(bloco6: Bloco6Data): number {
  if (bloco6.unidades.length === 0) return 0;
  const soma = bloco6.unidades.reduce((acc, u) => acc + u.score, 0);
  return soma / bloco6.unidades.length;
}

// CÁLCULO ID FINAL
export function calcularIDFinal(
  e: number, p: number, c: number, f: number, d: number, r: number
): { idFinal: number; fatoresRisco: string[]; classificacao: string } {
  // R alto = ruim (sem controle neurovegetativo). Quanto pior R, mais amplifica o resultado.
  // Converter para qualidade (0 = sem controle = pior, 10 = pleno controle)
  const qualidadeRegulacao = 10 - r;
  // Divisor agressivo: R=10 → divisor=0.5 → multiplica por 20x; R=0 → divisor=10 → multiplica por 1x
  const rDivisor = Math.max(qualidadeRegulacao, 0.5);
  // R também entra como componente direto adicional (peso 0.10) para garantir impacto mesmo com scores baixos
  let idBase = ((e * 0.18) + (p * 0.25) + (c * 0.25) + (r * 0.12) + (f * 0.10) + (d * 0.10)) * (10 / rDivisor);

  const fatoresRisco: string[] = [];
  if (p > 7) { idBase += 3; fatoresRisco.push('Cinesiofobia acentuada (P > 7) → +3'); }
  if (c > 7) { idBase += 3; fatoresRisco.push('Carga contextual excessiva (C > 7) → +3'); }
  // R com limiares escalonados: comprometimento progressivo
  if (r > 8) { idBase += 5; fatoresRisco.push('Regulação neurovegetativa crítica (R > 8) → +5'); }
  else if (r > 6) { idBase += 3; fatoresRisco.push('Regulação neurovegetativa comprometida (R > 6) → +3'); }
  if (d > 8) { idBase += 1; fatoresRisco.push('Dor intensa com irradiação (D > 8) → +1'); }

  const idFinal = Math.round(idBase * 10) / 10;

  let classificacao = 'LEVE';
  if (idFinal > 40) classificacao = 'EXTREMO';
  else if (idFinal > 30) classificacao = 'CRÍTICO';
  else if (idFinal > 20) classificacao = 'SEVERO';
  else if (idFinal > 10) classificacao = 'MODERADO';

  return { idFinal, fatoresRisco, classificacao };
}

// Cálculo do modulador de estilo de vida (0–2 pontos extras)
export function calcularModuladorEstiloVida(bloco1: Bloco1Data): { modulador: number; fatores: string[] } {
  let mod = 0;
  const fatores: string[] = [];

  // Sedentarismo: >8h/dia = risco
  if (bloco1.horasSedentario >= 10) { mod += 0.5; fatores.push('Sedentarismo severo (≥10h)'); }
  else if (bloco1.horasSedentario >= 8) { mod += 0.3; fatores.push('Sedentarismo moderado (≥8h)'); }

  // Álcool: >2x/semana
  if (bloco1.alcool === 'frequente') { mod += 0.4; fatores.push('Álcool frequente (>3×/sem)'); }
  else if (bloco1.alcool === 'moderado') { mod += 0.2; fatores.push('Álcool moderado (1-3×/sem)'); }

  // Tabagismo
  if (bloco1.tabagismo) { mod += 0.4; fatores.push('Tabagismo ativo'); }

  // Pouca água: <1.5L/dia
  if ((bloco1.litrosAgua ?? 2) < 1) { mod += 0.3; fatores.push('Ingestão hídrica insuficiente (<1L)'); }
  else if ((bloco1.litrosAgua ?? 2) < 1.5) { mod += 0.15; fatores.push('Ingestão hídrica baixa (<1.5L)'); }

  // Comorbidades (histórico médico)
  if (bloco1.historicoMedico.length >= 4) { mod += 0.4; fatores.push(`${bloco1.historicoMedico.length} comorbidades`); }
  else if (bloco1.historicoMedico.length >= 2) { mod += 0.2; fatores.push(`${bloco1.historicoMedico.length} comorbidades`); }

  // Histórico familiar
  if (bloco1.historicoFamiliar) { mod += 0.2; fatores.push('Histórico familiar relevante'); }

  return { modulador: Math.min(2, mod), fatores };
}

// EQUAÇÃO DA DOR IDENTIDADE (4 dimensões – Apostila v8.0 + Moduladores Estilo de Vida)
// Pesos revisados: maior comprometimento para componentes biopsicossociais e neurovegetativos
export function calcularEquacaoDor(
  d: number,
  temIrradiacao: boolean,
  tipoDorPeso: number,
  p: number,
  r3: number,
  c: number,
  fCronicidade: number,
  r: number,
  moduladorEstiloVida: number = 0
): { total: number; sensorio: number; afetiva: number; cognitiva: number; neurovegetativa: number; estiloVida: number } {
  // D_sensório = (D×0.4) + (irradiação×2) + (tipoPeso×1)
  const sensorio = (d * 0.4) + (temIrradiacao ? 2 : 0) + (tipoDorPeso * 1);

  // D_afetiva = (P×0.7) + (R3×0.5) — pesos aumentados para cinesiofobia e psicológico
  const afetiva = (p * 0.7) + (r3 * 0.5);

  // D_cognitiva = (C×0.6) + (Fcronicidade×0.4) — peso maior para carga contextual
  const cronificacaoBonus = fCronicidade >= 3 ? fCronicidade * 0.1 : 0;
  const cognitiva = (c * 0.6) + (fCronicidade * 0.4) + cronificacaoBonus;

  // D_neurovegetativa = R×1.2 — peso máximo para regulação neurovegetativa (0=sem controle=pior)
  // R alto = sem regulação = amplifica dor significativamente
  const neurovegetativa = r * 1.2;

  // Estilo de vida como 5ª dimensão moduladora
  const estiloVida = moduladorEstiloVida;

  // Total raw, normalizar para 0-10
  const raw = sensorio + afetiva + cognitiva + neurovegetativa + estiloVida;
  const total = Math.min(10, Math.max(0, Math.round((raw / 3.5) * 10) / 10));

  return {
    total,
    sensorio: Math.min(10, Math.round(sensorio * 10) / 10),
    afetiva: Math.min(10, Math.round(afetiva * 10) / 10),
    cognitiva: Math.min(10, Math.round(cognitiva * 10) / 10),
    neurovegetativa: Math.min(10, Math.round(neurovegetativa * 10) / 10),
    estiloVida: Math.round(estiloVida * 10) / 10,
  };
}

// Helper: converter duração para fator de cronicidade (0-10)
export function duracaoParaCronicidade(duracao: string): number {
  const map: Record<string, number> = {
    '<2 semanas': 0,
    '2-4 semanas': 1,
    '1-3 meses': 3,
    '3-6 meses': 5,
    '6-12 meses': 7,
    '>1 ano': 8,
    '>2 anos': 10,
  };
  return map[duracao] ?? 3;
}

// CÁLCULO RISCO PROGRESSÃO COB° ZERO (Lonstein & Carlson)
export function calcularRiscoProgressao(cobbAngle: number, sexo: 'M' | 'F', risser: number): { percentage: number; level: string } {
  const sexoNum = sexo === 'F' ? 1 : 0;
  let risk = 0.24 * cobbAngle + 0.41 * sexoNum - 3.93;
  
  // Ajuste Risser
  if (risser <= 2) risk *= 1.5;
  else if (risser === 3) risk *= 1.25;
  else risk *= 0.5;

  const percentage = Math.max(0, Math.min(100, Math.round(risk)));
  let level = 'BAIXO';
  if (percentage > 50) level = 'ALTO';
  else if (percentage > 25) level = 'MODERADO';

  return { percentage, level };
}

// UTILITÁRIOS
export function getSeverityColor(classificacao: string): string {
  switch (classificacao) {
    case 'LEVE': return 'text-green-600 bg-green-50 border-green-200';
    case 'MODERADO': return 'text-amber-600 bg-amber-50 border-amber-200';
    case 'SEVERO': return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'CRÍTICO': return 'text-red-600 bg-red-50 border-red-200';
    case 'EXTREMO': return 'text-purple-700 bg-purple-50 border-purple-200';
    default: return 'text-muted-foreground bg-muted border-border';
  }
}

export function getSeverityColorHex(score: number): string {
  if (score <= 3) return '#22c55e';
  if (score <= 5) return '#f59e0b';
  if (score <= 7) return '#f97316';
  if (score <= 9) return '#ef4444';
  return '#9333ea';
}

export function getCobbClassification(cobb: number): { label: string; color: string } {
  if (cobb < 10) return { label: 'Normal', color: 'text-green-600 bg-green-50' };
  if (cobb < 25) return { label: 'LEVE', color: 'text-green-600 bg-green-50' };
  if (cobb < 40) return { label: 'MODERADO', color: 'text-amber-600 bg-amber-50' };
  if (cobb < 50) return { label: 'SEVERO', color: 'text-orange-600 bg-orange-50' };
  return { label: 'CRÍTICO', color: 'text-red-600 bg-red-50' };
}
