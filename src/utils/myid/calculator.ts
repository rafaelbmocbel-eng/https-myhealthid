import {
    MyIDBloco1Data, MyIDBloco2Data, MyIDBloco3Data,
    MyIDBloco4Data, MyIDBloco5Data, MyIDBloco6Data,
    MyIDResult as MyIDResultType, FingerprintRing
} from '@/types/myid';
import { getMyIDInterpretation } from '@/utils/myidCalculations';

export interface MyIDResponses extends Record<string, any> {
    session_id?: string;
    // Legacy nested structure
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
    result: Partial<MyIDResultType & {
        numerator: number;
        denominator: number;
        red_flags_detected: boolean;
        red_flags: Record<string, boolean>;
        pain_pattern: string;
        healing_history: any;
        med_penalty: number;
        medications: string[];
        hormonal_impact: number;
        clinical_priority: string;
        focus_areas: string[];
        status: string;
        color: string;
        recommendation: string;
        MyID: number;
    }> = {};


    constructor(responses: MyIDResponses) {
        this.responses = responses;
    }

    normalizeTo10(value: number, maxValue: number = 10): number {
        if (maxValue === 0) return 0;
        return parseFloat(((value / maxValue) * 10).toFixed(2));
    }

    // ==================== BLOCO 1: INÉRCIA (I) ====================
    calculateInertia(): number {
        // No v2, scoreI pode vir pré-calculado ou baseado em mudançasRecentes
        const b1 = this.responses.bloco1;
        const changes = this.responses.bloco_1_changes || b1?.mudancas_recentes || b1?.mudancasRecentes || [];
        const mudancasReais = changes.filter((m: string) => m !== 'Nenhuma mudança que eu note' && m !== 'none');

        // Cada mudança real conta 2 pontos de inércia
        const iPoints = mudancasReais.length * 2;
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
        if (regioes.length === 0) {
            this.scores['D'] = 0;
            return 0;
        }

        const somas = regioes.reduce(
            (acc, r) => ({
                atual: acc.atual + r.intensidadeAtual,
                max: acc.max + r.intensidadeMaxima,
            }),
            { atual: 0, max: 0 }
        );

        const d = (somas.atual + somas.max) / (2 * regioes.length);
        this.scores['D'] = Math.min(10, Math.round(d * 10) / 10);
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

        return this.result.red_flags_detected || false;
    }

    detectPainPattern(): string {
        const b2 = this.responses.bloco2;
        const regions = b2?.regioes || [];
        const allTypes = regions.flatMap(r => r.tiposDor || []);

        let patternType = 'Mecânico Adaptativo';
        if (allTypes.includes('Queimação') || allTypes.includes('Dormência')) {
            patternType = 'Isquêmico / Neuropático';
        } else if (allTypes.includes('Peso/Pressão')) {
            patternType = 'Congestivo / Mecânico';
        }

        this.result.pain_pattern = patternType;
        return patternType;
    }

    // ==================== BLOCO 3: FUNCIONALIDADE (EFI) ====================
    calculateFunctionality(): number {
        const efiValues = [
            this.responses.bloco_3_work ?? this.responses.bloco3?.trabalho ?? 0,
            this.responses.bloco_3_home ?? this.responses.bloco3?.domesticas ?? 0,
            this.responses.bloco_3_exercise ?? this.responses.bloco3?.exercicio ?? 0,
            this.responses.bloco_3_independence ?? this.responses.bloco3?.independencia ?? 0,
            this.responses.bloco_3_social ?? this.responses.bloco3?.vidaSocial ?? 0,
        ];

        const efi = efiValues.reduce((a, b) => a + b, 0) / efiValues.length;
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

        const p = (fearNormalized + beliefNormalized + avoidNormalized + selfEfficacyInverted) / 4;
        this.scores['P'] = Math.min(10, Math.max(0, Math.round(p * 10) / 10));
        return this.scores['P'];
    }

