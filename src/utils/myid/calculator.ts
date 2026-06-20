import {
    MyIDBloco1Data, MyIDBloco2Data, MyIDBloco3Data,
    MyIDBloco4Data, MyIDBloco5Data, MyIDBloco6Data,
    MyIDResult as MyIDResultType, FingerprintRing
} from '@/types/myid';
import { getMyIDInterpretation } from '@/utils/myidCalculations';
import {
    TABELA_PERDAS, calcularPerdaDimensao, calcularPerdaMedicamentos,
    classificarMyID100, identificarDriver, identificarCoDrivers, PerdaCalculada, MyID100Result,
    DriverPrimario, DIMENSION_LABELS, DIMENSION_COLORS, TEMPLATES_INTERPRETACAO,
} from './lossTable';

const RED_FLAG_LABELS: Record<string, string> = {
    weight_loss: 'Perda de peso inexplicada e rápida',
    fever: 'Febre inexplicada, calafrios ou suores noturnos frequentes',
    night_pain: 'Dor severa noturna que não melhora com mudança de posição',
    incontinence: 'Perda recente do controle da urina/fezes ou dormência em sela',
    progressive: 'Fraqueza grave progressiva nas pernas/braços',
    neuropathy: 'Dormência/formigamento severo descendo por um braço ou perna inteira',
};

export interface MyIDResponses extends Record<string, any> {
    session_id?: string;
    bloco1?: MyIDBloco1Data;
    bloco2?: MyIDBloco2Data;
    bloco3?: MyIDBloco3Data;
    bloco4?: MyIDBloco4Data;
    bloco5?: MyIDBloco5Data;
    bloco6?: MyIDBloco6Data;
}


export class MyIDCalculator {
    responses: MyIDResponses;
    scores: Record<string, number> = {};
    perdas: Record<string, PerdaCalculada> = {};
    result: Record<string, any> = {};

    constructor(responses: MyIDResponses) {
        this.responses = responses;
    }

    normalizeTo10(value: number, maxValue: number = 10): number {
        if (maxValue === 0) return 0;
        return parseFloat(((value / maxValue) * 10).toFixed(2));
    }

    // ==================== BLOCO 1: INÉRCIA (I) ====================
    calculateInertia(): number {
        const b1 = this.responses.bloco1;
        const changes: string[] = this.responses.bloco_1_changes || b1?.mudancas_recentes || b1?.mudancasRecentes || [];
        const PESOS_MUDANCA: Record<string, number> = {
            scare: 3,     // susto físico / quase-lesão — maior risco
            load: 2,      // aumento de carga
            posture: 1.5, // mudança postural / contexto
            equipment: 1, // novo equipamento
            // mudanças legado (texto completo) — manter compatibilidade
            'Susto físico (Movimento em falso, quase escorregão, "travada")': 3,
            'Aumento de carga (Mais treino, nova atividade, competição)': 2,
            'Mudança de postura (Mais tempo sentado, home office, viagem longa)': 1.5,
            'Novo equipamento (Tênis, colchão, travesseiro, cadeira de trabalho)': 1,
        };
        const iPoints = changes
            .filter(m => m !== 'none' && m !== 'Nenhuma mudança que eu note')
            .reduce((sum, m) => sum + (PESOS_MUDANCA[m] ?? 1.5), 0);
        const iNormalized = Math.min(iPoints, 10);
        this.scores['I'] = iNormalized;
        return iNormalized;
    }

