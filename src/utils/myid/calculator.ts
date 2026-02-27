export interface MyIDResponses {
    session_id?: string;
    // Bloco 1
    bloco_1_changes?: string[];
    bloco_1_similar_injury?: boolean;
    bloco_1_healing_speed?: 'fast' | 'moderate' | 'slow' | 'with_sequela';
    bloco_1_did_physio?: boolean;
    bloco_1_physio_result?: 'excellent' | 'good' | 'moderate' | 'bad';

    // Bloco 2
    bloco_2_pain_now?: number;
    bloco_2_pain_max?: number;
    bloco_2_red_flags?: {
        weight_loss?: boolean;
        fever?: boolean;
        night_pain?: boolean;
        incontinence?: boolean;
        progressive?: boolean;
        neuropathy?: boolean;
        [key: string]: boolean | undefined;
    };
    bloco_2_temporal_pattern?: string[];

    // Bloco 3
    bloco_3_work?: number;
    bloco_3_home?: number;
    bloco_3_exercise?: number;
    bloco_3_independence?: number;
    bloco_3_social?: number;

    // Bloco 4
    bloco_4_fear_movement?: number;
    bloco_4_belief_damage?: number;
    bloco_4_avoidance?: number;
    bloco_4_self_efficacy?: number;

    // Bloco 5A
    bloco_5a_quality?: number;
    bloco_5a_hours?: number;
    bloco_5a_awake?: 'never' | 'rarely' | 'frequently' | 'always';
    bloco_5a_disorders?: string[];

    // Bloco 5B
    bloco_5b_fatigue?: number;
    bloco_5b_tired_awake?: 'never' | 'sometimes' | 'frequently' | 'always';

    // Bloco 5C
    bloco_5c_stress?: number;
    bloco_5c_anxiety?: number;
    bloco_5c_control?: 'very' | 'moderate' | 'little' | 'none';

    // Bloco 5D
    bloco_5d_work_stress?: number;
    bloco_5d_family_conflict?: number;
    bloco_5d_financial_worry?: number;

    // Bloco 5E
    bloco_5e_lifestyle?: 'very_sedentary' | 'sedentary' | 'moderate' | 'active' | 'very_active';
    bloco_5e_sitting_hours?: number;
    bloco_5e_exercise_types?: string[];
    bloco_5e_intensity?: 'none' | 'light' | 'moderate' | 'intense' | 'maximum';

    // Bloco 5F
    bloco_5f_water_liters?: number;
    bloco_5f_urine_color?: 'very_dark' | 'dark' | 'yellow_clear' | 'clear';
    bloco_5f_micturition?: number;
    bloco_5f_dehydration_symptoms?: {
        dry_mouth_frequent?: boolean;
        dry_skin_frequent?: boolean;
        fatigue_water_helps?: boolean;
        [key: string]: boolean | undefined;
    };

    // Bloco 5G
    bloco_5g_quality?: 'very_poor' | 'poor' | 'acceptable' | 'good' | 'excellent';
    bloco_5g_fruits_portions?: number;
    bloco_5g_protein?: 'rarely' | 'sometimes' | 'almost_all' | 'all';
    bloco_5g_inflammatory?: 'daily' | 'several_week' | '1_2_week' | 'rarely' | 'never';
    bloco_5g_deficiency?: 'multiple' | 'one_significant' | 'possible' | 'none';

    // Bloco 5H
    bloco_5h_workspace?: 'none' | 'precarious' | 'acceptable' | 'good' | 'excellent';
    bloco_5h_sitting_continuous?: number;
    bloco_5h_sleep_position?: 'back' | 'side' | 'stomach' | 'mixed';
    bloco_5h_mattress?: 'old' | 'bad' | 'acceptable' | 'good' | 'excellent';
    bloco_5h_bad_habits?: string[];

    // Bloco 6
    bloco_6_axial_trauma?: boolean;
    bloco_6_abdominal_surgeries?: string[];
    bloco_6_visceral_issues?: string[];
    bloco_6_endometriosis?: boolean;
    bloco_6_pcos?: boolean;
    bloco_6_cycle_regularity?: 'regular' | 'irregular' | 'no_cycle';
    bloco_6_cycle_affects_pain?: boolean;
    bloco_6_cycle_pain_phase?: string[];
    bloco_6_hormonal_use?: 'none' | 'oral' | 'iud' | 'other';
    bloco_6_hormonal_improved?: boolean;
    bloco_6_daily_nsaid?: boolean;
    bloco_6_antidepressant?: boolean;
    bloco_6_antidepressant_type?: 'ssri' | 'tricyclic' | 'other';
    bloco_6_muscle_relaxant?: boolean;
    bloco_6_supplementation?: boolean;
    bloco_6_corticoid?: boolean;
}

