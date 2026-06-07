import { useEffect, useState } from 'react';
import { Stethoscope, Loader2, CheckCircle2, Lock, ShieldAlert } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useLenteAtiva, PerfilProfissional } from '@/hooks/useLenteAtiva';

const OPCOES: { value: PerfilProfissional; label: string; hint: string }[] = [
  { value: 'fisioterapeuta', label: 'Fisioterapeuta', hint: 'Avatar 3D, mapa de dor, raciocínio multidisciplinar' },
  { value: 'medico', label: 'Médico(a)', hint: 'Anamnese, vitais, CID-10, prescrição' },
  { value: 'psicologo', label: 'Psicólogo(a)', hint: 'Queixa, humor, cognição, escalas PHQ-9/GAD-7' },
  { value: 'nutricionista', label: 'Nutricionista', hint: 'Antropometria, recordatório, plano alimentar' },
  { value: 'educador_fisico', label: 'Educador(a) Físico(a)', hint: 'Testes funcionais, periodização de treino' },
  { value: 'terapeuta_ocupacional', label: 'Terapeuta Ocupacional', hint: 'AVDs, ambiente, ocupações significativas' },
];

const ESPECIALIDADES_MEDICAS: { value: string; label: string; hint: string }[] = [
  { value: 'clinico_geral', label: 'Clínico Geral / Família', hint: 'Anamnese SOAP, sinais vitais, prescrição' },
  { value: 'ortopedista', label: 'Ortopedista', hint: 'MyID + testes ortopédicos por região' },
  { value: 'endocrinologista', label: 'Endocrinologista', hint: 'Glicemia, HbA1c, perfil lipídico, TSH, IMC' },
  { value: 'cardiologista', label: 'Cardiologista', hint: 'PA, FC, ECG, risco cardiovascular' },
  { value: 'psiquiatra', label: 'Psiquiatra', hint: 'PHQ-9, GAD-7, sono, medicação' },
  { value: 'ginecologista', label: 'Ginecologista', hint: 'Ciclo, gestação, preventivos' },
  { value: 'pediatra', label: 'Pediatra', hint: 'Crescimento, marcos, vacinação' },
  { value: 'dermatologista', label: 'Dermatologista', hint: 'Lesões, fotos, checklist ABCDE' },
];

export default function PerfilProfissionalCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: lente } = useLenteAtiva();
  const [valor, setValor] = useState<PerfilProfissional>('fisioterapeuta');
  const [confirmacao, setConfirmacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  // Status de confirmação no banco
  const { data: status } = useQuery({
    queryKey: ['perfil-profissional-status', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('perfil_profissional_confirmado, perfil_profissional_confirmado_em')
        .eq('user_id', user!.id)
        .maybeSingle();
      return data as any;
    },
  });

  const confirmado = !!status?.perfil_profissional_confirmado;

  useEffect(() => {
    if (lente) setValor(lente.id);
  }, [lente]);

  const salvar = async () => {
    if (!user) return;
    setSalvando(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        perfil_profissional: valor,
        perfil_profissional_confirmado: true,
      } as any)
      .eq('user_id', user.id);
    setSalvando(false);
    if (error) {
      toast({ title: 'Não foi possível confirmar', description: error.message, variant: 'destructive' });
      return;
    }
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2500);
    setConfirmacao('');
    qc.invalidateQueries({ queryKey: ['lente-ativa'] });
    qc.invalidateQueries({ queryKey: ['perfil-profissional-status'] });
    toast({
      title: 'Profissão confirmada',
      description: 'Para alterar futuramente, será necessário contatar o suporte.',
    });
  };

  const sel = OPCOES.find(o => o.value === valor);
  const selLabel = sel?.label || '';
  const podeSalvar = !confirmado && lente && lente.id !== valor;
  const confirmacaoOk = confirmacao.trim().toLowerCase() === selLabel.toLowerCase();

  return (
    <div className="clinical-card mb-4 sm:mb-5">
      <div className="flex items-center gap-2 mb-3">
        <Stethoscope className="icon-sm text-muted-foreground" />
        <h2 className="h-section">Minha Profissão</h2>
        {confirmado && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5 ml-auto">
            <Lock className="h-2.5 w-2.5" />
            Confirmada
          </span>
        )}
      </div>

      <p className="text-caption mb-4">
        Define a lente clínica usada na avaliação presencial — ferramentas exibidas, foco da IA e template de evolução.
        Por segurança clínica e regulatória, <strong>a profissão só pode ser definida uma vez</strong>. Alterações
        posteriores exigem solicitação ao suporte.
      </p>

      <div className="max-w-md space-y-3">
        <div>
          <Label className="text-xs font-medium mb-1.5 block">Profissão</Label>
          <Select
            value={valor}
            onValueChange={(v) => setValor(v as PerfilProfissional)}
            disabled={confirmado}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {OPCOES.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {sel && <p className="text-[11px] text-muted-foreground mt-1.5">{sel.hint}</p>}
        </div>

        {confirmado ? (
          <div className="rounded-xl bg-muted/40 border border-border/40 p-3 text-[12px] text-muted-foreground flex gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <div className="font-medium text-foreground">Lente travada</div>
              Para evitar que um profissional atue fora da sua área, esta configuração foi bloqueada após a primeira
              confirmação. Se precisar mudar, fale com o suporte enviando comprovação do seu registro profissional.
            </div>
          </div>
        ) : podeSalvar ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" className="gap-2 rounded-xl">
                {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : salvo ? <CheckCircle2 className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                Confirmar profissão
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar como {selLabel}?</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <span className="block">
                    Esta escolha é <strong>definitiva</strong>. Ela define quais ferramentas clínicas você poderá usar,
                    o template de prontuário e o comportamento da IA. Alterar depois exige contato com o suporte e
                    comprovação do registro profissional (CRM, CREFITO, CRP, CRN, CREF, CREFITO-TO).
                  </span>
                  <span className="block pt-2 text-foreground">
                    Para confirmar, digite <strong>{selLabel}</strong> abaixo:
                  </span>
                  <input
                    type="text"
                    value={confirmacao}
                    onChange={(e) => setConfirmacao(e.target.value)}
                    placeholder={selLabel}
                    className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-border bg-background"
                    autoFocus
                  />
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setConfirmacao('')}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  disabled={!confirmacaoOk || salvando}
                  onClick={(e) => { e.preventDefault(); salvar(); }}
                >
                  {salvando ? 'Confirmando...' : 'Confirmar definitivamente'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>
    </div>
  );
}