    // ==================== BLOCO 2: DOR (D) ====================
    calculatePain(): number {
        const painNow = this.responses.bloco_2_pain_now;
        const painMax = this.responses.bloco_2_pain_max;

        if (painNow !== undefined && painMax !== undefined) {
            const d = (painNow + painMax) / 2;
            this.scores['D'] = Math.round(d * 10) / 10;
            return this.scores['D'];
        }

        const regioes = this.responses.bloco2?.regioes || [];
        if (regioes.length === 0) { this.scores['D'] = 0; return 0; }

        const somas = regioes.reduce(
            (acc, r) => ({ atual: acc.atual + r.intensidadeAtual, max: acc.max + r.intensidadeMaxima }),
            { atual: 0, max: 0 }
        );
        const d = (somas.atual + somas.max) / (2 * regioes.length);

        // Fator de múltiplas regiões: cada região adicional adiciona 8% de peso (máx 40%)
        const nRegioes = regioes.length;
        const fatorMultiRegiao = 1 + Math.min((nRegioes - 1) * 0.08, 0.40);

        // Variabilidade da dor: quanto maior a diferença melhorDia vs máxima, melhor o prognóstico
        // Paciente que fica bem ocasionalmente tem dor mais mecânica (bom sinal)
        const regiaoMaisGrave = regioes.reduce((prev, curr) =>
            curr.intensidadeAtual > prev.intensidadeAtual ? curr : prev
        );
        const variabilidade = regiaoMaisGrave.intensidadeMaxima > 0
            ? (regiaoMaisGrave.intensidadeMaxima - (regiaoMaisGrave.intensidadeMelhorDia ?? regiaoMaisGrave.intensidadeAtual)) / regiaoMaisGrave.intensidadeMaxima
            : 0;
        // Alta variabilidade = dor mecânica = redução de até 10% no score D
        const bonusVariabilidade = variabilidade * 0.10;

        const dAjustado = Math.min(10, d * fatorMultiRegiao * (1 - bonusVariabilidade));
        this.scores['D'] = Math.min(10, Math.round(dAjustado * 10) / 10);
        return this.scores['D'];
    }

    detectRedFlags(): boolean {
        const flags = this.responses.bloco_2_red_flags || this.responses.bloco2?.redFlags || {};
        const criticalFlags = {
            weight_loss: !!(flags.weight_loss || flags.perdaPeso),
            fever: !!(flags.fever || flags.febreCalafrios),
            night_pain: !!(flags.night_pain || flags.dorNoturnaImpedeSono),
            incontinence: !!(flags.incontinence || flags.alteracaoEsfincteriana),
            progressive: !!(flags.progressive || flags.dorPioraConsistente),
            neuropathy: !!(flags.neuropathy || flags.dormenciaProgressiva),
        };
        this.result.red_flags_detected = Object.values(criticalFlags).some(v => v === true);
        this.result.red_flags = criticalFlags;
        this.result.red_flag_alerts = Object.entries(criticalFlags)
            .filter(([, active]) => active === true)
            .map(([id]) => RED_FLAG_LABELS[id] || id);
        return this.result.red_flags_detected || false;
    }

    detectPainPattern(): string {
        const regions = this.responses.bloco2?.regioes || [];
        const allTypes = regions.flatMap(r => r.tiposDor || []);
        let patternType = 'Mecânico Adaptativo';
        if (allTypes.includes('Queimação') || allTypes.includes('Dormência')) patternType = 'Isquêmico / Neuropático';
        else if (allTypes.includes('Peso/Pressão')) patternType = 'Congestivo / Mecânico';
        this.result.pain_pattern = patternType;
        return patternType;
    }

    // ==================== BLOCO 3: FUNCIONALIDADE (EFI) ====================
    calculateFunctionality(): number {
        const work = this.responses.bloco_3_work ?? this.responses.bloco3?.trabalho;
        const efiValues = [
            work === 'na' ? null : (work ?? 0),
            this.responses.bloco_3_home ?? this.responses.bloco3?.domesticas ?? 0,
            this.responses.bloco_3_exercise ?? this.responses.bloco3?.exercicio ?? 0,
            this.responses.bloco_3_independence ?? this.responses.bloco3?.independencia ?? 0,
            this.responses.bloco_3_social ?? this.responses.bloco3?.vidaSocial ?? 0,
        ].filter((v): v is number => v !== null);
        // Pior item domina porque EFI é bem-estar: menor = pior
        const min = Math.min(...efiValues);
        const avg = efiValues.reduce((a, b) => a + b, 0) / efiValues.length;
        const efi = min * 0.6 + avg * 0.4;
        this.scores['EFI'] = Math.round(efi * 10) / 10;
        return this.scores['EFI'];
    }