export class MyIDCalculator {
    responses: MyIDResponses;
    scores: Record<string, number> = {};
    result: Record<string, any> = {};

    constructor(responses: MyIDResponses) {
        this.responses = responses || {};
    }

    normalizeTo10(value: number, maxValue: number = 10): number {
        if (maxValue === 0) return 0;
        return parseFloat(((value / maxValue) * 10).toFixed(2));
    }

    // ==================== BLOCO 1: INÉRCIA (I) ====================
    calculateInertia(): number {
        const changes = this.responses.bloco_1_changes || [];
        const iPoints = changes.length * 2;
        const maxInertia = 8;

        const iNormalized = this.normalizeTo10(iPoints, maxInertia);
        this.scores['I'] = Math.min(iNormalized, 10);
        return this.scores['I'];
    }

    // ==================== BLOCO 2: DOR (D) ====================
    calculatePain(): number {
        const painNow = this.responses.bloco_2_pain_now || 0;
        const painMax = this.responses.bloco_2_pain_max || 0;

        const d = (painNow + painMax) / 2;
        this.scores['D'] = d;
        return this.scores['D'];
    }

    detectRedFlags(): boolean {
        const redFlags = this.responses.bloco_2_red_flags || {};

        const criticalFlags = {
            weight_loss: !!redFlags.weight_loss,
            fever: !!redFlags.fever,
            night_pain: !!redFlags.night_pain,
            incontinence: !!redFlags.incontinence,
            progressive: !!redFlags.progressive,
            neuropathy: !!redFlags.neuropathy,
        };

        this.result['red_flags_detected'] = Object.values(criticalFlags).some(v => v === true);
        this.result['red_flags'] = criticalFlags;

        return this.result['red_flags_detected'];
    }

    detectPainPattern(): string {
        const patterns = this.responses.bloco_2_temporal_pattern || [];
        let patternType = 'Mixed';

        if (patterns.includes('nocturnal')) {
            patternType = 'Nocturnal (Inflamation)';
        } else if (patterns.includes('morning_stiffness')) {
            patternType = 'Morning Stiffness (Inflamation)';
        } else if (patterns.includes('mechanical')) {
            patternType = 'Mechanical (Movement-related)';
        } else if (patterns.includes('post_exercise')) {
            patternType = 'Post-Exercise (Recovery issue)';
        }

        this.result['pain_pattern'] = patternType;
        return patternType;
    }

    // ==================== BLOCO 3: FUNCIONALIDADE (EFI) ====================
    calculateFunctionality(): number {
        const efiValues = [
            this.responses.bloco_3_work || 0,
            this.responses.bloco_3_home || 0,
            this.responses.bloco_3_exercise || 0,
            this.responses.bloco_3_independence || 0,
            this.responses.bloco_3_social || 0,
        ];

        const efi = efiValues.reduce((a, b) => a + b, 0) / efiValues.length;
        this.scores['EFI'] = efi;
        return this.scores['EFI'];
    }

    // ==================== BLOCO 4: PSICOLÓGICO (P) ====================
    calculatePsychological(): number {
        const fearMovement = this.responses.bloco_4_fear_movement || 2; // 1-4
        const beliefDamage = this.responses.bloco_4_belief_damage || 2; // 1-4
        const avoidance = this.responses.bloco_4_avoidance || 2; // 1-4
        const selfEfficacy = this.responses.bloco_4_self_efficacy || 5; // 0-10

        const fearNormalized = ((fearMovement - 1) / 3) * 10;
        const beliefNormalized = ((beliefDamage - 1) / 3) * 10;
        const avoidNormalized = ((avoidance - 1) / 3) * 10;

        const selfEfficacyInverted = 10 - selfEfficacy;

        const p = (fearNormalized + beliefNormalized + avoidNormalized + selfEfficacyInverted) / 4;
        this.scores['P'] = p;
        return this.scores['P'];
    }

