import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, Loader2, X } from 'lucide-react';

interface Props {
    pacienteId: string;
    onSave: (data: any) => Promise<void>;
    onCancel?: () => void;
    isPending?: boolean;
}

export default function StudioMedidasForm({ pacienteId, onSave, onCancel, isPending }: Props) {
    const [form, setForm] = useState({
        paciente_id: pacienteId,
        peso: '', percentual_gordura: '', massa_magra: '', imc: '',
        cintura: '', quadril: '', braco_direito: '', braco_esquerdo: '',
        coxa_direita: '', coxa_esquerda: '', peitoral: '', panturrilha: '',
        observacoes: '',
    });

    const handleSave = async () => {
        const payload: any = { paciente_id: pacienteId };
        Object.entries(form).forEach(([k, v]) => {
            if (v !== '' && k !== 'paciente_id') payload[k] = isNaN(Number(v)) ? v : Number(v);
        });
        await onSave(payload);
        // Limpar form após sucesso (opcional, dependendo do uso)
        setForm(p => ({ ...p, peso: '', percentual_gordura: '', massa_magra: '', imc: '', cintura: '', quadril: '', braco_direito: '', braco_esquerdo: '', coxa_direita: '', coxa_esquerda: '', peitoral: '', panturrilha: '', observacoes: '' }));
    };

    return (
        <div className="p-4 rounded-xl border-2 border-studio/20 bg-studio-light/10 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between">
                <h4 className="font-bold text-studio text-sm">Nova Medição Antropométrica</h4>
                {onCancel && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCancel}>
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                    { k: 'peso', l: 'Peso (kg)' }, { k: 'percentual_gordura', l: '% Gordura' }, { k: 'massa_magra', l: 'M. Magra (kg)' },
                    { k: 'cintura', l: 'Cintura (cm)' }, { k: 'quadril', l: 'Quadril (cm)' }, { k: 'peitoral', l: 'Peitoral (cm)' },
                    { k: 'braco_direito', l: 'Braço D (cm)' }, { k: 'braco_esquerdo', l: 'Braço E (cm)' }, { k: 'coxa_direita', l: 'Coxa D (cm)' },
                    { k: 'coxa_esquerda', l: 'Coxa E (cm)' }, { k: 'panturrilha', l: 'Panturrilha (cm)' }, { k: 'imc', l: 'IMC' },
                ].map(f => (
                    <div key={f.k}>
                        <label className="text-[10px] text-muted-foreground uppercase font-semibold">{f.l}</label>
                        <Input
                            type="number"
                            step="0.1"
                            className="h-9 text-sm border-studio/10 focus-visible:ring-studio"
                            value={(form as any)[f.k]}
                            onChange={e => setForm(p => ({ ...p, [f.k]: e.target.value }))}
                        />
                    </div>
                ))}
            </div>

            <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground uppercase font-semibold">Observações Clínicas</label>
                <Input
                    placeholder="Ex: Aluno em jejum, medição pós-treino..."
                    value={form.observacoes}
                    onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))}
                    className="h-9 text-sm border-studio/10"
                />
            </div>

            <div className="flex gap-2 justify-end pt-2">
                {onCancel && <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onCancel}>Cancelar</Button>}
                <Button
                    size="sm"
                    className="h-8 bg-gradient-studio text-white gap-1.5 px-6 shadow-md shadow-studio/20"
                    onClick={handleSave}
                    disabled={isPending}
                >
                    {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Salvar Medidas
                </Button>
            </div>
        </div>
    );
}