    // ==================== BLOCO 4: PSICOLÓGICO (P) ====================
    calculatePsychological(): number {
        const fearMovement = this.responses.bloco_4_fear_movement ?? this.responses.bloco4?.medoMovimento ?? 2;
        const beliefDamage = this.responses.bloco_4_belief_damage ?? this.responses.bloco4?.catastrofizacao ?? 2;
        const avoidance = this.responses.bloco_4_avoidance ?? this.responses.bloco4?.evitacao ?? 2;
        const selfEfficacy = this.responses.bloco_4_self_efficacy ?? this.responses.bloco4?.autoeficacia ?? 5;

        const fearNormalized = ((fearMovement - 1) / 3) * 10;
        const beliefNormalized = ((beliefDamage - 1) / 3) * 10;
        const avoidNormalized = ((avoidance - 1) / 3) * 10;
        const selfEfficacyInverted = 10 - selfEfficacy;

        const expectation = this.responses.bloco_4_expectation ?? this.responses.bloco4?.bloco_4_expectation ?? 5;
        const expectationInverted = 10 - expectation; // expectativa baixa = pior prognóstico

        // Pior item domina porque P é perda: maior = pior
        const items = [fearNormalized, beliefNormalized, avoidNormalized, selfEfficacyInverted, expectationInverted];
        const maxItem = Math.max(...items);
        const avg = items.reduce((a, b) => a + b, 0) / items.length;
        const p = maxItem * 0.6 + avg * 0.4;
        this.scores['P'] = Math.min(10, Math.max(0, Math.round(p * 10) / 10));
        return this.scores['P'];
    }

    // ==================== BLOCO 5: REGULAÇÃO (R) ====================
    calculateRegulation(): number {
        const sleepQuality = this.responses.bloco_5a_quality ?? this.responses.bloco5?.qualidadeSono ?? 5;
        const sleepHours = this.responses.bloco_5a_hours ?? this.responses.bloco5?.horasSono ?? 7;
        const sleepHoursNormalized = this.normalizeTo10(sleepHours, 9);
        const awakeMapping: Record<string, number> = { never: 10, nunca: 10, rarely: 7, rarely_v2: 7, moderately: 5, frequently: 3, always: 0 };
        let sleepAwake = awakeMapping[this.responses.bloco_5a_awake || this.responses.bloco5?.acordaPorDor || 'rarely'] ?? 5;
        const disorders = this.responses.bloco_5a_disorders || this.responses.bloco5?.bloco_5a_disorders || [];
        const disorderPenalty = disorders.length * 1.5;
        const rSleep = Math.max(0, ((sleepQuality + sleepHoursNormalized + sleepAwake) / 3) - disorderPenalty);

        const tirednessMapping: Record<string, number> = { never: 10, nunca: 10, sometimes: 6, as_vezes: 6, frequently: 3, always: 0 };
        const wakingTired = tirednessMapping[this.responses.bloco_5b_tired_awake || this.responses.bloco5?.exaustoAoAcordar || 'sometimes'] ?? 5;
        // R2: combina fadiga crônica + estado ao acordar
        const fadiga = this.responses.bloco_5b_fatigue ?? this.responses.bloco5?.fadiga ?? 5;
        const rEnergy = (wakingTired + (10 - fadiga)) / 2;

        const stress = this.responses.bloco_5c_stress ?? this.responses.bloco5?.estresse ?? 5;
        const anxiety = this.responses.bloco_5c_anxiety ?? this.responses.bloco5?.ansiedade ?? 5;
        const controlMapping: Record<string, number> = { very: 10, moderate: 6, little: 3, none: 0, muito: 10, moderado: 6, pouco: 3, sem: 0 };
        const control = controlMapping[this.responses.bloco_5c_control || this.responses.bloco5?.controleSaude || 'moderate'] ?? 5;
        const rPsychology = ((10 - stress) + (10 - anxiety) + control) / 3;

        // R is CAPACITY: high R = good. For loss table we invert it (deficit = 10 - R)
        const r = (rSleep + rEnergy + rPsychology) / 3;
        this.scores['R'] = Math.round(r * 10) / 10;
        return this.scores['R'];
    }

    // ==================== BLOCO 5D: CONTEXTO (C) ====================
    calculateContext(): number {
        const workStress = this.responses.bloco_5d_work_stress ?? this.responses.bloco5?.trabalhoEstressante;
        const familyConflict = this.responses.bloco_5d_family_conflict ?? this.responses.bloco5?.conflitosFamiliares ?? 5;
        const financialWorry = this.responses.bloco_5d_financial_worry ?? this.responses.bloco5?.preocupacaoFinanceira ?? 5;
        // C is CAPACITY: high C = good support
        const contextItems = [
            workStress === 'na' ? null : (10 - (workStress ?? 5)),
            10 - familyConflict,
            10 - financialWorry,
        ].filter((v): v is number => v !== null);
        const c = contextItems.reduce((a, b) => a + b, 0) / contextItems.length;
        this.scores['C'] = Math.round(c * 10) / 10;
        return this.scores['C'];
    }