    // ==================== BLOCO 5: REGULAÇÃO (R) ====================
    calculateRegulation(): number {
        // 5A: Sono
        const sleepQuality = this.responses.bloco_5a_quality || 5;
        const sleepHours = this.responses.bloco_5a_hours || 7;
        const sleepHoursNormalized = this.normalizeTo10(sleepHours, 9);

        const awakeMapping: Record<string, number> = { never: 10, rarely: 7, frequently: 4, always: 0 };
        let sleepAwake = awakeMapping[this.responses.bloco_5a_awake || 'rarely'] ?? 5;

        const sleepDisorders = this.responses.bloco_5a_disorders || [];
        const disorderPenalty = sleepDisorders.length * 1.5;
        sleepAwake = Math.max(0, sleepAwake - disorderPenalty);

        const rSleep = (sleepQuality + sleepHoursNormalized + sleepAwake) / 3;

        // 5B: Energia
        const fatigue = this.responses.bloco_5b_fatigue || 5;
        const fatigueInverted = 10 - fatigue;

        const tirednessMapping: Record<string, number> = { never: 10, sometimes: 6, frequently: 3, always: 0 };
        const wakingTired = tirednessMapping[this.responses.bloco_5b_tired_awake || 'sometimes'] ?? 5;

        const rEnergy = (fatigueInverted + wakingTired) / 2;

        // 5C: Psicológico
        const stress = this.responses.bloco_5c_stress || 5;
        const stressInverted = 10 - stress;

        const anxiety = this.responses.bloco_5c_anxiety || 5;
        const anxietyInverted = 10 - anxiety;

        const controlMapping: Record<string, number> = { very: 10, moderate: 6, little: 3, none: 0 };
        const control = controlMapping[this.responses.bloco_5c_control || 'moderate'] ?? 5;

        const rPsychology = (stressInverted + anxietyInverted + control) / 3;

        const r = (rSleep + rEnergy + rPsychology) / 3;
        this.scores['R'] = r;
        return this.scores['R'];
    }

    // ==================== BLOCO 5D: CONTEXTO (C) ====================
    calculateContext(): number {
        const workStress = this.responses.bloco_5d_work_stress || 5;
        const workSupport = 10 - workStress;

        const familyConflict = this.responses.bloco_5d_family_conflict || 5;
        const familySupport = 10 - familyConflict;

        const financialWorry = this.responses.bloco_5d_financial_worry || 5;
        const financialSupport = 10 - financialWorry;

        const c = (workSupport + familySupport + financialSupport) / 3;
        this.scores['C'] = c;
        return this.scores['C'];
    }

    // ==================== BLOCO 5E: ATIVIDADE FÍSICA (AF) ====================
    calculateActivityFactor(): number {
        const lifestyleMapping: Record<string, number> = {
            very_sedentary: 0, sedentary: 2, moderate: 5, active: 7, very_active: 10
        };
        const lifestyle = lifestyleMapping[this.responses.bloco_5e_lifestyle || 'moderate'] ?? 5;

        const sittingHours = this.responses.bloco_5e_sitting_hours !== undefined ? this.responses.bloco_5e_sitting_hours : 8;
        const sittingMapping = [
            { max: 0, score: 10 }, { max: 4, score: 9 }, { max: 6, score: 7 },
            { max: 8, score: 5 }, { max: 10, score: 2 }, { max: 999, score: 0 }
        ];

        let sittingScore = 5;
        for (const bin of sittingMapping) {
            if (sittingHours <= bin.max) {
                sittingScore = bin.score;
                break;
            }
        }

        const exerciseTypes = (this.responses.bloco_5e_exercise_types || []).length;
        const exerciseScore = Math.min(exerciseTypes * 2, 10);

        const intensityMapping: Record<string, number> = {
            none: 0, light: 3, moderate: 6, intense: 8, maximum: 10
        };
        const intensity = intensityMapping[this.responses.bloco_5e_intensity || 'moderate'] ?? 5;

        const af = (lifestyle + sittingScore + exerciseScore + intensity) / 4;
        this.scores['AF'] = af;
        return this.scores['AF'];
    }