    // ==================== BLOCO 5: REGULAÇÃO (R) ====================
    calculateRegulation(): number {
        // 5A: Sono
        const sleepQuality = this.responses.bloco_5a_quality ?? this.responses.bloco5?.qualidadeSono ?? 5;
        const sleepHours = this.responses.bloco_5a_hours ?? this.responses.bloco5?.horasSono ?? 7;
        const sleepHoursNormalized = this.normalizeTo10(sleepHours, 9);

        const awakeMapping: Record<string, number> = { nunca: 10, rarely: 7, rarely_v2: 7, moderately: 5, frequently: 3, always: 0 };
        let sleepAwake = awakeMapping[this.responses.bloco_5a_awake || this.responses.bloco5?.acordaPorDor || 'rarely'] ?? 5;

        // 5A.4: Distúrbios de sono
        const disorders = this.responses.bloco_5a_disorders || this.responses.bloco5?.bloco_5a_disorders || [];
        const disorderPenalty = disorders.length * 1.5;

        const rSleep = Math.max(0, ((sleepQuality + sleepHoursNormalized + sleepAwake) / 3) - disorderPenalty);

        // 5B: Energia
        const fatigue = this.responses.fadiga ?? 5;
        const fatigueInverted = 10 - fatigue;

        const tirednessMapping: Record<string, number> = { nunca: 10, sometimes: 6, frequently: 3, always: 0 };
        const wakingTired = tirednessMapping[this.responses.bloco_5b_tired_awake || this.responses.bloco5?.exaustoAoAcordar || 'sometimes'] ?? 5;

        const rEnergy = (fatigueInverted + wakingTired) / 2;

        // 5C: Psicológico
        const stress = this.responses.bloco_5c_stress ?? this.responses.bloco5?.estresse ?? 5;
        const stressInverted = 10 - stress;

        const anxiety = this.responses.bloco_5c_anxiety ?? this.responses.bloco5?.ansiedade ?? 5;
        const anxietyInverted = 10 - anxiety;

        const controlMapping: Record<string, number> = { very: 10, moderate: 6, little: 3, none: 0, muito: 10, sem: 0 };
        const control = controlMapping[this.responses.bloco_5c_control || this.responses.bloco5?.controleSaude || 'moderate'] ?? 5;

        const rPsychology = (stressInverted + anxietyInverted + control) / 3;

        const r = (rSleep + rEnergy + rPsychology) / 3;
        this.scores['R'] = Math.round(r * 10) / 10;
        return this.scores['R'];
    }

    // ==================== BLOCO 5D: CONTEXTO (C) ====================
    calculateContext(): number {
        const workStress = this.responses.bloco_5d_work_stress ?? this.responses.bloco5?.trabalhoEstressante ?? 5;
        const workSupport = 10 - workStress;

        const familyConflict = this.responses.bloco_5d_family_conflict ?? this.responses.bloco5?.conflitosFamiliares ?? 5;
        const familySupport = 10 - familyConflict;

        const financialWorry = this.responses.bloco_5d_financial_worry ?? this.responses.bloco5?.preocupacaoFinanceira ?? 5;
        const financialSupport = 10 - financialWorry;

        const c = (workSupport + familySupport + financialSupport) / 3;
        this.scores['C'] = Math.round(c * 10) / 10;
        return this.scores['C'];
    }

    // ==================== BLOCO 5E: ATIVIDADE FÍSICA (AF) ====================
    calculateActivityFactor(): number {
        const lifestyle = this.responses.bloco_5e_lifestyle ?? this.responses.bloco5?.bloco_5e_lifestyle ?? 'moderate';
        const intensity = this.responses.bloco_5e_intensity ?? this.responses.bloco5?.bloco_5e_intensity ?? 'moderate';

        const styleMap: Record<string, number> = {
            very_sedentary: 0, sedentary: 3, moderate: 6, active: 8, very_active: 10
        };
        const intensityMap: Record<string, number> = {
            none: 0, light: 4, moderate: 7, intense: 9, maximum: 10
        };

        const af = (styleMap[lifestyle] || 5 + intensityMap[intensity] || 5) / 2;
        this.scores['AF'] = Math.round(af * 10) / 10;
        return this.scores['AF'];
    }

    // ==================== BLOCO 5F: HIDRATAÇÃO (HID) ====================
    calculateHydration(): number {
        const water = this.responses.bloco_5f_water_liters ?? this.responses.bloco5?.bloco_5f_water_liters ?? 2;
        const waterScore = Math.min((water / 3) * 10, 10);

        const colorMap: Record<string, number> = {
            very_dark: 0, dark: 4, yellow_clear: 8, clear: 10
        };
        const colorScore = colorMap[this.responses.bloco_5f_urine_color || this.responses.bloco5?.bloco_5f_urine_color || 'yellow_clear'] ?? 5;

        const symptoms = this.responses.bloco_5f_dehydration_symptoms || this.responses.bloco5?.bloco_5f_dehydration_symptoms || {};
        const symptomPenalty = Object.values(symptoms).filter(v => v === true).length * 2;

        const hid = Math.max(0, (waterScore + colorScore) / 2 - symptomPenalty);
        this.scores['HID'] = Math.round(hid * 10) / 10;
        return this.scores['HID'];
    }

