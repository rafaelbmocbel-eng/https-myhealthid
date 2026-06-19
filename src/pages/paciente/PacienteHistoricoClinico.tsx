import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PacienteLayout from '@/components/paciente/PacienteLayout';
import ProtectedPatientRoute from '@/components/paciente/ProtectedPatientRoute';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ClipboardList, Loader2, Send, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Categorias provisórias — conteúdo/redação a ser refinado depois.
const PERGUNTAS = [
  { id: 'fratura', label: 'Você já teve alguma fratura óssea?', placeholder: 'Ex: fratura de pulso direito em 2015, após uma queda de bicicleta…' },
  { id: 'cirurgia', label: 'Já passou por alguma cirurgia de grande porte?', placeholder: 'Ex: cirurgia de joelho em 2020 (ligamento)…' },
  { id: 'pequena_cirurgia', label: 'Já fez algum pequeno procedimento cirúrgico (ex: retirada de pinta, endoscopia, biópsia)?', placeholder: 'Ex: retirada de nódulo na mama em 2019…' },
  { id: 'trauma_chicote', label: 'Já sofreu uma lesão tipo "chicote" (whiplash), como em batida de carro por trás?', placeholder: 'Ex: batida de carro por trás em 2018, dor no pescoço por semanas…' },
  { id: 'traumatismo', label: 'Já teve algum traumatismo importante (queda forte, golpe na cabeça, etc.)?', placeholder: 'Ex: queda de escada em 2012, bateu a cabeça…' },
  { id: 'acidente', label: 'Já se envolveu em acidente de carro ou moto?', placeholder: 'Ex: acidente de moto em 2017, fratura de clavícula…' },
  { id: 'malformacao', label: 'Tem alguma malformação ou condição congênita?', placeholder: 'Ex: escoliose congênita…' },
  { id: 'doenca_sistemica', label: 'Tem alguma doença sistêmica diagnosticada (diabetes, hipertensão, tireoide, autoimune, etc.)?', placeholder: 'Ex: diabetes tipo 2, diagnosticada em 2021…' },
  { id: 'tratamento_doenca', label: 'Está em tratamento ou já tratou alguma doença significativa?', placeholder: 'Ex: tratamento de câncer de mama, finalizado em 2022…' },
] as const;

export default function PacienteHistoricoClinico() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [respostas, setRespostas] = useState<Record<string, boolean>>({});
  const [detalhes, setDetalhes] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const toggle = (id: string, value: boolean) => {
    setRespostas(prev => ({ ...prev, [id]: value }));
    if (!value) setDetalhes(prev => ({ ...prev, [id]: '' }));
  };

  const positivas = PERGUNTAS.filter(p => respostas[p.id]);
  const faltamDetalhe = positivas.filter(p => (detalhes[p.id] || '').trim().length < 3);
  const podeEnviar = positivas.length > 0 && faltamDetalhe.length === 0;

  const enviar = async () => {
    if (!podeEnviar) return;
    setSubmitting(true);
    try {
      const answers = positivas.map(p => ({
        categoria: p.id,
        pergunta: p.label,
        resposta: (detalhes[p.id] || '').trim(),
      }));

      const { REGIONS } = await import('@/components/presencial/Body3DAvatar');
      const { VISCERAL_REGIONS } = await import('@/utils/anatomia/regioesViscerais');
      const regions = [
        ...REGIONS.map(r => ({ id: r.id, label: r.label, sistemas: ['musculoesqueletico'] })),
        ...VISCERAL_REGIONS.map(r => ({ id: r.id, label: r.label, sistemas: r.sistemas })),
      ];

      const { data, error } = await supabase.functions.invoke('triagem-historico-clinico', {
        body: { answers, regions },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: '✅ Histórico enviado',
        description: 'Seu profissional vai revisar e decidir o que entra no seu Avatar Clínico.',
      });
      navigate('/paciente/dashboard');
    } catch (e: any) {
      toast({
        title: 'Não foi possível enviar',
        description: e?.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProtectedPatientRoute>
      <PacienteLayout>
        <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
          <div>
            <h1 className="h-page flex items-center gap-2">
              <ClipboardList className="icon-md text-primary" /> Histórico Clínico
            </h1>
            <p className="text-caption mt-0.5">
              Conte sobre fraturas, cirurgias, traumas e outras condições do seu passado de saúde.
              Seu profissional revisa tudo antes de qualquer coisa entrar no seu prontuário.
            </p>
          </div>

          <div className="space-y-3">
            {PERGUNTAS.map(p => {
              const ativo = !!respostas[p.id];
              const detalheFaltando = ativo && (detalhes[p.id] || '').trim().length < 3;
              return (
                <Card key={p.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <Label className="text-sm font-medium leading-snug">{p.label}</Label>
                      <Switch checked={ativo} onCheckedChange={(v) => toggle(p.id, v)} />
                    </div>
                    {ativo && (
                      <Textarea
                        value={detalhes[p.id] || ''}
                        onChange={e => setDetalhes(prev => ({ ...prev, [p.id]: e.target.value }))}
                        placeholder={p.placeholder}
                        rows={3}
                        className={detalheFaltando ? 'border-destructive' : ''}
                        style={{ fontSize: '16px' }}
                      />
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <p className="text-micro text-muted-foreground">
            {positivas.length === 0
              ? 'Marque "sim" nas opções que se aplicam ao seu caso e descreva brevemente.'
              : `${positivas.length} item${positivas.length > 1 ? 's' : ''} marcado${positivas.length > 1 ? 's' : ''}${faltamDetalhe.length > 0 ? ' — descreva todos antes de enviar' : '.'}`}
          </p>

          <Button onClick={enviar} disabled={!podeEnviar || submitting} className="w-full gap-2">
            {submitting ? <Loader2 className="icon-sm animate-spin" /> : positivas.length > 0 ? <Send className="icon-sm" /> : <Check className="icon-sm" />}
            {submitting ? 'Enviando…' : 'Enviar para meu profissional'}
          </Button>
        </div>
      </PacienteLayout>
    </ProtectedPatientRoute>
  );
}