    // ==================== BLOCO 5F: HIDRATAÇÃO (HID) ====================
    calculateHydration(): number {
        const waterLiters = this.responses.bloco_5f_water_liters !== undefined ? this.responses.bloco_5f_water_liters : 2;
        const hydrationMapping = [
            { max: 1, score: 0 }, { max: 1.5, score: 2 }, { max: 2, score: 4 },
            { max: 2.5, score: 6 }, { max: 3, score: 8 }, { max: 999, score: 10 }
        ];

        let hid = 5;
        for (const bin of hydrationMapping) {
            if (waterLiters <= bin.max) {
                hid = bin.score;
                break;
            }
        }

        const colorMapping: Record<string, number> = {
            very_dark: 0, dark: 2, yellow_clear: 5, clear: 10
        };
        const urineColor = this.responses.bloco_5f_urine_color || 'yellow_clear';
        const colorScore = colorMapping[urineColor] ?? 5;

        const micturition = this.responses.bloco_5f_micturition !== undefined ? this.responses.bloco_5f_micturition : 6;
        const micturitionMapping = [
            { max: 3, score: 0 }, { max: 5, score: 3 }, { max: 7, score: 7 },
            { max: 10, score: 10 }, { max: 999, score: 8 }
        ];
        let micturitionScore = 5;
        for (const bin of micturitionMapping) {
            if (micturition <= bin.max) {
                micturitionScore = bin.score;
                break;
            }
        }

        const symptoms = this.responses.bloco_5f_dehydration_symptoms || {};
        let dehydrationPenalty = 0;
        if (symptoms.dry_mouth_frequent) dehydrationPenalty += 1;
        if (symptoms.dry_skin_frequent) dehydrationPenalty += 1;
        if (symptoms.fatigue_water_helps) dehydrationPenalty += 1;

        dehydrationPenalty *= 0.5;

        const hidFinal = (hid + colorScore + micturitionScore) / 3 - dehydrationPenalty;
        this.scores['HID'] = Math.max(0, hidFinal);
        return this.scores['HID'];
    }

    // ==================== BLOCO 5G: NUTRIÇÃO (NUT) ====================
    calculateNutrition(): number {
        const qualityMapping: Record<string, number> = {
            very_poor: 0, poor: 2, acceptable: 5, good: 7, excellent: 10
        };
        const quality = qualityMapping[this.responses.bloco_5g_quality || 'acceptable'] ?? 5;

        const fruitsPortions = this.responses.bloco_5g_fruits_portions !== undefined ? this.responses.bloco_5g_fruits_portions : 2;
        const fruitsMapping = [
            { max: 0, score: 0 }, { max: 2, score: 2 }, { max: 3, score: 4 },
            { max: 5, score: 7 }, { max: 999, score: 10 }
        ];
        let fruitsScore = 5;
        for (const bin of fruitsMapping) {
            if (fruitsPortions <= bin.max) {
                fruitsScore = bin.score;
                break;
            }
        }

        const proteinMapping: Record<string, number> = {
            rarely: 0, sometimes: 4, almost_all: 7, all: 10
        };
        const protein = proteinMapping[this.responses.bloco_5g_protein || 'sometimes'] ?? 5;

        const inflammatoryMapping: Record<string, number> = {
            daily: 0, several_week: 2, '1_2_week': 5, rarely: 8, never: 10
        };
        const inflammatory = inflammatoryMapping[this.responses.bloco_5g_inflammatory || '1_2_week'] ?? 5;

        const deficiencyMapping: Record<string, number> = {
            multiple: 0, one_significant: 3, possible: 2, none: 10
        };
        const deficiency = deficiencyMapping[this.responses.bloco_5g_deficiency || 'none'] ?? 5;

        const nut = (quality + fruitsScore + protein + inflammatory + deficiency) / 5;
        this.scores['NUT'] = nut;
        return this.scores['NUT'];
    }

    // ==================== BLOCO 5H: ERGONOMIA (ERG) ====================
    calculateErgonomics(): number {
        const workspaceMapping: Record<string, number> = {
            none: 0, precarious: 2, acceptable: 5, good: 8, excellent: 10
        };
        const workspace = workspaceMapping[this.responses.bloco_5h_workspace || 'acceptable'] ?? 5;

        const sittingContinuous = this.responses.bloco_5h_sitting_continuous !== undefined ? this.responses.bloco_5h_sitting_continuous : 90;
        const sittingErgMapping = [
            { max: 30, score: 10 }, { max: 60, score: 8 }, { max: 120, score: 5 },
            { max: 180, score: 2 }, { max: 999, score: 0 }
        ];
        let sittingErg = 5;
        for (const bin of sittingErgMapping) {
            if (sittingContinuous <= bin.max) {
                sittingErg = bin.score;
                break;
            }
        }

        const sleepPositionMapping: Record<string, number> = {
            back: 8, side: 7, stomach: 2, mixed: 5
        };
        const sleepPosition = sleepPositionMapping[this.responses.bloco_5h_sleep_position || 'side'] ?? 5;

        const mattressMapping: Record<string, number> = {
            old: 0, bad: 2, acceptable: 5, good: 8, excellent: 10
        };
        const mattress = mattressMapping[this.responses.bloco_5h_mattress || 'acceptable'] ?? 5;

        const badHabits = this.responses.bloco_5h_bad_habits || [];
        const badHabitsPenalty = badHabits.length * 1.0;

        const erg = (workspace + sittingErg + sleepPosition + mattress) / 4 - badHabitsPenalty;
        this.scores['ERG'] = Math.max(0, erg);
        return this.scores['ERG'];
    }