    // ==================== BLOCO 5E: ATIVIDADE FÍSICA (AF) ====================
    calculateActivityFactor(): number {
        const lifestyle = this.responses.bloco_5e_lifestyle ?? this.responses.bloco5?.bloco_5e_lifestyle ?? 'moderate';
        const intensity = this.responses.bloco_5e_intensity ?? this.responses.bloco5?.bloco_5e_intensity ?? 'moderate';
        const styleMap: Record<string, number> = { very_sedentary: 0, sedentary: 3, moderate: 6, active: 8, very_active: 10 };
        const intensityMap: Record<string, number> = { none: 0, light: 4, moderate: 7, intense: 9, maximum: 10 };
        const af = ((styleMap[lifestyle] ?? 5) + (intensityMap[intensity] ?? 5)) / 2;
        this.scores['AF'] = Math.round(af * 10) / 10;
        return this.scores['AF'];
    }

    // ==================== BLOCO 5F: HIDRATAÇÃO (HID) ====================
    calculateHydration(): number {
        const water = this.responses.bloco_5f_water_liters ?? this.responses.bloco5?.bloco_5f_water_liters ?? 2;
        // 2.5L = ótimo (score 10), escala linear abaixo
        const waterScore = Math.min((water / 2.5) * 10, 10);
        const colorMap: Record<string, number> = { very_dark: 0, dark: 4, yellow_clear: 8, clear: 10 };
        const colorScore = colorMap[this.responses.bloco_5f_urine_color || this.responses.bloco5?.bloco_5f_urine_color || 'yellow_clear'] ?? 5;
        const symptoms = this.responses.bloco_5f_dehydration_symptoms || this.responses.bloco5?.bloco_5f_dehydration_symptoms || {};
        const symptomPenalty = Object.values(symptoms).filter(v => v === true).length * 2;
        const hid = Math.max(0, (waterScore + colorScore) / 2 - symptomPenalty);
        this.scores['HID'] = Math.round(hid * 10) / 10;
        return this.scores['HID'];
    }

    // ==================== BLOCO 5G: NUTRIÇÃO (NUT) ====================
    calculateNutrition(): number {
        const qualityMap: Record<string, number> = { very_poor: 0, poor: 3, acceptable: 6, good: 8, excellent: 10 };
        const qualityVal = qualityMap[this.responses.bloco_5g_quality || this.responses.bloco5?.bloco_5g_quality || 'acceptable'] ?? 5;

        const proteinMap: Record<string, number> = { rarely: 0, sometimes: 5, almost_all: 8, all: 10 };
        const proteinVal = proteinMap[this.responses.bloco_5g_protein || this.responses.bloco5?.bloco_5g_protein || 'sometimes'] ?? 5;

        // Alimentos inflamatórios penalizam
        const inflammatoryMap: Record<string, number> = { daily: -3, several_week: -2, '1_2_week': -1, rarely: 0, never: 1 };
        const inflammatoryAdj = inflammatoryMap[this.responses.bloco_5g_inflammatory || this.responses.bloco5?.bloco_5g_inflammatory || ''] ?? 0;

        // Frutas/vegetais (0-5 porções → bônus proporcional)
        const fruitsPortions = this.responses.bloco_5g_fruits_portions ?? this.responses.bloco5?.bloco_5g_fruits_portions ?? 2;
        const fruitsBonus = Math.min((fruitsPortions / 5) * 2, 2); // máx +2 pts

        // Deficiências nutricionais penalizam
        const deficiencyMap: Record<string, number> = { multiple: -3, one_significant: -2, possible: -1, none: 0 };
        const deficiencyAdj = deficiencyMap[this.responses.bloco_5g_deficiency || this.responses.bloco5?.bloco_5g_deficiency || ''] ?? 0;

        const nut = Math.max(0, Math.min(10, (qualityVal + proteinVal) / 2 + inflammatoryAdj + fruitsBonus + deficiencyAdj));
        this.scores['NUT'] = Math.round(nut * 10) / 10;
        return this.scores['NUT'];
    }