    // ==================== BLOCO 5G: NUTRIÇÃO (NUT) ====================
    calculateNutrition(): number {
        const qualityMap: Record<string, number> = {
            very_poor: 0, poor: 3, acceptable: 6, good: 8, excellent: 10
        };
        const qualityVal = qualityMap[this.responses.bloco_5g_quality || this.responses.bloco5?.bloco_5g_quality || 'acceptable'] ?? 5;

        const proteinMap: Record<string, number> = {
            rarely: 0, sometimes: 5, almost_all: 8, all: 10
        };
        const proteinVal = proteinMap[this.responses.bloco_5g_protein || this.responses.bloco5?.bloco_5g_protein || 'sometimes'] ?? 5;

        const nut = (qualityVal + proteinVal) / 2;
        this.scores['NUT'] = Math.round(nut * 10) / 10;
        return this.scores['NUT'];
    }

    // ==================== BLOCO 5H: ERGONOMIA (ERG) ====================
    calculateErgonomics(): number {
        const spaceMap: Record<string, number> = {
            none: 0, precarious: 3, acceptable: 6, good: 9, excellent: 10
        };
        const spaceVal = spaceMap[this.responses.bloco_5h_workspace || this.responses.bloco5?.bloco_5h_workspace || 'acceptable'] ?? 5;

        const habitsPenalty = (this.responses.bloco_5h_bad_habits || this.responses.bloco5?.bloco_5h_bad_habits || []).length * 1.5;

        const erg = Math.max(0, spaceVal - habitsPenalty);
        this.scores['ERG'] = Math.round(erg * 10) / 10;
        return this.scores['ERG'];
    }

    // ==================== BLOCO 6: RUÍDO (N) ====================
    calculateNoise(): number {
        let nPoints = 0;

        if (this.responses.bloco_6_axial_trauma ?? this.responses.bloco6?.bloco_6_axial_trauma ?? this.responses.bloco6?.traumaAxial) nPoints += 2;

        const abdominalIssues = this.responses.bloco_6_abdominal_surgeries || this.responses.bloco6?.bloco_6_abdominal_surgeries || [];
        if (abdominalIssues.length > 0 || this.responses.bloco6?.cicatrizAbdominal) nPoints += 2;

        const signs = this.responses.bloco_6_visceral_issues || this.responses.bloco6?.sinaisAutonomicos || [];
        const signPoints = signs.filter((s: string) => s !== 'Nenhum desses' && s !== 'none').length * 1.5;
        nPoints += signPoints;

        if (this.responses.bloco_6_endometriosis || this.responses.bloco6?.bloco_6_endometriosis) nPoints += 3;
        if (this.responses.bloco_6_pcos || this.responses.bloco6?.bloco_6_pcos) nPoints += 2;

        const n = Math.min(nPoints, 10);
        this.scores['N'] = Math.round(n * 10) / 10;
        return this.scores['N'];
    }

    // ==================== BLOCO 6: CICLO MENSTRUAL (HOR) ====================
    calculateHormones(): number {
        // Reduzi a complexidade deste método para alinhar com o MyIDBloco6Data
        this.result.hormonal_impact = 0;
        return 0;
    }

    // ==================== BLOCO 6: MEDICAÇÕES (MED) ====================
    calculateMedications(): number {
        let medPenalty = 0;
        const medications: string[] = [];

        const b6 = this.responses.bloco6;

        // AINE diário
        if (this.responses.bloco_6_daily_nsaid ?? b6?.bloco_6_daily_nsaid) {
            medPenalty += 2;
            medications.push('AINE diário');
        }

        // Antidepressivo
        if (this.responses.bloco_6_antidepressant ?? b6?.bloco_6_antidepressant) {
            medPenalty += 1.5;
            medications.push(`Antidepressivo${b6?.bloco_6_antidepressant_type ? ` (${b6.bloco_6_antidepressant_type})` : ''}`);
        }

        // Relaxante muscular
        if (this.responses.bloco_6_muscle_relaxant ?? b6?.bloco_6_muscle_relaxant) {
            medPenalty += 1.5;
            medications.push('Relaxante muscular');
        }

        // Corticóide
        if (this.responses.bloco_6_corticoid ?? b6?.bloco_6_corticoid) {
            medPenalty += 2;
            medications.push('Corticóide');
        }

        // Suplementação (positivo = -0.5 penalty, ou seja, melhora capacidade)
        if (this.responses.bloco_6_supplementation ?? b6?.bloco_6_supplementation) {
            medPenalty -= 0.5;
            medications.push('Suplementação (↑)');
        }

        this.result.med_penalty = Math.max(0, Math.round(medPenalty * 10) / 10);
        this.result.medications = medications;
        this.scores['MED'] = this.result.med_penalty;
        return this.result.med_penalty;
    }