    // ==================== BLOCO 6: RUÍDO (N) ====================
    calculateNoise(): number {
        let nPoints = 0;

        if (this.responses.bloco_6_axial_trauma) nPoints += 2;

        const abdominalSurgeries = this.responses.bloco_6_abdominal_surgeries || [];
        nPoints += abdominalSurgeries.length * 1.5;

        const visceralIssues = this.responses.bloco_6_visceral_issues || [];
        nPoints += visceralIssues.length * 1.5;

        if (this.responses.bloco_6_endometriosis) nPoints += 3;
        if (this.responses.bloco_6_pcos) nPoints += 2;

        const n = Math.min(nPoints, 10);
        this.scores['N'] = n;
        return this.scores['N'];
    }

    // ==================== BLOCO 6: CICLO MENSTRUAL (HOR) ====================
    calculateHormones(): number {
        const cycleRegularity = this.responses.bloco_6_cycle_regularity || 'regular';
        const regularPenalty = cycleRegularity === 'regular' ? 0 : 1;

        let painPenalty = 0;
        if (this.responses.bloco_6_cycle_affects_pain) {
            const affectedPhase = (this.responses.bloco_6_cycle_pain_phase || []).join(',');
            if (affectedPhase.includes('luteal') || affectedPhase.includes('menstruation')) {
                painPenalty = 1.5;
            } else {
                painPenalty = 0.5;
            }
        }

        const hormonalUse = this.responses.bloco_6_hormonal_use || 'none';
        let hormonalBonus = 0;
        if (hormonalUse === 'oral' && this.responses.bloco_6_hormonal_improved) {
            hormonalBonus = 1;
        } else if (hormonalUse === 'iud' && this.responses.bloco_6_hormonal_improved) {
            hormonalBonus = 1.5;
        }

        const horImpact = regularPenalty + painPenalty - hormonalBonus;
        this.result['hormonal_impact'] = horImpact;
        return horImpact;
    }

    // ==================== BLOCO 6: MEDICAÇÕES (MED) ====================
    calculateMedications(): number {
        let medPenalty = 0;
        const medicationsList: string[] = [];

        if (this.responses.bloco_6_daily_nsaid) {
            medPenalty -= 1;
            medicationsList.push('NSAID (daily)');
        }

        if (this.responses.bloco_6_antidepressant) {
            const antType = this.responses.bloco_6_antidepressant_type || 'ssri';
            if (antType === 'tricyclic') {
                medPenalty += 1;
            } else {
                medPenalty += 0.5;
            }
            medicationsList.push('Antidepressant');
        }

        if (this.responses.bloco_6_muscle_relaxant) {
            medPenalty -= 1;
            medicationsList.push('Muscle Relaxant');
        }

        if (this.responses.bloco_6_supplementation) {
            medPenalty += 1;
            medicationsList.push('Supplementation');
        }

        if (this.responses.bloco_6_corticoid) {
            medPenalty -= 2.5;
            medicationsList.push('Corticoid (SEVERE)');
        }

        this.result['med_penalty'] = medPenalty;
        this.result['medications'] = medicationsList;
        return medPenalty;
    }