    // ==================== BLOCO 5H: ERGONOMIA (ERG) ====================
    calculateErgonomics(): number {
        const spaceMap: Record<string, number> = { no_office: 6, none: 0, precarious: 3, acceptable: 6, good: 9, excellent: 10 };
        const spaceVal = spaceMap[this.responses.bloco_5h_workspace || this.responses.bloco5?.bloco_5h_workspace || 'acceptable'] ?? 5;
        const habitsPenalty = (this.responses.bloco_5h_bad_habits || this.responses.bloco5?.bloco_5h_bad_habits || []).length * 1.5;
        const erg = Math.max(0, spaceVal - habitsPenalty);

        // Posição de sono contribui para ERG noturna
        const sleepPosMap: Record<string, number> = {
            back: 1.5, side: 1, back_side: 0.5, stomach: -1, variable: 0,
            costas: 1.5, lado: 1, barriga: -1, variavel: 0,
        };
        const mattressMap: Record<string, number> = {
            excellent: 1.5, good: 0.5, acceptable: 0, poor: -1, very_poor: -2,
            otimo: 1.5, bom: 0.5, aceitavel: 0, ruim: -1, muito_ruim: -2,
        };
        const sleepBonus = sleepPosMap[this.responses.bloco_5h_sleep_position || this.responses.bloco5?.bloco_5h_sleep_position || ''] ?? 0;
        const mattressBonus = mattressMap[this.responses.bloco_5h_mattress || this.responses.bloco5?.bloco_5h_mattress || ''] ?? 0;
        const ergFinal = Math.max(0, Math.min(10, erg + sleepBonus + mattressBonus));
        this.scores['ERG'] = Math.round(ergFinal * 10) / 10;
        return this.scores['ERG'];
    }

    // ==================== BLOCO 6: RUÍDO (N) ====================
    calculateNoise(): number {
        let nPoints = 0;
        const signs = this.responses.bloco_6_visceral_issues || this.responses.bloco6?.sinaisAutonomicos || [];
        const signPoints = signs.filter((s: string) => s !== 'Nenhum desses' && s !== 'none').length * 1.5;
        nPoints += signPoints;
        const temEndo = !!(this.responses.bloco_6_endometriosis || this.responses.bloco6?.bloco_6_endometriosis);
        const temPcos = !!(this.responses.bloco_6_pcos || this.responses.bloco6?.bloco_6_pcos);
        if (temEndo && temPcos) nPoints += 4; // equivalente a 'ambas'
        else if (temEndo) nPoints += 3;
        else if (temPcos) nPoints += 2;
        const n = Math.min(nPoints, 10);
        this.scores['N'] = Math.round(n * 10) / 10;
        return this.scores['N'];
    }

    // ==================== BLOCO 6: HORMÔNIOS ====================
    calculateHormones(): number {
        const b6 = this.responses.bloco6;
        let hormonalNoise = 0;

        const cycleRegularity = this.responses.bloco_6_cycle_regularity ?? b6?.bloco_6_cycle_regularity;
        if (cycleRegularity === 'irregular') hormonalNoise += 1.5;

        const cycleAffectsPain = this.responses.bloco_6_cycle_affects_pain ?? b6?.bloco_6_cycle_affects_pain;
        if (cycleAffectsPain) {
            const phases: string[] = this.responses.bloco_6_cycle_pain_phase ?? b6?.bloco_6_cycle_pain_phase ?? [];
            hormonalNoise += phases.length * 1.0;
        }

        // Se hormonal não melhorou a dor, sugere componente hormonal ativo
        const hormonalUse = this.responses.bloco_6_hormonal_use ?? b6?.bloco_6_hormonal_use;
        const hormonalImproved = this.responses.bloco_6_hormonal_improved ?? b6?.bloco_6_hormonal_improved;
        if (hormonalUse && hormonalUse !== 'none' && hormonalImproved === false) {
            hormonalNoise += 1.5;
        }

        if (hormonalNoise > 0) {
            const currentN = this.scores['N'] || 0;
            this.scores['N'] = Math.min(10, Math.round((currentN + hormonalNoise) * 10) / 10);
        }

        this.result.hormonal_impact = hormonalNoise;
        return hormonalNoise;
    }

