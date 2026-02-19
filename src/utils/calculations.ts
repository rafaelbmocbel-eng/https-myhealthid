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
export function calcularScoreD(bloco2: Bloco2Data): number {
  if (bloco2.regioes.length === 0) return 0;

  let somaRegiao = 0;
  bloco2.regioes.forEach(regiao => {
    let peso = regiao.intensidade;
    if (regiao.irradiacao) peso *= 1.2;
    if (regiao.frequencia === 'Contínua (24h)') peso *= 1.1;
    if (regiao.frequencia === 'Noturna (afeta sono)') peso *= 1.05;
    if (regiao.fatoresMelhora.length >= 3) peso /= 1.1;
    somaRegiao += peso;
  });

  const dRegioes = somaRegiao / bloco2.regioes.length;

  // Tipos de dor
  let dTipos = 0;
  bloco2.regioes.forEach(regiao => {
    const tiposGraves = ['Ardor', 'Queimação', 'Dormência'];
    tiposGraves.forEach(t => {
      if (regiao.tipos.includes(t)) dTipos += 0.3;
    });
    const tiposModerad = ['Pontada', 'Rigidez', 'Peso/Pressão', 'Dor profunda'];
    tiposModerad.forEach(t => {
      if (regiao.tipos.includes(t)) dTipos += 0.1;
    });
  });

  const dFinal = (dRegioes + Math.min(dTipos, 10)) / 2;
  return Math.min(10, dFinal);
}

// CÁLCULO SCORE EFI – Funcionalidade (Bloco 3)
export function calcularScoreEFI(bloco3: Bloco3Data): number {
  return (bloco3.trabalho + bloco3.domesticas + bloco3.exercicio + bloco3.independencia + bloco3.vidaSocial) / 5;
}

// CÁLCULO SCORE P – Kinesiophobia TSK-11 (Bloco 4)
export function calcularScoreP(bloco4: Bloco4Data): number {
  const itensInvertidos = [0, 3, 5, 9]; // índices 0-based
  let soma = 0;
  bloco4.respostas.forEach((resp, idx) => {
    if (itensInvertidos.includes(idx)) {
      soma += (5 - resp); // inverter escala 1-4
    } else {
      soma += resp;
    }
  });
  // Normalizar 11-44 para 0-10
  return ((soma - 11) / 33) * 10;
}

// CÁLCULO SCORES R e C (Bloco 5)
export function calcularScoresRC(bloco5: Bloco5Data): { r1: number; r2: number; r3: number; r: number; c: number } {
  const r1Media = (bloco5.qualidadeSono + bloco5.horasSono + (10 - bloco5.acordaNaNoite) + (10 - bloco5.dorAfetaSono) + bloco5.descansadoAoAcordar) / 5;
  const r1 = 10 - r1Media; // invertido
  
  const r2Media = (bloco5.energiaAoAcordar + (10 - bloco5.fadigaDia) + (10 - bloco5.precisaCochiblar) + bloco5.motivacao + bloco5.resistenciaFisica) / 5;
  const r2 = 10 - r2Media;
  
  const r3Media = ((10 - bloco5.nivelStress) + bloco5.humorGeral + bloco5.concentracao + (10 - bloco5.preocupacaoSaude) + bloco5.sensacaoControle) / 5;
  const r3 = 10 - r3Media;
  
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
  const rDivisor = Math.max(r, 0.5); // evitar divisão por zero
  let idBase = ((e * 0.30) + (p * 0.20) + (c * 0.20) + (f * 0.15) + (d * 0.10)) * (10 / rDivisor);

  const fatoresRisco: string[] = [];
  if (p > 7) { idBase += 2; fatoresRisco.push('Kinesiophobia acentuada (P > 7) → +2'); }
  if (c > 8) { idBase += 2; fatoresRisco.push('Carga contextual excessiva (C > 8) → +2'); }
  if (r < 3) { idBase += 3; fatoresRisco.push('Regulação neurovegetativa crítica (R < 3) → +3'); }
  if (d > 8) { idBase += 1; fatoresRisco.push('Dor intensa com irradiação → +1'); }

  const idFinal = Math.round(idBase * 10) / 10;

  let classificacao = 'LEVE';
  if (idFinal > 40) classificacao = 'EXTREMO';
  else if (idFinal > 30) classificacao = 'CRÍTICO';
  else if (idFinal > 20) classificacao = 'SEVERO';
  else if (idFinal > 10) classificacao = 'MODERADO';

  return { idFinal, fatoresRisco, classificacao };
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