    // ==================== HISTÓRICO DE CICATRIZAÇÃO ====================
    calculateHealingHistory(): string {
        const hadSimilarInjury = !!this.responses.bloco_1_similar_injury;
        let prognosis = '';
        let healingSpeed = 'unknown';

        if (!hadSimilarInjury) {
            prognosis = 'First experience - unpredictable timeline';
        } else {
            healingSpeed = this.responses.bloco_1_healing_speed || 'moderate';
            const prognosisMapping: Record<string, string> = {
                fast: 'Fast healer - expect quick recovery',
                moderate: 'Moderate healing - standard timeline',
                slow: 'Slow healer - expect extended recovery',
                with_sequela: 'Incomplete healing - may need specialized approach'
            };
            prognosis = prognosisMapping[healingSpeed] || 'Unknown';
        }

        const didPhysio = !!this.responses.bloco_1_did_physio;
        const physioResult = didPhysio ? (this.responses.bloco_1_physio_result || 'moderate') : 'N/A';

        this.result['healing_history'] = {
            prognosis,
            healing_speed: healingSpeed,
            physio_history: physioResult
        };

        return prognosis;
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
        const MedPenalty = this.result['med_penalty'] || 0;

        const numerator = ((D + EFI) * (1 + (P / 10))) + I;
        const denominator = (R + C + AF + HID + NUT + ERG) - N - MedPenalty;

        let myid = 10;
        if (denominator > 0) {
            myid = numerator / denominator;
        }

        myid = Math.min(Math.max(myid, 0), 10);

        this.result['MyID'] = parseFloat(myid.toFixed(2));
        this.result['numerator'] = parseFloat(numerator.toFixed(2));
        this.result['denominator'] = parseFloat(denominator.toFixed(2));

        return this.result['MyID'];
    }

    // ==================== INTERPRETAÇÃO ====================
    interpretStatus(): string {
        const myid = this.result['MyID'] || 5;
        let status = '';
        let color = '';
        let recommendation = '';

        if (myid < 2) {
            status = 'EXCELLENT';
            color = '✅';
            recommendation = 'Seu corpo está em excelente estado de recuperação';
        } else if (myid < 4) {
            status = 'GOOD';
            color = '✅';
            recommendation = 'Sistema balanceado, recuperação progressiva';
        } else if (myid < 6) {
            status = 'CAUTION';
            color = '⚠️';
            recommendation = 'Demanda começando a exceder capacidade';
        } else if (myid < 8) {
            status = 'ALERT';
            color = '⛔';
            recommendation = 'SITUAÇÃO CRÍTICA - Intervenção multidisciplinar necessária';
        } else {
            status = 'EMERGENCY';
            color = '🚨';
            recommendation = 'VOCÊ ESTÁ QUEBRANDO - Ação urgente necessária';
        }

        this.result['status'] = status;
        this.result['color'] = color;
        this.result['recommendation'] = recommendation;
        return status;
    }

    // ==================== PRIORIDADE CLÍNICA ====================
    determineClinicalPriority(): string {
        const numeratorAvg = ((this.scores['D'] || 0) + (this.scores['EFI'] || 0) + (this.scores['P'] || 0)) / 3;
        const denominatorAvg = ((this.scores['R'] || 0) + (this.scores['C'] || 0) + (this.scores['AF'] || 0) +
            (this.scores['HID'] || 0) + (this.scores['NUT'] || 0) + (this.scores['ERG'] || 0)) / 6;

        let priority = '';
        let focus: string[] = [];

        if (numeratorAvg > denominatorAvg) {
            priority = 'Numerator (Reduce Demand)';
            focus = [
                'Reduzir dor (fisioterapia + educação)',
                'Aumentar funcionalidade (movimento progressivo)',
                'Reduzir medo (psicologia)',
                'Adaptar a novas mudanças'
            ];
        } else {
            priority = 'Denominator (Increase Support)';
            focus = [
                'Melhorar sono (8+ horas)',
                'Aumentar hidratação (3-4L/dia)',
                'Melhorar nutrição (proteína + vitaminas)',
                'Corrigir ergonomia/postura',
                'Aumentar atividade física apropriada',
                'Reduzir estresse'
            ];
        }

        this.result['clinical_priority'] = priority;
        this.result['focus_areas'] = focus;
        return priority;
    }

    // ==================== COMPILE FULL RESULT ====================
    getFullResult(): Record<string, any> {
        this.calculateMyID();
        this.interpretStatus();
        this.determineClinicalPriority();
        this.detectRedFlags();
        this.detectPainPattern();
        this.calculateHealingHistory();

        return {
            session_id: this.responses.session_id || 'N/A',
            timestamp: new Date().toISOString(),
            MyID_score: this.result['MyID'] || 0,
            status: this.result['status'] || 'UNKNOWN',
            color: this.result['color'] || '',

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
            },

            red_flags: this.result['red_flags_detected'] || false,
            red_flags_details: this.result['red_flags'] || {},
            pain_pattern: this.result['pain_pattern'] || 'Unknown',

            clinical_priority: this.result['clinical_priority'] || 'Unknown',
            focus_areas: this.result['focus_areas'] || [],

            healing_history: this.result['healing_history'] || {},
            medications: this.result['medications'] || [],

            recommendation: this.result['recommendation'] || '',
        };
    }
}