    // ==================== MEDICAÇÕES (MED) ====================
    calculateMedications(): number {
        const b6 = this.responses.bloco6;
        const medResult = calcularPerdaMedicamentos({
            daily_nsaid: this.responses.bloco_6_daily_nsaid ?? b6?.bloco_6_daily_nsaid,
            antidepressant: this.responses.bloco_6_antidepressant ?? b6?.bloco_6_antidepressant,
            antidepressant_type: this.responses.bloco_6_antidepressant_type ?? b6?.bloco_6_antidepressant_type,
            muscle_relaxant: this.responses.bloco_6_muscle_relaxant ?? b6?.bloco_6_muscle_relaxant,
            corticoid: this.responses.bloco_6_corticoid ?? b6?.bloco_6_corticoid,
            supplementation: this.responses.bloco_6_supplementation ?? b6?.bloco_6_supplementation,
        });
        this.result.med_penalty = medResult.perda_pontos;
        this.result.medications = medResult.medicamentos;
        this.scores['MED'] = medResult.perda_pontos;
        return medResult.perda_pontos;
    }

    getHealingPrognosis(): string {
        const d = this.scores['D'] || 0;
        const efi = this.scores['EFI'] || 0;
        const p = this.scores['P'] || 0;
        const myid = this.result.MyID ?? 50;
        const gatilhos = this.result.gatilhos_criticos || [];

        if (myid >= 75 && d < 4 && p < 4) return 'Favorável — padrão mecânico adaptativo';
        if (myid >= 55 && efi >= 5 && gatilhos.length === 0) return 'Moderado — bom potencial com adesão ao tratamento';
        if (p >= 6 || gatilhos.length >= 2) return 'Cauteloso — componente central/psicológico elevado, abordagem multifatorial necessária';
        if (d >= 7 || efi <= 3) return 'Reservado — alta carga de dor e baixa funcionalidade';
        return 'Moderado — monitorar resposta ao tratamento';
    }

