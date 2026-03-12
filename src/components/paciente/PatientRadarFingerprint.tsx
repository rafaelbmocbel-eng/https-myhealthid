import { useMemo } from 'react';
import {
    RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
    Tooltip
} from 'recharts';
import { cn } from '@/lib/utils';
import { Fingerprint, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PatientRadarFingerprintProps {
    scores: {
        score_e: number;
        score_p: number;
        score_c: number;
        score_f: number;
        score_d: number;
        score_r: number;
        score_efi: number;
    } | null;
    isLoading?: boolean;
    className?: string;
}

const SCORE_LABELS: Record<string, string> = {
    score_e: 'Estrutural',
    score_p: 'Cinesiofobia',
    score_c: 'Social',
    score_f: 'Contextual',
    score_d: 'Dor',
    score_r: 'Regulação',
    score_efi: 'Funcional',
};

const SCORE_KEYS = ['score_e', 'score_p', 'score_c', 'score_f', 'score_d', 'score_r', 'score_efi'];

export default function PatientRadarFingerprint({ scores, isLoading, className }: PatientRadarFingerprintProps) {
    const radarData = useMemo(() => {
        if (!scores) return [];
        return SCORE_KEYS.map(key => ({
            subject: SCORE_LABELS[key] || key,
            A: Number((scores as any)[key] || 0),
            fullMark: 10,
        }));
    }, [scores]);

    if (isLoading) {
        return (
            <div className={cn("h-64 bg-slate-50 animate-pulse rounded-2xl border border-slate-100", className)} />
        );
    }

    if (!scores) {
        return (
            <div className={cn("h-64 bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-center p-6", className)}>
                <Fingerprint className="h-10 w-10 text-slate-200 mb-2" />
                <p className="text-slate-500 font-bold text-sm">Sua Identidade Digital está sendo processada.</p>
                <p className="text-slate-400 text-xs">Complete sua primeira avaliação para ver seu MyID Radar.</p>
            </div>
        );
    }

    return (
        <Card className={cn("border-none shadow-sm bg-white overflow-hidden rounded-[2rem]", className)}>
            <CardHeader className="pb-0 pt-6 px-6">
                <CardTitle className="text-sm font-black text-slate-900 flex items-center gap-2 uppercase tracking-widest">
                    <Fingerprint className="h-4 w-4 text-indigo-600" />
                    Digital MyID Fingerprint
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 h-64 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis
                            dataKey="subject"
                            tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                        />
                        <Radar
                            name="Sua Saúde"
                            dataKey="A"
                            stroke="#4f46e5"
                            fill="#4f46e5"
                            fillOpacity={0.15}
                            strokeWidth={3}
                        />
                        <Tooltip
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            itemStyle={{ fontSize: '12px', fontWeight: 800, color: '#4f46e5' }}
                        />
                    </RadarChart>
                </ResponsiveContainer>

                <div className="flex justify-center -mt-4 mb-2">
                    <div className="inline-flex items-center gap-1.5 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100/50">
                        <Info className="h-3 w-3 text-indigo-600" />
                        <span className="text-[10px] text-indigo-700 font-black uppercase tracking-tight">Quanto mais próximo do centro, mais favorável</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
