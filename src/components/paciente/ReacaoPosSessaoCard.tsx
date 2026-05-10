import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { ThumbsUp, ThumbsDown, Meh, Loader2, Heart } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  pacienteId: string;
}

interface SessaoPendente {
  id: string;
  data_sessao: string;
  terapeuta_id: string;
}

export default function ReacaoPosSessaoCard({ pacienteId }: Props) {
  const { toast } = useToast();
  const [sessao, setSessao] = useState<SessaoPendente | null>(null);
  const [loading, setLoading] = useState(true);
  const [escolha, setEscolha] = useState<'pos' | 'neutro' | 'neg' | null>(null);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    const buscar = async () => {
      const desde = new Date();
      desde.setHours(desde.getHours() - 72);

      const { data: sessoes } = await supabase
        .from('controle_sessoes')
        .select('id, data_sessao, terapeuta_id')
        .eq('paciente_id', pacienteId)
        .eq('status', 'realizada')
        .gte('data_sessao', desde.toISOString())
        .lte('data_sessao', new Date().toISOString())
        .order('data_sessao', { ascending: false })
        .limit(5);

      if (!sessoes || sessoes.length === 0) {
        setLoading(false);
        return;
      }

      // Verifica quais já têm NPS
      const ids = sessoes.map((s) => s.id);
      const { data: jaResponderam } = await supabase
        .from('pesquisas_nps')
        .select('sessao_id')
        .in('sessao_id', ids);

      const respondidas = new Set((jaResponderam || []).map((n: any) => n.sessao_id));
      const pendente = sessoes.find((s) => !respondidas.has(s.id));
      setSessao(pendente ?? null);
      setLoading(false);
    };

    buscar();
  }, [pacienteId]);

  const enviar = async () => {
    if (!escolha || !sessao) return;
    setEnviando(true);
    const nota = escolha === 'pos' ? 10 : escolha === 'neutro' ? 5 : 0;
    try {
      const { error } = await supabase.from('pesquisas_nps').insert({
        paciente_id: pacienteId,
        terapeuta_id: sessao.terapeuta_id,
        sessao_id: sessao.id,
        nota,
        comentario: comentario.trim() || null,
      });
      if (error) throw error;

      // Alerta automático ao profissional se reação foi negativa
      if (escolha === 'neg') {
        await supabase.from('chat_mensagens').insert({
          paciente_id: pacienteId,
          terapeuta_id: sessao.terapeuta_id,
          remetente: 'sistema',
          tipo: 'alerta',
          mensagem: `⚠️ Paciente registrou reação negativa após sessão de ${format(parseISO(sessao.data_sessao), "dd/MM HH:mm", { locale: ptBR })}.${
            comentario.trim() ? `\n\nComentário: "${comentario.trim()}"` : ''
          }`,
          metadata: { origem: 'nps_pos_sessao', nota: 0 },
        });
      }

      setEnviado(true);
      toast({ title: '💙 Obrigado pelo seu feedback!' });
    } catch (e: any) {
      toast({ title: 'Erro ao enviar', description: e.message ?? 'Tente novamente.', variant: 'destructive' });
    } finally {
      setEnviando(false);
    }
  };

  if (loading || !sessao || enviado) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <Heart className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">Como foi sua última sessão?</p>
              <p className="text-[11px] text-muted-foreground">
                {format(parseISO(sessao.data_sessao), "EEE, dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {([
              { key: 'pos', icon: ThumbsUp, label: 'Boa', color: 'emerald' },
              { key: 'neutro', icon: Meh, label: 'Mais ou menos', color: 'amber' },
              { key: 'neg', icon: ThumbsDown, label: 'Difícil', color: 'rose' },
            ] as const).map((opt) => {
              const Icon = opt.icon;
              const ativo = escolha === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => setEscolha(opt.key)}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-lg border transition-all ${
                    ativo
                      ? opt.color === 'emerald'
                        ? 'bg-emerald-500 border-emerald-600 text-white'
                        : opt.color === 'amber'
                          ? 'bg-amber-500 border-amber-600 text-white'
                          : 'bg-rose-500 border-rose-600 text-white'
                      : 'bg-background border-border/40 text-foreground hover:border-primary/40'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] font-semibold">{opt.label}</span>
                </button>
              );
            })}
          </div>

          <AnimatePresence>
            {escolha && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <Textarea
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder={escolha === 'neg' ? 'Quer contar o que aconteceu? (opcional)' : 'Quer comentar algo? (opcional)'}
                  className="mt-3 min-h-[60px] text-sm resize-none"
                  maxLength={300}
                  style={{ fontSize: '16px' }}
                />
                <Button
                  className="w-full mt-2 h-9"
                  size="sm"
                  onClick={enviar}
                  disabled={enviando}
                >
                  {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar feedback'}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}