    private getCronicidadeMultiplier(dataInicio?: string): number {
        if (!dataInicio) return 1.0;
        try {
            const inicio = new Date(dataInicio);
            if (isNaN(inicio.getTime())) return 1.0;
            const diffMs = Date.now() - inicio.getTime();
            const diffDias = diffMs / (1000 * 60 * 60 * 24);
            if (diffDias < 42) return 1.0;      // < 6 semanas: aguda
            if (diffDias < 84) return 1.1;      // 6-12 semanas: subaguda
            if (diffDias < 365) return 1.2;     // 3-12 meses: crônica inicial
            return 1.3;                          // > 12 meses: crônica estabelecida
        } catch {
            // data inválida — retornar neutro
            return 1.0;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // FÓRMULA MyID-100 v2.0: Subtração cumulativa de 100
    // MyID_100 = 100 - Σ(Perdas por dimensão) - MED_penalty
    // ═══════════════════════════════════════════════════════════
    calculateMyID(): number {
        this.calculateInertia();
        this.calculatePain();
        this.calculateFunctionality();
        this.calculatePsychological();
        this.calculateRegulation();
        this.calculateContext();
        this.calculateActivityFactor();
        this.calculateHydration();
        this.calculateNutrition();
        this.calculateErgonomics();
        this.calculateNoise();
        this.calculateMedications();
        this.calculateHormones();

        const D = this.scores['D'] || 0;
        const EFI = this.scores['EFI'] || 0;
        const P = this.scores['P'] || 0;
        const I = this.scores['I'] || 0;
        const N = this.scores['N'] || 0;

        // For capacity dimensions (R, C, AF, HID, NUT, ERG):
        // High value = good. Loss table uses DEFICIT (10 - value) as input.
        const R = this.scores['R'] || 0;
        const C = this.scores['C'] || 0;
        const AF = this.scores['AF'] || 0;
        const HID = this.scores['HID'] || 0;
        const NUT = this.scores['NUT'] || 0;
        const ERG = this.scores['ERG'] || 0;

        // Calculate losses for DEMAND dimensions (raw score = how bad)
        this.perdas['D'] = calcularPerdaDimensao('D', D);
        this.perdas['EFI'] = calcularPerdaDimensao('EFI', EFI);
        this.perdas['P'] = calcularPerdaDimensao('P', P);
        this.perdas['I'] = calcularPerdaDimensao('I', I);
        this.perdas['N'] = calcularPerdaDimensao('N', N);

        // Calculate losses for CAPACITY dimensions (deficit = 10 - value)
        this.perdas['R'] = calcularPerdaDimensao('R', 10 - R);
        this.perdas['C'] = calcularPerdaDimensao('C', 10 - C);
        this.perdas['AF'] = calcularPerdaDimensao('AF', 10 - AF);
        this.perdas['HID'] = calcularPerdaDimensao('HID', 10 - HID);
        this.perdas['NUT'] = calcularPerdaDimensao('NUT', 10 - NUT);
        this.perdas['ERG'] = calcularPerdaDimensao('ERG', 10 - ERG);

        const dataInicio = this.responses.bloco_1_date || this.responses.bloco1?.data_inicio_dor || this.responses.bloco1?.dataInicioDor;
        const cronicMult = this.getCronicidadeMultiplier(dataInicio);
        if (cronicMult > 1 && this.perdas['D'].perda_pontos > 0) {
            const perdaDAjustada = Math.min(TABELA_PERDAS.D.peso_maximo, this.perdas['D'].perda_pontos * cronicMult);
            this.perdas['D'] = { ...this.perdas['D'], perda_pontos: perdaDAjustada };
        }
        this.result.cronicidade_multiplier = cronicMult;

        // Sum all losses
        let totalPerdas = 0;
        for (const [dim, perda] of Object.entries(this.perdas)) {
            totalPerdas += perda.perda_pontos;
        }

        // Add medication penalty (negative = more loss, positive = bonus)
        const medPenalty = this.result.med_penalty || 0;
        totalPerdas -= medPenalty; // med_penalty: negative values add loss, positive subtract

        const rfData = this.responses.bloco_2_red_flags || this.responses.bloco2?.redFlags || {};
        const activeRF = [
            !!(rfData.weight_loss || rfData.perdaPeso),
            !!(rfData.fever || rfData.febreCalafrios),
            !!(rfData.night_pain || rfData.dorNoturnaImpedeSono),
            !!(rfData.incontinence || rfData.alteracaoEsfincteriana),
            !!(rfData.progressive || rfData.dorPioraConsistente),
            !!(rfData.neuropathy || rfData.dormenciaProgressiva),
        ].filter(Boolean).length;
        const redFlagPenalty = Math.min(activeRF * 3, 15);
        totalPerdas += redFlagPenalty;
        this.result.red_flag_penalty = redFlagPenalty;

        // MyID-100 score
        const myid100 = Math.max(0, Math.min(100, 100 - totalPerdas));
        this.result.MyID = myid100;
        this.result.total_perdas = totalPerdas;

        // Check critical triggers
        const gatilhosCriticos = Object.entries(this.perdas)
            .filter(([_, dados]) => dados.gatilho_critico)
            .map(([dim]) => dim);
        this.result.gatilhos_criticos = gatilhosCriticos;

        // Classify
        const temGatilhoCritico = gatilhosCriticos.length > 0;
        const classificacao = classificarMyID100(myid100, temGatilhoCritico);
        this.result.classificacao = classificacao;

        // Driver primário
        this.result.driver_primario = identificarDriver(this.perdas);

        return myid100;
    }

    interpretStatus(): string {
        const myid100 = this.result.MyID ?? 0;
        const classificacao = this.result.classificacao;
        const template = TEMPLATES_INTERPRETACAO[classificacao?.nome || 'MODERADO'];
        this.result.status = classificacao?.nome || 'MODERADO';
        this.result.color = classificacao?.cor || '#F59E0B';
        this.result.recommendation = template?.recomendacao || '';
        return this.result.status;
    }

    determineClinicalPriority(): string {
        const driver = this.result.driver_primario;
        if (!driver) {
            this.result.clinical_priority = 'MANUTENÇÃO';
            this.result.focus_areas = ['Manter hábitos saudáveis'];
            return 'MANUTENÇÃO';
        }

        const demandDims = ['D', 'EFI', 'P', 'I'];
        const capacityDims = ['R', 'C', 'AF', 'HID', 'NUT', 'ERG'];

        if (demandDims.includes(driver.dimensao)) {
            this.result.clinical_priority = 'REDUZIR DEMANDA';
            this.result.focus_areas = [
                `Foco em ${DIMENSION_LABELS[driver.dimensao]}`,
                'Reduzir sobrecarga sistêmica',
                'Tratamento direcionado ao driver primário',
            ];
        } else if (capacityDims.includes(driver.dimensao)) {
            this.result.clinical_priority = 'AUMENTAR CAPACIDADE';
            this.result.focus_areas = [
                `Melhorar ${DIMENSION_LABELS[driver.dimensao]}`,
                'Fortalecer fatores protetores',
                'Ajustes de estilo de vida',
            ];
        } else {
            this.result.clinical_priority = 'INVESTIGAR RUÍDO';
            this.result.focus_areas = [
                'Investigar fatores sistêmicos ocultos',
                'Avaliação multidisciplinar',
            ];
        }

        return this.result.clinical_priority;
    }

    // ==================== COMPILE FULL RESULT ====================
    getFullResult(): Record<string, any> {
        this.calculateMyID();
        this.interpretStatus();
        this.determineClinicalPriority();
        this.detectRedFlags();
        this.detectPainPattern();

        const b1 = this.responses.bloco1;
        this.result.healing_history = {
            prognosis: this.getHealingPrognosis(),
            description: b1?.descricaoEvento || '',
        };

        const classificacao = this.result.classificacao || { nome: 'MODERADO', cor: '#F59E0B', emoji: '🟠' };

        return {
            session_id: this.responses.session_id || 'N/A',
            timestamp: new Date().toISOString(),
            versao: '2.0',

            // MyID-100 score (0-100, higher = better)
            MyID_score: this.result.MyID || 0,
            myid_100: {
                pontuacao_inicial: 100,
                total_perdas: this.result.total_perdas || 0,
                pontuacao_final: this.result.MyID || 0,
                classificacao: classificacao.nome,
                cor: classificacao.cor,
                emoji: classificacao.emoji,
                gatilhos_criticos_ativados: this.result.gatilhos_criticos || [],
                driver_primario: this.result.driver_primario || null,
                co_drivers: identificarCoDrivers(this.perdas),
            },

            status: classificacao.nome,
            color: classificacao.cor,

            // Raw scores (0-10 each)
            component_scores: {
                D: parseFloat((this.scores['D'] || 0).toFixed(2)),
                EFI: parseFloat((this.scores['EFI'] || 0).toFixed(2)),
                P: parseFloat((this.scores['P'] || 0).toFixed(2)),
                I: parseFloat((this.scores['I'] || 0).toFixed(2)),
                R: parseFloat((this.scores['R'] || 0).toFixed(2)),
                C: parseFloat((this.scores['C'] || 0).toFixed(2)),
                AF: parseFloat((this.scores['AF'] || 0).toFixed(2)),
                HID: parseFloat((this.scores['HID'] || 0).toFixed(2)),
                NUT: parseFloat((this.scores['NUT'] || 0).toFixed(2)),
                ERG: parseFloat((this.scores['ERG'] || 0).toFixed(2)),
                N: parseFloat((this.scores['N'] || 0).toFixed(2)),
                MED: parseFloat((this.scores['MED'] || 0).toFixed(2)),
                // Legacy aliases
                D_pain: parseFloat((this.scores['D'] || 0).toFixed(2)),
                EFI_functionality: parseFloat((this.scores['EFI'] || 0).toFixed(2)),
                P_psychological: parseFloat((this.scores['P'] || 0).toFixed(2)),
                I_inertia: parseFloat((this.scores['I'] || 0).toFixed(2)),
                R_regulation: parseFloat((this.scores['R'] || 0).toFixed(2)),
                C_context: parseFloat((this.scores['C'] || 0).toFixed(2)),
                AF_activity: parseFloat((this.scores['AF'] || 0).toFixed(2)),
                HID_hydration: parseFloat((this.scores['HID'] || 0).toFixed(2)),
                NUT_nutrition: parseFloat((this.scores['NUT'] || 0).toFixed(2)),
                ERG_ergonomics: parseFloat((this.scores['ERG'] || 0).toFixed(2)),
                N_noise: parseFloat((this.scores['N'] || 0).toFixed(2)),
                MED_penalty: parseFloat((this.scores['MED'] || 0).toFixed(2)),
            },

            // Losses per dimension
            perdas_calculadas: this.perdas,

            red_flags: this.result.red_flags_detected || false,
            red_flags_details: this.result.red_flags || {},
            red_flags_detected: this.result.red_flags_detected || false,
            red_flag_alerts: this.result.red_flag_alerts || [],
            pain_pattern: this.result.pain_pattern || 'Unknown',
            dimension_alerts: this.result.gatilhos_criticos || [],

            clinical_priority: this.result.clinical_priority || 'Unknown',
            focus_areas: this.result.focus_areas || [],

            healing_history: this.result.healing_history || {},
            medications: this.result.medications || [],

            recommendation: this.result.recommendation || '',
        };
    }
}
