import { useEffect, useState } from 'react';
import { Stethoscope, Loader2, CheckCircle2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useLenteAtiva, PerfilProfissional } from '@/hooks/useLenteAtiva';

const OPCOES: { value: PerfilProfissional; label: string; hint: string }[] = [
  { value: 'fisioterapeuta', label: 'Fisioterapeuta', hint: 'Avatar 3D, mapa de dor, raciocínio multidisciplinar' },
  { value: 'medico', label: 'Médico(a)', hint: 'Anamnese, vitais, CID-10, prescrição' },
  { value: 'psicologo', label: 'Psicólogo(a)', hint: 'Queixa, humor, cognição, escalas PHQ-9/GAD-7' },
  { value: 'nutricionista', label: 'Nutricionista', hint: 'Antropometria, recordatório, plano alimentar' },
  { value: 'educador_fisico', label: 'Educador(a) Físico(a)', hint: 'Testes funcionais, periodização de treino' },
  { value: 'terapeuta_ocupacional', label: 'Terapeuta Ocupacional', hint: 'AVDs, ambiente, ocupações significativas' },
];

export default function PerfilProfissionalCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: lente } = useLenteAtiva();
  const [valor, setValor] = useState<PerfilProfissional>('fisioterapeuta');
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    if (lente) setValor(lente.id);
  }, [lente]);

  const salvar = async () => {
    if (!user) return;
    setSalvando(true);
    const { error } = await supabase
      .from('profiles')
      .update({ perfil_profissional: valor } as any)
      .eq('user_id', user.id);
    setSalvando(false);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2500);
    qc.invalidateQueries({ queryKey: ['lente-ativa'] });
    toast({ title: 'Lente atualizada', description: 'A avaliação presencial vai usar a nova configuração.' });
  };

  const sel = OPCOES.find(o => o.value === valor);
  const mudou = lente && lente.id !== valor;

  return (
    <div className="clinical-card mb-4 sm:mb-5">
      <div className="flex items-center gap-2 mb-3">
        <Stethoscope className="icon-sm text-muted-foreground" />
        <h2 className="h-section">Minha Profissão</h2>
      </div>
      <p className="text-caption mb-4">
        Define a lente clínica usada na avaliação presencial — ferramentas exibidas, foco da IA e template de evolução.
      </p>

      <div className="max-w-md space-y-3">
        <div>
          <Label className="text-xs font-medium mb-1.5 block">Profissão</Label>
          <Select value={valor} onValueChange={(v) => setValor(v as PerfilProfissional)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {OPCOES.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {sel && <p className="text-[11px] text-muted-foreground mt-1.5">{sel.hint}</p>}
        </div>

        {mudou && (
          <Button onClick={salvar} disabled={salvando} size="sm" className="gap-2 rounded-xl">
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : salvo ? <CheckCircle2 className="h-4 w-4" /> : null}
            {salvando ? 'Salvando...' : salvo ? 'Salvo' : 'Salvar profissão'}
          </Button>
        )}
      </div>
    </div>
  );
}
