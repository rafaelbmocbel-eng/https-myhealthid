import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Bell, Save, Loader2 } from 'lucide-react';

interface Prefs {
  lembrete_consulta: boolean;
  alerta_falta: boolean;
  diario_pendente: boolean;
  questionario_pendente: boolean;
  nps_recebido: boolean;
}

const defaultPrefs: Prefs = {
  lembrete_consulta: true,
  alerta_falta: true,
  diario_pendente: true,
  questionario_pendente: true,
  nps_recebido: true,
};

const labels: Record<keyof Prefs, string> = {
  lembrete_consulta: 'Lembrete de consultas próximas',
  alerta_falta: 'Alerta de faltas e cancelamentos',
  diario_pendente: 'Diário de saúde pendente',
  questionario_pendente: 'Questionários sem resposta',
  nps_recebido: 'Novo feedback NPS recebido',
};

export default function NotificationPreferences() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<Prefs>(defaultPrefs);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('preferencias_notificacao')
      .select('*')
      .eq('terapeuta_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPrefs({
            lembrete_consulta: data.lembrete_consulta,
            alerta_falta: data.alerta_falta,
            diario_pendente: data.diario_pendente,
            questionario_pendente: data.questionario_pendente,
            nps_recebido: data.nps_recebido,
          });
        }
      });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('preferencias_notificacao')
      .upsert({ terapeuta_id: user.id, ...prefs }, { onConflict: 'terapeuta_id' });
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Preferências salvas!' });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          Preferências de Notificação
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(Object.keys(labels) as (keyof Prefs)[]).map(key => (
          <div key={key} className="flex items-center justify-between">
            <Label htmlFor={key} className="text-sm cursor-pointer">{labels[key]}</Label>
            <Switch
              id={key}
              checked={prefs[key]}
              onCheckedChange={v => setPrefs(p => ({ ...p, [key]: v }))}
            />
          </div>
        ))}
        <Button onClick={handleSave} disabled={saving} className="w-full mt-2" size="sm">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar preferências
        </Button>
      </CardContent>
    </Card>
  );
}