    // ==================== HISTÓRICO DE CICATRIZAÇÃO ====================
    // No v2, este método foi simplificado para apenas retornar uma string informativa no getFullResult
    getHealingPrognosis(): string {
        const b1 = this.responses.bloco1;
        const changes = b1?.mudancasRecentes || [];
        if (changes.length > 2) return 'Possível instabilidade sistêmica';
        if (changes.includes('Nenhuma mudança que eu note')) return 'Estável';
        return 'Moderado';
    }

    // ==================== FÓRMULA PRINCIPAL ====================
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
        const R = this.scores['R'] || 0;
        const C = this.scores['C'] || 0;
        const AF = this.scores['AF'] || 0;
        const HID = this.scores['HID'] || 0;
        const NUT = this.scores['NUT'] || 0;
        const ERG = this.scores['ERG'] || 0;
        const N = this.scores['N'] || 0;
        const MedPenalty = (this.result.med_penalty || 0) + (this.result.hormonal_impact || 0);

        // O fator P (Psicológico) atua como um multiplicador (amplificador) dos sintomas físicos (D + EFI)
        // E também como uma demanda base aditiva, garantindo que o score reflita carga mesmo sem dor física.
        const numerator = ((D + EFI) * (1 + (P / 10))) + P + I;
        const denominator = (R + C + AF + HID + NUT + ERG) - N - MedPenalty;

        let myid = 10;
        if (denominator > 0) {
            myid = numerator / denominator;
        }

        myid = Math.min(Math.max(myid, 0), 10);

        this.result.MyID = parseFloat(myid.toFixed(2));
        this.result.numerator = parseFloat(numerator.toFixed(2));
        this.result.denominator = parseFloat(denominator.toFixed(2));

        return this.result.MyID;
    }

    // ==================== INTERPRETAÇÃO ====================
    interpretStatus(): string {
        const interp = getMyIDInterpretation(this.result.MyID ?? 0);
        this.result.status = interp.status;
        this.result.color = interp.color;
        this.result.recommendation = interp.recommendation;
        return interp.status;
    }

    // ==================== PRIORIDADE CLÍNICA ====================
    determineClinicalPriority(): string {
        const numeratorAvg = ((this.scores['D'] || 0) + (this.scores['EFI'] || 0) + (this.scores['P'] || 0)) / 3;
        const denominatorAvg = ((this.scores['R'] || 0) + (this.scores['C'] || 0) + (this.scores['AF'] || 0) +
            (this.scores['HID'] || 0) + (this.scores['NUT'] || 0) + (this.scores['ERG'] || 0)) / 6;

        let priority = '';
        let focus: string[] = [];

        if (numeratorAvg > denominatorAvg) {
            priority = 'REDUZIR DEMANDA';
            focus = [
                'Reduzir dor (fisioterapia + educação)',
                'Aumentar funcionalidade (movimento progressivo)',
                'Reduzir medo (psicologia)',
                'Adaptar a novas mudanças'
            ];
        } else {
            priority = 'AUMENTAR SUPORTE';
            focus = [
                'Melhorar sono (8+ horas)',
                'Aumentar hidratação (3-4L/dia)',
                'Melhorar nutrição (proteína + vitaminas)',
                'Corrigir ergonomia/postura',
                'Aumentar atividade física apropriada',
                'Reduzir estresse'
            ];
        }

        this.result.clinical_priority = priority;
        this.result.focus_areas = focus;
        return priority;
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
            description: b1?.descricaoEvento || ''
        };

        return {
            session_id: this.responses.session_id || 'N/A',
            timestamp: new Date().toISOString(),
            MyID_score: this.result.MyID || 0,
            status: this.result.status || 'UNKNOWN',
            color: this.result.color || '',

            component_scores: {
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

            red_flags: this.result.red_flags_detected || false,
            red_flags_details: this.result.red_flags || {},
            pain_pattern: this.result.pain_pattern || 'Unknown',

            clinical_priority: this.result.clinical_priority || 'Unknown',
            focus_areas: this.result.focus_areas || [],

            healing_history: this.result.healing_history || {},
            medications: this.result.medications || [],

            recommendation: this.result.recommendation || '',
        };
    }
}
